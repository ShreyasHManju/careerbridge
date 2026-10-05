from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.health import (
    check_liveness,
    check_database_readiness,
    check_migration_readiness,
    check_storage_readiness,
    check_system_readiness,
)
from app.main import app

client = TestClient(app)


class TestLivenessProbe:
    def test_liveness_endpoint_returns_200(self):
        res = client.get("/health/live")
        assert res.status_code == 200
        assert res.json() == {"status": "alive"}

    def test_liveness_independent_of_database(self):
        with patch("app.core.health.engine.connect", side_effect=Exception("Database is down")):
            res = client.get("/health/live")
            assert res.status_code == 200
            assert res.json() == {"status": "alive"}


class TestReadinessProbe:
    def test_readiness_healthy_system_returns_200(self):
        res = client.get("/health/ready")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ready"
        assert "checks" in data
        assert data["checks"]["database"]["status"] == "healthy"
        assert "latency_ms" in data["checks"]["database"]
        assert data["checks"]["migrations"]["status"] == "aligned"
        assert data["checks"]["storage"]["status"] == "ready"

    def test_readiness_database_failure_returns_503(self):
        with patch("app.core.health.check_database_readiness", return_value=(False, {"status": "unavailable", "detail": "database connection failed"})):
            res = client.get("/health/ready")
            assert res.status_code == 503
            data = res.json()
            assert data["status"] == "not_ready"
            assert data["checks"]["database"]["status"] == "unavailable"

    def test_readiness_migration_mismatch_returns_503(self):
        with patch("app.core.health.check_migration_readiness", return_value=(False, {
            "status": "mismatch",
            "current_revision": "old_rev_123",
            "head_revision": "new_rev_456",
            "detail": "database schema revision does not match code head revision"
        })):
            res = client.get("/health/ready")
            assert res.status_code == 503
            data = res.json()
            assert data["status"] == "not_ready"
            assert data["checks"]["migrations"]["status"] == "mismatch"
            assert data["checks"]["migrations"]["current_revision"] == "old_rev_123"

    def test_readiness_storage_failure_returns_503(self):
        with patch("app.core.health.check_storage_readiness", return_value=(False, {"status": "unavailable", "detail": "local upload directory is not writable"})):
            res = client.get("/health/ready")
            assert res.status_code == 503
            data = res.json()
            assert data["status"] == "not_ready"
            assert data["checks"]["storage"]["status"] == "unavailable"

    def test_readiness_with_s3_storage_provider(self, monkeypatch):
        monkeypatch.setattr(settings, "STORAGE_PROVIDER", "s3")
        monkeypatch.setattr(settings, "STORAGE_BUCKET", "prod-careerbridge-bucket")
        monkeypatch.setattr(settings, "STORAGE_REGION", "eu-central-1")

        mock_s3_client = MagicMock()
        mock_s3_client.head_bucket.return_value = {}

        with patch("app.core.storage.S3StorageProvider._get_client", return_value=mock_s3_client):
            res = client.get("/health/ready")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "ready"
            assert data["checks"]["storage"]["provider"] == "s3"
            assert data["checks"]["storage"]["bucket"] == "prod-careerbridge-bucket"
            assert data["checks"]["storage"]["region"] == "eu-central-1"
            mock_s3_client.head_bucket.assert_called_once_with(Bucket="prod-careerbridge-bucket")

    def test_readiness_s3_storage_connectivity_failure_returns_503(self, monkeypatch):
        monkeypatch.setattr(settings, "STORAGE_PROVIDER", "s3")
        monkeypatch.setattr(settings, "STORAGE_BUCKET", "prod-careerbridge-bucket")

        mock_s3_client = MagicMock()
        mock_s3_client.head_bucket.side_effect = Exception("AWS S3 Connection Timeout")

        with patch("app.core.storage.S3StorageProvider._get_client", return_value=mock_s3_client):
            res = client.get("/health/ready")
            assert res.status_code == 503
            data = res.json()
            assert data["status"] == "not_ready"
            assert data["checks"]["storage"]["status"] == "unavailable"
            assert data["checks"]["storage"]["detail"] == "storage bucket connectivity check failed"

    def test_readiness_error_responses_shield_sensitive_data(self):
        with patch("app.core.health.engine.connect", side_effect=Exception("FATAL: password authentication failed for user 'postgres'")):
            res = client.get("/health/ready")
            assert res.status_code == 503
            text_body = res.text
            assert "password" not in text_body.lower()
            assert "postgres" not in text_body
            assert "FATAL" not in text_body


class TestBackwardCompatibility:
    def test_legacy_health_endpoint_still_works(self):
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert data["service"] == "CareerBridge API"

    def test_root_endpoint_still_works(self):
        res = client.get("/")
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "CareerBridge API"
        assert data["status"] == "ok"
