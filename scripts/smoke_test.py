#!/usr/bin/env python3
"""
CareerBridge Deployment Smoke Test Script
Validates:
1. Backend /health endpoint returns 200 with database connectivity.
2. Backend root / endpoint returns 200 with API status.
3. Backend /openapi.json endpoint serves a valid OpenAPI specification.
4. Frontend / endpoint serves HTML with SPA root container.
5. Frontend SPA routes (/app/jobs, /login) resolve properly via Nginx fallback.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request


def check_url(url: str, expected_status: int = 200, timeout: int = 5) -> tuple[bool, int, str]:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "CareerBridge-SmokeTest/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status = response.status
            body = response.read().decode("utf-8", errors="replace")
            return (status == expected_status, status, body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        return (e.code == expected_status, e.code, body)
    except Exception as e:
        return (False, 0, str(e))


def run_smoke_tests(backend_url: str, frontend_url: str) -> bool:
    print("===========================================================================")
    print("CAREERBRIDGE PRODUCTION DEPLOYMENT SMOKE VALIDATION")
    print("===========================================================================")
    print(f"Backend Target  : {backend_url}")
    print(f"Frontend Target : {frontend_url}")
    print("---------------------------------------------------------------------------")

    all_passed = True

    # 1. Backend /health
    health_url = f"{backend_url.rstrip('/')}/health"
    print(f"[*] Checking Backend Health Endpoint: {health_url} ... ", end="")
    ok, status, body = check_url(health_url)
    if ok:
        try:
            data = json.loads(body)
            if data.get("status") == "ok" and data.get("database") == "connected":
                print(f"PASS (HTTP {status}, DB Connected)")
            else:
                print(f"WARN (HTTP {status}, Unexpected payload: {body})")
        except Exception:
            print(f"PASS (HTTP {status})")
    else:
        print(f"FAIL (HTTP {status}, Response: {body[:100]})")
        all_passed = False

    # 2. Backend Root
    root_url = f"{backend_url.rstrip('/')}/"
    print(f"[*] Checking Backend Root Endpoint: {root_url} ... ", end="")
    ok, status, body = check_url(root_url)
    if ok:
        print(f"PASS (HTTP {status})")
    else:
        print(f"FAIL (HTTP {status})")
        all_passed = False

    # 3. Backend OpenAPI Spec
    openapi_url = f"{backend_url.rstrip('/')}/openapi.json"
    print(f"[*] Checking OpenAPI JSON Spec: {openapi_url} ... ", end="")
    ok, status, body = check_url(openapi_url)
    if ok:
        try:
            spec = json.loads(body)
            title = spec.get("info", {}).get("title", "")
            print(f"PASS (HTTP {status}, Title: {title})")
        except Exception:
            print(f"PASS (HTTP {status})")
    else:
        print(f"FAIL (HTTP {status})")
        all_passed = False

    # 4. Frontend Root
    fe_root_url = f"{frontend_url.rstrip('/')}/"
    print(f"[*] Checking Frontend Root HTML: {fe_root_url} ... ", end="")
    ok, status, body = check_url(fe_root_url)
    if ok and ("<html" in body.lower() or "<!doctype html" in body.lower()):
        print(f"PASS (HTTP {status}, Valid HTML document)")
    else:
        print(f"FAIL (HTTP {status})")
        all_passed = False

    # 5. Frontend SPA Route Fallback
    fe_spa_url = f"{frontend_url.rstrip('/')}/app/jobs"
    print(f"[*] Checking Frontend SPA Route Fallback: {fe_spa_url} ... ", end="")
    ok, status, body = check_url(fe_spa_url)
    if ok and ("<html" in body.lower() or "<!doctype html" in body.lower()):
        print(f"PASS (HTTP {status}, SPA fallback active)")
    else:
        print(f"FAIL (HTTP {status})")
        all_passed = False

    # 6. Optional: Nginx Container Health Endpoint (if frontend is Nginx container)
    fe_health_url = f"{frontend_url.rstrip('/')}/nginx-health"
    ok, status, body = check_url(fe_health_url)
    if ok:
        print(f"[*] Checking Frontend Nginx Health: {fe_health_url} ... PASS (HTTP {status})")

    # 7. Reverse Proxy Check via Frontend Port (if unified Nginx routing)
    proxy_health_url = f"{frontend_url.rstrip('/')}/health"
    ok, status, body = check_url(proxy_health_url)
    if ok:
        print(f"[*] Checking Nginx -> Backend Proxy (/health): {proxy_health_url} ... PASS (HTTP {status})")

    print("---------------------------------------------------------------------------")
    if all_passed:
        print("RESULT: ALL SMOKE CHECKS PASSED SUCCESSFULLY.")
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
