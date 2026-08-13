/**
 * CLOSEOUT-08 — the RUNTIME bootstrap DDL must not reintroduce the broken
 * `initiatives.status` default, proved against a REAL PostgreSQL.
 *
 * ===========================================================================
 * WHAT WAS BROKEN
 * ===========================================================================
 * `PostgresDatabase.ts` `initDb()` used to create `initiatives` inline with
 * `status TEXT DEFAULT 'step3'`. `'step3'` is NOT one of the 13 canonical
 * statuses (SSOT: `server/src/constants/initiativeStatuses.ts`), and migration
 * `20260624_initiative_status_normalize.sql` installs
 * `initiatives_status_check` over exactly those 13 values. A table produced by
 * the runtime DDL therefore carried a DEFAULT that its own CHECK rejects:
 * every `INSERT INTO initiatives` that omits `status` died with
 * `new row ... violates check constraint "initiatives_status_check"`.
 *
 * CLOSEOUT-2 repaired databases that RUN MIGRATIONS via the additive migration
 * `20260821_initiatives_status_default_draft.sql`. The runtime DDL is a SECOND,
 * independent producer of this table — it fires from `getPool()` on app boot
 * whenever `DB_MANAGED_SCHEMA` is not disabled — so the "thin bootstrap" path
 * (`initDb()` creates the schema, migrations stopped at `000_*` or never ran)
 * kept reproducing the defect from source. That second producer is what this
 * suite pins.
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
 *      `DRAFT`, with the write proved PHYSICAL (see "PROOF OF WORK" below).
 *
 * Step 4 is the falsifiable one. Revert `PostgresDatabase.ts` to
 * `DEFAULT 'step3'` and step 4 fails with the CHECK violation above (re-run as
 * the negative control for INTEGRITY-02).
 *
 * ===========================================================================
 * INTEGRITY-02 — FAIL-CLOSED GATE (this is the point of the file's rewrite)
 * ===========================================================================
 * The previous revision skipped — silently and greenly — whenever Postgres was
 * absent OR merely unreachable. Verified experimentally: pointed at a port
 * with no server behind it, the suite reported `5 passed` and exit 0. In CI
 * without Postgres that is a FALSE GREEN: the whole CLOSEOUT-08 evidence chain
 * rested on a suite that had proved nothing.
 *
 * The gate is now asymmetric, and keyed on `RUN_DB_TESTS` READ AT MODULE LOAD
 * (before `beforeAll` mutates the environment — a suite must not talk itself
 * into its own preconditions):
 *
 *   - `RUN_DB_TESTS` UNSET (or an explicit opt-out: ``/`0`/`false`/`no`/`off`)
 *     -> the caller has not asked for database coverage. LOUD skip, exit 0.
 *     This is the local-dev-without-Postgres path and the ONLY path on which a
 *     skip is legal.
 *   - `RUN_DB_TESTS` set to anything else (canonically `1`)
 *     -> the caller has asserted a database is available. Every degradation is
 *     now a FAILURE with a diagnostic message: `MOCK_DB` not exactly `false`,
 *     no `DATABASE_URL`/`PGHOST`, server unreachable, cannot create the scratch
 *     database, `initDb()` throwing, or the scratch database not actually
 *     carrying the table. No silent downgrade to "vacuous pass" exists any more.
 *
 * ===========================================================================
 * PROOF OF WORK — "ready" and "the INSERT physically happened"
 * ===========================================================================
 * Green is only allowed to mean "the assertions ran against a real database".
 * Three independent controls enforce that, and their results are printed as an
 * evidence block at the end of the run:
 *
 *   (a) TARGET CONTROL. `initDb()` can be silently redirected: on a login that
 *       cannot `CREATE DATABASE`, `PostgresDatabase.ts` sets
 *       `testDatabaseOverride = 'postgres'` and writes into the MAINTENANCE
 *       database instead. So we (i) ask the APP'S OWN pool for
 *       `current_database()` and require it to equal our scratch database, and
 *       (ii) snapshot whether `initiatives` exists in `postgres` BEFORE
 *       `initDb()` and fail if the table appeared there afterwards.
 *   (b) SCHEMA CONTROL. `initiatives` must exist in the scratch database — the
 *       positive counterpart to (a), and the thing that makes "the runtime DDL
 *       ran" a fact rather than an assumption.
 *   (c) WRITE CONTROL. Every fixture INSERT asserts `rowCount === 1`, and the
 *       row is then re-read over a SECOND, INDEPENDENT CONNECTION to the same
 *       database. A same-session `SELECT` would also see an uncommitted or
 *       session-local row; a different connection only sees a committed one.
 *       This is the control that already caught a false proof elsewhere in
 *       this workstream (an `UPDATE 0` reading as PASS because the fixture row
 *       had never been created).
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
 * `MOCK_DB=false` the data layer hands back an in-memory mock. That trap is
 * now closed from the other side too — with `RUN_DB_TESTS=1` set, a missing
 * `MOCK_DB=false` is a hard failure rather than a skip.
 *
 * `DB_MANAGED_SCHEMA=false` is load-bearing HERE and only here: it suppresses
 * the automatic schema init that `getPool()` kicks off, so `initDb()` runs
 * EXACTLY ONCE. Without it two concurrent `CREATE TABLE IF NOT EXISTS` passes
 * race and Postgres raises `duplicate key value violates unique constraint
 * "pg_type_typname_nsp_index"`. It does not weaken the test: this file calls
 * `initDb()` itself.
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

const RUNTIME_DDL_PATH = path.resolve(__dirname, '../PostgresDatabase.ts');

const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const SCRATCH_DB = `co8_runtime_ddl_${tag}`;
const ORG_ID = `co8-org-${tag}`;

// ---------------------------------------------------------------------------
// INTEGRITY-02 gate
// ---------------------------------------------------------------------------

/**
 * Read ONCE, at module load, i.e. strictly before `beforeAll` starts writing
 * `process.env`. The old revision set `MOCK_DB=false` / `RUN_DB_TESTS=1` on
 * itself and then had no way to tell an honestly-configured run from one that
 * had been repaired in-flight.
 */
const ENV_AT_LOAD = Object.freeze({
  RUN_DB_TESTS: process.env.RUN_DB_TESTS,
  MOCK_DB: process.env.MOCK_DB,
  DB_TYPE: process.env.DB_TYPE,
  DATABASE_URL: process.env.DATABASE_URL,
  PGHOST: process.env.PGHOST,
  DB_HOST: process.env.DB_HOST,
  DB_MANAGED_SCHEMA: process.env.DB_MANAGED_SCHEMA,
});

/** Values that mean "the caller deliberately did NOT ask for a database". */
const OPT_OUT_VALUES = new Set(['', '0', 'false', 'no', 'off']);

/**
 * True => a real database was PROMISED, so every degradation is a failure.
 * False => nobody promised one, so a loud skip is the honest outcome.
 */
const DB_REQUIRED =
  ENV_AT_LOAD.RUN_DB_TESTS !== undefined &&
  !OPT_OUT_VALUES.has(String(ENV_AT_LOAD.RUN_DB_TESTS).trim().toLowerCase());

const FAIL_BANNER =
  '[CLOSEOUT-08 / INTEGRITY-02] FAIL-CLOSED: RUN_DB_TESTS demanded a real ' +
  'PostgreSQL, so this suite refuses to report a vacuous pass.';

function envDump(): string {
  const shown = (v: string | undefined) => (v === undefined ? '<unset>' : JSON.stringify(v));
  return [
    '  environment as read at module load:',
    `    RUN_DB_TESTS      = ${shown(ENV_AT_LOAD.RUN_DB_TESTS)}`,
    `    MOCK_DB           = ${shown(ENV_AT_LOAD.MOCK_DB)}`,
    `    DB_TYPE           = ${shown(ENV_AT_LOAD.DB_TYPE)}`,
    `    DB_MANAGED_SCHEMA = ${shown(ENV_AT_LOAD.DB_MANAGED_SCHEMA)}`,
    `    DATABASE_URL      = ${shown(redactUrl(ENV_AT_LOAD.DATABASE_URL))}`,
    `    PGHOST            = ${shown(ENV_AT_LOAD.PGHOST)}`,
    `    DB_HOST           = ${shown(ENV_AT_LOAD.DB_HOST)}`,
    '  to run without a database, unset RUN_DB_TESTS (the suite then skips loudly).',
  ].join('\n');
}

function redactUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return raw;
  }
}

/** Thrown on the legal (RUN_DB_TESTS unset) skip path only, inside `beforeAll`. */
class SoftSkip extends Error {}

let skipReason = 'no PostgreSQL configured (DATABASE_URL / PGHOST unset)';

/**
 * The single decision point. Under `DB_REQUIRED` it raises a diagnostic error
 * (the suite goes RED); otherwise it records the reason and unwinds to a loud
 * skip. There is deliberately no third outcome.
 */
function abort(reason: string): never {
  if (DB_REQUIRED) {
    throw new Error(`${FAIL_BANNER}\n  reason: ${reason}\n${envDump()}`);
  }
  skipReason = reason;
  throw new SoftSkip(reason);
}

// ---------------------------------------------------------------------------
// connection plumbing
// ---------------------------------------------------------------------------

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
  const admin = ADMIN_CONFIG as any;
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

/** Connects, or `abort()`s with the driver's own message attached. */
async function connectOrAbort(config: ClientConfig, what: string): Promise<Client> {
  const client = new Client(config);
  try {
    await client.connect();
    return client;
  } catch (e: any) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return abort(`${what} — ${e?.code ? `${e.code}: ` : ''}${e?.message ?? e}`);
  }
}

// ---------------------------------------------------------------------------
// evidence — printed at the end of the run so a green result is auditable
// ---------------------------------------------------------------------------

const evidence = {
  gate: DB_REQUIRED ? 'REQUIRED (fail-closed)' : 'OPTIONAL (skip allowed)',
  scratchDatabase: SCRATCH_DB,
  appPoolCurrentDatabase: null as string | null,
  initiativesPresentInScratchDb: false,
  initiativesLeakedIntoMaintenanceDb: null as boolean | null,
  organizationInsertRowCount: null as number | null,
  initiativeInsertRowCount: null as number | null,
  initiativesRowDelta: null as number | null,
  readBackOnSecondConnection: null as string | null,
};

let ready = false;
let scratchClient: Client | null = null;
/** Deliberately a SEPARATE connection: only sees COMMITTED rows. */
let verifyClient: Client | null = null;
let adminClient: Client | null = null;

async function bootstrap(): Promise<void> {
  // --- gate ---------------------------------------------------------------
  if (DB_REQUIRED) {
    const mock = String(ENV_AT_LOAD.MOCK_DB ?? '')
      .trim()
      .toLowerCase();
    if (mock !== 'false') {
      abort(
        `MOCK_DB must be exactly "false" when RUN_DB_TESTS is set, otherwise the ` +
          `data layer serves an in-memory mock and nothing below touches Postgres`
      );
    }
  }
  if (!ADMIN_CONFIG) {
    abort('no usable PostgreSQL endpoint (DATABASE_URL / PGHOST unset or unparseable)');
  }

  // --- reachability -------------------------------------------------------
  adminClient = await connectOrAbort(ADMIN_CONFIG, 'cannot reach the configured PostgreSQL');

  // (a) TARGET CONTROL, part 1: snapshot the maintenance database BEFORE
  // initDb(), so a later appearance of `initiatives` there is attributable to
  // the testDatabaseOverride redirect and not to pre-existing content.
  const maintenanceBefore = await maintenanceHasInitiatives();

  try {
    await adminClient.query(`CREATE DATABASE "${SCRATCH_DB}"`);
  } catch (e: any) {
    abort(`cannot create the scratch database "${SCRATCH_DB}" (${e?.message ?? e})`);
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

  // --- the real runtime DDL ----------------------------------------------
  let initDb: () => Promise<void>;
  let acquirePgClient: () => Promise<any>;
  try {
    ({ initDb, acquirePgClient } = (await import('../PostgresDatabase.js')) as any);
  } catch (e: any) {
    return abort(`cannot import PostgresDatabase (${e?.message ?? e})`);
  }
  try {
    await initDb();
  } catch (e: any) {
    abort(`initDb() threw against the scratch database (${e?.message ?? e})`);
  }

  // (a) TARGET CONTROL, part 2: ask the APP'S OWN pool where it is. If
  // `testDatabaseOverride` fired, this says `postgres` and every assertion
  // below would have been about the wrong table.
  try {
    const poolClient = await acquirePgClient();
    try {
      const res = await poolClient.query('SELECT current_database() AS db');
      evidence.appPoolCurrentDatabase = res.rows[0]?.db ?? null;
    } finally {
      poolClient.release();
    }
  } catch (e: any) {
    abort(`cannot ask the app pool for current_database() (${e?.message ?? e})`);
  }
  if (evidence.appPoolCurrentDatabase !== SCRATCH_DB) {
    abort(
      `initDb() ran against "${evidence.appPoolCurrentDatabase}", not the scratch database ` +
        `"${SCRATCH_DB}" — the testDatabaseOverride fallback in PostgresDatabase.ts redirected it`
    );
  }

  const maintenanceAfter = await maintenanceHasInitiatives();
  evidence.initiativesLeakedIntoMaintenanceDb = !maintenanceBefore && maintenanceAfter;
  if (evidence.initiativesLeakedIntoMaintenanceDb) {
    abort('initDb() created `initiatives` in the `postgres` maintenance database');
  }

  // --- (b) SCHEMA CONTROL --------------------------------------------------
  scratchClient = await connectOrAbort(
    buildScratchConfig(),
    `scratch database "${SCRATCH_DB}" created but not reachable`
  );
  verifyClient = await connectOrAbort(
    buildScratchConfig(),
    `cannot open the independent verification connection to "${SCRATCH_DB}"`
  );

  const created = await scratchClient.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'initiatives'`
  );
  if (created.rows[0]?.n !== 1) {
    abort(`initDb() did not create \`initiatives\` in the scratch database "${SCRATCH_DB}"`);
  }
  evidence.initiativesPresentInScratchDb = true;
}

async function maintenanceHasInitiatives(): Promise<boolean> {
  const res = await adminClient!.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'initiatives'`
  );
  return (res.rows[0]?.n ?? 0) > 0;
}

beforeAll(async () => {
  try {
    await bootstrap();
    ready = true;
  } catch (e) {
    if (e instanceof SoftSkip) return; // legal skip path only
    throw e; // fail-closed: vitest reports this file as FAILED
  }
}, 300_000);

afterAll(async () => {
  for (const c of [verifyClient, scratchClient]) {
    if (!c) continue;
    try {
      await c.end();
    } catch {
      /* ignore */
    }
  }
  try {
    const mod = (await import('../PostgresDatabase.js')) as any;
    if (typeof mod.closePool === 'function') await mod.closePool();
    else if (mod.default && typeof mod.default.close === 'function') await mod.default.close();
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
  // eslint-disable-next-line no-console
  console.info(
    `[CLOSEOUT-08] proof-of-work evidence:\n${JSON.stringify(evidence, null, 2)}`
  );
}, 120_000);

/**
 * Every database-backed `it()` funnels through this — no bare
 * `if (!ready) return`, which is exactly how the previous revision turned an
 * unreachable database into five green checkmarks.
 *
 * Under `DB_REQUIRED` it throws. Otherwise it calls `ctx.skip()`, so the test
 * is reported as SKIPPED rather than PASSED. That distinction is the whole
 * point: vitest's DEFAULT reporter prints no console output at all (verified —
 * the `console.warn` banner below is invisible unless `--reporter=verbose`),
 * so the only "loud" channel that survives a plain CI run is the summary line,
 * which then reads `Tests 1 passed | 4 skipped` instead of `5 passed`.
 */
function requireReady(ctx: { skip: (note?: string) => void }): boolean {
  if (ready) return true;
  if (DB_REQUIRED) {
    throw new Error(`${FAIL_BANNER}\n  reason: bootstrap did not reach ready state\n${envDump()}`);
  }
  ctx.skip(`[CLOSEOUT-08] not verified — ${skipReason} (RUN_DB_TESTS unset)`);
  return false;
}

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
  it('INTEGRITY-02 gate: green means a real database was reached, or the run is loudly skipped', (ctx) => {
    if (DB_REQUIRED) {
      // Unreachable in practice — `beforeAll` already rethrows — but it keeps
      // the invariant asserted rather than merely implied.
      expect(ready, 'RUN_DB_TESTS is set, so the suite must have reached a real database').toBe(
        true
      );
      expect(evidence.appPoolCurrentDatabase).toBe(SCRATCH_DB);
      expect(evidence.initiativesPresentInScratchDb).toBe(true);
      expect(evidence.initiativesLeakedIntoMaintenanceDb).toBe(false);
      return;
    }
    if (!ready) {
      // eslint-disable-next-line no-console
      console.warn(
        [
          '',
          '='.repeat(78),
          '[CLOSEOUT-08] SKIPPED — NOTHING BELOW WAS VERIFIED.',
          `  reason: ${skipReason}`,
          '  RUN_DB_TESTS is unset, so no database was promised and no database was used.',
          '  This run is NOT evidence for CLOSEOUT-08. Re-run with RUN_DB_TESTS=1 MOCK_DB=false',
          '  and a reachable DATABASE_URL to obtain evidence; in that mode every degradation',
          '  below is a hard failure instead of a skip.',
          '='.repeat(78),
          '',
        ].join('\n')
      );
    }
    // Reported as SKIPPED, not PASSED — see `requireReady`.
    requireReady(ctx);
  });

  it('initDb() gives status a default drawn from the canonical status list', async (ctx) => {
    if (!requireReady(ctx)) return;
    const def = await statusColumnDefault();
    expect(def).not.toBeNull();
    expect(def).not.toBe('step3');
    expect(CANONICAL_STATUSES as readonly string[]).toContain(def!);
    expect(def).toBe(EXPECTED_DEFAULT);
  });

  it('a status-less INSERT physically lands, survives initiatives_status_check, and reads back as DRAFT', async (ctx) => {
    if (!requireReady(ctx)) return;

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

    // (c) WRITE CONTROL. The fixture org is inserted WITHOUT `ON CONFLICT`, so
    // `rowCount` is a truthful "a row was written" signal rather than a
    // silently-absorbed no-op. The scratch database is brand new; a conflict
    // here would itself be a finding.
    const orgInsert = await scratchClient!.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2)`,
      [ORG_ID, 'CLOSEOUT-08 fixture']
    );
    evidence.organizationInsertRowCount = orgInsert.rowCount;
    expect(orgInsert.rowCount, 'fixture organization must physically insert').toBe(1);

    const orgConfirmed = await verifyClient!.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM organizations WHERE id = $1`,
      [ORG_ID]
    );
    expect(
      orgConfirmed.rows[0]?.n,
      'fixture organization must be visible on an independent connection before it is used'
    ).toBe(1);

    const before = await verifyClient!.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM initiatives`
    );

    const id = `co8-init-${tag}`;
    // No `status` column -> the DDL default is what gets written. This is the
    // statement that failed outright before the fix.
    const insert = await scratchClient!.query(
      `INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`,
      [id, ORG_ID, 'CLOSEOUT-08 default-status initiative']
    );
    evidence.initiativeInsertRowCount = insert.rowCount;
    expect(insert.rowCount, 'the status-less INSERT must physically write exactly one row').toBe(1);

    const after = await verifyClient!.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM initiatives`
    );
    evidence.initiativesRowDelta = (after.rows[0]?.n ?? 0) - (before.rows[0]?.n ?? 0);
    expect(evidence.initiativesRowDelta, 'initiatives row count must grow by exactly one').toBe(1);

    // Independent connection: a row visible here is a COMMITTED row.
    const row = await verifyClient!.query<{ status: string }>(
      `SELECT status FROM initiatives WHERE id = $1`,
      [id]
    );
    expect(row.rowCount, 'the inserted row must be readable on a second connection').toBe(1);
    evidence.readBackOnSecondConnection = row.rows[0]!.status;
    expect(row.rows[0]!.status).toBe(EXPECTED_DEFAULT);
  }, 60_000);

  it('still rejects an explicit step3, so the CHECK is genuinely enforcing', async (ctx) => {
    if (!requireReady(ctx)) return;
    await expect(
      scratchClient!.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'step3')`,
        [`co8-reject-${tag}`, ORG_ID, 'CLOSEOUT-08 explicit step3 must be rejected']
      )
    ).rejects.toThrow(/initiatives_status_check/);
  });

  /**
   * STATIC GUARD — REPOINTED AT THE SOURCE (INTEGRITY-02).
   *
   * The previous revision asserted that `000_initdb_core_tables.sql` and
   * `000_z_core_baseline.sql` no longer contain `DEFAULT 'step3'`. That guard
   * has been retired, deliberately, for two reasons:
   *
   *   1. It encoded the WRONG repair. Both files are ALREADY-APPLIED migrations.
   *      Editing an applied migration produces silent migration drift: the
   *      checksum/ledger of every database that ran the old text no longer
   *      matches the file, while nothing about those databases changes. The
   *      correct repair — the one that now stands — is (i) fix the runtime DDL
   *      in `PostgresDatabase.ts` and (ii) ship the ADDITIVE migration
   *      `20260821_initiatives_status_default_draft.sql`. Under that
   *      architecture the historical files are ALLOWED to keep their original
   *      `DEFAULT 'step3'`; a guard forbidding it would fail the repo for being
   *      correct.
   *   2. It guarded a copy rather than the original. Both SQL files are
   *      derivatives of the runtime DDL (`000_initdb_core_tables.sql` is
   *      mechanically regenerated from it by
   *      `server/scripts/extract-initdb-migration.js`). The source is
   *      `PostgresDatabase.ts`.
   *
   * So the guard now reads the runtime DDL itself. It is still weaker than the
   * behavioural proof above — and it is NOT a substitute for it, because it
   * runs with or without a database and must never be mistaken for evidence
   * that the suite reached Postgres.
   */
  it('the runtime DDL source declares the canonical default and not step3 (static guard)', () => {
    const source = readFileSync(RUNTIME_DDL_PATH, 'utf8');

    const marker = 'CREATE TABLE IF NOT EXISTS initiatives(';
    const start = source.indexOf(marker);
    expect(start, `${RUNTIME_DDL_PATH} no longer contains "${marker}"`).toBeGreaterThan(-1);
    const nextTable = source.indexOf('CREATE TABLE IF NOT EXISTS', start + marker.length);
    const block = source.slice(start, nextTable === -1 ? source.length : nextTable);

    // Strip SQL comments so the explanatory prose ABOUT `DEFAULT 'step3'` in
    // this very block cannot trip (or satisfy) the assertions below.
    const code = block
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('--')) return '';
        const cut = line.indexOf('--');
        if (cut === -1) return line;
        // Only treat it as a comment if it is not inside a string literal.
        const quotes = (line.slice(0, cut).match(/'/g) ?? []).length;
        return quotes % 2 === 0 ? line.slice(0, cut) : line;
      })
      .join('\n');

    const offenders = code
      .split('\n')
      .filter((line) => /\bstatus\b[^\n]*DEFAULT\s+'step3'/i.test(line));
    expect(
      offenders,
      "runtime DDL for `initiatives` re-declares the broken DEFAULT 'step3'"
    ).toEqual([]);

    // Positive half: the guard must not pass merely because the column was
    // renamed or deleted.
    const declared = code.match(/\bstatus\s+TEXT\s+DEFAULT\s+'([^']+)'/i);
    expect(declared, 'runtime DDL no longer declares a default for `initiatives.status`').not.toBeNull();
    expect(CANONICAL_STATUSES as readonly string[]).toContain(declared![1]);
    expect(declared![1]).toBe(EXPECTED_DEFAULT);
  });
});
