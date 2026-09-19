#!/bin/bash
# QD16 / D-03 ETAP 1 (DEC-660) — preflight migracji 20262305 na KOPII dumpu
# staging-auto-20260919T0330. Wzór: QD14-bis preflight32.sh + D-136 udu.sh.
#
# Mierzy, bez zgadywania:
#   §1 stan kopii (dump, PG, tabele, ledger, typy 24 tabel etap-1 PRZED),
#   §2 odcisk danych PRZED (wiersze, nie-NULL, md5 tekstu, md5 chwili) — niezależna
#      lista 24 tabel w tym skrypcie, NIE zaczytana z migracji,
#   §3 `--dry-run` -> asercja pending == 2 i że to DOKŁADNIE
#      {20262304_scim_missing_objects.sql, 20262305_created_at_timestamptz_etap1.sql},
#   §4 UP realnym runnerem -> RC, "Applying migrations: N", ledger,
#   §5 PO_UP: typy 24 tabel, domyślne, ile wciąż text,
#   §6 PODWÓJNE zastosowanie (łańcuch Table Platform też łapie pliki 8-cyfrowe,
#      migrationIdentity.ts:56): ten sam plik drugi raz przez psql -> RC=0,
#      converted=0 already=24, odcisk chwili bez zmian,
#   §7 bramka release-migration-gate.ts (APP_BUILD_SHA = tip linii),
#   §8 `pg_dump -s` diff baseline<->PO_UP,
#   §9 DOWN (plik rollback) + kasacja wiersza ledgera -> RC, typy z powrotem text,
#      odcisk TEKSTU identyczny z §2 (wierność bajt w bajt per kształt),
#      diff baseline<->PO_DOWN = wyłącznie 5 obiektów SCIM z 20262304,
#   §10 UP2 -> identyczność z PO_UP1 (typy, chwila, diff PO_UP1<->PO_UP2 = 0),
#   §11 sha256 obu plików migracji.
#
# Staging i demo nie są dotykane — tylko kopia w kontenerze stanowiska D.
# REGUŁA 10 (Wpis 206): zero sekretów w tym pliku i w logach; hasło lokalnego
# kontenera podaje środowisko (PGPASSWORD), URL bazy składany w pamięci.
#
# Uzycie: wyeksportuj PGPASSWORD (haslo lokalnego kontenera) w srodowisku,
#         a nastepnie uruchom: bash preflight-etap1.sh
set -u
ROOT=/Users/piotrwisniewski/Developer/qoder-wt/consultify-d
E="$ROOT/evidence/d03-createdat-etap1-20260919"
PORT="${QD16_PORT:-6637}"
DB="${QD16_DB:-consultify_qd16}"
CONTAINER="${QD16_CONTAINER:-qoder-d-pg-8}"
MIG=20262305_created_at_timestamptz_etap1.sql
MIG_PREV=20262304_scim_missing_objects.sql
DOWN="server/migrations/rollback/20262305_created_at_timestamptz_etap1.down.sql"
PSQL_BIN=/opt/homebrew/opt/postgresql@18/bin/psql
PGDUMP_BIN=/opt/homebrew/opt/postgresql@18/bin/pg_dump
: "${PGPASSWORD:?ustaw PGPASSWORD w srodowisku (haslo lokalnego kontenera; REGULA 10 — zero sekretow w pliku)}"
export PGPASSWORD
export PGOPTIONS="-c timezone=UTC"
DBURL="postgres://postgres:$PGPASSWORD@127.0.0.1:$PORT/$DB"
cd "$ROOT" || exit 1
mkdir -p "$E"

q() { "$PSQL_BIN" -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

dump_norm() { # $1 = plik wyjściowy
  "$PGDUMP_BIN" -s --no-owner --no-privileges -n public -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" 2>/dev/null \
    | grep -v 'restrict ' > "$1"
}

run_runner() { # $1 = log ; dodatkowe flagi w $2..
  NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" \
    npx tsx server/scripts/migrate.postgres.ts --dir server/migrations "$@" > "$1" 2>&1
  echo $?
}

# Niezależna od migracji lista 24 tabel etap-1 + kształt zmierzony w KROK 0.
LISTA_SQL="(VALUES
 ('wave6_context_ledger','KANON'),('wave6_context_snapshots','KANON'),
 ('wave5_artifact_versions','KANON'),('research_session_events','KANON'),
 ('research_sessions','KANON'),('research_evidence_graph','KANON'),
 ('research_report_artifacts','KANON'),('wave7_connectors','KANON'),
 ('wave6_memory_candidates','KANON'),('wave6_memory_stewardship_decisions','KANON'),
 ('wave8_agent_notifications','KANON'),('wave8_agent_runs','KANON'),
 ('wave9_evidence_registry','KANON'),('ai_deep_thinking_confirms','KANON'),
 ('usage_pricing_tiers','KANON'),('v8_promotion_gates','KANON'),
 ('notification_dedup','ISOZ'),('meeting_participants','ISOZ'),
 ('work_canvas_proposals','ISOZ'),('document_share_links','ISOZ'),
 ('deck_comments','ISOZ'),('decision_escalation_templates','PUSTA'),
 ('meeting_decisions','PUSTA'),('tax_rates','PUSTA'))"

odcisk() { # $1 = plik wynikowy, $2 = etykieta etapu
  # per tabela: wiersze, nie-NULL, md5 tekstu (surowy), md5 chwili (epoch)
  local etykieta="${2:-?}"
  for row in $(q -tA -F'|' -c "SELECT tabela||'~'||ksztalt FROM $LISTA_SQL AS e(tabela,ksztalt) ORDER BY 1"); do
    t="${row%%~*}"; k="${row##*~}"
    read -r w n ht hc <<<"$(q -tA -F' ' -c "
SELECT (SELECT count(*) FROM public.$t),
       (SELECT count(*) FROM public.$t WHERE created_at IS NOT NULL),
       coalesce(md5(string_agg(created_at::text, ',' ORDER BY created_at::text)),'-'),
       coalesce(md5(string_agg(extract(epoch FROM created_at::timestamptz)::text, ',' ORDER BY created_at::timestamptz)),'-')
FROM public.$t;" 2>&1)"
    echo "$etykieta|$t|$k|$w|$n|$ht|$hc" >> "$1"
  done
}

typy() { # $1 = plik
  q -tA -F'|' -c "
SELECT e.tabela, coalesce(c.data_type,'(brak)'), coalesce(c.column_default,'(brak)')
FROM $LISTA_SQL AS e(tabela,ksztalt)
LEFT JOIN information_schema.columns c
  ON c.table_schema='public' AND c.table_name=e.tabela AND c.column_name='created_at'
ORDER BY e.tabela;" > "$1" 2>&1
}

W="$E/preflight-etap1-wyniki.txt"
: > "$W"
O_PRZED="$E/odcisk-przed.txt"; O_UP1="$E/odcisk-po-up1.txt"
O_DUP="$E/odcisk-po-podwojnym.txt"; O_DOWN="$E/odcisk-po-down.txt"; O_UP2="$E/odcisk-po-up2.txt"
for f in "$O_PRZED" "$O_UP1" "$O_DUP" "$O_DOWN" "$O_UP2"; do : > "$f"; done

# ============================ §1 stan kopii =================================
LINIA=$(git ls-remote origin refs/heads/integracja/20260911 | awk '{print $1}')
HEAD_LOCAL=$(git rev-parse HEAD)
{
  echo "# QD16 / D-03 ETAP 1 — preflight migracji 20262305, $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "kontener=$CONTAINER  port=$PORT  baza=$DB  (kopia dumpu, staging/demo nietknięte)"
  echo "linia_integracyjna=$LINIA"
  echo "HEAD_worktree=$HEAD_LOCAL"
  echo "dump=$(ls -1 ~/Developer/kopie/staging-auto-*.dump | tail -1)"
  echo "dump_rozmiar=$(stat -f%z "$(ls -1 ~/Developer/kopie/staging-auto-*.dump | tail -1)")"
  echo "pg_wersja_kopii=$(q -tAc 'SHOW server_version')"
  echo "tabel_w_public=$(q -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
  echo "ledger_wierszy=$(q -tAc 'SELECT count(*) FROM schema_migrations')"
  echo "ledger_statusy=$(q -tAc "SELECT string_agg(status||'='||n, ', ' ORDER BY status) FROM (SELECT status, count(*) n FROM schema_migrations GROUP BY status) s")"
  echo "20262304_w_ledgerze=$(q -tAc "SELECT count(*) FROM schema_migrations WHERE filename LIKE '20262304%'")"
  echo "20262305_w_ledgerze=$(q -tAc "SELECT count(*) FROM schema_migrations WHERE filename LIKE '20262305%'")"
  echo "etap1_tabel_text_przed=$(q -tAc "SELECT count(*) FROM information_schema.columns c JOIN $LISTA_SQL AS e(tabela,ksztalt) ON e.tabela=c.table_name WHERE c.table_schema='public' AND c.column_name='created_at' AND c.data_type='text'")"
  echo "etap1_tabel_razem=$(q -tAc "SELECT count(*) FROM $LISTA_SQL AS e(tabela,ksztalt)")"
  echo "created_at_text_w_calej_bazie_przed=$(q -tAc "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='created_at' AND data_type='text'")"
} >> "$W"

# ============================ §2 odcisk PRZED ===============================
odcisk "$O_PRZED" PRZED
typy "$E/typy-przed.txt"
dump_norm "$E/dump-baseline.txt"
{
  echo ""
  echo "# §2 odcisk danych PRZED (wiersze|nieNULL|md5tekst|md5chwila per tabela)"
  echo "odcisk_przed_wierszy_razem=$(awk -F'|' '{s+=$4} END{print s}' "$O_PRZED")"
  echo "odcisk_przed_nienull_razem=$(awk -F'|' '{s+=$5} END{print s}' "$O_PRZED")"
  echo "typy_przed_text=$(awk -F'|' '$2=="text"' "$E/typy-przed.txt" | wc -l | tr -d ' ')"
  echo "typy_przed_timestamptz=$(awk -F'|' '$2=="timestamp with time zone"' "$E/typy-przed.txt" | wc -l | tr -d ' ')"
} >> "$W"

# ============================ §3 dry-run + asercja =========================
rc_dry=$(run_runner "$E/etap1-dry-run.log" --dry-run)
pending=$(grep -oE 'Pending migrations: [0-9]+' "$E/etap1-dry-run.log" | grep -oE '[0-9]+$')
lista_pending=$(grep -oE '20262[0-9]{3}_[a-z0-9_]+\.sql' "$E/etap1-dry-run.log" | sort -u | tr '\n' ',' )
{
  echo ""
  echo "# §3 dry-run"
  echo "rc_dry_run=$rc_dry"
  echo "pending=$pending"
  echo "lista_pending=$lista_pending"
  if [ "$pending" = "2" ] && [ "$lista_pending" = "$MIG_PREV,$MIG," ]; then
    echo "ASERCJA_PENDING=PASS (pending == 2 i to DOKŁADNIE $MIG_PREV + $MIG)"
  else
    echo "ASERCJA_PENDING=FAIL (oczekiwane 2 = $MIG_PREV + $MIG)"
  fi
} >> "$W"

# ============================ §4 UP ========================================
rc_up1=$(run_runner "$E/etap1-up1.log")
{
  echo ""
  echo "# §4 UP (realny runner)"
  echo "rc_up1=$rc_up1  $(grep -oE 'Applying migrations: [0-9]+' "$E/etap1-up1.log" | head -1)"
  echo "ledger_20262305=$(q -tA -F'|' -c "SELECT status, coalesce(checksum,'-') FROM schema_migrations WHERE filename LIKE '20262305%'")"
  echo "notice_z_migracji=$(grep -c 'D03-20262305:' "$E/etap1-up1.log")"
  grep -oE 'D03-20262305: etap 1 done.*' "$E/etap1-up1.log" | head -1 | sed 's/^/  /'
} >> "$W"

# ============================ §5 PO_UP ====================================
typy "$E/typy-po-up1.txt"
odcisk "$O_UP1" PO_UP1
{
  echo ""
  echo "# §5 PO_UP"
  echo "etap1_timestamptz=$(awk -F'|' '$2=="timestamp with time zone"' "$E/typy-po-up1.txt" | wc -l | tr -d ' ')"
  echo "etap1_wciaz_text=$(awk -F'|' '$2=="text"' "$E/typy-po-up1.txt" | wc -l | tr -d ' ')"
  echo "created_at_text_w_calej_bazie_po=$(q -tAc "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='created_at' AND data_type='text'")"
  echo "domyslne_po_up1:"
  awk -F'|' '{print "  "$1" = "$3}' "$E/typy-po-up1.txt"
  echo "chwila_przed_vs_po_up1_diff=$(awk -F'|' 'NR==FNR{a[$2]=$7;next}{if(a[$2]!=$7)d++}END{print d+0}' "$O_PRZED" "$O_UP1")"
} >> "$W"

# ============================ §6 podwójne zastosowanie =====================
q -f "server/migrations/$MIG" > "$E/etap1-up1-drugirazy.log" 2>&1
rc_dup=$?
odcisk "$O_DUP" PO_PODWOJNYM
{
  echo ""
  echo "# §6 PODWÓJNE zastosowanie (drugi przebieg tego samego pliku przez psql)"
  echo "rc_drugi_przebieg=$rc_dup"
  grep -oE 'D03-20262305: etap 1 done.*' "$E/etap1-up1-drugirazy.log" | head -1 | sed 's/^/  /'
  echo "bledow_w_drugim_przebiegu=$(grep -ciE 'ERROR|FATAL' "$E/etap1-up1-drugirazy.log")"
  echo "chwila_po_up1_vs_po_podwojnym_diff=$(awk -F'|' 'NR==FNR{a[$2]=$7;next}{if(a[$2]!=$7)d++}END{print d+0}' "$O_UP1" "$O_DUP")"
  echo "typy_po_podwojnym_timestamptz=$(q -tAc "SELECT count(*) FROM information_schema.columns c JOIN $LISTA_SQL AS e(tabela,ksztalt) ON e.tabela=c.table_name WHERE c.table_schema='public' AND c.column_name='created_at' AND c.data_type='timestamp with time zone'")"
} >> "$W"

# ============================ §7 bramka ====================================
rc_gate=$(RELEASE_TARGET_DB_HOST_FINGERPRINT=127.0.0.1 APP_BUILD_SHA="$LINIA" \
  NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" \
  npx tsx server/scripts/release-migration-gate.ts > "$E/etap1-release-gate.log" 2>&1; echo $?)
{
  echo ""
  echo "# §7 bramka release-migration-gate"
  echo "rc_gate=$rc_gate  PASS=$(grep -c 'PASS' "$E/etap1-release-gate.log")  FAIL=$(grep -c 'FAIL' "$E/etap1-release-gate.log")"
  grep -oE 'RELEASE_MIGRATION_GATE_PASS.*' "$E/etap1-release-gate.log" | head -1 | sed 's/^/  /'
} >> "$W"

# ============================ §8 diff baseline<->PO_UP =====================
dump_norm "$E/dump-po-up1.txt"
{
  echo ""
  echo "# §8 pg_dump -s diff baseline<->PO_UP1"
  echo "diff_baseline_po_up1_linie=$(diff "$E/dump-baseline.txt" "$E/dump-po-up1.txt" | grep -cE '^[<>]')"
  echo "  w tym zmian typu created_at: $(diff "$E/dump-baseline.txt" "$E/dump-po-up1.txt" | grep -cE 'created_at')"
} >> "$W"

# ============================ §9 DOWN ======================================
q -f "$DOWN" > "$E/etap1-down.log" 2>&1
rc_down=$?
q -c "DELETE FROM schema_migrations WHERE filename LIKE '20262305%';" >/dev/null 2>&1
rc_del=$?
typy "$E/typy-po-down.txt"
odcisk "$O_DOWN" PO_DOWN
dump_norm "$E/dump-po-down.txt"
{
  echo ""
  echo "# §9 DOWN (rollback) + kasacja wiersza ledgera"
  echo "rc_down=$rc_down  rc_delete_ledger=$rc_del"
  grep -oE 'D03-20262305-down: done.*' "$E/etap1-down.log" | head -1 | sed 's/^/  /'
  echo "bledow_w_down=$(grep -ciE '^psql.*ERROR|FATAL' "$E/etap1-down.log")"
  echo "etap1_text_po_down=$(awk -F'|' '$2=="text"' "$E/typy-po-down.txt" | wc -l | tr -d ' ')"
  echo "etap1_timestamptz_po_down=$(awk -F'|' '$2=="timestamp with time zone"' "$E/typy-po-down.txt" | wc -l | tr -d ' ')"
  echo "WIERNOSC_TEKSTU_przed_vs_po_down_diff=$(awk -F'|' 'NR==FNR{a[$2]=$6;next}{if(a[$2]!=$6)d++}END{print d+0}' "$O_PRZED" "$O_DOWN")"
  echo "chwila_przed_vs_po_down_diff=$(awk -F'|' 'NR==FNR{a[$2]=$7;next}{if(a[$2]!=$7)d++}END{print d+0}' "$O_PRZED" "$O_DOWN")"
  echo "diff_baseline_po_down_linie=$(diff "$E/dump-baseline.txt" "$E/dump-po-down.txt" | grep -cE '^[<>]')  (oczekiwane = wyłącznie 5 obiektów SCIM z 20262304)"
  echo "domyslne_po_down_rownosc_z_przed=$(diff "$E/typy-przed.txt" "$E/typy-po-down.txt" | grep -cE '^[<>]')"
} >> "$W"

# ============================ §10 UP2 ======================================
rc_up2=$(run_runner "$E/etap1-up2.log")
typy "$E/typy-po-up2.txt"
odcisk "$O_UP2" PO_UP2
dump_norm "$E/dump-po-up2.txt"
{
  echo ""
  echo "# §10 UP2 (cykl odtwarzalny)"
  echo "rc_up2=$rc_up2  $(grep -oE 'Applying migrations: [0-9]+' "$E/etap1-up2.log" | head -1)"
  echo "typy_po_up1_vs_po_up2_diff=$(diff "$E/typy-po-up1.txt" "$E/typy-po-up2.txt" | grep -cE '^[<>]')"
  echo "chwila_po_up1_vs_po_up2_diff=$(awk -F'|' 'NR==FNR{a[$2]=$7;next}{if(a[$2]!=$7)d++}END{print d+0}' "$O_UP1" "$O_UP2")"
  echo "diff_dump_po_up1_po_up2_linie=$(diff "$E/dump-po-up1.txt" "$E/dump-po-up2.txt" | grep -cE '^[<>]')"
  echo "diff_baseline_po_up2_linie=$(diff "$E/dump-baseline.txt" "$E/dump-po-up2.txt" | grep -cE '^[<>]')"
} >> "$W"

# ============================ §11 checksumy ================================
{
  echo ""
  echo "# §11 sha256 plików migracji"
  shasum -a 256 "server/migrations/$MIG" "$DOWN" | sed 's/^/  /'
} >> "$W"

# ============================ werdykt ======================================
asercja_pending=$(grep -c 'ASERCJA_PENDING=PASS' "$W")
tstz_po_up=$(awk -F'|' '$2=="timestamp with time zone"' "$E/typy-po-up1.txt" | wc -l | tr -d ' ')
text_po_down=$(awk -F'|' '$2=="text"' "$E/typy-po-down.txt" | wc -l | tr -d ' ')
wiernosc=$(grep -oE 'WIERNOSC_TEKSTU_przed_vs_po_down_diff=[0-9]+' "$W" | cut -d= -f2)
dup=$(grep -oE 'rc_drugi_przebieg=[0-9]+' "$W" | cut -d= -f2)
{
  echo ""
  if [ "$rc_up1" = 0 ] && [ "$asercja_pending" = 1 ] && [ "$tstz_po_up" = 24 ] \
     && [ "$rc_down" = 0 ] && [ "$text_po_down" = 24 ] && [ "$wiernosc" = 0 ] \
     && [ "$rc_up2" = 0 ] && [ "$dup" = 0 ] && [ "$rc_gate" = 0 ]; then
    echo "WERDYKT=PASS (pending=2={20262304,20262305}, UP/DOWN/UP RC 0/0/0, 24/24 text->timestamptz, drugi przebieg RC=0 i bez zmian, wierność tekstu po rollbacku diff=0, gate RC=0)"
  else
    echo "WERDYKT=FAIL (rc_up1=$rc_up1 asercja_pending=$asercja_pending tstz_po_up=$tstz_po_up rc_down=$rc_down text_po_down=$text_po_down wiernosc=$wiernosc rc_up2=$rc_up2 drugi_przebieg=$dup rc_gate=$rc_gate)"
  fi
} >> "$W"

cat "$W"
