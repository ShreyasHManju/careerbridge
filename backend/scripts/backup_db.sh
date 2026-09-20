#!/usr/bin/env bash
# ==============================================================================
# CareerBridge Database Backup Script
# Creates a timestamped snapshot of the PostgreSQL database.
#
# Usage:
#   ./scripts/backup_db.sh
#   BACKUP_DIR=/custom/path ./scripts/backup_db.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Configuration (defaults match development / production compose settings)
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-internship_db}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-careerbridge-db-production}"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="${BACKUP_DIR}/careerbridge_backup_${POSTGRES_DB}_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "================================================================="
echo "CAREERBRIDGE DATABASE BACKUP"
echo "================================================================="
echo "Target Database : ${POSTGRES_DB}"
echo "Target User     : ${POSTGRES_USER}"
echo "Destination     : ${BACKUP_FILE}"
echo "Timestamp       : ${TIMESTAMP}"
echo "================================================================="

# Check if production Docker container is running
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
    echo "[INFO] Using running Docker container: ${DOCKER_CONTAINER}"
    docker exec -i "${DOCKER_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists > "${BACKUP_FILE}"
elif command -v pg_dump >/dev/null 2>&1; then
    echo "[INFO] Using local pg_dump client (Host: ${POSTGRES_HOST}:${POSTGRES_PORT})"
    pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists -f "${BACKUP_FILE}"
else
    echo "[ERROR] Neither Docker container '${DOCKER_CONTAINER}' nor local 'pg_dump' utility found." >&2
    exit 1
fi

if [[ -f "${BACKUP_FILE}" && -s "${BACKUP_FILE}" ]]; then
    BACKUP_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
    echo "================================================================="
    echo "[SUCCESS] Backup completed successfully!"
    echo "File : ${BACKUP_FILE}"
    echo "Size : ${BACKUP_SIZE}"
    echo "NOTE : Off-host replication/retention must be managed separately."
    echo "================================================================="
    exit 0
else
    echo "[ERROR] Backup failed or generated an empty file." >&2
    exit 1
fi
