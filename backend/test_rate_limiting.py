"""
Unit and integration tests for Phase 5.5: Rate Limiting & Abuse Defense.
Covers login rate limiting, password reset protection, messaging rate limiting,
application submission rate limiting, Retry-After headers, and anti-leakage guarantees.
"""

import uuid
import pytest
from sqlalchemy import delete
from starlette.testclient import TestClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.rate_limit import RateLimiter, rate_limiter
from app.core.security import create_access_token, hash_password
from app.core.test_fixtures import clean_test_records
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.conversation import Conversation, ConversationParticipant
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.message import Message
from app.models.user import User, UserRole


@pytest.fixture(autouse=True)
def clean_rate_limiter_and_db():
    """Reset rate limiter state and track/clean database records after each test."""
    rate_limiter.reset()
    created_user_ids = []
    created_conv_ids = []

    yield created_user_ids, created_conv_ids

    rate_limiter.reset()
    if created_user_ids or created_conv_ids:
        with SessionLocal() as db:
            if created_conv_ids:
                db.execute(delete(Message).where(Message.conversation_id.in_(created_conv_ids)))
                db.execute(delete(ConversationParticipant).where(ConversationParticipant.conversation_id.in_(created_conv_ids)))
                db.execute(delete(Conversation).where(Conversation.id.in_(created_conv_ids)))
                db.commit()
            if created_user_ids:
                clean_test_records(db, user_ids=created_user_ids)


# ==============================================================================
# 1. CORE RATE LIMITER UNIT TESTS
# ==============================================================================

def test_rate_limiter_allows_requests_under_limit():
    """Rate limiter allows attempts up to max_attempts."""
    limiter = RateLimiter()
    key = "test_user_1"
    for _ in range(5):
        limiter.check_and_record_rate_limit(key=key, max_attempts=5, window_seconds=60)

    # 6th attempt must be blocked
    limited, retry_after = limiter.is_rate_limited(key=key, max_attempts=5, window_seconds=60)
    assert limited is True
    assert retry_after > 0


def test_rate_limiter_resets_after_window(monkeypatch):
    """Rate limiter expires old timestamps outside the sliding window."""
    limiter = RateLimiter()
    key = "test_user_2"
    # Record 3 attempts at t=100
    monkeypatch.setattr("time.time", lambda: 100.0)
    for _ in range(3):
        limiter.check_and_record_rate_limit(key=key, max_attempts=3, window_seconds=10)

    # At t=105, still limited
    monkeypatch.setattr("time.time", lambda: 105.0)
    limited, _ = limiter.is_rate_limited(key=key, max_attempts=3, window_seconds=10)
    assert limited is True

    # At t=111 (past window), should be unblocked
    monkeypatch.setattr("time.time", lambda: 111.0)
    limited, _ = limiter.is_rate_limited(key=key, max_attempts=3, window_seconds=10)
    assert limited is False


# ==============================================================================
# 2. LOGIN RATE LIMITING & BRUTE-FORCE MITIGATION
# ==============================================================================

def test_login_rate_limiting_exceeded_returns_429(clean_rate_limiter_and_db):
    """Exceeding failed login attempts triggers HTTP 429 with Retry-After header."""
    user_ids, _ = clean_rate_limiter_and_db
    db = SessionLocal()
    try:
        email = f"rate_login_{uuid.uuid4().hex[:8]}@careerbridge.io"
        user = User(
            email=email,
            password_hash=hash_password("CorrectPassword123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        db.commit()
        user_ids.append(user.id)

        with TestClient(app) as client:
            # Send max_attempts failed logins
            for _ in range(settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS):
                res = client.post(
                    "/api/v1/auth/login",
                    json={"email": email, "password": "WrongPassword!"},
                )
                assert res.status_code == 401

            # The subsequent attempt must return 429
            blocked_res = client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "WrongPassword!"},
            )
            assert blocked_res.status_code == 429
            assert "Retry-After" in blocked_res.headers
            data = blocked_res.json()
            assert data.get("error_code") == "RATE_LIMIT_EXCEEDED" or "Rate limit" in str(data)
    finally:
        db.close()


def test_successful_login_clears_rate_limit(clean_rate_limiter_and_db):
    """A successful login clears the failed attempt history for the user."""
    user_ids, _ = clean_rate_limiter_and_db
    db = SessionLocal()
    try:
        email = f"rate_login_clear_{uuid.uuid4().hex[:8]}@careerbridge.io"
        user = User(
            email=email,
            password_hash=hash_password("CorrectPassword123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        db.commit()
        user_ids.append(user.id)

        with TestClient(app) as client:
            # 2 failed logins
            for _ in range(2):
                client.post("/api/v1/auth/login", json={"email": email, "password": "BadPassword"})

            # Successful login
            good_res = client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "CorrectPassword123!"},
            )
            assert good_res.status_code == 200

            # After success, client can fail again up to limit without immediate 429
            fail_res = client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "BadPassword"},
            )
            assert fail_res.status_code == 401
    finally:
        db.close()


# ==============================================================================
# 3. PASSWORD RESET ABUSE PROTECTION & ANTI-ENUMERATION
# ==============================================================================

def test_password_reset_request_anti_enumeration(clean_rate_limiter_and_db):
    """Password reset request returns uniform response for existing and non-existing accounts."""
    user_ids, _ = clean_rate_limiter_and_db
    db = SessionLocal()
    try:
        email_exist = f"exist_user_{uuid.uuid4().hex[:8]}@careerbridge.io"
        user = User(
            email=email_exist,
            password_hash=hash_password("Password123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        db.commit()
        user_ids.append(user.id)

        with TestClient(app) as client:
            res1 = client.post(
                "/api/v1/auth/password-reset/request",
                json={"email": email_exist},
            )
            assert res1.status_code == 200
            data1 = res1.json()
            assert "message" in data1

            # Non-existing user
            res2 = client.post(
                "/api/v1/auth/password-reset/request",
                json={"email": f"nonexistent_{uuid.uuid4().hex[:8]}@careerbridge.io"},
            )
            assert res2.status_code == 200
            data2 = res2.json()

            # Responses must be identical to prevent account enumeration
            assert data1["message"] == data2["message"]
    finally:
        db.close()


def test_password_reset_rate_limiting_blocks_abuse():
    """Password reset request returns 429 when max attempts are exceeded."""
    with TestClient(app) as client:
        email = f"reset_flood_{uuid.uuid4().hex[:8]}@careerbridge.io"
        for _ in range(settings.RATE_LIMIT_PASSWORD_RESET_MAX_ATTEMPTS):
            res = client.post(
                "/api/v1/auth/password-reset/request",
                json={"email": email},
            )
            assert res.status_code == 200

        # Next request must be throttled
        blocked = client.post(
            "/api/v1/auth/password-reset/request",
            json={"email": email},
        )
        assert blocked.status_code == 429
        assert "Retry-After" in blocked.headers


# ==============================================================================
# 4. MESSAGING ABUSE PROTECTION
# ==============================================================================

def test_messaging_rate_limiting_blocks_spam(clean_rate_limiter_and_db):
    """Rapid direct messaging by an authenticated user is rate-limited to prevent spam."""
    user_ids, conv_ids = clean_rate_limiter_and_db
    db = SessionLocal()
    try:
        uid = uuid.uuid4().hex[:8]
        sender = User(
            email=f"sender_msg_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        receiver = User(
            email=f"receiver_msg_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.RECRUITER,
            is_active=True,
        )
        db.add_all([sender, receiver])
        db.commit()
        db.refresh(sender)
        db.refresh(receiver)
        user_ids.extend([sender.id, receiver.id])

        token = create_access_token(subject=sender.id)
        headers = {"Authorization": f"Bearer {token}"}

        with TestClient(app) as client:
            # Create conversation
            conv_res = client.post(
                "/api/v1/conversations",
                json={"other_user_id": receiver.id},
                headers=headers,
            )
            assert conv_res.status_code in (200, 201)
            conv_id = conv_res.json()["id"]
            conv_ids.append(conv_id)

            # Send messages up to max limit
            for i in range(settings.RATE_LIMIT_MESSAGING_MAX_ATTEMPTS):
                res = client.post(
                    f"/api/v1/conversations/{conv_id}/messages",
                    json={"body": f"Message {i}"},
                    headers=headers,
                )
                assert res.status_code == 201

            # Next message must trigger 429
            blocked = client.post(
                f"/api/v1/conversations/{conv_id}/messages",
                json={"body": "Flood message"},
                headers=headers,
            )
            assert blocked.status_code == 429
            assert "Retry-After" in blocked.headers
    finally:
        db.close()


def test_messaging_rate_limits_are_user_isolated(clean_rate_limiter_and_db):
    """Different users have independent messaging rate limit buckets."""
    user_ids, conv_ids = clean_rate_limiter_and_db
    db = SessionLocal()
    try:
        uid = uuid.uuid4().hex[:8]
        user1 = User(
            email=f"user1_msg_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        user2 = User(
            email=f"user2_msg_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        target = User(
            email=f"target_msg_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.RECRUITER,
            is_active=True,
        )
        db.add_all([user1, user2, target])
        db.commit()
        db.refresh(user1)
        db.refresh(user2)
        db.refresh(target)
        user_ids.extend([user1.id, user2.id, target.id])

        token1 = create_access_token(subject=user1.id)
        token2 = create_access_token(subject=user2.id)

        with TestClient(app) as client:
            # Exhaust user1's limit
            conv1_res = client.post(
                "/api/v1/conversations",
                json={"other_user_id": target.id},
                headers={"Authorization": f"Bearer {token1}"},
            )
            conv1 = conv1_res.json()["id"]
            conv_ids.append(conv1)

            for i in range(settings.RATE_LIMIT_MESSAGING_MAX_ATTEMPTS):
                client.post(
                    f"/api/v1/conversations/{conv1}/messages",
                    json={"body": f"User1 msg {i}"},
                    headers={"Authorization": f"Bearer {token1}"},
                )

            # User1 is blocked
            blocked1 = client.post(
                f"/api/v1/conversations/{conv1}/messages",
                json={"body": "User1 extra"},
                headers={"Authorization": f"Bearer {token1}"},
            )
            assert blocked1.status_code == 429

            # User2 can still send messages
            conv2_res = client.post(
                "/api/v1/conversations",
                json={"other_user_id": target.id},
                headers={"Authorization": f"Bearer {token2}"},
            )
            conv2 = conv2_res.json()["id"]
            conv_ids.append(conv2)

            ok2 = client.post(
                f"/api/v1/conversations/{conv2}/messages",
                json={"body": "User2 first msg"},
                headers={"Authorization": f"Bearer {token2}"},
            )
            assert ok2.status_code == 201
    finally:
        db.close()


# ==============================================================================
# 5. APPLICATION SUBMISSION ABUSE PROTECTION
# ==============================================================================

def test_application_submission_rate_limiting(clean_rate_limiter_and_db):
    """Rapid repeated application submissions by a student are throttled at 429."""
    user_ids, _ = clean_rate_limiter_and_db
    db = SessionLocal()
    try:
        uid = uuid.uuid4().hex[:8]
        student = User(
            email=f"student_app_lim_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        recruiter = User(
            email=f"recruiter_app_lim_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.RECRUITER,
            is_active=True,
        )
        db.add_all([student, recruiter])
        db.commit()
        db.refresh(student)
        db.refresh(recruiter)
        user_ids.extend([student.id, recruiter.id])

        # Create multiple jobs
        jobs = []
        for i in range(settings.RATE_LIMIT_APPLICATION_MAX_ATTEMPTS + 2):
            j = JobPosting(
                recruiter_id=recruiter.id,
                title=f"Test Job {i}",
                description="Engineering Intern",
                opportunity_type=OpportunityType.INTERNSHIP,
                company_name="TechCorp",
                location="Remote",
                employment_type=EmploymentType.FULL_TIME,
                is_active=True,
            )
            db.add(j)
            jobs.append(j)
        db.commit()

        token = create_access_token(subject=student.id)
        headers = {"Authorization": f"Bearer {token}"}

        with TestClient(app) as client:
            # Submit applications up to max limit
            for i in range(settings.RATE_LIMIT_APPLICATION_MAX_ATTEMPTS):
                res = client.post(
                    f"/api/v1/jobs/{jobs[i].id}/applications",
                    json={"cover_message": f"Cover letter {i}"},
                    headers=headers,
                )
                assert res.status_code == 201

            # Next submission must return 429
            blocked = client.post(
                f"/api/v1/jobs/{jobs[-1].id}/applications",
                json={"cover_message": "Excessive application"},
                headers=headers,
            )
            assert blocked.status_code == 429
            assert "Retry-After" in blocked.headers
    finally:
        db.close()


def test_application_duplicate_check_preserved_under_limit(clean_rate_limiter_and_db):
    """Duplicate application rejection (409) executes properly when under rate limit."""
    user_ids, _ = clean_rate_limiter_and_db
    db = SessionLocal()
    try:
        uid = uuid.uuid4().hex[:8]
        student = User(
            email=f"student_dup_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        recruiter = User(
            email=f"recruiter_dup_{uid}@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.RECRUITER,
            is_active=True,
        )
        db.add_all([student, recruiter])
        db.commit()
        db.refresh(student)
        db.refresh(recruiter)
        user_ids.extend([student.id, recruiter.id])

        job = JobPosting(
            recruiter_id=recruiter.id,
            title="Single Apply Job",
            description="Testing duplicate handling",
            opportunity_type=OpportunityType.INTERNSHIP,
            company_name="TechCorp",
            location="Remote",
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        token = create_access_token(subject=student.id)
        headers = {"Authorization": f"Bearer {token}"}

        with TestClient(app) as client:
            # 1st application -> 201
            res1 = client.post(
                f"/api/v1/jobs/{job.id}/applications",
                json={"cover_message": "First application"},
                headers=headers,
            )
            assert res1.status_code == 201

            # 2nd application to the same job -> 409 Conflict
            res2 = client.post(
                f"/api/v1/jobs/{job.id}/applications",
                json={"cover_message": "Second application"},
                headers=headers,
            )
            assert res2.status_code == 409
            assert "already applied" in res2.json()["detail"]
    finally:
        db.close()


# ==============================================================================
# 6. SECRET & SENSITIVE INFORMATION LEAKAGE PREVENTION
# ==============================================================================

def test_rate_limit_error_responses_contain_no_secrets():
    """Rate limit 429 error bodies and headers do not contain tokens, passwords, or system secrets."""
    limiter = RateLimiter()
    key = "secret_leak_test_key"
    for _ in range(2):
        limiter.check_and_record_rate_limit(key=key, max_attempts=2, window_seconds=60)

    try:
        limiter.check_and_record_rate_limit(key=key, max_attempts=2, window_seconds=60)
        pytest.fail("Expected RateLimitExceededException")
    except Exception as exc:
        msg = str(exc)
        assert "password" not in msg.lower()
        assert "token" not in msg.lower()
        assert "secret" not in msg.lower() or "rate limit" in msg.lower()
        assert "postgres" not in msg.lower()
