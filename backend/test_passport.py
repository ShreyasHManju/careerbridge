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

from app.core.database import SessionLocal, engine
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
    ProjectSkill,
    ProjectStatus,
    ProjectType,
    ProjectVisibility,
)
from app.models.project_evidence import EvidenceType, ProjectEvidence
from app.models.project_evidence_verification import EvidenceVerification, EvidenceVerificationStatus
from app.models.project_evaluation import (
    EvaluationRecommendation,
    EvaluationSkillAssessment,
    EvaluationStatus,
    ProjectEvaluation,
    SkillAssessmentProficiency,
)
from app.models.project_milestone import MilestoneStatus, ProjectMilestone
from app.models.recruiter_profile import RecruiterProfile
from app.models.resume import Resume
from app.core.rate_limit import rate_limiter
from app.models.passport_share import PassportShare
from app.models.skill import Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.skill_service import get_or_create_skill

client = TestClient(app)

STUDENT1_EMAIL = "passport.student1@careerbridge.io"
STUDENT2_EMAIL = "passport.student2@careerbridge.io"
RECRUITER_EMAIL = "passport.recruiter@careerbridge.io"
RECRUITER2_EMAIL = "passport.recruiter2@careerbridge.io"
ADMIN_EMAIL = "passport.admin@careerbridge.io"
TEST_PASSWORD = "PassportPassword123!"


def cleanup_test_data():
    """Remove test users, profiles, projects, and experiences."""
    with SessionLocal() as db:
        test_emails = [
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            RECRUITER_EMAIL,
            RECRUITER2_EMAIL,
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
    PassportShare.__table__.create(bind=engine, checkfirst=True)
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


def test_7_passport_verified_evidence_aggregation_and_privacy():
    """Verify verified evidence artifacts aggregation, presentation, and strict privacy boundaries."""
    print("\n[Test 7] Testing Passport verified evidence aggregation and privacy boundaries...")
    data = setup_users()
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}
    headers_s2 = {"Authorization": f"Bearer {data['token_s2']}"}
    headers_r1 = {"Authorization": f"Bearer {data['token_r1']}"}
    s1_id = data["s1_id"]
    admin_id = data["a1_id"]

    with SessionLocal() as db:
        # Public Project
        pub_proj = InnovationProject(
            student_id=s1_id,
            title="AI Search Engine",
            slug="ai-search-engine",
            description="Semantic search engine over technical documentation.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PUBLIC,
        )
        # Private Project
        priv_proj = InnovationProject(
            student_id=s1_id,
            title="Proprietary Trading Algorithm",
            slug="proprietary-trading-algorithm",
            description="High frequency algorithmic trading strategies.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PRIVATE,
        )
        db.add_all([pub_proj, priv_proj])
        db.flush()

        # Public project evidence 1: Verified
        ev_pub_verified = ProjectEvidence(
            innovation_project_id=pub_proj.id,
            title="Public Production Demo",
            description="Working live deployment on AWS.",
            evidence_type=EvidenceType.DEMO,
            url="https://demo.search.dev",
        )
        # Public project evidence 2: Pending (unverified)
        ev_pub_pending = ProjectEvidence(
            innovation_project_id=pub_proj.id,
            title="Benchmark Report",
            description="Internal performance metrics draft.",
            evidence_type=EvidenceType.DOCUMENT,
            url="https://metrics.search.dev/benchmarks.pdf",
        )
        # Private project evidence 3: Verified (Belongs to private project)
        ev_priv_verified = ProjectEvidence(
            innovation_project_id=priv_proj.id,
            title="Proprietary Alpha Backtest",
            description="Backtest simulation results.",
            evidence_type=EvidenceType.DOCUMENT,
            url="https://secure.internal/backtest.pdf",
        )
        db.add_all([ev_pub_verified, ev_pub_pending, ev_priv_verified])
        db.flush()

        v1 = EvidenceVerification(
            evidence_id=ev_pub_verified.id,
            verifier_id=admin_id,
            status=EvidenceVerificationStatus.VERIFIED,
            verified_at=datetime.now(timezone.utc),
            notes="Live demo verified.",
        )
        v2 = EvidenceVerification(
            evidence_id=ev_pub_pending.id,
            verifier_id=None,
            status=EvidenceVerificationStatus.PENDING,
        )
        v3 = EvidenceVerification(
            evidence_id=ev_priv_verified.id,
            verifier_id=admin_id,
            status=EvidenceVerificationStatus.VERIFIED,
            verified_at=datetime.now(timezone.utc),
            notes="Backtest confirmed.",
        )
        db.add_all([v1, v2, v3])
        db.commit()

    # 1. Recruiter checks Student 1's passport
    res_rec = client.get(f"/api/v1/passport/{s1_id}", headers=headers_r1)
    assert res_rec.status_code == 200
    rec_body = res_rec.json()

    # Recruiter must see only 1 project (the public one)
    assert len(rec_body["projects"]) == 1
    pub_p_data = rec_body["projects"][0]
    assert pub_p_data["title"] == "AI Search Engine"

    # In public project, only the verified evidence artifact appears
    assert pub_p_data["verified_evidence_count"] == 1
    assert len(pub_p_data["verified_evidence"]) == 1
    assert pub_p_data["verified_evidence"][0]["title"] == "Public Production Demo"
    assert pub_p_data["verified_evidence"][0]["url"] == "https://demo.search.dev"

    # Overall passport verified_evidence list must only have the public verified item
    assert len(rec_body["verified_evidence"]) == 1
    assert rec_body["verified_evidence"][0]["title"] == "Public Production Demo"
    assert rec_body["summary"]["verified_evidence_count"] == 1

    # Ensure unverified evidence and private verified evidence never leak to recruiter
    rec_text = res_rec.text
    assert "Benchmark Report" not in rec_text
    assert "Proprietary Alpha Backtest" not in rec_text
    assert "secure.internal" not in rec_text
    print("  [PASS] Recruiter passport view strictly isolates verified public evidence and omits unverified/private artifacts.")

    # 2. Student 2 (another student) checks Student 1's passport -> Same privacy enforcement
    res_s2 = client.get(f"/api/v1/passport/{s1_id}", headers=headers_s2)
    assert res_s2.status_code == 200
    assert len(res_s2.json()["projects"]) == 1
    assert len(res_s2.json()["verified_evidence"]) == 1
    assert "Proprietary Alpha Backtest" not in res_s2.text
    print("  [PASS] Student 2 public passport view respects identical privacy boundaries.")

    # 3. Student 1 (Owner) checks their own passport via /passport/me
    res_owner = client.get("/api/v1/passport/me", headers=headers_s1)
    assert res_owner.status_code == 200
    owner_body = res_owner.json()
    assert owner_body["is_owner"] is True
    # Owner sees both public and private projects
    assert len(owner_body["projects"]) == 2
    # Total verified evidence across all projects owned by student
    assert owner_body["summary"]["verified_evidence_count"] == 2
    assert len(owner_body["verified_evidence"]) == 2
    print("  [PASS] Owner passport view displays all verified evidence artifacts across all owned projects.")


def test_8_passport_recruiter_evaluations_aggregation_and_privacy():
    """
    Phase 30D: Validate that:
    1. SUBMITTED project evaluations aggregate into the student's Passport with dimensional scores and recommendations.
    2. Multiple submitted evaluations compute project-level and passport-level score averages correctly.
    3. DRAFT and WITHDRAWN evaluations are strictly excluded from the Passport.
    4. Recruiter personal emails and private details are never exposed.
    5. Assessed skills appear in the canonical skills list with 'evaluation' provenance.
    6. Students without evaluations receive clean empty structures.
    """
    print("\n--- Test 8: Passport Recruiter Evaluations Aggregation & Privacy (Phase 30D) ---")
    data = setup_users()
    s1_id = data["s1_id"]
    r1_id = data["r1_id"]
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}
    headers_r1 = {"Authorization": f"Bearer {data['token_r1']}"}

    with SessionLocal() as db:
        # Create a second recruiter for multi-evaluation testing
        r2 = User(
            email="passport.recruiter2@careerbridge.io",
            password_hash=hash_password(TEST_PASSWORD),
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        db.add(r2)
        db.flush()
        db.add(
            RecruiterProfile(
                user_id=r2.id,
                company_name="Nexus Innovations",
                contact_name="Sarah Connor",
                is_verified=True,
            )
        )

        # Public Innovation Project
        pub_proj = InnovationProject(
            student_id=s1_id,
            title="Distributed Transaction Engine",
            slug="distributed-transaction-engine",
            description="High performance 2PC distributed transaction manager in Rust.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PUBLIC,
        )
        db.add(pub_proj)
        db.flush()

        # Canonical skill for evaluation assessment
        rust_skill = get_or_create_skill(db, "Rust", "Systems")

        # 1. Submitted evaluation by Recruiter 1
        eval_submitted = ProjectEvaluation(
            project_id=pub_proj.id,
            student_id=s1_id,
            recruiter_id=r1_id,
            status=EvaluationStatus.SUBMITTED,
            technical_quality_score=5,
            problem_solving_score=5,
            execution_score=4,
            communication_documentation_score=4,
            evidence_quality_score=5,
            overall_score=4.60,
            recommendation=EvaluationRecommendation.STRONGLY_RECOMMENDED,
            strengths="Exceptional concurrency control and lock-free data structures.",
            feedback="Top 1% systems engineering candidate.",
            submitted_at=datetime.now(timezone.utc),
        )
        # 2. Draft evaluation by Recruiter 2 (should be excluded)
        eval_draft = ProjectEvaluation(
            project_id=pub_proj.id,
            student_id=s1_id,
            recruiter_id=r2.id,
            status=EvaluationStatus.DRAFT,
            technical_quality_score=3,
            overall_score=3.00,
            feedback="Draft notes not yet finalized.",
        )
        db.add_all([eval_submitted, eval_draft])
        db.flush()

        # Add assessed skill on submitted evaluation
        sa = EvaluationSkillAssessment(
            evaluation_id=eval_submitted.id,
            skill_id=rust_skill.id,
            proficiency=SkillAssessmentProficiency.ADVANCED,
        )
        db.add(sa)
        db.commit()
        eval_draft_id = eval_draft.id

    # Verify Public / Recruiter Passport View
    res = client.get(f"/api/v1/passport/{s1_id}", headers=headers_r1)
    assert res.status_code == 200
    body = res.json()

    # Project evaluations
    proj = body["projects"][0]
    assert proj["title"] == "Distributed Transaction Engine"
    assert proj["evaluations_count"] == 1
    assert len(proj["evaluations"]) == 1
    assert proj["average_evaluation_score"] == 4.6

    eval_data = proj["evaluations"][0]
    assert eval_data["recruiter_company"] == "Apex Cloud Systems"
    assert eval_data["overall_score"] == 4.6
    assert eval_data["technical_score"] == 5
    assert eval_data["problem_solving_score"] == 5
    assert eval_data["execution_score"] == 4
    assert eval_data["communication_score"] == 4
    assert eval_data["evidence_score"] == 5
    assert eval_data["recommendation"] == "strongly_recommended"
    assert eval_data["strengths"] == "Exceptional concurrency control and lock-free data structures."
    assert len(eval_data["assessed_skills"]) == 1
    assert eval_data["assessed_skills"][0]["name"] == "Rust"

    # Privacy checks: Draft evaluation is excluded and recruiter personal email is not exposed
    res_text = res.text
    assert "Draft notes not yet finalized" not in res_text
    assert RECRUITER_EMAIL not in res_text

    # Summary metrics
    summary = body["summary"]
    assert summary["total_evaluations_count"] == 1
    assert summary["average_project_score"] == 4.6

    # Canonical skills provenance includes 'evaluation'
    rust_in_skills = next((s for s in body["skills"] if s["name"] == "Rust"), None)
    assert rust_in_skills is not None
    assert "evaluation" in rust_in_skills["sources"]
    print("  [PASS] Submitted recruiter evaluations aggregate cleanly into Passport with privacy shielding.")

    # Multi-evaluation aggregation check
    with SessionLocal() as db:
        # Submit the second evaluation
        db_eval2 = db.scalar(select(ProjectEvaluation).where(ProjectEvaluation.id == eval_draft_id))
        db_eval2.status = EvaluationStatus.SUBMITTED
        db_eval2.overall_score = 4.00
        db_eval2.submitted_at = datetime.now(timezone.utc)
        db.commit()

    res_multi = client.get(f"/api/v1/passport/{s1_id}", headers=headers_r1)
    assert res_multi.status_code == 200
    multi_body = res_multi.json()
    proj_multi = multi_body["projects"][0]
    assert proj_multi["evaluations_count"] == 2
    assert len(proj_multi["evaluations"]) == 2
    assert proj_multi["average_evaluation_score"] == 4.3  # (4.6 + 4.0) / 2 = 4.3
    assert multi_body["summary"]["total_evaluations_count"] == 2
    assert multi_body["summary"]["average_project_score"] == 4.3
    print("  [PASS] Multiple submitted evaluations correctly compute project and passport average scores.")

    # Withdrawn evaluation check
    with SessionLocal() as db:
        db_eval2 = db.scalar(select(ProjectEvaluation).where(ProjectEvaluation.id == eval_draft_id))
        db_eval2.status = EvaluationStatus.WITHDRAWN
        db.commit()

    res_withdrawn = client.get(f"/api/v1/passport/{s1_id}", headers=headers_r1)
    assert res_withdrawn.status_code == 200
    withdrawn_body = res_withdrawn.json()
    assert withdrawn_body["projects"][0]["evaluations_count"] == 1
    assert withdrawn_body["summary"]["total_evaluations_count"] == 1
    print("  [PASS] Withdrawn evaluations are strictly omitted from Passport.")


def test_9_passport_share_lifecycle_and_crud():
    """
    Test 9: Verify authenticated student Passport Share lifecycle:
    - Authenticated student can create a new share link (POST /api/v1/passport/shares)
    - Unauthenticated requests receive 401
    - Non-student roles receive 403
    - Raw token is returned only on creation with usable /p/ share URL
    - List shares returns masked token preview and share_url=None
    - Update share modifies label, activation, and expiration
    - Delete share revokes the link (204 No Content)
    """
    print("\n--- Test 9: Passport Share CRUD & Lifecycle ---")
    data = setup_users()
    s1_id = data["s1_id"]
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}
    headers_r1 = {"Authorization": f"Bearer {data['token_r1']}"}

    # 1. Unauthenticated creation rejected
    res_unauth = client.post(
        "/api/v1/passport/shares",
        json={"label": "Unauth Test"},
    )
    assert res_unauth.status_code == 401
    print("  [PASS] Unauthenticated share creation rejected with 401.")

    # 2. Non-student role rejected
    res_rec = client.post(
        "/api/v1/passport/shares",
        json={"label": "Recruiter Test"},
        headers=headers_r1,
    )
    assert res_rec.status_code == 403
    print("  [PASS] Non-student role share creation rejected with 403.")

    # 3. Authenticated student creates share link
    create_payload = {
        "label": "Engineering Recruiter Share",
        "expires_in_days": 30,
        "allow_contact_info": True,
        "allow_unverified_projects": False,
    }
    res_create = client.post(
        "/api/v1/passport/shares",
        json=create_payload,
        headers=headers_s1,
    )
    assert res_create.status_code == 201
    created_body = res_create.json()
    assert "share_token" in created_body
    raw_token = created_body["share_token"]
    assert raw_token.startswith("cb_share_")
    assert created_body["share_url"] == f"/p/{raw_token}"
    assert created_body["label"] == "Engineering Recruiter Share"
    assert created_body["is_active"] is True
    assert created_body["allow_contact_info"] is True
    assert created_body["allow_unverified_projects"] is False
    assert created_body["view_count"] == 0
    assert created_body["expires_at"] is not None
    share_id = created_body["id"]
    print("  [PASS] Student successfully creates share link with raw token and share URL.")

    # 4. List shares returns safe historical summary
    res_list = client.get("/api/v1/passport/shares", headers=headers_s1)
    assert res_list.status_code == 200
    shares_list = res_list.json()
    assert len(shares_list) == 1
    item = shares_list[0]
    assert item["id"] == share_id
    assert item["label"] == "Engineering Recruiter Share"
    assert item["token_preview"].startswith("cb_share_")
    assert "..." in item["token_preview"]
    assert item["share_url"] is None
    assert "share_token" not in item
    print("  [PASS] List shares returns masked token preview and share_url=None.")

    # 5. Update share: label and expiration
    res_upd = client.patch(
        f"/api/v1/passport/shares/{share_id}",
        json={"label": "Updated Label", "clear_expiration": True},
        headers=headers_s1,
    )
    assert res_upd.status_code == 200
    upd_body = res_upd.json()
    assert upd_body["label"] == "Updated Label"
    assert upd_body["expires_at"] is None
    assert upd_body["is_active"] is True
    print("  [PASS] Update share successfully updates label and clears expiration.")

    # 6. Deactivate / Revoke via update
    res_deact = client.patch(
        f"/api/v1/passport/shares/{share_id}",
        json={"is_active": False},
        headers=headers_s1,
    )
    assert res_deact.status_code == 200
    assert res_deact.json()["is_active"] is False
    assert res_deact.json()["revoked_at"] is not None
    print("  [PASS] Deactivating share link records revoked_at timestamp.")

    # 7. Reactivate via update
    res_react = client.patch(
        f"/api/v1/passport/shares/{share_id}",
        json={"is_active": True},
        headers=headers_s1,
    )
    assert res_react.status_code == 200
    assert res_react.json()["is_active"] is True
    assert res_react.json()["revoked_at"] is None
    print("  [PASS] Reactivating share link clears revoked_at timestamp.")

    # 8. Delete / Revoke via DELETE endpoint
    res_del = client.delete(f"/api/v1/passport/shares/{share_id}", headers=headers_s1)
    assert res_del.status_code == 204
    # Verify share is now inactive in DB
    res_list_after = client.get("/api/v1/passport/shares", headers=headers_s1)
    assert res_list_after.json()[0]["is_active"] is False
    print("  [PASS] DELETE /passport/shares/{id} successfully revokes share link (204).")


def test_10_passport_share_idor_prevention():
    """
    Test 10: Strict IDOR prevention between students:
    - Student A cannot access or list Student B's share links
    - Student A cannot modify Student B's share links
    - Student A cannot revoke Student B's share links
    """
    print("\n--- Test 10: Passport Share IDOR Protection ---")
    data = setup_users()
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}
    headers_s2 = {"Authorization": f"Bearer {data['token_s2']}"}

    # Student 1 creates a share
    res_create = client.post(
        "/api/v1/passport/shares",
        json={"label": "Student 1 Share"},
        headers=headers_s1,
    )
    assert res_create.status_code == 201
    s1_share_id = res_create.json()["id"]

    # Student 2 lists shares: must see 0 shares (isolated)
    res_s2_list = client.get("/api/v1/passport/shares", headers=headers_s2)
    assert res_s2_list.status_code == 200
    assert len(res_s2_list.json()) == 0
    print("  [PASS] Student 2 cannot view Student 1's share links.")

    # Student 2 attempts to update Student 1's share: rejected with 404
    res_s2_upd = client.patch(
        f"/api/v1/passport/shares/{s1_share_id}",
        json={"label": "Hacked Label"},
        headers=headers_s2,
    )
    assert res_s2_upd.status_code == 404
    print("  [PASS] Student 2 cannot update Student 1's share link (404 Not Found).")

    # Student 2 attempts to delete Student 1's share: rejected with 404
    res_s2_del = client.delete(
        f"/api/v1/passport/shares/{s1_share_id}",
        headers=headers_s2,
    )
    assert res_s2_del.status_code == 404
    print("  [PASS] Student 2 cannot revoke Student 1's share link (404 Not Found).")


def test_11_public_passport_verification_and_privacy():
    """
    Test 11: Public Passport Resolution, Verification Summary, and Privacy Shielding:
    - Public endpoint /api/v1/public/passport/{share_token} resolves without auth
    - Cache-Control header is set to no-store, no-cache, must-revalidate
    - No internal student ID, recruiter ID, or evaluation IDs leaked
    - Avatar URL is None (no ID leaked)
    - Verification timestamp derived from authoritative artifact timestamps
    - Contact info respects allow_contact_info flag
    - Unverified projects respect allow_unverified_projects flag
    """
    print("\n--- Test 11: Public Passport Verification & Privacy ---")
    data = setup_users()
    s1_id = data["s1_id"]
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}

    # Setup student profile, verified experience, verified project, and unverified project
    with SessionLocal() as db:
        # Profile
        p1 = db.scalar(select(StudentProfile).where(StudentProfile.user_id == s1_id))
        if p1:
            p1.full_name = "Alex Vance"
            p1.phone = "+1-555-0199"
            p1.college = "MIT"
            p1.degree = "B.S."
            p1.branch = "Computer Science"
            p1.graduation_year = 2026
            p1.bio = "Systems programmer & distributed systems builder."
            p1.portfolio_url = "https://alexvance.dev"
            p1.linkedin_url = "https://linkedin.com/in/alexvance"
            p1.github_url = "https://github.com/alexvance"
        else:
            db.add(
                StudentProfile(
                    user_id=s1_id,
                    full_name="Alex Vance",
                    phone="+1-555-0199",
                    college="MIT",
                    degree="B.S.",
                    branch="Computer Science",
                    graduation_year=2026,
                    bio="Systems programmer & distributed systems builder.",
                    portfolio_url="https://alexvance.dev",
                    linkedin_url="https://linkedin.com/in/alexvance",
                    github_url="https://github.com/alexvance",
                )
            )
        # Verified Experience
        exp_verified_at = datetime(2026, 5, 15, 10, 0, 0, tzinfo=timezone.utc)
        exp = ExperienceRecord(
            student_id=s1_id,
            title="Systems Engineering Intern",
            organization_name="Apex Systems",
            experience_type=ExperienceType.INTERNSHIP,
            start_date=date(2025, 6, 1),
            end_date=date(2025, 8, 31),
            is_current=False,
            description="Built high-throughput message pipelines.",
            status=VerificationStatus.VERIFIED,
            verification_source=VerificationSource.RECRUITER_CONFIRMED,
            verified_at=exp_verified_at,
        )
        db.add(exp)
        db.flush()

        skill_go = get_or_create_skill(db, "Go", "Languages", is_verified=True)
        db.add(ExperienceSkill(experience_record_id=exp.id, skill_id=skill_go.id))

        # Verified Project
        proj_verified_at = datetime(2026, 6, 20, 14, 30, 0, tzinfo=timezone.utc)
        proj_v = InnovationProject(
            student_id=s1_id,
            title="Distributed Raft Cluster",
            slug="distributed-raft-cluster",
            short_description="Consensus engine in Go",
            description="Production Raft implementation.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PUBLIC,
            repository_url="https://github.com/alexvance/raft",
        )
        db.add(proj_v)
        db.flush()

        ev = ProjectEvidence(
            innovation_project_id=proj_v.id,
            title="Repository Proof",
            url="https://github.com/alexvance/raft",
            evidence_type=EvidenceType.REPOSITORY,
        )
        db.add(ev)
        db.flush()

        ev_ver = EvidenceVerification(
            evidence_id=ev.id,
            status=EvidenceVerificationStatus.VERIFIED,
            verified_at=proj_verified_at,
        )
        db.add(ev_ver)

        skill_dist = get_or_create_skill(db, "Distributed Systems", "Architecture", is_verified=True)
        db.add(ProjectSkill(innovation_project_id=proj_v.id, skill_id=skill_dist.id))

        # Unverified Project
        proj_unv = InnovationProject(
            student_id=s1_id,
            title="Unverified Toy Project",
            slug="unverified-toy-project",
            short_description="Toy parser in Python",
            description="Unverified experiments.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PUBLIC,
        )
        db.add(proj_unv)
        db.flush()
        skill_py = get_or_create_skill(db, "Python", "Languages", is_verified=False)
        db.add(ProjectSkill(innovation_project_id=proj_unv.id, skill_id=skill_py.id))

        db.commit()

    # Create share link with allow_contact_info=True, allow_unverified_projects=False
    res_c1 = client.post(
        "/api/v1/passport/shares",
        json={"label": "Verified Only", "allow_contact_info": True, "allow_unverified_projects": False},
        headers=headers_s1,
    )
    raw_token1 = res_c1.json()["share_token"]

    # Public request without credentials
    res_pub = client.get(f"/api/v1/public/passport/{raw_token1}")
    assert res_pub.status_code == 200
    assert res_pub.headers.get("Cache-Control") == "no-store, no-cache, must-revalidate"
    pub_data = res_pub.json()

    # Verify Profile header
    assert pub_data["full_name"] == "Alex Vance"
    assert pub_data["institution"] == "MIT"
    assert pub_data["major"] == "Computer Science"
    assert pub_data["degree"] == "B.S."
    assert pub_data["graduation_year"] == 2026
    assert pub_data["avatar_url"] is None  # Student ID shielded

    # Verify Contact info (included when True)
    assert pub_data["contact_info"] is not None
    assert pub_data["contact_info"]["email"] == STUDENT1_EMAIL
    assert pub_data["contact_info"]["phone"] == "+1-555-0199"
    assert pub_data["contact_info"]["portfolio_url"] == "https://alexvance.dev"

    # Verify Verification summary
    v_summary = pub_data["verification_summary"]
    assert v_summary["issuer"] == "CareerBridge"
    assert v_summary["verification_status"] == "VERIFIED"
    assert v_summary["verified_placements_count"] == 1
    assert v_summary["verified_projects_count"] == 1
    # Latest verified timestamp is max(exp_verified_at, proj_verified_at) = proj_verified_at
    assert v_summary["verified_at"] is not None
    assert "2026-06-20" in v_summary["verified_at"]

    # Verify Experience timeline (no internal IDs)
    assert len(pub_data["experience_timeline"]) == 1
    exp_item = pub_data["experience_timeline"][0]
    assert exp_item["company_name"] == "Apex Systems"
    assert exp_item["role_title"] == "Systems Engineering Intern"
    assert exp_item["is_verified"] is True
    assert "id" not in exp_item
    assert "student_id" not in exp_item

    # Verify Featured projects (unverified excluded when allow_unverified_projects=False)
    assert len(pub_data["featured_projects"]) == 1
    assert pub_data["featured_projects"][0]["title"] == "Distributed Raft Cluster"
    assert pub_data["featured_projects"][0]["is_verified"] is True
    assert "id" not in pub_data["featured_projects"][0]

    # Verify Verified skills: Go and Distributed Systems present, Python strictly excluded
    skill_names = [s["skill_name"] for s in pub_data["verified_skills"]]
    assert "Go" in skill_names
    assert "Distributed Systems" in skill_names
    assert "Python" not in skill_names
    print("  [PASS] Public passport verified projections and privacy shields verified.")

    # Create share link with allow_contact_info=False, allow_unverified_projects=True
    res_c2 = client.post(
        "/api/v1/passport/shares",
        json={"label": "Unverified Included", "allow_contact_info": False, "allow_unverified_projects": True},
        headers=headers_s1,
    )
    raw_token2 = res_c2.json()["share_token"]
    res_pub2 = client.get(f"/api/v1/public/passport/{raw_token2}")
    assert res_pub2.status_code == 200
    pub_data2 = res_pub2.json()

    # Contact info omitted when allow_contact_info=False
    assert pub_data2["contact_info"] is None

    # Featured projects includes unverified project marked with is_verified=False
    proj_titles = [p["title"] for p in pub_data2["featured_projects"]]
    assert "Distributed Raft Cluster" in proj_titles
    assert "Unverified Toy Project" in proj_titles
    toy_proj = next(p for p in pub_data2["featured_projects"] if p["title"] == "Unverified Toy Project")
    assert toy_proj["is_verified"] is False

    # Unverified project skills STILL excluded from verified_skills
    skill_names2 = [s["skill_name"] for s in pub_data2["verified_skills"]]
    assert "Python" not in skill_names2
    print("  [PASS] Contact info omitted and unverified project skills excluded from verified_skills.")


def test_12_public_passport_status_guards_and_view_count_isolation():
    """
    Test 12: Public Endpoint Status Guards & Atomic View Counting:
    - Valid token increments view_count atomically
    - Invalid token returns 404 (no view count increment)
    - Revoked token returns 410 (no view count increment)
    - Expired token returns 410 (no view count increment)
    - Inactive student returns 404 (no view count increment)
    """
    print("\n--- Test 12: Public Status Guards & Atomic View Count ---")
    data = setup_users()
    s1_id = data["s1_id"]
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}

    res_c = client.post(
        "/api/v1/passport/shares",
        json={"label": "View Count Guard Test"},
        headers=headers_s1,
    )
    share_id = res_c.json()["id"]
    raw_token = res_c.json()["share_token"]

    # 1. First valid request increments view count to 1
    res1 = client.get(f"/api/v1/public/passport/{raw_token}")
    assert res1.status_code == 200

    with SessionLocal() as db:
        share_db = db.scalar(select(PassportShare).where(PassportShare.id == share_id))
        assert share_db.view_count == 1
        assert share_db.last_accessed_at is not None

    # 2. Second valid request increments view count to 2
    res2 = client.get(f"/api/v1/public/passport/{raw_token}")
    assert res2.status_code == 200

    with SessionLocal() as db:
        share_db = db.scalar(select(PassportShare).where(PassportShare.id == share_id))
        assert share_db.view_count == 2
    print("  [PASS] Atomic view count increments on valid requests.")

    # 3. Invalid token returns 404 and does not increment
    res_invalid = client.get("/api/v1/public/passport/cb_share_completely_invalid_token_12345")
    assert res_invalid.status_code == 404

    # 4. Revoked token returns 410 and does not increment
    client.patch(f"/api/v1/passport/shares/{share_id}", json={"is_active": False}, headers=headers_s1)
    res_revoked = client.get(f"/api/v1/public/passport/{raw_token}")
    assert res_revoked.status_code == 410

    with SessionLocal() as db:
        share_db = db.scalar(select(PassportShare).where(PassportShare.id == share_id))
        assert share_db.view_count == 2
    print("  [PASS] Revoked token returns 410 with no view count increment.")

    # 5. Expired token returns 410 and does not increment
    client.patch(f"/api/v1/passport/shares/{share_id}", json={"is_active": True}, headers=headers_s1)
    with SessionLocal() as db:
        share_db = db.scalar(select(PassportShare).where(PassportShare.id == share_id))
        share_db.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()

    res_expired = client.get(f"/api/v1/public/passport/{raw_token}")
    assert res_expired.status_code == 410

    with SessionLocal() as db:
        share_db = db.scalar(select(PassportShare).where(PassportShare.id == share_id))
        assert share_db.view_count == 2
    print("  [PASS] Expired token returns 410 with no view count increment.")

    # 6. Inactive student returns 404 and does not increment
    client.patch(f"/api/v1/passport/shares/{share_id}", json={"clear_expiration": True}, headers=headers_s1)
    with SessionLocal() as db:
        s1 = db.scalar(select(User).where(User.id == s1_id))
        s1.is_active = False
        db.commit()

    res_inactive = client.get(f"/api/v1/public/passport/{raw_token}")
    assert res_inactive.status_code == 404

    with SessionLocal() as db:
        share_db = db.scalar(select(PassportShare).where(PassportShare.id == share_id))
        assert share_db.view_count == 2
        # Restore student active state
        s1 = db.scalar(select(User).where(User.id == s1_id))
        s1.is_active = True
        db.commit()
    print("  [PASS] Inactive student returns 404 with no view count increment.")


def test_13_public_passport_rate_limiting():
    """
    Test 13: Public Passport Sliding-Window Rate Limiting:
    - Enforces max 60 requests/minute per IP
    - Exceeding limit triggers HTTP 429 Too Many Requests with Retry-After header
    """
    print("\n--- Test 13: Public Passport Rate Limiting ---")
    rate_limiter.reset()
    data = setup_users()
    headers_s1 = {"Authorization": f"Bearer {data['token_s1']}"}

    res_c = client.post(
        "/api/v1/passport/shares",
        json={"label": "Rate Limit Test"},
        headers=headers_s1,
    )
    raw_token = res_c.json()["share_token"]

    # Send 60 requests -> all should succeed (200)
    for i in range(60):
        res = client.get(f"/api/v1/public/passport/{raw_token}")
        assert res.status_code == 200

    # 61st request -> should trigger 429 RateLimitExceeded
    res_limited = client.get(f"/api/v1/public/passport/{raw_token}")
    assert res_limited.status_code == 429
    assert "Retry-After" in res_limited.headers
    print("  [PASS] 61st request triggers HTTP 429 with Retry-After header.")
    rate_limiter.reset()


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
    test_7_passport_verified_evidence_aggregation_and_privacy()
    test_8_passport_recruiter_evaluations_aggregation_and_privacy()
    test_9_passport_share_lifecycle_and_crud()
    test_10_passport_share_idor_prevention()
    test_11_public_passport_verification_and_privacy()
    test_12_public_passport_status_guards_and_view_count_isolation()
    test_13_public_passport_rate_limiting()
    cleanup_test_data()
    print("\n" + "=" * 70)
    print("ALL 2.0-E EXPERIENCE PASSPORT TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_all()
