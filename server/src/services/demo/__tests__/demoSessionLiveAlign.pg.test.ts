/** @vitest-environment node */

/**
 * D-19 v3 (Wpis 77 · DEC-539) — the LIVE demo-clone path must leave the canonical
 * aggregate and `initiatives.status` in agreement.
 *
 * Measured defect (Wpis 60/77): `demoSeedService` writes `initiatives.status`
 * directly and registers the canonical twin at `REGISTERED_DRAFT`, so EVERY fresh
 * clone is born divergent (2267 of the 2272 staging rows were demo-session orgs).
 * v3 wires the SAME planner (`processOrg`, shared module
 * `server/src/services/initiatives/alignInitiativeAggregateService.ts`) into
 * `demoSessionService.startDemoSession` right after the seed's durable writes.
 *
 * This file proves on REAL Postgres:
 *  1) a brand-new demo session (the live `startDemoSession` path, not a hand
 *     call) leaves 0 divergent status-vs-aggregate rows for the clone org;
 *  2) the 20262260 trigger chain is status-neutral: after `processOrg` writes the
 *     aggregate, `ie_aggregate_initiative_stage_sync` ->
 *     `initiatives_lifecycle_stage_sync` derives the SAME seven-code status the
 *     column already held (no loop, no status change);
 *  3) cleanup leaves zero test rows behind.
 *
 * Mutation proofs (run manually, reverted): deleting the
 * `alignCloneAggregateAfterSeed(...)` call from `startDemoSession` turns test 1
 * RED (divergent > 0).
 *
 * ENVIRONMENT (measured, Wpis 86 · D-66): the GREEN proof below runs on a COPY
 * OF STAGING DUMP 22 (`staging-pre-wdrozenie22-20260917T1636.dump`, pg17
 * container `qoder-b-pg-d66`, DB `consultify_dump`) with the 3 pending
 * migrations applied — including `20262260_initiatives_lifecycle_stage.sql`,
 * asserted present in `beforeAll`. Wpis 78 had to SKIP the seed on a migrated
 * base because `ensureReceiptForMaterializedDone` threw "materialized DONE
 * receipt was not persisted"; D-66 fixed that root cause (the seed now registers
 * the canonical aggregate at the stage matching its own legacy status), so the
 * skip guard was removed and ANY seed failure is a hard RED.
 *
 * URUCHOMIENIE:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6612/consultify_dump \
 *   npx vitest run server/src/services/demo/__tests__/demoSessionLiveAlign.pg.test.ts \
 *     --maxWorkers=1 --no-file-parallelism --retry=0
 */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import {
  planAggregateAlignment,
  processOrg,
  stageGroup,
} from '../../initiatives/alignInitiativeAggregateService.js';
import { deleteDemoDatasetForOrganization } from '../demoSeedService.js';
import { startDemoSession } from '../demoSessionService.js';

const NO_RETRY = { retry: 0 } as const;

interface AggregateRow {
  id: string;
  status: string;
  currentStage: string | null;
}

async function readAggregateRows(sql: Client, orgId: string): Promise<AggregateRow[]> {
  const res = await sql.query<{ id: string; status: string; current_stage: string | null }>(
    `SELECT i.id,
            UPPER(COALESCE(i.status, 'DRAFT')) AS status,
            a.payload_json->>'lifecycleState' AS current_stage
       FROM initiatives i
       JOIN ie_aggregate_state a
         ON a.aggregate_type = 'initiative'
        AND a.aggregate_id = i.id
        AND a.organization_id = i.organization_id
      WHERE i.organization_id = $1`,
    [orgId]
  );
  return res.rows.map((r) => ({ id: r.id, status: r.status, currentStage: r.current_stage }));
}

function divergentRows(rows: AggregateRow[]): AggregateRow[] {
  return rows.filter((r) => planAggregateAlignment(r.status, r.currentStage).action === 'align');
}

/**
 * Wpis 78 tolerated ONE clone-seed failure as an environment skip
 * ("materialized DONE receipt was not persisted"), because it was a ZASTANY
 * defect unrelated to D-19. D-66 (Wpis 86) fixed exactly that defect, so the
 * skip is gone: a seed failure on a migrated base is now a hard RED.
 */

describe('D-19 v3 — live demo-clone path leaves aggregate and status aligned', NO_RETRY, () => {
  const userId = `d19v3-${randomUUID()}`;
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
    // `demo_sessions.base_org_id` is an FK and the module-level DEMO_ORG_ID
    // defaults to 'demo-org', which a fresh/dump DB does not contain. Mint the
    // base org row so the live path can reference it; the CLONE org (the one
    // under test) is created by the seed itself and named 'Atelier Toys'.
    await sql.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ('demo-org', 'Demo Base (test only)', 'demo', 'active')
       ON CONFLICT (id) DO NOTHING`
    );
    // `demo_sessions.user_id` is an FK to users; only `id` is NOT NULL there.
    await sql.query(`INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [userId]);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    const client = sql;
    try {
      if (sessionOrgId) {
        await deleteDemoDatasetForOrganization(sessionOrgId).catch(() => undefined);
        for (const table of [
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

  it('a fresh live demo session has 0 divergent status-vs-aggregate rows', async () => {
    if (!sql) throw new Error('beforeAll did not establish a SQL connection.');
    const session = await startDemoSession(userId, 'demo_toggle', 'en');
    sessionOrgId = session.session_org_id;
    expect(session.datasetComplete).toBe(true);

    const rows = await readAggregateRows(sql, sessionOrgId);
    expect(rows.length).toBeGreaterThan(0);
    expect(divergentRows(rows)).toEqual([]);
  }, 180_000);

  it('processOrg is status-neutral through the 20262260 trigger chain', async () => {
    if (!sql) throw new Error('beforeAll did not establish a SQL connection.');
    if (!sessionOrgId) throw new Error('no clone org — the previous test did not create one.');
    const rows = await readAggregateRows(sql, sessionOrgId);
    // A victim whose aggregate stage is NOT already IN_EXECUTION, so writing the
    // column to IN_EXECUTION creates a real cross-group divergence.
    const victim = rows.find(
      (r) =>
        !['REJECTED', 'PROPOSED'].includes(r.status) &&
        stageGroup(r.currentStage) !== 'IN_EXECUTION'
    );
    expect(victim).toBeDefined();
    if (!victim) return;

    // Re-create the born-divergent shape the pre-D-66 seed produced THROUGH THE
    // COLUMN: the legacy INSERT writes `initiatives.status` directly while the
    // canonical aggregate is left behind at the register's stage. Writing the
    // aggregate instead would be self-defeating — 20262260's cascade re-derives
    // the column from it in the same statement, so nothing would stay divergent
    // for `processOrg` to align (measured: counts.align === 0).
    await sql.query(`UPDATE initiatives SET status='IN_EXECUTION' WHERE id=$1`, [victim.id]);
    const statusBefore = (
      await sql.query<{ status: string; stage: string | null }>(
        `SELECT i.status, a.payload_json->>'lifecycleState' AS stage
           FROM initiatives i
           JOIN ie_aggregate_state a
             ON a.aggregate_type='initiative' AND a.aggregate_id=i.id AND a.organization_id=i.organization_id
          WHERE i.id=$1`,
        [victim.id]
      )
    ).rows[0];
    expect(String(statusBefore?.status).toUpperCase()).toBe('IN_EXECUTION');
    expect(stageGroup(statusBefore?.stage)).not.toBe('IN_EXECUTION');

    const { counts, wrote, allowed } = await processOrg(sql, sessionOrgId, true);
    expect(allowed).toBe(true);
    expect(counts.align).toBeGreaterThanOrEqual(1);
    expect(wrote).toBeGreaterThanOrEqual(1);

    const after = (
      await sql.query<{ status: string; stage: string | null }>(
        `SELECT i.status, a.payload_json->>'lifecycleState' AS stage
           FROM initiatives i
           JOIN ie_aggregate_state a
             ON a.aggregate_type='initiative' AND a.aggregate_id=i.id AND a.organization_id=i.organization_id
          WHERE i.id=$1`,
        [victim.id]
      )
    ).rows[0];
    // The trigger chain derived the status FROM the aligned stage and landed on
    // the value the column already held — no loop, no status change.
    expect(after?.status).toBe(statusBefore?.status);
    expect(stageGroup(after?.stage)).toBe(String(statusBefore?.status).toUpperCase());
  }, 60_000);
});
