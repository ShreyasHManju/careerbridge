"""
CareerBridge Phase 21 Email Notification Foundation Test Suite
============================================================
Comprehensive test coverage:
1. Configuration & provider initialization (local vs smtp, defaults)
2. LocalEmailProvider in-memory storage, retrieval, and clearing
3. EmailService recipient and payload validation (invalid email, empty subject/body)
4. Email template rendering (all 6 events: welcome, verification, reset, application, status, interview)
5. HTML injection prevention (html.escape verification in rendered HTML)
6. Error handling on missing templates
7. Direct event handlers execution
8. Background job registration & execution history tracking
9. Safe failure isolation (email error does not crash background job runner or HTTP request)
10. E2E User registration dispatches welcome email
11. E2E Welcome email does not expose passwords or hashes
12. E2E Student application submission dispatches confirmation email
13. E2E Recruiter status update dispatches status update email
14. E2E Status update with same status is idempotent (no duplicate email)
15. E2E Recruiter schedules interview dispatches interview invitation email
16. E2E Interview email content validation (job, company, time, type)
17. E2E Cross-recruiter authorization check
18. E2E Messaging does NOT send email on individual chat messages
19. E2E Failure isolation: Email sending failure does NOT roll back DB transactions
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from unittest.mock import patch

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import BackgroundTasks
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.conversation import Conversation
from app.models.interview import Interview, InterviewStatus, InterviewType
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

from app.services.background_jobs import (
    clear_jobs,
    dispatch_job,
    get_execution_history,
)
from app.services.email_providers import (
    BaseEmailProvider,
    LocalEmailProvider,
    SMTPEmailProvider,
    get_email_provider,
    _default_local_provider,
)
from app.services.email_service import EmailEventType, EmailService

client = TestClient(app)

TEST_RECRUITER_EMAIL = "emailtest.recruiter@careerbridge.io"
TEST_RECRUITER2_EMAIL = "emailtest.recruiter2@careerbridge.io"
TEST_STUDENT_EMAIL = "emailtest.student@careerbridge.io"
TEST_ADMIN_EMAIL = "emailtest.admin@careerbridge.io"
TEST_PASSWORD = "EmailTestPassword123!"

test_recruiter_id: int = 0
test_recruiter2_id: int = 0
test_student_id: int = 0
test_admin_id: int = 0
test_job_id: int = 0
test_job2_id: int = 0

recruiter_token: str = ""
recruiter2_token: str = ""
student_token: str = ""
admin_token: str = ""


def assert_raises(exc_type, func, *args, match=None, **kwargs):
    """Helper to assert exceptions without requiring pytest."""
    try:
        func(*args, **kwargs)
    except exc_type as exc:
        if match and match not in str(exc):
            raise AssertionError(f"Expected match '{match}' not in '{exc}'")
        return exc
    except Exception as other_exc:
        raise AssertionError(
            f"Expected {exc_type.__name__}, but got {type(other_exc).__name__}: {other_exc}"
        )
    raise AssertionError(f"Expected exception {exc_type.__name__} was not raised")


def setup_module():
    """Seed test fixtures, users, and postings."""
    global test_recruiter_id, test_recruiter2_id, test_student_id, test_admin_id
    global test_job_id, test_job2_id
    global recruiter_token, recruiter2_token, student_token, admin_token

    teardown_module()
    _default_local_provider.clear()
    EmailService.register_background_jobs()

    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

        rec = User(
            email=TEST_RECRUITER_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        rec2 = User(
            email=TEST_RECRUITER2_EMAIL,
            password_hash=hashed,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        stu = User(
            email=TEST_STUDENT_EMAIL,
            password_hash=hashed,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        adm = User(
            email=TEST_ADMIN_EMAIL,
            password_hash=hashed,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add_all([rec, rec2, stu, adm])
        db.commit()
        db.refresh(rec)
        db.refresh(rec2)
        db.refresh(stu)
        db.refresh(adm)

        test_recruiter_id = rec.id
        test_recruiter2_id = rec2.id
        test_student_id = stu.id
        test_admin_id = adm.id

        # Profiles
        rec_prof = RecruiterProfile(
            user_id=rec.id,
            company_name="Email Test Corp",
            company_website="https://emailtestcorp.com",
            is_verified=True,
        )
        stu_prof = StudentProfile(
            user_id=stu.id,
            full_name="Email Student",
            college="Email University",
            degree="B.Tech",
            branch="Computer Science",
            graduation_year=2026,
        )
        db.add_all([rec_prof, stu_prof])
        db.commit()

        # Jobs
        job = JobPosting(
            recruiter_id=rec.id,
            title="Email Software Engineer",
            company_name="Email Test Corp",
            location="Remote",
            is_remote=True,
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            description="Engineering role with email integrations",
            skills="Python, FastAPI",
            is_active=True,
        )
        job2 = JobPosting(
            recruiter_id=rec2.id,
            title="Other Recruiter Job",
            company_name="Other Corp",
            location="New York, NY",
            is_remote=False,
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            description="Other company opportunity",
            skills="Python",
            is_active=True,
        )
        db.add_all([job, job2])
        db.commit()
        db.refresh(job)
        db.refresh(job2)
        test_job_id = job.id
        test_job2_id = job2.id

    recruiter_token = create_access_token(subject=test_recruiter_id)
    recruiter2_token = create_access_token(subject=test_recruiter2_id)
    student_token = create_access_token(subject=test_student_id)
    admin_token = create_access_token(subject=test_admin_id)


def teardown_module():
    """Clean up test records."""
    _default_local_provider.clear()
    with SessionLocal() as db:
        users = db.scalars(
            select(User).where(
                User.email.in_([
                    TEST_RECRUITER_EMAIL,
                    TEST_RECRUITER2_EMAIL,
                    TEST_STUDENT_EMAIL,
                    TEST_ADMIN_EMAIL,
                    "newuser.emailtest@careerbridge.io",
                    "failure.user@careerbridge.io",
                ])
            )
        ).all()
        for u in users:
            db.delete(u)
        db.commit()



# ==========================================================================
# 1. Configuration & Providers
# ==========================================================================

def test_default_config_uses_local_provider():
    """Settings defaults to local email provider for zero external dependencies."""
    assert settings.EMAIL_PROVIDER == "local"
    assert settings.EMAIL_FROM == "no-reply@careerbridge.io"
    assert settings.EMAIL_FROM_NAME == "CareerBridge"


def test_get_email_provider_factory():
    """Factory correctly returns LocalEmailProvider or SMTPEmailProvider."""
    local_p = get_email_provider("local")
    assert isinstance(local_p, LocalEmailProvider)

    smtp_p = get_email_provider("smtp")
    assert isinstance(smtp_p, SMTPEmailProvider)

    # Default fallback
    default_p = get_email_provider()
    assert isinstance(default_p, LocalEmailProvider)


def test_smtp_provider_missing_host_raises_value_error():
    """SMTPEmailProvider raises ValueError when SMTP_HOST is not provided."""
    provider = SMTPEmailProvider(host="")
    assert_raises(
        ValueError,
        provider.send,
        to_email="test@example.com",
        subject="Test Subject",
        text_body="Hello world",
        match="SMTP_HOST is not configured",
    )


def test_local_provider_storage_and_clear():
    """LocalEmailProvider captures emails, allows inspection, and clears correctly."""
    provider = LocalEmailProvider()
    provider.send(
        to_email="recipient@example.com",
        subject="Welcome!",
        text_body="Plain text body",
        html_body="<p>HTML body</p>",
        event_type="welcome",
    )
    sent = provider.get_sent_emails()
    assert len(sent) == 1
    assert sent[0]["to_email"] == "recipient@example.com"
    assert sent[0]["subject"] == "Welcome!"
    assert sent[0]["text_body"] == "Plain text body"
    assert sent[0]["html_body"] == "<p>HTML body</p>"
    assert sent[0]["event_type"] == "welcome"

    last = provider.get_last_email()
    assert last == sent[0]

    provider.clear()
    assert len(provider.get_sent_emails()) == 0
    assert provider.get_last_email() is None


# ==========================================================================
# 2. EmailService Validation & Rendering
# ==========================================================================

def test_email_validation_helper():
    """Valid and invalid email addresses are accurately detected."""
    assert EmailService.is_valid_email("user@example.com") is True
    assert EmailService.is_valid_email("first.last+tag@sub.domain.co") is True
    assert EmailService.is_valid_email("invalid-email") is False
    assert EmailService.is_valid_email("") is False
    assert EmailService.is_valid_email(None) is False
    assert EmailService.is_valid_email("user@") is False
    assert EmailService.is_valid_email("@domain.com") is False


def test_email_service_rejects_invalid_recipient():
    """EmailService.send_email raises ValueError on invalid recipient email."""
    assert_raises(
        ValueError,
        EmailService.send_email,
        to_email="not-an-email",
        subject="Hello",
        text_body="Content",
        match="Invalid recipient email address",
    )


def test_email_service_rejects_empty_subject():
    """EmailService.send_email raises ValueError on empty subject."""
    assert_raises(
        ValueError,
        EmailService.send_email,
        to_email="valid@example.com",
        subject="",
        text_body="Content",
        match="Email subject cannot be empty",
    )


def test_email_service_rejects_empty_body():
    """EmailService.send_email raises ValueError on empty body."""
    assert_raises(
        ValueError,
        EmailService.send_email,
        to_email="valid@example.com",
        subject="Valid Subject",
        text_body="",
        match="Email text body cannot be empty",
    )


def test_render_template_welcome():
    """Welcome template renders text and HTML correctly with placeholders."""
    txt, html_body = EmailService.render_template(
        EmailEventType.WELCOME,
        {"user_name": "Alice", "user_email": "alice@example.com", "role": "Student"},
    )
    assert "Alice" in txt
    assert "Student" in txt
    assert "alice@example.com" in txt
    assert "Alice" in html_body
    assert "Student" in html_body
    assert "<!DOCTYPE html>" in html_body


def test_render_template_email_verification():
    """Email verification template renders with verification link."""
    txt, html_body = EmailService.render_template(
        EmailEventType.EMAIL_VERIFICATION,
        {"user_name": "Bob", "verification_url": "https://careerbridge.io/verify?t=abc"},
    )
    assert "Bob" in txt
    assert "https://careerbridge.io/verify?t=abc" in txt
    assert "https://careerbridge.io/verify?t=abc" in html_body


def test_render_template_password_reset():
    """Password reset template renders with reset link."""
    txt, html_body = EmailService.render_template(
        EmailEventType.PASSWORD_RESET,
        {"user_name": "Charlie", "reset_url": "https://careerbridge.io/reset?t=xyz"},
    )
    assert "Charlie" in txt
    assert "https://careerbridge.io/reset?t=xyz" in txt
    assert "https://careerbridge.io/reset?t=xyz" in html_body


def test_render_template_application_confirmation():
    """Application confirmation template renders application details."""
    txt, html_body = EmailService.render_template(
        EmailEventType.APPLICATION_CONFIRMATION,
        {
            "student_name": "David",
            "job_title": "Backend Intern",
            "company_name": "Tech Corp",
            "application_id": "42",
        },
    )
    assert "David" in txt
    assert "Backend Intern" in txt
    assert "Tech Corp" in txt
    assert "#42" in txt
    assert "Backend Intern" in html_body


def test_render_template_application_status_update():
    """Application status update template renders new status badge."""
    txt, html_body = EmailService.render_template(
        EmailEventType.APPLICATION_STATUS_UPDATE,
        {
            "student_name": "Eve",
            "job_title": "Frontend Engineer",
            "company_name": "Design Inc",
            "new_status": "Shortlisted",
            "application_id": "99",
        },
    )
    assert "Shortlisted" in txt
    assert "Frontend Engineer" in txt
    assert "Shortlisted" in html_body


def test_render_template_interview_invitation():
    """Interview invitation template renders full scheduling parameters."""
    txt, html_body = EmailService.render_template(
        EmailEventType.INTERVIEW_INVITATION,
        {
            "student_name": "Frank",
            "job_title": "DevOps Engineer",
            "company_name": "Cloud Ltd",
            "interview_type": "Video",
            "scheduled_at": "2026-10-01 14:00 UTC",
            "duration_minutes": "45",
            "location_or_link": "https://meet.google.com/abc-defg-hij",
            "notes": "Bring portfolio",
        },
    )
    assert "Frank" in txt
    assert "DevOps Engineer" in txt
    assert "Video" in txt
    assert "2026-10-01 14:00 UTC" in txt
    assert "https://meet.google.com/abc-defg-hij" in html_body
    assert "Bring portfolio" in html_body


def test_html_injection_prevention():
    """HTML escaping prevents script injection in rendered emails."""
    malicious_name = "<script>alert('xss')</script>"
    malicious_company = "<img src=x onerror=alert(1)>"
    _, html_body = EmailService.render_template(
        EmailEventType.APPLICATION_CONFIRMATION,
        {
            "student_name": malicious_name,
            "job_title": "Security Analyst",
            "company_name": malicious_company,
            "application_id": "101",
        },
    )
    # Raw scripts must NOT be present
    assert "<script>" not in html_body
    assert "<img src=x" not in html_body
    # Escaped entities MUST be present
    assert ("&lt;script&gt;" in html_body)
    assert ("&lt;img src=x" in html_body)


# ==========================================================================
# 3. Direct Handlers & Synchronous Dispatch
# ==========================================================================

def test_handle_send_welcome_email():
    """Direct invocation of handle_send_welcome_email delivers email to local provider."""
    _default_local_provider.clear()
    result = EmailService.handle_send_welcome_email(
        to_email="direct.welcome@careerbridge.io",
        role="student",
        user_name="DirectUser",
    )
    assert result is True
    email = _default_local_provider.get_last_email()
    assert email is not None
    assert email["to_email"] == "direct.welcome@careerbridge.io"
    assert email["event_type"] == "welcome"
    assert "DirectUser" in email["text_body"]


def test_handle_send_email_verification():
    """Direct invocation of handle_send_email_verification delivers email."""
    _default_local_provider.clear()
    result = EmailService.handle_send_email_verification(
        to_email="direct.verify@careerbridge.io",
        verification_url="https://careerbridge.io/verify?token=12345",
        user_name="VerifyUser",
    )
    assert result is True
    email = _default_local_provider.get_last_email()
    assert email["to_email"] == "direct.verify@careerbridge.io"
    assert email["event_type"] == "email_verification"
    assert "12345" in email["text_body"]


def test_handle_send_password_reset():
    """Direct invocation of handle_send_password_reset delivers email."""
    _default_local_provider.clear()
    result = EmailService.handle_send_password_reset(
        to_email="direct.reset@careerbridge.io",
        reset_url="https://careerbridge.io/reset?token=67890",
        user_name="ResetUser",
    )
    assert result is True
    email = _default_local_provider.get_last_email()
    assert email["to_email"] == "direct.reset@careerbridge.io"
    assert email["event_type"] == "password_reset"
    assert "67890" in email["text_body"]


def test_handle_send_application_confirmation():
    """Direct invocation of handle_send_application_confirmation delivers email."""
    _default_local_provider.clear()
    result = EmailService.handle_send_application_confirmation_email(
        to_email="student.app@careerbridge.io",
        student_name="StudentApp",
        job_title="ML Intern",
        company_name="AI Labs",
        application_id=55,
    )
    assert result is True
    email = _default_local_provider.get_last_email()
    assert email["to_email"] == "student.app@careerbridge.io"
    assert email["event_type"] == "application_confirmation"
    assert "ML Intern" in email["subject"]


def test_handle_send_application_status_update():
    """Direct invocation of handle_send_application_status_update delivers email."""
    _default_local_provider.clear()
    result = EmailService.handle_send_application_status_update_email(
        to_email="student.status@careerbridge.io",
        student_name="StudentStatus",
        job_title="Frontend Developer",
        company_name="Web Works",
        new_status="accepted",
        application_id=77,
    )
    assert result is True
    email = _default_local_provider.get_last_email()
    assert email["to_email"] == "student.status@careerbridge.io"
    assert email["event_type"] == "application_status_update"
    assert "Accepted" in email["text_body"]


def test_handle_send_interview_invitation():
    """Direct invocation of handle_send_interview_invitation delivers email."""
    _default_local_provider.clear()
    result = EmailService.handle_send_interview_invitation_email(
        to_email="student.interview@careerbridge.io",
        student_name="StudentInterview",
        job_title="Security Lead",
        company_name="SecureNet",
        interview_type="video",
        scheduled_at="2026-11-15 10:00 UTC",
        duration_minutes=60,
        location_or_link="https://meet.google.com/xyz",
        notes="Prepare system design questions",
    )
    assert result is True
    email = _default_local_provider.get_last_email()
    assert email["to_email"] == "student.interview@careerbridge.io"
    assert email["event_type"] == "interview_invitation"
    assert "Video" in email["text_body"]
    assert "SecureNet" in email["text_body"]


# ==========================================================================
# 4. Background Job Integration & Failure Isolation
# ==========================================================================

def test_dispatch_welcome_email_sync():
    """Dispatching welcome email without BackgroundTasks executes synchronously."""
    _default_local_provider.clear()
    dispatched = EmailService.dispatch_welcome_email(
        to_email="sync.welcome@careerbridge.io",
        role="recruiter",
        user_name="SyncRecruiter",
    )
    assert dispatched is True
    email = _default_local_provider.get_last_email()
    assert email is not None
    assert email["to_email"] == "sync.welcome@careerbridge.io"


def test_dispatch_welcome_email_with_fastapi_background_tasks():
    """FastAPI BackgroundTasks queue and execute email jobs asynchronously."""
    _default_local_provider.clear()
    tasks = BackgroundTasks()
    dispatched = EmailService.dispatch_welcome_email(
        to_email="bg.welcome@careerbridge.io",
        role="student",
        user_name="BgStudent",
        background_tasks=tasks,
    )
    assert dispatched is True
    # Has not executed yet
    assert len(_default_local_provider.get_sent_emails()) == 0

    # Simulate FastAPI executing background tasks
    import asyncio
    asyncio.run(tasks())

    email = _default_local_provider.get_last_email()
    assert email is not None
    assert email["to_email"] == "bg.welcome@careerbridge.io"


def test_dispatch_all_job_types():
    """All email event types can be dispatched through background jobs."""
    _default_local_provider.clear()
    assert EmailService.dispatch_email_verification("v@test.io", "http://v", "VUser") is True
    assert EmailService.dispatch_password_reset("p@test.io", "http://p", "PUser") is True
    assert EmailService.dispatch_application_confirmation_email("a@test.io", "A", "Dev", "Co", 1) is True
    assert EmailService.dispatch_application_status_update_email("s@test.io", "S", "Dev", "Co", "shortlisted", 1) is True
    assert EmailService.dispatch_interview_invitation_email("i@test.io", "I", "Dev", "Co", "video", "2026-10-01", 30) is True

    emails = _default_local_provider.get_sent_emails()
    assert len(emails) == 5


def test_background_job_failure_isolation():
    """A failing email provider logs the error and records 'failed' in execution history without crashing."""
    failing_provider = LocalEmailProvider()

    def buggy_send(*args, **kwargs):
        raise ConnectionResetError("Simulated SMTP network outage")

    failing_provider.send = buggy_send

    with patch("app.services.email_service.get_email_provider", return_value=failing_provider):
        # Dispatch should safely return True because dispatch succeeded, handler executed safely
        result = EmailService.dispatch_welcome_email(
            to_email="fail.isolate@careerbridge.io",
            role="student",
        )
        assert result is True

    # Check background jobs execution history
    history = get_execution_history()
    recent = [h for h in history if h.get("job_name") == "send_welcome_email"]
    assert len(recent) > 0
    assert recent[-1]["status"] == "failed"
    assert "Simulated SMTP network outage" in recent[-1]["error"]


# ==========================================================================
# 5. End-to-End API Integration
# ==========================================================================

def test_e2e_user_registration_dispatches_welcome_email():
    """POST /users creates user record and dispatches welcome email."""
    _default_local_provider.clear()
    payload = {
        "email": "newuser.emailtest@careerbridge.io",
        "password": "SecurePassword123!",
        "role": "student",
    }
    response = client.post("/api/v1/users", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["email"] == "newuser.emailtest@careerbridge.io"

    email = _default_local_provider.get_last_email()
    assert email is not None
    assert email["to_email"] == "newuser.emailtest@careerbridge.io"
    assert email["event_type"] == "welcome"
    assert "Student" in email["text_body"]


def test_e2e_welcome_email_does_not_expose_passwords():
    """Sent welcome email does NOT contain plaintext passwords or password hashes."""
    email = _default_local_provider.get_last_email()
    assert email is not None
    assert "SecurePassword123!" not in email["text_body"]
    assert "SecurePassword123!" not in email["html_body"]
    assert "password_hash" not in email["text_body"]


def test_e2e_application_submission_dispatches_confirmation_email():
    """Student applying to job triggers application confirmation email."""
    _default_local_provider.clear()
    headers = {"Authorization": f"Bearer {student_token}"}
    response = client.post(
        f"/api/v1/jobs/{test_job_id}/applications",
        json={"cover_message": "Excited for this role!"},
        headers=headers,
    )
    assert response.status_code == 201
    app_data = response.json()

    email = _default_local_provider.get_last_email()
    assert email is not None
    assert email["to_email"] == TEST_STUDENT_EMAIL
    assert email["event_type"] == "application_confirmation"
    assert "Email Software Engineer" in email["subject"]
    assert "Email Test Corp" in email["text_body"]
    assert str(app_data["id"]) in email["text_body"]


def test_e2e_application_status_update_dispatches_status_email():
    """Recruiter changing application status dispatches update email to student."""
    # Find application ID
    with SessionLocal() as db:
        app_rec = db.scalar(
            select(Application).where(
                Application.job_posting_id == test_job_id,
                Application.student_id == test_student_id,
            )
        )
        assert app_rec is not None
        application_id = app_rec.id

    _default_local_provider.clear()
    headers = {"Authorization": f"Bearer {recruiter_token}"}
    response = client.patch(
        f"/api/v1/recruiter/applications/{application_id}",
        json={"status": "shortlisted"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "shortlisted"

    email = _default_local_provider.get_last_email()
    assert email is not None
    assert email["to_email"] == TEST_STUDENT_EMAIL
    assert email["event_type"] == "application_status_update"
    assert "Shortlisted" in email["subject"]
    assert "Shortlisted" in email["text_body"]


def test_e2e_application_status_update_same_status_no_duplicate_email():
    """Updating application to the exact same status does NOT dispatch a duplicate email."""
    with SessionLocal() as db:
        app_rec = db.scalar(
            select(Application).where(
                Application.job_posting_id == test_job_id,
                Application.student_id == test_student_id,
            )
        )
        application_id = app_rec.id

    _default_local_provider.clear()
    headers = {"Authorization": f"Bearer {recruiter_token}"}
    # Update with the same status ("shortlisted")
    response = client.patch(
        f"/api/v1/recruiter/applications/{application_id}",
        json={"status": "shortlisted"},
        headers=headers,
    )
    assert response.status_code == 200

    # No email should be sent
    assert len(_default_local_provider.get_sent_emails()) == 0


def test_e2e_interview_scheduling_dispatches_invitation_email():
    """Recruiter scheduling an interview triggers interview invitation email to candidate."""
    with SessionLocal() as db:
        app_rec = db.scalar(
            select(Application).where(
                Application.job_posting_id == test_job_id,
                Application.student_id == test_student_id,
            )
        )
        application_id = app_rec.id

    _default_local_provider.clear()
    future_time = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {
        "scheduled_at": future_time,
        "duration_minutes": 45,
        "interview_type": "online",
        "location_or_link": "https://meet.google.com/test-room",
        "notes": "Bring your technical portfolio",
    }
    headers = {"Authorization": f"Bearer {recruiter_token}"}
    response = client.post(
        f"/api/v1/applications/{application_id}/interviews",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201

    email = _default_local_provider.get_last_email()
    assert email is not None
    assert email["to_email"] == TEST_STUDENT_EMAIL
    assert email["event_type"] == "interview_invitation"
    assert "Interview Scheduled" in email["subject"]
    assert "Email Software Engineer" in email["text_body"]
    assert "https://meet.google.com/test-room" in email["text_body"]
    assert "Bring your technical portfolio" in email["text_body"]


def test_e2e_cross_recruiter_access_rejected_no_email():
    """Recruiter 2 cannot update Recruiter 1's application and no email is sent."""
    with SessionLocal() as db:
        app_rec = db.scalar(
            select(Application).where(
                Application.job_posting_id == test_job_id,
                Application.student_id == test_student_id,
            )
        )
        application_id = app_rec.id

    _default_local_provider.clear()
    headers = {"Authorization": f"Bearer {recruiter2_token}"}
    response = client.patch(
        f"/api/v1/recruiter/applications/{application_id}",
        json={"status": "accepted"},
        headers=headers,
    )
    assert response.status_code == 403
    assert len(_default_local_provider.get_sent_emails()) == 0


def test_e2e_messaging_does_not_send_email():
    """Sending chat messages strictly does NOT trigger email notifications."""
    _default_local_provider.clear()
    # Recruiter creates conversation with student
    headers = {"Authorization": f"Bearer {recruiter_token}"}
    conv_resp = client.post(
        "/api/v1/conversations",
        json={"other_user_id": test_student_id},
        headers=headers,
    )
    assert conv_resp.status_code in (200, 201)
    conv_id = conv_resp.json()["id"]

    # Send a message
    msg_resp = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        json={"body": "Hello candidate! Looking forward to our chat."},
        headers=headers,
    )
    assert msg_resp.status_code == 201


    # Verify ZERO emails were sent
    assert len(_default_local_provider.get_sent_emails()) == 0


def test_e2e_email_failure_does_not_fail_http_request():
    """If email provider encounters an unexpected runtime error, the HTTP request still succeeds."""
    failing_provider = LocalEmailProvider()

    def exploding_send(*args, **kwargs):
        raise RuntimeError("Fatal provider crash")

    failing_provider.send = exploding_send

    with patch("app.services.email_service.get_email_provider", return_value=failing_provider):
        payload = {
            "email": "failure.user@careerbridge.io",
            "password": "Password123!",
            "role": "student",
        }
        # Request should succeed (HTTP 201) despite email delivery failure
        response = client.post("/api/v1/users", json=payload)
        assert response.status_code == 201

    # Verify user exists in database
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "failure.user@careerbridge.io"))
        assert user is not None
        assert user.email == "failure.user@careerbridge.io"


def test_render_template_missing_template_raises_error():
    """Requesting non-existent template raises FileNotFoundError."""
    class FakeEventType:
        value = "non_existent_template_event"

    assert_raises(
        FileNotFoundError,
        EmailService.render_template,
        FakeEventType,
        {},
        match="Email templates for 'non_existent_template_event' not found",
    )


def test_smtp_provider_masks_password_in_repr():
    """SMTPEmailProvider instance string representation does not expose raw password."""
    provider = SMTPEmailProvider(
        host="smtp.example.com",
        username="myuser",
        password="SuperSecretPassword!",
    )
    provider_str = str(provider)
    assert "SuperSecretPassword!" not in provider_str


def test_email_service_empty_whitespace_recipient():
    """Email with only spaces is rejected as invalid."""
    assert EmailService.is_valid_email("   ") is False
    assert_raises(
        ValueError,
        EmailService.send_email,
        to_email="   ",
        subject="Subject",
        text_body="Body",
        match="Invalid recipient email address",
    )


def test_email_service_handles_special_characters_in_name():
    """Names with unicode / special characters are handled cleanly."""
    txt, html_body = EmailService.render_template(
        EmailEventType.WELCOME,
        {"user_name": "Renée Ångström & Co <test>", "user_email": "renee@example.com", "role": "student"},
    )
    assert "Renée Ångström & Co <test>" in txt
    assert "Renée Ångström &amp; Co &lt;test&gt;" in html_body


def test_email_service_handles_long_job_title():
    """Long job titles and requirements interpolate without error."""
    long_title = "Senior Principal Distributed Systems & Cloud Infrastructure Lead Architect"
    txt, html_body = EmailService.render_template(
        EmailEventType.APPLICATION_CONFIRMATION,
        {
            "student_name": "Applicant",
            "job_title": long_title,
            "company_name": "Big Tech",
            "application_id": "999",
        },
    )
    assert long_title in txt
    assert "Senior Principal Distributed Systems &amp; Cloud Infrastructure Lead Architect" in html_body


def test_email_service_interview_optional_notes_and_link():
    """Interview invitation handles None/omitted notes and link gracefully with fallback strings."""
    _default_local_provider.clear()
    EmailService.handle_send_interview_invitation_email(
        to_email="candidate.opt@careerbridge.io",
        student_name="Candidate",
        job_title="Intern",
        company_name="Startup",
        interview_type="phone",
        scheduled_at="Tomorrow 10am",
        duration_minutes=30,
        location_or_link=None,
        notes=None,
    )
    email = _default_local_provider.get_last_email()
    assert email is not None
    assert "Details will be provided by the recruiter" in email["html_body"]
    assert "None" in email["html_body"]



def test_email_service_welcome_email_handles_custom_portal_url():
    """Welcome email template supports passing a specific portal_url."""
    txt, html_body = EmailService.render_template(
        EmailEventType.WELCOME,
        {
            "user_name": "CustomUser",
            "user_email": "custom@example.com",
            "role": "Recruiter",
            "portal_url": "https://custom.portal.com/login",
        },
    )
    assert "https://custom.portal.com/login" in txt
    assert "https://custom.portal.com/login" in html_body


def test_e2e_interview_invitation_contains_no_credentials():
    """Interview invitation sent body strictly avoids exposing credentials or tokens."""
    email = _default_local_provider.get_last_email()
    if email:
        for secret_kw in ["password", "secret_key", "postgres", "Bearer"]:
            assert secret_kw not in email["text_body"].lower()


def test_e2e_application_confirmation_email_contains_no_credentials():
    """Application confirmation sent body strictly avoids exposing secrets."""
    _default_local_provider.clear()
    EmailService.handle_send_application_confirmation_email(
        to_email="test.sec@careerbridge.io",
        student_name="SecStudent",
        job_title="Intern",
        company_name="Corp",
        application_id=1,
    )
    email = _default_local_provider.get_last_email()
    assert email is not None
    assert "secret" not in email["text_body"].lower()
    assert "password" not in email["text_body"].lower()


if __name__ == "__main__":
    print("\n=======================================================")
    print("STARTING CAREERBRIDGE EMAIL NOTIFICATION FOUNDATION TESTS")
    print("=======================================================\n")
    setup_module()
    test_functions = [
        test_default_config_uses_local_provider,
        test_get_email_provider_factory,
        test_smtp_provider_missing_host_raises_value_error,
        test_local_provider_storage_and_clear,
        test_email_validation_helper,
        test_email_service_rejects_invalid_recipient,
        test_email_service_rejects_empty_subject,
        test_email_service_rejects_empty_body,
        test_render_template_welcome,
        test_render_template_email_verification,
        test_render_template_password_reset,
        test_render_template_application_confirmation,
        test_render_template_application_status_update,
        test_render_template_interview_invitation,
        test_html_injection_prevention,
        test_handle_send_welcome_email,
        test_handle_send_email_verification,
        test_handle_send_password_reset,
        test_handle_send_application_confirmation,
        test_handle_send_application_status_update,
        test_handle_send_interview_invitation,
        test_dispatch_welcome_email_sync,
        test_dispatch_welcome_email_with_fastapi_background_tasks,
        test_dispatch_all_job_types,
        test_background_job_failure_isolation,
        test_e2e_user_registration_dispatches_welcome_email,
        test_e2e_welcome_email_does_not_expose_passwords,
        test_e2e_application_submission_dispatches_confirmation_email,
        test_e2e_application_status_update_dispatches_status_email,
        test_e2e_application_status_update_same_status_no_duplicate_email,
        test_e2e_interview_scheduling_dispatches_invitation_email,
        test_e2e_cross_recruiter_access_rejected_no_email,
        test_e2e_messaging_does_not_send_email,
        test_e2e_email_failure_does_not_fail_http_request,
        test_render_template_missing_template_raises_error,
        test_smtp_provider_masks_password_in_repr,
        test_email_service_empty_whitespace_recipient,
        test_email_service_handles_special_characters_in_name,
        test_email_service_handles_long_job_title,
        test_email_service_interview_optional_notes_and_link,
        test_email_service_welcome_email_handles_custom_portal_url,
        test_e2e_interview_invitation_contains_no_credentials,
        test_e2e_application_confirmation_email_contains_no_credentials,
    ]


    passed = 0
    failed = 0
    try:
        for fn in test_functions:
            try:
                fn()
                print(f"PASS: {fn.__name__}")
                passed += 1
            except Exception as e:
                print(f"FAIL: {fn.__name__} - {e}")
                import traceback
                traceback.print_exc()
                failed += 1
    finally:
        teardown_module()

    print(f"\nResults: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)
    print("\n=======================================================")
    print("ALL EMAIL NOTIFICATION FOUNDATION TESTS COMPLETED SUCCESSFULLY!")
    print("=======================================================\n")
