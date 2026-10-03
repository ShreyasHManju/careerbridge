#!/usr/bin/env bash
# ==============================================================================
# CareerBridge — Automated PostgreSQL Backup Script
# Creates a compressed database snapshot and optionally syncs to Amazon S3.
#
# Usage:
#   ./deploy/aws/backup.sh
#   BACKUP_DIR=/custom/path S3_BACKUP_BUCKET=my-bucket ./deploy/aws/backup.sh
# ==============================================================================

set -Eeuo pipefail

trap 'echo "[ERROR] Backup process failed on line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Configuration
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-careerbridge-db-production}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-internship_db}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="${BACKUP_DIR}/careerbridge_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "=========================================================================="
echo "CAREERBRIDGE — DATABASE BACKUP EXECUTION"
echo "=========================================================================="
echo "Target Container : ${POSTGRES_CONTAINER}"
echo "Database Name    : ${POSTGRES_DB}"
echo "User             : ${POSTGRES_USER}"
echo "Destination      : ${BACKUP_FILE}"
echo "Retention Days   : ${RETENTION_DAYS}"
echo "Timestamp        : ${TIMESTAMP}"
echo "=========================================================================="

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

# 1. Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    echo "[ERROR] Docker container '${POSTGRES_CONTAINER}' is not running." >&2
    exit 1
fi

# 2. Execute pg_dump and stream directly through gzip
echo "[1/3] Dumping PostgreSQL database..."
docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists | gzip > "${BACKUP_FILE}"

if [[ ! -s "${BACKUP_FILE}" ]]; then
    echo "[ERROR] Backup failed: output file is empty." >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

chmod 600 "${BACKUP_FILE}"
BACKUP_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "  -> Snapshot created successfully (Size: ${BACKUP_SIZE})."

# 3. Optional S3 off-host replication
if [[ -n "${S3_BACKUP_BUCKET}" ]]; then
    echo "[2/3] Uploading snapshot to Amazon S3 (Bucket: ${S3_BACKUP_BUCKET})..."
    if ! command -v aws >/dev/null 2>&1; then
        echo "[ERROR] 'aws' CLI is required when S3_BACKUP_BUCKET is configured, but was not found." >&2
        exit 1
    fi
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BACKUP_BUCKET}/db/careerbridge_${POSTGRES_DB}_${TIMESTAMP}.sql.gz" --sse AES256
    echo "  -> Snapshot copied to S3 with AES256 server-side encryption."
else
    echo "[2/3] S3_BACKUP_BUCKET not set. Skipping off-host replication."
fi

# 4. Prune old local backups
echo "[3/3] Pruning local backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "careerbridge_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "  -> Local retention policy applied."

echo "=========================================================================="
echo "[SUCCESS] Database backup workflow completed."
echo "=========================================================================="
