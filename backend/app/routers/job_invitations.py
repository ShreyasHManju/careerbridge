from typing import List
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.job_invitation import InvitationStatus
from app.models.user import User, UserRole
from app.schemas.job_invitation import (
    JobInvitationCreate,
    JobInvitationResponse,
    JobInvitationUpdate,
)
from app.services.job_invitation_service import JobInvitationService

router = APIRouter(tags=["Job Invitations"])


@router.post(
    "/jobs/{job_id}/invitations",
    response_model=JobInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a student candidate to apply for a job posting",
    description="Allows the recruiter who owns the job posting to send a proactive invitation to an eligible student.",
)
def invite_candidate_to_job(
    job_id: int = Path(..., ge=1, description="Unique job posting ID"),
    payload: JobInvitationCreate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    return JobInvitationService.create_invitation(
        db=db,
        job_id=job_id,
        recruiter_id=current_user.id,
        student_id=payload.student_id,
        message=payload.message,
    )


@router.get(
    "/jobs/{job_id}/invitations",
    response_model=List[JobInvitationResponse],
    summary="List invitations sent for a job posting",
    description="Allows the recruiter who owns the job posting to view all outreach invitations sent.",
)
def list_job_invitations(
    job_id: int = Path(..., ge=1, description="Unique job posting ID"),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    return JobInvitationService.list_job_invitations(
        db=db,
        job_id=job_id,
        recruiter_id=current_user.id,
    )


@router.get(
    "/student/invitations",
    response_model=List[JobInvitationResponse],
    summary="List job invitations received by the authenticated student",
    description="Retrieves all invitations sent by recruiters inviting the student to apply.",
)
def list_student_invitations(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    return JobInvitationService.list_student_invitations(
        db=db,
        student_id=current_user.id,
    )


@router.patch(
    "/invitations/{invitation_id}",
    response_model=JobInvitationResponse,
    summary="Respond to a job invitation (Accept or Decline)",
    description="Allows the invited student to accept or decline the invitation.",
)
def respond_to_job_invitation(
    invitation_id: int = Path(..., ge=1, description="Unique job invitation ID"),
    payload: JobInvitationUpdate = ...,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    return JobInvitationService.respond_to_invitation(
        db=db,
        invitation_id=invitation_id,
        student_id=current_user.id,
        new_status=payload.status,
    )
