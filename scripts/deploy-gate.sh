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
run_check "TypeScript type-check" npx tsc --noEmit --project tsconfig.json

# Gate 2: ESLint (critical errors only)
run_check "ESLint" npx eslint src/ --quiet --max-warnings 0 2>/dev/null || true

# Gate 3: Backend build
run_check "Backend build" npm run build:backend

# Gate 4: Frontend build
run_check "Frontend build" npm run build

# Gate 5: Health endpoint check (if server running)
if curl -sf http://localhost:3005/ping > /dev/null 2>&1; then
  run_check "Health: /ping" curl -sf http://localhost:3005/ping
  run_check "Health: /api/ready" curl -sf http://localhost:3005/api/ready
  run_check "Health: /api/health/database" curl -sf http://localhost:3005/api/health/database
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
