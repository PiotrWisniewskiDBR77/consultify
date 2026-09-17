/** @vitest-environment node */

/**
 * B4 / DEC-576 (OPCJA C) — `deleteDemoDatasetForOrganization` proved against a
 * REAL PostgreSQL: the demo TTL purge still removes an expired clone org even
 * though that org wrote to the append-only `results_writer_observations` ledger.
 *
 * ===========================================================================
 * THE DEFECT THIS GUARDS
 * ===========================================================================
 * The purge walks `DEMO_DATASET_DELETE_QUERIES` children-first and runs every
 * DELETE with `{ fallback: false }`, so the first table that REFUSES a DELETE
 * throws and aborts the loop before it reaches `organizations` (the last entry).
 * `results_writer_observations` is append-only — migration 20261014 installs
 * `trg_results_writer_observation_no_delete` (BEFORE DELETE → RAISE
 * restrict_violation). While it sat in the list at `demoSeedService.ts:4415`,
 * any clone org with ≥1 ledger observation could never be purged: the DELETE
 * raised, the loop aborted, the org survived → the 126 staging orphans.
 *
 * OPCJA C removes the ledger from the purge list. The ledger has NO foreign key
 * on purpose (organization_id is plain TEXT — 20261014 l.56-59: "a cascading FK
 * into an append-only ledger would make the parent row undeletable"), so a
 * surviving observation row is a harmless dangling pointer, never an orphan that
 * blocks business-data cleanup. Retention of the ledger is an OWNER_DECISION.
 *
 * ===========================================================================
 * WHAT IS ASSERTED (KANAL Wpis 26 pkt 2a)
 * ===========================================================================
 *   clone org + 1 ledger observation + 1 row in 3 other list tables
 *   → deleteDemoDatasetForOrganization
 *   → organizations clone GONE, the 3 children GONE, ledger row STILL EXISTS.
 *
 * MUTATION PROOF (KANAL Wpis 26 pkt 2b, run live, not automated): re-adding
 * `['results_writer_observations','organization_id']` to the list makes the
 * purge abort at the ledger, the clone org survives, and the assertions below
 * turn RED. Reverting restores GREEN.
 *
 * ===========================================================================
 * FAIL-CLOSED GATE (KANAL Wpis 20, standard W164b) — read at module load
 * ===========================================================================
 *   RUN_DB_TESTS unset / ''/0/false/no/off → skip loudly with a reason;
 *   CI=true/GITHUB_ACTIONS without RUN_DB_TESTS → THROW (RC=1), never a green skip.
 *
 * How it was run for B4 (PG18, B port pool, dedicated migrated database):
 *
 *   docker run -d --name qoder-b-pg-1 -p 127.0.0.1:6610:5432 \
 *     -e POSTGRES_PASSWORD=qoder pgvector/pgvector:pg18
 *   docker exec qoder-b-pg-1 psql -U postgres -c 'CREATE DATABASE consultify_b4;'
 *   NODE_ENV=test DB_TYPE=postgres MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6610/consultify_b4 \
 *     npx tsx server/scripts/migrate.postgres.ts --dir server/migrations
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6610/consultify_b4 \
 *     npx vitest run --retry=0 \
 *       server/src/services/demo/__tests__/demoSeedService.purgeLedger.pg.test.ts
 */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { deleteDemoDatasetForOrganization } from '../demoSeedService.js';

const NO_RETRY = { retry: 0 } as const;

// --- fail-closed CI gate (KANAL Wpis 20) -----------------------------------
const ENV_AT_LOAD = {
  RUN_DB_TESTS: process.env.RUN_DB_TESTS,
  DATABASE_URL: process.env.DATABASE_URL,
};
const OPT_OUT = new Set(['', '0', 'false', 'no', 'off']);
const DB_TESTS_DEMANDED =
  ENV_AT_LOAD.RUN_DB_TESTS !== undefined &&
  !OPT_OUT.has(String(ENV_AT_LOAD.RUN_DB_TESTS).trim().toLowerCase());

// Read at module load so the throw happens during collection (RC=1), before any
// beforeAll can soften it. Locally (no CI) the suite still skips loudly below.
const IN_CI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
if (IN_CI && !DB_TESTS_DEMANDED) {
  throw new Error(
    'RealPG evidence must never be skipped in CI: set RUN_DB_TESTS=1 and DATABASE_URL'
  );
}

const LEDGER_TABLE = 'results_writer_observations';
const LEDGER_TRIGGER = 'trg_results_writer_observation_no_delete';
const CHILD_TABLES = ['notebook_pages', 'custom_prompts', 'activity_logs'] as const;

describe('B4/DEC-576 — demo TTL purge deletes the clone org, ledger row survives', NO_RETRY, () => {
  const cloneOrgId = `b4-clone-${randomUUID()}`;
  const observationId = `b4-obs-${randomUUID()}`;
  let sql: Client | undefined;
  let usable = false;
  let skipReason = 'RUN_DB_TESTS is not set — this suite skips on purpose';
  // Tables the purge actually ran a DELETE against (the `afterDeleteStep` seam
  // fires only for tables that EXIST). This is the real cleaned-table count the
  // meldunek reports — measured, not the "49"/"63" from the design doc.
  let cleanedTables: string[] = [];

  beforeAll(async () => {
    if (!DB_TESTS_DEMANDED) return;
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();

    // Premise check: the ledger AND its append-only trigger must exist, otherwise
    // the test would prove nothing (a missing trigger = no DELETE would ever be
    // refused). Fail loudly rather than pass vacuously.
    const ledger = await sql.query<{ t: number; trg: number }>(
      `SELECT (to_regclass('public.${LEDGER_TABLE}') IS NOT NULL)::int AS t,
              (SELECT count(*)::int FROM pg_trigger WHERE tgname = $1) AS trg`,
      [LEDGER_TRIGGER]
    );
    expect(ledger.rows[0].t, `${LEDGER_TABLE} missing — run migrations first`).toBe(1);
    expect(ledger.rows[0].trg, `${LEDGER_TRIGGER} missing — run migrations first`).toBe(1);

    // --- fixture: one expired clone org with business rows + a ledger row ---
    await sql!.query(
      `INSERT INTO organizations (id, name, status, is_active, billing_status)
       VALUES ($1,$2,$3,$4,$5)`,
      [cloneOrgId, 'B4 Expired Clone', 'active', 1, 'ACTIVE']
    );
    // The append-only observation that used to wedge the purge.
    await sql!.query(
      `INSERT INTO ${LEDGER_TABLE}
         (observation_id, organization_id, actor_user_id, writer_family, operation, endpoint, correlation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [observationId, cloneOrgId, null, 'legacy_kpi_crud', 'b4.purge.proof', '/api/b4', `corr-${cloneOrgId}`]
    );
    // One row in three other org-scoped list tables (children the purge must remove).
    await sql!.query(
      `INSERT INTO notebook_pages (id, owner_user_id, organization_id, title)
       VALUES ($1,$2,$3,$4)`,
      [`b4-np-${cloneOrgId}`, 'b4-owner', cloneOrgId, 'B4 page']
    );
    await sql!.query(
      `INSERT INTO custom_prompts (id, organization_id, name, context, template)
       VALUES ($1,$2,$3,$4,$5)`,
      [`b4-cp-${cloneOrgId}`, cloneOrgId, 'B4 prompt', 'ctx', 'tpl']
    );
    await sql!.query(
      `INSERT INTO activity_logs (id, organization_id, action, entity_type)
       VALUES ($1,$2,$3,$4)`,
      [`b4-al-${cloneOrgId}`, cloneOrgId, 'B4_ACTION', 'test']
    );

    usable = true;
  }, 120_000);

  afterAll(async () => {
    if (!sql) return;
    const client = sql;
    try {
      // The ledger row SURVIVES the purge by design, so normal DELETE is refused
      // by the trigger. Documented test teardown (20261014): inside a disposable
      // database, disable the precisely-named trigger, delete, re-enable. The
      // prod/demo-host guard already ran in assertRealPostgresTestEnvironment().
      await client
        .query(`ALTER TABLE ${LEDGER_TABLE} DISABLE TRIGGER ${LEDGER_TRIGGER}`)
        .catch(() => undefined);
      await client
        .query(`DELETE FROM ${LEDGER_TABLE} WHERE organization_id = $1`, [cloneOrgId])
        .catch(() => undefined);
      await client
        .query(`ALTER TABLE ${LEDGER_TABLE} ENABLE TRIGGER ${LEDGER_TRIGGER}`)
        .catch(() => undefined);
      // Defensive: drop any fixture row that survived a mid-test failure. The org
      // DELETE cascades to custom_prompts/activity_logs (FK ON DELETE CASCADE);
      // notebook_pages has no FK, so it is removed explicitly.
      await client
        .query(`DELETE FROM notebook_pages WHERE organization_id = $1`, [cloneOrgId])
        .catch(() => undefined);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [cloneOrgId]).catch(() => undefined);
    } finally {
      await client.end().catch(() => undefined);
    }
  }, 60_000);

  // it/it.skip is decided at COLLECTION time → key on DB_TESTS_DEMANDED (module
  // load), NOT on `usable` (set in beforeAll). Keying on `usable` would report
  // skipped even with a working PostgreSQL (KANAL Wpis 20 PUŁAPKA).
  const guard = (name: string, fn: () => Promise<void>) =>
    (DB_TESTS_DEMANDED ? it : it.skip)(name, async () => {
      if (!usable) {
        // eslint-disable-next-line no-console
        console.warn(`[B4 purge pg] SKIPPED: ${skipReason}`);
        return;
      }
      await fn();
    }, 120_000);

  guard('purge removes the clone org and its children but leaves the append-only ledger row', async () => {
    if (!sql) throw new Error('beforeAll did not establish a SQL connection.');

    cleanedTables = [];
    await deleteDemoDatasetForOrganization(cloneOrgId, {
      afterDeleteStep: (table) => {
        cleanedTables.push(table);
      },
    });

    // (1) the clone org is GONE — the loop reached `organizations` and deleted it.
    const org = await sql.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM organizations WHERE id = $1`,
      [cloneOrgId]
    );
    expect(org.rows[0].c, 'clone org survived the purge — loop aborted before organizations').toBe(0);

    // (2) the three business children are GONE.
    for (const table of CHILD_TABLES) {
      const child = await sql.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM ${table} WHERE organization_id = $1`,
        [cloneOrgId]
      );
      expect(child.rows[0].c, `${table} row survived the purge`).toBe(0);
    }

    // (3) the append-only ledger row STILL EXISTS (dangling pointer by contract).
    const ledger = await sql.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM ${LEDGER_TABLE} WHERE organization_id = $1`,
      [cloneOrgId]
    );
    expect(ledger.rows[0].c, 'ledger row was deleted — it must survive as a dangling pointer').toBe(1);

    // (4) the purge never targeted the ledger, and finished on `organizations`.
    expect(cleanedTables).not.toContain(LEDGER_TABLE);
    expect(cleanedTables[cleanedTables.length - 1]).toBe('organizations');
    for (const table of CHILD_TABLES) expect(cleanedTables).toContain(table);

    // The real number of tables the purge cleaned on this migrated schema —
    // reported in the meldunek instead of the design doc's "49"/"63".
    // eslint-disable-next-line no-console
    console.log(`[B4 purge pg] real cleaned-table count = ${cleanedTables.length}`);
    expect(cleanedTables.length).toBeGreaterThan(0);
  });
});
