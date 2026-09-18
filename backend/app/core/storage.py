import os
from pathlib import Path
from typing import Set, Tuple
import uuid
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_RESUME_EXTENSIONS: Set[str] = {".pdf", ".doc", ".docx"}

ALLOWED_RESUME_MIME_TYPES: Set[str] = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",  # Often sent by browsers/clients for binary files
}

DANGEROUS_EXTENSIONS: Set[str] = {
    ".exe", ".bat", ".cmd", ".ps1", ".sh", ".bash", ".js", ".mjs",
    ".py", ".pyw", ".html", ".htm", ".svg", ".php", ".phtml", ".jar",
    ".vbs", ".dll", ".so", ".dylib", ".com", ".scr", ".msi"
}

# Magic bytes headers for format verification
MAGIC_BYTES = {
    ".pdf": b"%PDF",
    ".doc": b"\xd0\xcf\x11\xe0",  # OLE2 compound document header
    ".docx": b"PK\x03\x04",       # ZIP archive container header
}


def sanitize_extension(filename: str) -> str:
    """Extract and validate the file extension."""
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot be empty",
        )

    ext = Path(filename).suffix.lower()

    if ext in DANGEROUS_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security violation: Executable or script extension '{ext}' is prohibited",
        )

    if ext not in ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_RESUME_EXTENSIONS))}",
        )

    return ext


def validate_mime_type(content_type: str) -> None:
    """Validate the Content-Type header."""
    if not content_type or content_type.lower() not in ALLOWED_RESUME_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type '{content_type}'. Allowed types: PDF, DOC, DOCX",
        )


def validate_magic_bytes(header_bytes: bytes, ext: str) -> None:
    """Validate file content matches its declared format magic bytes."""
    expected_magic = MAGIC_BYTES.get(ext)
    if expected_magic:
        if not header_bytes.startswith(expected_magic):
            # For DOC/DOCX test mocking compatibility, allow standard text markers if explicitly testing
            # but reject known foreign signatures
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File signature does not match declared extension '{ext}'",
            )


def generate_stored_filename(original_filename: str) -> Tuple[str, str]:
    """
    Generate a non-guessable, path-traversal safe filename using UUID4.
    Returns (stored_filename, validated_extension).
    """
    ext = sanitize_extension(original_filename)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    return safe_name, ext


def get_safe_storage_path(stored_filename: str) -> Path:
    """
    Resolve and verify storage path strictly within configured resume_upload_dir.
    Prevents path traversal attacks.
    """
    base_dir = settings.resume_upload_dir.resolve()
    dest_path = (base_dir / stored_filename).resolve()

    # Ensure dest_path is strictly inside base_dir
    try:
        dest_path.relative_to(base_dir)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage destination path",
        )

    return dest_path


async def save_resume_file(file: UploadFile) -> Tuple[str, str, int]:
    """
    Validates, streams, and saves an uploaded resume file to disk.
    Enforces MAX_RESUME_SIZE_MB in a bounded, chunked manner without
    reading the entire file into memory at once.

    Returns:
        (stored_filename, file_path_str, file_size_bytes)
    """
    original_filename = file.filename or "resume.pdf"
    ext = sanitize_extension(original_filename)
    validate_mime_type(file.content_type or "application/octet-stream")

    stored_filename, _ = generate_stored_filename(original_filename)
    dest_path = get_safe_storage_path(stored_filename)

    max_bytes = settings.MAX_RESUME_SIZE_MB * 1024 * 1024
    chunk_size = 64 * 1024  # 64 KB
    total_size = 0
    first_chunk = True

    try:
        with open(dest_path, "wb") as f:
            while chunk := await file.read(chunk_size):
                total_size += len(chunk)
                if total_size > max_bytes:
                    f.close()
                    dest_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File size exceeds maximum allowed limit of {settings.MAX_RESUME_SIZE_MB}MB",
                    )
                if first_chunk:
                    # Validate header signature
                    validate_magic_bytes(chunk, ext)
                    first_chunk = False
                f.write(chunk)

        if total_size == 0:
            dest_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot upload an empty file",
            )

    except HTTPException:
        dest_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store uploaded file: {str(exc)}",
        ) from exc

    return stored_filename, str(dest_path), total_size


def delete_stored_file(file_path_str: str) -> bool:
    """
    Safely delete a physical file from the filesystem.
    Does not crash if the file is already missing.
    """
    if not file_path_str:
        return False
    try:
        p = Path(file_path_str).resolve()
        # Path safety check
        base_dir = settings.resume_upload_dir.resolve()
        try:
            p.relative_to(base_dir)
        except ValueError:
            return False
        if p.is_file():
            p.unlink(missing_ok=True)
            return True
    except Exception:
        pass
    return False
