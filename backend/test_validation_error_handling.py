"""
CareerBridge Phase 23 Validation & Error Handling Test Suite
============================================================
Comprehensive test coverage:
1. Missing authentication header -> 401 AUTHENTICATION_REQUIRED
2. Invalid authentication token -> 401 INVALID_TOKEN
3. Expired authentication token -> 401 TOKEN_EXPIRED
4. Valid user with insufficient permissions / wrong role -> 403 FORBIDDEN
5. Nonexistent resource -> 404 NOT_FOUND
6. Duplicate application -> 409 DUPLICATE_APPLICATION
7. Duplicate saved job -> 409 RESOURCE_CONFLICT
8. Conflicting interview schedule -> 409 RESOURCE_CONFLICT
9. Invalid request body (missing required field) -> 422 VALIDATION_ERROR
10. Invalid enum value -> 422 VALIDATION_ERROR
11. Invalid pagination values (e.g. page_size=0, page_size=101) -> 422 VALIDATION_ERROR
12. Invalid file upload (unsupported extension / content-type) -> 400 INVALID_FILE_TYPE
13. Oversized file upload -> 400 or 413 FILE_TOO_LARGE
14. Unauthorized resource ownership access (cross-student / cross-recruiter) -> 403 RESOURCE_OWNERSHIP_ERROR or FORBIDDEN
15. Expected database conflict translation -> safe 409 RESOURCE_CONFLICT
16. Unexpected server exception -> 500 INTERNAL_SERVER_ERROR without traceback leakage
17. Security check: Error responses strictly contain no password, hash, JWT secret, DB URL, or server paths
18. Consistency check: Error envelope has 'success': False, 'message', 'error_code', and backward-compatible 'detail'
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
import jwt
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.exceptions import (
    AppException,
    AuthenticationRequiredException,
    DuplicateApplicationException,
    DuplicateResourceException,
    ErrorCode,
    FileTooLargeException,
    ForbiddenException,
    InternalServerException,
    InvalidFileTypeException,
    InvalidStateException,
    InvalidTokenException,
    NotFoundException,
    RateLimitExceededException,
    ResourceOwnershipException,
    TokenExpiredException,
    ValidationException,
)
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.interview import Interview, InterviewStatus, InterviewType
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.recruiter_profile import RecruiterProfile
from app.models.saved_job import SavedJob
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole

client = TestClient(app)

TEST_STUDENT_EMAIL = "valerr.student@careerbridge.io"
TEST_STUDENT2_EMAIL = "valerr.student2@careerbridge.io"
TEST_RECRUITER_EMAIL = "valerr.recruiter@careerbridge.io"
TEST_RECRUITER2_EMAIL = "valerr.recruiter2@careerbridge.io"
TEST_ADMIN_EMAIL = "valerr.admin@careerbridge.io"
TEST_PASSWORD = "ValErrPassword123!"

student_id: int = 0
student2_id: int = 0
recruiter_id: int = 0
recruiter2_id: int = 0
admin_id: int = 0

student_token: str = ""
student2_token: str = ""
recruiter_token: str = ""
recruiter2_token: str = ""
admin_token: str = ""

job_id: int = 0
job2_id: int = 0
application_id: int = 0


def teardown_module():
    """Clean up test users, profiles, and dependencies."""
    with SessionLocal() as db:
        test_emails = [
            TEST_STUDENT_EMAIL,
            TEST_STUDENT2_EMAIL,
            TEST_RECRUITER_EMAIL,
            TEST_RECRUITER2_EMAIL,
            TEST_ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(delete(Interview).where(Interview.student_id.in_(user_ids)))
            db.execute(delete(SavedJob).where(SavedJob.student_id.in_(user_ids)))
            db.execute(delete(Application).where(Application.student_id.in_(user_ids)))

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
    """Seed test fixtures."""
    global student_id, student2_id, recruiter_id, recruiter2_id, admin_id
    global student_token, student2_token, recruiter_token, recruiter2_token, admin_token
    global job_id, job2_id, application_id

    teardown_module()

    with SessionLocal() as db:
        hashed = hash_password(TEST_PASSWORD)

        s1 = User(email=TEST_STUDENT_EMAIL, password_hash=hashed, role=UserRole.STUDENT, is_active=True, is_verified=True)
        s2 = User(email=TEST_STUDENT2_EMAIL, password_hash=hashed, role=UserRole.STUDENT, is_active=True, is_verified=True)
        r1 = User(email=TEST_RECRUITER_EMAIL, password_hash=hashed, role=UserRole.RECRUITER, is_active=True, is_verified=True)
        r2 = User(email=TEST_RECRUITER2_EMAIL, password_hash=hashed, role=UserRole.RECRUITER, is_active=True, is_verified=True)
        adm = User(email=TEST_ADMIN_EMAIL, password_hash=hashed, role=UserRole.ADMIN, is_active=True, is_verified=True)

        db.add_all([s1, s2, r1, r2, adm])
        db.commit()

        for u in [s1, s2, r1, r2, adm]:
            db.refresh(u)

        student_id = s1.id
        student2_id = s2.id
        recruiter_id = r1.id
        recruiter2_id = r2.id
        admin_id = adm.id

        student_token = create_access_token(student_id)
        student2_token = create_access_token(student2_id)
        recruiter_token = create_access_token(recruiter_id)
        recruiter2_token = create_access_token(recruiter2_id)
        admin_token = create_access_token(admin_id)

        # Profiles
        prof_r1 = RecruiterProfile(user_id=recruiter_id, company_name="ErrHandling Inc", is_verified=True)
        prof_r2 = RecruiterProfile(user_id=recruiter2_id, company_name="OtherCorp", is_verified=True)
        db.add_all([prof_r1, prof_r2])
        db.commit()

        # Job Postings
        j1 = JobPosting(
            recruiter_id=recruiter_id,
            company_name="ErrHandling Inc",
            title="Software Test Engineer Intern",
            description="Testing and verification role",
            location="Remote",
            opportunity_type=OpportunityType.INTERNSHIP,
            employment_type=EmploymentType.FULL_TIME,
            is_active=True,
        )
        j2 = JobPosting(
            recruiter_id=recruiter2_id,
            company_name="OtherCorp",
            title="DevOps Intern",
            description="Infrastructure testing role",
            location="Remote",
            opportunity_type=OpportunityType.INTERNSHIP,
            employment_type=EmploymentType.PART_TIME,
            is_active=True,
        )
        db.add_all([j1, j2])
        db.commit()

        db.refresh(j1)
        db.refresh(j2)
        job_id = j1.id
        job2_id = j2.id

        # Application: Student 1 applies to Job 1
        app1 = Application(
            student_id=student_id,
            job_posting_id=job_id,
            status=ApplicationStatus.APPLIED,
        )
        db.add(app1)
        db.commit()
        db.refresh(app1)
        application_id = app1.id


# ==============================================================================
# 1. Authentication Error Tests
# ==============================================================================
def test_01_missing_auth_header_returns_401_structured():
    """Unauthenticated request returns 401 with AUTHENTICATION_REQUIRED."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    body = res.json()
    assert body["success"] is False
    assert "error_code" in body
    assert body["error_code"] == ErrorCode.AUTHENTICATION_REQUIRED.value
    assert "message" in body
    assert "detail" in body


def test_02_invalid_token_returns_401_structured():
    """Request with garbage bearer token returns 401 with INVALID_TOKEN."""
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not.a.valid.jwt.token"},
    )
    assert res.status_code == 401
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.INVALID_TOKEN.value


def test_03_expired_token_returns_401_structured():
    """Request with an expired JWT token returns 401 with TOKEN_EXPIRED."""
    expired_token = create_access_token(
        subject=student_id,
        expires_delta=timedelta(seconds=-60),
    )
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.TOKEN_EXPIRED.value


# ==============================================================================
# 2. Authorization & RBAC Error Tests
# ==============================================================================
def test_04_wrong_role_returns_403_structured():
    """Student accessing admin-only endpoint returns 403 with FORBIDDEN."""
    res = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res.status_code == 403
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.FORBIDDEN.value
    assert "message" in body
    assert "Not enough permissions" in body["message"]


def test_05_unauthorized_ownership_access_returns_403():
    """Student 2 attempting to view Student 1's private application returns 403."""
    res = client.get(
        f"/api/v1/applications/{application_id}",
        headers={"Authorization": f"Bearer {student2_token}"},
    )
    assert res.status_code == 403
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] in (
        ErrorCode.RESOURCE_OWNERSHIP_ERROR.value,
        ErrorCode.FORBIDDEN.value,
    )


def test_06_recruiter_cannot_update_another_recruiters_application():
    """Recruiter 2 modifying application for Recruiter 1's posting returns 403."""
    res = client.patch(
        f"/api/v1/recruiter/applications/{application_id}",
        headers={"Authorization": f"Bearer {recruiter2_token}"},
        json={"status": "shortlisted"},
    )
    assert res.status_code == 403
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] in (
        ErrorCode.RESOURCE_OWNERSHIP_ERROR.value,
        ErrorCode.FORBIDDEN.value,
    )


# ==============================================================================
# 3. Not Found (404) Error Tests
# ==============================================================================
def test_07_resource_not_found_returns_404_structured():
    """Requesting nonexistent job returns 404 with NOT_FOUND."""
    res = client.get(
        "/api/v1/jobs/999999",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res.status_code == 404
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.NOT_FOUND.value
    assert "message" in body
    assert "detail" in body


def test_08_nonexistent_application_returns_404():
    """Requesting nonexistent application returns 404 with NOT_FOUND."""
    res = client.get(
        "/api/v1/applications/999999",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res.status_code == 404
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.NOT_FOUND.value


# ==============================================================================
# 4. Conflict (409) Error Tests
# ==============================================================================
def test_09_duplicate_application_returns_409_structured():
    """Re-applying to the same job returns 409 with DUPLICATE_APPLICATION."""
    res = client.post(
        f"/api/v1/jobs/{job_id}/applications",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"cover_message": "Trying to apply a second time"},
    )
    assert res.status_code == 409
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.DUPLICATE_APPLICATION.value
    assert "already applied" in body["message"].lower()


def test_10_duplicate_saved_job_returns_409_structured():
    """Saving the same job twice returns 409 with RESOURCE_CONFLICT."""
    # First save succeeds (201)
    res1 = client.post(
        f"/api/v1/jobs/{job_id}/save",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res1.status_code == 201

    # Second save returns 409
    res2 = client.post(
        f"/api/v1/jobs/{job_id}/save",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res2.status_code == 409
    body = res2.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.RESOURCE_CONFLICT.value

    # Cleanup saved job
    client.delete(
        f"/api/v1/jobs/{job_id}/save",
        headers={"Authorization": f"Bearer {student_token}"},
    )


def test_11_conflicting_interview_schedule_returns_409():
    """Scheduling overlapping interviews returns 409 with RESOURCE_CONFLICT."""
    now = datetime.now(timezone.utc)
    interview_time = now + timedelta(days=10)

    # Schedule first interview
    res1 = client.post(
        f"/api/v1/applications/{application_id}/interviews",
        headers={"Authorization": f"Bearer {recruiter_token}"},
        json={
            "scheduled_at": interview_time.isoformat(),
            "duration_minutes": 60,
            "interview_type": "online",
            "location_or_link": "https://meet.careerbridge.io/test-err-1",
        },
    )
    assert res1.status_code == 201
    int_id = res1.json()["id"]

    # Attempt to schedule conflicting interview at exact same time
    res2 = client.post(
        f"/api/v1/applications/{application_id}/interviews",
        headers={"Authorization": f"Bearer {recruiter_token}"},
        json={
            "scheduled_at": interview_time.isoformat(),
            "duration_minutes": 30,
            "interview_type": "online",
            "location_or_link": "https://meet.careerbridge.io/test-err-2",
        },
    )
    assert res2.status_code == 409
    body = res2.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.RESOURCE_CONFLICT.value

    # Cleanup interview
    with SessionLocal() as db:
        it = db.scalar(select(Interview).where(Interview.id == int_id))
        if it:
            db.delete(it)
            db.commit()


# ==============================================================================
# 5. Validation (422) Error Tests
# ==============================================================================
def test_12_invalid_request_body_returns_422_structured():
    """Missing required field in request body returns 422 with VALIDATION_ERROR."""
    res = client.post(
        "/api/v1/users",
        json={"email": "incomplete@example.com"},  # missing password
    )
    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.VALIDATION_ERROR.value
    assert isinstance(body["detail"], list)
    assert len(body["detail"]) > 0


def test_13_invalid_enum_value_returns_422_structured():
    """Invalid enum value returns 422 with VALIDATION_ERROR."""
    res = client.post(
        "/api/v1/users",
        json={
            "email": "bad.enum@example.com",
            "password": "Password123!",
            "role": "super_mega_admin",  # invalid role enum
        },
    )
    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.VALIDATION_ERROR.value


def test_14_invalid_pagination_returns_422_structured():
    """Pagination outside allowed range (e.g. page_size=0, page=0) returns 422."""
    res_zero_page = client.get(
        "/api/v1/admin/users?page=0",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_zero_page.status_code == 422
    assert res_zero_page.json()["error_code"] == ErrorCode.VALIDATION_ERROR.value

    res_large_size = client.get(
        "/api/v1/admin/users?page_size=500",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_large_size.status_code == 422
    assert res_large_size.json()["error_code"] == ErrorCode.VALIDATION_ERROR.value


# ==============================================================================
# 6. File Upload Validation & Error Tests
# ==============================================================================
def test_15_invalid_file_extension_upload_returns_400():
    """Uploading an executable or script returns 400 with INVALID_FILE_TYPE."""
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00"
    files = {"file": ("malicious.exe", fake_exe, "application/octet-stream")}
    res = client.post(
        "/api/v1/resume",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
    )
    assert res.status_code == 400
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.INVALID_FILE_TYPE.value


def test_16_oversized_file_upload_returns_appropriate_error():
    """Uploading file exceeding maximum size returns FILE_TOO_LARGE."""
    # 6MB payload (exceeds 5MB resume limit)
    oversized_data = b"%PDF-1.4 " + (b"0" * (6 * 1024 * 1024))
    files = {"file": ("huge_resume.pdf", oversized_data, "application/pdf")}
    res = client.post(
        "/api/v1/resume",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
    )
    assert res.status_code in (400, 413)
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.FILE_TOO_LARGE.value


# ==============================================================================
# 7. Unexpected Server Error (500) & Security Leakage Tests
# ==============================================================================
def test_17_unexpected_exception_returns_500_without_traceback():
    """Simulated unhandled server exception returns 500 without stack trace leakage."""
    client_500 = TestClient(app, raise_server_exceptions=False)
    res = client_500.get("/test-error-500")
    assert res.status_code == 500
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == ErrorCode.INTERNAL_SERVER_ERROR.value
    assert "unexpected" in body["message"].lower()

    # Verify no stack trace or internal python keywords are leaked
    raw_text = res.text.lower()
    assert "traceback" not in raw_text
    assert "runtimeerror" not in raw_text
    assert "file \"" not in raw_text
    assert "line " not in raw_text


def test_18_error_responses_contain_no_credentials_or_secrets():
    """Error responses must strictly not leak passwords, hashes, secrets, or DB paths."""
    res_bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": TEST_STUDENT_EMAIL, "password": "WrongPassword123!"},
    )
    assert res_bad_login.status_code == 401
    body_str = res_bad_login.text.lower()

    forbidden_terms = [
        "password_hash",
        "secret_key",
        "postgresql://",
        "jwt_secret",
        TEST_PASSWORD.lower(),
        "bcrypt",
    ]
    for term in forbidden_terms:
        assert term not in body_str, f"Found leaked term '{term}' in error response!"


# ==============================================================================
# 8. Domain Exception Unit Hierarchy Tests
# ==============================================================================
def test_19_app_exception_hierarchy():
    """Verify custom domain AppException classes initialize correctly with expected codes."""
    exc_nf = NotFoundException("Item missing")
    assert exc_nf.status_code == 404
    assert exc_nf.error_code == ErrorCode.NOT_FOUND.value

    exc_auth = AuthenticationRequiredException()
    assert exc_auth.status_code == 401
    assert exc_auth.error_code == ErrorCode.AUTHENTICATION_REQUIRED.value

    exc_tok = InvalidTokenException()
    assert exc_tok.status_code == 401
    assert exc_tok.error_code == ErrorCode.INVALID_TOKEN.value

    exc_exp = TokenExpiredException()
    assert exc_exp.status_code == 401
    assert exc_exp.error_code == ErrorCode.TOKEN_EXPIRED.value

    exc_forbid = ForbiddenException()
    assert exc_forbid.status_code == 403
    assert exc_forbid.error_code == ErrorCode.FORBIDDEN.value

    exc_owner = ResourceOwnershipException()
    assert exc_owner.status_code == 403
    assert exc_owner.error_code == ErrorCode.RESOURCE_OWNERSHIP_ERROR.value

    exc_dup_app = DuplicateApplicationException()
    assert exc_dup_app.status_code == 409
    assert exc_dup_app.error_code == ErrorCode.DUPLICATE_APPLICATION.value

    exc_dup_res = DuplicateResourceException()
    assert exc_dup_res.status_code == 409
    assert exc_dup_res.error_code == ErrorCode.RESOURCE_CONFLICT.value

    exc_file_lg = FileTooLargeException()
    assert exc_file_lg.error_code == ErrorCode.FILE_TOO_LARGE.value

    exc_file_typ = InvalidFileTypeException()
    assert exc_file_typ.error_code == ErrorCode.INVALID_FILE_TYPE.value

    exc_500 = InternalServerException()
    assert exc_500.status_code == 500
    assert exc_500.error_code == ErrorCode.INTERNAL_SERVER_ERROR.value

    exc_rate = RateLimitExceededException(message="Too many login attempts", retry_after=45)
    assert exc_rate.status_code == 429
    assert exc_rate.error_code == ErrorCode.RATE_LIMIT_EXCEEDED.value
    assert exc_rate.headers == {"Retry-After": "45"}


def test_20_error_code_derivation_mapping():
    """Verify _derive_error_code maps HTTP status codes and error messages correctly."""
    from app.core.error_handlers import _derive_error_code

    assert _derive_error_code(400, "File size exceeds maximum allowed") == ErrorCode.FILE_TOO_LARGE.value
    assert _derive_error_code(400, "Unsupported file extension") == ErrorCode.INVALID_FILE_TYPE.value
    assert _derive_error_code(400, "Invalid resource state") == ErrorCode.INVALID_STATE.value
    assert _derive_error_code(401, "Token has expired") == ErrorCode.TOKEN_EXPIRED.value
    assert _derive_error_code(401, "Invalid token provided") == ErrorCode.INVALID_TOKEN.value
    assert _derive_error_code(401, "Authentication credentials missing") == ErrorCode.AUTHENTICATION_REQUIRED.value
    assert _derive_error_code(403, "Not authorized to modify this resource") == ErrorCode.RESOURCE_OWNERSHIP_ERROR.value
    assert _derive_error_code(403, "Not enough permissions") == ErrorCode.FORBIDDEN.value
    assert _derive_error_code(404, "Job not found") == ErrorCode.NOT_FOUND.value
    assert _derive_error_code(409, "You have already applied for this internship.") == ErrorCode.DUPLICATE_APPLICATION.value
    assert _derive_error_code(409, "A resource with these details already exists") == ErrorCode.RESOURCE_CONFLICT.value
    assert _derive_error_code(413, "Payload too large") == ErrorCode.FILE_TOO_LARGE.value
    assert _derive_error_code(415, "Unsupported media type") == ErrorCode.INVALID_FILE_TYPE.value
    assert _derive_error_code(422, "Request validation failed") == ErrorCode.VALIDATION_ERROR.value
    assert _derive_error_code(429, "Too many requests. Please try again later.") == ErrorCode.RATE_LIMIT_EXCEEDED.value
    assert _derive_error_code(500, "Internal server error") == ErrorCode.INTERNAL_SERVER_ERROR.value
    assert _derive_error_code(503, "Database connection failed") == ErrorCode.INTERNAL_SERVER_ERROR.value


def run_all_tests():
    """Execute all tests sequentially."""
    print("=" * 70)
    print("RUNNING CAREERBRIDGE PHASE 23 VALIDATION & ERROR HANDLING TEST SUITE")
    print("=" * 70)

    setup_module()
    tests = [
        test_01_missing_auth_header_returns_401_structured,
        test_02_invalid_token_returns_401_structured,
        test_03_expired_token_returns_401_structured,
        test_04_wrong_role_returns_403_structured,
        test_05_unauthorized_ownership_access_returns_403,
        test_06_recruiter_cannot_update_another_recruiters_application,
        test_07_resource_not_found_returns_404_structured,
        test_08_nonexistent_application_returns_404,
        test_09_duplicate_application_returns_409_structured,
        test_10_duplicate_saved_job_returns_409_structured,
        test_11_conflicting_interview_schedule_returns_409,
        test_12_invalid_request_body_returns_422_structured,
        test_13_invalid_enum_value_returns_422_structured,
        test_14_invalid_pagination_returns_422_structured,
        test_15_invalid_file_extension_upload_returns_400,
        test_16_oversized_file_upload_returns_appropriate_error,
        test_17_unexpected_exception_returns_500_without_traceback,
        test_18_error_responses_contain_no_credentials_or_secrets,
        test_19_app_exception_hierarchy,
        test_20_error_code_derivation_mapping,
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
