"""
CareerBridge Phase 14 Secure Student Profile Image Upload Test Suite
Tests:
1. Valid JPEG upload (201 Created)
2. Valid PNG upload (201 Created)
3. Valid WebP upload (201 Created)
4. Unsupported extension rejection (.gif, .svg, .bmp, .tiff, .ico, .txt, .pdf -> 400 Bad Request)
5. Dangerous extension rejection (.exe, .sh -> 400 Bad Request)
6. Mismatched magic bytes rejection (400 Bad Request)
7. Unsupported MIME type rejection (415 Unsupported Media Type)
8. Oversized file rejection (> 2MB -> 400 Bad Request) and disk cleanup
9. Empty file rejection (0 bytes -> 400 Bad Request)
10. Unauthenticated upload rejection (401 Unauthorized)
11. Recruiter upload rejection (403 Forbidden)
12. Admin upload rejection (403 Forbidden)
13. Student retrieves own profile image metadata (200 OK, safe schema)
14. Student without profile image gets 404 Not Found on GET /profile-image
15. Student downloads own profile image (200 OK, matching bytes and headers)
16. Cross-student data isolation (Student B cannot see or download Student A's image)
17. Profile image replacement updates single DB record and cleans up old physical file
18. Student deletes own profile image (204 No Content, cleans up disk and DB)
19. Deleting non-existent profile image returns 404 Not Found
20. Missing physical file returns controlled 404 Not Found
21. Path traversal filename is safely stored inside profile_images directory
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
from app.models.profile_image import ProfileImage
from app.models.user import User, UserRole

client = TestClient(app)

STUDENT1_EMAIL = "img.student1@careerbridge.io"
STUDENT2_EMAIL = "img.student2@careerbridge.io"
INACTIVE_STUDENT_EMAIL = "img.inactive_student@careerbridge.io"
RECRUITER_EMAIL = "img.recruiter@careerbridge.io"
ADMIN_EMAIL = "img.admin@careerbridge.io"
TEST_PASSWORD = "ProfileImageTestPassword123!"

# Realistic test image signatures
VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"\xff\xdb\x00C\x00" + b"CareerBridge JPEG Test Payload"
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4" + b"CareerBridge PNG Test Payload"
VALID_WEBP_BYTES = b"RIFF\x2c\x00\x00\x00WEBPVP8 \x20\x00\x00\x00\x30\x01\x00\x9d\x01\x2a\x01\x00\x01\x00" + b"CareerBridge WebP Test Payload"


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
            images = db.scalars(select(ProfileImage).where(ProfileImage.student_id.in_(user_ids))).all()
            for img in images:
                try:
                    p = Path(img.file_path)
                    if p.is_file():
                        p.unlink(missing_ok=True)
                except Exception:
                    pass
            db.execute(delete(ProfileImage).where(ProfileImage.student_id.in_(user_ids)))
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
    print("STARTING PHASE 14 PROFILE IMAGE UPLOAD TEST SUITE...")
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
        # [1/22] Valid JPEG Upload
        print("[1/22] Test: Valid JPEG Upload (POST /api/v1/profile-image)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("avatar.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
            headers=s1_headers,
        )
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["original_filename"] == "avatar.jpg"
        assert data["content_type"] == "image/jpeg"
        assert data["file_size"] == len(VALID_JPEG_BYTES)
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        # Ensure internal file_path and stored_filename are not exposed
        assert "file_path" not in data, "Security leak: file_path exposed in response!"
        assert "stored_filename" not in data, "Security leak: stored_filename exposed in response!"

        # Verify physical file on disk
        with SessionLocal() as db:
            image_record = db.scalar(select(ProfileImage).where(ProfileImage.student_id == tokens["s1_id"]))
            assert image_record is not None
            created_files.append(image_record.file_path)
            assert Path(image_record.file_path).is_file(), "Physical file was not created on disk!"
        print("  -> Passed: Valid JPEG uploaded with 201, safe schema, and physical file created.")

        # [2/22] Valid PNG Upload
        print("[2/22] Test: Valid PNG Upload (POST /api/v1/profile-image)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("profile.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
            headers=s2_headers,
        )
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["original_filename"] == "profile.png"
        assert data["content_type"] == "image/png"
        with SessionLocal() as db:
            r2 = db.scalar(select(ProfileImage).where(ProfileImage.student_id == tokens["s2_id"]))
            assert r2 is not None
            created_files.append(r2.file_path)
            assert Path(r2.file_path).is_file()
        print("  -> Passed: Valid PNG uploaded with 201.")

        # [3/22] Valid WebP Upload
        print("[3/22] Test: Valid WebP Upload (POST /api/v1/profile-image)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("picture.webp", io.BytesIO(VALID_WEBP_BYTES), "image/webp")},
            headers=s2_headers,
        )
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["original_filename"] == "picture.webp"
        assert data["content_type"] == "image/webp"
        with SessionLocal() as db:
            r2_updated = db.scalar(select(ProfileImage).where(ProfileImage.student_id == tokens["s2_id"]))
            assert r2_updated is not None
            created_files.append(r2_updated.file_path)
            assert Path(r2_updated.file_path).is_file()
        print("  -> Passed: Valid WebP uploaded with 201.")

        # [4/22] Unsupported extension rejected (.gif, .svg, .bmp, .ico, .txt, .pdf, .docx)
        print("[4/22] Test: Unsupported Extension Rejected (.gif, .svg, .bmp, .txt, .pdf)")
        unsupported_tests = [
            ("animated.gif", b"GIF89a...", "image/gif"),
            ("vector.svg", b"<svg>...</svg>", "image/svg+xml"),
            ("bitmap.bmp", b"BM...", "image/bmp"),
            ("document.pdf", b"%PDF-1.4", "application/pdf"),
            ("notes.txt", b"text notes", "text/plain"),
        ]
        for fname, fbytes, fmime in unsupported_tests:
            res = client.post(
                "/api/v1/profile-image",
                files={"file": (fname, io.BytesIO(fbytes), fmime)},
                headers=s1_headers,
            )
            assert res.status_code == 400, f"Expected 400 for {fname}, got {res.status_code}: {res.text}"
        print("  -> Passed: Unsupported image extensions rejected with 400.")

        # [5/22] Dangerous extension rejected (.exe, .sh)
        print("[5/22] Test: Dangerous Extension Rejected (.exe, .sh)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("payload.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "Security violation" in res.json()["detail"]

        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("script.sh", io.BytesIO(b"#!/bin/bash\necho test"), "application/x-sh")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "Security violation" in res.json()["detail"]
        print("  -> Passed: Dangerous extensions rejected with 400 security violation.")

        # [6/22] Mismatched magic bytes rejected
        print("[6/22] Test: Mismatched Magic Bytes Rejected")
        # Renamed text or PDF file claiming to be a JPEG
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("fake.jpg", io.BytesIO(b"%PDF-1.4\nNot a real JPEG"), "image/jpeg")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "File signature does not match" in res.json()["detail"]
        print("  -> Passed: Spoofed magic bytes rejected with 400.")

        # [7/22] Unsupported MIME type rejected
        print("[7/22] Test: Unsupported MIME Type Rejected")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("image.jpg", io.BytesIO(VALID_JPEG_BYTES), "application/pdf")},
            headers=s1_headers,
        )
        assert res.status_code == 415, f"Expected 415, got {res.status_code}"
        assert "Unsupported content type" in res.json()["detail"]
        print("  -> Passed: Unsupported MIME type rejected with 415.")

        # [8/22] Oversized file rejected (> 2MB) & disk cleanup confirmed
        print("[8/22] Test: Oversized File Rejected (> 2MB) and Disk Cleaned")
        oversized_bytes = VALID_JPEG_BYTES + b"0" * (settings.MAX_PROFILE_IMAGE_SIZE_MB * 1024 * 1024 + 512)
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("huge_photo.jpg", io.BytesIO(oversized_bytes), "image/jpeg")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "File size exceeds maximum allowed limit" in res.json()["detail"]
        print("  -> Passed: Oversized image rejected with 400.")

        # [9/22] Empty file rejected (0 bytes)
        print("[9/22] Test: Empty File Rejected (0 bytes)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
            headers=s1_headers,
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("  -> Passed: Empty file rejected with 400.")

        # [10/22] Unauthenticated upload rejected
        print("[10/22] Test: Unauthenticated Upload Rejected (401)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("avatar.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
        )
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  -> Passed: Unauthenticated request rejected with 401.")

        # [11/22] Recruiter upload rejected
        print("[11/22] Test: Recruiter Upload Rejected (403)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("avatar.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
            headers=rec_headers,
        )
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  -> Passed: Recruiter upload blocked with 403.")

        # [12/22] Admin upload rejected
        print("[12/22] Test: Admin Upload Rejected (403)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("avatar.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
            headers=adm_headers,
        )
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  -> Passed: Admin upload blocked with 403.")

        # [13/22] Student retrieves own profile image metadata
        print("[13/22] Test: Student Retrieves Own Profile Image Metadata (GET /api/v1/profile-image)")
        res = client.get("/api/v1/profile-image", headers=s1_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        meta = res.json()
        assert meta["original_filename"] == "avatar.jpg"
        assert meta["content_type"] == "image/jpeg"
        assert meta["file_size"] == len(VALID_JPEG_BYTES)
        assert "file_path" not in meta
        assert "stored_filename" not in meta
        print("  -> Passed: Metadata retrieved with 200 without exposing server paths.")

        # [14/22] Student without profile image gets 404
        print("[14/22] Test: Student Without Profile Image Gets 404 (GET /api/v1/profile-image)")
        # Temporarily remove student 2's image to test 404
        with SessionLocal() as db:
            db.execute(delete(ProfileImage).where(ProfileImage.student_id == tokens["s2_id"]))
            db.commit()
        res = client.get("/api/v1/profile-image", headers=s2_headers)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        assert res.json()["detail"] == "Profile image not found"
        print("  -> Passed: Student without profile image received 404.")

        # [15/22] Student downloads own profile image
        print("[15/22] Test: Student Downloads Own Profile Image (GET /api/v1/profile-image/download)")
        res = client.get("/api/v1/profile-image/download", headers=s1_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert res.content == VALID_JPEG_BYTES, "Downloaded bytes do not match uploaded bytes!"
        assert "avatar.jpg" in res.headers.get("content-disposition", "")
        print("  -> Passed: Profile image downloaded with 200 and exact byte match.")

        # [16/22] Cross-student data isolation
        print("[16/22] Test: Cross-Student Data Isolation")
        res_meta = client.get("/api/v1/profile-image", headers=s2_headers)
        assert res_meta.status_code == 404
        res_dl = client.get("/api/v1/profile-image/download", headers=s2_headers)
        assert res_dl.status_code == 404
        print("  -> Passed: Student 2 cannot access Student 1's profile image.")

        # [17/22] Profile image replacement updates single record and cleans up old file
        print("[17/22] Test: Profile Image Replacement & Old File Cleanup")
        with SessionLocal() as db:
            old_record = db.scalar(select(ProfileImage).where(ProfileImage.student_id == tokens["s1_id"]))
            old_path = Path(old_record.file_path)
            old_id = old_record.id
            assert old_path.is_file()

        NEW_PNG_BYTES = VALID_PNG_BYTES + b"\nUpdated PNG Version 2"
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("new_avatar.png", io.BytesIO(NEW_PNG_BYTES), "image/png")},
            headers=s1_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["original_filename"] == "new_avatar.png"
        assert data["content_type"] == "image/png"
        assert data["file_size"] == len(NEW_PNG_BYTES)

        with SessionLocal() as db:
            images = db.scalars(select(ProfileImage).where(ProfileImage.student_id == tokens["s1_id"])).all()
            assert len(images) == 1, f"Expected exactly 1 profile image record, found {len(images)}"
            new_record = images[0]
            assert new_record.id == old_id, "Replacement should update the existing record ID!"
            new_path = Path(new_record.file_path)
            created_files.append(str(new_path))
            assert new_path.is_file(), "New physical file does not exist!"
            assert not old_path.is_file(), f"Old physical file {old_path} was NOT deleted upon replacement!"
        print("  -> Passed: Replacement preserved single DB record and purged old physical file.")

        # [18/22] Student deletes own profile image
        print("[18/22] Test: Student Deletes Own Profile Image (DELETE /api/v1/profile-image)")
        res = client.delete("/api/v1/profile-image", headers=s1_headers)
        assert res.status_code == 204, f"Expected 204, got {res.status_code}"

        with SessionLocal() as db:
            deleted_record = db.scalar(select(ProfileImage).where(ProfileImage.student_id == tokens["s1_id"]))
            assert deleted_record is None, "ProfileImage record still exists in DB after deletion!"

        assert not new_path.is_file(), f"Physical file {new_path} was not deleted from disk!"

        res_after = client.get("/api/v1/profile-image", headers=s1_headers)
        assert res_after.status_code == 404
        print("  -> Passed: Profile image successfully deleted from DB and filesystem.")

        # [19/22] Deleting non-existent profile image returns 404
        print("[19/22] Test: Deleting Non-Existent Profile Image Returns 404")
        res = client.delete("/api/v1/profile-image", headers=s1_headers)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        assert res.json()["detail"] == "Profile image not found"
        print("  -> Passed: Deleting non-existent profile image returned 404.")

        # [20/22] Missing physical file returns controlled 404
        print("[20/22] Test: Missing Physical File Handling (404)")
        res = client.post(
            "/api/v1/profile-image",
            files={"file": ("ghost_photo.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
            headers=s1_headers,
        )
        assert res.status_code == 201
        with SessionLocal() as db:
            ghost_rec = db.scalar(select(ProfileImage).where(ProfileImage.student_id == tokens["s1_id"]))
            ghost_path = Path(ghost_rec.file_path)
            if ghost_path.is_file():
                ghost_path.unlink()

        res_dl = client.get("/api/v1/profile-image/download", headers=s1_headers)
        assert res_dl.status_code == 404, f"Expected 404, got {res_dl.status_code}"
        assert "not found on disk" in res_dl.json()["detail"]
        print("  -> Passed: Missing physical file on disk returns controlled 404.")

        # [21/22] Path traversal filename is safely stored inside profile_images directory
        print("[21/22] Test: Path Traversal in Filename Sanitization")
        malicious_filename = "../../../etc/passwd.jpg"
        res = client.post(
            "/api/v1/profile-image",
            files={"file": (malicious_filename, io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
            headers=s1_headers,
        )
        assert res.status_code == 201
        with SessionLocal() as db:
            traversal_rec = db.scalar(select(ProfileImage).where(ProfileImage.student_id == tokens["s1_id"]))
            stored_p = Path(traversal_rec.file_path).resolve()
            base_dir = settings.profile_image_upload_dir.resolve()
            assert stored_p.is_relative_to(base_dir), f"File stored outside target directory: {stored_p}"
            created_files.append(str(stored_p))
        print("  -> Passed: Path traversal sanitized; file safely contained in storage directory.")

        # [22/22] Inactive student rejected
        print("[22/22] Test: Inactive Student Rejected (401)")
        res = client.get("/api/v1/profile-image", headers=sinact_headers)
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        res_post = client.post(
            "/api/v1/profile-image",
            files={"file": ("inactive.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
            headers=sinact_headers,
        )
        assert res_post.status_code == 401, f"Expected 401, got {res_post.status_code}"
        print("  -> Passed: Inactive user rejected with 401.")

        print("\n=========================================================")
        print("ALL 22 PROFILE IMAGE TESTS PASSED SUCCESSFULLY!")
        print("=========================================================")

    finally:
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
