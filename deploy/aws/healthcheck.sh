#!/usr/bin/env bash
# ==============================================================================
# CareerBridge — Deployment Health Check Probe
# Validates running container endpoints and network routing.
#
# Usage:
#   ./deploy/aws/healthcheck.sh
#   BACKEND_URL=http://localhost:8000 FRONTEND_URL=http://localhost:80 ./deploy/aws/healthcheck.sh
# ==============================================================================

set -Eeuo pipefail

trap 'echo "[ERROR] Health check probe failed on line $LINENO" >&2' ERR

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:80}"
MAX_RETRIES="${MAX_RETRIES:-12}"
RETRY_INTERVAL="${RETRY_INTERVAL:-5}"

echo "=========================================================================="
echo "CAREERBRIDGE — DEPLOYMENT HEALTH PROBE"
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
            echo "[PASS] ${name} (${url}) -> HTTP ${code}"
            return 0
        fi

        echo "[WAIT] ${name} returned HTTP ${code} (Attempt ${attempt}/${MAX_RETRIES}). Retrying in ${RETRY_INTERVAL}s..."
        sleep "${RETRY_INTERVAL}"
        attempt=$((attempt + 1))
    done

    echo "[FAIL] ${name} (${url}) did not return HTTP ${expected_code} after ${MAX_RETRIES} attempts." >&2
    return 1
}

# 1. Frontend Nginx container healthcheck
check_endpoint "Frontend Nginx Container Health" "${FRONTEND_URL}/nginx-health" "200"

# 2. Backend Health & Database Connectivity
check_endpoint "Backend Health & DB Probe" "${BACKEND_URL}/health" "200"

# 3. Backend Root Info
check_endpoint "Backend API Root" "${BACKEND_URL}/" "200"

# 4. Backend OpenAPI Schema
check_endpoint "Backend OpenAPI Schema" "${BACKEND_URL}/openapi.json" "200"

# 5. Frontend SPA Route Resolution
check_endpoint "Frontend SPA Route Fallback" "${FRONTEND_URL}/app/jobs" "200"

echo "--------------------------------------------------------------------------"
echo "RESULT: ALL HEALTH PROBES PASSED SUCCESSFULLY."
echo "=========================================================================="
