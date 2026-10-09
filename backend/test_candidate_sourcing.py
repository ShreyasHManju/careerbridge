from datetime import date, datetime, timezone
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.experience_record import ExperienceRecord, ExperienceSkill, VerificationSource, VerificationStatus
from app.models.innovation_project import InnovationProject, ProjectSkill, ProjectStatus, ProjectType, ProjectVisibility
from app.models.project_evaluation import (
    EvaluationRecommendation,
    EvaluationSkillAssessment,
    EvaluationStatus,
    ProjectEvaluation,
    SkillAssessmentProficiency,
)
from app.models.recruiter_profile import RecruiterProfile
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER_EMAIL = "source_recruiter@careerbridge.io"
STUDENT1_EMAIL = "source_student1@careerbridge.io"
STUDENT2_EMAIL = "source_student2@careerbridge.io"
STUDENT3_EMAIL = "source_student3@careerbridge.io"
TEST_PASSWORD = "SecurePassword123!"

DATA = {}


def setup_module():
    teardown_module()
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

        rec = User(
            email=RECRUITER_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        stu1 = User(
            email=STUDENT1_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        stu2 = User(
            email=STUDENT2_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        stu3 = User(
            email=STUDENT3_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        db.add_all([rec, stu1, stu2, stu3])
        db.commit()
        db.refresh(rec)
        db.refresh(stu1)
        db.refresh(stu2)
        db.refresh(stu3)

        rec_prof = RecruiterProfile(
            user_id=rec.id,
            company_name="Apex Sourcing Tech",
            contact_name="Talent Lead",
        )
        stu_prof1 = StudentProfile(
            user_id=stu1.id,
            full_name="Alice Candidate",
            branch="Computer Science",
            college="MIT",
            graduation_year=2026,
        )
        stu_prof2 = StudentProfile(
            user_id=stu2.id,
            full_name="Bob Candidate",
            branch="Electrical Engineering",
            college="Stanford",
            graduation_year=2025,
        )
        stu_prof3 = StudentProfile(
            user_id=stu3.id,
            full_name="Charlie Private",
            branch="Computer Engineering",
            college="Berkeley",
            graduation_year=2026,
        )
        db.add_all([rec_prof, stu_prof1, stu_prof2, stu_prof3])
        db.commit()
        db.refresh(stu_prof1)
        db.refresh(stu_prof2)
        db.refresh(stu_prof3)

        # Canonical skills
        py_skill = Skill(name="Python", slug="python", category="Backend", is_verified=True)
        react_skill = Skill(name="React", slug="react", category="Frontend", is_verified=True)
        pg_skill = Skill(name="PostgreSQL", slug="postgresql", category="Database", is_verified=True)
        rust_skill = Skill(name="Rust", slug="rust", category="Languages", is_verified=True)
        db.add_all([py_skill, react_skill, pg_skill, rust_skill])
        db.commit()
        db.refresh(py_skill)
        db.refresh(react_skill)
        db.refresh(pg_skill)
        db.refresh(rust_skill)

        # Student 1: Python on profile (Claimed) + Active Public Project with React + Evaluated Python
        ss1 = StudentSkill(student_profile_id=stu_prof1.id, skill_id=py_skill.id, proficiency="expert")
        db.add(ss1)

        proj1 = InnovationProject(
            student_id=stu1.id,
            title="Distributed Raft Consensus",
            slug="distributed-raft-consensus",
            description="A distributed key-value store with consensus algorithm.",
            project_type=ProjectType.SOFTWARE,
            visibility=ProjectVisibility.PUBLIC,
            status=ProjectStatus.ACTIVE,
        )
        db.add(proj1)
        db.flush()

        ps1 = ProjectSkill(innovation_project_id=proj1.id, skill_id=react_skill.id)
        db.add(ps1)

        eval1 = ProjectEvaluation(
            project_id=proj1.id,
            student_id=stu1.id,
            recruiter_id=rec.id,
            status=EvaluationStatus.SUBMITTED,
            overall_score=4.80,
            technical_quality_score=5,
            problem_solving_score=5,
            execution_score=4,
            communication_documentation_score=5,
            evidence_quality_score=5,
            recommendation=EvaluationRecommendation.STRONGLY_RECOMMENDED,
        )
        db.add(eval1)
        db.flush()

        # Recruiter assessed Python as ADVANCED on Alice's evaluation
        sa1 = EvaluationSkillAssessment(
            evaluation_id=eval1.id,
            skill_id=py_skill.id,
            proficiency=SkillAssessmentProficiency.ADVANCED,
        )
        db.add(sa1)

        # Student 2: Bob has NO skills on profile, but has Verified Experience with PostgreSQL
        exp2 = ExperienceRecord(
            student_id=stu2.id,
            title="Database Intern",
            organization_name="Enterprise DB",
            experience_type="work",
            start_date=date(2025, 1, 1),
            description="Database tuning and schema indexing.",
            status=VerificationStatus.VERIFIED,
            verification_source=VerificationSource.ADMIN_CONFIRMED,
        )
        db.add(exp2)
        db.flush()
        es2 = ExperienceSkill(experience_record_id=exp2.id, skill_id=pg_skill.id)
        db.add(es2)

        # Student 3: Charlie has ONLY a PRIVATE active project demonstrating Rust (no profile skill)
        proj3 = InnovationProject(
            student_id=stu3.id,
            title="Stealth Rust Project",
            slug="stealth-rust-project",
            description="Secret project",
            project_type=ProjectType.SOFTWARE,
            visibility=ProjectVisibility.PRIVATE,
            status=ProjectStatus.ACTIVE,
        )
        db.add(proj3)
        db.flush()
        ps3 = ProjectSkill(innovation_project_id=proj3.id, skill_id=rust_skill.id)
        db.add(ps3)

        db.commit()

        DATA["recruiter_token"] = create_access_token(rec.id)
        DATA["student_token"] = create_access_token(stu1.id)
        DATA["student1_id"] = stu1.id
        DATA["student2_id"] = stu2.id
        DATA["student3_id"] = stu3.id


def teardown_module():
    with SessionLocal() as db:
        users = db.scalars(
            select(User).where(User.email.in_([RECRUITER_EMAIL, STUDENT1_EMAIL, STUDENT2_EMAIL, STUDENT3_EMAIL]))
        ).all()
        for u in users:
            db.delete(u)
        skills = db.scalars(select(Skill).where(Skill.slug.in_(["python", "react", "postgresql", "rust"]))).all()
        for s in skills:
            db.delete(s)
        db.commit()


def test_student_cannot_access_candidate_sourcing():
    resp = client.get(
        "/api/v1/recruiter/candidates",
        headers={"Authorization": f"Bearer {DATA['student_token']}"},
    )
    assert resp.status_code == 403


def test_recruiter_can_search_candidates():
    resp = client.get(
        "/api/v1/recruiter/candidates?q=Alice",
        headers={"Authorization": f"Bearer {DATA['recruiter_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert any(c["full_name"] == "Alice Candidate" for c in data["items"])


def test_recruiter_filter_by_skill_includes_projects_and_evaluations():
    """Alice is found by Python (evaluated) and React (public project)."""
    resp = client.get(
        "/api/v1/recruiter/candidates?skills=react",
        headers={"Authorization": f"Bearer {DATA['recruiter_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) >= 1
    alice = next((c for c in data["items"] if c["full_name"] == "Alice Candidate"), None)
    assert alice is not None
    skill_names = [s["name"] for s in alice["skills"]]
    assert "React" in skill_names
    assert "Python" in skill_names


def test_recruiter_finds_candidate_with_verified_experience_skill_not_on_profile():
    """Bob has PostgreSQL ONLY on verified experience, not in profile. Sourcing must discover Bob."""
    resp = client.get(
        "/api/v1/recruiter/candidates?skills=postgresql",
        headers={"Authorization": f"Bearer {DATA['recruiter_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) >= 1
    bob = next((c for c in data["items"] if c["full_name"] == "Bob Candidate"), None)
    assert bob is not None
    assert any(s["name"] == "PostgreSQL" for s in bob["skills"])
    assert any(s["name"] == "PostgreSQL" for s in bob["verified_skills"])


def test_private_project_skills_excluded_from_recruiter_sourcing():
    """Charlie's Rust skill comes strictly from a PRIVATE project; recruiter must NOT find Charlie by Rust."""
    resp = client.get(
        "/api/v1/recruiter/candidates?skills=rust",
        headers={"Authorization": f"Bearer {DATA['recruiter_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert not any(c["full_name"] == "Charlie Private" for c in data["items"])


def test_min_verified_skills_uses_actual_verified_provenance():
    """Only candidates with verified experience or evaluated skills satisfy min_verified_skills."""
    resp = client.get(
        "/api/v1/recruiter/candidates?min_verified_skills=1",
        headers={"Authorization": f"Bearer {DATA['recruiter_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    names = [c["full_name"] for c in data["items"]]
    assert "Alice Candidate" in names  # Evaluated Python
    assert "Bob Candidate" in names    # Verified Experience PostgreSQL
    assert "Charlie Private" not in names


def test_has_verified_passport_filter():
    """Candidates with verified experience or submitted evaluation have verified passport."""
    resp = client.get(
        "/api/v1/recruiter/candidates?has_verified_passport=true",
        headers={"Authorization": f"Bearer {DATA['recruiter_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    names = [c["full_name"] for c in data["items"]]
    assert "Alice Candidate" in names
    assert "Bob Candidate" in names
    assert "Charlie Private" not in names


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
