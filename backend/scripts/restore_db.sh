#!/usr/bin/env bash
# ==============================================================================
# CareerBridge Database Restore & Verification Script
# Restores a PostgreSQL database from an explicit backup file and verifies integrity.
#
# Usage:
#   ./scripts/restore_db.sh <path_to_backup.sql>
#   CONFIRM_RESTORE=yes ./scripts/restore_db.sh /path/to/backup.sql
# ==============================================================================

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <path_to_backup_file.sql>" >&2
    echo "Example: $0 ./backups/careerbridge_backup_internship_db_20260920_120000.sql" >&2
    exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" || ! -r "${BACKUP_FILE}" ]]; then
    echo "[ERROR] Backup file does not exist or is not readable: ${BACKUP_FILE}" >&2
    exit 1
fi

# Configuration
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-internship_db}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-careerbridge-db-production}"
CONFIRM_RESTORE="${CONFIRM_RESTORE:-no}"

echo "================================================================="
echo "CAREERBRIDGE DATABASE RESTORE WARNING"
echo "================================================================="
echo "Target Database : ${POSTGRES_DB}"
echo "Target User     : ${POSTGRES_USER}"
echo "Source Backup   : ${BACKUP_FILE}"
echo "-----------------------------------------------------------------"
echo "WARNING: This operation will overwrite and replace existing data!"
echo "================================================================="

if [[ "${CONFIRM_RESTORE}" != "yes" ]]; then
    read -r -p "Type 'RESTORE' to confirm destructive restoration: " USER_CONFIRMATION
    if [[ "${USER_CONFIRMATION}" != "RESTORE" ]]; then
        echo "[ABORTED] Restore cancelled by user."
        exit 0
    fi
fi

echo "[INFO] Commencing database restoration..."

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
    echo "[INFO] Restoring into Docker container: ${DOCKER_CONTAINER}"
    docker exec -i "${DOCKER_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${BACKUP_FILE}"
elif command -v psql >/dev/null 2>&1; then
    echo "[INFO] Restoring using local psql client (Host: ${POSTGRES_HOST}:${POSTGRES_PORT})"
    psql -v ON_ERROR_STOP=1 -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "${BACKUP_FILE}"
else
    echo "[ERROR] Neither Docker container '${DOCKER_CONTAINER}' nor local 'psql' utility found." >&2
    exit 1
fi

echo "[INFO] Running post-restore table existence verification..."

REQUIRED_TABLES_QUERY="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'job_postings', 'applications');"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
    FOUND_CORE_TABLES="$(docker exec -i "${DOCKER_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "${REQUIRED_TABLES_QUERY}" | tr -d '[:space:]')"
elif command -v psql >/dev/null 2>&1; then
    FOUND_CORE_TABLES="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "${REQUIRED_TABLES_QUERY}" | tr -d '[:space:]')"
else
    echo "[ERROR] Cannot execute verification query: no database client found." >&2
    exit 1
fi

if [[ "${FOUND_CORE_TABLES}" -ne 3 ]]; then
    echo "[ERROR] Post-restore verification failed: expected core tables (users, job_postings, applications) missing! Verified: ${FOUND_CORE_TABLES}/3" >&2
    exit 1
fi

echo "================================================================="
echo "[SUCCESS] Database restoration complete and verified!"
echo "Core tables verified (users, job_postings, applications): 3/3"
echo "================================================================="
exit 0
