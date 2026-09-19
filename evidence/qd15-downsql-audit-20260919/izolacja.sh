#!/bin/bash
# QD15 — testy IZOLOWANE. Pelny audyt (audyt-up-down-up.sh) idzie przez migracje
# w odwrotnej kolejnosci chronologicznej NA TEJ SAMEJ bazie, wiec cykl migracji N
# startuje ze stanu zostawionego przez cykle N+1..N+k. Trzy wyniki z pelnego audytu
# wymagaja rozstrzygniecia: defekt WLASNY pliku czy efekt kolejnosci lancucha?
#   * 20262271 up1=1 up2=1 ledger=failed  ("TEMPLATE-1 readback: expected 39 active
#     base snapshots, found 293") — podejrzenie: DOWN od 20262272 przywrocil wiersze
#     template'ow, ktore 20262272 UP wyczyscil.
#   * 20262280 down=3 ("20262280 rollback conflict in
#     public.organization_context_snapshots.snapshot_json: 1 rows changed or missing
#     after apply") — podejrzenie: down jest fail-closed Z PROJEKTU (linia 2-3 pliku),
#     a konflikt zasial wczesniejszy cykl.
#   * 20262282 SEM=NIE (13 linii katalogu) — podejrzenie: defekt WLASNY, bo
#     rollback/20262282_*.down.sql:9 robi DROP TABLE obiektu utworzonego przez
#     20261090_meetings_day19_note_materialization.sql:4, a UP 20262282:13 to
#     CREATE TABLE IF NOT EXISTS (na stagingu byl no-opem).
# Kazda migracja dostaje SWIEZY, niezalezny restore tego samego dumpu — zero stanu
# z poprzedniego testu. Staging/demo nietkniete; wszystko w kontenerze qoder-d-pg-5.
set -u
ROOT=/Users/piotrwisniewski/Developer/qoder-wt/consultify-d
E="$ROOT/evidence/qd15-downsql-audit-20260919"
PORT=6634
DB=consultify_qd15_iso
DUMP=/Users/piotrwisniewski/Developer/kopie/staging-pre-d121-20260918.dump
P=/opt/homebrew/opt/postgresql@18/bin
# REGULA 10 (Wpis 206, CTO): zero sekretow w plikach evidence — haslo lokalnego
# kontenera podaje srodowisko (zmienna PGPASSWORD, wartosc `<haslo-lokalne>`);
# audyt-up-down-up.sh odziedziczy je z tego srodowiska.
: "${PGPASSWORD:?ustaw PGPASSWORD w srodowisku (haslo lokalnego kontenera; REGULA 10 — zero sekretow w pliku)}"
export PGPASSWORD
cd "$ROOT" || exit 1

for m in "$@"; do
  echo "=== IZOLACJA $m — $(date '+%H:%M:%S')"
  $P/psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -q \
    -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;"
  $P/pg_restore --no-owner --no-privileges -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" "$DUMP" > /dev/null 2>&1
  echo "restore_rc=$? tables=$($P/psql -h 127.0.0.1 -p $PORT -U postgres -d $DB -tA -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
  bash "$E/audyt-up-down-up.sh" "$DB" "$m"
  mv "$E/wyniki-smoke-$m.txt" "$E/izolacja-$m.txt"
  echo "--- wynik:"
  grep -E '^(baseline|koniec_)|^\S+\.sql\|' "$E/izolacja-$m.txt"
  echo ""
done
echo "=== IZOLACJE SKONCZONE $(date '+%H:%M:%S')"
