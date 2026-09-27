"""
CareerBridge Milestone R5 — Project Evidence Test Suite
Comprehensive coverage for:
1. Evidence creation attached directly to an owned InnovationProject.
2. Evidence creation attached to a specific ProjectMilestone under the project.
3. Mismatched milestone ID rejection (milestone belonging to another project -> 400 Bad Request).
4. Ownership enforcement (unauthorized student cannot add/update/delete evidence -> 403 Forbidden).
5. Role-based access control (non-student cannot create/update/delete evidence -> 403 Forbidden).
6. Visibility & privacy shielding (private project evidence is hidden from unauthorized users -> 404 Not Found).
7. Evidence listing and optional milestone filtering.
8. Evidence update (PATCH) and deletion (DELETE).
9. Schema validation (title sanitization, URL format requirements -> 422 Unprocessable Entity).
10. Parent project deletion cascades project_evidence rows.
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
    ProjectStatus,
    ProjectType,
    ProjectVisibility,
)
from app.models.project_evidence import EvidenceType, ProjectEvidence
from app.models.project_milestone import MilestoneStatus, ProjectMilestone
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "evidence.student1@careerbridge.io"
STUDENT2_EMAIL = "evidence.student2@careerbridge.io"
RECRUITER_EMAIL = "evidence.recruiter@careerbridge.io"
ADMIN_EMAIL = "evidence.admin@careerbridge.io"
TEST_PASSWORD = "EvidenceTestPassword123!"


def cleanup_test_data():
    """Remove test users, profiles, projects, milestones, and evidence."""
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
            # Delete innovation projects (cascades milestones and evidence)
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
                    full_name="Evidence Test Student",
                    college="Institute of Technology",
                )
                db.add(profile)
                db.commit()

        return create_access_token(subject=user.id)


def test_create_project_evidence_success():
    print("[1/9] Testing project evidence creation and responses...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Create project
    proj_res = client.post(
        "/api/v1/innovation-projects",
        headers=headers1,
        json={
            "title": "Autonomous AI Agent Suite",
            "description": "Full stack agent orchestration framework with telemetry.",
            "project_type": "software",
            "visibility": "public",
        },
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # Attach evidence
    payload = {
        "title": "GitHub Core Repository",
        "description": "Production TypeScript & Python codebase with CI tests",
        "evidence_type": "repository",
        "url": "https://github.com/example/ai-agent-suite",
    }
    res = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        json=payload,
        headers=headers1,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == payload["title"]
    assert data["evidence_type"] == "repository"
    assert data["url"] == payload["url"]
    assert data["innovation_project_id"] == project_id
    assert data["milestone_id"] is None
    assert "id" in data
    evidence_id = data["id"]

    print("  -> Evidence creation passed.")
    return project_id, evidence_id


def test_create_evidence_attached_to_milestone(project_id: int):
    print("[2/9] Testing evidence attached to project milestone...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Create a milestone
    ms_res = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={
            "title": "PCB Architecture Prototype",
            "status": "completed",
            "display_order": 1,
        },
    )
    assert ms_res.status_code == 201
    milestone_id = ms_res.json()["id"]

    # Attach evidence to milestone
    payload = {
        "title": "Hardware Circuit Schematics & Gerber Files",
        "description": "Schematic diagrams and bill of materials",
        "evidence_type": "document",
        "url": "https://example.com/schematics-v1.pdf",
        "milestone_id": milestone_id,
    }
    res = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        json=payload,
        headers=headers1,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["milestone_id"] == milestone_id
    assert data["evidence_type"] == "document"
    ms_evidence_id = data["id"]

    print("  -> Milestone-linked evidence creation passed.")
    return milestone_id, ms_evidence_id


def test_mismatched_milestone_rejection(project_id: int):
    print("[3/9] Testing mismatched milestone rejection...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Create second project with its own milestone
    p2_res = client.post(
        "/api/v1/innovation-projects",
        headers=headers1,
        json={
            "title": "Second Project",
            "description": "Second test project",
            "project_type": "software",
            "visibility": "public",
        },
    )
    assert p2_res.status_code == 201
    p2_id = p2_res.json()["id"]

    ms2_res = client.post(
        f"/api/v1/innovation-projects/{p2_id}/milestones",
        headers=headers1,
        json={"title": "Project 2 Milestone", "status": "todo"},
    )
    assert ms2_res.status_code == 201
    p2_milestone_id = ms2_res.json()["id"]

    # Attempt to attach p2_milestone_id to project_id (Project 1)
    payload = {
        "title": "Mismatched Evidence",
        "evidence_type": "link",
        "url": "https://example.com/test",
        "milestone_id": p2_milestone_id,
    }
    res = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        json=payload,
        headers=headers1,
    )
    assert res.status_code == 400
    assert "does not belong to this project" in res.json()["detail"]

    print("  -> Mismatched milestone rejection passed.")


def test_ownership_and_role_enforcement(project_id: int, evidence_id: int):
    print("[4/9] Testing ownership enforcement and RBAC...")
    token2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    recruiter_token = get_token(RECRUITER_EMAIL, UserRole.RECRUITER)
    headers2 = {"Authorization": f"Bearer {token2}"}
    headers_rec = {"Authorization": f"Bearer {recruiter_token}"}

    payload = {
        "title": "Unauthorized Artifact",
        "evidence_type": "demo",
        "url": "https://demo.example.com",
    }

    # Student 2 cannot create evidence on Student 1's project -> 403
    res_s2 = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        json=payload,
        headers=headers2,
    )
    assert res_s2.status_code == 403

    # Recruiter cannot create evidence -> 403
    res_rec = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        json=payload,
        headers=headers_rec,
    )
    assert res_rec.status_code == 403

    # Student 2 cannot update Student 1's evidence -> 403
    res_s2_up = client.patch(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}",
        json={"title": "Hacked Title"},
        headers=headers2,
    )
    assert res_s2_up.status_code == 403

    # Student 2 cannot delete Student 1's evidence -> 403
    res_s2_del = client.delete(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}",
        headers=headers2,
    )
    assert res_s2_del.status_code == 403

    print("  -> Ownership and RBAC enforcement passed.")


def test_list_and_filter_evidence(project_id: int, milestone_id: int):
    print("[5/9] Testing evidence listing and milestone filtering...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # List all evidence for project
    res_all = client.get(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        headers=headers1,
    )
    assert res_all.status_code == 200
    all_data = res_all.json()
    assert all_data["project_id"] == project_id
    assert all_data["total_count"] >= 2
    assert len(all_data["items"]) >= 2

    # Filter by milestone
    res_filtered = client.get(
        f"/api/v1/innovation-projects/{project_id}/evidence?milestone_id={milestone_id}",
        headers=headers1,
    )
    assert res_filtered.status_code == 200
    f_data = res_filtered.json()
    assert f_data["total_count"] == 1
    assert f_data["items"][0]["milestone_id"] == milestone_id

    print("  -> Evidence listing and filtering passed.")


def test_privacy_and_visibility_guards():
    print("[6/9] Testing private project evidence privacy guards...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    token2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    recruiter_token = get_token(RECRUITER_EMAIL, UserRole.RECRUITER)
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)

    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    headers_rec = {"Authorization": f"Bearer {recruiter_token}"}
    headers_adm = {"Authorization": f"Bearer {admin_token}"}

    # Student 1 creates private project
    p_res = client.post(
        "/api/v1/innovation-projects",
        headers=headers1,
        json={
            "title": "Stealth DeepTech Project",
            "description": "Confidential R&D project",
            "project_type": "software",
            "visibility": "private",
        },
    )
    assert p_res.status_code == 201
    private_p_id = p_res.json()["id"]

    # Student 1 adds evidence
    ev_res = client.post(
        f"/api/v1/innovation-projects/{private_p_id}/evidence",
        headers=headers1,
        json={
            "title": "Confidential Whitepaper",
            "evidence_type": "document",
            "url": "https://secure.example.com/whitepaper.pdf",
        },
    )
    assert ev_res.status_code == 201
    ev_id = ev_res.json()["id"]

    # Owner can access list & detail -> 200
    assert client.get(f"/api/v1/innovation-projects/{private_p_id}/evidence", headers=headers1).status_code == 200
    assert client.get(f"/api/v1/innovation-projects/{private_p_id}/evidence/{ev_id}", headers=headers1).status_code == 200

    # Admin can access list & detail -> 200
    assert client.get(f"/api/v1/innovation-projects/{private_p_id}/evidence", headers=headers_adm).status_code == 200
    assert client.get(f"/api/v1/innovation-projects/{private_p_id}/evidence/{ev_id}", headers=headers_adm).status_code == 200

    # Other student receives 404 (privacy shield)
    assert client.get(f"/api/v1/innovation-projects/{private_p_id}/evidence", headers=headers2).status_code == 404
    assert client.get(f"/api/v1/innovation-projects/{private_p_id}/evidence/{ev_id}", headers=headers2).status_code == 404

    # Recruiter receives 404
    assert client.get(f"/api/v1/innovation-projects/{private_p_id}/evidence", headers=headers_rec).status_code == 404
    assert client.get(f"/api/v1/innovation-projects/{private_p_id}/evidence/{ev_id}", headers=headers_rec).status_code == 404

    print("  -> Private project evidence visibility guards passed.")


def test_update_and_delete_evidence(project_id: int, evidence_id: int):
    print("[7/9] Testing evidence update and deletion...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Update evidence
    res_up = client.patch(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}",
        headers=headers1,
        json={
            "title": "Updated GitHub Core Monorepo",
            "url": "https://github.com/example/ai-agent-suite-monorepo",
            "evidence_type": "repository",
        },
    )
    assert res_up.status_code == 200
    up_data = res_up.json()
    assert up_data["title"] == "Updated GitHub Core Monorepo"
    assert up_data["url"] == "https://github.com/example/ai-agent-suite-monorepo"

    # Delete evidence
    res_del = client.delete(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}",
        headers=headers1,
    )
    assert res_del.status_code == 204

    # Confirm 404 on get
    res_get = client.get(
        f"/api/v1/innovation-projects/{project_id}/evidence/{evidence_id}",
        headers=headers1,
    )
    assert res_get.status_code == 404

    print("  -> Evidence update and deletion passed.")


def test_validation_rules(project_id: int):
    print("[8/9] Testing evidence input validation rules...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Blank title -> 422
    res_empty = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        headers=headers1,
        json={"title": "   ", "url": "https://example.com/test", "evidence_type": "link"},
    )
    assert res_empty.status_code == 422

    # Malformed URL without URI scheme -> 422
    res_bad_url = client.post(
        f"/api/v1/innovation-projects/{project_id}/evidence",
        headers=headers1,
        json={"title": "Test Title", "url": "not-a-valid-scheme", "evidence_type": "link"},
    )
    assert res_bad_url.status_code == 422

    print("  -> Input validation rules passed.")


def test_cascade_deletion():
    print("[9/9] Testing parent project deletion cascades evidence...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Create ephemeral project with evidence
    p_res = client.post(
        "/api/v1/innovation-projects",
        headers=headers1,
        json={
            "title": "Ephemeral Cascade Project",
            "description": "Testing evidence cascade deletion",
            "project_type": "software",
            "visibility": "public",
        },
    )
    assert p_res.status_code == 201
    eph_id = p_res.json()["id"]

    ev_res = client.post(
        f"/api/v1/innovation-projects/{eph_id}/evidence",
        headers=headers1,
        json={
            "title": "Ephemeral Evidence Artifact",
            "evidence_type": "link",
            "url": "https://example.com/ephemeral",
        },
    )
    assert ev_res.status_code == 201
    ev_id = ev_res.json()["id"]

    # Delete project
    del_res = client.delete(
        f"/api/v1/innovation-projects/{eph_id}",
        headers=headers1,
    )
    assert del_res.status_code == 204

    # Verify evidence deleted from DB
    with SessionLocal() as db:
        ev = db.scalar(select(ProjectEvidence).where(ProjectEvidence.id == ev_id))
        assert ev is None

    print("  -> Cascade deletion passed.")


def run_all_tests():
    print("\n=========================================================")
    print("STARTING MILESTONE R5 PROJECT EVIDENCE TEST SUITE...")
    print("=========================================================\n")
    cleanup_test_data()
    try:
        project_id, evidence_id = test_create_project_evidence_success()
        milestone_id, ms_evidence_id = test_create_evidence_attached_to_milestone(project_id)
        test_mismatched_milestone_rejection(project_id)
        test_ownership_and_role_enforcement(project_id, evidence_id)
        test_list_and_filter_evidence(project_id, milestone_id)
        test_privacy_and_visibility_guards()
        test_update_and_delete_evidence(project_id, evidence_id)
        test_validation_rules(project_id)
        test_cascade_deletion()

        print("\n=========================================================")
        print("ALL MILESTONE R5 PROJECT EVIDENCE TESTS PASSED SUCCESSFULLY!")
        print("=========================================================\n")
    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_all_tests()
