"""
CareerBridge Phase 7 RBAC (Role-Based Access Control) Test Suite
Tests authorization dependencies, single-role enforcement, multi-role enforcement,
401 unauthenticated vs 403 forbidden responses, and credential protection.
"""

from datetime import timedelta
import os
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT_EMAIL = "rbac.student@careerbridge.io"
RECRUITER_EMAIL = "rbac.recruiter@careerbridge.io"
ADMIN_EMAIL = "rbac.admin@careerbridge.io"
TEST_PASSWORD = "RbacTestPassword123!"


def cleanup_rbac_users():
    """Remove test users created during the RBAC test suite."""
    with SessionLocal() as db:
        db.execute(
            delete(User).where(
                User.email.in_([STUDENT_EMAIL, RECRUITER_EMAIL, ADMIN_EMAIL])
            )
        )
        db.commit()


def run_rbac_tests():
    print("\n=========================================================")
    print("STARTING PHASE 7 RBAC AUTHORIZATION TEST SUITE...")
    print("=========================================================\n")

    cleanup_rbac_users()

    student_id = None
    recruiter_id = None
    admin_id = None

    try:
        # 1. Setup test users in PostgreSQL
        with SessionLocal() as db:
            student_user = User(
                email=STUDENT_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=False,
            )
            recruiter_user = User(
                email=RECRUITER_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=False,
            )
            admin_user = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=False,
            )
            db.add_all([student_user, recruiter_user, admin_user])
            db.commit()
            db.refresh(student_user)
            db.refresh(recruiter_user)
            db.refresh(admin_user)
            student_id = student_user.id
            recruiter_id = recruiter_user.id
            admin_id = admin_user.id

        print(f"[Setup] Created RBAC users: Student ID {student_id}, Recruiter ID {recruiter_id}, Admin ID {admin_id}")

        # Issue access tokens using the existing Phase 6 authentication system
        student_token = create_access_token(subject=student_id)
        recruiter_token = create_access_token(subject=recruiter_id)
        admin_token = create_access_token(subject=admin_id)

        student_headers = {"Authorization": f"Bearer {student_token}"}
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # [1/16] Student token can access student endpoint -> 200
        print("[1/16] Test: Student token can access student endpoint -> 200")
        res1 = client.get("/api/v1/rbac/student", headers=student_headers)
        assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"
        assert res1.json()["role"] == "student"
        print("  -> Passed: Student accessed /student with 200")

        # [2/16] Recruiter token can access recruiter endpoint -> 200
        print("[2/16] Test: Recruiter token can access recruiter endpoint -> 200")
        res2 = client.get("/api/v1/rbac/recruiter", headers=recruiter_headers)
        assert res2.status_code == 200, f"Expected 200, got {res2.status_code}: {res2.text}"
        assert res2.json()["role"] == "recruiter"
        print("  -> Passed: Recruiter accessed /recruiter with 200")

        # [3/16] Admin token can access admin endpoint -> 200
        print("[3/16] Test: Admin token can access admin endpoint -> 200")
        res3 = client.get("/api/v1/rbac/admin", headers=admin_headers)
        assert res3.status_code == 200, f"Expected 200, got {res3.status_code}: {res3.text}"
        assert res3.json()["role"] == "admin"
        print("  -> Passed: Admin accessed /admin with 200")

        # [4/16] Student accessing recruiter endpoint -> 403
        print("[4/16] Test: Student accessing recruiter endpoint -> 403")
        res4 = client.get("/api/v1/rbac/recruiter", headers=student_headers)
        assert res4.status_code == 403, f"Expected 403, got {res4.status_code}: {res4.text}"
        assert res4.json()["detail"] == "Not enough permissions"
        print("  -> Passed: Student blocked from /recruiter with 403")

        # [5/16] Student accessing admin endpoint -> 403
        print("[5/16] Test: Student accessing admin endpoint -> 403")
        res5 = client.get("/api/v1/rbac/admin", headers=student_headers)
        assert res5.status_code == 403, f"Expected 403, got {res5.status_code}: {res5.text}"
        assert res5.json()["detail"] == "Not enough permissions"
        print("  -> Passed: Student blocked from /admin with 403")

        # [6/16] Recruiter accessing student endpoint -> 403
        print("[6/16] Test: Recruiter accessing student endpoint -> 403")
        res6 = client.get("/api/v1/rbac/student", headers=recruiter_headers)
        assert res6.status_code == 403, f"Expected 403, got {res6.status_code}: {res6.text}"
        assert res6.json()["detail"] == "Not enough permissions"
        print("  -> Passed: Recruiter blocked from /student with 403")

        # [7/16] Recruiter accessing admin endpoint -> 403
        print("[7/16] Test: Recruiter accessing admin endpoint -> 403")
        res7 = client.get("/api/v1/rbac/admin", headers=recruiter_headers)
        assert res7.status_code == 403, f"Expected 403, got {res7.status_code}: {res7.text}"
        assert res7.json()["detail"] == "Not enough permissions"
        print("  -> Passed: Recruiter blocked from /admin with 403")

        # [8/16] Admin accessing student endpoint -> 403 (strict student-only endpoint)
        print("[8/16] Test: Admin accessing student endpoint -> 403")
        res8 = client.get("/api/v1/rbac/student", headers=admin_headers)
        assert res8.status_code == 403, f"Expected 403, got {res8.status_code}: {res8.text}"
        assert res8.json()["detail"] == "Not enough permissions"
        print("  -> Passed: Admin blocked from student-only endpoint with 403")

        # [9/16] Admin accessing recruiter endpoint -> 403 (strict recruiter-only endpoint)
        print("[9/16] Test: Admin accessing recruiter endpoint -> 403")
        res9 = client.get("/api/v1/rbac/recruiter", headers=admin_headers)
        assert res9.status_code == 403, f"Expected 403, got {res9.status_code}: {res9.text}"
        assert res9.json()["detail"] == "Not enough permissions"
        print("  -> Passed: Admin blocked from recruiter-only endpoint with 403")

        # [10/16] Student accessing student-or-recruiter endpoint -> 200
        print("[10/16] Test: Student accessing student-or-recruiter endpoint -> 200")
        res10 = client.get("/api/v1/rbac/student-or-recruiter", headers=student_headers)
        assert res10.status_code == 200, f"Expected 200, got {res10.status_code}: {res10.text}"
        assert res10.json()["role"] == "student"
        print("  -> Passed: Student allowed on multi-role endpoint with 200")

        # [11/16] Recruiter accessing student-or-recruiter endpoint -> 200
        print("[11/16] Test: Recruiter accessing student-or-recruiter endpoint -> 200")
        res11 = client.get("/api/v1/rbac/student-or-recruiter", headers=recruiter_headers)
        assert res11.status_code == 200, f"Expected 200, got {res11.status_code}: {res11.text}"
        assert res11.json()["role"] == "recruiter"
        print("  -> Passed: Recruiter allowed on multi-role endpoint with 200")

        # [12/16] Admin accessing student-or-recruiter endpoint -> 403
        print("[12/16] Test: Admin accessing student-or-recruiter endpoint -> 403")
        res12 = client.get("/api/v1/rbac/student-or-recruiter", headers=admin_headers)
        assert res12.status_code == 403, f"Expected 403, got {res12.status_code}: {res12.text}"
        assert res12.json()["detail"] == "Not enough permissions"
        print("  -> Passed: Admin rejected on student-or-recruiter endpoint with 403")

        # [13/16] Missing token -> 401
        print("[13/16] Test: Missing token -> 401")
        res13 = client.get("/api/v1/rbac/student")
        assert res13.status_code == 401, f"Expected 401, got {res13.status_code}"
        print("  -> Passed: Unauthenticated request rejected with 401")

        # [14/16] Invalid token -> 401
        print("[14/16] Test: Invalid token -> 401")
        res14 = client.get("/api/v1/rbac/student", headers={"Authorization": "Bearer invalid.token.value"})
        assert res14.status_code == 401, f"Expected 401, got {res14.status_code}"
        print("  -> Passed: Malformed/invalid token rejected with 401")

        # [15/16] Expired token -> 401
        print("[15/16] Test: Expired token -> 401")
        expired_token = create_access_token(subject=student_id, expires_delta=timedelta(seconds=-10))
        res15 = client.get("/api/v1/rbac/student", headers={"Authorization": f"Bearer {expired_token}"})
        assert res15.status_code == 401, f"Expected 401, got {res15.status_code}"
        print("  -> Passed: Expired token rejected with 401")

        # [16/16] Verify response does not expose password/password_hash
        print("[16/16] Test: Verify responses do not expose password/password_hash")
        for res in [res1, res2, res3, res10, res11]:
            data = res.json()
            assert "password" not in data, "password exposed!"
            assert "password_hash" not in data, "password_hash exposed!"
        print("  -> Passed: No sensitive credential fields exposed in RBAC responses")

        print("\n=========================================================")
        print("ALL 16 RBAC AUTHORIZATION TESTS PASSED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_rbac_users()


if __name__ == "__main__":
    run_rbac_tests()
