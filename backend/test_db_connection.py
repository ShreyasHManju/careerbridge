import sys
from pathlib import Path

# Ensure backend is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, check_db_connection


def main():
    print("[1/3] Testing Python sqlalchemy connectivity to PostgreSQL")
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

        print("[2/3] Verifying database selection")
        assert row[0] == "internship_db"
        print("  -> Confirmed: connected to 'internship_db'.")

        print("[3/3] All SQLAlchemy -> PostgreSQL connectivity checks PASSED SUCCESSFULLY!")

    except Exception as e:
        print(f"TEST FAILED: {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
