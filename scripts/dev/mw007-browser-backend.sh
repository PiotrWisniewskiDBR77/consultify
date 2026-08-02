#!/usr/bin/env bash
# MW-07 browser-acceptance verification only. Real Express server, real
# routing/auth middleware, pointed at a throwaway local Postgres container
# (torn down after verification) instead of the shared staging DB that
# `npm run dev` normally requires — `dev:localdb`/`dev:pg` are hard-disabled
# by scripts/dev/reject-local-db.mjs for day-to-day development, and this is
# a one-off local golden-flow acceptance check, not a dev workflow change.
# NODE_ENV=test / E2E_MODE=true are the SAME env contract already used by
# every real-PG test in tests/integration/ (see
# tests/integration/mw-007-calendar-reschedule.golden-flow.realdb.test.ts) —
# not a bypass invented for this check.
set -euo pipefail
cd "$(dirname "$0")/../../server"
export PORT=3001
export DB_TYPE=postgres
export NODE_ENV=test
export E2E_MODE=true
# NODE_ENV=test skips mounting the real production Gateway.ts (server/src/
# index.ts's `isTest && ENABLE_TEST_GATEWAY !== 'true'` branch) in favor of a
# minimal management-reports-only stub, by design, to keep automated test
# suites fast. Browser acceptance needs the REAL Gateway (all routes,
# real routing) mounted, so this must be explicitly opted back in.
export ENABLE_TEST_GATEWAY=true
export ENABLE_V8_GLOBAL=true
export MOCK_DB=false
export RUN_DB_TESTS=1
export DATABASE_URL="${MW007_DATABASE_URL:-postgres://iris:iris_test@localhost:5456/iris_test}"
export JWT_SECRET="${JWT_SECRET:-mw007-browser-acceptance-dummy-secret}"
export DEV_RESTART_ON_SHUTDOWN=true
export LOG_LEVEL=info
export DISABLE_SCHEDULER=true
export DISABLE_AI_PROVIDER_SENTINEL=true
export DISABLE_AI_HEALTH_MONITOR=true
export DISABLE_STARTUP_HEALTH_MONITOR=true
export SKIP_STARTUP_VALIDATOR=true
export DEFER_LLM_CONFIG_INIT_MS=3000
exec npx tsx src/index.ts
