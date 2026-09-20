from typing import List
from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import require_role
from app.models.job_posting import JobPosting
from app.models.saved_job import SavedJob
from app.models.user import User, UserRole
from app.schemas.saved_job import SavedJobResponse, SavedJobStatusResponse

router = APIRouter(tags=["Saved Jobs"])


# --------------------------------------------------------------------------
# Save Job Posting
# --------------------------------------------------------------------------
@router.post(
    "/jobs/{job_id}/save",
    response_model=SavedJobStatusResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save / bookmark an active job posting",
    description="Allows an authenticated student to bookmark an active job or internship posting. Ownership is strictly bound to current_user.id.",
)
def save_job_posting(
    job_id: int = Path(..., ge=1, description="Primary key identifier of the job posting to bookmark"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Save a job posting:
    - Verifies job exists (404).
    - Verifies job is active (400).
    - Checks duplicate save (409).
    - Derives student_id strictly from current_user.id.
    - Persists record and returns saved status.
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
            detail="Cannot save inactive job posting",
        )

    # Check for duplicate save
    existing = db.scalar(
        select(SavedJob).where(
            SavedJob.job_posting_id == job_id,
            SavedJob.student_id == current_user.id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Job posting is already saved",
        )

    new_saved = SavedJob(
        student_id=current_user.id,
        job_posting_id=job_id,
    )
    db.add(new_saved)
    try:
        db.commit()
        db.refresh(new_saved)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Job posting is already saved",
        )

    return SavedJobStatusResponse(
        job_id=job_id,
        is_saved=True,
        saved_at=new_saved.created_at,
    )


# --------------------------------------------------------------------------
# Check Saved Job Status
# --------------------------------------------------------------------------
@router.get(
    "/jobs/{job_id}/saved",
    response_model=SavedJobStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Check if a job posting is saved by the current student",
    description="Returns whether the specified job is saved by the authenticated student along with the saved_at timestamp.",
)
def check_saved_job_status(
    job_id: int = Path(..., ge=1, description="Primary key identifier of the job posting to inspect"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Check if a job posting is saved:
    - Verifies job exists (404).
    - Checks if a saved_job record exists for current_user.id.
    - Returns is_saved boolean and saved_at timestamp.
    """
    job = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    saved = db.scalar(
        select(SavedJob).where(
            SavedJob.job_posting_id == job_id,
            SavedJob.student_id == current_user.id,
        )
    )

    if saved:
        return SavedJobStatusResponse(
            job_id=job_id,
            is_saved=True,
            saved_at=saved.created_at,
        )

    return SavedJobStatusResponse(
        job_id=job_id,
        is_saved=False,
        saved_at=None,
    )


# --------------------------------------------------------------------------
# Remove Saved Job (Unsave)
# --------------------------------------------------------------------------
@router.delete(
    "/jobs/{job_id}/save",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a saved job posting",
    description="Allows an authenticated student to remove a bookmark for a job posting. Returns 204 No Content on success.",
)
def remove_saved_job(
    job_id: int = Path(..., ge=1, description="Primary key identifier of the job posting to unbookmark"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Remove a saved job posting:
    - Finds the saved_job record for current_user.id and job_id.
    - Returns 404 if record does not exist.
    - Deletes record and returns 204 No Content.
    """
    saved = db.scalar(
        select(SavedJob).where(
            SavedJob.job_posting_id == job_id,
            SavedJob.student_id == current_user.id,
        )
    )
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved job record not found",
        )

    db.delete(saved)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------
# List Saved Jobs
# --------------------------------------------------------------------------
@router.get(
    "/saved-jobs",
    response_model=List[SavedJobResponse],
    status_code=status.HTTP_200_OK,
    summary="List all saved jobs for current student",
    description="Retrieves all job and internship postings bookmarked by the authenticated student, ordered newest saved first. Includes inactive jobs if saved earlier.",
)
def list_saved_jobs(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    List all jobs saved by the authenticated student:
    - Joined with JobPosting to avoid N+1 queries.
    - Ordered by created_at DESC (newest saved first), then id DESC.
    - Formats both job fields and saved_at.
    """
    saved_entries = db.scalars(
        select(SavedJob)
        .options(joinedload(SavedJob.job_posting))
        .where(SavedJob.student_id == current_user.id)
        .order_by(SavedJob.created_at.desc(), SavedJob.id.desc())
    ).all()

    results: List[SavedJobResponse] = []
    for entry in saved_entries:
        job = entry.job_posting
        results.append(
            SavedJobResponse(
                id=job.id,
                saved_id=entry.id,
                title=job.title,
                description=job.description,
                opportunity_type=job.opportunity_type,
                company_name=job.company_name,
                location=job.location,
                is_remote=job.is_remote,
                employment_type=job.employment_type,
                skills=job.skills,
                minimum_qualification=job.minimum_qualification,
                experience_required=job.experience_required,
                salary_min=job.salary_min,
                salary_max=job.salary_max,
                application_deadline=job.application_deadline,
                is_active=job.is_active,
                created_at=job.created_at,
                updated_at=job.updated_at,
                saved_at=entry.created_at,
            )
        )

    return results
