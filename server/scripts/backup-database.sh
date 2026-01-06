#!/bin/bash
# Database Backup Script
# Creates compressed backup with timestamp and rotation

set -e

# Configuration
DB_PATH="server/consultify.db"
BACKUP_DIR="server/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/consultify_${TIMESTAMP}.db"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}[Backup] Starting database backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if database exists
if [ ! -f "${DB_PATH}" ]; then
    echo -e "${RED}[Backup] Error: Database file not found: ${DB_PATH}${NC}"
    exit 1
fi

# Create backup using SQLite backup command
echo -e "${YELLOW}[Backup] Creating backup: ${BACKUP_FILE}${NC}"
sqlite3 "${DB_PATH}" ".backup '${BACKUP_FILE}'"

# Verify backup integrity
echo -e "${YELLOW}[Backup] Verifying backup integrity...${NC}"
INTEGRITY_CHECK=$(sqlite3 "${BACKUP_FILE}" "PRAGMA integrity_check;" 2>&1)

if [ "$INTEGRITY_CHECK" != "ok" ]; then
    echo -e "${RED}[Backup] Error: Backup integrity check failed!${NC}"
    echo -e "${RED}${INTEGRITY_CHECK}${NC}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

echo -e "${GREEN}[Backup] ✅ Integrity check passed${NC}"

# Compress backup
echo -e "${YELLOW}[Backup] Compressing backup...${NC}"
gzip "${BACKUP_FILE}"

# Get file sizes
ORIGINAL_SIZE=$(stat -f%z "${DB_PATH}" 2>/dev/null || stat -c%s "${DB_PATH}")
COMPRESSED_SIZE=$(stat -f%z "${COMPRESSED_FILE}" 2>/dev/null || stat -c%s "${COMPRESSED_FILE}")
COMPRESSION_RATIO=$(echo "scale=1; 100 - ($COMPRESSED_SIZE * 100 / $ORIGINAL_SIZE)" | bc)

echo -e "${GREEN}[Backup] ✅ Backup created: ${COMPRESSED_FILE}${NC}"
echo -e "${GREEN}[Backup] Original size: $(numfmt --to=iec-i --suffix=B $ORIGINAL_SIZE)${NC}"
echo -e "${GREEN}[Backup] Compressed size: $(numfmt --to=iec-i --suffix=B $COMPRESSED_SIZE)${NC}"
echo -e "${GREEN}[Backup] Compression: ${COMPRESSION_RATIO}%${NC}"

# Cleanup old backups (keep last N days)
echo -e "${YELLOW}[Backup] Cleaning up old backups (keeping last ${RETENTION_DAYS} days)...${NC}"
find "${BACKUP_DIR}" -name "consultify_*.db.gz" -type f -mtime +${RETENTION_DAYS} -delete

REMAINING_BACKUPS=$(find "${BACKUP_DIR}" -name "consultify_*.db.gz" -type f | wc -l)
echo -e "${GREEN}[Backup] ✅ ${REMAINING_BACKUPS} backups retained${NC}"

echo -e "${GREEN}[Backup] ✅ Backup complete!${NC}"
