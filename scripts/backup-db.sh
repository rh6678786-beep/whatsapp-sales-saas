#!/bin/bash
# =============================================================================
# Automated Database Backup Script
# Usage: ./scripts/backup-db.sh [database-url] [s3-bucket]
#
# Environment variables:
#   DATABASE_URL     - PostgreSQL connection string (required)
#   BACKUP_S3_BUCKET - S3 bucket name (optional, for cloud backup)
#   BACKUP_S3_REGION - AWS region (default: us-east-1)
#   BACKUP_RETENTION - Number of days to keep local backups (default: 7)
# =============================================================================

set -euo pipefail

# ---- Configuration ----
BACKUP_DIR="${BACKUP_DIR:-./backups/database}"
RETENTION_DAYS="${BACKUP_RETENTION:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db-backup-${TIMESTAMP}.sql.gz"
LATEST_LINK="${BACKUP_DIR}/latest.sql.gz"

# ---- Color output ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---- Validate prerequisites ----
if ! command -v pg_dump &> /dev/null; then
  log_error "pg_dump not found. Install postgresql-client first."
  exit 1
fi

if ! command -v gzip &> /dev/null; then
  log_error "gzip not found."
  exit 1
fi

# ---- Get database URL ----
DB_URL="${1:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  log_error "DATABASE_URL is required. Provide as argument or set DATABASE_URL env var."
  echo "Usage: $0 [database-url] [s3-bucket]"
  exit 1
fi

S3_BUCKET="${2:-${BACKUP_S3_BUCKET:-}}"

# ---- Create backup directory ----
mkdir -p "$BACKUP_DIR"

# ---- Perform backup ----
log_info "Starting database backup..."
log_info "Output: ${BACKUP_FILE}"

# Use pg_dump with compression level 6 (good balance of speed vs size)
pg_dump "${DB_URL}" \
  --no-owner \
  --no-acl \
  --verbose \
  2>&1 | gzip -6 > "${BACKUP_FILE}"

# Verify backup integrity
if [ ! -f "${BACKUP_FILE}" ]; then
  log_error "Backup file was not created!"
  exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log_info "Backup completed: ${BACKUP_SIZE}"

# Create/update latest symlink
ln -sf "${BACKUP_FILE}" "${LATEST_LINK}"

# ---- Upload to S3 (if configured) ----
if [ -n "$S3_BUCKET" ]; then
  if command -v aws &> /dev/null; then
    log_info "Uploading to S3 bucket: ${S3_BUCKET}..."
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/database/$(basename ${BACKUP_FILE})" \
      --region "${BACKUP_S3_REGION:-us-east-1}" \
      --storage-class STANDARD_IA
    
    # Upload latest symlink target
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/database/latest.sql.gz" \
      --region "${BACKUP_S3_REGION:-us-east-1}"
    
    log_info "S3 upload complete!"
  else
    log_warn "AWS CLI not found. Skipping S3 upload."
    log_warn "Install: pip install awscli"
  fi
fi

# ---- Cleanup old backups ----
log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "db-backup-*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -delete

# ---- Backup summary ----
REMAINING=$(find "${BACKUP_DIR}" -name "db-backup-*.sql.gz" -type f | wc -l)
log_info "Backup complete! ${REMAINING} backup(s) retained."
log_info "File: ${BACKUP_FILE}"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  To restore: gunzip -c ${BACKUP_FILE} | psql \$DATABASE_URL"
echo "═══════════════════════════════════════════════════════════════"
