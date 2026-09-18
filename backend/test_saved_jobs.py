"""
CareerBridge Phase 15 Saved Jobs & Saved Internships Test Suite
Tests:
1. Student saves active job (201 Created, DB row verified, correct IDs & created_at)
2. Duplicate save returns 409 Conflict; only 1 row exists in DB
3. Student cannot save inactive job (400 Bad Request; no row created)
4. Saving non-existent job returns 404 Not Found
5. Student lists saved jobs (ordered newest saved first, accurate job fields and saved_at)
6. Ownership isolation: Student B cannot see Student A's saved jobs
7. Saved status check: unsaved returns is_saved=False (200), saved returns is_saved=True (200), missing job returns 404
8. Cross-student status isolation: Student A's save does not show as saved for Student B
9. Student unsaves job (204 No Content; subsequent status is_saved=False; removed from list)
10. Unsaving job that is not saved returns 404 Not Found
11. Recruiter blocked from save, list, status, unsave with 403 Forbidden
12. Admin blocked from student-only endpoints with 403 Forbidden
13. Unauthenticated requests to save, list, status, unsave return 401 Unauthorized
14. Inactive student rejected with 401 Unauthorized
15. Client-supplied student_id in query or payload is ignored (ownership strictly from token)
16. Cascade deletion: deleting a job deletes associated saved_jobs records
17. Cascade deletion: deleting a user deletes their saved_jobs records
18. Inactive job retention in saved list with is_active=False
"""

import sys
import time
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
from app.models.saved_job import SavedJob
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER_EMAIL = "savedjobs.recruiter@careerbridge.io"
STUDENT1_EMAIL = "savedjobs.student1@careerbridge.io"
STUDENT2_EMAIL = "savedjobs.student2@careerbridge.io"
INACTIVE_STUDENT_EMAIL = "savedjobs.inactive@careerbridge.io"
ADMIN_EMAIL = "savedjobs.admin@careerbridge.io"
TEST_PASSWORD = "SavedJobsTestPassword123!"


def cleanup_test_data():
    """Remove test users and all cascading jobs and saved jobs."""
    with SessionLocal() as db:
        test_emails = [
            RECRUITER_EMAIL,
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            INACTIVE_STUDENT_EMAIL,
            ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            # Explicit cleanup in dependency order
            db.execute(delete(SavedJob).where(SavedJob.student_id.in_(user_ids)))
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def run_saved_jobs_tests():
    print("\n=========================================================")
    print("STARTING PHASE 15 SAVED JOBS & SAVED INTERNSHIPS TESTS")
    print("=========================================================\n")

    cleanup_test_data()

    recruiter_id = None
    student1_id = None
    student2_id = None
    inactive_student_id = None
    admin_id = None

    try:
        # Step 1: Create test users
        with SessionLocal() as db:
            r = User(
                email=RECRUITER_EMAIL,
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
            s_inactive = User(
                email=INACTIVE_STUDENT_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.STUDENT,
                is_active=False,
                is_verified=True,
            )
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add_all([r, s1, s2, s_inactive, admin])
            db.commit()
            db.refresh(r)
            db.refresh(s1)
            db.refresh(s2)
            db.refresh(s_inactive)
            db.refresh(admin)

            recruiter_id = r.id
            student1_id = s1.id
            student2_id = s2.id
            inactive_student_id = s_inactive.id
            admin_id = admin.id

            # Create test jobs
            # Job 1: Active internship
            job1 = JobPosting(
                recruiter_id=recruiter_id,
                title="AI Research Intern",
                description="Exciting internship in machine learning and LLM research.",
                opportunity_type=OpportunityType.INTERNSHIP,
                company_name="OpenBrain AI",
                location="Bengaluru, India",
                is_remote=False,
                employment_type=EmploymentType.FULL_TIME,
                is_active=True,
                salary_min=40000,
                salary_max=60000,
            )
            # Job 2: Active full-time job
            job2 = JobPosting(
                recruiter_id=recruiter_id,
                title="Senior Backend Engineer",
                description="FastAPI, PostgreSQL, and scalable distributed architectures.",
                opportunity_type=OpportunityType.JOB,
                company_name="CloudBridge",
                location="Remote",
                is_remote=True,
                employment_type=EmploymentType.FULL_TIME,
                is_active=True,
                salary_min=120000,
                salary_max=160000,
            )
            # Job 3: Inactive job
            job3 = JobPosting(
                recruiter_id=recruiter_id,
                title="Closed Quality Assurance Role",
                description="Role has been filled and is closed.",
                opportunity_type=OpportunityType.JOB,
                company_name="OldCorp",
                location="Pune, India",
                is_remote=False,
                employment_type=EmploymentType.PART_TIME,
                is_active=False,
            )
            # Job 4: Another active job for cascade test
            job4 = JobPosting(
                recruiter_id=recruiter_id,
                title="Temporary Intern for Deletion",
                description="Will be deleted to test cascade behavior.",
                opportunity_type=OpportunityType.INTERNSHIP,
                company_name="Ephemeral Tech",
                location="Remote",
                is_remote=True,
                employment_type=EmploymentType.PART_TIME,
                is_active=True,
            )
            db.add_all([job1, job2, job3, job4])
            db.commit()
            db.refresh(job1)
            db.refresh(job2)
            db.refresh(job3)
            db.refresh(job4)

            job1_id = job1.id
            job2_id = job2.id
            job3_id = job3.id
            job4_id = job4.id

        # Auth tokens
        token_s1 = create_access_token(subject=student1_id)
        token_s2 = create_access_token(subject=student2_id)
        token_inactive = create_access_token(subject=inactive_student_id)
        token_r = create_access_token(subject=recruiter_id)
        token_admin = create_access_token(subject=admin_id)

        headers_s1 = {"Authorization": f"Bearer {token_s1}"}
        headers_s2 = {"Authorization": f"Bearer {token_s2}"}
        headers_inactive = {"Authorization": f"Bearer {token_inactive}"}
        headers_r = {"Authorization": f"Bearer {token_r}"}
        headers_admin = {"Authorization": f"Bearer {token_admin}"}

        # -----------------------------------------------------------------
        # TEST 1: Initial status check returns is_saved=False
        # -----------------------------------------------------------------
        print("[Test 1] Check initial saved status (unsaved)")
        res = client.get(f"/api/v1/jobs/{job1_id}/saved", headers=headers_s1)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["job_id"] == job1_id
        assert data["is_saved"] is False
        assert data["saved_at"] is None
        print("  -> Passed: is_saved=False, saved_at=None")

        # -----------------------------------------------------------------
        # TEST 2: Student saves active job (201 Created)
        # -----------------------------------------------------------------
        print("\n[Test 2] Student saves active job")
        res = client.post(f"/api/v1/jobs/{job1_id}/save", headers=headers_s1)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["job_id"] == job1_id
        assert data["is_saved"] is True
        assert data["saved_at"] is not None
        saved_at_1 = data["saved_at"]

        # Verify DB row
        with SessionLocal() as db:
            saved_row = db.scalar(
                select(SavedJob).where(
                    SavedJob.student_id == student1_id,
                    SavedJob.job_posting_id == job1_id,
                )
            )
            assert saved_row is not None, "SavedJob row not found in database!"
            assert saved_row.student_id == student1_id
            assert saved_row.job_posting_id == job1_id
            assert saved_row.created_at is not None
        print(f"  -> Passed: 201 Created, DB row verified (id={saved_row.id})")

        # -----------------------------------------------------------------
        # TEST 3: Status check after saving returns is_saved=True
        # -----------------------------------------------------------------
        print("\n[Test 3] Check saved status after saving")
        res = client.get(f"/api/v1/jobs/{job1_id}/saved", headers=headers_s1)
        assert res.status_code == 200
        data = res.json()
        assert data["job_id"] == job1_id
        assert data["is_saved"] is True
        assert data["saved_at"] is not None
        print("  -> Passed: is_saved=True, saved_at timestamp returned")

        # -----------------------------------------------------------------
        # TEST 4: Duplicate save returns 409 Conflict
        # -----------------------------------------------------------------
        print("\n[Test 4] Duplicate save returns 409 Conflict")
        res = client.post(f"/api/v1/jobs/{job1_id}/save", headers=headers_s1)
        assert res.status_code == 409, f"Expected 409, got {res.status_code}: {res.text}"
        assert "already saved" in res.json()["detail"]
        with SessionLocal() as db:
            count = len(
                db.scalars(
                    select(SavedJob).where(
                        SavedJob.student_id == student1_id,
                        SavedJob.job_posting_id == job1_id,
                    )
                ).all()
            )
            assert count == 1, f"Expected exactly 1 saved job row, found {count}"
        print("  -> Passed: 409 Conflict returned and only 1 row in DB")

        # -----------------------------------------------------------------
        # TEST 5: Cannot save inactive job (400 Bad Request)
        # -----------------------------------------------------------------
        print("\n[Test 5] Cannot save inactive job")
        res = client.post(f"/api/v1/jobs/{job3_id}/save", headers=headers_s1)
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        assert "inactive" in res.json()["detail"].lower()
        with SessionLocal() as db:
            row = db.scalar(
                select(SavedJob).where(
                    SavedJob.student_id == student1_id,
                    SavedJob.job_posting_id == job3_id,
                )
            )
            assert row is None, "Inactive job should not be in saved_jobs!"
        print("  -> Passed: 400 Bad Request and no row created")

        # -----------------------------------------------------------------
        # TEST 6: Saving non-existent job returns 404 Not Found
        # -----------------------------------------------------------------
        print("\n[Test 6] Saving non-existent job returns 404 Not Found")
        res = client.post("/api/v1/jobs/999999/save", headers=headers_s1)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        assert "not found" in res.json()["detail"].lower()
        print("  -> Passed: 404 Not Found returned")

        # -----------------------------------------------------------------
        # TEST 7: Checking status of non-existent job returns 404
        # -----------------------------------------------------------------
        print("\n[Test 7] Checking status of non-existent job returns 404")
        res = client.get("/api/v1/jobs/999999/saved", headers=headers_s1)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        print("  -> Passed: 404 Not Found returned")

        # -----------------------------------------------------------------
        # TEST 8: List saved jobs (newest saved first)
        # -----------------------------------------------------------------
        print("\n[Test 8] List saved jobs with ordering and accurate fields")
        # Save Job 2 after a brief sleep to guarantee strictly newer timestamp
        time.sleep(0.05)
        res = client.post(f"/api/v1/jobs/{job2_id}/save", headers=headers_s1)
        assert res.status_code == 201

        res = client.get("/api/v1/saved-jobs", headers=headers_s1)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        items = res.json()
        assert len(items) == 2, f"Expected 2 saved jobs, got {len(items)}"
        # Newest saved first: Job 2 should be first, Job 1 second
        assert items[0]["id"] == job2_id
        assert items[0]["title"] == "Senior Backend Engineer"
        assert items[0]["company_name"] == "CloudBridge"
        assert items[0]["is_remote"] is True
        assert items[0]["saved_id"] is not None
        assert items[0]["saved_at"] is not None

        assert items[1]["id"] == job1_id
        assert items[1]["title"] == "AI Research Intern"
        assert items[1]["company_name"] == "OpenBrain AI"
        assert items[1]["saved_at"] == saved_at_1
        print("  -> Passed: Correctly returned 2 saved jobs ordered newest first")

        # -----------------------------------------------------------------
        # TEST 9: Ownership isolation (Student 2 sees 0 saved jobs)
        # -----------------------------------------------------------------
        print("\n[Test 9] Cross-student ownership isolation in listing")
        res = client.get("/api/v1/saved-jobs", headers=headers_s2)
        assert res.status_code == 200
        assert len(res.json()) == 0, "Student 2 should have 0 saved jobs!"
        print("  -> Passed: Student 2 isolated, sees 0 saved jobs")

        # -----------------------------------------------------------------
        # TEST 10: Cross-student status isolation
        # -----------------------------------------------------------------
        print("\n[Test 10] Cross-student status isolation")
        res = client.get(f"/api/v1/jobs/{job1_id}/saved", headers=headers_s2)
        assert res.status_code == 200
        data = res.json()
        assert data["job_id"] == job1_id
        assert data["is_saved"] is False
        assert data["saved_at"] is None
        print("  -> Passed: Job 1 is not saved for Student 2")

        # -----------------------------------------------------------------
        # TEST 11: Student unsaves a job (204 No Content)
        # -----------------------------------------------------------------
        print("\n[Test 11] Student unsaves job (204 No Content)")
        res = client.delete(f"/api/v1/jobs/{job1_id}/save", headers=headers_s1)
        assert res.status_code == 204, f"Expected 204, got {res.status_code}"

        # Check status is now False
        res = client.get(f"/api/v1/jobs/{job1_id}/saved", headers=headers_s1)
        assert res.status_code == 200
        assert res.json()["is_saved"] is False

        # Check list now only has Job 2
        res = client.get("/api/v1/saved-jobs", headers=headers_s1)
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["id"] == job2_id
        print("  -> Passed: 204 returned, status is False, removed from list")

        # -----------------------------------------------------------------
        # TEST 12: Unsaving already unsaved / non-saved job returns 404
        # -----------------------------------------------------------------
        print("\n[Test 12] Unsaving job not saved returns 404 Not Found")
        res = client.delete(f"/api/v1/jobs/{job1_id}/save", headers=headers_s1)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        assert "not found" in res.json()["detail"].lower()

        # Student 2 tries to unsave Job 2 (which only Student 1 saved) -> 404
        res = client.delete(f"/api/v1/jobs/{job2_id}/save", headers=headers_s2)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        print("  -> Passed: 404 returned when unsaving non-saved job")

        # -----------------------------------------------------------------
        # TEST 13: RBAC - Recruiter blocked from all 4 endpoints (403)
        # -----------------------------------------------------------------
        print("\n[Test 13] Recruiter blocked with 403 Forbidden")
        res = client.post(f"/api/v1/jobs/{job2_id}/save", headers=headers_r)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        res = client.get(f"/api/v1/jobs/{job2_id}/saved", headers=headers_r)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        res = client.delete(f"/api/v1/jobs/{job2_id}/save", headers=headers_r)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        res = client.get("/api/v1/saved-jobs", headers=headers_r)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  -> Passed: Recruiter received 403 on all saved-job routes")

        # -----------------------------------------------------------------
        # TEST 14: RBAC - Admin blocked from student-only endpoints (403)
        # -----------------------------------------------------------------
        print("\n[Test 14] Admin blocked with 403 Forbidden")
        res = client.post(f"/api/v1/jobs/{job2_id}/save", headers=headers_admin)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        res = client.get(f"/api/v1/jobs/{job2_id}/saved", headers=headers_admin)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        res = client.delete(f"/api/v1/jobs/{job2_id}/save", headers=headers_admin)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        res = client.get("/api/v1/saved-jobs", headers=headers_admin)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  -> Passed: Admin received 403 on student-only saved-job routes")

        # -----------------------------------------------------------------
        # TEST 15: Unauthenticated requests return 401 Unauthorized
        # -----------------------------------------------------------------
        print("\n[Test 15] Unauthenticated requests return 401 Unauthorized")
        res = client.post(f"/api/v1/jobs/{job2_id}/save")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        res = client.get(f"/api/v1/jobs/{job2_id}/saved")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        res = client.delete(f"/api/v1/jobs/{job2_id}/save")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        res = client.get("/api/v1/saved-jobs")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  -> Passed: 401 Unauthorized on unauthenticated requests")

        # -----------------------------------------------------------------
        # TEST 16: Inactive student rejected with 401 Unauthorized
        # -----------------------------------------------------------------
        print("\n[Test 16] Inactive student rejected with 401 Unauthorized")
        res = client.post(f"/api/v1/jobs/{job2_id}/save", headers=headers_inactive)
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        res = client.get("/api/v1/saved-jobs", headers=headers_inactive)
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  -> Passed: Inactive student rejected with 401")

        # -----------------------------------------------------------------
        # TEST 17: Client-supplied student_id in query/body is ignored
        # -----------------------------------------------------------------
        print("\n[Test 17] Spoofed student_id in query is ignored")
        # Student 2 saves job 1 but passes ?student_id=<student1_id>
        res = client.post(
            f"/api/v1/jobs/{job1_id}/save?student_id={student1_id}",
            headers=headers_s2,
            json={"student_id": student1_id},
        )
        assert res.status_code == 201
        with SessionLocal() as db:
            row = db.scalar(
                select(SavedJob).where(
                    SavedJob.student_id == student2_id,
                    SavedJob.job_posting_id == job1_id,
                )
            )
            assert row is not None, "Job should be saved under Student 2, not Student 1"
            # Verify Student 1 still does not have job 1 saved
            s1_row = db.scalar(
                select(SavedJob).where(
                    SavedJob.student_id == student1_id,
                    SavedJob.job_posting_id == job1_id,
                )
            )
            assert s1_row is None, "Student 1's saved status should not be modified by spoofed query"
        print("  -> Passed: Spoofed student_id ignored, ownership strictly token-bound")

        # -----------------------------------------------------------------
        # TEST 18: Inactive job retention in saved list with is_active=False
        # -----------------------------------------------------------------
        print("\n[Test 18] Inactive job retention in saved list")
        # Deactivate job 2
        with SessionLocal() as db:
            j2 = db.scalar(select(JobPosting).where(JobPosting.id == job2_id))
            j2.is_active = False
            db.commit()

        # Student 1 fetches saved jobs: Job 2 was saved previously, should still appear but with is_active=False
        res = client.get("/api/v1/saved-jobs", headers=headers_s1)
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["id"] == job2_id
        assert items[0]["is_active"] is False
        print("  -> Passed: Saved job retained in list with is_active=False")

        # -----------------------------------------------------------------
        # TEST 19: Cascade deletion on Job deletion
        # -----------------------------------------------------------------
        print("\n[Test 19] Cascade deletion upon Job deletion")
        # Save job 4 for student 2
        res = client.post(f"/api/v1/jobs/{job4_id}/save", headers=headers_s2)
        assert res.status_code == 201

        with SessionLocal() as db:
            # Check row exists
            row = db.scalar(select(SavedJob).where(SavedJob.job_posting_id == job4_id))
            assert row is not None
            # Delete job 4
            j4 = db.scalar(select(JobPosting).where(JobPosting.id == job4_id))
            db.delete(j4)
            db.commit()

            # Confirm saved_jobs row was deleted by cascade
            row = db.scalar(select(SavedJob).where(SavedJob.job_posting_id == job4_id))
            assert row is None, "SavedJob record should be cascade deleted when JobPosting is deleted"
        print("  -> Passed: Cascade deletion on JobPosting delete verified")

        # -----------------------------------------------------------------
        # TEST 20: Cascade deletion on User deletion
        # -----------------------------------------------------------------
        print("\n[Test 20] Cascade deletion upon User deletion")
        with SessionLocal() as db:
            # Check student 2 has at least 1 saved job (job 1)
            count = len(db.scalars(select(SavedJob).where(SavedJob.student_id == student2_id)).all())
            assert count >= 1
            # Delete student 2
            s2_user = db.scalar(select(User).where(User.id == student2_id))
            db.delete(s2_user)
            db.commit()

            # Confirm saved_jobs rows for student 2 were deleted by cascade
            count_after = len(db.scalars(select(SavedJob).where(SavedJob.student_id == student2_id)).all())
            assert count_after == 0, "All saved_jobs rows for deleted user should be deleted"
        print("  -> Passed: Cascade deletion on User delete verified")

        print("\n=========================================================")
        print("ALL 20 PHASE 15 SAVED JOBS TESTS COMPLETED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_saved_jobs_tests()
