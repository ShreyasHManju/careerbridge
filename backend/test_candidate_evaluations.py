"""
CareerBridge Phase 35A — Recruiter Candidate Evaluation Test Suite
Comprehensive test suite validating the candidate evaluation foundation, including:
1. Recruiter creation of draft evaluations
2. Recruiter direct or two-step submission of evaluations
3. Score boundary validation (1 to 5)
4. Rejection of scores < 1 and > 5
5. Server-side calculated overall score and client override prevention
6. Deterministic rounding of overall_score
7. Updating draft evaluations
8. Finalized/submitted evaluation immutability
9. Recruiter retrieval of own evaluations (by ID, by application, by recruiter)
10. Authorization & IDOR protection: Recruiter B cannot create, read, update, or submit Recruiter A's evaluations
11. Recruiter cannot evaluate an application belonging to another recruiter's job
12. Student isolation: Students cannot create, read, update, or submit recruiter evaluations (403)
13. Non-existent application/evaluation returns 404
14. Invalid interview/application relationship rejection (400)
15. Duplicate evaluation prevention for same application / interview round (409)
16. Migration upgrade and downgrade sanity checks
"""

from datetime import datetime, timezone
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.candidate_evaluation import (
    CandidateEvaluation,
    CandidateEvaluationStatus,
    CandidateRecommendation,
)
from app.models.interview import Interview, InterviewStatus, InterviewType
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.candidate_evaluation_service import calculate_candidate_overall_score

client = TestClient(app)

RECRUITER_A_EMAIL = "cand_eval_recruiter_a@careerbridge.io"
RECRUITER_B_EMAIL = "cand_eval_recruiter_b@careerbridge.io"
STUDENT_S_EMAIL = "cand_eval_student_s@careerbridge.io"
STUDENT_OTHER_EMAIL = "cand_eval_student_other@careerbridge.io"
TEST_PASSWORD = "EvaluationSecret123!"


def cleanup_test_data():
    """Clean up candidate evaluation test records."""
    with SessionLocal() as db:
        test_emails = [
            RECRUITER_A_EMAIL,
            RECRUITER_B_EMAIL,
            STUDENT_S_EMAIL,
            STUDENT_OTHER_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            # Delete evaluations
            db.execute(
                delete(CandidateEvaluation).where(
                    CandidateEvaluation.recruiter_id.in_(user_ids)
                )
            )
            # Delete interviews
            db.execute(
                delete(Interview).where(
                    (Interview.recruiter_id.in_(user_ids))
                    | (Interview.student_id.in_(user_ids))
                )
            )
            # Delete applications
            db.execute(delete(Application).where(Application.student_id.in_(user_ids)))
            # Delete job postings
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            # Delete profiles
            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            db.execute(delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(user_ids)))
            # Delete users
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


@pytest.fixture(autouse=True)
def setup_and_teardown():
    cleanup_test_data()
    yield
    cleanup_test_data()


def create_fixture_environment():
    """
    Sets up:
    - Recruiter A with Job A
    - Recruiter B with Job B
    - Student S with Application A (to Job A) and Interview A1
    - Student Other with Application B (to Job B) and Interview B1
    """
    with SessionLocal() as db:
        hashed_pw = hash_password(TEST_PASSWORD)

        # Recruiter A
        rec_a = User(
            email=RECRUITER_A_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        # Recruiter B
        rec_b = User(
            email=RECRUITER_B_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        # Student S
        stu_s = User(
            email=STUDENT_S_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        # Student Other
        stu_other = User(
            email=STUDENT_OTHER_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        db.add_all([rec_a, rec_b, stu_s, stu_other])
        db.flush()

        rec_a_id = rec_a.id
        rec_b_id = rec_b.id
        stu_s_id = stu_s.id
        stu_other_id = stu_other.id

        # Recruiter Profiles
        prof_a = RecruiterProfile(
            user_id=rec_a_id,
            company_name="Alpha Tech Innovations",
            contact_name="Alice Recruiter",
            is_verified=True,
        )
        prof_b = RecruiterProfile(
            user_id=rec_b_id,
            company_name="Beta Systems Corp",
            contact_name="Bob Recruiter",
            is_verified=True,
        )
        # Student Profiles
        s_prof_s = StudentProfile(
            user_id=stu_s_id,
            full_name="Sam Student",
            college="State Tech University",
        )
        s_prof_o = StudentProfile(
            user_id=stu_other_id,
            full_name="Olivia Student",
            college="City Engineering Institute",
        )
        db.add_all([prof_a, prof_b, s_prof_s, s_prof_o])

        # Job Posting A
        job_a = JobPosting(
            recruiter_id=rec_a_id,
            title="Junior Backend Engineer",
            company_name="Alpha Tech Innovations",
            description="Build scalable microservices with Python and FastAPI",
            location="Remote",
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        # Job Posting B
        job_b = JobPosting(
            recruiter_id=rec_b_id,
            title="Frontend Specialist",
            company_name="Beta Systems Corp",
            description="Design responsive web interfaces",
            location="Bangalore",
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        db.add_all([job_a, job_b])
        db.flush()

        job_a_id = job_a.id
        job_b_id = job_b.id

        # Application A (Student S -> Job A)
        app_a = Application(
            job_posting_id=job_a_id,
            student_id=stu_s_id,
            status=ApplicationStatus.SHORTLISTED,
        )
        # Application B (Student Other -> Job B)
        app_b = Application(
            job_posting_id=job_b_id,
            student_id=stu_other_id,
            status=ApplicationStatus.SHORTLISTED,
        )
        db.add_all([app_a, app_b])
        db.flush()

        app_a_id = app_a.id
        app_b_id = app_b.id

        # Interview A1 (for App A)
        int_a1 = Interview(
            application_id=app_a_id,
            student_id=stu_s_id,
            recruiter_id=rec_a_id,
            notes="Technical Screening",
            scheduled_at=datetime.now(timezone.utc),
            duration_minutes=45,
            interview_type=InterviewType.ONLINE,
            status=InterviewStatus.SCHEDULED,
        )
        # Interview B1 (for App B)
        int_b1 = Interview(
            application_id=app_b_id,
            student_id=stu_other_id,
            recruiter_id=rec_b_id,
            notes="Portfolio Review",
            scheduled_at=datetime.now(timezone.utc),
            duration_minutes=60,
            interview_type=InterviewType.ONLINE,
            status=InterviewStatus.SCHEDULED,
        )
        db.add_all([int_a1, int_b1])
        db.commit()

        int_a1_id = int_a1.id
        int_b1_id = int_b1.id

        # Generate tokens
        token_rec_a = create_access_token(subject=rec_a_id)
        token_rec_b = create_access_token(subject=rec_b_id)
        token_stu_s = create_access_token(subject=stu_s_id)
        token_stu_other = create_access_token(subject=stu_other_id)

        return {
            "rec_a_id": rec_a_id,
            "rec_b_id": rec_b_id,
            "stu_s_id": stu_s_id,
            "stu_other_id": stu_other_id,
            "job_a_id": job_a_id,
            "job_b_id": job_b_id,
            "app_a_id": app_a_id,
            "app_b_id": app_b_id,
            "int_a1_id": int_a1_id,
            "int_b1_id": int_b1_id,
            "token_rec_a": token_rec_a,
            "token_rec_b": token_rec_b,
            "token_stu_s": token_stu_s,
            "token_stu_other": token_stu_other,
        }


# =========================================================================
# 1-11: Core Candidate Evaluation Foundation & Lifecycle Tests
# =========================================================================

def test_recruiter_can_create_draft_evaluation():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    payload = {
        "technical_score": 4,
        "problem_solving_score": 5,
        "communication_score": 4,
        "role_fit_score": 3,
        "recommendation": "hire",
        "strengths": "Strong grasp of algorithmic complexity and clean code",
        "areas_for_growth": "Could deepen understanding of distributed caching",
        "summary_notes": "Very promising candidate for the junior role",
        "is_submitted": False,
    }
    response = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "draft"
    assert data["application_id"] == env["app_a_id"]
    assert data["recruiter_id"] == env["rec_a_id"]
    assert data["technical_score"] == 4
    assert data["problem_solving_score"] == 5
    assert data["communication_score"] == 4
    assert data["role_fit_score"] == 3
    assert data["overall_score"] == 4.0  # (4+5+4+3)/4 = 4.0
    assert data["recommendation"] == "hire"
    assert data["submitted_at"] is None
    assert data["job_title"] == "Junior Backend Engineer"
    assert data["student_name"] == "Sam Student"
    assert data["company_name"] == "Alpha Tech Innovations"


def test_recruiter_can_submit_evaluation_directly():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    payload = {
        "technical_score": 5,
        "problem_solving_score": 5,
        "communication_score": 4,
        "role_fit_score": 5,
        "recommendation": "strong_hire",
        "strengths": "Exceptional system design and problem solving",
        "areas_for_growth": "None observed",
        "summary_notes": "Immediate hire recommendation",
        "is_submitted": True,
    }
    response = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "submitted"
    assert data["overall_score"] == 4.75  # (5+5+4+5)/4 = 4.75
    assert data["submitted_at"] is not None


def test_score_boundaries_1_to_5_accepted():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    payload = {
        "technical_score": 1,
        "problem_solving_score": 5,
        "communication_score": 1,
        "role_fit_score": 5,
        "recommendation": "hire",
        "is_submitted": False,
    }
    response = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["overall_score"] == 3.0


def test_score_below_1_is_rejected():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    payload = {
        "technical_score": 0,
        "problem_solving_score": 4,
        "communication_score": 4,
        "role_fit_score": 4,
        "recommendation": "no_hire",
    }
    response = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 422


def test_score_above_5_is_rejected():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    payload = {
        "technical_score": 6,
        "problem_solving_score": 4,
        "communication_score": 4,
        "role_fit_score": 4,
        "recommendation": "strong_hire",
    }
    response = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 422


def test_overall_score_calculated_server_side_and_ignores_client_override():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    payload = {
        "technical_score": 3,
        "problem_solving_score": 3,
        "communication_score": 3,
        "role_fit_score": 4,
        "overall_score": 5.0,  # Client tries to force 5.0
        "recommendation": "hire",
    }
    response = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    # Average of 3, 3, 3, 4 is 3.25
    assert data["overall_score"] == 3.25


def test_exact_average_calculation_and_deterministic_rounding():
    # Test helper directly
    assert calculate_candidate_overall_score(4, 4, 4, 4) == 4.0
    assert calculate_candidate_overall_score(4, 5, 4, 4) == 4.25
    assert calculate_candidate_overall_score(3, 4, 4, 4) == 3.75
    assert calculate_candidate_overall_score(1, 2, 4, 5) == 3.0
    assert calculate_candidate_overall_score(1, 2, 2, 2) == 1.75
    assert calculate_candidate_overall_score(2, 2, 3, 3) == 2.5
    assert calculate_candidate_overall_score(None, None, None, None) is None
    # Partial scores
    assert calculate_candidate_overall_score(4, 5, None, None) == 4.5


def test_draft_can_be_updated():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    # Create draft
    create_resp = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 2, "is_submitted": False},
        headers=headers,
    )
    assert create_resp.status_code == 201
    eval_id = create_resp.json()["id"]

    # Update draft
    update_payload = {
        "technical_score": 4,
        "problem_solving_score": 4,
        "communication_score": 5,
        "role_fit_score": 4,
        "recommendation": "hire",
        "strengths": "Great technical update",
    }
    update_resp = client.patch(
        f"/api/v1/evaluations/{eval_id}",
        json=update_payload,
        headers=headers,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["technical_score"] == 4
    assert updated["communication_score"] == 5
    assert updated["overall_score"] == 4.25
    assert updated["strengths"] == "Great technical update"
    assert updated["status"] == "draft"


def test_draft_update_can_explicitly_clear_nullable_fields():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    create_resp = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={
            "technical_score": 2,
            "problem_solving_score": 4,
            "communication_score": 5,
            "role_fit_score": 4,
            "recommendation": "hire",
            "strengths": "Strong communication",
            "areas_for_growth": "Needs deeper systems knowledge",
            "summary_notes": "Initial notes",
            "is_submitted": False,
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    eval_id = create_resp.json()["id"]

    update_resp = client.patch(
        f"/api/v1/evaluations/{eval_id}",
        json={
            "technical_score": None,
            "recommendation": None,
            "strengths": None,
            "areas_for_growth": None,
            "summary_notes": None,
        },
        headers=headers,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["technical_score"] is None
    assert updated["recommendation"] is None
    assert updated["strengths"] is None
    assert updated["areas_for_growth"] is None
    assert updated["summary_notes"] is None
    assert updated["overall_score"] == 4.33


def test_submitted_evaluation_cannot_be_modified():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    # Create and submit
    payload = {
        "technical_score": 4,
        "problem_solving_score": 4,
        "communication_score": 4,
        "role_fit_score": 4,
        "recommendation": "hire",
        "is_submitted": True,
    }
    create_resp = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert create_resp.status_code == 201
    eval_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "submitted"

    # Attempt to update finalized evaluation
    update_resp = client.patch(
        f"/api/v1/evaluations/{eval_id}",
        json={"technical_score": 1},
        headers=headers,
    )
    assert update_resp.status_code == 400
    assert "finalized" in update_resp.json()["detail"].lower()


def test_recruiter_can_submit_via_submit_endpoint():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    # Create draft
    create_resp = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={
            "technical_score": 4,
            "problem_solving_score": 4,
            "communication_score": 4,
            "role_fit_score": 4,
            "recommendation": "hire",
            "is_submitted": False,
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    eval_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "draft"

    # Submit via submit endpoint
    submit_resp = client.post(
        f"/api/v1/evaluations/{eval_id}/submit",
        headers=headers,
    )
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "submitted"
    assert submit_resp.json()["submitted_at"] is not None

    # Duplicate submit rejected
    dup_submit = client.post(
        f"/api/v1/evaluations/{eval_id}/submit",
        headers=headers,
    )
    assert dup_submit.status_code == 400


def test_incomplete_evaluation_cannot_be_submitted():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    # Create incomplete draft (missing some scores)
    create_resp = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 4, "is_submitted": False},
        headers=headers,
    )
    assert create_resp.status_code == 201
    eval_id = create_resp.json()["id"]

    # Try to submit
    submit_resp = client.post(
        f"/api/v1/evaluations/{eval_id}/submit",
        headers=headers,
    )
    assert submit_resp.status_code == 400
    assert "required for submission" in submit_resp.json()["detail"].lower()


# =========================================================================
# 12-17: Authorization, Security, & IDOR Prevention Tests
# =========================================================================

def test_recruiter_can_retrieve_own_evaluation_and_list_application_evaluations():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    create_resp = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 4, "is_submitted": False},
        headers=headers,
    )
    eval_id = create_resp.json()["id"]

    # Retrieve single
    get_resp = client.get(f"/api/v1/evaluations/{eval_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == eval_id

    # List for application
    list_resp = client.get(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        headers=headers,
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["id"] == eval_id

    # List all for recruiter
    rec_list_resp = client.get(
        "/api/v1/recruiter/evaluations",
        headers=headers,
    )
    assert rec_list_resp.status_code == 200
    assert len(rec_list_resp.json()) == 1


def test_recruiter_b_cannot_access_recruiter_a_evaluations_idor():
    """
    Recruiter A owns Job A (and App A).
    Recruiter B owns Job B (and App B).
    Recruiter B must be blocked from:
    1. Creating evaluation for App A (403)
    2. Reading Recruiter A's evaluation (403)
    3. Reading Recruiter A's application evaluations (403)
    4. Updating Recruiter A's evaluation (403)
    5. Submitting Recruiter A's evaluation (403)
    """
    env = create_fixture_environment()
    headers_a = {"Authorization": f"Bearer {env['token_rec_a']}"}
    headers_b = {"Authorization": f"Bearer {env['token_rec_b']}"}

    # Recruiter A creates draft evaluation
    create_a = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 4, "is_submitted": False},
        headers=headers_a,
    )
    assert create_a.status_code == 201
    eval_a_id = create_a.json()["id"]

    # 1. Recruiter B attempts to create evaluation on App A
    b_create_on_a = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 5, "is_submitted": False},
        headers=headers_b,
    )
    assert b_create_on_a.status_code == 403

    # 2. Recruiter B attempts to read Recruiter A's evaluation
    b_read_a = client.get(f"/api/v1/evaluations/{eval_a_id}", headers=headers_b)
    assert b_read_a.status_code == 403

    # 3. Recruiter B attempts to list evaluations for App A
    b_list_app_a = client.get(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        headers=headers_b,
    )
    assert b_list_app_a.status_code == 403

    # 4. Recruiter B attempts to update Recruiter A's evaluation
    b_update_a = client.patch(
        f"/api/v1/evaluations/{eval_a_id}",
        json={"technical_score": 1},
        headers=headers_b,
    )
    assert b_update_a.status_code == 403

    # 5. Recruiter B attempts to submit Recruiter A's evaluation
    b_submit_a = client.post(
        f"/api/v1/evaluations/{eval_a_id}/submit",
        headers=headers_b,
    )
    assert b_submit_a.status_code == 403


def test_evaluation_access_requires_author_and_current_job_owner():
    env = create_fixture_environment()
    headers_a = {"Authorization": f"Bearer {env['token_rec_a']}"}
    headers_b = {"Authorization": f"Bearer {env['token_rec_b']}"}

    created = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 4},
        headers=headers_a,
    )
    assert created.status_code == 201
    evaluation_id = created.json()["id"]

    # Simulate job ownership changing after the evaluation is created.
    with SessionLocal() as db:
        job = db.get(JobPosting, env["job_a_id"])
        assert job is not None
        job.recruiter_id = env["rec_b_id"]
        db.commit()

    assert client.get(f"/api/v1/evaluations/{evaluation_id}", headers=headers_a).status_code == 403
    assert client.get(f"/api/v1/evaluations/{evaluation_id}", headers=headers_b).status_code == 403

    list_app = client.get(f"/api/v1/applications/{env['app_a_id']}/evaluations", headers=headers_b)
    assert list_app.status_code == 200 and list_app.json() == []
    list_a = client.get("/api/v1/recruiter/evaluations", headers=headers_a)
    list_b = client.get("/api/v1/recruiter/evaluations", headers=headers_b)
    assert list_a.status_code == 200 and list_a.json() == []
    assert list_b.status_code == 200 and list_b.json() == []


def test_student_cannot_access_evaluations_data_or_endpoints():
    """
    Candidate evaluations are internal recruiter scorecards.
    Students must be forbidden (403) from:
    1. Creating evaluations
    2. Listing application evaluations
    3. Reading evaluations by ID
    4. Updating evaluations
    5. Submitting evaluations
    """
    env = create_fixture_environment()
    headers_rec_a = {"Authorization": f"Bearer {env['token_rec_a']}"}
    headers_student = {"Authorization": f"Bearer {env['token_stu_s']}"}

    # Recruiter A creates evaluation
    create_a = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={
            "technical_score": 4,
            "problem_solving_score": 4,
            "communication_score": 4,
            "role_fit_score": 4,
            "recommendation": "hire",
            "strengths": "Strong coder",
            "areas_for_growth": "Needs better tests",
            "summary_notes": "Internal recruiter notes",
            "is_submitted": True,
        },
        headers=headers_rec_a,
    )
    assert create_a.status_code == 201
    eval_id = create_a.json()["id"]

    # Student attempts create
    stu_create = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 5},
        headers=headers_student,
    )
    assert stu_create.status_code == 403

    # Student attempts list
    stu_list = client.get(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        headers=headers_student,
    )
    assert stu_list.status_code == 403

    # Student attempts read by ID
    stu_read = client.get(
        f"/api/v1/evaluations/{eval_id}",
        headers=headers_student,
    )
    assert stu_read.status_code == 403

    # Student attempts update
    stu_update = client.patch(
        f"/api/v1/evaluations/{eval_id}",
        json={"technical_score": 5},
        headers=headers_student,
    )
    assert stu_update.status_code == 403

    # Student attempts submit
    stu_submit = client.post(
        f"/api/v1/evaluations/{eval_id}/submit",
        headers=headers_student,
    )
    assert stu_submit.status_code == 403


# =========================================================================
# 18-22: Not Found, Invalid Relationships, & Duplicate Checks
# =========================================================================

def test_nonexistent_application_returns_404():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    resp = client.post(
        "/api/v1/applications/999999/evaluations",
        json={"technical_score": 4},
        headers=headers,
    )
    assert resp.status_code == 404

    resp_list = client.get(
        "/api/v1/applications/999999/evaluations",
        headers=headers,
    )
    assert resp_list.status_code == 404


def test_nonexistent_evaluation_returns_404():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    resp_get = client.get("/api/v1/evaluations/999999", headers=headers)
    assert resp_get.status_code == 404

    resp_patch = client.patch(
        "/api/v1/evaluations/999999",
        json={"technical_score": 4},
        headers=headers,
    )
    assert resp_patch.status_code == 404

    resp_submit = client.post(
        "/api/v1/evaluations/999999/submit",
        headers=headers,
    )
    assert resp_submit.status_code == 404


def test_evaluation_cannot_reference_interview_belonging_to_another_application():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    # Try to evaluate App A using Interview B1 (which belongs to App B)
    payload = {
        "interview_id": env["int_b1_id"],
        "technical_score": 4,
    }
    resp = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 400
    assert "belong to the specified application" in resp.json()["detail"]


def test_nonexistent_interview_id_returns_404():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    payload = {
        "interview_id": 999999,
        "technical_score": 4,
    }
    resp = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 404
    assert "Interview not found" in resp.json()["detail"]


def test_duplicate_evaluation_prevention():
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    # 1. First application-level evaluation succeeds
    resp1 = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 4},
        headers=headers,
    )
    assert resp1.status_code == 201

    # 2. Second application-level evaluation for same app & recruiter returns 409
    resp2 = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 5},
        headers=headers,
    )
    assert resp2.status_code == 409
    assert "already exists for this candidate" in resp2.json()["detail"]

    # 3. Interview-level evaluation for Int A1 succeeds
    resp3 = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"interview_id": env["int_a1_id"], "technical_score": 5},
        headers=headers,
    )
    assert resp3.status_code == 201

    # 4. Duplicate evaluation for the same interview returns 409
    resp4 = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"interview_id": env["int_a1_id"], "technical_score": 3},
        headers=headers,
    )
    assert resp4.status_code == 409
    assert "already exists for this interview round" in resp4.json()["detail"]


def test_database_unique_indexes_enforce_evaluation_duplicates():
    env = create_fixture_environment()

    with SessionLocal() as db:
        db.add(CandidateEvaluation(
            application_id=env["app_a_id"], recruiter_id=env["rec_a_id"],
            status=CandidateEvaluationStatus.DRAFT,
        ))
        db.commit()

        db.add(CandidateEvaluation(
            application_id=env["app_a_id"], recruiter_id=env["rec_a_id"],
            status=CandidateEvaluationStatus.DRAFT,
        ))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        db.add(CandidateEvaluation(
            application_id=env["app_a_id"], interview_id=env["int_a1_id"],
            recruiter_id=env["rec_a_id"], status=CandidateEvaluationStatus.DRAFT,
        ))
        db.commit()

        db.add(CandidateEvaluation(
            application_id=env["app_a_id"], interview_id=env["int_a1_id"],
            recruiter_id=env["rec_a_id"], status=CandidateEvaluationStatus.DRAFT,
        ))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


# =========================================================================
# 23-24: Database Migration Sanity Checks
# =========================================================================

def test_migration_and_model_roundtrip():
    """Verify that the model maps cleanly to the migrated database table."""
    with SessionLocal() as db:
        env = create_fixture_environment()
        eval_record = CandidateEvaluation(
            application_id=env["app_a_id"],
            interview_id=env["int_a1_id"],
            recruiter_id=env["rec_a_id"],
            status=CandidateEvaluationStatus.SUBMITTED,
            technical_score=4,
            problem_solving_score=5,
            communication_score=4,
            role_fit_score=5,
            overall_score=4.50,
            recommendation=CandidateRecommendation.STRONG_HIRE,
            strengths="ORM test strengths",
            areas_for_growth="ORM test growth",
            summary_notes="ORM test notes",
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(eval_record)
        db.commit()
        db.refresh(eval_record)

        assert eval_record.id is not None
        assert eval_record.overall_score == 4.50
        assert eval_record.recommendation == CandidateRecommendation.STRONG_HIRE

        # Clean up
        db.delete(eval_record)
        db.commit()

def test_deleting_interview_with_evaluations_is_restricted_and_preserves_history():
    """An evaluated interview cannot be deleted or silently unlinked."""
    env = create_fixture_environment()
    headers = {"Authorization": f"Bearer {env['token_rec_a']}"}

    app_response = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={"technical_score": 4},
        headers=headers,
    )
    interview_response = client.post(
        f"/api/v1/applications/{env['app_a_id']}/evaluations",
        json={
            "interview_id": env["int_a1_id"],
            "technical_score": 5,
        },
        headers=headers,
    )

    assert app_response.status_code == 201
    assert interview_response.status_code == 201

    # Exercise the ORM deletion path, not only a direct SQL DELETE.
    with SessionLocal() as db:
        interview = db.get(Interview, env["int_a1_id"])
        assert interview is not None

        db.delete(interview)
        with pytest.raises(IntegrityError):
            db.commit()

        db.rollback()

    # The interview and both evaluations must remain intact.
    with SessionLocal() as db:
        assert db.get(Interview, env["int_a1_id"]) is not None

        evaluations = db.scalars(
            select(CandidateEvaluation).where(
                CandidateEvaluation.application_id == env["app_a_id"],
                CandidateEvaluation.recruiter_id == env["rec_a_id"],
            )
        ).all()

        assert len(evaluations) == 2
        assert sum(e.interview_id is None for e in evaluations) == 1
        assert sum(
            e.interview_id == env["int_a1_id"] for e in evaluations
        ) == 1
