from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.application import Application, ApplicationStatus
from app.models.job_posting import JobPosting
from app.models.user import User, UserRole
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
)

router = APIRouter(tags=["Applications"])


# --------------------------------------------------------------------------
# Student Application Submission
# --------------------------------------------------------------------------
@router.post(
    "/jobs/{job_id}/applications",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an application to a job posting",
    description="Allows an authenticated student to apply to an active job or internship posting. Ownership is securely bound to current_user.id.",
)
def apply_to_job_posting(
    job_id: int,
    payload: ApplicationCreate,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Apply to a job posting:
    - Verifies job exists (404).
    - Verifies job is active (400).
    - Checks duplicate application (409).
    - Derives student_id strictly from current_user.id.
    - Sets initial status to 'applied'.
    """
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    if not job.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot apply to inactive job posting",
        )

    # Check for duplicate submission
    existing = db.scalar(
        select(Application).where(
            Application.job_posting_id == job_id,
            Application.student_id == current_user.id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied to this job posting",
        )

    new_app = Application(
        job_posting_id=job_id,
        student_id=current_user.id,
        status=ApplicationStatus.APPLIED,
        cover_message=payload.cover_message,
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app


# --------------------------------------------------------------------------
# Student Application Listing & Detail
# --------------------------------------------------------------------------
@router.get(
    "/applications/me",
    response_model=List[ApplicationResponse],
    summary="List all applications submitted by current student",
    description="Retrieves all applications submitted by the authenticated student, ordered newest first.",
)
def get_my_applications(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Retrieve current student's submitted applications.
    Strictly isolated to current_user.id.
    """
    apps = db.scalars(
        select(Application)
        .where(Application.student_id == current_user.id)
        .order_by(Application.created_at.desc())
    ).all()
    return apps


@router.get(
    "/applications/{application_id}",
    response_model=ApplicationResponse,
    summary="Get single application details",
    description="Retrieve details of a single application. Accessible by the applicant student, the hiring recruiter, or admin.",
)
def get_application_by_id(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve single application.
    Enforces authorization:
    - Students may only view their own application (403).
    - Recruiters may only view applications to their own job postings (403).
    - Admins may view any application.
    """
    application = db.scalar(
        select(Application).where(Application.id == application_id)
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.STUDENT:
        if application.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to view this application",
            )
    elif current_user.role == UserRole.RECRUITER:
        if application.job_posting.recruiter_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to view this application",
            )

    return application


# --------------------------------------------------------------------------
# Recruiter Application Review & Status Updates
# --------------------------------------------------------------------------
@router.get(
    "/recruiter/applications",
    response_model=List[ApplicationResponse],
    summary="List applications received for recruiter's job postings",
    description="Retrieves all candidate applications submitted across all job postings owned by the authenticated recruiter.",
)
def get_recruiter_applications(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    List all applications for postings owned by current recruiter.
    """
    apps = db.scalars(
        select(Application)
        .join(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(JobPosting.recruiter_id == current_user.id)
        .order_by(Application.created_at.desc())
    ).all()
    return apps


@router.get(
    "/recruiter/applications/{application_id}",
    response_model=ApplicationResponse,
    summary="Get single application details (Recruiter view)",
    description="Retrieves single candidate application for a job posting owned by the authenticated recruiter.",
)
def get_recruiter_application_by_id(
    application_id: int,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Recruiter detail view:
    Rejects cross-recruiter access with 403 Forbidden.
    """
    application = db.scalar(
        select(Application).where(Application.id == application_id)
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if application.job_posting.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view this application",
        )

    return application


@router.patch(
    "/recruiter/applications/{application_id}",
    response_model=ApplicationResponse,
    summary="Update application status (Recruiter only)",
    description="Allows the hiring recruiter to transition application status (applied, reviewing, shortlisted, rejected, accepted).",
)
def update_application_status(
    application_id: int,
    payload: ApplicationUpdate,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Update application status:
    - Rejects cross-recruiter mutations (403).
    - Prevents modification of student_id or job_posting_id.
    """
    application = db.scalar(
        select(Application).where(Application.id == application_id)
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if application.job_posting.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update this application",
        )

    application.status = payload.status
    db.commit()
    db.refresh(application)
    return application
