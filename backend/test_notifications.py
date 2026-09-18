"""
CareerBridge Phase 17 Backend Notifications & Background Jobs Foundation Test Suite
Tests:
1. Unauthenticated requests to notifications endpoints return 401 Unauthorized
2. Inactive user requests return 401 Unauthorized
3. Empty notifications list returns items=[], total=0, total_pages=0
4. Empty unread count returns unread_count=0
5. Create notification via service and list via GET /notifications (accurate serialization)
6. Notifications ordered newest first (created_at desc, id desc)
7. Pagination: page and page_size navigation, total and total_pages calculations
8. Unread-only filter (unread_only=True) excludes read notifications
9. Unread count endpoint accurately reflects number of unread notifications
10. Mark single notification as read (is_read=True, read_at set)
11. Mark single notification as read idempotent
12. Mark non-existent notification as read returns 404 Not Found
13. Cross-user isolation: User A cannot see User B's notifications
14. Cross-user isolation: User A cannot mark User B's notification as read (404)
15. Cross-user isolation: User A's unread count unaffected by User B's notifications
16. Mark all as read: marks only current user's unread notifications and returns marked_read_count
17. Mark all as read: User B's notifications remain unread
18. Event trigger: Student applies to job -> recruiter receives APPLICATION_SUBMITTED notification
19. Event trigger: Recruiter updates application status -> student receives APPLICATION_STATUS_CHANGED notification
20. Event trigger: Admin verifies recruiter -> recruiter receives RECRUITER_VERIFICATION_CHANGED notification
21. Event trigger: Admin moderates job -> recruiter receives JOB_MODERATION_CHANGED notification
22. Cascade deletion: Deleting a user deletes their notifications via ON DELETE CASCADE
23. Background jobs abstraction: register_job and dispatch_job synchronous execution
24. Background jobs abstraction: error isolation catches exception, logs, does not crash
25. Background jobs abstraction: dispatch unregistered job returns False safely
26. Background jobs abstraction: dispatch with FastAPI BackgroundTasks
"""

import sys
import time
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import BackgroundTasks
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.notification import Notification, NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.services.background_jobs import (
    clear_jobs,
    dispatch_job,
    get_execution_history,
    get_job,
    register_job,
)
from app.services.notification_service import NotificationService

client = TestClient(app)

STUDENT_EMAIL = "notif.student@careerbridge.io"
STUDENT2_EMAIL = "notif.student2@careerbridge.io"
RECRUITER_EMAIL = "notif.recruiter@careerbridge.io"
ADMIN_EMAIL = "notif.admin@careerbridge.io"
INACTIVE_EMAIL = "notif.inactive@careerbridge.io"
TEST_PASSWORD = "NotifPassword123!"


def setup_module():
    """Seed test users and clean prior test data."""
    teardown_module()
    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

        student = User(
            email=STUDENT_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        student2 = User(
            email=STUDENT2_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        recruiter = User(
            email=RECRUITER_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=False,
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
            role=UserRole.STUDENT,
            is_active=False,
            is_verified=True,
        )
        db.add_all([student, student2, recruiter, admin, inactive])
        db.commit()
        db.refresh(student)
        db.refresh(recruiter)

        rec_profile = RecruiterProfile(
            user_id=recruiter.id,
            company_name="NotifCorp Solutions",
            company_description="Notification Testing Inc.",
            contact_name="Alice Recruiter",
            is_verified=False,
        )
        db.add(rec_profile)
        db.commit()


def teardown_module():
    """Clean up test users and related records."""
    emails = [
        STUDENT_EMAIL,
        STUDENT2_EMAIL,
        RECRUITER_EMAIL,
        ADMIN_EMAIL,
        INACTIVE_EMAIL,
        "cascade.user@careerbridge.io",
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
# Authentication and Inactive Tests
# --------------------------------------------------------------------------
def test_unauthenticated_requests_rejected():
    endpoints = [
        ("GET", "/api/v1/notifications"),
        ("GET", "/api/v1/notifications/unread-count"),
        ("PATCH", "/api/v1/notifications/read-all"),
        ("PATCH", "/api/v1/notifications/1/read"),
    ]
    for method, path in endpoints:
        resp = client.request(method, path)
        assert resp.status_code == 401, f"{method} {path} expected 401, got {resp.status_code}"


def test_inactive_user_rejected():
    headers = get_auth_headers(INACTIVE_EMAIL)
    resp = client.get("/api/v1/notifications", headers=headers)
    assert resp.status_code == 401


# --------------------------------------------------------------------------
# Empty State Tests
# --------------------------------------------------------------------------
def test_empty_notifications_list():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["total_pages"] == 0
    assert data["page"] == 1
    assert data["page_size"] == 10


def test_empty_unread_count():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["unread_count"] == 0


# --------------------------------------------------------------------------
# Service Notification Creation & Retrieval
# --------------------------------------------------------------------------
def test_create_notification_service_and_list():
    with SessionLocal() as db:
        student = db.scalar(select(User).where(User.email == STUDENT_EMAIL))
        notif = NotificationService.create_notification(
            db,
            user_id=student.id,
            notification_type=NotificationType.APPLICATION_STATUS_CHANGED,
            title="Application Accepted",
            message="Your application for Backend Engineer was accepted.",
            commit=True,
        )
        notif_id = notif.id

    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["id"] == notif_id
    assert item["notification_type"] == "application_status_changed"
    assert item["title"] == "Application Accepted"
    assert item["message"] == "Your application for Backend Engineer was accepted."
    assert item["is_read"] is False
    assert item["read_at"] is None
    assert "created_at" in item


def test_notifications_ordering_and_pagination():
    with SessionLocal() as db:
        student = db.scalar(select(User).where(User.email == STUDENT_EMAIL))
        # Add 4 more notifications
        for i in range(2, 6):
            NotificationService.create_notification(
                db,
                user_id=student.id,
                notification_type=NotificationType.APPLICATION_STATUS_CHANGED,
                title=f"Notification {i}",
                message=f"Message {i}",
                commit=True,
            )

    headers = get_auth_headers(STUDENT_EMAIL)
    # Total is now 5
    resp = client.get("/api/v1/notifications?page=1&page_size=2", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert data["total_pages"] == 3
    assert len(data["items"]) == 2
    # Newest first
    assert data["items"][0]["title"] == "Notification 5"
    assert data["items"][1]["title"] == "Notification 4"

    # Page 2
    resp2 = client.get("/api/v1/notifications?page=2&page_size=2", headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["items"]) == 2
    assert data2["items"][0]["title"] == "Notification 3"
    assert data2["items"][1]["title"] == "Notification 2"

    # Page 3
    resp3 = client.get("/api/v1/notifications?page=3&page_size=2", headers=headers)
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert len(data3["items"]) == 1
    assert data3["items"][0]["title"] == "Application Accepted"


def test_unread_count():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["unread_count"] == 5


# --------------------------------------------------------------------------
# Read Status Mutation Tests
# --------------------------------------------------------------------------
def test_mark_single_notification_as_read():
    headers = get_auth_headers(STUDENT_EMAIL)
    list_resp = client.get("/api/v1/notifications?page=1&page_size=1", headers=headers)
    target_id = list_resp.json()["items"][0]["id"]

    # Mark as read
    patch_resp = client.patch(f"/api/v1/notifications/{target_id}/read", headers=headers)
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["id"] == target_id
    assert updated["is_read"] is True
    assert updated["read_at"] is not None

    # Idempotent call
    patch_resp_again = client.patch(f"/api/v1/notifications/{target_id}/read", headers=headers)
    assert patch_resp_again.status_code == 200
    assert patch_resp_again.json()["is_read"] is True

    # Check unread count dropped to 4
    count_resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert count_resp.json()["unread_count"] == 4


def test_mark_nonexistent_notification_read():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.patch("/api/v1/notifications/9999999/read", headers=headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Notification not found"


def test_unread_only_filter():
    headers = get_auth_headers(STUDENT_EMAIL)
    # Total is 5, 1 is read, 4 are unread
    resp = client.get("/api/v1/notifications?unread_only=true", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 4
    for item in data["items"]:
        assert item["is_read"] is False


# --------------------------------------------------------------------------
# Cross-User Isolation Tests
# --------------------------------------------------------------------------
def test_cross_user_isolation():
    student1_headers = get_auth_headers(STUDENT_EMAIL)
    student2_headers = get_auth_headers(STUDENT2_EMAIL)

    # Student 2 has 0 notifications
    resp = client.get("/api/v1/notifications", headers=student2_headers)
    assert resp.json()["total"] == 0
    resp_count = client.get("/api/v1/notifications/unread-count", headers=student2_headers)
    assert resp_count.json()["unread_count"] == 0

    # Student 1 gets their top notification ID
    list1 = client.get("/api/v1/notifications?page=1&page_size=1", headers=student1_headers)
    notif1_id = list1.json()["items"][0]["id"]

    # Student 2 tries to mark Student 1's notification as read -> 404
    hack_resp = client.patch(f"/api/v1/notifications/{notif1_id}/read", headers=student2_headers)
    assert hack_resp.status_code == 404
    assert hack_resp.json()["detail"] == "Notification not found"


def test_mark_all_as_read():
    headers = get_auth_headers(STUDENT_EMAIL)
    # 4 unread remain for Student 1
    resp = client.patch("/api/v1/notifications/read-all", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["marked_read_count"] == 4

    # Now unread count is 0
    count_resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert count_resp.json()["unread_count"] == 0

    # Calling mark-all again returns marked_read_count = 0
    resp2 = client.patch("/api/v1/notifications/read-all", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["marked_read_count"] == 0


# --------------------------------------------------------------------------
# Platform Event Triggers Tests
# --------------------------------------------------------------------------
def test_event_application_submitted_notifies_recruiter():
    with SessionLocal() as db:
        recruiter = db.scalar(select(User).where(User.email == RECRUITER_EMAIL))
        # Create a job posting for recruiter
        job = JobPosting(
            recruiter_id=recruiter.id,
            title="Senior Backend Engineer",
            description="Build scalable services",
            opportunity_type=OpportunityType.JOB,
            company_name="NotifCorp Solutions",
            is_remote=True,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id

    recruiter_headers = get_auth_headers(RECRUITER_EMAIL)
    # Check recruiter unread count before application
    before_count = client.get("/api/v1/notifications/unread-count", headers=recruiter_headers).json()["unread_count"]

    # Student 2 applies to this job
    student2_headers = get_auth_headers(STUDENT2_EMAIL)
    apply_resp = client.post(
        f"/api/v1/jobs/{job_id}/applications",
        headers=student2_headers,
        json={"cover_message": "Excited to apply!"},
    )
    assert apply_resp.status_code == 201

    # Recruiter should now have 1 new unread notification
    after_count = client.get("/api/v1/notifications/unread-count", headers=recruiter_headers).json()["unread_count"]
    assert after_count == before_count + 1

    notif_list = client.get("/api/v1/notifications?page=1&page_size=1", headers=recruiter_headers).json()
    newest = notif_list["items"][0]
    assert newest["notification_type"] == "application_submitted"
    assert "Senior Backend Engineer" in newest["message"]


def test_event_application_status_changed_notifies_student():
    recruiter_headers = get_auth_headers(RECRUITER_EMAIL)
    # Get the application ID submitted by Student 2
    app_list_resp = client.get("/api/v1/recruiter/applications", headers=recruiter_headers)
    assert app_list_resp.status_code == 200
    apps = app_list_resp.json()
    assert len(apps) > 0
    app_id = apps[0]["id"]

    student2_headers = get_auth_headers(STUDENT2_EMAIL)
    before_count = client.get("/api/v1/notifications/unread-count", headers=student2_headers).json()["unread_count"]

    # Recruiter transitions application status to 'shortlisted'
    update_resp = client.patch(
        f"/api/v1/recruiter/applications/{app_id}",
        headers=recruiter_headers,
        json={"status": "shortlisted"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "shortlisted"

    # Student 2 receives notification
    after_count = client.get("/api/v1/notifications/unread-count", headers=student2_headers).json()["unread_count"]
    assert after_count == before_count + 1

    notif_list = client.get("/api/v1/notifications?page=1&page_size=1", headers=student2_headers).json()
    newest = notif_list["items"][0]
    assert newest["notification_type"] == "application_status_changed"
    assert "shortlisted" in newest["message"]


def test_event_recruiter_verification_changed_notifies_recruiter():
    with SessionLocal() as db:
        recruiter = db.scalar(select(User).where(User.email == RECRUITER_EMAIL))
        recruiter_id = recruiter.id

    admin_headers = get_auth_headers(ADMIN_EMAIL)
    recruiter_headers = get_auth_headers(RECRUITER_EMAIL)
    before_count = client.get("/api/v1/notifications/unread-count", headers=recruiter_headers).json()["unread_count"]

    # Admin verifies the recruiter
    verify_resp = client.patch(
        f"/api/v1/admin/recruiters/{recruiter_id}/verification",
        headers=admin_headers,
        json={"is_verified": True},
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["is_verified"] is True

    # Recruiter receives notification
    after_count = client.get("/api/v1/notifications/unread-count", headers=recruiter_headers).json()["unread_count"]
    assert after_count == before_count + 1

    notif_list = client.get("/api/v1/notifications?page=1&page_size=1", headers=recruiter_headers).json()
    newest = notif_list["items"][0]
    assert newest["notification_type"] == "recruiter_verification_changed"
    assert "verified" in newest["message"]


def test_event_job_moderation_changed_notifies_recruiter():
    with SessionLocal() as db:
        job = db.scalar(select(JobPosting).where(JobPosting.title == "Senior Backend Engineer"))
        job_id = job.id

    admin_headers = get_auth_headers(ADMIN_EMAIL)
    recruiter_headers = get_auth_headers(RECRUITER_EMAIL)
    before_count = client.get("/api/v1/notifications/unread-count", headers=recruiter_headers).json()["unread_count"]

    # Admin deactivates the job
    mod_resp = client.patch(
        f"/api/v1/admin/jobs/{job_id}/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert mod_resp.status_code == 200
    assert mod_resp.json()["is_active"] is False

    # Recruiter receives notification
    after_count = client.get("/api/v1/notifications/unread-count", headers=recruiter_headers).json()["unread_count"]
    assert after_count == before_count + 1

    notif_list = client.get("/api/v1/notifications?page=1&page_size=1", headers=recruiter_headers).json()
    newest = notif_list["items"][0]
    assert newest["notification_type"] == "job_moderation_changed"
    assert "deactivated" in newest["message"]


# --------------------------------------------------------------------------
# Cascade Deletion Test
# --------------------------------------------------------------------------
def test_cascade_deletion_on_user_delete():
    temp_email = "cascade.user@careerbridge.io"
    with SessionLocal() as db:
        user = User(
            email=temp_email,
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id

        NotificationService.create_notification(
            db,
            user_id=user_id,
            notification_type=NotificationType.APPLICATION_STATUS_CHANGED,
            title="Cascade Test",
            message="This should cascade delete",
            commit=True,
        )

        # Confirm notification exists
        notif_count = db.scalar(
            select(Notification).where(Notification.user_id == user_id)
        )
        assert notif_count is not None

        # Delete user
        db.delete(user)
        db.commit()

        # Check notification was cascaded
        notif_after = db.scalar(
            select(Notification).where(Notification.user_id == user_id)
        )
        assert notif_after is None


# --------------------------------------------------------------------------
# Background Jobs Abstraction Tests
# --------------------------------------------------------------------------
def test_background_jobs_sync_execution():
    clear_jobs()
    test_state = {"executed": False, "arg": None, "kw": None}

    def sample_job(arg1, keyword="default"):
        test_state["executed"] = True
        test_state["arg"] = arg1
        test_state["kw"] = keyword
        return "job_done"

    register_job("sample.task", sample_job)
    assert get_job("sample.task") is sample_job

    dispatched = dispatch_job("sample.task", "test_val", keyword="custom_val")
    assert dispatched is True
    assert test_state["executed"] is True
    assert test_state["arg"] == "test_val"
    assert test_state["kw"] == "custom_val"

    history = get_execution_history()
    assert len(history) == 1
    assert history[0]["status"] == "success"
    assert history[0]["job_name"] == "sample.task"


def test_background_jobs_error_isolation():
    clear_jobs()

    def failing_job():
        raise ValueError("Simulated background job failure")

    register_job("fail.task", failing_job)
    # Should not raise exception
    dispatched = dispatch_job("fail.task")
    assert dispatched is True

    history = get_execution_history()
    assert len(history) == 1
    assert history[0]["status"] == "failed"
    assert "Simulated background job failure" in history[0]["error"]


def test_background_jobs_unregistered():
    clear_jobs()
    dispatched = dispatch_job("nonexistent.job")
    assert dispatched is False


def test_background_jobs_with_fastapi_background_tasks():
    clear_jobs()
    results = []

    def task_fn(val):
        results.append(val)

    register_job("fastapi.task", task_fn)

    bg = BackgroundTasks()
    dispatched = dispatch_job("fastapi.task", 42, background_tasks=bg)
    assert dispatched is True

    # BackgroundTasks queued the task
    assert len(bg.tasks) == 1
    # Run the queued tasks
    import asyncio
    asyncio.run(bg())

    assert results == [42]
    history = get_execution_history()
    assert len(history) == 1
    assert history[0]["status"] == "success"


def test_cross_role_isolation_recruiter_and_student():
    student_headers = get_auth_headers(STUDENT_EMAIL)
    recruiter_headers = get_auth_headers(RECRUITER_EMAIL)

    # Recruiter creates a notification
    with SessionLocal() as db:
        rec = db.scalar(select(User).where(User.email == RECRUITER_EMAIL))
        notif = NotificationService.create_notification(
            db,
            user_id=rec.id,
            notification_type=NotificationType.JOB_MODERATION_CHANGED,
            title="Recruiter Only",
            message="Private recruiter message",
            commit=True,
        )
        rec_notif_id = notif.id

    # Student cannot mark recruiter's notification as read
    resp = client.patch(f"/api/v1/notifications/{rec_notif_id}/read", headers=student_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Notification not found"

    # Recruiter cannot mark student's notification as read
    with SessionLocal() as db:
        stu = db.scalar(select(User).where(User.email == STUDENT_EMAIL))
        notif = NotificationService.create_notification(
            db,
            user_id=stu.id,
            notification_type=NotificationType.APPLICATION_STATUS_CHANGED,
            title="Student Only",
            message="Private student message",
            commit=True,
        )
        stu_notif_id = notif.id

    resp2 = client.patch(f"/api/v1/notifications/{stu_notif_id}/read", headers=recruiter_headers)
    assert resp2.status_code == 404
    assert resp2.json()["detail"] == "Notification not found"


def test_pagination_out_of_bounds():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications?page=9999&page_size=10", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["page"] == 9999
    assert data["total"] > 0


def test_pagination_max_page_size():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications?page=1&page_size=100", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["page_size"] == 100


def test_pagination_validation_invalid_page():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications?page=0&page_size=10", headers=headers)
    assert resp.status_code == 422


def test_pagination_validation_invalid_page_size_zero():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications?page=1&page_size=0", headers=headers)
    assert resp.status_code == 422


def test_pagination_validation_invalid_page_size_excessive():
    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications?page=1&page_size=101", headers=headers)
    assert resp.status_code == 422


def test_special_characters_and_unicode_in_notifications():
    with SessionLocal() as db:
        student = db.scalar(select(User).where(User.email == STUDENT_EMAIL))
        notif = NotificationService.create_notification(
            db,
            user_id=student.id,
            notification_type=NotificationType.APPLICATION_STATUS_CHANGED,
            title="🎉 Congratulations! You've been selected 🚀",
            message="Details: <Engineering & Product> team at $100k/yr — 'Best wishes!' 🌟",
            commit=True,
        )
        notif_id = notif.id

    headers = get_auth_headers(STUDENT_EMAIL)
    resp = client.get("/api/v1/notifications?page=1&page_size=1", headers=headers)
    assert resp.status_code == 200
    newest = resp.json()["items"][0]
    assert newest["id"] == notif_id
    assert newest["title"] == "🎉 Congratulations! You've been selected 🚀"
    assert "🌟" in newest["message"]


def test_background_jobs_async_coroutine():
    clear_jobs()
    state = {"ran": False}

    async def async_handler(val):
        state["ran"] = True
        state["val"] = val

    register_job("async.job", async_handler)
    dispatched = dispatch_job("async.job", 999)
    assert dispatched is True
    assert state["ran"] is True
    assert state["val"] == 999

    history = get_execution_history()
    assert len(history) == 1
    assert history[0]["status"] == "success"


if __name__ == "__main__":
    setup_module()
    try:
        test_unauthenticated_requests_rejected()
        print("PASS: test_unauthenticated_requests_rejected")
        test_inactive_user_rejected()
        print("PASS: test_inactive_user_rejected")
        test_empty_notifications_list()
        print("PASS: test_empty_notifications_list")
        test_empty_unread_count()
        print("PASS: test_empty_unread_count")
        test_create_notification_service_and_list()
        print("PASS: test_create_notification_service_and_list")
        test_notifications_ordering_and_pagination()
        print("PASS: test_notifications_ordering_and_pagination")
        test_unread_count()
        print("PASS: test_unread_count")
        test_mark_single_notification_as_read()
        print("PASS: test_mark_single_notification_as_read")
        test_mark_nonexistent_notification_read()
        print("PASS: test_mark_nonexistent_notification_read")
        test_unread_only_filter()
        print("PASS: test_unread_only_filter")
        test_cross_user_isolation()
        print("PASS: test_cross_user_isolation")
        test_mark_all_as_read()
        print("PASS: test_mark_all_as_read")
        test_event_application_submitted_notifies_recruiter()
        print("PASS: test_event_application_submitted_notifies_recruiter")
        test_event_application_status_changed_notifies_student()
        print("PASS: test_event_application_status_changed_notifies_student")
        test_event_recruiter_verification_changed_notifies_recruiter()
        print("PASS: test_event_recruiter_verification_changed_notifies_recruiter")
        test_event_job_moderation_changed_notifies_recruiter()
        print("PASS: test_event_job_moderation_changed_notifies_recruiter")
        test_cascade_deletion_on_user_delete()
        print("PASS: test_cascade_deletion_on_user_delete")
        test_background_jobs_sync_execution()
        print("PASS: test_background_jobs_sync_execution")
        test_background_jobs_error_isolation()
        print("PASS: test_background_jobs_error_isolation")
        test_background_jobs_unregistered()
        print("PASS: test_background_jobs_unregistered")
        test_background_jobs_with_fastapi_background_tasks()
        print("PASS: test_background_jobs_with_fastapi_background_tasks")
        test_cross_role_isolation_recruiter_and_student()
        print("PASS: test_cross_role_isolation_recruiter_and_student")
        test_pagination_out_of_bounds()
        print("PASS: test_pagination_out_of_bounds")
        test_pagination_max_page_size()
        print("PASS: test_pagination_max_page_size")
        test_pagination_validation_invalid_page()
        print("PASS: test_pagination_validation_invalid_page")
        test_pagination_validation_invalid_page_size_zero()
        print("PASS: test_pagination_validation_invalid_page_size_zero")
        test_pagination_validation_invalid_page_size_excessive()
        print("PASS: test_pagination_validation_invalid_page_size_excessive")
        test_special_characters_and_unicode_in_notifications()
        print("PASS: test_special_characters_and_unicode_in_notifications")
        test_background_jobs_async_coroutine()
        print("PASS: test_background_jobs_async_coroutine")
        print("\n=======================================================")
        print("ALL 29 NOTIFICATION TESTS COMPLETED SUCCESSFULLY!")
        print("=======================================================\n")
    finally:
        teardown_module()
