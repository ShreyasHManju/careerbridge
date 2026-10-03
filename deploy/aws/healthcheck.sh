#!/usr/bin/env bash
# ==============================================================================
# CareerBridge — Deployment Health & Readiness Verification Probe
# Validates running container endpoints, network routing, and readiness probes.
#
# Usage:
#   ./deploy/aws/healthcheck.sh
#   BACKEND_URL=http://127.0.0.1:8000 FRONTEND_URL=http://127.0.0.1:80 ./deploy/aws/healthcheck.sh
# ==============================================================================

set -Eeuo pipefail

trap 'echo "[ERROR] Health check probe encountered unexpected failure on line $LINENO" >&2' ERR

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:80}"
MAX_RETRIES="${MAX_RETRIES:-12}"
RETRY_INTERVAL="${RETRY_INTERVAL:-5}"

echo "=========================================================================="
echo "CAREERBRIDGE — DEPLOYMENT HEALTH & READINESS PROBE"
echo "=========================================================================="
echo "Backend Target   : ${BACKEND_URL}"
echo "Frontend Target  : ${FRONTEND_URL}"
echo "Max Retries      : ${MAX_RETRIES} (Interval: ${RETRY_INTERVAL}s)"
echo "Timestamp        : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "--------------------------------------------------------------------------"

check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"

    local attempt=1
    while [[ $attempt -le $MAX_RETRIES ]]; do
        local code
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${url}" 2>/dev/null || echo "000")

        if [[ "${code}" == "${expected_code}" ]]; then
            echo "[PASS] ${name} -> HTTP ${code}"
            return 0
        fi

        echo "[WAIT] ${name} returned HTTP ${code} (Attempt ${attempt}/${MAX_RETRIES}). Retrying in ${RETRY_INTERVAL}s..."
        sleep "${RETRY_INTERVAL}"
        attempt=$((attempt + 1))
    done

    echo "[FAIL] ${name} did not return HTTP ${expected_code} after ${MAX_RETRIES} attempts." >&2
    return 1
}

# 1. Frontend Nginx container healthcheck
check_endpoint "Frontend Nginx Container (/nginx-health)" "${FRONTEND_URL}/nginx-health" "200"

# 2. Backend Liveness Probe (/health/live) - Lightweight process liveness
check_endpoint "Backend Liveness Probe (/health/live)" "${BACKEND_URL}/health/live" "200"

# 3. Backend Dependency Readiness Probe (/health/ready) - DB, Migrations, Storage
check_endpoint "Backend Readiness Probe (/health/ready)" "${BACKEND_URL}/health/ready" "200"

# 4. Backend Legacy Health Check (/health) - Backward compatibility
check_endpoint "Backend Health Probe (/health)" "${BACKEND_URL}/health" "200"

# 5. Backend Root Endpoint (/)
check_endpoint "Backend API Root (/)" "${BACKEND_URL}/" "200"

# 6. Backend OpenAPI Specification (/openapi.json)
check_endpoint "Backend OpenAPI Schema (/openapi.json)" "${BACKEND_URL}/openapi.json" "200"

# 7. Frontend Single Page Application Route Resolution (/app/jobs)
check_endpoint "Frontend SPA Route Fallback (/app/jobs)" "${FRONTEND_URL}/app/jobs" "200"

echo "--------------------------------------------------------------------------"
echo "RESULT: ALL HEALTH & READINESS PROBES PASSED SUCCESSFULLY."
echo "=========================================================================="
