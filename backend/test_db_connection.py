import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from app.core.config import Settings, settings
from app.core.database import engine, check_db_connection
from app.core.test_database import test_engine, get_test_database_name, validate_test_database_url
from app.main import app

client = TestClient(app)


def test_db_connection_workflow():
    print("[1/6] Testing Python sqlalchemy connectivity to isolated PostgreSQL test database")
    try:
        # Pre-connection verification: Ensure target database is valid test database before connecting
        test_db_url = validate_test_database_url()
        expected_test_db = get_test_database_name(test_db_url)
        assert expected_test_db not in {"internship_db", "internship_staging_db", "postgres", "production", "staging"}, (
            "Fatal: Configured test database points to protected database!"
        )
        assert expected_test_db.endswith("_test") or expected_test_db.endswith("_test_db") or expected_test_db.startswith("test_"), (
            "Fatal: Configured database is not an explicitly test-designated database name!"
        )

        with test_engine.connect() as conn:
            result = conn.execute(
                text("SELECT current_database(), current_user, version();")
            )
            row = result.one()
            print(f"  -> Test Database Name: {row[0]}")
            print(f"  -> Test Database User: {row[1]}")
            print(f"  -> Server Version: {row[2].split(',')[0]}")
            print(f"  -> Host: {settings.POSTGRES_HOST}")
            print(f"  -> Port: {settings.POSTGRES_PORT}")

        print("[2/6] Verifying test database selection")
        assert row[0] == expected_test_db, f"Expected test database '{expected_test_db}', got '{row[0]}'"
        assert row[0] not in {"internship_db", "internship_staging_db", "postgres"}, "Fatal: Connected to protected database!"
        print(f"  -> Confirmed: connected to dedicated test database '{expected_test_db}'.")

        print("[3/6] Verifying /health returns HTTP 200 when database is healthy")
        with patch("app.main.check_db_connection", return_value=True):
            res_healthy = client.get("/health")
            assert res_healthy.status_code == 200
            assert res_healthy.json()["status"] == "ok"
            assert res_healthy.json()["database"] == "connected"
            print("  -> Confirmed: /health returns status 200 with database connected.")

        print("[4/6] Verifying check_db_connection() health-check probe behavior (mocked engine)")
        # Mock engine connection to verify positive check_db_connection() logic without touching application database
        mock_conn = MagicMock()
        mock_conn.execute.return_value.scalar.return_value = 1
        with patch.object(engine, "connect") as mock_connect:
            mock_connect.return_value.__enter__.return_value = mock_conn
            assert check_db_connection() is True, "check_db_connection() should return True when connection executes SELECT 1"
        print("  -> Confirmed: check_db_connection() returns True when ping query succeeds.")

        # Verify OperationalError exception shielding on application engine
        with patch.object(engine, "connect", side_effect=OperationalError("connection refused", {}, None)):
            res_down = check_db_connection()
            assert res_down is False, "check_db_connection() should return False on OperationalError"
        print("  -> Confirmed: check_db_connection() safely catches OperationalError and returns False.")

        # Verify generic Exception shielding on application engine
        with patch.object(engine, "connect", side_effect=Exception("unexpected connection crash")):
            res_down_generic = check_db_connection()
            assert res_down_generic is False, "check_db_connection() should return False on generic Exception"
        print("  -> Confirmed: check_db_connection() safely catches generic Exception and returns False.")

        print("[5/6] Verifying /health returns HTTP 503 when database connection fails")
        with patch("app.main.check_db_connection", return_value=False):
            res_503 = client.get("/health")
            assert res_503.status_code == 503, f"Expected 503, got {res_503.status_code}"
            body_503 = res_503.json()
            assert body_503["success"] is False
            assert "database connection failed" in body_503["detail"].lower()
        print("  -> Confirmed: /health cleanly returns 503 with structured error envelope.")

        print("[6/6] Verifying DATABASE_URL 'postgres://' normalization in Settings")
        cloud_raw_url = "postgres://usr:p%40ss:123@db.cloud.provider.com:5432/careerbridge?sslmode=require"
        test_settings = Settings(
            DATABASE_URL=cloud_raw_url,
            JWT_SECRET_KEY="test_jwt_secret_key_for_testing_purposes_only",
            POSTGRES_USER="u",
            POSTGRES_PASSWORD="p",
        )
        normalized_url = test_settings.sync_database_url
        assert normalized_url.startswith("postgresql://"), f"Expected postgresql:// prefix, got: {normalized_url[:15]}"
        assert "usr:p%40ss:123@db.cloud.provider.com:5432/careerbridge?sslmode=require" in normalized_url
        # Standard postgresql:// scheme is preserved as-is
        standard_url = "postgresql://usr:pass@localhost:5432/db"
        test_settings_std = Settings(
            DATABASE_URL=standard_url,
            JWT_SECRET_KEY="test_jwt_secret_key_for_testing_purposes_only",
            POSTGRES_USER="u",
            POSTGRES_PASSWORD="p",
        )
        assert test_settings_std.sync_database_url == standard_url
        print("  -> Confirmed: 'postgres://' successfully normalized to 'postgresql://' without altering credentials/params.")

        print("\nAll database connectivity, health probing, and URL normalization checks PASSED SUCCESSFULLY!")

    except Exception as e:
        print(f"TEST FAILED: {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    test_db_connection_workflow()
