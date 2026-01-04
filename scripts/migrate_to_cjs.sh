#!/bin/bash
# migrate_to_cjs.sh - Zmiana utility scripts z .js na .cjs
# Te pliki używają require() i nie są częścią głównej aplikacji

set -e

cd "$(dirname "$0")/.."
SERVER_DIR="server"

echo "🔧 Migracja utility scripts z .js na .cjs..."
echo ""

# Backup najpierw
BACKUP_DIR="backup/js-to-cjs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Lista wzorców plików do zmiany
# To są utility scripts, nie główna aplikacja
PATTERNS=(
    # Root level utility scripts
    "$SERVER_DIR/seed_*.js"
    "$SERVER_DIR/test_*.js"
    "$SERVER_DIR/migrate_*.js"
    "$SERVER_DIR/check_*.js"
    "$SERVER_DIR/fix_*.js"
    "$SERVER_DIR/list_*.js"
    "$SERVER_DIR/restore_*.js"
    "$SERVER_DIR/verify_*.js"
    "$SERVER_DIR/apply_*.js"
    "$SERVER_DIR/cleanup_*.js"
    "$SERVER_DIR/force_*.js"
    "$SERVER_DIR/inspect_*.js"
    "$SERVER_DIR/database.sqlite*.js"
    # Seed directory
    "$SERVER_DIR/seed/*.js"
    # Scripts directory
    "$SERVER_DIR/scripts/seed*.js"
    "$SERVER_DIR/scripts/check*.js"
    "$SERVER_DIR/scripts/run*.js"
    "$SERVER_DIR/scripts/restore*.js"
    "$SERVER_DIR/scripts/migrate*.js"
    "$SERVER_DIR/scripts/verify*.js"
    "$SERVER_DIR/scripts/test*.js"
)

count=0
for pattern in "${PATTERNS[@]}"; do
    for file in $pattern; do
        if [ -f "$file" ]; then
            # Backup
            cp "$file" "$BACKUP_DIR/"
            
            # Rename
            newname="${file%.js}.cjs"
            mv "$file" "$newname"
            echo "✅ $file → $newname"
            ((count++))
        fi
    done
done

echo ""
echo "📊 Zmieniono $count plików"
echo "📁 Backup: $BACKUP_DIR"
echo ""
echo "✅ Gotowe!"

