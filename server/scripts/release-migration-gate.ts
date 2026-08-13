#!/usr/bin/env tsx
/**
 * Release migration gate — the single canonical pre-deploy entry point.
 *
 * WHY THIS EXISTS
 * ---------------
 * A read-only forensic pass on 2026-08-13 established that demo had NO effective external
 * migration gate: the Railway service carried `preDeployCommand: ["true"]` (an explicit no-op)
 * on all 20 retained deployments, and root railway.json carried none at all. As a result the SQL
 * chain went dormant after 2026-03 while schema was applied out-of-band.
 *
 * This gate runs the FULL chain and fails closed on anything it cannot explain.
 *
 * HARD CONTRACT — the following are never used, and their presence is a failure:
 *   --only                  (scopes the run to a hand-maintained list that silently goes stale)
 *   --safe                  (records failures as 'skipped' and keeps going)
 *   --allow-checksum-drift  (accepts a database that no longer matches the tree)
 *
 * Exit code is 0 only when every check passes. Any other state exits non-zero so the deploy
 * cannot proceed.
 */
import { spawnSync } from 'child_process';
import nodeFs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { Pool } from 'pg';

import '../src/config/loadEnv.js';
import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import { isRuntimeMigrationFile } from '../src/services/tablePlatform/migrationIdentity.js';
import {
  evaluateSqlChain,
  isSqlChainAcceptable,
} from '../src/services/releaseGate/sqlChainEvaluator.js';
import {
  assertExpectedTarget,
  assertNoForbiddenFlags,
} from '../src/services/releaseGate/gateContract.js';
import { resolveBuildSha } from '../src/config/buildSha.js';

function firstExistingDir(candidates: string[]): string | null {
  for (const c of candidates) {
    try {
      if (nodeFs.existsSync(c) && nodeFs.statSync(c).isDirectory()) return c;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function firstExistingFile(candidates: string[]): string | null {
  for (const c of candidates) {
    try {
      if (nodeFs.existsSync(c) && nodeFs.statSync(c).isFile()) return c;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

export interface GateFinding {
  check: string;
  ok: boolean;
  detail: string;
}

async function collectFindings(pool: Pool, migrationsDir: string): Promise<GateFinding[]> {
  const fs = await import('fs');
  const findings: GateFinding[] = [];
  const add = (check: string, ok: boolean, detail: string) => findings.push({ check, ok, detail });

  const onDisk = fs
    .readdirSync(migrationsDir)
    .filter((f: string) => /\.(sql|js|ts)$/.test(f));

  // 1-3. SQL chain state — via the SHARED evaluator, the same one readiness uses. There is
  // deliberately no second implementation here: an earlier draft of this gate computed "pending"
  // from a raw directory listing and reported 212 phantom pending migrations.
  const evaluation = await evaluateSqlChain({ db: pool as any, migrationsDir });
  add('sql_ledger_present', evaluation.ledgerPresent, evaluation.ledgerPresent ? 'schema_migrations present' : 'schema_migrations missing');
  add('sql_ledger_no_failed', evaluation.failed.length === 0, `failed=${evaluation.failed.length}`);
  add('sql_ledger_no_skipped', evaluation.skipped.length === 0, `skipped=${evaluation.skipped.length}`);
  add('sql_chain_no_pending', evaluation.pending.length === 0, `pending=${evaluation.pending.length}`);
  add(
    'sql_chain_no_unexplained_drift',
    evaluation.unexplainedDrift.length === 0,
    evaluation.unexplainedDrift.length === 0
      ? `no unexplained drift (${evaluation.approvedVariants.length} approved variant(s), ${evaluation.attestedLegacyVariants.length} schema-attested)`
      : `unexplained=${evaluation.unexplainedDrift.length}: ${evaluation.unexplainedDrift.slice(0, 5).join(', ')}`
  );
  add('sql_chain_acceptable', isSqlChainAcceptable(evaluation), `state=${evaluation.state}: ${evaluation.detail}`);

  // Table Platform ledger — pre-deploy runs before the app boots, so absence is expected here;
  // readiness enforces it at boot.
  const tpExists = await pool.query(`SELECT to_regclass('public.tp_migration_history') IS NOT NULL AS e`);
  if (tpExists.rows[0].e) {
    const tp = await pool.query(`SELECT filename FROM tp_migration_history`);
    const tpSet = new Set<string>(tp.rows.map((r: any) => String(r.filename)));
    const tpPending = onDisk.filter((f) => isRuntimeMigrationFile(f) && !tpSet.has(f));
    add('tp_chain_no_pending', tpPending.length === 0, tpPending.length === 0 ? 'runtime ledger complete' : `pending=${tpPending.length}`);
  } else {
    add('tp_chain_no_pending', true, 'tp_migration_history not yet created (expected pre-deploy; enforced by readiness at boot)');
  }

  // 4. PRESENT-WITHOUT-HISTORY: schema that exists although no ledger records the migration.
  //    We never auto-heal this; it requires a human decision, so the gate fails closed.
  const pwh = await pool.query(
    `SELECT count(*)::int AS n
       FROM information_schema.tables t
      WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
        AND t.table_name LIKE 'ie\\_%'
        AND NOT EXISTS (SELECT 1 FROM schema_migrations sm WHERE sm.filename LIKE '93%')`
  );
  add(
    'no_unresolved_present_without_history',
    pwh.rows[0].n === 0,
    pwh.rows[0].n === 0
      ? 'no known present-without-history marker'
      : `${pwh.rows[0].n} ie_* table(s) exist with no 93x ledger row — requires an explicit CTO decision, never auto-recorded`
  );

  // 5. Repair migrations must have actually taken effect (postconditions, not just ledger rows).
  const post = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_instruction_suggestions' AND column_name IN ('suggested_instruction','confidence_score')) AS repair_a,
       (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='tp_schema_proposals' AND column_name='level') AS repair_b_col,
       (SELECT count(*)::int FROM pg_constraint WHERE conname='tp_schema_proposals_level_check') AS repair_b_chk,
       (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND (
          (table_name='organizations' AND column_name IN ('active_llm_provider_id','billing_currency','billing_country','tax_exempt')) OR
          (table_name='users' AND column_name IN ('title','trial_tokens_used','locale','first_day_of_week','accessibility_settings','notification_preferences','ui_preferences','known_devices','ai_assertiveness_level','ai_autonomy_level','attribution_data')) OR
          (table_name='settings' AND column_name='category') OR
          (table_name='projects' AND column_name IN ('start_date','end_date','budget','currency','lead_id','priority','phase','settings','metadata','context_data','rag_enabled')) OR
          (table_name='llm_providers' AND column_name IN ('context_window','created_at')))) AS repair_c`
  );
  const p = post.rows[0];
  add('repair_a_postcondition', p.repair_a === 2, `ai_instruction_suggestions new columns=${p.repair_a}/2`);
  add('repair_b_postcondition', p.repair_b_col === 1 && p.repair_b_chk === 1, `level col=${p.repair_b_col}/1 check=${p.repair_b_chk}/1`);
  add('repair_c_postcondition', p.repair_c === 29, `baseline repair columns=${p.repair_c}/29`);

  return findings;
}

async function main() {
  const argv = process.argv.slice(2);
  assertNoForbiddenFlags(argv);

  // Resolve everything relative to THIS FILE, not to process.cwd().
  //
  // The production image sets `WORKDIR /app/server` (Dockerfile.api) while migrations live at
  // /app/server/migrations, so a cwd-relative `server/migrations` would resolve to
  // /app/server/server/migrations — a path that does not exist. Locating from __dirname works
  // in both layouts: repo (server/scripts/ -> ../migrations) and image (dist/scripts/ -> ../../migrations).
  const selfDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = firstExistingDir([
    path.resolve(selfDir, '../migrations'), // repo: server/scripts -> server/migrations
    path.resolve(selfDir, '../../migrations'), // image: dist/scripts -> /app/server/migrations
    path.resolve(process.cwd(), 'server/migrations'), // repo root invocation
    path.resolve(process.cwd(), 'migrations'),
  ]);
  if (!migrationsDir) {
    throw new Error('Could not locate the migrations directory from the release gate.');
  }

  process.env.DB_TYPE = 'postgres';
  const resolved = resolveReachableDatabaseUrl({
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  const databaseUrl = resolved.databaseUrl;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const host = assertExpectedTarget(databaseUrl, process.env.RELEASE_TARGET_DB_HOST_FINGERPRINT);
  // eslint-disable-next-line no-console
  console.log(`[release-gate] target host verified against expected fingerprint (host redacted).`);
  // eslint-disable-next-line no-console
  console.log(`[release-gate] build sha: ${resolveBuildSha()}`);

  // ---- 1. run the FULL chain, strict, no forbidden flags -------------------------------------
  // Default to the migrator that actually SHIPS in this layout. The production image copies only
  // compiled dist/ — no raw .ts — so defaulting to the .ts runner would fail with "file not found"
  // even once the gate itself is built. Prefer the compiled sibling, fall back to the source.
  const runner =
    process.env.RELEASE_GATE_MIGRATOR ||
    firstExistingFile([
      path.resolve(selfDir, 'migrate.postgres.js'), // image: dist/scripts/migrate.postgres.js
      path.resolve(selfDir, 'migrate.postgres.ts'), // repo: server/scripts/migrate.postgres.ts
    ]) ||
    path.resolve(selfDir, 'migrate.postgres.ts');
  const useTsx = runner.endsWith('.ts');
  // tsx only exists in the repo (dev); the image runs the compiled .js with plain node.
  const cmd = useTsx
    ? firstExistingFile([
        path.resolve(selfDir, '../../node_modules/.bin/tsx'),
        path.resolve(process.cwd(), 'node_modules/.bin/tsx'),
      ]) || 'tsx'
    : process.execPath;
  const args = useTsx ? [runner] : [runner];

  // eslint-disable-next-line no-console
  console.log('[release-gate] applying full migration chain (no --only, no --safe, no --allow-checksum-drift)');
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, DB_TYPE: 'postgres' },
  });
  if (res.status !== 0) {
    throw new Error(`Migration chain failed with exit code ${res.status}. Release blocked.`);
  }

  // ---- 2. verify the resulting state ----------------------------------------------------------
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const findings = await collectFindings(pool, migrationsDir);
    // eslint-disable-next-line no-console
    console.log('\n[release-gate] verification:');
    for (const f of findings) {
      // eslint-disable-next-line no-console
      console.log(`  ${f.ok ? 'PASS' : 'FAIL'}  ${f.check}: ${f.detail}`);
    }
    const failed = findings.filter((f) => !f.ok);
    if (failed.length > 0) {
      throw new Error(
        `Release gate FAILED ${failed.length} check(s): ${failed.map((f) => f.check).join(', ')}`
      );
    }
    // ---- 3. success receipt --------------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log(
      `\nRELEASE_MIGRATION_GATE_PASS buildSha=${resolveBuildSha()} checks=${findings.length} hostVerified=true`
    );
  } finally {
    await pool.end();
  }
}

const isDirectCliInvocation =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectCliInvocation) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('RELEASE_MIGRATION_GATE_FAIL:', e?.message || e);
    process.exit(1);
  });
}
