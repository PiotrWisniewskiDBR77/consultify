/** @vitest-environment node */

/**
 * D-66 (Wpis 86 · DEC-539) — the clone seed must survive migration `20262260`.
 *
 * Measured defect (CTO A/B probe, `sonda-d66-20260917`): on a dump-22 base
 * WITHOUT `20262260` `startDemoSession` is OK; WITH it EVERY new demo session on
 * staging fails at `closureDeliveryReceiptService.ts:224`
 * ("materialized DONE receipt was not persisted"). Cause: the seed inserts the
 * legacy row with `status='CLOSED'` and then registers the canonical twin, whose
 * aggregate lands on the hardcoded `lifecycleState='REGISTERED_DRAFT'`
 * (`registerInitiative.ts:134`). The 20262260 cascade
 * (`ie_aggregate_initiative_stage_sync` -> `sync_initiative_stage_from_aggregate`
 * -> `initiatives_lifecycle_stage_sync`) rewrites the column FROM that stage, so
 * CLOSED becomes DRAFT and the receipt's `INSERT ... SELECT WHERE UPPER(status)
 * = 'CLOSED'` matches 0 rows.
 *
 * Fix under test: right after the canonical register the seed repairs the
 * aggregate stage from the status IT seeded (`alignSeedInitiativeStage`), and the
 * same cascade then derives the column back. Dispositions (seeded CANCELLED ->
 * REJECTED) have no engine stage, so the seed re-asserts the column directly.
 *
 * This file proves, on a COPY OF DUMP 22 + the 3 pending migrations (including
 * 20262260), that:
 *  1) `startDemoSession` no longer throws and reports `datasetComplete === true`;
 *  2) the clone's `initiatives.status` counts are EXACTLY the counts the seed
 *     template asks for (CLOSED/IN_EXECUTION/DRAFT/... parity, before == after);
 *  3) 0 status-vs-aggregate rows diverge;
 *  4) every seeded CLOSED initiative carries stage CLOSED (not REGISTERED_DRAFT)
 *     and HAS its closure delivery receipt.
 *
 * Mutation proof (measured, reverted): removing the `alignSeedInitiativeStage`
 * call from `demoSeedService` turns tests 1-4 RED with the original
 * "materialized DONE receipt was not persisted".
 *
 * The base MUST contain 20262260 — the test asserts it instead of skipping, so a
 * GREEN can never mean "the trigger was simply not there".
 *
 * URUCHOMIENIE:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false MOCK_REDIS=true \
 *   DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6612/consultify_dump \
 *   npx vitest run server/src/services/demo/__tests__/demoSeedStageParity.pg.test.ts \
 *     --maxWorkers=1 --no-file-parallelism --retry=0
 */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { normalizeInitiativeStatus } from '../../../constants/initiativeStatuses.js';
import { planAggregateAlignment } from '../../initiatives/alignInitiativeAggregateService.js';
import { getAtelierToysInitiatives } from '../atelierToysDemoTemplate.js';
import { deleteDemoDatasetForOrganization } from '../demoSeedService.js';
import { startDemoSession } from '../demoSessionService.js';

const NO_RETRY = { retry: 0 } as const;
const LOCALE = 'en' as const;

/** The migration whose trigger cascade breaks the seed — the base MUST have it. */
const STAGE_1_MIGRATION = '20262260_initiatives_lifecycle_stage.sql';

/**
 * The status counts the seed TEMPLATE asks for, derived with the SAME
 * normalizer the seed uses (`resolveSeedInitiativeStatus` ->
 * `normalizeInitiativeStatus`, falling back to DRAFT). This is the "PRZED" side
 * of the parity check; the DB read after `startDemoSession` is the "PO" side.
 */
function expectedStatusCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const initiative of getAtelierToysInitiatives(LOCALE)) {
    const status = normalizeInitiativeStatus(String(initiative.status ?? '')) ?? 'DRAFT';
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function countsFromRows(rows: Array<{ status: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const status = String(row.status ?? 'DRAFT').toUpperCase();
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

interface CloneRow {
  id: string;
  status: string;
  lifecycleStage: string | null;
  aggregateStage: string | null;
}

describe('D-66 — clone seed keeps the seeded status through the 20262260 cascade', NO_RETRY, () => {
  const userId = `d66-${randomUUID()}`;
  let sql: Client | undefined;
  let sessionOrgId = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(String(process.env.DATABASE_URL || '')).toMatch(/^postgres/);
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();

    const applied = await sql.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations WHERE filename = $1`,
      [STAGE_1_MIGRATION]
    );
    expect(
      applied.rows.map((r) => r.filename),
      `the base MUST carry ${STAGE_1_MIGRATION}, otherwise this GREEN proves nothing`
    ).toEqual([STAGE_1_MIGRATION]);

    // `demo_sessions.base_org_id` is an FK and the module-level DEMO_ORG_ID
    // defaults to 'demo-org', which the dump does not necessarily contain.
    await sql.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ('demo-org', 'Demo Base (test only)', 'demo', 'active')
       ON CONFLICT (id) DO NOTHING`
    );
    await sql.query(`INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [userId]);
  }, 60_000);

  afterAll(async () => {
    if (!sql) return;
    const client = sql;
    try {
      if (sessionOrgId) {
        await deleteDemoDatasetForOrganization(sessionOrgId).catch(() => undefined);
        for (const table of [
          'closure_delivery_receipts',
          'ie_outbox_events',
          'ie_audit_events',
          'ie_command_receipts',
          'ie_aggregate_relations',
          'ie_aggregate_state',
          'initiative_candidates',
        ]) {
          await client
            .query(`DELETE FROM ${table} WHERE organization_id=$1`, [sessionOrgId])
            .catch(() => undefined);
        }
        await client
          .query(`DELETE FROM organizations WHERE id=$1`, [sessionOrgId])
          .catch(() => undefined);
      }
      await client
        .query(`DELETE FROM demo_session_tenants WHERE base_org_id=$1 OR tenant_org_id=$1`, [
          sessionOrgId,
        ])
        .catch(() => undefined);
      await client
        .query(`DELETE FROM demo_sessions WHERE user_id=$1`, [userId])
        .catch(() => undefined);
      await client
        .query(`DELETE FROM user_preferences WHERE user_id=$1`, [userId])
        .catch(() => undefined);
      await client
        .query(`DELETE FROM organizations WHERE id='demo-org' AND name='Demo Base (test only)'`)
        .catch(() => undefined);
      await client.query(`DELETE FROM users WHERE id=$1`, [userId]).catch(() => undefined);
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  it('startDemoSession completes on a base WITH 20262260 (no receipt throw)', async () => {
    if (!sql) throw new Error('beforeAll did not establish a SQL connection.');
    const session = await startDemoSession(userId, 'demo_toggle', LOCALE);
    sessionOrgId = session.session_org_id;
    expect(session.datasetComplete).toBe(true);
    expect(sessionOrgId).toContain('demo-org-session-');
  }, 240_000);

  it('the clone initiatives.status counts equal the seed template counts (PRZED == PO)', async () => {
    if (!sql || !sessionOrgId) throw new Error('no clone org — see the previous test.');
    const rows = await sql.query<{ status: string }>(
      `SELECT UPPER(COALESCE(status,'DRAFT')) AS status FROM initiatives WHERE organization_id=$1`,
      [sessionOrgId]
    );
    const expected = expectedStatusCounts();
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(countsFromRows(rows.rows)).toEqual(expected);
    // Pinned explicitly so a template change cannot silently move the goalposts.
    expect(expected.CLOSED).toBeGreaterThan(0);
  }, 60_000);

  it('0 status-vs-aggregate rows diverge, and CLOSED rows carry stage CLOSED', async () => {
    if (!sql || !sessionOrgId) throw new Error('no clone org — see the previous test.');
    const rows = await sql.query<CloneRow>(
      `SELECT i.id,
              UPPER(COALESCE(i.status,'DRAFT')) AS status,
              i.lifecycle_stage AS "lifecycleStage",
              a.payload_json->>'lifecycleState' AS "aggregateStage"
         FROM initiatives i
         JOIN ie_aggregate_state a
           ON a.aggregate_type = 'initiative'
          AND a.aggregate_id = i.id
          AND a.organization_id = i.organization_id
        WHERE i.organization_id = $1`,
      [sessionOrgId]
    );
    expect(rows.rows.length).toBeGreaterThan(0);

    const divergent = rows.rows.filter(
      (r) => planAggregateAlignment(r.status, r.aggregateStage).action === 'align'
    );
    expect(divergent).toEqual([]);

    // The measured defect shape: a seeded CLOSED initiative whose aggregate still
    // sits at the register's hardcoded REGISTERED_DRAFT.
    const closedRows = rows.rows.filter((r) => r.status === 'CLOSED');
    expect(closedRows.length).toBeGreaterThan(0);
    for (const row of closedRows) {
      expect(row.aggregateStage, `CLOSED initiative ${row.id} aggregate stage`).toBe('CLOSED');
      expect(row.lifecycleStage, `CLOSED initiative ${row.id} column stage`).toBe('CLOSED');
    }
    expect(rows.rows.some((r) => r.aggregateStage === 'REGISTERED_DRAFT' && r.status === 'CLOSED')).toBe(
      false
    );
  }, 60_000);

  it('every seeded CLOSED initiative has its closure delivery receipt', async () => {
    if (!sql || !sessionOrgId) throw new Error('no clone org — see the previous test.');
    const missing = await sql.query<{ id: string }>(
      `SELECT i.id
         FROM initiatives i
        WHERE i.organization_id = $1
          AND UPPER(COALESCE(i.status,'DRAFT')) = 'CLOSED'
          AND NOT EXISTS (
                SELECT 1 FROM closure_delivery_receipts r
                 WHERE r.organization_id = i.organization_id
                   AND r.initiative_id = i.id
              )`,
      [sessionOrgId]
    );
    expect(missing.rows).toEqual([]);

    const receipts = await sql.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM closure_delivery_receipts WHERE organization_id=$1`,
      [sessionOrgId]
    );
    expect(Number(receipts.rows[0]?.n ?? 0)).toBeGreaterThan(0);
  }, 60_000);
});
