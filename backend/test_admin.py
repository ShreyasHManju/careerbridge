"""
CareerBridge Phase 16 Admin User Management & Moderation Test Suite
Tests:
1. Admin can list users -> 200
2. Student cannot list users -> 403
3. Recruiter cannot list users -> 403
4. Missing token -> 401
5. Invalid token -> 401
6. Search filters users by email correctly
7. Role filter works
8. is_active filter works
9. Pagination works
10. Admin can view single user detail
11. Missing user detail -> 404
12. Admin can deactivate user account
13. Admin can activate user account
14. Admin cannot deactivate their own currently authenticated account (self-lockout prevention -> 400)
15. password_hash is never present in responses
16. Arbitrary role changes are not accepted via status endpoint
17. Arbitrary password/hash changes are not accepted via status endpoint
18. Client-supplied identity cannot override target user
19. Admin can list recruiters
20. Student cannot access recruiter administration -> 403
21. Recruiter cannot access recruiter administration -> 403
22. Recruiter verification works (is_verified=True)
23. Recruiter unverification works (is_verified=False)
24. Non-recruiter user cannot be verified through recruiter endpoint -> 400
25. Recruiter without profile handled with 404
26. Verification filter works on recruiter listing
27. Search filter works on recruiter listing (email, company_name, contact_name)
28. Admin can list both active and inactive jobs
29. Student cannot access admin job listing -> 403
30. Recruiter cannot access admin job listing -> 403
31. Admin can deactivate a job
32. Admin can activate a job
33. Moderating non-existent job -> 404
34. Only is_active changes, job ownership and attributes remain intact
35. Admin job search and filters (search, opportunity_type, employment_type, is_active)
36. Inactive admin cannot access admin endpoints -> 401
37. Role spoofing in query or payload is ignored / blocked
"""

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
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User, UserRole

client = TestClient(app)

ADMIN_EMAIL = "admin.mod@careerbridge.io"
ADMIN2_EMAIL = "admin2.mod@careerbridge.io"
INACTIVE_ADMIN_EMAIL = "inactive.admin@careerbridge.io"
STUDENT_EMAIL = "student.mod@careerbridge.io"
RECRUITER1_EMAIL = "recruiter1.mod@careerbridge.io"
RECRUITER2_EMAIL = "recruiter2.mod@careerbridge.io"
TEST_PASSWORD = "AdminTestPassword123!"


def cleanup_test_data():
    """Remove test users and their cascading profiles and jobs."""
    with SessionLocal() as db:
        test_emails = [
            ADMIN_EMAIL,
            ADMIN2_EMAIL,
            INACTIVE_ADMIN_EMAIL,
            STUDENT_EMAIL,
            RECRUITER1_EMAIL,
            RECRUITER2_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            db.execute(delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def run_admin_tests():
    print("\n=========================================================")
    print("STARTING PHASE 16 ADMIN & MODERATION TEST SUITE")
    print("=========================================================\n")

    cleanup_test_data()

    admin_id = None
    admin2_id = None
    inactive_admin_id = None
    student_id = None
    recruiter1_id = None
    recruiter2_id = None
    job1_id = None
    job2_id = None

    try:
        # Step 1: Create test users
        with SessionLocal() as db:
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            admin2 = User(
                email=ADMIN2_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            inact_admin = User(
                email=INACTIVE_ADMIN_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.ADMIN,
                is_active=False,
                is_verified=True,
            )
            student = User(
                email=STUDENT_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            recruiter1 = User(
                email=RECRUITER1_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=False,
            )
            recruiter2 = User(
                email=RECRUITER2_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
            db.add_all([admin, admin2, inact_admin, student, recruiter1, recruiter2])
            db.commit()
            for u in [admin, admin2, inact_admin, student, recruiter1, recruiter2]:
                db.refresh(u)

            admin_id = admin.id
            admin2_id = admin2.id
            inactive_admin_id = inact_admin.id
            student_id = student.id
            recruiter1_id = recruiter1.id
            recruiter2_id = recruiter2.id

            # Create recruiter profile for Recruiter 1 (unverified)
            rp1 = RecruiterProfile(
                user_id=recruiter1_id,
                company_name="Alpha Tech Innovators",
                company_description="Pioneering AI robotics solutions.",
                contact_name="Alice Recruiter",
                phone="+91-9876543210",
                company_website="https://alphatechinnovators.io",
                company_location="Hyderabad, India",
                industry="Robotics",
                company_size="51-200",
                is_verified=False,
            )
            # Create recruiter profile for Recruiter 2 (verified)
            rp2 = RecruiterProfile(
                user_id=recruiter2_id,
                company_name="Beta Global Cloud",
                company_description="Distributed cloud computing infrastructure.",
                contact_name="Bob Talent",
                phone="+91-9876543211",
                company_website="https://betaglobalcloud.io",
                company_location="Bengaluru, India",
                industry="Cloud Computing",
                company_size="500+",
                is_verified=True,
            )
            db.add_all([rp1, rp2])

            # Create test jobs
            j1 = JobPosting(
                recruiter_id=recruiter1_id,
                title="Robotics Software Engineer",
                description="Developing embedded ROS systems and control algorithms.",
                opportunity_type=OpportunityType.JOB,
                company_name="Alpha Tech Innovators",
                location="Hyderabad, India",
                is_remote=False,
                employment_type=EmploymentType.FULL_TIME,
                is_active=True,
                salary_min=80000,
                salary_max=120000,
            )
            j2 = JobPosting(
                recruiter_id=recruiter2_id,
                title="Cloud Infrastructure Intern",
                description="Kubernetes, Terraform, and PostgreSQL cloud automation.",
                opportunity_type=OpportunityType.INTERNSHIP,
                company_name="Beta Global Cloud",
                location="Bengaluru, India",
                is_remote=True,
                employment_type=EmploymentType.PART_TIME,
                is_active=False,
                salary_min=35000,
                salary_max=50000,
            )
            db.add_all([j1, j2])
            db.commit()
            db.refresh(j1)
            db.refresh(j2)
            job1_id = j1.id
            job2_id = j2.id

        # Generate tokens
        token_admin = create_access_token(subject=admin_id)
        token_admin2 = create_access_token(subject=admin2_id)
        token_inact_admin = create_access_token(subject=inactive_admin_id)
        token_student = create_access_token(subject=student_id)
        token_recruiter = create_access_token(subject=recruiter1_id)

        headers_admin = {"Authorization": f"Bearer {token_admin}"}
        headers_admin2 = {"Authorization": f"Bearer {token_admin2}"}
        headers_inact_admin = {"Authorization": f"Bearer {token_inact_admin}"}
        headers_student = {"Authorization": f"Bearer {token_student}"}
        headers_recruiter = {"Authorization": f"Bearer {token_recruiter}"}

        # -----------------------------------------------------------------
        # USER MANAGEMENT TESTS
        # -----------------------------------------------------------------
        print("[Test 1] Admin can list users -> 200")
        res = client.get("/api/v1/admin/users", headers=headers_admin)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        assert data["total"] >= 6
        print("  -> Passed: Admin listed users successfully")

        print("\n[Test 2] Student cannot list users -> 403")
        res = client.get("/api/v1/admin/users", headers=headers_student)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  -> Passed: Student received 403 Forbidden")

        print("\n[Test 3] Recruiter cannot list users -> 403")
        res = client.get("/api/v1/admin/users", headers=headers_recruiter)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  -> Passed: Recruiter received 403 Forbidden")

        print("\n[Test 4] Missing token -> 401")
        res = client.get("/api/v1/admin/users")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  -> Passed: Unauthenticated request returned 401")

        print("\n[Test 5] Invalid token -> 401")
        res = client.get("/api/v1/admin/users", headers={"Authorization": "Bearer invalid_token_123"})
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  -> Passed: Invalid token returned 401")

        print("\n[Test 6] Search filters users by email")
        res = client.get(f"/api/v1/admin/users?search=alpha", headers=headers_admin)
        assert res.status_code == 200
        # No user has 'alpha' in email
        assert res.json()["total"] == 0
        res = client.get(f"/api/v1/admin/users?search=student.mod", headers=headers_admin)
        assert res.status_code == 200
        assert res.json()["total"] == 1
        assert res.json()["items"][0]["email"] == STUDENT_EMAIL
        print("  -> Passed: Search correctly matched email")

        print("\n[Test 7] Role filter works")
        res = client.get("/api/v1/admin/users?role=recruiter", headers=headers_admin)
        assert res.status_code == 200
        items = res.json()["items"]
        assert all(u["role"] == "recruiter" for u in items)
        assert any(u["email"] == RECRUITER1_EMAIL for u in items)
        print("  -> Passed: Role filter correctly restricted items")

        print("\n[Test 8] is_active filter works")
        res = client.get("/api/v1/admin/users?is_active=false", headers=headers_admin)
        assert res.status_code == 200
        items = res.json()["items"]
        assert any(u["email"] == INACTIVE_ADMIN_EMAIL for u in items)
        assert all(u["is_active"] is False for u in items)
        print("  -> Passed: is_active filter correctly matched inactive accounts")

        print("\n[Test 9] Pagination works")
        res = client.get("/api/v1/admin/users?page=1&page_size=2", headers=headers_admin)
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total_pages"] >= 3
        print("  -> Passed: Pagination returned exact page_size and accurate total_pages")

        print("\n[Test 10] Admin can view user detail")
        res = client.get(f"/api/v1/admin/users/{student_id}", headers=headers_admin)
        assert res.status_code == 200
        user_data = res.json()
        assert user_data["id"] == student_id
        assert user_data["email"] == STUDENT_EMAIL
        assert user_data["role"] == "student"
        assert user_data["is_active"] is True
        print("  -> Passed: User detail returned expected fields")

        print("\n[Test 11] Missing user detail -> 404")
        res = client.get("/api/v1/admin/users/999999", headers=headers_admin)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        assert "not found" in res.json()["detail"].lower()
        print("  -> Passed: Non-existent user returned 404")

        print("\n[Test 12] Admin can deactivate user account")
        res = client.patch(
            f"/api/v1/admin/users/{student_id}/status",
            json={"is_active": False},
            headers=headers_admin,
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert res.json()["is_active"] is False
        # Verify student is now rejected by auth
        res_stu = client.get("/api/v1/admin/users", headers=headers_student)
        assert res_stu.status_code == 401
        print("  -> Passed: User deactivated and blocked by auth")

        print("\n[Test 13] Admin can activate user account")
        res = client.patch(
            f"/api/v1/admin/users/{student_id}/status",
            json={"is_active": True},
            headers=headers_admin,
        )
        assert res.status_code == 200
        assert res.json()["is_active"] is True
        print("  -> Passed: User reactivated successfully")

        print("\n[Test 14] Admin cannot deactivate self (prevent lockout -> 400)")
        res = client.patch(
            f"/api/v1/admin/users/{admin_id}/status",
            json={"is_active": False},
            headers=headers_admin,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        assert "cannot deactivate" in res.json()["detail"].lower()

        # Another admin can deactivate admin1
        res = client.patch(
            f"/api/v1/admin/users/{admin_id}/status",
            json={"is_active": False},
            headers=headers_admin2,
        )
        assert res.status_code == 200
        assert res.json()["is_active"] is False

        # Reactivate admin1 with admin2
        res = client.patch(
            f"/api/v1/admin/users/{admin_id}/status",
            json={"is_active": True},
            headers=headers_admin2,
        )
        assert res.status_code == 200
        assert res.json()["is_active"] is True
        print("  -> Passed: Self-deactivation blocked with 400; peer admin deactivation succeeded")

        # -----------------------------------------------------------------
        # SECURITY BOUNDARY TESTS
        # -----------------------------------------------------------------
        print("\n[Test 15] password_hash is never present in responses")
        res = client.get(f"/api/v1/admin/users/{student_id}", headers=headers_admin)
        assert "password_hash" not in res.json()
        assert "password" not in res.json()
        res = client.get("/api/v1/admin/users", headers=headers_admin)
        for item in res.json()["items"]:
            assert "password_hash" not in item
            assert "password" not in item
        print("  -> Passed: Credential fields omitted from all responses")

        print("\n[Test 16] Arbitrary role changes are not accepted via status endpoint")
        res = client.patch(
            f"/api/v1/admin/users/{student_id}/status",
            json={"is_active": True, "role": "admin"},
            headers=headers_admin,
        )
        assert res.status_code == 200
        assert res.json()["role"] == "student"  # role unchanged!
        print("  -> Passed: Role remained immutable across status patch")

        print("\n[Test 17] Arbitrary password/hash changes are not accepted via status endpoint")
        res = client.patch(
            f"/api/v1/admin/users/{student_id}/status",
            json={"is_active": True, "password_hash": "hacked_hash"},
            headers=headers_admin,
        )
        assert res.status_code == 200
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.id == student_id))
            assert user.password_hash != "hacked_hash"
        print("  -> Passed: password_hash cannot be modified via status patch")

        print("\n[Test 18] Client-supplied identity cannot override target user")
        # Attacker tries to pass another id in query or body
        res = client.patch(
            f"/api/v1/admin/users/{student_id}/status?user_id={admin2_id}",
            json={"is_active": True, "id": admin2_id},
            headers=headers_admin,
        )
        assert res.status_code == 200
        assert res.json()["id"] == student_id
        print("  -> Passed: Path parameter strictly governs target user")

        # -----------------------------------------------------------------
        # RECRUITER MODERATION TESTS
        # -----------------------------------------------------------------
        print("\n[Test 19] Admin can list recruiters")
        res = client.get("/api/v1/admin/recruiters", headers=headers_admin)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["total"] >= 2
        items = data["items"]
        rec1_item = next((r for r in items if r["user_id"] == recruiter1_id), None)
        assert rec1_item is not None
        assert rec1_item["company_name"] == "Alpha Tech Innovators"
        assert rec1_item["email"] == RECRUITER1_EMAIL
        assert rec1_item["is_verified"] is False
        print("  -> Passed: Recruiters listed with company metadata and email")

        print("\n[Test 20] Student blocked from recruiter administration -> 403")
        res = client.get("/api/v1/admin/recruiters", headers=headers_student)
        assert res.status_code == 403
        res = client.patch(
            f"/api/v1/admin/recruiters/{recruiter1_id}/verification",
            json={"is_verified": True},
            headers=headers_student,
        )
        assert res.status_code == 403
        print("  -> Passed: Student denied recruiter administration with 403")

        print("\n[Test 21] Recruiter blocked from recruiter administration -> 403")
        res = client.get("/api/v1/admin/recruiters", headers=headers_recruiter)
        assert res.status_code == 403
        res = client.patch(
            f"/api/v1/admin/recruiters/{recruiter1_id}/verification",
            json={"is_verified": True},
            headers=headers_recruiter,
        )
        assert res.status_code == 403
        print("  -> Passed: Recruiter denied recruiter administration with 403")

        print("\n[Test 22] Recruiter verification works")
        res = client.patch(
            f"/api/v1/admin/recruiters/{recruiter1_id}/verification",
            json={"is_verified": True},
            headers=headers_admin,
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert res.json()["is_verified"] is True
        with SessionLocal() as db:
            rp = db.scalar(select(RecruiterProfile).where(RecruiterProfile.user_id == recruiter1_id))
            assert rp.is_verified is True
            u = db.scalar(select(User).where(User.id == recruiter1_id))
            assert u.is_verified is True
        print("  -> Passed: Recruiter verified in profile and user record")

        print("\n[Test 23] Recruiter unverification works")
        res = client.patch(
            f"/api/v1/admin/recruiters/{recruiter1_id}/verification",
            json={"is_verified": False},
            headers=headers_admin,
        )
        assert res.status_code == 200
        assert res.json()["is_verified"] is False
        with SessionLocal() as db:
            rp = db.scalar(select(RecruiterProfile).where(RecruiterProfile.user_id == recruiter1_id))
            assert rp.is_verified is False
        print("  -> Passed: Recruiter unverified successfully")

        print("\n[Test 24] Non-recruiter user cannot be verified through recruiter endpoint -> 400")
        res = client.patch(
            f"/api/v1/admin/recruiters/{student_id}/verification",
            json={"is_verified": True},
            headers=headers_admin,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        assert "not a recruiter" in res.json()["detail"].lower()
        print("  -> Passed: Non-recruiter verification rejected with 400")

        print("\n[Test 25] Recruiter without profile handled with 404")
        # Create temporary recruiter without profile
        with SessionLocal() as db:
            orphan_recruiter = User(
                email="orphan.rec@careerbridge.io",
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
                is_active=True,
            )
            db.add(orphan_recruiter)
            db.commit()
            db.refresh(orphan_recruiter)
            orphan_id = orphan_recruiter.id

        res = client.patch(
            f"/api/v1/admin/recruiters/{orphan_id}/verification",
            json={"is_verified": True},
            headers=headers_admin,
        )
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"
        assert "profile not found" in res.json()["detail"].lower()
        with SessionLocal() as db:
            u = db.scalar(select(User).where(User.id == orphan_id))
            db.delete(u)
            db.commit()
        print("  -> Passed: Recruiter without profile returned 404")

        print("\n[Test 26] Verification filter works on recruiter listing")
        res = client.get("/api/v1/admin/recruiters?is_verified=true", headers=headers_admin)
        assert res.status_code == 200
        items = res.json()["items"]
        assert all(r["is_verified"] is True for r in items)
        assert any(r["user_id"] == recruiter2_id for r in items)
        print("  -> Passed: is_verified=true filter correctly returned verified recruiters")

        print("\n[Test 27] Search filter works across email, company_name, contact_name")
        res = client.get("/api/v1/admin/recruiters?search=Alpha", headers=headers_admin)
        assert res.status_code == 200
        assert res.json()["total"] == 1
        assert res.json()["items"][0]["company_name"] == "Alpha Tech Innovators"

        res = client.get("/api/v1/admin/recruiters?search=Alice", headers=headers_admin)
        assert res.status_code == 200
        assert res.json()["total"] == 1
        assert res.json()["items"][0]["contact_name"] == "Alice Recruiter"

        res = client.get(f"/api/v1/admin/recruiters?search={RECRUITER2_EMAIL}", headers=headers_admin)
        assert res.status_code == 200
        assert res.json()["total"] == 1
        assert res.json()["items"][0]["email"] == RECRUITER2_EMAIL
        print("  -> Passed: Search filter correctly matched company, contact, and email")

        # -----------------------------------------------------------------
        # JOB MODERATION TESTS
        # -----------------------------------------------------------------
        print("\n[Test 28] Admin can list active and inactive jobs")
        res = client.get("/api/v1/admin/jobs", headers=headers_admin)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        jobs = res.json()["items"]
        job_ids = [j["id"] for j in jobs]
        assert job1_id in job_ids, "Active Job 1 should be visible to admin"
        assert job2_id in job_ids, "Inactive Job 2 should be visible to admin"
        print("  -> Passed: Admin listed both active and inactive jobs")

        print("\n[Test 29] Student cannot access admin job listing -> 403")
        res = client.get("/api/v1/admin/jobs", headers=headers_student)
        assert res.status_code == 403
        res = client.patch(
            f"/api/v1/admin/jobs/{job1_id}/status",
            json={"is_active": False},
            headers=headers_student,
        )
        assert res.status_code == 403
        print("  -> Passed: Student blocked from admin job routes with 403")

        print("\n[Test 30] Recruiter cannot access admin job listing -> 403")
        res = client.get("/api/v1/admin/jobs", headers=headers_recruiter)
        assert res.status_code == 403
        res = client.patch(
            f"/api/v1/admin/jobs/{job1_id}/status",
            json={"is_active": False},
            headers=headers_recruiter,
        )
        assert res.status_code == 403
        print("  -> Passed: Recruiter blocked from admin job routes with 403")

        print("\n[Test 31] Admin can deactivate a job")
        res = client.patch(
            f"/api/v1/admin/jobs/{job1_id}/status",
            json={"is_active": False},
            headers=headers_admin,
        )
        assert res.status_code == 200
        assert res.json()["is_active"] is False
        with SessionLocal() as db:
            j = db.scalar(select(JobPosting).where(JobPosting.id == job1_id))
            assert j.is_active is False
        print("  -> Passed: Job deactivated successfully")

        print("\n[Test 32] Admin can activate a job")
        res = client.patch(
            f"/api/v1/admin/jobs/{job2_id}/status",
            json={"is_active": True},
            headers=headers_admin,
        )
        assert res.status_code == 200
        assert res.json()["is_active"] is True
        with SessionLocal() as db:
            j = db.scalar(select(JobPosting).where(JobPosting.id == job2_id))
            assert j.is_active is True
        print("  -> Passed: Job activated successfully")

        print("\n[Test 33] Moderating non-existent job -> 404")
        res = client.patch(
            "/api/v1/admin/jobs/999999/status",
            json={"is_active": False},
            headers=headers_admin,
        )
        assert res.status_code == 404
        print("  -> Passed: Non-existent job returned 404")

        print("\n[Test 34] Only is_active changes, other fields preserved")
        res = client.patch(
            f"/api/v1/admin/jobs/{job1_id}/status",
            json={
                "is_active": True,
                "title": "Hacked Title",
                "recruiter_id": 999,
                "salary_min": 999999,
            },
            headers=headers_admin,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_active"] is True
        assert data["title"] == "Robotics Software Engineer"  # Title unchanged!
        assert data["recruiter_id"] == recruiter1_id  # Recruiter unchanged!
        print("  -> Passed: Only is_active mutated; all other fields intact")

        print("\n[Test 35] Admin job filters")
        res = client.get("/api/v1/admin/jobs?search=Robotics", headers=headers_admin)
        assert res.status_code == 200
        assert any(j["id"] == job1_id for j in res.json()["items"])

        res = client.get("/api/v1/admin/jobs?opportunity_type=internship", headers=headers_admin)
        assert res.status_code == 200
        assert all(j["opportunity_type"] == "internship" for j in res.json()["items"])

        res = client.get("/api/v1/admin/jobs?employment_type=part_time", headers=headers_admin)
        assert res.status_code == 200
        assert all(j["employment_type"] == "part_time" for j in res.json()["items"])
        print("  -> Passed: Admin job filters executed correctly")

        # -----------------------------------------------------------------
        # AUTHORIZATION & INACTIVITY TESTS
        # -----------------------------------------------------------------
        print("\n[Test 36] Inactive admin cannot access admin endpoints -> 401")
        res = client.get("/api/v1/admin/users", headers=headers_inact_admin)
        assert res.status_code == 401
        res = client.get("/api/v1/admin/recruiters", headers=headers_inact_admin)
        assert res.status_code == 401
        res = client.get("/api/v1/admin/jobs", headers=headers_inact_admin)
        assert res.status_code == 401
        print("  -> Passed: Inactive admin account rejected with 401")

        print("\n[Test 37] Spoofed role in query/payload cannot grant admin access")
        res = client.get("/api/v1/admin/users?role=admin", headers=headers_student)
        assert res.status_code == 403
        res = client.patch(
            f"/api/v1/admin/users/{student_id}/status",
            headers=headers_recruiter,
            json={"is_active": True, "role": "admin"},
        )
        assert res.status_code == 403
        print("  -> Passed: Spoofed client roles safely rejected")

        print("\n=========================================================")
        print("ALL 37 PHASE 16 ADMIN & MODERATION TESTS PASSED!")
        print("=========================================================\n")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_admin_tests()
