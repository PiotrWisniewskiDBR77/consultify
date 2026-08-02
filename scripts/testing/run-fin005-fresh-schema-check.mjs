#!/usr/bin/env node
/**
 * FIN-005 — fresh-schema bootstrap proof (Codex review Blocker 1).
 *
 * Proves the golden flow (upload -> detect -> extract -> map -> values ->
 * validate -> confirm, both XLSX and CSV) works end-to-end on a database
 * that has NEVER had anything manually applied — only the sanctioned
 * migration path (`npx tsx server/scripts/migrate.postgres.ts --safe`, the
 * same runner `npm run db:migrate` wraps). Nobody has to reach into
 * `server/migrations/never-ran/668_statement_ready_contract.sql` or
 * `.../669_statement_import_rebuild.sql` by hand.
 *
 * Steps:
 *   1. Derive connection details from `server/.env.test` (same guarded LOCAL
 *      target every other acceptance script in this repo uses), but target a
 *      SEPARATE, disposable database name — not `consultinity_test` — so a
 *      leftover manual 668/669 application on the shared dev database can
 *      never quietly cover for a real gap.
 *   2. DROP + CREATE that database on the maintenance (`postgres`) database.
 *   3. Run ONLY `server/scripts/migrate.postgres.ts --safe` against it.
 *   4. Run `tests/acceptance/odbior--fin005--fresh-schema-golden-flow.e2e.test.ts`
 *      against it.
 *
 * Usage: node scripts/testing/run-fin005-fresh-schema-check.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import dotenv from 'dotenv';
import pg from 'pg';

const repoRoot = resolve(import.meta.dirname, '../..');
const envFile = resolve(repoRoot, 'server/.env.test');
const parsed = dotenv.parse(readFileSync(envFile));
const baseDatabaseUrl = parsed.DATABASE_URL;

if (!baseDatabaseUrl) {
  throw new Error('[FIN-005 fresh-schema] server/.env.test does not define DATABASE_URL');
}

const base = new URL(baseDatabaseUrl);
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
if (!localHosts.has(base.hostname)) {
  throw new Error(`[FIN-005 fresh-schema] REFUSING non-local database target host=${base.hostname}`);
}

const FRESH_DB_NAME = 'consultinity_test_fin005_fresh';

const maintenanceUrl = new URL(base.toString());
maintenanceUrl.pathname = '/postgres';

const freshUrl = new URL(base.toString());
freshUrl.pathname = `/${FRESH_DB_NAME}`;
const freshDatabaseUrl = freshUrl.toString();

function run(command, args, extraEnv = {}) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...parsed, ...extraEnv },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function recreateFreshDatabase() {
  const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    // Kick any lingering connections so DROP DATABASE cannot hang/fail.
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [FRESH_DB_NAME]
    );
    await client.query(`DROP DATABASE IF EXISTS ${FRESH_DB_NAME}`);
    await client.query(`CREATE DATABASE ${FRESH_DB_NAME}`);
    console.log(`[FIN-005 fresh-schema] recreated disposable database ${FRESH_DB_NAME}`);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`[FIN-005 fresh-schema] guarded local target: ${base.hostname}/${FRESH_DB_NAME}`);
  await recreateFreshDatabase();

  const forcedEnv = {
    DATABASE_URL: freshDatabaseUrl,
    ENV_FILE: envFile,
    DOTENV_IGNORE_LOCAL: '1',
    DOTENV_OVERRIDE: '1',
    NODE_ENV: 'test',
    DB_TYPE: 'postgres',
    MOCK_DB: 'false',
    RUN_DB_TESTS: '1',
    POSTGRES_SKIP_INIT_IN_TEST: 'true',
    DISABLE_SCHEDULER: 'true',
    // Match the harness's mintToken() fallback (server/.env.test's JWT_SECRET
    // is intentionally short for other suites and gets silently replaced by
    // Config.ts's own default when it fails the >=32-char production check —
    // pin both sides to that same default so signatures verify).
    JWT_SECRET: 'development_secret_key_change_in_production_abc123xyz',
  };

  // 1) ONLY the sanctioned migration path — nothing from never-ran/ applied.
  run('npx', ['tsx', 'server/scripts/migrate.postgres.ts', '--safe'], forcedEnv);

  // 2) The golden flow, both formats, against that exact database.
  run(
    'npx',
    [
      'vitest',
      'run',
      '--config',
      'vitest.acceptance.config.ts',
      'tests/acceptance/odbior--fin005--fresh-schema-golden-flow.e2e.test.ts',
      '--no-file-parallelism',
    ],
    forcedEnv
  );

  console.log('\n[FIN-005 fresh-schema] PASSED — sanctioned migration path alone is sufficient.');
}

main().catch((error) => {
  console.error('[FIN-005 fresh-schema] FAILED', error);
  process.exit(1);
});
