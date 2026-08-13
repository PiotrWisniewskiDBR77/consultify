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
import path from 'path';
import { pathToFileURL } from 'url';

import { Pool } from 'pg';

import '../src/config/loadEnv.js';
import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import { isRuntimeMigrationFile } from '../src/services/tablePlatform/migrationIdentity.js';
import { isExecutableMigration } from '../src/services/releaseGate/migrationExecutionPolicy.js';
import {
  assertExpectedTarget,
  assertNoForbiddenFlags,
} from '../src/services/releaseGate/gateContract.js';
import { resolveBuildSha } from '../src/config/buildSha.js';

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

  // 1. SQL ledger must contain no failed and no skipped rows.
  const sm = await pool.query(
    `SELECT status, count(*)::int AS n FROM schema_migrations GROUP BY status`
  );
  const byStatus = new Map<string, number>(sm.rows.map((r: any) => [String(r.status), r.n]));
  add('sql_ledger_no_failed', (byStatus.get('failed') ?? 0) === 0, `failed=${byStatus.get('failed') ?? 0}`);
  add(
    'sql_ledger_no_skipped',
    (byStatus.get('skipped') ?? 0) === 0,
    `skipped=${byStatus.get('skipped') ?? 0} (a skipped row means a migration did not actually apply)`
  );

  // 2. Nothing pending: every runner-consumed file must be recorded success.
  const applied = await pool.query(`SELECT filename FROM schema_migrations WHERE status='success'`);
  const appliedSet = new Set<string>(applied.rows.map((r: any) => String(r.filename)));
  // Only files the runner would actually execute count as "required".
  // "Required" means what the RUNNER would execute — not every file on disk. The runner skips
  // legacy (<500), 000_initdb_*, seed/demo and SQLite-only files by design.
  const required = onDisk.filter((f) => isExecutableMigration(f));
  const pending = required.filter((f) => !appliedSet.has(f));
  add(
    'sql_chain_no_pending',
    pending.length === 0,
    pending.length === 0 ? `all ${required.length} executable migrations recorded` : `pending=${pending.length}: ${pending.slice(0, 10).join(', ')}${pending.length > 10 ? ' …' : ''}`
  );

  // 3. Table Platform ledger: everything the runtime runner would discover must be recorded.
  const tpExists = await pool.query(`SELECT to_regclass('public.tp_migration_history') IS NOT NULL AS e`);
  if (tpExists.rows[0].e) {
    const tp = await pool.query(`SELECT filename FROM tp_migration_history`);
    const tpSet = new Set<string>(tp.rows.map((r: any) => String(r.filename)));
    const tpPending = onDisk.filter((f) => isRuntimeMigrationFile(f) && !tpSet.has(f));
    add(
      'tp_chain_no_pending',
      tpPending.length === 0,
      tpPending.length === 0 ? 'runtime ledger complete' : `pending=${tpPending.length}: ${tpPending.slice(0, 10).join(', ')}`
    );
  } else {
    // Pre-deploy runs BEFORE the app boots, and the runtime runner creates this table on its
    // first start. Absence here is expected, not a failure; readiness enforces it at boot.
    add(
      'tp_chain_no_pending',
      true,
      'tp_migration_history not yet created (expected pre-deploy; enforced by readiness at boot)'
    );
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

  const repoRoot = process.cwd();
  const migrationsDir = path.resolve(repoRoot, 'server/migrations');

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
  const runner = process.env.RELEASE_GATE_MIGRATOR
    ? process.env.RELEASE_GATE_MIGRATOR
    : path.resolve(repoRoot, 'server/scripts/migrate.postgres.ts');
  const useTsx = runner.endsWith('.ts');
  const cmd = useTsx ? path.resolve(repoRoot, 'node_modules/.bin/tsx') : process.execPath;
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
