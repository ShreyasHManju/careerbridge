from typing import List
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.job_offer import (
    JobOfferCreate,
    JobOfferResponse,
    JobOfferUpdate,
)
from app.services.job_offer_service import JobOfferService

router = APIRouter(tags=["Job Offers"])


# =========================================================================
# Application-scoped Job Offer Endpoints
# =========================================================================

@router.post(
    "/applications/{application_id}/offers",
    response_model=JobOfferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create job offer for an application",
    description="Allows an authorized recruiter to create a draft or direct job offer for a candidate application.",
)
def create_job_offer(
    application_id: int = Path(..., ge=1, description="Primary key identifier of the candidate application"),
    payload: JobOfferCreate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Create a new JobOffer for an application:
    - Enforces recruiter role and job posting ownership (403).
    - Prevents duplicate offers for the same application (409).
    - If is_sent is True, transitions application status to OFFERED.
    """
    return JobOfferService.create_offer(
        db=db,
        application_id=application_id,
        recruiter_user=current_user,
        payload=payload,
    )


@router.get(
    "/applications/{application_id}/offers",
    response_model=JobOfferResponse,
    summary="Get job offer for an application",
    description="Retrieves the job offer for the specified application. Accessible by the owning recruiter or applicant student (if released).",
)
def get_application_job_offer(
    application_id: int = Path(..., ge=1, description="Primary key identifier of the candidate application"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get job offer associated with an application.
    Enforces authorization:
    - Students may only view released offers for their own applications (403/404).
    - Recruiters may only view offers for their own job postings (403).
    """
    return JobOfferService.get_offer_by_application_id(
        db=db,
        application_id=application_id,
        current_user=current_user,
    )


# =========================================================================
# Standalone Job Offer Lifecycle Endpoints (/offers/{offer_id})
# =========================================================================

@router.get(
    "/offers/{offer_id}",
    response_model=JobOfferResponse,
    summary="Get job offer by ID",
    description="Retrieves details of a specific job offer for authorized recruiter or candidate student.",
)
def get_job_offer_by_id(
    offer_id: int = Path(..., ge=1, description="Primary key identifier of the job offer"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get single job offer with strict IDOR protections:
    - Recruiter must own the job posting (403).
    - Student must own the application (403), and draft offers are not visible (404).
    """
    return JobOfferService.get_offer_by_id(
        db=db,
        offer_id=offer_id,
        current_user=current_user,
    )


@router.patch(
    "/offers/{offer_id}",
    response_model=JobOfferResponse,
    summary="Update job offer",
    description="Allows the owning recruiter to update offer terms, compensation, dates, or lifecycle status.",
)
def update_job_offer(
    offer_id: int = Path(..., ge=1, description="Primary key identifier of the job offer"),
    payload: JobOfferUpdate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Update a job offer. Enforces ownership and lifecycle transition rules.
    """
    return JobOfferService.update_offer(
        db=db,
        offer_id=offer_id,
        recruiter_user=current_user,
        payload=payload,
    )


@router.post(
    "/offers/{offer_id}/send",
    response_model=JobOfferResponse,
    summary="Send draft job offer",
    description="Transitions a DRAFT offer to OFFERED and sets Application status to OFFERED.",
)
def send_job_offer(
    offer_id: int = Path(..., ge=1, description="Primary key identifier of the job offer"),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Send a draft offer to the candidate student.
    """
    return JobOfferService.send_offer(
        db=db,
        offer_id=offer_id,
        recruiter_user=current_user,
    )


@router.post(
    "/offers/{offer_id}/withdraw",
    response_model=JobOfferResponse,
    summary="Withdraw job offer",
    description="Allows the recruiter to withdraw a draft or active offer.",
)
def withdraw_job_offer(
    offer_id: int = Path(..., ge=1, description="Primary key identifier of the job offer"),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Withdraw a job offer.
    """
    return JobOfferService.withdraw_offer(
        db=db,
        offer_id=offer_id,
        recruiter_user=current_user,
    )


@router.post(
    "/offers/{offer_id}/accept",
    response_model=JobOfferResponse,
    summary="Accept job offer",
    description="Allows a student candidate to accept an extended job offer, transitioning both offer and application to ACCEPTED and creating a verified ExperienceRecord.",
)
def accept_job_offer(
    offer_id: int = Path(..., ge=1, description="Primary key identifier of the job offer"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Accept an active job offer (Student-only).
    """
    return JobOfferService.accept_offer(
        db=db,
        offer_id=offer_id,
        student_user=current_user,
    )


@router.post(
    "/offers/{offer_id}/reject",
    response_model=JobOfferResponse,
    summary="Decline job offer",
    description="Allows a student candidate to decline/reject an extended job offer, transitioning both offer and application to REJECTED.",
)
def reject_job_offer(
    offer_id: int = Path(..., ge=1, description="Primary key identifier of the job offer"),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    Decline an active job offer (Student-only).
    """
    return JobOfferService.reject_offer(
        db=db,
        offer_id=offer_id,
        student_user=current_user,
    )


# =========================================================================
# Collection Endpoints
# =========================================================================

@router.get(
    "/recruiter/offers",
    response_model=List[JobOfferResponse],
    summary="List recruiter's job offers",
    description="Retrieves all job offers created by the authenticated recruiter across all their job postings.",
)
def list_recruiter_job_offers(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    List all job offers created by current recruiter.
    """
    return JobOfferService.list_recruiter_offers(
        db=db,
        recruiter_user=current_user,
    )


@router.get(
    "/student/offers",
    response_model=List[JobOfferResponse],
    summary="List student's received job offers",
    description="Retrieves all released (non-draft) job offers extended to the authenticated student.",
)
def list_student_job_offers(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """
    List all job offers received by current student.
    """
    return JobOfferService.list_student_offers(
        db=db,
        student_user=current_user,
    )
