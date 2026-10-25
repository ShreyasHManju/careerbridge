"""Non-database unit tests for test-schema and migration-bootstrap safeguards."""

import contextlib
import io
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import importlib.util

class _IgnoreCythonExtensionFinder:
    @classmethod
    def find_spec(cls, fullname, path=None, target=None):
        if fullname.startswith("sqlalchemy.") and fullname.endswith("_cy"):
            if path:
                for p in path:
                    py_file = os.path.join(p, fullname.split(".")[-1] + ".py")
                    if os.path.isfile(py_file):
                        return importlib.util.spec_from_file_location(fullname, py_file)
        return None

if not any(getattr(f, "__name__", None) == "_IgnoreCythonExtensionFinder" for f in sys.meta_path):
    sys.meta_path.insert(0, _IgnoreCythonExtensionFinder)

import run_tests
from app.core import test_database



def make_test_url(database_name: str, host: str = "localhost") -> str:
    """Build a credential-free URL without printing it in tests."""
    return f"postgresql://{host}:5432/{database_name}"


class TestTestDatabaseUrlValidation(unittest.TestCase):
    def test_accepts_local_explicit_test_database_without_connecting(self):
        with patch.object(test_database, "create_engine") as create_engine:
            result = test_database.validate_test_database_url(make_test_url("careerbridge_test"))

        self.assertTrue(result.endswith("/careerbridge_test"))
        create_engine.assert_not_called()

    def test_rejects_remote_host_without_connecting(self):
        with patch.object(test_database, "create_engine") as create_engine:
            with self.assertRaisesRegex(RuntimeError, "approved local host"):
                test_database.validate_test_database_url(make_test_url("careerbridge_test", "db.example"))

        create_engine.assert_not_called()

    def test_rejects_protected_database_without_connecting(self):
        with patch.object(test_database, "create_engine") as create_engine:
            with self.assertRaisesRegex(RuntimeError, "protected database"):
                test_database.validate_test_database_url(make_test_url("postgres"))

        create_engine.assert_not_called()


class TestSchemaCreationAndRevisionStampingGuards(unittest.TestCase):
    def test_legacy_schema_helper_cannot_open_an_engine_or_stamp_a_revision(self):
        with patch.object(test_database, "get_test_engine") as get_test_engine:
            with self.assertRaisesRegex(RuntimeError, "schema creation is disabled"):
                test_database.init_test_schema()

        get_test_engine.assert_not_called()


class TestMigrationBootstrapGuard(unittest.TestCase):
    def test_bootstrap_command_is_reviewable_but_not_executed(self):
        command = run_tests.migration_bootstrap_command("test-python")
        self.assertEqual(command, ["test-python", "-m", "alembic", "upgrade", "head"])

        with patch.object(run_tests.subprocess, "run") as subprocess_run:
            with self.assertRaisesRegex(RuntimeError, "disabled pending separate approval"):
                run_tests.reject_migration_bootstrap_request("test-python")

        subprocess_run.assert_not_called()

    def test_requested_bootstrap_aborts_before_any_suite_subprocess(self):
        fake_test_database = types.ModuleType("app.core.test_database")
        fake_test_database.validate_test_database_url = lambda: make_test_url("careerbridge_test")

        with patch.dict(sys.modules, {"app.core.test_database": fake_test_database}):
            with patch.object(run_tests.subprocess, "run") as subprocess_run:
                with patch.object(sys, "argv", ["run_tests.py", run_tests.MIGRATION_BOOTSTRAP_FLAG]):
                    with contextlib.redirect_stdout(io.StringIO()):
                        with self.assertRaises(SystemExit) as exit_context:
                            run_tests.main()

        self.assertEqual(exit_context.exception.code, 1)
        subprocess_run.assert_not_called()


class TestTestDatabaseIdentityVerification(unittest.TestCase):
    def test_verify_identity_accepts_non_superuser_on_test_db(self):
        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.return_value.one.return_value = ("internship_test_db", "test_runner", False)
        mock_engine = unittest.mock.MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        res = test_database.verify_test_database_identity(mock_engine)
        self.assertEqual(res["database"], "internship_test_db")
        self.assertEqual(res["user"], "test_runner")
        self.assertFalse(res["is_superuser"])

    def test_verify_identity_rejects_superuser(self):
        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.return_value.one.return_value = ("internship_test_db", "postgres", True)
        mock_engine = unittest.mock.MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        with self.assertRaisesRegex(RuntimeError, "superuser privileges"):
            test_database.verify_test_database_identity(mock_engine)

    def test_verify_identity_rejects_protected_database(self):
        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.return_value.one.return_value = ("postgres", "test_runner", False)
        mock_engine = unittest.mock.MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        with self.assertRaisesRegex(RuntimeError, "protected database"):
            test_database.verify_test_database_identity(mock_engine)

    def test_verify_identity_fails_closed_on_connection_error(self):
        mock_engine = unittest.mock.MagicMock()
        mock_engine.connect.side_effect = Exception("network unreachable")

        with self.assertRaisesRegex(RuntimeError, "Unable to establish verification connection"):
            test_database.verify_test_database_identity(mock_engine)


class TestE2EStartupGuard(unittest.TestCase):
    def test_startup_guard_passes_when_test_database_is_verified(self):
        import asyncio
        from app.main import lifespan

        mock_app = unittest.mock.MagicMock()
        mock_engine = unittest.mock.MagicMock()
        mock_engine.url = "postgresql://localhost:5435/internship_test_db"
        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.return_value.scalar.return_value = "b8c9d0e1f2a3"
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        with patch.dict(os.environ, {"CAREERBRIDGE_TEST_MODE": "1"}):
            with patch("app.core.database.engine", mock_engine):
                with patch("app.core.test_database.validate_test_database_url", return_value="postgresql://localhost:5435/internship_test_db") as mock_val:
                    with patch("app.core.test_database.verify_test_database_identity", return_value={"database": "internship_test_db", "user": "careerbridge_test_runner", "is_superuser": False}) as mock_ident:
                        async def run_test():
                            async with lifespan(mock_app):
                                pass
                        asyncio.run(run_test())
                        mock_val.assert_called_once()
                        mock_ident.assert_called_once()

    def test_startup_guard_rejects_mismatched_revision(self):
        import asyncio
        from app.main import lifespan

        mock_app = unittest.mock.MagicMock()
        mock_engine = unittest.mock.MagicMock()
        mock_engine.url = "postgresql://localhost:5435/internship_test_db"
        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.return_value.scalar.return_value = "wrong_revision"
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        with patch.dict(os.environ, {"CAREERBRIDGE_TEST_MODE": "1"}):
            with patch("app.core.database.engine", mock_engine):
                with patch("app.core.test_database.validate_test_database_url", return_value="postgresql://localhost:5435/internship_test_db"):
                    with patch("app.core.test_database.verify_test_database_identity", return_value={"database": "internship_test_db", "user": "careerbridge_test_runner", "is_superuser": False}):
                        async def run_test():
                            async with lifespan(mock_app):
                                pass
                        with self.assertRaisesRegex(RuntimeError, "does not match expected revision"):
                            asyncio.run(run_test())

    def test_startup_guard_skipped_when_test_mode_is_off(self):
        import asyncio
        from app.main import lifespan

        mock_app = unittest.mock.MagicMock()
        mock_engine = unittest.mock.MagicMock()

        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CAREERBRIDGE_TEST_MODE", None)
            with patch("app.core.database.engine", mock_engine):
                with patch("app.core.test_database.validate_test_database_url") as mock_val:
                    async def run_test():
                        async with lifespan(mock_app):
                            pass
                    asyncio.run(run_test())
                    mock_val.assert_not_called()

    def test_startup_guard_rejects_unauthorized_role(self):
        import asyncio
        from app.main import lifespan

        mock_app = unittest.mock.MagicMock()
        mock_engine = unittest.mock.MagicMock()
        mock_engine.url = "postgresql://localhost:5435/internship_test_db"

        with patch.dict(os.environ, {"CAREERBRIDGE_TEST_MODE": "1"}):
            with patch("app.core.database.engine", mock_engine):
                with patch("app.core.test_database.validate_test_database_url", return_value="postgresql://localhost:5435/internship_test_db"):
                    with patch("app.core.test_database.verify_test_database_identity", return_value={"database": "internship_test_db", "user": "postgres", "is_superuser": False}):
                        async def run_test():
                            async with lifespan(mock_app):
                                pass
                        with self.assertRaisesRegex(RuntimeError, "unauthorized role"):
                            asyncio.run(run_test())

    def test_startup_guard_rejects_superuser(self):
        import asyncio
        from app.main import lifespan

        mock_app = unittest.mock.MagicMock()
        mock_engine = unittest.mock.MagicMock()
        mock_engine.url = "postgresql://localhost:5435/internship_test_db"

        with patch.dict(os.environ, {"CAREERBRIDGE_TEST_MODE": "1"}):
            with patch("app.core.database.engine", mock_engine):
                with patch("app.core.test_database.validate_test_database_url", return_value="postgresql://localhost:5435/internship_test_db"):
                    with patch("app.core.test_database.verify_test_database_identity", return_value={"database": "internship_test_db", "user": "careerbridge_test_runner", "is_superuser": True}):
                        async def run_test():
                            async with lifespan(mock_app):
                                pass
                        with self.assertRaisesRegex(RuntimeError, "Superuser access detected"):
                            asyncio.run(run_test())


class TestE2ECleanupSafeguards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import importlib.util
        cleanup_path = BACKEND_DIR.parent / "frontend" / "e2e" / "cleanup_e2e_db.py"
        spec = importlib.util.spec_from_file_location("cleanup_e2e_db", cleanup_path)
        cls.cleanup_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.cleanup_mod)

    def test_cleanup_guard_rejects_missing_test_database_url(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("TEST_DATABASE_URL", None)
            with self.assertRaisesRegex(RuntimeError, "TEST_DATABASE_URL must be explicitly set"):
                self.cleanup_mod.verify_safe_cleanup_target()

    def test_cleanup_guard_accepts_verified_test_target(self):
        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.return_value.scalar.return_value = "b8c9d0e1f2a3"
        mock_engine = unittest.mock.MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        with patch.dict(os.environ, {"TEST_DATABASE_URL": make_test_url("internship_test_db")}):
            with patch.object(test_database, "verify_test_database_identity", return_value={"database": "internship_test_db", "user": "careerbridge_test_runner", "is_superuser": False}):
                result = self.cleanup_mod.verify_safe_cleanup_target(mock_engine)
                self.assertEqual(result, mock_engine)

    def test_cleanup_guard_rejects_unexpected_database(self):
        mock_engine = unittest.mock.MagicMock()
        with patch.dict(os.environ, {"TEST_DATABASE_URL": make_test_url("some_other_test_db")}):
            with patch.object(test_database, "verify_test_database_identity", return_value={"database": "some_other_test_db", "user": "careerbridge_test_runner", "is_superuser": False}):
                with self.assertRaisesRegex(RuntimeError, "Connected to unexpected database"):
                    self.cleanup_mod.verify_safe_cleanup_target(mock_engine)

    def test_cleanup_guard_rejects_wrong_revision(self):
        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.return_value.scalar.return_value = "wrong_rev"
        mock_engine = unittest.mock.MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        with patch.dict(os.environ, {"TEST_DATABASE_URL": make_test_url("internship_test_db")}):
            with patch.object(test_database, "verify_test_database_identity", return_value={"database": "internship_test_db", "user": "careerbridge_test_runner", "is_superuser": False}):
                with self.assertRaisesRegex(RuntimeError, "Unexpected schema revision"):
                    self.cleanup_mod.verify_safe_cleanup_target(mock_engine)


if __name__ == "__main__":
    unittest.main()
