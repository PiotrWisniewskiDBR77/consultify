/**
 * CLOSEOUT-CO2 — `initiatives.status` DEFAULT must be a value the
 * `initiatives_status_check` CHECK constraint actually accepts.
 *
 * THE DEFECT (pre-existing, platform-level):
 *   `initiatives.status` was created with `DEFAULT 'step3'`
 *   (server/migrations/000_z_core_baseline.sql:226 and :264; also the runtime
 *   DDL in server/src/database/PostgresDatabase.ts:2526), while
 *   `initiatives_status_check` — added later by
 *   server/migrations/20260624_initiative_status_normalize.sql and
 *   server/migrations/20260802_mvp_core_schema_parity.sql — allows only the 13
 *   canonical UPPERCASE statuses, of which 'step3' is NOT one.
 *
 *   Consequence: every `INSERT INTO initiatives (...)` that omits `status`
 *   fell straight into the column default and was rejected with
 *   `new row for relation "initiatives" violates check constraint
 *   "initiatives_status_check"`. This is the single cause behind the
 *   Results-vNext ROI realdb fixtures failing en masse — all of them insert
 *   their fixture initiative as `(id, organization_id, name)` with no status
 *   (tests/resultsVnext/roi/roiFinanceLink.realdb.test.ts:87,
 *   roiFinanceReconciliation.realdb.test.ts:97,
 *   roiActualEntryAppendOnly.realdb.test.ts:115,
 *   roiEvidenceLinkFreshness.realdb.test.ts:157).
 *
 * THE FIX UNDER TEST:
 *   server/migrations/20260821_initiatives_status_default_draft.sql sets the
 *   column default to 'DRAFT' (the lifecycle entry state per the SSOT enum in
 *   server/src/constants/initiativeStatuses.ts, and exactly what the only
 *   production writer — InitiativeDefinitionService.ts:168 — already supplies).
 *   'step3' is an orphan, never a legitimate status, so the default was
 *   corrected rather than the canonical vocabulary widened.
 *
 * WHAT THIS SUITE ASSERTS (the four required scenarios):
 *   1. INSERT without an explicit status succeeds.
 *   2. The resulting row carries a legal default — one the CHECK admits.
 *   3. FRESH INSTALL: on a database built by a full migration replay, the
 *      committed default is already correct.
 *   4. UPGRADE: replaying the migration against a database deliberately put
 *      back into the broken pre-fix state (default reset to 'step3', legacy
 *      'step3' rows present with the CHECK dropped, mimicking a table created
 *      by the runtime `initDb()` DDL) repairs the default, remaps the orphan
 *      rows to 'DRAFT', and loses NO data.
 *
 * HOW TO RUN LOCALLY (postgresql@15 — @16 lacks pgvector here and breaks the
 * migration chain):
 *   LC_ALL=C initdb -D "$PGDATA" -U postgres --encoding=UTF8 --locale=C
 *   LC_ALL=C pg_ctl -D "$PGDATA" -o "-p 55131 -k /tmp/co2s -c listen_addresses=127.0.0.1" start
 *   psql -h 127.0.0.1 -p 55131 -U postgres -c 'CREATE DATABASE roi_fresh;'
 *   psql -h 127.0.0.1 -p 55131 -U postgres -d roi_fresh \
 *     -c 'CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;'
 *   NODE_ENV=test DB_TYPE=postgres \
 *     DATABASE_URL="postgresql://postgres@127.0.0.1:55131/roi_fresh" \
 *     npx tsx server/scripts/migrate.postgres.ts
 *   MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
 *     DATABASE_URL="postgresql://postgres@127.0.0.1:55131/roi_fresh" \
 *     npx vitest run tests/integration/closeout-co2-initiatives-status-default.realdb.test.ts \
 *     --no-file-parallelism
 *
 *   RED (proves the suite has teeth): before the fix, or after
 *     `ALTER TABLE initiatives ALTER COLUMN status SET DEFAULT 'step3';`
 *   scenarios 1-3 fail with the CHECK violation above.
 *
 * SKIP POLICY: same connection-probe contract as the sibling realdb suites
 * (tests/integration/schema-migration-completeness.realdb.test.ts et al.) —
 * a clean vacuous pass when no Postgres is configured/reachable, but a real,
 * reported failure once it IS reachable.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
}

const PROBE_TIMEOUT_MS = 10_000;

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../server/migrations/20260821_initiatives_status_default_draft.sql'
);

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

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 30_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}`;
const ORG_ID = `co2-status-org-${tag}`;

let client: Client;
let reachable = false;

async function columnDefault(): Promise<string | null> {
  const { rows } = await client.query<{ column_default: string | null }>(
    `SELECT column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'initiatives'
        AND column_name = 'status'`
  );
  return rows[0]?.column_default ?? null;
}

/** The literal value the column default evaluates to, e.g. `'DRAFT'::text` -> `DRAFT`. */
async function effectiveDefaultValue(): Promise<string | null> {
  const raw = await columnDefault();
  if (!raw) return null;
  const { rows } = await client.query<{ value: string | null }>(`SELECT (${raw})::text AS value`);
  return rows[0]?.value ?? null;
}

async function checkConstraintDef(): Promise<string | null> {
  const { rows } = await client.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conname = 'initiatives_status_check'
        AND conrelid = 'public.initiatives'::regclass`
  );
  return rows[0]?.def ?? null;
}

async function ensureOrganization(): Promise<void> {
  await client.query(
    `INSERT INTO organizations (id, name, plan, status)
     VALUES ($1, $2, 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [ORG_ID, 'CLOSEOUT-CO2 status-default org']
  );
}

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  const config = buildClientConfig();
  if (!config) return;
  client = new Client(config);
  try {
    await client.connect();
    await client.query('SELECT 1');
    reachable = true;
  } catch (error) {
    throw new Error(
      `Postgres is configured but unreachable — refusing to pass vacuously: ${String(error)}`
    );
  }
  await ensureOrganization();
}, 60_000);

afterAll(async () => {
  if (!reachable) return;
  // Probes clean up after themselves — demo data is the product's face.
  try {
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
  } finally {
    await client.end();
  }
});

describe('CLOSEOUT-CO2 — initiatives.status default is compatible with its CHECK', () => {
  it('scenario 1: INSERT without an explicit status succeeds', async () => {
    if (!reachable) return;
    const id = `co2-no-status-${tag}`;
    await expect(
      client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        id,
        ORG_ID,
        'CO2 fixture — status omitted on purpose',
      ])
    ).resolves.toBeDefined();

    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM initiatives WHERE id = $1`,
      [id]
    );
    expect(rows).toHaveLength(1);
  });

  it('scenario 2: the inserted row carries a legal default the CHECK admits', async () => {
    if (!reachable) return;
    const id = `co2-legal-default-${tag}`;
    await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
      id,
      ORG_ID,
      'CO2 fixture — legal default',
    ]);

    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM initiatives WHERE id = $1`,
      [id]
    );
    const status = rows[0]?.status;

    // Not merely "some value": it must be the canonical lifecycle entry state,
    // and it must be inside the vocabulary the CHECK enforces.
    expect(status).toBe('DRAFT');
    expect(CANONICAL_STATUSES).toContain(status);
    expect(status).not.toBe('step3');

    // Independent of the row: the declared default itself must be admissible.
    const def = await effectiveDefaultValue();
    expect(def).toBe('DRAFT');
    expect(CANONICAL_STATUSES).toContain(def as string);

    // And the CHECK must genuinely be present — otherwise scenario 1 would
    // pass for the wrong reason (nothing enforcing anything).
    const constraint = await checkConstraintDef();
    expect(constraint).toBeTruthy();
    expect(constraint).toContain('DRAFT');
    expect(constraint).not.toContain('step3');
  });

  it('scenario 3: FRESH INSTALL — the migrated schema commits the corrected default', async () => {
    if (!reachable) return;
    // This database was built by a full replay of server/migrations/. The
    // default baked into the schema (not just an ad-hoc ALTER in this suite)
    // must already be the corrected one.
    const raw = await columnDefault();
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('step3');
    expect(await effectiveDefaultValue()).toBe('DRAFT');

    // Sanity: the orphan value is genuinely rejected, so 'DRAFT' is not
    // simply "anything goes".
    const id = `co2-reject-step3-${tag}`;
    await expect(
      client.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'step3')`,
        [id, ORG_ID, 'CO2 fixture — explicit step3 must be rejected']
      )
    ).rejects.toThrow(/initiatives_status_check/);
  });

  it('scenario 4: UPGRADE — replaying the migration repairs a pre-fix DB without losing data', async () => {
    if (!reachable) return;
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    const keptId = `co2-upgrade-kept-${tag}`;
    const orphanId = `co2-upgrade-orphan-${tag}`;

    // Rewind this database into the exact broken pre-fix state: default back
    // to 'step3' and the CHECK dropped, which is how a table produced by the
    // runtime initDb() DDL (PostgresDatabase.ts:2526) looks before
    // 20260624/20260802 ever run. That is the only state in which legacy
    // 'step3' rows can exist at all.
    await client.query(`ALTER TABLE initiatives DROP CONSTRAINT initiatives_status_check`);
    await client.query(`ALTER TABLE initiatives ALTER COLUMN status SET DEFAULT 'step3'`);

    try {
      await client.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'EXECUTING')`,
        [keptId, ORG_ID, 'CO2 pre-existing row that must survive']
      );
      // Falls into the broken default — a legacy 'step3' row.
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        orphanId,
        ORG_ID,
        'CO2 pre-existing orphan row',
      ]);
      expect(await effectiveDefaultValue()).toBe('step3');
      const before = await client.query<{ status: string }>(
        `SELECT status FROM initiatives WHERE id = $1`,
        [orphanId]
      );
      expect(before.rows[0]?.status).toBe('step3');

      // Apply ONLY the new migration, as an upgrade would.
      await client.query(sql);

      // Default repaired.
      expect(await effectiveDefaultValue()).toBe('DRAFT');

      // Nothing lost: both rows still there, the legitimate one untouched,
      // the orphan remapped (not deleted) to the documented target.
      const after = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM initiatives WHERE id = ANY($1::text[]) ORDER BY id`,
        [[keptId, orphanId]]
      );
      expect(after.rows).toHaveLength(2);
      const byId = new Map(after.rows.map((r) => [r.id, r.status]));
      expect(byId.get(keptId)).toBe('EXECUTING');
      expect(byId.get(orphanId)).toBe('DRAFT');

      // Idempotent: a second replay changes nothing and does not throw.
      await client.query(sql);
      expect(await effectiveDefaultValue()).toBe('DRAFT');

      // With the default repaired, a statusless INSERT works even though the
      // CHECK is about to be restored below.
      const postId = `co2-upgrade-post-${tag}`;
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        postId,
        ORG_ID,
        'CO2 post-upgrade statusless insert',
      ]);
      const post = await client.query<{ status: string }>(
        `SELECT status FROM initiatives WHERE id = $1`,
        [postId]
      );
      expect(post.rows[0]?.status).toBe('DRAFT');
    } finally {
      // Restore the constraint this scenario dropped, so the database is left
      // exactly as it was found for any suite sharing it.
      await client.query(
        `ALTER TABLE initiatives
           ADD CONSTRAINT initiatives_status_check
           CHECK (status IN (${CANONICAL_STATUSES.map((s) => `'${s}'`).join(', ')}))`
      );
    }
  }, 60_000);
});
