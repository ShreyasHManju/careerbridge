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
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.project_blueprint import (
    BlueprintDifficulty,
    BlueprintStatus,
    ProjectBlueprint,
    ProjectBlueprintSkill,
)
from app.models.skill import JobSkill, Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.project_recommendation_service import ProjectRecommendationService
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
        test_users = session.scalars(select(User.id).where(User.email.like("%@test_recs.io"))).all()
        if test_users:
            clean_test_records(session, user_ids=list(test_users))
        test_bps = session.scalars(
            select(ProjectBlueprint).where(
                (ProjectBlueprint.slug.like("bp-a-raft-%"))
                | (ProjectBlueprint.slug.like("bp-b-cli-%"))
                | (ProjectBlueprint.slug.like("bp-c-react-%"))
                | (ProjectBlueprint.slug.like("bp-d-http-%"))
            )
        ).all()
        for bp in test_bps:
            session.delete(bp)
        session.commit()
        session.close()


@pytest.fixture
def student_user(db):
    user = create_test_user(db, role=UserRole.STUDENT, email=f"student_{uuid.uuid4().hex[:6]}@test_recs.io")
    return user


@pytest.fixture
def recruiter_user(db):
    user = create_test_user(db, role=UserRole.RECRUITER, email=f"recruiter_{uuid.uuid4().hex[:6]}@test_recs.io")
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
def recommendation_fixtures(db, recruiter_user):
    """Setup skills, job posting, and various blueprints with primary/supporting skills and difficulty levels."""
    s_python = get_or_create_skill(db, "Python", category="Backend")
    s_go = get_or_create_skill(db, "Go", category="Backend")
    s_dist = get_or_create_skill(db, "Distributed Systems", category="Backend")
    s_grpc = get_or_create_skill(db, "gRPC", category="Backend")
    s_react = get_or_create_skill(db, "React", category="Frontend")
    s_sql = get_or_create_skill(db, "PostgreSQL", category="Database")
    db.commit()

    # Job requiring Python, Go, Distributed Systems, gRPC
    job = JobPosting(
        recruiter_id=recruiter_user.id,
        title="Senior Backend Systems Engineer",
        description="Build scalable distributed microservices.",
        company_name="Apex Systems",
        location="Remote",
        opportunity_type=OpportunityType.JOB,
        employment_type=EmploymentType.FULL_TIME,
        is_active=True,
    )
    db.add(job)
    db.flush()

    for s in [s_python, s_go, s_dist, s_grpc]:
        db.add(JobSkill(job_posting_id=job.id, skill_id=s.id, is_required=True))

    # Blueprint A: High match - Primary Go + Distributed Systems (2 * 10 = 20), Supporting gRPC (1 * 3 = 3). Difficulty ADVANCED.
    bp_a = ProjectBlueprint(
        title="Blueprint A: Raft KV Store",
        slug=f"bp-a-raft-{uuid.uuid4().hex[:6]}",
        version=1,
        summary="Advanced Go distributed systems project",
        description="Detailed Raft KV description",
        learning_objectives="Master Go & Distributed Systems",
        project_type=ProjectType.SOFTWARE,
        difficulty_level=BlueprintDifficulty.ADVANCED,
        estimated_hours=40,
        status=BlueprintStatus.PUBLISHED,
    )
    db.add(bp_a)
    db.flush()
    db.add(ProjectBlueprintSkill(blueprint_id=bp_a.id, skill_id=s_go.id, is_primary=True))
    db.add(ProjectBlueprintSkill(blueprint_id=bp_a.id, skill_id=s_dist.id, is_primary=True))
    db.add(ProjectBlueprintSkill(blueprint_id=bp_a.id, skill_id=s_grpc.id, is_primary=False))

    # Blueprint B: Moderate match - Primary Go (1 * 10 = 10). Difficulty BEGINNER.
    bp_b = ProjectBlueprint(
        title="Blueprint B: Go CLI Tool",
        slug=f"bp-b-cli-{uuid.uuid4().hex[:6]}",
        version=1,
        summary="Beginner Go project",
        description="Detailed CLI description",
        learning_objectives="Learn basic Go CLI tooling",
        project_type=ProjectType.SOFTWARE,
        difficulty_level=BlueprintDifficulty.BEGINNER,
        estimated_hours=10,
        status=BlueprintStatus.PUBLISHED,
    )
    db.add(bp_b)
    db.flush()
    db.add(ProjectBlueprintSkill(blueprint_id=bp_b.id, skill_id=s_go.id, is_primary=True))

    # Blueprint C: Zero match for target backend skills - React (Frontend).
    bp_c = ProjectBlueprint(
        title="Blueprint C: React Dashboard",
        slug=f"bp-c-react-{uuid.uuid4().hex[:6]}",
        version=1,
        summary="React dashboard frontend project",
        description="Detailed React description",
        learning_objectives="Learn React & Frontend",
        project_type=ProjectType.SOFTWARE,
        difficulty_level=BlueprintDifficulty.BEGINNER,
        estimated_hours=15,
        status=BlueprintStatus.PUBLISHED,
    )
    db.add(bp_c)
    db.flush()
    db.add(ProjectBlueprintSkill(blueprint_id=bp_c.id, skill_id=s_react.id, is_primary=True))

    # Blueprint D: Tied with B in points (Primary Go = 10), but INTERMEDIATE difficulty.
    bp_d = ProjectBlueprint(
        title="Blueprint D: Go HTTP Microservice",
        slug=f"bp-d-http-{uuid.uuid4().hex[:6]}",
        version=1,
        summary="Intermediate Go microservice",
        description="Detailed HTTP microservice description",
        learning_objectives="Learn Go HTTP routing",
        project_type=ProjectType.SOFTWARE,
        difficulty_level=BlueprintDifficulty.INTERMEDIATE,
        estimated_hours=15,
        status=BlueprintStatus.PUBLISHED,
    )
    db.add(bp_d)
    db.flush()
    db.add(ProjectBlueprintSkill(blueprint_id=bp_d.id, skill_id=s_go.id, is_primary=True))

    db.commit()

    return {
        "job": job,
        "skills": {
            "python": s_python,
            "go": s_go,
            "dist": s_dist,
            "grpc": s_grpc,
            "react": s_react,
            "sql": s_sql,
        },
        "blueprints": {
            "bp_a": bp_a,
            "bp_b": bp_b,
            "bp_c": bp_c,
            "bp_d": bp_d,
        },
    }


# ============================================================================
# 1. RECOMMENDATION SERVICE ALGORITHM TESTS
# ============================================================================

def test_recommendation_scoring_and_ranking(db, recommendation_fixtures):
    """
    Given missing skills {Go, Distributed Systems, gRPC}:
    - Blueprint A has 2 primary + 1 supporting -> Highest score (33).
    - Blueprint B and D both have 1 primary (Score 13) -> B (Beginner, rank 1) ranks before D (Intermediate, rank 2).
    - Blueprint C has 0 matching missing skills -> Omitted completely.
    """
    s = recommendation_fixtures["skills"]
    bp_a = recommendation_fixtures["blueprints"]["bp_a"]
    bp_b = recommendation_fixtures["blueprints"]["bp_b"]
    bp_c = recommendation_fixtures["blueprints"]["bp_c"]
    bp_d = recommendation_fixtures["blueprints"]["bp_d"]

    missing_ids = {s["go"].id, s["dist"].id, s["grpc"].id}

    recs = ProjectRecommendationService.rank_blueprints_for_missing_skills(
        db=db,
        missing_skill_ids=missing_ids,
        student_id=None,
        limit=20,
    )

    rec_map = {r.blueprint.id: r for r in recs}

    # Blueprint C (React only) has 0 matching missing skills and must be excluded
    assert bp_c.id not in rec_map

    # Blueprint A must be present and have highest score
    assert bp_a.id in rec_map
    rec_a = rec_map[bp_a.id]
    assert rec_a.missing_primary_count == 2
    assert rec_a.missing_supporting_count == 1
    assert rec_a.total_missing_covered == 3
    # Score = (2 * 10) + (1 * 3) + round((3/3)*10) = 20 + 3 + 10 = 33
    assert rec_a.relevance_score == 33

    # Blueprint B & D must be present with Score = (1 * 10) + round((1/3)*10) = 13
    assert bp_b.id in rec_map
    assert bp_d.id in rec_map
    rec_b = rec_map[bp_b.id]
    rec_d = rec_map[bp_d.id]
    assert rec_b.relevance_score == 13
    assert rec_d.relevance_score == 13

    # Tie-break check: B (beginner, diff_rank 1) must rank strictly before D (intermediate, diff_rank 2)
    bp_ids_in_order = [r.blueprint.id for r in recs]
    assert bp_ids_in_order.index(bp_a.id) < bp_ids_in_order.index(bp_b.id)
    assert bp_ids_in_order.index(bp_b.id) < bp_ids_in_order.index(bp_d.id)


def test_recommendation_excludes_active_student_project(db, student_user, recommendation_fixtures):
    """If student already has an active project derived from Blueprint A, Blueprint A is excluded."""
    bp_a = recommendation_fixtures["blueprints"]["bp_a"]
    s = recommendation_fixtures["skills"]

    # Student instantiates Blueprint A
    active_proj = InnovationProject(
        student_id=student_user.id,
        source_blueprint_id=bp_a.id,
        source_blueprint_version=1,
        title=bp_a.title,
        slug=f"active-raft-{uuid.uuid4().hex[:6]}",
        description=bp_a.description,
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PRIVATE,
    )
    db.add(active_proj)
    db.commit()

    missing_ids = {s["go"].id, s["dist"].id, s["grpc"].id}
    recs = ProjectRecommendationService.rank_blueprints_for_missing_skills(
        db=db,
        missing_skill_ids=missing_ids,
        student_id=student_user.id,
    )

    rec_bp_ids = [r.blueprint.id for r in recs]
    assert bp_a.id not in rec_bp_ids


# ============================================================================
# 2. JOB RECOMMENDATION ENDPOINT TESTS
# ============================================================================

def test_get_job_project_recommendations(client, student_headers, student_user, recommendation_fixtures, db):
    """
    Student with Python skill viewing Job requiring {Python, Go, Distributed Systems, gRPC}:
    - Missing skills diagnosed: Go, Distributed Systems, gRPC
    - Returns ranked recommended blueprints
    """
    job = recommendation_fixtures["job"]
    s_python = recommendation_fixtures["skills"]["python"]

    # Give student Python skill on their profile
    profile = student_user.student_profile
    if profile:
        db.add(StudentSkill(student_profile_id=profile.id, skill_id=s_python.id))
        db.commit()

    res = client.get(f"/api/v1/projects/recommendations/jobs/{job.id}", headers=student_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["job_id"] == job.id
    assert data["total_missing_skills"] == 3
    missing_slugs = [ms["slug"] for ms in data["missing_skills"]]
    assert "python" not in missing_slugs
    assert "go" in missing_slugs

    # Recommendations present
    assert len(data["recommendations"]) > 0
    top_rec = data["recommendations"][0]
    assert "Go" in top_rec["recommendation_reason"]


def test_get_job_recommendations_recruiter_forbidden(client, recruiter_headers, recommendation_fixtures):
    """Recruiters cannot access student personalized job recommendations."""
    job_id = recommendation_fixtures["job"].id
    res = client.get(f"/api/v1/projects/recommendations/jobs/{job_id}", headers=recruiter_headers)
    assert res.status_code == status.HTTP_403_FORBIDDEN


# ============================================================================
# 3. SKILL RECOMMENDATION ENDPOINT TESTS
# ============================================================================

def test_get_skills_project_recommendations(client, student_headers, recommendation_fixtures):
    """Querying recommendations by explicit skill IDs returns ranked blueprints."""
    s = recommendation_fixtures["skills"]
    skill_ids = f"{s['go'].id}&skill_ids={s['dist'].id}"

    res = client.get(f"/api/v1/projects/recommendations/skills?skill_ids={skill_ids}", headers=student_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["total_blueprints_found"] >= 1
    assert len(data["recommendations"]) >= 1
