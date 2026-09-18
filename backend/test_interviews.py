"""
CareerBridge Phase 18 Interviews & Interview Scheduling Foundation Test Suite
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.interview import Interview, InterviewStatus, InterviewType
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.notification import Notification, NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER1_EMAIL = "interview.recruiter1@careerbridge.io"
RECRUITER2_EMAIL = "interview.recruiter2@careerbridge.io"
STUDENT1_EMAIL = "interview.student1@careerbridge.io"
STUDENT2_EMAIL = "interview.student2@careerbridge.io"
ADMIN_EMAIL = "interview.admin@careerbridge.io"
INACTIVE_EMAIL = "interview.inactive@careerbridge.io"
TEST_PASSWORD = "InterviewTestPassword123!"


def setup_module():
    """Seed test users, jobs, applications, and clean prior test data."""
    teardown_module()
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

        # Users
        rec1 = User(
            email=RECRUITER1_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        rec2 = User(
            email=RECRUITER2_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        stu1 = User(
            email=STUDENT1_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        stu2 = User(
            email=STUDENT2_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        admin = User(
            email=ADMIN_EMAIL,
            password_hash=hashed,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        inactive = User(
            email=INACTIVE_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=False,
            is_verified=True,
        )
        db.add_all([rec1, rec2, stu1, stu2, admin, inactive])
        db.commit()
        db.refresh(rec1)
        db.refresh(rec2)
        db.refresh(stu1)
        db.refresh(stu2)

        # Recruiter profiles
        rp1 = RecruiterProfile(
            user_id=rec1.id,
            company_name="AlphaTech Innovations",
            is_verified=True,
        )
        rp2 = RecruiterProfile(
            user_id=rec2.id,
            company_name="BetaGlobal Systems",
            is_verified=True,
        )
        db.add_all([rp1, rp2])
        db.commit()

        # Job postings
        job1 = JobPosting(
            recruiter_id=rec1.id,
            title="Senior Python Backend Engineer",
            description="Build scalable APIs and distributed backends",
            opportunity_type=OpportunityType.JOB,
            company_name="AlphaTech Innovations",
            is_remote=True,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        job2 = JobPosting(
            recruiter_id=rec2.id,
            title="Frontend React Specialist",
            description="Build modern user interfaces",
            opportunity_type=OpportunityType.JOB,
            company_name="BetaGlobal Systems",
            is_remote=True,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        db.add_all([job1, job2])
        db.commit()
        db.refresh(job1)
        db.refresh(job2)

        # Applications
        # app1: student 1 applies to job 1 (recruiter 1) -> applied
        app1 = Application(
            job_posting_id=job1.id,
            student_id=stu1.id,
            status=ApplicationStatus.APPLIED,
            cover_message="Passionate about Python backends",
        )
        # app2: student 2 applies to job 1 (recruiter 1) -> shortlisted
        app2 = Application(
            job_posting_id=job1.id,
            student_id=stu2.id,
            status=ApplicationStatus.SHORTLISTED,
            cover_message="Strong background in algorithms",
        )
        # app3: student 1 applies to job 2 (recruiter 2) -> rejected
        app3 = Application(
            job_posting_id=job2.id,
            student_id=stu1.id,
            status=ApplicationStatus.REJECTED,
            cover_message="Frontend interest",
        )
        # app4: student 2 applies to job 2 (recruiter 2) -> accepted
        app4 = Application(
            job_posting_id=job2.id,
            student_id=stu2.id,
            status=ApplicationStatus.ACCEPTED,
            cover_message="Accepted candidate",
        )
        db.add_all([app1, app2, app3, app4])
        db.commit()


def teardown_module():
    """Clean up test users and related records."""
    emails = [
        RECRUITER1_EMAIL,
        RECRUITER2_EMAIL,
        STUDENT1_EMAIL,
        STUDENT2_EMAIL,
        ADMIN_EMAIL,
        INACTIVE_EMAIL,
    ]
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.email.in_(emails))).all()
        for u in users:
            db.delete(u)
        db.commit()


def get_auth_headers(email: str) -> dict:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user, f"User {email} not found"
        token = create_access_token(subject=user.id)
        return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------
# 1. Authentication Tests
# --------------------------------------------------------------------------
def test_unauthenticated_requests_rejected():
    endpoints = [
        ("POST", "/api/v1/applications/1/interviews", {}),
        ("GET", "/api/v1/interviews/me", None),
        ("GET", "/api/v1/recruiter/interviews", None),
        ("GET", "/api/v1/interviews/1", None),
        ("PATCH", "/api/v1/interviews/1", {}),
        ("DELETE", "/api/v1/interviews/1", None),
    ]
    for method, path, body in endpoints:
        if method == "POST":
            resp = client.post(path, json=body)
        elif method == "GET":
            resp = client.get(path)
        elif method == "PATCH":
            resp = client.patch(path, json=body)
        elif method == "DELETE":
            resp = client.delete(path)
        assert resp.status_code == 401, f"{method} {path} expected 401, got {resp.status_code}"


def test_inactive_user_rejected():
    headers = get_auth_headers(INACTIVE_EMAIL)
    resp = client.get("/api/v1/recruiter/interviews", headers=headers)
    assert resp.status_code == 401


# --------------------------------------------------------------------------
# 2. RBAC Tests
# --------------------------------------------------------------------------
def test_student_cannot_create_interview():
    headers = get_auth_headers(STUDENT1_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    resp = client.post(
        "/api/v1/applications/1/interviews",
        headers=headers,
        json={
            "scheduled_at": future_time,
            "duration_minutes": 45,
            "interview_type": "online",
        },
    )
    assert resp.status_code == 403


def test_student_cannot_access_recruiter_interviews():
    headers = get_auth_headers(STUDENT1_EMAIL)
    resp = client.get("/api/v1/recruiter/interviews", headers=headers)
    assert resp.status_code == 403


def test_recruiter_cannot_access_student_interviews():
    headers = get_auth_headers(RECRUITER1_EMAIL)
    resp = client.get("/api/v1/interviews/me", headers=headers)
    assert resp.status_code == 403


def test_student_cannot_update_or_cancel_interview():
    headers = get_auth_headers(STUDENT1_EMAIL)
    resp1 = client.patch("/api/v1/interviews/1", headers=headers, json={"duration_minutes": 60})
    assert resp1.status_code == 403

    resp2 = client.delete("/api/v1/interviews/1", headers=headers)
    assert resp2.status_code == 403


# --------------------------------------------------------------------------
# 3. Validation Tests
# --------------------------------------------------------------------------
def test_validation_missing_application():
    headers = get_auth_headers(RECRUITER1_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    resp = client.post(
        "/api/v1/applications/999999/interviews",
        headers=headers,
        json={
            "scheduled_at": future_time,
            "duration_minutes": 45,
            "interview_type": "online",
        },
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Application not found"


def test_validation_invalid_duration():
    with SessionLocal() as db:
        app1 = db.scalar(select(Application).join(JobPosting).where(JobPosting.title == "Senior Python Backend Engineer"))
        app_id = app1.id

    headers = get_auth_headers(RECRUITER1_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    # Duration = 0
    resp1 = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        headers=headers,
        json={"scheduled_at": future_time, "duration_minutes": 0},
    )
    assert resp1.status_code == 422

    # Negative duration
    resp2 = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        headers=headers,
        json={"scheduled_at": future_time, "duration_minutes": -15},
    )
    assert resp2.status_code == 422

    # Excessive duration (> 480)
    resp3 = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        headers=headers,
        json={"scheduled_at": future_time, "duration_minutes": 500},
    )
    assert resp3.status_code == 422


def test_validation_invalid_interview_type():
    with SessionLocal() as db:
        app1 = db.scalar(select(Application).join(JobPosting).where(JobPosting.title == "Senior Python Backend Engineer"))
        app_id = app1.id

    headers = get_auth_headers(RECRUITER1_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    resp = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        headers=headers,
        json={
            "scheduled_at": future_time,
            "duration_minutes": 45,
            "interview_type": "telepathic",
        },
    )
    assert resp.status_code == 422


def test_validation_excessive_notes_and_link():
    with SessionLocal() as db:
        app1 = db.scalar(select(Application).join(JobPosting).where(JobPosting.title == "Senior Python Backend Engineer"))
        app_id = app1.id

    headers = get_auth_headers(RECRUITER1_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    # Link > 500 chars
    resp1 = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        headers=headers,
        json={
            "scheduled_at": future_time,
            "duration_minutes": 45,
            "location_or_link": "https://meet.google.com/" + "a" * 500,
        },
    )
    assert resp1.status_code == 422

    # Notes > 2000 chars
    resp2 = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        headers=headers,
        json={
            "scheduled_at": future_time,
            "duration_minutes": 45,
            "notes": "x" * 2005,
        },
    )
    assert resp2.status_code == 422


# --------------------------------------------------------------------------
# 4. Application Status Rules
# --------------------------------------------------------------------------
def test_application_status_rules_rejected_and_accepted():
    with SessionLocal() as db:
        app_rejected = db.scalar(select(Application).where(Application.status == ApplicationStatus.REJECTED))
        app_accepted = db.scalar(select(Application).where(Application.status == ApplicationStatus.ACCEPTED))
        rej_id = app_rejected.id
        acc_id = app_accepted.id

    rec2_headers = get_auth_headers(RECRUITER2_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    # Rejected application cannot be scheduled
    resp_rej = client.post(
        f"/api/v1/applications/{rej_id}/interviews",
        headers=rec2_headers,
        json={"scheduled_at": future_time, "duration_minutes": 30},
    )
    assert resp_rej.status_code == 400
    assert "rejected" in resp_rej.json()["detail"].lower()

    # Accepted application cannot be scheduled
    resp_acc = client.post(
        f"/api/v1/applications/{acc_id}/interviews",
        headers=rec2_headers,
        json={"scheduled_at": future_time, "duration_minutes": 30},
    )
    assert resp_acc.status_code == 400
    assert "accepted" in resp_acc.json()["detail"].lower()


# --------------------------------------------------------------------------
# 5. Ownership & Authorization
# --------------------------------------------------------------------------
def test_cross_recruiter_scheduling_blocked():
    with SessionLocal() as db:
        # App 1 is owned by Recruiter 1
        app1 = db.scalar(select(Application).join(JobPosting).where(JobPosting.title == "Senior Python Backend Engineer"))
        app1_id = app1.id

    rec2_headers = get_auth_headers(RECRUITER2_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()

    # Recruiter 2 tries to schedule interview for Recruiter 1's application -> 403
    resp = client.post(
        f"/api/v1/applications/{app1_id}/interviews",
        headers=rec2_headers,
        json={"scheduled_at": future_time, "duration_minutes": 45},
    )
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()


# --------------------------------------------------------------------------
# 6. CRUD & Notification Triggers
# --------------------------------------------------------------------------
def test_create_interview_success_and_notification():
    with SessionLocal() as db:
        app1 = db.scalar(select(Application).join(JobPosting).where(JobPosting.title == "Senior Python Backend Engineer"))
        app1_id = app1.id
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        stu1_id = stu1.id

    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)

    before_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]

    # Target scheduled time: tomorrow 10:00 UTC
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    interview_time = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)

    create_resp = client.post(
        f"/api/v1/applications/{app1_id}/interviews",
        headers=rec1_headers,
        json={
            "scheduled_at": interview_time.isoformat(),
            "duration_minutes": 60,
            "interview_type": "online",
            "location_or_link": "https://meet.google.com/abc-defg-hij",
            "notes": "System design round focusing on PostgreSQL indexing",
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["application_id"] == app1_id
    assert created["duration_minutes"] == 60
    assert created["interview_type"] == "online"
    assert created["status"] == "scheduled"
    assert created["job_title"] == "Senior Python Backend Engineer"
    assert created["company_name"] == "AlphaTech Innovations"
    assert created["candidate_email"] == STUDENT1_EMAIL
    assert created["recruiter_email"] == RECRUITER1_EMAIL
    assert "password_hash" not in created

    # Verify student received INTERVIEW_SCHEDULED notification
    after_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]
    assert after_notifs == before_notifs + 1

    notif_list = client.get("/api/v1/notifications?page=1&page_size=1", headers=stu1_headers).json()
    newest = notif_list["items"][0]
    assert newest["notification_type"] == "interview_scheduled"
    assert "AlphaTech Innovations" in newest["message"]


def test_get_single_interview_access_control():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)
    rec2_headers = get_auth_headers(RECRUITER2_EMAIL)
    admin_headers = get_auth_headers(ADMIN_EMAIL)

    with SessionLocal() as db:
        interview = db.scalar(select(Interview).order_by(Interview.id.desc()))
        interview_id = interview.id

    # Recruiter 1 (owner) -> 200
    r_resp = client.get(f"/api/v1/interviews/{interview_id}", headers=rec1_headers)
    assert r_resp.status_code == 200
    assert r_resp.json()["id"] == interview_id

    # Student 1 (participant) -> 200
    s_resp = client.get(f"/api/v1/interviews/{interview_id}", headers=stu1_headers)
    assert s_resp.status_code == 200
    assert s_resp.json()["id"] == interview_id

    # Admin -> 200
    a_resp = client.get(f"/api/v1/interviews/{interview_id}", headers=admin_headers)
    assert a_resp.status_code == 200

    # Recruiter 2 (unrelated) -> 403
    r2_resp = client.get(f"/api/v1/interviews/{interview_id}", headers=rec2_headers)
    assert r2_resp.status_code == 403

    # Student 2 (unrelated) -> 403
    s2_resp = client.get(f"/api/v1/interviews/{interview_id}", headers=stu2_headers)
    assert s2_resp.status_code == 403

    # Non-existent interview -> 404
    missing_resp = client.get("/api/v1/interviews/999999", headers=rec1_headers)
    assert missing_resp.status_code == 404


def test_student_and_recruiter_listings():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    stu2_headers = get_auth_headers(STUDENT2_EMAIL)

    # Student 1 list contains 1 interview
    s1_list = client.get("/api/v1/interviews/me", headers=stu1_headers).json()
    assert len(s1_list) >= 1
    assert s1_list[0]["candidate_email"] == STUDENT1_EMAIL

    # Student 2 list contains 0 interviews
    s2_list = client.get("/api/v1/interviews/me", headers=stu2_headers).json()
    assert len(s2_list) == 0

    # Recruiter 1 list contains at least 1 interview
    r1_list = client.get("/api/v1/recruiter/interviews", headers=rec1_headers).json()
    assert len(r1_list) >= 1
    assert r1_list[0]["recruiter_email"] == RECRUITER1_EMAIL


# --------------------------------------------------------------------------
# 7. Double-Booking Conflict Protection
# --------------------------------------------------------------------------
def test_recruiter_and_student_conflict_detection():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        # Existing interview is at tomorrow 10:00 - 11:00 UTC for rec1 and stu1
        existing = db.scalar(select(Interview).where(Interview.status == InterviewStatus.SCHEDULED))
        start = existing.scheduled_at
        # App 2 is for job 1 (rec1) and student 2
        app2 = db.scalar(select(Application).where(Application.status == ApplicationStatus.SHORTLISTED))
        app2_id = app2.id

    # Test Recruiter Overlap:
    # Recruiter 1 tries to schedule another interview with Student 2 overlapping at 10:30 (during 10:00 - 11:00)
    conflict_time = (start + timedelta(minutes=30)).isoformat()
    resp_rec_conflict = client.post(
        f"/api/v1/applications/{app2_id}/interviews",
        headers=rec1_headers,
        json={"scheduled_at": conflict_time, "duration_minutes": 45},
    )
    assert resp_rec_conflict.status_code == 409
    assert "recruiter has a conflicting interview" in resp_rec_conflict.json()["detail"].lower()

    # Test Student Overlap:
    # Recruiter 2 tries to schedule interview for Student 1 at overlapping time 10:15
    # Create application for student 1 on job 3 in 'reviewing' state
    with SessionLocal() as db:
        rec2 = db.scalar(select(User).where(User.email == RECRUITER2_EMAIL))
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        job3 = JobPosting(
            recruiter_id=rec2.id,
            title="DevOps Cloud Engineer",
            description="Infrastructure and Kubernetes",
            opportunity_type=OpportunityType.JOB,
            company_name="BetaGlobal Systems",
            is_remote=True,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        db.add(job3)
        db.commit()
        db.refresh(job3)

        app_reviewing = Application(
            job_posting_id=job3.id,
            student_id=stu1.id,
            status=ApplicationStatus.REVIEWING,
        )
        db.add(app_reviewing)
        db.commit()
        db.refresh(app_reviewing)
        app_rev_id = app_reviewing.id

    rec2_headers = get_auth_headers(RECRUITER2_EMAIL)
    resp_stu_conflict = client.post(
        f"/api/v1/applications/{app_rev_id}/interviews",
        headers=rec2_headers,
        json={"scheduled_at": conflict_time, "duration_minutes": 30},
    )
    assert resp_stu_conflict.status_code == 409
    assert "student has a conflicting interview" in resp_stu_conflict.json()["detail"].lower()


def test_non_overlapping_interview_succeeds():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        existing = db.scalar(select(Interview).where(Interview.status == InterviewStatus.SCHEDULED))
        start = existing.scheduled_at
        app2 = db.scalar(select(Application).where(Application.status == ApplicationStatus.SHORTLISTED))
        app2_id = app2.id

    # Non-overlapping time: exactly when previous one ends or later (11:00 UTC)
    non_conflict_time = (start + timedelta(minutes=60)).isoformat()
    resp = client.post(
        f"/api/v1/applications/{app2_id}/interviews",
        headers=rec1_headers,
        json={"scheduled_at": non_conflict_time, "duration_minutes": 45},
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "scheduled"


# --------------------------------------------------------------------------
# 8. Update / Reschedule & Cancellation
# --------------------------------------------------------------------------
def test_update_and_reschedule_interview():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)

    with SessionLocal() as db:
        interview = db.scalar(
            select(Interview).join(Application).where(Application.student_id == db.scalar(select(User.id).where(User.email == STUDENT1_EMAIL)))
        )
        interview_id = interview.id

    before_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]

    # Reschedule to tomorrow 14:00 UTC
    new_time = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0).isoformat()
    update_resp = client.patch(
        f"/api/v1/interviews/{interview_id}",
        headers=rec1_headers,
        json={"scheduled_at": new_time, "duration_minutes": 45, "notes": "Updated agenda"},
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["duration_minutes"] == 45
    assert updated["status"] == "rescheduled"
    assert updated["notes"] == "Updated agenda"

    # Student received INTERVIEW_RESCHEDULED notification
    after_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]
    assert after_notifs == before_notifs + 1

    notif_list = client.get("/api/v1/notifications?page=1&page_size=1", headers=stu1_headers).json()
    newest = notif_list["items"][0]
    assert newest["notification_type"] == "interview_rescheduled"


def test_cancel_interview_and_free_conflict_slot():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)

    with SessionLocal() as db:
        interview = db.scalar(
            select(Interview).join(Application).where(Application.student_id == db.scalar(select(User.id).where(User.email == STUDENT1_EMAIL)))
        )
        interview_id = interview.id
        cancelled_time = interview.scheduled_at

    before_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]

    # Cancel via DELETE
    cancel_resp = client.delete(f"/api/v1/interviews/{interview_id}", headers=rec1_headers)
    assert cancel_resp.status_code == 200
    cancelled = cancel_resp.json()
    assert cancelled["id"] == interview_id
    assert cancelled["status"] == "cancelled"

    # Student received INTERVIEW_CANCELLED notification
    after_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]
    assert after_notifs == before_notifs + 1

    notif_list = client.get("/api/v1/notifications?page=1&page_size=1", headers=stu1_headers).json()
    newest = notif_list["items"][0]
    assert newest["notification_type"] == "interview_cancelled"

    # Verify that the cancelled time slot is now FREE and does NOT cause conflict
    with SessionLocal() as db:
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        # App 1 is still eligible
        app1 = db.scalar(select(Application).where(Application.student_id == stu1.id, Application.status == ApplicationStatus.APPLIED))
        app1_id = app1.id

    new_schedule_resp = client.post(
        f"/api/v1/applications/{app1_id}/interviews",
        headers=rec1_headers,
        json={"scheduled_at": cancelled_time.isoformat(), "duration_minutes": 30},
    )
    assert new_schedule_resp.status_code == 201
    assert new_schedule_resp.json()["status"] == "scheduled"


# --------------------------------------------------------------------------
# 9. Immutability & Cascade Deletion
# --------------------------------------------------------------------------
def test_immutable_fields_cannot_be_mutated():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    with SessionLocal() as db:
        interview = db.scalar(select(Interview).where(Interview.status == InterviewStatus.SCHEDULED))
        interview_id = interview.id
        original_app_id = interview.application_id
        original_rec_id = interview.recruiter_id
        original_stu_id = interview.student_id

    # Try to spoof application_id, recruiter_id, student_id
    patch_resp = client.patch(
        f"/api/v1/interviews/{interview_id}",
        headers=rec1_headers,
        json={
            "application_id": 9999,
            "recruiter_id": 9999,
            "student_id": 9999,
            "notes": "Attempt spoofing",
        },
    )
    assert patch_resp.status_code == 200
    refreshed = patch_resp.json()
    assert refreshed["application_id"] == original_app_id
    assert refreshed["recruiter_id"] == original_rec_id
    assert refreshed["student_id"] == original_stu_id


def test_cascade_deletion_on_application_delete():
    with SessionLocal() as db:
        # Create temp job, application, and interview
        rec = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        stu = db.scalar(select(User).where(User.email == STUDENT2_EMAIL))

        temp_job = JobPosting(
            recruiter_id=rec.id,
            title="Temp Job For Cascade Test",
            description="Testing cascade deletion",
            opportunity_type=OpportunityType.JOB,
            company_name="AlphaTech Innovations",
            is_remote=True,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        db.add(temp_job)
        db.commit()
        db.refresh(temp_job)

        temp_app = Application(
            job_posting_id=temp_job.id,
            student_id=stu.id,
            status=ApplicationStatus.REVIEWING,
        )
        db.add(temp_app)
        db.commit()
        db.refresh(temp_app)
        temp_app_id = temp_app.id

        temp_interview = Interview(
            application_id=temp_app_id,
            recruiter_id=temp_job.recruiter_id,
            student_id=stu.id,
            scheduled_at=datetime.now(timezone.utc) + timedelta(days=10),
            duration_minutes=30,
            interview_type=InterviewType.ONLINE,
            status=InterviewStatus.SCHEDULED,
        )
        db.add(temp_interview)
        db.commit()
        db.refresh(temp_interview)
        temp_interview_id = temp_interview.id

        # Verify interview exists
        assert db.scalar(select(Interview).where(Interview.id == temp_interview_id)) is not None

        # Delete application
        db.delete(temp_app)
        db.commit()

        # Verify interview was cascaded
        assert db.scalar(select(Interview).where(Interview.id == temp_interview_id)) is None


# --------------------------------------------------------------------------
# 10. Granular Unauthenticated Tests (Individual Endpoints)
# --------------------------------------------------------------------------
def test_unauthenticated_post_application_interview_rejected():
    resp = client.post("/api/v1/applications/1/interviews", json={})
    assert resp.status_code == 401


def test_unauthenticated_get_single_interview_rejected():
    resp = client.get("/api/v1/interviews/1")
    assert resp.status_code == 401


def test_unauthenticated_student_interviews_rejected():
    resp = client.get("/api/v1/interviews/me")
    assert resp.status_code == 401


def test_unauthenticated_recruiter_interviews_rejected():
    resp = client.get("/api/v1/recruiter/interviews")
    assert resp.status_code == 401


def test_unauthenticated_update_interview_rejected():
    resp = client.patch("/api/v1/interviews/1", json={})
    assert resp.status_code == 401


def test_unauthenticated_cancel_interview_rejected():
    resp = client.delete("/api/v1/interviews/1")
    assert resp.status_code == 401


# --------------------------------------------------------------------------
# 11. Additional RBAC & Role Isolation Tests
# --------------------------------------------------------------------------
def test_admin_cannot_schedule_interview():
    admin_headers = get_auth_headers(ADMIN_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=12)).isoformat()
    resp = client.post(
        "/api/v1/applications/1/interviews",
        headers=admin_headers,
        json={"scheduled_at": future_time, "duration_minutes": 30},
    )
    assert resp.status_code == 403


def test_admin_cannot_update_interview():
    admin_headers = get_auth_headers(ADMIN_EMAIL)
    with SessionLocal() as db:
        interview = db.scalar(select(Interview).where(Interview.status == InterviewStatus.SCHEDULED))
        interview_id = interview.id

    resp = client.patch(
        f"/api/v1/interviews/{interview_id}",
        headers=admin_headers,
        json={"notes": "Admin modification attempt"},
    )
    assert resp.status_code == 403


def test_admin_cannot_cancel_interview():
    admin_headers = get_auth_headers(ADMIN_EMAIL)
    with SessionLocal() as db:
        interview = db.scalar(select(Interview).where(Interview.status == InterviewStatus.SCHEDULED))
        interview_id = interview.id

    resp = client.delete(f"/api/v1/interviews/{interview_id}", headers=admin_headers)
    assert resp.status_code == 403


def test_recruiter_cannot_update_other_recruiter_interview():
    rec2_headers = get_auth_headers(RECRUITER2_EMAIL)
    with SessionLocal() as db:
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        interview = db.scalar(select(Interview).where(Interview.recruiter_id == rec1.id))
        interview_id = interview.id

    resp = client.patch(
        f"/api/v1/interviews/{interview_id}",
        headers=rec2_headers,
        json={"notes": "Unauthorized modification attempt"},
    )
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()


def test_recruiter_cannot_cancel_other_recruiter_interview():
    rec2_headers = get_auth_headers(RECRUITER2_EMAIL)
    with SessionLocal() as db:
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        interview = db.scalar(select(Interview).where(Interview.recruiter_id == rec1.id))
        interview_id = interview.id

    resp = client.delete(f"/api/v1/interviews/{interview_id}", headers=rec2_headers)
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()


# --------------------------------------------------------------------------
# 12. Non-Timing Updates, Self-Conflict & Overlap Logic
# --------------------------------------------------------------------------
def test_update_notes_only_does_not_reschedule_nor_notify():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)

    with SessionLocal() as db:
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        stu1 = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        interview = db.scalar(
            select(Interview).where(
                Interview.recruiter_id == rec1.id,
                Interview.student_id == stu1.id,
                Interview.status == InterviewStatus.SCHEDULED,
            )
        )
        interview_id = interview.id

    before_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]

    resp = client.patch(
        f"/api/v1/interviews/{interview_id}",
        headers=rec1_headers,
        json={
            "notes": "Updated notes only - no reschedule",
            "location_or_link": "https://meet.google.com/notes-only-update",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "scheduled"
    assert data["notes"] == "Updated notes only - no reschedule"
    assert data["location_or_link"] == "https://meet.google.com/notes-only-update"

    after_notifs = client.get("/api/v1/notifications/unread-count", headers=stu1_headers).json()["unread_count"]
    assert after_notifs == before_notifs


def test_self_conflict_prevention_on_update_same_time():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        interview = db.scalar(
            select(Interview).where(
                Interview.recruiter_id == rec1.id,
                Interview.status == InterviewStatus.SCHEDULED,
            )
        )
        interview_id = interview.id
        current_time = interview.scheduled_at.isoformat()
        current_duration = interview.duration_minutes

    resp = client.patch(
        f"/api/v1/interviews/{interview_id}",
        headers=rec1_headers,
        json={
            "scheduled_at": current_time,
            "duration_minutes": current_duration,
            "notes": "Confirming self conflict does not trigger",
        },
    )
    assert resp.status_code == 200


def test_update_conflict_with_another_interview_fails():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)

    with SessionLocal() as db:
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        interviews = db.scalars(
            select(Interview).where(
                Interview.recruiter_id == rec1.id,
                Interview.status.in_([InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]),
            )
        ).all()
        assert len(interviews) >= 2
        inv_a = interviews[0]
        inv_b = interviews[1]
        target_inv_id = inv_b.id
        conflicting_time = inv_a.scheduled_at.isoformat()
        conflicting_duration = inv_a.duration_minutes

    # Try to move interview B right into the exact slot of interview A
    resp = client.patch(
        f"/api/v1/interviews/{target_inv_id}",
        headers=rec1_headers,
        json={
            "scheduled_at": conflicting_time,
            "duration_minutes": conflicting_duration,
        },
    )
    assert resp.status_code == 409
    assert "conflicting interview" in resp.json()["detail"].lower()


# --------------------------------------------------------------------------
# 13. Interview Types: In-Person & Phone
# --------------------------------------------------------------------------
def test_in_person_interview_type_creation():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=14)).replace(hour=9, minute=0, second=0, microsecond=0).isoformat()

    with SessionLocal() as db:
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        app = db.scalar(select(Application).join(JobPosting).where(JobPosting.recruiter_id == rec1.id))
        app_id = app.id

    resp = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        headers=rec1_headers,
        json={
            "scheduled_at": future_time,
            "duration_minutes": 60,
            "interview_type": "in_person",
            "location_or_link": "Building 5, Boardroom 204, Seattle HQ",
            "notes": "Bring photo ID for building access",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["interview_type"] == "in_person"
    assert data["location_or_link"] == "Building 5, Boardroom 204, Seattle HQ"


def test_phone_interview_type_creation():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    future_time = (datetime.now(timezone.utc) + timedelta(days=14)).replace(hour=11, minute=0, second=0, microsecond=0).isoformat()

    with SessionLocal() as db:
        rec1 = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        app = db.scalar(select(Application).join(JobPosting).where(JobPosting.recruiter_id == rec1.id))
        app_id = app.id

    resp = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        headers=rec1_headers,
        json={
            "scheduled_at": future_time,
            "duration_minutes": 30,
            "interview_type": "phone",
            "location_or_link": "+1 (555) 019-9832",
            "notes": "Initial technical screening via phone call",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["interview_type"] == "phone"
    assert data["location_or_link"] == "+1 (555) 019-9832"


# --------------------------------------------------------------------------
# 14. Eligible Application States & Chronological Sorting
# --------------------------------------------------------------------------
def test_application_eligible_states_reviewing_and_shortlisted():
    rec2_headers = get_auth_headers(RECRUITER2_EMAIL)

    with SessionLocal() as db:
        rec2 = db.scalar(select(User).where(User.email == RECRUITER2_EMAIL))
        stu2 = db.scalar(select(User).where(User.email == STUDENT2_EMAIL))
        
        job_review = JobPosting(
            recruiter_id=rec2.id,
            title="Eligible State Test Job Reviewing",
            description="Testing reviewing state scheduling",
            opportunity_type=OpportunityType.JOB,
            company_name="BetaGlobal Systems",
            is_remote=True,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        job_short = JobPosting(
            recruiter_id=rec2.id,
            title="Eligible State Test Job Shortlisted",
            description="Testing shortlisted state scheduling",
            opportunity_type=OpportunityType.JOB,
            company_name="BetaGlobal Systems",
            is_remote=True,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        db.add_all([job_review, job_short])
        db.commit()
        db.refresh(job_review)
        db.refresh(job_short)

        app_rev = Application(
            job_posting_id=job_review.id,
            student_id=stu2.id,
            status=ApplicationStatus.REVIEWING,
        )
        app_sho = Application(
            job_posting_id=job_short.id,
            student_id=stu2.id,
            status=ApplicationStatus.SHORTLISTED,
        )
        db.add_all([app_rev, app_sho])
        db.commit()
        db.refresh(app_rev)
        db.refresh(app_sho)
        rev_id = app_rev.id
        sho_id = app_sho.id

    t1 = (datetime.now(timezone.utc) + timedelta(days=16)).replace(hour=9, minute=0, second=0, microsecond=0).isoformat()
    t2 = (datetime.now(timezone.utc) + timedelta(days=16)).replace(hour=11, minute=0, second=0, microsecond=0).isoformat()

    resp1 = client.post(
        f"/api/v1/applications/{rev_id}/interviews",
        headers=rec2_headers,
        json={"scheduled_at": t1, "duration_minutes": 30},
    )
    assert resp1.status_code == 201

    resp2 = client.post(
        f"/api/v1/applications/{sho_id}/interviews",
        headers=rec2_headers,
        json={"scheduled_at": t2, "duration_minutes": 30},
    )
    assert resp2.status_code == 201


def test_student_interviews_sorted_chronological_ascending():
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)
    resp = client.get("/api/v1/interviews/me", headers=stu1_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 2
    for i in range(len(items) - 1):
        dt_current = datetime.fromisoformat(items[i]["scheduled_at"])
        dt_next = datetime.fromisoformat(items[i + 1]["scheduled_at"])
        assert dt_current <= dt_next, f"Student list not sorted ascending: {dt_current} > {dt_next}"


def test_recruiter_interviews_sorted_chronological_ascending():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    resp = client.get("/api/v1/recruiter/interviews", headers=rec1_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 2
    for i in range(len(items) - 1):
        dt_current = datetime.fromisoformat(items[i]["scheduled_at"])
        dt_next = datetime.fromisoformat(items[i + 1]["scheduled_at"])
        assert dt_current <= dt_next, f"Recruiter list not sorted ascending: {dt_current} > {dt_next}"


# --------------------------------------------------------------------------
# 15. Credential Filtering & Security
# --------------------------------------------------------------------------
def test_no_password_hash_leakage_in_interview_responses():
    rec1_headers = get_auth_headers(RECRUITER1_EMAIL)
    stu1_headers = get_auth_headers(STUDENT1_EMAIL)

    # Check student listing
    s_list = client.get("/api/v1/interviews/me", headers=stu1_headers).json()
    for item in s_list:
        assert "password_hash" not in item
        assert "password" not in item

    # Check recruiter listing
    r_list = client.get("/api/v1/recruiter/interviews", headers=rec1_headers).json()
    for item in r_list:
        assert "password_hash" not in item
        assert "password" not in item

    # Check detail endpoint
    inv_id = r_list[0]["id"]
    detail = client.get(f"/api/v1/interviews/{inv_id}", headers=rec1_headers).json()
    assert "password_hash" not in detail
    assert "password" not in detail


# --------------------------------------------------------------------------
# 16. User Cascade Deletions
# --------------------------------------------------------------------------
def test_cascade_deletion_on_student_user_delete():
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)
        temp_stu = User(
            email="temp.student.cascade@careerbridge.io",
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        rec = db.scalar(select(User).where(User.email == RECRUITER1_EMAIL))
        job = db.scalar(select(JobPosting).where(JobPosting.recruiter_id == rec.id))
        db.add(temp_stu)
        db.commit()
        db.refresh(temp_stu)

        app = Application(
            job_posting_id=job.id,
            student_id=temp_stu.id,
            status=ApplicationStatus.REVIEWING,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

        inv = Interview(
            application_id=app.id,
            recruiter_id=rec.id,
            student_id=temp_stu.id,
            scheduled_at=datetime.now(timezone.utc) + timedelta(days=20),
            duration_minutes=30,
            interview_type=InterviewType.ONLINE,
            status=InterviewStatus.SCHEDULED,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        inv_id = inv.id

        assert db.scalar(select(Interview).where(Interview.id == inv_id)) is not None

        # Delete student user
        db.delete(temp_stu)
        db.commit()

        # Interview must be cascade-deleted
        assert db.scalar(select(Interview).where(Interview.id == inv_id)) is None


def test_cascade_deletion_on_recruiter_user_delete():
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)
        temp_rec = User(
            email="temp.recruiter.cascade@careerbridge.io",
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        stu = db.scalar(select(User).where(User.email == STUDENT1_EMAIL))
        db.add(temp_rec)
        db.commit()
        db.refresh(temp_rec)

        temp_job = JobPosting(
            recruiter_id=temp_rec.id,
            title="Recruiter Cascade Test Job",
            description="Testing recruiter cascade",
            opportunity_type=OpportunityType.JOB,
            company_name="Cascade Inc",
            is_remote=True,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        db.add(temp_job)
        db.commit()
        db.refresh(temp_job)

        app = Application(
            job_posting_id=temp_job.id,
            student_id=stu.id,
            status=ApplicationStatus.REVIEWING,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

        inv = Interview(
            application_id=app.id,
            recruiter_id=temp_rec.id,
            student_id=stu.id,
            scheduled_at=datetime.now(timezone.utc) + timedelta(days=21),
            duration_minutes=30,
            interview_type=InterviewType.ONLINE,
            status=InterviewStatus.SCHEDULED,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        inv_id = inv.id

        assert db.scalar(select(Interview).where(Interview.id == inv_id)) is not None

        # Delete recruiter user
        db.delete(temp_rec)
        db.commit()

        # Interview must be cascade-deleted
        assert db.scalar(select(Interview).where(Interview.id == inv_id)) is None


if __name__ == "__main__":
    setup_module()
    try:
        test_unauthenticated_requests_rejected()
        print("PASS: test_unauthenticated_requests_rejected")
        test_inactive_user_rejected()
        print("PASS: test_inactive_user_rejected")
        test_student_cannot_create_interview()
        print("PASS: test_student_cannot_create_interview")
        test_student_cannot_access_recruiter_interviews()
        print("PASS: test_student_cannot_access_recruiter_interviews")
        test_recruiter_cannot_access_student_interviews()
        print("PASS: test_recruiter_cannot_access_student_interviews")
        test_student_cannot_update_or_cancel_interview()
        print("PASS: test_student_cannot_update_or_cancel_interview")
        test_validation_missing_application()
        print("PASS: test_validation_missing_application")
        test_validation_invalid_duration()
        print("PASS: test_validation_invalid_duration")
        test_validation_invalid_interview_type()
        print("PASS: test_validation_invalid_interview_type")
        test_validation_excessive_notes_and_link()
        print("PASS: test_validation_excessive_notes_and_link")
        test_application_status_rules_rejected_and_accepted()
        print("PASS: test_application_status_rules_rejected_and_accepted")
        test_cross_recruiter_scheduling_blocked()
        print("PASS: test_cross_recruiter_scheduling_blocked")
        test_create_interview_success_and_notification()
        print("PASS: test_create_interview_success_and_notification")
        test_get_single_interview_access_control()
        print("PASS: test_get_single_interview_access_control")
        test_student_and_recruiter_listings()
        print("PASS: test_student_and_recruiter_listings")
        test_recruiter_and_student_conflict_detection()
        print("PASS: test_recruiter_and_student_conflict_detection")
        test_non_overlapping_interview_succeeds()
        print("PASS: test_non_overlapping_interview_succeeds")
        test_update_and_reschedule_interview()
        print("PASS: test_update_and_reschedule_interview")
        test_cancel_interview_and_free_conflict_slot()
        print("PASS: test_cancel_interview_and_free_conflict_slot")
        test_immutable_fields_cannot_be_mutated()
        print("PASS: test_immutable_fields_cannot_be_mutated")
        test_cascade_deletion_on_application_delete()
        print("PASS: test_cascade_deletion_on_application_delete")
        test_unauthenticated_post_application_interview_rejected()
        print("PASS: test_unauthenticated_post_application_interview_rejected")
        test_unauthenticated_get_single_interview_rejected()
        print("PASS: test_unauthenticated_get_single_interview_rejected")
        test_unauthenticated_student_interviews_rejected()
        print("PASS: test_unauthenticated_student_interviews_rejected")
        test_unauthenticated_recruiter_interviews_rejected()
        print("PASS: test_unauthenticated_recruiter_interviews_rejected")
        test_unauthenticated_update_interview_rejected()
        print("PASS: test_unauthenticated_update_interview_rejected")
        test_unauthenticated_cancel_interview_rejected()
        print("PASS: test_unauthenticated_cancel_interview_rejected")
        test_admin_cannot_schedule_interview()
        print("PASS: test_admin_cannot_schedule_interview")
        test_admin_cannot_update_interview()
        print("PASS: test_admin_cannot_update_interview")
        test_admin_cannot_cancel_interview()
        print("PASS: test_admin_cannot_cancel_interview")
        test_recruiter_cannot_update_other_recruiter_interview()
        print("PASS: test_recruiter_cannot_update_other_recruiter_interview")
        test_recruiter_cannot_cancel_other_recruiter_interview()
        print("PASS: test_recruiter_cannot_cancel_other_recruiter_interview")
        test_update_notes_only_does_not_reschedule_nor_notify()
        print("PASS: test_update_notes_only_does_not_reschedule_nor_notify")
        test_self_conflict_prevention_on_update_same_time()
        print("PASS: test_self_conflict_prevention_on_update_same_time")
        test_update_conflict_with_another_interview_fails()
        print("PASS: test_update_conflict_with_another_interview_fails")
        test_in_person_interview_type_creation()
        print("PASS: test_in_person_interview_type_creation")
        test_phone_interview_type_creation()
        print("PASS: test_phone_interview_type_creation")
        test_application_eligible_states_reviewing_and_shortlisted()
        print("PASS: test_application_eligible_states_reviewing_and_shortlisted")
        test_student_interviews_sorted_chronological_ascending()
        print("PASS: test_student_interviews_sorted_chronological_ascending")
        test_recruiter_interviews_sorted_chronological_ascending()
        print("PASS: test_recruiter_interviews_sorted_chronological_ascending")
        test_no_password_hash_leakage_in_interview_responses()
        print("PASS: test_no_password_hash_leakage_in_interview_responses")
        test_cascade_deletion_on_student_user_delete()
        print("PASS: test_cascade_deletion_on_student_user_delete")
        test_cascade_deletion_on_recruiter_user_delete()
        print("PASS: test_cascade_deletion_on_recruiter_user_delete")
        print("\n=======================================================")
        print("ALL 43 INTERVIEW TEST CASES PASSED SUCCESSFULLY!")
        print("=======================================================\n")
    finally:
        teardown_module()
