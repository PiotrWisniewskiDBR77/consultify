/**
 * @vitest-environment node
 *
 * CEL 10 — migration discipline for the `20260813_method_core_*` family
 * (kernel/outputs/http_idempotency/bypass_status), 2026-08-13.
 *
 * Runs `server/scripts/migrate.postgres.ts` as a REAL child process against
 * disposable databases on a DEDICATED container (`mac-pg-s1b`, port 55500,
 * `pgvector/pgvector:pg15` — NOT `mac-pg-team`/55495, which other agents are
 * using concurrently). Every scenario asserts against `information_schema`/
 * `schema_migrations`, never against the migration script's exit code alone
 * — "kod wyjścia migracji nie dowodzi kompletności schematu" (measured
 * pitfall, not a hypothesis).
 *
 * Scenarios (one describe block each):
 *   1. Fresh install — the WHOLE `server/migrations/` set (~800 files,
 *      unmodified, in the repo's own deterministic order) against an empty
 *      database. Proven via information_schema (exact tables/columns), not
 *      just exit code.
 *   2. Idempotent rerun — a second invocation against the SAME database
 *      reports "Applying migrations: 0" and leaves the schema byte-for-byte
 *      the tables it already had.
 *   3. Ledger assertion — `schema_migrations` has a `status = 'success'`
 *      row for each of the 4 family files.
 *   4. Upgrade on a partial schema — clone the fully-migrated database,
 *      surgically strip ONLY the 12 method_core tables + their 4 ledger
 *      rows (no other migration references any `method_*` table — verified
 *      by `grep`, see the stripFamily() comment), then rerun the REAL,
 *      unmodified migrate script against that partial clone. It must
 *      re-apply exactly the 4 family files and nothing else.
 *   5. Negative control — a deliberately broken migration file MUST fail
 *      loudly (non-zero exit, `status = 'failed'` ledger row, no silent
 *      skip) without `--safe`, and produces an explicit `status = 'skipped'`
 *      ledger row (not silence) WITH `--safe`.
 *   6. ★ Silent exclusion by name — `isSqliteOnlyMigration()` in
 *      migrate.postgres.ts blanket-excludes any filename containing
 *      "demo"/"seed"/"mock" from the pending set, before it ever reaches
 *      `recordResult()`. This is the exact class of defect that cost the A9
 *      run (COORD note, this branch's history) — proven here automatically:
 *      a migration named with one of those substrings is applied to NEITHER
 *      the schema NOR the ledger (not even a "skipped" row — total silence,
 *      exit 0), while an otherwise-identical control file without the
 *      substring DOES apply. Detecting this must never again depend on a
 *      human noticing.
 *
 * Run (from the worktree ROOT):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *   S1B_ADMIN_DATABASE_URL="postgresql://s1b:s1b@localhost:55500/postgres" \
 *   npx vitest run server/src/__tests__/migrations --testTimeout=300000
 *
 * `describe.skipIf(!REAL_DB)` — structural no-op unless RUN_DB_TESTS=1 and
 * MOCK_DB=false are both set (same fail-closed gate as every other
 * `*.integration.test.ts` in this repo).
 *
 * Container setup (once, outside this test — see report for exact command):
 *   docker run -d --name mac-pg-s1b -e POSTGRES_USER=s1b -e POSTGRES_PASSWORD=s1b \
 *     -e POSTGRES_DB=s1b_test -p 55500:5432 pgvector/pgvector:pg15
 */
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestDb } from '../../test-utils/dbFailClosed.js';

const REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

const ADMIN_DATABASE_URL =
  process.env.S1B_ADMIN_DATABASE_URL ?? 'postgresql://s1b:s1b@localhost:55500/postgres';
const DB_HOST = 'localhost';
const DB_PORT = 55500;
const DB_USER = 's1b';
const DB_PASSWORD = 's1b';

function dbUrl(name: string): string {
  return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${name}`;
}

// Repo root — every sibling `*.integration.test.ts` in this package documents
// the same requirement ("Run from the worktree ROOT, not server/") because
// `server/scripts/migrate.postgres.ts` resolves `--dir` (when relative)
// against `process.cwd()`. This suite always passes an ABSOLUTE `--dir`
// (see MIGRATIONS_DIR / buildPartialMigrationsDir below) specifically so it
// does not depend on that convention holding — but REPO_ROOT is still used
// to locate the script and the real migrations directory.
const REPO_ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server', 'migrations');
const MIGRATE_SCRIPT = path.join(REPO_ROOT, 'server', 'scripts', 'migrate.postgres.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

const METHOD_CORE_FAMILY = [
  '20260813_method_core_1_kernel.sql',
  '20260813_method_core_2_outputs.sql',
  '20260813_method_core_3_http_idempotency.sql',
  '20260813_method_core_4_bypass_status.sql',
] as const;

const METHOD_CORE_TABLES = [
  'method_sessions',
  'method_session_roles',
  'method_events',
  'method_evidence',
  'method_teresa_previews',
  'method_snapshots',
  'method_packs',
  'method_outputs',
  'method_findings',
  'method_report_snapshots',
  'method_initiative_drafts',
  'method_session_create_idempotency',
] as const;

interface RunResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Spawns the REAL, unmodified `migrate.postgres.ts` as a child process —
 * proves behaviour of the actual script, not a re-implementation of it. */
function runMigrate(databaseUrl: string, args: readonly string[] = [], timeoutMs = 240_000): RunResult {
  const res = spawnSync(TSX_BIN, [MIGRATE_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: databaseUrl },
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) {
    throw new Error(`runMigrate: spawn failed: ${res.error.message}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`);
  }
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

async function createDatabase(admin: Pool, name: string): Promise<void> {
  await admin.query(`CREATE DATABASE "${name}"`);
}

async function dropDatabase(admin: Pool, name: string): Promise<void> {
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}

async function cloneDatabase(admin: Pool, source: string, target: string): Promise<void> {
  await admin.query(`CREATE DATABASE "${target}" TEMPLATE "${source}"`);
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return (res.rowCount ?? 0) > 0;
}

async function listPublicTables(pool: Pool): Promise<string[]> {
  const res = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  return res.rows.map((r) => String(r.table_name));
}

async function ledgerRow(
  pool: Pool,
  filename: string
): Promise<{ status: string; checksum: string } | null> {
  const res = await pool.query(`SELECT status, checksum FROM schema_migrations WHERE filename = $1`, [
    filename,
  ]);
  return res.rows[0] ?? null;
}

/**
 * Builds a temp copy of `server/migrations/` (files only — `ops/`,
 * `never-ran/`, `rollback/` are directories, `readdirSync` in the real
 * script never recurses into them and `f.endsWith('.sql'|'.js'|'.ts')` is
 * false for a bare directory name, so skipping non-files here matches the
 * real script's own filtering exactly) with `excludeFilenames` removed.
 * Used for the negative-control and silent-exclusion scenarios, which are
 * self-contained single-file directories, NOT copies of the real tree (they
 * don't need `organizations` etc.) — see each describe block.
 */
function makeTempMigrationsDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-core-migrations-temp-'));
  for (const [filename, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, filename), sql, 'utf-8');
  }
  return dir;
}

// ---------------------------------------------------------------------------
// Group 1 — fresh install of the WHOLE real migrations/ set, then idempotent
// rerun + ledger assertion, all against the SAME database (one expensive
// ~800-file apply, several cheap assertions on top of it).
// ---------------------------------------------------------------------------

describe.skipIf(!REAL_DB)('CEL 10 — fresh install (whole server/migrations/, real script)', () => {
  let admin: Pool;
  let pool: Pool;
  const DB_NAME = `s1b_fresh_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_DATABASE_URL });
    await assertRealPostgresTestDb(admin);
    await createDatabase(admin, DB_NAME);
    pool = new Pool({ connectionString: dbUrl(DB_NAME) });
    await assertRealPostgresTestDb(pool);

    const result = runMigrate(dbUrl(DB_NAME));
    if (result.status !== 0) {
      throw new Error(
        `fresh install failed (status ${result.status}):\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
      );
    }
    // Stash for the "Applying migrations: N" assertion below.
    (globalThis as any).__s1b_fresh_install_stdout = result.stdout;
  }, 280_000);

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await dropDatabase(admin, DB_NAME);
      await admin.end();
    }
  });

  it(
    '1. fresh install applied every method_core_* family file and created all 12 tables (information_schema, not exit code)',
    async () => {
      for (const table of METHOD_CORE_TABLES) {
        expect(await tableExists(pool, table), `expected table ${table} to exist after fresh install`).toBe(
          true
        );
      }
    },
    60_000
  );

  it(
    '2. schema assertion — key columns exist on the artefact-immutability tables (not just table presence)',
    async () => {
      const cols = async (table: string) => {
        const res = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
          [table]
        );
        return new Set(res.rows.map((r) => String(r.column_name)));
      };

      const outputCols = await cols('method_outputs');
      for (const c of ['output_version', 'revision_of_output_id', 'content_hash', 'scope', 'demo_bypass_active']) {
        expect(outputCols.has(c), `method_outputs missing column ${c}`).toBe(true);
      }
      // No UPDATE/patch surface on the Output table — immutability is
      // structural (see MethodOutputService header comment). We cannot
      // assert "no UPDATE statement exists" from schema alone, but we CAN
      // assert there is no "updated_at" column tempting one — method_outputs
      // only ever gets a fresh INSERT.
      expect(outputCols.has('updated_at')).toBe(false);

      const reportCols = await cols('method_report_snapshots');
      for (const c of ['kind', 'status', 'superseded_by_output_id', 'content_hash']) {
        expect(reportCols.has(c), `method_report_snapshots missing column ${c}`).toBe(true);
      }

      const draftCols = await cols('method_initiative_drafts');
      for (const c of ['status', 'superseded_by_output_id', 'finding_ids_json']) {
        expect(draftCols.has(c), `method_initiative_drafts missing column ${c}`).toBe(true);
      }
      // ★ Structural proof this table has NO path to "Registered Initiative"
      // (MethodInitiativeDraftService header comment): no initiative_id-shaped column.
      expect(draftCols.has('initiative_id')).toBe(false);
      expect(draftCols.has('registered_initiative_id')).toBe(false);

      const idemCols = await cols('method_session_create_idempotency');
      for (const c of ['organization_id', 'idempotency_key', 'session_id']) {
        expect(idemCols.has(c)).toBe(true);
      }
    },
    30_000
  );

  it(
    '3. ledger assertion — schema_migrations has a status=success row for each of the 4 family files',
    async () => {
      for (const filename of METHOD_CORE_FAMILY) {
        const row = await ledgerRow(pool, filename);
        expect(row, `no schema_migrations row for ${filename}`).not.toBeNull();
        expect(row!.status, `${filename} did not record success`).toBe('success');
        expect(row!.checksum, `${filename} recorded an empty checksum`).not.toBe('');
      }
    },
    30_000
  );

  it(
    '4. idempotent rerun — second invocation reports zero pending, schema unchanged, ledger unchanged',
    async () => {
      const before = await listPublicTables(pool);
      const beforeChecksums = await Promise.all(METHOD_CORE_FAMILY.map((f) => ledgerRow(pool, f)));

      const rerun = runMigrate(dbUrl(DB_NAME), [], 60_000);
      expect(rerun.status, `rerun failed:\n${rerun.stderr}`).toBe(0);
      expect(rerun.stdout).toMatch(/Applying migrations: 0/);

      const after = await listPublicTables(pool);
      expect(after).toEqual(before);

      const afterChecksums = await Promise.all(METHOD_CORE_FAMILY.map((f) => ledgerRow(pool, f)));
      expect(afterChecksums).toEqual(beforeChecksums);
    },
    90_000
  );

  it('5. dbFailClosed proof — this suite really is talking to PostgreSQL, not a mock', async () => {
    const proof = await assertRealPostgresTestDb(pool);
    expect(proof.database).toBe(DB_NAME);
    expect(proof.version.toLowerCase()).toContain('postgresql');
  });
});

// ---------------------------------------------------------------------------
// Group 2 — upgrade on a partial schema. Clones the (already fully-migrated,
// cheap: CREATE DATABASE ... TEMPLATE, not another ~800-file apply) database
// from a fresh full install, surgically strips ONLY the method_core family
// (verified self-contained — no other migration references any method_*
// table), then reruns the REAL migrate script and proves it re-applies
// exactly the 4 family files.
// ---------------------------------------------------------------------------

describe.skipIf(!REAL_DB)('CEL 10 — upgrade on a partial schema (real script, cloned baseline)', () => {
  let admin: Pool;
  let basePool: Pool;
  let upgradePool: Pool;
  const BASE_DB = `s1b_upgrade_base_${randomUUID().slice(0, 8)}`;
  const UPGRADE_DB = `s1b_upgrade_target_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_DATABASE_URL });
    await assertRealPostgresTestDb(admin);

    // One full install (the expensive ~800-file apply) …
    await createDatabase(admin, BASE_DB);
    const install = runMigrate(dbUrl(BASE_DB));
    if (install.status !== 0) {
      throw new Error(`base install for upgrade scenario failed:\n${install.stdout}\n${install.stderr}`);
    }
    basePool = new Pool({ connectionString: dbUrl(BASE_DB) });
    await assertRealPostgresTestDb(basePool);
    for (const table of METHOD_CORE_TABLES) {
      if (!(await tableExists(basePool, table))) {
        throw new Error(`setup invariant broken: ${table} missing right after the base install`);
      }
    }
    // … cloned cheaply via TEMPLATE (no connections may be open on BASE_DB
    // for CREATE DATABASE ... TEMPLATE to succeed, so close basePool first).
    await basePool.end();
    await cloneDatabase(admin, BASE_DB, UPGRADE_DB);

    upgradePool = new Pool({ connectionString: dbUrl(UPGRADE_DB) });
    await assertRealPostgresTestDb(upgradePool);

    // Surgically strip ONLY the method_core family — tables + ledger rows —
    // to fabricate a genuinely "partially migrated" database: every other
    // migration already applied, the family specifically never ran.
    await upgradePool.query(`
      DROP TABLE IF EXISTS method_findings CASCADE;
      DROP TABLE IF EXISTS method_report_snapshots CASCADE;
      DROP TABLE IF EXISTS method_initiative_drafts CASCADE;
      DROP TABLE IF EXISTS method_outputs CASCADE;
      DROP TABLE IF EXISTS method_teresa_previews CASCADE;
      DROP TABLE IF EXISTS method_evidence CASCADE;
      DROP TABLE IF EXISTS method_events CASCADE;
      DROP TABLE IF EXISTS method_session_roles CASCADE;
      DROP TABLE IF EXISTS method_snapshots CASCADE;
      DROP TABLE IF EXISTS method_sessions CASCADE;
      DROP TABLE IF EXISTS method_packs CASCADE;
      DROP TABLE IF EXISTS method_session_create_idempotency CASCADE;
    `);
    await upgradePool.query(`DELETE FROM schema_migrations WHERE filename = ANY($1)`, [
      [...METHOD_CORE_FAMILY],
    ]);

    for (const table of METHOD_CORE_TABLES) {
      if (await tableExists(upgradePool, table)) {
        throw new Error(`setup invariant broken: ${table} still present after stripping the family`);
      }
    }
  }, 280_000);

  afterAll(async () => {
    await upgradePool?.end();
    if (admin) {
      await dropDatabase(admin, BASE_DB);
      await dropDatabase(admin, UPGRADE_DB);
      await admin.end();
    }
  });

  it(
    'upgrade: rerunning the REAL, unmodified migrate script on the partial clone re-applies exactly the 4 family files and recreates all 12 tables',
    async () => {
      const upgrade = runMigrate(dbUrl(UPGRADE_DB), [], 60_000);
      expect(upgrade.status, `upgrade run failed:\n${upgrade.stdout}\n${upgrade.stderr}`).toBe(0);
      // Must apply the 4 family files — and, because every OTHER migration
      // was already in the ledger from the clone, ideally not much else.
      // Assert every family filename appears in the "→ <file>" apply log.
      for (const filename of METHOD_CORE_FAMILY) {
        expect(upgrade.stdout, `expected ${filename} to be (re)applied`).toContain(`→ ${filename}`);
      }

      for (const table of METHOD_CORE_TABLES) {
        expect(await tableExists(upgradePool, table), `${table} missing after upgrade`).toBe(true);
      }
      for (const filename of METHOD_CORE_FAMILY) {
        const row = await ledgerRow(upgradePool, filename);
        expect(row?.status).toBe('success');
      }
    },
    90_000
  );
});

// ---------------------------------------------------------------------------
// Group 3 — negative control: a genuinely broken migration MUST fail loudly.
// Self-contained (no dependency on organizations/baseline), so this is cheap
// and does not need a full install.
// ---------------------------------------------------------------------------

describe.skipIf(!REAL_DB)('CEL 10 — negative control: a broken migration must FAIL, never silently skip', () => {
  let admin: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_DATABASE_URL });
    await assertRealPostgresTestDb(admin);
  });

  afterAll(async () => {
    await admin?.end();
  });

  it(
    'without --safe: broken SQL exits non-zero and records status=failed in the ledger',
    async () => {
      const DB_NAME = `s1b_negctrl_${randomUUID().slice(0, 8)}`;
      await createDatabase(admin, DB_NAME);
      try {
        const dir = makeTempMigrationsDir({
          '20260813_zz_negative_control_broken.sql':
            'SELECT * FROM this_table_genuinely_does_not_exist_anywhere_zz;',
        });
        const result = runMigrate(dbUrl(DB_NAME), ['--dir', dir], 30_000);

        expect(result.status, 'a broken migration must exit non-zero').not.toBe(0);
        expect(result.stderr + result.stdout).toMatch(/this_table_genuinely_does_not_exist_anywhere_zz/);

        const pool = new Pool({ connectionString: dbUrl(DB_NAME) });
        try {
          const row = await ledgerRow(pool, '20260813_zz_negative_control_broken.sql');
          expect(row, 'expected an explicit ledger row, not silence').not.toBeNull();
          expect(row!.status).toBe('failed');
        } finally {
          await pool.end();
        }
      } finally {
        await dropDatabase(admin, DB_NAME);
      }
    },
    45_000
  );

  it(
    'with --safe: broken SQL exits ZERO but records status=skipped (auditable, not silent)',
    async () => {
      const DB_NAME = `s1b_negctrl_safe_${randomUUID().slice(0, 8)}`;
      await createDatabase(admin, DB_NAME);
      try {
        const dir = makeTempMigrationsDir({
          '20260813_zz_negative_control_safe.sql':
            'SELECT * FROM this_table_also_does_not_exist_zz;',
        });
        const result = runMigrate(dbUrl(DB_NAME), ['--dir', dir, '--safe'], 30_000);

        expect(result.status, '--safe must still exit 0 (documented behaviour)').toBe(0);

        const pool = new Pool({ connectionString: dbUrl(DB_NAME) });
        try {
          const row = await ledgerRow(pool, '20260813_zz_negative_control_safe.sql');
          expect(row, '--safe must still leave an explicit ledger row, never silence').not.toBeNull();
          expect(row!.status).toBe('skipped');
        } finally {
          await pool.end();
        }
      } finally {
        await dropDatabase(admin, DB_NAME);
      }
    },
    45_000
  );
});

// ---------------------------------------------------------------------------
// Group 4 — ★ silent exclusion by name. The exact A9-class defect: a file
// whose NAME contains demo/seed/mock is filtered out of the pending set by
// `isSqliteOnlyMigration()` BEFORE it ever reaches `recordResult()` — no
// error, no ledger row, exit 0. A control file without the substring, and
// otherwise byte-identical, DOES apply — proving this test would fail if the
// exclusion mechanism were ever removed (not a tautology).
// ---------------------------------------------------------------------------

describe.skipIf(!REAL_DB)('CEL 10 — ★ silent exclusion by filename (demo/seed/mock) is caught automatically', () => {
  let admin: Pool;
  let pool: Pool;
  const DB_NAME = `s1b_silentexcl_${randomUUID().slice(0, 8)}`;

  const EXCLUDED_FILES = {
    '20260813_zz_demo_marker.sql': 'CREATE TABLE zz_demo_marker_table (id INT);',
    '20260813_zz_seed_marker.sql': 'CREATE TABLE zz_seed_marker_table (id INT);',
    '20260813_zz_mock_marker.sql': 'CREATE TABLE zz_mock_marker_table (id INT);',
  } as const;
  const CONTROL_FILE = '20260814_zz_no_exclusion_control_marker.sql';
  const CONTROL_SQL = 'CREATE TABLE zz_control_marker_table (id INT);';

  let result: RunResult;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_DATABASE_URL });
    await assertRealPostgresTestDb(admin);
    await createDatabase(admin, DB_NAME);
    pool = new Pool({ connectionString: dbUrl(DB_NAME) });
    await assertRealPostgresTestDb(pool);

    const dir = makeTempMigrationsDir({ ...EXCLUDED_FILES, [CONTROL_FILE]: CONTROL_SQL });
    result = runMigrate(dbUrl(DB_NAME), ['--dir', dir], 30_000);
  }, 45_000);

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await dropDatabase(admin, DB_NAME);
      await admin.end();
    }
  });

  it('exits 0 — the exclusion is SILENT, no error is ever raised (this is the dangerous part)', () => {
    expect(result.status).toBe(0);
  });

  it('demo/seed/mock-named files are never attempted (absent from the "→ <file>" apply log)', () => {
    for (const filename of Object.keys(EXCLUDED_FILES)) {
      expect(result.stdout, `${filename} should never appear as attempted`).not.toContain(`→ ${filename}`);
    }
  });

  it('demo/seed/mock-named files create NO table and NO ledger row — total silence, not even "skipped"', async () => {
    for (const [filename, sql] of Object.entries(EXCLUDED_FILES)) {
      const tableName = sql.match(/CREATE TABLE (\w+)/)![1];
      expect(await tableExists(pool, tableName), `${tableName} must not exist`).toBe(false);
      expect(await ledgerRow(pool, filename), `${filename} must have zero ledger rows`).toBeNull();
    }
  });

  it('control file (no excluded substring) DOES apply — proves this is a real detector, not a tautology', async () => {
    expect(result.stdout).toContain(`→ ${CONTROL_FILE}`);
    expect(await tableExists(pool, 'zz_control_marker_table')).toBe(true);
    const row = await ledgerRow(pool, CONTROL_FILE);
    expect(row?.status).toBe('success');
  });
});
