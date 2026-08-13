#!/usr/bin/env bash
# Starts a real backend + dev-render on this agent's own ports (42801/42802),
# waits for /api/ready, runs drd-offline-real-true.spec.ts and
# drd-two-tabs-true.spec.ts sequentially against them, then tears both down.
# Own disposable Postgres: mac-pg-e2etrue (port 55540) — see
# tests/e2e/fixtures/offlineHarnessTrue.ts.
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO_ROOT="$(pwd)"
LOG_DIR="$REPO_ROOT/docs/qa/e2e-true-2026-08-13/offline-and-two-tabs/logs"
mkdir -p "$LOG_DIR"

export PORT=42801
export NODE_ENV=test
export RUN_DB_TESTS=1
export MOCK_DB=false
export DB_TYPE=postgres
export DATABASE_URL='postgresql://t:t@127.0.0.1:55540/t_test'
export ENABLE_TEST_AUTH_BYPASS=true
export METHOD_CORE_DEMO_BYPASS_PACK_READINESS=true
export DISABLE_CONNECTION_POOL=true
export DISABLE_SCHEDULER=true

echo "[e2etrue] starting backend on :42801 ..."
( cd server && npx tsx src/index.ts > "$LOG_DIR/server.log" 2>&1 & echo $! > "$LOG_DIR/server.pid" )
SERVER_PID=$(cat "$LOG_DIR/server.pid")
echo "[e2etrue] backend pid=$SERVER_PID"

echo "[e2etrue] starting dev-render on :42802 ..."
( DEV_RENDER_API_PROXY_TARGET=http://localhost:42801 npx vite dev-render --port 42802 --config dev-render/vite.config.ts --strictPort > "$LOG_DIR/dev-render.log" 2>&1 & echo $! > "$LOG_DIR/dev-render.pid" )
DEVRENDER_PID=$(cat "$LOG_DIR/dev-render.pid")
echo "[e2etrue] dev-render pid=$DEVRENDER_PID"

cleanup() {
  echo "[e2etrue] tearing down pid=$SERVER_PID (server) pid=$DEVRENDER_PID (dev-render)"
  kill -TERM "$SERVER_PID" 2>/dev/null || true
  kill -TERM "$DEVRENDER_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "[e2etrue] waiting for /api/ready (up to 280s) ..."
deadline=$((SECONDS + 280))
until curl -s -m 3 http://localhost:42801/api/ready 2>/dev/null | grep -q '"status":"ready"'; do
  if [ $SECONDS -ge $deadline ]; then
    echo "[e2etrue] backend never became ready — see $LOG_DIR/server.log"
    exit 1
  fi
  sleep 3
done
echo "[e2etrue] backend ready at $(date -u +%Y-%m-%dT%H:%M:%S.000Z)"

deadline=$((SECONDS + 60))
until curl -s -m 3 http://localhost:42802/drd-artifacts.html >/dev/null 2>&1; do
  if [ $SECONDS -ge $deadline ]; then
    echo "[e2etrue] dev-render never came up — see $LOG_DIR/dev-render.log"
    exit 1
  fi
  sleep 2
done
echo "[e2etrue] dev-render ready"

echo "[e2etrue] running drd-offline-real-true.spec.ts ..."
npx playwright test tests/e2e/drd-offline-real-true.spec.ts --project=chromium --reporter=line || true

echo "[e2etrue] running drd-two-tabs-true.spec.ts ..."
npx playwright test tests/e2e/drd-two-tabs-true.spec.ts --project=chromium --reporter=line || true

echo "[e2etrue] done."
