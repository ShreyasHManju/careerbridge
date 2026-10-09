from typing import Any, Dict, List, Optional, Set
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.experience_record import ExperienceRecord, ExperienceSkill, VerificationStatus
from app.models.innovation_project import (
    InnovationProject,
    ProjectSkill,
    ProjectStatus,
    ProjectVisibility,
)
from app.models.project_evaluation import (
    EvaluationSkillAssessment,
    EvaluationStatus,
    ProjectEvaluation,
    SkillAssessmentProficiency,
)
from app.models.project_evidence import ProjectEvidence
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.job_posting import JobMatchSummary, MatchedSkillItem
from app.schemas.skill import SkillResponse


from app.services.student_skill_compilation_service import StudentSkillCompilationService


class OpportunityMatchService:
    """
    Deterministic runtime matching service comparing a student's skill portfolio
    against job posting required skills and diagnosing skill gaps.
    """

    PROVENANCE_PRIORITY = StudentSkillCompilationService.PROVENANCE_PRIORITY
    OBSERVED_PROFICIENCIES = StudentSkillCompilationService.OBSERVED_PROFICIENCIES

    @classmethod
    def compile_student_skills(
        cls,
        db: Session,
        student_id: int,
    ) -> Dict[int, Dict[str, Any]]:
        """
        Compile the full canonical skill portfolio for a student.
        Delegates to canonical StudentSkillCompilationService in 'all_owned' scope.
        """
        return StudentSkillCompilationService.compile_student_skills(
            db, student_id, visibility_scope="all_owned"
        )

    @classmethod
    def compute_job_match(
        cls,
        job_skills: List[Skill],
        student_skills_map: Dict[int, Dict[str, Any]],
    ) -> JobMatchSummary:
        """
        Compute deterministic skill match and gap analysis between job required skills
        and compiled student skills map.
        """
        # Deduplicate job skills by canonical Skill.id while preserving first order
        seen_skill_ids: Set[int] = set()
        deduped_job_skills: List[Skill] = []
        for s in job_skills:
            if s and s.id and s.id not in seen_skill_ids:
                seen_skill_ids.add(s.id)
                deduped_job_skills.append(s)

        total_required = len(deduped_job_skills)

        # Edge case: Job has no required skills -> 100% match
        if total_required == 0:
            return JobMatchSummary(
                match_percentage=100,
                total_required=0,
                total_matched=0,
                total_verified_matched=0,
                total_missing=0,
                matched_skills=[],
                missing_skills=[],
            )

        matched_skills: List[MatchedSkillItem] = []
        missing_skills: List[SkillResponse] = []

        for req_skill in deduped_job_skills:
            if req_skill.id in student_skills_map:
                entry = student_skills_map[req_skill.id]
                matched_skills.append(
                    MatchedSkillItem(
                        id=req_skill.id,
                        name=req_skill.name,
                        slug=req_skill.slug,
                        category=req_skill.category,
                        is_verified=bool(entry["is_verified"]),
                        source=str(entry["source"]),
                    )
                )
            else:
                missing_skills.append(
                    SkillResponse(
                        id=req_skill.id,
                        name=req_skill.name,
                        slug=req_skill.slug,
                        category=req_skill.category,
                        is_verified=bool(req_skill.is_verified),
                        created_at=req_skill.created_at,
                    )
                )

        total_matched = len(matched_skills)
        total_verified_matched = len([m for m in matched_skills if m.is_verified])
        total_missing = len(missing_skills)

        match_percentage = round((total_matched / total_required) * 100)

        return JobMatchSummary(
            match_percentage=match_percentage,
            total_required=total_required,
            total_matched=total_matched,
            total_verified_matched=total_verified_matched,
            total_missing=total_missing,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
        )
