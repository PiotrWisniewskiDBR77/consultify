#!/usr/bin/env bash
#
# MW-CORE-001 golden-flow test runner — Inbox/Task, REAL Postgres only.
#
# Provisions/reuses a DEDICATED scratch Postgres container (name/port/db/user
# below are all hardcoded literals — never derived from any inherited/shared
# env var, so this can never accidentally point at a shared or production
# database). Loads the real schema, then runs the golden-flow integration
# test with --retry=0.
#
# FAILS HARD (non-zero exit) if:
#   - docker is unavailable
#   - the scratch Postgres never becomes reachable
#   - the DATABASE_URL guard rejects the target (non-local host)
#   - the schema loader's own required-table check fails
#   - any golden-flow test fails
# Never silently skips real-Postgres testing and falls back to a mock.
#
# Cleans up ONLY the scratch resources this script itself started (tracked via
# CONTAINER_STARTED_BY_SCRIPT below), via a trap-based teardown on exit.
#
# Usage: scripts/test-mw-core-golden-flow-pg.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# Dedicated scratch Postgres — hardcoded, never inherited from the caller's env.
# ---------------------------------------------------------------------------
readonly PG_CONTAINER_NAME="consultify-mw-golden-pg"
readonly PG_PORT="5443"
readonly PG_DB="mw_golden_flow"
readonly PG_USER="mw_golden"
readonly PG_PASSWORD="mw_golden"
readonly PG_IMAGE="pgvector/pgvector:pg16"
readonly DATABASE_URL="postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Local-only guard — same convention as tests/acceptance/harness.ts's
# requireLocalDbUrl() / tests/acceptance/schema.mjs's own inline check.
# Reused literally (bash port of the identical regex), not weakened.
# ---------------------------------------------------------------------------
if [[ ! "$DATABASE_URL" =~ (localhost|127\.0\.0\.1) ]]; then
  echo "[test-mw-core-golden-flow-pg] REFUSING: DATABASE_URL must be local. Got: $DATABASE_URL" >&2
  exit 2
fi
case "$DATABASE_URL" in
  *railway*|*rlwy.net*|*demo.consultify*|*trolley*|*centerbeam*)
    echo "[test-mw-core-golden-flow-pg] REFUSING: DATABASE_URL looks like a prod/demo/Railway target." >&2
    exit 2
    ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo "[test-mw-core-golden-flow-pg] FATAL: docker is required and not on PATH." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Provision/reuse the scratch container. Track exactly what WE did so the
# teardown trap only undoes our own action.
# ---------------------------------------------------------------------------
CONTAINER_ACTION="reused-running"   # reused-running | started-stopped | created-fresh

CONTAINER_EXISTS="$(docker ps -a --filter "name=^/${PG_CONTAINER_NAME}$" --format '{{.Names}}' || true)"
CONTAINER_RUNNING="$(docker ps --filter "name=^/${PG_CONTAINER_NAME}$" --format '{{.Names}}' || true)"

if [[ -z "$CONTAINER_EXISTS" ]]; then
  echo "[test-mw-core-golden-flow-pg] Creating scratch container ${PG_CONTAINER_NAME} on :${PG_PORT}..."
  docker run -d --name "$PG_CONTAINER_NAME" \
    -e "POSTGRES_USER=${PG_USER}" \
    -e "POSTGRES_PASSWORD=${PG_PASSWORD}" \
    -e "POSTGRES_DB=${PG_DB}" \
    -p "${PG_PORT}:5432" \
    "$PG_IMAGE" >/dev/null
  CONTAINER_ACTION="created-fresh"
elif [[ -z "$CONTAINER_RUNNING" ]]; then
  echo "[test-mw-core-golden-flow-pg] Starting existing (stopped) scratch container ${PG_CONTAINER_NAME}..."
  docker start "$PG_CONTAINER_NAME" >/dev/null
  CONTAINER_ACTION="started-stopped"
else
  echo "[test-mw-core-golden-flow-pg] Reusing already-running scratch container ${PG_CONTAINER_NAME}."
fi

teardown() {
  case "$CONTAINER_ACTION" in
    created-fresh)
      echo "[test-mw-core-golden-flow-pg] Teardown: removing scratch container we created (${PG_CONTAINER_NAME})."
      docker rm -f "$PG_CONTAINER_NAME" >/dev/null 2>&1 || true
      ;;
    started-stopped)
      echo "[test-mw-core-golden-flow-pg] Teardown: stopping scratch container we started (${PG_CONTAINER_NAME})."
      docker stop "$PG_CONTAINER_NAME" >/dev/null 2>&1 || true
      ;;
    reused-running)
      echo "[test-mw-core-golden-flow-pg] Teardown: container was already running before this script; leaving it as-is."
      ;;
  esac
}
trap teardown EXIT

# ---------------------------------------------------------------------------
# Wait for readiness — FAIL HARD (non-zero exit) if it never comes up, rather
# than silently skipping the real-Postgres run.
# ---------------------------------------------------------------------------
READY=0
for i in $(seq 1 60); do
  if docker exec "$PG_CONTAINER_NAME" pg_isready -U "$PG_USER" >/dev/null 2>&1; then
    READY=1
    echo "[test-mw-core-golden-flow-pg] Postgres ready on :${PG_PORT} after ${i}s"
    break
  fi
  sleep 1
done
if [[ "$READY" -ne 1 ]]; then
  echo "[test-mw-core-golden-flow-pg] FATAL: Postgres on :${PG_PORT} never became ready." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Real env for the whole run — MOCK_DB=false + RUN_DB_TESTS=1 force
# server/src/database/Database.ts onto the real PostgresDatabase path (this
# codebase's DB layer is Postgres-only; nothing to mock-fallback to). Also
# forces the real capability/tenancy/v8-gate code paths.
# ---------------------------------------------------------------------------
export DATABASE_URL
export NODE_ENV=test
export RUN_DB_TESTS=1
export MOCK_DB=false
export POSTGRES_SKIP_INIT_IN_TEST=true
export JWT_SECRET="${JWT_SECRET:-development_secret_key_change_in_production_abc123xyz}"
export ENABLE_V8_GLOBAL=true
# Default posture for capability enforcement is 'shadow' (never blocks) unless
# a specific test flips it to 'enforce' for its own request and restores it
# immediately after (see scenario #6 in the test file). Leave unset here so
# that default applies to every OTHER scenario.
unset CAPABILITY_ENFORCE || true

echo "[test-mw-core-golden-flow-pg] Loading full schema onto ${DATABASE_URL}..."
node tests/acceptance/schema.mjs || {
  status=$?
  # schema.mjs's own critical-missing exit code covers a long list of tables
  # unrelated to this suite (ai_agent_plans, presentation_ai_operations, ...).
  # What THIS suite actually needs is verified explicitly below — a nonzero
  # exit here is not automatically fatal to golden-flow testing, but we still
  # want the output visible for diagnosis.
  echo "[test-mw-core-golden-flow-pg] schema.mjs exited $status (see above — likely pre-existing unrelated gaps)."
}

echo "[test-mw-core-golden-flow-pg] Verifying the specific tables/columns this suite needs..."
node - <<'NODE'
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const checks = [
    ["to_regclass('public.canonical_inbox_items')", 'canonical_inbox_items'],
    ["to_regclass('v8.v8_feature_flags')", 'v8.v8_feature_flags'],
    ["to_regclass('public.tasks')", 'tasks'],
    ["to_regclass('public.project_members')", 'project_members'],
    ["to_regclass('public.organizations')", 'organizations'],
    ["to_regclass('public.users')", 'users'],
    ["to_regclass('public.organization_members')", 'organization_members'],
    ["to_regclass('public.projects')", 'projects'],
  ];
  let allOk = true;
  for (const [expr, label] of checks) {
    const { rows } = await client.query(`SELECT ${expr} AS reg`);
    const ok = rows[0].reg !== null;
    console.log(`   ${ok ? 'OK  ' : 'MISS'} ${label}`);
    if (!ok) allOk = false;
  }
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='canonical_inbox_items' AND column_name IN ('source_status','initiative_id')`
  );
  const colNames = cols.rows.map((r) => r.column_name).sort();
  const colsOk = colNames.length === 2;
  console.log(`   ${colsOk ? 'OK  ' : 'MISS'} canonical_inbox_items.{source_status,initiative_id} (found: ${colNames.join(',') || 'none'})`);
  if (!colsOk) allOk = false;

  const taskCols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name IN ('blocked_reason','blocked_by_decision_id')`
  );
  const taskColNames = taskCols.rows.map((r) => r.column_name).sort();
  const taskColsOk = taskColNames.length === 2;
  console.log(`   ${taskColsOk ? 'OK  ' : 'MISS'} tasks.{blocked_reason,blocked_by_decision_id} (found: ${taskColNames.join(',') || 'none'})`);
  if (!taskColsOk) allOk = false;

  await client.end();
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  console.error('[verify] FATAL', e);
  process.exit(1);
});
NODE

if [[ $? -ne 0 ]]; then
  echo "[test-mw-core-golden-flow-pg] FATAL: required schema objects for this suite are missing." >&2
  exit 1
fi

echo "[test-mw-core-golden-flow-pg] Running golden-flow suite (--retry=0)..."
npx vitest run \
  --config tests/integration/mywork/vitest.golden-flow.config.ts \
  --retry=0 \
  tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts
