/**
 * ROI-E004 — `publishRoiActualSnapshot` (Decision D8/D17: immutable rollup
 * of current Actual entries, fills `current_actual_snapshot_id`), against a
 * REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4.
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
const ORG_ID = `roi-e004-snapshot-org-${tag}`;
const USER_MAKER = `roi-e004-snapshot-maker-${tag}`;
const USER_APPROVER = `roi-e004-snapshot-approver-${tag}`;
const INITIATIVE_ID = `roi-e004-snapshot-init-${tag}`;

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
let recordActualEntry: ActualEntryCommandsModule['recordActualEntry'];
let verifyActualEntry: ActualEntryCommandsModule['verifyActualEntry'];
let publishRoiActualSnapshot: ActualSnapshotCommandsModule['publishRoiActualSnapshot'];
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
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Actual-snapshot fixture initiative',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Actual-snapshot fixture case',
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

describe('ROI-E004 publishRoiActualSnapshot (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E004 actual-snapshot realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_actual_snapshots LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id))`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiActualSnapshot realdb fixture org');
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
    const actualEntryCommands: ActualEntryCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js'
    );
    recordActualEntry = actualEntryCommands.recordActualEntry;
    verifyActualEntry = actualEntryCommands.verifyActualEntry;
    const actualSnapshotCommands: ActualSnapshotCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js'
    );
    publishRoiActualSnapshot = actualSnapshotCommands.publishRoiActualSnapshot;

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

  itDB('rolls up current entries: totals, verified/unverified/disputed counts, entry_ids_included, and updates current_actual_snapshot_id', async () => {
    const fixture = await buildTrackingCase('1');

    const costEntry = await recordActualEntry({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      entryType: 'cost',
      costLineId: fixture.costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 900,
      currency: 'USD',
      source: 'invoice-1',
      recordedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `cost-entry-${randomUUID()}`,
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
      source: 'revenue-report-1',
      recordedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `benefit-entry-${randomUUID()}`,
    });
    // Verify the benefit entry (verifier distinct from recorder — D10).
    const verifiedBenefit = await verifyActualEntry({
      actualEntryId: benefitEntry.result.actualEntryId,
      organizationId: ORG_ID,
      verifierId: USER_APPROVER,
      actorEffectiveRole: 'admin',
      idempotencyKey: `verify-benefit-${randomUUID()}`,
    });

    const snapshotOutcome = await publishRoiActualSnapshot({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: fixture.rowVersion,
      asOfPeriodEnd: '2026-02-28',
      publishedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `snapshot-1-${randomUUID()}`,
    });

    expect(snapshotOutcome.outcome).toBe('applied');
    const snapshot = snapshotOutcome.result;
    expect(snapshot.sequenceNumber).toBe(1);
    expect(snapshot.totalActualCosts).toBe(900);
    expect(snapshot.totalActualFinancialBenefits).toBe(1800);
    expect(snapshot.actualSimpleRoi).toBeCloseTo((1800 - 900) / 900, 6);
    expect(snapshot.unverifiedEntryCount).toBe(1); // the cost entry
    expect(snapshot.disputedEntryCount).toBe(0);
    expect(snapshot.entryIdsIncluded.sort()).toEqual(
      [costEntry.result.actualEntryId, verifiedBenefit.result.superseding.actualEntryId].sort()
    );

    const caseRow = await client.query<{ current_actual_snapshot_id: string }>(
      `SELECT current_actual_snapshot_id FROM rvn_roi_cases WHERE case_id = $1`,
      [fixture.caseId]
    );
    expect(caseRow.rows[0]!.current_actual_snapshot_id).toBe(snapshot.actualSnapshotId);
  });

  itDB('a second publish gets sequence_number 2 and current_actual_snapshot_id moves to it', async () => {
    const fixture = await buildTrackingCase('2');

    const first = await publishRoiActualSnapshot({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: fixture.rowVersion,
      asOfPeriodEnd: '2026-01-31',
      publishedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `snapshot-2a-${randomUUID()}`,
    });
    expect(first.result.sequenceNumber).toBe(1);
    // No entries recorded yet — an honest zero-coverage rollup, not a
    // fabricated one.
    expect(first.result.totalActualCosts).toBeNull();
    expect(first.result.periodsWithActualCount).toBe(0);

    const second = await publishRoiActualSnapshot({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: first.resultingVersion,
      asOfPeriodEnd: '2026-02-28',
      publishedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `snapshot-2b-${randomUUID()}`,
    });
    expect(second.result.sequenceNumber).toBe(2);

    const caseRow = await client.query<{ current_actual_snapshot_id: string }>(
      `SELECT current_actual_snapshot_id FROM rvn_roi_cases WHERE case_id = $1`,
      [fixture.caseId]
    );
    expect(caseRow.rows[0]!.current_actual_snapshot_id).toBe(second.result.actualSnapshotId);

    const allSnapshots = await client.query<{ sequence_number: number }>(
      `SELECT sequence_number FROM rvn_roi_actual_snapshots WHERE case_id = $1 ORDER BY sequence_number`,
      [fixture.caseId]
    );
    expect(allSnapshots.rows.map((r) => r.sequence_number)).toEqual([1, 2]);
  });
});
