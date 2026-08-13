#!/usr/bin/env bash
# ASM-IE browser E2E verification (Assessment module, DRD+SIRI). Real Express
# server (production Gateway, NOT the test gateway), real Postgres schema
# (consultify_asm_ie on 127.0.0.1:5439), real HTTP routes. No NODE_ENV=test
# (that flips DB to mock in this repo), no ENABLE_TEST_GATEWAY, no supertest.
# Data must come from UI-driven POSTs.
#
# CI=true (not NODE_ENV=test) is the legitimate escape hatch in
# server/src/config/databaseTargetResolver.ts allowLocalDatabaseForTests()
# that permits a local 127.0.0.1 DATABASE_URL outside of Railway/production.
set -euo pipefail
cd "$(dirname "$0")/../../server"
export CI=true
export NODE_ENV=development
export PORT=3401
export DB_TYPE=postgres
export MOCK_DB=false
export DATABASE_URL="postgresql://${USER}@127.0.0.1:5439/consultify_asm_ie"
export SKIP_MIGRATIONS=1
export AI_PROVIDER_MODE=mock
export DEV_RESTART_ON_SHUTDOWN=true
export LOG_LEVEL=info
export AI_LOG_LEVEL=info
export DB_POOL_SIZE=10
export ENABLE_V8_GLOBAL=true
export DISABLE_SCHEDULER=true
export DISABLE_AI_PROVIDER_SENTINEL=true
export DISABLE_AI_HEALTH_MONITOR=true
export DISABLE_STARTUP_HEALTH_MONITOR=true
export SKIP_STARTUP_VALIDATOR=true
export DEFER_LLM_CONFIG_INIT_MS=3000
export JWT_SECRET="${JWT_SECRET:-asm-ie-browser-e2e-dummy-secret-not-prod-32ch}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-asm-ie-browser-e2e-refresh-secret-32ch-min}"
export SESSION_SECRET="${SESSION_SECRET:-asm-ie-browser-e2e-session-secret-32ch-min}"
echo "[asm-ie-e2e-backend] starting real server on PORT=$PORT DATABASE_URL=$DATABASE_URL"
exec npx tsx src/index.ts
