"""
CareerBridge Phase 10 Job / Internship Posting Test Suite
Tests JobPosting model, schemas, enums, API routes (/api/v1/jobs, /jobs/my, /jobs/{id}),
recruiter ownership enforcement, candidate discovery, inactive hiding, validation rules,
and security boundaries.
"""

from datetime import datetime, timedelta, timezone
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
from app.models.user import User, UserRole

client = TestClient(app)

RECRUITER1_EMAIL = "job.recruiter1@careerbridge.io"
RECRUITER2_EMAIL = "job.recruiter2@careerbridge.io"
STUDENT_EMAIL = "job.student@careerbridge.io"
ADMIN_EMAIL = "job.admin@careerbridge.io"
TEST_PASSWORD = "JobTestPassword123!"


def cleanup_test_data():
    """Remove test users and their cascading job postings."""
    with SessionLocal() as db:
        test_emails = [
            RECRUITER1_EMAIL,
            RECRUITER2_EMAIL,
            STUDENT_EMAIL,
            ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def run_job_posting_tests():
    print("\n=========================================================")
    print("STARTING PHASE 10 JOB POSTING TEST SUITE...")
    print("=========================================================\n")

    cleanup_test_data()

    recruiter1_id = None
    recruiter2_id = None
    student_id = None
    admin_id = None

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
            db.add_all([r1, r2, student, admin])
            db.commit()
            db.refresh(r1)
            db.refresh(r2)
            db.refresh(student)
            db.refresh(admin)

            recruiter1_id = r1.id
            recruiter2_id = r2.id
            student_id = student.id
            admin_id = admin.id

        # Generate tokens
        token_r1 = create_access_token(subject=recruiter1_id)
        token_r2 = create_access_token(subject=recruiter2_id)
        token_student = create_access_token(subject=student_id)
        token_admin = create_access_token(subject=admin_id)

        headers_r1 = {"Authorization": f"Bearer {token_r1}"}
        headers_r2 = {"Authorization": f"Bearer {token_r2}"}
        headers_student = {"Authorization": f"Bearer {token_student}"}
        headers_admin = {"Authorization": f"Bearer {token_admin}"}

        valid_posting_payload = {
            "title": "Backend Engineering Intern",
            "description": "Join our distributed cloud backend team building high-performance APIs.",
            "opportunity_type": "internship",
            "company_name": "Acme Cloud Corp",
            "location": "San Francisco, CA",
            "is_remote": True,
            "employment_type": "full_time",
            "skills": "Python, FastAPI, PostgreSQL",
            "minimum_qualification": "Pursuing B.S. or M.S. in Computer Science",
            "experience_required": "0-1 years",
            "salary_min": 60000,
            "salary_max": 80000,
            "application_deadline": (
                datetime.now(timezone.utc) + timedelta(days=30)
            ).isoformat(),
            "is_active": True,
        }

        # TEST 1: Recruiter can create a posting (201)
        print("[Test 1/20] Recruiter can create a job posting (201)...")
        r = client.post("/api/v1/jobs", json=valid_posting_payload, headers=headers_r1)
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        job1_data = r.json()
        job1_id = job1_data["id"]
        assert job1_data["title"] == "Backend Engineering Intern"
        assert job1_data["opportunity_type"] == "internship"
        assert job1_data["employment_type"] == "full_time"
        print(f"  -> Passed: Job posting #{job1_id} created successfully with 201.")

        # TEST 2: Student cannot create a posting (403)
        print("[Test 2/20] Student cannot create a posting (403)...")
        r_student = client.post(
            "/api/v1/jobs", json=valid_posting_payload, headers=headers_student
        )
        assert r_student.status_code == 403, f"Expected 403, got {r_student.status_code}"
        print("  -> Passed: Student blocked from creating posting with 403 Forbidden.")

        # TEST 3: Unauthenticated user cannot create a posting (401)
        print("[Test 3/20] Unauthenticated user cannot create a posting (401)...")
        r_unauth = client.post("/api/v1/jobs", json=valid_posting_payload)
        assert r_unauth.status_code == 401, f"Expected 401, got {r_unauth.status_code}"
        print("  -> Passed: Unauthenticated request rejected with 401 Unauthorized.")

        # TEST 4: Recruiter can list their own postings (/jobs/my)
        print("[Test 4/20] Recruiter can list their own postings (/jobs/my)...")
        r_my = client.get("/api/v1/jobs/my", headers=headers_r1)
        assert r_my.status_code == 200, f"Expected 200, got {r_my.status_code}"
        my_postings = r_my.json()
        assert len(my_postings) >= 1
        assert any(p["id"] == job1_id for p in my_postings)
        assert all(p["recruiter_id"] == recruiter1_id for p in my_postings)
        print("  -> Passed: Recruiter retrieved own postings.")

        # TEST 5: Recruiter 2 cannot modify Recruiter 1's posting (403)
        print("[Test 5/20] Recruiter 2 cannot modify Recruiter 1's posting (403)...")
        r_mod = client.patch(
            f"/api/v1/jobs/{job1_id}",
            json={"title": "Malicious Modification"},
            headers=headers_r2,
        )
        assert r_mod.status_code == 403, f"Expected 403, got {r_mod.status_code}"
        print("  -> Passed: Cross-recruiter modification blocked with 403 Forbidden.")

        # TEST 6: Recruiter 2 cannot delete Recruiter 1's posting (403)
        print("[Test 6/20] Recruiter 2 cannot delete Recruiter 1's posting (403)...")
        r_del = client.delete(f"/api/v1/jobs/{job1_id}", headers=headers_r2)
        assert r_del.status_code == 403, f"Expected 403, got {r_del.status_code}"
        print("  -> Passed: Cross-recruiter deletion blocked with 403 Forbidden.")

        # TEST 7: Recruiter can update their own posting (200)
        print("[Test 7/20] Recruiter can update their own posting (200)...")
        update_payload = {
            "title": "Senior Backend Engineering Intern",
            "salary_min": 70000,
            "salary_max": 90000,
        }
        r_update = client.patch(
            f"/api/v1/jobs/{job1_id}", json=update_payload, headers=headers_r1
        )
        assert r_update.status_code == 200, f"Expected 200, got {r_update.status_code}"
        updated_data = r_update.json()
        assert updated_data["title"] == "Senior Backend Engineering Intern"
        assert updated_data["salary_min"] == 70000
        assert updated_data["salary_max"] == 90000
        assert updated_data["recruiter_id"] == recruiter1_id
        print("  -> Passed: Recruiter successfully updated own posting.")

        # Create a second inactive job posting by Recruiter 1
        inactive_payload = {
            "title": "Draft Inactive Role",
            "description": "Not yet ready to be published to candidates.",
            "opportunity_type": "job",
            "company_name": "Acme Cloud Corp",
            "employment_type": "contract",
            "is_active": False,
        }
        r_inact = client.post(
            "/api/v1/jobs", json=inactive_payload, headers=headers_r1
        )
        assert r_inact.status_code == 201
        inactive_job_id = r_inact.json()["id"]

        # TEST 8: Student can list active postings (/jobs)
        print("[Test 8/20] Student can list active postings (/jobs)...")
        r_browse = client.get("/api/v1/jobs", headers=headers_student)
        assert r_browse.status_code == 200
        browse_res = r_browse.json()
        browse_list = browse_res["items"] if isinstance(browse_res, dict) and "items" in browse_res else browse_res
        assert any(p["id"] == job1_id for p in browse_list)
        print("  -> Passed: Active posting present in candidate discovery list.")

        # TEST 9: Inactive postings are hidden from student listings
        print("[Test 9/20] Inactive postings hidden from student listings...")
        assert not any(p["id"] == inactive_job_id for p in browse_list), (
            "Inactive posting leaked in student listing!"
        )
        print("  -> Passed: Inactive posting is omitted from candidate discovery list.")

        # TEST 10: Student can retrieve an active posting by ID (200)
        print("[Test 10/20] Student can retrieve an active posting by ID (200)...")
        r_get = client.get(f"/api/v1/jobs/{job1_id}", headers=headers_student)
        assert r_get.status_code == 200
        assert r_get.json()["id"] == job1_id
        print("  -> Passed: Student retrieved active posting.")

        # TEST 11: Inactive posting returns 404 to students on single get
        print("[Test 11/20] Inactive posting returns 404 to students on single GET...")
        r_get_inact = client.get(
            f"/api/v1/jobs/{inactive_job_id}", headers=headers_student
        )
        assert r_get_inact.status_code == 404, f"Expected 404, got {r_get_inact.status_code}"
        print("  -> Passed: Inactive posting hidden with 404 from students.")

        # TEST 12: Recruiter can retrieve their own inactive posting on single GET (200)
        print("[Test 12/20] Recruiter can retrieve own inactive posting (200)...")
        r_rec_inact = client.get(
            f"/api/v1/jobs/{inactive_job_id}", headers=headers_r1
        )
        assert r_rec_inact.status_code == 200
        assert r_rec_inact.json()["id"] == inactive_job_id
        print("  -> Passed: Owning recruiter can access their own inactive posting.")

        # TEST 13: Nonexistent posting returns 404
        print("[Test 13/20] Nonexistent posting returns 404...")
        r_none = client.get("/api/v1/jobs/999999", headers=headers_r1)
        assert r_none.status_code == 404
        print("  -> Passed: Nonexistent posting returns 404.")

        # TEST 14: Invalid opportunity_type returns 422
        print("[Test 14/20] Invalid opportunity_type returns 422...")
        bad_opp = valid_posting_payload.copy()
        bad_opp["opportunity_type"] = "freelance_gig"
        r_bad_opp = client.post("/api/v1/jobs", json=bad_opp, headers=headers_r1)
        assert r_bad_opp.status_code == 422
        print("  -> Passed: Invalid opportunity_type rejected with 422.")

        # TEST 15: Invalid employment_type returns 422
        print("[Test 15/20] Invalid employment_type returns 422...")
        bad_emp = valid_posting_payload.copy()
        bad_emp["employment_type"] = "hourly_volunteer"
        r_bad_emp = client.post("/api/v1/jobs", json=bad_emp, headers=headers_r1)
        assert r_bad_emp.status_code == 422
        print("  -> Passed: Invalid employment_type rejected with 422.")

        # TEST 16: Negative salary is rejected (422)
        print("[Test 16/20] Negative salary is rejected (422)...")
        bad_sal = valid_posting_payload.copy()
        bad_sal["salary_min"] = -500
        r_bad_sal = client.post("/api/v1/jobs", json=bad_sal, headers=headers_r1)
        assert r_bad_sal.status_code == 422
        print("  -> Passed: Negative salary rejected with 422.")

        # TEST 17: salary_max < salary_min is rejected (422)
        print("[Test 17/20] salary_max < salary_min is rejected (422)...")
        inverted_sal = valid_posting_payload.copy()
        inverted_sal["salary_min"] = 100000
        inverted_sal["salary_max"] = 50000
        r_inv = client.post("/api/v1/jobs", json=inverted_sal, headers=headers_r1)
        assert r_inv.status_code == 422
        print("  -> Passed: Inverted salary range rejected with 422.")

        # TEST 18: Ownership is derived from authenticated user (cannot spoof recruiter_id)
        print("[Test 18/20] Ownership derived from authenticated user (spoofing blocked)...")
        spoofed_payload = valid_posting_payload.copy()
        spoofed_payload["recruiter_id"] = recruiter2_id  # Attempting to assign Recruiter 2
        r_spoof = client.post(
            "/api/v1/jobs", json=spoofed_payload, headers=headers_r1
        )
        assert r_spoof.status_code == 201
        spoofed_res = r_spoof.json()
        assert spoofed_res["recruiter_id"] == recruiter1_id, (
            f"recruiter_id was spoofed! Expected {recruiter1_id}, got {spoofed_res['recruiter_id']}"
        )
        print("  -> Passed: Spoofed recruiter_id ignored; derived strictly from current_user.id.")

        # TEST 19: PATCH cannot modify recruiter_id
        print("[Test 19/20] PATCH cannot modify recruiter_id...")
        r_patch_spoof = client.patch(
            f"/api/v1/jobs/{job1_id}",
            json={"recruiter_id": recruiter2_id, "location": "Boston, MA"},
            headers=headers_r1,
        )
        assert r_patch_spoof.status_code == 200
        assert r_patch_spoof.json()["recruiter_id"] == recruiter1_id
        assert r_patch_spoof.json()["location"] == "Boston, MA"
        print("  -> Passed: recruiter_id remains immutable on PATCH.")

        # TEST 20: Recruiter can delete their own posting (204)
        print("[Test 20/20] Recruiter can delete their own posting (204)...")
        r_del_ok = client.delete(f"/api/v1/jobs/{job1_id}", headers=headers_r1)
        assert r_del_ok.status_code == 204
        # Verify it no longer exists
        r_del_check = client.get(f"/api/v1/jobs/{job1_id}", headers=headers_r1)
        assert r_del_check.status_code == 404
        print("  -> Passed: Job posting deleted with 204 and no longer retrievable.")

        print("\n=========================================================")
        print("ALL 20 JOB POSTING TEST CASES PASSED SUCCESSFULLY!")
        print("=========================================================\n")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_job_posting_tests()
