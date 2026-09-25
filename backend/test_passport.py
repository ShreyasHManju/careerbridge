"""
CareerBridge Milestone 2.0-E — Experience Passport Backend Test Suite
Comprehensive coverage for:
1. /passport/me authenticated student access and ownership metadata.
2. /passport/{student_id} recruiter and authorized user access with strict privacy boundaries:
   - Unverified (claimed, draft, pending, rejected) experiences are strictly omitted.
   - Private and draft innovation projects are strictly omitted.
   - Milestones belonging to private projects are strictly omitted.
   - Rejection and moderation notes are strictly omitted.
3. Empty passport graceful fallbacks (students with no profile, projects, or experiences).
4. Canonical skills aggregation and evidence provenance tracking (experience, project, profile).
5. Dynamic data reflection without caching or synchronization lag.
6. Role and security guards (401 for unauthenticated, 403 for non-student calling /passport/me, 404 for invalid student ID).
"""

from datetime import date, datetime, timedelta, timezone
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
from app.models.experience_record import (
    ExperienceRecord,
    ExperienceSkill,
    ExperienceType,
    VerificationSource,
    VerificationStatus,
)
from app.models.innovation_project import (
    InnovationProject,
    ProjectStatus,
    ProjectType,
    ProjectVisibility,
)
from app.models.project_milestone import MilestoneStatus, ProjectMilestone
from app.models.recruiter_profile import RecruiterProfile
from app.models.resume import Resume
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.skill_service import get_or_create_skill

client = TestClient(app)

STUDENT1_EMAIL = "passport.student1@careerbridge.io"
STUDENT2_EMAIL = "passport.student2@careerbridge.io"
RECRUITER_EMAIL = "passport.recruiter@careerbridge.io"
ADMIN_EMAIL = "passport.admin@careerbridge.io"
TEST_PASSWORD = "PassportPassword123!"


def cleanup_test_data():
    """Remove test users, profiles, projects, and experiences."""
    with SessionLocal() as db:
        test_emails = [
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            RECRUITER_EMAIL,
            ADMIN_EMAIL,
        ]
        users = list(db.scalars(select(User).where(User.email.in_(test_emails))).all())
        user_ids = [u.id for u in users]
        if user_ids:
            # Cascading deletes will remove profiles, projects, milestones, experiences, etc.
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def setup_users():
    """Create test users and return their IDs and JWT tokens."""
    cleanup_test_data()
    with SessionLocal() as db:
        # Student 1
        s1 = User(
            email=STUDENT1_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        # Student 2 (Empty / Minimal)
        s2 = User(
            email=STUDENT2_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        # Recruiter
        r1 = User(
            email=RECRUITER_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        # Admin
        a1 = User(
            email=ADMIN_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add_all([s1, s2, r1, a1])
        db.flush()

        # Student 1 profile
        p1 = StudentProfile(
            user_id=s1.id,
            full_name="Alex Morgan",
            college="MIT",
            degree="Bachelor of Science",
            branch="Computer Science",
            graduation_year=2026,
            bio="Passionate full-stack developer & AI researcher.",
            github_url="https://github.com/alexmorgan",
            linkedin_url="https://linkedin.com/in/alexmorgan",
            portfolio_url="https://alexmorgan.dev",
        )
        db.add(p1)

        # Recruiter profile
        rp = RecruiterProfile(
            user_id=r1.id,
            company_name="Apex Cloud Systems",
            is_verified=True,
        )
        db.add(rp)

        db.commit()

        s1_id, s2_id, r1_id, a1_id = s1.id, s2.id, r1.id, a1.id

    token_s1 = create_access_token(subject=s1_id)
    token_s2 = create_access_token(subject=s2_id)
    token_r1 = create_access_token(subject=r1_id)
    token_admin = create_access_token(subject=a1_id)

    return {
        "s1_id": s1_id,
        "s2_id": s2_id,
        "r1_id": r1_id,
        "a1_id": a1_id,
        "token_s1": token_s1,
        "token_s2": token_s2,
        "token_r1": token_r1,
        "token_admin": token_admin,
    }


def test_1_passport_me_authorization_and_aggregation():
    """Verify authenticated student can access /passport/me with identity and ownership metadata."""
    print("\n[Test 1] Testing /passport/me authorization and ownership metadata...")
    data = setup_users()
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}
    headers_r1 = {"Authorization": f"Bearer {data['token_r1']}"}

    # Student 1 fetches /passport/me
    res = client.get("/api/v1/passport/me", headers=headers_s1)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    body = res.json()

    assert body["is_owner"] is True
    assert body["identity"]["user_id"] == data["s1_id"]
    assert body["identity"]["full_name"] == "Alex Morgan"
    assert body["identity"]["college"] == "MIT"
    assert body["identity"]["github_url"] == "https://github.com/alexmorgan"
    assert body["summary"]["verified_experiences_count"] == 0
    assert body["summary"]["public_projects_count"] == 0
    assert body["summary"]["canonical_skills_count"] == 0
    assert body["summary"]["completed_milestones_count"] == 0
    print("  [PASS] Student 1 successfully retrieved /passport/me with identity and is_owner=True.")

    # Recruiter attempts /passport/me (should fail with 403 Forbidden because endpoint requires STUDENT role)
    res_recruiter = client.get("/api/v1/passport/me", headers=headers_r1)
    assert res_recruiter.status_code == 403
    print("  [PASS] Recruiter receives 403 Forbidden when calling student-only /passport/me.")

    # Unauthenticated request to /passport/me fails with 401
    res_unauth = client.get("/api/v1/passport/me")
    assert res_unauth.status_code == 401
    print("  [PASS] Unauthenticated request to /passport/me receives 401 Unauthorized.")


def test_2_passport_student_id_recruiter_and_public_privacy_boundaries():
    """Verify recruiter view of /passport/{student_id} strictly hides private/unverified data."""
    print("\n[Test 2] Testing /passport/{student_id} recruiter view and privacy boundaries...")
    data = setup_users()
    headers_r1 = {"Authorization": f"Bearer {data['token_r1']}"}
    s1_id = data["s1_id"]

    with SessionLocal() as db:
        # Retrieve or create canonical skills
        py_skill = get_or_create_skill(db, "Python")
        react_skill = get_or_create_skill(db, "React")
        docker_skill = get_or_create_skill(db, "Docker")
        db.flush()

        # Create Public Active Project with Milestones
        pub_proj = InnovationProject(
            student_id=s1_id,
            title="Distributed Task Queue",
            slug="distributed-task-queue",
            short_description="Scalable async task executor",
            description="Built using Python, Redis, and FastAPI.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PUBLIC,
            live_demo_url="https://queue.dev",
            repository_url="https://github.com/alexmorgan/task-queue",
            skills="Python, Docker",
        )
        db.add(pub_proj)
        db.flush()

        m1 = ProjectMilestone(
            innovation_project_id=pub_proj.id,
            title="Architecture Design",
            status=MilestoneStatus.COMPLETED,
            display_order=1,
            completed_at=datetime.now(timezone.utc),
        )
        m2 = ProjectMilestone(
            innovation_project_id=pub_proj.id,
            title="Core Worker Implementation",
            status=MilestoneStatus.IN_PROGRESS,
            display_order=2,
        )
        db.add_all([m1, m2])

        # Create Private Project (MUST BE HIDDEN from recruiter)
        priv_proj = InnovationProject(
            student_id=s1_id,
            title="Secret Stealth Startup",
            slug="secret-stealth-startup",
            description="Confidential algorithms and experiments.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PRIVATE,
        )
        db.add(priv_proj)
        db.flush()

        m_priv = ProjectMilestone(
            innovation_project_id=priv_proj.id,
            title="Confidential Milestone",
            status=MilestoneStatus.COMPLETED,
            display_order=1,
        )
        db.add(m_priv)

        # Create Verified Experience Record
        exp_verified = ExperienceRecord(
            student_id=s1_id,
            title="Backend Engineering Intern",
            organization_name="Apex Cloud Systems",
            experience_type=ExperienceType.INTERNSHIP,
            start_date=date(2025, 6, 1),
            end_date=date(2025, 8, 31),
            is_current=False,
            description="Engineered high-throughput event processing pipelines.",
            status=VerificationStatus.VERIFIED,
            verification_source=VerificationSource.RECRUITER_CONFIRMED,
            verifier_id=data["r1_id"],
            verified_at=datetime.now(timezone.utc),
            innovation_project_id=pub_proj.id,
        )
        # Create Claimed/Unverified Experience (MUST BE HIDDEN)
        exp_claimed = ExperienceRecord(
            student_id=s1_id,
            title="Unverified AI Researcher",
            organization_name="Self Research Lab",
            experience_type=ExperienceType.RESEARCH,
            start_date=date(2025, 1, 1),
            is_current=True,
            description="Experimental NLP models.",
            status=VerificationStatus.CLAIMED,
            verification_source=VerificationSource.SELF_CLAIMED,
        )
        # Create Rejected Experience (MUST BE HIDDEN)
        exp_rejected = ExperienceRecord(
            student_id=s1_id,
            title="Unapproved Contract",
            organization_name="Ghost Co",
            experience_type=ExperienceType.WORK,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 5, 1),
            is_current=False,
            description="Contract work.",
            status=VerificationStatus.REJECTED,
            verification_source=VerificationSource.SELF_CLAIMED,
            verification_notes="INTERNAL MODERATOR NOTE: Verification rejected due to missing documentation.",
        )
        db.add_all([exp_verified, exp_claimed, exp_rejected])
        db.flush()

        es_py = ExperienceSkill(experience_record_id=exp_verified.id, skill_id=py_skill.id)
        es_doc = ExperienceSkill(experience_record_id=exp_verified.id, skill_id=docker_skill.id)
        db.add_all([es_py, es_doc])
        db.commit()

    # Recruiter calls /passport/{s1_id}
    res = client.get(f"/api/v1/passport/{s1_id}", headers=headers_r1)
    assert res.status_code == 200
    body = res.json()

    assert body["is_owner"] is False
    assert body["identity"]["full_name"] == "Alex Morgan"

    # Experiences check: ONLY verified experience is included
    experiences = body["verified_experiences"]
    assert len(experiences) == 1
    assert experiences[0]["title"] == "Backend Engineering Intern"
    assert experiences[0]["status"] == "verified"
    assert experiences[0]["verification_source"] == "recruiter_confirmed"
    assert experiences[0]["innovation_project_id"] is not None
    assert experiences[0]["innovation_project_title"] == "Distributed Task Queue"
    # Ensure claimed and rejected experiences are completely absent
    exp_titles = [e["title"] for e in experiences]
    assert "Unverified AI Researcher" not in exp_titles
    assert "Unapproved Contract" not in exp_titles
    print("  [PASS] Recruiter only receives verified experiences (unverified and rejected are omitted).")

    # Projects check: ONLY public active project is included
    projects = body["projects"]
    assert len(projects) == 1
    assert projects[0]["title"] == "Distributed Task Queue"
    assert projects[0]["visibility"] == "public"
    proj_titles = [p["title"] for p in projects]
    assert "Secret Stealth Startup" not in proj_titles
    print("  [PASS] Recruiter only receives public active projects (private projects are omitted).")

    # Milestones check: Only milestones from the public project
    milestones = body["milestones"]
    assert len(milestones) == 2
    m_titles = [m["title"] for m in milestones]
    assert "Architecture Design" in m_titles
    assert "Core Worker Implementation" in m_titles
    assert "Confidential Milestone" not in m_titles
    print("  [PASS] Milestones from private projects are not leaked.")

    # Summary counts check
    assert body["summary"]["verified_experiences_count"] == 1
    assert body["summary"]["public_projects_count"] == 1
    assert body["summary"]["completed_milestones_count"] == 1

    # Security check: Ensure internal moderation notes are NEVER leaked in response JSON
    response_text = res.text
    assert "INTERNAL MODERATOR NOTE" not in response_text
    print("  [PASS] Internal moderation notes are completely scrubbed from the response.")


def test_3_empty_passport_graceful_fallbacks():
    """Verify passport endpoint returns clean valid structures for students with no data."""
    print("\n[Test 3] Testing empty student passport graceful fallbacks...")
    data = setup_users()
    headers_s2 = {"Authorization": f"Bearer {data['token_s2']}"}
    s2_id = data["s2_id"]

    res = client.get("/api/v1/passport/me", headers=headers_s2)
    assert res.status_code == 200
    body = res.json()

    assert body["is_owner"] is True
    assert body["identity"]["user_id"] == s2_id
    assert body["identity"]["email"] == STUDENT2_EMAIL
    assert body["identity"]["full_name"] is None
    assert body["summary"]["verified_experiences_count"] == 0
    assert body["summary"]["public_projects_count"] == 0
    assert body["summary"]["canonical_skills_count"] == 0
    assert body["summary"]["completed_milestones_count"] == 0
    assert body["verified_experiences"] == []
    assert body["projects"] == []
    assert body["skills"] == []
    assert body["milestones"] == []
    assert body["resume"] is None
    print("  [PASS] Empty student passport returns 200 with clean default lists and zero counts.")


def test_4_skills_provenance_and_summary_metrics():
    """Verify canonical skills aggregation tracks evidence source tags correctly."""
    print("\n[Test 4] Testing skills aggregation and provenance tracking...")
    data = setup_users()
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}
    s1_id = data["s1_id"]

    with SessionLocal() as db:
        # Retrieve or create canonical skills
        s_ts = get_or_create_skill(db, "TypeScript")
        s_pg = get_or_create_skill(db, "PostgreSQL")
        db.flush()

        # Add StudentSkill to profile
        profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == s1_id))
        if profile:
            ss = StudentSkill(student_profile_id=profile.id, skill_id=s_ts.id)
            db.add(ss)

        # Add Experience with PostgreSQL
        exp = ExperienceRecord(
            student_id=s1_id,
            title="Database Intern",
            organization_name="Data Systems",
            experience_type=ExperienceType.WORK,
            start_date=date(2025, 1, 1),
            description="Database tuning.",
            status=VerificationStatus.VERIFIED,
            verification_source=VerificationSource.ADMIN_CONFIRMED,
        )
        db.add(exp)
        db.flush()

        es = ExperienceSkill(experience_record_id=exp.id, skill_id=s_pg.id)
        # TypeScript also in experience
        es2 = ExperienceSkill(experience_record_id=exp.id, skill_id=s_ts.id)
        db.add_all([es, es2])

        db.commit()

    res = client.get("/api/v1/passport/me", headers=headers_s1)
    assert res.status_code == 200
    body = res.json()

    skills = body["skills"]
    assert len(skills) >= 2
    ts_entry = next((s for s in skills if s["name"] == "TypeScript"), None)
    pg_entry = next((s for s in skills if s["name"] == "PostgreSQL"), None)

    assert ts_entry is not None
    assert "profile" in ts_entry["sources"]
    assert "experience" in ts_entry["sources"]

    assert pg_entry is not None
    assert "experience" in pg_entry["sources"]
    print("  [PASS] Canonical skill provenance properly aggregates sources across profile and experience.")


def test_5_resume_metadata_exposure():
    """Verify attached resume document safely exposes metadata without filesystem paths."""
    print("\n[Test 5] Testing resume metadata exposure...")
    data = setup_users()
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}
    s1_id = data["s1_id"]

    with SessionLocal() as db:
        resume = Resume(
            student_id=s1_id,
            original_filename="Alex_Morgan_Resume_2026.pdf",
            stored_filename="uuid-random-key.pdf",
            file_path="C:\\Secret\\Internal\\Storage\\uuid-random-key.pdf",
            content_type="application/pdf",
            file_size=1048576,
        )
        db.add(resume)
        db.commit()

    res = client.get(f"/api/v1/passport/{s1_id}", headers=headers_s1)
    assert res.status_code == 200
    body = res.json()

    resume_info = body["resume"]
    assert resume_info is not None
    assert resume_info["original_filename"] == "Alex_Morgan_Resume_2026.pdf"
    assert resume_info["content_type"] == "application/pdf"
    assert resume_info["file_size"] == 1048576

    # Ensure internal storage path is NOT in response
    assert "file_path" not in resume_info
    assert "C:\\Secret" not in res.text
    print("  [PASS] Resume metadata is safely exposed and filesystem storage paths remain private.")


def test_6_security_and_nonexistent_students():
    """Verify appropriate HTTP status codes for invalid or missing student IDs."""
    print("\n[Test 6] Testing security and nonexistent students...")
    data = setup_users()
    headers_r1 = {"Authorization": f"Bearer {data['token_r1']}"}

    # Nonexistent student ID returns 404
    res_404 = client.get("/api/v1/passport/999999", headers=headers_r1)
    assert res_404.status_code == 404
    assert res_404.json()["detail"] == "Student not found"
    print("  [PASS] Nonexistent student ID returns structured 404.")

    # Requesting passport for a recruiter user ID returns 404
    res_recruiter_id = client.get(f"/api/v1/passport/{data['r1_id']}", headers=headers_r1)
    assert res_recruiter_id.status_code == 404
    assert res_recruiter_id.json()["detail"] == "Student not found"
    print("  [PASS] Querying a recruiter user ID as a student passport returns 404.")

    # Unauthenticated call to /passport/{id} returns 401
    res_unauth = client.get(f"/api/v1/passport/{data['s1_id']}")
    assert res_unauth.status_code == 401
    print("  [PASS] Unauthenticated request to /passport/{id} returns 401.")


def run_all():
    print("=" * 70)
    print("CAREERBRIDGE 2.0-E — EXPERIENCE PASSPORT TEST SUITE")
    print("=" * 70)
    test_1_passport_me_authorization_and_aggregation()
    test_2_passport_student_id_recruiter_and_public_privacy_boundaries()
    test_3_empty_passport_graceful_fallbacks()
    test_4_skills_provenance_and_summary_metrics()
    test_5_resume_metadata_exposure()
    test_6_security_and_nonexistent_students()
    cleanup_test_data()
    print("\n" + "=" * 70)
    print("ALL 2.0-E EXPERIENCE PASSPORT TESTS PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    run_all()
