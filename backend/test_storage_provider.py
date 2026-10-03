import asyncio
import io
from pathlib import Path
import pytest
from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.core.storage import (
    LocalStorageProvider,
    S3StorageProvider,
    get_storage_provider,
    save_resume_file,
    save_profile_image_file,
    delete_stored_file,
    file_exists_in_storage,
    sanitize_extension,
    validate_mime_type,
    validate_magic_bytes,
)

VALID_PDF_BYTES = b"%PDF-1.4\n%CareerBridge Test PDF\n%%EOF"
VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"\xff\xdb\x00C\x00" + b"JPEG payload"
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4" + b"PNG payload"


class TestLocalStorageProvider:
    def test_save_read_delete_resume_lifecycle(self, tmp_path):
        async def _run():
            provider = LocalStorageProvider(base_upload_dir=tmp_path)
            file = UploadFile(
                file=io.BytesIO(VALID_PDF_BYTES),
                filename="student_resume.pdf",
                headers={"content-type": "application/pdf"},
            )

            stored_name, path_str, size = await save_resume_file(file, provider=provider)

            assert size == len(VALID_PDF_BYTES)
            assert stored_name.endswith(".pdf")
            assert Path(path_str).is_file()
            assert provider.exists(path_str) is True

            content = provider.read(path_str)
            assert content == VALID_PDF_BYTES

            # Test download response
            response = provider.get_response(path_str, "application/pdf", "original.pdf")
            assert response.path == path_str

            # Delete
            deleted = delete_stored_file(path_str, provider=provider)
            assert deleted is True
            assert provider.exists(path_str) is False
            assert Path(path_str).is_file() is False

        asyncio.run(_run())

    def test_save_read_delete_profile_image_lifecycle(self, tmp_path):
        async def _run():
            provider = LocalStorageProvider(base_upload_dir=tmp_path)
            file = UploadFile(
                file=io.BytesIO(VALID_JPEG_BYTES),
                filename="avatar.jpg",
                headers={"content-type": "image/jpeg"},
            )

            stored_name, path_str, size = await save_profile_image_file(file, provider=provider)

            assert size == len(VALID_JPEG_BYTES)
            assert stored_name.endswith(".jpg")
            assert Path(path_str).is_file()
            assert provider.exists(path_str) is True

            content = provider.read(path_str)
            assert content == VALID_JPEG_BYTES

            # Delete
            deleted = delete_stored_file(path_str, provider=provider)
            assert deleted is True
            assert provider.exists(path_str) is False

        asyncio.run(_run())

    def test_path_traversal_protection(self, tmp_path):
        provider = LocalStorageProvider(base_upload_dir=tmp_path)

        # Attempt to access or delete path outside root directory
        outside_path = str(tmp_path.parent / "sensitive.txt")
        assert provider.exists(outside_path) is False
        assert provider.delete(outside_path) is False

        with pytest.raises(HTTPException) as exc:
            provider.read(outside_path)
        assert exc.value.status_code == 400

    def test_empty_file_rejection(self, tmp_path):
        async def _run():
            provider = LocalStorageProvider(base_upload_dir=tmp_path)
            empty_file = UploadFile(
                file=io.BytesIO(b""),
                filename="empty.pdf",
                headers={"content-type": "application/pdf"},
            )

            with pytest.raises(HTTPException) as exc:
                await save_resume_file(empty_file, provider=provider)
            assert exc.value.status_code == 400
            assert "Cannot upload an empty file" in exc.value.detail

        asyncio.run(_run())


class TestS3StorageProvider:
    def test_s3_save_read_delete_resume_lifecycle(self):
        async def _run():
            provider = S3StorageProvider(
                bucket_name="test-careerbridge-bucket",
                region="us-west-2",
                endpoint_url="https://r2.cloudflare.com/test",
                access_key_id="mock_key",
                secret_access_key="mock_secret",
            )

            file = UploadFile(
                file=io.BytesIO(VALID_PDF_BYTES),
                filename="sample_resume.pdf",
                headers={"content-type": "application/pdf"},
            )

            stored_name, object_key, size = await save_resume_file(file, provider=provider)

            assert size == len(VALID_PDF_BYTES)
            assert object_key.startswith("resumes/")
            assert object_key.endswith(".pdf")
            assert provider.exists(object_key) is True

            content = provider.read(object_key)
            assert content == VALID_PDF_BYTES

            # Test download response
            response = provider.get_response(object_key, "application/pdf", "my_resume.pdf")
            assert response.status_code == 200
            assert response.media_type == "application/pdf"
            assert 'attachment; filename="my_resume.pdf"' in response.headers["content-disposition"]

            # Delete
            deleted = delete_stored_file(object_key, provider=provider)
            assert deleted is True
            assert provider.exists(object_key) is False

        asyncio.run(_run())

    def test_s3_profile_image_lifecycle(self):
        async def _run():
            provider = S3StorageProvider(
                bucket_name="test-careerbridge-bucket",
                region="auto",
                endpoint_url="https://minio.local:9000",
                access_key_id="minio_admin",
                secret_access_key="minio_secret",
            )

            file = UploadFile(
                file=io.BytesIO(VALID_PNG_BYTES),
                filename="profile_pic.png",
                headers={"content-type": "image/png"},
            )

            stored_name, object_key, size = await save_profile_image_file(file, provider=provider)

            assert size == len(VALID_PNG_BYTES)
            assert object_key.startswith("profile_images/")
            assert object_key.endswith(".png")
            assert provider.exists(object_key) is True

            content = provider.read(object_key)
            assert content == VALID_PNG_BYTES

            deleted = delete_stored_file(object_key, provider=provider)
            assert deleted is True
            assert provider.exists(object_key) is False

        asyncio.run(_run())

    def test_s3_missing_object_raises_file_not_found(self):
        provider = S3StorageProvider(bucket_name="test-bucket")
        assert provider.exists("non_existent_key.pdf") is False
        with pytest.raises(FileNotFoundError):
            provider.read("non_existent_key.pdf")

    def test_s3_missing_bucket_raises_error(self, monkeypatch):
        monkeypatch.setattr(settings, "STORAGE_BUCKET", None)
        with pytest.raises(ValueError) as exc:
            S3StorageProvider(bucket_name=None)
        assert "requires STORAGE_BUCKET" in str(exc.value)


class TestProviderFactory:
    def test_factory_resolves_local(self):
        provider = get_storage_provider("local")
        assert isinstance(provider, LocalStorageProvider)

    def test_factory_resolves_s3(self, monkeypatch):
        monkeypatch.setattr(settings, "STORAGE_BUCKET", "my-test-bucket")
        provider = get_storage_provider("s3")
        assert isinstance(provider, S3StorageProvider)

    def test_factory_invalid_provider_raises_error(self):
        with pytest.raises(ValueError) as exc:
            get_storage_provider("azure_blob_storage")
        assert "Unsupported storage provider" in str(exc.value)

    def test_production_blocks_local_fallback(self, monkeypatch):
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        monkeypatch.setattr(settings, "STORAGE_PROVIDER", "local")

        with pytest.raises(ValueError) as exc:
            get_storage_provider()
        assert "Production environment cannot use local filesystem storage" in str(exc.value)
