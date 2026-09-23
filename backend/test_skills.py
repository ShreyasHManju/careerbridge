"""
CareerBridge Milestone 2.0-A — Structured Skills Foundation Test Suite
Tests:
1. Slug generation and normalization utilities.
2. Canonical skill creation, duplicate detection, and case-insensitivity.
3. Skill search API (GET /api/v1/skills) with queries, categories, limits, ordering.
4. Student profile legacy string & structured skill dual synchronization.
5. Job posting legacy string & structured skill dual synchronization.
6. Ownership and RBAC authorization isolation for profiles and jobs.
7. Backward-compatible API response verification (skills string + structured_skills array).
8. Existing job search compatibility with structured skills.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.job_posting import JobPosting
from app.models.skill import JobSkill, Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.skill_service import (
    format_skills_string,
    generate_skill_slug,
    get_or_create_skill,
    parse_skills_text,
    sync_job_skills_from_text,
    sync_student_skills_from_text,
)

client = TestClient(app)

STUDENT_EMAIL = "skills.student@careerbridge.io"
STUDENT2_EMAIL = "skills.student2@careerbridge.io"
RECRUITER_EMAIL = "skills.recruiter@careerbridge.io"
RECRUITER2_EMAIL = "skills.recruiter2@careerbridge.io"
TEST_PASSWORD = "SkillsTestPassword123!"


def cleanup_test_data():
    """Remove test users, profiles, jobs, and test skills."""
    with SessionLocal() as db:
        test_emails = [
            STUDENT_EMAIL,
            STUDENT2_EMAIL,
            RECRUITER_EMAIL,
            RECRUITER2_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            # Delete student profiles (cascades student_skills)
            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            # Delete job postings (cascades job_skills)
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            # Delete users
            db.execute(delete(User).where(User.id.in_(user_ids)))

        # Clean up test skills created during testing
        test_slugs = [
            "test-python",
            "test-react",
            "test-typescript",
            "test-fastapi",
            "test-docker",
            "test-kubernetes",
            "test-aws",
            "test-gcp",
            "react-js",
            "node-js",
            "machine-learning",
            "c",
        ]
        db.execute(delete(Skill).where(Skill.slug.in_(test_slugs)))
        db.commit()


def get_token(email: str, role: UserRole) -> str:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(
                email=email,
                password_hash=hash_password(TEST_PASSWORD),
                role=role,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return create_access_token(subject=user.id)


def test_slug_and_normalization_units():
    print("[1/8] Testing slug generation and text parsing utilities...")
    # Slug generation
    assert generate_skill_slug("React") == "react"
    assert generate_skill_slug("React.js") == "react-js"
    assert generate_skill_slug("Node.js") == "node-js"
    assert generate_skill_slug("C++") == "c"
    assert generate_skill_slug("Machine Learning") == "machine-learning"
    assert generate_skill_slug("  Python 3.12  ") == "python-3-12"
    assert generate_skill_slug("---Ruby on Rails---") == "ruby-on-rails"

    # Parsing text
    parsed = parse_skills_text("Python, React , FastAPI, Python, , TypeScript")
    assert parsed == ["Python", "React", "FastAPI", "TypeScript"]
    assert parse_skills_text(None) == []
    assert parse_skills_text("   ") == []

    # Formatting string deterministically
    assert format_skills_string(["TypeScript", "Python", "FastAPI"]) == "TypeScript, Python, FastAPI"
    print("  -> Slug and parsing utilities verified.")


def test_canonical_skill_service():
    print("[2/8] Testing SkillService get_or_create and duplicate prevention...")
    with SessionLocal() as db:
        # Create canonical skill
        skill1 = get_or_create_skill(db, "Test-Python", category="Backend")
        assert skill1 is not None
        assert skill1.id is not None
        assert skill1.slug == "test-python"
        assert skill1.name == "Test-Python"

        # Re-fetch identical slug with different case
        skill2 = get_or_create_skill(db, "test-python")
        assert skill2.id == skill1.id

        # Empty skill name rejection
        assert get_or_create_skill(db, "") is None
        assert get_or_create_skill(db, "   ") is None
        db.commit()
    print("  -> SkillService canonical deduplication verified.")


def test_skills_api_search():
    print("[3/8] Testing GET /api/v1/skills search API...")
    with SessionLocal() as db:
        get_or_create_skill(db, "Test-Docker", category="DevOps")
        get_or_create_skill(db, "Test-Kubernetes", category="DevOps")
        get_or_create_skill(db, "Test-React", category="Frontend")
        db.commit()

    # Search with q
    res = client.get("/api/v1/skills?q=test-")
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data) >= 3
    slugs = [s["slug"] for s in data]
    assert "test-docker" in slugs
    assert "test-kubernetes" in slugs
    assert "test-react" in slugs

    # Filter with category
    res_cat = client.get("/api/v1/skills?category=Frontend")
    assert res_cat.status_code == 200
    data_cat = res_cat.json()
    assert all(s["category"] == "Frontend" for s in data_cat)

    # Bounded limit
    res_lim = client.get("/api/v1/skills?limit=1")
    assert res_lim.status_code == 200
    assert len(res_lim.json()) == 1

    # Empty search
    res_empty = client.get("/api/v1/skills?q=nonexistent12345xyz")
    assert res_empty.status_code == 200
    assert res_empty.json() == []
    print("  -> Skill search API verified.")


def test_student_profile_skills_sync():
    print("[4/8] Testing StudentProfile dual synchronization and additive responses...")
    token = get_token(STUDENT_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create student profile with comma-separated skills
    payload = {
        "full_name": "Test Student Skills",
        "skills": "Test-Python, Test-React, Test-FastAPI",
        "college": "Tech University",
        "degree": "B.Tech",
        "branch": "CS",
        "graduation_year": 2026,
    }
    create_res = client.post("/api/v1/student/profile", json=payload, headers=headers)
    assert create_res.status_code in (200, 201), create_res.text
    created = create_res.json()

    # Verify backward compatible legacy string
    assert created["skills"] == "Test-Python, Test-React, Test-FastAPI"

    # Verify additive structured_skills field
    assert "structured_skills" in created
    assert created["structured_skills"] is not None
    assert len(created["structured_skills"]) == 3
    struct_slugs = [s["slug"] for s in created["structured_skills"]]
    assert "test-python" in struct_slugs
    assert "test-react" in struct_slugs
    assert "test-fastapi" in struct_slugs

    # Verify database student_skills association rows
    with SessionLocal() as db:
        profile = db.scalar(select(StudentProfile).where(StudentProfile.full_name == "Test Student Skills"))
        assert profile is not None
        assert len(profile.student_skills) == 3

    # 2. Update profile with modified skills
    update_res = client.patch(
        "/api/v1/student/profile",
        json={"skills": "Test-Python, Test-Docker"},
        headers=headers,
    )
    assert update_res.status_code == 200, update_res.text
    updated = update_res.json()
    assert updated["skills"] == "Test-Python, Test-Docker"
    assert len(updated["structured_skills"]) == 2
    updated_slugs = [s["slug"] for s in updated["structured_skills"]]
    assert "test-python" in updated_slugs
    assert "test-docker" in updated_slugs
    assert "test-react" not in updated_slugs

    # 3. GET /api/v1/student/profile
    get_res = client.get("/api/v1/student/profile", headers=headers)
    assert get_res.status_code == 200
    assert len(get_res.json()["structured_skills"]) == 2
    print("  -> Student profile dual sync verified.")


def test_job_posting_skills_sync():
    print("[5/8] Testing JobPosting dual synchronization and additive responses...")
    token = get_token(RECRUITER_EMAIL, UserRole.RECRUITER)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Job Posting with legacy skills string
    deadline = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    job_payload = {
        "title": "Backend Skills Engineer",
        "description": "Looking for talented backend engineers with cloud expertise.",
        "opportunity_type": "job",
        "company_name": "CloudTech Inc",
        "location": "Remote",
        "is_remote": True,
        "employment_type": "full_time",
        "skills": "Test-Python, Test-Kubernetes, Test-AWS",
        "application_deadline": deadline,
    }
    res = client.post("/api/v1/jobs", json=job_payload, headers=headers)
    assert res.status_code in (200, 201), res.text
    job_data = res.json()
    job_id = job_data["id"]

    # Verify legacy string and structured skills in response
    assert job_data["skills"] == "Test-Python, Test-Kubernetes, Test-AWS"
    assert "structured_skills" in job_data
    assert job_data["structured_skills"] is not None
    assert len(job_data["structured_skills"]) == 3
    job_slugs = [s["slug"] for s in job_data["structured_skills"]]
    assert "test-python" in job_slugs
    assert "test-kubernetes" in job_slugs
    assert "test-aws" in job_slugs

    # Verify DB associations
    with SessionLocal() as db:
        db_job = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
        assert db_job is not None
        assert len(db_job.job_skills) == 3

    # 2. Update job posting skills
    update_res = client.patch(
        f"/api/v1/jobs/{job_id}",
        json={"skills": "Test-Kubernetes, Test-GCP"},
        headers=headers,
    )
    assert update_res.status_code == 200, update_res.text
    updated_job = update_res.json()
    assert updated_job["skills"] == "Test-Kubernetes, Test-GCP"
    assert len(updated_job["structured_skills"]) == 2
    u_slugs = [s["slug"] for s in updated_job["structured_skills"]]
    assert "test-kubernetes" in u_slugs
    assert "test-gcp" in u_slugs
    assert "test-python" not in u_slugs

    # 3. GET job detail
    detail_res = client.get(f"/api/v1/jobs/{job_id}", headers=headers)
    assert detail_res.status_code == 200
    assert len(detail_res.json()["structured_skills"]) == 2
    print("  -> Job posting dual sync verified.")


def test_job_search_backward_compatibility():
    print("[6/8] Testing job search backward compatibility with skills filter...")
    token = get_token(STUDENT_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token}"}

    # Job created above with "Test-Kubernetes, Test-GCP"
    res = client.get("/api/v1/jobs?skills=Kubernetes", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert any("Backend Skills Engineer" in j["title"] for j in items)

    # General search query
    res_q = client.get("/api/v1/jobs?search=Backend Skills", headers=headers)
    assert res_q.status_code == 200
    items_q = res_q.json()["items"]
    assert any("Backend Skills Engineer" in j["title"] for j in items_q)
    print("  -> Job search backward compatibility verified.")


def test_authorization_and_ownership():
    print("[7/8] Testing authorization and ownership isolation...")
    student1_token = get_token(STUDENT_EMAIL, UserRole.STUDENT)
    student2_token = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    recruiter1_token = get_token(RECRUITER_EMAIL, UserRole.RECRUITER)
    recruiter2_token = get_token(RECRUITER2_EMAIL, UserRole.RECRUITER)

    # Recruiter cannot access student profile endpoints
    res = client.get("/api/v1/student/profile", headers={"Authorization": f"Bearer {recruiter1_token}"})
    assert res.status_code == 403

    # Student cannot create jobs
    deadline = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    res = client.post(
        "/api/v1/jobs",
        json={"title": "Unauthorized Job", "description": "desc", "opportunity_type": "job", "company_name": "Co", "location": "Remote", "is_remote": True, "employment_type": "full_time", "application_deadline": deadline},
        headers={"Authorization": f"Bearer {student1_token}"},
    )
    assert res.status_code == 403

    # Recruiter 2 cannot modify Recruiter 1's job
    with SessionLocal() as db:
        recruiter1_user = db.scalar(select(User).where(User.email == RECRUITER_EMAIL))
        job = db.scalar(select(JobPosting).where(JobPosting.recruiter_id == recruiter1_user.id))
        job_id = job.id

    res_hack = client.patch(
        f"/api/v1/jobs/{job_id}",
        json={"title": "Hacked Job Title"},
        headers={"Authorization": f"Bearer {recruiter2_token}"},
    )
    assert res_hack.status_code == 403
    print("  -> Authorization and ownership isolation verified.")


def test_cleanup():
    print("[8/8] Cleaning up test data...")
    cleanup_test_data()
    print("  -> Cleanup complete.")


def run_all_skills_tests():
    print("\n=========================================================")
    print("STARTING MILESTONE 2.0-A STRUCTURED SKILLS TEST SUITE...")
    print("=========================================================\n")
    cleanup_test_data()
    try:
        test_slug_and_normalization_units()
        test_canonical_skill_service()
        test_skills_api_search()
        test_student_profile_skills_sync()
        test_job_posting_skills_sync()
        test_job_search_backward_compatibility()
        test_authorization_and_ownership()
        test_cleanup()
        print("\n=========================================================")
        print("ALL STRUCTURED SKILLS FOUNDATION TESTS PASSED (8/8)!")
        print("=========================================================\n")
    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_all_skills_tests()
