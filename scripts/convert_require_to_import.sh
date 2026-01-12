#!/bin/bash
# convert_require_to_import.sh - Konwertuje require() na import dla plików .js
# UWAGA: To jest agresywna zmiana - używać ostrożnie!

set -e

cd "$(dirname "$0")/.."

TARGET_DIR="${1:-server/services}"
BACKUP_DIR="backup/require-to-import-$(date +%Y%m%d-%H%M%S)"

echo "🔧 Konwersja require() → import w $TARGET_DIR"
echo "📁 Backup: $BACKUP_DIR"
echo ""

mkdir -p "$BACKUP_DIR"

# Znajdź pliki .js z require
files_with_require=$(grep -rl "require(" "$TARGET_DIR" --include="*.js" 2>/dev/null || true)

if [ -z "$files_with_require" ]; then
    echo "✅ Brak plików z require() w $TARGET_DIR"
    exit 0
fi

count=0
for file in $files_with_require; do
    # Pomiń pliki .test.js
    if [[ "$file" == *.test.js ]]; then
        echo "⏭️  Pomijam test: $file"
        continue
    fi
    
    # Backup
    cp "$file" "$BACKUP_DIR/"
    
    # Konwersja const X = require('Y') → import X from 'Y'
    # Obsługuje różne formaty
    sed -i '' \
        -e "s/const \([a-zA-Z_][a-zA-Z0-9_]*\) = require('\([^']*\)');/import \1 from '\2';/g" \
        -e "s/const { \([^}]*\) } = require('\([^']*\)');/import { \1 } from '\2';/g" \
        "$file"
    
    # Konwersja module.exports = X → export default X
    sed -i '' "s/module\.exports = /export default /g" "$file"
    
    # Konwersja module.exports.X = Y → export const X = Y
    sed -i '' "s/module\.exports\.\([a-zA-Z_][a-zA-Z0-9_]*\) = /export const \1 = /g" "$file"
    
    # Konwersja exports.X = Y → export const X = Y
    sed -i '' "s/^exports\.\([a-zA-Z_][a-zA-Z0-9_]*\) = /export const \1 = /g" "$file"
    
    echo "✅ $file"
    ((count++))
done

echo ""
echo "📊 Przekonwertowano $count plików"
echo "✅ Gotowe!"
echo ""
echo "⚠️  UWAGA: Sprawdź czy importy działają - niektóre mogą wymagać ręcznej poprawy"


