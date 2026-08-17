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

terminate_process_tree() {
  local root_pid="${1:-}"
  [ -n "${root_pid}" ] || return 0
  local child_pid
  # Playwright's webServer runners may create their own process groups. Walk
  # the parent/child tree leaf-first before terminating the Playwright parent;
  # otherwise those runners are re-parented to launchd and survive the sweep.
  while read -r child_pid; do
    [ -n "${child_pid}" ] || continue
    terminate_process_tree "${child_pid}"
  done < <(pgrep -P "${root_pid}" 2>/dev/null || true)
  kill -TERM "${root_pid}" 2>/dev/null || true
}

cleanup_active_child() {
  local exit_code="${1:-1}"
  trap - INT TERM EXIT
  if [ -n "${ACTIVE_CHILD_PID}" ] && kill -0 "${ACTIVE_CHILD_PID}" 2>/dev/null; then
    terminate_process_tree "${ACTIVE_CHILD_PID}"
    # Monitor mode gives the background Playwright command its own process
    # group. Keep the group kill as a second guard for same-group processes
    # that disappeared from the parent tree during shutdown.
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
: "${G4_E2E_MODE:=false}"

for surface in "${SURFACES[@]}"; do
  echo "=== G4 sweep: ${surface} ==="
  ACTIVE_LOG="$(mktemp "${TMPDIR:-/tmp}/consultify-g4-${surface}.XXXXXX.log")"
  G4_SURFACE="${surface}" \
  E2E_USE_WEB_SERVER=true E2E_REUSE_SERVER=true E2E_BACKEND_RUNNER=tsx \
  E2E_MOCK_DB=false E2E_MODE="${G4_E2E_MODE}" \
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
