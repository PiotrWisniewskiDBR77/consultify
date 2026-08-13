#!/usr/bin/env bash
# =============================================================================
# Finance v3 — JEDEN PEŁNY PRZEBIEG NA JEDNYM SHA
#
# Cel: zdjąć systemowe EVIDENCE_MISSING z reguły §18 "candidate SHA".
# §18: program jest zakończony wyłącznie wtedy, gdy wszystkie punkty mają PASS
# NA TYM SAMYM candidate SHA. Zebrano dotąd 24+ różnych SHA; 15 z 22 raportów
# CLOSEOUT/ROI nie podaje SHA w ogóle. Ten skrypt produkuje jeden przebieg,
# jeden SHA, jedna konfiguracja, surowe logi.
#
# Protokół z ROI_E007_ROUND1_INTEGRATION_RELEASE_HANDOFF.md §4 (8 wierszy).
#
# UWAGA — zakres uczciwy: ten przebieg pokrywa WARSTWY 1-3 protokołu §16A
# (statyczna/kontraktowa, finansowa/known-answer, RealDB/API/jobs).
# WARSTWA 4 (Playwright browser E2E) i WARSTWA 5 (manualny odbiór ekspercki:
# CFO + QA/UX + design-system) są NIEOSIĄGALNE bez warstwy UI i bez
# zewnętrznego recenzenta. To nie jest luka tego skryptu — to stan programu.
# Nie meldować "pełny odbiór", meldować "warstwy 1-3 na jednym SHA".
#
# Użycie:  bash single_sha_evidence_run.sh <PORT> <TAG>
# Przykład: bash single_sha_evidence_run.sh 57661 fanin
# =============================================================================
set -uo pipefail

PORT="${1:?podaj PORT}"
TAG="${2:?podaj TAG}"

REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"

OUT="$REPO/docs/validation/finance-v3/generated/gate-d/_evidence_run_${TAG}"
RAW="$OUT/raw"
# UWAGA: katalog wyjściowy tworzymy DOPIERO po bramce czystości drzewa (§0) —
# inaczej skrypt sam sobie brudzi drzewo i przerywa na własnym artefakcie.

PGBIN=/opt/homebrew/opt/postgresql@15/bin      # @15, NIE @16 (@16 bez pgvector)
PGDATA="/private/tmp/fv3-evidence-${TAG}-pgdata" # NIE w scratchpadzie sesji!
PGSOCK="/tmp/fv3ev${TAG}sock"
SUMMARY="$OUT/SUMMARY.txt"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$SUMMARY"; }

# --- 0. BRAMKA: drzewo musi być czyste, inaczej "jeden SHA" jest fikcją ------
DIRTY="$(git status --porcelain | wc -l | tr -d ' ')"
SHA="$(git rev-parse HEAD)"
SHA_SHORT="$(git rev-parse --short=10 HEAD)"
BRANCH="$(git branch --show-current)"

: > /dev/null
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "${SUMMARY:-/dev/null}" 2>/dev/null || echo "[$(date +%H:%M:%S)] $*"; }
log "=========================================================="
log "CANDIDATE SHA : $SHA"
log "  (short)     : $SHA_SHORT"
log "gałąź         : $BRANCH"
log "worktree      : $REPO"
log "niescommitowanych plików: $DIRTY"
log "=========================================================="

if [ "$DIRTY" != "0" ]; then
  log "!! PRZERWANE: drzewo brudne ($DIRTY plików). 'Jeden candidate SHA' wymaga"
  log "!! czystego drzewa — inaczej mierzysz coś, czego nie ma w żadnym commicie."
  git status --porcelain | tee "$RAW/00_dirty.txt"
  exit 2
fi

mkdir -p "$RAW"
git rev-parse HEAD > "$OUT/CANDIDATE_SHA.txt"

# --- 1. Świeży, efemeryczny klaster PostgreSQL 15 ----------------------------
if lsof -i:"$PORT" >/dev/null 2>&1; then
  log "!! PRZERWANE: port $PORT zajęty. Wybierz inny."
  exit 2
fi

log ""
log "--- [1/9] Stawiam efemeryczny klaster PG15 na porcie $PORT ---"
rm -rf "$PGDATA" "$PGSOCK"; mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C "$PGBIN/initdb" -D "$PGDATA" -U postgres -E UTF8 --locale=C \
  > "$RAW/01_initdb.log" 2>&1 || { log "!! initdb padł"; tail -20 "$RAW/01_initdb.log"; exit 2; }
LC_ALL=C "$PGBIN/pg_ctl" -D "$PGDATA" \
  -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" \
  -l "$RAW/01_pg.log" start > "$RAW/01_pgctl.log" 2>&1 \
  || { log "!! pg_ctl padł"; tail -20 "$RAW/01_pg.log"; exit 2; }

cleanup() {
  log ""
  log "--- Sprzątanie klastra ---"
  "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1
  rm -rf "$PGDATA" "$PGSOCK"
  log "Klaster usunięty."
}
trap cleanup EXIT

for db in ev_fresh ev_tests; do
  "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -c "CREATE DATABASE $db;" \
    >> "$RAW/01_createdb.log" 2>&1
done
log "Klaster gotowy (PG $("$PGBIN/postgres" --version | awk '{print $3}'))."

DB_FRESH="postgresql://postgres@127.0.0.1:$PORT/ev_fresh"
DB_TESTS="postgresql://postgres@127.0.0.1:$PORT/ev_tests"

# --- Pomocnik: uruchom krok, zapisz surowy log, wyciągnij podsumowanie -------
STATUS_LINES=()
step() {
  local id="$1" name="$2" logf="$RAW/$1.log"; shift 2
  log ""
  log "--- [$id] $name ---"
  ( eval "$@" ) > "$logf" 2>&1
  local rc=$?
  local files tests
  files="$(grep -E '^ *Test Files' "$logf" | tail -1 | sed 's/^ *//')"
  tests="$(grep -E '^ *Tests ' "$logf" | tail -1 | sed 's/^ *//')"
  log "exit=$rc"
  [ -n "$files" ] && log "  $files"
  [ -n "$tests" ] && log "  $tests"
  STATUS_LINES+=("$id | $name | exit=$rc | ${files:-–} | ${tests:-–}")
  return $rc
}

# --- 2. Migracje STRICT na świeżej bazie (bez --safe!) ----------------------
# --safe zamienia padniętą migrację w 'skipped' + exit 0 i ukrywa awarię.
step 02 "Migracje STRICT, świeża baza" \
  "DB_TYPE=postgres NODE_ENV=test DATABASE_URL='$DB_FRESH' npx tsx server/scripts/migrate.postgres.ts"
MIG_RC=$?
grep -E 'applied|success|failed|skipped' "$RAW/02.log" | tail -6 | tee -a "$SUMMARY"

# Ile tabel faktycznie powstało — liczba, nie deklaracja
"$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d ev_fresh -t -c \
  "SELECT table_schema, count(*) FROM information_schema.tables
   WHERE table_schema IN ('public','v8') GROUP BY 1 ORDER BY 1;" \
  > "$RAW/02_tables.txt" 2>&1
log "Tabele (information_schema, nie schema_migrations):"
sed 's/^/    /' "$RAW/02_tables.txt" | tee -a "$SUMMARY"

# Migracje na drugą bazę — pod pakiety testowe
DB_TYPE=postgres NODE_ENV=test DATABASE_URL="$DB_TESTS" \
  npx tsx server/scripts/migrate.postgres.ts > "$RAW/02b_tests_db.log" 2>&1
log "Baza testowa zmigrowana: exit=$?"

GATE="RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres DATABASE_URL='$DB_TESTS'"

# --- 3. Finance (z katalogu server/) ----------------------------------------
step 03 "Finance — src/services/finance" \
  "cd server && $GATE npx vitest run src/services/finance --no-file-parallelism"

# --- 3b. KONTROLA NEGATYWNA bramki DB ---------------------------------------
# Bez RUN_DB_TESTS/MOCK_DB/DATABASE_URL pakiet MUSI dać skipped, nigdy passed.
# To dowodzi, że zieleń z kroku 3 pochodzi z realnej bazy, a nie z atrapy.
step 03b "KONTROLA NEGATYWNA — Finance bez bramki (ma być skipped)" \
  "cd server && NODE_ENV=test npx vitest run src/services/finance --no-file-parallelism"

# --- 4. canonical + W9/W10 (rdzeń Finance v3) -------------------------------
step 04 "canonical — src/services/finance/canonical" \
  "cd server && $GATE npx vitest run --config vitest.config.ts src/services/finance/canonical --no-file-parallelism"

# --- 5. ROI (z KORZENIA repo — inny katalog niż Finance!) -------------------
step 05 "ROI — tests/resultsVnext/roi" \
  "$GATE npx vitest run tests/resultsVnext/roi --no-file-parallelism"

# --- 6. Results vNext całość (z korzenia) ----------------------------------
step 06 "Results vNext — tests/resultsVnext" \
  "$GATE npx vitest run tests/resultsVnext --no-file-parallelism"

# --- 7. Backend tsc ---------------------------------------------------------
step 07 "Backend tsc (server/tsconfig.json)" \
  "npx tsc --noEmit -p server/tsconfig.json"
log "  linii wyjścia tsc: $(wc -l < "$RAW/07.log" | tr -d ' ') (oczekiwane 0)"

# --- 8. Typy plików testowych (tsconfig ich WYKLUCZA — mierzymy osobno) -----
# server/tsconfig.json wyklucza **/*.test.ts, a vitest używa esbuilda,
# który nie sprawdza typów → pliki testowe nie są typecheckowane przez NIC.
# UWAGA — dwie pułapki, obie zaliczone przy pierwszym przebiegu:
# 1. bez `rootDir: "."` dziedziczy się `rootDir: server` -> 2274x TS6059,
#    czysty artefakt konfiguracji udający regresję;
# 2. bez `--max-old-space-size` tsc pada z exit 134 (SIGABRT/OOM) i przy
#    zerze błędów WYGLĄDA na sukces. Zawsze sprawdzaj kod wyjścia.
# 3. ta konfiguracja NIE ładuje globali vitest, więc wynik NIE jest
#    porównywalny z zakresowanymi pomiarami per-pakiet. Traktuj jako
#    orientacyjny licznik, nie jako bramkę.
cat > /tmp/tsconfig.evidence.$TAG.json <<'JSON'
{
  "extends": "./server/tsconfig.json",
  "compilerOptions": { "rootDir": ".", "noEmit": true },
  "include": ["server/src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
JSON
cp /tmp/tsconfig.evidence.$TAG.json "$REPO/tsconfig.evidence.$TAG.json"
step 08 "Typy plików TESTOWYCH (pomiar orientacyjny, NIE bramka, NIE porównywalny)" \
  "NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit -p tsconfig.evidence.$TAG.json"
TESTTYPE_ERRS=$(grep -cE 'error TS' "$RAW/08.log" 2>/dev/null || echo 0)
TESTTYPE_FILES=$(grep -oE '^[^(]+\(' "$RAW/08.log" 2>/dev/null | sort -u | wc -l | tr -d ' ')
log "  błędów typów w plikach testowych: $TESTTYPE_ERRS w $TESTTYPE_FILES plikach"
log "  (punkt odniesienia na starcie fali: 353 błędów w 97 plikach)"
rm -f "$REPO/tsconfig.evidence.$TAG.json"

# --- 9. Podsumowanie --------------------------------------------------------
log ""
log "=========================================================="
log "PODSUMOWANIE — WSZYSTKO NA SHA $SHA_SHORT"
log "=========================================================="
for l in "${STATUS_LINES[@]}"; do log "$l"; done
log ""
log "Surowe logi: $RAW"
log ""
log "ZAKRES: warstwy 1-3 protokołu §16A."
log "Warstwa 4 (Playwright E2E) i 5 (odbiór CFO/QA/design) — NIEOSIĄGALNE:"
log "brak warstwy UI, brak zewnętrznego recenzenta. To stan programu, nie luka skryptu."
log "Bramki FC-09, FC-10, FC-12 pozostają BLOCKED niezależnie od tego przebiegu."
