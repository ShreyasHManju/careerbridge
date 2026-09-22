"""
CareerBridge Phase 30B Workflows Test Suite
Verifies:
1. Batch applicant status operations (atomic updates, strict ownership check across all IDs, 403 IDOR rejection, 404 missing, 422 empty).
2. Data export functionality (recruiter applications CSV, recruiter interviews CSV, admin users CSV, formula injection sanitization, role enforcement).
3. Notification digest & delivery preferences (default retrieval, update frequency, email toggles, user isolation).
"""

from datetime import datetime, timezone
import io
import csv
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.core.database import Base, SessionLocal, engine
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.interview import Interview, InterviewStatus, InterviewType
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.notification_preference import NotificationFrequency, NotificationPreference
from app.models.user import User, UserRole
from app.services.export_service import sanitize_csv_cell


TEST_EMAILS = [
    "p30b_recruiter1@example.com",
    "p30b_recruiter2@example.com",
    "p30b_student1@example.com",
    "p30b_student2@example.com",
    "p30b_admin@example.com",
]


def cleanup_test_data():
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.email.in_(TEST_EMAILS))).all()
        for u in users:
            db.delete(u)
        db.commit()


def test_phase30b_workflows():
    print("===========================================================================")
    print("CAREERBRIDGE PHASE 30B WORKFLOWS & ADVANCED CAPABILITIES TEST SUITE")
    print("===========================================================================")

    cleanup_test_data()
    client = TestClient(app)
    db = SessionLocal()

    try:
        # ----------------------------------------------------------------------
        # Setup Test Users
        # ----------------------------------------------------------------------
        # Recruiter 1
        recruiter1 = db.scalar(select(User).where(User.email == "p30b_recruiter1@example.com"))
        if not recruiter1:
            recruiter1 = User(
                email="p30b_recruiter1@example.com",
                password_hash=hash_password("Password123!"),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
            db.add(recruiter1)
            db.commit()
            db.refresh(recruiter1)

        # Recruiter 2
        recruiter2 = db.scalar(select(User).where(User.email == "p30b_recruiter2@example.com"))
        if not recruiter2:
            recruiter2 = User(
                email="p30b_recruiter2@example.com",
                password_hash=hash_password("Password123!"),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
            db.add(recruiter2)
            db.commit()
            db.refresh(recruiter2)

        # Student 1
        student1 = db.scalar(select(User).where(User.email == "p30b_student1@example.com"))
        if not student1:
            student1 = User(
                email="p30b_student1@example.com",
                password_hash=hash_password("Password123!"),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            db.add(student1)
            db.commit()
            db.refresh(student1)

        # Student 2
        student2 = db.scalar(select(User).where(User.email == "p30b_student2@example.com"))
        if not student2:
            student2 = User(
                email="p30b_student2@example.com",
                password_hash=hash_password("Password123!"),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            db.add(student2)
            db.commit()
            db.refresh(student2)

        # Admin
        admin_user = db.scalar(select(User).where(User.email == "p30b_admin@example.com"))
        if not admin_user:
            admin_user = User(
                email="p30b_admin@example.com",
                password_hash=hash_password("Password123!"),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        # Job Postings
        job_r1 = db.scalar(select(JobPosting).where(JobPosting.title == "P30B Cloud Engineer"))
        if not job_r1:
            job_r1 = JobPosting(
                recruiter_id=recruiter1.id,
                title="P30B Cloud Engineer",
                company_name="Acme Cloud Corp",
                description="Manage distributed systems and Kubernetes infrastructure.",
                skills="Python, Go, AWS or GCP",
                opportunity_type=OpportunityType.JOB,
                employment_type=EmploymentType.FULL_TIME,
                is_active=True,
            )
            db.add(job_r1)
            db.commit()
            db.refresh(job_r1)

        job_r2 = db.scalar(select(JobPosting).where(JobPosting.title == "P30B Security Analyst"))
        if not job_r2:
            job_r2 = JobPosting(
                recruiter_id=recruiter2.id,
                title="P30B Security Analyst",
                company_name="CyberGuard Inc",
                description="Threat modeling and security auditing.",
                skills="Network security, cryptography",
                opportunity_type=OpportunityType.JOB,
                employment_type=EmploymentType.FULL_TIME,
                is_active=True,
            )
            db.add(job_r2)
            db.commit()
            db.refresh(job_r2)

        # Applications
        # App 1: Student 1 -> Job R1
        app1 = db.scalar(
            select(Application).where(
                Application.job_posting_id == job_r1.id,
                Application.student_id == student1.id,
            )
        )
        if not app1:
            app1 = Application(
                job_posting_id=job_r1.id,
                student_id=student1.id,
                status=ApplicationStatus.APPLIED,
                cover_message="=SUM(1+1) Testing formula injection",
            )
            db.add(app1)
        else:
            app1.status = ApplicationStatus.APPLIED
            app1.cover_message = "=SUM(1+1) Testing formula injection"

        # App 2: Student 2 -> Job R1
        app2 = db.scalar(
            select(Application).where(
                Application.job_posting_id == job_r1.id,
                Application.student_id == student2.id,
            )
        )
        if not app2:
            app2 = Application(
                job_posting_id=job_r1.id,
                student_id=student2.id,
                status=ApplicationStatus.APPLIED,
                cover_message="Passionate about cloud systems.",
            )
            db.add(app2)
        else:
            app2.status = ApplicationStatus.APPLIED

        # App 3: Student 1 -> Job R2 (owned by Recruiter 2)
        app3 = db.scalar(
            select(Application).where(
                Application.job_posting_id == job_r2.id,
                Application.student_id == student1.id,
            )
        )
        if not app3:
            app3 = Application(
                job_posting_id=job_r2.id,
                student_id=student1.id,
                status=ApplicationStatus.APPLIED,
                cover_message="Security research background.",
            )
            db.add(app3)
        else:
            app3.status = ApplicationStatus.APPLIED

        db.commit()
        db.refresh(app1)
        db.refresh(app2)
        db.refresh(app3)

        # Scheduled Interview for Recruiter 1
        itv1 = db.scalar(select(Interview).where(Interview.application_id == app1.id))
        if not itv1:
            itv1 = Interview(
                application_id=app1.id,
                recruiter_id=recruiter1.id,
                student_id=student1.id,
                scheduled_at=datetime.now(timezone.utc),
                duration_minutes=45,
                interview_type=InterviewType.ONLINE,
                location_or_link="+cmd|' /C calc'!A0",
                notes="Technical architecture interview.",
                status=InterviewStatus.SCHEDULED,
            )
            db.add(itv1)
            db.commit()
            db.refresh(itv1)

        # Generate tokens
        token_r1 = create_access_token(recruiter1.id)
        token_r2 = create_access_token(recruiter2.id)
        token_s1 = create_access_token(student1.id)
        token_admin = create_access_token(admin_user.id)

        headers_r1 = {"Authorization": f"Bearer {token_r1}"}
        headers_r2 = {"Authorization": f"Bearer {token_r2}"}
        headers_s1 = {"Authorization": f"Bearer {token_s1}"}
        headers_admin = {"Authorization": f"Bearer {token_admin}"}

        # ----------------------------------------------------------------------
        # TEST GROUP 1: Batch Applicant Operations
        # ----------------------------------------------------------------------
        print("\n[Group 1] Testing Batch Applicant Operations...")

        # 1.1 Empty application IDs list should return 422
        resp = client.post(
            "/api/v1/applications/bulk-status",
            json={"application_ids": [], "status": "reviewing"},
            headers=headers_r1,
        )
        assert resp.status_code == 422, f"Expected 422 for empty list, got {resp.status_code}"
        print("  -> 1.1 Empty application IDs list properly rejected with 422.")

        # 1.2 Invalid status should return 422
        resp = client.post(
            "/api/v1/applications/bulk-status",
            json={"application_ids": [app1.id, app2.id], "status": "invalid_status"},
            headers=headers_r1,
        )
        assert resp.status_code == 422, f"Expected 422 for invalid status, got {resp.status_code}"
        print("  -> 1.2 Invalid application status rejected with 422.")

        # 1.3 Missing application ID should return 404
        resp = client.post(
            "/api/v1/applications/bulk-status",
            json={"application_ids": [app1.id, 999999], "status": "reviewing"},
            headers=headers_r1,
        )
        assert resp.status_code == 404, f"Expected 404 for non-existent ID, got {resp.status_code}"
        print("  -> 1.3 Non-existent application in batch safely rejected with 404.")

        # 1.4 Mixed ownership batch (IDOR protection) -> 403 Forbidden
        resp = client.post(
            "/api/v1/applications/bulk-status",
            json={"application_ids": [app1.id, app3.id], "status": "shortlisted"},
            headers=headers_r1,
        )
        assert resp.status_code == 403, f"Expected 403 for unauthorized app in batch, got {resp.status_code}"
        print("  -> 1.4 Cross-recruiter IDOR in batch safely rejected with 403.")

        # Confirm app1 was NOT modified during failed batch (transactional safety)
        db.expire_all()
        check_app1 = db.scalar(select(Application).where(Application.id == app1.id))
        assert check_app1.status == ApplicationStatus.APPLIED, "Failed batch modified application state!"
        print("  -> 1.5 Transactional rollback on batch failure verified.")

        # 1.6 Student role forbidden -> 403 Forbidden
        resp = client.post(
            "/api/v1/applications/bulk-status",
            json={"application_ids": [app1.id], "status": "shortlisted"},
            headers=headers_s1,
        )
        assert resp.status_code == 403, f"Expected 403 for student role, got {resp.status_code}"
        print("  -> 1.6 Student role forbidden from bulk operations with 403.")

        # 1.7 Successful batch update for owned applications -> 200 OK
        resp = client.post(
            "/api/v1/applications/bulk-status",
            json={"application_ids": [app1.id, app2.id], "status": "reviewing"},
            headers=headers_r1,
        )
        assert resp.status_code == 200, f"Expected 200 for valid batch update, got {resp.status_code}"
        data = resp.json()
        assert data["updated_count"] == 2, f"Expected 2 updated, got {data['updated_count']}"
        assert data["status"] == "reviewing"
        assert len(data["items"]) == 2
        print("  -> 1.7 Valid batch update succeeded and returned updated objects.")

        # ----------------------------------------------------------------------
        # TEST GROUP 2: CSV Data Export
        # ----------------------------------------------------------------------
        print("\n[Group 2] Testing CSV Data Export & Formula Injection Sanitization...")

        # 2.1 Formula injection sanitization unit test
        assert sanitize_csv_cell("=SUM(1,2)") == "'=SUM(1,2)"
        assert sanitize_csv_cell("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
        assert sanitize_csv_cell("-123") == "'-123"
        assert sanitize_csv_cell("@calc") == "'@calc"
        assert sanitize_csv_cell("Normal Text") == "Normal Text"
        print("  -> 2.1 Cell sanitizer neutralizes all spreadsheet formula triggers.")

        # 2.2 Recruiter applications CSV export
        resp = client.get("/api/v1/recruiter/applications/export", headers=headers_r1)
        assert resp.status_code == 200, f"Expected 200 for recruiter apps export, got {resp.status_code}"
        assert "text/csv" in resp.headers.get("content-type", "")
        csv_reader = csv.DictReader(io.StringIO(resp.text))
        rows = list(csv_reader)
        assert len(rows) >= 2
        # Check that formula in app1 cover_message was safely sanitized
        row1 = next(r for r in rows if r["application_id"] == str(app1.id))
        assert row1["cover_message"].startswith("'="), f"Formula injection was not sanitized: {row1['cover_message']}"
        # Recruiter 2's app3 must NOT be present in Recruiter 1's export
        assert not any(r["application_id"] == str(app3.id) for r in rows)
        print("  -> 2.2 Recruiter applications CSV exported with formula protection and role isolation.")

        # 2.3 Recruiter interviews CSV export
        resp = client.get("/api/v1/recruiter/interviews/export", headers=headers_r1)
        assert resp.status_code == 200, f"Expected 200 for interviews export, got {resp.status_code}"
        itv_reader = csv.DictReader(io.StringIO(resp.text))
        itv_rows = list(itv_reader)
        assert len(itv_rows) >= 1
        itv_row = next(r for r in itv_rows if r["interview_id"] == str(itv1.id))
        assert itv_row["location_or_link"].startswith("'+"), f"Formula injection not sanitized: {itv_row['location_or_link']}"
        print("  -> 2.3 Recruiter interviews CSV exported with formula protection.")

        # 2.4 Admin users CSV export
        resp = client.get("/api/v1/admin/users/export", headers=headers_admin)
        assert resp.status_code == 200, f"Expected 200 for admin users export, got {resp.status_code}"
        admin_reader = csv.DictReader(io.StringIO(resp.text))
        admin_rows = list(admin_reader)
        assert len(admin_rows) >= 3
        # Must NOT contain password_hash or secret tokens
        for r in admin_rows:
            assert "password_hash" not in r
            assert "token" not in r
        print("  -> 2.4 Admin users CSV exported without sensitive credentials.")

        # 2.5 Student role forbidden from export endpoints -> 403 Forbidden
        resp = client.get("/api/v1/recruiter/applications/export", headers=headers_s1)
        assert resp.status_code == 403, f"Expected 403 for student apps export, got {resp.status_code}"
        resp = client.get("/api/v1/recruiter/interviews/export", headers=headers_s1)
        assert resp.status_code == 403, f"Expected 403 for student interviews export, got {resp.status_code}"
        resp = client.get("/api/v1/admin/users/export", headers=headers_s1)
        assert resp.status_code == 403, f"Expected 403 for student admin export, got {resp.status_code}"
        print("  -> 2.5 Students properly denied from recruiter and admin exports with 403.")

        # ----------------------------------------------------------------------
        # TEST GROUP 3: Notification Preferences
        # ----------------------------------------------------------------------
        print("\n[Group 3] Testing Notification Digest Preferences...")

        # 3.1 Get preferences defaults to instant
        resp = client.get("/api/v1/notifications/preferences", headers=headers_s1)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        pref_data = resp.json()
        assert pref_data["frequency"] == "instant"
        assert pref_data["email_notifications"] is True
        print("  -> 3.1 Default notification preferences returned (instant delivery).")

        # 3.2 Update preferences to digest
        resp = client.patch(
            "/api/v1/notifications/preferences",
            json={"frequency": "digest", "email_notifications": False},
            headers=headers_s1,
        )
        assert resp.status_code == 200, f"Expected 200 for update, got {resp.status_code}"
        updated_data = resp.json()
        assert updated_data["frequency"] == "digest"
        assert updated_data["email_notifications"] is False
        assert updated_data["id"] is not None
        print("  -> 3.2 Successfully updated preferences to digest mode.")

        # 3.3 Verify updated preferences persist
        resp = client.get("/api/v1/notifications/preferences", headers=headers_s1)
        assert resp.status_code == 200
        persisted = resp.json()
        assert persisted["frequency"] == "digest"
        assert persisted["email_notifications"] is False
        print("  -> 3.3 Updated preferences persisted in database.")

        # 3.4 Verify user isolation (Recruiter 1 still has default preferences)
        resp = client.get("/api/v1/notifications/preferences", headers=headers_r1)
        assert resp.status_code == 200
        r1_pref = resp.json()
        assert r1_pref["frequency"] == "instant"
        print("  -> 3.4 Notification preferences isolated per user.")

        # 3.5 Invalid frequency rejected with 422
        resp = client.patch(
            "/api/v1/notifications/preferences",
            json={"frequency": "hourly_invalid"},
            headers=headers_s1,
        )
        assert resp.status_code == 422, f"Expected 422 for invalid frequency, got {resp.status_code}"
        print("  -> 3.5 Invalid frequency rejected with 422.")

        # 3.6 Unauthenticated access rejected with 401
        resp = client.get("/api/v1/notifications/preferences")
        assert resp.status_code == 401, f"Expected 401 for unauthenticated request, got {resp.status_code}"
        print("  -> 3.6 Unauthenticated preferences request rejected with 401.")

        print("\n===========================================================")
        print("ALL PHASE 30B WORKFLOW TESTS PASSED 100% SUCCESSFULLY!")
        print("===========================================================\n")

    finally:
        db.close()
        cleanup_test_data()


if __name__ == "__main__":
    test_phase30b_workflows()
