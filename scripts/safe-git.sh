#!/bin/bash
# Safe Git Operations Script
# Prevents accidental data loss from destructive git commands

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Backup directory
BACKUP_DIR="../consultify-backups"

# Create timestamped backup
backup_untracked() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="${BACKUP_DIR}/backup_${timestamp}"
    
    # Get list of untracked files
    local untracked=$(git ls-files --others --exclude-standard)
    
    if [ -z "$untracked" ]; then
        echo -e "${GREEN}No untracked files to backup.${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}Found untracked files:${NC}"
    echo "$untracked"
    echo ""
    
    mkdir -p "$backup_path"
    
    # Copy untracked files preserving directory structure
    echo "$untracked" | while read file; do
        if [ -f "$file" ]; then
            mkdir -p "$backup_path/$(dirname "$file")"
            cp "$file" "$backup_path/$file"
        fi
    done
    
    echo -e "${GREEN}Backup created at: $backup_path${NC}"
    echo ""
}

# Safe git clean - shows what will be deleted and asks for confirmation
safe_clean() {
    echo -e "${YELLOW}=== FILES THAT WOULD BE DELETED ===${NC}"
    git clean -fdn
    echo ""
    
    local count=$(git clean -fdn | wc -l)
    if [ "$count" -eq 0 ]; then
        echo -e "${GREEN}No files to clean.${NC}"
        return 0
    fi
    
    echo -e "${RED}WARNING: These $count files will be PERMANENTLY DELETED!${NC}"
    echo -e "${RED}They will NOT go to trash!${NC}"
    echo ""
    
    read -p "Create backup first? (Y/n) " backup_choice
    if [ "$backup_choice" != "n" ] && [ "$backup_choice" != "N" ]; then
        backup_untracked
    fi
    
    read -p "Are you ABSOLUTELY sure you want to delete these files? Type 'DELETE' to confirm: " confirm
    if [ "$confirm" = "DELETE" ]; then
        git clean -fd
        echo -e "${GREEN}Files deleted.${NC}"
    else
        echo -e "${GREEN}Aborted. No files deleted.${NC}"
    fi
}

# Safe git reset --hard
safe_reset_hard() {
    echo -e "${YELLOW}=== UNCOMMITTED CHANGES THAT WOULD BE LOST ===${NC}"
    git diff --stat
    git diff --cached --stat
    echo ""
    
    local changes=$(git status --porcelain | wc -l)
    if [ "$changes" -eq 0 ]; then
        echo -e "${GREEN}No uncommitted changes.${NC}"
        git reset --hard "$@"
        return 0
    fi
    
    echo -e "${RED}WARNING: You have $changes uncommitted changes!${NC}"
    echo -e "${RED}These will be PERMANENTLY LOST!${NC}"
    echo ""
    
    read -p "Stash changes before reset? (Y/n) " stash_choice
    if [ "$stash_choice" != "n" ] && [ "$stash_choice" != "N" ]; then
        local stash_name="pre-reset-$(date +%Y%m%d_%H%M%S)"
        git stash push -m "$stash_name" --include-untracked
        echo -e "${GREEN}Changes stashed as: $stash_name${NC}"
    fi
    
    read -p "Are you sure you want to reset? Type 'RESET' to confirm: " confirm
    if [ "$confirm" = "RESET" ]; then
        git reset --hard "$@"
        echo -e "${GREEN}Reset complete.${NC}"
    else
        echo -e "${GREEN}Aborted.${NC}"
    fi
}

# Quick checkpoint commit
checkpoint() {
    local msg="${1:-WIP checkpoint $(date +%H:%M)}"
    git add -A
    git commit -m "$msg"
    echo -e "${GREEN}Checkpoint created: $msg${NC}"
}

# Show help
show_help() {
    echo "Safe Git Operations"
    echo ""
    echo "Usage: source scripts/safe-git.sh"
    echo ""
    echo "Commands:"
    echo "  safe_clean        - Safe git clean with backup option"
    echo "  safe_reset_hard   - Safe git reset --hard with stash option"  
    echo "  backup_untracked  - Backup all untracked files"
    echo "  checkpoint [msg]  - Quick WIP commit"
    echo ""
}

# If run directly, show help
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    show_help
fi
