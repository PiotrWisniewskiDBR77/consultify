#!/usr/bin/env npx tsx
/**
 * Read-only release preflight: what will the Table Platform migration runner
 * attempt on the next start of a given environment, and has any already-applied
 * migration drifted from its recorded checksum?
 *
 * Recommended as a release gate (Master Codex, M02-B). Since the runner became
 * fail-closed — it STOPS the series on the first failure and refuses to run at
 * all on checksum drift — it is worth knowing both facts BEFORE a deploy
 * rather than discovering them from a red readiness probe.
 *
 * This file is now only the CLI: argument parsing, a database connection,
 * printing and the exit code. The analysis lives in
 * services/tablePlatform/migrationPreflight.ts, which is directory-parameterised
 * so tests can point it at their own mkdtemp instead of writing fixtures into
 * the canonical server/migrations. Discovery and checksum semantics come from
 * services/tablePlatform/migrationIdentity.ts — the SAME module the runner
 * uses, so the two cannot drift apart. A parity test pins this.
 *
 * THIS CLI ALWAYS READS THE CANONICAL DIRECTORY. There is no flag, environment
 * variable or other runtime input that can redirect it: a preflight that could
 * be pointed somewhere else would report on a directory production will not run.
 *
 * STRICTLY READ-ONLY: SELECTs only. Never creates or writes tp_migration_history,
 * never runs a migration, never reads business data.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx server/scripts/preflight-pending-migrations.ts
 *     --json               machine-readable output
 *     --fail-on-pending    exit 1 when anything is pending
 *
 * Exit codes:
 *   0 clean
 *   1 checksum drift (ALWAYS), or pending with --fail-on-pending
 *   2 error
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  analyzePendingMigrations,
  formatPreflightReport,
  preflightExitCode,
} from '../src/services/tablePlatform/migrationPreflight.js';

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url));
/** Canonical, and only canonical. */
const MIGRATIONS_DIR = path.resolve(__dirname_esm, '../migrations');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const failOnPending = args.includes('--fail-on-pending');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();

  const report = await analyzePendingMigrations({
    migrationsDir: MIGRATIONS_DIR,
    client,
  });

  console.log(asJson ? JSON.stringify(report, null, 2) : formatPreflightReport(report));

  process.exit(preflightExitCode(report, { failOnPending }));
} catch (err: any) {
  console.error(`preflight failed: ${err?.message || err}`);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
