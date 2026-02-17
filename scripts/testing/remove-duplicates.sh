#!/bin/bash
# Usuwa duplikaty plików testowych (test 2.ts, test 3.ts, itd.)
# Użycie: ./scripts/testing/remove-duplicates.sh [--dry-run|--execute]

set -e
DRY_RUN=true
if [ "$1" = "--execute" ]; then
  DRY_RUN=false
fi

echo "🔍 Szukam duplikatów..."

# tests/
count_tests=$(find tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) 2>/dev/null | wc -l)
# server/tests/
count_server=$(find server/tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) 2>/dev/null | wc -l)

echo "Znaleziono: $count_tests w tests/, $count_server w server/tests/"

if [ "$DRY_RUN" = true ]; then
  echo "📋 DRY RUN - lista plików do usunięcia:"
  find tests/ server/tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) 2>/dev/null || true
  echo "⚠️  Uruchom z --execute aby usunąć."
  exit 0
fi

echo "🗑️  Usuwam..."
find tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) -delete 2>/dev/null || true
find server/tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) -delete 2>/dev/null || true
echo "✅ Usunięto duplikaty testów."
