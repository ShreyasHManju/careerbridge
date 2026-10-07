import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.experience_record import ExperienceRecord, ExperienceSkill, VerificationStatus
from app.models.innovation_project import (
    InnovationProject,
    ProjectSkill,
    ProjectStatus,
    ProjectVisibility,
)
from app.models.passport_share import PassportShare
from app.models.profile_image import ProfileImage
from app.models.project_evaluation import (
    EvaluationSkillAssessment,
    EvaluationStatus,
    ProjectEvaluation,
)
from app.models.project_evidence import ProjectEvidence
from app.models.project_evidence_verification import EvidenceVerification, EvidenceVerificationStatus
from app.models.project_milestone import MilestoneStatus, ProjectMilestone
from app.models.recruiter_profile import RecruiterProfile
from app.models.resume import Resume
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.passport import (
    PassportEvaluationItem,
    PassportEvidenceItem,
    PassportExperienceItem,
    PassportIdentity,
    PassportMilestoneItem,
    PassportProjectItem,
    PassportResponse,
    PassportResumeInfo,
    PassportShareCreateRequest,
    PassportShareCreateResponse,
    PassportShareSummaryResponse,
    PassportShareUpdateRequest,
    PassportSkillItem,
    PassportSummary,
    PublicContactInfo,
    PublicExperienceItem,
    PublicPassportResponse,
    PublicProjectItem,
    PublicSkillProvenance,
    PublicVerificationSummary,
)
from app.schemas.skill import SkillResponse
from app.services.skill_service import format_skills_string
from app.services.student_skill_compilation_service import StudentSkillCompilationService


class PassportService:
    """
    Aggregation service for compiling evidence-backed Experience Passports.
    Passport is dynamically derived from existing verified data with server-side privacy enforcement.
    """

    @staticmethod
    def get_student_passport(
        db: Session,
        target_student_id: int,
        current_user: Optional[User] = None,
    ) -> PassportResponse:
        """
        Assemble the Experience Passport for a given student.
        Enforces server-side privacy boundaries:
        - Non-owner/non-admin callers only receive verified experiences and active public projects.
        - Only SUBMITTED recruiter evaluations are included; draft and withdrawn evaluations are strictly omitted.
        - Recruiter personal contact emails are never exposed in evaluation metadata.
        - Internal moderation notes and rejected/pending claims are never exposed.
        """
        # 1. Validate Target Student Exists
        student = db.scalar(
            select(User)
            .where(User.id == target_student_id)
            .options(
                selectinload(User.student_profile).selectinload(StudentProfile.student_skills).selectinload(StudentSkill.skill),
                selectinload(User.profile_image),
                selectinload(User.resume),
            )
        )

        if not student or student.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found",
            )

        is_owner = current_user is not None and current_user.id == target_student_id
        is_admin = current_user is not None and current_user.role == UserRole.ADMIN

        if not student.is_active and not (is_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found",
            )

        # 2. Build Identity
        profile = student.student_profile
        profile_img = student.profile_image
        image_url = f"/api/v1/profile-image/{student.id}" if profile_img else None

        identity = PassportIdentity(
            user_id=student.id,
            email=student.email,
            full_name=profile.full_name if profile else None,
            college=profile.college if profile else None,
            degree=profile.degree if profile else None,
            branch=profile.branch if profile else None,
            graduation_year=profile.graduation_year if profile else None,
            bio=profile.bio if profile else None,
            github_url=profile.github_url if profile else None,
            linkedin_url=profile.linkedin_url if profile else None,
            portfolio_url=profile.portfolio_url if profile else None,
            profile_image_url=image_url,
            is_verified=student.is_verified,
            created_at=student.created_at,
        )

        # 3. Retrieve and Filter Experience Records
        exp_stmt = (
            select(ExperienceRecord)
            .where(
                ExperienceRecord.student_id == target_student_id,
                ExperienceRecord.status == VerificationStatus.VERIFIED,
            )
            .options(
                selectinload(ExperienceRecord.experience_skills).selectinload(ExperienceRecord.experience_skills.property.mapper.class_.skill),
                selectinload(ExperienceRecord.innovation_project),
            )
            .order_by(ExperienceRecord.start_date.desc(), ExperienceRecord.id.desc())
        )

        raw_experiences = list(db.scalars(exp_stmt).all())
        passport_experiences: List[PassportExperienceItem] = []

        for exp in raw_experiences:
            exp_skills: List[SkillResponse] = []
            if exp.experience_skills:
                for es in exp.experience_skills:
                    if es.skill:
                        exp_skills.append(
                            SkillResponse(
                                id=es.skill.id,
                                name=es.skill.name,
                                slug=es.skill.slug,
                                category=es.skill.category,
                                is_verified=es.skill.is_verified,
                                created_at=es.skill.created_at,
                            )
                        )

            skills_str = format_skills_string([s.name for s in exp_skills]) if exp_skills else None

            passport_experiences.append(
                PassportExperienceItem(
                    id=exp.id,
                    title=exp.title,
                    organization_name=exp.organization_name,
                    experience_type=exp.experience_type.value if hasattr(exp.experience_type, "value") else str(exp.experience_type),
                    start_date=exp.start_date,
                    end_date=exp.end_date,
                    is_current=exp.is_current,
                    description=exp.description,
                    status=exp.status.value if hasattr(exp.status, "value") else str(exp.status),
                    verification_source=exp.verification_source.value if hasattr(exp.verification_source, "value") else str(exp.verification_source),
                    verified_at=exp.verified_at,
                    innovation_project_id=exp.innovation_project_id,
                    innovation_project_title=exp.innovation_project.title if exp.innovation_project else None,
                    skills=skills_str,
                    structured_skills=exp_skills,
                )
            )

        # 4. Retrieve and Filter Innovation Projects, Milestones, Evidence & Evaluations
        proj_stmt = (
            select(InnovationProject)
            .where(InnovationProject.student_id == target_student_id)
            .options(
                selectinload(InnovationProject.project_skills).selectinload(InnovationProject.project_skills.property.mapper.class_.skill),
                selectinload(InnovationProject.milestones),
                selectinload(InnovationProject.evidence_items).selectinload(ProjectEvidence.verification),
                selectinload(InnovationProject.evidence_items).selectinload(ProjectEvidence.milestone),
                selectinload(InnovationProject.evaluations).selectinload(ProjectEvaluation.recruiter).selectinload(User.recruiter_profile),
                selectinload(InnovationProject.evaluations).selectinload(ProjectEvaluation.skill_assessments).selectinload(EvaluationSkillAssessment.skill),
            )
            .order_by(InnovationProject.created_at.desc())
        )

        if not (is_owner or is_admin):
            proj_stmt = proj_stmt.where(
                InnovationProject.visibility == ProjectVisibility.PUBLIC,
                InnovationProject.status == ProjectStatus.ACTIVE,
            )

        raw_projects = list(db.scalars(proj_stmt).all())

        passport_projects: List[PassportProjectItem] = []
        passport_milestones: List[PassportMilestoneItem] = []
        all_verified_evidence: List[PassportEvidenceItem] = []
        completed_milestone_count = 0

        for proj in raw_projects:
            proj_skills: List[SkillResponse] = []
            if proj.project_skills:
                for ps in proj.project_skills:
                    if ps.skill:
                        proj_skills.append(
                            SkillResponse(
                                id=ps.skill.id,
                                name=ps.skill.name,
                                slug=ps.skill.slug,
                                category=ps.skill.category,
                                is_verified=ps.skill.is_verified,
                                created_at=ps.skill.created_at,
                            )
                        )

            # Sort milestones by display_order
            sorted_milestones = sorted(proj.milestones or [], key=lambda m: (m.display_order, m.id))
            proj_milestones_items: List[PassportMilestoneItem] = []

            for m in sorted_milestones:
                is_completed = (hasattr(m.status, "value") and m.status.value == "completed") or m.status == "completed"
                if is_completed:
                    completed_milestone_count += 1

                m_item = PassportMilestoneItem(
                    id=m.id,
                    innovation_project_id=proj.id,
                    project_title=proj.title,
                    title=m.title,
                    description=m.description,
                    status=m.status.value if hasattr(m.status, "value") else str(m.status),
                    display_order=m.display_order,
                    due_date=m.due_date,
                    completed_at=m.completed_at,
                )
                proj_milestones_items.append(m_item)
                passport_milestones.append(m_item)

            # Extract verified evidence items for this project
            proj_verified_evidence: List[PassportEvidenceItem] = []
            for ev in (proj.evidence_items or []):
                is_ev_verified = (
                    ev.verification is not None
                    and (
                        (hasattr(ev.verification.status, "value") and ev.verification.status.value == "verified")
                        or ev.verification.status == "verified"
                        or ev.verification.status == EvidenceVerificationStatus.VERIFIED
                    )
                )
                if is_ev_verified:
                    ev_item = PassportEvidenceItem(
                        id=ev.id,
                        innovation_project_id=proj.id,
                        milestone_id=ev.milestone_id,
                        milestone_title=ev.milestone.title if ev.milestone else None,
                        title=ev.title,
                        description=ev.description,
                        evidence_type=ev.evidence_type.value if hasattr(ev.evidence_type, "value") else str(ev.evidence_type),
                        url=ev.url,
                        verified_at=ev.verification.verified_at if ev.verification else None,
                    )
                    proj_verified_evidence.append(ev_item)
                    all_verified_evidence.append(ev_item)

            # Extract submitted recruiter evaluations (Privacy: SUBMITTED only)
            proj_evaluations: List[PassportEvaluationItem] = []
            for pe in (proj.evaluations or []):
                is_submitted = (
                    (hasattr(pe.status, "value") and pe.status.value == "submitted")
                    or pe.status == "submitted"
                    or pe.status == EvaluationStatus.SUBMITTED
                )
                if not is_submitted:
                    continue

                rec_company = None
                rec_contact = None
                if pe.recruiter and pe.recruiter.recruiter_profile:
                    rec_company = pe.recruiter.recruiter_profile.company_name
                    rec_contact = pe.recruiter.recruiter_profile.contact_name

                # Assessed skills on this evaluation
                assessed_skills_list: List[SkillResponse] = []
                if pe.skill_assessments:
                    for sa in pe.skill_assessments:
                        if sa.skill:
                            assessed_skills_list.append(
                                SkillResponse(
                                    id=sa.skill.id,
                                    name=sa.skill.name,
                                    slug=sa.skill.slug,
                                    category=sa.skill.category,
                                    is_verified=sa.skill.is_verified,
                                    created_at=sa.skill.created_at,
                                )
                            )

                eval_item = PassportEvaluationItem(
                    id=pe.id,
                    recruiter_id=pe.recruiter_id,
                    recruiter_company=rec_company,
                    recruiter_name=rec_contact,
                    overall_score=float(pe.overall_score) if pe.overall_score is not None else None,
                    technical_score=pe.technical_quality_score,
                    problem_solving_score=pe.problem_solving_score,
                    execution_score=pe.execution_score,
                    communication_score=pe.communication_documentation_score,
                    evidence_score=pe.evidence_quality_score,
                    recommendation=pe.recommendation.value if hasattr(pe.recommendation, "value") else str(pe.recommendation) if pe.recommendation else None,
                    strengths=pe.strengths,
                    assessed_skills=assessed_skills_list,
                    submitted_at=pe.submitted_at,
                )
                proj_evaluations.append(eval_item)

            valid_eval_scores = [e.overall_score for e in proj_evaluations if e.overall_score is not None]
            avg_proj_eval_score = round(sum(valid_eval_scores) / len(valid_eval_scores), 2) if valid_eval_scores else None

            passport_projects.append(
                PassportProjectItem(
                    id=proj.id,
                    title=proj.title,
                    slug=proj.slug,
                    short_description=proj.short_description,
                    description=proj.description,
                    project_type=proj.project_type.value if hasattr(proj.project_type, "value") else str(proj.project_type),
                    status=proj.status.value if hasattr(proj.status, "value") else str(proj.status),
                    visibility=proj.visibility.value if hasattr(proj.visibility, "value") else str(proj.visibility),
                    repository_url=proj.repository_url,
                    live_demo_url=proj.live_demo_url,
                    skills=proj.skills,
                    structured_skills=proj_skills,
                    total_milestones=proj.total_milestones,
                    completed_milestones=proj.completed_milestones,
                    progress_percentage=proj.progress_percentage,
                    milestones=proj_milestones_items,
                    verified_evidence=proj_verified_evidence,
                    verified_evidence_count=len(proj_verified_evidence),
                    evaluations=proj_evaluations,
                    average_evaluation_score=avg_proj_eval_score,
                    evaluations_count=len(proj_evaluations),
                )
            )

        # 5. Aggregate Canonical Skills Provenance
        compiled_skills = StudentSkillCompilationService.compile_student_skills(
            db,
            target_student_id,
            visibility_scope="all_owned" if (is_owner or is_admin) else "public_only",
        )

        passport_skills = [
            PassportSkillItem(
                id=v["skill"].id,
                name=v["skill"].name,
                slug=v["skill"].slug,
                category=v["skill"].category,
                is_verified=bool(v["is_verified"]),
                sources=sorted(list(v["sources"])),
            )
            for v in sorted(compiled_skills.values(), key=lambda x: (x["skill"].name.lower()))
        ]

        # 6. Resume info (safe metadata only)
        resume_info: Optional[PassportResumeInfo] = None
        if student.resume:
            resume_info = PassportResumeInfo(
                id=student.resume.id,
                original_filename=student.resume.original_filename,
                content_type=student.resume.content_type,
                file_size=student.resume.file_size,
                updated_at=student.resume.updated_at,
            )

        # 7. Summary metrics
        all_eval_scores = [
            e.overall_score
            for proj in passport_projects
            for e in proj.evaluations
            if e.overall_score is not None
        ]
        total_eval_count = sum(proj.evaluations_count for proj in passport_projects)
        avg_project_score = round(sum(all_eval_scores) / len(all_eval_scores), 2) if all_eval_scores else None

        summary = PassportSummary(
            verified_experiences_count=len(passport_experiences),
            public_projects_count=len([p for p in passport_projects if p.visibility == "public" and p.status == "active"]),
            canonical_skills_count=len(passport_skills),
            completed_milestones_count=completed_milestone_count,
            verified_evidence_count=len(all_verified_evidence),
            total_evaluations_count=total_eval_count,
            average_project_score=avg_project_score,
        )

        return PassportResponse(
            identity=identity,
            summary=summary,
            verified_experiences=passport_experiences,
            projects=passport_projects,
            skills=passport_skills,
            milestones=passport_milestones,
            verified_evidence=all_verified_evidence,
            resume=resume_info,
            is_owner=is_owner,
        )

    # ==============================================================================
    # Phase 36: Passport Share Link Management & Public Verification Resolution
    # ==============================================================================

    @staticmethod
    def create_share_link(
        db: Session,
        *,
        student_id: int,
        payload: PassportShareCreateRequest,
    ) -> PassportShareCreateResponse:
        """
        Generate a secure, granular public share link for a student's Passport.
        The raw 256-bit token is returned only in this response; only its SHA-256 hash is persisted.
        """
        raw_token = f"cb_share_{secrets.token_urlsafe(32)}"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        expires_at: Optional[datetime] = None
        if payload.expires_in_days is not None:
            expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

        share = PassportShare(
            student_id=student_id,
            token_hash=token_hash,
            label=payload.label,
            allow_contact_info=payload.allow_contact_info,
            allow_unverified_projects=payload.allow_unverified_projects,
            is_active=True,
            view_count=0,
            expires_at=expires_at,
        )
        db.add(share)
        db.commit()
        db.refresh(share)

        return PassportShareCreateResponse(
            id=share.id,
            share_token=raw_token,
            share_url=f"/p/{raw_token}",
            label=share.label,
            is_active=share.is_active,
            allow_contact_info=share.allow_contact_info,
            allow_unverified_projects=share.allow_unverified_projects,
            view_count=share.view_count,
            expires_at=share.expires_at,
            created_at=share.created_at,
        )

    @staticmethod
    def list_share_links(
        db: Session,
        *,
        student_id: int,
    ) -> List[PassportShareSummaryResponse]:
        """
        List all active and historical share links generated by the authenticated student.
        Raw tokens are never returned; a masked token preview is provided.
        """
        shares = db.scalars(
            select(PassportShare)
            .where(PassportShare.student_id == student_id)
            .order_by(PassportShare.created_at.desc())
        ).all()

        results: List[PassportShareSummaryResponse] = []
        for s in shares:
            token_preview = f"cb_share_{s.token_hash[:8]}..."
            results.append(
                PassportShareSummaryResponse(
                    id=s.id,
                    token_preview=token_preview,
                    share_url=None,
                    label=s.label,
                    is_active=s.is_active,
                    allow_contact_info=s.allow_contact_info,
                    allow_unverified_projects=s.allow_unverified_projects,
                    view_count=s.view_count,
                    last_accessed_at=s.last_accessed_at,
                    expires_at=s.expires_at,
                    created_at=s.created_at,
                    revoked_at=s.revoked_at,
                )
            )
        return results

    @staticmethod
    def update_share_link(
        db: Session,
        *,
        share_id: int,
        student_id: int,
        payload: PassportShareUpdateRequest,
    ) -> PassportShareSummaryResponse:
        """
        Update settings on an existing Passport share link owned by the authenticated student.
        """
        share = db.scalar(
            select(PassportShare)
            .where(
                PassportShare.id == share_id,
                PassportShare.student_id == student_id,
            )
        )
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Passport share link not found",
            )

        if payload.label is not None:
            share.label = payload.label
        if payload.allow_contact_info is not None:
            share.allow_contact_info = payload.allow_contact_info
        if payload.allow_unverified_projects is not None:
            share.allow_unverified_projects = payload.allow_unverified_projects

        # Expiration update semantics:
        # clear_expiration == True -> set expires_at = None (remove expiration)
        # expires_in_days provided -> calculate new expires_at
        # both omitted -> preserve existing expiration
        if payload.clear_expiration:
            share.expires_at = None
        elif payload.expires_in_days is not None:
            share.expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

        # Activation update semantics:
        # is_active == False -> revoke link and record revoked_at timestamp
        # is_active == True -> reactivate link and clear revoked_at
        # is_active == None -> preserve existing active/revoked state
        if payload.is_active is False:
            share.is_active = False
            if share.revoked_at is None:
                share.revoked_at = datetime.now(timezone.utc)
        elif payload.is_active is True:
            share.is_active = True
            share.revoked_at = None

        db.commit()
        db.refresh(share)

        token_preview = f"cb_share_{share.token_hash[:8]}..."
        return PassportShareSummaryResponse(
            id=share.id,
            token_preview=token_preview,
            share_url=None,
            label=share.label,
            is_active=share.is_active,
            allow_contact_info=share.allow_contact_info,
            allow_unverified_projects=share.allow_unverified_projects,
            view_count=share.view_count,
            last_accessed_at=share.last_accessed_at,
            expires_at=share.expires_at,
            created_at=share.created_at,
            revoked_at=share.revoked_at,
        )

    @staticmethod
    def revoke_share_link(
        db: Session,
        *,
        share_id: int,
        student_id: int,
    ) -> None:
        """
        Revoke an existing Passport share link owned by the authenticated student.
        Subsequent public access attempts will return 410 Gone.
        """
        share = db.scalar(
            select(PassportShare)
            .where(
                PassportShare.id == share_id,
                PassportShare.student_id == student_id,
            )
        )
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Passport share link not found",
            )

        share.is_active = False
        share.revoked_at = datetime.now(timezone.utc)
        db.commit()

    @staticmethod
    def get_public_passport(
        db: Session,
        *,
        raw_token: str,
    ) -> PublicPassportResponse:
        """
        Resolve a public Passport share token into an explicit, sanitized PublicPassportResponse.
        Enforces server-side privacy boundaries, checks revocation/expiration, and atomically
        increments the view counter via SQL-level arithmetic ONLY after full validation.
        """
        # 1. Look up share record by SHA-256 token hash
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        share = db.scalar(
            select(PassportShare)
            .where(PassportShare.token_hash == token_hash)
        )

        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share link is invalid or does not exist.",
            )

        if not share.is_active or share.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This Career Passport link has been revoked by the owner.",
            )

        now_utc = datetime.now(timezone.utc)
        if share.expires_at is not None and share.expires_at < now_utc:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This Career Passport link has expired.",
            )

        # 2. Load and Validate Target Student User & Profile
        student = db.scalar(
            select(User)
            .where(User.id == share.student_id)
            .options(
                selectinload(User.student_profile).selectinload(StudentProfile.student_skills).selectinload(StudentSkill.skill),
            )
        )

        if not student or not student.is_active or student.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found or inactive.",
            )

        # 3. Database-level atomic view counter increment (Executes ONLY after validation)
        db.execute(
            update(PassportShare)
            .where(PassportShare.id == share.id)
            .values(
                view_count=PassportShare.view_count + 1,
                last_accessed_at=func.now(),
            )
        )
        db.commit()

        profile = student.student_profile

        # 4. Optional Contact Info (Omitted when allow_contact_info is False)
        contact_info: Optional[PublicContactInfo] = None
        if share.allow_contact_info:
            contact_info = PublicContactInfo(
                email=student.email,
                phone=profile.phone if profile and profile.phone else None,
                portfolio_url=profile.portfolio_url if profile and profile.portfolio_url else None,
                linkedin_url=profile.linkedin_url if profile and profile.linkedin_url else None,
                github_url=profile.github_url if profile and profile.github_url else None,
            )

        # 5. Verified Experience Timeline (Only VERIFIED records; internal IDs omitted)
        exp_records = db.scalars(
            select(ExperienceRecord)
            .where(
                ExperienceRecord.student_id == student.id,
                ExperienceRecord.status == VerificationStatus.VERIFIED,
            )
            .options(
                selectinload(ExperienceRecord.experience_skills).selectinload(ExperienceSkill.skill),
            )
            .order_by(ExperienceRecord.start_date.desc(), ExperienceRecord.id.desc())
        ).all()

        experience_timeline: List[PublicExperienceItem] = [
            PublicExperienceItem(
                company_name=exp.organization_name or "Verified Employer",
                role_title=exp.title,
                employment_type=exp.experience_type.value if hasattr(exp.experience_type, "value") else str(exp.experience_type),
                start_date=exp.start_date.isoformat() if hasattr(exp.start_date, "isoformat") else str(exp.start_date),
                end_date=exp.end_date.isoformat() if exp.end_date and hasattr(exp.end_date, "isoformat") else (str(exp.end_date) if exp.end_date else None),
                is_current=exp.is_current,
                is_verified=True,
                verified_at=exp.verified_at,
            )
            for exp in exp_records
        ]

        # 6. Featured Innovation Projects & Authoritative Evidence Verification
        projects_query = (
            select(InnovationProject)
            .where(
                InnovationProject.student_id == student.id,
                InnovationProject.status == ProjectStatus.ACTIVE,
                InnovationProject.visibility == ProjectVisibility.PUBLIC,
            )
            .options(
                selectinload(InnovationProject.milestones),
                selectinload(InnovationProject.project_skills).selectinload(ProjectSkill.skill),
                selectinload(InnovationProject.evidence_items).selectinload(ProjectEvidence.verification),
            )
            .order_by(InnovationProject.created_at.desc())
        )
        all_projects = db.scalars(projects_query).all()

        featured_projects: List[PublicProjectItem] = []
        verified_projects: List[InnovationProject] = []

        for proj in all_projects:
            verified_ev_count = sum(
                1 for ev in (proj.evidence_items or [])
                if ev.verification is not None
                and (
                    ev.verification.status == EvidenceVerificationStatus.VERIFIED
                    or (hasattr(ev.verification.status, "value") and ev.verification.status.value == "verified")
                    or ev.verification.status == "verified"
                )
            )
            completed_milestones = sum(
                1 for m in (proj.milestones or [])
                if (hasattr(m.status, "value") and m.status.value == "completed") or m.status == "completed" or m.status == MilestoneStatus.COMPLETED
            )
            total_milestones = len(proj.milestones or [])
            # Authoritative project verification rule: at least one evidence artifact verified by verifier
            is_verified = verified_ev_count > 0

            if is_verified:
                verified_projects.append(proj)
            elif not share.allow_unverified_projects:
                # Exclude unverified project if share link disallows it
                continue

            featured_projects.append(
                PublicProjectItem(
                    title=proj.title,
                    tagline=proj.short_description,
                    description=proj.description,
                    milestones_completed=completed_milestones,
                    total_milestones=total_milestones,
                    repository_url=proj.repository_url,
                    live_demo_url=proj.live_demo_url,
                    is_verified=is_verified,
                    verified_evidence_count=verified_ev_count,
                )
            )

        # 7. Verified Skills Provenance (ONLY verified experiences and genuinely verified projects contribute)
        skill_map: Dict[str, Dict[str, Any]] = {}
        for exp in exp_records:
            for es in (exp.experience_skills or []):
                if es.skill:
                    s_name = es.skill.name
                    key = s_name.lower()
                    if key not in skill_map:
                        skill_map[key] = {
                            "name": s_name,
                            "category": es.skill.category.value if hasattr(es.skill.category, "value") else (str(es.skill.category) if es.skill.category else "Experience"),
                            "projects": 0,
                            "placements": 0,
                        }
                    skill_map[key]["placements"] += 1

        for proj in verified_projects:
            for ps in (proj.project_skills or []):
                if ps.skill:
                    s_name = ps.skill.name
                    key = s_name.lower()
                    if key not in skill_map:
                        skill_map[key] = {
                            "name": s_name,
                            "category": ps.skill.category.value if hasattr(ps.skill.category, "value") else (str(ps.skill.category) if ps.skill.category else "Project"),
                            "projects": 0,
                            "placements": 0,
                        }
                    skill_map[key]["projects"] += 1

        verified_skills: List[PublicSkillProvenance] = [
            PublicSkillProvenance(
                skill_name=data["name"],
                category=data["category"],
                projects_count=data["projects"],
                verified_placements_count=data["placements"],
            )
            for data in sorted(skill_map.values(), key=lambda x: x["name"].lower())
        ]

        # 8. Compute Authoritative Verification Timestamp from Verified Artifacts
        verified_timestamps: List[datetime] = []
        for exp in exp_records:
            if exp.verified_at is not None:
                verified_timestamps.append(exp.verified_at)

        for proj in verified_projects:
            for ev in (proj.evidence_items or []):
                if (
                    ev.verification is not None
                    and (
                        ev.verification.status == EvidenceVerificationStatus.VERIFIED
                        or (hasattr(ev.verification.status, "value") and ev.verification.status.value == "verified")
                        or ev.verification.status == "verified"
                    )
                    and ev.verification.verified_at is not None
                ):
                    verified_timestamps.append(ev.verification.verified_at)

        latest_verified_at: Optional[datetime] = max(verified_timestamps) if verified_timestamps else None

        # 9. Verification Summary
        verification_summary = PublicVerificationSummary(
            issuer="CareerBridge",
            verification_status="VERIFIED",
            verified_at=latest_verified_at,
            verified_placements_count=len(experience_timeline),
            verified_projects_count=len(verified_projects),
            total_verified_skills=len(verified_skills),
        )

        return PublicPassportResponse(
            full_name=profile.full_name if profile else None,
            institution=profile.college if profile else None,
            major=profile.branch if profile else None,
            degree=profile.degree if profile else None,
            graduation_year=profile.graduation_year if profile else None,
            bio=profile.bio if profile else None,
            avatar_url=None,  # No internal student ID leaked
            contact_info=contact_info,
            verification_summary=verification_summary,
            verified_skills=verified_skills,
            experience_timeline=experience_timeline,
            featured_projects=featured_projects,
        )
