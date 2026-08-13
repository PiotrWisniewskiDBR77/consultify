/**
 * E2 — regression test for a fresh-install migration-ordering defect in the
 * RUNTIME table-platform migration runner
 * (`server/src/services/tablePlatform/migrationRunner.ts`, the "[TP
 * Migrations]" runner `server/src/index.ts` calls as PART OF READINESS at
 * every boot — this is the runner that actually gates `/api/ready`, not the
 * separate manual CLI runner `server/scripts/migrate.postgres.ts`).
 *
 * ===========================================================================
 * THE DEFECT (measured on a genuinely fresh, 0-table Postgres database)
 * ===========================================================================
 * `runMigrations()` discovers files with `discoverMigrationFiles()`, which
 * sorts with `compareMigrationFilenames()`. Before this packet's fix, that
 * comparator fell back to plain filename order whenever two files shared the
 * exact same date prefix. All eleven Case Workspace migrations share the
 * `20260809_` prefix:
 *
 *   20260809_case_workspace_artifact_links.sql        <- 'a', sorted FIRST
 *   20260809_case_workspace_capability_registry.sql
 *   20260809_case_workspace_case_core.sql              <- 'c', sole producer of `case_core`
 *   20260809_case_workspace_case_plan_version.sql
 *   20260809_case_workspace_execution_graph.sql
 *   20260809_case_workspace_history_value.sql
 *   20260809_case_workspace_migration_readiness.sql
 *   20260809_case_workspace_plays.sql
 *   20260809_case_workspace_proposals_approvals.sql
 *   20260809_case_workspace_run_binding.sql
 *   20260809_case_workspace_wait_subscription.sql
 *
 * `artifact_links` has `case_id TEXT NOT NULL REFERENCES case_core(case_id)`
 * but alphabetically precedes `case_core.sql`, the sole producer of that
 * table — so on a fresh database the runner failed applying
 * `artifact_links` with `relation "case_core" does not exist`, rolled back,
 * and STOPPED (fail-closed), which left `/api/ready` returning 503 forever.
 * The same class of inversion, independently, also breaks
 * `execution_graph` (needs `case_workspace_run_bindings`, produced by
 * `run_binding.sql`, which sorts later alphabetically) — reproduced below in
 * the "class of defect" test, not just the single reported file.
 *
 * This was invisible on any database where `case_core` already existed from
 * an earlier run (its own `CREATE TABLE IF NOT EXISTS` + fail-closed
 * checksum verification make an ALREADY-APPLIED file a pure skip regardless
 * of ordering), which is exactly why demo/prod/the shared local
 * `case_workspace_test` never surfaced it.
 *
 * ===========================================================================
 * THE FIX — verified here, not just asserted
 * ===========================================================================
 * `compareMigrationFilenames()` now consults a narrow, explicit
 * `SAME_PREFIX_ORDER` map (migrationRunner.ts) for same-date-prefix files it
 * names, mirroring the dependency order already reviewed and shipped for
 * the SEPARATE manual runner's `DATED_SAME_DAY_ORDER`
 * (`server/scripts/migrate.postgres.ts`). It changes DISCOVERY ORDER only —
 * no migration file's SQL content changed, so already-applied databases are
 * provably unaffected (an applied file is skipped by a filename lookup
 * BEFORE ordering is ever consulted; see `runMigrations()`'s skip check).
 *
 * ===========================================================================
 * WHAT THIS SUITE PROVES
 * ===========================================================================
 * 1. GENERIC DEPENDENCY CHECK (pure, no DB): parses every one of the 11 REAL
 *    files' `CREATE TABLE` / `REFERENCES` clauses (never a hand-written
 *    re-implementation of the schema) and asserts every producer sorts
 *    before every one of its same-family consumers, under the REAL exported
 *    `compareMigrationFilenames`. This is the general regression guard: it
 *    fails for ANY future same-day file whose dependency edge is not
 *    correctly ordered, not only for the specific historically-broken pair.
 * 2. NEGATIVE CONTROL: plain filename sort (no override) really does put
 *    `artifact_links` before `case_core` and `execution_graph` before
 *    `run_binding` — proves the bug is real, not hypothetical.
 * 3. DETERMINISM: sort order is identical regardless of input permutation
 *    (mirrors the repo's established pattern for this exact class of
 *    ordering bug, see tests/integration/m01-prun-base-runtime-migration-discovery.realdb.test.ts).
 * 4. FRESH APPLY (real Postgres): `runMigrations()`, pointed at a fixture
 *    directory containing byte-identical COPIES of the 11 real files, run
 *    against a scratch schema with only the external tables they reference
 *    (`organizations`, `projects`, `users`, `v8_execution_runs`) pre-created
 *    — applies all 11 with zero failures.
 * 5. IDEMPOTENT REPLAY: running again against the same, now-migrated schema
 *    applies zero and skips all 11.
 *
 * SKIP POLICY: identical to the sibling M01 suite — if a database is
 * configured but unreachable, this suite FAILS rather than skipping green.
 * If none is configured, it skips loudly (stderr) and reports nothing.
 *
 *   docker exec case-workspace-test-pg psql -U case_workspace -d postgres \
 *     -c "CREATE DATABASE <your_scratch_db>;"
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/<your_scratch_db> \
 *   npx vitest run tests/integration/case-workspace-fresh-install-migration-order.realdb.test.ts
 *
 * NEVER point this suite's DATABASE_URL at `case_workspace_test` or
 * `cw_freshmig` — both are shared with other concurrent sessions. Use your
 * own throwaway database.
 */

import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

const testDir = path.dirname(fileURLToPath(import.meta.url));
const REAL_MIGRATIONS_DIR = path.resolve(testDir, '../../server/migrations');

const CASE_WORKSPACE_FILE_RE = /^20260809_case_workspace_.*\.sql$/;

function realCaseWorkspaceFilenames(): string[] {
  return readdirSync(REAL_MIGRATIONS_DIR).filter((f) => CASE_WORKSPACE_FILE_RE.test(f));
}

/**
 * Parses `CREATE TABLE IF NOT EXISTS <name>` and `REFERENCES <name>(` out of
 * a migration's real SQL. Deliberately simple (no SQL parser) — this only
 * needs to find identifiers, and every migration in this family follows the
 * exact same two idioms (confirmed by direct inspection of all 11 files).
 */
function parseProducesAndReferences(sql: string): { produces: string[]; references: string[] } {
  const produces = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(
    (m) => m[1]
  );
  const references = [...sql.matchAll(/REFERENCES\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map(
    (m) => m[1]
  );
  return { produces, references };
}

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const url = readDatabaseUrl();
  if (url) return { connectionString: url, connectionTimeoutMillis: 2000, statement_timeout: 60_000 };
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 2000,
    statement_timeout: 60_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

function assertLocalDatabase(): void {
  const url = readDatabaseUrl();
  const host = url ? new URL(url).hostname : process.env.PGHOST || process.env.DB_HOST || '';
  const local =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.localdomain');
  if (!local) {
    throw new Error(
      `Refusing to run: this suite creates fixture objects and requires a local database. Got host "${host}".`
    );
  }
}

function assertNotSharedDatabase(): void {
  const url = readDatabaseUrl();
  const dbName = url ? new URL(url).pathname.replace(/^\//, '') : process.env.PGDATABASE || '';
  if (dbName === 'case_workspace_test' || dbName === 'cw_freshmig') {
    throw new Error(
      `Refusing to run against shared database "${dbName}" — this suite creates schema objects. Use a dedicated scratch database instead.`
    );
  }
}

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client(buildClientConfig() as ClientConfig);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

let reachable = false;
let runMigrations: (options?: { migrationsDir?: string }) => Promise<{
  applied: number;
  skipped: number;
  failed: string | null;
  failedFile: string | null;
  total: number;
}>;
let discoverMigrationFiles: (dir: string) => string[];
let compareMigrationFilenames: (a: string, b: string) => number;

const tempDirs: string[] = [];
function makeFixtureDirFromRealFiles(prefix: string, filenames: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  for (const name of filenames) {
    const content = readFileSync(path.join(REAL_MIGRATIONS_DIR, name), 'utf-8');
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

async function deleteHistory(filenames: string[]): Promise<void> {
  await withClient(async (c) => {
    await c.query(`DELETE FROM tp_migration_history WHERE filename = ANY($1::text[])`, [filenames]);
  });
}

describe('Case Workspace fresh-install migration ordering (real Postgres, real migration files)', () => {
  const realFiles = realCaseWorkspaceFilenames();
  let applyFixtureDir = '';

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — Case Workspace fresh-install ordering tests did NOT run. This run is not evidence.'
      );
      return;
    }
    assertLocalDatabase();
    assertNotSharedDatabase();
    try {
      await withClient(async (c) => {
        await c.query('SELECT 1');
      });
    } catch (error) {
      throw new Error(
        `A database is configured but is not reachable; refusing to report a green run. ${String(error)}`
      );
    }
    reachable = true;

    const runnerMod = await import('../../server/src/services/tablePlatform/migrationRunner.js');
    runMigrations = runnerMod.runMigrations;
    discoverMigrationFiles = runnerMod.discoverMigrationFiles;
    compareMigrationFilenames = runnerMod.compareMigrationFilenames;

    await withClient(async (c) => {
      await c.query(`
        CREATE TABLE IF NOT EXISTS tp_migration_history (
          id SERIAL PRIMARY KEY,
          filename TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          checksum TEXT
        )
      `);
      // Minimal stand-ins for the external tables these 11 files reference.
      // On a real boot these are created by DatabaseInitializer BEFORE the
      // TP runner ever runs; this suite only exercises the TP runner, so it
      // stubs the same three plus v8_execution_runs, matching each real
      // column type used in the FK definitions (all TEXT).
      await c.query(`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY)`);
      await c.query(
        `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT)`
      );
      await c.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)`);
      await c.query(`CREATE TABLE IF NOT EXISTS v8_execution_runs (run_id TEXT PRIMARY KEY)`);
    });

    await deleteHistory(realFiles);
    applyFixtureDir = makeFixtureDirFromRealFiles('cw-fresh-order-', realFiles);
  }, 120_000);

  afterAll(async () => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
    if (!reachable) return;
    await deleteHistory(realFiles);
    // Drop everything this suite created, in dependency order, so repeat
    // runs against the same scratch database start clean.
    await withClient(async (c) => {
      for (const table of [
        'case_workspace_gateway_evaluations',
        'case_workspace_node_result_acceptances',
        'case_workspace_artifact_links',
        'case_workspace_feature_flags',
        'case_workspace_feature_flag_definitions',
        'case_workspace_legacy_quarantine',
        'case_workspace_action_proposal_decisions',
        'case_workspace_action_proposals',
        'case_workspace_waits',
        'case_workspace_history_events',
        'case_workspace_value_measurements',
        'case_workspace_run_bindings',
        'case_workspace_capability_idempotency_keys',
        'case_workspace_capabilities',
        'process_versions',
        'process_definitions',
        'case_plan_view_state',
        'case_plan_versions',
        'case_core',
        'v8_execution_runs',
        'users',
        'projects',
        'organizations',
      ]) {
        await c.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }
    });
  }, 60_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 120_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  it('sanity: all 11 real Case Workspace same-day migration files are present', () => {
    expect(realFiles.length).toBe(11);
    expect(realFiles).toContain('20260809_case_workspace_artifact_links.sql');
    expect(realFiles).toContain('20260809_case_workspace_case_core.sql');
  });

  it(
    'NEGATIVE CONTROL: plain filename sort (no dependency override) really does invert both known pairs',
    () => {
      const plain = [...realFiles].sort();
      const idxArtifactLinks = plain.indexOf('20260809_case_workspace_artifact_links.sql');
      const idxCaseCore = plain.indexOf('20260809_case_workspace_case_core.sql');
      const idxExecutionGraph = plain.indexOf('20260809_case_workspace_execution_graph.sql');
      const idxRunBinding = plain.indexOf('20260809_case_workspace_run_binding.sql');
      // The historically-reported failure.
      expect(idxArtifactLinks).toBeLessThan(idxCaseCore);
      // A second, independently-discovered inversion of the exact same
      // class (see this suite's real-Postgres FRESH-apply-without-the-fix
      // reproduction in the packet's own evidence) — proves the bug is not
      // a one-off, it is a whole class.
      expect(idxExecutionGraph).toBeLessThan(idxRunBinding);
    }
  );

  it(
    'GENERIC DEPENDENCY CHECK: under the REAL exported compareMigrationFilenames, every producer of a case_workspace table sorts before every same-family file that REFERENCES it',
    () => {
      const parsed = new Map<string, { produces: string[]; references: string[] }>();
      for (const f of realFiles) {
        const sql = readFileSync(path.join(REAL_MIGRATIONS_DIR, f), 'utf-8');
        parsed.set(f, parseProducesAndReferences(sql));
      }

      // table -> producing filename, restricted to tables produced by one of
      // these 11 files (organizations/projects/users/v8_execution_runs are
      // produced elsewhere and are correctly excluded — this suite does not
      // assert anything about their relative order).
      const producerOf = new Map<string, string>();
      for (const [file, { produces }] of parsed) {
        for (const table of produces) producerOf.set(table, file);
      }

      const sorted = [...realFiles].sort(compareMigrationFilenames);
      const indexOf = new Map(sorted.map((f, i) => [f, i]));

      const violations: string[] = [];
      for (const [file, { references }] of parsed) {
        for (const table of references) {
          const producer = producerOf.get(table);
          if (!producer || producer === file) continue; // external table, or self-referencing
          if (indexOf.get(producer)! >= indexOf.get(file)!) {
            violations.push(`${file} references ${table} but sorts before its producer ${producer}`);
          }
        }
      }

      expect(violations).toEqual([]);
      // Pin the two known pairs explicitly too, so a future refactor of the
      // override map that accidentally drops one entry fails loudly here
      // even if the generic loop above were ever weakened.
      expect(indexOf.get('20260809_case_workspace_case_core.sql')).toBeLessThan(
        indexOf.get('20260809_case_workspace_artifact_links.sql')!
      );
      expect(indexOf.get('20260809_case_workspace_run_binding.sql')).toBeLessThan(
        indexOf.get('20260809_case_workspace_execution_graph.sql')!
      );
    }
  );

  it('DETERMINISM: sort order is identical regardless of input permutation', () => {
    const canonical = [...realFiles].sort(compareMigrationFilenames);
    for (let i = 0; i < 8; i++) {
      const shuffled = [...realFiles].sort(() => Math.random() - 0.5);
      expect(shuffled.sort(compareMigrationFilenames)).toEqual(canonical);
    }
    const reversed = [...realFiles].reverse().sort(compareMigrationFilenames);
    expect(reversed).toEqual(canonical);
  });

  itDB(
    'FRESH APPLY (real Postgres, real files, isolated fixture dir): all 11 apply with zero failures, case_core before every dependent',
    async () => {
      expect(discoverMigrationFiles(applyFixtureDir)).toEqual(
        [...realFiles].sort(compareMigrationFilenames)
      );

      const result = await runMigrations({ migrationsDir: applyFixtureDir });
      expect(result.failed).toBeNull();
      expect(result.failedFile).toBeNull();
      expect(result.applied).toBe(11);
      expect(result.total).toBe(11);

      const rows = await withClient((c) =>
        c.query(`SELECT filename FROM tp_migration_history WHERE filename = ANY($1::text[])`, [
          realFiles,
        ])
      );
      expect(rows.rows.length).toBe(11);

      const tables = await withClient((c) =>
        c.query(
          `SELECT to_regclass('case_core') AS case_core, to_regclass('case_workspace_artifact_links') AS artifact_links`
        )
      );
      expect(tables.rows[0].case_core).not.toBeNull();
      expect(tables.rows[0].artifact_links).not.toBeNull();
    }
  );

  itDB('IDEMPOTENT REPLAY: running again applies zero and skips all 11', async () => {
    const result = await runMigrations({ migrationsDir: applyFixtureDir });
    expect(result.failed).toBeNull();
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(11);
    expect(result.checksumMismatches).toEqual([]);
  });
});
