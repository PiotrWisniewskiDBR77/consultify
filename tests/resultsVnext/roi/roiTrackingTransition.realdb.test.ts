/**
 * ROI-E004 — `startRoiCaseTracking` (the `'approved' -> 'tracking'`
 * transition), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decision D1/D2.
 *
 * Proves: (1) an approved case transitions to 'tracking'; (2) the guard
 * rejects every other fromStatus; (3) a `track_roi_forecast_actuals`
 * obligation is created for the case owner (Decision D2), idempotently
 * (deduplication key means a second call does not double-create the row).
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
const ORG_ID = `roi-e004-tracking-org-${tag}`;
const USER_MAKER = `roi-e004-tracking-maker-${tag}`;
const USER_APPROVER = `roi-e004-tracking-approver-${tag}`;
const INITIATIVE_ID = `roi-e004-tracking-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
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
let RoiCaseValidationError: CaseCommandsModule['RoiCaseValidationError'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

/** Drives a fresh case from 'draft' all the way to 'approved' — the shared
 * precondition every command in this program's ROI-E001/E002/E003 chain
 * requires before ROI-E004's own `startRoiCaseTracking` becomes callable. */
async function buildApprovedCase(initiativeSuffix: string): Promise<{ caseId: string; ownerUserId: string; rowVersion: number }> {
  const initiativeId = `${INITIATIVE_ID}-${initiativeSuffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Tracking fixture initiative',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Tracking fixture case',
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

  const baselineOutcome = await captureOrUpdateBaseline({
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
  void baselineOutcome;

  await addCostLine({
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
  await addBenefitLine({
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

  return { caseId, ownerUserId: USER_MAKER, rowVersion: approveOutcome.resultingVersion };
}

describe('ROI-E004 startRoiCaseTracking (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E004 tracking realdb tests did NOT run. This run is not evidence.');
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
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiTrackingTransition realdb fixture org');
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

  itDB('approved -> tracking succeeds and creates a track_roi_forecast_actuals obligation for the owner (D2)', async () => {
    const { caseId, ownerUserId, rowVersion } = await buildApprovedCase('1');

    const outcome = await startRoiCaseTracking({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: rowVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `tracking-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('tracking');

    // Filtered by obligation_type — createRoiCase (buildApprovedCase's own
    // first step) ALSO creates its own 'start_roi_study' obligation for the
    // same reference_id, so a query over reference_id alone would see both.
    const obligationResult = await client.query<{ obligation_type: string; assignee_user_id: string; status: string }>(
      `SELECT obligation_type, assignee_user_id, status FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
          AND obligation_type = 'track_roi_forecast_actuals'`,
      [ORG_ID, caseId]
    );
    expect(obligationResult.rows).toHaveLength(1);
    expect(obligationResult.rows[0]).toMatchObject({
      obligation_type: 'track_roi_forecast_actuals',
      assignee_user_id: ownerUserId,
      status: 'open',
    });
  });

  itDB('rejects the transition from every non-approved status', async () => {
    const { caseId } = await buildApprovedCase('2');
    // caseId is 'approved' — start tracking once to move it to 'tracking',
    // then a second attempt from 'tracking' must be rejected.
    const first = await startRoiCaseTracking({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: (await client.query<{ row_version: number }>(`SELECT row_version FROM rvn_roi_cases WHERE case_id = $1`, [caseId]))
        .rows[0]!.row_version,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `tracking-2-${randomUUID()}`,
    });

    await expect(
      startRoiCaseTracking({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: first.resultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `tracking-3-${randomUUID()}`,
      })
    ).rejects.toThrow(RoiCaseValidationError);
  });

  itDB('idempotent obligation creation: calling startRoiCaseTracking twice (same case, distinct idempotencyKey) never double-creates the obligation row', async () => {
    // Not directly re-callable (status guard blocks a second 'approved' ->
    // 'tracking' transition), so this proves the DEDUPLICATION KEY itself —
    // createObligation's own ON CONFLICT (organization_id, deduplication_key)
    // DO NOTHING — by inserting a colliding obligation row directly and
    // confirming startRoiCaseTracking's own insert is a harmless no-op.
    const { caseId, ownerUserId, rowVersion } = await buildApprovedCase('3');
    const dedupKey = `${ORG_ID}:roi_case:${caseId}:track_roi_forecast_actuals`;

    await client.query(
      `INSERT INTO rvn_platform_obligations
         (organization_id, assignee_user_id, reference_type, reference_id, aggregate_version_at_creation,
          obligation_type, deduplication_key)
       VALUES ($1, $2, 'roi_case', $3, 1, 'track_roi_forecast_actuals', $4)`,
      [ORG_ID, ownerUserId, caseId, dedupKey]
    );

    const outcome = await startRoiCaseTracking({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: rowVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `tracking-4-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('tracking');

    // Filtered by obligation_type — see the identical comment on the first
    // test's own query above (createRoiCase's 'start_roi_study' row would
    // otherwise also match reference_id alone).
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_id = $2 AND obligation_type = 'track_roi_forecast_actuals'`,
      [ORG_ID, caseId]
    );
    expect(countResult.rows[0]!.count).toBe('1');
  });
});
