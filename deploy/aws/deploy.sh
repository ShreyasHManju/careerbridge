#!/usr/bin/env bash
# ==============================================================================
# CareerBridge — Production Deployment Script
# Automates the release deployment pipeline on an Ubuntu EC2 host.
#
# Usage:
#   ./deploy/aws/deploy.sh [TARGET_TAG]
#
# Examples:
#   ./deploy/aws/deploy.sh
#   ./deploy/aws/deploy.sh v1.0.0
# ==============================================================================

set -Eeuo pipefail

trap 'echo "[ERROR] Deployment pipeline failed on line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TARGET_TAG="${1:-v1.0.0}"
COMPOSE_FILE="docker-compose.production.yml"

echo "=========================================================================="
echo "CAREERBRIDGE — PRODUCTION DEPLOYMENT PIPELINE"
echo "=========================================================================="
echo "Target Release Tag : ${TARGET_TAG}"
echo "Project Root       : ${PROJECT_ROOT}"
echo "Compose File       : ${COMPOSE_FILE}"
echo "Timestamp          : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=========================================================================="

cd "${PROJECT_ROOT}"

# 1. Verify Docker and Docker Compose availability
echo "[1/8] Verifying Docker runtime environment..."
if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] Docker is not installed or not in PATH." >&2
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "[ERROR] Docker Compose plugin is not installed." >&2
    exit 1
fi
echo "  -> Docker $(docker --version) and $(docker compose version) detected."

# 2. Verify .env file and validate required secrets
echo "[2/8] Validating production .env configuration..."
if [[ ! -f .env ]]; then
    echo "[ERROR] Production .env file not found at ${PROJECT_ROOT}/.env" >&2
    echo "  Please copy .env.example to .env and configure production secrets." >&2
    exit 1
fi

# Check permissions
ENV_PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%Lp" .env 2>/dev/null || echo "unknown")
if [[ "${ENV_PERMS}" != "600" && "${ENV_PERMS}" != "400" && "${ENV_PERMS}" != "unknown" ]]; then
    echo "[WARN] .env permissions are ${ENV_PERMS}. Hardening to 600..."
    chmod 600 .env
fi

# Check required variables
check_var() {
    local var_name="$1"
    local val
    val=$(grep -E "^${var_name}=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)

    if [[ -z "${val}" ]]; then
        echo "[ERROR] Required variable '${var_name}' is missing or empty in .env." >&2
        exit 1
    fi

    # Check against known example placeholders
    if [[ "${val}" =~ ^(change_this|replace_with|your_google_oauth) ]]; then
        echo "[ERROR] Variable '${var_name}' still contains unconfigured template placeholder." >&2
        exit 1
    fi
}

check_var "POSTGRES_PASSWORD"
check_var "JWT_SECRET_KEY"
check_var "GOOGLE_CLIENT_ID"
echo "  -> Production environment contract verified."

# 3. Validate Docker Compose configuration
echo "[3/8] Validating Docker Compose configuration syntax..."
docker compose -f "${COMPOSE_FILE}" config >/dev/null
echo "  -> Compose configuration syntax: VALID."

# 4. Fetch latest tags and checkout release tag
echo "[4/8] Fetching git tags and validating release tag '${TARGET_TAG}'..."
git fetch origin --tags

# Verify tag or revision exists
if ! git rev-parse --verify "refs/tags/${TARGET_TAG}" >/dev/null 2>&1 && ! git rev-parse --verify "${TARGET_TAG}^{commit}" >/dev/null 2>&1; then
    echo "[ERROR] Target release '${TARGET_TAG}' does not exist as a Git tag or commit." >&2
    exit 1
fi

# Check for uncommitted working tree modifications
if [[ -n "$(git status --porcelain)" ]]; then
    echo "[WARN] Working tree contains uncommitted local files:"
    git status --short
fi

git checkout "${TARGET_TAG}"
echo "  -> Active commit: $(git rev-parse --short HEAD) ($(git describe --tags --always))"

# 5. Start database container and wait for health
echo "[5/8] Starting PostgreSQL database container..."
docker compose -f "${COMPOSE_FILE}" up -d db

echo "  -> Waiting for PostgreSQL healthcheck probe..."
DB_RETRIES=20
DB_WAIT=3
DB_READY=false

for i in $(seq 1 $DB_RETRIES); do
    HEALTH_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' careerbridge-db-production 2>/dev/null | tr -d '"' || echo "starting")
    if [[ "${HEALTH_STATUS}" == "healthy" ]]; then
        echo "  -> Database container is HEALTHY (Attempt $i/$DB_RETRIES)."
        DB_READY=true
        break
    fi
    echo "  -> Database status: '${HEALTH_STATUS}' ($i/$DB_RETRIES). Waiting ${DB_WAIT}s..."
    sleep $DB_WAIT
done

if [[ "${DB_READY}" != "true" ]]; then
    echo "[ERROR] PostgreSQL container failed to become healthy within timeout." >&2
    docker compose -f "${COMPOSE_FILE}" logs db
    exit 1
fi

# 6. Execute database migrations
echo "[6/8] Executing database schema migrations (alembic upgrade head)..."
docker compose -f "${COMPOSE_FILE}" run --rm backend alembic upgrade head
echo "  -> Migrations applied successfully."

# 7. Build and start full container topology
echo "[7/8] Building and launching application containers..."
docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans

# 8. Run health check validation
echo "[8/8] Executing post-deployment health checks..."
"${SCRIPT_DIR}/healthcheck.sh"

echo "=========================================================================="
echo "[SUCCESS] CareerBridge ${TARGET_TAG} deployed successfully!"
echo "=========================================================================="
