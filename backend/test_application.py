"""
CareerBridge Phase 11 Application Submission & Tracking Test Suite
Tests:
- Application model, schemas, enums (applied, reviewing, shortlisted, rejected, accepted)
- Student application submission (/jobs/{job_id}/applications)
- Recruiter/Admin/Unauthenticated authorization boundaries
- Inactive job rejection (400), nonexistent job (404), duplicate application (409)
- Student application listing & detail (/applications/me, /applications/{id})
- Cross-student data isolation (403)
- Recruiter application review & status transitions (/recruiter/applications, /recruiter/applications/{id})
- Cross-recruiter data isolation (403)
- Immutability of student_id and job_posting_id
- Cascade deletion of applications upon job deletion
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
from app.models.application import Application, ApplicationStatus
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER1_EMAIL = "app.recruiter1@careerbridge.io"
RECRUITER2_EMAIL = "app.recruiter2@careerbridge.io"
STUDENT1_EMAIL = "app.student1@careerbridge.io"
STUDENT2_EMAIL = "app.student2@careerbridge.io"
ADMIN_EMAIL = "app.admin@careerbridge.io"
TEST_PASSWORD = "ApplicationTestPassword123!"


def cleanup_test_data():
    """Remove test users and all cascading jobs and applications."""
    with SessionLocal() as db:
        test_emails = [
            RECRUITER1_EMAIL,
            RECRUITER2_EMAIL,
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            # Explicit cleanup in dependency order
            db.execute(delete(Application).where(Application.student_id.in_(user_ids)))
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def run_application_tests():
    print("\n=========================================================")
    print("STARTING PHASE 11 APPLICATION SUBMISSION & TRACKING TESTS")
    print("=========================================================\n")

    cleanup_test_data()

    recruiter1_id = None
    recruiter2_id = None
    student1_id = None
    student2_id = None
    admin_id = None

    try:
        # Step 1: Create test users
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
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add_all([r1, r2, s1, s2, admin])
            db.commit()
            db.refresh(r1)
            db.refresh(r2)
            db.refresh(s1)
            db.refresh(s2)
            db.refresh(admin)

            recruiter1_id = r1.id
            recruiter2_id = r2.id
            student1_id = s1.id
            student2_id = s2.id
            admin_id = admin.id

            # Create test jobs
            # Job 1: Active job by Recruiter 1
            job1 = JobPosting(
                recruiter_id=recruiter1_id,
                title="Full-Stack Engineer Intern",
                description="Join our team building CareerBridge applications.",
                opportunity_type=OpportunityType.INTERNSHIP,
                company_name="BridgeTech",
                is_active=True,
                employment_type=EmploymentType.FULL_TIME,
            )
            # Job 2: Inactive job by Recruiter 1
            job2 = JobPosting(
                recruiter_id=recruiter1_id,
                title="Archived Data Analyst Role",
                description="Old posting that is no longer accepting applications.",
                opportunity_type=OpportunityType.JOB,
                company_name="BridgeTech",
                is_active=False,
                employment_type=EmploymentType.FULL_TIME,
            )
            # Job 3: Active job by Recruiter 2
            job3 = JobPosting(
                recruiter_id=recruiter2_id,
                title="Cloud DevOps Specialist",
                description="Recruiter 2's posting for infrastructure engineering.",
                opportunity_type=OpportunityType.JOB,
                company_name="CloudNine Systems",
                is_active=True,
                employment_type=EmploymentType.FULL_TIME,
            )
            db.add_all([job1, job2, job3])
            db.commit()
            db.refresh(job1)
            db.refresh(job2)
            db.refresh(job3)

            job1_id = job1.id
            job2_id = job2.id
            job3_id = job3.id

        # Generate auth tokens
        token_r1 = create_access_token(subject=recruiter1_id)
        token_r2 = create_access_token(subject=recruiter2_id)
        token_s1 = create_access_token(subject=student1_id)
        token_s2 = create_access_token(subject=student2_id)
        token_admin = create_access_token(subject=admin_id)

        headers_r1 = {"Authorization": f"Bearer {token_r1}"}
        headers_r2 = {"Authorization": f"Bearer {token_r2}"}
        headers_s1 = {"Authorization": f"Bearer {token_s1}"}
        headers_s2 = {"Authorization": f"Bearer {token_s2}"}
        headers_admin = {"Authorization": f"Bearer {token_admin}"}

        app1_id = None

        # TEST 1: Student can apply to active job (201)
        print("[Test 1/22] Student can apply to active job posting (201)...")
        app_payload = {
            "cover_message": "I am deeply passionate about modern cloud architectures and full-stack development."
        }
        r1_res = client.post(
            f"/api/v1/jobs/{job1_id}/applications",
            json=app_payload,
            headers=headers_s1,
        )
        assert r1_res.status_code == 201, f"Expected 201, got {r1_res.status_code}: {r1_res.text}"
        app1_data = r1_res.json()
        app1_id = app1_data["id"]
        assert app1_data["job_posting_id"] == job1_id
        assert app1_data["student_id"] == student1_id
        assert app1_data["status"] == "applied"
        assert app1_data["cover_message"] == app_payload["cover_message"]
        assert "created_at" in app1_data
        assert "updated_at" in app1_data
        print(f"  -> Passed: Application #{app1_id} created successfully with 201.")

        # TEST 2: Recruiter cannot submit an application (403)
        print("[Test 2/22] Recruiter cannot submit an application (403)...")
        r2_res = client.post(
            f"/api/v1/jobs/{job1_id}/applications",
            json=app_payload,
            headers=headers_r1,
        )
        assert r2_res.status_code == 403, f"Expected 403, got {r2_res.status_code}"
        print("  -> Passed: Recruiter denied application submission with 403 Forbidden.")

        # TEST 3: Unauthenticated user cannot apply (401)
        print("[Test 3/22] Unauthenticated user cannot apply (401)...")
        r3_res = client.post(
            f"/api/v1/jobs/{job1_id}/applications",
            json=app_payload,
        )
        assert r3_res.status_code == 401, f"Expected 401, got {r3_res.status_code}"
        print("  -> Passed: Unauthenticated application request rejected with 401.")

        # TEST 4: Application created with status = 'applied'
        print("[Test 4/22] Verifying initial status is 'applied'...")
        assert app1_data["status"] == ApplicationStatus.APPLIED.value
        print("  -> Passed: Initial application status is verified as 'applied'.")

        # TEST 5: student_id is derived from authenticated user
        print("[Test 5/22] Verifying student_id is derived from authenticated user...")
        assert app1_data["student_id"] == student1_id
        print("  -> Passed: student_id matches authenticated Student 1.")

        # TEST 6: Spoofed student_id cannot change ownership
        print("[Test 6/22] Spoofed student_id cannot change ownership...")
        spoofed_payload = {
            "cover_message": "Attempting to spoof another student ID.",
            "student_id": student2_id,
        }
        r6_res = client.post(
            f"/api/v1/jobs/{job3_id}/applications",
            json=spoofed_payload,
            headers=headers_s1,
        )
        assert r6_res.status_code == 201
        spoofed_data = r6_res.json()
        assert spoofed_data["student_id"] == student1_id, (
            f"Expected {student1_id}, but student_id was spoofed to {spoofed_data['student_id']}"
        )
        print("  -> Passed: Spoofed student_id ignored; ownership firmly bound to current_user.id.")

        # TEST 7: Student cannot apply to inactive job (400)
        print("[Test 7/22] Student cannot apply to inactive job (400)...")
        r7_res = client.post(
            f"/api/v1/jobs/{job2_id}/applications",
            json=app_payload,
            headers=headers_s1,
        )
        assert r7_res.status_code == 400, f"Expected 400, got {r7_res.status_code}: {r7_res.text}"
        assert "inactive" in r7_res.json()["detail"].lower()
        print("  -> Passed: Applying to inactive job rejected with 400 Bad Request.")

        # TEST 8: Application to nonexistent job returns 404
        print("[Test 8/22] Application to nonexistent job returns 404...")
        r8_res = client.post(
            "/api/v1/jobs/999999/applications",
            json=app_payload,
            headers=headers_s1,
        )
        assert r8_res.status_code == 404, f"Expected 404, got {r8_res.status_code}"
        print("  -> Passed: Nonexistent job returns 404 Not Found.")

        # TEST 9: Duplicate application returns 409
        print("[Test 9/22] Duplicate application returns 409 Conflict...")
        r9_res = client.post(
            f"/api/v1/jobs/{job1_id}/applications",
            json=app_payload,
            headers=headers_s1,
        )
        assert r9_res.status_code == 409, f"Expected 409, got {r9_res.status_code}: {r9_res.text}"
        assert "already applied" in r9_res.json()["detail"].lower()
        print("  -> Passed: Duplicate application submission rejected with 409 Conflict.")

        # TEST 10: Student can list own applications (/applications/me)
        print("[Test 10/22] Student can list own applications (/applications/me)...")
        r10_res = client.get("/api/v1/applications/me", headers=headers_s1)
        assert r10_res.status_code == 200, f"Expected 200, got {r10_res.status_code}"
        my_apps = r10_res.json()
        assert len(my_apps) >= 2  # Applied to Job 1 and Job 3
        my_app_ids = [a["id"] for a in my_apps]
        assert app1_id in my_app_ids
        print("  -> Passed: Student 1 successfully lists own applications.")

        # TEST 11: Student cannot list another student's applications
        print("[Test 11/22] Student cannot list another student's applications (isolation)...")
        r11_res = client.get("/api/v1/applications/me", headers=headers_s2)
        assert r11_res.status_code == 200
        s2_apps = r11_res.json()
        assert len(s2_apps) == 0  # Student 2 has not applied to anything yet
        print("  -> Passed: Student 2 receives empty list; cannot see Student 1's applications.")

        # TEST 12: Student can view own application (/applications/{id})
        print("[Test 12/22] Student can view own application detail (/applications/{id})...")
        r12_res = client.get(f"/api/v1/applications/{app1_id}", headers=headers_s1)
        assert r12_res.status_code == 200
        assert r12_res.json()["id"] == app1_id
        print("  -> Passed: Student 1 successfully retrieves own application details.")

        # TEST 13: Student cannot view another student's application (403)
        print("[Test 13/22] Student cannot view another student's application (403)...")
        r13_res = client.get(f"/api/v1/applications/{app1_id}", headers=headers_s2)
        assert r13_res.status_code == 403, f"Expected 403, got {r13_res.status_code}"
        print("  -> Passed: Cross-student detail access blocked with 403 Forbidden.")

        # TEST 14: Recruiter can view applications for own job (/recruiter/applications)
        print("[Test 14/22] Recruiter can view applications for own job (/recruiter/applications)...")
        r14_res = client.get("/api/v1/recruiter/applications", headers=headers_r1)
        assert r14_res.status_code == 200
        r1_apps = r14_res.json()
        r1_app_ids = [a["id"] for a in r1_apps]
        assert app1_id in r1_app_ids
        print(f"  -> Passed: Recruiter 1 lists candidate applications containing #{app1_id}.")

        # TEST 15: Recruiter cannot view another recruiter's applications (isolation)
        print("[Test 15/22] Recruiter cannot view another recruiter's applications (isolation)...")
        # Recruiter 2 should only see applications for Job 3
        r15_list = client.get("/api/v1/recruiter/applications", headers=headers_r2)
        assert r15_list.status_code == 200
        r2_app_ids = [a["id"] for a in r15_list.json()]
        assert app1_id not in r2_app_ids

        # Recruiter 2 directly requesting app1_id via recruiter endpoint -> 403 Forbidden
        r15_detail = client.get(f"/api/v1/recruiter/applications/{app1_id}", headers=headers_r2)
        assert r15_detail.status_code == 403, f"Expected 403, got {r15_detail.status_code}"
        print("  -> Passed: Cross-recruiter isolation enforced on list and detail (403).")

        # TEST 16: Recruiter can update status of own job's application
        print("[Test 16/22] Recruiter can update status of own job's application...")
        r16_patch1 = client.patch(
            f"/api/v1/recruiter/applications/{app1_id}",
            json={"status": "reviewing"},
            headers=headers_r1,
        )
        assert r16_patch1.status_code == 200, f"Expected 200, got {r16_patch1.status_code}"
        assert r16_patch1.json()["status"] == "reviewing"

        r16_patch2 = client.patch(
            f"/api/v1/recruiter/applications/{app1_id}",
            json={"status": "shortlisted"},
            headers=headers_r1,
        )
        assert r16_patch2.status_code == 200
        assert r16_patch2.json()["status"] == "shortlisted"
        print("  -> Passed: Recruiter transitioned status to 'reviewing' and 'shortlisted'.")

        # TEST 17: Recruiter cannot update another recruiter's application (403)
        print("[Test 17/22] Recruiter cannot update another recruiter's application (403)...")
        r17_res = client.patch(
            f"/api/v1/recruiter/applications/{app1_id}",
            json={"status": "rejected"},
            headers=headers_r2,
        )
        assert r17_res.status_code == 403, f"Expected 403, got {r17_res.status_code}"
        print("  -> Passed: Cross-recruiter status modification rejected with 403 Forbidden.")

        # TEST 18: Student cannot update application status (403)
        print("[Test 18/22] Student cannot update application status (403)...")
        r18_res = client.patch(
            f"/api/v1/recruiter/applications/{app1_id}",
            json={"status": "accepted"},
            headers=headers_s1,
        )
        assert r18_res.status_code == 403, f"Expected 403, got {r18_res.status_code}"
        print("  -> Passed: Student prohibited from recruiter status endpoint with 403.")

        # TEST 19: Invalid status returns 422
        print("[Test 19/22] Invalid status returns 422 Unprocessable Entity...")
        r19_res = client.patch(
            f"/api/v1/recruiter/applications/{app1_id}",
            json={"status": "hired_immediately"},
            headers=headers_r1,
        )
        assert r19_res.status_code == 422, f"Expected 422, got {r19_res.status_code}"
        print("  -> Passed: Invalid status string correctly rejected with 422.")

        # TEST 20: job_posting_id cannot be changed
        print("[Test 20/22] job_posting_id cannot be changed via PATCH...")
        r20_res = client.patch(
            f"/api/v1/recruiter/applications/{app1_id}",
            json={"status": "reviewing", "job_posting_id": job3_id},
            headers=headers_r1,
        )
        assert r20_res.status_code == 200
        assert r20_res.json()["job_posting_id"] == job1_id
        print("  -> Passed: job_posting_id remains immutable on PATCH.")

        # TEST 21: student_id cannot be changed
        print("[Test 21/22] student_id cannot be changed via PATCH...")
        r21_res = client.patch(
            f"/api/v1/recruiter/applications/{app1_id}",
            json={"status": "reviewing", "student_id": student2_id},
            headers=headers_r1,
        )
        assert r21_res.status_code == 200
        assert r21_res.json()["student_id"] == student1_id
        print("  -> Passed: student_id remains immutable on PATCH.")

        # TEST 22: Cascade deletion of job posting deletes its applications
        print("[Test 22/22] Cascade deletion of job posting deletes its applications...")
        # Create a temporary job posting
        with SessionLocal() as db:
            temp_job = JobPosting(
                recruiter_id=recruiter1_id,
                title="Temporary Job for Cascade Test",
                description="Testing cascade delete of applications.",
                opportunity_type=OpportunityType.INTERNSHIP,
                company_name="BridgeTech",
                is_active=True,
                employment_type=EmploymentType.PART_TIME,
            )
            db.add(temp_job)
            db.commit()
            db.refresh(temp_job)
            temp_job_id = temp_job.id

        # Student 2 applies to temp_job
        temp_app_res = client.post(
            f"/api/v1/jobs/{temp_job_id}/applications",
            json={"cover_message": "Temporary application to be deleted by cascade."},
            headers=headers_s2,
        )
        assert temp_app_res.status_code == 201
        temp_app_id = temp_app_res.json()["id"]

        # Recruiter 1 deletes temp_job
        del_job_res = client.delete(f"/api/v1/jobs/{temp_job_id}", headers=headers_r1)
        assert del_job_res.status_code == 204

        # Verify the application was cascaded and no longer exists
        check_app_res = client.get(f"/api/v1/applications/{temp_app_id}", headers=headers_s2)
        assert check_app_res.status_code == 404

        with SessionLocal() as db:
            db_app = db.scalar(select(Application).where(Application.id == temp_app_id))
            assert db_app is None, "Application record still exists in PostgreSQL after job deletion!"
        print("  -> Passed: Job deletion cascaded to application; application deleted cleanly.")

        # Bonus Verification: Admin can view application detail
        print("  -> Verifying Admin access to application detail...")
        admin_res = client.get(f"/api/v1/applications/{app1_id}", headers=headers_admin)
        assert admin_res.status_code == 200
        assert admin_res.json()["id"] == app1_id
        print("  -> Passed: Admin can view application detail with 200 OK.")

        print("\n=========================================================")
        print("ALL 22 APPLICATION TEST CASES PASSED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_application_tests()
