import uuid
import pytest
from datetime import datetime, timezone
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.core.test_fixtures import clean_test_records, create_test_user
from app.main import app
from app.models.innovation_project import InnovationProject, ProjectStatus, ProjectType, ProjectVisibility
from app.models.project_blueprint import (
    BlueprintDifficulty,
    BlueprintStatus,
    ProjectBlueprint,
    ProjectBlueprintMilestone,
    ProjectBlueprintSkill,
)
from app.models.project_evidence import EvidenceType
from app.models.skill import Skill
from app.models.user import User, UserRole
from app.services.skill_service import get_or_create_skill


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        # Clean test users and projects
        test_users = session.scalars(select(User.id).where(User.email.like("%@test_bp.io"))).all()
        if test_users:
            clean_test_records(session, user_ids=list(test_users))
        # Clean test blueprints
        test_bps = session.scalars(
            select(ProjectBlueprint).where(
                (ProjectBlueprint.slug.like("test-pub-kv-%"))
                | (ProjectBlueprint.slug.like("test-draft-bp-%"))
                | (ProjectBlueprint.slug.like("test-arch-bp-%"))
            )
        ).all()
        for bp in test_bps:
            session.delete(bp)
        session.commit()
        session.close()


@pytest.fixture
def student_user(db):
    user = create_test_user(db, role=UserRole.STUDENT, email=f"student_{uuid.uuid4().hex[:6]}@test_bp.io")
    return user


@pytest.fixture
def recruiter_user(db):
    user = create_test_user(db, role=UserRole.RECRUITER, email=f"recruiter_{uuid.uuid4().hex[:6]}@test_bp.io")
    return user


@pytest.fixture
def admin_user(db):
    user = create_test_user(db, role=UserRole.ADMIN, email=f"admin_{uuid.uuid4().hex[:6]}@test_bp.io")
    return user


@pytest.fixture
def student_headers(student_user):
    token = create_access_token(subject=student_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def recruiter_headers(recruiter_user):
    token = create_access_token(subject=recruiter_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_user):
    token = create_access_token(subject=admin_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_blueprints(db):
    """Create a set of sample blueprints for testing."""
    s_go = get_or_create_skill(db, "Go", category="Backend")
    s_dist = get_or_create_skill(db, "Distributed Systems", category="Backend")
    s_grpc = get_or_create_skill(db, "gRPC", category="Backend")
    db.commit()

    # Published Blueprint
    bp_pub = ProjectBlueprint(
        title="Test Published KV Store",
        slug=f"test-pub-kv-{uuid.uuid4().hex[:6]}",
        version=1,
        summary="Published test blueprint summary",
        description="Detailed description for published blueprint",
        learning_objectives="Learn Go and Distributed Systems",
        project_type=ProjectType.SOFTWARE,
        difficulty_level=BlueprintDifficulty.ADVANCED,
        estimated_hours=30,
        status=BlueprintStatus.PUBLISHED,
    )
    db.add(bp_pub)
    db.flush()

    db.add(ProjectBlueprintSkill(blueprint_id=bp_pub.id, skill_id=s_go.id, is_primary=True))
    db.add(ProjectBlueprintSkill(blueprint_id=bp_pub.id, skill_id=s_dist.id, is_primary=True))
    db.add(ProjectBlueprintSkill(blueprint_id=bp_pub.id, skill_id=s_grpc.id, is_primary=False))

    db.add(ProjectBlueprintMilestone(
        blueprint_id=bp_pub.id,
        title="Milestone 1: Storage",
        description="Implement LSM store",
        expected_deliverable="In-memory store engine",
        recommended_evidence_type=EvidenceType.REPOSITORY,
        evidence_guidance="GitHub repository link with unit tests",
        display_order=1,
    ))
    db.add(ProjectBlueprintMilestone(
        blueprint_id=bp_pub.id,
        title="Milestone 2: Consensus",
        description="Implement leader election",
        expected_deliverable="Working election loop",
        recommended_evidence_type=EvidenceType.DEMO,
        evidence_guidance="Recorded terminal demo of election",
        display_order=2,
    ))

    # Draft Blueprint
    bp_draft = ProjectBlueprint(
        title="Test Draft Blueprint",
        slug=f"test-draft-bp-{uuid.uuid4().hex[:6]}",
        version=1,
        summary="Draft blueprint summary",
        description="Detailed draft description",
        learning_objectives="Draft objectives",
        project_type=ProjectType.SOFTWARE,
        difficulty_level=BlueprintDifficulty.BEGINNER,
        estimated_hours=10,
        status=BlueprintStatus.DRAFT,
    )
    db.add(bp_draft)

    # Archived Blueprint
    bp_arch = ProjectBlueprint(
        title="Test Archived Blueprint",
        slug=f"test-arch-bp-{uuid.uuid4().hex[:6]}",
        version=1,
        summary="Archived blueprint summary",
        description="Detailed archived description",
        learning_objectives="Archived objectives",
        project_type=ProjectType.SOFTWARE,
        difficulty_level=BlueprintDifficulty.INTERMEDIATE,
        estimated_hours=15,
        status=BlueprintStatus.ARCHIVED,
    )
    db.add(bp_arch)

    db.commit()
    db.refresh(bp_pub)
    db.refresh(bp_draft)
    db.refresh(bp_arch)

    return {
        "published": bp_pub,
        "draft": bp_draft,
        "archived": bp_arch,
        "skills": {"go": s_go, "dist": s_dist, "grpc": s_grpc},
    }


# ============================================================================
# 1. BLUEPRINT ACCESS & VISIBILITY TESTS
# ============================================================================

def test_list_blueprints_student_sees_published_only(client, student_headers, sample_blueprints):
    """Students should only see published blueprints."""
    res = client.get("/api/v1/projects/blueprints", headers=student_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "items" in data
    statuses = [item["status"] for item in data["items"]]
    assert "draft" not in statuses
    assert "archived" not in statuses


def test_list_blueprints_recruiter_sees_published_only(client, recruiter_headers, sample_blueprints):
    """Recruiters should only see published blueprints."""
    res = client.get("/api/v1/projects/blueprints", headers=recruiter_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    statuses = [item["status"] for item in data["items"]]
    assert "draft" not in statuses
    assert "archived" not in statuses


def test_list_blueprints_admin_sees_all_statuses(client, admin_headers, sample_blueprints):
    """Admins should see draft and archived blueprints as well."""
    res = client.get("/api/v1/projects/blueprints", headers=admin_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    slugs = [item["slug"] for item in data["items"]]
    assert sample_blueprints["draft"].slug in slugs
    assert sample_blueprints["archived"].slug in slugs


def test_get_blueprint_detail_published(client, student_headers, sample_blueprints):
    """Student can view detail of published blueprint."""
    bp_id = sample_blueprints["published"].id
    res = client.get(f"/api/v1/projects/blueprints/{bp_id}", headers=student_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["id"] == bp_id
    assert data["version"] == 1
    assert len(data["skills"]) >= 3
    assert len(data["milestones"]) == 2
    assert data["milestones"][0]["evidence_guidance"] is not None


def test_get_blueprint_detail_draft_hidden_from_student(client, student_headers, sample_blueprints):
    """Draft blueprints return 404 for student."""
    bp_id = sample_blueprints["draft"].id
    res = client.get(f"/api/v1/projects/blueprints/{bp_id}", headers=student_headers)
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_get_blueprint_detail_archived_hidden_from_student(client, student_headers, sample_blueprints):
    """Archived blueprints return 404 for student."""
    bp_id = sample_blueprints["archived"].id
    res = client.get(f"/api/v1/projects/blueprints/{bp_id}", headers=student_headers)
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_get_blueprint_detail_draft_accessible_by_admin(client, admin_headers, sample_blueprints):
    """Admin can view draft blueprint details."""
    bp_id = sample_blueprints["draft"].id
    res = client.get(f"/api/v1/projects/blueprints/{bp_id}", headers=admin_headers)
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "draft"


# ============================================================================
# 2. INSTANTIATION TESTS
# ============================================================================

def test_instantiate_blueprint_success(client, student_headers, student_user, sample_blueprints, db):
    """Successful instantiation creates a private student project with cloned milestones & skills."""
    bp = sample_blueprints["published"]
    res = client.post(f"/api/v1/projects/blueprints/{bp.id}/instantiate", headers=student_headers)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()

    assert data["student_id"] == student_user.id
    assert data["title"] == bp.title
    assert data["visibility"] == "private"
    assert data["status"] == "active"
    assert len(data["structured_skills"]) == 3
    assert len(data["milestones"]) == 2

    # Verify milestone descriptions include evidence guidance
    m1 = data["milestones"][0]
    assert "Expected Deliverable:" in m1["description"]
    assert "Evidence Guidance" in m1["description"]

    # Verify database record
    db_proj = db.scalar(select(InnovationProject).where(InnovationProject.id == data["id"]))
    assert db_proj is not None
    assert db_proj.source_blueprint_id == bp.id
    assert db_proj.source_blueprint_version == bp.version


def test_instantiate_blueprint_duplicate_active_conflict(client, student_headers, sample_blueprints):
    """Instantiating a blueprint when an active project already exists returns 409 Conflict."""
    bp = sample_blueprints["published"]
    # First instantiation
    res1 = client.post(f"/api/v1/projects/blueprints/{bp.id}/instantiate", headers=student_headers)
    assert res1.status_code == status.HTTP_201_CREATED

    # Second instantiation attempt
    res2 = client.post(f"/api/v1/projects/blueprints/{bp.id}/instantiate", headers=student_headers)
    assert res2.status_code == status.HTTP_409_CONFLICT
    assert "already have an active project" in res2.json()["detail"]


def test_instantiate_blueprint_archived_allows_reinstantiation(client, student_headers, student_user, sample_blueprints, db):
    """If an existing derived project was archived, student may instantiate a fresh active project."""
    bp = sample_blueprints["published"]

    # First instantiation
    res1 = client.post(f"/api/v1/projects/blueprints/{bp.id}/instantiate", headers=student_headers)
    assert res1.status_code == status.HTTP_201_CREATED
    proj_id = res1.json()["id"]

    # Archive the project in DB
    proj = db.scalar(select(InnovationProject).where(InnovationProject.id == proj_id))
    proj.status = ProjectStatus.ARCHIVED
    db.commit()

    # Re-instantiate should succeed
    res2 = client.post(f"/api/v1/projects/blueprints/{bp.id}/instantiate", headers=student_headers)
    assert res2.status_code == status.HTTP_201_CREATED
    assert res2.json()["id"] != proj_id
    assert res2.json()["status"] == "active"


def test_instantiate_unpublished_blueprint_fails(client, student_headers, sample_blueprints):
    """Attempting to instantiate draft or archived blueprints returns 404."""
    draft_id = sample_blueprints["draft"].id
    res = client.post(f"/api/v1/projects/blueprints/{draft_id}/instantiate", headers=student_headers)
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_instantiate_blueprint_recruiter_forbidden(client, recruiter_headers, sample_blueprints):
    """Recruiters cannot instantiate blueprints."""
    bp_id = sample_blueprints["published"].id
    res = client.post(f"/api/v1/projects/blueprints/{bp_id}/instantiate", headers=recruiter_headers)
    assert res.status_code == status.HTTP_403_FORBIDDEN


def test_blueprint_delete_restricted_when_instantiated(client, student_headers, sample_blueprints, db):
    """A blueprint that has been instantiated into a student project cannot be deleted (ON DELETE RESTRICT)."""
    bp = sample_blueprints["published"]
    res = client.post(f"/api/v1/projects/blueprints/{bp.id}/instantiate", headers=student_headers)
    assert res.status_code == status.HTTP_201_CREATED

    # Attempting to delete the blueprint directly in DB session should raise IntegrityError
    from sqlalchemy.exc import IntegrityError
    with pytest.raises(IntegrityError):
        db.delete(bp)
        db.commit()
    db.rollback()
