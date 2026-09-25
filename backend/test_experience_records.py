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
    """Remove test users, profiles, projects, and experiences."""
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
    cleanup_test_data()
    print("\n" + "=" * 70)
    print("ALL 2.0-D VERIFIED EXPERIENCE TESTS PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    run_all()
