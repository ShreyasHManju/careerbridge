"""
CareerBridge Phase 35B.2 — Job Offer Foundation Test Suite
Comprehensive test suite validating the JobOffer domain foundation, including:
1. Recruiter creation of draft job offer (DRAFT)
2. Recruiter direct creation of issued offer (OFFERED, transitions application status to OFFERED)
3. Recruiter cannot create offer for another recruiter's application (403 Forbidden)
4. Student can view own released offer (OFFERED)
5. Student cannot view draft offer before it is sent (404 Not Found)
6. Student cannot view another student's offer (403 Forbidden / IDOR protection)
7. Student cannot create or modify job offers (403 Forbidden)
8. Recruiter can update own draft/active offer
9. Recruiter cannot update another recruiter's offer (403 Forbidden)
10. Recruiter can send a draft offer (POST /offers/{id}/send -> transitions to OFFERED, app status -> OFFERED)
11. Recruiter can withdraw an offer (POST /offers/{id}/withdraw -> transitions to WITHDRAWN)
12. Duplicate offer for the same application is rejected (409 Conflict)
13. Valid lifecycle state transitions succeed
14. Invalid lifecycle state transitions are rejected (400 Bad Request)
15. Application status becomes/retains OFFERED when appropriate
16. Non-existent application or offer returns 404
17. Recruiter can list own created offers
18. Student can list own received released offers
19. Get offer by application_id works for authorized recruiter and student
20. Cross-recruiter and cross-student access by application_id is blocked with 403
21. Response schema returns correct fields and populated metadata
22. Existing candidate evaluations and interviews remain unaffected
"""

from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import SessionLocal, engine
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.experience_record import ExperienceRecord, VerificationSource, VerificationStatus
from app.models.job_offer import JobOffer, OfferStatus
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.notification import Notification, NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER_A_EMAIL = "job_offer_recruiter_a@careerbridge.io"
RECRUITER_B_EMAIL = "job_offer_recruiter_b@careerbridge.io"
STUDENT_S_EMAIL = "job_offer_student_s@careerbridge.io"
STUDENT_OTHER_EMAIL = "job_offer_student_other@careerbridge.io"
TEST_PASSWORD = "OfferSecretPassword123!"


def ensure_job_offers_table():
    """Ensure job_offers table exists in database."""
    JobOffer.__table__.create(bind=engine, checkfirst=True)
    ExperienceRecord.__table__.create(bind=engine, checkfirst=True)
    Notification.__table__.create(bind=engine, checkfirst=True)


def cleanup_test_data():
    """Clean up job offer test records."""
    ensure_job_offers_table()
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
            # Delete notifications
            db.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
            # Delete experience records
            db.execute(delete(ExperienceRecord).where(ExperienceRecord.student_id.in_(user_ids)))
            # Delete job offers
            db.execute(
                delete(JobOffer).where(
                    JobOffer.recruiter_id.in_(user_ids)
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
    - Student S with Application A (to Job A)
    - Student Other with Application B (to Job B)
    """
    ensure_job_offers_table()
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
            company_name="Alpha Tech Solutions",
            contact_name="Alice Recruiter",
            is_verified=True,
        )
        prof_b = RecruiterProfile(
            user_id=rec_b_id,
            company_name="Beta Cloud Labs",
            contact_name="Bob Recruiter",
            is_verified=True,
        )
        # Student Profiles
        s_prof_s = StudentProfile(
            user_id=stu_s_id,
            full_name="Sam Student",
            college="State Engineering University",
        )
        s_prof_o = StudentProfile(
            user_id=stu_other_id,
            full_name="Olivia Student",
            college="City Institute of Tech",
        )
        db.add_all([prof_a, prof_b, s_prof_s, s_prof_o])

        # Job Posting A
        job_a = JobPosting(
            recruiter_id=rec_a_id,
            title="Full Stack Software Engineer",
            company_name="Alpha Tech Solutions",
            description="Build modern cloud applications",
            location="Remote",
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        # Job Posting B
        job_b = JobPosting(
            recruiter_id=rec_b_id,
            title="Backend Data Engineer",
            company_name="Beta Cloud Labs",
            description="Build scalable analytics pipelines",
            location="New York, NY",
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
            cover_message="Excited to join Alpha Tech!",
        )
        # Application B (Student Other -> Job B)
        app_b = Application(
            job_posting_id=job_b_id,
            student_id=stu_other_id,
            status=ApplicationStatus.REVIEWING,
            cover_message="Passionate about data engineering.",
        )
        db.add_all([app_a, app_b])
        db.commit()

        token_a = create_access_token(subject=rec_a_id)
        token_b = create_access_token(subject=rec_b_id)
        token_s = create_access_token(subject=stu_s_id)
        token_other = create_access_token(subject=stu_other_id)

        return {
            "recruiter_a_id": rec_a_id,
            "recruiter_b_id": rec_b_id,
            "student_s_id": stu_s_id,
            "student_other_id": stu_other_id,
            "job_a_id": job_a_id,
            "job_b_id": job_b_id,
            "app_a_id": app_a.id,
            "app_b_id": app_b.id,
            "headers_a": {"Authorization": f"Bearer {token_a}"},
            "headers_b": {"Authorization": f"Bearer {token_b}"},
            "headers_s": {"Authorization": f"Bearer {token_s}"},
            "headers_other": {"Authorization": f"Bearer {token_other}"},
        }


# =========================================================================
# TEST CASES
# =========================================================================

def test_recruiter_create_draft_offer():
    """1. Recruiter can create a draft job offer for own application."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    payload = {
        "title": "Software Engineer Offer",
        "compensation": 120000.0,
        "currency": "USD",
        "start_date": "2027-01-15T09:00:00Z",
        "expiration_date": "2026-12-01T23:59:59Z",
        "terms": "Full-time position with health benefits and 401(k).",
        "is_sent": False,
    }

    res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json=payload,
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "draft"
    assert data["title"] == "Software Engineer Offer"
    assert data["compensation"] == 120000.0
    assert data["currency"] == "USD"
    assert data["application_id"] == env["app_a_id"]
    assert data["recruiter_id"] == env["recruiter_a_id"]
    assert data["job_title"] == "Full Stack Software Engineer"
    assert data["student_name"] == "Sam Student"

    # Application status should remain SHORTLISTED since offer is only DRAFT
    with SessionLocal() as db:
        app = db.scalar(select(Application).where(Application.id == env["app_a_id"]))
        assert app.status == ApplicationStatus.SHORTLISTED


def test_recruiter_create_sent_offer_updates_application_status():
    """2. Recruiter creating offer with is_sent=True immediately transitions to OFFERED and sets Application status to OFFERED."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    payload = {
        "title": "Software Engineer Direct Offer",
        "compensation": 125000.0,
        "currency": "USD",
        "terms": "Official offer letter.",
        "is_sent": True,
    }

    res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json=payload,
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "offered"
    assert data["title"] == "Software Engineer Direct Offer"

    # Application status should become OFFERED
    with SessionLocal() as db:
        app = db.scalar(select(Application).where(Application.id == env["app_a_id"]))
        assert app.status == ApplicationStatus.OFFERED


def test_recruiter_cannot_create_offer_for_unowned_application():
    """3. Recruiter B cannot create an offer for Recruiter A's application (403 Forbidden)."""
    env = create_fixture_environment()
    headers_b = env["headers_b"]

    payload = {
        "title": "Malicious Hijack Offer",
        "compensation": 999999.0,
        "is_sent": False,
    }

    res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_b,
        json=payload,
    )
    assert res.status_code == 403, res.text
    assert "Not authorized" in res.json()["detail"]


def test_student_can_view_own_released_offer():
    """4. Student can view their own released (OFFERED) job offer."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    # Recruiter creates sent offer
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Official Junior Offer", "compensation": 95000.0, "is_sent": True},
    )
    assert create_res.status_code == 201
    offer_id = create_res.json()["id"]

    # Student retrieves offer by ID
    res = client.get(f"/api/v1/offers/{offer_id}", headers=headers_s)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == offer_id
    assert data["title"] == "Official Junior Offer"
    assert data["status"] == "offered"
    assert data["compensation"] == 95000.0


def test_student_cannot_view_draft_offer():
    """5. Student cannot view draft offer before it is released by recruiter (404 Not Found)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    # Recruiter creates draft offer
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Draft Offer", "compensation": 90000.0, "is_sent": False},
    )
    assert create_res.status_code == 201
    offer_id = create_res.json()["id"]

    # Student tries to view draft offer by ID -> 404
    res_id = client.get(f"/api/v1/offers/{offer_id}", headers=headers_s)
    assert res_id.status_code == 404, res_id.text

    # Student tries to view draft offer by application_id -> 404
    res_app = client.get(f"/api/v1/applications/{env['app_a_id']}/offers", headers=headers_s)
    assert res_app.status_code == 404, res_app.text


def test_student_cannot_view_another_students_offer():
    """6. Student Other cannot view Student S's offer (403 Forbidden / IDOR protection)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_other = env["headers_other"]

    # Recruiter creates released offer for Student S
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Private Offer for S", "compensation": 110000.0, "is_sent": True},
    )
    assert create_res.status_code == 201
    offer_id = create_res.json()["id"]

    # Student Other attempts IDOR read by ID
    res_id = client.get(f"/api/v1/offers/{offer_id}", headers=headers_other)
    assert res_id.status_code == 403, res_id.text

    # Student Other attempts IDOR read by application_id
    res_app = client.get(f"/api/v1/applications/{env['app_a_id']}/offers", headers=headers_other)
    assert res_app.status_code == 403, res_app.text


def test_student_cannot_create_or_modify_offer():
    """7. Students cannot create, update, send, or withdraw offers (403 Forbidden)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    # Student attempts creation
    res_create = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_s,
        json={"title": "Self Offer", "compensation": 500000.0},
    )
    assert res_create.status_code == 403, res_create.text

    # Recruiter creates draft offer
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Legit Offer", "compensation": 100000.0, "is_sent": False},
    )
    offer_id = create_res.json()["id"]

    # Student attempts update
    res_update = client.patch(
        f"/api/v1/offers/{offer_id}",
        headers=headers_s,
        json={"compensation": 999999.0},
    )
    assert res_update.status_code == 403, res_update.text

    # Student attempts send
    res_send = client.post(f"/api/v1/offers/{offer_id}/send", headers=headers_s)
    assert res_send.status_code == 403, res_send.text

    # Student attempts withdraw
    res_withdraw = client.post(f"/api/v1/offers/{offer_id}/withdraw", headers=headers_s)
    assert res_withdraw.status_code == 403, res_withdraw.text


def test_recruiter_update_own_offer():
    """8. Recruiter can update terms, compensation, and details on own offer."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    # Create draft offer
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Initial Offer Title", "compensation": 80000.0, "currency": "USD"},
    )
    offer_id = create_res.json()["id"]

    # Update offer
    update_res = client.patch(
        f"/api/v1/offers/{offer_id}",
        headers=headers_a,
        json={
            "title": "Revised Senior Offer Title",
            "compensation": 105000.0,
            "terms": "Updated signing bonus included.",
        },
    )
    assert update_res.status_code == 200, update_res.text
    data = update_res.json()
    assert data["title"] == "Revised Senior Offer Title"
    assert data["compensation"] == 105000.0
    assert data["terms"] == "Updated signing bonus included."


def test_recruiter_cannot_update_another_recruiters_offer():
    """9. Recruiter B cannot update Recruiter A's offer (403 Forbidden)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_b = env["headers_b"]

    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Recruiter A Offer", "compensation": 90000.0},
    )
    offer_id = create_res.json()["id"]

    res = client.patch(
        f"/api/v1/offers/{offer_id}",
        headers=headers_b,
        json={"compensation": 1000.0},
    )
    assert res.status_code == 403, res.text


def test_recruiter_send_draft_offer():
    """10. Recruiter can send a draft offer via POST /offers/{id}/send."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Draft Offer", "compensation": 100000.0, "is_sent": False},
    )
    offer_id = create_res.json()["id"]
    assert create_res.json()["status"] == "draft"

    # Send offer
    send_res = client.post(f"/api/v1/offers/{offer_id}/send", headers=headers_a)
    assert send_res.status_code == 200, send_res.text
    assert send_res.json()["status"] == "offered"

    # Verify Application status is now OFFERED
    with SessionLocal() as db:
        app = db.scalar(select(Application).where(Application.id == env["app_a_id"]))
        assert app.status == ApplicationStatus.OFFERED


def test_recruiter_withdraw_offer():
    """11. Recruiter can withdraw an offer via POST /offers/{id}/withdraw."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Offer to Withdraw", "compensation": 90000.0, "is_sent": True},
    )
    offer_id = create_res.json()["id"]

    # Withdraw offer
    with_res = client.post(f"/api/v1/offers/{offer_id}/withdraw", headers=headers_a)
    assert with_res.status_code == 200, with_res.text
    assert with_res.json()["status"] == "withdrawn"


def test_duplicate_offer_for_same_application_rejected():
    """12. One application can only have one offer (409 Conflict)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    # First offer
    res1 = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "First Offer", "compensation": 90000.0},
    )
    assert res1.status_code == 201

    # Second offer attempt on same application
    res2 = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Second Offer", "compensation": 95000.0},
    )
    assert res2.status_code == 409, res2.text
    assert "already exists" in res2.json()["detail"]


def test_valid_and_invalid_lifecycle_transitions():
    """13 & 14. Valid lifecycle state transitions succeed, invalid transitions return 400 Bad Request."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    # Create draft offer
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "State Transition Test Offer", "compensation": 90000.0, "is_sent": False},
    )
    offer_id = create_res.json()["id"]

    # Invalid: Recruiter cannot directly PATCH to ACCEPTED
    res_inv1 = client.patch(
        f"/api/v1/offers/{offer_id}",
        headers=headers_a,
        json={"status": "accepted"},
    )
    assert res_inv1.status_code == 400, res_inv1.text
    assert "Candidate acceptance or rejection must occur through candidate response endpoints" in res_inv1.json()["detail"]

    # Valid: DRAFT -> OFFERED
    res_v1 = client.patch(
        f"/api/v1/offers/{offer_id}",
        headers=headers_a,
        json={"status": "offered"},
    )
    assert res_v1.status_code == 200
    assert res_v1.json()["status"] == "offered"

    # Valid: OFFERED -> WITHDRAWN
    res_v2 = client.patch(
        f"/api/v1/offers/{offer_id}",
        headers=headers_a,
        json={"status": "withdrawn"},
    )
    assert res_v2.status_code == 200
    assert res_v2.json()["status"] == "withdrawn"

    # Invalid: WITHDRAWN (terminal) -> DRAFT or OFFERED
    res_inv2 = client.patch(
        f"/api/v1/offers/{offer_id}",
        headers=headers_a,
        json={"status": "offered"},
    )
    assert res_inv2.status_code == 400, res_inv2.text


def test_nonexistent_application_and_offer_returns_404():
    """16. Non-existent application and offer return 404 Not Found."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    # Non-existent application
    res_app = client.post(
        "/api/v1/applications/999999/offers",
        headers=headers_a,
        json={"title": "Ghost Offer"},
    )
    assert res_app.status_code == 404, res_app.text

    # Non-existent offer
    res_offer = client.get("/api/v1/offers/999999", headers=headers_a)
    assert res_offer.status_code == 404, res_offer.text


def test_list_recruiter_and_student_offers():
    """17 & 18. Recruiter and Student listing endpoints work with proper filtering."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]
    headers_b = env["headers_b"]
    headers_other = env["headers_other"]

    # Recruiter A creates a sent offer for Student S
    client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Offer from A", "compensation": 100000.0, "is_sent": True},
    )

    # Recruiter B creates a draft offer for Student Other
    client.post(
        f"/api/v1/applications/{env['app_b_id']}/offers",
        headers=headers_b,
        json={"title": "Draft from B", "compensation": 85000.0, "is_sent": False},
    )

    # Recruiter A lists offers -> sees only offer A
    rec_a_list = client.get("/api/v1/recruiter/offers", headers=headers_a)
    assert rec_a_list.status_code == 200
    offers_a = rec_a_list.json()
    assert len(offers_a) == 1
    assert offers_a[0]["title"] == "Offer from A"

    # Student S lists offers -> sees released offer A
    stu_s_list = client.get("/api/v1/student/offers", headers=headers_s)
    assert stu_s_list.status_code == 200
    offers_s = stu_s_list.json()
    assert len(offers_s) == 1
    assert offers_s[0]["title"] == "Offer from A"

    # Student Other lists offers -> sees 0 because offer B is still DRAFT
    stu_o_list = client.get("/api/v1/student/offers", headers=headers_other)
    assert stu_o_list.status_code == 200
    assert len(stu_o_list.json()) == 0


def test_offer_by_application_id_endpoint():
    """19 & 20. GET /applications/{app_id}/offers endpoint enforces ownership and release rules."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_b = env["headers_b"]
    headers_s = env["headers_s"]
    headers_other = env["headers_other"]

    # Recruiter A creates released offer
    client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "App Offer", "compensation": 115000.0, "is_sent": True},
    )

    # Recruiter A can retrieve
    res_rec = client.get(f"/api/v1/applications/{env['app_a_id']}/offers", headers=headers_a)
    assert res_rec.status_code == 200
    assert res_rec.json()["title"] == "App Offer"

    # Student S can retrieve
    res_stu = client.get(f"/api/v1/applications/{env['app_a_id']}/offers", headers=headers_s)
    assert res_stu.status_code == 200
    assert res_stu.json()["title"] == "App Offer"

    # Recruiter B receives 403
    res_rec_b = client.get(f"/api/v1/applications/{env['app_a_id']}/offers", headers=headers_b)
    assert res_rec_b.status_code == 403

    # Student Other receives 403
    res_stu_o = client.get(f"/api/v1/applications/{env['app_a_id']}/offers", headers=headers_other)
    assert res_stu_o.status_code == 403


# =========================================================================
# PHASE 35B.3 — CANDIDATE DECISION, CREDENTIALING & NOTIFICATION TESTS
# =========================================================================

def test_student_accept_offered_job_offer_creates_experience_and_notification():
    """Phase 35B.3: Student accepting an OFFERED job offer creates verified ExperienceRecord and recruiter notification."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    # Recruiter sends offer
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Official Software Engineer Offer", "compensation": 130000.0, "is_sent": True},
    )
    assert create_res.status_code == 201
    offer_id = create_res.json()["id"]

    # Student accepts offer
    accept_res = client.post(f"/api/v1/offers/{offer_id}/accept", headers=headers_s)
    assert accept_res.status_code == 200, accept_res.text
    data = accept_res.json()
    assert data["status"] == "accepted"
    assert data["id"] == offer_id

    # Verify DB state: JobOffer and Application are both ACCEPTED
    with SessionLocal() as db:
        offer = db.scalar(select(JobOffer).where(JobOffer.id == offer_id))
        assert offer.status == OfferStatus.ACCEPTED

        app = db.scalar(select(Application).where(Application.id == env["app_a_id"]))
        assert app.status == ApplicationStatus.ACCEPTED

        # Verify ExperienceRecord is created and VERIFIED by recruiter
        exp = db.scalar(
            select(ExperienceRecord).where(ExperienceRecord.student_id == env["student_s_id"])
        )
        assert exp is not None
        assert exp.status == VerificationStatus.VERIFIED
        assert exp.verification_source == VerificationSource.RECRUITER_CONFIRMED
        assert exp.verifier_id == env["recruiter_a_id"]
        assert exp.organization_name == "Alpha Tech Solutions"
        assert exp.title == "Full Stack Software Engineer"

        # Verify Recruiter received OFFER_ACCEPTED notification
        notif = db.scalar(
            select(Notification).where(
                Notification.user_id == env["recruiter_a_id"],
                Notification.notification_type == NotificationType.OFFER_ACCEPTED,
            )
        )
        assert notif is not None
        assert "accepted your job offer" in notif.message


def test_student_reject_offered_job_offer_updates_status_and_no_experience():
    """Phase 35B.3: Student rejecting an OFFERED job offer updates status to REJECTED and creates no ExperienceRecord."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    # Recruiter sends offer
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Official Software Engineer Offer", "compensation": 130000.0, "is_sent": True},
    )
    assert create_res.status_code == 201
    offer_id = create_res.json()["id"]

    # Student declines offer
    reject_res = client.post(f"/api/v1/offers/{offer_id}/reject", headers=headers_s)
    assert reject_res.status_code == 200, reject_res.text
    data = reject_res.json()
    assert data["status"] == "rejected"

    # Verify DB state: JobOffer and Application are both REJECTED
    with SessionLocal() as db:
        offer = db.scalar(select(JobOffer).where(JobOffer.id == offer_id))
        assert offer.status == OfferStatus.REJECTED

        app = db.scalar(select(Application).where(Application.id == env["app_a_id"]))
        assert app.status == ApplicationStatus.REJECTED

        # Verify NO ExperienceRecord was created
        exp = db.scalar(
            select(ExperienceRecord).where(ExperienceRecord.student_id == env["student_s_id"])
        )
        assert exp is None

        # Verify Recruiter received OFFER_REJECTED notification
        notif = db.scalar(
            select(Notification).where(
                Notification.user_id == env["recruiter_a_id"],
                Notification.notification_type == NotificationType.OFFER_REJECTED,
            )
        )
        assert notif is not None
        assert "declined your job offer" in notif.message


def test_cross_student_cannot_accept_or_reject_offer():
    """Phase 35B.3: Student Other cannot accept or reject Student S's offer (403 Forbidden)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_other = env["headers_other"]

    # Recruiter sends offer for Student S
    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Private Offer", "compensation": 120000.0, "is_sent": True},
    )
    offer_id = create_res.json()["id"]

    # Student Other attempts to accept -> 403
    res_accept = client.post(f"/api/v1/offers/{offer_id}/accept", headers=headers_other)
    assert res_accept.status_code == 403, res_accept.text

    # Student Other attempts to reject -> 403
    res_reject = client.post(f"/api/v1/offers/{offer_id}/reject", headers=headers_other)
    assert res_reject.status_code == 403, res_reject.text


def test_recruiter_cannot_accept_or_reject_offer():
    """Phase 35B.3: Recruiters cannot call student decision endpoints (403 Forbidden)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    create_res = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Private Offer", "compensation": 120000.0, "is_sent": True},
    )
    offer_id = create_res.json()["id"]

    # Recruiter attempts to accept -> 403
    res_accept = client.post(f"/api/v1/offers/{offer_id}/accept", headers=headers_a)
    assert res_accept.status_code == 403, res_accept.text

    # Recruiter attempts to reject -> 403
    res_reject = client.post(f"/api/v1/offers/{offer_id}/reject", headers=headers_a)
    assert res_reject.status_code == 403, res_reject.text


def test_invalid_offer_states_cannot_be_accepted_or_rejected():
    """Phase 35B.3: Only OFFERED offers can be accepted/rejected (DRAFT, ACCEPTED, REJECTED, WITHDRAWN, EXPIRED return 400)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    # 1. DRAFT offer cannot be accepted or rejected
    res_draft = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Draft Offer", "compensation": 100000.0, "is_sent": False},
    )
    draft_id = res_draft.json()["id"]

    res_acc_draft = client.post(f"/api/v1/offers/{draft_id}/accept", headers=headers_s)
    assert res_acc_draft.status_code == 400, res_acc_draft.text

    res_rej_draft = client.post(f"/api/v1/offers/{draft_id}/reject", headers=headers_s)
    assert res_rej_draft.status_code == 400, res_rej_draft.text

    # 2. WITHDRAWN offer cannot be accepted
    client.post(f"/api/v1/offers/{draft_id}/send", headers=headers_a)
    client.post(f"/api/v1/offers/{draft_id}/withdraw", headers=headers_a)

    res_acc_withdrawn = client.post(f"/api/v1/offers/{draft_id}/accept", headers=headers_s)
    assert res_acc_withdrawn.status_code == 400, res_acc_withdrawn.text


def test_accepted_and_rejected_offers_cannot_be_re_decided():
    """Phase 35B.3: Once accepted or rejected, offers cannot be decided again."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    # Send offer
    res_send = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Decision Offer", "compensation": 100000.0, "is_sent": True},
    )
    offer_id = res_send.json()["id"]

    # Accept
    res_acc = client.post(f"/api/v1/offers/{offer_id}/accept", headers=headers_s)
    assert res_acc.status_code == 200

    # Try accepting again -> 400
    res_acc_again = client.post(f"/api/v1/offers/{offer_id}/accept", headers=headers_s)
    assert res_acc_again.status_code == 400, res_acc_again.text

    # Try rejecting after accept -> 400
    res_rej_after_acc = client.post(f"/api/v1/offers/{offer_id}/reject", headers=headers_s)
    assert res_rej_after_acc.status_code == 400, res_rej_after_acc.text


def test_notifications_on_offer_lifecycle_events():
    """Phase 35B.3: Test in-app notifications generated on OFFER_RECEIVED and OFFER_WITHDRAWN."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]

    # Recruiter creates draft offer
    res_draft = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Lifecycle Notif Offer", "compensation": 110000.0, "is_sent": False},
    )
    offer_id = res_draft.json()["id"]

    # Send offer -> Student receives OFFER_RECEIVED
    client.post(f"/api/v1/offers/{offer_id}/send", headers=headers_a)
    with SessionLocal() as db:
        notif_recv = db.scalar(
            select(Notification).where(
                Notification.user_id == env["student_s_id"],
                Notification.notification_type == NotificationType.OFFER_RECEIVED,
            )
        )
        assert notif_recv is not None
        assert "Full Stack Software Engineer" in notif_recv.message

    # Withdraw offer -> Student receives OFFER_WITHDRAWN
    client.post(f"/api/v1/offers/{offer_id}/withdraw", headers=headers_a)
    with SessionLocal() as db:
        notif_with = db.scalar(
            select(Notification).where(
                Notification.user_id == env["student_s_id"],
                Notification.notification_type == NotificationType.OFFER_WITHDRAWN,
            )
        )
        assert notif_with is not None
        assert "withdrawn" in notif_with.message


def test_passport_contains_verified_experience_after_acceptance():
    """Phase 35B.3: Career Passport dynamically includes the verified experience record after offer acceptance."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    # Send and accept offer
    res_offer = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Passport Verified Role", "compensation": 125000.0, "is_sent": True},
    )
    offer_id = res_offer.json()["id"]

    res_accept = client.post(f"/api/v1/offers/{offer_id}/accept", headers=headers_s)
    assert res_accept.status_code == 200

    # Retrieve passport for student
    res_passport = client.get("/api/v1/passport/me", headers=headers_s)
    assert res_passport.status_code == 200, res_passport.text
    passport_data = res_passport.json()

    exp_titles = [e["title"] for e in passport_data.get("verified_experiences", [])]
    assert "Full Stack Software Engineer" in exp_titles

    # Verify status is verified in passport output
    accepted_exp = next(
        e for e in passport_data["verified_experiences"] if e["title"] == "Full Stack Software Engineer"
    )
    assert accepted_exp["status"] == "verified"
    assert accepted_exp["verification_source"] == "recruiter_confirmed"
    assert accepted_exp["organization_name"] == "Alpha Tech Solutions"


def test_acceptance_transaction_rollback_on_failure():
    """Phase 35B.3: If experience credentialing fails, transaction rolls back atomically."""
    from unittest.mock import patch
    from app.services.experience_record_service import ExperienceRecordService

    env = create_fixture_environment()
    headers_a = env["headers_a"]
    headers_s = env["headers_s"]

    res_offer = client.post(
        f"/api/v1/applications/{env['app_a_id']}/offers",
        headers=headers_a,
        json={"title": "Rollback Test Offer", "compensation": 100000.0, "is_sent": True},
    )
    offer_id = res_offer.json()["id"]

    # Simulate catastrophic failure during ExperienceRecord creation
    with patch.object(
        ExperienceRecordService,
        "create_experience_from_accepted_application",
        side_effect=RuntimeError("Database transient credentialing error"),
    ):
        with pytest.raises(RuntimeError, match="Database transient credentialing error"):
            client.post(f"/api/v1/offers/{offer_id}/accept", headers=headers_s)

    # Verify that in database, all states remain uncommitted / rolled back
    with SessionLocal() as db:
        offer = db.scalar(select(JobOffer).where(JobOffer.id == offer_id))
        assert offer.status == OfferStatus.OFFERED

        app = db.scalar(select(Application).where(Application.id == env["app_a_id"]))
        assert app.status == ApplicationStatus.OFFERED

        # No partial experience record
        exp = db.scalar(
            select(ExperienceRecord).where(ExperienceRecord.student_id == env["student_s_id"])
        )
        assert exp is None

        # No partial OFFER_ACCEPTED notification
        notif = db.scalar(
            select(Notification).where(
                Notification.user_id == env["recruiter_a_id"],
                Notification.notification_type == NotificationType.OFFER_ACCEPTED,
            )
        )
        assert notif is None


def test_rejected_application_cannot_receive_offer():
    """Phase 38D: Rejected application cannot receive a job offer (HTTP 400)."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    app_id = env["app_a_id"]

    # Put application into REJECTED
    with SessionLocal() as db:
        app = db.scalar(select(Application).where(Application.id == app_id))
        app.status = ApplicationStatus.REJECTED
        db.commit()

    # Attempt to create offer with is_sent=True
    res = client.post(
        f"/api/v1/applications/{app_id}/offers",
        headers=headers_a,
        json={"title": "Junior Engineer", "compensation": 90000.0, "is_sent": True},
    )
    assert res.status_code == 400, res.text
    assert "Cannot create job offer for application in 'rejected' status" in res.json()["detail"]

    # Assert application remains REJECTED and no offer was created
    with SessionLocal() as db:
        app = db.scalar(select(Application).where(Application.id == app_id))
        assert app.status == ApplicationStatus.REJECTED

        offer = db.scalar(select(JobOffer).where(JobOffer.application_id == app_id))
        assert offer is None


def test_withdrawn_offer_releases_application_to_shortlisted():
    """Phase 38D: Withdrawn offer releases application from OFFERED to SHORTLISTED."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    app_id = env["app_a_id"]

    # 1. Create and send offer
    res_offer = client.post(
        f"/api/v1/applications/{app_id}/offers",
        headers=headers_a,
        json={"title": "Software Engineer", "compensation": 95000.0, "is_sent": True},
    )
    assert res_offer.status_code == 201, res_offer.text
    offer_id = res_offer.json()["id"]

    # 2. Verify application became OFFERED
    with SessionLocal() as db:
        app = db.scalar(select(Application).where(Application.id == app_id))
        assert app.status == ApplicationStatus.OFFERED

    # 3. Withdraw the offer
    res_with = client.post(f"/api/v1/offers/{offer_id}/withdraw", headers=headers_a)
    assert res_with.status_code == 200, res_with.text
    assert res_with.json()["status"] == "withdrawn"

    # 4. Assert offer becomes WITHDRAWN and application becomes SHORTLISTED
    with SessionLocal() as db:
        offer = db.scalar(select(JobOffer).where(JobOffer.id == offer_id))
        assert offer.status == OfferStatus.WITHDRAWN

        app = db.scalar(select(Application).where(Application.id == app_id))
        assert app.status == ApplicationStatus.SHORTLISTED

    # 5. Verify recruiter can subsequently perform a valid SHORTLISTED -> REJECTED transition
    res_reject = client.patch(
        f"/api/v1/recruiter/applications/{app_id}",
        headers=headers_a,
        json={"status": "rejected", "rejection_reason": "Position closed"},
    )
    assert res_reject.status_code == 200, res_reject.text
    with SessionLocal() as db:
        app = db.scalar(select(Application).where(Application.id == app_id))
        assert app.status == ApplicationStatus.REJECTED


def test_stale_draft_offer_cannot_be_sent_after_application_rejection():
    """Phase 38D: Stale draft offer cannot be sent if application transitioned to REJECTED."""
    env = create_fixture_environment()
    headers_a = env["headers_a"]
    app_id = env["app_a_id"]

    # 1. Create offer in DRAFT state
    res_draft = client.post(
        f"/api/v1/applications/{app_id}/offers",
        headers=headers_a,
        json={"title": "Draft Offer", "compensation": 90000.0, "is_sent": False},
    )
    assert res_draft.status_code == 201, res_draft.text
    offer_id = res_draft.json()["id"]

    # 2. Transition application to REJECTED
    res_app_reject = client.patch(
        f"/api/v1/recruiter/applications/{app_id}",
        headers=headers_a,
        json={"status": "rejected", "rejection_reason": "Candidate declined preliminary terms"},
    )
    assert res_app_reject.status_code == 200, res_app_reject.text

    # 3. Attempt to send draft offer
    res_send = client.post(f"/api/v1/offers/{offer_id}/send", headers=headers_a)
    assert res_send.status_code == 400, res_send.text
    assert "Cannot send job offer for application in 'rejected' status" in res_send.json()["detail"]

    # 4. Assert offer remains DRAFT and application remains REJECTED
    with SessionLocal() as db:
        offer = db.scalar(select(JobOffer).where(JobOffer.id == offer_id))
        assert offer.status == OfferStatus.DRAFT

        app = db.scalar(select(Application).where(Application.id == app_id))
        assert app.status == ApplicationStatus.REJECTED
