from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import require_role
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminJobStatusUpdate,
    AdminRecruiterPaginationResponse,
    AdminRecruiterResponse,
    AdminRecruiterVerificationUpdate,
    AdminUserPaginationResponse,
    AdminUserStatusUpdate,
)
from app.schemas.job_posting import JobPostingPaginationResponse, JobPostingResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


# --------------------------------------------------------------------------
# User Management Endpoints
# --------------------------------------------------------------------------
@router.get(
    "/users",
    response_model=AdminUserPaginationResponse,
    status_code=status.HTTP_200_OK,
    summary="List all users with filtering, search, and pagination",
    description="Administrative endpoint to query platform users. Supports search by email, filtering by role and active status, and database pagination. Ordered newest-first.",
)
def list_users(
    search: Optional[str] = Query(None, description="Search matching user email"),
    role: Optional[UserRole] = Query(None, description="Filter by user role (student, recruiter, admin)"),
    is_active: Optional[bool] = Query(None, description="Filter by active account status"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    conditions = []
    if search:
        conditions.append(User.email.ilike(f"%{search.strip()}%"))
    if role is not None:
        conditions.append(User.role == role)
    if is_active is not None:
        conditions.append(User.is_active == is_active)

    # Database-side total count
    count_stmt = select(func.count()).select_from(User).where(*conditions)
    total = db.scalar(count_stmt) or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    # Paginated query ordered newest-first
    stmt = (
        select(User)
        .where(*conditions)
        .order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    users = db.scalars(stmt).all()

    return AdminUserPaginationResponse(
        items=users,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user details by ID",
    description="Administrative endpoint to inspect a specific user account. Returns safe user metadata and excludes sensitive credential fields.",
)
def get_user_detail(
    user_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.patch(
    "/users/{user_id}/status",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Activate or deactivate a user account",
    description="Administrative endpoint to toggle user activity. Enforces self-lockout prevention to prohibit an administrator from deactivating their own account.",
)
def update_user_status(
    user_id: int,
    payload: AdminUserStatusUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Self-deactivation prevention: an admin cannot deactivate their currently authenticated account
    if user.id == current_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account",
        )

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


# --------------------------------------------------------------------------
# Recruiter Moderation Endpoints
# --------------------------------------------------------------------------
@router.get(
    "/recruiters",
    response_model=AdminRecruiterPaginationResponse,
    status_code=status.HTTP_200_OK,
    summary="List recruiters with verification filtering and search",
    description="Administrative endpoint to review recruiter profiles. Supports search across email, company name, and contact name, and filtering by verification status. Avoids N+1 queries.",
)
def list_recruiters(
    search: Optional[str] = Query(None, description="Search term for company name, contact name, or recruiter email"),
    is_verified: Optional[bool] = Query(None, description="Filter by recruiter verification status"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    conditions = []
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                User.email.ilike(term),
                RecruiterProfile.company_name.ilike(term),
                RecruiterProfile.contact_name.ilike(term),
            )
        )
    if is_verified is not None:
        conditions.append(RecruiterProfile.is_verified == is_verified)

    # Database-side total count
    count_stmt = (
        select(func.count())
        .select_from(RecruiterProfile)
        .join(User, RecruiterProfile.user_id == User.id)
        .where(*conditions)
    )
    total = db.scalar(count_stmt) or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    # Paginated query joining User to eliminate N+1 queries
    stmt = (
        select(RecruiterProfile)
        .join(User, RecruiterProfile.user_id == User.id)
        .options(joinedload(RecruiterProfile.user))
        .where(*conditions)
        .order_by(RecruiterProfile.created_at.desc(), RecruiterProfile.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    profiles = db.scalars(stmt).all()

    items = [
        AdminRecruiterResponse(
            id=p.id,
            user_id=p.user_id,
            email=p.user.email if p.user else None,
            company_name=p.company_name,
            company_description=p.company_description,
            contact_name=p.contact_name,
            phone=p.phone,
            company_website=p.company_website,
            company_location=p.company_location,
            industry=p.industry,
            company_size=p.company_size,
            is_verified=p.is_verified,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in profiles
    ]

    return AdminRecruiterPaginationResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.patch(
    "/recruiters/{user_id}/verification",
    response_model=AdminRecruiterResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify or unverify a recruiter",
    description="Administrative endpoint to update recruiter verification status. Validates target user is a recruiter and has an existing profile.",
)
def update_recruiter_verification(
    user_id: int,
    payload: AdminRecruiterVerificationUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    target_user = db.scalar(select(User).where(User.id == user_id))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if target_user.role != UserRole.RECRUITER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user is not a recruiter",
        )

    profile = db.scalar(
        select(RecruiterProfile)
        .options(joinedload(RecruiterProfile.user))
        .where(RecruiterProfile.user_id == user_id)
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found",
        )

    profile.is_verified = payload.is_verified
    target_user.is_verified = payload.is_verified
    db.commit()
    db.refresh(profile)

    return AdminRecruiterResponse(
        id=profile.id,
        user_id=profile.user_id,
        email=target_user.email,
        company_name=profile.company_name,
        company_description=profile.company_description,
        contact_name=profile.contact_name,
        phone=profile.phone,
        company_website=profile.company_website,
        company_location=profile.company_location,
        industry=profile.industry,
        company_size=profile.company_size,
        is_verified=profile.is_verified,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


# --------------------------------------------------------------------------
# Job Moderation Endpoints
# --------------------------------------------------------------------------
@router.get(
    "/jobs",
    response_model=JobPostingPaginationResponse,
    status_code=status.HTTP_200_OK,
    summary="List all job postings for moderation",
    description="Administrative endpoint to review all job postings across the platform, including both active and inactive postings. Supports search, type filters, and pagination.",
)
def list_jobs_for_moderation(
    search: Optional[str] = Query(None, description="Search matching title, company name, or location"),
    opportunity_type: Optional[OpportunityType] = Query(None, description="Filter by internship or job"),
    employment_type: Optional[EmploymentType] = Query(None, description="Filter by employment type"),
    is_active: Optional[bool] = Query(None, description="Filter by active or inactive status"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    conditions = []
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                JobPosting.title.ilike(term),
                JobPosting.company_name.ilike(term),
                JobPosting.location.ilike(term),
            )
        )
    if opportunity_type is not None:
        conditions.append(JobPosting.opportunity_type == opportunity_type)
    if employment_type is not None:
        conditions.append(JobPosting.employment_type == employment_type)
    if is_active is not None:
        conditions.append(JobPosting.is_active == is_active)

    count_stmt = select(func.count()).select_from(JobPosting).where(*conditions)
    total = db.scalar(count_stmt) or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    stmt = (
        select(JobPosting)
        .where(*conditions)
        .order_by(JobPosting.created_at.desc(), JobPosting.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    jobs = db.scalars(stmt).all()

    return JobPostingPaginationResponse(
        items=jobs,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.patch(
    "/jobs/{job_id}/status",
    response_model=JobPostingResponse,
    status_code=status.HTTP_200_OK,
    summary="Activate or deactivate a job posting",
    description="Administrative endpoint to moderate job posting visibility. Only updates is_active, leaving recruiter ownership and opportunity details intact.",
)
def update_job_status(
    job_id: int,
    payload: AdminJobStatusUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    job.is_active = payload.is_active
    db.commit()
    db.refresh(job)
    return job
