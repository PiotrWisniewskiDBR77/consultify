#!/usr/bin/env bash
# check-ssot-paths.sh — łapie martwe ścieżki SSOT w CLAUDE.md (klasa błędu J7:
# dokument przeniesiony/usunięty, referencja w CLAUDE.md nie poprawiona).
#
# Wyciąga z CLAUDE.md ścieżki wzgl. w backtickach zawierające "/" + rozszerzenie
# (.md/.html/.sh), sprawdza `test -f` z korzenia repo. Uruchom z korzenia repo.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 2
fail=0
paths=$(grep -oE '`[A-Za-z0-9_./-]+/[A-Za-z0-9_./-]+\.[a-zA-Z]{2,5}`' CLAUDE.md | tr -d '`' | sort -u)
for p in $paths; do
  if [ ! -e "$p" ]; then
    echo "MARTWA ŚCIEŻKA SSOT w CLAUDE.md: $p" >&2
    fail=1
  fi
done
[ "$fail" -eq 0 ] && echo "check-ssot-paths: OK — wszystkie ścieżki SSOT z CLAUDE.md istnieją."
exit $fail
