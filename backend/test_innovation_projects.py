"""
CareerBridge Milestone 2.0-B — Innovation Projects Test Suite
Comprehensive coverage for:
1. Creation by authenticated student with structured skills and URL validation.
2. Ownership protection: students cannot edit/delete another student's projects.
3. RBAC isolation: non-students cannot create or edit projects.
4. Visibility guards: private projects are strictly hidden from non-owners.
5. Student project listing (/my) with all visibility and status variants.
6. Public project discovery (/innovation-projects) with filtering, pagination, search.
7. Structured skills synchronization and canonical reuse.
8. Deletion and cascading join-row cleanup.
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
    ProjectSkill,
    ProjectStatus,
    ProjectType,
    ProjectVisibility,
)
from app.models.skill import Skill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "project.student1@careerbridge.io"
STUDENT2_EMAIL = "project.student2@careerbridge.io"
RECRUITER_EMAIL = "project.recruiter@careerbridge.io"
ADMIN_EMAIL = "project.admin@careerbridge.io"
TEST_PASSWORD = "ProjectTestPassword123!"


def cleanup_test_data():
    """Remove test users, profiles, projects, and test skills."""
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
            # Delete innovation projects (cascades project_skills)
            db.execute(delete(InnovationProject).where(InnovationProject.student_id.in_(user_ids)))
            # Delete student profiles
            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            # Delete users
            db.execute(delete(User).where(User.id.in_(user_ids)))

        test_slugs = [
            "ai-drone-navigation",
            "autonomous-rover",
            "quantum-circuit-simulator",
            "test-python",
            "test-react",
            "test-robotics",
            "test-pytorch",
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

            if role == UserRole.STUDENT:
                profile = StudentProfile(
                    user_id=user.id,
                    full_name="Project Student",
                    college="Engineering Institute",
                )
                db.add(profile)
                db.commit()

        return create_access_token(subject=user.id)


def test_project_creation_and_validation():
    print("[1/8] Testing project creation, validation, and structured skills attachment...")
    token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Valid Creation
    payload = {
        "title": "Autonomous Rover Navigation",
        "short_description": "Edge-computing autonomous path planner.",
        "description": "An end-to-end edge-computing navigation system built with ROS2 and PyTorch.",
        "project_type": "software",
        "status": "active",
        "visibility": "public",
        "skills": "Test-Python, Test-Robotics, Test-PyTorch",
        "repository_url": "https://github.com/student/autonomous-rover",
        "live_demo_url": "https://rover-demo.careerbridge.io",
    }
    res = client.post("/api/v1/innovation-projects", json=payload, headers=headers)
    assert res.status_code in (200, 201), res.text
    data = res.json()
    project_id = data["id"]

    assert data["title"] == "Autonomous Rover Navigation"
    assert data["slug"] == "autonomous-rover-navigation"
    assert data["project_type"] == "software"
    assert data["status"] == "active"
    assert data["visibility"] == "public"
    assert data["skills"] == "Test-Python, Test-Robotics, Test-PyTorch"
    assert len(data["structured_skills"]) == 3
    struct_slugs = [s["slug"] for s in data["structured_skills"]]
    assert "test-python" in struct_slugs
    assert "test-robotics" in struct_slugs
    assert "test-pytorch" in struct_slugs
    assert data["repository_url"] == "https://github.com/student/autonomous-rover"
    assert data["live_demo_url"] == "https://rover-demo.careerbridge.io"

    # 2. Validation: invalid title length (min 2 chars)
    bad_title = payload.copy()
    bad_title["title"] = "A"
    res_bad = client.post("/api/v1/innovation-projects", json=bad_title, headers=headers)
    assert res_bad.status_code == 422

    # 3. Validation: invalid URL format
    bad_url = payload.copy()
    bad_url["repository_url"] = "not-a-valid-url"
    res_bad_url = client.post("/api/v1/innovation-projects", json=bad_url, headers=headers)
    assert res_bad_url.status_code == 422

    # 4. Validation: invalid project_type
    bad_type = payload.copy()
    bad_type["project_type"] = "unsupported_type"
    res_bad_type = client.post("/api/v1/innovation-projects", json=bad_type, headers=headers)
    assert res_bad_type.status_code == 422

    print("  -> Project creation and schema validation verified.")
    return project_id


def test_rbac_and_unauthorized_creation():
    print("[2/8] Testing RBAC access controls on project creation...")
    recruiter_token = get_token(RECRUITER_EMAIL, UserRole.RECRUITER)

    # Recruiter attempting to create an innovation project
    payload = {
        "title": "Recruiter Fake Project",
        "description": "Recruiter trying to publish an innovation project.",
        "project_type": "software",
    }
    res = client.post(
        "/api/v1/innovation-projects",
        json=payload,
        headers={"Authorization": f"Bearer {recruiter_token}"},
    )
    assert res.status_code == 403

    # Unauthenticated attempt
    res_unauth = client.post("/api/v1/innovation-projects", json=payload)
    assert res_unauth.status_code == 401
    print("  -> RBAC access controls verified.")


def test_student_projects_listing(project_id: int):
    print("[3/8] Testing student project listing (/my) with filters...")
    token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token}"}

    # Create a draft private project
    private_payload = {
        "title": "Confidential Hardware Accelerator",
        "description": "Proprietary FPGA-based matrix multiplier accelerator design.",
        "project_type": "hardware",
        "status": "draft",
        "visibility": "private",
        "skills": "Verilog, FPGA",
    }
    res_priv = client.post("/api/v1/innovation-projects", json=private_payload, headers=headers)
    assert res_priv.status_code in (200, 201)
    priv_id = res_priv.json()["id"]

    # Student 1 lists all their projects
    res_my = client.get("/api/v1/innovation-projects/my", headers=headers)
    assert res_my.status_code == 200
    my_projects = res_my.json()
    assert len(my_projects) >= 2
    my_ids = [p["id"] for p in my_projects]
    assert project_id in my_ids
    assert priv_id in my_ids

    # Filter /my by status=draft
    res_draft = client.get("/api/v1/innovation-projects/my?status=draft", headers=headers)
    assert res_draft.status_code == 200
    drafts = res_draft.json()
    assert all(p["status"] == "draft" for p in drafts)
    assert priv_id in [p["id"] for p in drafts]

    print("  -> Student project listing verified.")
    return priv_id


def test_visibility_guards(public_id: int, private_id: int):
    print("[4/8] Testing visibility guards for public vs private projects...")
    student1_token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    student2_token = get_token(STUDENT2_EMAIL, UserRole.STUDENT)

    # 1. Owner can access both public and private projects
    res_owner_pub = client.get(f"/api/v1/innovation-projects/{public_id}", headers={"Authorization": f"Bearer {student1_token}"})
    assert res_owner_pub.status_code == 200

    res_owner_priv = client.get(f"/api/v1/innovation-projects/{private_id}", headers={"Authorization": f"Bearer {student1_token}"})
    assert res_owner_priv.status_code == 200

    # 2. Student 2 can view public project
    res_other_pub = client.get(f"/api/v1/innovation-projects/{public_id}", headers={"Authorization": f"Bearer {student2_token}"})
    assert res_other_pub.status_code == 200

    # 3. Student 2 CANNOT view private project (returns 404 to avoid enumeration)
    res_other_priv = client.get(f"/api/v1/innovation-projects/{private_id}", headers={"Authorization": f"Bearer {student2_token}"})
    assert res_other_priv.status_code == 404

    # 4. Public discovery list does NOT include private project
    res_disc = client.get("/api/v1/innovation-projects", headers={"Authorization": f"Bearer {student2_token}"})
    assert res_disc.status_code == 200
    items = res_disc.json()["items"]
    disc_ids = [p["id"] for p in items]
    assert public_id in disc_ids
    assert private_id not in disc_ids

    print("  -> Visibility guards verified.")


def test_ownership_protection(public_id: int):
    print("[5/8] Testing ownership protection on project modifications and deletions...")
    student2_token = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    recruiter_token = get_token(RECRUITER_EMAIL, UserRole.RECRUITER)

    # Student 2 attempts to patch Student 1's project
    res_hack_patch = client.patch(
        f"/api/v1/innovation-projects/{public_id}",
        json={"title": "Hacked Title"},
        headers={"Authorization": f"Bearer {student2_token}"},
    )
    assert res_hack_patch.status_code == 403

    # Student 2 attempts to delete Student 1's project
    res_hack_del = client.delete(
        f"/api/v1/innovation-projects/{public_id}",
        headers={"Authorization": f"Bearer {student2_token}"},
    )
    assert res_hack_del.status_code == 403

    # Recruiter attempts to modify project
    res_rec_patch = client.patch(
        f"/api/v1/innovation-projects/{public_id}",
        json={"title": "Recruiter Modified"},
        headers={"Authorization": f"Bearer {recruiter_token}"},
    )
    assert res_rec_patch.status_code == 403

    print("  -> Ownership protection verified.")


def test_project_update_and_skill_sync(project_id: int):
    print("[6/8] Testing project partial update and structured skills resync...")
    token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token}"}

    # Update title, short description, and skills
    update_payload = {
        "title": "Autonomous Rover Navigation v2",
        "short_description": "Updated ROS2 edge planner.",
        "skills": "Test-Python, Test-React",
        "live_demo_url": "https://v2.rover.demo",
    }
    res = client.patch(f"/api/v1/innovation-projects/{project_id}", json=update_payload, headers=headers)
    assert res.status_code == 200
    updated = res.json()

    assert updated["title"] == "Autonomous Rover Navigation v2"
    assert updated["slug"] == "autonomous-rover-navigation-v2"
    assert updated["short_description"] == "Updated ROS2 edge planner."
    assert updated["live_demo_url"] == "https://v2.rover.demo"
    assert updated["skills"] == "Test-Python, Test-React"
    assert len(updated["structured_skills"]) == 2
    u_slugs = [s["slug"] for s in updated["structured_skills"]]
    assert "test-python" in u_slugs
    assert "test-react" in u_slugs
    assert "test-robotics" not in u_slugs

    # Verify DB associations
    with SessionLocal() as db:
        project = db.scalar(select(InnovationProject).where(InnovationProject.id == project_id))
        assert project is not None
        assert len(project.project_skills) == 2

    print("  -> Project update and skills resync verified.")


def test_public_discovery_and_filtering(public_id: int):
    print("[7/8] Testing public project discovery, search, and pagination...")
    token = get_token(STUDENT2_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token}"}

    # Search with q
    res_q = client.get("/api/v1/innovation-projects?q=Rover", headers=headers)
    assert res_q.status_code == 200
    items = res_q.json()["items"]
    assert any(p["id"] == public_id for p in items)

    # Filter by project_type
    res_type = client.get("/api/v1/innovation-projects?project_type=software", headers=headers)
    assert res_type.status_code == 200
    assert all(p["project_type"] == "software" for p in res_type.json()["items"])

    # Filter by skill
    res_skill = client.get("/api/v1/innovation-projects?skill=React", headers=headers)
    assert res_skill.status_code == 200
    assert any(p["id"] == public_id for p in res_skill.json()["items"])

    # Pagination limits
    res_page = client.get("/api/v1/innovation-projects?page=1&page_size=1", headers=headers)
    assert res_page.status_code == 200
    assert len(res_page.json()["items"]) <= 1
    assert "total" in res_page.json()
    assert "total_pages" in res_page.json()

    print("  -> Public project discovery and filtering verified.")


def test_project_deletion_and_cascade(project_id: int):
    print("[8/8] Testing project deletion and cascading join row removal...")
    token = get_token(STUDENT1_EMAIL, UserRole.STUDENT)
    headers = {"Authorization": f"Bearer {token}"}

    # Delete project
    res_del = client.delete(f"/api/v1/innovation-projects/{project_id}", headers=headers)
    assert res_del.status_code == 204

    # Subsequent GET returns 404
    res_get = client.get(f"/api/v1/innovation-projects/{project_id}", headers=headers)
    assert res_get.status_code == 404

    # Verify DB associations are cascaded
    with SessionLocal() as db:
        skills = db.scalars(
            select(ProjectSkill).where(ProjectSkill.innovation_project_id == project_id)
        ).all()
        assert len(skills) == 0

    print("  -> Project deletion and cascade verified.")


def run_all_tests():
    print("\n=========================================================")
    print("STARTING MILESTONE 2.0-B INNOVATION PROJECTS TEST SUITE...")
    print("=========================================================\n")
    cleanup_test_data()
    try:
        public_id = test_project_creation_and_validation()
        test_rbac_and_unauthorized_creation()
        private_id = test_student_projects_listing(public_id)
        test_visibility_guards(public_id, private_id)
        test_ownership_protection(public_id)
        test_project_update_and_skill_sync(public_id)
        test_public_discovery_and_filtering(public_id)
        test_project_deletion_and_cascade(public_id)
        print("\n=========================================================")
        print("ALL INNOVATION PROJECTS TESTS PASSED (8/8)!")
        print("=========================================================\n")
    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_all_tests()
