import uuid
import pytest
from datetime import date, datetime, timezone
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.core.test_fixtures import clean_test_records
from app.main import app
from app.models.experience_record import ExperienceRecord, ExperienceSkill, VerificationSource, VerificationStatus
from app.models.innovation_project import InnovationProject, ProjectSkill, ProjectStatus, ProjectVisibility
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.project_evaluation import (
    EvaluationRecommendation,
    EvaluationSkillAssessment,
    EvaluationStatus,
    ProjectEvaluation,
    SkillAssessmentProficiency,
)
from app.models.project_evidence import EvidenceType, ProjectEvidence
from app.models.project_evidence_verification import EvidenceVerification, EvidenceVerificationStatus
from app.models.skill import JobSkill, Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.opportunity_match_service import OpportunityMatchService
from app.services.skill_service import (
    get_or_create_skill,
    sync_experience_skills_from_text,
    sync_job_skills_from_text,
    sync_project_skills_from_text,
    sync_student_skills_from_text,
)
@pytest.fixture
def client():
    return TestClient(app)
@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        # Find any test users created during test
        test_users = session.scalars(select(User.id).where(User.email.like("%@test_match.io"))).all()
        if test_users:
            clean_test_records(session, user_ids=list(test_users))
        session.close()
@pytest.fixture
def match_skills(db):
    """Fixture creating distinct canonical skills."""
    s_python = get_or_create_skill(db, "Python", category="Backend")
    s_react = get_or_create_skill(db, "React", category="Frontend")
    s_sql = get_or_create_skill(db, "PostgreSQL", category="Database")
    s_docker = get_or_create_skill(db, "Docker", category="DevOps")
    s_fastapi = get_or_create_skill(db, "FastAPI", category="Backend")
    s_k8s = get_or_create_skill(db, "Kubernetes", category="DevOps")
    db.commit()
    return {
        "python": s_python,
        "react": s_react,
        "sql": s_sql,
        "docker": s_docker,
        "fastapi": s_fastapi,
        "k8s": s_k8s,
    }
def test_opportunity_match_full_match(db, match_skills):
    """Student with all required skills gets 100% match score."""
    s_python = match_skills["python"]
    s_react = match_skills["react"]
    student_skills_map = {
        s_python.id: {"skill": s_python, "is_verified": False, "source": "profile"},
        s_react.id: {"skill": s_react, "is_verified": True, "source": "experience"},
    }
    job_skills = [s_python, s_react]
    match = OpportunityMatchService.compute_job_match(job_skills, student_skills_map)
    assert match.match_percentage == 100
    assert match.total_required == 2
    assert match.total_matched == 2
    assert match.total_verified_matched == 1
    assert match.total_missing == 0
    assert len(match.matched_skills) == 2
    assert len(match.missing_skills) == 0
def test_opportunity_match_partial_match(db, match_skills):
    """Student with 2 of 3 required skills gets 67% match."""
    s_python = match_skills["python"]
    s_react = match_skills["react"]
    s_sql = match_skills["sql"]
    student_skills_map = {
        s_python.id: {"skill": s_python, "is_verified": True, "source": "experience"},
        s_react.id: {"skill": s_react, "is_verified": False, "source": "profile"},
    }
    job_skills = [s_python, s_react, s_sql]
    match = OpportunityMatchService.compute_job_match(job_skills, student_skills_map)
    assert match.match_percentage == 67
    assert match.total_required == 3
    assert match.total_matched == 2
    assert match.total_verified_matched == 1
    assert match.total_missing == 1
    assert match.missing_skills[0].id == s_sql.id
    assert match.missing_skills[0].name == "PostgreSQL"
def test_opportunity_match_zero_match(db, match_skills):
    """Student with none of the required skills gets 0% match."""
    s_python = match_skills["python"]
    s_docker = match_skills["docker"]
    student_skills_map = {
        s_python.id: {"skill": s_python, "is_verified": False, "source": "profile"},
    }
    job_skills = [s_docker]
    match = OpportunityMatchService.compute_job_match(job_skills, student_skills_map)
    assert match.match_percentage == 0
    assert match.total_required == 1
    assert match.total_matched == 0
    assert match.total_missing == 1
    assert len(match.matched_skills) == 0
    assert len(match.missing_skills) == 1
def test_opportunity_match_job_no_required_skills(db, match_skills):
    """Job with 0 required skills defaults to 100% match."""
    s_python = match_skills["python"]
    student_skills_map = {
        s_python.id: {"skill": s_python, "is_verified": False, "source": "profile"},
    }
    match = OpportunityMatchService.compute_job_match([], student_skills_map)
    assert match.match_percentage == 100
    assert match.total_required == 0
    assert match.total_matched == 0
    assert match.total_missing == 0
    assert match.matched_skills == []
    assert match.missing_skills == []
def test_opportunity_match_student_no_skills(db, match_skills):
    """Student with empty skill map gets 0% match for jobs requiring skills."""
    s_python = match_skills["python"]
    s_fastapi = match_skills["fastapi"]
    match = OpportunityMatchService.compute_job_match([s_python, s_fastapi], {})
    assert match.match_percentage == 0
    assert match.total_required == 2
    assert match.total_matched == 0
    assert match.total_missing == 2
    assert len(match.missing_skills) == 2
def test_opportunity_match_deduplicate_job_skills(db, match_skills):
    """Duplicate skills in job listing are deduplicated by canonical id."""
    s_python = match_skills["python"]
    student_skills_map = {
        s_python.id: {"skill": s_python, "is_verified": False, "source": "profile"},
    }
    # Job skill passed twice
    match = OpportunityMatchService.compute_job_match([s_python, s_python], student_skills_map)
    assert match.total_required == 1
    assert match.total_matched == 1
    assert match.match_percentage == 100
def test_profile_only_skill_unverified(db, match_skills):
    """Profile-only self-declared skills have source='profile' and is_verified=False."""
    u_id = uuid.uuid4().hex[:8]
    s_python = match_skills["python"]
    student = User(
        email=f"student_prof_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()
    profile = StudentProfile(
        user_id=student.id,
        full_name="Profile Only Student",
        college="Stanford",
        degree="B.S.",
        branch="CS",
        graduation_year=2026,
    )
    db.add(profile)
    db.flush()
    sync_student_skills_from_text(db, profile, "Python")
    db.commit()
    compiled = OpportunityMatchService.compile_student_skills(db, student.id)
    assert s_python.id in compiled
    assert compiled[s_python.id]["source"] == "profile"
    assert compiled[s_python.id]["is_verified"] is False
def test_project_status_and_privacy_rules(db, match_skills):
    """
    Active projects (both public and private) owned by student contribute to their own match.
    Draft and Archived projects are strictly omitted.
    """
    u_id = uuid.uuid4().hex[:8]
    s_python = match_skills["python"]
    s_react = match_skills["react"]
    s_sql = match_skills["sql"]
    s_docker = match_skills["docker"]
    student = User(
        email=f"student_proj_priv_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()
    # 1. Active Public project with Python
    p_pub = InnovationProject(
        student_id=student.id,
        title="Public Web App",
        slug=f"public-app-{u_id}",
        description="Public fullstack app",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(p_pub)
    db.flush()
    sync_project_skills_from_text(db, p_pub, "Python")
    # 2. Active Private project with React (contributes to student's own private portfolio)
    p_priv = InnovationProject(
        student_id=student.id,
        title="Private Stealth Project",
        slug=f"private-app-{u_id}",
        description="Proprietary algorithm",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PRIVATE,
    )
    db.add(p_priv)
    db.flush()
    sync_project_skills_from_text(db, p_priv, "React")
    # 3. Draft project with PostgreSQL (MUST BE IGNORED)
    p_draft = InnovationProject(
        student_id=student.id,
        title="Draft Scratchpad",
        slug=f"draft-app-{u_id}",
        description="Unpublished ideas",
        project_type="software",
        status=ProjectStatus.DRAFT,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(p_draft)
    db.flush()
    sync_project_skills_from_text(db, p_draft, "PostgreSQL")
    # 4. Archived project with Docker (MUST BE IGNORED)
    p_arch = InnovationProject(
        student_id=student.id,
        title="Old Abandoned Project",
        slug=f"archived-app-{u_id}",
        description="Legacy archived code",
        project_type="software",
        status=ProjectStatus.ARCHIVED,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(p_arch)
    db.flush()
    sync_project_skills_from_text(db, p_arch, "Docker")
    db.commit()
    compiled = OpportunityMatchService.compile_student_skills(db, student.id)
    # Active public skill present
    assert s_python.id in compiled
    assert compiled[s_python.id]["source"] == "project"
    # Active private skill present for student's own match
    assert s_react.id in compiled
    assert compiled[s_react.id]["source"] == "project"
    # Draft project skill excluded
    assert s_sql.id not in compiled
    # Archived project skill excluded
    assert s_docker.id not in compiled
def test_evaluation_not_observed_ignored(db, match_skills):
    """EvaluationSkillAssessment with NOT_OBSERVED proficiency must NOT count as a verified match."""
    u_id = uuid.uuid4().hex[:8]
    s_docker = match_skills["docker"]
    student = User(
        email=f"student_notobs_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    recruiter = User(
        email=f"recruiter_notobs_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    db.add(student)
    db.add(recruiter)
    db.flush()
    proj = InnovationProject(
        student_id=student.id,
        title="DevOps System",
        slug=f"devops-{u_id}",
        description="Devops pipeline",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(proj)
    db.flush()
    # Evaluation with NOT_OBSERVED for Docker
    eval_record = ProjectEvaluation(
        project_id=proj.id,
        student_id=student.id,
        recruiter_id=recruiter.id,
        status=EvaluationStatus.SUBMITTED,
        overall_score=3.0,
    )
    db.add(eval_record)
    db.flush()
    sa = EvaluationSkillAssessment(
        evaluation_id=eval_record.id,
        skill_id=s_docker.id,
        proficiency=SkillAssessmentProficiency.NOT_OBSERVED,
    )
    db.add(sa)
    db.commit()
    compiled = OpportunityMatchService.compile_student_skills(db, student.id)
    # NOT_OBSERVED skill should NOT be registered as evaluation-verified
    assert s_docker.id not in compiled
def test_evaluation_observed_proficiencies(db, match_skills):
    """BASIC, INTERMEDIATE, and ADVANCED evaluations establish verified evaluation skills."""
    u_id = uuid.uuid4().hex[:8]
    s_python = match_skills["python"]
    s_react = match_skills["react"]
    s_docker = match_skills["docker"]
    student = User(
        email=f"student_profic_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    recruiter = User(
        email=f"recruiter_profic_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    db.add(student)
    db.add(recruiter)
    db.flush()
    proj = InnovationProject(
        student_id=student.id,
        title="Full Stack Suite",
        slug=f"fullstack-{u_id}",
        description="Full stack suite",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(proj)
    db.flush()
    eval_record = ProjectEvaluation(
        project_id=proj.id,
        student_id=student.id,
        recruiter_id=recruiter.id,
        status=EvaluationStatus.SUBMITTED,
        overall_score=4.8,
    )
    db.add(eval_record)
    db.flush()
    # Add BASIC, INTERMEDIATE, ADVANCED assessments
    db.add(EvaluationSkillAssessment(
        evaluation_id=eval_record.id,
        skill_id=s_python.id,
        proficiency=SkillAssessmentProficiency.BASIC,
    ))
    db.add(EvaluationSkillAssessment(
        evaluation_id=eval_record.id,
        skill_id=s_react.id,
        proficiency=SkillAssessmentProficiency.INTERMEDIATE,
    ))
    db.add(EvaluationSkillAssessment(
        evaluation_id=eval_record.id,
        skill_id=s_docker.id,
        proficiency=SkillAssessmentProficiency.ADVANCED,
    ))
    db.commit()
    compiled = OpportunityMatchService.compile_student_skills(db, student.id)
    for s in [s_python, s_react, s_docker]:
        assert s.id in compiled
        assert compiled[s.id]["source"] == "evaluation"
        assert compiled[s.id]["is_verified"] is True
def test_draft_and_withdrawn_evaluations_ignored(db, match_skills):
    """Draft and Withdrawn evaluations do not contribute verified skills."""
    u_id = uuid.uuid4().hex[:8]
    s_python = match_skills["python"]
    s_react = match_skills["react"]
    student = User(
        email=f"student_eval_status_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    recruiter = User(
        email=f"recruiter_eval_status_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    db.add(student)
    db.add(recruiter)
    db.flush()
    proj = InnovationProject(
        student_id=student.id,
        title="Evaluation Testing Project",
        slug=f"eval-test-{u_id}",
        description="Testing evaluation statuses",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(proj)
    db.flush()
    # 1. Draft evaluation with Python ADVANCED
    eval_draft = ProjectEvaluation(
        project_id=proj.id,
        student_id=student.id,
        recruiter_id=recruiter.id,
        status=EvaluationStatus.DRAFT,
    )
    db.add(eval_draft)
    db.flush()
    db.add(EvaluationSkillAssessment(
        evaluation_id=eval_draft.id,
        skill_id=s_python.id,
        proficiency=SkillAssessmentProficiency.ADVANCED,
    ))
    # 2. Withdrawn evaluation with React ADVANCED
    recruiter_2 = User(
        email=f"recruiter2_eval_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    db.add(recruiter_2)
    db.flush()
    eval_withdrawn = ProjectEvaluation(
        project_id=proj.id,
        student_id=student.id,
        recruiter_id=recruiter_2.id,
        status=EvaluationStatus.WITHDRAWN,
    )
    db.add(eval_withdrawn)
    db.flush()
    db.add(EvaluationSkillAssessment(
        evaluation_id=eval_withdrawn.id,
        skill_id=s_react.id,
        proficiency=SkillAssessmentProficiency.ADVANCED,
    ))
    db.commit()
    compiled = OpportunityMatchService.compile_student_skills(db, student.id)
    assert s_python.id not in compiled
    assert s_react.id not in compiled
def test_compile_student_skills_provenance_hierarchy(db, match_skills):
    """Verify provenance resolution and strongest source priority: experience > evaluation > project > profile."""
    u_id = uuid.uuid4().hex[:8]
    s_python = match_skills["python"]
    s_react = match_skills["react"]
    s_docker = match_skills["docker"]
    student = User(
        email=f"student_prov_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()
    profile = StudentProfile(
        user_id=student.id,
        full_name="Match Student",
        college="Tech Univ",
        degree="B.Tech",
        branch="CS",
        graduation_year=2025,
    )
    db.add(profile)
    db.flush()
    # Profile has Python (claimed) and React (claimed)
    sync_student_skills_from_text(db, profile, "Python, React")
    # Verified experience with React -> upgrades React to source='experience', is_verified=True
    exp = ExperienceRecord(
        student_id=student.id,
        title="Frontend Intern",
        organization_name="WebCorp",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 1),
        description="React development",
        status=VerificationStatus.VERIFIED,
        verification_source=VerificationSource.RECRUITER_CONFIRMED,
    )
    db.add(exp)
    db.flush()
    sync_experience_skills_from_text(db, exp, "React")
    # Project with Docker evaluated by recruiter
    proj = InnovationProject(
        student_id=student.id,
        title="Container Platform",
        slug=f"container-platform-{u_id}",
        description="Docker orchestration",
        project_type="software",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
    )
    db.add(proj)
    db.flush()
    sync_project_skills_from_text(db, proj, "Docker")
    recruiter = User(
        email=f"recruiter_prov_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    db.add(recruiter)
    db.flush()
    eval_record = ProjectEvaluation(
        project_id=proj.id,
        student_id=student.id,
        recruiter_id=recruiter.id,
        status=EvaluationStatus.SUBMITTED,
        overall_score=4.5,
        technical_quality_score=4,
        problem_solving_score=5,
        execution_score=4,
        communication_documentation_score=5,
        evidence_quality_score=4,
        recommendation=EvaluationRecommendation.STRONGLY_RECOMMENDED,
        strengths="Great Docker mastery",
    )
    db.add(eval_record)
    db.flush()
    sa = EvaluationSkillAssessment(
        evaluation_id=eval_record.id,
        skill_id=s_docker.id,
        proficiency=SkillAssessmentProficiency.ADVANCED,
    )
    db.add(sa)
    db.commit()
    compiled = OpportunityMatchService.compile_student_skills(db, student.id)
    # Assert Python is profile claimed
    assert s_python.id in compiled
    assert compiled[s_python.id]["source"] == "profile"
    assert compiled[s_python.id]["is_verified"] is False
    # Assert React was upgraded to experience verified
    assert s_react.id in compiled
    assert compiled[s_react.id]["source"] == "experience"
    assert compiled[s_react.id]["is_verified"] is True
    # Assert Docker is evaluation verified
    assert s_docker.id in compiled
    assert compiled[s_docker.id]["source"] == "evaluation"
    assert compiled[s_docker.id]["is_verified"] is True
def test_api_browse_jobs_returns_match_for_student(client, db, match_skills):
    """Authenticated student receives match_summary on GET /api/v1/jobs/."""
    u_id = uuid.uuid4().hex[:8]
    s_python = match_skills["python"]
    s_react = match_skills["react"]
    recruiter = User(
        email=f"job_rec_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    db.add(recruiter)
    db.flush()
    job = JobPosting(
        recruiter_id=recruiter.id,
        title="Full Stack Engineer",
        description="Python and React full stack developer opportunity",
        opportunity_type=OpportunityType.JOB,
        company_name="InnovateTech",
        employment_type=EmploymentType.FULL_TIME,
        is_remote=True,
        is_active=True,
    )
    db.add(job)
    db.flush()
    sync_job_skills_from_text(db, job, "Python, React")
    student = User(
        email=f"student_match_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()
    profile = StudentProfile(
        user_id=student.id,
        full_name="API Student",
        college="Tech Univ",
        degree="B.Tech",
        branch="CS",
        graduation_year=2025,
    )
    db.add(profile)
    db.flush()
    sync_student_skills_from_text(db, profile, "Python")
    db.commit()
    token = create_access_token(subject=student.id)
    headers = {"Authorization": f"Bearer {token}"}
    # 1. Test Browse endpoint
    res = client.get("/api/v1/jobs/", headers=headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "items" in data
    matching_job = next(j for j in data["items"] if j["id"] == job.id)
    assert matching_job["match_summary"] is not None
    assert matching_job["match_summary"]["match_percentage"] == 50
    assert matching_job["match_summary"]["total_required"] == 2
    assert matching_job["match_summary"]["total_matched"] == 1
    assert matching_job["match_summary"]["total_missing"] == 1
    assert matching_job["match_summary"]["matched_skills"][0]["name"] == "Python"
    assert matching_job["match_summary"]["missing_skills"][0]["name"] == "React"
    # 2. Test Get Detail endpoint
    res_detail = client.get(f"/api/v1/jobs/{job.id}", headers=headers)
    assert res_detail.status_code == status.HTTP_200_OK
    detail_data = res_detail.json()
    assert detail_data["match_summary"] is not None
    assert detail_data["match_summary"]["match_percentage"] == 50
def test_api_jobs_omits_match_for_recruiter_and_admin(client, db, match_skills):
    """Recruiters and admins receive match_summary=None."""
    u_id = uuid.uuid4().hex[:8]
    recruiter = User(
        email=f"rec_nomatch_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    admin = User(
        email=f"admin_nomatch_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(recruiter)
    db.add(admin)
    db.flush()
    job = JobPosting(
        recruiter_id=recruiter.id,
        title="Backend Dev",
        description="Python backend dev",
        opportunity_type=OpportunityType.JOB,
        company_name="CloudCo",
        employment_type=EmploymentType.FULL_TIME,
        is_remote=False,
        is_active=True,
    )
    db.add(job)
    db.flush()
    sync_job_skills_from_text(db, job, "Python")
    db.commit()
    # Recruiter check
    token_rec = create_access_token(subject=recruiter.id)
    headers_rec = {"Authorization": f"Bearer {token_rec}"}
    res_rec = client.get(f"/api/v1/jobs/{job.id}", headers=headers_rec)
    assert res_rec.status_code == status.HTTP_200_OK
    assert res_rec.json()["match_summary"] is None
    # Admin check
    token_admin = create_access_token(subject=admin.id)
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    res_admin = client.get(f"/api/v1/jobs/{job.id}", headers=headers_admin)
    assert res_admin.status_code == status.HTTP_200_OK
    assert res_admin.json()["match_summary"] is None
def test_inactive_job_protection_for_students(client, db):
    """Inactive job returns 404 for students attempting to access it."""
    u_id = uuid.uuid4().hex[:8]
    recruiter = User(
        email=f"rec_inact_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.RECRUITER,
        is_active=True,
    )
    student = User(
        email=f"student_inact_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(recruiter)
    db.add(student)
    db.flush()
    job = JobPosting(
        recruiter_id=recruiter.id,
        title="Hidden Position",
        description="Not currently accepting candidates",
        opportunity_type=OpportunityType.JOB,
        company_name="StealthCo",
        employment_type=EmploymentType.FULL_TIME,
        is_active=False,
    )
    db.add(job)
    db.commit()
    token = create_access_token(subject=student.id)
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get(f"/api/v1/jobs/{job.id}", headers=headers)
    assert res.status_code == status.HTTP_404_NOT_FOUND
def test_unverified_experience_statuses_ignored(db, match_skills):
    """
    Experience records with CLAIMED, DRAFT, PENDING_VERIFICATION, or REJECTED
    must not produce verified experience skills.
    """
    u_id = uuid.uuid4().hex[:8]
    s_python = match_skills["python"]
    s_react = match_skills["react"]
    s_docker = match_skills["docker"]
    s_sql = match_skills["sql"]
    student = User(
        email=f"student_unver_exp_{u_id}@test_match.io",
        password_hash="hashed_password",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.flush()
    # 1. DRAFT experience
    exp_draft = ExperienceRecord(
        student_id=student.id,
        title="Draft Exp",
        organization_name="DraftCorp",
        start_date=date(2024, 1, 1),
        description="Draft exp",
        status=VerificationStatus.DRAFT,
    )
    db.add(exp_draft)
    db.flush()
    sync_experience_skills_from_text(db, exp_draft, "Python")
    # 2. CLAIMED experience
    exp_claimed = ExperienceRecord(
        student_id=student.id,
        title="Claimed Exp",
        organization_name="ClaimedCorp",
        start_date=date(2024, 1, 1),
        description="Claimed exp",
        status=VerificationStatus.CLAIMED,
    )
    db.add(exp_claimed)
    db.flush()
    sync_experience_skills_from_text(db, exp_claimed, "React")
    # 3. PENDING_VERIFICATION experience
    exp_pending = ExperienceRecord(
        student_id=student.id,
        title="Pending Exp",
        organization_name="PendingCorp",
        start_date=date(2024, 1, 1),
        description="Pending exp",
        status=VerificationStatus.PENDING_VERIFICATION,
    )
    db.add(exp_pending)
    db.flush()
    sync_experience_skills_from_text(db, exp_pending, "Docker")
    # 4. REJECTED experience
    exp_rejected = ExperienceRecord(
        student_id=student.id,
        title="Rejected Exp",
        organization_name="RejectedCorp",
        start_date=date(2024, 1, 1),
        description="Rejected exp",
        status=VerificationStatus.REJECTED,
    )
    db.add(exp_rejected)
    db.flush()
    sync_experience_skills_from_text(db, exp_rejected, "PostgreSQL")
    db.commit()
    compiled = OpportunityMatchService.compile_student_skills(db, student.id)
    assert s_python.id not in compiled
    assert s_react.id not in compiled
    assert s_docker.id not in compiled
    assert s_sql.id not in compiled


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
