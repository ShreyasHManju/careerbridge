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
from app.models.innovation_project import InnovationProject, ProjectStatus
from app.models.project_evidence import ProjectEvidence
from app.models.project_evidence_verification import EvidenceVerification, EvidenceVerificationStatus
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

    @staticmethod
    def create_experience_from_verified_project(
        db: Session,
        student_id: int,
        project_id: int,
    ) -> ExperienceRecord:
        """
        Create a verified ExperienceRecord derived directly from an owned InnovationProject
        that contains at least one verified evidence artifact.
        Enforces:
        - Student ownership of the project.
        - Existence of verified evidence items (via R6 verification).
        - Prevention of duplicate experience records for the same project.
        - Canonical skill synchronization from project skills.
        - Traceable verifier metadata from evidence verification.
        """
        # 1. Fetch project with student ownership, skills, and evidence verification
        project = db.scalar(
            select(InnovationProject)
            .where(InnovationProject.id == project_id)
            .options(
                selectinload(InnovationProject.project_skills).selectinload(InnovationProject.project_skills.property.mapper.class_.skill),
                selectinload(InnovationProject.evidence_items).selectinload(ProjectEvidence.verification).selectinload(EvidenceVerification.verifier),
            )
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to convert another student's project into an experience record",
            )

        # 2. Check for duplicate experience record linked to this project for this student
        existing_exp = db.scalar(
            select(ExperienceRecord).where(
                ExperienceRecord.student_id == student_id,
                ExperienceRecord.innovation_project_id == project_id,
            )
        )
        if existing_exp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An experience record already exists for this innovation project",
            )

        # 3. Verify that the project has at least one verified evidence item
        verified_evidences = []
        for ev in (project.evidence_items or []):
            if ev.verification and (
                ev.verification.status == EvidenceVerificationStatus.VERIFIED
                or getattr(ev.verification.status, "value", None) == "verified"
                or str(ev.verification.status) == "verified"
            ):
                verified_evidences.append(ev)

        if not verified_evidences:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create verified experience: project has no verified evidence artifacts",
            )

        # 4. Extract latest verifier and timestamp
        latest_evidence = max(
            verified_evidences,
            key=lambda e: (e.verification.verified_at or datetime.min.replace(tzinfo=timezone.utc), e.id),
        )
        verifier_id = latest_evidence.verification.verifier_id if latest_evidence.verification else None
        verified_at = latest_evidence.verification.verified_at if latest_evidence.verification else datetime.now(timezone.utc)

        # 5. Build ExperienceRecord
        is_completed = (project.status == ProjectStatus.ARCHIVED or getattr(project.status, "value", None) == "archived")
        start_date = project.created_at.date() if project.created_at else datetime.now(timezone.utc).date()
        end_date = datetime.now(timezone.utc).date() if is_completed else None
        is_current = not is_completed

        desc = project.description
        if not desc or len(desc.strip()) < 10:
            desc = f"Verified execution of innovation project '{project.title}' with verified milestone evidence artifacts."

        exp_record = ExperienceRecord(
            student_id=student_id,
            title=project.title,
            organization_name="Innovation Project",
            experience_type=ExperienceType.PROJECT,
            start_date=start_date,
            end_date=end_date,
            is_current=is_current,
            description=desc,
            status=VerificationStatus.VERIFIED,
            verification_source=VerificationSource.PLATFORM_PROJECT,
            innovation_project_id=project.id,
            verifier_id=verifier_id,
            verified_at=verified_at,
            verification_notes=f"Derived from verified project evidence ({len(verified_evidences)} verified artifact(s)).",
        )
        db.add(exp_record)
        db.flush()

        # 6. Copy canonical skills
        if project.skills:
            sync_experience_skills_from_text(db, exp_record, project.skills)

        db.commit()
        db.refresh(exp_record)
        ExperienceRecordService._populate_derived_fields([exp_record])
        return exp_record
