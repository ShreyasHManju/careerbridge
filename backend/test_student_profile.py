"""
CareerBridge Phase 8 Student Profile Test Suite
Tests student profile model, schema, API endpoints (GET, POST, PATCH),
student-only RBAC, ownership enforcement derived from current_user.id,
error handling (401, 403, 404, 409, 422), and credentials leakage prevention.
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
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "profile.student1@careerbridge.io"
STUDENT2_EMAIL = "profile.student2@careerbridge.io"
RECRUITER_EMAIL = "profile.recruiter@careerbridge.io"
ADMIN_EMAIL = "profile.admin@careerbridge.io"
TEST_PASSWORD = "ProfileTestPass123!"


def cleanup_test_data():
    """Remove test users and their cascading student profiles."""
    with SessionLocal() as db:
        test_emails = [
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            RECRUITER_EMAIL,
            ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(
                delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids))
            )
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def run_student_profile_tests():
    print("\n=========================================================")
    print("STARTING PHASE 8 STUDENT PROFILE TEST SUITE...")
    print("=========================================================\n")

    cleanup_test_data()

    student1_id = None
    student2_id = None
    recruiter_id = None
    admin_id = None

    try:
        # Step 1: Create test users in DB
        with SessionLocal() as db:
            s1 = User(
                email=STUDENT1_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            s2 = User(
                email=STUDENT2_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            recruiter = User(
                email=RECRUITER_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
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
            db.add_all([s1, s2, recruiter, admin])
            db.commit()
            db.refresh(s1)
            db.refresh(s2)
            db.refresh(recruiter)
            db.refresh(admin)

            student1_id = s1.id
            student2_id = s2.id
            recruiter_id = recruiter.id
            admin_id = admin.id

        # Generate JWT tokens
        student1_token = create_access_token(subject=student1_id)
        student2_token = create_access_token(subject=student2_id)
        recruiter_token = create_access_token(subject=recruiter_id)
        admin_token = create_access_token(subject=admin_id)
        expired_token = create_access_token(
            subject=student1_id, expires_delta=timedelta(seconds=-60)
        )

        headers_s1 = {"Authorization": f"Bearer {student1_token}"}
        headers_s2 = {"Authorization": f"Bearer {student2_token}"}
        headers_recruiter = {"Authorization": f"Bearer {recruiter_token}"}
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_expired = {"Authorization": f"Bearer {expired_token}"}
        headers_invalid = {"Authorization": "Bearer invalid.token.value"}

        # TEST 1: Nonexistent profile returns 404
        print("[Test 1/17] Nonexistent profile returns 404...")
        r = client.get("/api/v1/student/profile", headers=headers_s1)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
        assert "not found" in r.json().get("detail", "").lower()
        print("  -> Passed: 404 returned for uncreated profile.")

        # TEST 2: Student can create own profile (201)
        print("[Test 2/17] Student can create own profile (201)...")
        create_payload = {
            "full_name": "Alex Mercer",
            "phone": "+1-555-0199",
            "college": "MIT",
            "degree": "B.S.",
            "branch": "Computer Science",
            "graduation_year": 2026,
            "bio": "Aspiring software engineer passionate about distributed systems.",
            "skills": "Python, FastAPI, PostgreSQL, Docker",
            "github_url": "https://github.com/alexmercer",
            "linkedin_url": "https://linkedin.com/in/alexmercer",
            "portfolio_url": "https://alexmercer.dev",
        }
        r = client.post("/api/v1/student/profile", json=create_payload, headers=headers_s1)
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        profile_data = r.json()
        assert profile_data["full_name"] == "Alex Mercer"
        assert profile_data["college"] == "MIT"
        assert profile_data["graduation_year"] == 2026
        print("  -> Passed: Profile created successfully with status 201.")

        # TEST 3: Profile belongs to authenticated student
        print("[Test 3/17] Profile ownership correctly bound to authenticated student...")
        assert profile_data["user_id"] == student1_id, (
            f"Expected user_id {student1_id}, got {profile_data['user_id']}"
        )
        print(f"  -> Passed: Profile user_id matches authenticated student ID ({student1_id}).")

        # TEST 4: Student can retrieve own profile (200)
        print("[Test 4/17] Student can retrieve own profile (200)...")
        r = client.get("/api/v1/student/profile", headers=headers_s1)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        fetched = r.json()
        assert fetched["id"] == profile_data["id"]
        assert fetched["full_name"] == "Alex Mercer"
        assert fetched["user_id"] == student1_id
        print("  -> Passed: Profile successfully retrieved with status 200.")

        # TEST 5: Student can update own profile (200)
        print("[Test 5/17] Student can update own profile (200)...")
        update_payload = {
            "bio": "Updated bio: Specializing in high-performance backend APIs.",
            "skills": "Python, FastAPI, PostgreSQL, Docker, Redis, Kubernetes",
            "graduation_year": 2027,
        }
        r = client.patch("/api/v1/student/profile", json=update_payload, headers=headers_s1)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        updated = r.json()
        assert updated["bio"] == update_payload["bio"]
        assert updated["skills"] == update_payload["skills"]
        assert updated["graduation_year"] == 2027
        assert updated["full_name"] == "Alex Mercer"  # Unmodified field preserved
        print("  -> Passed: Profile updated successfully with status 200.")

        # TEST 6: Duplicate profile creation blocked (409)
        print("[Test 6/17] Duplicate creation blocked with 409 Conflict...")
        r = client.post("/api/v1/student/profile", json=create_payload, headers=headers_s1)
        assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
        assert "already exists" in r.json().get("detail", "").lower()
        print("  -> Passed: Duplicate creation rejected with 409.")

        # TEST 7: Recruiter blocked from student profile (403)
        print("[Test 7/17] Recruiter blocked from student profile (403)...")
        r_get = client.get("/api/v1/student/profile", headers=headers_recruiter)
        r_post = client.post(
            "/api/v1/student/profile", json=create_payload, headers=headers_recruiter
        )
        r_patch = client.patch(
            "/api/v1/student/profile", json={"bio": "hack"}, headers=headers_recruiter
        )
        assert r_get.status_code == 403, f"Expected 403, got {r_get.status_code}"
        assert r_post.status_code == 403, f"Expected 403, got {r_post.status_code}"
        assert r_patch.status_code == 403, f"Expected 403, got {r_patch.status_code}"
        print("  -> Passed: Recruiter denied with 403 on GET, POST, and PATCH.")

        # TEST 8: Admin blocked from student profile (403)
        print("[Test 8/17] Admin blocked from student profile (403)...")
        r_get = client.get("/api/v1/student/profile", headers=headers_admin)
        r_post = client.post(
            "/api/v1/student/profile", json=create_payload, headers=headers_admin
        )
        r_patch = client.patch(
            "/api/v1/student/profile", json={"bio": "hack"}, headers=headers_admin
        )
        assert r_get.status_code == 403, f"Expected 403, got {r_get.status_code}"
        assert r_post.status_code == 403, f"Expected 403, got {r_post.status_code}"
        assert r_patch.status_code == 403, f"Expected 403, got {r_patch.status_code}"
        print("  -> Passed: Admin denied with 403 on GET, POST, and PATCH.")

        # TEST 9: Missing token rejected (401)
        print("[Test 9/17] Missing token rejected (401)...")
        r = client.get("/api/v1/student/profile")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  -> Passed: Unauthenticated request rejected with 401.")

        # TEST 10: Invalid token rejected (401)
        print("[Test 10/17] Invalid token rejected (401)...")
        r = client.get("/api/v1/student/profile", headers=headers_invalid)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  -> Passed: Invalid token rejected with 401.")

        # TEST 11: Expired token rejected (401)
        print("[Test 11/17] Expired token rejected (401)...")
        r = client.get("/api/v1/student/profile", headers=headers_expired)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  -> Passed: Expired token rejected with 401.")

        # TEST 12: Invalid data rejected (422)
        print("[Test 12/17] Invalid data rejected (422)...")
        # Missing required full_name
        r_missing = client.post("/api/v1/student/profile", json={"phone": "123"}, headers=headers_s2)
        assert r_missing.status_code == 422, f"Expected 422, got {r_missing.status_code}"
        # Invalid graduation year (out of range)
        r_bad_year = client.post(
            "/api/v1/student/profile",
            json={"full_name": "Bob", "graduation_year": 1850},
            headers=headers_s2,
        )
        assert r_bad_year.status_code == 422, f"Expected 422, got {r_bad_year.status_code}"
        # Too short full_name
        r_short_name = client.post(
            "/api/v1/student/profile",
            json={"full_name": "A"},
            headers=headers_s2,
        )
        assert r_short_name.status_code == 422, f"Expected 422, got {r_short_name.status_code}"
        print("  -> Passed: Validation failures properly return 422 Unprocessable Entity.")

        # TEST 13 & 14: Password and password_hash never exposed
        print("[Test 13-14/17] Password and password_hash never exposed in response...")
        for resp in [profile_data, updated, fetched]:
            assert "password" not in resp, "Password key found in response!"
            assert "password_hash" not in resp, "Password hash found in response!"
        print("  -> Passed: No sensitive authentication credentials leaked.")

        # TEST 15: Client cannot assign another user_id on POST
        print("[Test 15/17] Client cannot assign another user_id on POST...")
        malicious_payload = {
            "full_name": "Bob Stone",
            "user_id": 9999,  # Attempting to assign arbitrary user_id
            "college": "Stanford",
        }
        r = client.post("/api/v1/student/profile", json=malicious_payload, headers=headers_s2)
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        s2_profile = r.json()
        assert s2_profile["user_id"] == student2_id, (
            f"user_id was forged! Expected {student2_id}, got {s2_profile['user_id']}"
        )
        print("  -> Passed: Client-provided user_id is ignored; bound to current_user.id.")

        # TEST 16: Ownership spoofing blocked (Student B cannot access Student A's profile)
        print("[Test 16/17] Ownership isolation verified (Student B receives Student B's data)...")
        r_s2 = client.get("/api/v1/student/profile", headers=headers_s2)
        assert r_s2.status_code == 200
        assert r_s2.json()["user_id"] == student2_id
        assert r_s2.json()["full_name"] == "Bob Stone"
        assert r_s2.json()["user_id"] != student1_id
        print("  -> Passed: Student B is strictly isolated to Student B's own profile.")

        # TEST 17: PATCH cannot modify user_id
        print("[Test 17/17] PATCH cannot modify profile user_id...")
        patch_attempt = {"user_id": 9999, "college": "Harvard"}
        r_patch = client.patch("/api/v1/student/profile", json=patch_attempt, headers=headers_s1)
        assert r_patch.status_code == 200
        assert r_patch.json()["user_id"] == student1_id, "user_id was modified by PATCH!"
        assert r_patch.json()["college"] == "Harvard"
        print("  -> Passed: user_id modification attempt ignored during PATCH.")

        print("\n=========================================================")
        print("ALL 17 STUDENT PROFILE TEST CASES PASSED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_student_profile_tests()
