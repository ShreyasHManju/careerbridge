"""
CareerBridge Phase 6 Authentication & JWT Test Suite
Tests JWT creation, login endpoint, protected /me endpoint, account status, token validation, and error handling.
"""

from datetime import datetime, timedelta, timezone
import os
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from unittest.mock import patch
from fastapi.testclient import TestClient
import jwt
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User, UserRole

client = TestClient(app)

TEST_USER_EMAIL = "auth.test.user@careerbridge.io"
TEST_USER_PASSWORD = "ValidAuthPassword123!"
TEST_INACTIVE_EMAIL = "auth.inactive.user@careerbridge.io"
TEST_GOOGLE_NEW_EMAIL = "auth.google.new@careerbridge.io"
TEST_GOOGLE_EXISTING_EMAIL = "auth.google.existing@careerbridge.io"
TEST_GOOGLE_INACTIVE_EMAIL = "auth.google.inactive@careerbridge.io"
TEST_GOOGLE_SUB_NEW = "google-sub-new-10001"
TEST_GOOGLE_SUB_EXISTING = "google-sub-existing-10002"
TEST_GOOGLE_SUB_INACTIVE = "google-sub-inactive-999"


def cleanup_test_users():
    """Clean up any leftover test users created during authentication tests."""
    with SessionLocal() as db:
        db.execute(
            delete(User).where(
                User.email.in_([
                    TEST_USER_EMAIL,
                    TEST_INACTIVE_EMAIL,
                    TEST_GOOGLE_NEW_EMAIL,
                    TEST_GOOGLE_EXISTING_EMAIL,
                    TEST_GOOGLE_INACTIVE_EMAIL,
                ]) | User.google_subject.in_([
                    TEST_GOOGLE_SUB_NEW,
                    TEST_GOOGLE_SUB_EXISTING,
                    TEST_GOOGLE_SUB_INACTIVE,
                ])
            )
        )
        db.commit()


def run_auth_tests():
    print("\n=========================================================")
    print("STARTING PHASE 6 AUTHENTICATION & JWT TEST SUITE...")
    print("=========================================================\n")

    cleanup_test_users()

    user_id = None
    inactive_user_id = None

    try:
        # Pre-create test users in PostgreSQL
        with SessionLocal() as db:
            active_user = User(
                email=TEST_USER_EMAIL,
                password_hash=hash_password(TEST_USER_PASSWORD),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=False,
            )
            inactive_user = User(
                email=TEST_INACTIVE_EMAIL,
                password_hash=hash_password(TEST_USER_PASSWORD),
                role=UserRole.STUDENT,
                is_active=False,
                is_verified=False,
            )
            existing_google_user = User(
                email=TEST_GOOGLE_EXISTING_EMAIL,
                password_hash=None,
                auth_provider="google",
                google_subject=TEST_GOOGLE_SUB_EXISTING,
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            inactive_google_user = User(
                email=TEST_GOOGLE_INACTIVE_EMAIL,
                password_hash=None,
                auth_provider="google",
                google_subject=TEST_GOOGLE_SUB_INACTIVE,
                role=UserRole.STUDENT,
                is_active=False,
                is_verified=True,
            )
            db.add(active_user)
            db.add(inactive_user)
            db.add(existing_google_user)
            db.add(inactive_google_user)
            db.commit()
            db.refresh(active_user)
            db.refresh(inactive_user)
            db.refresh(existing_google_user)
            db.refresh(inactive_google_user)
            user_id = active_user.id
            inactive_user_id = inactive_user.id
            google_existing_id = existing_google_user.id

        print(f"[Setup] Created test users: active ID {user_id}, inactive ID {inactive_user_id}, existing Google ID {google_existing_id}")

        # [1/16] Login with valid credentials
        print("[1/16] Test: Login with valid credentials")
        res = client.post(
            "/api/v1/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        print("  -> Login successful, status 200")

        # [2/16] Token response contains access_token
        print("[2/16] Test: Token response contains access_token")
        assert "access_token" in data and len(data["access_token"]) > 20, "access_token missing or invalid"
        valid_token = data["access_token"]
        print("  -> Confirmed: access_token present in response")

        # [3/16] Token type is bearer
        print("[3/16] Test: Token type is bearer")
        assert data.get("token_type") == "bearer", f"Expected token_type bearer, got {data.get('token_type')}"
        print("  -> Confirmed: token_type is 'bearer'")

        # [4/16] Login with wrong password
        print("[4/16] Test: Login with wrong password returns 401 generic error")
        res_bad_pwd = client.post(
            "/api/v1/auth/login",
            json={"email": TEST_USER_EMAIL, "password": "WrongPassword999!"},
        )
        assert res_bad_pwd.status_code == 401, f"Expected 401, got {res_bad_pwd.status_code}"
        assert res_bad_pwd.json()["detail"] == "Incorrect email or password"
        print("  -> Confirmed: wrong password rejected with generic 401")

        # [5/16] Login with unknown email
        print("[5/16] Test: Login with unknown email returns identical 401 generic error")
        res_unknown_email = client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent.user@careerbridge.io", "password": TEST_USER_PASSWORD},
        )
        assert res_unknown_email.status_code == 401, f"Expected 401, got {res_unknown_email.status_code}"
        assert res_unknown_email.json()["detail"] == "Incorrect email or password"
        print("  -> Confirmed: unknown email rejected with identical generic 401")

        # [6/16] Login with invalid email format
        print("[6/16] Test: Login with invalid email format returns 422")
        res_bad_email = client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email-address", "password": TEST_USER_PASSWORD},
        )
        assert res_bad_email.status_code == 422, f"Expected 422, got {res_bad_email.status_code}"
        print("  -> Confirmed: invalid email format rejected with 422")

        # [7/16] Login inactive user
        print("[7/16] Test: Login inactive user returns 401 Inactive user account")
        res_inactive = client.post(
            "/api/v1/auth/login",
            json={"email": TEST_INACTIVE_EMAIL, "password": TEST_USER_PASSWORD},
        )
        assert res_inactive.status_code == 401, f"Expected 401, got {res_inactive.status_code}"
        assert res_inactive.json()["detail"] == "Inactive user account"
        print("  -> Confirmed: inactive account rejected with 401 Inactive user account")

        # [8/16] Protected endpoint without token
        print("[8/16] Test: Protected endpoint without token returns 401")
        res_no_token = client.get("/api/v1/auth/me")
        assert res_no_token.status_code == 401, f"Expected 401, got {res_no_token.status_code}"
        print("  -> Confirmed: unauthenticated request to /me returns 401")

        # [9/16] Protected endpoint with invalid token
        print("[9/16] Test: Protected endpoint with invalid token returns 401")
        res_bad_token = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.value"},
        )
        assert res_bad_token.status_code == 401, f"Expected 401, got {res_bad_token.status_code}"
        print("  -> Confirmed: invalid token returns 401")

        # [10/16] Protected endpoint with valid token
        print("[10/16] Test: Protected endpoint with valid token returns 200")
        res_me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert res_me.status_code == 200, f"Expected 200, got {res_me.status_code}"
        me_data = res_me.json()
        print("  -> Confirmed: authenticated request to /me succeeds with 200")

        # [11/16] Protected endpoint returns correct current user
        print("[11/16] Test: Protected endpoint returns correct current user")
        assert me_data["id"] == user_id, f"Expected user ID {user_id}, got {me_data.get('id')}"
        assert me_data["email"] == TEST_USER_EMAIL, f"Expected email {TEST_USER_EMAIL}, got {me_data.get('email')}"
        assert me_data["role"] == "student"
        assert me_data["is_active"] is True
        print("  -> Confirmed: returned user ID, email, role, and status match database record")

        # [12/16] Protected response does not expose password
        print("[12/16] Test: Protected response does not expose password")
        assert "password" not in me_data, "Password exposed in response!"

        # [13/16] Protected response does not expose password_hash
        print("[13/16] Test: Protected response does not expose password_hash")
        assert "password_hash" not in me_data, "password_hash exposed in response!"
        print("  -> Confirmed: neither password nor password_hash is returned")

        # [14/16] Expired token rejected
        print("[14/16] Test: Expired token rejected with 401")
        expired_token = create_access_token(
            subject=user_id,
            expires_delta=timedelta(seconds=-10),
        )
        res_expired = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert res_expired.status_code == 401, f"Expected 401, got {res_expired.status_code}"
        print("  -> Confirmed: expired token rejected with 401")

        # [15/16] Token with invalid signature rejected
        print("[15/16] Test: Token with invalid signature rejected with 401")
        forged_token = jwt.encode(
            {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(minutes=15)},
            "completely_wrong_attacker_secret_key_12345",
            algorithm="HS256",
        )
        res_forged = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {forged_token}"},
        )
        assert res_forged.status_code == 401, f"Expected 401, got {res_forged.status_code}"
        print("  -> Confirmed: invalid signature token rejected with 401")

        # [16/24] Missing JWT subject rejected
        print("[16/24] Test: Token with missing subject ('sub') claim rejected with 401")
        no_sub_token = jwt.encode(
            {"exp": datetime.now(timezone.utc) + timedelta(minutes=15)},
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        res_no_sub = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {no_sub_token}"},
        )
        assert res_no_sub.status_code == 401, f"Expected 401, got {res_no_sub.status_code}"
        print("  -> Confirmed: token missing 'sub' rejected with 401")

        # [17/24] Google Login: Valid new user account creation and JWT issuance
        print("[17/24] Test: Valid new Google user creates student account and returns JWT")
        with patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "sub": TEST_GOOGLE_SUB_NEW,
                "email": TEST_GOOGLE_NEW_EMAIL,
                "email_verified": True,
            }
            res_google = client.post(
                "/api/v1/auth/google",
                json={"credential": "valid.google.id.token"},
            )
            assert res_google.status_code == 200, f"Expected 200, got {res_google.status_code}: {res_google.text}"
            google_data = res_google.json()
            assert "access_token" in google_data, "access_token missing in Google login response"
            assert google_data.get("token_type") == "bearer"
            google_jwt_token = google_data["access_token"]
            print("  -> Confirmed: new Google user created and JWT token returned")

        # [18/24] Google Login: Invalid Google token returns 401
        print("[18/24] Test: Invalid Google token (ValueError) returns 401")
        with patch("app.routers.auth.id_token.verify_oauth2_token", side_effect=ValueError("Token expired")):
            res_invalid = client.post(
                "/api/v1/auth/google",
                json={"credential": "invalid.google.token"},
            )
            assert res_invalid.status_code == 401, f"Expected 401, got {res_invalid.status_code}"
            assert res_invalid.json()["detail"] == "Invalid Google authentication token."
            print("  -> Confirmed: invalid Google token rejected with 401")

        # [19/24] Google Login: Missing Google identity data returns 401
        print("[19/24] Test: Missing Google identity data (sub/email) returns 401")
        with patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "email": TEST_GOOGLE_NEW_EMAIL,
                "email_verified": True,
                # Missing 'sub'
            }
            res_missing_sub = client.post(
                "/api/v1/auth/google",
                json={"credential": "token.missing.sub"},
            )
            assert res_missing_sub.status_code == 401, f"Expected 401, got {res_missing_sub.status_code}"
            assert res_missing_sub.json()["detail"] == "Google account information is incomplete."
            print("  -> Confirmed: missing identity data rejected with 401")

        # [20/24] Google Login: Unverified Google email returns 401
        print("[20/24] Test: Unverified Google email returns 401")
        with patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "sub": "some-unverified-sub",
                "email": "unverified@example.com",
                "email_verified": False,
            }
            res_unverified = client.post(
                "/api/v1/auth/google",
                json={"credential": "token.unverified.email"},
            )
            assert res_unverified.status_code == 401, f"Expected 401, got {res_unverified.status_code}"
            assert res_unverified.json()["detail"] == "Google email address is not verified."
            print("  -> Confirmed: unverified Google email rejected with 401")

        # [21/24] Google Login: Existing Google user logs in
        print("[21/24] Test: Existing Google user logs in successfully")
        with patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "sub": TEST_GOOGLE_SUB_EXISTING,
                "email": TEST_GOOGLE_EXISTING_EMAIL,
                "email_verified": True,
            }
            res_existing_google = client.post(
                "/api/v1/auth/google",
                json={"credential": "existing.google.token"},
            )
            assert res_existing_google.status_code == 200, f"Expected 200, got {res_existing_google.status_code}"
            data_existing = res_existing_google.json()
            assert "access_token" in data_existing
            print("  -> Confirmed: existing Google account authenticated successfully")

        # [22/24] Google Login: Email conflict with local account returns 409 Conflict
        print("[22/24] Test: Email conflict with existing local user returns 409 Conflict")
        with patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "sub": "completely-new-sub-with-local-email",
                "email": TEST_USER_EMAIL,  # Matches pre-created local account
                "email_verified": True,
            }
            res_conflict = client.post(
                "/api/v1/auth/google",
                json={"credential": "conflicting.google.token"},
            )
            assert res_conflict.status_code == 409, f"Expected 409, got {res_conflict.status_code}"
            assert "An account with this email already exists" in res_conflict.json()["detail"]
            print("  -> Confirmed: linking conflict safely prevented with 409")

        # [23/24] Google Login: Inactive Google account returns 401
        print("[23/24] Test: Inactive Google account returns 401")
        with patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "sub": TEST_GOOGLE_SUB_INACTIVE,
                "email": TEST_GOOGLE_INACTIVE_EMAIL,
                "email_verified": True,
            }
            res_inactive_g = client.post(
                "/api/v1/auth/google",
                json={"credential": "inactive.google.token"},
            )
            assert res_inactive_g.status_code == 401, f"Expected 401, got {res_inactive_g.status_code}"
            assert res_inactive_g.json()["detail"] == "Inactive user account."
            print("  -> Confirmed: inactive Google user rejected with 401")

        # [24/24] Google Login: JWT generation and protected /me verification
        print("[24/24] Test: Google JWT access token accesses /api/v1/auth/me")
        res_me_google = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {google_jwt_token}"},
        )
        assert res_me_google.status_code == 200, f"Expected 200, got {res_me_google.status_code}"
        me_google_data = res_me_google.json()
        assert me_google_data["email"] == TEST_GOOGLE_NEW_EMAIL
        assert me_google_data["role"] == "student"
        assert me_google_data["is_active"] is True
        print("  -> Confirmed: Google JWT access token authenticates correctly against /me")

        print("\n=========================================================")
        print("ALL 24 AUTHENTICATION & JWT TESTS PASSED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_test_users()


if __name__ == "__main__":
    run_auth_tests()
