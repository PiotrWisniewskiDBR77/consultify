#!/usr/bin/env bash
# check-sqlsql.sh — blokuje NOWE pliki klasy `*.sql.sql` w server/migrations/.
#
# Powód (backlog E-SQL-01, DECYZJA CTO-4): `*.sql.sql` to podwójne
# rozszerzenie — artefakt błędu z ery SQLite, treść w środku ma nagłówek
# jednego `.sql`. 61 historycznych plików tej klasy zarchiwizowano (NIE
# przemianowano — patrz README) do `server/migrations/never-ran/`, bo
# przemianowanie na `.sql` mogłoby sprawić, że zaczną się odpalać na boot
# (runTablePlatformMigrations w server/src/database/DatabaseInitializer.ts,
# oraz server/scripts/migrate.ts) z nieznanym skutkiem na Postgresie.
#
# Ten guard pilnuje żeby ta klasa się nie odrodziła: każdy NOWY plik
# `*.sql.sql` w `server/migrations/` poza `never-ran/` = commit zablokowany.
# Zero-tolerance (bez ratchet/baseline) — klasa ma być pusta, kropka.
#
# Użycie:
#   scripts/check-sqlsql.sh                # skan całego server/migrations/
#   scripts/check-sqlsql.sh <plik> [...]   # skan tylko podanych ścieżek (hook)

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

MIGRATIONS_DIR="server/migrations"
ARCHIVE_SUBDIR="server/migrations/never-ran"

violations=()

if [ "$#" -gt 0 ]; then
  # Wywołanie z listą plików (np. z pre-commit: tylko staged) — filtrujemy do
  # server/migrations/ poza never-ran/.
  for f in "$@"; do
    case "$f" in
      "$ARCHIVE_SUBDIR"/*) continue ;;
      "$MIGRATIONS_DIR"/*.sql.sql) [ -e "$f" ] && violations+=("$f") ;;
    esac
  done
else
  # Bez argumentów: pełny skan katalogu (npm run check:sqlsql / CI).
  while IFS= read -r f; do
    violations+=("$f")
  done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql.sql')
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "" >&2
  echo "  ⛔ Guard zablokował: nowy plik klasy *.sql.sql w server/migrations/." >&2
  echo "     Ta klasa jest martwa z zasady (backlog E-SQL-01) — jeśli to legalna" >&2
  echo "     migracja, nadaj jej pojedyncze rozszerzenie .sql. Jeśli to celowo" >&2
  echo "     martwy/archiwalny plik, umieść go w server/migrations/never-ran/." >&2
  echo "" >&2
  for v in "${violations[@]}"; do
    echo "     - $v" >&2
  done
  echo "" >&2
  exit 1
fi

echo "✅ check-sqlsql: brak nowych plików *.sql.sql poza server/migrations/never-ran/"
exit 0
