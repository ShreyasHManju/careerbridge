#!/usr/bin/env python
"""
CareerBridge Centralized Backend Test Runner
Executes all platform test suites or specified subsets, measuring elapsed time
and generating a clean execution summary.

IMPORTANT ISOLATION ARCHITECTURE NOTE:
This centralized runner enforces preflight test database validation and injects
the validated TEST_DATABASE_URL into all child subprocesses.
Direct execution of individual test scripts (e.g. `python test_xxx.py`) bypasses
this runner. Therefore, fail-closed isolation is independently enforced at the
module and session level within `app.core.test_database` (`LazyTestEngine` /
`LazyTestSessionLocal`), ensuring any standalone execution that attempts database
access without a valid test database configuration fails closed immediately.
"""

import argparse
import os
from pathlib import Path
import subprocess
import sys
import time
from typing import List, Tuple

backend_dir = Path(__file__).resolve().parent
MIGRATION_BOOTSTRAP_FLAG = "--bootstrap-migrations"


def discover_test_files() -> List[str]:
    """Find all test_*.py files in backend directory sorted alphabetically."""
    files = [
        f for f in os.listdir(backend_dir)
        if f.startswith("test_") and f.endswith(".py")
    ]
    return sorted(files)


def run_suite(python_bin: str, test_file: str, env: dict) -> Tuple[bool, float, str]:
    """
    Run a single test script via subprocess, capturing status, time, and output.
    Centrally bootstraps test database isolation and dependency overrides prior
    to executing the test script, guaranteeing standalone scripts cannot bypass overrides.
    """
    start_time = time.time()
    bootstrap_cmd = (
        "import app.core.test_database as _tdb; "
        "_tdb.apply_test_dependency_overrides(); "
        "import runpy, sys; "
        "sys.argv[0] = sys.argv[1]; "
        "del sys.argv[1]; "
        "runpy.run_path(sys.argv[0], run_name='__main__')"
    )
    res = subprocess.run(
        [python_bin, "-c", bootstrap_cmd, test_file],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        env=env,
    )
    elapsed = time.time() - start_time
    output = res.stdout + "\n" + res.stderr
    return res.returncode == 0, elapsed, output


def migration_bootstrap_command(python_bin: str) -> List[str]:
    """Return the future isolated-test migration command without executing it."""
    return [python_bin, "-m", "alembic", "upgrade", "head"]


def reject_migration_bootstrap_request(python_bin: str) -> None:
    """
    Keep database mutation explicitly disabled until separately approved.

    The command is constructed only for reviewability; it is intentionally not
    passed to subprocess.run in this change.
    """
    del python_bin
    raise RuntimeError(
        "Test database migration bootstrap is disabled pending separate approval. "
        "No Alembic command was executed."
    )


def main():
    # --------------------------------------------------------------------------
    # Mandatory Preflight Guard: Test Database Isolation Verification
    # Refuses to run any test suite unless a valid, test-designated database URL is set.
    # Strictly fails closed and forbids access to application, staging, or production DBs.
    # --------------------------------------------------------------------------
    try:
        from app.core.test_database import validate_test_database_url, verify_test_database_identity
        validated_test_url = validate_test_database_url()
        verified_info = verify_test_database_identity()
        print(f"[INFO] Verified disposable test database target: {verified_info['database']} (user: {verified_info['user']}, non-superuser)")
    except Exception as exc:
        print("=" * 75)
        print("FATAL: TEST DATABASE ISOLATION PREFLIGHT GUARD FAILED")
        print("=" * 75)
        print(f"Error: {exc}")
        print("\nTest execution aborted.")
        print("A dedicated PostgreSQL test database URL is required via TEST_DATABASE_URL.")
        print("Example: TEST_DATABASE_URL=postgresql://careerbridge_test_runner:password@127.0.0.1:5435/internship_test_db")
        print("Testing against application, staging, or production databases is strictly prohibited.")
        print("=" * 75)
        sys.exit(1)

    test_env = os.environ.copy()
    test_env["TEST_DATABASE_URL"] = validated_test_url
    test_env["CAREERBRIDGE_TEST_MODE"] = "1"
    test_env.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key-careerbridge-safety-32bytes")
    test_env.setdefault("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
    test_env.setdefault("POSTGRES_USER", "postgres")
    test_env.setdefault("POSTGRES_PASSWORD", "postgres")


    parser = argparse.ArgumentParser(description="CareerBridge Backend Test Runner")
    parser.add_argument(
        "suites",
        nargs="*",
        help="Specific test file(s) to run. If omitted, runs all discovered test suites.",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print full stdout/stderr of each suite as it runs.",
    )
    parser.add_argument(
        MIGRATION_BOOTSTRAP_FLAG,
        action="store_true",
        help="Reserved migration bootstrap switch; database execution is disabled pending approval.",
    )
    args = parser.parse_args()

    python_bin = sys.executable

    # This gate is deliberately before discovery and suite subprocesses.  It
    # defines the future ordering (validate -> migrate -> tests) while keeping
    # all database-mutating work disabled in the current implementation.
    if args.bootstrap_migrations:
        try:
            reject_migration_bootstrap_request(python_bin)
        except RuntimeError as exc:
            print(f"FATAL: {exc}")
            sys.exit(1)

    print("[INFO] Test database migration bootstrap is disabled pending separate approval.")

    all_discovered = discover_test_files()
    if args.suites:
        target_suites = []
        for s in args.suites:
            target = s if s.endswith(".py") else f"{s}.py"
            if not target.startswith("test_"):
                target = f"test_{target}"
            if target in all_discovered:
                target_suites.append(target)
            else:
                print(f"[WARN] Requested suite '{s}' not found in {backend_dir}. Skipping.")
        if not target_suites:
            print("[ERROR] No matching test suites found.")
            sys.exit(1)
    else:
        target_suites = all_discovered

    print("=" * 75)
    print(f"CAREERBRIDGE BACKEND TEST RUNNER — {len(target_suites)} SUITES SCHEDULED")
    print(f"Python: {python_bin}")
    print("=" * 75)

    passed_suites = []
    failed_suites = []
    total_start = time.time()

    for idx, suite in enumerate(target_suites, 1):
        print(f"[{idx:02d}/{len(target_suites):02d}] Running {suite}...", end="", flush=True)
        success, elapsed, output = run_suite(python_bin, suite, env=test_env)

        if success:
            print(f" [PASS] ({elapsed:.2f}s)")
            passed_suites.append((suite, elapsed))
        else:
            print(f" [FAIL] ({elapsed:.2f}s)")
            failed_suites.append((suite, elapsed, output))

        if args.verbose or not success:
            if not success:
                print("-" * 60)
                print(f"FAILURE OUTPUT FOR {suite}:")
                print(output[-1500:] if len(output) > 1500 else output)
                print("-" * 60)

    total_elapsed = time.time() - total_start

    print("\n" + "=" * 75)
    print("CAREERBRIDGE BACKEND TEST EXECUTION SUMMARY")
    print("=" * 75)
    print(f"Total Suites Executed : {len(target_suites)}")
    print(f"Suites Passed         : {len(passed_suites)}")
    print(f"Suites Failed         : {len(failed_suites)}")
    print(f"Total Elapsed Time    : {total_elapsed:.2f}s")
    print("=" * 75)

    if failed_suites:
        print("\nFAILED SUITES:")
        for f_name, f_time, _ in failed_suites:
            print(f"  - {f_name} ({f_time:.2f}s)")
        print("\nTest execution failed. See logs above for failure details.")
        sys.exit(1)
    else:
        print("\nALL TEST SUITES PASSED 100% SUCCESSFULLY!")
        sys.exit(0)


if __name__ == "__main__":
    main()
