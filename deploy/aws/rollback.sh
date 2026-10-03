#!/usr/bin/env bash
# ==============================================================================
# CareerBridge — Production Rollback Automation Script
# Safely reverts application code to a prior release tag and restarts services.
#
# Usage:
#   ./deploy/aws/rollback.sh <TARGET_TAG_OR_COMMIT> [OPTIONAL_ALEMBIC_REVISION]
#
# Examples:
#   ./deploy/aws/rollback.sh v0.9.0
#   ./deploy/aws/rollback.sh v0.9.0 e8a3182b8a21
# ==============================================================================

set -Eeuo pipefail

trap 'echo "[ERROR] Rollback failed on line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TARGET_REV="${1:-}"
TARGET_MIGRATION="${2:-}"

if [[ -z "${TARGET_REV}" ]]; then
    echo "=========================================================================="
    echo "[ERROR] Missing target release tag or commit SHA."
    echo "Usage: $0 <TARGET_TAG_OR_COMMIT> [OPTIONAL_ALEMBIC_REVISION]"
    echo "Example: $0 v0.9.0"
    echo "=========================================================================="
    exit 1
fi

echo "=========================================================================="
echo "CAREERBRIDGE — PRODUCTION ROLLBACK"
echo "=========================================================================="
echo "Target Revision   : ${TARGET_REV}"
echo "Schema Downgrade  : ${TARGET_MIGRATION:-None (No schema downgrade)}"
echo "Timestamp         : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=========================================================================="

cd "${PROJECT_ROOT}"

# 1. Take safety snapshot of database before rollback
echo "[1/5] Creating mandatory pre-rollback database safety snapshot..."
if ! "${SCRIPT_DIR}/backup.sh"; then
    echo "[ERROR] Pre-rollback database backup failed. Aborting rollback to prevent data loss." >&2
    exit 1
fi

# 2. Check out target revision
echo "[2/5] Validating and checking out target revision: ${TARGET_REV}..."
git fetch origin --tags

if ! git rev-parse --verify "refs/tags/${TARGET_REV}" >/dev/null 2>&1 && ! git rev-parse --verify "${TARGET_REV}^{commit}" >/dev/null 2>&1; then
    echo "[ERROR] Target revision '${TARGET_REV}' does not exist as a Git tag or commit." >&2
    exit 1
fi

git checkout "${TARGET_REV}"

# 3. Optional database schema downgrade
if [[ -n "${TARGET_MIGRATION}" ]]; then
    echo "[3/5] Executing database schema downgrade to revision: ${TARGET_MIGRATION}..."
    docker compose -f docker-compose.production.yml run --rm backend alembic downgrade "${TARGET_MIGRATION}"
else
    echo "[3/5] No schema downgrade requested. Preserving database state."
fi

# 4. Rebuild and restart production containers
echo "[4/5] Rebuilding and restarting containers..."
docker compose -f docker-compose.production.yml up -d --build

# 5. Run health check verification
echo "[5/5] Verifying post-rollback container health..."
"${SCRIPT_DIR}/healthcheck.sh"

echo "=========================================================================="
echo "[SUCCESS] Rollback to ${TARGET_REV} completed successfully!"
echo "=========================================================================="
