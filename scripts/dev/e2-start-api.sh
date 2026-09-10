#!/usr/bin/env bash
# E2 — lokalne API na kopii bazy consultify_kopia_e2 (nigdy na zywej bazie)
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a
while IFS= read -r linia; do
  case "$linia" in ''|'#'*) continue;; esac
  klucz="${linia%%=*}"
  wartosc="${linia#*=}"
  case "$klucz" in *[!A-Za-z0-9_]*) continue;; esac
  export "$klucz=$wartosc"
done < ~/Developer/consultify-secrets/server.env
set +a
unset DB_HOST DB_NAME DB_USER DB_PASSWORD DB_PORT DB_SSL DB_SSLMODE DISABLE_RATE_LIMIT NODE_ENV || true
export DB_TYPE=postgres
export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54418/consultify_kopia_e2"
export ENABLE_V8_GLOBAL=true
export DB_MANAGED_SCHEMA=off
export NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
export DISABLE_SCHEDULER=true DISABLE_AI_PROVIDER_SENTINEL=true DISABLE_AI_HEALTH_MONITOR=true DISABLE_STARTUP_HEALTH_MONITOR=true SKIP_STARTUP_VALIDATOR=true
export LOG_LEVEL=info
export PORT="${E2_PORT:-4222}"
export CAPABILITY_ENFORCE="${E2_CAPABILITY_ENFORCE:-shadow}"
exec npx tsx server/src/index.ts
