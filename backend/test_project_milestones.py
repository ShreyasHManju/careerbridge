"""
CareerBridge Milestone 2.0-C — Project Execution & Milestones Test Suite
Comprehensive coverage for:
1. Milestone creation under owned InnovationProject.
2. Ownership enforcement: only project owner can create, update, or delete milestones.
3. Mismatched project/milestone ID protection.
4. Input validation (title length, status, display_order >= 0, past and future due dates).
5. Completed_at status transition business logic (todo -> in_progress -> completed -> todo/in_progress).
6. Milestone listing and project progress calculation (total, completed, progress_percentage).
7. Privacy and visibility inheritance from parent project.
8. Cascade deletion when parent project is deleted.
"""

from datetime import datetime, timezone, timedelta
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
from app.models.project_milestone import MilestoneStatus, ProjectMilestone
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "milestone.student1@careerbridge.io"
STUDENT2_EMAIL = "milestone.student2@careerbridge.io"
RECRUITER_EMAIL = "milestone.recruiter@careerbridge.io"
ADMIN_EMAIL = "milestone.admin@careerbridge.io"
TEST_PASSWORD = "MilestoneTestPassword123!"


def cleanup_test_data():
    """Remove test users, profiles, projects, and milestones."""
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
            # Delete innovation projects (cascades project_milestones and project_skills)
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
                    full_name="Milestone Student",
                    college="Engineering Institute",
                )
                db.add(profile)
                db.commit()

        return create_access_token(subject=user.id)


def test_milestone_creation_and_validation():
    print("[1/8] Testing milestone creation and input validation...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Create parent project
    proj_res = client.post(
        "/api/v1/innovation-projects",
        headers=headers1,
        json={
            "title": "Autonomous Drone Navigator",
            "description": "A high-performance autonomous drone path planning system.",
            "project_type": "software",
            "visibility": "public",
        },
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 1. Successful milestone creation
    due_date_str = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    ms_res = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={
            "title": "Design System Architecture",
            "description": "Produce ROS2 node diagrams and simulation setup.",
            "status": "todo",
            "display_order": 1,
            "due_date": due_date_str,
        },
    )
    assert ms_res.status_code == 201
    ms_data = ms_res.json()
    assert ms_data["title"] == "Design System Architecture"
    assert ms_data["status"] == "todo"
    assert ms_data["display_order"] == 1
    assert ms_data["completed_at"] is None
    milestone1_id = ms_data["id"]

    # 2. Past due date is valid (project history)
    past_date_str = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    past_res = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={
            "title": "Initial Feasibility Study",
            "description": "Reviewed existing drone simulation libraries.",
            "status": "completed",
            "display_order": 0,
            "due_date": past_date_str,
        },
    )
    assert past_res.status_code == 201
    assert past_res.json()["completed_at"] is not None

    # 3. Validation: missing title
    bad_res1 = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={"description": "Missing title"},
    )
    assert bad_res1.status_code == 422

    # 4. Validation: title too short (< 2 chars)
    bad_res2 = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={"title": "A"},
    )
    assert bad_res2.status_code == 422

    # 5. Validation: invalid status
    bad_res3 = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={"title": "Invalid Status", "status": "unknown_status"},
    )
    assert bad_res3.status_code == 422

    # 6. Validation: negative display_order
    bad_res4 = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={"title": "Negative Order", "display_order": -1},
    )
    assert bad_res4.status_code == 422

    print("  -> Milestone creation and validation passed.")
    return project_id, milestone1_id


def test_ownership_and_authorization(project_id: int, milestone_id: int):
    print("[2/8] Testing ownership enforcement and cross-student authorization...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    token2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Student 2 cannot create milestone on Student 1's project
    res_create = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers2,
        json={"title": "Unauthorized Milestone"},
    )
    assert res_create.status_code == 403

    # Student 2 cannot update Student 1's milestone
    res_update = client.patch(
        f"/api/v1/innovation-projects/{project_id}/milestones/{milestone_id}",
        headers=headers2,
        json={"title": "Hacked Title"},
    )
    assert res_update.status_code == 403

    # Student 2 cannot delete Student 1's milestone
    res_del = client.delete(
        f"/api/v1/innovation-projects/{project_id}/milestones/{milestone_id}",
        headers=headers2,
    )
    assert res_del.status_code == 403

    # Student 2 creates own project
    res_p2 = client.post(
        "/api/v1/innovation-projects",
        headers=headers2,
        json={
            "title": "Student 2 Private Project",
            "description": "Student 2 proprietary hardware prototype.",
            "visibility": "private",
        },
    )
    assert res_p2.status_code == 201
    p2_id = res_p2.json()["id"]

    # Mismatched IDs Case 1: Student 1 attempts to update a milestone under Student 2's project (Student 1 doesn't own p2_id -> 403)
    res_mismatch1 = client.patch(
        f"/api/v1/innovation-projects/{p2_id}/milestones/{milestone_id}",
        headers=headers1,
        json={"title": "Unauthorized Mismatch"},
    )
    assert res_mismatch1.status_code == 403

    # Mismatched IDs Case 2: Student 2 (owner of p2_id) attempts to update milestone1_id (which belongs to project_id, not p2_id -> 404)
    res_mismatch2 = client.patch(
        f"/api/v1/innovation-projects/{p2_id}/milestones/{milestone_id}",
        headers=headers2,
        json={"title": "Cross Project Hijack"},
    )
    assert res_mismatch2.status_code == 404

    # Mismatched IDs Case 3: Student 2 attempts to delete milestone1_id under p2_id -> 404
    res_mismatch3 = client.delete(
        f"/api/v1/innovation-projects/{p2_id}/milestones/{milestone_id}",
        headers=headers2,
    )
    assert res_mismatch3.status_code == 404

    print("  -> Ownership and authorization passed.")
    return p2_id


def test_completed_at_status_transitions(project_id: int, milestone_id: int):
    print("[3/8] Testing completed_at status transition business rules...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # 1. todo -> in_progress (completed_at remains None)
    res1 = client.patch(
        f"/api/v1/innovation-projects/{project_id}/milestones/{milestone_id}",
        headers=headers1,
        json={"status": "in_progress"},
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "in_progress"
    assert res1.json()["completed_at"] is None

    # 2. in_progress -> completed (sets completed_at to current timestamp)
    res2 = client.patch(
        f"/api/v1/innovation-projects/{project_id}/milestones/{milestone_id}",
        headers=headers1,
        json={"status": "completed"},
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "completed"
    completed_at_ts = res2.json()["completed_at"]
    assert completed_at_ts is not None

    # 3. completed -> completed with other updates (preserves completed_at)
    res3 = client.patch(
        f"/api/v1/innovation-projects/{project_id}/milestones/{milestone_id}",
        headers=headers1,
        json={"description": "Updated deliverables description."},
    )
    assert res3.status_code == 200
    assert res3.json()["status"] == "completed"
    assert res3.json()["completed_at"] == completed_at_ts

    # 4. completed -> in_progress (clears completed_at to None)
    res4 = client.patch(
        f"/api/v1/innovation-projects/{project_id}/milestones/{milestone_id}",
        headers=headers1,
        json={"status": "in_progress"},
    )
    assert res4.status_code == 200
    assert res4.json()["status"] == "in_progress"
    assert res4.json()["completed_at"] is None

    # 5. in_progress -> todo (completed_at remains None)
    res5 = client.patch(
        f"/api/v1/innovation-projects/{project_id}/milestones/{milestone_id}",
        headers=headers1,
        json={"status": "todo"},
    )
    assert res5.status_code == 200
    assert res5.json()["status"] == "todo"
    assert res5.json()["completed_at"] is None

    # 6. todo -> completed (sets completed_at)
    res6 = client.patch(
        f"/api/v1/innovation-projects/{project_id}/milestones/{milestone_id}",
        headers=headers1,
        json={"status": "completed"},
    )
    assert res6.status_code == 200
    assert res6.json()["completed_at"] is not None

    print("  -> Status transition business rules passed.")


def test_progress_calculation(project_id: int):
    print("[4/8] Testing project execution progress calculation...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Add 2 more milestones:
    # Current: 2 milestones (both completed from previous steps) -> 100%
    # Add milestone 3 (todo) and milestone 4 (in_progress)
    client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={"title": "Milestone 3", "status": "todo", "display_order": 2},
    )
    client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={"title": "Milestone 4", "status": "in_progress", "display_order": 3},
    )

    # List milestones: total = 4, completed = 2 -> progress = 50%
    list_res = client.get(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
    )
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["total"] == 4
    assert data["completed"] == 2
    assert data["progress_percentage"] == 50
    assert len(data["items"]) == 4

    # Verify project detail response also includes progress metrics
    proj_res = client.get(
        f"/api/v1/innovation-projects/{project_id}",
        headers=headers1,
    )
    assert proj_res.status_code == 200
    p_data = proj_res.json()
    assert p_data["total_milestones"] == 4
    assert p_data["completed_milestones"] == 2
    assert p_data["progress_percentage"] == 50
    assert len(p_data["milestones"]) == 4

    print("  -> Progress calculation passed.")


def test_privacy_and_visibility_guards(p2_id: int):
    print("[5/8] Testing milestone privacy and visibility inheritance...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    token2 = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    admin_token = get_token(ADMIN_EMAIL, UserRole.ADMIN)

    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Student 2 adds a milestone to their private project p2_id
    res_m = client.post(
        f"/api/v1/innovation-projects/{p2_id}/milestones",
        headers=headers2,
        json={"title": "Confidential Hardware Spec", "status": "todo"},
    )
    assert res_m.status_code == 201

    # Student 2 (owner) can list milestones for private project
    res_owner = client.get(
        f"/api/v1/innovation-projects/{p2_id}/milestones",
        headers=headers2,
    )
    assert res_owner.status_code == 200
    assert res_owner.json()["total"] == 1

    # Student 1 (non-owner) receives 404 when listing milestones of private project
    res_non_owner = client.get(
        f"/api/v1/innovation-projects/{p2_id}/milestones",
        headers=headers1,
    )
    assert res_non_owner.status_code == 404

    # Admin can view milestones of private project
    res_admin = client.get(
        f"/api/v1/innovation-projects/{p2_id}/milestones",
        headers=headers_admin,
    )
    assert res_admin.status_code == 200

    print("  -> Milestone privacy guards passed.")


def test_milestone_deletion(project_id: int):
    print("[6/8] Testing single milestone deletion...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Create a temporary milestone to delete
    res_c = client.post(
        f"/api/v1/innovation-projects/{project_id}/milestones",
        headers=headers1,
        json={"title": "Temporary Milestone to Delete"},
    )
    assert res_c.status_code == 201
    temp_id = res_c.json()["id"]

    # Delete milestone
    res_d = client.delete(
        f"/api/v1/innovation-projects/{project_id}/milestones/{temp_id}",
        headers=headers1,
    )
    assert res_d.status_code == 204

    # Confirm deletion from database
    with SessionLocal() as db:
        m = db.scalar(select(ProjectMilestone).where(ProjectMilestone.id == temp_id))
        assert m is None

    print("  -> Single milestone deletion passed.")


def test_project_deletion_cascades_milestones():
    print("[7/8] Testing parent project deletion cascades milestone rows...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Create dedicated project with 2 milestones
    p_res = client.post(
        "/api/v1/innovation-projects",
        headers=headers1,
        json={
            "title": "Cascade Test Project",
            "description": "Project designed to verify milestone cascade cleanup.",
            "visibility": "public",
        },
    )
    assert p_res.status_code == 201
    cascade_p_id = p_res.json()["id"]

    m1 = client.post(
        f"/api/v1/innovation-projects/{cascade_p_id}/milestones",
        headers=headers1,
        json={"title": "Cascade Milestone 1"},
    )
    assert m1.status_code == 201
    m1_id = m1.json()["id"]

    m2 = client.post(
        f"/api/v1/innovation-projects/{cascade_p_id}/milestones",
        headers=headers1,
        json={"title": "Cascade Milestone 2"},
    )
    assert m2.status_code == 201
    m2_id = m2.json()["id"]

    # Delete parent project
    del_p = client.delete(
        f"/api/v1/innovation-projects/{cascade_p_id}",
        headers=headers1,
    )
    assert del_p.status_code == 204

    # Verify milestones are cascaded
    with SessionLocal() as db:
        ms = db.scalars(
            select(ProjectMilestone).where(ProjectMilestone.id.in_([m1_id, m2_id]))
        ).all()
        assert len(ms) == 0

    print("  -> Parent project cascade cleanup passed.")


def test_zero_milestones_progress():
    print("[8/8] Testing progress calculation when project has 0 milestones...")
    token1 = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers1 = {"Authorization": f"Bearer {token1}"}

    p_res = client.post(
        "/api/v1/innovation-projects",
        headers=headers1,
        json={
            "title": "Zero Milestones Project",
            "description": "Project with no milestones defined yet.",
            "visibility": "public",
        },
    )
    assert p_res.status_code == 201
    zero_p_id = p_res.json()["id"]

    list_res = client.get(
        f"/api/v1/innovation-projects/{zero_p_id}/milestones",
        headers=headers1,
    )
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 0
    assert list_res.json()["completed"] == 0
    assert list_res.json()["progress_percentage"] == 0

    print("  -> Zero milestone progress calculation passed.")


def run_all_tests():
    print("\n=========================================================")
    print("STARTING MILESTONE 2.0-C PROJECT MILESTONES TEST SUITE...")
    print("=========================================================\n")
    cleanup_test_data()
    try:
        project_id, milestone1_id = test_milestone_creation_and_validation()
        p2_id = test_ownership_and_authorization(project_id, milestone1_id)
        test_completed_at_status_transitions(project_id, milestone1_id)
        test_progress_calculation(project_id)
        test_privacy_and_visibility_guards(p2_id)
        test_milestone_deletion(project_id)
        test_project_deletion_cascades_milestones()
        test_zero_milestones_progress()

        print("\n=========================================================")
        print("ALL 2.0-C PROJECT MILESTONES TESTS PASSED SUCCESSFULLY!")
        print("=========================================================\n")
    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_all_tests()
