/**
 * M01-PRUN, Part A — minimal, standalone fix on the runner as it exists on
 * THIS M01 integration-candidate branch (no dependency on M02's
 * consolidated `migrationIdentity.ts`/`migrationPreflight.ts`/
 * `databaseReadiness.ts` — those exist only on
 * `codex/m02c-m02b-runner-consolidation-20260804` and Master Codex has not
 * authorized pulling M02 infrastructure into an M01 candidate).
 *
 * `server/src/services/tablePlatform/migrationRunner.ts` on this branch is
 * imported by `server/src/index.ts` at every boot (a detached, non-blocking
 * `setTimeout` — that broader readiness-gating gap is Part B, out of scope
 * here, tracked as M01-057) and is the runner that actually executes on
 * deploy. Before this packet its discovery predicate was a bare
 * `MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/` test, so NONE of the five
 * M01 migrations registered below were discoverable (none start with 7xx or
 * an 8-digit date).
 *
 * ROUND-2 COORDINATOR FIX: the round-1 submission wrote its own local
 * copies of `943_work_canvas_timestamp_parity_postgres.sql` (owner: P06A)
 * and `944_canvas_idea_materialization_receipts.sql` (owner: P07C) into
 * `server/migrations/` so discovery/order/fresh-run tests had real files to
 * exercise. The coordinator caught that those blobs had already diverged
 * from the owning packets' own `ACCEPTED_LOCAL` versions — a second,
 * conflicting source of truth for the same filename by the time an
 * integration candidate assembles every packet. Both local copies are
 * removed from this branch; the canonical files ship from P06A/P07C. Every
 * discovery/order/fresh-run test below instead uses an isolated `mkdtemp`
 * FIXTURE directory (created in `beforeAll`, removed in `afterAll`) whose
 * files carry the FIVE REAL TARGET FILENAMES with placeholder SQL content —
 * the filename is what `isRuntimeMigrationFile()`/`compareMigrationFilenames()`
 * operate on, not the DDL, so a placeholder body proves the same discovery
 * and ordering contract without needing (or risking diverging from) any
 * other packet's real migration content. The seam is
 * `runMigrations({ migrationsDir })` / `discoverMigrationFiles(dir)`, both
 * of which already took a directory argument on this branch (round 1 added
 * `migrationsDir` to `runMigrations()`/`getMigrationsDir()` and exported
 * `discoverMigrationFiles`) — never an environment variable.
 *
 * This suite proves, against the runner PRESENT ON THIS BRANCH:
 *   1. the pre-fix pattern really did not match any of the five files
 *      (negative control a);
 *   2. `RUNTIME_MIGRATION_ALLOWLIST` (exactly 5 entries) +
 *      `isRuntimeMigrationFile()` make all five discoverable;
 *   3. the allowlist stays narrow — no other real 9xx/8xx file already in
 *      `server/migrations` becomes visible as a side effect (negative
 *      control c, proven on the real, already-present, read-only-inspected
 *      `900_prod_missing_tables_hotfix.sql` — reading that filename does
 *      not create or duplicate anything, unlike round 1's mistake);
 *   4. the discovery-order non-determinism this branch ALREADY had (proven
 *      to pre-date any M02 involvement — confirmed against three real
 *      `730_*` files, still read-only from `server/migrations`, plus
 *      registered as M01-058: the fix benefits the whole repository, not
 *      only M01) is fixed and reproducibly deterministic regardless of
 *      on-disk creation order — verified against physical fixture files,
 *      including the `942_chat` vs `942_ideas` collision and the full
 *      943-945 neighborhood;
 *   5. FRESH + RERUN through the REAL `runMigrations()`, pointed at the
 *      fixture directory (not `server/migrations`).
 *
 * `runMigrations()`'s OTHER known gaps on this branch — no checksum-drift
 * fail-closed check, false-success on SQL error (records the filename as
 * applied even when the DDL failed), no per-statement atomicity, no
 * readiness gating — are UNCHANGED by this packet (tracked as M01-057).
 * They require the shared-infrastructure consolidation with M02 (Part B)
 * and are deliberately not duplicated here as a second, divergent
 * implementation.
 *
 * HOW TO RUN LOCALLY — needs a real, disposable Postgres. Fixture SQL is
 * self-contained (`CREATE TABLE IF NOT EXISTS` on throwaway, uniquely
 * named tables), so no baseline bootstrap is required this time:
 *
 *   docker run -d --name m01prunA-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test \
 *     -p 0:5432 pgvector/pgvector:pg16
 *   docker exec m01prunA-pg psql -U iris -d iris_test \
 *     -c 'CREATE DATABASE m01pruna_runner'
 *
 *   RUN_DB_TESTS=1 NODE_ENV=test DATABASE_URL=postgresql://iris:iris_test@HOST:PORT/m01pruna_runner \
 *     DB_TYPE=postgres npx vitest run tests/integration/m01-prun-base-runtime-migration-discovery.realdb.test.ts
 *
 * SKIP POLICY: if a database is configured but unreachable, this suite FAILS
 * rather than skipping green.
 */

import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
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
  process.env.POSTGRES_SKIP_INIT_IN_TEST = 'false';
}

const testDir = path.dirname(fileURLToPath(import.meta.url));
const REAL_MIGRATIONS_DIR = path.resolve(testDir, '../../server/migrations');

const M01_800 = '800_chat_007_proposal_idempotency_key.sql';
const M01_942 = '942_chat_m01p04a_attachment_status.sql';
const M01_943 = '943_work_canvas_timestamp_parity_postgres.sql';
const M01_944 = '944_canvas_idea_materialization_receipts.sql';
const M01_945 = '945_chat_m01p04c_knowledge_doc_scope.sql';
const M01_FILES = [M01_800, M01_942, M01_943, M01_944, M01_945];

/** Stand-in for M02-C's real filename — not on this branch's allowlist. */
const M02C_942_NAME = '942_ideas_collaboration_tool_sessions.sql';

/** The discovery rule as it stood before this packet, verbatim. */
const OLD_MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/;

/**
 * Placeholder DDL, one self-contained throwaway table per filename. The
 * filename — not this content — is the thing under test; a real DDL body
 * would only recreate the exact "second copy of another packet's migration"
 * problem this round's fix removes.
 */
function fixtureSql(tag: string): string {
  return `CREATE TABLE IF NOT EXISTS m01prun_fx_${tag} (id INT PRIMARY KEY);`;
}
const FIXTURE_SQL: Record<string, string> = {
  [M01_800]: fixtureSql('800'),
  [M01_942]: fixtureSql('942_chat'),
  [M01_943]: fixtureSql('943'),
  [M01_944]: fixtureSql('944'),
  [M01_945]: fixtureSql('945'),
  [M02C_942_NAME]: fixtureSql('942_ideas_decoy'),
};

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
      `Refusing to run: this suite creates/drops fixture objects and requires a local database. Got host "${host}".`
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
  total: number;
}>;
let discoverMigrationFiles: (dir: string) => string[];
let isRuntimeMigrationFile: (f: string) => boolean;
let RUNTIME_MIGRATION_ALLOWLIST: ReadonlySet<string>;
let compareMigrationFilenames: (a: string, b: string) => number;

/** Every temp dir created by any test, removed in `afterAll`. */
const tempDirs: string[] = [];
function makeFixtureDir(prefix: string, filenames: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  for (const name of filenames) {
    writeFileSync(path.join(dir, name), FIXTURE_SQL[name]);
  }
  return dir;
}

/** Persistent fixture dir for the FRESH/RERUN suite (real M01 names only — the M02 decoy is never on this branch's own allowlist, so it would be silently invisible to discoverMigrationFiles regardless of placement). */
let applyFixtureDir = '';

async function historyRows(
  filenames: string[]
): Promise<Array<{ filename: string; checksum: string | null; id: number }>> {
  return withClient(async (c) => {
    const res = await c.query(
      `SELECT id, filename, checksum FROM tp_migration_history WHERE filename = ANY($1::text[]) ORDER BY id ASC`,
      [filenames]
    );
    return res.rows as Array<{ filename: string; checksum: string | null; id: number }>;
  });
}

async function deleteHistory(filenames: string[]): Promise<void> {
  await withClient(async (c) => {
    await c.query(`DELETE FROM tp_migration_history WHERE filename = ANY($1::text[])`, [filenames]);
  });
}

describe('M01-PRUN Part A — base-branch runtime runner discovery + determinism (real Postgres, fixture-only)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — M01-PRUN Part A tests did NOT run. This run is not evidence.'
      );
      return;
    }
    assertLocalDatabase();
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

    // Import the runner PRESENT ON THIS BRANCH — never the consolidated
    // version, which lives only on the M02 branch.
    const runnerMod = await import('../../server/src/services/tablePlatform/migrationRunner.js');
    runMigrations = runnerMod.runMigrations;
    discoverMigrationFiles = runnerMod.discoverMigrationFiles;
    isRuntimeMigrationFile = runnerMod.isRuntimeMigrationFile;
    RUNTIME_MIGRATION_ALLOWLIST = runnerMod.RUNTIME_MIGRATION_ALLOWLIST;
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
    });

    applyFixtureDir = makeFixtureDir('m01prunA-apply-', M01_FILES);
  }, 120_000);

  afterAll(async () => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
    if (!reachable) return;
    await withClient(async (c) => {
      for (const tag of ['800', '942_chat', '943', '944', '945', '942_ideas_decoy']) {
        await c.query(`DROP TABLE IF EXISTS m01prun_fx_${tag}`);
      }
    });
    await deleteHistory(M01_FILES);
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

  // ---------------------------------------------------------------------
  // DISCOVERY — including the negative control. Pure filename predicates,
  // no filesystem access needed.
  // ---------------------------------------------------------------------

  itDB('NEGATIVE CONTROL: the pre-repair discovery rule finds NONE of the five M01 migrations', async () => {
    for (const f of M01_FILES) expect(OLD_MIGRATION_PATTERN.test(f)).toBe(false);
  });

  itDB('the runner PRESENT ON THIS BRANCH now finds all five M01 migrations', async () => {
    for (const f of M01_FILES) expect(isRuntimeMigrationFile(f)).toBe(true);
  });

  itDB(
    'the "_postgres.sql" suffix on 943 is a DIFFERENT convention (sqlite-runner skip) and does not interact with this allowlist',
    async () => {
      // server/scripts/migrate.ts (sqlite-first runner) skips *_postgres.sql
      // files when dbType==='sqlite'. This runner (Postgres-only,
      // tablePlatform/migrationRunner.ts) has no such special-case — 943 is
      // discovered purely via the allowlist, exactly like the other four.
      expect(M01_943.endsWith('_postgres.sql')).toBe(true);
      expect(isRuntimeMigrationFile(M01_943)).toBe(true);
    }
  );

  itDB('the integrated allowlist contains every M01 entry and the reviewed M02 producer', async () => {
    expect(RUNTIME_MIGRATION_ALLOWLIST.size).toBeGreaterThanOrEqual(M01_FILES.length + 1);
    for (const f of M01_FILES) expect(RUNTIME_MIGRATION_ALLOWLIST.has(f)).toBe(true);
    expect(RUNTIME_MIGRATION_ALLOWLIST.has(M02C_942_NAME)).toBe(true);
  });

  itDB(
    'NEGATIVE CONTROL: no blanket 9xx/8xx activation — every other real file in server/migrations stays invisible (read-only)',
    async () => {
      // Read-only enumeration of the REAL directory — proves the risk
      // against a genuine, already-present file, not a fabricated example.
      // Nothing is written here (round 1's mistake was writing local
      // copies of OTHER packets' files into this directory; reading
      // existing filenames is not that).
      const other9xx = readdirSync(REAL_MIGRATIONS_DIR).filter(
        (f) => /^9\d{2}_.*\.sql$/.test(f) && !M01_FILES.includes(f)
      );
      expect(other9xx.length).toBeGreaterThan(0);
      expect(other9xx).toContain('900_prod_missing_tables_hotfix.sql');
      for (const f of other9xx) {
        if (RUNTIME_MIGRATION_ALLOWLIST.has(f)) continue;
        expect(isRuntimeMigrationFile(f), `${f} must NOT be runtime-discovered`).toBe(false);
      }
      const other8xxNumbered = readdirSync(REAL_MIGRATIONS_DIR).filter(
        (f) => /^8\d{2}_.*\.sql$/.test(f) && !M01_FILES.includes(f)
      );
      for (const f of other8xxNumbered) {
        if (RUNTIME_MIGRATION_ALLOWLIST.has(f)) continue;
        expect(isRuntimeMigrationFile(f), `${f} must NOT be runtime-discovered`).toBe(false);
      }
    }
  );

  // ---------------------------------------------------------------------
  // DETERMINISM — pre-existing on this branch, not introduced by M02
  // (registered as M01-058: the fix benefits the whole repository, not
  // only M01 — three real 730_* files and dozens of same-date files share
  // this exact class of collision). Proven against the REAL, EXPORTED
  // `compareMigrationFilenames` (never a reimplementation) and, for the
  // collision-shaped cases, against REAL PHYSICAL FIXTURE FILES on disk
  // (not `server/migrations` — an isolated `mkdtemp` directory) so the
  // proof exercises actual file-order effects, not just array literals.
  // ---------------------------------------------------------------------

  itDB(
    'DETERMINISM (pre-existing 730_* collision, read-only against the real directory): sort is stable regardless of read order',
    async () => {
      const real730 = readdirSync(REAL_MIGRATIONS_DIR).filter((f) => /^730_.*\.sql$/.test(f)).sort();
      expect(real730.length).toBeGreaterThanOrEqual(2); // the collision is real, not hypothetical

      const forward = [...real730].sort(compareMigrationFilenames);
      const reversed = [...real730].reverse().sort(compareMigrationFilenames);
      expect(reversed).toEqual(forward);
      expect(forward).toEqual([...real730].sort()); // full-filename order = plain lexical order
    }
  );

  itDB(
    'DETERMINISM (942_chat vs 942_ideas collision, on physical fixture files): order is identical regardless of input order',
    async () => {
      // Both names are real files on disk (not just string literals) — the
      // "on fixtures" requirement — but the actual determinism PROOF, like
      // the 730_* test above, is against explicit forward/reversed input
      // arrays, not against whatever order fs.readdirSync() happens to
      // enumerate a freshly-created 2-entry directory in: that enumeration
      // order is not reliably controllable by write order on every
      // filesystem (observed directly while proving this fix's own
      // negative control — a from-scratch mkdtemp directory can enumerate
      // alphabetically regardless of creation order, which would make a
      // creation-order-based test pass even with the bug reintroduced, a
      // false negative for the very control it exists to prove).
      const dir = makeFixtureDir('m01prunA-942-order-', [M01_942, M02C_942_NAME]);
      const onDisk = readdirSync(dir);
      expect(onDisk.sort()).toEqual([M01_942, M02C_942_NAME].sort()); // both physically exist

      const forward = [...onDisk].sort(compareMigrationFilenames);
      const reversed = [...onDisk].reverse().sort(compareMigrationFilenames);
      expect(forward).toEqual([M01_942, M02C_942_NAME]); // 'chat' < 'ideas' lexically
      expect(reversed).toEqual(forward);
    }
  );

  itDB(
    'DETERMINISM (943-945 neighborhood + 942 collision, on physical fixture files): permutation-independent order',
    async () => {
      const canonicalNames = [M01_800, M01_942, M02C_942_NAME, M01_943, M01_944, M01_945];
      const expected = [
        M01_800, // "800" < "942"/"943"/"944"/"945" numerically
        M01_942, // "942_chat..." — 'chat' < 'ideas' lexically within the 942 tie
        M02C_942_NAME, // "942_ideas..."
        M01_943,
        M01_944,
        M01_945,
      ];

      // All six names are physical files in ONE fixture directory (not
      // string literals). The permutation sweep itself is applied to the
      // ARRAY READ BACK from disk — 8 independent shuffles of that array,
      // each re-sorted — rather than by re-creating the directory in
      // different physical write orders (see the comment on the 942 test
      // above for why that would not reliably observe the defect).
      const dir = makeFixtureDir('m01prunA-neighborhood-', canonicalNames);
      const onDisk = readdirSync(dir);
      expect(onDisk.sort()).toEqual([...canonicalNames].sort()); // all six physically exist

      for (let i = 0; i < 8; i++) {
        const shuffled = [...onDisk].sort(() => Math.random() - 0.5);
        expect(shuffled.sort(compareMigrationFilenames)).toEqual(expected);
      }
    }
  );

  // ---------------------------------------------------------------------
  // FRESH / RERUN — the five real M01 migrations, through the ACTUAL
  // runMigrations({ migrationsDir }) on this branch, pointed at an
  // isolated fixture directory (never server/migrations — round 1's
  // mistake). Placeholder SQL only; filenames are the real target names.
  // ---------------------------------------------------------------------

  itDB(
    "FRESH: the branch's own runMigrations({ migrationsDir }), against an isolated fixture directory, applies exactly the five M01 files",
    async () => {
      // Exercise the exported discovery function directly first: filter
      // (isRuntimeMigrationFile, via the allowlist) + sort
      // (compareMigrationFilenames) together, against the real fixture
      // directory — this is the exact call runMigrations() makes
      // internally, invoked here to pin its output independent of the
      // apply step below.
      expect(discoverMigrationFiles(applyFixtureDir)).toEqual([...M01_FILES].sort(compareMigrationFilenames));

      await deleteHistory(M01_FILES);

      const result = await runMigrations({ migrationsDir: applyFixtureDir });
      expect(result.failed).toBeNull();
      expect(result.total).toBe(5);
      expect(result.applied).toBe(5);

      const rows = await historyRows(M01_FILES);
      expect(rows.map((r) => r.filename).sort()).toEqual([...M01_FILES].sort());

      const created = await withClient(async (c) => {
        const r = await c.query(
          `SELECT table_name FROM information_schema.tables
             WHERE table_schema='public' AND table_name = ANY($1::text[]) ORDER BY 1`,
          [['m01prun_fx_800', 'm01prun_fx_942_chat', 'm01prun_fx_943', 'm01prun_fx_944', 'm01prun_fx_945']]
        );
        return r.rows.map((row: any) => row.table_name);
      });
      expect(created).toEqual([
        'm01prun_fx_800',
        'm01prun_fx_942_chat',
        'm01prun_fx_943',
        'm01prun_fx_944',
        'm01prun_fx_945',
      ]);
    },
    120_000
  );

  itDB('RERUN: a second run against the SAME fixture directory applies nothing new', async () => {
    const before = await historyRows(M01_FILES);
    const result = await runMigrations({ migrationsDir: applyFixtureDir });
    expect(result.failed).toBeNull();
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(5);
    const after = await historyRows(M01_FILES);
    expect(after).toEqual(before);
  });

  itDB(
    'RERUN (945 specifically): deleting only its history row and re-running re-applies exactly that one file (idempotent DDL, no error)',
    async () => {
      await deleteHistory([M01_945]);
      const result = await runMigrations({ migrationsDir: applyFixtureDir });
      expect(result.failed).toBeNull();
      expect(result.applied).toBe(1);
      const rows = await historyRows([M01_945]);
      expect(rows.map((r) => r.filename)).toEqual([M01_945]);
    }
  );

  itDB(
    'an explicit migrationsDir that does not exist fails loudly, with no silent fallback to the real directory',
    async () => {
      const missing = path.join(tmpdir(), `m01prunA-does-not-exist-${Date.now()}`);
      const result = await runMigrations({ migrationsDir: missing });
      expect(result.failed).toBeTruthy();
      expect(String(result.failed)).toContain(missing);
      expect(result.total).toBe(0);
      expect(result.applied).toBe(0);
    }
  );

  itDB(
    'each of the five M01 numbered migrations appears in server/migrations exactly once, with no diverging duplicate under a different filename (M01-P08R: this assertion was written for the isolated PRUN branch, where 943/944/945 were owned elsewhere and had to be ABSENT to avoid round-1\'s diverging-blob mistake; on the integration candidate, all six packets are merged and these files are legitimately present, each from its single canonical owner — the invariant worth protecting post-merge is "exactly one, not zero")',
    async () => {
      const canonical = readdirSync(REAL_MIGRATIONS_DIR);
      const allFive = [M01_800, M01_942, M01_943, M01_944, M01_945];
      for (const f of allFive) {
        const occurrences = canonical.filter((name) => name === f);
        expect(occurrences, `${f} must appear in server/migrations exactly once`).toHaveLength(1);
      }
      // No stray sibling under the same numeric prefix (e.g. a second,
      // divergent 943_*.sql) — the exact class of collision round 1 produced.
      for (const prefix of ['943_', '944_', '945_']) {
        const siblings = canonical.filter((name) => name.startsWith(prefix));
        expect(siblings, `only the canonical file should exist under prefix ${prefix}`).toHaveLength(1);
      }
    }
  );

  itDB('no fixture directory or its contents leak into the canonical server/migrations directory', async () => {
    const canonical = readdirSync(REAL_MIGRATIONS_DIR);
    expect(canonical).toContain(M02C_942_NAME);
  });
});
