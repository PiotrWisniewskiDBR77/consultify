#!/bin/bash
# Lista plików .test bez rozszerzenia (martwe pliki)
echo "🔍 Pliki .test bez rozszerzenia (nie wykonywane przez Vitest):"
find tests/ server/tests/ -type f -name "*.test" 2>/dev/null | head -50
echo "..."
total=$(find tests/ server/tests/ -type f -name "*.test" 2>/dev/null | wc -l)
echo "Razem: $total plików"
