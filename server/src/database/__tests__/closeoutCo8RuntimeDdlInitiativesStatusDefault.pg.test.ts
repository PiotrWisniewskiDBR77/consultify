/**
 * CLOSEOUT-08 — the RUNTIME bootstrap DDL must not reintroduce the broken
 * `initiatives.status` default, proved against a REAL PostgreSQL.
 *
 * ===========================================================================
 * WHAT WAS BROKEN
 * ===========================================================================
 * `PostgresDatabase.ts` `initDb()` creates `initiatives` inline with
 * `status TEXT DEFAULT 'step3'`. `'step3'` is NOT one of the 13 canonical
 * statuses (SSOT: `server/src/constants/initiativeStatuses.ts`), and migration
 * `20260624_initiative_status_normalize.sql` installs
 * `initiatives_status_check` over exactly those 13 values. A table produced by
 * the runtime DDL therefore carries a DEFAULT that its own CHECK rejects:
 * every `INSERT INTO initiatives` that omits `status` dies with
 * `new row ... violates check constraint "initiatives_status_check"`.
 *
 * CLOSEOUT-2 repaired this with migration
 * `20260821_initiatives_status_default_draft.sql`, but that only heals a
 * database that RUNS MIGRATIONS. The runtime DDL is a SECOND, independent
 * producer of this table — it fires from `getPool()` on app boot whenever
 * `DB_MANAGED_SCHEMA` is not disabled — so the "thin bootstrap" path
 * (`initDb()` creates the schema, migrations stopped at `000_*` or never ran)
 * kept reproducing the defect from source.
 *
 * ===========================================================================
 * WHY THIS IS A REAL-DATABASE TEST AND NOT A STRING ASSERTION
 * ===========================================================================
 * A static assertion ("the literal 'step3' does not appear next to status")
 * would pass on any DDL that is merely differently-worded, and could not see
 * the thing that actually matters: whether the default the runtime DDL
 * produces SURVIVES the canonical CHECK. So this suite:
 *
 *   1. creates its OWN throwaway database (nothing pre-existing is touched,
 *      and `CREATE TABLE IF NOT EXISTS` cannot silently no-op against a table
 *      some earlier run left behind — the freshness is what makes the
 *      assertion about the runtime DDL true rather than incidental);
 *   2. runs the REAL exported `initDb()` against it;
 *   3. applies the REAL migration that installs `initiatives_status_check`;
 *   4. inserts an initiative WITHOUT a status and requires it to land as
 *      `DRAFT`.
 *
 * Step 4 is the falsifiable one. Revert `PostgresDatabase.ts` to
 * `DEFAULT 'step3'` and step 4 fails with the CHECK violation above (verified
 * as the negative control for this packet).
 *
 * ===========================================================================
 * HOW TO RUN
 * ===========================================================================
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DB_MANAGED_SCHEMA=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/postgres \
 *   npx vitest run src/database/__tests__/closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts
 *
 * (run from `server/`).
 *
 * `NODE_ENV=test` ALONE IS A TRAP: without `RUN_DB_TESTS=1` and
 * `MOCK_DB=false` the data layer hands back an in-memory mock and the suite
 * would go green without touching a database.
 *
 * `DB_MANAGED_SCHEMA=false` is load-bearing HERE and only here: it suppresses
 * the automatic schema init that `getPool()` kicks off, so `initDb()` runs
 * EXACTLY ONCE. Without it two concurrent `CREATE TABLE IF NOT EXISTS` passes
 * race and Postgres raises `duplicate key value violates unique constraint
 * "pg_type_typname_nsp_index"`. It does not weaken the test: this file calls
 * `initDb()` itself.
 *
 * SKIP POLICY: same contract as the sibling realdb suites — a clean vacuous
 * pass when no Postgres is configured/reachable (or when the login cannot
 * create databases), a real reported failure once it IS reachable.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PROBE_TIMEOUT_MS = 10_000;

/** SSOT: server/src/constants/initiativeStatuses.ts (enum InitiativeStatus). */
const CANONICAL_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'REVIEW',
  'PROMOTED',
  'PLANNING',
  'APPROVED',
  'SCHEDULED',
  'EXECUTING',
  'BLOCKED',
  'DONE',
  'TRACKING',
  'CANCELLED',
  'ARCHIVED',
] as const;

/** Documented entry state of the initiative lifecycle. */
const EXPECTED_DEFAULT = 'DRAFT';

const NORMALIZE_MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../migrations/20260624_initiative_status_normalize.sql'
);

const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const SCRATCH_DB = `co8_runtime_ddl_${tag}`;
const ORG_ID = `co8-org-${tag}`;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Railway-style unexpanded template -> not a usable URL.
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

/** Admin connection config, always pointed at the `postgres` maintenance DB. */
function buildAdminConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    let parsed: URL;
    try {
      parsed = new URL(databaseUrl);
    } catch {
      return null;
    }
    parsed.pathname = '/postgres';
    return {
      connectionString: parsed.toString(),
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 30_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 30_000,
  };
}

/** Same shape as the admin config, but aimed at the scratch database. */
function buildScratchConfig(): ClientConfig {
  const admin = buildAdminConfig() as any;
  if (admin.connectionString) {
    const parsed = new URL(admin.connectionString);
    parsed.pathname = `/${SCRATCH_DB}`;
    return { ...admin, connectionString: parsed.toString() };
  }
  return { ...admin, database: SCRATCH_DB };
}

function scratchDatabaseUrl(): string {
  const cfg = buildScratchConfig() as any;
  if (cfg.connectionString) return cfg.connectionString as string;
  const user = encodeURIComponent(cfg.user ?? 'postgres');
  const pass = cfg.password ? `:${encodeURIComponent(cfg.password)}` : '';
  return `postgresql://${user}${pass}@${cfg.host}:${cfg.port}/${SCRATCH_DB}`;
}

const ADMIN_CONFIG = buildAdminConfig();

/**
 * `false` until `beforeAll` has actually stood the scratch database up and run
 * the runtime DDL against it. Every `it()` short-circuits on it, so an
 * unreachable / unprivileged environment produces a vacuous pass rather than a
 * wall of misleading red.
 */
let ready = false;
let skipReason = 'no PostgreSQL configured (DATABASE_URL / PGHOST unset)';
let scratchClient: Client | null = null;
let adminClient: Client | null = null;

async function tryConnect(config: ClientConfig): Promise<Client | null> {
  const client = new Client(config);
  try {
    await client.connect();
    return client;
  } catch {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return null;
  }
}

beforeAll(async () => {
  if (!ADMIN_CONFIG) return;

  adminClient = await tryConnect(ADMIN_CONFIG);
  if (!adminClient) {
    skipReason = 'PostgreSQL configured but not reachable';
    return;
  }

  try {
    await adminClient.query(`CREATE DATABASE "${SCRATCH_DB}"`);
  } catch (e: any) {
    skipReason = `cannot create scratch database (${e?.message ?? e})`;
    return;
  }

  // Point the app's data layer at the scratch DB BEFORE it is first touched.
  // `DatabaseConfig` is a lazy Proxy, so this is read on first access, which
  // the dynamic import below is the first thing to trigger.
  process.env.DATABASE_URL = scratchDatabaseUrl();
  process.env.DB_TYPE = 'postgres';
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  // Run initDb() exactly once, from here — see the header note.
  process.env.DB_MANAGED_SCHEMA = 'false';
  delete process.env.PGDATABASE;

  const { initDb } = await import('../PostgresDatabase.js');
  await initDb();

  scratchClient = await tryConnect(buildScratchConfig());
  if (!scratchClient) {
    skipReason = 'scratch database created but not reachable';
    return;
  }

  // Guard against the silent `testDatabaseOverride` fallback in
  // PostgresDatabase.ts, which redirects to the `postgres` database when the
  // login cannot create one. If that fired, initDb() wrote somewhere else and
  // every assertion below would be about the wrong table.
  const created = await scratchClient.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'initiatives'`
  );
  if (created.rows[0]?.n !== 1) {
    skipReason = 'initDb() did not create initiatives in the scratch database';
    return;
  }

  ready = true;
}, 300_000);

afterAll(async () => {
  if (scratchClient) {
    try {
      await scratchClient.end();
    } catch {
      /* ignore */
    }
  }
  try {
    const { closePool } = (await import('../PostgresDatabase.js')) as any;
    if (typeof closePool === 'function') await closePool();
  } catch {
    /* ignore */
  }
  if (adminClient) {
    try {
      await adminClient.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [SCRATCH_DB]
      );
      await adminClient.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`);
    } catch {
      /* ignore */
    }
    try {
      await adminClient.end();
    } catch {
      /* ignore */
    }
  }
}, 120_000);

/** The literal default, e.g. `'DRAFT'::text`, unwrapped to `DRAFT`. */
async function statusColumnDefault(): Promise<string | null> {
  const res = await scratchClient!.query<{ column_default: string | null }>(
    `SELECT column_default FROM information_schema.columns
      WHERE table_name = 'initiatives' AND column_name = 'status'`
  );
  const raw = res.rows[0]?.column_default ?? null;
  if (raw === null) return null;
  const m = raw.match(/^'((?:[^']|'')*)'(?:::[\w ]+)?$/);
  return m ? m[1].replace(/''/g, "'") : raw;
}

describe('CLOSEOUT-08 — runtime bootstrap DDL: initiatives.status default', () => {
  it('reports why it is skipping, if it is', () => {
    if (!ready) {
      // eslint-disable-next-line no-console
      console.warn(`[CLOSEOUT-08] SKIPPED — ${skipReason}`);
    }
    expect(true).toBe(true);
  });

  it('initDb() gives status a default drawn from the canonical status list', async () => {
    if (!ready) return;
    const def = await statusColumnDefault();
    expect(def).not.toBeNull();
    expect(def).not.toBe('step3');
    expect(CANONICAL_STATUSES as readonly string[]).toContain(def!);
    expect(def).toBe(EXPECTED_DEFAULT);
  });

  it('a status-less INSERT survives initiatives_status_check and lands as DRAFT', async () => {
    if (!ready) return;

    // Install the canonical CHECK exactly as production does — by running the
    // real migration file, not a hand-copied constraint that could drift.
    const migration = readFileSync(NORMALIZE_MIGRATION_PATH, 'utf8');
    await scratchClient!.query(migration);

    const constraint = await scratchClient!.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = 'initiatives_status_check'`
    );
    // Precondition: without the CHECK this test proves nothing.
    expect(constraint.rowCount).toBe(1);
    expect(constraint.rows[0]!.def).not.toContain('step3');

    await scratchClient!.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, 'CLOSEOUT-08 fixture']
    );

    const id = `co8-init-${tag}`;
    // No `status` column -> the DDL default is what gets written. This is the
    // statement that failed outright before the fix.
    await scratchClient!.query(
      `INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`,
      [id, ORG_ID, 'CLOSEOUT-08 default-status initiative']
    );

    const row = await scratchClient!.query<{ status: string }>(
      `SELECT status FROM initiatives WHERE id = $1`,
      [id]
    );
    expect(row.rowCount).toBe(1);
    expect(row.rows[0]!.status).toBe(EXPECTED_DEFAULT);
  }, 60_000);

  it('still rejects an explicit step3, so the CHECK is genuinely enforcing', async () => {
    if (!ready) return;
    await expect(
      scratchClient!.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'step3')`,
        [`co8-reject-${tag}`, ORG_ID, 'CLOSEOUT-08 explicit step3 must be rejected']
      )
    ).rejects.toThrow(/initiatives_status_check/);
  });

  /**
   * WEAKER ON PURPOSE — and it needs no database, so it also guards CI runs
   * that skip everything above.
   *
   * `000_initdb_core_tables.sql` is a MECHANICAL COPY of the runtime DDL
   * (`server/scripts/extract-initdb-migration.js` regenerates it by regexing
   * the `CREATE TABLE IF NOT EXISTS` blocks out of PostgresDatabase.ts), and
   * `000_z_core_baseline.sql` is the hand-maintained twin of the same tables.
   * Both are executed directly by `server/scripts/run-initdb.js` — a bootstrap
   * path that never reaches migration 20260821 — so each carried its own copy
   * of the defect.
   *
   * A text assertion cannot prove those files behave; it only proves the
   * literal is gone. The behavioural proof above covers the runtime DDL, which
   * is the SOURCE all three share.
   */
  it('no bootstrap SQL twin re-declares the broken default (static guard)', () => {
    const files = ['000_initdb_core_tables.sql', '000_z_core_baseline.sql'];
    for (const file of files) {
      const sql = readFileSync(path.resolve(__dirname, '../../../migrations', file), 'utf8');
      // Any `status ... DEFAULT 'step3'` declaration, CREATE TABLE or ADD COLUMN.
      const offenders = sql
        .split('\n')
        .filter((line) => /\bstatus\b[^\n]*DEFAULT\s+'step3'/i.test(line) && !/^\s*--/.test(line));
      expect(offenders, `${file} still declares DEFAULT 'step3'`).toEqual([]);
    }
  });
});
