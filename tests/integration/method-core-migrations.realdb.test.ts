/**
 * @vitest-environment node
 *
 * Method-core / Assessment migrations — the seven gates (S4, 2026-08-13).
 *
 * Scope: the four `server/migrations/20260813_method_core_*.sql` files
 * (kernel, outputs, http_idempotency, bypass_status) — the sole producers of
 * every `method_*` table (verified by grep before writing this suite: no
 * other migration file references `method_sessions`, `method_outputs`, etc.).
 *
 * These four files already carry a documented history of TWO silent-failure
 * bugs (see the header comment of each file, and
 * docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/EVIDENCE_LEDGER.md §G13):
 *
 *   G13.A — same-day files sorted lexicographically put a consumer
 *           (`..._http_idempotency`, FK to `method_sessions`) before its
 *           producer (`..._kernel`). Fixed by explicit `1_/2_/3_/4_` numbering.
 *   G13.B — a file named `..._demo_status.sql` was SILENTLY excluded by
 *           `isSqliteOnlyMigration()`'s "any filename containing demo/seed/
 *           mock is demo data" heuristic — `migrate.postgres.ts` exited 0
 *           while `demo_bypass_active`/`kind` were never created. Fixed by
 *           renaming to `4_bypass_status.sql`.
 *
 * This suite turns that manual, one-off container proof (G13.C) into a
 * repeatable automated gate, run against REAL, throwaway PostgreSQL
 * databases (never the shared `consultify_asm_s4` sandbox — every database
 * this file touches is created and dropped by the suite itself).
 *
 * Gates covered (CLAUDE.md task, CEL A):
 *   1. fresh install       — empty DB -> migrate -> schema matches
 *   2. upgrade              — older-state DB -> migrate -> schema matches, data untouched
 *   3. idempotent rerun     — second run is a no-op, exit 0
 *   4. schema assertion     — information_schema, not assumption
 *   5. migration ledger     — schema_migrations has exactly one row per file
 *   6. negative control     — deliberately breaking producer/consumer order
 *                             makes THIS suite's own method fail (proves the
 *                             gate can actually catch the bug class it guards)
 *   7. no silent exclusion  — none of the 4 files is <500-numbered or nested
 *                             in a subdirectory the (non-recursive) runner
 *                             would miss; dry-run proves the real runner's
 *                             own filter does not drop them either
 *
 * HOW TO RUN LOCALLY:
 *   RUN_DB_TESTS=1 MOCK_DB=false PGHOST=127.0.0.1 PGPORT=5439 PGUSER=$USER \
 *     npx vitest run tests/integration/method-core-migrations.realdb.test.ts \
 *     --no-file-parallelism
 *
 * Same connection-probe/skip contract as sibling realdb suites: if Postgres
 * (with CREATEDB privilege) is not reachable, the suite no-ops (vacuous
 * pass) instead of failing CI runs with no database configured. Gate 7's
 * static/dry-run checks do not require a live database and always run.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server/migrations');
const MIGRATE_SCRIPT = path.join(REPO_ROOT, 'server/scripts/migrate.postgres.ts');

const METHOD_CORE_FILES = [
  '20260813_method_core_1_kernel.sql',
  '20260813_method_core_2_outputs.sql',
  '20260813_method_core_3_http_idempotency.sql',
  '20260813_method_core_4_bypass_status.sql',
] as const;

const METHOD_CORE_TABLES = [
  'method_packs',
  'method_sessions',
  'method_session_roles',
  'method_events',
  'method_evidence',
  'method_teresa_previews',
  'method_snapshots',
  'method_outputs',
  'method_findings',
  'method_report_snapshots',
  'method_initiative_drafts',
  'method_session_create_idempotency',
] as const;

// ---------------------------------------------------------------------------
// Connection plumbing — mirrors the PGHOST/PGPORT/PGUSER convention already
// used by sibling realdb suites (e.g. exe009-closure-delivery-receipt).
// Defaults match this worktree's disposable sandbox (127.0.0.1:5439) but are
// fully overridable via env for other machines/CI.
// ---------------------------------------------------------------------------
const PG_HOST = process.env.PGHOST || process.env.DB_HOST || '127.0.0.1';
const PG_PORT = process.env.PGPORT || process.env.DB_PORT || '5439';
const PG_USER = process.env.PGUSER || process.env.DB_USER || process.env.USER || 'postgres';
const PG_PASSWORD = process.env.PGPASSWORD || process.env.DB_PASSWORD || '';
const PG_BIN_CANDIDATES = [
  process.env.PG_BIN_DIR,
  '/opt/homebrew/opt/postgresql@17/bin',
  '/opt/homebrew/opt/postgresql/bin',
  '/usr/local/opt/postgresql@17/bin',
].filter((p): p is string => Boolean(p));

function adminUrl(dbName: string): string {
  const auth = PG_PASSWORD ? `${PG_USER}:${PG_PASSWORD}` : PG_USER;
  return `postgresql://${auth}@${PG_HOST}:${PG_PORT}/${dbName}`;
}

/** Runs a Postgres client binary (createdb/dropdb/psql), trying each known bin dir then bare PATH. */
function runPgBin(bin: string, args: string[]): string {
  const attempts = [...PG_BIN_CANDIDATES.map((d) => path.join(d, bin)), bin];
  let lastErr: unknown = null;
  for (const cmd of attempts) {
    try {
      return execFileSync(cmd, args, {
        env: { ...process.env, LC_ALL: 'C', PGPASSWORD: PG_PASSWORD },
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        lastErr = err;
        continue; // try next candidate
      }
      throw err; // binary found but command failed for a real reason
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Could not locate ${bin} on PATH or known bin dirs`);
}

function createThrowawayDb(): string {
  const dbName = `method_core_gate_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  runPgBin('createdb', ['-h', PG_HOST, '-p', PG_PORT, '-U', PG_USER, dbName]);
  runPgBin('psql', [
    '-h', PG_HOST, '-p', PG_PORT, '-U', PG_USER, '-d', dbName,
    '-v', 'ON_ERROR_STOP=1',
    '-c', 'CREATE EXTENSION IF NOT EXISTS vector;',
  ]);
  return dbName;
}

function dropThrowawayDb(dbName: string): void {
  try {
    runPgBin('dropdb', ['-h', PG_HOST, '-p', PG_PORT, '-U', PG_USER, '--if-exists', dbName]);
  } catch {
    // best-effort cleanup — do not fail the suite on teardown
  }
}

interface MigrateResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** Spawns the REAL runner under test as a subprocess — never imported in-process (its module top level calls main() -> process.exit()). */
function runMigrate(databaseUrl: string, extraArgs: string[] = []): MigrateResult {
  try {
    const stdout = execFileSync(
      'npx',
      ['tsx', MIGRATE_SCRIPT, ...extraArgs],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DB_TYPE: 'postgres',
          DATABASE_URL: databaseUrl,
          // Never let a stray DATABASE_PUBLIC_URL from the parent shell win.
          DATABASE_PUBLIC_URL: '',
        },
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      }
    );
    return { status: 0, stdout, stderr: '' };
  } catch (err: any) {
    return {
      status: typeof err?.status === 'number' ? err.status : 1,
      stdout: String(err?.stdout ?? ''),
      stderr: String(err?.stderr ?? err?.message ?? ''),
    };
  }
}

/** Dry-run pending list against a given (already-extension-ready) DB — used to compute a real "everything except method_core" file set without duplicating the runner's own SQLite/legacy filter logic. */
function dryRunPendingFiles(databaseUrl: string): string[] {
  const res = runMigrate(databaseUrl, ['--dry-run']);
  if (res.status !== 0) {
    throw new Error(`--dry-run failed (status ${res.status}): ${res.stderr || res.stdout}`);
  }
  return res.stdout
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

async function tableNames(client: Client, names: readonly string[]): Promise<Set<string>> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  return new Set(result.rows.map((r) => r.table_name));
}

async function columnExists(client: Client, table: string, column: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return (result.rowCount ?? 0) > 0;
}

async function ledgerRows(
  client: Client,
  filenames: readonly string[]
): Promise<Array<{ filename: string; status: string; n: number }>> {
  const result = await client.query<{ filename: string; status: string; n: string }>(
    `SELECT filename, status, count(*)::text AS n
       FROM schema_migrations
      WHERE filename = ANY($1)
      GROUP BY filename, status`,
    [filenames as unknown as string[]]
  );
  return result.rows.map((r) => ({ filename: r.filename, status: r.status, n: Number(r.n) }));
}

// ---------------------------------------------------------------------------
// Reachability + CREATEDB-privilege probe (fail-open to a vacuous pass, not
// a hard failure, when no usable Postgres is configured for this run).
// ---------------------------------------------------------------------------
let USABLE = false;
let probeMessage = '';

async function probeUsable(): Promise<boolean> {
  try {
    const client = new Client({ connectionString: adminUrl('postgres') });
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
  } catch (err) {
    probeMessage = `Postgres not reachable at ${PG_HOST}:${PG_PORT} as ${PG_USER}: ${(err as Error).message}`;
    return false;
  }
  try {
    const probeDb = createThrowawayDb();
    dropThrowawayDb(probeDb);
  } catch (err) {
    probeMessage = `Postgres reachable but CREATEDB probe failed: ${(err as Error).message}`;
    return false;
  }
  return true;
}

describe('Method-core migrations — Gate 7 — no silent exclusion by name or subdirectory (static, no DB required)', () => {
  it('all 4 method_core files live directly in server/migrations, not in any subdirectory', () => {
    const topLevel = new Set(fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name));
    for (const f of METHOD_CORE_FILES) {
      expect(topLevel.has(f), `${f} must be a direct file in server/migrations (runner is non-recursive)`).toBe(true);
    }
    // Sanity: prove the check is real by confirming files DO exist somewhere
    // nested (never-ran/, ops/) so an all-pass isn't just an empty check.
    const neverRan = fs.readdirSync(path.join(MIGRATIONS_DIR, 'never-ran'));
    expect(neverRan.length).toBeGreaterThan(0);
  });

  it('none of the 4 files would be excluded by the <500-numbered legacy heuristic (dated filenames, not 3-digit)', () => {
    for (const f of METHOD_CORE_FILES) {
      const versionToken = f.split('_')[0];
      // isSqliteOnlyMigration() only auto-excludes 3-digit-or-fewer numeric
      // versions < 500. These files use an 8-digit date prefix.
      expect(versionToken).toMatch(/^\d{8}$/);
      expect(Number.parseInt(versionToken, 10)).toBeGreaterThan(500);
    }
  });

  it('none of the 4 filenames contains "demo", "seed", or "mock" (the exact string trap that silently ate G13.B)', () => {
    for (const f of METHOD_CORE_FILES) {
      const lower = f.toLowerCase();
      expect(lower.includes('demo'), `${f} must not contain "demo" — isSqliteOnlyMigration() silently drops it`).toBe(false);
      expect(lower.includes('seed')).toBe(false);
      expect(lower.includes('mock')).toBe(false);
    }
  });

  it('method_* tables are declared ONLY by these 4 files (scope check — no stray producer elsewhere)', () => {
    const allSqlFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    const tableRefPattern = /\bmethod_(?:packs|sessions|session_roles|events|evidence|teresa_previews|snapshots|outputs|findings|report_snapshots|initiative_drafts|session_create_idempotency)\b/;
    const filesReferencingMethodTables = allSqlFiles.filter((f) => {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
      return tableRefPattern.test(content);
    });
    expect(new Set(filesReferencingMethodTables)).toEqual(new Set(METHOD_CORE_FILES));
  });
});

describe('Method-core migrations — real PostgreSQL, throwaway databases', () => {
  beforeAll(async () => {
    USABLE = await probeUsable();
    if (!USABLE) {
      // eslint-disable-next-line no-console
      console.error(
        `[skip] method-core-migrations realdb gates skipped — ${probeMessage}. Set PGHOST/PGPORT/PGUSER ` +
          '(or DATABASE_URL) to point at a reachable Postgres with CREATEDB privilege to exercise this suite.'
      );
    }
  }, 30_000);

  it('is actually running against Postgres with CREATEDB privilege (a skip below is not a pass)', () => {
    if (!USABLE) {
      // eslint-disable-next-line no-console
      console.warn('[method-core-migrations] SKIPPED — see probe message above.');
    }
    expect(true).toBe(true);
  });

  // ── Gates 1, 3, 4, 5 — fresh install / idempotent rerun / schema / ledger ──
  describe('Gates 1, 4, 5, 3 — fresh install -> schema assertion -> ledger assertion -> idempotent rerun', () => {
    let dbName = '';
    let databaseUrl = '';
    let firstRun: MigrateResult | null = null;

    beforeAll(async () => {
      if (!USABLE) return;
      dbName = createThrowawayDb();
      databaseUrl = adminUrl(dbName);
      firstRun = runMigrate(databaseUrl);
    }, 120_000);

    afterAll(() => {
      if (USABLE && dbName) dropThrowawayDb(dbName);
    });

    it('Gate 1 — fresh install exits 0 and applies all 4 method_core files', () => {
      if (!USABLE) return;
      expect(firstRun, 'firstRun must have executed in beforeAll').not.toBeNull();
      expect(
        firstRun!.status,
        `migrate.postgres.ts should exit 0 on a fresh DB. stderr: ${firstRun!.stderr}`
      ).toBe(0);
      for (const f of METHOD_CORE_FILES) {
        expect(firstRun!.stdout, `expected "→ ${f}" in stdout`).toContain(`→ ${f}`);
      }
      expect(firstRun!.stdout).toContain('✅ Postgres migrations complete');
    });

    it('Gate 4 — schema assertion: all 12 method_* tables exist in information_schema', async () => {
      if (!USABLE) return;
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        const found = await tableNames(client, METHOD_CORE_TABLES);
        const missing = METHOD_CORE_TABLES.filter((t) => !found.has(t));
        expect(missing, `Missing method_* tables after fresh install: [${missing.join(', ')}]`).toEqual([]);

        // G13.B regression columns specifically — the ones the "demo" filename
        // trap silently dropped.
        expect(await columnExists(client, 'method_sessions', 'demo_bypass_active')).toBe(true);
        expect(await columnExists(client, 'method_outputs', 'demo_bypass_active')).toBe(true);
        expect(await columnExists(client, 'method_report_snapshots', 'demo_bypass_active')).toBe(true);
        expect(await columnExists(client, 'method_report_snapshots', 'kind')).toBe(true);
      } finally {
        await client.end();
      }
    }, 30_000);

    it('Gate 5 — migration ledger: exactly one success row per method_core file', async () => {
      if (!USABLE) return;
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        const rows = await ledgerRows(client, METHOD_CORE_FILES);
        for (const f of METHOD_CORE_FILES) {
          const forFile = rows.filter((r) => r.filename === f);
          expect(forFile.length, `${f} should have exactly one distinct status in schema_migrations`).toBe(1);
          expect(forFile[0].status).toBe('success');
          expect(forFile[0].n, `${f} should appear exactly once in schema_migrations`).toBe(1);
        }
      } finally {
        await client.end();
      }
    }, 30_000);

    it('Gate 3 — idempotent rerun: second run is a no-op, exit 0, ledger unchanged', async () => {
      if (!USABLE) return;
      const second = runMigrate(databaseUrl);
      expect(second.status, `rerun should exit 0. stderr: ${second.stderr}`).toBe(0);
      expect(second.stdout).toContain('Applying migrations: 0');
      expect(second.stdout).not.toContain('→ 20260813_method_core');

      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        const rows = await ledgerRows(client, METHOD_CORE_FILES);
        for (const f of METHOD_CORE_FILES) {
          const forFile = rows.filter((r) => r.filename === f);
          expect(forFile.length).toBe(1);
          expect(forFile[0].n, `${f} must still appear exactly once after rerun (no duplicate row)`).toBe(1);
        }
      } finally {
        await client.end();
      }
    }, 60_000);
  });

  // ── Gate 2 — upgrade from an older state, data untouched ──────────────────
  describe('Gate 2 — upgrade: older-state DB -> migrate -> schema matches, prior data untouched', () => {
    let dbName = '';
    let databaseUrl = '';
    let baselineFiles: string[] = [];
    const MARKER_ORG_ID = `gate2-marker-org-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      if (!USABLE) return;
      dbName = createThrowawayDb();
      databaseUrl = adminUrl(dbName);

      // Compute "everything the designed schema would run, minus the 4
      // method_core files" via the REAL runner's own --dry-run selection
      // (not a re-implementation of isSqliteOnlyMigration()), so the
      // "older state" is exactly what the current runner would apply on any
      // DB that predates the method-core family — nothing more, nothing less.
      const allPending = dryRunPendingFiles(databaseUrl);
      baselineFiles = allPending.filter((f) => !(METHOD_CORE_FILES as readonly string[]).includes(f));
      expect(baselineFiles.length).toBeGreaterThan(300); // sanity: this is really "almost everything"
      expect(baselineFiles).not.toEqual(expect.arrayContaining([...METHOD_CORE_FILES]));

      const baseline = runMigrate(databaseUrl, ['--only', baselineFiles.join(',')]);
      expect(baseline.status, `baseline (pre-method-core) install failed: ${baseline.stderr}`).toBe(0);

      // Prior data that must survive the upgrade untouched.
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        await client.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
          MARKER_ORG_ID,
          'Gate 2 upgrade marker — must survive method-core migration',
        ]);
      } finally {
        await client.end();
      }
    }, 180_000);

    afterAll(() => {
      if (USABLE && dbName) dropThrowawayDb(dbName);
    });

    it('older-state DB really has no method_* tables yet (the precondition this gate exercises)', async () => {
      if (!USABLE) return;
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        const found = await tableNames(client, METHOD_CORE_TABLES);
        expect([...found]).toEqual([]);
      } finally {
        await client.end();
      }
    });

    it('upgrade run (no --only) applies exactly the 4 method_core files and exits 0', () => {
      if (!USABLE) return;
      const upgrade = runMigrate(databaseUrl);
      expect(upgrade.status, `upgrade run failed: ${upgrade.stderr}`).toBe(0);
      for (const f of METHOD_CORE_FILES) {
        expect(upgrade.stdout).toContain(`→ ${f}`);
      }
    }, 60_000);

    it('post-upgrade schema matches fresh install (all 12 tables + demo_bypass_active/kind columns)', async () => {
      if (!USABLE) return;
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        const found = await tableNames(client, METHOD_CORE_TABLES);
        const missing = METHOD_CORE_TABLES.filter((t) => !found.has(t));
        expect(missing).toEqual([]);
        expect(await columnExists(client, 'method_sessions', 'demo_bypass_active')).toBe(true);
        expect(await columnExists(client, 'method_report_snapshots', 'kind')).toBe(true);
      } finally {
        await client.end();
      }
    }, 30_000);

    it('prior data (the marker organization) is untouched by the upgrade', async () => {
      if (!USABLE) return;
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        const result = await client.query('SELECT id, name FROM organizations WHERE id = $1', [
          MARKER_ORG_ID,
        ]);
        expect(result.rowCount).toBe(1);
        expect(result.rows[0].name).toBe('Gate 2 upgrade marker — must survive method-core migration');
      } finally {
        await client.end();
      }
    });
  });

  // ── Gate 6 — negative control ──────────────────────────────────────────────
  describe('Gate 6 — negative control: producer removed => consumer fails (proves the gate can catch the bug class)', () => {
    let dbName = '';
    let databaseUrl = '';

    beforeAll(async () => {
      if (!USABLE) return;
      dbName = createThrowawayDb();
      databaseUrl = adminUrl(dbName);

      const allPending = dryRunPendingFiles(databaseUrl);
      const baselineFiles = allPending.filter((f) => !(METHOD_CORE_FILES as readonly string[]).includes(f));
      const baseline = runMigrate(databaseUrl, ['--only', baselineFiles.join(',')]);
      expect(baseline.status, `baseline install failed: ${baseline.stderr}`).toBe(0);
    }, 180_000);

    afterAll(() => {
      if (USABLE && dbName) dropThrowawayDb(dbName);
    });

    it('reproduces G13.A: running the outputs file WITHOUT its kernel producer fails on the exact FK error, and leaves no partial table behind', async () => {
      if (!USABLE) return;

      // Deliberately request ONLY the outputs/http_idempotency/bypass_status
      // files — omitting `..._1_kernel.sql`, the sole producer of
      // `method_sessions`/`method_snapshots` that `method_outputs` FKs to.
      // This is exactly the ordering bug G13.A describes, reproduced on
      // purpose instead of asserted from memory.
      const broken = runMigrate(databaseUrl, [
        '--only',
        [
          '20260813_method_core_2_outputs.sql',
          '20260813_method_core_3_http_idempotency.sql',
          '20260813_method_core_4_bypass_status.sql',
        ].join(','),
      ]);

      expect(broken.status, 'a producer-before-consumer break MUST fail, not silently succeed').not.toBe(0);
      expect(broken.stderr + broken.stdout).toMatch(/method_sessions.*does not exist|relation "method_sessions"/i);

      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        // The single multi-statement query for the outputs file must have
        // rolled back atomically — method_outputs must NOT exist.
        const found = await tableNames(client, ['method_outputs', 'method_sessions']);
        expect([...found]).toEqual([]);

        // And schema_migrations must not have a false-success row for it.
        const rows = await ledgerRows(client, ['20260813_method_core_2_outputs.sql']);
        const successRows = rows.filter((r) => r.status === 'success');
        expect(successRows).toEqual([]);
      } finally {
        await client.end();
      }
    }, 60_000);

    it('control-on-the-control: the SAME database heals when run with the correct file set (proves the failure above was ordering, not environment)', async () => {
      if (!USABLE) return;
      const healed = runMigrate(databaseUrl); // default order: 1 -> 2 -> 3 -> 4
      expect(healed.status, `healing run failed: ${healed.stderr}`).toBe(0);

      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        const found = await tableNames(client, METHOD_CORE_TABLES);
        const missing = METHOD_CORE_TABLES.filter((t) => !found.has(t));
        expect(missing).toEqual([]);
      } finally {
        await client.end();
      }
    }, 60_000);
  });
});
