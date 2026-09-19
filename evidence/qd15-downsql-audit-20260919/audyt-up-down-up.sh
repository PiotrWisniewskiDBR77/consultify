#!/bin/bash
# QD15 (Wpis 193, kolumna D v2) — audyt `.down.sql` dla migracji >= 20262260 na linii 700e8f8e98.
# Dla kazdej migracji, ktora MA plik rollback/<base>.down.sql, na KOPII dumpu stagingu
# (kontener qoder-d-pg-5, pgvector/pgvector:pg17 = PostgreSQL 17.11, 127.0.0.1:6634)
# wykonuje cykl UP -> DOWN -> UP i mierzy TRZY niezalezne metryki schematu:
#   1. SEM  — semantyczny odcisk katalogu (kolumny+typy+nullability+defaulty, indeksy,
#             constrainty, relacje, funkcje, triggery; kolejnosc wierszy znormalizowana).
#             To jest miara "czy schemat wrocil do stanu sprzed cyklu" — odporna na
#             przestawienie attnum.
#   2. POS  — osobny odcisk kolejnosci kolumn (table.column.ordinal_position).
#             Rozjazd SEM=TAK / POS=NIE oznacza: struktura ta sama, ale DROP+ADD COLUMN
#             przesunal kolumne w tabeli (uczciwie raportowane, nie ukrywane).
#   3. DUMP — znormalizowany `pg_dump -s` (bez tokena sesji \restrict/\unrestrict):
#             hash sha256 + liczba linii diff przed/po. Ta miara jest NAJSCISLEJSZA
#             i czerwieni sie takze przy przestawieniu attnum — wlasnie dlatego
#             SEM/POS sa potrzebne, zeby ja zinterpretowac.
# Dodatkowo: RC kazdego z trzech krokow, czy migrator realnie zastosowal plik
# ("Applying migrations: 1", nie 0), stan ledgera, transakcyjnosc down (BEGIN),
# liczba destrukcyjnych operacji w down.
# Staging ani demo nie sa dotykane. Zadnego zapisu poza ta kopia.
#
# Uzycie:  audyt-up-down-up.sh [nazwa_db] [tylko_ta_migracja.sql]
set -u
ROOT=/Users/piotrwisniewski/Developer/qoder-wt/consultify-d
E="$ROOT/evidence/qd15-downsql-audit-20260919"
PORT=6634
DB="${1:-consultify_qd15}"
ONLY="${2:-}"
PSQL_BIN=/opt/homebrew/opt/postgresql@18/bin/psql
PGDUMP_BIN=/opt/homebrew/opt/postgresql@18/bin/pg_dump
# REGULA 10 (Wpis 206, CTO): zero sekretow w plikach evidence. Haslo lokalnego
# kontenera podaje srodowisko (zmienna PGPASSWORD, wartosc `<haslo-lokalne>`),
# nie ten plik. Wywolanie: ustaw PGPASSWORD w srodowisku, potem
#   bash audyt-up-down-up.sh [nazwa_db] [migracja.sql]
: "${PGPASSWORD:?ustaw PGPASSWORD w srodowisku (haslo lokalnego kontenera; REGULA 10 — zero sekretow w pliku)}"
export PGPASSWORD
DBUSER="${QD15_PG_USER:-postgres}"
DBURL="postgres://$DBUSER:$PGPASSWORD@127.0.0.1:$PORT/$DB"
cd "$ROOT" || exit 1
mkdir -p "$E/cykle" "$E/dumpy"

q() { "$PSQL_BIN" -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

# 1. SEM — semantyczny odcisk katalogu public.
sem_hash() {
  q -tA -c "
SELECT md5(string_agg(line, E'\n' ORDER BY line)) FROM (
  SELECT format('COL %s.%s %s %s %s', table_name, column_name, data_type, is_nullable, coalesce(column_default,'-')) AS line
    FROM information_schema.columns WHERE table_schema='public'
  UNION ALL SELECT format('IDX %s %s', tablename, indexdef) FROM pg_indexes WHERE schemaname='public'
  UNION ALL SELECT format('CON %s %s %s', conrelid::regclass, conname, pg_get_constraintdef(oid))
    FROM pg_constraint WHERE connamespace='public'::regnamespace
  UNION ALL SELECT format('TBL %s %s', relname, relkind) FROM pg_class c
    WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','v','m','S','f')
  UNION ALL SELECT format('FN %s %s', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  UNION ALL SELECT format('TRG %s %s', tgrelid::regclass, tgname) FROM pg_trigger WHERE NOT tgisinternal
) s;" 2>/dev/null
}

# 2. POS — odcisk kolejnosci kolumn (attnum porzadek w pg_dump -s).
# UWAGA (M3): wczesniejsza wersja uzywala `string_agg(... ORDER BY 1)`. Wewnatrz
# agregatu gola liczba NIE jest pozycja kolumny wyjsciowej, tylko STALA sortujaca,
# czyli kolejnosc agregacji byla niezdefiniowana: trzy identyczne swieze przywrocenia
# z tego samego dumpu daly trzy rozne hashe (b7af57c3 / e1e88188 / 0db535da) przy
# identycznych 24779-liniowych zbiorach (diff=0). SEM uzywal nazwanej kolumny
# (`ORDER BY line`) i odtwarzal sie co do bajtu. Poprawka: sortowanie po nazwanej
# kolumnie podzapytania + werdykty TAK/NIE liczone z diffow zbiorow linii, nie z hasha.
pos_hash() {
  q -tA -c "SELECT md5(string_agg(line, E'\n' ORDER BY line)) FROM (
              SELECT format('POS %s.%s %s', table_name, column_name, ordinal_position) AS line
                FROM information_schema.columns WHERE table_schema='public') s;" 2>/dev/null
}

# Zbiory linii odcisku (do atrybucji rozjazdu do konkretnego obiektu katalogu).
sem_lines() {
  q -tA -c "
SELECT line FROM (
  SELECT format('COL %s.%s %s %s %s', table_name, column_name, data_type, is_nullable, coalesce(column_default,'-')) AS line
    FROM information_schema.columns WHERE table_schema='public'
  UNION ALL SELECT format('IDX %s %s', tablename, indexdef) FROM pg_indexes WHERE schemaname='public'
  UNION ALL SELECT format('CON %s %s %s', conrelid::regclass, conname, pg_get_constraintdef(oid))
    FROM pg_constraint WHERE connamespace='public'::regnamespace
  UNION ALL SELECT format('TBL %s %s', relname, relkind) FROM pg_class c
    WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','v','m','S','f')
  UNION ALL SELECT format('FN %s %s', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  UNION ALL SELECT format('TRG %s %s', tgrelid::regclass, tgname) FROM pg_trigger WHERE NOT tgisinternal
) s ORDER BY line;" 2>/dev/null
}
pos_lines() {
  q -tA -c "SELECT line FROM (
              SELECT format('POS %s.%s %s', table_name, column_name, ordinal_position) AS line
                FROM information_schema.columns WHERE table_schema='public') s ORDER BY line;" 2>/dev/null
}

# 3. DUMP — znormalizowany pg_dump -s do pliku; hash + diff vs baseline.
dump_norm() { # $1 = plik wyjsciowy
  "$PGDUMP_BIN" -s --no-owner --no-privileges -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" 2>/dev/null \
    | grep -v 'restrict ' > "$1"
}
dump_hash() { shasum -a 256 < "$1" | cut -d' ' -f1; }

run_up() { # $1 = filename, $2 = log ; stdout = RC
  NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" \
    npx tsx server/scripts/migrate.postgres.ts --dir server/migrations --only "$1" > "$2" 2>&1
  echo $?
}

WYNIKI="$E/wyniki.txt"
if [ -n "$ONLY" ]; then WYNIKI="$E/wyniki-smoke-$ONLY.txt"; fi

mkdir -p "$E/fp/$DB"
BL_SEM=$(sem_hash); BL_POS=$(pos_hash)
BL_DUMP="$E/dumpy/baseline-$DB.sql"; dump_norm "$BL_DUMP"; BL_DH=$(dump_hash "$BL_DUMP")
BL_SEM_F="$E/fp/$DB/baseline-sem.txt"; BL_POS_F="$E/fp/$DB/baseline-pos.txt"
sem_lines > "$BL_SEM_F"; pos_lines > "$BL_POS_F"
PREV_SEM_F="$BL_SEM_F"

{
  echo "db=$DB"
  echo "baseline_sem=$BL_SEM"
  echo "baseline_pos=$BL_POS"
  echo "baseline_dump_sha256=$BL_DH"
  echo "data_start=$(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "filtr=${ONLY:-brak (pelny audyt)}"
  echo ""
  echo "migracja|down|rc_up1|rc_down|rc_up2|applied1|applied2|begin_w_down|destrukcyjne_w_down|SEM_powrot|POS_powrot|DUMP_powrot|diff_dump_linie|sem_diff_vs_baseline|sem_delta_vs_poprzedni|pos_diff_vs_baseline|DOWN_zmienil_schemat|ledger|sem_po|pos_po|dump_po|uwagi"
} > "$WYNIKI"

# Odwrotna kolejnosc chronologiczna = kolejnosc rollbacku.
MIGRATIONS=$(ls server/migrations | grep -E '^2026[0-9]{4}_' | sort -r)

for f in $MIGRATIONS; do
  n=${f%%_*}
  [ "$n" -ge 20262260 ] 2>/dev/null || continue
  if [ -n "$ONLY" ] && [ "$f" != "$ONLY" ]; then continue; fi
  base=${f%.sql}
  down="server/migrations/rollback/$base.down.sql"
  log="$E/cykle/$base.log"
  if [ ! -f "$down" ]; then
    echo "$f|DOWN_BRAK|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|plik .down.sql nie istnieje" >> "$WYNIKI"
    continue
  fi
  {
    echo "=== $f ==="
    echo "down: $down"
    echo "start: $(date '+%H:%M:%S')"
  } > "$log"

  tx=$(grep -ciE '^[[:space:]]*BEGIN;' "$down")
  del=$(grep -ciE '\b(DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN)\b' "$down")

  q -q -c "DELETE FROM schema_migrations WHERE filename='$f';" >> "$log" 2>&1
  rc_del=$?
  rc_up1=$(run_up "$f" "$log.up1")
  applied1=$(grep -oE 'Applying migrations: [0-9]+' "$log.up1" | tail -1)
  S1_SEM=$(sem_hash)
  q -f "$down" >> "$log" 2>&1; rc_down=$?
  S2_SEM=$(sem_hash)
  q -q -c "DELETE FROM schema_migrations WHERE filename='$f';" >> "$log" 2>&1
  rc_up2=$(run_up "$f" "$log.up2")
  applied2=$(grep -oE 'Applying migrations: [0-9]+' "$log.up2" | tail -1)
  ledger=$(q -tA -c "SELECT status FROM schema_migrations WHERE filename='$f';" 2>/dev/null)

  A_SEM=$(sem_hash); A_POS=$(pos_hash)
  A_DUMP="$E/dumpy/po-$base.sql"; dump_norm "$A_DUMP"; A_DH=$(dump_hash "$A_DUMP")
  ddiff=$(diff "$BL_DUMP" "$A_DUMP" | grep -c '^[<>]')
  A_SEM_F="$E/fp/$DB/po-$base-sem.txt"; A_POS_F="$E/fp/$DB/po-$base-pos.txt"
  sem_lines > "$A_SEM_F"; pos_lines > "$A_POS_F"
  sem_d=$(diff "$BL_SEM_F" "$A_SEM_F" | grep -c '^[<>]')
  pos_d=$(diff "$BL_POS_F" "$A_POS_F" | grep -c '^[<>]')
  sem_delta=$(diff "$PREV_SEM_F" "$A_SEM_F" | grep -c '^[<>]')
  diff "$BL_SEM_F" "$A_SEM_F" > "$E/fp/$DB/rozjazd-$base-sem.diff"
  diff "$BL_POS_F" "$A_POS_F" > "$E/fp/$DB/rozjazd-$base-pos.diff"
  diff "$PREV_SEM_F" "$A_SEM_F" > "$E/fp/$DB/delta-$base-sem.diff"
  PREV_SEM_F="$A_SEM_F"
  # Werdykt z diffu zbiorow linii (odtwarzalny), hash tylko jako odcisk pomocniczy.
  [ "$sem_d" -eq 0 ] && sem_ok="TAK" || sem_ok="NIE"
  # M3 (mutacja wykryta 19.09): sama rownosc stanu KONCOWEGO nie dowodzi, ze DOWN
  # cokolwiek cofnal — jesli down pominie DROP TABLE, a UP ma CREATE TABLE IF NOT
  # EXISTS, to UP->DOWN->UP konczy sie stanem identycznym z baseline i miara mowilaby
  # PASS o rollbacku, ktory nic nie zrobil. Dlatego osobny odcisk PO UP1 i PO DOWN:
  # DOWN_zmienil_schemat=NIE oznacza rollback pusty (albo swiadomie data-only,
  # jak 20262284) i taka linia wymaga wyjasnienia, nie jest dowodem poprawnosci.
  [ "$S1_SEM" != "$S2_SEM" ] && down_eff="TAK" || down_eff="NIE"
  [ "$pos_d" -eq 0 ] && pos_ok="TAK" || pos_ok="NIE"
  [ "$ddiff"  -eq 0 ] && dump_ok="TAK" || dump_ok="NIE"

  note=""
  [ "$rc_del" -ne 0 ] && note="${note}delete_ledger_rc=$rc_del; "
  [ "$rc_up1" -ne 0 ] && note="${note}up1_rc=$rc_up1; "
  [ "$rc_down" -ne 0 ] && note="${note}down_rc=$rc_down; "
  [ "$rc_up2" -ne 0 ] && note="${note}up2_rc=$rc_up2; "
  [ "$sem_ok" = "NIE" ] && note="${note}SEM_rozjazd; "
  [ "$down_eff" = "NIE" ] && note="${note}DOWN_pusty_lub_data_only; "
  [ "$pos_ok" = "NIE" ] && [ "$sem_ok" = "TAK" ] && note="${note}tylko_kolejnosc_kolumn; "
  echo "$f|DOWN_TAK|$rc_up1|$rc_down|$rc_up2|$applied1|$applied2|$tx|$del|$sem_ok|$pos_ok|$dump_ok|$ddiff|$sem_d|$sem_delta|$pos_d|$down_eff|$ledger|$A_SEM|$A_POS|$A_DH|${note:-ok}" >> "$WYNIKI"

  cat "$log.up1" "$log.up2" >> "$log"
  rm -f "$log.up1" "$log.up2"
  echo "koniec: $(date '+%H:%M:%S') up1=$rc_up1 down=$rc_down up2=$rc_up2 SEM=$sem_ok POS=$pos_ok DUMP=$dump_ok diff_linie=$ddiff" >> "$log"
done

BL2_DUMP="$E/dumpy/koniec-$DB.sql"; dump_norm "$BL2_DUMP"
{
  echo ""
  echo "data_koniec=$(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "koniec_sem=$(sem_hash)"
  echo "koniec_pos=$(pos_hash)"
  echo "koniec_dump_sha256=$(dump_hash "$BL2_DUMP")"
  echo "koniec_diff_vs_baseline_linie=$(diff "$BL_DUMP" "$BL2_DUMP" | grep -c '^[<>]')"
} >> "$WYNIKI"
echo "=== $(date '+%H:%M:%S') AUDYT SKONCZONY db=$DB ==="
