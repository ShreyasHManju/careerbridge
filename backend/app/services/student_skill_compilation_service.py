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


class StudentSkillCompilationService:
    """
    Canonical service for aggregating and determining the verified competence
    and provenance of a student's skill portfolio.

    Rules:
    1. Provenance Hierarchy: experience (4) > evaluation (3) > project (2) > profile (1).
    2. Verification Invariant:
       - Skill.is_verified on the canonical catalog represents master catalog approval only.
       - A student's possession of a skill is verified (is_verified=True) IF AND ONLY IF backed by:
         a. Verified Experience record (VerificationStatus.VERIFIED), OR
         b. Submitted Recruiter Evaluation (EvaluationStatus.SUBMITTED) with observed proficiency
            (BASIC, INTERMEDIATE, ADVANCED).
       - Self-claimed profile skills and active project declarations have is_verified=False.
       - NOT_OBSERVED evaluation proficiency, DRAFT evaluations, and WITHDRAWN evaluations
         strictly do NOT grant verification.
    3. Visibility Scoping:
       - "all_owned": Includes private active projects and their submitted evaluations (used for
         student self-view and opportunity matching).
       - "public_only": Excludes private projects and their evaluations (used for recruiter
         candidate sourcing and public passport view).
       - DRAFT and ARCHIVED projects are strictly excluded in all scopes.
    """

    PROVENANCE_PRIORITY = {
        "experience": 4,   # Authenticated third-party work/internship experience
        "evaluation": 3,   # Verified recruiter evaluation with observed proficiency
        "project": 2,      # Active project evidence / self-declaration
        "profile": 1,      # Self-claimed profile declaration
    }

    OBSERVED_PROFICIENCIES = {
        SkillAssessmentProficiency.BASIC,
        SkillAssessmentProficiency.INTERMEDIATE,
        SkillAssessmentProficiency.ADVANCED,
        "basic",
        "intermediate",
        "advanced",
    }

    @classmethod
    def compile_student_skills_from_user(
        cls,
        student: User,
        visibility_scope: str = "all_owned",
    ) -> Dict[int, Dict[str, Any]]:
        """
        Compile canonical skills from an already loaded User entity.
        Returns:
            Dict[skill_id, {
                "skill": Skill,
                "is_verified": bool,
                "source": str,  # strongest source
                "sources": Set[str],  # all contributing sources
            }]
        """
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
                    "sources": {source},
                }
            else:
                current_entry = skill_map[s_id]
                current_entry["sources"].add(source)
                current_prio = cls.PROVENANCE_PRIORITY.get(current_entry["source"], 0)
                new_prio = cls.PROVENANCE_PRIORITY.get(source, 0)
                # Upgrade strongest source if current is weaker
                if new_prio > current_prio:
                    current_entry["source"] = source
                # Upgrade verification if any verified source establishes it
                if is_verified:
                    current_entry["is_verified"] = True

        # 1. Profile skills (Claimed)
        profile = student.student_profile
        if profile and profile.student_skills:
            for ss in profile.student_skills:
                if ss.skill:
                    register_skill(ss.skill, source="profile", is_verified=False)

        # 2. Innovation Projects & Recruiter Evaluated skills
        for proj in (student.innovation_projects or []):
            is_active = (
                proj.status == ProjectStatus.ACTIVE
                or (hasattr(proj.status, "value") and proj.status.value == "active")
                or str(proj.status).lower() == "active"
            )
            # DRAFT or ARCHIVED projects are strictly omitted in all scopes
            if not is_active:
                continue

            # In public_only scope, strictly omit non-public projects
            if visibility_scope == "public_only":
                is_public = (
                    proj.visibility == ProjectVisibility.PUBLIC
                    or (hasattr(proj.visibility, "value") and proj.visibility.value == "public")
                    or str(proj.visibility).lower() == "public"
                )
                if not is_public:
                    continue

            # Project declared skills
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
                if not is_eval_submitted or not pe.skill_assessments:
                    continue

                for sa in pe.skill_assessments:
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
    def compile_student_skills(
        cls,
        db: Session,
        student_id: int,
        visibility_scope: str = "all_owned",
    ) -> Dict[int, Dict[str, Any]]:
        """
        Load student with all necessary relationships and compile their skills.
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

        return cls.compile_student_skills_from_user(student, visibility_scope=visibility_scope)
