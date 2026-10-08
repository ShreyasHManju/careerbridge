"""
CareerBridge P0 Authentication Recovery Test Suite
Comprehensive tests for:
1. Email normalization across registration, login, and recovery.
2. Password reset request (local, uppercase, whitespace, nonexistent, Google, rate limiting, token invalidation, no raw token in DB).
3. Password reset confirmation (valid token, invalid token, expired token, used token, second use rejected, mismatch, old password rejected, new password accepted).
4. Change password (unauthenticated, wrong current, mismatch, successful change, session invalidation).
"""

from datetime import datetime, timedelta, timezone
import hashlib
import os
import sys
import time
from pathlib import Path
import uuid

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.rate_limit import rate_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.main import app
from app.models.base import Base
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User, UserRole
from app.services.email_service import EmailService

client = TestClient(app)

# Ensure password_reset_tokens table exists in the test DB schema
Base.metadata.create_all(bind=engine, tables=[PasswordResetToken.__table__], checkfirst=True)

PREFIX = f"recovery_{uuid.uuid4().hex[:6]}"
TEST_LOCAL_EMAIL = f"{PREFIX}_user@careerbridge.io"
TEST_LOCAL_PASSWORD = "OriginalPassword123!"
TEST_NEW_PASSWORD = "BrandNewSecurePassword456!"
TEST_GOOGLE_EMAIL = f"{PREFIX}_google@careerbridge.io"
TEST_UPPER_EMAIL = f"{PREFIX}_UPPER@careerbridge.io"


def cleanup_recovery_test_data():
    """Clean up test users and reset tokens created during this test run."""
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.email.like(f"{PREFIX}%"))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def run_auth_recovery_tests():
    print("\n=========================================================")
    print("STARTING P0 AUTHENTICATION RECOVERY TEST SUITE...")
    print("=========================================================\n")

    cleanup_recovery_test_data()

    # Clear rate limiter state for clean test execution
    rate_limiter._attempts.clear()

    try:
        # -------------------------------------------------------------
        # Setup test accounts
        # -------------------------------------------------------------
        with SessionLocal() as db:
            local_user = User(
                email=TEST_LOCAL_EMAIL.lower(),
                password_hash=hash_password(TEST_LOCAL_PASSWORD),
                role=UserRole.STUDENT,
                auth_provider="local",
                is_active=True,
                is_verified=True,
            )
            google_user = User(
                email=TEST_GOOGLE_EMAIL.lower(),
                password_hash=None,
                role=UserRole.STUDENT,
                auth_provider="google",
                google_subject=f"google_sub_{PREFIX}",
                is_active=True,
                is_verified=True,
            )
            # Create a user with historical mixed/uppercase email
            upper_user = User(
                email=TEST_UPPER_EMAIL,  # Stored with uppercase
                password_hash=hash_password(TEST_LOCAL_PASSWORD),
                role=UserRole.STUDENT,
                auth_provider="local",
                is_active=True,
                is_verified=True,
            )
            db.add_all([local_user, google_user, upper_user])
            db.commit()
            db.refresh(local_user)
            db.refresh(google_user)
            db.refresh(upper_user)
            local_user_id = local_user.id
            upper_user_id = upper_user.id

        print(f"[Setup] Created test users: local ID {local_user_id}, upper ID {upper_user_id}")

        # -------------------------------------------------------------
        # 1. Email Normalization & Login Tests
        # -------------------------------------------------------------
        print("\n--- 1. Email Normalization & Login ---")

        # 1.1 Login with exact lowercase email
        res = client.post("/api/v1/auth/login", json={"email": TEST_LOCAL_EMAIL.lower(), "password": TEST_LOCAL_PASSWORD})
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert "access_token" in res.json()
        print("  [PASS] Login with exact lowercase email")

        # 1.2 Login with uppercase input for lowercase account
        res = client.post("/api/v1/auth/login", json={"email": TEST_LOCAL_EMAIL.upper(), "password": TEST_LOCAL_PASSWORD})
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        print("  [PASS] Login with uppercase input for lowercase account")

        # 1.3 Login with lowercase input for historically uppercase account
        res = client.post("/api/v1/auth/login", json={"email": TEST_UPPER_EMAIL.lower(), "password": TEST_LOCAL_PASSWORD})
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        print("  [PASS] Login with lowercase input for historically uppercase account")

        # 1.4 Registration normalizes email to lowercase
        reg_email = f"{PREFIX}_REG_TEST@careerbridge.io"
        res = client.post("/api/v1/users", json={"email": reg_email, "password": "RegisterPassword123!", "role": "student"})
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        created_email = res.json()["email"]
        assert created_email == reg_email.lower(), f"Expected email to be lowercased, got {created_email}"
        print("  [PASS] Registration normalizes email to lowercase")

        # 1.5 Duplicate registration with different casing rejected
        res = client.post("/api/v1/users", json={"email": reg_email.lower(), "password": "RegisterPassword123!", "role": "student"})
        assert res.status_code == 409, f"Expected 409 conflict, got {res.status_code}"
        print("  [PASS] Duplicate registration with different casing rejected with 409")

        # -------------------------------------------------------------
        # 2. Password Reset Request Tests
        # -------------------------------------------------------------
        print("\n--- 2. Password Reset Request ---")

        # 2.1 Nonexistent email returns generic 200 response
        res = client.post("/api/v1/auth/password-reset/request", json={"email": f"nonexistent_{PREFIX}@careerbridge.io"})
        assert res.status_code == 200
        assert "message" in res.json()
        print("  [PASS] Nonexistent email returns generic 200 response (enumeration protected)")

        # 2.2 Google account returns generic 200 without creating token
        res = client.post("/api/v1/auth/password-reset/request", json={"email": TEST_GOOGLE_EMAIL})
        assert res.status_code == 200
        with SessionLocal() as db:
            google_tokens = db.scalars(select(PasswordResetToken).where(PasswordResetToken.user_id == google_user.id)).all()
            assert len(google_tokens) == 0, "Google account must not receive password reset tokens"
        print("  [PASS] Google account returns generic 200 without creating reset token")

        # 2.3 Valid local account receives reset token in DB
        res = client.post("/api/v1/auth/password-reset/request", json={"email": TEST_LOCAL_EMAIL})
        assert res.status_code == 200
        with SessionLocal() as db:
            tokens = db.scalars(
                select(PasswordResetToken)
                .where(PasswordResetToken.user_id == local_user_id, PasswordResetToken.used_at.is_(None))
            ).all()
            assert len(tokens) == 1, f"Expected 1 active token, found {len(tokens)}"
            first_token_hash = tokens[0].token_hash
            # Verify token hash is 64-char SHA-256
            assert len(first_token_hash) == 64, "Token hash must be 64-char SHA-256"
        print("  [PASS] Valid local account creates active SHA-256 token record (raw token not persisted)")

        # 2.4 Case-insensitive & whitespace reset request
        res = client.post("/api/v1/auth/password-reset/request", json={"email": f"  {TEST_UPPER_EMAIL.lower()}  "})
        assert res.status_code == 200
        with SessionLocal() as db:
            upper_tokens = db.scalars(
                select(PasswordResetToken).where(PasswordResetToken.user_id == upper_user_id)
            ).all()
            assert len(upper_tokens) >= 1, "Password reset request on uppercase user with whitespace succeeded"
        print("  [PASS] Case-insensitive and whitespace reset request recognized")

        # 2.5 Requesting a second reset token invalidates the previous unused token
        res = client.post("/api/v1/auth/password-reset/request", json={"email": TEST_LOCAL_EMAIL})
        assert res.status_code == 200
        with SessionLocal() as db:
            active_tokens = db.scalars(
                select(PasswordResetToken)
                .where(PasswordResetToken.user_id == local_user_id, PasswordResetToken.used_at.is_(None))
            ).all()
            all_tokens = db.scalars(
                select(PasswordResetToken).where(PasswordResetToken.user_id == local_user_id)
            ).all()
            assert len(active_tokens) == 1, "Only the newest token must remain active"
            assert len(all_tokens) == 2, "Previous token must exist but be marked used/invalidated"
        print("  [PASS] Previous unused reset token invalidated on new request")

        # 2.6 Rate limiting on password reset request
        if settings.RATE_LIMIT_PASSWORD_RESET_ENABLED:
            rate_limiter._attempts.clear()
            rate_email = f"{PREFIX}_ratelimit@careerbridge.io"
            for _ in range(settings.RATE_LIMIT_PASSWORD_RESET_MAX_ATTEMPTS):
                client.post("/api/v1/auth/password-reset/request", json={"email": rate_email})
            # Next request should be rate limited (429)
            res = client.post("/api/v1/auth/password-reset/request", json={"email": rate_email})
            assert res.status_code == 429, f"Expected 429 rate limit, got {res.status_code}"
            print("  [PASS] Rate limiting enforces 429 on excessive password reset requests")
            rate_limiter._attempts.clear()

        # -------------------------------------------------------------
        # 3. Password Reset Confirmation Tests
        # -------------------------------------------------------------
        print("\n--- 3. Password Reset Confirmation ---")

        # Create known fresh token for confirmation tests
        raw_test_token = f"test_raw_token_{uuid.uuid4().hex}"
        test_token_hash = hashlib.sha256(raw_test_token.encode("utf-8")).hexdigest()
        now_utc = datetime.now(timezone.utc)

        with SessionLocal() as db:
            # Clear existing tokens for local_user
            db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == local_user_id))
            token_rec = PasswordResetToken(
                user_id=local_user_id,
                token_hash=test_token_hash,
                expires_at=now_utc + timedelta(minutes=15),
            )
            db.add(token_rec)
            db.commit()

        # 3.1 Invalid / unknown token rejected
        res = client.post("/api/v1/auth/password-reset/confirm", json={
            "token": "completely_bogus_token_12345",
            "new_password": TEST_NEW_PASSWORD,
            "confirm_password": TEST_NEW_PASSWORD,
        })
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("  [PASS] Unknown token rejected with 400")

        # 3.2 Password confirmation mismatch rejected
        res = client.post("/api/v1/auth/password-reset/confirm", json={
            "token": raw_test_token,
            "new_password": TEST_NEW_PASSWORD,
            "confirm_password": "MismatchPassword999!",
        })
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("  [PASS] Password confirmation mismatch rejected with 400")

        # 3.3 Short new password (<8 chars) rejected by schema validation
        res = client.post("/api/v1/auth/password-reset/confirm", json={
            "token": raw_test_token,
            "new_password": "short",
            "confirm_password": "short",
        })
        assert res.status_code == 422, f"Expected 422, got {res.status_code}"
        print("  [PASS] Short password (<8 chars) rejected with 422")

        # 3.4 Expired token rejected
        expired_raw = f"expired_raw_{uuid.uuid4().hex}"
        expired_hash = hashlib.sha256(expired_raw.encode("utf-8")).hexdigest()
        with SessionLocal() as db:
            db.add(PasswordResetToken(
                user_id=local_user_id,
                token_hash=expired_hash,
                expires_at=now_utc - timedelta(minutes=5),  # Expired 5 mins ago
            ))
            db.commit()

        res = client.post("/api/v1/auth/password-reset/confirm", json={
            "token": expired_raw,
            "new_password": TEST_NEW_PASSWORD,
            "confirm_password": TEST_NEW_PASSWORD,
        })
        assert res.status_code == 400, f"Expected 400 for expired token, got {res.status_code}"
        print("  [PASS] Expired token rejected with 400")

        # 3.5 Valid token confirmation succeeds
        res = client.post("/api/v1/auth/password-reset/confirm", json={
            "token": raw_test_token,
            "new_password": TEST_NEW_PASSWORD,
            "confirm_password": TEST_NEW_PASSWORD,
        })
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert "message" in res.json()
        print("  [PASS] Valid token reset confirmation succeeds with 200")

        # 3.6 Token marked used_at in DB
        with SessionLocal() as db:
            used_rec = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == test_token_hash))
            assert used_rec.used_at is not None, "Token used_at must be populated after successful reset"
        print("  [PASS] Reset token marked used in database")

        # 3.7 Second use of the same token rejected (single-use enforcement)
        res = client.post("/api/v1/auth/password-reset/confirm", json={
            "token": raw_test_token,
            "new_password": "AnotherNewPassword999!",
            "confirm_password": "AnotherNewPassword999!",
        })
        assert res.status_code == 400, f"Expected 400 on second use, got {res.status_code}"
        print("  [PASS] Second use of reset token rejected with 400 (single-use enforced)")

        # 3.8 Old password rejected on login
        res = client.post("/api/v1/auth/login", json={"email": TEST_LOCAL_EMAIL, "password": TEST_LOCAL_PASSWORD})
        assert res.status_code == 401, f"Expected 401 with old password, got {res.status_code}"
        print("  [PASS] Old password rejected on login")

        # 3.9 New password accepted on login
        res = client.post("/api/v1/auth/login", json={"email": TEST_LOCAL_EMAIL, "password": TEST_NEW_PASSWORD})
        assert res.status_code == 200, f"Expected 200 with new password, got {res.status_code}"
        assert "access_token" in res.json()
        print("  [PASS] New password accepted on login")

        # -------------------------------------------------------------
        # 4. Change Password Tests
        # -------------------------------------------------------------
        print("\n--- 4. Change Password ---")

        # Obtain valid access token
        login_res = client.post("/api/v1/auth/login", json={"email": TEST_LOCAL_EMAIL, "password": TEST_NEW_PASSWORD})
        active_jwt = login_res.json()["access_token"]
        auth_header = {"Authorization": f"Bearer {active_jwt}"}

        # 4.1 Unauthenticated request rejected
        res = client.post("/api/v1/auth/change-password", json={
            "current_password": TEST_NEW_PASSWORD,
            "new_password": "ThirdPassword789!",
            "confirm_password": "ThirdPassword789!",
        })
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  [PASS] Unauthenticated request to /change-password rejected with 401")

        # 4.2 Wrong current password rejected
        res = client.post("/api/v1/auth/change-password", headers=auth_header, json={
            "current_password": "WrongCurrentPassword123!",
            "new_password": "ThirdPassword789!",
            "confirm_password": "ThirdPassword789!",
        })
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("  [PASS] Wrong current password rejected with 400")

        # 4.3 Confirmation mismatch rejected
        res = client.post("/api/v1/auth/change-password", headers=auth_header, json={
            "current_password": TEST_NEW_PASSWORD,
            "new_password": "ThirdPassword789!",
            "confirm_password": "DifferentPassword789!",
        })
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("  [PASS] Confirmation mismatch rejected with 400")

        # 4.4 Short new password rejected
        res = client.post("/api/v1/auth/change-password", headers=auth_header, json={
            "current_password": TEST_NEW_PASSWORD,
            "new_password": "short",
            "confirm_password": "short",
        })
        assert res.status_code == 422, f"Expected 422, got {res.status_code}"
        print("  [PASS] Short new password rejected with 422")

        # 4.5 Successful password change
        THIRD_PASSWORD = "FinalChangedPassword999!"
        # Sleep 1.5 seconds so token iat is strictly before the password change timestamp
        time.sleep(1.5)
        res = client.post("/api/v1/auth/change-password", headers=auth_header, json={
            "current_password": TEST_NEW_PASSWORD,
            "new_password": THIRD_PASSWORD,
            "confirm_password": THIRD_PASSWORD,
        })
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        print("  [PASS] Successful password change returns 200")

        # 4.6 Previous session token invalidated after password change
        res = client.get("/api/v1/auth/me", headers=auth_header)
        assert res.status_code == 401, f"Expected 401 for old session token, got {res.status_code}"
        print("  [PASS] Previous session token invalidated after password change")

        # 4.7 Old password rejected on login
        res = client.post("/api/v1/auth/login", json={"email": TEST_LOCAL_EMAIL, "password": TEST_NEW_PASSWORD})
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  [PASS] Pre-change password rejected on login")

        # 4.8 New password accepted on login and new token works on /me
        login_res2 = client.post("/api/v1/auth/login", json={"email": TEST_LOCAL_EMAIL, "password": THIRD_PASSWORD})
        assert login_res2.status_code == 200
        new_jwt = login_res2.json()["access_token"]
        me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_jwt}"})
        assert me_res.status_code == 200
        assert me_res.json()["id"] == local_user_id
        print("  [PASS] New credentials log in successfully and new token accesses /me")

        print("\n=========================================================")
        print("ALL P0 AUTHENTICATION RECOVERY TESTS PASSED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_recovery_test_data()


if __name__ == "__main__":
    run_auth_recovery_tests()
