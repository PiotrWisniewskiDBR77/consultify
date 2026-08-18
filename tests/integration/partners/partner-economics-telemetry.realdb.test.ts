/**
 * AMD-PRT-ECONOMICS-002 — `partner_economics_policy_events` durable telemetry.
 *
 * Proves, against a REAL disposable PostgreSQL database, the two artifacts
 * this packet ships:
 *
 *   1. `server/migrations/20260818_partner_economics_policy_events.sql` — a
 *      three-phase migration (catalog-only preflight that RAISEs before any
 *      mutation, idempotent mutation, post-condition) whose whole reason for
 *      existing is to refuse cleanly on a pre-existing non-canonical table
 *      instead of half-converging it.
 *   2. `server/src/services/partnerEconomicsPolicy.ts`'s
 *      `recordPartnerEconomicsPolicyDenial` — the receipt writer: NARROW
 *      identity (tenant + x-request-id) is the UNIQUE key, the FULL request
 *      fingerprint is compared on replay, and an altered replay throws
 *      `PartnerEconomicsReceiptCollisionError` with zero new rows.
 *
 * HOUSE STYLE — modeled directly on the two sibling suites in this
 * directory: `tests/integration/partners/partner-legacy-cutover.realdb.test.ts`
 * (DATABASE_URL guard, request-id-prefixed proof rows, single persistent pg
 * Client, top-level static import of the module under test) and
 * `tests/integration/partners/partner-accrual-payout-atomic.realdb.test.ts`
 * (`RUN_DB_TESTS==='1' && MOCK_DB==='false'` => `describeReal`, else
 * `describe.skip`).
 *
 * DESTRUCTIVE-FIXTURE OPT-IN. This suite does not just insert append-only
 * rows — it deliberately seeds NON-CANONICAL pre-existing table shapes (to
 * prove the preflight refuses them) and must delete its own append-only rows
 * during teardown (which requires transiently disabling the append-only
 * DELETE trigger). That is real, deliberate destruction, so three
 * independent things must ALL be true before a single statement runs:
 *   - RUN_DB_TESTS=1
 *   - MOCK_DB=false
 *   - PARTNER_ECONOMICS_TELEMETRY_ALLOW_DESTRUCTIVE_FIXTURE=1
 *   - PARTNER_ECONOMICS_TELEMETRY_DISPOSABLE_DB_PREFIX=<prefix> (and
 *     DATABASE_URL's database name must actually start with that prefix —
 *     checked with a live `SELECT current_database()`, not trusted from the
 *     env var alone, immediately before EVERY destructive statement in this
 *     file: DROP TABLE/FUNCTION, and the guarded DELETE in teardown)
 * This mirrors `tests/support/disposableLedgerCleanup.ts`'s
 * ENABLE_ENV/PREFIX_ENV convention (same disable-trigger/DELETE/re-enable
 * transaction shape for cleaning an append-only ledger), reimplemented here
 * scoped to this table because that helper's ledger names are hardcoded to
 * the closure-evidence tables and do not cover this one.
 *
 * HOW TO RUN LOCALLY — against a genuinely disposable, empty-or-own
 * database (never demo/staging/prod; the database name itself MUST start
 * with the declared prefix):
 *
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL="postgresql://user:pass@127.0.0.1:5439/prt_econ_disposable_1" \
 *   PARTNER_ECONOMICS_TELEMETRY_ALLOW_DESTRUCTIVE_FIXTURE=1 \
 *   PARTNER_ECONOMICS_TELEMETRY_DISPOSABLE_DB_PREFIX=prt_econ_disposable_ \
 *   npx vitest run tests/integration/partners/partner-economics-telemetry.realdb.test.ts \
 *     --retry=0 --no-file-parallelism
 *
 * `--retry=0` IS MANDATORY. Root `vitest.config.ts` sets `retry: CI ? 3 : 1`
 * — a retry re-runs a "test" that already mutated shared table/database
 * state (dropped/recreated the fixture table, deleted its own rows in
 * teardown), so a retried run does not re-exercise the same precondition and
 * can pass or fail for the wrong reason. `--no-file-parallelism` avoids two
 * suites racing on the same global Postgres connection pool singleton in one
 * worker process (see `server/src/database/Database.ts`: the pg Pool is a
 * process-global keyed off whatever DATABASE_URL was first observed).
 *
 * SCOPE — WHAT THIS FILE DOES NOT CLAIM. The "FAIL-BEFORE-MUTATION" coverage
 * below exercises exactly the four wrong-variant shapes the task named:
 * partial columns, wrong-typed column, OR-true-widened CHECK, superset CHECK
 * value list. The migration's preflight ALSO refuses a table missing its
 * UNIQUE index, missing/disabled append-only triggers, or whose append-only
 * function does not RAISE — those three additional branches are read and
 * understood from the migration source but are not separately exercised
 * here as their own byte-identical-rollback proofs.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  PartnerEconomicsReceiptCollisionError,
  partnerEconomicsReceiptIdentity,
  partnerEconomicsRequestFingerprint,
  recordPartnerEconomicsPolicyDenial,
  type PartnerEconomicOperation,
} from '../../../server/src/services/partnerEconomicsPolicy.js';

/* ==========================================================================
 * Gate — three independent opt-ins, all required, before any connection.
 * ========================================================================== */

const ENABLE_ENV = 'PARTNER_ECONOMICS_TELEMETRY_ALLOW_DESTRUCTIVE_FIXTURE';
const PREFIX_ENV = 'PARTNER_ECONOMICS_TELEMETRY_DISPOSABLE_DB_PREFIX';

const DATABASE_URL = process.env.DATABASE_URL || '';
const DECLARED_PREFIX = String(process.env[PREFIX_ENV] ?? '').trim();

const run =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env[ENABLE_ENV] === '1' &&
  Boolean(DECLARED_PREFIX) &&
  Boolean(DATABASE_URL);

const describeReal = run ? describe : describe.skip;

/* ==========================================================================
 * Fixed identifiers — the exact object names the migration creates.
 * ========================================================================== */

const TABLE = 'partner_economics_policy_events';
const FUNCTION_NAME = 'partner_economics_policy_events_deny_mutation';
const TRIGGER_UPDATE = 'trg_partner_economics_policy_events_no_update';
const TRIGGER_DELETE = 'trg_partner_economics_policy_events_no_delete';
const SUPPORT_INDEXES = [
  'idx_partner_economics_policy_observed',
  'idx_partner_economics_policy_operation',
  'idx_partner_economics_policy_org',
] as const;
const CANONICAL_COLUMN_NAMES = [
  'id',
  'request_id',
  'user_id',
  'organization_id',
  'partner_org_id',
  'method',
  'route_path',
  'surface',
  'operation',
  'decision',
  'denial_code',
  'receipt_identity',
  'request_fingerprint',
  'observed_at',
] as const;

const MIGRATION_FILENAME = '20260818_partner_economics_policy_events.sql';
const REPO_ROOT = path.resolve(__dirname, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server/migrations');
const MIGRATE_SCRIPT = path.join(REPO_ROOT, 'server/scripts/migrate.postgres.ts');
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILENAME);

function readMigrationSql(): string {
  return fs.readFileSync(MIGRATION_PATH, 'utf-8');
}

function sha256Hex(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Every row this suite inserts uses an organization_id under this prefix,
 * even the "no x-request-id" rows whose request_id is NULL — so guarded
 * cleanup can find every fixture row through a single WHERE clause. */
const TEST_PREFIX = 'prt-econ-telemetry-';

/* ==========================================================================
 * Guarded destructive-operation helper — mirrors
 * tests/support/disposableLedgerCleanup.ts's assertDisposableDatabase,
 * reimplemented locally because that helper's ledger table names are
 * hardcoded to the closure-evidence packet and do not include this table.
 * ========================================================================== */

class UnsafeCleanupTargetError extends Error {}

async function assertDisposableDatabase(sql: Client): Promise<string> {
  if (process.env[ENABLE_ENV] !== '1') {
    throw new UnsafeCleanupTargetError(`${ENABLE_ENV}=1 is required before any destructive fixture operation`);
  }
  const prefix = String(process.env[PREFIX_ENV] ?? '').trim();
  if (!prefix) {
    throw new UnsafeCleanupTargetError(`${PREFIX_ENV} is required (disposable database name prefix)`);
  }
  const result = await sql.query<{ db: string }>('SELECT current_database() AS db');
  const database = String(result.rows[0]?.db ?? '');
  if (!database.startsWith(prefix)) {
    throw new UnsafeCleanupTargetError(
      `Refusing destructive fixture operation: current_database() "${database}" does not start with declared disposable prefix "${prefix}"`
    );
  }
  return database;
}

/** Guarded DROP of the fixture table + its function, used between
 * FAIL-BEFORE-MUTATION scenarios and to guarantee a clean slate up front. */
async function dropFixtureObjects(sql: Client): Promise<void> {
  await assertDisposableDatabase(sql);
  await sql.query(`DROP TABLE IF EXISTS ${TABLE} CASCADE`);
  await sql.query(`DROP FUNCTION IF EXISTS public.${FUNCTION_NAME}() CASCADE`);
}

/** Guarded, transactional row cleanup for THIS suite's own append-only rows.
 * The table is append-only (BEFORE DELETE trigger raises), so a plain DELETE
 * cannot work — the trigger must be disabled for the duration of one
 * transaction, exactly like disposableLedgerCleanup.ts's deleteLedgerRows. */
async function deleteFixtureRows(sql: Client, prefix: string): Promise<number> {
  await assertDisposableDatabase(sql);
  await sql.query('BEGIN');
  try {
    await sql.query(`SELECT pg_advisory_xact_lock(hashtext('partner-economics-telemetry-fixture-cleanup'))`);
    await sql.query(`ALTER TABLE ${TABLE} DISABLE TRIGGER ${TRIGGER_DELETE}`);
    const result = await sql.query(
      `DELETE FROM ${TABLE} WHERE request_id LIKE $1 || '%' OR organization_id LIKE $1 || '%'`,
      [prefix]
    );
    await sql.query(`ALTER TABLE ${TABLE} ENABLE TRIGGER ${TRIGGER_DELETE}`);
    await sql.query('COMMIT');
    return result.rowCount ?? 0;
  } catch (err) {
    await sql.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}

/* ==========================================================================
 * Schema-shape snapshot/assertion helpers.
 * ========================================================================== */

async function readSchemaSnapshot(sql: Client) {
  const columns = await sql.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1
      ORDER BY column_name`,
    [TABLE]
  );
  const constraints = await sql.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = $1::regclass
      ORDER BY conname`,
    [TABLE]
  );
  return { columns: columns.rows, constraints: constraints.rows };
}

async function readRowsSnapshot(sql: Client) {
  const rows = await sql.query(`SELECT * FROM ${TABLE} ORDER BY id`);
  return rows.rows;
}

async function assertCanonicalSchema(sql: Client): Promise<void> {
  const cols = await sql.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
    [TABLE]
  );
  const colSet = new Set(cols.rows.map((r: { column_name: string }) => r.column_name));
  for (const name of CANONICAL_COLUMN_NAMES) {
    expect(colSet.has(name), `missing canonical column ${name}`).toBe(true);
  }
  expect(colSet.size, 'no extra/superset columns').toBe(CANONICAL_COLUMN_NAMES.length);

  const uniq = await sql.query(
    `SELECT 1
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
      WHERE c.relname = $1 AND i.indisunique AND a.attname = 'receipt_identity'`,
    [TABLE]
  );
  expect(uniq.rowCount, 'receipt_identity must have a UNIQUE index').toBeGreaterThan(0);

  for (const idx of SUPPORT_INDEXES) {
    const found = await sql.query(`SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'i'`, [idx]);
    expect(found.rowCount, `missing support index ${idx}`).toBeGreaterThan(0);
  }

  const trg = await sql.query(
    `SELECT tgname, tgenabled
       FROM pg_trigger
      WHERE tgrelid = $1::regclass AND NOT tgisinternal AND tgname = ANY($2)`,
    [TABLE, [TRIGGER_UPDATE, TRIGGER_DELETE]]
  );
  expect(trg.rowCount, 'both named append-only triggers must exist').toBe(2);
  for (const row of trg.rows as Array<{ tgname: string; tgenabled: string }>) {
    expect(row.tgenabled, `${row.tgname} must be enabled ('O')`).toBe('O');
  }

  const fn = await sql.query(
    `SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = $1 AND n.nspname = 'public'`,
    [FUNCTION_NAME]
  );
  expect(fn.rowCount, 'append-only function must exist').toBe(1);
  expect((fn.rows[0] as { prosrc: string }).prosrc).toMatch(/RAISE\s+EXCEPTION/i);
}

/* ==========================================================================
 * CLI runner — invokes the REAL migrate.postgres.ts as a subprocess, exactly
 * as production deploys run it. Mirrors runMigrate() in the sibling
 * tests/integration/method-core-migrations.realdb.test.ts.
 * ========================================================================== */

interface MigrateResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runMigrateCli(extraArgs: string[]): MigrateResult {
  try {
    const stdout = execFileSync('npx', ['tsx', MIGRATE_SCRIPT, ...extraArgs], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DB_TYPE: 'postgres',
        DATABASE_URL,
        DATABASE_PUBLIC_URL: '',
      },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err: any) {
    return {
      status: typeof err?.status === 'number' ? err.status : 1,
      stdout: String(err?.stdout ?? ''),
      stderr: String(err?.stderr ?? err?.message ?? ''),
    };
  }
}

/* ==========================================================================
 * Fake Express Request builder + service-call helper for the telemetry
 * writer. Field reads mirror recordPartnerEconomicsPolicyDenial exactly:
 * req.user?.id / req.user?.organizationId / req.partnerOrgId /
 * headers['x-request-id'] / req.method / req.originalUrl (fallback req.path).
 * ========================================================================== */

function fakeRequest(opts: {
  requestId?: string | null;
  organizationId: string;
  partnerOrgId?: string | null;
  userId?: string | null;
  method?: string;
  path?: string;
}): any {
  return {
    method: opts.method ?? 'POST',
    path: opts.path ?? '/payouts/request',
    originalUrl: opts.path ?? '/payouts/request',
    headers: opts.requestId ? { 'x-request-id': opts.requestId } : {},
    user: { id: opts.userId ?? null, organizationId: opts.organizationId },
    partnerOrgId: opts.partnerOrgId ?? null,
  };
}

function denyOnce(opts: {
  requestId?: string | null;
  organizationId: string;
  partnerOrgId?: string | null;
  userId?: string | null;
  method?: string;
  path?: string;
  surface?: string;
  operation?: PartnerEconomicOperation;
}): Promise<void> {
  return recordPartnerEconomicsPolicyDenial({
    req: fakeRequest(opts),
    operation: opts.operation ?? 'payout',
    surface: opts.surface ?? 'v8_partner',
  });
}

/* ==========================================================================
 * FAIL-BEFORE-MUTATION wrong-variant fixtures. Each is deliberately correct
 * up to the ONE deviation named, so the preflight raises on that exact
 * check and not an earlier/unrelated one.
 * ========================================================================== */

interface WrongVariant {
  name: string;
  setupSql: string;
  expectedMessage: RegExp;
}

const WRONG_VARIANTS: WrongVariant[] = [
  {
    name: 'partial columns (partner_org_id missing)',
    setupSql: `
      CREATE TABLE ${TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id TEXT,
        user_id TEXT,
        organization_id TEXT,
        method TEXT NOT NULL,
        route_path TEXT NOT NULL,
        surface TEXT NOT NULL,
        operation TEXT NOT NULL,
        decision TEXT NOT NULL,
        denial_code TEXT NOT NULL,
        receipt_identity TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO ${TABLE}
        (request_id,user_id,organization_id,method,route_path,surface,operation,decision,denial_code,receipt_identity,request_fingerprint)
      VALUES
        ('seed-missing-column','user-seed','org-seed','POST','/seed','v8_partner','commission','AMD-PRT-ECONOMICS-002','PARTNER_ECONOMICS_POLICY_DISABLED','identity-seed-missing-column','fingerprint-seed-missing-column');
    `,
    expectedMessage: /non-canonical shape \(missing column "partner_org_id"\)/,
  },
  {
    name: 'wrong-typed column (route_path is integer)',
    setupSql: `
      CREATE TABLE ${TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id TEXT,
        user_id TEXT,
        organization_id TEXT,
        partner_org_id TEXT,
        method TEXT NOT NULL,
        route_path INTEGER NOT NULL,
        surface TEXT NOT NULL,
        operation TEXT NOT NULL,
        decision TEXT NOT NULL,
        denial_code TEXT NOT NULL,
        receipt_identity TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO ${TABLE}
        (request_id,user_id,organization_id,partner_org_id,method,route_path,surface,operation,decision,denial_code,receipt_identity,request_fingerprint)
      VALUES
        ('seed-wrong-type','user-seed','org-seed','partner-seed','POST',1,'v8_partner','commission','AMD-PRT-ECONOMICS-002','PARTNER_ECONOMICS_POLICY_DISABLED','identity-seed-wrong-type','fingerprint-seed-wrong-type');
    `,
    expectedMessage: /column "route_path" has type integer, expected text/,
  },
  {
    name: 'OR-true-widened CHECK on surface',
    setupSql: `
      CREATE TABLE ${TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id TEXT,
        user_id TEXT,
        organization_id TEXT,
        partner_org_id TEXT,
        method TEXT NOT NULL,
        route_path TEXT NOT NULL,
        surface TEXT NOT NULL CHECK (surface IN ('v8_partner','legacy_partner','superadmin_partner_settlements','superadmin_partner_config','service') OR true),
        operation TEXT NOT NULL CHECK (operation IN ('commission','discount','accrual','payout','payout_settings','lifecycle_payout')),
        decision TEXT NOT NULL,
        denial_code TEXT NOT NULL,
        receipt_identity TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO ${TABLE}
        (request_id,user_id,organization_id,partner_org_id,method,route_path,surface,operation,decision,denial_code,receipt_identity,request_fingerprint)
      VALUES
        ('seed-or-true','user-seed','org-seed','partner-seed','POST','/seed','v8_partner','commission','AMD-PRT-ECONOMICS-002','PARTNER_ECONOMICS_POLICY_DISABLED','identity-seed-or-true','fingerprint-seed-or-true');
    `,
    expectedMessage: /CHECK on surface is widened with an OR-true term/,
  },
  {
    name: 'superset CHECK value list on surface',
    setupSql: `
      CREATE TABLE ${TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id TEXT,
        user_id TEXT,
        organization_id TEXT,
        partner_org_id TEXT,
        method TEXT NOT NULL,
        route_path TEXT NOT NULL,
        surface TEXT NOT NULL CHECK (surface IN ('v8_partner','legacy_partner','superadmin_partner_settlements','superadmin_partner_config','service','shadow_admin_surface')),
        operation TEXT NOT NULL CHECK (operation IN ('commission','discount','accrual','payout','payout_settings','lifecycle_payout')),
        decision TEXT NOT NULL,
        denial_code TEXT NOT NULL,
        receipt_identity TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO ${TABLE}
        (request_id,user_id,organization_id,partner_org_id,method,route_path,surface,operation,decision,denial_code,receipt_identity,request_fingerprint)
      VALUES
        ('seed-superset','user-seed','org-seed','partner-seed','POST','/seed','v8_partner','commission','AMD-PRT-ECONOMICS-002','PARTNER_ECONOMICS_POLICY_DISABLED','identity-seed-superset','fingerprint-seed-superset');
    `,
    expectedMessage: /admits a SUPERSET of the canonical values/,
  },
];

/* ==========================================================================
 * Suite
 * ========================================================================== */

describeReal.sequential('AMD-PRT-ECONOMICS-002 — partner_economics_policy_events (real PG)', () => {
  let sql: Client;
  let lockClient: Client;
  let lockReleased = false;

  // Well-known identity/org captured across groups for cold-readback +
  // fingerprint cross-checks later in the file.
  let concurrencyIdentity = '';
  let concurrencyOrg = '';
  let concurrencyFields: {
    surface: string;
    operation: PartnerEconomicOperation;
    method: string;
    path: string;
    partnerOrgId: string;
    userId: string;
  } | null = null;

  beforeAll(async () => {
    sql = new Client({ connectionString: DATABASE_URL });
    await sql.connect();
    const versionRow = await sql.query('SELECT version() AS version');
    expect(versionRow.rows[0].version).toMatch(/PostgreSQL/);

    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();

    // Confirms the gate is REAL (not just env-flag trust) before anything
    // destructive can run, and holds a session-level advisory lock for the
    // whole suite so a concurrent run against the same disposable database
    // cannot interleave with this one's schema surgery.
    await assertDisposableDatabase(lockClient);
    await lockClient.query(`SELECT pg_advisory_lock(hashtext('partner-economics-telemetry-realdb-suite'))`);

    // Clean slate: drop any leftover fixture table/function from a prior
    // aborted run, and any stale schema_migrations ledger row for this file
    // (so the CLI genuinely sees a fresh-install precondition below).
    await dropFixtureObjects(sql);
    try {
      await sql.query(`DELETE FROM schema_migrations WHERE filename = $1`, [MIGRATION_FILENAME]);
    } catch (err: any) {
      if (String(err?.code) !== '42P01') throw err; // ignore "relation does not exist"
    }
    await sql.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  }, 60_000);

  afterAll(async () => {
    if (!lockReleased && lockClient) {
      await lockClient.query(`SELECT pg_advisory_unlock(hashtext('partner-economics-telemetry-realdb-suite'))`).catch(() => undefined);
    }
    await sql?.end().catch(() => undefined);
    await lockClient?.end().catch(() => undefined);
  });

  it('is actually running against real PostgreSQL, on the declared disposable database', async () => {
    const db = await sql.query('SELECT current_database() AS db');
    expect(String(db.rows[0].db)).toMatch(new RegExp(`^${DECLARED_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });

  describe('1. CLI-driven fresh apply / repeat apply / dry-run / checksum stability', () => {
    it('fresh apply: exits 0, applies exactly this file, and leaves the canonical schema', async () => {
      const result = runMigrateCli(['--only', MIGRATION_FILENAME]);
      expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
      expect(result.stdout).toContain(`→ ${MIGRATION_FILENAME}`);
      expect(result.stdout).toContain('✅ Postgres migrations complete');
      await assertCanonicalSchema(sql);
    }, 120_000);

    it('repeat apply is a no-op: 0 applied, exit 0, no duplicate ledger row', async () => {
      const result = runMigrateCli(['--only', MIGRATION_FILENAME]);
      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('Applying migrations: 0');
      expect(result.stdout).not.toContain(`→ ${MIGRATION_FILENAME}`);

      const ledger = await sql.query(
        `SELECT count(*)::int AS n FROM schema_migrations WHERE filename = $1 AND status = 'success'`,
        [MIGRATION_FILENAME]
      );
      expect(ledger.rows[0].n).toBe(1);
    }, 60_000);

    it('dry-run reports 0 pending once applied', async () => {
      const result = runMigrateCli(['--dry-run', '--only', MIGRATION_FILENAME]);
      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('Pending migrations: 0');
      expect(result.stdout).not.toContain(`- ${MIGRATION_FILENAME}`);
    }, 60_000);

    it('checksum equals sha256 of the actual file bytes and is stable across reruns', async () => {
      const expectedChecksum = sha256Hex(readMigrationSql());
      const first = await sql.query(`SELECT checksum FROM schema_migrations WHERE filename = $1`, [
        MIGRATION_FILENAME,
      ]);
      expect(first.rows[0].checksum).toBe(expectedChecksum);

      // Rerun once more (already applied -> 0 pending) and confirm the
      // stored checksum did not drift.
      const rerun = runMigrateCli(['--only', MIGRATION_FILENAME]);
      expect(rerun.status).toBe(0);
      const second = await sql.query(`SELECT checksum FROM schema_migrations WHERE filename = $1`, [
        MIGRATION_FILENAME,
      ]);
      expect(second.rows[0].checksum).toBe(expectedChecksum);
    }, 60_000);
  });

  describe('2. Valid LATE apply onto a database that already has the canonical table + rows', () => {
    it('re-running the raw migration text against an already-canonical, non-empty table succeeds and leaves rows byte-identical', async () => {
      await denyOnce({
        requestId: `${TEST_PREFIX}late-apply`,
        organizationId: `${TEST_PREFIX}org-late-apply`,
        partnerOrgId: `${TEST_PREFIX}partner-late-apply`,
        userId: `${TEST_PREFIX}user-late-apply`,
        method: 'POST',
        path: '/payouts/request',
        surface: 'v8_partner',
        operation: 'payout',
      });

      const before = await readRowsSnapshot(sql);
      expect(before.length).toBeGreaterThan(0);

      await expect(sql.query(readMigrationSql())).resolves.toBeDefined();

      const after = await readRowsSnapshot(sql);
      expect(after).toEqual(before);
      await assertCanonicalSchema(sql);
    }, 30_000);
  });

  describe('3. FAIL-BEFORE-MUTATION: preflight rejects a non-empty wrong-variant table and leaves it byte-identical', () => {
    for (const variant of WRONG_VARIANTS) {
      it(`refuses "${variant.name}" before any mutation, rolling back to the exact pre-existing schema and rows`, async () => {
        await dropFixtureObjects(sql);
        await sql.query(variant.setupSql);

        const before = await readSchemaSnapshot(sql);
        const beforeRows = await readRowsSnapshot(sql);
        expect(beforeRows.length).toBeGreaterThan(0); // the seed row is genuinely non-empty

        await expect(sql.query(readMigrationSql())).rejects.toThrow(variant.expectedMessage);

        const after = await readSchemaSnapshot(sql);
        const afterRows = await readRowsSnapshot(sql);
        expect(after).toEqual(before);
        expect(afterRows).toEqual(beforeRows);
      }, 30_000);
    }

    it('restores the canonical table for the remaining functional tests', async () => {
      await dropFixtureObjects(sql);
      await expect(sql.query(readMigrationSql())).resolves.toBeDefined();
      await assertCanonicalSchema(sql);
      const rows = await readRowsSnapshot(sql);
      expect(rows).toEqual([]); // genuinely fresh — no residue from the wrong variants
    }, 30_000);
  });

  describe('4. 8-way concurrency: same identity + payload => exactly one row', () => {
    it('fires 8 concurrent identical denials and stores exactly one receipt', async () => {
      const requestId = `${TEST_PREFIX}concurrency-same`;
      const organizationId = `${TEST_PREFIX}org-concurrency`;
      concurrencyFields = {
        surface: 'v8_partner',
        operation: 'payout',
        method: 'POST',
        path: '/payouts/request',
        partnerOrgId: `${TEST_PREFIX}partner-concurrency`,
        userId: `${TEST_PREFIX}user-concurrency`,
      };
      concurrencyIdentity = partnerEconomicsReceiptIdentity({ requestId, organizationId }).identity;
      concurrencyOrg = organizationId;

      const attempt = () =>
        denyOnce({
          requestId,
          organizationId,
          partnerOrgId: concurrencyFields!.partnerOrgId,
          userId: concurrencyFields!.userId,
          method: concurrencyFields!.method,
          path: concurrencyFields!.path,
          surface: concurrencyFields!.surface,
          operation: concurrencyFields!.operation,
        });

      const results = await Promise.allSettled(Array.from({ length: 8 }, () => attempt()));
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected, `identical concurrent replays must never collide: ${JSON.stringify(rejected.map((r) => String(r.reason)))}`).toEqual([]);

      const count = await sql.query(`SELECT count(*)::int AS n FROM ${TABLE} WHERE receipt_identity = $1`, [
        concurrencyIdentity,
      ]);
      expect(count.rows[0].n).toBe(1);
    }, 30_000);
  });

  describe('5. Altered-key collision: same identity, altered payload => throws, zero new rows', () => {
    it('a replay with the same request id + tenant but an altered method is refused as a binding collision', async () => {
      const requestId = `${TEST_PREFIX}collision`;
      const organizationId = `${TEST_PREFIX}org-collision`;
      const identity = partnerEconomicsReceiptIdentity({ requestId, organizationId }).identity;

      await denyOnce({
        requestId,
        organizationId,
        partnerOrgId: `${TEST_PREFIX}partner-collision`,
        userId: `${TEST_PREFIX}user-collision`,
        method: 'POST',
        path: '/payouts/request',
        surface: 'v8_partner',
        operation: 'payout',
      });

      const before = await sql.query(
        `SELECT count(*)::int AS n, max(request_fingerprint) AS fp FROM ${TABLE} WHERE receipt_identity = $1`,
        [identity]
      );
      expect(before.rows[0].n).toBe(1);
      const originalFingerprint = before.rows[0].fp as string;

      // Same identity (requestId + organizationId unchanged), but the
      // method differs (POST -> PUT). Identity must stay stable while the
      // fingerprint changes — that mismatch IS the collision.
      let caught: unknown;
      try {
        await denyOnce({
          requestId,
          organizationId,
          partnerOrgId: `${TEST_PREFIX}partner-collision`,
          userId: `${TEST_PREFIX}user-collision`,
          method: 'PUT',
          path: '/payouts/request',
          surface: 'v8_partner',
          operation: 'payout',
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(PartnerEconomicsReceiptCollisionError);
      expect((caught as PartnerEconomicsReceiptCollisionError).code).toBe('PARTNER_ECONOMICS_RECEIPT_COLLISION');

      const after = await sql.query(
        `SELECT count(*)::int AS n, max(request_fingerprint) AS fp FROM ${TABLE} WHERE receipt_identity = $1`,
        [identity]
      );
      expect(after.rows[0].n, 'a collision must insert ZERO new rows, never re-key into a new identity').toBe(1);
      expect(after.rows[0].fp, 'the stored fingerprint must remain the ORIGINAL request, not the colliding one').toBe(
        originalFingerprint
      );
    }, 30_000);
  });

  describe('6. Without x-request-id: honest non-replayable behaviour (documented, not asserted as exactly-one)', () => {
    it('two denials with no x-request-id each get their own row and neither throws', async () => {
      const organizationId = `${TEST_PREFIX}org-no-reqid`;
      const noIdIdentity = partnerEconomicsReceiptIdentity({ requestId: null, organizationId });
      expect(noIdIdentity.replayable).toBe(false);

      await expect(
        denyOnce({
          requestId: null,
          organizationId,
          partnerOrgId: `${TEST_PREFIX}partner-no-reqid`,
          userId: `${TEST_PREFIX}user-no-reqid`,
          method: 'POST',
          path: '/payouts/request',
          surface: 'v8_partner',
          operation: 'payout',
        })
      ).resolves.toBeUndefined();

      await expect(
        denyOnce({
          requestId: null,
          organizationId,
          partnerOrgId: `${TEST_PREFIX}partner-no-reqid`,
          userId: `${TEST_PREFIX}user-no-reqid`,
          method: 'POST',
          path: '/payouts/request',
          surface: 'v8_partner',
          operation: 'payout',
        })
      ).resolves.toBeUndefined();

      const rows = await sql.query(
        `SELECT receipt_identity FROM ${TABLE} WHERE organization_id = $1 AND request_id IS NULL`,
        [organizationId]
      );
      expect(rows.rowCount).toBe(2);
      expect(rows.rows[0].receipt_identity).not.toBe(rows.rows[1].receipt_identity);
    }, 30_000);
  });

  describe('7. Cold readback via a brand-new pg Pool/Client', () => {
    it('reads back the concurrency-group receipt from a fresh connection pool, and the stored fingerprint matches the pure function', async () => {
      expect(concurrencyIdentity).not.toBe('');
      const coldPool = new Pool({ connectionString: DATABASE_URL });
      try {
        const result = await coldPool.query(`SELECT * FROM ${TABLE} WHERE receipt_identity = $1`, [
          concurrencyIdentity,
        ]);
        expect(result.rows).toHaveLength(1);
        const row = result.rows[0];
        expect(row).toMatchObject({
          decision: 'AMD-PRT-ECONOMICS-002',
          denial_code: 'PARTNER_ECONOMICS_POLICY_DISABLED',
          operation: 'payout',
          surface: 'v8_partner',
          organization_id: concurrencyOrg,
        });

        const expectedFingerprint = partnerEconomicsRequestFingerprint({
          surface: concurrencyFields!.surface,
          operation: concurrencyFields!.operation,
          method: concurrencyFields!.method,
          routePath: concurrencyFields!.path,
          organizationId: concurrencyOrg,
          partnerOrgId: concurrencyFields!.partnerOrgId,
          userId: concurrencyFields!.userId,
        });
        expect(row.request_fingerprint).toBe(expectedFingerprint);
      } finally {
        await coldPool.end();
      }
    }, 30_000);
  });

  describe('8. Immutability: direct UPDATE and DELETE are both rejected by trigger', () => {
    it('a direct UPDATE on an existing receipt is refused and the row is unchanged', async () => {
      const target = await sql.query(`SELECT id, operation FROM ${TABLE} WHERE receipt_identity = $1`, [
        concurrencyIdentity,
      ]);
      expect(target.rowCount).toBe(1);
      const { id, operation } = target.rows[0];

      await expect(
        sql.query(`UPDATE ${TABLE} SET operation = 'commission' WHERE id = $1`, [id])
      ).rejects.toThrow(/append-only under AMD-PRT-ECONOMICS-002; UPDATE not permitted/);

      const after = await sql.query(`SELECT operation FROM ${TABLE} WHERE id = $1`, [id]);
      expect(after.rows[0].operation).toBe(operation);
    }, 30_000);

    it('a direct DELETE on an existing receipt is refused and the row still exists', async () => {
      const target = await sql.query(`SELECT id FROM ${TABLE} WHERE receipt_identity = $1`, [concurrencyIdentity]);
      expect(target.rowCount).toBe(1);
      const { id } = target.rows[0];

      await expect(sql.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id])).rejects.toThrow(
        /append-only under AMD-PRT-ECONOMICS-002; DELETE not permitted/
      );

      const after = await sql.query(`SELECT count(*)::int AS n FROM ${TABLE} WHERE id = $1`, [id]);
      expect(after.rows[0].n).toBe(1);
    }, 30_000);
  });

  describe('9. Guarded cleanup', () => {
    it('refuses to delete anything when the declared prefix does not match current_database()', async () => {
      const before = await sql.query(
        `SELECT count(*)::int AS n FROM ${TABLE} WHERE request_id LIKE $1 || '%' OR organization_id LIKE $1 || '%'`,
        [TEST_PREFIX]
      );
      expect(before.rows[0].n).toBeGreaterThan(0);

      const original = process.env[PREFIX_ENV];
      process.env[PREFIX_ENV] = 'definitely-not-the-real-disposable-prefix-';
      try {
        await expect(deleteFixtureRows(sql, TEST_PREFIX)).rejects.toBeInstanceOf(UnsafeCleanupTargetError);
      } finally {
        process.env[PREFIX_ENV] = original;
      }

      const after = await sql.query(
        `SELECT count(*)::int AS n FROM ${TABLE} WHERE request_id LIKE $1 || '%' OR organization_id LIKE $1 || '%'`,
        [TEST_PREFIX]
      );
      expect(after.rows[0].n, 'a refused cleanup must delete ZERO rows').toBe(before.rows[0].n);
    }, 30_000);

    it('performs the guarded cleanup: postcommit residue is 0, both triggers remain enabled, advisory lock is released', async () => {
      const deleted = await deleteFixtureRows(sql, TEST_PREFIX);
      expect(deleted).toBeGreaterThan(0);

      const residue = await sql.query(
        `SELECT count(*)::int AS n FROM ${TABLE} WHERE request_id LIKE $1 || '%' OR organization_id LIKE $1 || '%'`,
        [TEST_PREFIX]
      );
      expect(residue.rows[0].n, 'postcommit residue must be 0').toBe(0);

      const trg = await sql.query(
        `SELECT tgname, tgenabled FROM pg_trigger
          WHERE tgrelid = $1::regclass AND NOT tgisinternal AND tgname = ANY($2)`,
        [TABLE, [TRIGGER_UPDATE, TRIGGER_DELETE]]
      );
      expect(trg.rowCount).toBe(2);
      for (const row of trg.rows as Array<{ tgname: string; tgenabled: string }>) {
        expect(row.tgenabled, `${row.tgname} must still be 'O' after guarded cleanup`).toBe('O');
      }

      await lockClient.query(`SELECT pg_advisory_unlock(hashtext('partner-economics-telemetry-realdb-suite'))`);
      lockReleased = true;

      const locks = await lockClient.query(
        `SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()`
      );
      expect(locks.rows[0].n, 'advisory locks held by this session must be 0 after release').toBe(0);
    }, 30_000);
  });
});
