#!/bin/bash
# Database Restore Script
# Restores database from compressed backup with safety checks

set -e

BACKUP_DIR="server/backups"
DB_PATH="server/consultify.db"
SAFETY_BACKUP="${DB_PATH}.pre-restore-$(date +%Y%m%d_%H%M%S)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}[Restore] Database Restore Utility${NC}"
echo ""

# List available backups
echo -e "${YELLOW}Available backups:${NC}"
BACKUPS=($(find "${BACKUP_DIR}" -name "consultify_*.db.gz" -type f | sort -r))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}[Restore] No backups found in ${BACKUP_DIR}${NC}"
    exit 1
fi

for i in "${!BACKUPS[@]}"; do
    BACKUP_FILE="${BACKUPS[$i]}"
    BACKUP_NAME=$(basename "$BACKUP_FILE")
    BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")
    BACKUP_DATE=$(stat -f%Sm -t "%Y-%m-%d %H:%M:%S" "$BACKUP_FILE" 2>/dev/null || stat -c%y "$BACKUP_FILE" | cut -d'.' -f1)
    
    echo -e "  ${GREEN}[$i]${NC} $BACKUP_NAME ($(numfmt --to=iec-i --suffix=B $BACKUP_SIZE), $BACKUP_DATE)"
done

echo ""
echo -e "${YELLOW}Select backup to restore (0-$((${#BACKUPS[@]}-1))), or 'q' to quit:${NC}"
read -r SELECTION

if [ "$SELECTION" = "q" ]; then
    echo -e "${YELLOW}[Restore] Cancelled${NC}"
    exit 0
fi

if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -ge "${#BACKUPS[@]}" ]; then
    echo -e "${RED}[Restore] Invalid selection${NC}"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$SELECTION]}"
echo ""
echo -e "${YELLOW}[Restore] Selected: $(basename "$SELECTED_BACKUP")${NC}"

# Safety backup of current database
if [ -f "${DB_PATH}" ]; then
    echo -e "${YELLOW}[Restore] Creating safety backup of current database...${NC}"
    cp "${DB_PATH}" "${SAFETY_BACKUP}"
    echo -e "${GREEN}[Restore] ✅ Safety backup: ${SAFETY_BACKUP}${NC}"
fi

# Decompress backup
TEMP_BACKUP="/tmp/consultify_restore_$$.db"
echo -e "${YELLOW}[Restore] Decompressing backup...${NC}"
gunzip -c "${SELECTED_BACKUP}" > "${TEMP_BACKUP}"

# Verify backup integrity
echo -e "${YELLOW}[Restore] Verifying backup integrity...${NC}"
INTEGRITY_CHECK=$(sqlite3 "${TEMP_BACKUP}" "PRAGMA integrity_check;" 2>&1)

if [ "$INTEGRITY_CHECK" != "ok" ]; then
    echo -e "${RED}[Restore] Error: Backup integrity check failed!${NC}"
    echo -e "${RED}${INTEGRITY_CHECK}${NC}"
    rm -f "${TEMP_BACKUP}"
    exit 1
fi

echo -e "${GREEN}[Restore] ✅ Integrity check passed${NC}"

# Final confirmation
echo ""
echo -e "${RED}⚠️  WARNING: This will replace the current database!${NC}"
echo -e "${YELLOW}Continue with restore? (yes/no):${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}[Restore] Cancelled${NC}"
    rm -f "${TEMP_BACKUP}"
    exit 0
fi

# Perform restore
echo -e "${YELLOW}[Restore] Restoring database...${NC}"
mv "${TEMP_BACKUP}" "${DB_PATH}"

# Verify restored database
RESTORED_CHECK=$(sqlite3 "${DB_PATH}" "PRAGMA integrity_check;" 2>&1)

if [ "$RESTORED_CHECK" != "ok" ]; then
    echo -e "${RED}[Restore] Error: Restored database failed integrity check!${NC}"
    echo -e "${RED}[Restore] Rolling back to safety backup...${NC}"
    mv "${SAFETY_BACKUP}" "${DB_PATH}"
    exit 1
fi

echo -e "${GREEN}[Restore] ✅ Database restored successfully${NC}"
echo -e "${GREEN}[Restore] Safety backup retained: ${SAFETY_BACKUP}${NC}"
echo -e "${YELLOW}[Restore] You can delete the safety backup once you verify everything works${NC}"
