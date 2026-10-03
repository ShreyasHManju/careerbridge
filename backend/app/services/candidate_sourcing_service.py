from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.experience_record import ExperienceRecord, VerificationStatus
from app.models.innovation_project import InnovationProject, ProjectStatus, ProjectVisibility
from app.models.project_evaluation import EvaluationStatus, ProjectEvaluation
from app.models.project_evidence import ProjectEvidence
from app.models.project_evidence_verification import EvidenceVerificationStatus
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.candidate_sourcing import (
    CandidatePassportSummarySchema,
    CandidateProjectPreviewSchema,
    CandidateSearchResponseSchema,
    CandidateSourcingEducation,
    CandidateSourcingItem,
)
from app.schemas.skill import SkillResponse


class CandidateSourcingService:
    @classmethod
    def search_candidates(
        cls,
        db: Session,
        *,
        query: Optional[str] = None,
        skills: Optional[List[str]] = None,
        degree: Optional[str] = None,
        graduation_year: Optional[int] = None,
        has_verified_passport: bool = False,
        min_verified_skills: Optional[int] = None,
        sort_by: str = "verified_skills",
        page: int = 1,
        page_size: int = 10,
    ) -> CandidateSearchResponseSchema:
        # Base query for active students with profile
        stmt = (
            select(User)
            .join(StudentProfile, User.id == StudentProfile.user_id)
            .where(
                User.role == UserRole.STUDENT,
                User.is_active == True,  # noqa: E712
            )
            .options(
                selectinload(User.student_profile).selectinload(StudentProfile.student_skills).selectinload(StudentSkill.skill),
                selectinload(User.profile_image),
                selectinload(User.experience_records),
                selectinload(User.innovation_projects).selectinload(InnovationProject.evidence_items).selectinload(ProjectEvidence.verification),
                selectinload(User.innovation_projects).selectinload(InnovationProject.evaluations),
            )
        )

        # Filters
        if degree and degree.strip() and degree.lower() != "all":
            stmt = stmt.where(StudentProfile.degree.ilike(f"%{degree.strip()}%"))

        if graduation_year:
            stmt = stmt.where(StudentProfile.graduation_year == graduation_year)

        if query and query.strip():
            q = f"%{query.strip()}%"
            stmt = stmt.where(
                (StudentProfile.full_name.ilike(q))
                | (StudentProfile.bio.ilike(q))
                | (StudentProfile.college.ilike(q))
                | (StudentProfile.branch.ilike(q))
                | (StudentProfile.skills.ilike(q))
            )

        all_candidates = list(db.scalars(stmt).unique().all())

        # Post-filter and compile candidate summary objects
        compiled_items: List[CandidateSourcingItem] = []

        for student in all_candidates:
            profile = student.student_profile
            if not profile:
                continue

            # Skills
            all_skills: List[SkillResponse] = []
            verified_skills: List[SkillResponse] = []
            for ss in (profile.student_skills or []):
                if ss.skill:
                    sk_res = SkillResponse(
                        id=ss.skill.id,
                        name=ss.skill.name,
                        slug=ss.skill.slug,
                        category=ss.skill.category,
                        is_verified=ss.is_verified,
                        created_at=ss.skill.created_at,
                    )
                    all_skills.append(sk_res)
                    if ss.is_verified:
                        verified_skills.append(sk_res)

            # Filter by skills if specified
            if skills and len(skills) > 0:
                skill_names = [s.strip().lower() for s in skills if s.strip()]
                student_skill_names = [s.name.lower() for s in all_skills] + [s.slug.lower() for s in all_skills if s.slug]
                if not any(target in student_skill_names for target in skill_names):
                    continue

            # Filter by min_verified_skills
            if min_verified_skills and len(verified_skills) < min_verified_skills:
                continue

            # Experience records
            verified_experiences = [
                exp for exp in (student.experience_records or [])
                if exp.status == VerificationStatus.VERIFIED or (hasattr(exp.status, "value") and exp.status.value == "verified")
            ]

            # Innovation projects
            public_projects = [
                p for p in (student.innovation_projects or [])
                if (p.visibility == ProjectVisibility.PUBLIC or (hasattr(p.visibility, "value") and p.visibility.value == "public"))
                and (p.status == ProjectStatus.ACTIVE or (hasattr(p.status, "value") and p.status.value == "active"))
            ]

            top_project_previews: List[CandidateProjectPreviewSchema] = []
            total_evaluations_count = 0
            eval_score_sum = 0.0
            total_verified_evidence = 0

            for p in public_projects:
                p_verified_ev = [
                    ev for ev in (p.evidence_items or [])
                    if ev.verification and (ev.verification.status == EvidenceVerificationStatus.VERIFIED or (hasattr(ev.verification.status, "value") and ev.verification.status.value == "verified"))
                ]
                total_verified_evidence += len(p_verified_ev)

                # Submitted evaluations only
                submitted_evals = [
                    ev for ev in (p.evaluations or [])
                    if ev.status == EvaluationStatus.SUBMITTED or (hasattr(ev.status, "value") and ev.status.value == "submitted")
                ]
                total_evaluations_count += len(submitted_evals)
                p_eval_sum = sum(float(e.score_overall) for e in submitted_evals if e.score_overall is not None)
                p_avg_score = (p_eval_sum / len(submitted_evals)) if len(submitted_evals) > 0 else None
                eval_score_sum += p_eval_sum

                top_project_previews.append(
                    CandidateProjectPreviewSchema(
                        id=p.id,
                        title=p.title,
                        slug=p.slug,
                        short_description=p.short_description or (p.description[:140] if p.description else None),
                        project_type=p.project_type.value if hasattr(p.project_type, "value") else str(p.project_type),
                        visibility="public",
                        progress_percentage=p.progress_percentage or 100,
                        verified_evidence_count=len(p_verified_ev),
                        average_evaluation_score=p_avg_score,
                        evaluations_count=len(submitted_evals),
                    )
                )

            avg_project_score = (eval_score_sum / total_evaluations_count) if total_evaluations_count > 0 else None
            is_passport_verified = len(verified_experiences) > 0 or total_verified_evidence > 0

            if has_verified_passport and not is_passport_verified:
                continue

            passport_summary = CandidatePassportSummarySchema(
                verified_experiences_count=len(verified_experiences),
                public_projects_count=len(public_projects),
                canonical_skills_count=len(all_skills),
                completed_milestones_count=0,
                verified_evidence_count=total_verified_evidence,
                total_evaluations_count=total_evaluations_count,
                average_project_score=avg_project_score,
                is_verified=is_passport_verified,
            )

            profile_image_url = f"/api/v1/profile-image/{student.id}" if student.profile_image else None

            candidate_item = CandidateSourcingItem(
                id=student.id,
                full_name=profile.full_name,
                bio=profile.bio,
                profile_image_url=profile_image_url,
                github_url=profile.github_url,
                linkedin_url=profile.linkedin_url,
                portfolio_url=profile.portfolio_url,
                education=CandidateSourcingEducation(
                    college=profile.college,
                    degree=profile.degree,
                    branch=profile.branch,
                    graduation_year=profile.graduation_year,
                ),
                skills=all_skills,
                verified_skills=verified_skills,
                top_projects=top_project_previews[:3],
                passport_summary=passport_summary,
                created_at=student.created_at,
            )
            compiled_items.append(candidate_item)

        # Sorting
        if sort_by == "top_rated_projects":
            compiled_items.sort(
                key=lambda c: (
                    c.passport_summary.average_project_score or 0.0,
                    c.passport_summary.total_evaluations_count or 0,
                    len(c.verified_skills),
                ),
                reverse=True,
            )
        elif sort_by == "recent":
            compiled_items.sort(key=lambda c: c.created_at, reverse=True)
        else:  # 'verified_skills'
            compiled_items.sort(
                key=lambda c: (
                    len(c.verified_skills),
                    c.passport_summary.verified_experiences_count,
                    c.passport_summary.average_project_score or 0.0,
                ),
                reverse=True,
            )

        # Pagination
        total = len(compiled_items)
        total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1
        start_idx = (page - 1) * page_size
        paged_items = compiled_items[start_idx : start_idx + page_size]

        return CandidateSearchResponseSchema(
            items=paged_items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
