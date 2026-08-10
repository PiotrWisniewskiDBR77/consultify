/**
 * ROI-E005 — `getRoiCaseBenefitsRealizationView` (AC-03: realization %
 * computed from governed data), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §2, Decisions
 * D10-D14.
 *
 * Proves: (1) the 2-reason typed-slot behavior — `not_yet_approved` when the
 * case has no approved snapshot yet, `no_actual_recorded` when it does but
 * has no actual snapshot yet (approved-missing checked first, per D12);
 * (2) the exact D10 formula — `(actual/approved)*100` — against known
 * Approved/Actual values this test constructs and independently reads back
 * from the DB (not hardcoded assumptions about the calculation engine's
 * internals); (3) `null` when the approved denominator is 0 (D10).
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
const ORG_ID = `roi-e005-view-org-${tag}`;
const USER_MAKER = `roi-e005-view-maker-${tag}`;
const USER_APPROVER = `roi-e005-view-approver-${tag}`;
const INITIATIVE_ID = `roi-e005-view-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
type ActualEntryCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js');
type ActualSnapshotCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js');
type BenefitsRealizationRepositoryModule =
  typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitsRealizationRepository.js');

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
let recordActualEntry: ActualEntryCommandsModule['recordActualEntry'];
let publishRoiActualSnapshot: ActualSnapshotCommandsModule['publishRoiActualSnapshot'];
let getRoiCaseBenefitsRealizationView: BenefitsRealizationRepositoryModule['getRoiCaseBenefitsRealizationView'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

interface CaseFixture {
  caseId: string;
  costLineId: string;
  benefitLineId: string | null;
  rowVersion: number;
}

/** Drives a fresh case to 'approved'. `addBenefitAmount = null` skips adding
 * any benefit line at all — used by the "approved denominator is 0" test. */
async function buildApprovedCase(suffix: string, addBenefitAmount: number | null): Promise<CaseFixture> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`, [
    initiativeId,
    ORG_ID,
    'Benefits realization view fixture initiative',
    'EXECUTING',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Benefits realization view fixture case',
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

  let benefitLineId: string | null = null;
  if (addBenefitAmount !== null) {
    const benefitLineOutcome = await addBenefitLine({
      caseId,
      organizationId: ORG_ID,
      category: 'revenue',
      label: 'New revenue',
      isFinancial: true,
      amount: addBenefitAmount,
      currency: 'USD',
      timingType: 'one_time',
      oneTimePeriodDate: '2026-02-15',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `benefit-${randomUUID()}`,
    });
    benefitLineId = benefitLineOutcome.result.benefitLineId;
  }

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

  return {
    caseId,
    costLineId: costLineOutcome.result.costLineId,
    benefitLineId,
    rowVersion: approveOutcome.resultingVersion,
  };
}

describe('ROI-E005 getRoiCaseBenefitsRealizationView (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E005 benefits-realization view realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_approval_snapshots LIMIT 0');
      await client.query('SELECT 1 FROM initiatives LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the required schema); refusing to report a green run. ' +
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
    const actualEntryCommands: ActualEntryCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js'
    );
    recordActualEntry = actualEntryCommands.recordActualEntry;
    const actualSnapshotCommands: ActualSnapshotCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js'
    );
    publishRoiActualSnapshot = actualSnapshotCommands.publishRoiActualSnapshot;
    const benefitsRealizationRepository: BenefitsRealizationRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitsRealizationRepository.js'
    );
    getRoiCaseBenefitsRealizationView = benefitsRealizationRepository.getRoiCaseBenefitsRealizationView;

    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI-E005 Benefits Realization View RealDB Org', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID]
    );

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

  itDB('not_yet_approved: a case still in "approved" status that has NOT YET been submitted for a second decision has no latestApprovedSnapshotId until the first approval — verified pre-approval via a fresh draft case', async () => {
    const initiativeId = `${INITIATIVE_ID}-notapproved`;
    await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`, [
      initiativeId,
      ORG_ID,
      'Not-yet-approved fixture initiative',
      'EXECUTING',
    ]);
    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId,
      title: 'Not-yet-approved fixture case',
      ownerUserId: USER_MAKER,
      currency: 'USD',
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-notapproved-${randomUUID()}`,
    });

    const view = await getRoiCaseBenefitsRealizationView({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: createOutcome.result.case.caseId,
    });
    expect(view).not.toBeNull();
    expect(view!.benefitsRealizationPct).toEqual({ status: 'not_yet_available', reason: 'not_yet_approved' });
    expect(view!.approvedFinancialBenefits).toBeNull();
    expect(view!.actualFinancialBenefits).toBeNull();
    expect(view!.asOfActualSnapshotId).toBeNull();
  });

  itDB('no_actual_recorded: an approved case (D14: readable in ANY status, still "approved" here, not yet tracking) with no actual snapshot yet', async () => {
    const fixture = await buildApprovedCase('noactual', 5000);

    const view = await getRoiCaseBenefitsRealizationView({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: fixture.caseId,
    });
    expect(view).not.toBeNull();
    expect(view!.benefitsRealizationPct).toEqual({ status: 'not_yet_available', reason: 'no_actual_recorded' });
    expect(view!.approvedFinancialBenefits).not.toBeNull();
    expect(view!.actualFinancialBenefits).toBeNull();
  });

  itDB('D10: exact formula (actual/approved)*100 against known, independently-read-back Approved and Actual values', async () => {
    const fixture = await buildApprovedCase('formula', 5000);

    // Independently read back the APPROVED figure the calculation engine
    // actually pinned — not a hardcoded assumption about its internals.
    const caseRow = await client.query<{ latest_approved_snapshot_id: string }>(
      `SELECT latest_approved_snapshot_id FROM rvn_roi_cases WHERE case_id = $1`,
      [fixture.caseId]
    );
    const snapshotRow = await client.query<{ snapshot_payload: { decisionCalculationRun: { totalFinancialBenefits: number } } }>(
      `SELECT snapshot_payload FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`,
      [caseRow.rows[0]!.latest_approved_snapshot_id]
    );
    const approvedFinancialBenefits = snapshotRow.rows[0]!.snapshot_payload.decisionCalculationRun.totalFinancialBenefits;
    expect(approvedFinancialBenefits).not.toBeNull();
    expect(approvedFinancialBenefits).toBeGreaterThan(0);

    const trackingOutcome = await startRoiCaseTracking({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: fixture.rowVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `tracking-formula-${randomUUID()}`,
    });

    const actualFinancialBenefitsRecorded = 3750;
    await recordActualEntry({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      entryType: 'benefit',
      benefitLineId: fixture.benefitLineId,
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      amount: actualFinancialBenefitsRecorded,
      currency: 'USD',
      source: 'revenue-report-formula',
      recordedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `benefit-entry-formula-${randomUUID()}`,
    });
    const snapshotOutcome = await publishRoiActualSnapshot({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: trackingOutcome.resultingVersion,
      asOfPeriodEnd: '2026-02-28',
      publishedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `snapshot-formula-${randomUUID()}`,
    });
    expect(snapshotOutcome.outcome).toBe('applied');
    expect(snapshotOutcome.result.totalActualFinancialBenefits).toBe(actualFinancialBenefitsRecorded);

    const view = await getRoiCaseBenefitsRealizationView({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: fixture.caseId,
    });
    expect(view).not.toBeNull();
    expect(view!.approvedFinancialBenefits).toBe(approvedFinancialBenefits);
    expect(view!.actualFinancialBenefits).toBe(actualFinancialBenefitsRecorded);
    const expectedPct = (actualFinancialBenefitsRecorded / approvedFinancialBenefits) * 100;
    expect(view!.benefitsRealizationPct.status).toBe('available');
    expect((view!.benefitsRealizationPct as { status: 'available'; value: number | null }).value).toBeCloseTo(
      expectedPct,
      6
    );
    expect(view!.asOfActualSnapshotId).toBe(snapshotOutcome.result.actualSnapshotId);
  });

  itDB('D10: null benefitsRealizationPct.value when the approved denominator is 0 (case approved with zero financial benefit lines)', async () => {
    const fixture = await buildApprovedCase('zerodenom', null);

    const caseRow = await client.query<{ latest_approved_snapshot_id: string }>(
      `SELECT latest_approved_snapshot_id FROM rvn_roi_cases WHERE case_id = $1`,
      [fixture.caseId]
    );
    const snapshotRow = await client.query<{ snapshot_payload: { decisionCalculationRun: { totalFinancialBenefits: number | null } } }>(
      `SELECT snapshot_payload FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`,
      [caseRow.rows[0]!.latest_approved_snapshot_id]
    );
    const approvedFinancialBenefits = snapshotRow.rows[0]!.snapshot_payload.decisionCalculationRun.totalFinancialBenefits;
    // Ground the precondition: confirm the engine really did compute a
    // zero (not null, not positive) total for a case with no benefit
    // lines — this test's whole point requires the denominator to be 0.
    expect(approvedFinancialBenefits).toBe(0);

    const trackingOutcome = await startRoiCaseTracking({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: fixture.rowVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `tracking-zerodenom-${randomUUID()}`,
    });
    await recordActualEntry({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      entryType: 'cost',
      costLineId: fixture.costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 500,
      currency: 'USD',
      source: 'invoice-zerodenom',
      recordedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `cost-entry-zerodenom-${randomUUID()}`,
    });
    await publishRoiActualSnapshot({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: trackingOutcome.resultingVersion,
      asOfPeriodEnd: '2026-01-31',
      publishedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `snapshot-zerodenom-${randomUUID()}`,
    });

    const view = await getRoiCaseBenefitsRealizationView({
      userId: USER_MAKER,
      organizationId: ORG_ID,
      caseId: fixture.caseId,
    });
    expect(view).not.toBeNull();
    expect(view!.benefitsRealizationPct).toEqual({ status: 'available', value: null });
  });
});
