"""
CareerBridge Isolated Test Database Architecture
Provides fail-closed, isolated test engine and session factory for backend test suites.
Guarantees zero connection or accidental mutation against development, staging, or production databases.

CRITICAL SAFETY INVARIANTS:
1. TEST_DATABASE_URL is strictly mandatory for test suite execution. No fallback
   to DATABASE_URL, POSTGRES_DB, or the application default engine is permitted.
2. A test-like database name (e.g. ending in '_test' or '_test_db') is a syntactic
   defense-in-depth constraint, but is NOT proof that the database is actually disposable
   or unshared. Operators must ensure the target database contains no production or
   irreplaceable data before executing destructive tests.
3. The validator performs in-memory parsing and blocklist verification only. It does NOT
   connect to the target database to verify it, preventing any unintended connection side effects.
4. Validation error messages strictly omit credentials, tokens, passwords, and connection strings.
"""

import os
import sys
from typing import Generator, List, Optional, Set

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session, sessionmaker

# Database names strictly prohibited from test execution
PROTECTED_DATABASE_NAMES: Set[str] = {
    "internship_db",
    "internship_staging_db",
    "postgres",
    "production",
    "staging",
    "careerbridge",
    "careerbridge_prod",
    "careerbridge_staging",
    "template0",
    "template1",
}


def validate_test_database_url(url_str: Optional[str] = None) -> str:
    """
    Validates that a dedicated test PostgreSQL database URL is configured,
    syntactically valid, uses PostgreSQL driver, avoids all protected databases,
    and references an explicitly test-designated database name.

    Fails closed with safe, credential-free error messages.
    Does NOT fall back to DATABASE_URL, POSTGRES_DB, or the application default engine.
    """
    raw_url = url_str
    if raw_url is None:
        raw_url = os.environ.get("TEST_DATABASE_URL")
    if raw_url is None:
        for candidate in [".env.test", "../.env.test", os.path.join(os.path.dirname(__file__), "../../../.env.test")]:
            if os.path.isfile(candidate):
                try:
                    with open(candidate, "r", encoding="utf-8") as f:
                        for line in f:
                            clean_line = line.strip()
                            if clean_line.startswith("TEST_DATABASE_URL="):
                                raw_url = clean_line.split("=", 1)[1].strip().strip('"').strip("'")
                                break
                except Exception:
                    pass
            if raw_url:
                break
    if raw_url is None:
        try:
            from app.core.config import settings
            raw_url = getattr(settings, "TEST_DATABASE_URL", None)
        except Exception:
            raw_url = None

    if not raw_url or not str(raw_url).strip():
        raise RuntimeError(
            "FAIL-CLOSED: TEST_DATABASE_URL is not configured. "
            "A dedicated, disposable PostgreSQL test database is required for test execution. "
            "Testing against application, staging, or production databases is strictly prohibited."
        )

    clean_url = str(raw_url).strip()

    # Normalize postgres:// scheme to postgresql:// for SQLAlchemy
    if clean_url.startswith("postgres://"):
        clean_url = f"postgresql://{clean_url[11:]}"

    try:
        parsed = make_url(clean_url)
    except Exception:
        raise RuntimeError(
            "FAIL-CLOSED: TEST_DATABASE_URL is malformed. "
            "Unable to parse the provided test database URL."
        ) from None

    # Allow local database hosts only by default; reject remote hosts.
    allowed_hosts = {"localhost", "127.0.0.1", "::1"}
    hostname = parsed.host

    if not hostname or hostname.lower() not in allowed_hosts:
        raise RuntimeError(
            "FAIL-CLOSED: TEST_DATABASE_URL must target an approved local host "
            "(localhost, 127.0.0.1, or ::1). Remote database hosts are not allowed."
        )


    db_name = parsed.database
    if not db_name or not db_name.strip():
        raise RuntimeError(
            "FAIL-CLOSED: TEST_DATABASE_URL does not specify a target database name."
        )

    db_name_clean = db_name.strip().lower()

    if db_name_clean in PROTECTED_DATABASE_NAMES:
        raise RuntimeError(
            f"FAIL-CLOSED: TEST_DATABASE_URL targets protected database '{db_name}'. "
            "Test execution against production, staging, or application databases is strictly prohibited."
        )

    is_test_designated = (
        db_name_clean.endswith("_test")
        or db_name_clean.endswith("_test_db")
        or db_name_clean.startswith("test_")
    )
    if not is_test_designated:
        raise RuntimeError(
            f"FAIL-CLOSED: Database '{db_name}' is not an explicitly test-designated database name. "
            "The test database name must end in '_test' or '_test_db' (e.g. 'internship_test_db')."
        )

    return clean_url


def get_test_database_name(url_str: Optional[str] = None) -> str:
    """
    Returns the database name from the validated TEST_DATABASE_URL.
    """
    valid_url = validate_test_database_url(url_str)
    parsed = make_url(valid_url)
    return parsed.database or ""


def verify_test_database_identity(target_engine: Optional[Engine] = None) -> dict:
    """
    Independently connects to the test database and verifies:
    1. The connected database is NOT in PROTECTED_DATABASE_NAMES.
    2. The connected database is an approved test database.
    3. The connecting role is NOT a PostgreSQL superuser.
    4. Credential-free error reporting.
    """
    from sqlalchemy import text
    eng = target_engine or get_test_engine()
    try:
        with eng.connect() as conn:
            row = conn.execute(
                text("SELECT current_database(), current_user, (SELECT usesuper FROM pg_user WHERE usename = current_user);")
            ).one()
            db_name, db_user, is_super = row[0], row[1], bool(row[2])
    except Exception as exc:
        if isinstance(exc, RuntimeError):
            raise
        raise RuntimeError(
            "FAIL-CLOSED: Unable to establish verification connection to configured test database."
        ) from None

    if db_name in PROTECTED_DATABASE_NAMES:
        raise RuntimeError(
            f"FAIL-CLOSED: Connected database '{db_name}' is a protected database. Test execution aborted."
        )

    if not (db_name.endswith("_test") or db_name.endswith("_test_db") or db_name.startswith("test_")):
        raise RuntimeError(
            f"FAIL-CLOSED: Connected database '{db_name}' is not an explicitly test-designated database."
        )

    if is_super:
        raise RuntimeError(
            f"FAIL-CLOSED: Connected user '{db_user}' has PostgreSQL superuser privileges. "
            "Tests must execute under a least-privilege, non-superuser role."
        )

    return {"database": db_name, "user": db_user, "is_superuser": is_super}


_test_engine: Optional[Engine] = None
_test_sessionmaker: Optional[sessionmaker] = None


def get_test_engine() -> Engine:
    """
    Returns the singleton test Engine bound to the validated TEST_DATABASE_URL.
    Fails closed if TEST_DATABASE_URL is missing, invalid, or targets a protected database.
    Independently verifies the live database identity and enforces non-superuser execution.
    """
    global _test_engine
    if _test_engine is None:
        validated_url = validate_test_database_url()
        eng = create_engine(
            validated_url,
            pool_pre_ping=True,
            echo=False,
        )
        verify_test_database_identity(eng)
        _test_engine = eng
    return _test_engine


def get_test_sessionmaker() -> sessionmaker:
    """
    Returns the sessionmaker factory bound strictly to the isolated test engine.
    """
    global _test_sessionmaker
    if _test_sessionmaker is None:
        engine_inst = get_test_engine()
        _test_sessionmaker = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine_inst,
        )
    return _test_sessionmaker


def get_test_db_override() -> Generator[Session, None, None]:
    """
    FastAPI dependency override providing an isolated database session per request.
    Yields session bound to the validated test engine.
    Ensures connection is closed when request finishes.
    """
    factory = get_test_sessionmaker()
    db = factory()
    try:
        yield db
    finally:
        db.close()


class LazyTestEngine:
    """
    Proxy that lazily delegates all attribute access and method calls
    to get_test_engine(). Configuration validation occurs upon first access.
    """
    @property
    def _engine(self) -> Engine:
        return get_test_engine()

    def connect(self, *args, **kwargs):
        return self._engine.connect(*args, **kwargs)

    def begin(self, *args, **kwargs):
        return self._engine.begin(*args, **kwargs)

    def execute(self, *args, **kwargs):
        return self._engine.execute(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._engine, name)

    def __repr__(self):
        return "<LazyTestEngine (isolated test database)>"


try:
    from sqlalchemy.inspection import _registrars
    _registrars[LazyTestEngine] = lambda lazy: _registrars[Engine](lazy._engine)
except Exception:
    pass


class LazyTestSessionLocal:
    """
    Callable proxy that lazily delegates session creation to get_test_sessionmaker().
    Configuration validation occurs upon first session creation.
    """
    def __call__(self, *args, **kwargs) -> Session:
        return get_test_sessionmaker()(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(get_test_sessionmaker(), name)

    def __repr__(self):
        return "<LazyTestSessionLocal (isolated test sessionmaker)>"


# Canonical test database interface
test_engine = LazyTestEngine()
TestSessionLocal = LazyTestSessionLocal()

# Drop-in compatibility aliases for test suites replacing app.core.database
engine = test_engine
SessionLocal = TestSessionLocal
from app.models.base import Base



def init_test_schema(tables: Optional[List] = None) -> None:
    """
    Disabled compatibility hook for legacy tests.

    Test schemas must be created exclusively by Alembic migrations.  In
    particular, this function must never create ORM metadata tables or write
    an Alembic revision, because either action could falsely represent a
    partially-created schema as fully migrated.
    """
    del tables
    raise RuntimeError(
        "FAIL-CLOSED: Test schema creation is disabled. "
        "Apply Alembic migrations to the validated isolated test database before running tests."
    )



_override_state_stack: List[dict] = []


def apply_test_dependency_overrides(app_instance=None) -> None:
    """
    Registers the isolated test database dependency override on the FastAPI app
    and routes WebSocket routes to use the isolated test session factory.
    Preserves exact prior override state to enable clean restoration.
    Rolls back any state already modified if setup partially fails.
    Safe against repeated invocations.
    """
    if app_instance is None:
        from app.main import app as app_instance
    from app.core.database import get_db

    # 1. Capture exact prior state
    had_previous_get_db = get_db in app_instance.dependency_overrides
    previous_get_db = app_instance.dependency_overrides.get(get_db)

    ws_module = None
    previous_ws_session_factory = None
    try:
        import app.routers.websocket_messaging as ws_module
        previous_ws_session_factory = getattr(ws_module, "SessionLocal", None)
    except ImportError:
        ws_module = None

    # 2. Apply get_db override
    app_instance.dependency_overrides[get_db] = get_test_db_override

    # 3. Apply WebSocket SessionLocal override with rollback on partial failure
    patched_ws = False
    try:
        if ws_module is not None:
            ws_module.SessionLocal = TestSessionLocal
            patched_ws = True
    except Exception:
        # Roll back get_db override to preserve exact prior state on partial setup failure
        if had_previous_get_db:
            app_instance.dependency_overrides[get_db] = previous_get_db
        else:
            app_instance.dependency_overrides.pop(get_db, None)
        raise

    # 4. Record state on stack for subsequent restoration
    _override_state_stack.append({
        "app": app_instance,
        "had_previous_get_db": had_previous_get_db,
        "previous_get_db": previous_get_db,
        "patched_ws": patched_ws,
        "previous_ws_session_factory": previous_ws_session_factory,
    })


def clear_test_dependency_overrides(app_instance=None) -> None:
    """
    Cleans up the test database dependency override from the FastAPI app
    and restores WebSocket routes to the exact prior session factory.
    Safe against repeated invocations and pops from the state stack.
    """
    if app_instance is None:
        try:
            from app.main import app as app_instance
        except Exception:
            app_instance = None

    # Pop most recent state from the stack
    state = None
    if _override_state_stack:
        if app_instance is not None:
            for i in range(len(_override_state_stack) - 1, -1, -1):
                if _override_state_stack[i]["app"] is app_instance:
                    state = _override_state_stack.pop(i)
                    break
        if state is None:
            state = _override_state_stack.pop()

    if state is not None:
        target_app = state["app"]
        from app.core.database import get_db
        if state["had_previous_get_db"]:
            target_app.dependency_overrides[get_db] = state["previous_get_db"]
        else:
            target_app.dependency_overrides.pop(get_db, None)

        if state["patched_ws"]:
            try:
                import app.routers.websocket_messaging as ws_module
                if state["previous_ws_session_factory"] is not None:
                    ws_module.SessionLocal = state["previous_ws_session_factory"]
                else:
                    from app.core.database import SessionLocal as AppSessionLocal
                    ws_module.SessionLocal = AppSessionLocal
            except ImportError:
                pass
    else:
        # Fallback safe cleanup if clear is called without a matching prior apply
        if app_instance is not None:
            from app.core.database import get_db, SessionLocal as AppSessionLocal
            app_instance.dependency_overrides.pop(get_db, None)
            try:
                import app.routers.websocket_messaging as ws_module
                ws_module.SessionLocal = AppSessionLocal
            except ImportError:
                pass
