from datetime import datetime, timezone
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
from app.models.innovation_project import InnovationProject, ProjectStatus, ProjectType, ProjectVisibility
from app.models.project_evaluation import EvaluationRecommendation, EvaluationStatus, ProjectEvaluation
from app.models.recruiter_profile import RecruiterProfile
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER_EMAIL = "source_recruiter@careerbridge.io"
STUDENT1_EMAIL = "source_student1@careerbridge.io"
STUDENT2_EMAIL = "source_student2@careerbridge.io"
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
        db.add_all([rec, stu1, stu2])
        db.commit()
        db.refresh(rec)
        db.refresh(stu1)
        db.refresh(stu2)

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
        db.add_all([rec_prof, stu_prof1, stu_prof2])
        db.commit()
        db.refresh(stu_prof1)
        db.refresh(stu_prof2)

        # Canonical skills
        py_skill = Skill(name="Python", slug="python", category="Backend", is_verified=True)
        react_skill = Skill(name="React", slug="react", category="Frontend", is_verified=True)
        db.add_all([py_skill, react_skill])
        db.commit()
        db.refresh(py_skill)
        db.refresh(react_skill)

        # Associate skill to student 1
        ss1 = StudentSkill(student_profile_id=stu_prof1.id, skill_id=py_skill.id, proficiency="expert")
        db.add(ss1)

        # Project for student 1
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
        db.commit()
        db.refresh(proj1)

        # Evaluation for project 1
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
        db.commit()

        DATA["recruiter_token"] = create_access_token(rec.id)
        DATA["student_token"] = create_access_token(stu1.id)
        DATA["student1_id"] = stu1.id
        DATA["student2_id"] = stu2.id


def teardown_module():
    with SessionLocal() as db:
        users = db.scalars(
            select(User).where(User.email.in_([RECRUITER_EMAIL, STUDENT1_EMAIL, STUDENT2_EMAIL]))
        ).all()
        for u in users:
            db.delete(u)
        skills = db.scalars(select(Skill).where(Skill.slug.in_(["python", "react"]))).all()
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


def test_recruiter_filter_by_skill():
    resp = client.get(
        "/api/v1/recruiter/candidates?skills=python",
        headers={"Authorization": f"Bearer {DATA['recruiter_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) >= 1
    alice = next((c for c in data["items"] if c["full_name"] == "Alice Candidate"), None)
    assert alice is not None
    assert any(s["name"] == "Python" for s in alice["skills"])
    assert len(alice["top_projects"]) >= 1
    assert alice["top_projects"][0]["title"] == "Distributed Raft Consensus"
    assert alice["top_projects"][0]["average_evaluation_score"] == 4.8


