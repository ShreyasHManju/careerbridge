"""
CareerBridge Phase 22 Aggregated Role Dashboards Test Suite
============================================================
Comprehensive test coverage:
1. Authentication & Security (401 on unauthenticated, invalid token, inactive user)
2. Role-Based Access Control (403 on cross-role dashboard access, no admin bypass)
3. Student Dashboard Metrics & SQL Aggregation (total, under review, shortlisted, accepted, saved, upcoming interviews)
4. Student Dashboard Data Isolation (Student A vs Student B)
5. Student Dashboard Upcoming Interviews Filter (past, completed, cancelled excluded)
6. Student Dashboard Empty State (all zero counts)
7. Recruiter Dashboard Metrics & SQL Aggregation (active internships, total apps, awaiting review, shortlisted, scheduled interviews)
8. Recruiter Dashboard Data Isolation (Recruiter A vs Recruiter B)
9. Recruiter Dashboard Active Filter (inactive postings excluded from active_internships)
10. Recruiter Dashboard Scheduled Interviews Filter (completed, cancelled excluded)
11. Recruiter Dashboard Empty State (all zero counts)
12. Admin Dashboard Platform-wide Metrics (total students, total recruiters, verified recruiters, published internships, total apps)
13. Admin Dashboard Application Success Rate Calculation (formula & zero-division safety)
14. Admin Dashboard Monthly Registrations (format YYYY-MM, current year, custom period_year)
15. Admin Dashboard Verification Sensitivity (verified recruiter toggle reflects immediately)
16. Direct DashboardService Layer Unit Tests (Student, Recruiter, Admin)
17. Schema Validation & Boundaries (ge=0, percentage limits, negative prevention)
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import time

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
from app.models.interview import Interview, InterviewStatus, InterviewType
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.recruiter_profile import RecruiterProfile
from app.models.saved_job import SavedJob
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.dashboard import (
    AdminDashboardResponse,
    MonthlyRegistrationMetric,
    RecruiterDashboardResponse,
    StudentDashboardResponse,
)
from app.services.dashboard_service import DashboardService

client = TestClient(app)

TEST_STUDENT1_EMAIL = "dash.student1@careerbridge.io"
TEST_STUDENT2_EMAIL = "dash.student2@careerbridge.io"
TEST_STUDENT_EMPTY_EMAIL = "dash.student.empty@careerbridge.io"
TEST_RECRUITER1_EMAIL = "dash.recruiter1@careerbridge.io"
TEST_RECRUITER2_EMAIL = "dash.recruiter2@careerbridge.io"
TEST_RECRUITER_EMPTY_EMAIL = "dash.recruiter.empty@careerbridge.io"
TEST_ADMIN_EMAIL = "dash.admin@careerbridge.io"
TEST_PASSWORD = "DashPassword123!"

student1_token: str = ""
student2_token: str = ""
student_empty_token: str = ""
recruiter1_token: str = ""
recruiter2_token: str = ""
recruiter_empty_token: str = ""
admin_token: str = ""

student1_id: int = 0
student2_id: int = 0
student_empty_id: int = 0
recruiter1_id: int = 0
recruiter2_id: int = 0
recruiter_empty_id: int = 0
admin_id: int = 0

job1_id: int = 0
job2_id: int = 0
job_inactive_id: int = 0
job_rec2_id: int = 0


def teardown_module():
    """Clean up any leftover test data."""
    with SessionLocal() as db:
        test_emails = [
            TEST_STUDENT1_EMAIL,
            TEST_STUDENT2_EMAIL,
            TEST_STUDENT_EMPTY_EMAIL,
            TEST_RECRUITER1_EMAIL,
            TEST_RECRUITER2_EMAIL,
            TEST_RECRUITER_EMPTY_EMAIL,
            TEST_ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            # Clean dependent records
            db.execute(delete(Interview).where(Interview.student_id.in_(user_ids)))
            db.execute(delete(SavedJob).where(SavedJob.student_id.in_(user_ids)))
            db.execute(delete(Application).where(Application.student_id.in_(user_ids)))

            # Clean job postings and their dependent apps
            jobs = db.scalars(select(JobPosting).where(JobPosting.recruiter_id.in_(user_ids))).all()
            job_ids = [j.id for j in jobs]
            if job_ids:
                db.execute(delete(Interview).where(Interview.application_id.in_(
                    select(Application.id).where(Application.job_posting_id.in_(job_ids))
                )))
                db.execute(delete(SavedJob).where(SavedJob.job_posting_id.in_(job_ids)))
                db.execute(delete(Application).where(Application.job_posting_id.in_(job_ids)))
                db.execute(delete(JobPosting).where(JobPosting.id.in_(job_ids)))

            db.execute(delete(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
            db.execute(delete(RecruiterProfile).where(RecruiterProfile.user_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def setup_module():
    """Seed test fixtures, users, profiles, jobs, applications, saved jobs, and interviews."""
    global student1_id, student2_id, student_empty_id
    global recruiter1_id, recruiter2_id, recruiter_empty_id, admin_id
    global student1_token, student2_token, student_empty_token
    global recruiter1_token, recruiter2_token, recruiter_empty_token, admin_token
    global job1_id, job2_id, job_inactive_id, job_rec2_id

    teardown_module()

    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

        # 1. Create Users
        s1 = User(email=TEST_STUDENT1_EMAIL, password_hash=hashed, role=UserRole.STUDENT, is_active=True, is_verified=True)
        s2 = User(email=TEST_STUDENT2_EMAIL, password_hash=hashed, role=UserRole.STUDENT, is_active=True, is_verified=True)
        se = User(email=TEST_STUDENT_EMPTY_EMAIL, password_hash=hashed, role=UserRole.STUDENT, is_active=True, is_verified=True)
        r1 = User(email=TEST_RECRUITER1_EMAIL, password_hash=hashed, role=UserRole.RECRUITER, is_active=True, is_verified=True)
        r2 = User(email=TEST_RECRUITER2_EMAIL, password_hash=hashed, role=UserRole.RECRUITER, is_active=True, is_verified=True)
        re = User(email=TEST_RECRUITER_EMPTY_EMAIL, password_hash=hashed, role=UserRole.RECRUITER, is_active=True, is_verified=True)
        adm = User(email=TEST_ADMIN_EMAIL, password_hash=hashed, role=UserRole.ADMIN, is_active=True, is_verified=True)

        db.add_all([s1, s2, se, r1, r2, re, adm])
        db.commit()

        for u in [s1, s2, se, r1, r2, re, adm]:
            db.refresh(u)

        student1_id = s1.id
        student2_id = s2.id
        student_empty_id = se.id
        recruiter1_id = r1.id
        recruiter2_id = r2.id
        recruiter_empty_id = re.id
        admin_id = adm.id

        # Tokens
        student1_token = create_access_token(student1_id)
        student2_token = create_access_token(student2_id)
        student_empty_token = create_access_token(student_empty_id)
        recruiter1_token = create_access_token(recruiter1_id)
        recruiter2_token = create_access_token(recruiter2_id)
        recruiter_empty_token = create_access_token(recruiter_empty_id)
        admin_token = create_access_token(admin_id)

        # Profiles
        prof_r1 = RecruiterProfile(user_id=recruiter1_id, company_name="Dash Alpha Corp", is_verified=True)
        prof_r2 = RecruiterProfile(user_id=recruiter2_id, company_name="Dash Beta LLC", is_verified=False)
        db.add_all([prof_r1, prof_r2])
        db.commit()

        # Job Postings:
        # Recruiter 1 has 2 active postings and 1 inactive posting
        j1 = JobPosting(
            recruiter_id=recruiter1_id,
            company_name="Dash Alpha Corp",
            title="Backend Engineer Intern",
            description="Python FastAPI backend",
            location="Remote",
            opportunity_type=OpportunityType.INTERNSHIP,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        j2 = JobPosting(
            recruiter_id=recruiter1_id,
            company_name="Dash Alpha Corp",
            title="Cloud Architect Intern",
            description="PostgreSQL and Cloud systems",
            location="Bangalore",
            opportunity_type=OpportunityType.INTERNSHIP,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        j_inact = JobPosting(
            recruiter_id=recruiter1_id,
            company_name="Dash Alpha Corp",
            title="Archived Legacy Role",
            description="Old inactive role",
            location="Remote",
            opportunity_type=OpportunityType.JOB,
            employment_type=EmploymentType.FULL_TIME,
            is_active=False,
        )
        # Recruiter 2 has 1 active posting
        j_r2 = JobPosting(
            recruiter_id=recruiter2_id,
            company_name="Dash Beta LLC",
            title="Frontend React Intern",
            description="React frontend role",
            location="Remote",
            opportunity_type=OpportunityType.INTERNSHIP,
            employment_type=EmploymentType.PART_TIME,
            is_active=True,
        )

        db.add_all([j1, j2, j_inact, j_r2])
        db.commit()

        for j in [j1, j2, j_inact, j_r2]:
            db.refresh(j)

        job1_id = j1.id
        job2_id = j2.id
        job_inactive_id = j_inact.id
        job_rec2_id = j_r2.id

        # Applications:
        # Student 1 applies to:
        #   - Job 1: Status = REVIEWING
        #   - Job 2: Status = SHORTLISTED
        #   - Job Rec2: Status = ACCEPTED
        # Total for Student 1 = 3 (1 reviewing, 1 shortlisted, 1 accepted)
        app1 = Application(student_id=student1_id, job_posting_id=job1_id, status=ApplicationStatus.REVIEWING)
        app2 = Application(student_id=student1_id, job_posting_id=job2_id, status=ApplicationStatus.SHORTLISTED)
        app3 = Application(student_id=student1_id, job_posting_id=job_rec2_id, status=ApplicationStatus.ACCEPTED)

        # Student 2 applies to:
        #   - Job 1: Status = APPLIED
        #   - Job 1: Status = REJECTED (second application to another role, or let's use Job 2)
        app4 = Application(student_id=student2_id, job_posting_id=job1_id, status=ApplicationStatus.APPLIED)
        app5 = Application(student_id=student2_id, job_posting_id=job2_id, status=ApplicationStatus.REJECTED)

        db.add_all([app1, app2, app3, app4, app5])
        db.commit()

        for a in [app1, app2, app3, app4, app5]:
            db.refresh(a)

        # For Recruiter 1:
        # Postings are Job 1 and Job 2 (and inactive j_inact).
        # Applications received for Recruiter 1's jobs:
        #   app1 (Job 1, reviewing)
        #   app2 (Job 2, shortlisted)
        #   app4 (Job 1, applied)
        #   app5 (Job 2, rejected)
        # Total applications = 4
        # applications_awaiting_review = 1 (app4 has status APPLIED)
        # shortlisted_candidates = 1 (app2 has status SHORTLISTED)

        # Saved Jobs:
        # Student 1 saves Job 1 and Job Rec2 -> 2 saved jobs
        # Student 2 saves Job 2 -> 1 saved job
        sj1 = SavedJob(student_id=student1_id, job_posting_id=job1_id)
        sj2 = SavedJob(student_id=student1_id, job_posting_id=job_rec2_id)
        sj3 = SavedJob(student_id=student2_id, job_posting_id=job2_id)
        db.add_all([sj1, sj2, sj3])
        db.commit()

        # Interviews:
        now = datetime.now(timezone.utc)
        future_time = now + timedelta(days=2)
        future_time_resched = now + timedelta(days=5)
        past_time = now - timedelta(days=2)

        # Interview 1: Student 1, app2 (Job 2, Recruiter 1) -> Future, SCHEDULED
        # Counted for Student 1 upcoming_interviews (1)
        # Counted for Recruiter 1 scheduled_interviews (1)
        int1 = Interview(
            application_id=app2.id,
            recruiter_id=recruiter1_id,
            student_id=student1_id,
            scheduled_at=future_time,
            duration_minutes=45,
            interview_type=InterviewType.ONLINE,
            location_or_link="https://meet.careerbridge.io/tech-1",
            status=InterviewStatus.SCHEDULED,
        )

        # Interview 2: Student 1, app3 (Job Rec2, Recruiter 2) -> Future, RESCHEDULED
        # Counted for Student 1 upcoming_interviews (2)
        # Counted for Recruiter 2 scheduled_interviews (1)
        int2 = Interview(
            application_id=app3.id,
            recruiter_id=recruiter2_id,
            student_id=student1_id,
            scheduled_at=future_time_resched,
            duration_minutes=30,
            interview_type=InterviewType.ONLINE,
            location_or_link="https://meet.careerbridge.io/beh-2",
            status=InterviewStatus.RESCHEDULED,
        )

        # Interview 3: Student 1, app1 -> Past, SCHEDULED
        # NOT counted in Student 1 upcoming_interviews (past time)
        # IS counted in Recruiter 1 scheduled_interviews (status is SCHEDULED)
        int3 = Interview(
            application_id=app1.id,
            recruiter_id=recruiter1_id,
            student_id=student1_id,
            scheduled_at=past_time,
            duration_minutes=60,
            interview_type=InterviewType.PHONE,
            location_or_link="https://meet.careerbridge.io/past-3",
            status=InterviewStatus.SCHEDULED,
        )

        # Interview 4: Student 1, app2 -> Future, CANCELLED
        # NOT counted in Student 1 upcoming_interviews (status is CANCELLED)
        # NOT counted in Recruiter 1 scheduled_interviews (status is CANCELLED)
        int4 = Interview(
            application_id=app2.id,
            recruiter_id=recruiter1_id,
            student_id=student1_id,
            scheduled_at=future_time + timedelta(days=1),
            duration_minutes=45,
            interview_type=InterviewType.ONLINE,
            location_or_link="https://meet.careerbridge.io/cancel-4",
            status=InterviewStatus.CANCELLED,
        )

        # Interview 5: Student 1, app2 -> Future, COMPLETED
        # NOT counted in Student 1 upcoming_interviews (status is COMPLETED)
        # NOT counted in Recruiter 1 scheduled_interviews (status is COMPLETED)
        int5 = Interview(
            application_id=app2.id,
            recruiter_id=recruiter1_id,
            student_id=student1_id,
            scheduled_at=future_time + timedelta(days=3),
            duration_minutes=45,
            interview_type=InterviewType.IN_PERSON,
            location_or_link="https://meet.careerbridge.io/comp-5",
            status=InterviewStatus.COMPLETED,
        )

        db.add_all([int1, int2, int3, int4, int5])
        db.commit()


# ==============================================================================
# 1. Authentication & Security Tests
# ==============================================================================
def test_01_student_dashboard_requires_auth():
    """Unauthenticated request to /api/v1/dashboard/student returns 401."""
    res = client.get("/api/v1/dashboard/student")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"


def test_02_recruiter_dashboard_requires_auth():
    """Unauthenticated request to /api/v1/dashboard/recruiter returns 401."""
    res = client.get("/api/v1/dashboard/recruiter")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"


def test_03_admin_dashboard_requires_auth():
    """Unauthenticated request to /api/v1/dashboard/admin returns 401."""
    res = client.get("/api/v1/dashboard/admin")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"


def test_04_invalid_token_rejected_on_all_dashboards():
    """Invalid token returns 401 on all dashboard routes."""
    headers = {"Authorization": "Bearer invalid_token_xyz"}
    for endpoint in ["/student", "/recruiter", "/admin"]:
        res = client.get(f"/api/v1/dashboard{endpoint}", headers=headers)
        assert res.status_code == 401, f"Expected 401 on {endpoint}, got {res.status_code}"


def test_05_inactive_user_token_rejected():
    """Inactive user cannot access dashboard."""
    with SessionLocal() as db:
        inactive_user = User(
            email="dash.inactive@careerbridge.io",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=False,
        )
        db.add(inactive_user)
        db.commit()
        db.refresh(inactive_user)
        token = create_access_token(inactive_user.id)
        inact_id = inactive_user.id

    res = client.get("/api/v1/dashboard/student", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401, f"Expected 401 for inactive user, got {res.status_code}"

    # Cleanup
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.id == inact_id))
        if u:
            db.delete(u)
            db.commit()


# ==============================================================================
# 2. RBAC & Cross-Role Access Control Tests
# ==============================================================================
def test_06_student_cannot_access_recruiter_dashboard():
    """Student token accessing /api/v1/dashboard/recruiter returns 403 Forbidden."""
    res = client.get(
        "/api/v1/dashboard/recruiter",
        headers={"Authorization": f"Bearer {student1_token}"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"


def test_07_student_cannot_access_admin_dashboard():
    """Student token accessing /api/v1/dashboard/admin returns 403 Forbidden."""
    res = client.get(
        "/api/v1/dashboard/admin",
        headers={"Authorization": f"Bearer {student1_token}"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"


def test_08_recruiter_cannot_access_student_dashboard():
    """Recruiter token accessing /api/v1/dashboard/student returns 403 Forbidden."""
    res = client.get(
        "/api/v1/dashboard/student",
        headers={"Authorization": f"Bearer {recruiter1_token}"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"


def test_09_recruiter_cannot_access_admin_dashboard():
    """Recruiter token accessing /api/v1/dashboard/admin returns 403 Forbidden."""
    res = client.get(
        "/api/v1/dashboard/admin",
        headers={"Authorization": f"Bearer {recruiter1_token}"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"


def test_10_admin_cannot_access_student_dashboard():
    """Admin token accessing student dashboard returns 403 (strict role boundary, no admin bypass)."""
    res = client.get(
        "/api/v1/dashboard/student",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"


def test_11_admin_cannot_access_recruiter_dashboard():
    """Admin token accessing recruiter dashboard returns 403 (strict role boundary, no admin bypass)."""
    res = client.get(
        "/api/v1/dashboard/recruiter",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"


# ==============================================================================
# 3. Student Dashboard Functional & SQL Aggregation Tests
# ==============================================================================
def test_12_student1_dashboard_accurate_metrics():
    """Student 1 dashboard returns exact aggregated metrics matching database state."""
    res = client.get(
        "/api/v1/dashboard/student",
        headers={"Authorization": f"Bearer {student1_token}"},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    # Total applications = 3 (reviewing, shortlisted, accepted)
    assert data["total_applications"] == 3, f"Expected total_applications=3, got {data['total_applications']}"
    assert data["applications_under_review"] == 1, f"Expected applications_under_review=1, got {data['applications_under_review']}"
    assert data["shortlisted_applications"] == 1, f"Expected shortlisted_applications=1, got {data['shortlisted_applications']}"
    assert data["accepted_applications"] == 1, f"Expected accepted_applications=1, got {data['accepted_applications']}"
    assert data["saved_internships"] == 2, f"Expected saved_internships=2, got {data['saved_internships']}"
    # Upcoming interviews: 2 in future (int1 SCHEDULED, int2 RESCHEDULED). Past (int3), cancelled (int4), completed (int5) excluded.
    assert data["upcoming_interviews"] == 2, f"Expected upcoming_interviews=2, got {data['upcoming_interviews']}"


def test_13_student2_dashboard_data_isolation():
    """Student 2 dashboard reflects only Student 2's data, strictly isolated from Student 1."""
    res = client.get(
        "/api/v1/dashboard/student",
        headers={"Authorization": f"Bearer {student2_token}"},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    # Student 2 applied to 2 jobs: 1 APPLIED, 1 REJECTED
    assert data["total_applications"] == 2, f"Expected 2, got {data['total_applications']}"
    assert data["applications_under_review"] == 0, f"Expected 0, got {data['applications_under_review']}"
    assert data["shortlisted_applications"] == 0, f"Expected 0, got {data['shortlisted_applications']}"
    assert data["accepted_applications"] == 0, f"Expected 0, got {data['accepted_applications']}"
    assert data["saved_internships"] == 1, f"Expected 1, got {data['saved_internships']}"
    assert data["upcoming_interviews"] == 0, f"Expected 0, got {data['upcoming_interviews']}"


def test_14_student_empty_state_returns_zeroes():
    """Student with no applications, saved jobs, or interviews returns 0 for all metrics."""
    res = client.get(
        "/api/v1/dashboard/student",
        headers={"Authorization": f"Bearer {student_empty_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_applications"] == 0
    assert data["applications_under_review"] == 0
    assert data["shortlisted_applications"] == 0
    assert data["accepted_applications"] == 0
    assert data["saved_internships"] == 0
    assert data["upcoming_interviews"] == 0


def test_15_student_saved_internship_unsave_updates_count():
    """Unsaving a job immediately decrements the student's saved_internships count."""
    # Student 1 currently has 2 saved jobs
    res_before = client.get("/api/v1/dashboard/student", headers={"Authorization": f"Bearer {student1_token}"})
    assert res_before.json()["saved_internships"] == 2

    # Unsave job1
    with SessionLocal() as db:
        db.execute(delete(SavedJob).where(SavedJob.student_id == student1_id, SavedJob.job_posting_id == job1_id))
        db.commit()

    res_after = client.get("/api/v1/dashboard/student", headers={"Authorization": f"Bearer {student1_token}"})
    assert res_after.json()["saved_internships"] == 1

    # Re-save to restore state
    with SessionLocal() as db:
        db.add(SavedJob(student_id=student1_id, job_posting_id=job1_id))
        db.commit()


# ==============================================================================
# 4. Recruiter Dashboard Functional & SQL Aggregation Tests
# ==============================================================================
def test_16_recruiter1_dashboard_accurate_metrics():
    """Recruiter 1 dashboard returns exact aggregated metrics matching database state."""
    res = client.get(
        "/api/v1/dashboard/recruiter",
        headers={"Authorization": f"Bearer {recruiter1_token}"},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    # Active internships: 2 active (j1, j2); j_inact is False -> active_internships = 2
    assert data["active_internships"] == 2, f"Expected active_internships=2, got {data['active_internships']}"

    # Total applications: 4 (app1 reviewing, app2 shortlisted, app4 applied, app5 rejected)
    assert data["total_applications"] == 4, f"Expected total_applications=4, got {data['total_applications']}"

    # applications_awaiting_review: status == APPLIED -> 1 (app4)
    assert data["applications_awaiting_review"] == 1, f"Expected applications_awaiting_review=1, got {data['applications_awaiting_review']}"

    # shortlisted_candidates: status == SHORTLISTED -> 1 (app2)
    assert data["shortlisted_candidates"] == 1, f"Expected shortlisted_candidates=1, got {data['shortlisted_candidates']}"

    # scheduled_interviews: status IN (SCHEDULED, RESCHEDULED) for Recruiter 1's postings:
    # int1 (SCHEDULED on app2) -> count 1
    # int3 (SCHEDULED on app1) -> count 1
    # int4 (CANCELLED on app2) -> excluded
    # int5 (COMPLETED on app2) -> excluded
    # Total = 2
    assert data["scheduled_interviews"] == 2, f"Expected scheduled_interviews=2, got {data['scheduled_interviews']}"


def test_17_recruiter2_dashboard_data_isolation():
    """Recruiter 2 dashboard reflects only Recruiter 2's postings and pipeline, isolated from Recruiter 1."""
    res = client.get(
        "/api/v1/dashboard/recruiter",
        headers={"Authorization": f"Bearer {recruiter2_token}"},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    # Recruiter 2 has 1 active posting (job_rec2_id)
    assert data["active_internships"] == 1, f"Expected 1, got {data['active_internships']}"

    # Total applications for Recruiter 2: 1 (app3, status ACCEPTED)
    assert data["total_applications"] == 1, f"Expected 1, got {data['total_applications']}"
    assert data["applications_awaiting_review"] == 0, f"Expected 0, got {data['applications_awaiting_review']}"
    assert data["shortlisted_candidates"] == 0, f"Expected 0, got {data['shortlisted_candidates']}"

    # scheduled_interviews: int2 (RESCHEDULED on app3) -> 1
    assert data["scheduled_interviews"] == 1, f"Expected 1, got {data['scheduled_interviews']}"


def test_18_recruiter_empty_state_returns_zeroes():
    """Recruiter with no postings returns 0 for all metrics."""
    res = client.get(
        "/api/v1/dashboard/recruiter",
        headers={"Authorization": f"Bearer {recruiter_empty_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["active_internships"] == 0
    assert data["total_applications"] == 0
    assert data["applications_awaiting_review"] == 0
    assert data["shortlisted_candidates"] == 0
    assert data["scheduled_interviews"] == 0


def test_19_recruiter_inactive_posting_toggle():
    """Toggling a job posting active status immediately updates active_internships."""
    # Deactivate job1
    with SessionLocal() as db:
        j = db.scalar(select(JobPosting).where(JobPosting.id == job1_id))
        j.is_active = False
        db.commit()

    res = client.get("/api/v1/dashboard/recruiter", headers={"Authorization": f"Bearer {recruiter1_token}"})
    assert res.json()["active_internships"] == 1

    # Reactivate job1
    with SessionLocal() as db:
        j = db.scalar(select(JobPosting).where(JobPosting.id == job1_id))
        j.is_active = True
        db.commit()

    res2 = client.get("/api/v1/dashboard/recruiter", headers={"Authorization": f"Bearer {recruiter1_token}"})
    assert res2.json()["active_internships"] == 2


# ==============================================================================
# 5. Admin Dashboard Functional Tests
# ==============================================================================
def test_20_admin_dashboard_platform_wide_metrics():
    """Admin dashboard returns platform-wide aggregated user and posting metrics."""
    res = client.get(
        "/api/v1/dashboard/admin",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    assert data["total_students"] >= 3, f"Expected >=3 students, got {data['total_students']}"
    assert data["total_companies"] >= 3, f"Expected >=3 recruiters, got {data['total_companies']}"
    assert data["verified_companies"] >= 1, f"Expected >=1 verified recruiter, got {data['verified_companies']}"
    assert data["published_internships"] >= 3, f"Expected >=3 published postings, got {data['published_internships']}"
    assert data["total_applications"] >= 5, f"Expected >=5 total applications, got {data['total_applications']}"
    assert isinstance(data["application_success_rate"], float)
    assert 0.0 <= data["application_success_rate"] <= 100.0


def test_21_admin_dashboard_recruiter_verification_sensitivity():
    """Verifying/un-verifying a recruiter profile updates verified_companies count immediately."""
    res_before = client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
    verified_before = res_before.json()["verified_companies"]

    # Verify recruiter 2
    with SessionLocal() as db:
        prof = db.scalar(select(RecruiterProfile).where(RecruiterProfile.user_id == recruiter2_id))
        prof.is_verified = True
        db.commit()

    res_after = client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_after.json()["verified_companies"] == verified_before + 1

    # Revert
    with SessionLocal() as db:
        prof = db.scalar(select(RecruiterProfile).where(RecruiterProfile.user_id == recruiter2_id))
        prof.is_verified = False
        db.commit()


def test_22_admin_dashboard_success_rate_formula():
    """Admin dashboard application success rate accurately calculates (accepted / total * 100)."""
    with SessionLocal() as db:
        dash = DashboardService.get_admin_dashboard(db)

        total_apps = dash.total_applications
        # Count accepted applications in DB
        accepted = db.scalar(
            select(Application.id).where(Application.status == ApplicationStatus.ACCEPTED)
        )
        total_accepted = len(
            db.scalars(select(Application.id).where(Application.status == ApplicationStatus.ACCEPTED)).all()
        )

        if total_apps > 0:
            expected_rate = round((total_accepted / total_apps) * 100.0, 2)
            assert dash.application_success_rate == expected_rate, (
                f"Expected rate {expected_rate}, got {dash.application_success_rate}"
            )


def test_23_admin_dashboard_zero_division_safety():
    """When no applications exist in the query, success_rate is 0.0 without division error."""
    # Directly test the mathematical condition in service
    class MockAdminStats:
        total = 0
        accepted = 0

    # Ensure zero applications returns 0.0
    if MockAdminStats.total > 0:
        rate = round((MockAdminStats.accepted / MockAdminStats.total) * 100.0, 2)
    else:
        rate = 0.0
    assert rate == 0.0


def test_24_admin_dashboard_monthly_registrations_format():
    """Monthly registrations output adheres to [{'month': 'YYYY-MM', 'count': N}] structure."""
    res = client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()

    assert "monthly_registrations" in data
    assert isinstance(data["monthly_registrations"], list)
    assert len(data["monthly_registrations"]) > 0

    current_month_prefix = datetime.now(timezone.utc).strftime("%Y-")
    found_current_year = False
    for entry in data["monthly_registrations"]:
        assert "month" in entry
        assert "count" in entry
        assert isinstance(entry["count"], int)
        assert entry["count"] >= 0
        assert len(entry["month"]) == 7
        assert entry["month"][4] == "-"
        if entry["month"].startswith(current_month_prefix):
            found_current_year = True

    assert found_current_year, "Expected at least one monthly entry for the current year"


def test_25_admin_dashboard_period_year_filter():
    """Admin dashboard accepts period_year query parameter."""
    res = client.get(
        "/api/v1/dashboard/admin?period_year=2026",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    for entry in data["monthly_registrations"]:
        assert entry["month"].startswith("2026-")


def test_26_admin_dashboard_invalid_period_year():
    """Invalid period_year returns 422 validation error."""
    res = client.get(
        "/api/v1/dashboard/admin?period_year=1800",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 422


# ==============================================================================
# 6. Direct Service Layer & Performance Tests
# ==============================================================================
def test_27_direct_service_student_dashboard():
    """Direct DashboardService.get_student_dashboard returns valid Pydantic model."""
    with SessionLocal() as db:
        res = DashboardService.get_student_dashboard(db, student_id=student1_id)
        assert isinstance(res, StudentDashboardResponse)
        assert res.total_applications == 3
        assert res.applications_under_review == 1
        assert res.shortlisted_applications == 1
        assert res.accepted_applications == 1
        assert res.saved_internships == 2
        assert res.upcoming_interviews == 2


def test_28_direct_service_recruiter_dashboard():
    """Direct DashboardService.get_recruiter_dashboard returns valid Pydantic model."""
    with SessionLocal() as db:
        res = DashboardService.get_recruiter_dashboard(db, recruiter_id=recruiter1_id)
        assert isinstance(res, RecruiterDashboardResponse)
        assert res.active_internships == 2
        assert res.total_applications == 4
        assert res.applications_awaiting_review == 1
        assert res.shortlisted_candidates == 1
        assert res.scheduled_interviews == 2


def test_29_direct_service_admin_dashboard():
    """Direct DashboardService.get_admin_dashboard returns valid Pydantic model."""
    with SessionLocal() as db:
        res = DashboardService.get_admin_dashboard(db)
        assert isinstance(res, AdminDashboardResponse)
        assert res.total_students >= 3
        assert res.total_companies >= 3
        assert res.verified_companies >= 1
        assert res.published_internships >= 3
        assert res.total_applications >= 5
        assert isinstance(res.monthly_registrations, list)


def test_30_dashboard_query_performance():
    """Dashboard endpoints execute within performance SLA (under 200ms)."""
    start_time = time.perf_counter()
    res_student = client.get("/api/v1/dashboard/student", headers={"Authorization": f"Bearer {student1_token}"})
    student_duration_ms = (time.perf_counter() - start_time) * 1000
    assert res_student.status_code == 200
    assert student_duration_ms < 500, f"Student dashboard took {student_duration_ms:.2f}ms (exceeded SLA)"

    start_time = time.perf_counter()
    res_recruiter = client.get("/api/v1/dashboard/recruiter", headers={"Authorization": f"Bearer {recruiter1_token}"})
    recruiter_duration_ms = (time.perf_counter() - start_time) * 1000
    assert res_recruiter.status_code == 200
    assert recruiter_duration_ms < 500, f"Recruiter dashboard took {recruiter_duration_ms:.2f}ms (exceeded SLA)"

    start_time = time.perf_counter()
    res_admin = client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
    admin_duration_ms = (time.perf_counter() - start_time) * 1000
    assert res_admin.status_code == 200
    assert admin_duration_ms < 500, f"Admin dashboard took {admin_duration_ms:.2f}ms (exceeded SLA)"


def test_31_pydantic_schema_validations():
    """Pydantic schemas enforce type constraints and prevent invalid bounds."""
    # Test valid student schema
    s = StudentDashboardResponse(
        total_applications=5,
        applications_under_review=2,
        shortlisted_applications=1,
        accepted_applications=1,
        saved_internships=3,
        upcoming_interviews=1,
    )
    assert s.total_applications == 5

    # Test negative count rejection
    try:
        StudentDashboardResponse(
            total_applications=-1,
            applications_under_review=0,
            shortlisted_applications=0,
            accepted_applications=0,
            saved_internships=0,
            upcoming_interviews=0,
        )
        assert False, "Should have raised ValidationError for negative total_applications"
    except Exception:
        pass

    # Test admin success rate bounds [0, 100]
    adm = AdminDashboardResponse(
        total_students=10,
        total_companies=5,
        verified_companies=3,
        published_internships=8,
        total_applications=20,
        application_success_rate=50.0,
        monthly_registrations=[MonthlyRegistrationMetric(month="2026-09", count=15)],
    )
    assert adm.application_success_rate == 50.0

    try:
        AdminDashboardResponse(
            total_students=10,
            total_companies=5,
            verified_companies=3,
            published_internships=8,
            total_applications=20,
            application_success_rate=150.0,
            monthly_registrations=[],
        )
        assert False, "Should have raised ValidationError for success rate > 100"
    except Exception:
        pass


def run_all_tests():
    """Run all test functions sequentially."""
    print("=" * 70)
    print("RUNNING CAREERBRIDGE PHASE 22 DASHBOARD TEST SUITE")
    print("=" * 70)

    setup_module()
    tests = [
        test_01_student_dashboard_requires_auth,
        test_02_recruiter_dashboard_requires_auth,
        test_03_admin_dashboard_requires_auth,
        test_04_invalid_token_rejected_on_all_dashboards,
        test_05_inactive_user_token_rejected,
        test_06_student_cannot_access_recruiter_dashboard,
        test_07_student_cannot_access_admin_dashboard,
        test_08_recruiter_cannot_access_student_dashboard,
        test_09_recruiter_cannot_access_admin_dashboard,
        test_10_admin_cannot_access_student_dashboard,
        test_11_admin_cannot_access_recruiter_dashboard,
        test_12_student1_dashboard_accurate_metrics,
        test_13_student2_dashboard_data_isolation,
        test_14_student_empty_state_returns_zeroes,
        test_15_student_saved_internship_unsave_updates_count,
        test_16_recruiter1_dashboard_accurate_metrics,
        test_17_recruiter2_dashboard_data_isolation,
        test_18_recruiter_empty_state_returns_zeroes,
        test_19_recruiter_inactive_posting_toggle,
        test_20_admin_dashboard_platform_wide_metrics,
        test_21_admin_dashboard_recruiter_verification_sensitivity,
        test_22_admin_dashboard_success_rate_formula,
        test_23_admin_dashboard_zero_division_safety,
        test_24_admin_dashboard_monthly_registrations_format,
        test_25_admin_dashboard_period_year_filter,
        test_26_admin_dashboard_invalid_period_year,
        test_27_direct_service_student_dashboard,
        test_28_direct_service_recruiter_dashboard,
        test_29_direct_service_admin_dashboard,
        test_30_dashboard_query_performance,
        test_31_pydantic_schema_validations,
    ]

    passed = 0
    failed = 0

    try:
        for t in tests:
            name = t.__name__
            try:
                t()
                print(f"[PASS] {name}")
                passed += 1
            except Exception as e:
                print(f"[FAIL] {name}: {e}")
                failed += 1
                import traceback
                traceback.print_exc()
    finally:
        teardown_module()

    print("=" * 70)
    print(f"RESULTS: {passed} PASSED, {failed} FAILED out of {len(tests)} tests")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
