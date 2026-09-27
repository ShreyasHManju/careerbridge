"""
CareerBridge Milestone R6 — Project Evidence Verification Test Suite
Comprehensive coverage for:
1. Verification creation and updates by authorized Admin.
2. Self-verification prevention (student cannot self-verify own evidence -> 403 Forbidden).
3. Role-based access control (student/recruiter cannot verify evidence -> 403 Forbidden).
4. Unauthenticated request rejection (401 Unauthorized).
5. Schema validation (invalid status, note length limits -> 422 Unprocessable Entity).
6. Nonexistent project / evidence rejection -> 404 Not Found.
7. Mismatched project and evidence relationship -> 404 Not Found.
8. Privacy shielding on private projects (unauthorized users cannot view verification -> 404 Not Found).
9. Verification status lifecycle transitions (pending -> verified, verified -> rejected, rejected -> pending).
10. Upsert / single verification constraint (updating existing verification preserves 1-to-1 relationship).
11. Cascade deletion (deleting evidence or project cascades verification record).
"""

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
from app.models.innovation_project import (
    InnovationProject,
    ProjectType,
    ProjectVisibility,
)
from app.models.project_evidence import EvidenceType, ProjectEvidence
from app.models.project_evidence_verification import (
    EvidenceVerification,
    EvidenceVerificationStatus,
)
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "verification.student1@careerbridge.io"
STUDENT2_EMAIL = "verification.student2@careerbridge.io"
RECRUITER_EMAIL = "verification.recruiter@careerbridge.io"
ADMIN_EMAIL = "verification.admin@careerbridge.io"
TEST_PASSWORD = "VerificationTestPassword123!"


def cleanup_test_data():
    """Remove test users, profiles, projects, evidence, and verifications."""
    with SessionLocal() as db:
        test_emails = [
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            RECRUITER_EMAIL,
            ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(delete(InnovationProject).where(InnovationProject.student_id.in_(user_ids)))
            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
        db.commit()


def get_token(email: str, role: UserRole) -> str:
    """Create test user if not exists and return JWT token."""
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

            if role == UserRole.STUDENT:
                profile = StudentProfile(
                    user_id=user.id,
                    full_name="Verification Test Student",
                    college="Institute of Technology",
                )
                db.add(profile)
                db.commit()

        return create_access_token(subject=user.id)


def setup_fixture():
    """Helper to create student project with an evidence item."""
    token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token}"}

    proj_res = client.post(
        "/api/v1/innovation-projects",
        headers=headers,
        json={
            "title": "Quantum Simulation Engine",
            "description": "High-performance simulation engine written in Rust",
            "project_type": "software",
            "visibility": "public",
        },
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    ev_res = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        headers=headers,
        json={
            "title": "Core Engine Repository",
            "description": "GitHub repository with simulation benchmarks",
            "evidence_type": "repository",
            "url": "https://github.com/example/quantum-sim",
        },
    )
    assert ev_res.status_code == 201
    evidence_id = ev_res.json()["id"]
    return project_id, evidence_id


def _test_admin_verification_lifecycle(project_id: int, evidence_id: int):
    print("[1/8] Testing Admin verification creation, update, and transitions...")
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Initial state on evidence: verification should be None / null
    ev_get = client.get(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}",
        headers=admin_headers,
    )
    assert ev_get.status_code == 200
    assert ev_get.json()["verification"] is None

    # 1. Admin verifies evidence with status="verified"
    res1 = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers=admin_headers,
        json={
            "status": "verified",
            "notes": "Codebase thoroughly audited. CI test suite passes with 100% coverage.",
        },
    )
    assert res1.status_code == 200
    v1 = res1.json()
    assert v1["status"] == "verified"
    assert v1["evidence_id"] == evidence_id
    assert "CI test suite passes" in v1["notes"]
    assert v1["verified_at"] is not None
    assert v1["verifier_id"] is not None

    # 2. Verify evidence response includes verification
    ev_get2 = client.get(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}",
        headers=admin_headers,
    )
    assert ev_get2.status_code == 200
    assert ev_get2.json()["verification"]["status"] == "verified"

    # 3. Transition to rejected via PATCH
    res2 = client.patch(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers=admin_headers,
        json={
            "status": "rejected",
            "notes": "Repository contains broken build artifacts.",
        },
    )
    assert res2.status_code == 200
    v2 = res2.json()
    assert v2["status"] == "rejected"
    assert "broken build artifacts" in v2["notes"]
    assert v2["verified_at"] is not None

    # 4. Transition to pending via PATCH (re-review requested)
    res3 = client.patch(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers=admin_headers,
        json={
            "status": "pending",
            "notes": "Awaiting student repository update.",
        },
    )
    assert res3.status_code == 200
    v3 = res3.json()
    assert v3["status"] == "pending"
    assert v3["verified_at"] is None

    # 5. Get verification directly via GET endpoint
    get_res = client.get(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers=admin_headers,
    )
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "pending"

    print("  -> Admin verification lifecycle passed.")


def _test_self_verification_prevention(project_id: int, evidence_id: int):
    print("[2/8] Testing student self-verification prevention...")
    student_token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # Student tries to verify their own evidence -> 403 Forbidden
    res_post = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers=student_headers,
        json={
            "status": "verified",
            "notes": "Self approved by owner",
        },
    )
    assert res_post.status_code == 403
    assert "cannot self-verify" in res_post.json()["detail"].lower()

    res_patch = client.patch(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers=student_headers,
        json={
            "status": "verified",
        },
    )
    assert res_patch.status_code == 403

    print("  -> Student self-verification prevention passed.")


def _test_role_and_auth_enforcement(project_id: int, evidence_id: int):
    print("[3/8] Testing RBAC and unauthenticated requests...")
    student2_token = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    recruiter_token = get_token(RECRUITER_EMAIL, UserRole.RECRUTER if hasattr(UserRole, "RECRUTER") else UserRole.RECRUITER)

    # 1. Unauthenticated request -> 401
    res_no_auth = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        json={"status": "verified"},
    )
    assert res_no_auth.status_code == 401

    # 2. Other student cannot verify -> 403
    res_s2 = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers={"Authorization": f"Bearer {student2_token}"},
        json={"status": "verified"},
    )
    assert res_s2.status_code == 403

    # 3. Recruiter cannot verify -> 403
    res_rec = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers={"Authorization": f"Bearer {recruiter_token}"},
        json={"status": "verified"},
    )
    assert res_rec.status_code == 403

    print("  -> RBAC and auth enforcement passed.")


def _test_validation_rules(project_id: int, evidence_id: int):
    print("[4/8] Testing input validation rules...")
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Invalid status string -> 422
    res_bad_status = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers=admin_headers,
        json={"status": "invalid_status_value"},
    )
    assert res_bad_status.status_code == 422

    # Notes exceeding max length (e.g. > 2000 characters) -> 422
    res_long_notes = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
        headers=admin_headers,
        json={"status": "verified", "notes": "A" * 2005},
    )
    assert res_long_notes.status_code == 422

    print("  -> Input validation rules passed.")


def _test_relationship_and_not_found(project_id: int, evidence_id: int):
    print("[5/8] Testing relationship integrity and 404 responses...")
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Nonexistent project ID -> 404
    res_no_proj = client.post(
        f"/api/v1/innovation-projects/999999/evidence/{evidence_id}/verification",
        headers=admin_headers,
        json={"status": "verified"},
    )
    assert res_no_proj.status_code == 404

    # 2. Nonexistent evidence ID -> 404
    res_no_ev = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence/999999/verification",
        headers=admin_headers,
        json={"status": "verified"},
    )
    assert res_no_ev.status_code == 404

    # 3. Evidence belonging to another project -> 404
    student1_token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    other_proj_res = client.post(
        "/api/v1/innovation-projects",
        headers={"Authorization": f"Bearer {student1_token}"},
        json={
            "title": "Another Project",
            "description": "Second project for mismatched check",
            "project_type": "software",
            "visibility": "public",
        },
    )
    assert other_proj_res.status_code == 201
    other_proj_id = other_proj_res.json()["id"]

    res_mismatch = client.post(
        f"/api/v1/innovation-projects/{other_proj_id}/evidence/{evidence_id}/verification",
        headers=admin_headers,
        json={"status": "verified"},
    )
    assert res_mismatch.status_code == 404

    print("  -> Relationship integrity and 404 responses passed.")


def _test_privacy_shield_private_projects():
    print("[6/8] Testing private project verification privacy shielding...")
    student1_token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    student2_token = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    recruiter_token = get_token(RECRUITER_EMAIL, UserRole.RECRUITER)
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)

    # Create private project and evidence
    p_res = client.post(
        "/api/v1/innovation-projects",
        headers={"Authorization": f"Bearer {student1_token}"},
        json={
            "title": "Proprietary AI Hardware",
            "description": "Private hardware specs",
            "project_type": "hardware",
            "visibility": "private",
        },
    )
    assert p_res.status_code == 201
    priv_p_id = p_res.json()["id"]

    ev_res = client.post(
        f"/api/v1/innovation-projects/{priv_p_id}/evidence",
        headers={"Authorization": f"Bearer {student1_token}"},
        json={
            "title": "Private Gerber Files",
            "evidence_type": "document",
            "url": "https://secure.example.com/gerber.zip",
        },
    )
    assert ev_res.status_code == 201
    priv_ev_id = ev_res.json()["id"]

    # Admin verifies the private evidence
    v_res = client.post(
        f"/api/v1/innovation-projects/{priv_p_id}/evidence/{priv_ev_id}/verification",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "verified", "notes": "Approved for private innovation portfolio."},
    )
    assert v_res.status_code == 200

    # Owner can view verification -> 200
    owner_get = client.get(
        f"/api/v1/innovation-projects/{priv_p_id}/evidence/{priv_ev_id}/verification",
        headers={"Authorization": f"Bearer {student1_token}"},
    )
    assert owner_get.status_code == 200
    assert owner_get.json()["status"] == "verified"

    # Admin can view verification -> 200
    admin_get = client.get(
        f"/api/v1/innovation-projects/{priv_p_id}/evidence/{priv_ev_id}/verification",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_get.status_code == 200

    # Unauthorized student receives 404 (no leak)
    assert client.get(
        f"/api/v1/innovation-projects/{priv_p_id}/evidence/{priv_ev_id}/verification",
        headers={"Authorization": f"Bearer {student2_token}"},
    ).status_code == 404

    # Recruiter receives 404 (no leak)
    assert client.get(
        f"/api/v1/innovation-projects/{priv_p_id}/evidence/{priv_ev_id}/verification",
        headers={"Authorization": f"Bearer {recruiter_token}"},
    ).status_code == 404

    # Anonymous receives 401 Unauthorized (unauthenticated)
    assert client.get(
        f"/api/v1/innovation-projects/{priv_p_id}/evidence/{priv_ev_id}/verification",
    ).status_code == 401

    print("  -> Private project verification privacy shielding passed.")


def _test_duplicate_prevention_and_upsert(project_id: int, evidence_id: int):
    print("[7/8] Testing 1-to-1 verification constraint and single record count...")
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Call POST multiple times on same evidence
    for status in ["pending", "verified", "rejected", "verified"]:
        res = client.post(
            f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}/verification",
            headers=admin_headers,
            json={"status": status, "notes": f"Note for {status}"},
        )
        assert res.status_code == 200

    # Verify DB has exactly 1 verification record for this evidence_id
    with SessionLocal() as db:
        records = db.scalars(
            select(EvidenceVerification).where(EvidenceVerification.evidence_id == evidence_id)
        ).all()
        assert len(records) == 1
        assert records[0].status == EvidenceVerificationStatus.VERIFIED

    print("  -> Duplicate prevention and upsert passed.")


def _test_cascade_deletion():
    print("[8/8] Testing cascade deletion on evidence removal...")
    student_token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)
    student_headers = {"Authorization": f"Bearer {student_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create project and evidence
    p_res = client.post(
        "/api/v1/innovation-projects",
        headers=student_headers,
        json={
            "title": "Cascade Verification Project",
            "description": "Testing cascade on verification",
            "project_type": "software",
            "visibility": "public",
        },
    )
    assert p_res.status_code == 201
    p_id = p_res.json()["id"]

    ev_res = client.post(
        f"/api/v1/innovation-projects/{p_id}/evidence",
        headers=student_headers,
        json={
            "title": "Cascade Evidence",
            "evidence_type": "link",
            "url": "https://example.com/cascade-doc",
        },
    )
    assert ev_res.status_code == 201
    ev_id = ev_res.json()["id"]

    # Verify evidence
    v_res = client.post(
        f"/api/v1/innovation-projects/{p_id}/evidence/{ev_id}/verification",
        headers=admin_headers,
        json={"status": "verified"},
    )
    assert v_res.status_code == 200
    v_id = v_res.json()["id"]

    # Delete evidence directly
    del_res = client.delete(
        f"/api/v1/innovation-projects/{p_id}/evidence/{ev_id}",
        headers=student_headers,
    )
    assert del_res.status_code == 204

    # Check verification record was deleted
    with SessionLocal() as db:
        rec = db.scalar(select(EvidenceVerification).where(EvidenceVerification.id == v_id))
        assert rec is None

    print("  -> Cascade deletion passed.")


def test_project_evidence_verification_workflow():
    print("\n=========================================================")
    print("STARTING MILESTONE R6 PROJECT EVIDENCE VERIFICATION TESTS...")
    print("=========================================================\n")
    cleanup_test_data()
    try:
        project_id, evidence_id = setup_fixture()
        _test_admin_verification_lifecycle(project_id, evidence_id)
        _test_self_verification_prevention(project_id, evidence_id)
        _test_role_and_auth_enforcement(project_id, evidence_id)
        _test_validation_rules(project_id, evidence_id)
        _test_relationship_and_not_found(project_id, evidence_id)
        _test_privacy_shield_private_projects()
        _test_duplicate_prevention_and_upsert(project_id, evidence_id)
        _test_cascade_deletion()

        print("\n=========================================================")
        print("ALL MILESTONE R6 VERIFICATION TESTS PASSED SUCCESSFULLY!")
        print("=========================================================\n")
    finally:
        cleanup_test_data()


if __name__ == "__main__":
    test_project_evidence_verification_workflow()
