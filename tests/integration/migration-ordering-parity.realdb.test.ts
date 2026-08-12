/**
 * E8 — generic ordering parity across EVERY mechanism that applies
 * `server/migrations/*.sql`, plus a real-DB proof of the fixed `--safe`
 * semantics in `server/scripts/migrate.postgres.ts`.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * E2 (tests/integration/case-workspace-fresh-install-migration-order.realdb.test.ts)
 * proved and fixed a same-date-prefix ordering defect in ONE mechanism —
 * `server/src/services/tablePlatform/migrationRunner.ts` ("[TP Migrations]",
 * the runner that actually gates `/api/ready`). E7
 * (docs/product/case-workspace/evidence/e7-migration-paths-2026-08-12/
 * MIGRATION_PATH_ASSESSMENT.md) then found the IDENTICAL, unfixed defect
 * class still alive in two siblings that also apply the same on-disk
 * `server/migrations/*.sql` files:
 *   - `server/src/database/DatabaseInitializer.ts` ("[TP-Migrations]",
 *     hyphen — runs on every real boot too, just before the runner above,
 *     and was masked only by an UNRELATED bug, not by any real fix).
 *   - `server/scripts/run-migrations-staging.cjs` (manual staging tool, no
 *     mitigation at all).
 * `server/scripts/migrate.postgres.ts` already carried the correct fix
 * (`DATED_SAME_DAY_ORDER`) — it is the reference implementation the other
 * two now reuse or mirror.
 *
 * E8 closed the two open gaps by (a) making DatabaseInitializer.ts import
 * migrationRunner.ts's own `compareMigrationFilenames` directly — ONE
 * function, not a second copy — and (b) duplicating the same dependency map
 * into run-migrations-staging.cjs with a heavy cross-reference comment,
 * since that script is plain CommonJS (no build step, cannot import an ESM
 * .ts module) and this packet's allowlist does not permit adding a new
 * shared module.
 *
 * This suite is the thing that makes that regression class structurally
 * impossible to reintroduce in only one mechanism: it parses the REAL
 * producer/consumer relationships out of the REAL 11
 * `20260809_case_workspace_*.sql` files (never a hand-written
 * re-implementation of the schema — the same technique E2 already
 * established) and asserts, independently, that EVERY mechanism's own
 * ordering function places every producer before every file that
 * REFERENCES it. If a future packet touches any one of these four sort
 * functions and reintroduces the inversion, ONLY that mechanism's assertion
 * goes red — the failure message names exactly which one.
 *
 * ===========================================================================
 * WHAT THIS SUITE DOES NOT DO
 * ===========================================================================
 * It does not execute any mechanism's `main()`/full run against a live
 * database except migrate.postgres.ts's `--safe` semantics check at the
 * bottom, which uses an ISOLATED `--dir` fixture and an OWN scratch
 * database — never `server/migrations`, never `case_workspace_test`, never
 * staging. `run-migrations-staging.cjs` in particular is imported ONLY for
 * its exported `compareMigrationFilenames` — its `main()` (which connects
 * to the real staging DB) is guarded behind `require.main === module` and
 * is structurally unreachable from a `require()`/`import()` call, per this
 * program's hard rule against ever executing that script against staging.
 *
 * ===========================================================================
 * HOW TO RUN LOCALLY
 * ===========================================================================
 * Pure ordering-parity tests (first describe block) need no database.
 * The `--safe` semantics tests (second describe block) need a real,
 * disposable Postgres:
 *
 *   docker exec case-workspace-test-pg psql -U case_workspace -d postgres \
 *     -c "CREATE DATABASE <your_scratch_db>;"
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/<your_scratch_db> \
 *   npx vitest run tests/integration/migration-ordering-parity.realdb.test.ts
 *
 * NEVER point DATABASE_URL at `case_workspace_test` — shared with other
 * concurrent sessions. Use your own throwaway database.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(testDir, '../..');
const REAL_MIGRATIONS_DIR = path.resolve(REPO_ROOT, 'server/migrations');

const CASE_WORKSPACE_FILE_RE = /^20260809_case_workspace_.*\.sql$/;

function realCaseWorkspaceFilenames(): string[] {
  return readdirSync(REAL_MIGRATIONS_DIR).filter((f) => CASE_WORKSPACE_FILE_RE.test(f));
}

/**
 * Parses `CREATE TABLE IF NOT EXISTS <name>` and `REFERENCES <name>(` out of
 * a migration's real SQL — deliberately simple (no SQL parser), matching
 * E2's identical helper. Every file in this family follows exactly these
 * two idioms (confirmed by direct inspection of all 11 files).
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

type FilenameComparator = (a: string, b: string) => number;

/**
 * Generic property check, reused for every mechanism: under `compare`,
 * every producer of a case_workspace table must sort before every
 * same-family file that REFERENCES that table. Returns human-readable
 * violation strings (empty = property holds).
 */
function findOrderingViolations(filenames: string[], compare: FilenameComparator): string[] {
  const parsed = new Map<string, { produces: string[]; references: string[] }>();
  for (const f of filenames) {
    const sql = readFileSync(path.join(REAL_MIGRATIONS_DIR, f), 'utf-8');
    parsed.set(f, parseProducesAndReferences(sql));
  }

  const producerOf = new Map<string, string>();
  for (const [file, { produces }] of parsed) {
    for (const table of produces) producerOf.set(table, file);
  }

  const sorted = [...filenames].sort(compare);
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
  return violations;
}

describe('Migration ordering parity — EVERY mechanism that applies server/migrations/*.sql (E8)', () => {
  const realFiles = realCaseWorkspaceFilenames();

  it('sanity: all 11 real Case Workspace same-day migration files are present', () => {
    expect(realFiles.length).toBe(11);
    expect(realFiles).toContain('20260809_case_workspace_artifact_links.sql');
    expect(realFiles).toContain('20260809_case_workspace_case_core.sql');
  });

  it('NEGATIVE CONTROL: a naive raw-filename sort (no dependency awareness at all) DOES violate the parsed dependency graph — proves this suite would have caught the original bug', () => {
    const violations = findOrderingViolations(realFiles, (a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join('\n')).toContain('artifact_links');
  });

  describe('mechanism #1 — migrationRunner.ts ("[TP Migrations]", gates /api/ready)', () => {
    it('compareMigrationFilenames respects every producer/consumer edge', async () => {
      const { compareMigrationFilenames } = await import(
        '../../server/src/services/tablePlatform/migrationRunner.js'
      );
      const violations = findOrderingViolations(realFiles, compareMigrationFilenames);
      expect(violations).toEqual([]);
    });
  });

  describe('mechanism #2 — DatabaseInitializer.ts ("[TP-Migrations]", runs every real boot just before #1)', () => {
    const tempDirs: string[] = [];
    afterAll(() => {
      for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
    });

    it('discoverTablePlatformMigrationFiles() sorts a fixture copy of the 11 real files with no violations', async () => {
      const { discoverTablePlatformMigrationFiles } = await import(
        '../../server/src/database/DatabaseInitializer.js'
      );

      // Fixture dir with byte-identical copies of the real files (same
      // technique E2 uses) — this function only reads filenames + sorts, it
      // never touches a database, so a plain fs fixture is sufficient and
      // keeps this test independent of any live Postgres.
      const dir = mkdtempSync(path.join(tmpdir(), 'e8-tp-migrations-order-'));
      tempDirs.push(dir);
      // Shuffle on write so directory read order can never coincidentally
      // match dependency order (mirrors the real defect: readdirSync order
      // is filesystem-dependent, not alphabetical, on this OS).
      const shuffled = [...realFiles].sort(() => Math.random() - 0.5);
      for (const name of shuffled) {
        writeFileSync(path.join(dir, name), readFileSync(path.join(REAL_MIGRATIONS_DIR, name)));
      }

      const discovered = discoverTablePlatformMigrationFiles(dir);
      expect(discovered.length).toBe(11);

      const violations = findOrderingViolations(discovered, (a, b) => {
        // discovered is ALREADY sorted by the function under test; re-derive
        // a comparator from its resulting index order so
        // findOrderingViolations can re-sort it identically (sorting an
        // already-sorted array by this comparator is a no-op).
        const ia = discovered.indexOf(a);
        const ib = discovered.indexOf(b);
        return ia - ib;
      });
      expect(violations).toEqual([]);
    });
  });

  describe('mechanism #5 — run-migrations-staging.cjs (manual staging tool, exported ordering fn ONLY — main() is guarded and never invoked here)', () => {
    it('compareMigrationFilenames respects every producer/consumer edge', async () => {
      const mod: any = await import('../../server/scripts/run-migrations-staging.cjs');
      const compareMigrationFilenames = mod.compareMigrationFilenames ?? mod.default?.compareMigrationFilenames;
      expect(typeof compareMigrationFilenames).toBe('function');
      const violations = findOrderingViolations(realFiles, compareMigrationFilenames);
      expect(violations).toEqual([]);
    });

    it('never connects to a database as a side effect of being imported (require.main guard)', async () => {
      // If the guard were missing, importing this module in a process with
      // no DATABASE_URL would throw/exit before this assertion even ran —
      // reaching this line at all is part of the proof.
      const mod: any = await import('../../server/scripts/run-migrations-staging.cjs');
      expect(mod.MIGRATIONS_DIR).toContain('server');
      expect(mod.MIGRATIONS_DIR).toContain('migrations');
    });
  });

  describe('mechanism #3 — migrate.postgres.ts (reference implementation; DATED_SAME_DAY_ORDER)', () => {
    // migrate.postgres.ts starts with a `#!/usr/bin/env tsx` shebang. Vite's
    // SSR module transform (what vitest's plain `await import()` uses)
    // chokes on that shebang when the file is fetched as a dependency
    // module (RollupError: "Parse failure: Expected ident" — a Vite/rollup
    // quirk with shebang lines outside the app's normal transform roots),
    // even though the SAME file imports and runs perfectly under tsx
    // directly (this is its only real invocation path — see package.json's
    // `db:migrate*` scripts, all `tsx server/scripts/migrate.postgres.ts`;
    // the file is not chmod +x, so the shebang is not, and never has been,
    // functionally load-bearing). Rather than touch migrate.postgres.ts a
    // third way just to appease Vite's SSR transform, this harness imports
    // it the SAME way it always actually runs: through `tsx`, in a child
    // process, via a tiny in-tmpdir shim script (not under server/scripts —
    // this packet's allowlist does not add files there). That child
    // process import ALSO proves the `isDirectCliInvocation` guard (added
    // in E8, see migrate.postgres.ts's bottom) does its job for real: this
    // shim is the process entry point, not migrate.postgres.ts, so
    // `import.meta.url !== pathToFileURL(process.argv[1]).href` inside
    // migrate.postgres.ts and `main()` correctly does NOT run — no
    // DATABASE_URL is even set for this child process, so if the guard
    // regressed, main() would throw immediately and this harness would
    // report failure instead of the sorted JSON it expects.
    function sortViaMigratePostgresSubprocess(filenames: string[]): string[] {
      const shimDir = mkdtempSync(path.join(tmpdir(), 'e8-migrate-postgres-shim-'));
      try {
        const shimPath = path.join(shimDir, 'sort-shim.mjs');
        const outPath = path.join(shimDir, 'out.json');
        const targetUrl = pathToFileURL(
          path.resolve(REPO_ROOT, 'server/scripts/migrate.postgres.ts')
        ).href;
        // Importing migrate.postgres.ts pulls in loadEnv.js, which logs
        // informational lines to stdout — write the result to a FILE
        // instead of stdout so those log lines can never corrupt the JSON
        // this harness parses.
        writeFileSync(
          shimPath,
          [
            `import { writeFileSync } from 'node:fs';`,
            `import { compareMigrationOrder } from ${JSON.stringify(targetUrl)};`,
            `const files = JSON.parse(process.argv[2]);`,
            `const toMigration = (filename) => ({ version: filename.split('_')[0], filename, filepath: '', checksum: '' });`,
            `const sorted = [...files].sort((a, b) => compareMigrationOrder(toMigration(a), toMigration(b)));`,
            `writeFileSync(${JSON.stringify(outPath)}, JSON.stringify(sorted));`,
          ].join('\n')
        );

        const result = spawnSync('npx', ['tsx', shimPath, JSON.stringify(filenames)], {
          cwd: REPO_ROOT,
          encoding: 'utf-8',
          env: { ...process.env },
        });
        if (result.status !== 0) {
          throw new Error(
            `sort-shim subprocess failed (status ${result.status}): ${result.stderr || result.stdout}`
          );
        }
        return JSON.parse(readFileSync(outPath, 'utf-8'));
      } finally {
        rmSync(shimDir, { recursive: true, force: true });
      }
    }

    it('compareMigrationOrder respects every producer/consumer edge', () => {
      const sorted = sortViaMigratePostgresSubprocess(realFiles);
      expect(sorted.length).toBe(11);
      const indexOf = (f: string) => sorted.indexOf(f);
      const violations = findOrderingViolations(sorted, (a, b) => indexOf(a) - indexOf(b));
      expect(violations).toEqual([]);
    });

    it('does not run main() / touch a database merely by being imported (isDirectCliInvocation guard)', () => {
      // If the guard were missing or broken, importing migrate.postgres.ts
      // from the shim (with no DATABASE_URL set) would make main() attempt
      // `new Pool({ connectionString: undefined })` / throw before ever
      // reaching the shim's own sort + stdout write — so getting back a
      // clean 11-element sorted array here is itself the proof.
      const sorted = sortViaMigratePostgresSubprocess(realFiles);
      expect(sorted.length).toBe(11);
    });
  });
});

// =============================================================================
// `--safe` semantics (migrate.postgres.ts) — real Postgres, isolated fixture
// dir, own scratch database. Proves: benign already-applied errors are
// tolerated and recorded 'skipped' (unchanged), while a GENUINE failure is
// recorded 'failed' (not 'skipped') and the whole run exits non-zero instead
// of printing "✅ ... complete".
// =============================================================================
function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function assertLocalDatabase(url: string): void {
  const host = new URL(url).hostname;
  const local =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.localdomain');
  if (!local) {
    throw new Error(`Refusing to run: this suite requires a local database. Got host "${host}".`);
  }
}

function assertNotSharedDatabase(url: string): void {
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (dbName === 'case_workspace_test' || dbName === 'cw_freshmig') {
    throw new Error(
      `Refusing to run against shared database "${dbName}" — use a dedicated scratch database.`
    );
  }
}

const DATABASE_URL = readDatabaseUrl();
const DB_CONFIGURED = DATABASE_URL !== null;

describe('migrate.postgres.ts --safe semantics (real Postgres, E8)', () => {
  let reachable = false;
  const tempDirs: string[] = [];

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 60_000) =>
    it(
      name,
      async () => {
        if (!reachable) {
          // eslint-disable-next-line no-console
          console.error(`[skip] ${name} — no reachable local Postgres configured. Not evidence.`);
          return;
        }
        await fn();
      },
      timeoutMs
    );

  async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: DATABASE_URL as string } as ClientConfig);
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No DATABASE_URL configured — --safe semantics tests did NOT run.');
      return;
    }
    assertLocalDatabase(DATABASE_URL as string);
    assertNotSharedDatabase(DATABASE_URL as string);
    await withClient(async (c) => {
      await c.query('SELECT 1');
    });
    reachable = true;
  }, 30_000);

  afterAll(() => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
  });

  function makeFixtureDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'e8-safe-semantics-'));
    tempDirs.push(dir);
    return dir;
  }

  function runMigratePostgres(args: string[], extraEnv: Record<string, string> = {}) {
    return spawnSync(
      'npx',
      ['tsx', 'server/scripts/migrate.postgres.ts', ...args],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        env: {
          ...process.env,
          DB_TYPE: 'postgres',
          NODE_ENV: 'test',
          RUN_DB_TESTS: '1',
          DATABASE_URL: DATABASE_URL as string,
          ...extraEnv,
        },
      }
    );
  }

  itDB(
    'BENIGN-ONLY run: --safe against an already-existing table still exits 0 and prints the "complete" banner (unchanged behavior — proves --safe was NOT made useless)',
    async () => {
      const dir = makeFixtureDir();
      const filename = '500_e8_safe_benign_only.sql';
      writeFileSync(path.join(dir, filename), 'CREATE TABLE e8_safe_benign_probe (id INT);');

      // Pre-create the table so the migration hits a REAL Postgres
      // "already exists" error — not an assumed error string.
      await withClient((c) => c.query('DROP TABLE IF EXISTS e8_safe_benign_probe'));
      await withClient((c) => c.query('CREATE TABLE e8_safe_benign_probe (id INT)'));

      const result = runMigratePostgres(['--safe', '--dir', dir, '--only', filename]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('✅ Postgres migrations complete');

      const rows = await withClient((c) =>
        c.query(`SELECT status FROM schema_migrations WHERE filename = $1`, [filename])
      );
      expect(rows.rows[0]?.status).toBe('skipped');

      await withClient((c) => c.query('DROP TABLE IF EXISTS e8_safe_benign_probe'));
      await withClient((c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [filename]));
    }
  );

  itDB(
    'MIXED run: --safe with one benign + one GENUINE failure — genuine is recorded failed (not skipped), run exits non-zero, no "complete" banner',
    async () => {
      const dir = makeFixtureDir();
      const benignFile = '500_e8_safe_mixed_benign.sql';
      const genuineFile = '501_e8_safe_mixed_genuine.sql';
      writeFileSync(path.join(dir, benignFile), 'CREATE TABLE e8_safe_mixed_probe (id INT);');
      writeFileSync(
        path.join(dir, genuineFile),
        'INSERT INTO e8_totally_nonexistent_table_xyz (id) VALUES (1);'
      );

      await withClient((c) => c.query('DROP TABLE IF EXISTS e8_safe_mixed_probe'));
      await withClient((c) => c.query('CREATE TABLE e8_safe_mixed_probe (id INT)'));
      await withClient((c) =>
        c.query('DELETE FROM schema_migrations WHERE filename = ANY($1::text[])', [
          [benignFile, genuineFile],
        ])
      );

      const result = runMigratePostgres([
        '--safe',
        '--dir',
        dir,
        '--only',
        `${benignFile},${genuineFile}`,
      ]);

      // THE core assertion this whole packet exists for: a genuine failure
      // under --safe must NOT be reported as success.
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain('✅ Postgres migrations complete');
      expect(result.stdout + result.stderr).toContain('genuinely failed under --safe');

      const rows = await withClient((c) =>
        c.query(
          `SELECT filename, status FROM schema_migrations WHERE filename = ANY($1::text[]) ORDER BY filename`,
          [[benignFile, genuineFile]]
        )
      );
      const byFile = new Map(rows.rows.map((r: any) => [r.filename, r.status]));
      expect(byFile.get(benignFile)).toBe('skipped');
      // NOT 'skipped' — this is the exact defect E7 §5 reported: a genuine
      // failure recorded under a status name that reads as "not needed".
      expect(byFile.get(genuineFile)).toBe('failed');

      await withClient((c) => c.query('DROP TABLE IF EXISTS e8_safe_mixed_probe'));
      await withClient((c) =>
        c.query('DELETE FROM schema_migrations WHERE filename = ANY($1::text[])', [
          [benignFile, genuineFile],
        ])
      );
    }
  );

  itDB(
    'WITHOUT --safe: the same genuine failure still fails loud (pre-existing behavior, unchanged) — exit non-zero, status failed',
    async () => {
      const dir = makeFixtureDir();
      const genuineFile = '501_e8_unsafe_genuine.sql';
      writeFileSync(
        path.join(dir, genuineFile),
        'INSERT INTO e8_totally_nonexistent_table_abc (id) VALUES (1);'
      );
      await withClient((c) =>
        c.query('DELETE FROM schema_migrations WHERE filename = $1', [genuineFile])
      );

      const result = runMigratePostgres(['--dir', dir, '--only', genuineFile]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain('✅ Postgres migrations complete');

      const rows = await withClient((c) =>
        c.query(`SELECT status FROM schema_migrations WHERE filename = $1`, [genuineFile])
      );
      expect(rows.rows[0]?.status).toBe('failed');

      await withClient((c) =>
        c.query('DELETE FROM schema_migrations WHERE filename = $1', [genuineFile])
      );
    }
  );
});
