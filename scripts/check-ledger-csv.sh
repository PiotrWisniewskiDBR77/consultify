#!/usr/bin/env bash
# check-ledger-csv.sh — CSV contract guard for docs/qa/*/02_EXECUTION_LEDGER.csv-style files.
#
# Enforces that every record (header + data rows) has exactly the same number
# of columns as the header (currently 20 for the Ideas transformation ledger).
# Uses a real CSV parser (Python's csv module) so that commas and embedded
# quotes inside quoted fields do NOT get miscounted as column separators —
# naive `tr ',' '\n' | wc -l` splitting is wrong for this file and must not
# be used here.
#
# Usage:
#   scripts/check-ledger-csv.sh [path-to-ledger.csv ...]
# With no arguments, checks the canonical Ideas transformation ledger.
#
# Exit 0: every row (including header) has the expected column count.
# Exit 1: at least one row has a wrong column count (row number + actual
#         count printed for each offender), or the file could not be parsed.

set -euo pipefail

DEFAULT_LEDGER="docs/qa/ideas-complete-transformation-2026-08-09/02_EXECUTION_LEDGER.csv"

if [ "$#" -eq 0 ]; then
  set -- "$DEFAULT_LEDGER"
fi

status=0

for ledger in "$@"; do
  if [ ! -f "$ledger" ]; then
    echo "✗ check-ledger-csv: plik nie istnieje: $ledger"
    status=1
    continue
  fi

  if ! python3 - "$ledger" <<'PYEOF'
import csv
import sys

path = sys.argv[1]

with open(path, newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    rows = list(reader)

if not rows:
    print(f"✗ check-ledger-csv: {path} jest pusty (brak nawet nagłówka)")
    sys.exit(1)

header = rows[0]
expected = len(header)
bad_rows = []

for i, row in enumerate(rows[1:], start=2):
    if len(row) != expected:
        bad_rows.append((i, len(row)))

if bad_rows:
    print(f"✗ check-ledger-csv: {path}")
    print(f"  nagłówek ma {expected} kolumn, ale {len(bad_rows)} wiersz(y) się nie zgadza:")
    for line_no, actual in bad_rows:
        print(f"    linia {line_no}: {actual} kolumn (oczekiwano {expected})")
    sys.exit(1)

print(f"✓ check-ledger-csv: {path} — {len(rows) - 1} wierszy danych, każdy z {expected} kolumnami zgodnie z nagłówkiem")
sys.exit(0)
PYEOF
  then
    status=1
  fi
done

exit "$status"
