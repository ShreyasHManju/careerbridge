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


class OpportunityMatchService:
    """
    Deterministic runtime matching service comparing a student's skill portfolio
    against job posting required skills and diagnosing skill gaps.
    """

    PROVENANCE_PRIORITY = {
        "experience": 4,   # Authenticated third-party work/internship experience
        "evaluation": 3,   # Verified recruiter evaluation with observed proficiency
        "project": 2,      # Active project evidence / self-declaration
        "profile": 1,      # Self-claimed profile declaration
    }

    # Observed proficiency levels that establish verified competence in recruiter evaluations
    OBSERVED_PROFICIENCIES = {
        SkillAssessmentProficiency.BASIC,
        SkillAssessmentProficiency.INTERMEDIATE,
        SkillAssessmentProficiency.ADVANCED,
        "basic",
        "intermediate",
        "advanced",
    }

    @classmethod
    def compile_student_skills(
        cls,
        db: Session,
        student_id: int,
    ) -> Dict[int, Dict[str, Any]]:
        """
        Compile the full canonical skill portfolio for a student.
        Returns a mapping:
          skill_id -> {
              "skill": Skill,
              "is_verified": bool,
              "source": str ("experience" | "evaluation" | "project" | "profile"),
          }

        Rules:
        1. Eagerly loads all relations in single batch queries to eliminate N+1 latency.
        2. Student Profile: Self-declared skills (source='profile', is_verified=False).
        3. Innovation Projects:
           - Only ACTIVE projects (ProjectStatus.ACTIVE) owned by the student are considered.
           - DRAFT and ARCHIVED projects are strictly excluded.
           - Both PUBLIC and PRIVATE active projects owned by the student contribute to their
             own private opportunity match calculations (consistent with Passport owner view).
           - Project declared skills: registered with source='project', is_verified=False.
           - Project evidence validates project execution artifacts; granular skill verification
             is established by structured recruiter evaluations.
        4. Recruiter Evaluations:
           - Only SUBMITTED evaluations (EvaluationStatus.SUBMITTED) are considered.
           - DRAFT and WITHDRAWN evaluations are strictly excluded.
           - Evaluated skills with observed proficiency (BASIC, INTERMEDIATE, ADVANCED)
             establish verified competence (source='evaluation', is_verified=True).
           - Skills marked NOT_OBSERVED do NOT establish verified competence.
        5. Experience Records:
           - Only VERIFIED experience records (VerificationStatus.VERIFIED) establish verified competence.
           - Registered with source='experience', is_verified=True.
        6. Provenance hierarchy: When a skill is present across multiple sources, the strongest
           provenance source is preserved (experience > evaluation > project > profile), and
           is_verified is True if any verified source establishes it.
        """
        student = db.scalar(
            select(User)
            .where(User.id == student_id, User.role == UserRole.STUDENT, User.is_active == True)  # noqa: E712
            .options(
                selectinload(User.student_profile)
                .selectinload(StudentProfile.student_skills)
                .selectinload(StudentSkill.skill),

                selectinload(User.experience_records)
                .selectinload(ExperienceRecord.experience_skills)
                .selectinload(ExperienceSkill.skill),

                selectinload(User.innovation_projects)
                .selectinload(InnovationProject.project_skills)
                .selectinload(ProjectSkill.skill),

                selectinload(User.innovation_projects)
                .selectinload(InnovationProject.evidence_items)
                .selectinload(ProjectEvidence.verification),

                selectinload(User.innovation_projects)
                .selectinload(InnovationProject.evaluations)
                .selectinload(ProjectEvaluation.skill_assessments)
                .selectinload(EvaluationSkillAssessment.skill),
            )
        )

        if not student:
            return {}

        skill_map: Dict[int, Dict[str, Any]] = {}

        def register_skill(skill: Optional[Skill], source: str, is_verified: bool):
            if not skill or not skill.id:
                return
            s_id = skill.id
            if s_id not in skill_map:
                skill_map[s_id] = {
                    "skill": skill,
                    "is_verified": is_verified,
                    "source": source,
                }
            else:
                current_entry = skill_map[s_id]
                current_prio = cls.PROVENANCE_PRIORITY.get(current_entry["source"], 0)
                new_prio = cls.PROVENANCE_PRIORITY.get(source, 0)
                # Upgrade source if stronger
                if new_prio > current_prio:
                    current_entry["source"] = source
                # Upgrade verified flag if any source proves verification
                if is_verified:
                    current_entry["is_verified"] = True

        # 1. Profile skills (Claimed)
        profile = student.student_profile
        if profile and profile.student_skills:
            for ss in profile.student_skills:
                if ss.skill:
                    register_skill(ss.skill, source="profile", is_verified=False)

        # 2. Project skills & Recruiter Evaluated skills
        for proj in (student.innovation_projects or []):
            is_active = (
                proj.status == ProjectStatus.ACTIVE
                or (hasattr(proj.status, "value") and proj.status.value == "active")
                or str(proj.status).lower() == "active"
            )
            # DRAFT or ARCHIVED projects are strictly omitted
            if not is_active:
                continue

            # Project declared skills (demonstrated via active project)
            for ps in (proj.project_skills or []):
                if ps.skill:
                    register_skill(ps.skill, source="project", is_verified=False)

            # Recruiter assessed skills on submitted evaluations
            for pe in (proj.evaluations or []):
                is_eval_submitted = (
                    pe.status == EvaluationStatus.SUBMITTED
                    or (hasattr(pe.status, "value") and pe.status.value == "submitted")
                    or str(pe.status).lower() == "submitted"
                )
                # Ignore DRAFT and WITHDRAWN evaluations
                if not is_eval_submitted or not pe.skill_assessments:
                    continue

                for sa in pe.skill_assessments:
                    # NOT_OBSERVED must NOT count as an observed/verified skill
                    is_observed = sa.proficiency in cls.OBSERVED_PROFICIENCIES or (
                        hasattr(sa.proficiency, "value") and sa.proficiency.value in cls.OBSERVED_PROFICIENCIES
                    )
                    if is_observed and sa.skill:
                        register_skill(sa.skill, source="evaluation", is_verified=True)

        # 3. Verified Experience Record skills
        for exp in (student.experience_records or []):
            is_exp_verified = (
                exp.status == VerificationStatus.VERIFIED
                or (hasattr(exp.status, "value") and exp.status.value == "verified")
                or str(exp.status).lower() == "verified"
            )
            if is_exp_verified and exp.experience_skills:
                for es in exp.experience_skills:
                    if es.skill:
                        register_skill(es.skill, source="experience", is_verified=True)

        return skill_map

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
