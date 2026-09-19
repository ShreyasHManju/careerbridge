"""
CareerBridge Phase 24 Core Roadmap Backend Test Suite
Validates the complete backend testing strategy against the original engineering roadmap:
1. Registration (valid, invalid, duplicate email, bcrypt hashed, no password/hash leakage)
2. Login (valid credentials, invalid password, unknown user, inactive user, safe response)
3. Password Hashing (plaintext prevention, salt uniqueness, verify_password correctness)
4. Role Permissions (student, recruiter, admin access matrix, 401 unauth, 403 forbidden)
5. Internship/Job Creation (recruiter 201, non-recruiter 403, validation 422, ownership binding)
6. Internship/Job Filtering (search keyword, filters, pagination, inactive job hiding)
7. Application Submission (student 201, non-student 403, missing job 404, inactive job 400)
8. Duplicate Application Prevention (409 duplicate conflict, single DB row invariant)
9. Application Status Changes (recruiter progression, cross-recruiter 403, student observation)
10. Admin Permissions (admin endpoints require admin role, recruiter/student 403, self-lockout 400)
11. Structured Error Handling & Zero-Leakage (401, 403, 404, 409, 422, 500 envelopes, no tracebacks)
"""

from pathlib import Path
import sys
import uuid

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password, verify_password
from app.core.test_fixtures import (
    DEFAULT_TEST_PASSWORD,
    clean_test_records,
    create_test_application,
    create_test_job,
    create_test_user,
    generate_test_email,
    get_auth_headers,
    get_test_db,
)
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.user import User, UserRole

client = TestClient(app, raise_server_exceptions=False)
created_user_ids: list[int] = []


def cleanup():
    """Tear down all user records and cascaded entities created by this suite."""
    global created_user_ids
    with get_test_db() as db:
        if created_user_ids:
            clean_test_records(db, user_ids=created_user_ids)
            created_user_ids = []
        # Safety guard: clean any orphaned records matching test patterns
        patterns = [
            "reg_%@careerbridge.io", "login_%@careerbridge.io", "perm_%@careerbridge.io",
            "job_create_%@careerbridge.io", "filter_%@careerbridge.io", "app_%@careerbridge.io",
            "dup_%@careerbridge.io", "stat_%@careerbridge.io", "adm_%@careerbridge.io",
            "err_%@careerbridge.io", "short_pass_%@careerbridge.io"
        ]
        clause = User.email.like(patterns[0])
        for p in patterns[1:]:
            clause = clause | User.email.like(p)
        orphans = db.scalars(select(User.id).where(clause)).all()
        if orphans:
            clean_test_records(db, user_ids=list(orphans))


def record_user(user: User) -> User:
    """Track a created user ID for safe teardown."""
    created_user_ids.append(user.id)
    return user


# ==============================================================================
# 1. REGISTRATION TESTS
# ==============================================================================

def test_01_registration_valid_succeeds_and_hashes_password():
    """Verify valid student registration creates a user, hashes password, and returns safe payload."""
    email = generate_test_email("reg_valid")
    password = "SafeRegistrationPass123!"

    res = client.post("/api/v1/users", json={
        "email": email,
        "password": password,
        "role": "student"
    })
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    body = res.json()

    created_user_ids.append(body["id"])
    assert body["email"] == email
    assert body["role"] == "student"
    assert "password" not in body
    assert "password_hash" not in body

    # Verify directly in DB that password is encrypted and not plaintext
    with get_test_db() as db:
        user_in_db = db.scalar(select(User).where(User.id == body["id"]))
        assert user_in_db is not None
        assert user_in_db.password_hash != password
        assert user_in_db.password_hash.startswith("$2b$") or user_in_db.password_hash.startswith("$2a$")
        assert verify_password(password, user_in_db.password_hash)


def test_02_registration_invalid_payload_fails():
    """Verify invalid registration payloads (bad email, short password) return 422 VALIDATION_ERROR."""
    # Invalid email
    res1 = client.post("/api/v1/users", json={
        "email": "not-an-email",
        "password": "ValidPassword123!",
        "role": "student"
    })
    assert res1.status_code == 422
    b1 = res1.json()
    assert b1["success"] is False
    assert b1["error_code"] == "VALIDATION_ERROR"

    # Password too short (< 8 chars)
    res2 = client.post("/api/v1/users", json={
        "email": generate_test_email("short_pass"),
        "password": "short",
        "role": "student"
    })
    assert res2.status_code == 422
    b2 = res2.json()
    assert b2["success"] is False
    assert b2["error_code"] == "VALIDATION_ERROR"


def test_03_registration_duplicate_email_rejected():
    """Verify attempting to register with an already registered email is rejected."""
    email = generate_test_email("reg_dup")
    password = "TestPassword123!"

    # First registration
    res1 = client.post("/api/v1/users", json={
        "email": email,
        "password": password,
        "role": "student"
    })
    assert res1.status_code == 201
    created_user_ids.append(res1.json()["id"])

    # Second registration with identical email
    res2 = client.post("/api/v1/users", json={
        "email": email,
        "password": password,
        "role": "student"
    })
    assert res2.status_code in (400, 409)
    b2 = res2.json()
    assert b2["success"] is False
    assert "already registered" in str(b2["message"]).lower() or "conflict" in str(b2["message"]).lower() or "exists" in str(b2["message"]).lower()


# ==============================================================================
# 2. LOGIN TESTS
# ==============================================================================

def test_04_login_valid_credentials_succeeds():
    """Verify logging in with valid credentials returns a Bearer access token."""
    with get_test_db() as db:
        user = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="login_valid"))

    res = client.post("/api/v1/auth/login", json={
        "email": user.email,
        "password": DEFAULT_TEST_PASSWORD
    })
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert body["token_type"].lower() == "bearer"
    assert "password" not in body
    assert "password_hash" not in body


def test_05_login_invalid_password_fails():
    """Verify logging in with an incorrect password returns 401 AUTHENTICATION_REQUIRED."""
    with get_test_db() as db:
        user = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="login_badpass"))

    res = client.post("/api/v1/auth/login", json={
        "email": user.email,
        "password": "WrongPassword999!"
    })
    assert res.status_code == 401
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == "AUTHENTICATION_REQUIRED"


def test_06_login_unknown_user_fails():
    """Verify logging in with a non-existent email returns 401 AUTHENTICATION_REQUIRED."""
    res = client.post("/api/v1/auth/login", json={
        "email": "nonexistent.ghost.user@careerbridge.io",
        "password": "SomePassword123!"
    })
    assert res.status_code == 401
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == "AUTHENTICATION_REQUIRED"


def test_07_login_inactive_user_fails():
    """Verify deactivated user accounts cannot authenticate (401/403)."""
    with get_test_db() as db:
        user = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="login_inactive", is_active=False))

    res = client.post("/api/v1/auth/login", json={
        "email": user.email,
        "password": DEFAULT_TEST_PASSWORD
    })
    assert res.status_code in (400, 401, 403)
    body = res.json()
    assert body["success"] is False


# ==============================================================================
# 3. PASSWORD HASHING TESTS
# ==============================================================================

def test_08_password_hashing_security():
    """Verify bcrypt hash properties: salt randomness, verification correctness, non-plaintext."""
    raw_pass = "CryptographicallySecurePassword123!"
    hash1 = hash_password(raw_pass)
    hash2 = hash_password(raw_pass)

    # 1. Hashes are different due to unique per-call bcrypt salts
    assert hash1 != hash2
    assert hash1 != raw_pass

    # 2. Both verify correctly
    assert verify_password(raw_pass, hash1) is True
    assert verify_password(raw_pass, hash2) is True

    # 3. False password fails verification
    assert verify_password("WrongPassword123!", hash1) is False


# ==============================================================================
# 4. ROLE PERMISSIONS TESTS
# ==============================================================================

def test_09_role_permission_matrix():
    """Verify endpoint authorization matrix across roles (Student, Recruiter, Admin)."""
    with get_test_db() as db:
        student = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="perm_stu"))
        recruiter = record_user(create_test_user(db, role=UserRole.RECRUITER, email_prefix="perm_rec"))
        admin = record_user(create_test_user(db, role=UserRole.ADMIN, email_prefix="perm_adm"))

    stu_hdr = get_auth_headers(student)
    rec_hdr = get_auth_headers(recruiter)
    adm_hdr = get_auth_headers(admin)

    # Unauthenticated access -> 401
    res_unauth = client.get("/api/v1/auth/me")
    assert res_unauth.status_code == 401
    assert res_unauth.json()["error_code"] == "AUTHENTICATION_REQUIRED"

    # Student cannot access recruiter postings list (/api/v1/jobs/my) -> 403
    res_stu_forbidden = client.get("/api/v1/jobs/my", headers=stu_hdr)
    assert res_stu_forbidden.status_code == 403
    assert res_stu_forbidden.json()["error_code"] == "FORBIDDEN"

    # Recruiter cannot access student applications list (/api/v1/applications/me) -> 403
    res_rec_forbidden = client.get("/api/v1/applications/me", headers=rec_hdr)
    assert res_rec_forbidden.status_code == 403
    assert res_rec_forbidden.json()["error_code"] == "FORBIDDEN"

    # Student cannot access admin users list (/api/v1/admin/users) -> 403
    res_adm_forbidden = client.get("/api/v1/admin/users", headers=stu_hdr)
    assert res_adm_forbidden.status_code == 403
    assert res_adm_forbidden.json()["error_code"] == "FORBIDDEN"

    # Admin CAN access admin users list -> 200
    res_adm_ok = client.get("/api/v1/admin/users", headers=adm_hdr)
    assert res_adm_ok.status_code == 200


# ==============================================================================
# 5. INTERNSHIP / JOB CREATION TESTS
# ==============================================================================

def test_10_job_creation_and_ownership():
    """Verify recruiter can create jobs, students cannot, validation rejects bad ranges, and ownership binds."""
    with get_test_db() as db:
        recruiter = record_user(create_test_user(db, role=UserRole.RECRUITER, email_prefix="job_create_rec"))
        student = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="job_create_stu"))

    rec_hdr = get_auth_headers(recruiter)
    stu_hdr = get_auth_headers(student)

    # 1. Student cannot create job -> 403
    res_stu = client.post("/api/v1/jobs", headers=stu_hdr, json={
        "title": "Unauthorized Job",
        "description": "Should be rejected",
        "company_name": "Unauthorized Org",
        "location": "Remote",
        "opportunity_type": "internship",
        "employment_type": "full_time"
    })
    assert res_stu.status_code == 403
    assert res_stu.json()["error_code"] == "FORBIDDEN"

    # 2. Invalid salary range (salary_max < salary_min) -> 422
    res_bad_sal = client.post("/api/v1/jobs", headers=rec_hdr, json={
        "title": "Invalid Salary Job",
        "description": "Salary inverted",
        "company_name": "Invalid Org",
        "location": "Remote",
        "opportunity_type": "internship",
        "employment_type": "full_time",
        "salary_min": 5000,
        "salary_max": 2000
    })
    assert res_bad_sal.status_code == 422
    assert res_bad_sal.json()["error_code"] == "VALIDATION_ERROR"

    # 3. Recruiter creates valid job -> 201
    res_ok = client.post("/api/v1/jobs", headers=rec_hdr, json={
        "title": "Backend Engineering Intern",
        "description": "Develop high-throughput REST APIs.",
        "company_name": "Acme Cloud Corp",
        "location": "Seattle, WA",
        "is_remote": True,
        "opportunity_type": "internship",
        "employment_type": "full_time",
        "salary_min": 4000,
        "salary_max": 6000
    })
    assert res_ok.status_code == 201, f"Create job failed: {res_ok.text}"
    job_data = res_ok.json()
    assert job_data["title"] == "Backend Engineering Intern"
    assert job_data["recruiter_id"] == recruiter.id


# ==============================================================================
# 6. INTERNSHIP / JOB FILTERING TESTS
# ==============================================================================

def test_11_job_filtering_and_pagination():
    """Verify job search, keyword filtering, and pagination excluding inactive postings."""
    with get_test_db() as db:
        recruiter = record_user(create_test_user(db, role=UserRole.RECRUITER, email_prefix="filter_rec"))
        student = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="filter_stu"))
        # Active matching job
        active_job = create_test_job(
            db, recruiter_id=recruiter.id,
            title="Quantum Cloud Computing Intern",
            company_name="Quantum Systems Corp",
            location="Boston, MA",
            opportunity_type=OpportunityType.INTERNSHIP,
            is_active=True
        )
        # Inactive matching job
        inactive_job = create_test_job(
            db, recruiter_id=recruiter.id,
            title="Quantum Cloud Inactive Intern",
            company_name="Quantum Systems Corp",
            location="Boston, MA",
            opportunity_type=OpportunityType.INTERNSHIP,
            is_active=False
        )

    stu_hdr = get_auth_headers(student)

    # 1. Search by keyword "Quantum" via ?q=Quantum
    res = client.get("/api/v1/jobs?q=Quantum", headers=stu_hdr)
    assert res.status_code == 200, f"Search failed: {res.text}"
    body = res.json()
    items = body.get("items", body) if isinstance(body, dict) else body

    found_active = any(j["id"] == active_job.id for j in items)
    found_inactive = any(j["id"] == inactive_job.id for j in items)
    assert found_active is True, "Active job should appear in candidate search"
    assert found_inactive is False, "Inactive job should NOT appear in candidate search"

    # 2. Pagination query parameters
    res_pag = client.get("/api/v1/jobs?page=1&size=5", headers=stu_hdr)
    assert res_pag.status_code == 200


# ==============================================================================
# 7. APPLICATION SUBMISSION TESTS
# ==============================================================================

def test_12_application_submission_lifecycle():
    """Verify student application submission, role authorization, and validation."""
    with get_test_db() as db:
        recruiter = record_user(create_test_user(db, role=UserRole.RECRUITER, email_prefix="app_rec"))
        student = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="app_stu"))
        admin = record_user(create_test_user(db, role=UserRole.ADMIN, email_prefix="app_adm"))
        job = create_test_job(db, recruiter_id=recruiter.id, title="Data Science Intern", is_active=True)
        inactive_job = create_test_job(db, recruiter_id=recruiter.id, title="Closed Intern", is_active=False)

    stu_hdr = get_auth_headers(student)
    rec_hdr = get_auth_headers(recruiter)
    adm_hdr = get_auth_headers(admin)

    # 1. Recruiter cannot submit application -> 403
    res_rec = client.post(f"/api/v1/jobs/{job.id}/applications", headers=rec_hdr, json={
        "cover_message": "Recruiter trying to apply."
    })
    assert res_rec.status_code == 403
    assert res_rec.json()["error_code"] == "FORBIDDEN"

    # 2. Admin cannot submit application -> 403
    res_adm = client.post(f"/api/v1/jobs/{job.id}/applications", headers=adm_hdr, json={
        "cover_message": "Admin trying to apply."
    })
    assert res_adm.status_code == 403
    assert res_adm.json()["error_code"] == "FORBIDDEN"

    # 3. Applying to inactive job -> 400
    res_inactive = client.post(f"/api/v1/jobs/{inactive_job.id}/applications", headers=stu_hdr, json={
        "cover_message": "Applying to closed job."
    })
    assert res_inactive.status_code == 400

    # 4. Applying to nonexistent job -> 404
    res_missing = client.post("/api/v1/jobs/999999999/applications", headers=stu_hdr, json={
        "cover_message": "Ghost job."
    })
    assert res_missing.status_code == 404
    assert res_missing.json()["error_code"] == "NOT_FOUND"

    # 5. Valid student application -> 201
    res_ok = client.post(f"/api/v1/jobs/{job.id}/applications", headers=stu_hdr, json={
        "cover_message": "I have deep experience with PyTorch and Pandas."
    })
    assert res_ok.status_code == 201
    app_data = res_ok.json()
    assert app_data["student_id"] == student.id
    assert app_data["job_posting_id"] == job.id
    assert app_data["status"] == "applied"


# ==============================================================================
# 8. DUPLICATE APPLICATION PREVENTION TESTS
# ==============================================================================

def test_13_duplicate_application_prevention():
    """Verify duplicate applications are rejected with 409 and duplicate DB rows are prevented."""
    with get_test_db() as db:
        recruiter = record_user(create_test_user(db, role=UserRole.RECRUITER, email_prefix="dup_rec"))
        student = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="dup_stu"))
        job = create_test_job(db, recruiter_id=recruiter.id, title="Robotics Intern", is_active=True)

    stu_hdr = get_auth_headers(student)

    # 1. First application succeeds (201)
    res1 = client.post(f"/api/v1/jobs/{job.id}/applications", headers=stu_hdr, json={
        "cover_message": "First submission."
    })
    assert res1.status_code == 201

    # 2. Second application to same job is rejected (409)
    res2 = client.post(f"/api/v1/jobs/{job.id}/applications", headers=stu_hdr, json={
        "cover_message": "Duplicate submission."
    })
    assert res2.status_code == 409
    body2 = res2.json()
    assert body2["success"] is False
    assert body2["error_code"] in ("DUPLICATE_APPLICATION", "RESOURCE_CONFLICT")

    # 3. Invariant check: Exactly one row exists in DB
    with get_test_db() as db:
        apps = db.scalars(
            select(Application).where(
                Application.student_id == student.id,
                Application.job_posting_id == job.id
            )
        ).all()
        assert len(apps) == 1, f"Expected exactly 1 application record, found {len(apps)}"


# ==============================================================================
# 9. APPLICATION STATUS CHANGES TESTS
# ==============================================================================

def test_14_application_status_transitions_and_isolation():
    """Verify recruiter can progress application status, cross-recruiter tampering blocked, student views state."""
    with get_test_db() as db:
        recruiter1 = record_user(create_test_user(db, role=UserRole.RECRUITER, email_prefix="stat_rec1"))
        recruiter2 = record_user(create_test_user(db, role=UserRole.RECRUITER, email_prefix="stat_rec2"))
        student = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="stat_stu"))
        job = create_test_job(db, recruiter_id=recruiter1.id, title="Frontend Intern", is_active=True)
        application = create_test_application(db, student_id=student.id, job_posting_id=job.id, status=ApplicationStatus.APPLIED)

    rec1_hdr = get_auth_headers(recruiter1)
    rec2_hdr = get_auth_headers(recruiter2)
    stu_hdr = get_auth_headers(student)

    # 1. Recruiter 2 (different organization) cannot modify status -> 403
    res_tamper = client.patch(f"/api/v1/recruiter/applications/{application.id}", headers=rec2_hdr, json={
        "status": "shortlisted"
    })
    assert res_tamper.status_code == 403
    assert res_tamper.json()["error_code"] in ("FORBIDDEN", "RESOURCE_OWNERSHIP_ERROR")

    # 2. Student cannot modify status -> 403
    res_stu_mod = client.patch(f"/api/v1/recruiter/applications/{application.id}", headers=stu_hdr, json={
        "status": "accepted"
    })
    assert res_stu_mod.status_code == 403

    # 3. Owning recruiter transitions status: applied -> reviewing
    res_rev = client.patch(f"/api/v1/recruiter/applications/{application.id}", headers=rec1_hdr, json={
        "status": "reviewing"
    })
    assert res_rev.status_code == 200
    assert res_rev.json()["status"] == "reviewing"

    # 4. Owning recruiter transitions status: reviewing -> shortlisted
    res_short = client.patch(f"/api/v1/recruiter/applications/{application.id}", headers=rec1_hdr, json={
        "status": "shortlisted"
    })
    assert res_short.status_code == 200
    assert res_short.json()["status"] == "shortlisted"

    # 5. Owning recruiter transitions status: shortlisted -> accepted
    res_acc = client.patch(f"/api/v1/recruiter/applications/{application.id}", headers=rec1_hdr, json={
        "status": "accepted"
    })
    assert res_acc.status_code == 200
    assert res_acc.json()["status"] == "accepted"

    # 6. Student views their updated application status
    res_stu_view = client.get(f"/api/v1/applications/{application.id}", headers=stu_hdr)
    assert res_stu_view.status_code == 200
    assert res_stu_view.json()["status"] == "accepted"


# ==============================================================================
# 10. ADMIN PERMISSIONS TESTS
# ==============================================================================

def test_15_admin_permissions_and_moderation():
    """Verify admin-only endpoints require admin role, recruiter verification, job moderation, self-lockout."""
    with get_test_db() as db:
        admin = record_user(create_test_user(db, role=UserRole.ADMIN, email_prefix="adm_perm"))
        student = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="stu_adm"))
        recruiter = record_user(create_test_user(db, role=UserRole.RECRUITER, email_prefix="rec_adm"))
        job = create_test_job(db, recruiter_id=recruiter.id, title="Admin Moderated Job", is_active=True)

    adm_hdr = get_auth_headers(admin)
    stu_hdr = get_auth_headers(student)
    rec_hdr = get_auth_headers(recruiter)

    # 1. Non-admins cannot access admin users list -> 403
    assert client.get("/api/v1/admin/users", headers=stu_hdr).status_code == 403
    assert client.get("/api/v1/admin/users", headers=rec_hdr).status_code == 403

    # 2. Admin verifies recruiter organization
    res_ver = client.patch(f"/api/v1/admin/recruiters/{recruiter.id}/verification", headers=adm_hdr, json={
        "is_verified": True
    })
    assert res_ver.status_code == 200, f"Recruiter verify failed: {res_ver.text}"
    assert res_ver.json()["is_verified"] is True

    # 3. Admin moderates job posting (deactivates job)
    res_mod = client.patch(f"/api/v1/admin/jobs/{job.id}/status", headers=adm_hdr, json={
        "is_active": False
    })
    assert res_mod.status_code == 200
    assert res_mod.json()["is_active"] is False

    # 4. Admin cannot deactivate own currently authenticated account (self-lockout protection -> 400)
    res_self = client.patch(f"/api/v1/admin/users/{admin.id}/status", headers=adm_hdr, json={
        "is_active": False
    })
    assert res_self.status_code == 400
    assert "own account" in res_self.json()["message"].lower() or "self" in res_self.json()["message"].lower()


# ==============================================================================
# 11. STRUCTURED ERROR HANDLING ENVELOPE & SECURITY SHIELDING
# ==============================================================================

def test_16_structured_error_envelopes_and_zero_leakage():
    """Verify Phase 23 structured JSON error envelopes (401, 403, 404, 409, 422, 500) and zero secret leakage."""
    # 1. 401 Unauthorized
    res_401 = client.get("/api/v1/auth/me")
    assert res_401.status_code == 401
    b_401 = res_401.json()
    assert b_401["success"] is False
    assert b_401["error_code"] == "AUTHENTICATION_REQUIRED"
    assert "detail" in b_401

    # 2. 403 Forbidden
    with get_test_db() as db:
        stu = record_user(create_test_user(db, role=UserRole.STUDENT, email_prefix="err_stu"))
    stu_hdr = get_auth_headers(stu)
    res_403 = client.get("/api/v1/admin/users", headers=stu_hdr)
    assert res_403.status_code == 403
    b_403 = res_403.json()
    assert b_403["success"] is False
    assert b_403["error_code"] == "FORBIDDEN"

    # 3. 404 Not Found
    res_404 = client.get("/api/v1/jobs/88888888", headers=stu_hdr)
    assert res_404.status_code == 404
    b_404 = res_404.json()
    assert b_404["success"] is False
    assert b_404["error_code"] == "NOT_FOUND"

    # 4. 422 Validation Error
    res_422 = client.post("/api/v1/auth/login", json={"email": "invalid_email_format"})
    assert res_422.status_code == 422
    b_422 = res_422.json()
    assert b_422["success"] is False
    assert b_422["error_code"] == "VALIDATION_ERROR"
    assert isinstance(b_422["detail"], list)

    # 5. 500 Internal Server Error (Sanitized, zero stack trace)
    res_500 = client.get("/test-error-500")
    assert res_500.status_code == 500
    b_500 = res_500.json()
    assert b_500["success"] is False
    assert b_500["error_code"] == "INTERNAL_SERVER_ERROR"
    assert "Traceback" not in res_500.text
    assert "File \"" not in res_500.text
    assert "RuntimeError" not in res_500.text

    # 6. Global Zero Leakage Verification across all responses
    all_responses = [res_401.text, res_403.text, res_404.text, res_422.text, res_500.text]
    for text in all_responses:
        assert "password_hash" not in text
        assert "SECRET_KEY" not in text
        assert "postgresql://" not in text


# ==============================================================================
# TEST RUNNER ENTRYPOINT
# ==============================================================================

def run_core_roadmap_tests():
    print("=" * 70)
    print("STARTING PHASE 24 CORE ROADMAP BACKEND TEST SUITE...")
    print("=" * 70)

    tests = [
        test_01_registration_valid_succeeds_and_hashes_password,
        test_02_registration_invalid_payload_fails,
        test_03_registration_duplicate_email_rejected,
        test_04_login_valid_credentials_succeeds,
        test_05_login_invalid_password_fails,
        test_06_login_unknown_user_fails,
        test_07_login_inactive_user_fails,
        test_08_password_hashing_security,
        test_09_role_permission_matrix,
        test_10_job_creation_and_ownership,
        test_11_job_filtering_and_pagination,
        test_12_application_submission_lifecycle,
        test_13_duplicate_application_prevention,
        test_14_application_status_transitions_and_isolation,
        test_15_admin_permissions_and_moderation,
        test_16_structured_error_envelopes_and_zero_leakage,
    ]

    passed = 0
    failed = 0

    # Ensure clean slate before running tests
    cleanup()

    try:
        for idx, t in enumerate(tests, 1):
            name = t.__name__
            try:
                t()
                print(f"[{idx:02d}/{len(tests):02d}] PASS: {name}")
                passed += 1
            except Exception as e:
                print(f"[{idx:02d}/{len(tests):02d}] FAIL: {name} -> {e}")
                failed += 1
                raise
    finally:
        cleanup()

    print("=" * 70)
    print(f"RESULTS: {passed} PASSED, {failed} FAILED out of {len(tests)} tests")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_core_roadmap_tests()
