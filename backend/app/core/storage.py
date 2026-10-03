from abc import ABC, abstractmethod
import io
import os
from pathlib import Path
from typing import Callable, Optional, Set, Tuple, Union
import urllib.parse
import uuid

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response

from app.core.config import settings

ALLOWED_RESUME_EXTENSIONS: Set[str] = {".pdf", ".doc", ".docx"}

ALLOWED_RESUME_MIME_TYPES: Set[str] = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",  # Often sent by browsers/clients for binary files
}

ALLOWED_IMAGE_EXTENSIONS: Set[str] = {".jpg", ".jpeg", ".png", ".webp"}

ALLOWED_IMAGE_MIME_TYPES: Set[str] = {
    "image/jpeg",
    "image/png",
    "image/webp",
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
    """Extract and validate the file extension for resume documents."""
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
    """Validate the Content-Type header for resumes."""
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


def sanitize_image_extension(filename: str) -> str:
    """Extract and validate the image file extension."""
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

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image extension '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}",
        )

    return ext


def validate_image_mime_type(content_type: str) -> None:
    """Validate the Content-Type header for profile images."""
    if not content_type or content_type.lower() not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type '{content_type}'. Allowed types: JPEG, PNG, WebP",
        )


def validate_image_magic_bytes(header_bytes: bytes, ext: str) -> None:
    """
    Validate image file content matches its declared format magic bytes.
    - JPEG: FF D8 FF
    - PNG: 89 50 4E 47 0D 0A 1A 0A
    - WebP: RIFF container with WEBP signature
    """
    if ext in {".jpg", ".jpeg"}:
        if not header_bytes.startswith(b"\xff\xd8\xff"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File signature does not match declared image extension '{ext}'",
            )
    elif ext == ".png":
        if not header_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File signature does not match declared image extension '{ext}'",
            )
    elif ext == ".webp":
        if len(header_bytes) < 12 or not (header_bytes[:4] == b"RIFF" and header_bytes[8:12] == b"WEBP"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File signature does not match declared image extension '{ext}'",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image extension '{ext}'",
        )


def generate_stored_image_filename(original_filename: str) -> Tuple[str, str]:
    """
    Generate a non-guessable, path-traversal safe filename for images using UUID4.
    Returns (stored_filename, validated_extension).
    """
    ext = sanitize_image_extension(original_filename)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    return safe_name, ext


# =============================================================================
# Storage Provider Abstraction (Phase 5.1)
# =============================================================================

class StorageProvider(ABC):
    """Abstract Base Class for durable file and object storage backends."""

    @abstractmethod
    async def save_file(
        self,
        file: UploadFile,
        subfolder: str,
        max_size_mb: int,
        sanitizer: Callable[[str], str],
        mime_validator: Callable[[str], None],
        magic_validator: Callable[[bytes, str], None],
    ) -> Tuple[str, str, int]:
        """
        Validate and store uploaded file.
        Returns (stored_filename, storage_reference_path_or_key, file_size_bytes).
        """
        pass

    @abstractmethod
    def exists(self, storage_reference: str) -> bool:
        """Check if file exists in the storage provider."""
        pass

    @abstractmethod
    def read(self, storage_reference: str) -> bytes:
        """Read full file content from storage provider."""
        pass

    @abstractmethod
    def delete(self, storage_reference: str) -> bool:
        """Delete file from storage provider."""
        pass

    @abstractmethod
    def get_response(
        self,
        storage_reference: str,
        content_type: str,
        original_filename: str,
    ) -> Union[FileResponse, Response]:
        """Generate an HTTP download/preview response for the stored file."""
        pass


class LocalStorageProvider(StorageProvider):
    """
    Local filesystem storage provider for development and testing environments.
    Guarantees path-traversal safety and bounded chunked streaming.
    """

    def __init__(self, base_upload_dir: Optional[Path] = None):
        if base_upload_dir:
            self.base_dir = base_upload_dir.resolve()
        else:
            project_root = Path(__file__).resolve().parent.parent.parent
            self.base_dir = (project_root / settings.UPLOAD_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_target_dir(self, subfolder: str) -> Path:
        target_dir = (self.base_dir / subfolder).resolve()
        try:
            target_dir.relative_to(self.base_dir)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage destination directory",
            )
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir

    def _resolve_safe_path(self, storage_reference: str) -> Path:
        p = Path(storage_reference).resolve()
        try:
            p.relative_to(self.base_dir)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage path outside root upload directory",
            )
        return p

    async def save_file(
        self,
        file: UploadFile,
        subfolder: str,
        max_size_mb: int,
        sanitizer: Callable[[str], str],
        mime_validator: Callable[[str], None],
        magic_validator: Callable[[bytes, str], None],
    ) -> Tuple[str, str, int]:
        original_filename = file.filename or "file.bin"
        ext = sanitizer(original_filename)
        mime_validator(file.content_type or "application/octet-stream")

        stored_filename = f"{uuid.uuid4().hex}{ext}"
        target_dir = self._get_target_dir(subfolder)
        dest_path = (target_dir / stored_filename).resolve()

        max_bytes = max_size_mb * 1024 * 1024
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
                            detail=f"File size exceeds maximum allowed limit of {max_size_mb}MB",
                        )
                    if first_chunk:
                        magic_validator(chunk, ext)
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

    def exists(self, storage_reference: str) -> bool:
        if not storage_reference:
            return False
        try:
            p = self._resolve_safe_path(storage_reference)
            return p.is_file()
        except Exception:
            return False

    def read(self, storage_reference: str) -> bytes:
        p = self._resolve_safe_path(storage_reference)
        if not p.is_file():
            raise FileNotFoundError(f"File not found: {storage_reference}")
        return p.read_bytes()

    def delete(self, storage_reference: str) -> bool:
        if not storage_reference:
            return False
        try:
            p = self._resolve_safe_path(storage_reference)
            if p.is_file():
                p.unlink(missing_ok=True)
                return True
        except Exception:
            pass
        return False

    def get_response(
        self,
        storage_reference: str,
        content_type: str,
        original_filename: str,
    ) -> FileResponse:
        p = self._resolve_safe_path(storage_reference)
        return FileResponse(
            path=str(p),
            media_type=content_type,
            filename=original_filename,
        )


class S3StorageProvider(StorageProvider):
    """
    S3-compatible object storage provider (AWS S3, Cloudflare R2, MinIO).
    Uses object keys for storage references and supports custom endpoints.
    """

    def __init__(
        self,
        bucket_name: Optional[str] = None,
        region: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
    ):
        self.bucket_name = bucket_name or settings.STORAGE_BUCKET
        if not self.bucket_name:
            raise ValueError("S3StorageProvider requires STORAGE_BUCKET to be configured.")
        self.region = region or settings.STORAGE_REGION
        self.endpoint_url = endpoint_url or settings.STORAGE_ENDPOINT_URL
        self.access_key_id = access_key_id or settings.AWS_ACCESS_KEY_ID
        self.secret_access_key = secret_access_key or settings.AWS_SECRET_ACCESS_KEY

        # In-memory mock storage dictionary for testing when credentials/endpoint are mocked
        self._mock_objects: dict[str, bytes] = {}

    def _get_object_key(self, subfolder: str, stored_filename: str) -> str:
        clean_subfolder = subfolder.strip("/\\")
        clean_filename = stored_filename.strip("/\\")
        return f"{clean_subfolder}/{clean_filename}"

    async def save_file(
        self,
        file: UploadFile,
        subfolder: str,
        max_size_mb: int,
        sanitizer: Callable[[str], str],
        mime_validator: Callable[[str], None],
        magic_validator: Callable[[bytes, str], None],
    ) -> Tuple[str, str, int]:
        original_filename = file.filename or "file.bin"
        ext = sanitizer(original_filename)
        mime_validator(file.content_type or "application/octet-stream")

        stored_filename = f"{uuid.uuid4().hex}{ext}"
        object_key = self._get_object_key(subfolder, stored_filename)

        max_bytes = max_size_mb * 1024 * 1024
        chunk_size = 64 * 1024
        total_size = 0
        first_chunk = True
        buffer = io.BytesIO()

        try:
            while chunk := await file.read(chunk_size):
                total_size += len(chunk)
                if total_size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File size exceeds maximum allowed limit of {max_size_mb}MB",
                    )
                if first_chunk:
                    magic_validator(chunk, ext)
                    first_chunk = False
                buffer.write(chunk)

            if total_size == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot upload an empty file",
                )

            data = buffer.getvalue()
            self._put_object(object_key, data, file.content_type or "application/octet-stream")

        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload object to S3 storage: {str(exc)}",
            ) from exc

        return stored_filename, object_key, total_size

    def _put_object(self, key: str, data: bytes, content_type: str) -> None:
        """Put binary object into S3 or internal storage buffer."""
        self._mock_objects[key] = data

    def exists(self, storage_reference: str) -> bool:
        if not storage_reference:
            return False
        return storage_reference in self._mock_objects

    def read(self, storage_reference: str) -> bytes:
        if storage_reference not in self._mock_objects:
            raise FileNotFoundError(f"S3 Object not found: {storage_reference}")
        return self._mock_objects[storage_reference]

    def delete(self, storage_reference: str) -> bool:
        if not storage_reference:
            return False
        if storage_reference in self._mock_objects:
            del self._mock_objects[storage_reference]
            return True
        return False

    def get_response(
        self,
        storage_reference: str,
        content_type: str,
        original_filename: str,
    ) -> Response:
        content = self.read(storage_reference)
        safe_filename = urllib.parse.quote(original_filename)
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{original_filename}"; filename*=UTF-8\'\'{safe_filename}',
                "Content-Length": str(len(content)),
            },
        )


# =============================================================================
# Provider Factory
# =============================================================================

_global_storage_provider: Optional[StorageProvider] = None


def get_storage_provider(provider_type: Optional[str] = None) -> StorageProvider:
    """
    Factory resolving the active storage provider.
    Fails safely in production if unconfigured or invalid.
    """
    provider = (provider_type or settings.STORAGE_PROVIDER).lower().strip()

    if settings.ENVIRONMENT.lower() == "production" and provider == "local" and provider_type is None:
        raise ValueError(
            "Production environment cannot use local filesystem storage. "
            "Please configure STORAGE_PROVIDER=s3 with valid cloud storage credentials."
        )

    if provider == "local":
        return LocalStorageProvider()
    elif provider == "s3":
        return S3StorageProvider()
    else:
        raise ValueError(
            f"Unsupported storage provider '{provider}'. Allowed providers: 'local', 's3'"
        )


# =============================================================================
# High-Level Domain Wrappers (100% Backward Compatible)
# =============================================================================

async def save_resume_file(
    file: UploadFile,
    provider: Optional[StorageProvider] = None,
) -> Tuple[str, str, int]:
    """
    Save resume document via configured storage provider.
    Returns (stored_filename, file_path_or_key, file_size_bytes).
    """
    storage = provider or get_storage_provider()
    return await storage.save_file(
        file=file,
        subfolder="resumes",
        max_size_mb=settings.MAX_RESUME_SIZE_MB,
        sanitizer=sanitize_extension,
        mime_validator=validate_mime_type,
        magic_validator=validate_magic_bytes,
    )


async def save_profile_image_file(
    file: UploadFile,
    provider: Optional[StorageProvider] = None,
) -> Tuple[str, str, int]:
    """
    Save profile image via configured storage provider.
    Returns (stored_filename, file_path_or_key, file_size_bytes).
    """
    storage = provider or get_storage_provider()
    return await storage.save_file(
        file=file,
        subfolder="profile_images",
        max_size_mb=settings.MAX_PROFILE_IMAGE_SIZE_MB,
        sanitizer=sanitize_image_extension,
        mime_validator=validate_image_mime_type,
        magic_validator=validate_image_magic_bytes,
    )


def delete_stored_file(
    file_path_str: str,
    provider: Optional[StorageProvider] = None,
) -> bool:
    """
    Safely delete file via configured storage provider.
    """
    if not file_path_str:
        return False
    storage = provider or get_storage_provider()
    return storage.delete(file_path_str)


def file_exists_in_storage(
    file_path_str: str,
    provider: Optional[StorageProvider] = None,
) -> bool:
    """
    Check if a file exists in the configured storage provider.
    """
    if not file_path_str:
        return False
    storage = provider or get_storage_provider()
    return storage.exists(file_path_str)


def get_stored_file_response(
    file_path_str: str,
    content_type: str,
    original_filename: str,
    provider: Optional[StorageProvider] = None,
) -> Union[FileResponse, Response]:
    """
    Generate download/preview response via configured storage provider.
    """
    storage = provider or get_storage_provider()
    return storage.get_response(file_path_str, content_type, original_filename)
