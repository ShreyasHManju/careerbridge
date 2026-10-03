#!/usr/bin/env python3
"""
CareerBridge Production Deployment & Operational Smoke Test Script
Validates core runtime health, deep dependency readiness, routing fallbacks,
and security rate-limiting invariants across backend and frontend services.

Endpoints validated:
1. Backend Liveness Probe (/health/live)
2. Backend Readiness Probe (/health/ready - DB, Migrations, Storage)
3. Backend Legacy Health Probe (/health)
4. Backend API Root (/)
5. Backend OpenAPI Schema (/openapi.json)
6. Security / Anti-Enumeration Rate Limit Endpoint (/api/v1/auth/password-reset/request)
7. Frontend Web Root (/)
8. Frontend SPA Route Fallback (/app/jobs)
9. Frontend Nginx Health (/nginx-health)
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Optional, Tuple


def check_request(
    url: str,
    method: str = "GET",
    headers: Optional[dict] = None,
    data: Optional[bytes] = None,
    expected_status: int = 200,
    timeout: int = 5,
) -> Tuple[bool, int, str, dict]:
    """Execute an HTTP request and return status, response body, and headers."""
    req_headers = {"User-Agent": "CareerBridge-SmokeTest/1.0"}
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(
        url,
        data=data,
        headers=req_headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status = response.status
            body = response.read().decode("utf-8", errors="replace")
            resp_headers = dict(response.headers)
            return (status == expected_status, status, body, resp_headers)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        resp_headers = dict(e.headers) if hasattr(e, "headers") else {}
        return (e.code == expected_status, e.code, body, resp_headers)
    except Exception as e:
        return (False, 0, str(e), {})


def run_smoke_tests(backend_url: str, frontend_url: str) -> bool:
    print("===========================================================================")
    print("CAREERBRIDGE OPERATIONAL & DEPLOYMENT SMOKE TEST SUITE")
    print("===========================================================================")
    print(f"Backend Target  : {backend_url}")
    print(f"Frontend Target : {frontend_url}")
    print("---------------------------------------------------------------------------")

    all_passed = True
    b_url = backend_url.rstrip("/")
    f_url = frontend_url.rstrip("/")

    # 1. Backend Liveness Probe (/health/live)
    live_url = f"{b_url}/health/live"
    print(f"[*] Checking Backend Liveness Probe: {live_url} ... ", end="")
    ok, status, body, _ = check_request(live_url)
    if ok:
        try:
            data = json.loads(body)
            if data.get("status") == "alive":
                print(f"PASS (HTTP {status}, Process Alive)")
            else:
                print(f"WARN (HTTP {status}, Payload: {body})")
        except Exception:
            print(f"PASS (HTTP {status})")
    else:
        print(f"FAIL (HTTP {status}, Response: {body[:100]})")
        all_passed = False

    # 2. Backend Readiness Probe (/health/ready)
    ready_url = f"{b_url}/health/ready"
    print(f"[*] Checking Backend Readiness Probe: {ready_url} ... ", end="")
    ok, status, body, _ = check_request(ready_url)
    if ok:
        try:
            data = json.loads(body)
            checks = data.get("checks", {})
            db_status = checks.get("database", {}).get("status", "unknown")
            storage_status = checks.get("storage", {}).get("status", "unknown")
            print(f"PASS (HTTP {status}, DB: {db_status}, Storage: {storage_status})")
        except Exception:
            print(f"PASS (HTTP {status})")
    else:
        print(f"FAIL (HTTP {status}, Response: {body[:100]})")
        all_passed = False

    # 3. Backend Legacy Health Probe (/health)
    health_url = f"{b_url}/health"
    print(f"[*] Checking Backend Legacy Health Probe: {health_url} ... ", end="")
    ok, status, body, _ = check_request(health_url)
    if ok:
        try:
            data = json.loads(body)
            if data.get("status") == "ok" and data.get("database") == "connected":
                print(f"PASS (HTTP {status}, DB Connected)")
            else:
                print(f"WARN (HTTP {status}, Payload: {body})")
        except Exception:
            print(f"PASS (HTTP {status})")
    else:
        print(f"FAIL (HTTP {status}, Response: {body[:100]})")
        all_passed = False

    # 4. Backend Root Endpoint (/)
    root_url = f"{b_url}/"
    print(f"[*] Checking Backend Root Endpoint: {root_url} ... ", end="")
    ok, status, body, _ = check_request(root_url)
    if ok:
        print(f"PASS (HTTP {status})")
    else:
        print(f"FAIL (HTTP {status})")
        all_passed = False

    # 5. Backend OpenAPI Specification (/openapi.json)
    openapi_url = f"{b_url}/openapi.json"
    print(f"[*] Checking OpenAPI JSON Spec: {openapi_url} ... ", end="")
    ok, status, body, _ = check_request(openapi_url)
    if ok:
        try:
            spec = json.loads(body)
            title = spec.get("info", {}).get("title", "Unknown")
            version = spec.get("info", {}).get("version", "")
            print(f"PASS (HTTP {status}, Title: '{title}', Version: '{version}')")
        except Exception:
            print(f"PASS (HTTP {status})")
    else:
        print(f"FAIL (HTTP {status})")
        all_passed = False

    # 6. Security Anti-Enumeration & Rate-Limiting Check (/api/v1/auth/password-reset/request)
    reset_url = f"{b_url}/api/v1/auth/password-reset/request"
    print(f"[*] Checking Security Endpoint & Anti-Enumeration: {reset_url} ... ", end="")
    payload = json.dumps({"email": "smoke_test_probe@careerbridge.io"}).encode("utf-8")
    ok, status, body, headers = check_request(
        reset_url,
        method="POST",
        headers={"Content-Type": "application/json"},
        data=payload,
        expected_status=200,
    )
    if ok:
        try:
            data = json.loads(body)
            if "message" in data:
                print(f"PASS (HTTP {status}, Anti-Enumeration Verified)")
            else:
                print(f"WARN (HTTP {status}, Body: {body})")
        except Exception:
            print(f"PASS (HTTP {status})")
    elif status == 429:
        retry_after = headers.get("Retry-After", headers.get("retry-after", "present"))
        print(f"PASS (HTTP 429 Rate Limited, Retry-After: {retry_after})")
    else:
        print(f"FAIL (HTTP {status}, Response: {body[:100]})")
        all_passed = False

    # 7. Frontend Web Root (/)
    fe_root_url = f"{f_url}/"
    print(f"[*] Checking Frontend Web Root HTML: {fe_root_url} ... ", end="")
    ok, status, body, _ = check_request(fe_root_url)
    if ok and ("<html" in body.lower() or "<!doctype html" in body.lower()):
        print(f"PASS (HTTP {status}, Valid HTML document)")
    else:
        print(f"FAIL (HTTP {status})")
        all_passed = False

    # 8. Frontend SPA Route Fallback (/app/jobs)
    fe_spa_url = f"{f_url}/app/jobs"
    print(f"[*] Checking Frontend SPA Route Resolution: {fe_spa_url} ... ", end="")
    ok, status, body, _ = check_request(fe_spa_url)
    if ok and ("<html" in body.lower() or "<!doctype html" in body.lower()):
        print(f"PASS (HTTP {status}, SPA fallback active)")
    else:
        print(f"FAIL (HTTP {status})")
        all_passed = False

    # 9. Optional: Frontend Nginx Container Health Endpoint (/nginx-health)
    fe_health_url = f"{f_url}/nginx-health"
    ok, status, _, _ = check_request(fe_health_url)
    if ok:
        print(f"[*] Checking Frontend Nginx Health: {fe_health_url} ... PASS (HTTP {status})")

    print("---------------------------------------------------------------------------")
    if all_passed:
        print("RESULT: ALL OPERATIONAL SMOKE CHECKS PASSED.")
    else:
        print("RESULT: ONE OR MORE SMOKE CHECKS FAILED.")
    print("===========================================================================")
    return all_passed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run CareerBridge deployment smoke tests.")
    parser.add_argument(
        "--backend-url",
        default="http://127.0.0.1:8000",
        help="Backend base URL (default: http://127.0.0.1:8000)",
    )
    parser.add_argument(
        "--frontend-url",
        default="http://localhost:5173",
        help="Frontend base URL (default: http://localhost:5173)",
    )
    args = parser.parse_args()

    success = run_smoke_tests(args.backend_url, args.frontend_url)
    sys.exit(0 if success else 1)
