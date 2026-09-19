#!/usr/bin/env bash
# D-136 / DEC-685 — dowód mutacyjny testu RealPG scimMissingObjects.pg.test.ts
#
# REGUŁA 10: skrypt NIE zawiera hasła ani URL z sekretem — DATABASE_URL
# przekazuje środowisko (wywołanie w udu-logach).
#
# Mutacje (każda: zmień plik -> uruchom test -> przywróć -> porównaj sha256):
#   M1  usunięty obiekt: ALTER TABLE ... scim_last_sync_at   (logika)
#   M2  usunięty obiekt: CREATE INDEX idx_scim_conflicts_org (logika)
#   M3  usunięty obiekt: users.scim_external_id              (wpięcie: zapytanie trasy)
#   M4  usunięty DROP COLUMN scim_provisioned z .down.sql    (logika rollbacku)
set -u
cd "$(dirname "$0")/../.." || exit 9
ROOT="$PWD"
MIG="server/migrations/20262304_scim_missing_objects.sql"
DOWN="server/migrations/rollback/20262304_scim_missing_objects.down.sql"
TEST="server/src/routes/integrations/__tests__/scimMissingObjects.pg.test.ts"
EV="evidence/d136-scim-objects-20260919"
OUT="$EV/mutacje-wyniki.txt"
: "${DATABASE_URL:?DATABASE_URL musi wskazywać KOPIĘ dumpu na loopback}"

sha() { shasum -a 256 "$1" | awk '{print $1}'; }
MIG_SHA0="$(sha "$MIG")"
DOWN_SHA0="$(sha "$DOWN")"

run_test() {
  DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL="$DATABASE_URL" \
    npx vitest run "$TEST" --retry=0 2>&1
}

: > "$OUT"
{
  echo "D-136 dowód mutacyjny — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "test: $TEST"
  echo "sha256 migracji przed: $MIG_SHA0"
  echo "sha256 down przed:     $DOWN_SHA0"
  echo
} >> "$OUT"

mutate() {
  local nazwa="$1"; local plik="$2"; local wyrazenie="$3"; local sha_start="$4"
  cp "$plik" "/tmp/d136-mut.bak"
  perl -0pi -e "$wyrazenie" "$plik"
  local zmieniono
  if [ "$(sha "$plik")" = "$sha_start" ]; then zmieniono="NIE (mutacja nie chwyciła)"; else zmieniono="TAK"; fi
  {
    echo "=== $nazwa ==="
    echo "plik: $plik | zmieniony: $zmieniono"
  } >> "$OUT"
  local log rc
  run_test > /tmp/d136-mut.raw 2>&1
  rc=$?
  log="$(sed -e 's/\x1b\[[0-9;]*[mGK]//g' /tmp/d136-mut.raw)"
  echo "$log" > "/tmp/d136-mut.log"
  {
    echo "RC=$rc"
    echo "$log" | grep -E '^[[:space:]]*(✓|×|↓)[[:space:]]' | sed -E 's#^.*/__tests__/##; s/^/  /'
    echo "$log" | grep -E 'Test Files|^[[:space:]]*Tests[[:space:]]' | sed 's/^/  /'
    echo "$log" | grep -E 'AssertionError|expected .* to ' | head -4 | sed 's/^/  blad: /'
    echo
  } >> "$OUT"
  cp "/tmp/d136-mut.bak" "$plik"
  local sha_po
  sha_po="$(sha "$plik")"
  if [ "$sha_po" != "$sha_start" ]; then echo "KRYTYCZNE: plik nie wrócił do baseline ($plik)" >> "$OUT"; exit 8; fi
  echo "przywrócono: sha256 zgodny z baseline" >> "$OUT"
  echo >> "$OUT"
}

mutate "M1 — bez users.scim_last_sync_at" "$MIG" \
  's/^ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_last_sync_at TIMESTAMPTZ;\n//m' "$MIG_SHA0"

mutate "M2 — bez idx_scim_conflicts_org" "$MIG" \
  's/^CREATE INDEX IF NOT EXISTS idx_scim_conflicts_org\n    ON scim_conflict_log \(organization_id\);\n//m' "$MIG_SHA0"

mutate "M3 — bez users.scim_external_id (wpięcie: zapytanie trasy SCIM)" "$MIG" \
  's/^ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_external_id TEXT;\n//m' "$MIG_SHA0"

mutate "M4 — down bez DROP COLUMN scim_provisioned" "$DOWN" \
  's/^ALTER TABLE users DROP COLUMN IF EXISTS scim_provisioned;\n//m' "$DOWN_SHA0"

# Stan końcowy: pliki bazowe + pełny przebieg GREEN na niezmienionej migracji.
{
  echo "=== PRZEBIEG KOŃCOWY (pliki bazowe, bez mutacji) ==="
  echo "sha256 migracji: $(sha "$MIG")"
  echo "sha256 down:     $(sha "$DOWN")"
} >> "$OUT"
run_test > /tmp/d136-mut.raw 2>&1; rc=$?
sed -e 's/\x1b\[[0-9;]*[mGK]//g' /tmp/d136-mut.raw > /tmp/d136-mut.log
{
  grep -E '^[[:space:]]*(✓|×)[[:space:]]' /tmp/d136-mut.log | sed -E 's#^.*/__tests__/##; s/^/  /'
  grep -E 'Test Files|^[[:space:]]*Tests[[:space:]]' /tmp/d136-mut.log | sed 's/^/  /'
} >> "$OUT"
echo "RC=$rc" >> "$OUT"
echo "WERSJA_KONCOWA_RC=$rc" >> "$OUT"
exit 0
