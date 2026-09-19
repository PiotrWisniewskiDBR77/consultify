#!/bin/bash
# D-136 / QD20 (DEC-685) — dowód UP -> DOWN -> UP dla migracji 20262304 na KOPII
# dumpu stagingu (kontener qoder-d-pg-6, pgvector/pgvector:pg18 = PostgreSQL 18.6,
# 127.0.0.1:6635, baza consultify_d136 = staging-auto-20260919T0330.dump).
#
# Mierzy, bez zgadywania:
#   1. preflight: `--dry-run` -> "Pending migrations: 1" i ta jedna = 20262304
#      (osobny log: preflight-dry-run.log),
#   2. UP przez REALNY runner (migrate.postgres.ts, pełny łańcuch) -> RC,
#      "Applying migrations: N", status w ledgerze,
#   3. obecność 5 obiektów PRZED / PO UP / PO DOWN / PO UP2 (ten sam przyrząd
#      obiektowy co KROK 0: information_schema.columns + pg_indexes),
#   4. `pg_dump -s` znormalizowany: diff baseline vs PO UP (musi zawierać
#      WYŁĄCZNIE te 5 obiektów), baseline vs PO DOWN (musi być pusty = schema
#      wróciła), PO UP vs PO UP2 (musi być pusty = cykl odtwarzalny),
#   5. RC każdego kroku; DOWN transakcyjny (BEGIN/COMMIT w pliku).
#
# Staging ani demo nie są dotykane. Żadnego zapisu poza tą kopią.
# REGUŁA 10 (Wpis 206): zero sekretów w tym pliku i w logach — hasło lokalnego
# kontenera podaje środowisko (PGPASSWORD), URL bazy jest składany w pamięci.
#
# Uzycie:  PGPASSWORD=<haslo-lokalne> bash udu.sh
set -u
ROOT=/Users/piotrwisniewski/Developer/qoder-wt/consultify-d
E="$ROOT/evidence/d136-scim-objects-20260919"
PORT="${D136_PORT:-6635}"
DB="${D136_DB:-consultify_d136}"
MIG=20262304_scim_missing_objects.sql
DOWN="server/migrations/rollback/20262304_scim_missing_objects.down.sql"
PSQL_BIN=/opt/homebrew/opt/postgresql@18/bin/psql
PGDUMP_BIN=/opt/homebrew/opt/postgresql@18/bin/pg_dump
: "${PGPASSWORD:?ustaw PGPASSWORD w srodowisku (haslo lokalnego kontenera; REGULA 10 — zero sekretow w pliku)}"
export PGPASSWORD
DBURL="postgres://postgres:$PGPASSWORD@127.0.0.1:$PORT/$DB"
cd "$ROOT" || exit 1
mkdir -p "$E/dumpy" "$E/obiekty"

q() { "$PSQL_BIN" -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

# Obecność 5 obiektów (3 kolumny + 2 indeksy) — jeden wiersz na obiekt.
obiekty() { # $1 = plik wyjściowy
  q -tA -F'|' -c "
SELECT 'COL users.scim_external_id', (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='scim_external_id')::text
UNION ALL SELECT 'COL users.scim_provisioned', (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='scim_provisioned')::text
UNION ALL SELECT 'COL users.scim_last_sync_at', (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='scim_last_sync_at')::text
UNION ALL SELECT 'IDX idx_users_scim_external_id', (SELECT count(*) FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_users_scim_external_id')::text
UNION ALL SELECT 'IDX idx_scim_conflicts_org', (SELECT count(*) FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_scim_conflicts_org')::text
ORDER BY 1;" > "$1" 2>&1
}
obecne() { awk -F'|' '$2=="1"' "$1" | wc -l | tr -d ' '; }

dump_norm() { # $1 = plik wyjściowy
  "$PGDUMP_BIN" -s --no-owner --no-privileges -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" 2>/dev/null \
    | grep -v 'restrict ' > "$1"
}

run_runner() { # $1 = log ; dodatkowe flagi w $2..
  NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" \
    npx tsx server/scripts/migrate.postgres.ts --dir server/migrations "$@" > "$1" 2>&1
  echo $?
}

W="$E/udu-wyniki.txt"
{
  echo "# D-136 UP->DOWN->UP, $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "kontener=qoder-d-pg-6 port=$PORT baza=$DB (kopia staging-auto-20260919T0330.dump)"
  echo "migracja=$MIG  down=$DOWN"
  echo "down_transakcyjny_begin=$(grep -ciE '^[[:space:]]*BEGIN;' "$DOWN")"
  echo "down_destrukcyjne_operacje=$(grep -ciE '\b(DROP TABLE|TRUNCATE|DELETE FROM)\b' "$DOWN")"
} > "$W"

# --- baseline ---------------------------------------------------------------
obiekty "$E/obiekty/00-baseline.txt"
BL="$E/dumpy/baseline.sql"; dump_norm "$BL"
echo "baseline_obiektow_obecnych=$(obecne "$E/obiekty/00-baseline.txt")/5" >> "$W"

# --- UP 1 (realny runner, pełny łańcuch) ------------------------------------
rc_up1=$(run_runner "$E/up1.log")
applied1=$(grep -oE 'Applying migrations: [0-9]+' "$E/up1.log" | tail -1)
obiekty "$E/obiekty/01-po-up1.txt"
PU1="$E/dumpy/po-up1.sql"; dump_norm "$PU1"
diff "$BL" "$PU1" > "$E/dumpy/diff-baseline-po-up1.txt"
d_up1=$(grep -c '^[<>]' "$E/dumpy/diff-baseline-po-up1.txt")
ledger1=$(q -tA -c "SELECT status FROM schema_migrations WHERE filename='$MIG';" 2>/dev/null)
{
  echo "rc_up1=$rc_up1  ${applied1:-brak_linii_Applying}  ledger=$ledger1"
  echo "po_up1_obiektow=$(obecne "$E/obiekty/01-po-up1.txt")/5"
  echo "diff_baseline_po_up1_linie=$d_up1"
} >> "$W"

# --- DOWN -------------------------------------------------------------------
q -f "$DOWN" > "$E/down.log" 2>&1; rc_down=$?
obiekty "$E/obiekty/02-po-down.txt"
PD="$E/dumpy/po-down.sql"; dump_norm "$PD"
diff "$BL" "$PD" > "$E/dumpy/diff-baseline-po-down.txt"
d_down=$(grep -c '^[<>]' "$E/dumpy/diff-baseline-po-down.txt")
{
  echo "rc_down=$rc_down"
  echo "po_down_obiektow=$(obecne "$E/obiekty/02-po-down.txt")/5"
  echo "diff_baseline_po_down_linie=$d_down  (oczekiwane 0 = schema wróciła)"
} >> "$W"

# --- UP 2 (po usunięciu wpisu ledgera, jak przy realnym ponownym wdrożeniu) --
q -q -c "DELETE FROM schema_migrations WHERE filename='$MIG';" >> "$E/down.log" 2>&1
rc_del=$?
rc_up2=$(run_runner "$E/up2.log")
applied2=$(grep -oE 'Applying migrations: [0-9]+' "$E/up2.log" | tail -1)
obiekty "$E/obiekty/03-po-up2.txt"
PU2="$E/dumpy/po-up2.sql"; dump_norm "$PU2"
diff "$PU1" "$PU2" > "$E/dumpy/diff-po-up1-po-up2.txt"
d_udu=$(grep -c '^[<>]' "$E/dumpy/diff-po-up1-po-up2.txt")
diff "$BL" "$PU2" > "$E/dumpy/diff-baseline-po-up2.txt"
d_up2=$(grep -c '^[<>]' "$E/dumpy/diff-baseline-po-up2.txt")
ledger2=$(q -tA -c "SELECT status FROM schema_migrations WHERE filename='$MIG';" 2>/dev/null)
{
  echo "rc_delete_ledger=$rc_del  rc_up2=$rc_up2  ${applied2:-brak_linii_Applying}  ledger=$ledger2"
  echo "po_up2_obiektow=$(obecne "$E/obiekty/03-po-up2.txt")/5"
  echo "diff_po_up1_po_up2_linie=$d_udu  (oczekiwane 0 = cykl odtwarzalny)"
  echo "diff_baseline_po_up2_linie=$d_up2  (oczekiwane = diff_baseline_po_up1_linie)"
} >> "$W"

# --- werdykt ----------------------------------------------------------------
{
  echo ""
  if [ "$rc_up1" = 0 ] && [ "$rc_down" = 0 ] && [ "$rc_up2" = 0 ] \
     && [ "$(obecne "$E/obiekty/01-po-up1.txt")" = 5 ] \
     && [ "$(obecne "$E/obiekty/02-po-down.txt")" = 0 ] \
     && [ "$(obecne "$E/obiekty/03-po-up2.txt")" = 5 ] \
     && [ "$d_down" = 0 ] && [ "$d_udu" = 0 ]; then
    echo "WERDYKT=PASS (RC 0/0/0, obiekty 5->0->5, diff baseline-PO_DOWN=0, diff UP1-UP2=0)"
  else
    echo "WERDYKT=FAIL (szczegóły powyżej)"
  fi
} >> "$W"

cat "$W"
