import uuid
from datetime import date
import pytest
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.test_fixtures import clean_test_records
from app.models.experience_record import ExperienceRecord, ExperienceSkill, VerificationSource, VerificationStatus
from app.models.innovation_project import InnovationProject, ProjectSkill, ProjectStatus, ProjectVisibility
from app.models.project_evaluation import (
    EvaluationRecommendation,
    EvaluationSkillAssessment,
    EvaluationStatus,
    ProjectEvaluation,
    SkillAssessmentProficiency,
)
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.skill_service import get_or_create_skill
from app.services.student_skill_compilation_service import StudentSkillCompilationService


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        test_users = session.scalars(select(User.id).where(User.email.like("%@test_compilation.io"))).all()
        if test_users:
            clean_test_records(session, user_ids=list(test_users))
        session.close()


@pytest.fixture
def skills(db):
    s1 = get_or_create_skill(db, "Python", category="Backend")
    s2 = get_or_create_skill(db, "React", category="Frontend")
    s3 = get_or_create_skill(db, "Docker", category="DevOps")
    s4 = get_or_create_skill(db, "Rust", category="Languages")
    s5 = get_or_create_skill(db, "Kubernetes", category="DevOps")
    s6 = get_or_create_skill(db, "PostgreSQL", category="Database")
    db.commit()
    return {
        "python": s1,
        "react": s2,
        "docker": s3,
        "rust": s4,
        "k8s": s5,
        "postgres": s6,
    }


def test_profile_skill_is_unverified_even_if_catalog_is_verified(db, skills):
    """
    Skill.is_verified=True on the master catalog table does NOT make a self-claimed
    profile skill verified for the student.
    """
    u_id = uuid.uuid4().hex[:8]
    s_python = skills["python"]
    assert s_python.is_verified is True  # Master catalog entry is verified

    student = User(
        email=f"stu_prof_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()

    profile = StudentProfile(user_id=student.id, full_name="Test Student")
    db.add(profile)
    db.flush()

    ss = StudentSkill(student_profile_id=profile.id, skill_id=s_python.id)
    db.add(ss)
    db.commit()

    compiled = StudentSkillCompilationService.compile_student_skills(db, student.id)
    assert s_python.id in compiled
    assert compiled[s_python.id]["is_verified"] is False
    assert compiled[s_python.id]["source"] == "profile"
    assert "profile" in compiled[s_python.id]["sources"]


def test_verified_experience_makes_skill_verified(db, skills):
    """ExperienceRecord with VERIFIED status marks skill as verified with experience provenance."""
    u_id = uuid.uuid4().hex[:8]
    s_pg = skills["postgres"]

    student = User(
        email=f"stu_exp_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()

    exp = ExperienceRecord(
        student_id=student.id,
        title="DB Admin",
        organization_name="Enterprise Co",
        experience_type="work",
        start_date=date(2025, 1, 1),
        description="Database administration and performance tuning.",
        status=VerificationStatus.VERIFIED,
        verification_source=VerificationSource.ADMIN_CONFIRMED,
    )
    db.add(exp)
    db.flush()

    es = ExperienceSkill(experience_record_id=exp.id, skill_id=s_pg.id)
    db.add(es)
    db.commit()

    compiled = StudentSkillCompilationService.compile_student_skills(db, student.id)
    assert s_pg.id in compiled
    assert compiled[s_pg.id]["is_verified"] is True
    assert compiled[s_pg.id]["source"] == "experience"


def test_unverified_experience_does_not_verify_skill(db, skills):
    """ExperienceRecord with CLAIMED or REJECTED status does not verify skill."""
    u_id = uuid.uuid4().hex[:8]
    s_pg = skills["postgres"]

    student = User(
        email=f"stu_unv_exp_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()

    exp = ExperienceRecord(
        student_id=student.id,
        title="Unverified Work",
        organization_name="Co",
        experience_type="work",
        start_date=date(2025, 1, 1),
        description="Self claimed work.",
        status=VerificationStatus.CLAIMED,
        verification_source=VerificationSource.SELF_CLAIMED,
    )
    db.add(exp)
    db.flush()

    es = ExperienceSkill(experience_record_id=exp.id, skill_id=s_pg.id)
    db.add(es)
    db.commit()

    compiled = StudentSkillCompilationService.compile_student_skills(db, student.id)
    assert s_pg.id not in compiled


def test_evaluation_observed_proficiency_verifies_skill(db, skills):
    """Submitted recruiter evaluation with BASIC, INTERMEDIATE, or ADVANCED verifies skill."""
    u_id = uuid.uuid4().hex[:8]
    s_rust = skills["rust"]

    student = User(
        email=f"stu_eval_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    recruiter = User(
        email=f"rec_eval_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    db.add_all([student, recruiter])
    db.flush()

    proj = InnovationProject(
        student_id=student.id,
        title="Rust Engine",
        slug=f"rust-engine-{u_id}",
        description="Rust systems engine",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(proj)
    db.flush()

    eval_rec = ProjectEvaluation(
        project_id=proj.id,
        student_id=student.id,
        recruiter_id=recruiter.id,
        status=EvaluationStatus.SUBMITTED,
        overall_score=4.5,
    )
    db.add(eval_rec)
    db.flush()

    sa = EvaluationSkillAssessment(
        evaluation_id=eval_rec.id,
        skill_id=s_rust.id,
        proficiency=SkillAssessmentProficiency.ADVANCED,
    )
    db.add(sa)
    db.commit()

    compiled = StudentSkillCompilationService.compile_student_skills(db, student.id)
    assert s_rust.id in compiled
    assert compiled[s_rust.id]["is_verified"] is True
    assert compiled[s_rust.id]["source"] == "evaluation"


def test_evaluation_not_observed_or_draft_does_not_verify(db, skills):
    """NOT_OBSERVED, DRAFT, and WITHDRAWN evaluations must NOT verify skills."""
    u_id = uuid.uuid4().hex[:8]
    s_docker = skills["docker"]
    s_k8s = skills["k8s"]

    student = User(
        email=f"stu_eval_no_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    recruiter = User(
        email=f"rec_eval_no_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    recruiter2 = User(
        email=f"rec_eval_no2_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    db.add_all([student, recruiter, recruiter2])
    db.flush()

    proj = InnovationProject(
        student_id=student.id,
        title="Cloud Ops",
        slug=f"cloud-ops-{u_id}",
        description="Cloud deployment",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(proj)
    db.flush()

    # Evaluation 1: SUBMITTED but NOT_OBSERVED for Docker
    eval_not_obs = ProjectEvaluation(
        project_id=proj.id,
        student_id=student.id,
        recruiter_id=recruiter.id,
        status=EvaluationStatus.SUBMITTED,
        overall_score=3.0,
    )
    db.add(eval_not_obs)
    db.flush()
    sa1 = EvaluationSkillAssessment(
        evaluation_id=eval_not_obs.id,
        skill_id=s_docker.id,
        proficiency=SkillAssessmentProficiency.NOT_OBSERVED,
    )
    db.add(sa1)

    # Evaluation 2: DRAFT evaluation with ADVANCED for K8s
    eval_draft = ProjectEvaluation(
        project_id=proj.id,
        student_id=student.id,
        recruiter_id=recruiter2.id,
        status=EvaluationStatus.DRAFT,
        overall_score=4.0,
    )
    db.add(eval_draft)
    db.flush()
    sa2 = EvaluationSkillAssessment(
        evaluation_id=eval_draft.id,
        skill_id=s_k8s.id,
        proficiency=SkillAssessmentProficiency.ADVANCED,
    )
    db.add(sa2)
    db.commit()

    compiled = StudentSkillCompilationService.compile_student_skills(db, student.id)
    assert s_docker.id not in compiled
    assert s_k8s.id not in compiled


def test_visibility_scoping_public_only_vs_all_owned(db, skills):
    """
    In public_only scope (recruiter sourcing), private project skills are excluded.
    In all_owned scope (student self-view/matching), private active project skills are included.
    """
    u_id = uuid.uuid4().hex[:8]
    s_react = skills["react"]
    s_rust = skills["rust"]

    student = User(
        email=f"stu_vis_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()

    # Public active project with React
    p_pub = InnovationProject(
        student_id=student.id,
        title="Public App",
        slug=f"pub-app-{u_id}",
        description="Public frontend app",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    # Private active project with Rust
    p_priv = InnovationProject(
        student_id=student.id,
        title="Private Research",
        slug=f"priv-res-{u_id}",
        description="Secret Rust research",
        project_type="research",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PRIVATE,
    )
    db.add_all([p_pub, p_priv])
    db.flush()

    ps_pub = ProjectSkill(innovation_project_id=p_pub.id, skill_id=s_react.id)
    ps_priv = ProjectSkill(innovation_project_id=p_priv.id, skill_id=s_rust.id)
    db.add_all([ps_pub, ps_priv])
    db.commit()

    # Recruiter view: public_only
    recruiter_compiled = StudentSkillCompilationService.compile_student_skills(
        db, student.id, visibility_scope="public_only"
    )
    assert s_react.id in recruiter_compiled
    assert s_rust.id not in recruiter_compiled

    # Student self view: all_owned
    student_compiled = StudentSkillCompilationService.compile_student_skills(
        db, student.id, visibility_scope="all_owned"
    )
    assert s_react.id in student_compiled
    assert s_rust.id in student_compiled


def test_draft_and_archived_projects_strictly_excluded_in_all_scopes(db, skills):
    """Draft and archived projects are omitted even in all_owned scope."""
    u_id = uuid.uuid4().hex[:8]
    s_docker = skills["docker"]
    s_k8s = skills["k8s"]

    student = User(
        email=f"stu_proj_status_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()

    p_draft = InnovationProject(
        student_id=student.id,
        title="Draft Ops",
        slug=f"draft-ops-{u_id}",
        description="Draft",
        project_type="software",
        status=ProjectStatus.DRAFT,
        visibility=ProjectVisibility.PUBLIC,
    )
    p_archived = InnovationProject(
        student_id=student.id,
        title="Archived Ops",
        slug=f"arch-ops-{u_id}",
        description="Archived",
        project_type="software",
        status=ProjectStatus.ARCHIVED,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add_all([p_draft, p_archived])
    db.flush()

    ps1 = ProjectSkill(innovation_project_id=p_draft.id, skill_id=s_docker.id)
    ps2 = ProjectSkill(innovation_project_id=p_archived.id, skill_id=s_k8s.id)
    db.add_all([ps1, ps2])
    db.commit()

    compiled = StudentSkillCompilationService.compile_student_skills(
        db, student.id, visibility_scope="all_owned"
    )
    assert s_docker.id not in compiled
    assert s_k8s.id not in compiled


def test_provenance_hierarchy_upgrade_and_verification_retention(db, skills):
    """
    When a skill appears across profile, project, and experience:
    - Provenance hierarchy upgrades: experience (4) > project (2) > profile (1)
    - is_verified is True if ANY verified source establishes it.
    """
    u_id = uuid.uuid4().hex[:8]
    s_python = skills["python"]

    student = User(
        email=f"stu_prio_{u_id}@test_compilation.io",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()

    # 1. Profile claim (weakest, is_verified=False)
    prof = StudentProfile(user_id=student.id, full_name="Student Multi")
    db.add(prof)
    db.flush()
    ss = StudentSkill(student_profile_id=prof.id, skill_id=s_python.id)
    db.add(ss)

    # 2. Project declaration (source='project', is_verified=False)
    proj = InnovationProject(
        student_id=student.id,
        title="Python Tool",
        slug=f"py-tool-{u_id}",
        description="Tool",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(proj)
    db.flush()
    ps = ProjectSkill(innovation_project_id=proj.id, skill_id=s_python.id)
    db.add(ps)

    # 3. Verified Experience (strongest, is_verified=True)
    exp = ExperienceRecord(
        student_id=student.id,
        title="Python Engineer",
        organization_name="Tech Corp",
        experience_type="work",
        start_date=date(2025, 1, 1),
        description="Python backend development.",
        status=VerificationStatus.VERIFIED,
        verification_source=VerificationSource.ADMIN_CONFIRMED,
    )
    db.add(exp)
    db.flush()
    es = ExperienceSkill(experience_record_id=exp.id, skill_id=s_python.id)
    db.add(es)
    db.commit()

    compiled = StudentSkillCompilationService.compile_student_skills(db, student.id)
    entry = compiled[s_python.id]
    assert entry["is_verified"] is True
    assert entry["source"] == "experience"
    assert entry["sources"] == {"profile", "project", "experience"}


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
