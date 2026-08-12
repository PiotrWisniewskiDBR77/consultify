/**
 * ROI-E001 — baseline freeze-protection trigger, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §3
 * (`rvn_roi_baselines_protect_frozen` trigger) / §4.4-§4.5
 * (`captureOrUpdateBaseline`'s `RoiBaselineFrozenError` guard,
 * `freezeRoiBaseline`'s cross-epic contract). Exercises `captureOrUpdateBaseline`
 * against a real Postgres, freezes the row via `freezeRoiBaseline` (the
 * function ROI-E003's future `approveRoiCase` will call), then asserts the
 * DB TRIGGER ITSELF (not application code) genuinely rejects a direct
 * UPDATE that mutates a frozen content column — same requirement shape
 * `initiativeKpiImpactBaselineFreeze.realdb.test.ts` proved for KPI-E005's
 * own baseline-protect trigger.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureRoiFixtureOrganization } from './roiRealdbOrgFixture.js';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e001-baseline-freeze-org-${tag}`;
const USER_OWNER = `roi-e001-baseline-freeze-owner-${tag}`;
const INITIATIVE_ID = `roi-e001-baseline-freeze-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let freezeRoiBaseline: BaselineCommandsModule['freezeRoiBaseline'];
let RoiBaselineFrozenError: BaselineCommandsModule['RoiBaselineFrozenError'];
let closePgPool: (() => Promise<void>) | undefined;
let acquirePgClient: PgModule['acquirePgClient'];

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

describe('ROI-E001 baseline — freeze-protection trigger (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — ROI baseline freeze realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_baselines LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiBaselineFreeze realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        INITIATIVE_ID,
        ORG_ID,
        'Baseline-freeze fixture initiative',
      ]);
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI schema/initiatives fixture); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
    );
    createRoiCase = caseCommands.createRoiCase;

    const baselineCommands: BaselineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;
    freezeRoiBaseline = baselineCommands.freezeRoiBaseline;
    RoiBaselineFrozenError = baselineCommands.RoiBaselineFrozenError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
    acquirePgClient = pgModule.acquirePgClient;

    await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_OWNER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    // rvn_platform_resource_acl has no organization_id column (PRIMARY KEY
    // is resource_type/resource_id/grantee_type/grantee_id) — scope via a
    // subquery over this org's own case ids, BEFORE the rvn_roi_cases
    // delete below removes them.
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(
      `DELETE FROM rvn_platform_obligations WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    // ROI-E002: createRoiCase now also inserts a rvn_roi_calculation_policy
    // shell row (FK to rvn_roi_cases) — must be deleted before rvn_roi_cases
    // itself, same ordering requirement rvn_roi_baselines already had.
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'captureOrUpdateBaseline succeeds pre-freeze, freezeRoiBaseline freezes it, a further captureOrUpdateBaseline ' +
      'call throws the typed RoiBaselineFrozenError, and the DB trigger itself rejects a raw UPDATE bypassing the command layer',
    async () => {
      const createOutcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        title: 'Freeze-trigger fixture case',
        ownerUserId: USER_OWNER,
        currency: 'USD',
        createdBy: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-${randomUUID()}`,
      });
      const caseId = createOutcome.result.case.caseId;
      expect(createOutcome.result.baseline.frozenAt).toBeNull();

      // Pre-freeze: captureOrUpdateBaseline succeeds normally.
      const captureOutcome = await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: 1,
        baselinePeriodStart: '2026-01-01',
        baselinePeriodEnd: '2026-01-31',
        currentMeasuredValue: 100,
        currentMeasuredUnit: 'hours',
        actorId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `capture-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(captureOutcome.outcome).toBe('applied');
      expect(captureOutcome.result.currentMeasuredValue).toBe(100);
      expect(captureOutcome.result.frozenAt).toBeNull();

      // Freeze it (the function ROI-E003's future approveRoiCase will call,
      // on its own pinned client — here just acquired directly to prove the
      // contract works standalone).
      const freezeClient = await acquirePgClient();
      try {
        await freezeRoiBaseline(freezeClient, { caseId, organizationId: ORG_ID, frozenBy: USER_OWNER });
      } finally {
        freezeClient.release();
      }

      const frozenRowCheck = await client.query<{ frozen_at: string | null; row_version: number }>(
        `SELECT frozen_at, row_version FROM rvn_roi_baselines WHERE case_id = $1`,
        [caseId]
      );
      expect(frozenRowCheck.rows[0]?.frozen_at).not.toBeNull();
      const frozenRowVersion = frozenRowCheck.rows[0]!.row_version;

      // Application-layer guard: a further captureOrUpdateBaseline call on
      // the now-frozen baseline throws the typed RoiBaselineFrozenError,
      // BEFORE ever reaching the UPDATE statement.
      await expect(
        captureOrUpdateBaseline({
          organizationId: ORG_ID,
          caseId,
          expectedVersion: frozenRowVersion,
          currentMeasuredValue: 999,
          actorId: USER_OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `capture-after-freeze-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toBeInstanceOf(RoiBaselineFrozenError);

      // The REAL guarantee: the DB TRIGGER itself rejects a raw UPDATE that
      // mutates a frozen content column, even bypassing the command layer
      // entirely — this is what proves the trigger, not just the
      // application check, blocks the mutation (design §3's own DoD).
      await expect(
        client.query(`UPDATE rvn_roi_baselines SET current_measured_value = 12345 WHERE case_id = $1`, [caseId])
      ).rejects.toThrow(/frozen/i);

      // Bookkeeping-only mutations (row_version/updated_at) remain legal on
      // a frozen row per the trigger's own comment ("only row_version/
      // updated_at bookkeeping may change").
      await expect(
        client.query(
          `UPDATE rvn_roi_baselines SET row_version = row_version + 1, updated_at = now() WHERE case_id = $1`,
          [caseId]
        )
      ).resolves.toBeTruthy();

      // The value itself never changed — still 100 from the pre-freeze
      // capture, never the raw UPDATE's rejected 12345.
      const finalRow = await client.query<{ current_measured_value: string | null }>(
        `SELECT current_measured_value FROM rvn_roi_baselines WHERE case_id = $1`,
        [caseId]
      );
      expect(Number(finalRow.rows[0]?.current_measured_value)).toBe(100);
    }
  );
});
