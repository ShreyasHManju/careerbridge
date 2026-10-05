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


from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError


class TestS3StorageProvider:
    def test_s3_save_read_delete_resume_lifecycle(self):
        async def _run():
            mock_client = MagicMock()
            mock_body = MagicMock()
            mock_body.read.return_value = VALID_PDF_BYTES
            mock_client.get_object.return_value = {"Body": mock_body}
            mock_client.head_object.return_value = {}
            mock_client.delete_object.return_value = {}
            mock_client.put_object.return_value = {}

            provider = S3StorageProvider(
                bucket_name="test-careerbridge-bucket",
                region="us-west-2",
                endpoint_url="https://r2.cloudflare.com/test",
                access_key_id="mock_key",
                secret_access_key="mock_secret",
            )
            provider._client = mock_client

            file = UploadFile(
                file=io.BytesIO(VALID_PDF_BYTES),
                filename="sample_resume.pdf",
                headers={"content-type": "application/pdf"},
            )

            stored_name, object_key, size = await save_resume_file(file, provider=provider)

            assert size == len(VALID_PDF_BYTES)
            assert object_key.startswith("resumes/")
            assert object_key.endswith(".pdf")
            mock_client.put_object.assert_called_once_with(
                Bucket="test-careerbridge-bucket",
                Key=object_key,
                Body=VALID_PDF_BYTES,
                ContentType="application/pdf",
            )

            # Exists
            assert provider.exists(object_key) is True
            mock_client.head_object.assert_called_with(
                Bucket="test-careerbridge-bucket",
                Key=object_key,
            )

            # Read
            content = provider.read(object_key)
            assert content == VALID_PDF_BYTES
            mock_client.get_object.assert_called_with(
                Bucket="test-careerbridge-bucket",
                Key=object_key,
            )
            mock_body.close.assert_called_once()

            # Response
            response = provider.get_response(object_key, "application/pdf", "my_resume.pdf")
            assert response.status_code == 200
            assert response.media_type == "application/pdf"
            assert 'attachment; filename="my_resume.pdf"' in response.headers["content-disposition"]

            # Delete
            deleted = delete_stored_file(object_key, provider=provider)
            assert deleted is True
            mock_client.delete_object.assert_called_with(
                Bucket="test-careerbridge-bucket",
                Key=object_key,
            )

        asyncio.run(_run())

    def test_s3_profile_image_lifecycle(self):
        async def _run():
            mock_client = MagicMock()
            mock_body = MagicMock()
            mock_body.read.return_value = VALID_PNG_BYTES
            mock_client.get_object.return_value = {"Body": mock_body}
            mock_client.head_object.return_value = {}
            mock_client.delete_object.return_value = {}
            mock_client.put_object.return_value = {}

            provider = S3StorageProvider(
                bucket_name="test-careerbridge-bucket",
                region="auto",
                endpoint_url="https://minio.local:9000",
                access_key_id="minio_admin",
                secret_access_key="minio_secret",
            )
            provider._client = mock_client

            file = UploadFile(
                file=io.BytesIO(VALID_PNG_BYTES),
                filename="profile_pic.png",
                headers={"content-type": "image/png"},
            )

            stored_name, object_key, size = await save_profile_image_file(file, provider=provider)

            assert size == len(VALID_PNG_BYTES)
            assert object_key.startswith("profile_images/")
            assert object_key.endswith(".png")
            mock_client.put_object.assert_called_once_with(
                Bucket="test-careerbridge-bucket",
                Key=object_key,
                Body=VALID_PNG_BYTES,
                ContentType="image/png",
            )

            # Exists & Read
            assert provider.exists(object_key) is True
            content = provider.read(object_key)
            assert content == VALID_PNG_BYTES

            # Delete
            deleted = delete_stored_file(object_key, provider=provider)
            assert deleted is True

        asyncio.run(_run())

    def test_s3_missing_object_raises_file_not_found(self):
        mock_client = MagicMock()
        mock_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}},
            "head_object",
        )
        mock_client.get_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}},
            "get_object",
        )

        provider = S3StorageProvider(bucket_name="test-bucket")
        provider._client = mock_client

        assert provider.exists("non_existent_key.pdf") is False
        with pytest.raises(FileNotFoundError) as exc:
            provider.read("non_existent_key.pdf")
        assert "S3 Object not found" in str(exc.value)

    def test_s3_missing_bucket_raises_error(self, monkeypatch):
        monkeypatch.setattr(settings, "STORAGE_BUCKET", None)
        with pytest.raises(ValueError) as exc:
            S3StorageProvider(bucket_name=None)
        assert "requires STORAGE_BUCKET" in str(exc.value)

    def test_s3_client_failure_raises_http_500(self):
        async def _run():
            mock_client = MagicMock()
            mock_client.put_object.side_effect = ClientError(
                {"Error": {"Code": "500", "Message": "Internal Server Error"}},
                "put_object",
            )

            provider = S3StorageProvider(bucket_name="test-bucket")
            provider._client = mock_client

            file = UploadFile(
                file=io.BytesIO(VALID_PDF_BYTES),
                filename="resume.pdf",
                headers={"content-type": "application/pdf"},
            )

            with pytest.raises(HTTPException) as exc:
                await save_resume_file(file, provider=provider)
            assert exc.value.status_code == 500
            assert "Failed to upload object to S3 storage" in exc.value.detail

        asyncio.run(_run())

    def test_s3_upload_size_limit_exceeded(self):
        async def _run():
            provider = S3StorageProvider(bucket_name="test-bucket")
            provider._client = MagicMock()

            # Create file larger than 1MB
            large_data = VALID_PDF_BYTES + (b"A" * (2 * 1024 * 1024))
            file = UploadFile(
                file=io.BytesIO(large_data),
                filename="resume.pdf",
                headers={"content-type": "application/pdf"},
            )

            with pytest.raises(HTTPException) as exc:
                await provider.save_file(
                    file=file,
                    subfolder="resumes",
                    max_size_mb=1,
                    sanitizer=sanitize_extension,
                    mime_validator=validate_mime_type,
                    magic_validator=validate_magic_bytes,
                )
            assert exc.value.status_code == 400
            assert "File size exceeds maximum allowed limit" in exc.value.detail

        asyncio.run(_run())

    def test_s3_empty_file_rejected(self):
        async def _run():
            provider = S3StorageProvider(bucket_name="test-bucket")
            provider._client = MagicMock()

            file = UploadFile(
                file=io.BytesIO(b""),
                filename="resume.pdf",
                headers={"content-type": "application/pdf"},
            )

            with pytest.raises(HTTPException) as exc:
                await save_resume_file(file, provider=provider)
            assert exc.value.status_code == 400
            assert "Cannot upload an empty file" in exc.value.detail

        asyncio.run(_run())

    def test_s3_magic_bytes_validation_rejection(self):
        async def _run():
            provider = S3StorageProvider(bucket_name="test-bucket")
            provider._client = MagicMock()

            # Invalid magic bytes for PDF
            file = UploadFile(
                file=io.BytesIO(b"NOT_A_PDF_CONTENT"),
                filename="resume.pdf",
                headers={"content-type": "application/pdf"},
            )

            with pytest.raises(HTTPException) as exc:
                await save_resume_file(file, provider=provider)
            assert exc.value.status_code == 400
            assert "File signature does not match" in exc.value.detail

        asyncio.run(_run())

    def test_s3_lazy_client_initialization_with_credentials_and_custom_endpoint(self):
        with patch("boto3.client") as mock_boto_client:
            provider = S3StorageProvider(
                bucket_name="test-bucket",
                region="us-east-1",
                endpoint_url="https://minio.custom.endpoint:9000",
                access_key_id="custom_access_key",
                secret_access_key="custom_secret_key",
            )
            # Not initialized until _get_client() is called
            assert provider._client is None
            mock_boto_client.assert_not_called()

            client = provider._get_client()
            assert client is not None
            mock_boto_client.assert_called_once_with(
                "s3",
                region_name="us-east-1",
                endpoint_url="https://minio.custom.endpoint:9000",
                aws_access_key_id="custom_access_key",
                aws_secret_access_key="custom_secret_key",
            )

    def test_s3_lazy_client_omits_credentials_when_none(self):
        with patch("boto3.client") as mock_boto_client:
            provider = S3StorageProvider(
                bucket_name="test-bucket",
                region="us-west-2",
                endpoint_url=None,
                access_key_id=None,
                secret_access_key=None,
            )
            client = provider._get_client()
            assert client is not None
            mock_boto_client.assert_called_once_with(
                "s3",
                region_name="us-west-2",
            )


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
