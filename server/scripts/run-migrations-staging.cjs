#!/usr/bin/env node
/**
 * run-migrations-staging.js
 * Applies pending YYYYMMDD_*.sql migrations to the staging (trolley) DB.
 * Tracks applied migrations in tp_migration_history (idempotent).
 *
 * Usage:  node server/scripts/run-migrations-staging.js
 */

'use strict';

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const PATTERN = /^(\d{8})_.*\.sql$/;

// ---------------------------------------------------------------------------
// Ordering fix (E8, docs/product/case-workspace/evidence/e7-migration-paths-
// 2026-08-12/MIGRATION_PATH_ASSESSMENT.md §3): plain `.sort()` on the raw
// filename (the historical behavior here) puts
// `20260809_case_workspace_artifact_links.sql` ('a') before
// `20260809_case_workspace_case_core.sql` ('c') because all eleven
// `20260809_case_workspace_*.sql` files share the identical 8-digit date
// prefix and nothing breaks the tie except ASCII order — the exact defect
// that made a fresh install fail with `relation "case_core" does not exist`
// (fixed for the runtime path in server/src/services/tablePlatform/
// migrationRunner.ts's SAME_PREFIX_ORDER, and originally in
// server/scripts/migrate.postgres.ts's DATED_SAME_DAY_ORDER). Unlike those
// two, this script is NOT run through tsx/ts-node (its own header: `node
// scripts/run-migrations-staging.cjs`, plain CommonJS, no build step), so it
// cannot `require()` or dynamically `import()` those ESM .ts modules without
// depending on a compiled dist/ output this script has never depended on
// before — a new failure mode (silently stale or missing dist) that would be
// worse than the duplication it removes. A new shared plain-JS module is not
// an option either: this packet's allowlist is exactly
// {DatabaseInitializer.ts, run-migrations-staging.cjs, migrate.postgres.ts,
// one new test} — no new shared file. So this map is a DELIBERATE,
// cross-referenced DUPLICATE of migrationRunner.ts's SAME_PREFIX_ORDER (same
// eleven entries, same dependency order, same reasoning — see that file for
// the full per-file FK trace). Keep the two in sync if a new same-day
// case_workspace file is ever added; the generic ordering test added in
// tests/integration/migration-ordering-parity.realdb.test.ts fails loudly if
// they drift.
const SAME_PREFIX_ORDER = {
  '20260809_case_workspace_case_core.sql': 0,
  '20260809_case_workspace_capability_registry.sql': 1,
  '20260809_case_workspace_case_plan_version.sql': 2,
  '20260809_case_workspace_run_binding.sql': 3,
  '20260809_case_workspace_proposals_approvals.sql': 4,
  '20260809_case_workspace_wait_subscription.sql': 5,
  '20260809_case_workspace_history_value.sql': 6,
  '20260809_case_workspace_plays.sql': 7,
  '20260809_case_workspace_artifact_links.sql': 8,
  '20260809_case_workspace_execution_graph.sql': 9,
  '20260809_case_workspace_migration_readiness.sql': 10,
};

/**
 * Mirrors migrationRunner.ts's `compareMigrationFilenames` exactly (prefix
 * length, then prefix localeCompare, then the SAME_PREFIX_ORDER override for
 * files this script explicitly knows about, then raw code-point order as the
 * final fallback). See that file for the full rationale.
 */
function compareMigrationFilenames(a, b) {
  const prefixA = a.split('_')[0];
  const prefixB = b.split('_')[0];
  if (prefixA.length !== prefixB.length) return prefixA.length - prefixB.length;
  const prefixCmp = prefixA.localeCompare(prefixB);
  if (prefixCmp !== 0) return prefixCmp;
  if (a === b) return 0;
  const orderA = SAME_PREFIX_ORDER[a];
  const orderB = SAME_PREFIX_ORDER[b];
  if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
  return a < b ? -1 : 1;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('✅  Connected to staging DB');

  // Ensure tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS tp_migration_history (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT,
      duration_ms INTEGER
    )
  `);

  // Load already-applied migrations
  const { rows } = await client.query('SELECT filename FROM tp_migration_history');
  const applied = new Set(rows.map(r => r.filename));

  // Discover pending
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => PATTERN.test(f))
    .sort(compareMigrationFilenames);

  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('✅  No pending migrations — already up to date');
    await client.end();
    return;
  }

  console.log(`\n📋  ${pending.length} pending migration(s):\n`);
  for (const f of pending) console.log(`    • ${f}`);
  console.log();

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
    const t0 = Date.now();

    process.stdout.write(`  ⏳  ${file} ... `);
    try {
      await client.query(sql);
      const ms = Date.now() - t0;
      await client.query(
        'INSERT INTO tp_migration_history (filename, checksum, duration_ms) VALUES ($1, $2, $3)',
        [file, checksum, ms]
      );
      console.log(`✅  (${ms}ms)`);
    } catch (err) {
      console.log(`❌  FAILED`);
      console.error(`\n    ${err.message}\n`);
      await client.end();
      process.exit(1);
    }
  }

  console.log('\n✅  All migrations applied successfully.\n');
  await client.end();
}

// E8: everything with a real side effect (loading .env.staging.local,
// exiting if DATABASE_URL is missing, and running main() itself, which
// connects to the REAL staging ("trolley") database — see this file's
// header) is gated behind `require.main === module`, i.e. it only runs when
// this file is executed directly (`node scripts/run-migrations-staging.cjs`
// / `node server/scripts/run-migrations-staging.cjs`), never when another
// module (a test) merely `require()`s it for `compareMigrationFilenames`.
// This packet's hard rule is explicit: this script may be EDITED but must
// NOT be EXECUTED against staging — the guard makes "import for the pure
// ordering function" and "run for real against trolley" structurally
// different code paths, so a test cannot accidentally trigger the latter.
// No behavior change for the actual CLI entry point: `require.main` is the
// process's originally-invoked module either way.
if (require.main === module) {
  // Load staging DATABASE_URL from .env.staging.local
  const envFile = path.resolve(__dirname, '../../.env.staging.local');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^DATABASE_URL=(.+)$/);
      if (m) process.env.DATABASE_URL = m[1].trim();
    }
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL not found in .env.staging.local');
    process.exit(1);
  }

  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { compareMigrationFilenames, SAME_PREFIX_ORDER, PATTERN, MIGRATIONS_DIR };
