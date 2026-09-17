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


def cleanup_test_users():
    """Clean up any leftover test users created during authentication tests."""
    with SessionLocal() as db:
        db.execute(
            delete(User).where(
                User.email.in_([TEST_USER_EMAIL, TEST_INACTIVE_EMAIL])
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
            db.add(active_user)
            db.add(inactive_user)
            db.commit()
            db.refresh(active_user)
            db.refresh(inactive_user)
            user_id = active_user.id
            inactive_user_id = inactive_user.id

        print(f"[Setup] Created test users: active ID {user_id}, inactive ID {inactive_user_id}")

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

        # [16/16] Missing JWT subject rejected
        print("[16/16] Test: Token with missing subject ('sub') claim rejected with 401")
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

        print("\n=========================================================")
        print("ALL 16 AUTHENTICATION & JWT TESTS PASSED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_test_users()


if __name__ == "__main__":
    run_auth_tests()
