"""
CareerBridge Milestone 2.0-D — Verified Experience Test Suite
Comprehensive coverage for:
1. Model creation, date validation, and status constraints.
2. Ownership enforcement: only owner student can view/edit/delete/request verification.
3. Anti-self-verification guard: students cannot verify their own experience.
4. Recruiter authorization: recruiter can only verify experience matching their verified company.
5. Admin verification authority.
6. Rejection and resubmission workflow.
7. Verified record immutability on core fields.
8. InnovationProject linkage and SET NULL cascade behavior.
9. Canonical Skill association via ExperienceSkill.
10. Privacy guards: unverified claims do not leak to public/recruiter profile endpoints.
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
from app.models.application import Application, ApplicationStatus
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
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.project_evidence import EvidenceType, ProjectEvidence
from app.models.project_evidence_verification import EvidenceVerification, EvidenceVerificationStatus
from app.models.recruiter_profile import RecruiterProfile
from app.models.skill import Skill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "exp.student1@careerbridge.io"
STUDENT2_EMAIL = "exp.student2@careerbridge.io"
RECRUITER1_EMAIL = "exp.recruiter1@careerbridge.io"
RECRUITER2_EMAIL = "exp.recruiter2@careerbridge.io"
ADMIN_EMAIL = "exp.admin@careerbridge.io"
TEST_PASSWORD = "ExpTestPassword123!"

RECRUITER1_COMPANY = "Acme Corp"
RECRUITER2_COMPANY = "Globex Industries"


def cleanup_test_data():
    """Remove test users, profiles, projects, jobs, applications, and experiences."""
    with SessionLocal() as db:
        test_emails = [
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            RECRUITER1_EMAIL,
            RECRUITER2_EMAIL,
            ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(delete(ExperienceRecord).where(ExperienceRecord.student_id.in_(user_ids)))
            db.execute(delete(Application).where(Application.student_id.in_(user_ids)))
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            db.execute(delete(InnovationProject).where(InnovationProject.student_id.in_(user_ids)))
            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            db.execute(delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
        db.commit()


def get_token(email: str, role: UserRole, company_name: str = None) -> str:
    """Create test user with profile if not exists and return JWT token."""
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
            db.flush()

            if role == UserRole.STUDENT:
                profile = StudentProfile(
                    user_id=user.id,
                    full_name=f"Student {user.id}",
                )
                db.add(profile)
            elif role == UserRole.RECRUITER:
                r_profile = RecruiterProfile(
                    user_id=user.id,
                    company_name=company_name or "Test Organization",
                    is_verified=True,
                )
                db.add(r_profile)
            db.commit()
            db.refresh(user)

        return create_access_token(subject=user.id)


def get_user_id(email: str) -> int:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        return user.id


def test_1_create_experience_record_and_validation():
    print("\n--- TEST 1: Experience Record Creation & Validation ---")
    cleanup_test_data()
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token1}"}

    # 1. Valid creation
    payload = {
        "title": "Backend Engineering Intern",
        "organization_name": "Acme Corp",
        "experience_type": "internship",
        "start_date": "2025-06-01",
        "end_date": "2025-08-31",
        "is_current": False,
        "description": "Architected RESTful APIs and optimized PostgreSQL database queries.",
        "skills": "Python, FastAPI, PostgreSQL",
    }
    res = client.post("/api/v1/students/me/experiences", json=payload, headers=headers)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["title"] == "Backend Engineering Intern"
    assert data["organization_name"] == "Acme Corp"
    assert data["status"] == "claimed"
    assert data["verification_source"] == "self_claimed"
    assert data["skills"] == "Python, FastAPI, PostgreSQL"
    assert len(data["structured_skills"]) == 3
    print("  [PASS] Successfully created student experience record with structured skills.")

    # 2. Invalid date validation (end_date < start_date)
    invalid_dates_payload = dict(payload, start_date="2025-08-01", end_date="2025-05-01")
    res_inv = client.post("/api/v1/students/me/experiences", json=invalid_dates_payload, headers=headers)
    assert res_inv.status_code == 422, f"Expected 422 for invalid dates, got {res_inv.status_code}"
    print("  [PASS] Correctly rejected invalid end_date < start_date with 422.")

    # 3. Forged status rejection (cannot create with VERIFIED)
    forged_status_payload = dict(payload, status="verified")
    res_forged = client.post("/api/v1/students/me/experiences", json=forged_status_payload, headers=headers)
    assert res_forged.status_code == 422, f"Expected 422 for forged status, got {res_forged.status_code}"
    print("  [PASS] Correctly rejected forged initial status 'verified'.")


def test_2_ownership_and_access_control():
    print("\n--- TEST 2: Ownership Enforcement & RBAC ---")
    cleanup_test_data()
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    token2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    recruiter_token = get_token(RECRUITER1_EMAIL, UserRole.RECRUITER, RECRUITER1_COMPANY)
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Student 1 creates experience
    res = client.post(
        "/api/v1/students/me/experiences",
        json={
            "title": "Machine Learning Researcher",
            "organization_name": "AI Lab",
            "experience_type": "research",
            "start_date": "2025-01-01",
            "is_current": True,
            "description": "Trained transformer models for low-resource translation.",
        },
        headers=headers1,
    )
    assert res.status_code == 201
    exp_id = res.json()["id"]

    # Student 2 cannot update Student 1's experience
    res_s2_update = client.patch(
        f"/api/v1/students/me/experiences/{exp_id}",
        json={"title": "Hacked Title"},
        headers=headers2,
    )
    assert res_s2_update.status_code == 403, f"Expected 403, got {res_s2_update.status_code}"
    print("  [PASS] Student 2 forbidden from updating Student 1's experience.")

    # Student 2 cannot delete Student 1's experience
    res_s2_delete = client.delete(
        f"/api/v1/students/me/experiences/{exp_id}",
        headers=headers2,
    )
    assert res_s2_delete.status_code == 403
    print("  [PASS] Student 2 forbidden from deleting Student 1's experience.")

    # Recruiter cannot access student's /me/experiences
    res_rec = client.get("/api/v1/students/me/experiences", headers={"Authorization": f"Bearer {recruiter_token}"})
    assert res_rec.status_code == 403
    print("  [PASS] Recruiter forbidden from accessing /students/me/experiences.")


def test_3_verification_lifecycle_and_recruiter_authorization():
    print("\n--- TEST 3: Verification Lifecycle & Recruiter Authorization ---")
    cleanup_test_data()
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    recruiter1_token = get_token(RECRUITER1_EMAIL, UserRole.RECRUITER, RECRUITER1_COMPANY)
    recruiter2_token = get_token(RECRUITER2_EMAIL, UserRole.RECRUITER, RECRUITER2_COMPANY)
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers_rec1 = {"Authorization": f"Bearer {recruiter1_token}"}
    headers_rec2 = {"Authorization": f"Bearer {recruiter2_token}"}

    # Student 1 creates experience for Acme Corp
    res = client.post(
        "/api/v1/students/me/experiences",
        json={
            "title": "Software Engineering Intern",
            "organization_name": RECRUITER1_COMPANY,
            "experience_type": "internship",
            "start_date": "2025-05-01",
            "end_date": "2025-08-01",
            "is_current": False,
            "description": "Built notification microservices and CI/CD pipelines.",
        },
        headers=headers1,
    )
    exp_id = res.json()["id"]

    # Student 1 requests verification
    res_req = client.post(
        f"/api/v1/students/me/experiences/{exp_id}/request-verification",
        headers=headers1,
    )
    assert res_req.status_code == 200
    assert res_req.json()["status"] == "pending_verification"
    print("  [PASS] Experience successfully transitioned to pending_verification.")

    # Anti-self-verification Guard: Student cannot decide on their own verification
    res_self = client.post(
        f"/api/v1/verifications/{exp_id}/decision",
        json={"action": "approve", "notes": "I approve myself"},
        headers=headers1,
    )
    assert res_self.status_code == 403
    print("  [PASS] Student blocked from deciding on their own verification.")

    # Recruiter 2 (Globex) cannot verify experience for Acme Corp
    res_rec2_decide = client.post(
        f"/api/v1/verifications/{exp_id}/decision",
        json={"action": "approve", "notes": "Globex approval"},
        headers=headers_rec2,
    )
    assert res_rec2_decide.status_code == 403, f"Expected 403 for mismatched recruiter company, got {res_rec2_decide.status_code}"
    print("  [PASS] Recruiter 2 blocked from verifying experience for another company.")

    # Recruiter 1 (Acme Corp) sees it in their pending verification queue
    res_queue = client.get("/api/v1/verifications/pending", headers=headers_rec1)
    assert res_queue.status_code == 200
    queue_items = res_queue.json()["items"]
    assert any(item["id"] == exp_id for item in queue_items)
    print("  [PASS] Recruiter 1 sees pending verification in authorized company queue.")

    # Recruiter 1 approves verification
    res_approve = client.post(
        f"/api/v1/verifications/{exp_id}/decision",
        json={"action": "approve", "notes": "Outstanding intern performance confirmed by engineering lead."},
        headers=headers_rec1,
    )
    assert res_approve.status_code == 200
    appr_data = res_approve.json()
    assert appr_data["status"] == "verified"
    assert appr_data["verification_source"] == "recruiter_confirmed"
    assert appr_data["verifier_id"] is not None
    assert appr_data["verified_at"] is not None
    assert "Outstanding intern" in appr_data["verification_notes"]
    print("  [PASS] Recruiter 1 successfully approved verification.")


def test_4_verified_record_immutability():
    print("\n--- TEST 4: Verified Record Immutability ---")
    cleanup_test_data()
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Student 1 creates and requests verification
    res = client.post(
        "/api/v1/students/me/experiences",
        json={
            "title": "Full Stack Developer",
            "organization_name": "Tech Corp",
            "experience_type": "work",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "is_current": False,
            "description": "Developed React and FastAPI full stack applications.",
        },
        headers=headers1,
    )
    exp_id = res.json()["id"]

    client.post(f"/api/v1/students/me/experiences/{exp_id}/request-verification", headers=headers1)
    client.post(
        f"/api/v1/verifications/{exp_id}/decision",
        json={"action": "approve", "notes": "Admin verified"},
        headers=headers_admin,
    )

    # Attempt to alter core field 'title' while verified -> MUST FAIL WITH 400
    res_alter = client.patch(
        f"/api/v1/students/me/experiences/{exp_id}",
        json={"title": "Chief Technology Officer"},
        headers=headers1,
    )
    assert res_alter.status_code == 400, f"Expected 400, got {res_alter.status_code}: {res_alter.text}"
    assert "Cannot modify core field" in res_alter.json()["detail"]
    print("  [PASS] Altering core title on verified record blocked with 400.")

    # Attempt to alter organization_name while verified -> MUST FAIL WITH 400
    res_alter_org = client.patch(
        f"/api/v1/students/me/experiences/{exp_id}",
        json={"organization_name": "Different Corp"},
        headers=headers1,
    )
    assert res_alter_org.status_code == 400
    print("  [PASS] Altering organization_name on verified record blocked with 400.")

    # Attempt status demotion VERIFIED -> DRAFT -> MUST FAIL WITH 400
    res_demote_draft = client.patch(
        f"/api/v1/students/me/experiences/{exp_id}",
        json={"status": "draft"},
        headers=headers1,
    )
    assert res_demote_draft.status_code == 400, f"Expected 400, got {res_demote_draft.status_code}: {res_demote_draft.text}"
    assert "Verified experience status cannot be modified." in res_demote_draft.json()["detail"]

    # Verify status remains VERIFIED
    res_check1 = client.get(f"/api/v1/students/me/experiences/{exp_id}", headers=headers1)
    assert res_check1.status_code == 200
    assert res_check1.json()["status"] == "verified"
    print("  [PASS] Status demotion VERIFIED -> DRAFT blocked with 400; status remains VERIFIED.")

    # Attempt status demotion VERIFIED -> CLAIMED -> MUST FAIL WITH 400
    res_demote_claimed = client.patch(
        f"/api/v1/students/me/experiences/{exp_id}",
        json={"status": "claimed"},
        headers=headers1,
    )
    assert res_demote_claimed.status_code == 400, f"Expected 400, got {res_demote_claimed.status_code}: {res_demote_claimed.text}"
    assert "Verified experience status cannot be modified." in res_demote_claimed.json()["detail"]

    # Verify status remains VERIFIED
    res_check2 = client.get(f"/api/v1/students/me/experiences/{exp_id}", headers=headers1)
    assert res_check2.status_code == 200
    assert res_check2.json()["status"] == "verified"
    print("  [PASS] Status demotion VERIFIED -> CLAIMED blocked with 400; status remains VERIFIED.")


def test_5_rejection_and_resubmission_flow():
    print("\n--- TEST 5: Rejection and Resubmission Flow ---")
    cleanup_test_data()
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    res = client.post(
        "/api/v1/students/me/experiences",
        json={
            "title": "Open Source Contributor",
            "organization_name": "OSS Org",
            "experience_type": "project",
            "start_date": "2025-01-01",
            "is_current": True,
            "description": "Contributed bug fixes to open source libraries.",
        },
        headers=headers1,
    )
    exp_id = res.json()["id"]

    # Request verification
    client.post(f"/api/v1/students/me/experiences/{exp_id}/request-verification", headers=headers1)

    # Admin rejects verification with feedback
    res_reject = client.post(
        f"/api/v1/verifications/{exp_id}/decision",
        json={"action": "reject", "notes": "Please provide more detailed descriptions of PRs merged."},
        headers=headers_admin,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "rejected"
    assert "Please provide more detailed" in res_reject.json()["verification_notes"]
    print("  [PASS] Verification rejected with feedback notes.")

    # Student updates description
    res_update = client.patch(
        f"/api/v1/students/me/experiences/{exp_id}",
        json={"description": "Merged 5 PRs in repository X implementing dark mode and unit tests."},
        headers=headers1,
    )
    assert res_update.status_code == 200

    # Student resubmits verification
    res_resubmit = client.post(f"/api/v1/students/me/experiences/{exp_id}/request-verification", headers=headers1)
    assert res_resubmit.status_code == 200
    assert res_resubmit.json()["status"] == "pending_verification"
    assert res_resubmit.json()["verification_notes"] is None
    print("  [PASS] Student successfully resubmitted rejected experience for re-verification.")


def test_6_innovation_project_link_and_cascade():
    print("\n--- TEST 6: Innovation Project Linkage & Cascade ---")
    cleanup_test_data()
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    token2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Student 1 creates innovation project
    proj_res = client.post(
        "/api/v1/innovation-projects",
        json={
            "title": "Decentralized File Vault",
            "description": "Cryptographic file storage and sharing application with zero knowledge proofs.",
            "project_type": "software",
        },
        headers=headers1,
    )
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    # Student 2 cannot link Student 1's project
    res_s2_link = client.post(
        "/api/v1/students/me/experiences",
        json={
            "title": "Lead Engineer",
            "experience_type": "project",
            "start_date": "2025-01-01",
            "is_current": True,
            "description": "Built the decentralized file vault.",
            "innovation_project_id": proj_id,
        },
        headers=headers2,
    )
    assert res_s2_link.status_code == 400
    print("  [PASS] Student 2 blocked from linking another student's innovation project.")

    # Student 1 links their own project
    res_s1_link = client.post(
        "/api/v1/students/me/experiences",
        json={
            "title": "Lead Engineer",
            "experience_type": "project",
            "start_date": "2025-01-01",
            "is_current": True,
            "description": "Built the decentralized file vault with React and FastAPI.",
            "innovation_project_id": proj_id,
        },
        headers=headers1,
    )
    assert res_s1_link.status_code == 201
    exp_id = res_s1_link.json()["id"]
    assert res_s1_link.json()["verification_source"] == "platform_project"
    print("  [PASS] Student 1 successfully linked owned InnovationProject with platform_project source.")

    # Delete innovation project -> ExperienceRecord remains with innovation_project_id = None
    del_proj = client.delete(f"/api/v1/innovation-projects/{proj_id}", headers=headers1)
    assert del_proj.status_code == 204

    res_check = client.get(f"/api/v1/students/me/experiences/{exp_id}", headers=headers1)
    assert res_check.status_code == 200
    assert res_check.json()["innovation_project_id"] is None
    print("  [PASS] Deleting linked InnovationProject safely sets innovation_project_id to NULL.")


def test_7_privacy_rules_for_public_student_read():
    print("\n--- TEST 7: Privacy Rules for Student Profile Experiences ---")
    cleanup_test_data()
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    token2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    student1_id = get_user_id(STUDENT1_EMAIL)
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Student 1 creates two experiences: 1 unverified (claimed), 1 verified
    res1 = client.post(
        "/api/v1/students/me/experiences",
        json={
            "title": "Unverified Claim",
            "experience_type": "work",
            "start_date": "2025-01-01",
            "is_current": True,
            "description": "Unverified student claim that should not leak publicly.",
        },
        headers=headers1,
    )
    exp1_id = res1.json()["id"]

    res2 = client.post(
        "/api/v1/students/me/experiences",
        json={
            "title": "Verified Internship",
            "organization_name": "Acme Corp",
            "experience_type": "internship",
            "start_date": "2024-06-01",
            "end_date": "2024-08-31",
            "is_current": False,
            "description": "Verified internship completed at Acme Corp.",
        },
        headers=headers1,
    )
    exp2_id = res2.json()["id"]
    client.post(f"/api/v1/students/me/experiences/{exp2_id}/request-verification", headers=headers1)
    client.post(
        f"/api/v1/verifications/{exp2_id}/decision",
        json={"action": "approve", "notes": "Approved"},
        headers=headers_admin,
    )

    # Student 2 views Student 1's public experiences
    res_s2_view = client.get(f"/api/v1/students/{student1_id}/experiences", headers=headers2)
    assert res_s2_view.status_code == 200
    s2_items = res_s2_view.json()["items"]
    assert len(s2_items) == 1
    assert s2_items[0]["id"] == exp2_id
    assert s2_items[0]["title"] == "Verified Internship"
    print("  [PASS] Student 2 only sees verified experiences on Student 1's profile (unverified claim omitted).")

    # Student 1 views their own experiences via public endpoint
    res_s1_view = client.get(f"/api/v1/students/{student1_id}/experiences", headers=headers1)
    assert res_s1_view.status_code == 200
    assert len(res_s1_view.json()["items"]) == 2
    print("  [PASS] Student 1 sees all their own experiences (verified and unverified).")

    # Admin views Student 1's experiences via public endpoint
    res_admin_view = client.get(f"/api/v1/students/{student1_id}/experiences", headers=headers_admin)
    assert res_admin_view.status_code == 200
    assert len(res_admin_view.json()["items"]) == 2
    print("  [PASS] Admin sees all student experiences.")


def test_8_create_experience_from_verified_project():
    print("\n--- TEST 8: Create Experience From Verified Project ---")
    cleanup_test_data()
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    token2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    student1_id = get_user_id(STUDENT1_EMAIL)
    admin_id = get_user_id(ADMIN_EMAIL)
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create an Innovation Project for Student 1
    with SessionLocal() as db:
        proj = InnovationProject(
            student_id=student1_id,
            title="Realtime Stream Processing Engine",
            slug="realtime-stream-processing-engine",
            description="A distributed stream processing engine built in Rust and Python with Kafka.",
            project_type=ProjectType.SOFTWARE,
            status=ProjectStatus.ACTIVE,
            visibility=ProjectVisibility.PUBLIC,
            skills="Rust, Python, Apache Kafka",
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)
        proj_id = proj.id

    # 2. Attempt to add project as experience before any evidence is verified -> MUST FAIL WITH 400
    res_no_ev = client.post(
        f"/api/v1/students/me/experiences/from-project/{proj_id}",
        headers=headers1,
    )
    assert res_no_ev.status_code == 400, f"Expected 400, got {res_no_ev.status_code}: {res_no_ev.text}"
    assert "no verified evidence" in res_no_ev.json()["detail"]
    print("  [PASS] Project without verified evidence cannot be added as verified experience.")

    # 3. Add pending evidence item
    with SessionLocal() as db:
        ev = ProjectEvidence(
            innovation_project_id=proj_id,
            title="Architecture Whitepaper",
            description="Detailed design document.",
            evidence_type=EvidenceType.DOCUMENT,
            url="https://github.com/alex/stream-engine/doc.pdf",
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)
        ev_id = ev.id

        # Add pending verification
        verif = EvidenceVerification(
            evidence_id=ev_id,
            verifier_id=None,
            status=EvidenceVerificationStatus.PENDING,
        )
        db.add(verif)
        db.commit()

    # Still pending -> MUST FAIL WITH 400
    res_pending = client.post(
        f"/api/v1/students/me/experiences/from-project/{proj_id}",
        headers=headers1,
    )
    assert res_pending.status_code == 400
    print("  [PASS] Project with pending unverified evidence cannot be converted.")

    # 4. Admin verifies the evidence artifact (R6 system)
    with SessionLocal() as db:
        v_rec = db.scalar(select(EvidenceVerification).where(EvidenceVerification.evidence_id == ev_id))
        v_rec.status = EvidenceVerificationStatus.VERIFIED
        v_rec.verifier_id = admin_id
        v_rec.verified_at = datetime.now(timezone.utc)
        v_rec.notes = "Verified by senior staff engineer."
        db.commit()

    # 5. Student 2 cannot add Student 1's project -> MUST FAIL WITH 403
    res_s2_hack = client.post(
        f"/api/v1/students/me/experiences/from-project/{proj_id}",
        headers=headers2,
    )
    assert res_s2_hack.status_code == 403, f"Expected 403, got {res_s2_hack.status_code}"
    print("  [PASS] Cross-student project conversion blocked with 403 Forbidden.")

    # 6. Student 1 successfully adds verified project to Experience Records
    res_create = client.post(
        f"/api/v1/students/me/experiences/from-project/{proj_id}",
        headers=headers1,
    )
    assert res_create.status_code == 201, f"Expected 201, got {res_create.status_code}: {res_create.text}"
    exp_data = res_create.json()
    assert exp_data["title"] == "Realtime Stream Processing Engine"
    assert exp_data["status"] == "verified"
    assert exp_data["verification_source"] == "platform_project"
    assert exp_data["innovation_project_id"] == proj_id
    assert exp_data["verifier_id"] == admin_id
    assert exp_data["verified_at"] is not None
    assert len(exp_data["structured_skills"]) >= 2
    print("  [PASS] Student successfully created verified ExperienceRecord from verified project.")

    # 7. Duplicate prevention: Attempting to add the same project again -> MUST FAIL WITH 400
    res_dup = client.post(
        f"/api/v1/students/me/experiences/from-project/{proj_id}",
        headers=headers1,
    )
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"]
    print("  [PASS] Duplicate experience record creation prevented with 400 Bad Request.")


def test_9_create_experience_from_accepted_application():
    """
    Test Phase 33 Step 1:
    - Accepted job application -> successful WORK experience creation.
    - Accepted internship application -> successful INTERNSHIP experience creation.
    - Non-ACCEPTED application -> rejected with 400.
    - Application belonging to another student -> rejected with 403.
    - Nonexistent application -> 404.
    - Duplicate credentialization -> rejected with 400.
    - VerificationSource is exactly RECRUITER_CONFIRMED.
    - Recruiter/company attribution is correct.
    - Student cannot forge another student's application ID (IDOR protection).
    - Unauthenticated request is rejected with 401.
    - Non-student role is rejected with 403.
    """
    cleanup_test_data()

    token_s1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    token_s2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    token_rec1 = get_token(RECRUITER1_EMAIL, UserRole.RECRUITER, RECRUITER1_COMPANY)
    token_admin = get_token(ADMIN_EMAIL, UserRole.ADMIN)

    headers_s1 = {"Authorization": f"Bearer {token_s1}"}
    headers_s2 = {"Authorization": f"Bearer {token_s2}"}
    headers_rec1 = {"Authorization": f"Bearer {token_rec1}"}
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    with SessionLocal() as db:
        s1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        s2 = db.scalar(select(User).where(User.email == STUDENT2_EMAIL))
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))

        # Create Job Posting 1 (Full-Time Job)
        job_fulltime = JobPosting(
            recruiter_id=rec1.id,
            title="Senior Backend Engineer",
            description="Build distributed scale backends in Python and Go.",
            company_name=RECRUITER1_COMPANY,
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            skills="Python, Distributed Systems, FastAPI, PostgreSQL",
            is_active=True,
        )
        # Create Job Posting 2 (Internship)
        job_internship = JobPosting(
            recruiter_id=rec1.id,
            title="Software Engineering Intern",
            description="Summer software engineering internship building web services.",
            company_name=RECRUITER1_COMPANY,
            opportunity_type=OpportunityType.INTERNSHIP,
            employment_type=EmploymentType.FULL_TIME,
            skills="TypeScript, React, Python",
            is_active=True,
        )
        db.add_all([job_fulltime, job_internship])
        db.commit()
        db.refresh(job_fulltime)
        db.refresh(job_internship)

        # 1. Application 1: Student 1 to Job Fulltime (APPLIED status initially)
        app_applied = Application(
            job_posting_id=job_fulltime.id,
            student_id=s1.id,
            status=ApplicationStatus.APPLIED,
            cover_message="I am excited about this role.",
        )
        # 2. Application 2: Student 1 to Job Internship (ACCEPTED status)
        app_internship_accepted = Application(
            job_posting_id=job_internship.id,
            student_id=s1.id,
            status=ApplicationStatus.ACCEPTED,
            cover_message="Looking forward to interning at Acme.",
        )
        # 3. Application 3: Student 2 to Job Fulltime (ACCEPTED status)
        app_s2_accepted = Application(
            job_posting_id=job_fulltime.id,
            student_id=s2.id,
            status=ApplicationStatus.ACCEPTED,
            cover_message="Marcus applying.",
        )
        db.add_all([app_applied, app_internship_accepted, app_s2_accepted])
        db.commit()
        db.refresh(app_applied)
        db.refresh(app_internship_accepted)
        db.refresh(app_s2_accepted)

        app_applied_id = app_applied.id
        app_intern_acc_id = app_internship_accepted.id
        app_s2_acc_id = app_s2_accepted.id
        rec1_id = rec1.id

    # A. Unauthenticated request -> 401
    res_unauth = client.post(f"/api/v1/students/me/experiences/from-accepted-application/{app_intern_acc_id}")
    assert res_unauth.status_code == 401, f"Expected 401, got {res_unauth.status_code}"

    # B. Non-student role (Recruiter/Admin) -> 403
    res_rec = client.post(
        f"/api/v1/students/me/experiences/from-accepted-application/{app_intern_acc_id}",
        headers=headers_rec1,
    )
    assert res_rec.status_code == 403, f"Expected 403, got {res_rec.status_code}"

    res_adm = client.post(
        f"/api/v1/students/me/experiences/from-accepted-application/{app_intern_acc_id}",
        headers=headers_admin,
    )
    assert res_adm.status_code == 403, f"Expected 403, got {res_adm.status_code}"

    # C. Nonexistent application -> 404
    res_404 = client.post(
        "/api/v1/students/me/experiences/from-accepted-application/999999",
        headers=headers_s1,
    )
    assert res_404.status_code == 404, f"Expected 404, got {res_404.status_code}"
    assert "not found" in res_404.json()["detail"].lower()

    # D. Non-ACCEPTED status (status=applied) -> 400 Bad Request
    res_not_acc = client.post(
        f"/api/v1/students/me/experiences/from-accepted-application/{app_applied_id}",
        headers=headers_s1,
    )
    assert res_not_acc.status_code == 400, f"Expected 400, got {res_not_acc.status_code}"
    assert "must be accepted" in res_not_acc.json()["detail"]

    # E. IDOR Protection: Student 1 attempts to credentialize Student 2's accepted application -> 403 Forbidden
    res_idor = client.post(
        f"/api/v1/students/me/experiences/from-accepted-application/{app_s2_acc_id}",
        headers=headers_s1,
    )
    assert res_idor.status_code == 403, f"Expected 403, got {res_idor.status_code}"
    assert "not authorized" in res_idor.json()["detail"].lower()

    # F. Successful Internship Credentialization: Student 1 credentializes accepted internship -> 201 Created
    res_intern = client.post(
        f"/api/v1/students/me/experiences/from-accepted-application/{app_intern_acc_id}",
        headers=headers_s1,
    )
    assert res_intern.status_code == 201, f"Expected 201, got {res_intern.status_code}: {res_intern.text}"
    exp_intern = res_intern.json()
    assert exp_intern["title"] == "Software Engineering Intern"
    assert exp_intern["organization_name"] == RECRUITER1_COMPANY
    assert exp_intern["experience_type"] == "internship"
    assert exp_intern["status"] == "verified"
    assert exp_intern["verification_source"] == "recruiter_confirmed"
    assert exp_intern["verifier_id"] == rec1_id
    assert exp_intern["verified_at"] is not None
    assert exp_intern["is_current"] is True
    assert len(exp_intern["structured_skills"]) >= 2
    print("  [PASS] Accepted internship application successfully converted to INTERNSHIP ExperienceRecord.")

    # G. Duplicate prevention: Attempting to credentialize the same accepted internship again -> 400 Bad Request
    res_dup = client.post(
        f"/api/v1/students/me/experiences/from-accepted-application/{app_intern_acc_id}",
        headers=headers_s1,
    )
    assert res_dup.status_code == 400, f"Expected 400, got {res_dup.status_code}"
    assert "already exists" in res_dup.json()["detail"].lower()
    print("  [PASS] Duplicate accepted application credentialization prevented with 400 Bad Request.")

    # H. Successful Full-Time Job Credentialization: Transition application 1 to ACCEPTED, then credentialize
    with SessionLocal() as db:
        app1_db = db.scalar(select(Application).where(Application.id == app_applied_id))
        app1_db.status = ApplicationStatus.ACCEPTED
        db.commit()

    res_work = client.post(
        f"/api/v1/students/me/experiences/from-accepted-application/{app_applied_id}",
        headers=headers_s1,
    )
    assert res_work.status_code == 201, f"Expected 201, got {res_work.status_code}: {res_work.text}"
    exp_work = res_work.json()
    assert exp_work["title"] == "Senior Backend Engineer"
    assert exp_work["organization_name"] == RECRUITER1_COMPANY
    assert exp_work["experience_type"] == "work"
    assert exp_work["status"] == "verified"
    assert exp_work["verification_source"] == "recruiter_confirmed"
    assert exp_work["verifier_id"] == rec1_id
    assert exp_work["verified_at"] is not None
    assert exp_work["is_current"] is True
    assert len(exp_work["structured_skills"]) >= 3
    print("  [PASS] Accepted job application successfully converted to WORK ExperienceRecord.")


def run_all():
    print("=" * 70)
    print("CAREERBRIDGE 2.0-D — VERIFIED EXPERIENCE TEST SUITE")
    print("=" * 70)
    test_1_create_experience_record_and_validation()
    test_2_ownership_and_access_control()
    test_3_verification_lifecycle_and_recruiter_authorization()
    test_4_verified_record_immutability()
    test_5_rejection_and_resubmission_flow()
    test_6_innovation_project_link_and_cascade()
    test_7_privacy_rules_for_public_student_read()
    test_8_create_experience_from_verified_project()
    test_9_create_experience_from_accepted_application()
    cleanup_test_data()
    print("\n" + "=" * 70)
    print("ALL 2.0-D VERIFIED EXPERIENCE TESTS PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    run_all()
