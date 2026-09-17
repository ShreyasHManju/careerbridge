"""
CareerBridge Phase 9 Recruiter Profile Test Suite
Tests recruiter profile model, schema, API endpoints (GET, POST, PATCH),
recruiter-only RBAC, ownership enforcement derived from current_user.id,
error handling (401, 403, 404, 409, 422), credential leakage prevention,
and database CASCADE deletion.
"""

from datetime import timedelta
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER1_EMAIL = "rp.recruiter1@careerbridge.io"
RECRUITER2_EMAIL = "rp.recruiter2@careerbridge.io"
STUDENT_EMAIL = "rp.student@careerbridge.io"
ADMIN_EMAIL = "rp.admin@careerbridge.io"
CASCADE_EMAIL = "rp.cascade_test@careerbridge.io"
TEST_PASSWORD = "RecruiterProfileTest123!"


def cleanup_test_data():
    """Remove test users and their cascading recruiter profiles."""
    with SessionLocal() as db:
        test_emails = [
            RECRUITER1_EMAIL,
            RECRUITER2_EMAIL,
            STUDENT_EMAIL,
            ADMIN_EMAIL,
            CASCADE_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(
                delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(user_ids))
            )
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def run_recruiter_profile_tests():
    print("\n=========================================================")
    print("STARTING PHASE 9 RECRUITER PROFILE TEST SUITE...")
    print("=========================================================\n")

    cleanup_test_data()

    recruiter1_id = None
    recruiter2_id = None
    student_id = None
    admin_id = None
    cascade_user_id = None

    try:
        # Step 1: Create test users in DB
        with SessionLocal() as db:
            r1 = User(
                email=RECRUITER1_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
            r2 = User(
                email=RECRUITER2_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
            student = User(
                email=STUDENT_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            cascade_u = User(
                email=CASCADE_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
            db.add_all([r1, r2, student, admin, cascade_u])
            db.commit()
            db.refresh(r1)
            db.refresh(r2)
            db.refresh(student)
            db.refresh(admin)
            db.refresh(cascade_u)

            recruiter1_id = r1.id
            recruiter2_id = r2.id
            student_id = student.id
            admin_id = admin.id
            cascade_user_id = cascade_u.id

        # Generate JWT tokens
        token_r1 = create_access_token(subject=recruiter1_id)
        token_r2 = create_access_token(subject=recruiter2_id)
        token_student = create_access_token(subject=student_id)
        token_admin = create_access_token(subject=admin_id)
        token_cascade = create_access_token(subject=cascade_user_id)
        token_expired = create_access_token(
            subject=recruiter1_id, expires_delta=timedelta(seconds=-60)
        )

        headers_r1 = {"Authorization": f"Bearer {token_r1}"}
        headers_r2 = {"Authorization": f"Bearer {token_r2}"}
        headers_student = {"Authorization": f"Bearer {token_student}"}
        headers_admin = {"Authorization": f"Bearer {token_admin}"}
        headers_cascade = {"Authorization": f"Bearer {token_cascade}"}
        headers_expired = {"Authorization": f"Bearer {token_expired}"}
        headers_invalid = {"Authorization": "Bearer invalid.token.value"}

        create_payload = {
            "company_name": "Acme Innovations Inc.",
            "company_description": "Pioneering next-generation cloud infrastructure.",
            "contact_name": "Jane Doe",
            "phone": "+1-555-0200",
            "company_website": "https://acme-innovations.example.com",
            "company_location": "San Francisco, CA",
            "industry": "Technology",
            "company_size": "51-200",
        }

        # TEST 1: Nonexistent recruiter profile returns 404
        print("[Test 1/20] Nonexistent recruiter profile returns 404...")
        r = client.get("/api/v1/recruiter/profile", headers=headers_r1)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
        assert "not found" in r.json().get("detail", "").lower()
        print("  -> Passed: 404 returned for uncreated recruiter profile.")

        # TEST 2 & 3: Recruiter can create own profile (201)
        print("[Test 2-3/20] Recruiter can create own profile (201)...")
        r = client.post(
            "/api/v1/recruiter/profile", json=create_payload, headers=headers_r1
        )
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        profile_data = r.json()
        assert profile_data["company_name"] == "Acme Innovations Inc."
        assert profile_data["contact_name"] == "Jane Doe"
        assert profile_data["industry"] == "Technology"
        print("  -> Passed: Recruiter profile created successfully with status 201.")

        # TEST 4: user_id is automatically bound to authenticated recruiter
        print("[Test 4/20] user_id automatically bound to authenticated recruiter...")
        assert profile_data["user_id"] == recruiter1_id, (
            f"Expected user_id {recruiter1_id}, got {profile_data['user_id']}"
        )
        print(f"  -> Passed: Profile user_id matches authenticated recruiter ID ({recruiter1_id}).")

        # TEST 5: Recruiter can retrieve own profile (200)
        print("[Test 5/20] Recruiter can retrieve own profile (200)...")
        r = client.get("/api/v1/recruiter/profile", headers=headers_r1)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        fetched = r.json()
        assert fetched["id"] == profile_data["id"]
        assert fetched["company_name"] == "Acme Innovations Inc."
        assert fetched["user_id"] == recruiter1_id
        print("  -> Passed: Profile retrieved successfully with status 200.")

        # TEST 6: Recruiter can update own profile (200)
        print("[Test 6/20] Recruiter can update own profile (200)...")
        update_payload = {
            "company_description": "Updated overview: Global leader in enterprise software.",
            "company_size": "201-500",
            "company_location": "San Jose, CA",
        }
        r = client.patch(
            "/api/v1/recruiter/profile", json=update_payload, headers=headers_r1
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        updated = r.json()
        assert updated["company_description"] == update_payload["company_description"]
        assert updated["company_size"] == "201-500"
        assert updated["company_location"] == "San Jose, CA"
        assert updated["company_name"] == "Acme Innovations Inc."  # Unmodified preserved
        print("  -> Passed: Profile updated successfully with status 200.")

        # TEST 7: Duplicate recruiter profile creation returns 409
        print("[Test 7/20] Duplicate recruiter profile creation returns 409 Conflict...")
        r = client.post(
            "/api/v1/recruiter/profile", json=create_payload, headers=headers_r1
        )
        assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
        assert "already exists" in r.json().get("detail", "").lower()
        print("  -> Passed: Duplicate profile creation blocked with 409 Conflict.")

        # TEST 8: Student cannot access recruiter profile (403)
        print("[Test 8/20] Student cannot access recruiter profile (403)...")
        r_get = client.get("/api/v1/recruiter/profile", headers=headers_student)
        r_post = client.post(
            "/api/v1/recruiter/profile", json=create_payload, headers=headers_student
        )
        r_patch = client.patch(
            "/api/v1/recruiter/profile", json={"company_name": "Hack"}, headers=headers_student
        )
        assert r_get.status_code == 403, f"Expected 403, got {r_get.status_code}"
        assert r_post.status_code == 403, f"Expected 403, got {r_post.status_code}"
        assert r_patch.status_code == 403, f"Expected 403, got {r_patch.status_code}"
        print("  -> Passed: Student rejected with 403 Forbidden across all operations.")

        # TEST 9: Admin cannot access recruiter profile (403)
        print("[Test 9/20] Admin cannot access recruiter profile (403)...")
        r_get = client.get("/api/v1/recruiter/profile", headers=headers_admin)
        r_post = client.post(
            "/api/v1/recruiter/profile", json=create_payload, headers=headers_admin
        )
        r_patch = client.patch(
            "/api/v1/recruiter/profile", json={"company_name": "Hack"}, headers=headers_admin
        )
        assert r_get.status_code == 403, f"Expected 403, got {r_get.status_code}"
        assert r_post.status_code == 403, f"Expected 403, got {r_post.status_code}"
        assert r_patch.status_code == 403, f"Expected 403, got {r_patch.status_code}"
        print("  -> Passed: Admin rejected with 403 Forbidden across all operations.")

        # TEST 10: Missing token returns 401
        print("[Test 10/20] Missing token returns 401...")
        r = client.get("/api/v1/recruiter/profile")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  -> Passed: Unauthenticated request returns 401.")

        # TEST 11: Invalid token returns 401
        print("[Test 11/20] Invalid token returns 401...")
        r = client.get("/api/v1/recruiter/profile", headers=headers_invalid)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  -> Passed: Invalid token returns 401.")

        # TEST 12: Expired token returns 401
        print("[Test 12/20] Expired token returns 401...")
        r = client.get("/api/v1/recruiter/profile", headers=headers_expired)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  -> Passed: Expired token returns 401.")

        # TEST 13: Invalid profile data returns 422
        print("[Test 13/20] Invalid profile data returns 422...")
        # Missing required company_name
        r_missing = client.post(
            "/api/v1/recruiter/profile", json={"contact_name": "Jane"}, headers=headers_r2
        )
        assert r_missing.status_code == 422, f"Expected 422, got {r_missing.status_code}"
        # Too short company_name (< 2 chars)
        r_short = client.post(
            "/api/v1/recruiter/profile", json={"company_name": "A"}, headers=headers_r2
        )
        assert r_short.status_code == 422, f"Expected 422, got {r_short.status_code}"
        print("  -> Passed: Invalid input rejected with 422 Unprocessable Entity.")

        # TEST 14 & 15: password and password_hash never exposed
        print("[Test 14-15/20] password and password_hash are never exposed...")
        for resp in [profile_data, updated, fetched]:
            assert "password" not in resp, "Password key leaked in response!"
            assert "password_hash" not in resp, "Password hash leaked in response!"
        print("  -> Passed: No authentication secrets or hashes exposed.")

        # TEST 16: Client cannot assign another user_id during POST
        print("[Test 16/20] Client cannot assign another user_id during POST...")
        spoof_post = {
            "company_name": "Beta Labs LLC",
            "user_id": 9999,  # Malicious attempt to claim another ID
            "industry": "Biotech",
        }
        r = client.post("/api/v1/recruiter/profile", json=spoof_post, headers=headers_r2)
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        r2_profile = r.json()
        assert r2_profile["user_id"] == recruiter2_id, (
            f"user_id was forged! Expected {recruiter2_id}, got {r2_profile['user_id']}"
        )
        print(f"  -> Passed: Client-provided user_id was ignored; bound to current_user.id ({recruiter2_id}).")

        # TEST 17: Client cannot modify user_id during PATCH
        print("[Test 17/20] Client cannot modify user_id during PATCH...")
        spoof_patch = {"user_id": 9999, "company_location": "New York, NY"}
        r = client.patch(
            "/api/v1/recruiter/profile", json=spoof_patch, headers=headers_r1
        )
        assert r.status_code == 200
        assert r.json()["user_id"] == recruiter1_id, "user_id was modified by PATCH!"
        assert r.json()["company_location"] == "New York, NY"
        print("  -> Passed: user_id modification attempt ignored during PATCH.")

        # TEST 18: Recruiter A cannot access Recruiter B's profile
        print("[Test 18/20] Recruiter A cannot access Recruiter B's profile (isolation)...")
        r_r2_get = client.get("/api/v1/recruiter/profile", headers=headers_r2)
        assert r_r2_get.status_code == 200
        assert r_r2_get.json()["user_id"] == recruiter2_id
        assert r_r2_get.json()["company_name"] == "Beta Labs LLC"
        assert r_r2_get.json()["user_id"] != recruiter1_id
        print("  -> Passed: Recruiter 2 isolated strictly to Recruiter 2's own profile.")

        # TEST 19: Recruiter A cannot update Recruiter B's profile
        print("[Test 19/20] Recruiter A cannot update Recruiter B's profile...")
        # Recruiter 2 updates profile
        client.patch(
            "/api/v1/recruiter/profile",
            json={"company_name": "Beta Labs Worldwide"},
            headers=headers_r2,
        )
        # Verify Recruiter 1 profile is untouched
        r_r1_verify = client.get("/api/v1/recruiter/profile", headers=headers_r1)
        assert r_r1_verify.status_code == 200
        assert r_r1_verify.json()["company_name"] == "Acme Innovations Inc."
        print("  -> Passed: Profile mutation by Recruiter 2 did not affect Recruiter 1.")

        # TEST 20: Deleting the associated User removes the recruiter profile through CASCADE
        print("[Test 20/20] Deleting User removes recruiter profile via CASCADE...")
        # Create profile for cascade user
        r_casc = client.post(
            "/api/v1/recruiter/profile",
            json={"company_name": "Temporary Test Corp"},
            headers=headers_cascade,
        )
        assert r_casc.status_code == 201
        cascade_profile_id = r_casc.json()["id"]

        with SessionLocal() as db:
            # Confirm profile exists in DB
            prof_before = db.scalar(
                select(RecruiterProfile).where(RecruiterProfile.id == cascade_profile_id)
            )
            assert prof_before is not None, "Profile should exist before user deletion"

            # Delete the user directly
            db.execute(delete(User).where(User.id == cascade_user_id))
            db.commit()

            # Confirm profile was cascaded by PostgreSQL foreign key
            prof_after = db.scalar(
                select(RecruiterProfile).where(RecruiterProfile.id == cascade_profile_id)
            )
            assert prof_after is None, "Recruiter profile was not cascaded upon User deletion!"
        print("  -> Passed: ON DELETE CASCADE successfully purged child recruiter profile.")

        print("\n=========================================================")
        print("ALL 20 RECRUITER PROFILE TEST CASES PASSED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_recruiter_profile_tests()
