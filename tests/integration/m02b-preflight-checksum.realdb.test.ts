/**
 * M02-019 FIX 2 — the preflight must actually detect checksum drift, and must
 * stay in lockstep with the runner.
 *
 * The first version's header promised `exit 1` on drift but never compared a
 * checksum: it had no hashing at all, and carried its own copy of the
 * discovery pattern. Both files now import
 * services/tablePlatform/migrationIdentity.ts, and the parity test below
 * exists so they cannot silently diverge again.
 *
 * The drift test is a NEGATIVE CONTROL end-to-end: apply a fixture through the
 * real runner, mutate the file, then run the real preflight analysis and
 * require the gate to fail.
 *
 * ISOLATION (M02-C follow-up): the fixture lives in this suite's own mkdtemp and
 * the CANONICAL server/migrations is never created in, written to or deleted
 * from — not even transiently. The earlier version wrote the fixture into the
 * canonical directory "just for one test"; for the duration of that test a
 * concurrently running backend could discover it and apply it to its own
 * database. Cleaning up in afterAll proved tidiness, not isolation. The runner
 * and the preflight analysis now both take the directory as an ARGUMENT and are
 * pointed at the SAME temp directory.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  classifyChecksum,
  classifyMigrationChecksum,
  fileChecksum,
  MIGRATION_PATTERN,
} from '../../server/src/services/tablePlatform/migrationIdentity.js';

const execFileAsync = promisify(execFile);
const RUN_DB = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const itDB = RUN_DB ? it : it.skip;

const REPO_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server/migrations');
const PREFLIGHT = path.join(REPO_ROOT, 'server/scripts/preflight-pending-migrations.ts');
const PREFLIGHT_ANALYSIS = path.join(
  REPO_ROOT,
  'server/src/services/tablePlatform/migrationPreflight.ts'
);
const MIGRATION_TABLE = 'tp_migration_history';

/**
 * Names AND content of the canonical migrations directory. A listing-only check
 * would pass while a file was modified in place, so the content is hashed too.
 */
function snapshotCanonical(): Array<[string, string]> {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .sort()
    .map((f) => {
      const full = path.join(MIGRATIONS_DIR, f);
      const content = fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf-8') : '<dir>';
      return [f, fileChecksum(content)] as [string, string];
    });
}

let canonicalSnapshotAtStart: Array<[string, string]> = [];

describe('M02-019 — preflight checksum drift + runner parity', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  let tmpDir = '';
  const driftFile = '29990102_m02bdrift_probe.sql';
  const ORIGINAL_SQL = `CREATE TABLE IF NOT EXISTS m02b_drift_probe (id TEXT PRIMARY KEY);`;

  beforeAll(async () => {
    if (!RUN_DB) return;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm02b-drift-'));
    await client.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), checksum TEXT)`);

    // Snapshot the canonical directory: names AND content. Every negative
    // control below asserts against this, before, during and after — a listing
    // check alone would miss a file that was modified in place and restored.
    canonicalSnapshotAtStart = snapshotCanonical();
  });

  afterAll(async () => {
    if (!RUN_DB) return;
    // Nothing to remove from server/migrations — nothing was ever put there.
    await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE filename = $1`, [driftFile]);
    await client.query(`DROP TABLE IF EXISTS m02b_drift_probe CASCADE`);
    await client.end();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── parity: one source of truth for discovery + checksum ─────────────────
  it('runner and preflight share the discovery pattern and checksum helper', async () => {
    const runner = await import('../../server/src/services/tablePlatform/migrationRunner.js');

    // Neither file may re-declare the pattern or re-implement hashing. The
    // preflight side is now the ANALYSIS module — the CLI is a printer and
    // holds no discovery or checksum logic of its own.
    const runnerSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'server/src/services/tablePlatform/migrationRunner.ts'),
      'utf-8'
    );
    for (const [name, src] of [
      ['runner', runnerSrc],
      ['preflight analysis', fs.readFileSync(PREFLIGHT_ANALYSIS, 'utf-8')],
    ] as const) {
      expect(src, `${name} must import the shared identity module`).toContain('migrationIdentity');
      expect(src, `${name} must not re-declare MIGRATION_PATTERN`).not.toMatch(
        /const\s+MIGRATION_PATTERN\s*=/
      );
      expect(src, `${name} must not re-implement the checksum`).not.toMatch(
        /createHash\(\s*['"]sha256/
      );
    }
    expect(runner).toBeDefined();
  });

  it('checksum classification: match / drift / unverifiable', () => {
    const sum = fileChecksum(ORIGINAL_SQL);
    expect(classifyChecksum(sum, ORIGINAL_SQL)).toBe('match');
    expect(classifyChecksum(sum, `${ORIGINAL_SQL} -- changed`)).toBe('drift');
    // NULL/empty predates checksum recording — demo has 181 such rows.
    expect(classifyChecksum(null, ORIGINAL_SQL)).toBe('unverifiable');
    expect(classifyChecksum('', ORIGINAL_SQL)).toBe('unverifiable');
  });

  it('historical compatibility is exact on filename, stored digest and current content', () => {
    const filename = '725_module_sync.sql';
    const current = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
    const historical = '79db562130016782';

    expect(classifyMigrationChecksum(filename, historical, current)).toBe(
      'accepted_historical_variant'
    );
    // A future file edit cannot ride the compatibility entry.
    expect(classifyMigrationChecksum(filename, historical, `${current}\n-- future edit`)).toBe(
      'drift'
    );
    // Nor can a third, unreviewed history value.
    expect(classifyMigrationChecksum(filename, '0000000000000000', current)).toBe('drift');
    // The same pair under another name is not accepted.
    expect(classifyMigrationChecksum('725_lookalike.sql', historical, current)).toBe('drift');
  });

  it('the shared pattern still excludes 9xx and includes date-prefixed files', () => {
    expect(MIGRATION_PATTERN.test('20260804_decision_workflow_canonical.sql')).toBe(true);
    expect(MIGRATION_PATTERN.test('788_tp_notifications_inbox.sql')).toBe(true);
    expect(MIGRATION_PATTERN.test('932_decision_workflow_canonical.sql')).toBe(false);
    expect(MIGRATION_PATTERN.test('932_canonical_inbox_items_source_status_initiative.sql')).toBe(
      false
    );
  });

  it('DISCOVERY (pattern + allowlist) admits only the explicit exceptions', async () => {
    // The pattern alone is no longer the whole rule: M02-C added an explicit,
    // individually reviewed allowlist for one migration that cannot carry a
    // date prefix. Consumers must ask `isRuntimeMigrationFile`, never the
    // pattern — otherwise the allowlist silently stops applying in one of them.
    const { isRuntimeMigrationFile, getRuntimeMigrationAllowlist } =
      await import('../../server/src/services/tablePlatform/migrationIdentity.js');

    const allowlist = getRuntimeMigrationAllowlist();
    // Order-independent: RUNTIME_MIGRATION_ALLOWLIST is consumed as a Set,
    // never by position. Every exception is pinned here so widening discovery
    // cannot hide inside a regex change or an unreviewed allowlist addition.
    expect(new Set(allowlist)).toEqual(
      new Set([
        '654_canonical_inbox_items_producer_fresh_db_gap.sql',
        '669_tool_facilitation_producer_fresh_db_gap.sql',
        '672_enterprise_agent_planner.sql',
        '20260802c_mat010_operation_claims_table.sql',
        '942_ideas_collaboration_tool_sessions.sql',
        '800_chat_007_proposal_idempotency_key.sql',
        '942_chat_m01p04a_attachment_status.sql',
        '940_mw010_vault_document_versions.sql',
        '941_ai_agent_plan_execution_lease.sql',
        '942_ai_agent_plan_run_idempotency.sql',
        '943_work_canvas_timestamp_parity_postgres.sql',
        '944_canvas_idea_materialization_receipts.sql',
        '945_chat_m01p04c_knowledge_doc_scope.sql',
      ])
    );
    expect(allowlist.length).toBe(13);

    // Pattern-matched files are unaffected.
    expect(isRuntimeMigrationFile('20260804_decision_workflow_canonical.sql')).toBe(true);
    expect(isRuntimeMigrationFile('788_tp_notifications_inbox.sql')).toBe(true);

    // The allowlisted file is discovered even though the pattern rejects it.
    expect(MIGRATION_PATTERN.test(allowlist[0])).toBe(false);
    expect(isRuntimeMigrationFile(allowlist[0])).toBe(true);

    // EVERY other 9xx in the repository stays invisible — this is what makes
    // the allowlist a narrow exception rather than a widened regex.
    const other9xx = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^9\d{2}_.*\.sql$/.test(f) && !allowlist.includes(f));
    expect(other9xx.length).toBeGreaterThan(0); // the risk is real, not theoretical
    for (const f of other9xx) {
      expect(isRuntimeMigrationFile(f), `${f} must NOT be runtime-discovered`).toBe(false);
    }
  });

  it('runner and preflight both route discovery through the shared predicate', () => {
    const runnerSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'server/src/services/tablePlatform/migrationRunner.ts'),
      'utf-8'
    );
    const analysisSrc = fs.readFileSync(PREFLIGHT_ANALYSIS, 'utf-8');
    for (const [name, src] of [
      ['runner', runnerSrc],
      ['preflight analysis', analysisSrc],
    ] as const) {
      expect(src, `${name} must filter with isRuntimeMigrationFile`).toContain(
        'isRuntimeMigrationFile'
      );
      // Using the bare pattern here would bypass the allowlist.
      expect(src, `${name} must not filter on MIGRATION_PATTERN directly`).not.toMatch(
        /MIGRATION_PATTERN\.test\(/
      );
    }
  });

  // ── negative control: real drift, real analysis, real gate decision ──────
  //
  // Everything below runs against `tmpDir`. The canonical directory is asserted
  // untouched at every step, not merely at the end.
  itDB(
    'detects drift end-to-end and fails the gate (without --fail-on-pending)',
    async () => {
      expect(snapshotCanonical(), 'canonical must be untouched BEFORE').toEqual(
        canonicalSnapshotAtStart
      );

      const target = path.join(tmpDir, driftFile);
      fs.writeFileSync(target, ORIGINAL_SQL, 'utf-8');

      // Apply it through the REAL runner, pointed at the SAME temp directory, so
      // history holds a real checksum for a file that exists only there.
      const { runMigrations } =
        await import('../../server/src/services/tablePlatform/migrationRunner.js');
      const applyRes = await runMigrations({ migrationsDir: tmpDir });
      expect(applyRes.failed).toBeNull();
      expect(applyRes.applied).toBe(1);

      expect(snapshotCanonical(), 'canonical must be untouched DURING (after apply)').toEqual(
        canonicalSnapshotAtStart
      );

      const { rows } = await client.query(
        `SELECT checksum FROM ${MIGRATION_TABLE} WHERE filename = $1`,
        [driftFile]
      );
      expect(rows[0]?.checksum).toBe(fileChecksum(ORIGINAL_SQL));

      const { analyzePendingMigrations, preflightExitCode } =
        await import('../../server/src/services/tablePlatform/migrationPreflight.js');

      // Clean first: no drift yet, gate open.
      const clean = await analyzePendingMigrations({ migrationsDir: tmpDir, client });
      expect(clean.checksumMismatchCount).toBe(0);
      expect(preflightExitCode(clean)).toBe(0);

      // Now drift the file — in the temp directory.
      fs.writeFileSync(target, `${ORIGINAL_SQL} -- drifted`, 'utf-8');

      const drifted = await analyzePendingMigrations({ migrationsDir: tmpDir, client });
      expect(drifted.checksumMismatches).toContain(driftFile);
      expect(drifted.checksumMismatchCount).toBe(1);
      // Drift fails the gate REGARDLESS of --fail-on-pending.
      expect(preflightExitCode(drifted)).toBe(1);
      expect(preflightExitCode(drifted, { failOnPending: false })).toBe(1);

      expect(snapshotCanonical(), 'canonical must be untouched AFTER').toEqual(
        canonicalSnapshotAtStart
      );
    },
    120_000
  );

  itDB(
    'the runner is fail-closed on the same drift, in the same temp directory',
    async () => {
      // Stands alone: rewrite the drifted content and restore the history row.
      fs.writeFileSync(path.join(tmpDir, driftFile), `${ORIGINAL_SQL} -- drifted`, 'utf-8');
      await client.query(
        `INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ($1, $2)
       ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum`,
        [driftFile, fileChecksum(ORIGINAL_SQL)]
      );

      const { runMigrations } =
        await import('../../server/src/services/tablePlatform/migrationRunner.js');
      const res = await runMigrations({ migrationsDir: tmpDir });
      expect(res.failed).toBeTruthy();
      expect(res.checksumMismatches).toContain(driftFile);
      expect(res.applied).toBe(0);

      expect(snapshotCanonical(), 'canonical must be untouched').toEqual(canonicalSnapshotAtStart);
    },
    120_000
  );

  itDB(
    'runner and preflight accept only the exact historical pair without rewriting history',
    async () => {
      const filename = '725_module_sync.sql';
      const historical = '79db562130016782';
      const compatibilityDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm02b-compat-'));
      const target = path.join(compatibilityDir, filename);
      const current = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
      fs.writeFileSync(target, current, 'utf-8');

      try {
        await client.query(
          `INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ($1, $2)
         ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum`,
          [filename, historical]
        );

        const { analyzePendingMigrations } =
          await import('../../server/src/services/tablePlatform/migrationPreflight.js');
        const exact = await analyzePendingMigrations({ migrationsDir: compatibilityDir, client });
        expect(exact.checksumMismatchCount).toBe(0);
        expect(exact.acceptedHistoricalChecksumVariants).toEqual([filename]);

        const { runMigrations } =
          await import('../../server/src/services/tablePlatform/migrationRunner.js');
        const run = await runMigrations({ migrationsDir: compatibilityDir });
        expect(run.failed).toBeNull();
        expect(run.applied).toBe(0);
        expect(run.skipped).toBe(1);
        expect(run.acceptedHistoricalChecksumVariants).toEqual([filename]);

        const { rows } = await client.query(
          `SELECT checksum FROM ${MIGRATION_TABLE} WHERE filename = $1`,
          [filename]
        );
        expect(rows[0]?.checksum).toBe(historical); // compatibility is read-only

        fs.writeFileSync(target, `${current}\n-- future edit`, 'utf-8');
        const futureEdit = await analyzePendingMigrations({
          migrationsDir: compatibilityDir,
          client,
        });
        expect(futureEdit.checksumMismatches).toEqual([filename]);

        fs.writeFileSync(target, current, 'utf-8');
        await client.query(`UPDATE ${MIGRATION_TABLE} SET checksum = $2 WHERE filename = $1`, [
          filename,
          '0000000000000000',
        ]);
        const thirdHistoryValue = await analyzePendingMigrations({
          migrationsDir: compatibilityDir,
          client,
        });
        expect(thirdHistoryValue.checksumMismatches).toEqual([filename]);
      } finally {
        await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE filename = $1`, [filename]);
        fs.rmSync(compatibilityDir, { recursive: true, force: true });
      }
    },
    120_000
  );

  itDB(
    'the production CLI still runs, read-only, against the canonical directory',
    async () => {
      // The analysis is directory-parameterised for tests; the CLI is not. This
      // exercises the real binary end-to-end and then proves it changed nothing.
      const res = await execFileAsync('npx', ['tsx', PREFLIGHT, '--json'], {
        cwd: REPO_ROOT,
        env: { ...process.env },
      }).catch((e) => e);

      const stdout = String(res.stdout || '');
      const report = JSON.parse(stdout);
      expect(report.migrationsDir).toBe(MIGRATIONS_DIR);
      // Exit code is whatever this database's real state warrants (0 or 1); what
      // matters here is that it ran against canonical and mutated nothing.
      expect([0, 1]).toContain(res.code ?? 0);

      expect(snapshotCanonical(), 'the CLI must not modify canonical').toEqual(
        canonicalSnapshotAtStart
      );
    },
    180_000
  );

  it('the test-only directory seam is an argument, never runtime input', () => {
    const analysisSrc = fs.readFileSync(PREFLIGHT_ANALYSIS, 'utf-8');
    const cliSrc = fs.readFileSync(PREFLIGHT, 'utf-8');
    const runnerSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'server/src/services/tablePlatform/migrationRunner.ts'),
      'utf-8'
    );

    // No environment override anywhere on the discovery path.
    for (const [name, src] of [
      ['analysis', analysisSrc],
      ['cli', cliSrc],
      ['runner', runnerSrc],
    ] as const) {
      expect(src, `${name} must not read a migrations dir from the environment`).not.toMatch(
        /process\.env\.[A-Z_]*MIGRATIONS?_DIR/
      );
    }

    // The CLI resolves canonical itself and never forwards an external value.
    expect(cliSrc).toMatch(/const MIGRATIONS_DIR = path\.resolve\(/);
    expect(cliSrc).toContain('migrationsDir: MIGRATIONS_DIR');
  });
});
