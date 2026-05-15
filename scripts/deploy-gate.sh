#!/usr/bin/env bash
# Deploy Gate (T107)
# Runs quality checks before deployment.
# Exit code 0 = pass, non-zero = fail (blocks deploy).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=========================================="
echo "  DEPLOY GATE — Quality Checks"
echo "=========================================="
echo ""

PASS=0
FAIL=0
HEALTH_BASE_URL="${DEPLOY_GATE_HEALTH_BASE_URL:-http://localhost:3001}"

run_check() {
  local name="$1"
  shift
  echo "▶ $name..."
  if "$@" > /dev/null 2>&1; then
    echo "  ✓ PASS"
    PASS=$((PASS + 1))
  else
    echo "  ✗ FAIL"
    FAIL=$((FAIL + 1))
  fi
}

# Gate 1: TypeScript type-check
# Use the validated project config with increased heap to avoid Node OOM while
# preserving the same inclusion scope as the explicit green `tsc --project` run.
run_check "TypeScript type-check" node --max-old-space-size=8192 ./node_modules/.bin/tsc --noEmit --project tsconfig.json

# Gate 2: ESLint (critical errors only)
# Quiet mode reports only errors, while legacy warnings are tracked separately
# and should not block production release readiness.
run_check "ESLint" npx eslint src/ --quiet 2>/dev/null || true

# Gate 3: Backend build
run_check "Backend build" npm run build:backend

# Gate 4: Frontend build
run_check "Frontend build" npm run build

# Gate 5: Data truth release gate
run_check "Data truth release gate" npm run release:gate:data-truth

# Gate 6: Health endpoint check (if server running)
if curl -sf "${HEALTH_BASE_URL}/api/health/ping" > /dev/null 2>&1; then
  run_check "Health: /api/health/ping" curl -sf "${HEALTH_BASE_URL}/api/health/ping"
  run_check "Health: /api/health/ready" curl -sf "${HEALTH_BASE_URL}/api/health/ready"
  run_check "Health: /api/health/database" curl -sf "${HEALTH_BASE_URL}/api/health/database"
else
  echo "▶ Health checks: SKIP (server not running)"
fi

echo ""
echo "=========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  echo "  ⛔ DEPLOY BLOCKED — fix failures above"
  exit 1
else
  echo "  ✅ DEPLOY GATE PASSED"
  exit 0
fi
