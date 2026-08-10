/**
 * ROI-E004 — `getRoiCaseCompareView` (AC-04: compare view has separate,
 * distinguishable missing states), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decision D9.
 *
 * Proves the THREE distinct missing-reason states, never a bare
 * `number | null` collapsing them together:
 *   1. `not_yet_approved` — before `approveRoiCase` has ever run.
 *   2. `no_forecast_published` — approved (even tracking), but
 *      `createRoiForecastVersion` has never run.
 *   3. `no_actual_recorded` — approved + forecast published, but
 *      `publishRoiActualSnapshot` has never run.
 * Then proves all three slots become `available` once each artifact exists
 * — except `paybackPeriods`'s ACTUAL slot, which is a documented permanent
 * gap (`rvn_roi_actual_snapshots` has no `payback_periods` column).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
const ORG_ID = `roi-e004-compare-org-${tag}`;
const USER_MAKER = `roi-e004-compare-maker-${tag}`;
const USER_APPROVER = `roi-e004-compare-approver-${tag}`;
const INITIATIVE_ID = `roi-e004-compare-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
type ForecastCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiForecastVersionCommands.js');
type ActualEntryCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js');
type ActualSnapshotCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js');
type CompareRepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCompareRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let submitRoiCaseForApproval: ApprovalCommandsModule['submitRoiCaseForApproval'];
let approveRoiCase: ApprovalCommandsModule['approveRoiCase'];
let startRoiCaseTracking: TrackingCommandsModule['startRoiCaseTracking'];
let createRoiForecastVersion: ForecastCommandsModule['createRoiForecastVersion'];
let recordActualEntry: ActualEntryCommandsModule['recordActualEntry'];
let publishRoiActualSnapshot: ActualSnapshotCommandsModule['publishRoiActualSnapshot'];
let getRoiCaseCompareView: CompareRepositoryModule['getRoiCaseCompareView'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

function metricRow(compare: Awaited<ReturnType<typeof getRoiCaseCompareView>>, metric: string) {
  const row = compare!.metrics.find((m) => m.metric === metric);
  if (!row) throw new Error(`metric ${metric} missing from compare view`);
  return row;
}

describe('ROI-E004 getRoiCaseCompareView — AC-04 (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E004 compare-view realdb tests did NOT run. This run is not evidence.');
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
    const actualEntryCommands: ActualEntryCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js'
    );
    recordActualEntry = actualEntryCommands.recordActualEntry;
    const actualSnapshotCommands: ActualSnapshotCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js'
    );
    publishRoiActualSnapshot = actualSnapshotCommands.publishRoiActualSnapshot;
    const compareRepository: CompareRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCompareRepository.js'
    );
    getRoiCaseCompareView = compareRepository.getRoiCaseCompareView;

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
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
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

  itDB('progresses through all three missing-reason states as artifacts appear, then all slots (except payback/actual) become available', async () => {
    const initiativeId = `${INITIATIVE_ID}-1`;
    await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
      initiativeId,
      ORG_ID,
      'Compare-view fixture initiative',
    ]);

    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId,
      title: 'Compare-view fixture case',
      ownerUserId: USER_MAKER,
      currency: 'USD',
      analysisStart: '2026-01-01',
      analysisEnd: '2026-06-30',
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-${randomUUID()}`,
    });
    const caseId = createOutcome.result.case.caseId;

    // ---- STATE 1: not_yet_approved (case still draft/modeling) ----
    const compare1 = await getRoiCaseCompareView({ userId: USER_MAKER, organizationId: ORG_ID, caseId });
    expect(metricRow(compare1, 'npv').approved).toEqual({ status: 'not_yet_available', reason: 'not_yet_approved' });
    expect(metricRow(compare1, 'npv').forecast).toEqual({ status: 'not_yet_available', reason: 'no_forecast_published' });
    expect(metricRow(compare1, 'npv').actual).toEqual({ status: 'not_yet_available', reason: 'no_actual_recorded' });

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

    // ---- STATE 2: approved is available, forecast/actual still missing ----
    const compare2 = await getRoiCaseCompareView({ userId: USER_MAKER, organizationId: ORG_ID, caseId });
    const npv2 = metricRow(compare2, 'totalCosts');
    expect(npv2.approved).toEqual({ status: 'available', value: 1000 });
    expect(npv2.forecast).toEqual({ status: 'not_yet_available', reason: 'no_forecast_published' });
    expect(npv2.actual).toEqual({ status: 'not_yet_available', reason: 'no_actual_recorded' });

    const forecastOutcome = await createRoiForecastVersion({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: trackingOutcome.resultingVersion,
      reason: 'Q1 reforecast',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `forecast-${randomUUID()}`,
    });

    // ---- STATE 3: approved + forecast available, actual still missing ----
    const compare3 = await getRoiCaseCompareView({ userId: USER_MAKER, organizationId: ORG_ID, caseId });
    const totalCosts3 = metricRow(compare3, 'totalCosts');
    expect(totalCosts3.approved).toEqual({ status: 'available', value: 1000 });
    expect(totalCosts3.forecast).toEqual({ status: 'available', value: 1000 });
    expect(totalCosts3.actual).toEqual({ status: 'not_yet_available', reason: 'no_actual_recorded' });

    await recordActualEntry({
      caseId,
      organizationId: ORG_ID,
      entryType: 'cost',
      costLineId: costLineOutcome.result.costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 950,
      currency: 'USD',
      source: 'invoice-1',
      recordedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `actual-cost-${randomUUID()}`,
    });
    await recordActualEntry({
      caseId,
      organizationId: ORG_ID,
      entryType: 'benefit',
      benefitLineId: benefitLineOutcome.result.benefitLineId,
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      amount: 1900,
      currency: 'USD',
      source: 'revenue-1',
      recordedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `actual-benefit-${randomUUID()}`,
    });
    const snapshotOutcome = await publishRoiActualSnapshot({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: forecastOutcome.resultingVersion,
      asOfPeriodEnd: '2026-02-28',
      publishedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `snapshot-${randomUUID()}`,
    });
    void snapshotOutcome;

    // ---- STATE 4: all three available for totalCosts/totalFinancialBenefits/
    // npv/simpleRoi; paybackPeriods's ACTUAL slot is the one documented,
    // permanent exception (no such column on rvn_roi_actual_snapshots). ----
    const compare4 = await getRoiCaseCompareView({ userId: USER_MAKER, organizationId: ORG_ID, caseId });
    const totalCosts4 = metricRow(compare4, 'totalCosts');
    expect(totalCosts4.approved.status).toBe('available');
    expect(totalCosts4.forecast.status).toBe('available');
    expect(totalCosts4.actual).toEqual({ status: 'available', value: 950 });

    const totalBenefits4 = metricRow(compare4, 'totalFinancialBenefits');
    expect(totalBenefits4.actual).toEqual({ status: 'available', value: 1900 });

    const payback4 = metricRow(compare4, 'paybackPeriods');
    expect(payback4.actual).toEqual({ status: 'not_yet_available', reason: 'no_actual_recorded' });
  });
});
