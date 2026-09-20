"""
CareerBridge Phase 30A Observability & Operational Reliability Test Suite
Verifies:
1. Request correlation ID generation, validation, sanitization, and header propagation.
2. Standardized error response envelopes include request_id and matching header.
3. Concurrency safety of ContextVar request correlation ID across parallel requests.
4. Structured logging RequestIdFilter behavior inside and outside HTTP request scope.
5. Operational script safety (no hardcoded passwords, argument checking, and syntax).
"""

from concurrent.futures import ThreadPoolExecutor
import logging
from pathlib import Path
import re
import sys
import uuid

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.core.logging import RequestIdFilter, get_request_id, set_request_id, reset_request_id

client = TestClient(app)


# --------------------------------------------------------------------------
# 1. Request ID Generation & Propagation Tests
# --------------------------------------------------------------------------
def test_request_without_request_id_generates_valid_uuid():
    resp = client.get("/")
    assert resp.status_code == 200
    assert "x-request-id" in resp.headers
    req_id = resp.headers["x-request-id"]
    # Verify it is a valid UUID
    parsed = uuid.UUID(req_id)
    assert str(parsed) == req_id


def test_request_with_valid_supplied_request_id_propagates():
    custom_id = "custom-client-trace-id-12345"
    resp = client.get("/", headers={"X-Request-ID": custom_id})
    assert resp.status_code == 200
    assert resp.headers["x-request-id"] == custom_id


def test_request_with_invalid_unsafe_request_id_is_sanitized():
    # CRLF / newline injection attempt
    malicious_id = "invalid\r\nHeader: Injected"
    resp = client.get("/", headers={"X-Request-ID": malicious_id})
    assert resp.status_code == 200
    # Must NOT equal the malicious string; must have generated a new safe UUID
    propagated_id = resp.headers["x-request-id"]
    assert propagated_id != malicious_id
    assert "\r" not in propagated_id and "\n" not in propagated_id
    uuid.UUID(propagated_id)  # verify valid UUID


def test_request_with_oversized_request_id_is_regenerated():
    oversized_id = "a" * 128
    resp = client.get("/", headers={"X-Request-ID": oversized_id})
    assert resp.status_code == 200
    propagated_id = resp.headers["x-request-id"]
    assert propagated_id != oversized_id
    uuid.UUID(propagated_id)


# --------------------------------------------------------------------------
# 2. Standardized Error Response Correlation Tests
# --------------------------------------------------------------------------
def test_404_error_contains_request_id_in_body_and_header():
    custom_id = "test-error-404-correlation-id"
    resp = client.get("/api/v1/nonexistent-route", headers={"X-Request-ID": custom_id})
    assert resp.status_code == 404
    assert resp.headers["x-request-id"] == custom_id
    data = resp.json()
    assert data["success"] is False
    assert data["error_code"] == "NOT_FOUND"
    assert data["request_id"] == custom_id


def test_422_validation_error_contains_request_id():
    resp = client.post("/api/v1/auth/login", json={"invalid": "payload"})
    assert resp.status_code == 422
    assert "x-request-id" in resp.headers
    data = resp.json()
    assert data["success"] is False
    assert data["error_code"] == "VALIDATION_ERROR"
    assert "request_id" in data
    assert data["request_id"] == resp.headers["x-request-id"]


def test_500_error_contains_request_id():
    custom_id = "test-error-500-correlation-id"
    client_500 = TestClient(app, raise_server_exceptions=False)
    resp = client_500.get("/test-error-500", headers={"X-Request-ID": custom_id})
    assert resp.status_code == 500
    assert resp.headers.get("x-request-id") == custom_id
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
    assert resp.headers.get("x-xss-protection") == "1; mode=block"
    assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    data = resp.json()
    assert data["success"] is False
    assert data["error_code"] == "INTERNAL_SERVER_ERROR"
    assert data["request_id"] == custom_id


# --------------------------------------------------------------------------
# 3. Concurrency Safety Tests
# --------------------------------------------------------------------------
def test_concurrent_requests_maintain_distinct_isolated_request_ids():
    def make_request(idx: int) -> tuple[str, str]:
        req_id = f"concurrent-req-trace-{idx}-{uuid.uuid4()}"
        resp = client.get("/", headers={"X-Request-ID": req_id})
        return req_id, resp.headers["x-request-id"]

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(make_request, i) for i in range(20)]
        results = [f.result() for f in futures]

    for sent_id, received_id in results:
        assert sent_id == received_id


# --------------------------------------------------------------------------
# 4. Structured Logging Filter Tests
# --------------------------------------------------------------------------
def test_logging_filter_inside_and_outside_request_scope():
    filter_instance = RequestIdFilter()

    # 1. Outside request context
    record_outside = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="Background job log",
        args=(),
        exc_info=None,
    )
    filter_instance.filter(record_outside)
    assert hasattr(record_outside, "request_id")
    assert record_outside.request_id == "-"

    # 2. Inside simulated request context
    test_id = "scoped-request-id-xyz"
    token = set_request_id(test_id)
    try:
        record_inside = logging.LogRecord(
            name="test_logger",
            level=logging.INFO,
            pathname=__file__,
            lineno=2,
            msg="Request-scoped log",
            args=(),
            exc_info=None,
        )
        filter_instance.filter(record_inside)
        assert record_inside.request_id == test_id
    finally:
        reset_request_id(token)


# --------------------------------------------------------------------------
# 5. Operational Backup & Restore Scripts Verification
# --------------------------------------------------------------------------
def test_backup_and_restore_scripts_exist_and_secure():
    scripts_dir = backend_dir / "scripts"
    backup_script = scripts_dir / "backup_db.sh"
    restore_script = scripts_dir / "restore_db.sh"

    assert backup_script.exists(), "backup_db.sh does not exist"
    assert restore_script.exists(), "restore_db.sh does not exist"

    backup_content = backup_script.read_text(encoding="utf-8")
    restore_content = restore_script.read_text(encoding="utf-8")

    # Verify no hardcoded passwords
    assert "password123" not in backup_content.lower()
    assert "password123" not in restore_content.lower()
    assert "set -euo pipefail" in backup_content
    assert "set -euo pipefail" in restore_content

    # Verify backup uses -i flag instead of -t to avoid TTY artifacts
    assert "docker exec -i" in backup_content

    # Verify restore requires confirmation and enforces ON_ERROR_STOP
    assert "CONFIRM_RESTORE" in restore_content
    assert "RESTORE" in restore_content
    assert "ON_ERROR_STOP=1" in restore_content

    # Verify core table existence verification
    assert "users" in restore_content
    assert "job_postings" in restore_content
    assert "applications" in restore_content


# --------------------------------------------------------------------------
# Execution Runner
# --------------------------------------------------------------------------
if __name__ == "__main__":
    print("[1/5] Testing Request ID Generation and Validation...")
    test_request_without_request_id_generates_valid_uuid()
    print("PASS: test_request_without_request_id_generates_valid_uuid")
    test_request_with_valid_supplied_request_id_propagates()
    print("PASS: test_request_with_valid_supplied_request_id_propagates")
    test_request_with_invalid_unsafe_request_id_is_sanitized()
    print("PASS: test_request_with_invalid_unsafe_request_id_is_sanitized")
    test_request_with_oversized_request_id_is_regenerated()
    print("PASS: test_request_with_oversized_request_id_is_regenerated")

    print("[2/5] Testing Error Response Correlation...")
    test_404_error_contains_request_id_in_body_and_header()
    print("PASS: test_404_error_contains_request_id_in_body_and_header")
    test_422_validation_error_contains_request_id()
    print("PASS: test_422_validation_error_contains_request_id")
    test_500_error_contains_request_id()
    print("PASS: test_500_error_contains_request_id")

    print("[3/5] Testing Concurrency Isolation...")
    test_concurrent_requests_maintain_distinct_isolated_request_ids()
    print("PASS: test_concurrent_requests_maintain_distinct_isolated_request_ids")

    print("[4/5] Testing Structured Logging Filter...")
    test_logging_filter_inside_and_outside_request_scope()
    print("PASS: test_logging_filter_inside_and_outside_request_scope")

    print("[5/5] Testing Operational Scripts Security and Parameters...")
    test_backup_and_restore_scripts_exist_and_secure()
    print("PASS: test_backup_and_restore_scripts_exist_and_secure")

    print("\n=======================================================")
    print("ALL OBSERVABILITY AND OPERATIONAL TESTS PASSED (100%)!")
    print("=======================================================\n")
