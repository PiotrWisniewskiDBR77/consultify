#!/usr/bin/env bash
# UI-CANON G4 — run the canon sweep for one or more surfaces against the
# already-running real stack (real Postgres, real signed-in session).
#
#   scripts/g4/run-sweep.sh CHAT MYW INT ...
#   scripts/g4/run-sweep.sh all
#
# Requires the harness servers to be up (see docs/program/evidence/closure/ui-g4/HARNESS.md).
set -euo pipefail
set -m

ACTIVE_CHILD_PID=""
ACTIVE_LOG=""

cleanup_active_child() {
  local exit_code="${1:-1}"
  trap - INT TERM EXIT
  if [ -n "${ACTIVE_CHILD_PID}" ] && kill -0 "${ACTIVE_CHILD_PID}" 2>/dev/null; then
    # Monitor mode gives the background Playwright command its own process
    # group. Stop the whole group so its backend/frontend children cannot be
    # orphaned and restarted by the next loop iteration.
    kill -TERM -- "-${ACTIVE_CHILD_PID}" 2>/dev/null || true
    wait "${ACTIVE_CHILD_PID}" 2>/dev/null || true
  fi
  if [ -n "${ACTIVE_LOG}" ] && [ -f "${ACTIVE_LOG}" ]; then
    tail -6 "${ACTIVE_LOG}" || true
    rm -f "${ACTIVE_LOG}"
  fi
  exit "${exit_code}"
}

trap 'cleanup_active_child 130' INT
trap 'cleanup_active_child 143' TERM

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
  ACTIVE_LOG="$(mktemp "${TMPDIR:-/tmp}/consultify-g4-${surface}.XXXXXX.log")"
  G4_SURFACE="${surface}" \
  E2E_USE_WEB_SERVER=true E2E_REUSE_SERVER=true E2E_BACKEND_RUNNER=tsx \
  E2E_MOCK_DB=false E2E_MODE=true \
  DATABASE_URL="${G4_DATABASE_URL}" \
  E2E_API_URL="${G4_API_URL}" E2E_BASE_URL="${G4_BASE_URL}" \
  ENABLE_V8_GLOBAL=true VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true \
  E2E_TMP_DIR="${G4_TMP_DIR}" CI=true \
  npx playwright test tests/e2e/ui-canon-g4/g4.spec.ts \
    --project=chromium --workers=1 --retries=0 --reporter=line \
    >"${ACTIVE_LOG}" 2>&1 &
  ACTIVE_CHILD_PID=$!

  child_status=0
  wait "${ACTIVE_CHILD_PID}" || child_status=$?
  ACTIVE_CHILD_PID=""
  tail -6 "${ACTIVE_LOG}"
  rm -f "${ACTIVE_LOG}"
  ACTIVE_LOG=""
  if [ "${child_status}" -ne 0 ]; then
    exit "${child_status}"
  fi
  echo
done

echo "=== done ==="
