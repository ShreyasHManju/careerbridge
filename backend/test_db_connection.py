import sys
from pathlib import Path
from unittest.mock import patch

# Ensure backend is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from app.core.config import Settings, settings
from app.core.database import engine, check_db_connection
from app.main import app

client = TestClient(app)


def main():
    print("[1/6] Testing Python sqlalchemy connectivity to PostgreSQL")
    try:
        connected_initial = check_db_connection()
        assert connected_initial is True
        print("  -> Successfully executed 'SELECT 1' ping query.")

        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT current_database(), current_user, version();")
            )
            row = result.one()
            print(f"  -> Database Name: {row[0]}")
            print(f"  -> Database User: {row[1]}")
            print(f"  -> Server Version: {row[2].split(',')[0]}")
            print(f"  -> Host: {settings.POSTGRES_HOST}")
            print(f"  -> Port: {settings.POSTGRES_PORT}")

        print("[2/6] Verifying database selection")
        assert row[0] == "internship_db"
        print("  -> Confirmed: connected to 'internship_db'.")

        print("[3/6] Verifying /health returns HTTP 200 when database is healthy")
        res_healthy = client.get("/health")
        assert res_healthy.status_code == 200
        assert res_healthy.json()["status"] == "ok"
        assert res_healthy.json()["database"] == "connected"
        print("  -> Confirmed: /health returns status 200 with database connected.")

        print("[4/6] Verifying check_db_connection() exception shielding on connectivity failure")
        with patch.object(engine, "connect", side_effect=OperationalError("connection refused", {}, None)):
            res_down = check_db_connection()
            assert res_down is False, "check_db_connection() should return False on OperationalError"
        print("  -> Confirmed: check_db_connection() safely catches OperationalError and returns False.")

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
    main()
