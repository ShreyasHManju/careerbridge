from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.experience_record import ExperienceRecord, VerificationStatus
from app.models.innovation_project import InnovationProject, ProjectStatus, ProjectVisibility
from app.models.profile_image import ProfileImage
from app.models.project_milestone import MilestoneStatus, ProjectMilestone
from app.models.resume import Resume
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.passport import (
    PassportExperienceItem,
    PassportIdentity,
    PassportMilestoneItem,
    PassportProjectItem,
    PassportResponse,
    PassportResumeInfo,
    PassportSkillItem,
    PassportSummary,
)
from app.schemas.skill import SkillResponse
from app.services.skill_service import format_skills_string


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
            .where(ExperienceRecord.student_id == target_student_id)
            .options(
                selectinload(ExperienceRecord.experience_skills).selectinload(ExperienceRecord.experience_skills.property.mapper.class_.skill),
                selectinload(ExperienceRecord.innovation_project),
            )
            .order_by(ExperienceRecord.start_date.desc(), ExperienceRecord.id.desc())
        )

        # In Passport presentation, experiences are strictly verified evidence
        # For non-owner, only VERIFIED. For owner, we include VERIFIED records in the passport timeline.
        if not (is_owner or is_admin):
            exp_stmt = exp_stmt.where(ExperienceRecord.status == VerificationStatus.VERIFIED)
        else:
            # For owner preview, filter to verified records for the verified timeline
            exp_stmt = exp_stmt.where(ExperienceRecord.status == VerificationStatus.VERIFIED)

        raw_experiences = list(db.scalars(exp_stmt).all())

        passport_experiences: List[PassportExperienceItem] = []
        for exp in raw_experiences:
            exp_skills: List[SkillResponse] = []
            skill_names: List[str] = []
            if exp.experience_skills:
                for es in exp.experience_skills:
                    if es.skill:
                        skill_names.append(es.skill.name)
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
            skills_str = format_skills_string(skill_names) if skill_names else None

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

        # 4. Retrieve and Filter Innovation Projects & Milestones
        proj_stmt = (
            select(InnovationProject)
            .where(InnovationProject.student_id == target_student_id)
            .options(
                selectinload(InnovationProject.project_skills).selectinload(InnovationProject.project_skills.property.mapper.class_.skill),
                selectinload(InnovationProject.milestones),
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
                )
            )

        # 5. Aggregate Canonical Skills Provenance
        skill_map: Dict[int, Dict] = {}

        # Profile skills
        if profile and profile.student_skills:
            for ss in profile.student_skills:
                if ss.skill:
                    s_id = ss.skill.id
                    if s_id not in skill_map:
                        skill_map[s_id] = {
                            "id": ss.skill.id,
                            "name": ss.skill.name,
                            "slug": ss.skill.slug,
                            "category": ss.skill.category,
                            "is_verified": ss.skill.is_verified,
                            "sources": set(),
                        }
                    skill_map[s_id]["sources"].add("profile")

        # Verified experience skills
        for exp in passport_experiences:
            for s in exp.structured_skills:
                if s.id not in skill_map:
                    skill_map[s.id] = {
                        "id": s.id,
                        "name": s.name,
                        "slug": s.slug,
                        "category": s.category,
                        "is_verified": s.is_verified,
                        "sources": set(),
                    }
                skill_map[s.id]["sources"].add("experience")

        # Included project skills
        for proj in passport_projects:
            for s in proj.structured_skills:
                if s.id not in skill_map:
                    skill_map[s.id] = {
                        "id": s.id,
                        "name": s.name,
                        "slug": s.slug,
                        "category": s.category,
                        "is_verified": s.is_verified,
                        "sources": set(),
                    }
                skill_map[s.id]["sources"].add("project")

        passport_skills = [
            PassportSkillItem(
                id=v["id"],
                name=v["name"],
                slug=v["slug"],
                category=v["category"],
                is_verified=v["is_verified"],
                sources=sorted(list(v["sources"])),
            )
            for v in sorted(skill_map.values(), key=lambda x: (x["name"].lower()))
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
        summary = PassportSummary(
            verified_experiences_count=len(passport_experiences),
            public_projects_count=len([p for p in passport_projects if p.visibility == "public" and p.status == "active"]),
            canonical_skills_count=len(passport_skills),
            completed_milestones_count=completed_milestone_count,
        )

        return PassportResponse(
            identity=identity,
            summary=summary,
            verified_experiences=passport_experiences,
            projects=passport_projects,
            skills=passport_skills,
            milestones=passport_milestones,
            resume=resume_info,
            is_owner=is_owner,
        )
