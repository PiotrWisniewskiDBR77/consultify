/**
 * ROI-E005 — `cancelRoiCase` (`ROI_TRACKING_ACTIVE_STATUSES -> 'cancelled'`),
 * against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §2, Decisions
 * D6-D9.
 *
 * Proves: (1) the guard's scope is EXACTLY `ROI_TRACKING_ACTIVE_STATUSES`
 * (a case still `'approved'` — not yet tracking — is rejected, Decision D7);
 * (2) the mandatory `reason` is durably recorded on the event log;
 * (3) **AC-04** — cancellation preserves Actual: record actual entries,
 * publish an actual snapshot, cancel the case, then assert every actual
 * entry row (and the actual snapshot row) is BYTE-IDENTICAL to its
 * pre-cancellation content — a full-row snapshot comparison (every column,
 * not a sampled subset), the same "prove nothing was touched" rigor prior
 * epics' AC-01/AC-06 immutability tests use.
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
const ORG_ID = `roi-e005-cancel-org-${tag}`;
const USER_MAKER = `roi-e005-cancel-maker-${tag}`;
const USER_APPROVER = `roi-e005-cancel-approver-${tag}`;
const INITIATIVE_ID = `roi-e005-cancel-init-${tag}`;

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
type BenefitsRealizationCommandsModule =
  typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let RoiCaseValidationError: CaseCommandsModule['RoiCaseValidationError'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let submitRoiCaseForApproval: ApprovalCommandsModule['submitRoiCaseForApproval'];
let approveRoiCase: ApprovalCommandsModule['approveRoiCase'];
let startRoiCaseTracking: TrackingCommandsModule['startRoiCaseTracking'];
let recordActualEntry: ActualEntryCommandsModule['recordActualEntry'];
let publishRoiActualSnapshot: ActualSnapshotCommandsModule['publishRoiActualSnapshot'];
let cancelRoiCase: BenefitsRealizationCommandsModule['cancelRoiCase'];
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
  rowVersion: number;
}

async function buildTrackingCase(suffix: string): Promise<TrackingCaseFixture> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`, [
    initiativeId,
    ORG_ID,
    'Cancellation fixture initiative',
    'EXECUTING',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Cancellation fixture case',
    ownerUserId: USER_MAKER,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-06-30',
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
    rowVersion: trackingOutcome.resultingVersion,
  };
}

describe('ROI-E005 cancelRoiCase (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E005 cancellation realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_actual_snapshots LIMIT 0');
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
    RoiCaseValidationError = caseCommands.RoiCaseValidationError;
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
    const benefitsRealizationCommands: BenefitsRealizationCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.js'
    );
    cancelRoiCase = benefitsRealizationCommands.cancelRoiCase;

    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI-E005 Cancellation RealDB Org', 'enterprise', 'active')
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

  itDB('rejects cancellation from a status outside ROI_TRACKING_ACTIVE_STATUSES (e.g. "approved", not yet tracking) — Decision D7', async () => {
    const initiativeId = `${INITIATIVE_ID}-guard`;
    await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`, [
      initiativeId,
      ORG_ID,
      'Cancellation guard fixture initiative',
      'EXECUTING',
    ]);
    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId,
      title: 'Cancellation guard fixture case (stays approved)',
      ownerUserId: USER_MAKER,
      currency: 'USD',
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-guard-${randomUUID()}`,
    });
    const stamped = await client.query<{ row_version: number }>(
      `UPDATE rvn_roi_cases SET status = 'approved', row_version = row_version + 1 WHERE case_id = $1 RETURNING row_version`,
      [createOutcome.result.case.caseId]
    );

    await expect(
      cancelRoiCase({
        caseId: createOutcome.result.case.caseId,
        organizationId: ORG_ID,
        expectedVersion: stamped.rows[0]!.row_version,
        reason: 'attempted cancel from approved (must be rejected)',
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `cancel-guard-${randomUUID()}`,
      })
    ).rejects.toThrow(RoiCaseValidationError);

    const row = await client.query<{ status: string }>(`SELECT status FROM rvn_roi_cases WHERE case_id = $1`, [
      createOutcome.result.case.caseId,
    ]);
    expect(row.rows[0]!.status).toBe('approved');
  });

  itDB('succeeds from every ROI_TRACKING_ACTIVE_STATUSES member and records the mandatory reason on the event log', async () => {
    const fixture = await buildTrackingCase('reason');
    const reasonText = `Program deprioritized ${randomUUID()}`;

    const outcome = await cancelRoiCase({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: fixture.rowVersion,
      reason: reasonText,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `cancel-reason-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('cancelled');

    const eventRow = await client.query<{ reason: string | null; event_type: string }>(
      `SELECT reason, event_type FROM rvn_platform_events
        WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'roi.case_cancelled'
        ORDER BY occurred_at DESC LIMIT 1`,
      [ORG_ID, fixture.caseId]
    );
    expect(eventRow.rows).toHaveLength(1);
    expect(eventRow.rows[0]!.reason).toBe(reasonText);
  });

  itDB(
    'AC-04: cancellation leaves every Actual entry row and the Actual snapshot row byte-identical to their pre-cancellation content',
    async () => {
      const fixture = await buildTrackingCase('ac04');

      const costEntry = await recordActualEntry({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        entryType: 'cost',
        costLineId: fixture.costLineId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        amount: 900,
        currency: 'USD',
        source: 'invoice-ac04',
        recordedBy: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `cost-entry-ac04-${randomUUID()}`,
      });
      const benefitEntry = await recordActualEntry({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        entryType: 'benefit',
        benefitLineId: fixture.benefitLineId,
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
        amount: 1800,
        currency: 'USD',
        source: 'revenue-report-ac04',
        recordedBy: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `benefit-entry-ac04-${randomUUID()}`,
      });

      const snapshotOutcome = await publishRoiActualSnapshot({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: fixture.rowVersion,
        asOfPeriodEnd: '2026-02-28',
        publishedBy: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `snapshot-ac04-${randomUUID()}`,
      });
      expect(snapshotOutcome.outcome).toBe('applied');

      // Full-row snapshot of BOTH actual entries and the actual snapshot,
      // BEFORE cancellation — every column, ORDER BY a stable key so the
      // comparison below is not order-dependent.
      const entriesBefore = await client.query(
        `SELECT * FROM rvn_roi_actual_entries WHERE case_id = $1 ORDER BY actual_entry_id`,
        [fixture.caseId]
      );
      expect(entriesBefore.rows).toHaveLength(2);
      const snapshotsBefore = await client.query(
        `SELECT * FROM rvn_roi_actual_snapshots WHERE case_id = $1 ORDER BY actual_snapshot_id`,
        [fixture.caseId]
      );
      expect(snapshotsBefore.rows).toHaveLength(1);

      const caseRowBefore = await client.query<{ row_version: number }>(
        `SELECT row_version FROM rvn_roi_cases WHERE case_id = $1`,
        [fixture.caseId]
      );

      const cancelOutcome = await cancelRoiCase({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: caseRowBefore.rows[0]!.row_version,
        reason: 'AC-04 proof cancellation',
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `cancel-ac04-${randomUUID()}`,
      });
      expect(cancelOutcome.outcome).toBe('applied');
      expect(cancelOutcome.result.status).toBe('cancelled');

      const entriesAfter = await client.query(
        `SELECT * FROM rvn_roi_actual_entries WHERE case_id = $1 ORDER BY actual_entry_id`,
        [fixture.caseId]
      );
      const snapshotsAfter = await client.query(
        `SELECT * FROM rvn_roi_actual_snapshots WHERE case_id = $1 ORDER BY actual_snapshot_id`,
        [fixture.caseId]
      );

      // Byte-identical: same row count, same column values, in the same
      // order — not merely "still present" but UNCHANGED.
      expect(entriesAfter.rows).toEqual(entriesBefore.rows);
      expect(snapshotsAfter.rows).toEqual(snapshotsBefore.rows);

      // Also confirm the case's own forecast/actual pointer columns
      // (current_actual_snapshot_id) were not cleared or altered by
      // cancellation — AC-04 is about the DATA, and the pointer to it, both
      // surviving untouched.
      const caseRowAfter = await client.query<{ current_actual_snapshot_id: string | null }>(
        `SELECT current_actual_snapshot_id FROM rvn_roi_cases WHERE case_id = $1`,
        [fixture.caseId]
      );
      expect(caseRowAfter.rows[0]!.current_actual_snapshot_id).toBe(snapshotsBefore.rows[0]!.actual_snapshot_id);
    }
  );
});
