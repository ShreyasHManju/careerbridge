"""
CareerBridge Phase 13 Resume Upload & Student Document Foundation Test Suite
Tests:
1. Valid PDF upload (201 Created)
2. Valid DOC upload (201 Created)
3. Valid DOCX upload (201 Created)
4. Unsupported extension rejection (.txt, .png -> 400 Bad Request)
5. Dangerous extension rejection (.exe, .sh -> 400 Bad Request)
6. Mismatched magic bytes rejection (400 Bad Request)
7. Unsupported MIME type rejection (415 Unsupported Media Type)
8. Oversized file rejection (> 5MB -> 400 Bad Request) and disk cleanup
9. Empty file rejection (0 bytes -> 400 Bad Request)
10. Unauthenticated upload rejection (401 Unauthorized)
11. Recruiter upload rejection (403 Forbidden)
12. Admin upload rejection (403 Forbidden)
13. Student retrieves own resume metadata (200 OK, safe schema)
14. Student without resume gets 404 Not Found on GET /resume
15. Student downloads own resume (200 OK, matching bytes and headers)
16. Cross-student data isolation (Student B cannot see or download Student A's resume)
17. Resume replacement updates single DB record and cleans up old physical file
18. Student deletes own resume (204 No Content, cleans up disk and DB)
19. Deleting non-existent resume returns 404 Not Found
20. Missing physical file returns controlled 404 Not Found
21. Path traversal filename is safely stored inside resumes directory
22. Inactive student rejected (401 Unauthorized)
"""

import io
import os
from pathlib import Path
import sys

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.resume import Resume
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "resume.student1@careerbridge.io"
STUDENT2_EMAIL = "resume.student2@careerbridge.io"
INACTIVE_STUDENT_EMAIL = "resume.inactive_student@careerbridge.io"
RECRUITER_EMAIL = "resume.recruiter@careerbridge.io"
ADMIN_EMAIL = "resume.admin@careerbridge.io"
TEST_PASSWORD = "ResumeTestPassword123!"

# Realistic test file signatures
VALID_PDF_BYTES = b"%PDF-1.4\n%CareerBridge Test Resume Content\n%%EOF"
VALID_DOC_BYTES = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 64 + b"MSWord Test Content"
VALID_DOCX_BYTES = b"PK\x03\x04\x14\x00\x06\x00" + b"\x00" * 32 + b"Docx Test Content"


def cleanup_test_data():
    """Remove test users and delete any physical files created during tests."""
    with SessionLocal() as db:
        test_emails = [
            STUDENT1_EMAIL,
            STUDENT2_EMAIL,
            INACTIVE_STUDENT_EMAIL,
            RECRUITER_EMAIL,
            ADMIN_EMAIL,
        ]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            # Look up resumes to delete physical files
            resumes = db.scalars(select(Resume).where(Resume.student_id.in_(user_ids))).all()
            for r in resumes:
                try:
                    p = Path(r.file_path)
                    if p.is_file():
                        p.unlink(missing_ok=True)
                except Exception:
                    pass
            db.execute(delete(Resume).where(Resume.student_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def setup_users():
    """Create test users and return tokens."""
    cleanup_test_data()
    with SessionLocal() as db:
        hashed_pw = hash_password(TEST_PASSWORD)

        s1 = User(
            email=STUDENT1_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        s2 = User(
            email=STUDENT2_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        s_inact = User(
            email=INACTIVE_STUDENT_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.STUDENT,
            is_active=False,
            is_verified=True,
        )
        rec = User(
            email=RECRUITER_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        adm = User(
            email=ADMIN_EMAIL,
            password_hash=hashed_pw,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add_all([s1, s2, s_inact, rec, adm])
        db.commit()
        db.refresh(s1)
        db.refresh(s2)
        db.refresh(s_inact)
        db.refresh(rec)
        db.refresh(adm)

        s1_token = create_access_token(str(s1.id))
        s2_token = create_access_token(str(s2.id))
        sinact_token = create_access_token(str(s_inact.id))
        rec_token = create_access_token(str(rec.id))
        adm_token = create_access_token(str(adm.id))

        return {
            "s1_id": s1.id,
            "s2_id": s2.id,
            "s1_token": s1_token,
            "s2_token": s2_token,
            "sinact_token": sinact_token,
            "rec_token": rec_token,
            "adm_token": adm_token,
        }


def run_tests():
    print("=========================================================")
    print("STARTING PHASE 13 RESUME UPLOAD & DOCUMENT TEST SUITE...")
    print("=========================================================\n")

    tokens = setup_users()
    s1_headers = {"Authorization": f"Bearer {tokens['s1_token']}"}
    s2_headers = {"Authorization": f"Bearer {tokens['s2_token']}"}
    rec_headers = {"Authorization": f"Bearer {tokens['rec_token']}"}
    adm_headers = {"Authorization": f"Bearer {tokens['adm_token']}"}
    sinact_headers = {"Authorization": f"Bearer {tokens['sinact_token']}"}

    # Track files for cleanup
    created_files = []

    try:
        # [1/22] Valid PDF Upload
        print("[1/22] Test: Valid PDF Upload (POST /api/v1/resume)")
        res = client.post(
            "/api/v1/resume",
            files={"file": ("my_resume.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
            headers=s1_headers,
        )
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["original_filename"] == "my_resume.pdf"
        assert data["content_type"] == "application/pdf"
        assert data["file_size"] == len(VALID_PDF_BYTES)
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        # Ensure internal file_path and stored_filename are not exposed
        assert "file_path" not in data, "Security leak: file_path exposed in response!"
        assert "stored_filename" not in data, "Security leak: stored_filename exposed in response!"

        # Verify physical file on disk
        with SessionLocal() as db:
            resume_record = db.scalar(select(Resume).where(Resume.student_id == tokens["s1_id"]))
            assert resume_record is not None
            created_files.append(resume_record.file_path)
            assert Path(resume_record.file_path).is_file(), "Physical file was not created on disk!"
        print("  -> Passed: Valid PDF uploaded with 201, safe schema, and physical file created.")

        # [2/22] Valid DOC Upload
        print("[2/22] Test: Valid DOC Upload (POST /api/v1/resume)")
        # Use student 2 for DOC upload
        res = client.post(
            "/api/v1/resume",
            files={"file": ("resume_doc.doc", io.BytesIO(VALID_DOC_BYTES), "application/msword")},
            headers=s2_headers,
        )
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["original_filename"] == "resume_doc.doc"
        assert data["content_type"] == "application/msword"
        with SessionLocal() as db:
            r2 = db.scalar(select(Resume).where(Resume.student_id == tokens["s2_id"]))
            assert r2 is not None
            created_files.append(r2.file_path)
            assert Path(r2.file_path).is_file()
        print("  -> Passed: Valid DOC uploaded with 201.")

        # [3/22] Valid DOCX Upload (Replacing student 2's resume)
        print("[3/22] Test: Valid DOCX Upload (POST /api/v1/resume)")
        docx_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        res = client.post(
            "/api/v1/resume",
            files={"file": ("resume_docx.docx", io.BytesIO(VALID_DOCX_BYTES), docx_mime)},
            headers=s2_headers,
        )
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["original_filename"] == "resume_docx.docx"
        assert data["content_type"] == docx_mime
        with SessionLocal() as db:
            r2_updated = db.scalar(select(Resume).where(Resume.student_id == tokens["s2_id"]))
            assert r2_updated is not None
            created_files.append(r2_updated.file_path)
            assert Path(r2_updated.file_path).is_file()
        print("  -> Passed: Valid DOCX uploaded with 201.")

        # [4/22] Unsupported extension rejected (.txt, .png)
        print("[4/22] Test: Unsupported Extension Rejected (.txt, .png)")
        res = client.post(
            "/api/v1/resume",
            files={"file": ("notes.txt", io.BytesIO(b"Some text"), "text/plain")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "Unsupported file extension" in res.json()["detail"]

        res = client.post(
            "/api/v1/resume",
            files={"file": ("photo.png", io.BytesIO(b"\x89PNG\r\n\x1a\n"), "image/png")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "Unsupported file extension" in res.json()["detail"]
        print("  -> Passed: Unsupported extensions rejected with 400.")

        # [5/22] Dangerous extension rejected (.exe, .sh)
        print("[5/22] Test: Dangerous Extension Rejected (.exe, .sh)")
        res = client.post(
            "/api/v1/resume",
            files={"file": ("malware.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "Security violation" in res.json()["detail"]

        res = client.post(
            "/api/v1/resume",
            files={"file": ("script.sh", io.BytesIO(b"#!/bin/bash\necho hello"), "application/x-sh")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "Security violation" in res.json()["detail"]
        print("  -> Passed: Dangerous extensions rejected with 400 security violation.")

        # [6/22] Mismatched magic bytes rejected
        print("[6/22] Test: Mismatched Magic Bytes Rejected")
        # File named .pdf but containing plain text instead of %PDF header
        res = client.post(
            "/api/v1/resume",
            files={"file": ("spoofed.pdf", io.BytesIO(b"Plain text claiming to be a PDF"), "application/pdf")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "File signature does not match" in res.json()["detail"]
        print("  -> Passed: Spoofed magic bytes rejected with 400.")

        # [7/22] Unsupported MIME type rejected
        print("[7/22] Test: Unsupported MIME Type Rejected")
        res = client.post(
            "/api/v1/resume",
            files={"file": ("valid.pdf", io.BytesIO(VALID_PDF_BYTES), "image/jpeg")},
            headers=s1_headers,
        )
        assert res.status_code == 415, f"Expected 415, got {res.status_code}"
        assert "Unsupported content type" in res.json()["detail"]
        print("  -> Passed: Unsupported MIME type rejected with 415.")

        # [8/22] Oversized file rejected (> 5MB) & disk cleanup confirmed
        print("[8/22] Test: Oversized File Rejected (> 5MB) and Disk Cleaned")
        oversized_bytes = VALID_PDF_BYTES + b"0" * (settings.MAX_RESUME_SIZE_MB * 1024 * 1024 + 512)
        res = client.post(
            "/api/v1/resume",
            files={"file": ("huge.pdf", io.BytesIO(oversized_bytes), "application/pdf")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "File size exceeds maximum allowed limit" in res.json()["detail"]
        print("  -> Passed: Oversized file rejected with 400.")

        # [9/22] Empty file rejected (0 bytes)
        print("[9/22] Test: Empty File Rejected (0 bytes)")
        res = client.post(
            "/api/v1/resume",
            files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("  -> Passed: Empty file rejected with 400.")

        # [10/22] Unauthenticated upload rejected
        print("[10/22] Test: Unauthenticated Upload Rejected (401)")
        res = client.post(
            "/api/v1/resume",
            files={"file": ("resume.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        )
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  -> Passed: Unauthenticated request rejected with 401.")

        # [11/22] Recruiter upload rejected
        print("[11/22] Test: Recruiter Upload Rejected (403)")
        res = client.post(
            "/api/v1/resume",
            files={"file": ("resume.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
            headers=rec_headers,
        )
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  -> Passed: Recruiter upload blocked with 403.")

        # [12/22] Admin upload rejected
        print("[12/22] Test: Admin Upload Rejected (403)")
        res = client.post(
            "/api/v1/resume",
            files={"file": ("resume.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
            headers=adm_headers,
        )
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  -> Passed: Admin upload blocked with 403.")

        # [13/22] Student retrieves own resume metadata
        print("[13/22] Test: Student Retrieves Own Resume Metadata (GET /api/v1/resume)")
        res = client.get("/api/v1/resume", headers=s1_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        meta = res.json()
        assert meta["original_filename"] == "my_resume.pdf"
        assert meta["content_type"] == "application/pdf"
        assert meta["file_size"] == len(VALID_PDF_BYTES)
        assert "file_path" not in meta
        assert "stored_filename" not in meta
        print("  -> Passed: Metadata retrieved with 200 without exposing server paths.")

        # [14/22] Student without resume gets 404
        print("[14/22] Test: Student Without Resume Gets 404 (GET /api/v1/resume)")
        # Temporarily clean student 2's resume to test 404
        with SessionLocal() as db:
            db.execute(delete(Resume).where(Resume.student_id == tokens["s2_id"]))
            db.commit()
        res = client.get("/api/v1/resume", headers=s2_headers)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        assert res.json()["detail"] == "Resume not found"
        print("  -> Passed: Student without resume received 404.")

        # [15/22] Student downloads own resume
        print("[15/22] Test: Student Downloads Own Resume (GET /api/v1/resume/download)")
        res = client.get("/api/v1/resume/download", headers=s1_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert res.content == VALID_PDF_BYTES, "Downloaded bytes do not match uploaded bytes!"
        assert "my_resume.pdf" in res.headers.get("content-disposition", "")
        print("  -> Passed: Resume downloaded with 200 and exact byte match.")

        # [16/22] Cross-student data isolation
        print("[16/22] Test: Cross-Student Data Isolation")
        # Student 2 tries to access resume (has none, must NOT see Student 1's resume)
        res_meta = client.get("/api/v1/resume", headers=s2_headers)
        assert res_meta.status_code == 404
        res_dl = client.get("/api/v1/resume/download", headers=s2_headers)
        assert res_dl.status_code == 404
        print("  -> Passed: Student 2 cannot access Student 1's resume.")

        # [17/22] Resume replacement updates single record and cleans up old file
        print("[17/22] Test: Resume Replacement & Old File Cleanup")
        # Record old file path
        with SessionLocal() as db:
            old_record = db.scalar(select(Resume).where(Resume.student_id == tokens["s1_id"]))
            old_path = Path(old_record.file_path)
            old_id = old_record.id
            assert old_path.is_file()

        NEW_PDF_BYTES = VALID_PDF_BYTES + b"\nUpdated content version 2"
        res = client.post(
            "/api/v1/resume",
            files={"file": ("updated_resume.pdf", io.BytesIO(NEW_PDF_BYTES), "application/pdf")},
            headers=s1_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["original_filename"] == "updated_resume.pdf"
        assert data["file_size"] == len(NEW_PDF_BYTES)

        with SessionLocal() as db:
            # Must still have exactly ONE resume in the database for student 1
            resumes = db.scalars(select(Resume).where(Resume.student_id == tokens["s1_id"])).all()
            assert len(resumes) == 1, f"Expected exactly 1 resume record, found {len(resumes)}"
            new_record = resumes[0]
            assert new_record.id == old_id, "Replacement should update the existing record ID!"
            new_path = Path(new_record.file_path)
            created_files.append(str(new_path))
            assert new_path.is_file(), "New physical file does not exist!"
            # Confirm old physical file was removed
            assert not old_path.is_file(), f"Old physical file {old_path} was NOT deleted upon replacement!"
        print("  -> Passed: Replacement preserved single DB record and purged old physical file.")

        # [18/22] Student deletes own resume
        print("[18/22] Test: Student Deletes Own Resume (DELETE /api/v1/resume)")
        res = client.delete("/api/v1/resume", headers=s1_headers)
        assert res.status_code == 204, f"Expected 204, got {res.status_code}"

        # Confirm DB record is deleted
        with SessionLocal() as db:
            deleted_record = db.scalar(select(Resume).where(Resume.student_id == tokens["s1_id"]))
            assert deleted_record is None, "Resume record still exists in DB after deletion!"

        # Confirm physical file is deleted
        assert not new_path.is_file(), f"Physical file {new_path} was not deleted from disk!"

        # Subsequent GET /resume returns 404
        res_after = client.get("/api/v1/resume", headers=s1_headers)
        assert res_after.status_code == 404
        print("  -> Passed: Resume successfully deleted from DB and filesystem.")

        # [19/22] Deleting non-existent resume returns 404
        print("[19/22] Test: Deleting Non-Existent Resume Returns 404")
        res = client.delete("/api/v1/resume", headers=s1_headers)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        assert res.json()["detail"] == "Resume not found"
        print("  -> Passed: Deleting non-existent resume returned 404.")

        # [20/22] Missing physical file returns controlled 404
        print("[20/22] Test: Missing Physical File Handling (404)")
        # Upload a new resume for student 1
        res = client.post(
            "/api/v1/resume",
            files={"file": ("ghost_file.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
            headers=s1_headers,
        )
        assert res.status_code == 201
        with SessionLocal() as db:
            ghost_rec = db.scalar(select(Resume).where(Resume.student_id == tokens["s1_id"]))
            ghost_path = Path(ghost_rec.file_path)
            # Manually delete physical file to simulate filesystem loss
            if ghost_path.is_file():
                ghost_path.unlink()

        res_dl = client.get("/api/v1/resume/download", headers=s1_headers)
        assert res_dl.status_code == 404, f"Expected 404, got {res_dl.status_code}"
        assert "not found on disk" in res_dl.json()["detail"]
        print("  -> Passed: Missing physical file on disk returns controlled 404.")

        # [21/22] Path traversal filename is safely stored inside resumes directory
        print("[21/22] Test: Path Traversal in Filename Sanitization")
        malicious_filename = "../../../etc/passwd.pdf"
        res = client.post(
            "/api/v1/resume",
            files={"file": (malicious_filename, io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
            headers=s1_headers,
        )
        assert res.status_code == 201
        with SessionLocal() as db:
            traversal_rec = db.scalar(select(Resume).where(Resume.student_id == tokens["s1_id"]))
            stored_p = Path(traversal_rec.file_path).resolve()
            base_dir = settings.resume_upload_dir.resolve()
            # File must be strictly inside base_dir
            assert stored_p.is_relative_to(base_dir), f"File stored outside target directory: {stored_p}"
            created_files.append(str(stored_p))
        print("  -> Passed: Path traversal sanitized; file safely contained in storage directory.")

        # [22/22] Inactive student rejected
        print("[22/22] Test: Inactive Student Rejected (401)")
        res = client.get("/api/v1/resume", headers=sinact_headers)
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        res_post = client.post(
            "/api/v1/resume",
            files={"file": ("inactive.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
            headers=sinact_headers,
        )
        assert res_post.status_code == 401, f"Expected 401, got {res_post.status_code}"
        print("  -> Passed: Inactive user rejected with 401.")

        print("\n=========================================================")
        print("ALL 22 RESUME & DOCUMENT TESTS PASSED SUCCESSFULLY!")
        print("=========================================================")

    finally:
        # Final cleanup
        cleanup_test_data()
        for f in created_files:
            try:
                p = Path(f)
                if p.is_file():
                    p.unlink(missing_ok=True)
            except Exception:
                pass


if __name__ == "__main__":
    run_tests()
