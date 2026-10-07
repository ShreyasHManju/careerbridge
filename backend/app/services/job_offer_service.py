from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application, ApplicationStatus
from app.models.job_offer import JobOffer, OfferStatus
from app.models.job_posting import JobPosting
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.job_offer import JobOfferCreate, JobOfferUpdate


# Valid lifecycle state transitions map
VALID_OFFER_TRANSITIONS = {
    OfferStatus.DRAFT: {OfferStatus.OFFERED, OfferStatus.WITHDRAWN},
    OfferStatus.OFFERED: {
        OfferStatus.ACCEPTED,
        OfferStatus.REJECTED,
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
    and student authorization privacy boundaries.
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
        - If payload.is_sent is True, offer status becomes OFFERED and application status transitions to OFFERED.
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

        # If sending directly, update application status to OFFERED
        if payload.is_sent:
            application.status = ApplicationStatus.OFFERED

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
        - Validates status transitions against allowed lifecycle paths (400).
        - Updates fields (title, compensation, currency, dates, terms).
        - If transitioning to OFFERED, updates application status to OFFERED.
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

        # Validate status transition if status change requested
        if payload.status is not None and payload.status != offer.status:
            allowed_next = VALID_OFFER_TRANSITIONS.get(offer.status, set())
            if payload.status not in allowed_next:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot transition job offer from '{offer.status.value}' to '{payload.status.value}'.",
                )

            offer.status = payload.status
            if payload.status == OfferStatus.OFFERED:
                offer.application.status = ApplicationStatus.OFFERED

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
        Transition a DRAFT offer to OFFERED and update Application status to OFFERED.
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
        """
        update_payload = JobOfferUpdate(status=OfferStatus.WITHDRAWN)
        return JobOfferService.update_offer(
            db=db,
            offer_id=offer_id,
            recruiter_user=recruiter_user,
            payload=update_payload,
        )

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
