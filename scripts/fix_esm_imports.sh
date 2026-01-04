#!/bin/bash
# fix_esm_imports.sh - Naprawia importy w index.ts (../services → ./services)

set -e

cd "$(dirname "$0")/.."

INDEX_FILE="server/src/index.ts"
BACKUP_FILE="server/src/index.ts.esm-backup"

echo "🔧 Naprawianie importów w index.ts..."
echo ""

# Backup
cp "$INDEX_FILE" "$BACKUP_FILE"
echo "📁 Backup: $BACKUP_FILE"

# Zamiana ../services/ na ./services/
sed -i '' "s|'../services/|'./services/|g" "$INDEX_FILE"

# Zamiana ../cron/ na ./cron/
sed -i '' "s|'../cron/|'./cron/|g" "$INDEX_FILE"

# Zamiana ../workers/ na ./workers/ (jeśli istnieje)
sed -i '' "s|'../workers/|'./workers/|g" "$INDEX_FILE"

echo "✅ Importy naprawione!"
echo ""

# Pokaż co się zmieniło
echo "📋 Zmienione linie:"
diff "$BACKUP_FILE" "$INDEX_FILE" || true

