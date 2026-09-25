from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.experience_record import (
    ExperienceRecord,
    ExperienceType,
    VerificationSource,
    VerificationStatus,
)
from app.models.innovation_project import InnovationProject
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.experience_record import (
    ExperienceRecordCreate,
    ExperienceRecordListResponse,
    ExperienceRecordResponse,
    ExperienceRecordUpdate,
    ExperienceVerificationDecision,
)
from app.services.skill_service import format_skills_string, sync_experience_skills_from_text


class ExperienceRecordService:
    @staticmethod
    def _populate_derived_fields(experiences: List[ExperienceRecord]) -> None:
        """Populate skills string and verifier name on records in-memory."""
        for exp in experiences:
            if exp.experience_skills:
                skill_names = [es.skill.name for es in exp.experience_skills if es.skill]
                exp.skills = format_skills_string(skill_names)
            else:
                exp.skills = None

            if exp.verifier:
                exp.verifier_name = exp.verifier.email
            else:
                exp.verifier_name = None

    @staticmethod
    def create_experience(
        db: Session,
        student_id: int,
        payload: ExperienceRecordCreate,
    ) -> ExperienceRecord:
        """
        Create a new student experience record.
        Validates optional linked innovation project ownership.
        """
        data = payload.model_dump(exclude={"skills"})
        skills_text = payload.skills

        # Validate linked project ownership if provided
        verification_source = VerificationSource.SELF_CLAIMED
        if data.get("innovation_project_id") is not None:
            project = db.scalar(
                select(InnovationProject).where(
                    InnovationProject.id == data["innovation_project_id"]
                )
            )
            if not project or project.student_id != student_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Linked innovation project not found or does not belong to you",
                )
            verification_source = VerificationSource.PLATFORM_PROJECT

        initial_status = data.pop("status", None) or VerificationStatus.CLAIMED
        if initial_status not in [VerificationStatus.CLAIMED, VerificationStatus.DRAFT]:
            initial_status = VerificationStatus.CLAIMED

        data.pop("verification_source", None)

        experience = ExperienceRecord(
            student_id=student_id,
            verification_source=verification_source,
            status=initial_status,
            **data,
        )
        db.add(experience)
        db.flush()

        if skills_text:
            sync_experience_skills_from_text(db, experience, skills_text)

        db.commit()
        db.refresh(experience)
        ExperienceRecordService._populate_derived_fields([experience])
        return experience

    @staticmethod
    def list_student_experiences(
        db: Session,
        student_id: int,
    ) -> ExperienceRecordListResponse:
        """
        Retrieve all experience records for the authenticated student.
        """
        stmt = (
            select(ExperienceRecord)
            .where(ExperienceRecord.student_id == student_id)
            .options(
                selectinload(ExperienceRecord.experience_skills),
                selectinload(ExperienceRecord.verifier),
                selectinload(ExperienceRecord.innovation_project),
            )
            .order_by(ExperienceRecord.start_date.desc(), ExperienceRecord.id.desc())
        )
        items = list(db.scalars(stmt).all())
        ExperienceRecordService._populate_derived_fields(items)
        return ExperienceRecordListResponse(items=items, total=len(items))

    @staticmethod
    def get_experience(
        db: Session,
        experience_id: int,
        current_user: Optional[User] = None,
    ) -> ExperienceRecord:
        """
        Retrieve a single experience record.
        Respects privacy rules: unverified claims return 404 to unauthorized viewers.
        """
        stmt = (
            select(ExperienceRecord)
            .where(ExperienceRecord.id == experience_id)
            .options(
                selectinload(ExperienceRecord.experience_skills),
                selectinload(ExperienceRecord.verifier),
                selectinload(ExperienceRecord.innovation_project),
            )
        )
        experience = db.scalar(stmt)
        if not experience:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experience record not found",
            )

        is_owner = current_user is not None and current_user.id == experience.student_id
        is_admin = current_user is not None and current_user.role == UserRole.ADMIN

        # Privacy Guard: unverified records are only visible to owner and admin
        if experience.status != VerificationStatus.VERIFIED and not (is_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experience record not found",
            )

        ExperienceRecordService._populate_derived_fields([experience])
        return experience

    @staticmethod
    def update_experience(
        db: Session,
        experience_id: int,
        student_id: int,
        payload: ExperienceRecordUpdate,
    ) -> ExperienceRecord:
        """
        Update an experience record owned by the student.
        Enforces verified record immutability on core fields.
        """
        experience = db.scalar(
            select(ExperienceRecord)
            .where(ExperienceRecord.id == experience_id)
            .options(
                selectinload(ExperienceRecord.experience_skills),
                selectinload(ExperienceRecord.verifier),
                selectinload(ExperienceRecord.innovation_project),
            )
        )
        if not experience:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experience record not found",
            )

        if experience.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to edit this experience record",
            )

        update_data = payload.model_dump(exclude_unset=True)

        # Immutability Guard: Core verified fields cannot be mutated on a VERIFIED record
        if experience.status == VerificationStatus.VERIFIED:
            core_fields = [
                "title",
                "organization_name",
                "experience_type",
                "start_date",
                "end_date",
                "innovation_project_id",
            ]
            for field in core_fields:
                if field in update_data and update_data[field] != getattr(experience, field):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Cannot modify core field '{field}' on a verified experience record. "
                            "You must request re-verification or recreate the claim."
                        ),
                    )

        # Validate new linked project ownership if changed
        if "innovation_project_id" in update_data and update_data["innovation_project_id"] is not None:
            project = db.scalar(
                select(InnovationProject).where(
                    InnovationProject.id == update_data["innovation_project_id"]
                )
            )
            if not project or project.student_id != student_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Linked innovation project not found or does not belong to you",
                )

        # Apply updates
        skills_text = update_data.pop("skills", None)
        for key, value in update_data.items():
            setattr(experience, key, value)

        if skills_text is not None:
            sync_experience_skills_from_text(db, experience, skills_text)

        db.commit()
        db.refresh(experience)
        ExperienceRecordService._populate_derived_fields([experience])
        return experience

    @staticmethod
    def delete_experience(
        db: Session,
        experience_id: int,
        student_id: int,
        is_admin: bool = False,
    ) -> None:
        """
        Delete an experience record.
        """
        experience = db.scalar(
            select(ExperienceRecord).where(ExperienceRecord.id == experience_id)
        )
        if not experience:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experience record not found",
            )

        if not is_admin and experience.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this experience record",
            )

        db.delete(experience)
        db.commit()

    @staticmethod
    def request_verification(
        db: Session,
        experience_id: int,
        student_id: int,
    ) -> ExperienceRecord:
        """
        Transition experience record status from CLAIMED/DRAFT/REJECTED to PENDING_VERIFICATION.
        """
        experience = db.scalar(
            select(ExperienceRecord)
            .where(ExperienceRecord.id == experience_id)
            .options(
                selectinload(ExperienceRecord.experience_skills),
                selectinload(ExperienceRecord.verifier),
                selectinload(ExperienceRecord.innovation_project),
            )
        )
        if not experience:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experience record not found",
            )

        if experience.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to request verification for this experience record",
            )

        if experience.status == VerificationStatus.VERIFIED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Experience record is already verified",
            )

        experience.status = VerificationStatus.PENDING_VERIFICATION
        experience.verification_notes = None  # Clear previous rejection feedback
        db.commit()
        db.refresh(experience)
        ExperienceRecordService._populate_derived_fields([experience])
        return experience

    @staticmethod
    def list_pending_verifications(
        db: Session,
        current_user: User,
    ) -> ExperienceRecordListResponse:
        """
        List pending verification requests for authorized recruiters (scoped to company) or admins.
        """
        base_query = (
            select(ExperienceRecord)
            .where(ExperienceRecord.status == VerificationStatus.PENDING_VERIFICATION)
            .options(
                selectinload(ExperienceRecord.experience_skills),
                selectinload(ExperienceRecord.verifier),
                selectinload(ExperienceRecord.innovation_project),
            )
        )

        if current_user.role == UserRole.ADMIN:
            stmt = base_query.order_by(ExperienceRecord.created_at.desc())
        elif current_user.role == UserRole.RECRUITER:
            recruiter_profile = db.scalar(
                select(RecruiterProfile).where(RecruiterProfile.user_id == current_user.id)
            )
            if not recruiter_profile or not recruiter_profile.company_name:
                return ExperienceRecordListResponse(items=[], total=0)

            company_filter = f"%{recruiter_profile.company_name.strip()}%"
            stmt = base_query.where(
                ExperienceRecord.organization_name.ilike(company_filter)
            ).order_by(ExperienceRecord.created_at.desc())
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view verification requests",
            )

        items = list(db.scalars(stmt).all())
        ExperienceRecordService._populate_derived_fields(items)
        return ExperienceRecordListResponse(items=items, total=len(items))

    @staticmethod
    def decide_verification(
        db: Session,
        experience_id: int,
        verifier: User,
        decision: ExperienceVerificationDecision,
    ) -> ExperienceRecord:
        """
        Process an approval or rejection for a pending experience record.
        Enforces verifier authorization and prevents student self-verification.
        """
        experience = db.scalar(
            select(ExperienceRecord)
            .where(ExperienceRecord.id == experience_id)
            .options(
                selectinload(ExperienceRecord.experience_skills),
                selectinload(ExperienceRecord.verifier),
                selectinload(ExperienceRecord.innovation_project),
            )
        )
        if not experience:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experience record not found",
            )

        # Anti-self-verification Guard
        if verifier.id == experience.student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students are not permitted to verify their own experience records",
            )

        if experience.status != VerificationStatus.PENDING_VERIFICATION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot decide on experience record with status '{experience.status.value}'. Must be pending_verification.",
            )

        # Authorization check for recruiters
        if verifier.role == UserRole.RECRUITER:
            recruiter_profile = db.scalar(
                select(RecruiterProfile).where(RecruiterProfile.user_id == verifier.id)
            )
            if not recruiter_profile or not recruiter_profile.company_name:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Recruiter profile missing company information",
                )

            recruiter_company = recruiter_profile.company_name.strip().lower()
            org_name = (experience.organization_name or "").strip().lower()
            if recruiter_company not in org_name and org_name not in recruiter_company:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to verify experience for another organization",
                )

        now = datetime.now(timezone.utc)
        if decision.action == "approve":
            experience.status = VerificationStatus.VERIFIED
            experience.verifier_id = verifier.id
            experience.verified_at = now
            experience.verification_notes = decision.notes

            if verifier.role == UserRole.RECRUITER:
                experience.verification_source = VerificationSource.RECRUITER_CONFIRMED
            elif verifier.role == UserRole.ADMIN:
                if experience.innovation_project_id:
                    experience.verification_source = VerificationSource.PLATFORM_PROJECT
                else:
                    experience.verification_source = VerificationSource.ADMIN_CONFIRMED
        else:
            experience.status = VerificationStatus.REJECTED
            experience.verifier_id = verifier.id
            experience.verified_at = None
            experience.verification_notes = decision.notes

        db.commit()
        db.refresh(experience)
        ExperienceRecordService._populate_derived_fields([experience])
        return experience

    @staticmethod
    def list_public_student_experiences(
        db: Session,
        target_student_id: int,
        current_user: Optional[User] = None,
    ) -> ExperienceRecordListResponse:
        """
        List experiences for a student profile view.
        Only returns VERIFIED records to external callers/recruiters.
        Returns all records if caller is the owner student or admin.
        """
        # Ensure student exists
        student = db.scalar(select(User).where(User.id == target_student_id))
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found",
            )

        is_owner = current_user is not None and current_user.id == target_student_id
        is_admin = current_user is not None and current_user.role == UserRole.ADMIN

        stmt = (
            select(ExperienceRecord)
            .where(ExperienceRecord.student_id == target_student_id)
            .options(
                selectinload(ExperienceRecord.experience_skills),
                selectinload(ExperienceRecord.verifier),
                selectinload(ExperienceRecord.innovation_project),
            )
        )

        if not (is_owner or is_admin):
            stmt = stmt.where(ExperienceRecord.status == VerificationStatus.VERIFIED)

        stmt = stmt.order_by(ExperienceRecord.start_date.desc(), ExperienceRecord.id.desc())
        items = list(db.scalars(stmt).all())
        ExperienceRecordService._populate_derived_fields(items)
        return ExperienceRecordListResponse(items=items, total=len(items))
