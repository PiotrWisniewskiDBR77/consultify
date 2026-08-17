#!/usr/bin/env bash
# UI-CANON G4 — run the canon sweep for one or more surfaces against the
# already-running real stack (real Postgres, real signed-in session).
#
#   scripts/g4/run-sweep.sh CHAT MYW INT ...
#   scripts/g4/run-sweep.sh all
#
# Requires the harness servers to be up (see docs/program/evidence/closure/ui-g4/HARNESS.md).
set -uo pipefail

ALL_SURFACES=(CHAT MYW INT TLS ASM INI EXE RES FIN MAT MTG ORG ADM SET PRT)

if [ "${1:-}" = "all" ] || [ $# -eq 0 ]; then
  SURFACES=("${ALL_SURFACES[@]}")
else
  SURFACES=("$@")
fi

: "${G4_API_URL:=http://127.0.0.1:3941}"
: "${G4_BASE_URL:=http://127.0.0.1:3940}"
: "${G4_DATABASE_URL:=postgresql://consultinity:consultinity@127.0.0.1:34940/consultinity}"
: "${G4_TMP_DIR:=/tmp/e2euig4}"

for surface in "${SURFACES[@]}"; do
  echo "=== G4 sweep: ${surface} ==="
  G4_SURFACE="${surface}" \
  E2E_USE_WEB_SERVER=true E2E_REUSE_SERVER=true E2E_BACKEND_RUNNER=tsx \
  E2E_MOCK_DB=false E2E_MODE=true \
  DATABASE_URL="${G4_DATABASE_URL}" \
  E2E_API_URL="${G4_API_URL}" E2E_BASE_URL="${G4_BASE_URL}" \
  ENABLE_V8_GLOBAL=true VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true \
  E2E_TMP_DIR="${G4_TMP_DIR}" CI=true \
  npx playwright test tests/e2e/ui-canon-g4/g4.spec.ts \
    --project=chromium --workers=1 --retries=0 --reporter=line 2>&1 \
    | tail -6
  echo
done

echo "=== done ==="
