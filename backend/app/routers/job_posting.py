from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.job_posting import JobPosting
from app.models.user import User, UserRole
from app.schemas.job_posting import (
    JobPostingCreate,
    JobPostingResponse,
    JobPostingUpdate,
)

router = APIRouter(prefix="/jobs", tags=["Jobs & Internships"])


@router.post(
    "",
    response_model=JobPostingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new job or internship posting",
    description="Allows an authenticated recruiter to post a new job or internship opportunity. Ownership is securely bound to current_user.id.",
)
@router.post(
    "/",
    response_model=JobPostingResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_job_posting(
    payload: JobPostingCreate,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Create a new job posting for the authenticated recruiter.
    Enforces:
    - Recruiter-only access (require_role(UserRole.RECRUITER)).
    - Secure ownership: recruiter_id is derived strictly from current_user.id.
    """
    posting_data = payload.model_dump()
    new_posting = JobPosting(
        recruiter_id=current_user.id,
        **posting_data,
    )
    db.add(new_posting)
    db.commit()
    db.refresh(new_posting)
    return new_posting


@router.get(
    "/my",
    response_model=List[JobPostingResponse],
    summary="List postings owned by authenticated recruiter",
    description="Retrieves all job and internship postings (both active and inactive) created by the currently authenticated recruiter.",
)
def get_my_job_postings(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Retrieve all postings owned by the authenticated recruiter, newest first.
    Never exposes another recruiter's postings.
    """
    postings = db.scalars(
        select(JobPosting)
        .where(JobPosting.recruiter_id == current_user.id)
        .order_by(JobPosting.created_at.desc())
    ).all()
    return postings


@router.get(
    "",
    response_model=List[JobPostingResponse],
    summary="Browse active job and internship postings",
    description="Public candidate discovery endpoint. Returns all active postings ordered newest first. Inactive postings are strictly omitted.",
)
@router.get("/", response_model=List[JobPostingResponse], include_in_schema=False)
def browse_active_job_postings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Candidate discovery: Returns all active postings, ordered newest first.
    """
    postings = db.scalars(
        select(JobPosting)
        .where(JobPosting.is_active == True)
        .order_by(JobPosting.created_at.desc())
    ).all()
    return postings


@router.get(
    "/{job_id}",
    response_model=JobPostingResponse,
    summary="Get single job posting details",
    description="Retrieve details of a job posting by ID. Inactive postings are hidden from candidates (404) but accessible to the owning recruiter or admin.",
)
def get_job_posting_by_id(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve single job posting.
    Hides inactive postings from unauthorized candidates by returning 404.
    """
    posting = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not posting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    # Inactive posting visibility guard
    if not posting.is_active:
        is_owner = (
            current_user.role == UserRole.RECRUITER
            and posting.recruiter_id == current_user.id
        )
        is_admin = current_user.role == UserRole.ADMIN
        if not (is_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job posting not found",
            )

    return posting


@router.patch(
    "/{job_id}",
    response_model=JobPostingResponse,
    summary="Update a job posting",
    description="Allows the owning recruiter to partially update a job posting. Rejects attempts by other recruiters (403).",
)
def update_job_posting(
    job_id: int,
    payload: JobPostingUpdate,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Partially update existing job posting.
    Enforces:
    - Posting existence (404).
    - Ownership verification: caller must own posting (403).
    - Ownership immutability: recruiter_id cannot be changed.
    - Cross-field salary integrity check.
    """
    posting = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not posting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    if posting.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to modify this job posting",
        )

    update_data = payload.model_dump(exclude_unset=True)
    # Strictly strip any attempt to modify ownership
    update_data.pop("recruiter_id", None)

    # Cross-field salary consistency check for partial updates
    new_min = update_data.get("salary_min", posting.salary_min)
    new_max = update_data.get("salary_max", posting.salary_max)
    if new_min is not None and new_max is not None and new_max < new_min:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="salary_max cannot be less than salary_min",
        )

    for field, value in update_data.items():
        setattr(posting, field, value)

    db.commit()
    db.refresh(posting)
    return posting


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a job posting",
    description="Allows the owning recruiter to permanently delete a job posting. Rejects attempts by other recruiters (403).",
)
def delete_job_posting(
    job_id: int,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Delete existing job posting.
    Enforces:
    - Posting existence (404).
    - Ownership verification: caller must own posting (403).
    """
    posting = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not posting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    if posting.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete this job posting",
        )

    db.delete(posting)
    db.commit()
    return None
