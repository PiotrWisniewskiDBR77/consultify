/**
 * ROI-E004 — `createRoiForecastVersion` (AC-01: forecast never mutates
 * Approved), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decisions
 * D1/D3/D4/D5/D6/D7.
 *
 * THE LITERAL AC-01 PROOF (mirroring `roiCaseReapproval.realdb.test.ts`'s
 * hash-stability style): creates a forecast WITH overrides, then re-reads
 * the original approval snapshot's `content_hash`/full payload AND every
 * frozen `rvn_roi_assumptions`/`rvn_roi_cost_lines`/`rvn_roi_benefit_lines`
 * row, asserting byte-identical/unchanged before vs. after — an override
 * changes only the forecast's OWN computed numbers, never the underlying
 * frozen economic-model rows or the approval record.
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
const ORG_ID = `roi-e004-forecast-org-${tag}`;
const USER_MAKER = `roi-e004-forecast-maker-${tag}`;
const USER_APPROVER = `roi-e004-forecast-approver-${tag}`;
const INITIATIVE_ID = `roi-e004-forecast-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type AssumptionCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
type ForecastCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiForecastVersionCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let addAssumption: AssumptionCommandsModule['addAssumption'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let submitRoiCaseForApproval: ApprovalCommandsModule['submitRoiCaseForApproval'];
let approveRoiCase: ApprovalCommandsModule['approveRoiCase'];
let startRoiCaseTracking: TrackingCommandsModule['startRoiCaseTracking'];
let createRoiForecastVersion: ForecastCommandsModule['createRoiForecastVersion'];
let RoiForecastVersionValidationError: ForecastCommandsModule['RoiForecastVersionValidationError'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

interface TrackingCaseFixture {
  caseId: string;
  costLineId: string;
  benefitLineId: string;
  assumptionId: string;
  approvalSnapshotId: string;
  rowVersion: number;
}

async function buildTrackingCase(suffix: string): Promise<TrackingCaseFixture> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Forecast fixture initiative',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Forecast fixture case',
    ownerUserId: USER_MAKER,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  const caseId = createOutcome.result.case.caseId;

  const startOutcome = await startModeling({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: createOutcome.result.case.rowVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `start-${randomUUID()}`,
  });

  await captureOrUpdateBaseline({
    organizationId: ORG_ID,
    caseId,
    expectedVersion: createOutcome.result.baseline.rowVersion,
    currentMeasuredValue: 100,
    baselinePeriodStart: '2026-01-01',
    baselinePeriodEnd: '2026-01-31',
    actorId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `baseline-${randomUUID()}`,
  });

  const assumptionOutcome = await addAssumption({
    caseId,
    organizationId: ORG_ID,
    category: 'market',
    label: 'Adoption rate',
    baseValue: 50,
    downsideValue: 30,
    upsideValue: 70,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `assumption-${randomUUID()}`,
  });

  const costLineOutcome = await addCostLine({
    caseId,
    organizationId: ORG_ID,
    category: 'implementation',
    label: 'Setup',
    amount: 1000,
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: '2026-01-15',
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `cost-${randomUUID()}`,
  });
  const benefitLineOutcome = await addBenefitLine({
    caseId,
    organizationId: ORG_ID,
    category: 'revenue',
    label: 'New revenue',
    isFinancial: true,
    amount: 2000,
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: '2026-02-15',
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `benefit-${randomUUID()}`,
  });

  await createRoiCalculationRun({
    organizationId: ORG_ID,
    caseId,
    scenarioId: null,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `run-${randomUUID()}`,
  });

  const readyOutcome = await markReadyForReview({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: startOutcome.resultingVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `ready-${randomUUID()}`,
  });
  const submitOutcome = await submitRoiCaseForApproval({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: readyOutcome.resultingVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `submit-${randomUUID()}`,
  });
  const approveOutcome = await approveRoiCase({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: submitOutcome.resultingVersion,
    approverId: USER_APPROVER,
    actorEffectiveRole: 'admin',
    idempotencyKey: `approve-${randomUUID()}`,
  });

  const trackingOutcome = await startRoiCaseTracking({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: approveOutcome.resultingVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `tracking-${randomUUID()}`,
  });

  return {
    caseId,
    costLineId: costLineOutcome.result.costLineId,
    benefitLineId: benefitLineOutcome.result.benefitLineId,
    assumptionId: assumptionOutcome.result.assumptionId,
    approvalSnapshotId: approveOutcome.result.snapshot.snapshotId,
    rowVersion: trackingOutcome.resultingVersion,
  };
}

describe('ROI-E004 createRoiForecastVersion — AC-01 (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E004 forecast realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_forecast_versions LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id))`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiForecastVersion realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL)`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI-E004 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;
    markReadyForReview = caseCommands.markReadyForReview;
    const baselineCommands: BaselineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;
    const assumptionCommands: AssumptionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js'
    );
    addAssumption = assumptionCommands.addAssumption;
    const costLineCommands: CostLineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
    addCostLine = costLineCommands.addCostLine;
    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    addBenefitLine = benefitLineCommands.addBenefitLine;
    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;
    const approvalCommands: ApprovalCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
    );
    submitRoiCaseForApproval = approvalCommands.submitRoiCaseForApproval;
    approveRoiCase = approvalCommands.approveRoiCase;
    const trackingCommands: TrackingCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js'
    );
    startRoiCaseTracking = trackingCommands.startRoiCaseTracking;
    const forecastCommands: ForecastCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiForecastVersionCommands.js'
    );
    createRoiForecastVersion = forecastCommands.createRoiForecastVersion;
    RoiForecastVersionValidationError = forecastCommands.RoiForecastVersionValidationError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertVisibilityPolicy('roi', 'OPEN_ORG', USER_MAKER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `UPDATE rvn_roi_cases SET current_forecast_version_id = NULL, current_actual_snapshot_id = NULL
        WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_variance_causes WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_variances WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_actual_snapshots WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_actual_entries WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_forecast_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_roi_cases SET original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
              decision_calculation_run_id = NULL
        WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_approval_snapshots WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_assumptions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
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
    'creating a forecast WITH overrides leaves the approval snapshot content_hash/payload AND the frozen assumption/cost-line/benefit-line rows byte-unchanged (AC-01)',
    async () => {
      const fixture = await buildTrackingCase('1');

      // ---- capture BEFORE state ----
      const snapshotBefore = await client.query<{ content_hash: string; snapshot_payload: unknown }>(
        `SELECT content_hash, snapshot_payload FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`,
        [fixture.approvalSnapshotId]
      );
      const contentHashBefore = snapshotBefore.rows[0]!.content_hash;
      const payloadBefore = snapshotBefore.rows[0]!.snapshot_payload;
      expect(contentHashBefore.length).toBeGreaterThan(0);

      const assumptionRowBefore = await client.query(`SELECT * FROM rvn_roi_assumptions WHERE assumption_id = $1`, [
        fixture.assumptionId,
      ]);
      const costLineRowBefore = await client.query(`SELECT * FROM rvn_roi_cost_lines WHERE cost_line_id = $1`, [fixture.costLineId]);
      const benefitLineRowBefore = await client.query(`SELECT * FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1`, [
        fixture.benefitLineId,
      ]);

      // ---- create a forecast WITH overrides (a different cost amount than
      // the frozen model's own value) ----
      const forecastOutcome = await createRoiForecastVersion({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: fixture.rowVersion,
        reason: 'Q2 reforecast — updated vendor quote',
        overrides: [{ targetType: 'cost_line', targetId: fixture.costLineId, overrideAmount: 1500 }],
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `forecast-1-${randomUUID()}`,
      });

      expect(forecastOutcome.outcome).toBe('applied');
      expect(forecastOutcome.result.sequenceNumber).toBe(1);
      expect(forecastOutcome.result.status).toBe('completed');
      expect(forecastOutcome.result.comparedAgainstSnapshotId).toBe(fixture.approvalSnapshotId);
      // The override changed the forecast's OWN cost total (1500 instead of
      // the frozen model's 1000).
      expect(forecastOutcome.result.totalCosts).toBe(1500);

      const caseRow = await client.query<{ current_forecast_version_id: string }>(
        `SELECT current_forecast_version_id FROM rvn_roi_cases WHERE case_id = $1`,
        [fixture.caseId]
      );
      expect(caseRow.rows[0]!.current_forecast_version_id).toBe(forecastOutcome.result.forecastVersionId);

      // ---- THE AC-01 PROOF: re-read after, assert byte-identical/unchanged ----
      const snapshotAfter = await client.query<{ content_hash: string; snapshot_payload: unknown }>(
        `SELECT content_hash, snapshot_payload FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`,
        [fixture.approvalSnapshotId]
      );
      expect(snapshotAfter.rows[0]!.content_hash).toBe(contentHashBefore);
      expect(snapshotAfter.rows[0]!.snapshot_payload).toEqual(payloadBefore);

      const assumptionRowAfter = await client.query(`SELECT * FROM rvn_roi_assumptions WHERE assumption_id = $1`, [
        fixture.assumptionId,
      ]);
      const costLineRowAfter = await client.query(`SELECT * FROM rvn_roi_cost_lines WHERE cost_line_id = $1`, [fixture.costLineId]);
      const benefitLineRowAfter = await client.query(`SELECT * FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1`, [
        fixture.benefitLineId,
      ]);
      expect(assumptionRowAfter.rows[0]).toEqual(assumptionRowBefore.rows[0]);
      // The frozen cost-line row's own `amount` must still be the ORIGINAL
      // 1000 — the override lives only inside the forecast's own
      // input_overrides/input_snapshot, never written back onto the
      // underlying rvn_roi_cost_lines row.
      expect(costLineRowAfter.rows[0]).toEqual(costLineRowBefore.rows[0]);
      expect(costLineRowAfter.rows[0]!.amount).toBe('1000');
      expect(benefitLineRowAfter.rows[0]).toEqual(benefitLineRowBefore.rows[0]);
    }
  );

  itDB('a second forecast (no overrides) gets sequence_number 2, current_forecast_version_id moves to it (D6: latest only)', async () => {
    const fixture = await buildTrackingCase('2');

    const first = await createRoiForecastVersion({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: fixture.rowVersion,
      reason: 'first forecast',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `forecast-2a-${randomUUID()}`,
    });
    expect(first.result.sequenceNumber).toBe(1);

    const second = await createRoiForecastVersion({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: first.resultingVersion,
      reason: 'second forecast',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `forecast-2b-${randomUUID()}`,
    });
    expect(second.result.sequenceNumber).toBe(2);
    expect(second.result.totalCosts).toBe(1000); // unchanged, no override this time

    const caseRow = await client.query<{ current_forecast_version_id: string }>(
      `SELECT current_forecast_version_id FROM rvn_roi_cases WHERE case_id = $1`,
      [fixture.caseId]
    );
    expect(caseRow.rows[0]!.current_forecast_version_id).toBe(second.result.forecastVersionId);

    const allForecasts = await client.query<{ sequence_number: number }>(
      `SELECT sequence_number FROM rvn_roi_forecast_versions WHERE case_id = $1 ORDER BY sequence_number`,
      [fixture.caseId]
    );
    expect(allForecasts.rows.map((r) => r.sequence_number)).toEqual([1, 2]);
  });

  itDB('CASE_NOT_TRACKABLE: a case still "approved" (has not called startRoiCaseTracking) cannot publish a forecast', async () => {
    const initiativeId = `${INITIATIVE_ID}-not-tracking`;
    await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
      initiativeId,
      ORG_ID,
      'Not-tracking fixture initiative',
    ]);
    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId,
      title: 'Not-tracking fixture case',
      ownerUserId: USER_MAKER,
      currency: 'USD',
      analysisStart: '2026-01-01',
      analysisEnd: '2026-12-31',
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-nt-${randomUUID()}`,
    });

    await expect(
      createRoiForecastVersion({
        caseId: createOutcome.result.case.caseId,
        organizationId: ORG_ID,
        expectedVersion: createOutcome.result.case.rowVersion,
        reason: 'should fail — still draft',
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `forecast-nt-${randomUUID()}`,
      })
    ).rejects.toThrow(RoiForecastVersionValidationError);
  });

  itDB('OVERRIDE_TARGET_NOT_FOUND: an override targeting a foreign/nonexistent id is rejected', async () => {
    const fixture = await buildTrackingCase('3');

    await expect(
      createRoiForecastVersion({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: fixture.rowVersion,
        reason: 'bad override',
        overrides: [{ targetType: 'cost_line', targetId: randomUUID() }],
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `forecast-bad-${randomUUID()}`,
      })
    ).rejects.toThrow(RoiForecastVersionValidationError);
  });
});
