from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application, ApplicationStatus
from app.models.job_offer import JobOffer, OfferStatus
from app.models.job_posting import JobPosting
from app.models.notification import NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.job_offer import JobOfferCreate, JobOfferUpdate
from app.services.notification_service import NotificationService


# Valid lifecycle state transitions map for Recruiter updates
VALID_RECRUITER_OFFER_TRANSITIONS = {
    OfferStatus.DRAFT: {OfferStatus.OFFERED, OfferStatus.WITHDRAWN},
    OfferStatus.OFFERED: {
        OfferStatus.WITHDRAWN,
        OfferStatus.EXPIRED,
    },
    OfferStatus.ACCEPTED: set(),  # Terminal state
    OfferStatus.REJECTED: set(),  # Terminal state
    OfferStatus.WITHDRAWN: set(),  # Terminal state
    OfferStatus.EXPIRED: set(),   # Terminal state
}


def populate_job_offer_metadata(db: Session, offers: List[JobOffer]) -> None:
    """
    Attach metadata (job title, student name/email, recruiter company/name)
    to JobOffer instances in-memory for response serialization.
    """
    if not offers:
        return

    app_ids = list({o.application_id for o in offers})
    applications = db.scalars(
        select(Application)
        .options(
            joinedload(Application.job_posting),
            joinedload(Application.student),
        )
        .where(Application.id.in_(app_ids))
    ).all()
    app_map = {a.id: a for a in applications}

    student_ids = list({a.student_id for a in applications})
    student_profiles = db.scalars(
        select(StudentProfile).where(StudentProfile.user_id.in_(student_ids))
    ).all()
    student_map = {sp.user_id: sp.full_name for sp in student_profiles}

    recruiter_ids = list({o.recruiter_id for o in offers})
    recruiter_profiles = db.scalars(
        select(RecruiterProfile).where(RecruiterProfile.user_id.in_(recruiter_ids))
    ).all()
    recruiter_map = {rp.user_id: rp for rp in recruiter_profiles}

    for off in offers:
        app = app_map.get(off.application_id)
        if app:
            off.student_id = app.student_id
            off.student_name = student_map.get(app.student_id) or (
                app.student.email if app.student else None
            )
            off.student_email = app.student.email if app.student else None

            if app.job_posting:
                off.job_id = app.job_posting.id
                off.job_title = app.job_posting.title
                off.company_name = app.job_posting.company_name

        rec_prof = recruiter_map.get(off.recruiter_id)
        if rec_prof:
            off.recruiter_name = rec_prof.contact_name or (
                off.recruiter.email if off.recruiter else None
            )
            if not getattr(off, "company_name", None):
                off.company_name = rec_prof.company_name
        else:
            off.recruiter_name = off.recruiter.email if off.recruiter else None


class JobOfferService:
    """
    Domain service layer managing official JobOffer entities.
    Enforces recruiter ownership, application uniqueness, status lifecycle rules,
    candidate decision flows (accept/reject), experience credentialing integration,
    and in-app notification triggers.
    """

    @staticmethod
    def create_offer(
        db: Session,
        application_id: int,
        recruiter_user: User,
        payload: JobOfferCreate,
    ) -> JobOffer:
        """
        Create a new JobOffer for a candidate application.
        Validates:
        - Recruiter role (403)
        - Application exists (404)
        - Recruiter owns the associated job posting (403)
        - Unique offer constraint: only one offer per application (409)
        - If payload.is_sent is True, offer status becomes OFFERED, application status transitions to OFFERED,
          and in-app notification (OFFER_RECEIVED) is delivered to the student.
        """
        if recruiter_user.role != UserRole.RECRUITER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only recruiters can create job offers.",
            )

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

        if application.job_posting.recruiter_id != recruiter_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to extend job offers for this application",
            )

        # Enforce unique offer per application
        existing_offer = db.scalar(
            select(JobOffer).where(JobOffer.application_id == application_id)
        )
        if existing_offer:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A job offer already exists for this application",
            )

        offer_status = OfferStatus.OFFERED if payload.is_sent else OfferStatus.DRAFT

        offer = JobOffer(
            application_id=application_id,
            recruiter_id=recruiter_user.id,
            status=offer_status,
            title=payload.title,
            compensation=payload.compensation,
            currency=payload.currency,
            start_date=payload.start_date,
            expiration_date=payload.expiration_date,
            terms=payload.terms,
        )
        db.add(offer)

        # If sending directly, update application status to OFFERED and trigger notification
        if payload.is_sent:
            application.status = ApplicationStatus.OFFERED
            job = application.job_posting
            NotificationService.create_notification(
                db,
                user_id=application.student_id,
                notification_type=NotificationType.OFFER_RECEIVED,
                title="Job Offer Received",
                message=f"You have received an official job offer for '{job.title}' from {job.company_name}.",
                commit=False,
            )

        db.commit()
        db.refresh(offer)

        populate_job_offer_metadata(db, [offer])
        return offer

    @staticmethod
    def get_offer_by_id(
        db: Session,
        offer_id: int,
        current_user: User,
    ) -> JobOffer:
        """
        Retrieve a single JobOffer with strict authorization checks:
        - Students can only view offers for their own applications, and only if not in DRAFT state.
        - Recruiters can only view offers for job postings they own.
        - Admins can view any offer.
        """
        offer = db.scalar(
            select(JobOffer)
            .options(
                joinedload(JobOffer.application).joinedload(Application.job_posting),
                joinedload(JobOffer.application).joinedload(Application.student),
            )
            .where(JobOffer.id == offer_id)
        )
        if not offer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job offer not found",
            )

        if current_user.role == UserRole.STUDENT:
            if offer.application.student_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this job offer",
                )
            if offer.status == OfferStatus.DRAFT:
                # Students should not see unreleased draft offers
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Job offer not found",
                )
        elif current_user.role == UserRole.RECRUITER:
            if offer.application.job_posting.recruiter_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this job offer",
                )

        populate_job_offer_metadata(db, [offer])
        return offer

    @staticmethod
    def get_offer_by_application_id(
        db: Session,
        application_id: int,
        current_user: User,
    ) -> JobOffer:
        """
        Retrieve the JobOffer associated with an application.
        - Students can view if it is their application and offer is not DRAFT.
        - Recruiters can view if they own the job posting.
        """
        application = db.scalar(
            select(Application)
            .options(joinedload(Application.job_posting))
            .where(Application.id == application_id)
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
                    detail="Not authorized to view offers for this application",
                )
        elif current_user.role == UserRole.RECRUITER:
            if application.job_posting.recruiter_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view offers for this application",
                )

        offer = db.scalar(
            select(JobOffer).where(JobOffer.application_id == application_id)
        )
        if not offer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No job offer found for this application",
            )

        if current_user.role == UserRole.STUDENT and offer.status == OfferStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No job offer found for this application",
            )

        populate_job_offer_metadata(db, [offer])
        return offer

    @staticmethod
    def update_offer(
        db: Session,
        offer_id: int,
        recruiter_user: User,
        payload: JobOfferUpdate,
    ) -> JobOffer:
        """
        Update an existing JobOffer:
        - Validates recruiter role and job posting ownership (403).
        - Prevents recruiters from forcing candidate decision status (ACCEPTED/REJECTED) (400).
        - Validates status transitions against allowed recruiter lifecycle paths (400).
        - Updates fields (title, compensation, currency, dates, terms).
        - If transitioning to OFFERED, updates application status to OFFERED and triggers OFFER_RECEIVED notification.
        """
        if recruiter_user.role != UserRole.RECRUITER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only recruiters can update job offers.",
            )

        offer = db.scalar(
            select(JobOffer)
            .options(
                joinedload(JobOffer.application).joinedload(Application.job_posting)
            )
            .where(JobOffer.id == offer_id)
        )
        if not offer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job offer not found",
            )

        if (
            offer.recruiter_id != recruiter_user.id
            or offer.application.job_posting.recruiter_id != recruiter_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this job offer",
            )

        # Protect candidate decision status from recruiter PATCH override
        if payload.status in (OfferStatus.ACCEPTED, OfferStatus.REJECTED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recruiters cannot manually set candidate decision status. Candidate acceptance or rejection must occur through candidate response endpoints.",
            )

        # Validate status transition if status change requested
        if payload.status is not None and payload.status != offer.status:
            allowed_next = VALID_RECRUITER_OFFER_TRANSITIONS.get(offer.status, set())
            if payload.status not in allowed_next:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot transition job offer from '{offer.status.value}' to '{payload.status.value}'.",
                )

            old_status = offer.status
            offer.status = payload.status
            if payload.status == OfferStatus.OFFERED:
                offer.application.status = ApplicationStatus.OFFERED
                if old_status == OfferStatus.DRAFT:
                    job = offer.application.job_posting
                    NotificationService.create_notification(
                        db,
                        user_id=offer.application.student_id,
                        notification_type=NotificationType.OFFER_RECEIVED,
                        title="Job Offer Received",
                        message=f"You have received an official job offer for '{job.title}' from {job.company_name}.",
                        commit=False,
                    )
            elif payload.status == OfferStatus.WITHDRAWN and old_status == OfferStatus.OFFERED:
                job = offer.application.job_posting
                NotificationService.create_notification(
                    db,
                    user_id=offer.application.student_id,
                    notification_type=NotificationType.OFFER_WITHDRAWN,
                    title="Job Offer Withdrawn",
                    message=f"The job offer for '{job.title}' from {job.company_name} has been withdrawn.",
                    commit=False,
                )

        # Update field attributes if provided
        if payload.title is not None:
            offer.title = payload.title
        if payload.compensation is not None:
            offer.compensation = payload.compensation
        if payload.currency is not None:
            offer.currency = payload.currency
        if payload.start_date is not None:
            offer.start_date = payload.start_date
        if payload.expiration_date is not None:
            offer.expiration_date = payload.expiration_date
        if payload.terms is not None:
            offer.terms = payload.terms

        db.commit()
        db.refresh(offer)

        populate_job_offer_metadata(db, [offer])
        return offer

    @staticmethod
    def send_offer(
        db: Session,
        offer_id: int,
        recruiter_user: User,
    ) -> JobOffer:
        """
        Transition a DRAFT offer to OFFERED, update Application status to OFFERED,
        and send an in-app notification (OFFER_RECEIVED) to the student.
        """
        update_payload = JobOfferUpdate(status=OfferStatus.OFFERED)
        return JobOfferService.update_offer(
            db=db,
            offer_id=offer_id,
            recruiter_user=recruiter_user,
            payload=update_payload,
        )

    @staticmethod
    def withdraw_offer(
        db: Session,
        offer_id: int,
        recruiter_user: User,
    ) -> JobOffer:
        """
        Withdraw an active or draft offer.
        If offer was released (OFFERED), triggers an in-app notification (OFFER_WITHDRAWN) to the student.
        """
        update_payload = JobOfferUpdate(status=OfferStatus.WITHDRAWN)
        return JobOfferService.update_offer(
            db=db,
            offer_id=offer_id,
            recruiter_user=recruiter_user,
            payload=update_payload,
        )

    @staticmethod
    def accept_offer(
        db: Session,
        offer_id: int,
        student_user: User,
    ) -> JobOffer:
        """
        Accept an active JobOffer (Student applicant only):
        - Enforces student role (403) and ownership of the application (403).
        - Requires offer to be in OFFERED status (400 if DRAFT, ACCEPTED, REJECTED, WITHDRAWN, EXPIRED).
        - Executes atomic transaction:
          1. Sets JobOffer.status = ACCEPTED
          2. Sets Application.status = ACCEPTED
          3. Creates in-app Notification (OFFER_ACCEPTED) for hiring recruiter
          4. Invokes ExperienceRecordService.create_experience_from_accepted_application to generate verified credential
          5. Commits atomically; on any error rolls back entire transaction.
        """
        if student_user.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only student candidates can accept job offers.",
            )

        offer = db.scalar(
            select(JobOffer)
            .options(
                joinedload(JobOffer.application).joinedload(Application.job_posting),
                joinedload(JobOffer.application).joinedload(Application.student),
            )
            .where(JobOffer.id == offer_id)
        )
        if not offer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job offer not found",
            )

        if offer.application.student_id != student_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to accept an offer extended to another candidate",
            )

        if offer.status != OfferStatus.OFFERED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot accept job offer in '{offer.status.value}' state. Only active offers in 'offered' status can be accepted.",
            )

        job = offer.application.job_posting
        student_profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == student_user.id)
        )
        student_name = (
            student_profile.full_name
            if student_profile and student_profile.full_name
            else student_user.email.split("@")[0]
        )

        try:
            # 1. Mutate offer and application statuses to ACCEPTED
            offer.status = OfferStatus.ACCEPTED
            offer.application.status = ApplicationStatus.ACCEPTED

            # 2. Add recruiter in-app notification
            NotificationService.create_notification(
                db,
                user_id=job.recruiter_id,
                notification_type=NotificationType.OFFER_ACCEPTED,
                title="Job Offer Accepted",
                message=f"{student_name} has accepted your job offer for '{job.title}'.",
                commit=False,
            )
            db.flush()

            # 3. Call existing ExperienceRecord credentialing service
            from app.services.experience_record_service import ExperienceRecordService

            ExperienceRecordService.create_experience_from_accepted_application(
                db,
                student_id=student_user.id,
                application_id=offer.application_id,
            )

            db.commit()
            db.refresh(offer)
        except Exception:
            db.rollback()
            raise

        populate_job_offer_metadata(db, [offer])
        return offer

    @staticmethod
    def reject_offer(
        db: Session,
        offer_id: int,
        student_user: User,
    ) -> JobOffer:
        """
        Decline / reject an active JobOffer (Student applicant only):
        - Enforces student role (403) and ownership of the application (403).
        - Requires offer to be in OFFERED status (400 if DRAFT, ACCEPTED, REJECTED, WITHDRAWN, EXPIRED).
        - Executes transaction:
          1. Sets JobOffer.status = REJECTED
          2. Sets Application.status = REJECTED
          3. Creates in-app Notification (OFFER_REJECTED) for hiring recruiter
          4. Does NOT create an ExperienceRecord.
        """
        if student_user.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only student candidates can decline job offers.",
            )

        offer = db.scalar(
            select(JobOffer)
            .options(
                joinedload(JobOffer.application).joinedload(Application.job_posting),
                joinedload(JobOffer.application).joinedload(Application.student),
            )
            .where(JobOffer.id == offer_id)
        )
        if not offer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job offer not found",
            )

        if offer.application.student_id != student_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to decline an offer extended to another candidate",
            )

        if offer.status != OfferStatus.OFFERED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot decline job offer in '{offer.status.value}' state. Only active offers in 'offered' status can be declined.",
            )

        job = offer.application.job_posting
        student_profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == student_user.id)
        )
        student_name = (
            student_profile.full_name
            if student_profile and student_profile.full_name
            else student_user.email.split("@")[0]
        )

        try:
            offer.status = OfferStatus.REJECTED
            offer.application.status = ApplicationStatus.REJECTED

            NotificationService.create_notification(
                db,
                user_id=job.recruiter_id,
                notification_type=NotificationType.OFFER_REJECTED,
                title="Job Offer Declined",
                message=f"{student_name} has declined your job offer for '{job.title}'.",
                commit=False,
            )
            db.commit()
            db.refresh(offer)
        except Exception:
            db.rollback()
            raise

        populate_job_offer_metadata(db, [offer])
        return offer

    @staticmethod
    def list_recruiter_offers(
        db: Session,
        recruiter_user: User,
    ) -> List[JobOffer]:
        """
        List all job offers created by the authenticated recruiter.
        """
        if recruiter_user.role != UserRole.RECRUITER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only recruiters can view recruiter job offers.",
            )

        offers = db.scalars(
            select(JobOffer)
            .where(JobOffer.recruiter_id == recruiter_user.id)
            .order_by(JobOffer.created_at.desc())
        ).all()

        populate_job_offer_metadata(db, offers)
        return list(offers)

    @staticmethod
    def list_student_offers(
        db: Session,
        student_user: User,
    ) -> List[JobOffer]:
        """
        List all active / released (non-draft) job offers extended to the student.
        """
        if student_user.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can access student job offers.",
            )

        offers = db.scalars(
            select(JobOffer)
            .join(Application, JobOffer.application_id == Application.id)
            .where(
                Application.student_id == student_user.id,
                JobOffer.status != OfferStatus.DRAFT,
            )
            .order_by(JobOffer.created_at.desc())
        ).all()

        populate_job_offer_metadata(db, offers)
        return list(offers)
