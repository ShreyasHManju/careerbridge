from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application, ApplicationStatus
from app.models.interview import Interview, InterviewStatus
from app.models.job_posting import JobPosting
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.interview import InterviewCreate, InterviewUpdate
from app.services.notification_service import NotificationService


class InterviewService:
    """
    Domain service layer managing interview scheduling, double-booking conflict prevention,
    status transitions, and notification dispatching.
    """

    @staticmethod
    def check_conflicts(
        db: Session,
        *,
        recruiter_id: int,
        student_id: int,
        scheduled_at: datetime,
        duration_minutes: int,
        exclude_interview_id: Optional[int] = None,
    ) -> None:
        """
        Validate that neither the recruiter nor the student has an overlapping active interview.
        Active interviews are those with status SCHEDULED or RESCHEDULED.
        Two intervals [S1, E1) and [S2, E2) overlap iff S1 < E2 and E1 > S2.
        Raises HTTP 409 Conflict if an overlap exists.
        """
        # Ensure scheduled_at is timezone-aware
        start_time = (
            scheduled_at
            if scheduled_at.tzinfo is not None
            else scheduled_at.replace(tzinfo=timezone.utc)
        )
        end_time = start_time + timedelta(minutes=duration_minutes)

        active_statuses = [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]

        # 1. Check Recruiter active interviews
        recruiter_stmt = select(Interview).where(
            Interview.recruiter_id == recruiter_id,
            Interview.status.in_(active_statuses),
        )
        if exclude_interview_id is not None:
            recruiter_stmt = recruiter_stmt.where(Interview.id != exclude_interview_id)

        recruiter_interviews = db.scalars(recruiter_stmt).all()
        for item in recruiter_interviews:
            item_start = (
                item.scheduled_at
                if item.scheduled_at.tzinfo is not None
                else item.scheduled_at.replace(tzinfo=timezone.utc)
            )
            item_end = item_start + timedelta(minutes=item.duration_minutes)
            if start_time < item_end and end_time > item_start:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Recruiter has a conflicting interview scheduled during this time window",
                )

        # 2. Check Student active interviews
        student_stmt = select(Interview).where(
            Interview.student_id == student_id,
            Interview.status.in_(active_statuses),
        )
        if exclude_interview_id is not None:
            student_stmt = student_stmt.where(Interview.id != exclude_interview_id)

        student_interviews = db.scalars(student_stmt).all()
        for item in student_interviews:
            item_start = (
                item.scheduled_at
                if item.scheduled_at.tzinfo is not None
                else item.scheduled_at.replace(tzinfo=timezone.utc)
            )
            item_end = item_start + timedelta(minutes=item.duration_minutes)
            if start_time < item_end and end_time > item_start:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Student has a conflicting interview scheduled during this time window",
                )

    @classmethod
    def create_interview(
        cls,
        db: Session,
        *,
        application_id: int,
        recruiter_id: int,
        payload: InterviewCreate,
    ) -> Interview:
        """
        Schedule a new interview for a job application.
        Validates:
        - Application exists (404)
        - Recruiter owns the associated job posting (403)
        - Application is in an interview-eligible status (APPLIED, REVIEWING, SHORTLISTED) (400)
        - Neither recruiter nor student has a scheduling conflict (409)
        """
        application = db.scalar(
            select(Application)
            .options(
                joinedload(Application.job_posting),
                joinedload(Application.student),
            )
            .where(Application.id == application_id)
        )
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )

        if application.job_posting.recruiter_id != recruiter_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to schedule interviews for this application",
            )

        # Validate application status
        allowed_statuses = [
            ApplicationStatus.APPLIED,
            ApplicationStatus.REVIEWING,
            ApplicationStatus.SHORTLISTED,
        ]
        if application.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot schedule interview for application in '{application.status.value}' status",
            )

        # Check scheduling conflicts
        cls.check_conflicts(
            db,
            recruiter_id=recruiter_id,
            student_id=application.student_id,
            scheduled_at=payload.scheduled_at,
            duration_minutes=payload.duration_minutes,
        )

        interview = Interview(
            application_id=application.id,
            recruiter_id=recruiter_id,
            student_id=application.student_id,
            scheduled_at=payload.scheduled_at,
            duration_minutes=payload.duration_minutes,
            interview_type=payload.interview_type,
            location_or_link=payload.location_or_link,
            notes=payload.notes,
            status=InterviewStatus.SCHEDULED,
        )
        db.add(interview)

        # Create notification for candidate student
        formatted_time = payload.scheduled_at.strftime("%Y-%m-%d %H:%M UTC")
        NotificationService.create_notification(
            db,
            user_id=application.student_id,
            notification_type=NotificationType.INTERVIEW_SCHEDULED,
            title="Interview Scheduled",
            message=(
                f"An interview for '{application.job_posting.title}' at "
                f"'{application.job_posting.company_name}' has been scheduled for {formatted_time} "
                f"({payload.interview_type.value})."
            ),
        )

        db.commit()
        db.refresh(interview)
        return interview

    @classmethod
    def update_interview(
        cls,
        db: Session,
        *,
        interview_id: int,
        recruiter_id: int,
        payload: InterviewUpdate,
    ) -> Interview:
        """
        Update or reschedule an interview.
        Validates ownership, conflicts on time modification, and emits notifications.
        """
        interview = db.scalar(
            select(Interview)
            .options(
                joinedload(Interview.application).joinedload(Application.job_posting),
                joinedload(Interview.recruiter),
                joinedload(Interview.student),
            )
            .where(Interview.id == interview_id)
        )
        if not interview:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview not found",
            )

        if interview.recruiter_id != recruiter_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this interview",
            )

        # Determine if timing changed
        new_time = payload.scheduled_at if payload.scheduled_at is not None else interview.scheduled_at
        new_duration = (
            payload.duration_minutes
            if payload.duration_minutes is not None
            else interview.duration_minutes
        )
        time_changed = (
            payload.scheduled_at is not None and payload.scheduled_at != interview.scheduled_at
        ) or (
            payload.duration_minutes is not None and payload.duration_minutes != interview.duration_minutes
        )

        # Target status
        target_status = payload.status if payload.status is not None else interview.status
        if time_changed and target_status != InterviewStatus.CANCELLED:
            cls.check_conflicts(
                db,
                recruiter_id=recruiter_id,
                student_id=interview.student_id,
                scheduled_at=new_time,
                duration_minutes=new_duration,
                exclude_interview_id=interview.id,
            )
            if payload.status is None:
                interview.status = InterviewStatus.RESCHEDULED
                target_status = InterviewStatus.RESCHEDULED

        # Apply updates
        if payload.scheduled_at is not None:
            interview.scheduled_at = payload.scheduled_at
        if payload.duration_minutes is not None:
            interview.duration_minutes = payload.duration_minutes
        if payload.interview_type is not None:
            interview.interview_type = payload.interview_type
        if payload.location_or_link is not None:
            interview.location_or_link = payload.location_or_link
        if payload.notes is not None:
            interview.notes = payload.notes
        if payload.status is not None:
            interview.status = payload.status

        # Notifications
        job_title = (
            interview.application.job_posting.title
            if interview.application and interview.application.job_posting
            else "your application"
        )
        if interview.status == InterviewStatus.CANCELLED:
            NotificationService.create_notification(
                db,
                user_id=interview.student_id,
                notification_type=NotificationType.INTERVIEW_CANCELLED,
                title="Interview Cancelled",
                message=f"Your interview for '{job_title}' has been cancelled.",
            )
        elif time_changed or target_status == InterviewStatus.RESCHEDULED:
            formatted_time = interview.scheduled_at.strftime("%Y-%m-%d %H:%M UTC")
            NotificationService.create_notification(
                db,
                user_id=interview.student_id,
                notification_type=NotificationType.INTERVIEW_RESCHEDULED,
                title="Interview Rescheduled",
                message=f"Your interview for '{job_title}' has been rescheduled to {formatted_time}.",
            )

        db.commit()
        db.refresh(interview)
        return interview

    @classmethod
    def cancel_interview(
        cls,
        db: Session,
        *,
        interview_id: int,
        recruiter_id: int,
    ) -> Interview:
        """
        Cancel an interview (soft-cancellation).
        Sets status to CANCELLED and dispatches an INTERVIEW_CANCELLED notification to the student.
        """
        interview = db.scalar(
            select(Interview)
            .options(
                joinedload(Interview.application).joinedload(Application.job_posting),
                joinedload(Interview.recruiter),
                joinedload(Interview.student),
            )
            .where(Interview.id == interview_id)
        )
        if not interview:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview not found",
            )

        if interview.recruiter_id != recruiter_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this interview",
            )

        interview.status = InterviewStatus.CANCELLED

        job_title = (
            interview.application.job_posting.title
            if interview.application and interview.application.job_posting
            else "your application"
        )
        NotificationService.create_notification(
            db,
            user_id=interview.student_id,
            notification_type=NotificationType.INTERVIEW_CANCELLED,
            title="Interview Cancelled",
            message=f"Your interview for '{job_title}' has been cancelled.",
        )

        db.commit()
        db.refresh(interview)
        return interview
