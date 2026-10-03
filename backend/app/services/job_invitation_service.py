from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.job_invitation import InvitationStatus, JobInvitation
from app.models.job_posting import JobPosting
from app.models.notification import NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.job_invitation import (
    JobInvitationJobSummary,
    JobInvitationRecruiterSummary,
    JobInvitationResponse,
    JobInvitationStudentSummary,
)
from app.services.notification_service import NotificationService


class JobInvitationService:
    @staticmethod
    def format_invitation_response(invitation: JobInvitation, db: Session) -> JobInvitationResponse:
        job = invitation.job_posting
        job_summary = None
        if job:
            job_summary = JobInvitationJobSummary(
                id=job.id,
                title=job.title,
                company_name=job.company_name,
                location=job.location,
                is_remote=job.is_remote,
                opportunity_type=job.opportunity_type.value if hasattr(job.opportunity_type, "value") else str(job.opportunity_type),
                is_active=job.is_active,
            )

        # Recruiter summary
        recruiter_profile = db.scalar(
            select(RecruiterProfile).where(RecruiterProfile.user_id == invitation.recruiter_id)
        )
        recruiter_summary = JobInvitationRecruiterSummary(
            id=invitation.recruiter_id,
            full_name=recruiter_profile.contact_name if recruiter_profile else None,
            company_name=recruiter_profile.company_name if recruiter_profile else (job.company_name if job else None),
        )

        # Student summary
        student_profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == invitation.student_id)
        )
        student_summary = JobInvitationStudentSummary(
            id=invitation.student_id,
            full_name=student_profile.full_name if student_profile else None,
            college=student_profile.college if student_profile else None,
            degree=student_profile.degree if student_profile else None,
        )

        return JobInvitationResponse(
            id=invitation.id,
            job_id=invitation.job_id,
            recruiter_id=invitation.recruiter_id,
            student_id=invitation.student_id,
            message=invitation.message,
            status=invitation.status,
            created_at=invitation.created_at,
            updated_at=invitation.updated_at,
            responded_at=invitation.responded_at,
            job_posting=job_summary,
            recruiter=recruiter_summary,
            student=student_summary,
        )

    @classmethod
    def create_invitation(
        cls,
        db: Session,
        *,
        job_id: int,
        recruiter_id: int,
        student_id: int,
        message: Optional[str] = None,
    ) -> JobInvitationResponse:
        # 1. Verify Job exists and is owned by recruiter
        job = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job posting not found",
            )
        if job.recruiter_id != recruiter_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only invite candidates to your own job postings",
            )
        if not job.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send invitations for an inactive job posting",
            )

        # 2. Cannot invite self
        if student_id == recruiter_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot invite yourself to a job posting",
            )

        # 3. Verify student exists and is active
        student = db.scalar(select(User).where(User.id == student_id))
        if not student or student.role != UserRole.STUDENT or not student.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Eligible candidate student not found",
            )

        # 4. Check for duplicate pending invitation
        existing_pending = db.scalar(
            select(JobInvitation).where(
                JobInvitation.job_id == job_id,
                JobInvitation.student_id == student_id,
                JobInvitation.status == InvitationStatus.PENDING,
            )
        )
        if existing_pending:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A pending invitation to apply for this job has already been sent to this student",
            )

        # 5. Create invitation
        invitation = JobInvitation(
            job_id=job_id,
            recruiter_id=recruiter_id,
            student_id=student_id,
            message=message.strip() if message and message.strip() else None,
            status=InvitationStatus.PENDING,
        )
        db.add(invitation)
        db.flush()

        # 6. Create in-app Notification for student
        recruiter_profile = db.scalar(
            select(RecruiterProfile).where(RecruiterProfile.user_id == recruiter_id)
        )
        company_label = job.company_name or (recruiter_profile.company_name if recruiter_profile else "A recruiter")
        NotificationService.create_notification(
            db,
            user_id=student_id,
            notification_type=NotificationType.JOB_INVITATION_RECEIVED,
            title=f"Invitation to apply: {job.title}",
            message=f"{company_label} has invited you to apply for {job.title}.",
            commit=False,
        )

        db.commit()
        db.refresh(invitation)

        return cls.format_invitation_response(invitation, db)

    @classmethod
    def list_student_invitations(
        cls,
        db: Session,
        *,
        student_id: int,
    ) -> List[JobInvitationResponse]:
        stmt = (
            select(JobInvitation)
            .where(JobInvitation.student_id == student_id)
            .options(
                selectinload(JobInvitation.job_posting),
            )
            .order_by(JobInvitation.created_at.desc(), JobInvitation.id.desc())
        )
        invitations = list(db.scalars(stmt).all())
        return [cls.format_invitation_response(inv, db) for inv in invitations]

    @classmethod
    def list_job_invitations(
        cls,
        db: Session,
        *,
        job_id: int,
        recruiter_id: int,
    ) -> List[JobInvitationResponse]:
        job = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job posting not found",
            )
        if job.recruiter_id != recruiter_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view invitations for this job posting",
            )

        stmt = (
            select(JobInvitation)
            .where(JobInvitation.job_id == job_id)
            .options(
                selectinload(JobInvitation.job_posting),
            )
            .order_by(JobInvitation.created_at.desc(), JobInvitation.id.desc())
        )
        invitations = list(db.scalars(stmt).all())
        return [cls.format_invitation_response(inv, db) for inv in invitations]

    @classmethod
    def respond_to_invitation(
        cls,
        db: Session,
        *,
        invitation_id: int,
        student_id: int,
        new_status: InvitationStatus,
    ) -> JobInvitationResponse:
        invitation = db.scalar(
            select(JobInvitation)
            .where(JobInvitation.id == invitation_id)
            .options(selectinload(JobInvitation.job_posting))
        )
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job invitation not found",
            )

        if invitation.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to respond to this invitation",
            )

        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This invitation has already been {invitation.status.value}",
            )

        invitation.status = new_status
        invitation.responded_at = datetime.now(timezone.utc)

        # Notify recruiter
        job_title = invitation.job_posting.title if invitation.job_posting else "job posting"
        student_profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == student_id)
        )
        candidate_name = student_profile.full_name if student_profile and student_profile.full_name else "A candidate"

        action_word = "accepted" if new_status == InvitationStatus.ACCEPTED else "declined"
        NotificationService.create_notification(
            db,
            user_id=invitation.recruiter_id,
            notification_type=NotificationType.JOB_INVITATION_RESPONDED,
            title=f"Invitation {action_word}: {job_title}",
            message=f"{candidate_name} has {action_word} your invitation to apply for {job_title}.",
            commit=False,
        )

        db.commit()
        db.refresh(invitation)
        return cls.format_invitation_response(invitation, db)
