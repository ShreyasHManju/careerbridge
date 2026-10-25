import pytest

from app.core.database import get_db
from app.core.test_database import (
    apply_test_dependency_overrides,
    clear_test_dependency_overrides,
    validate_test_database_url,
    verify_test_database_identity,
)
from app.core.test_fixtures import clean_test_records, get_test_db
from app.main import app
from app.models.user import User


@pytest.fixture(scope="session", autouse=True)
def validate_test_database_isolation():
    """
    Session-level fixture that ensures the test environment is strictly isolated
    before any pytest test runs. Fails closed if TEST_DATABASE_URL is missing,
    malformed, points to any protected database, or uses superuser privileges.
    """
    validate_test_database_url()
    verify_test_database_identity()


@pytest.fixture(autouse=True)
def override_test_db_dependency():
    """
    Autouse fixture ensuring every test request against FastAPI TestClient
    uses the isolated test database session factory (get_test_db_override)
    and WebSocket routes use the isolated test session factory (TestSessionLocal).

    Preserves and restores any existing dependency override for get_db and
    the WebSocket route session factory, preventing state leakage across tests.

    IMPORTANT SCOPE NOTICE:
    This fixture protects test execution invoked through pytest. Standalone
    scripts that execute outside pytest (e.g. `python test_xxx.py`) bypass
    conftest.py and rely on runner/module-level isolation via app.core.test_database.
    """
    apply_test_dependency_overrides()
    try:
        yield
    finally:
        clear_test_dependency_overrides()




@pytest.fixture(autouse=True)
def cleanup_core_roadmap_test_data(request):
    yield

    if request.node.module.__name__ != "test_core_roadmap":
        return

    with get_test_db() as db:
        patterns = [
            "reg_%@careerbridge.io",
            "login_%@careerbridge.io",
            "perm_%@careerbridge.io",
            "job_create_%@careerbridge.io",
            "filter_%@careerbridge.io",
            "app_%@careerbridge.io",
            "dup_%@careerbridge.io",
            "stat_%@careerbridge.io",
            "adm_%@careerbridge.io",
            "err_%@careerbridge.io",
            "short_pass_%@careerbridge.io",
            "e2e_student_%@careerbridge.io",
            "e2e_recruiter_%@careerbridge.io",
        ]

        user_ids = set()

        for pattern in patterns:
            rows = (
                db.query(User.id)
                .filter(User.email.like(pattern))
                .all()
            )
            user_ids.update(row[0] for row in rows)

        if user_ids:
            clean_test_records(db, user_ids=list(user_ids))
