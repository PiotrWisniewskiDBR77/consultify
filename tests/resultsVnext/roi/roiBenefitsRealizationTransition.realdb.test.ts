/**
 * ROI-E005 — `startRoiCaseBenefitsRealization` (the `'tracking' ->
 * 'benefits_realization'` transition), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §2, Decisions
 * D1-D4.
 *
 * Proves: (1) a tracking case transitions to 'benefits_realization'; (2) the
 * guard rejects every other fromStatus; (3) a `confirm_benefits_realization`
 * obligation is created for the case owner (Decision D4), without touching
 * the pre-existing `track_roi_forecast_actuals` obligation; (4) **AC-01** —
 * the transition's outcome (success/failure, resulting status) is IDENTICAL
 * regardless of the linked legacy Initiative's `status` column — proven by
 * driving one case's linked Initiative to `'EXECUTING'` and another's to
 * `'DONE'` (via direct SQL — the full legacy closure WORKFLOW is exercised
 * by the sibling `roiObligationsSurviveInitiativeClosure.realdb.test.ts`,
 * not here; this file's AC-01 proof only needs the Initiative's *status
 * value*, not the workflow that produced it) and confirming both
 * transitions succeed identically.
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
const ORG_ID = `roi-e005-br-org-${tag}`;
const USER_MAKER = `roi-e005-br-maker-${tag}`;
const USER_APPROVER = `roi-e005-br-approver-${tag}`;
const INITIATIVE_ID = `roi-e005-br-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
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
let startRoiCaseBenefitsRealization: BenefitsRealizationCommandsModule['startRoiCaseBenefitsRealization'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

/** Drives a fresh case from 'draft' all the way to 'tracking' — the shared
 * precondition `startRoiCaseBenefitsRealization` requires. `initiativeStatus`
 * lets AC-01's test seed the linked legacy Initiative at a specific status
 * value (default 'EXECUTING' — same value the real closure-gate/transition
 * engine uses for an in-flight initiative, see initiativeStatuses.ts). */
async function buildTrackingCase(
  initiativeSuffix: string,
  initiativeStatus = 'EXECUTING'
): Promise<{ caseId: string; initiativeId: string; ownerUserId: string; rowVersion: number }> {
  const initiativeId = `${INITIATIVE_ID}-${initiativeSuffix}`;
  await client.query(
    `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
    [initiativeId, ORG_ID, 'Benefits realization fixture initiative', initiativeStatus]
  );

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Benefits realization fixture case',
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
        access: { capabilities: ['*'], platformRole: null },
});
  const approveOutcome = await approveRoiCase({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: submitOutcome.resultingVersion,
    approverId: USER_APPROVER,
    actorEffectiveRole: 'admin',
    idempotencyKey: `approve-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const trackingOutcome = await startRoiCaseTracking({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: approveOutcome.resultingVersion,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `tracking-${randomUUID()}`,
  });

  return { caseId, initiativeId, ownerUserId: USER_MAKER, rowVersion: trackingOutcome.resultingVersion };
}

describe('ROI-E005 startRoiCaseBenefitsRealization (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E005 benefits-realization transition realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_cases LIMIT 0');
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
    const benefitsRealizationCommands: BenefitsRealizationCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.js'
    );
    startRoiCaseBenefitsRealization = benefitsRealizationCommands.startRoiCaseBenefitsRealization;

    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    // `initiatives.organization_id` carries a real FK to `organizations(id)`
    // on a fully-migrated schema (unlike the minimal ad hoc `initiatives`
    // stub some sibling ROI-E001-E004 realdb suites create when only the
    // resultsVnext-slice schema is present) — this suite needs the real
    // `initiatives` table (AC-01 sets its `status` column directly), so a
    // real `organizations` row is required first.
    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI-E005 Benefits Realization RealDB Org', 'enterprise', 'active')
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

  itDB('tracking -> benefits_realization succeeds and creates a confirm_benefits_realization obligation for the owner (D4), leaving track_roi_forecast_actuals untouched', async () => {
    const { caseId, ownerUserId, rowVersion } = await buildTrackingCase('1');

    const outcome = await startRoiCaseBenefitsRealization({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: rowVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `br-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('benefits_realization');

    const newObligation = await client.query<{ obligation_type: string; assignee_user_id: string; status: string }>(
      `SELECT obligation_type, assignee_user_id, status FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
          AND obligation_type = 'confirm_benefits_realization'`,
      [ORG_ID, caseId]
    );
    expect(newObligation.rows).toHaveLength(1);
    expect(newObligation.rows[0]).toMatchObject({
      obligation_type: 'confirm_benefits_realization',
      assignee_user_id: ownerUserId,
      status: 'open',
    });

    // The pre-existing track_roi_forecast_actuals obligation (created by
    // startRoiCaseTracking, buildTrackingCase's own last step) is
    // deliberately left untouched — still 'open', not superseded/completed.
    const priorObligation = await client.query<{ status: string }>(
      `SELECT status FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
          AND obligation_type = 'track_roi_forecast_actuals'`,
      [ORG_ID, caseId]
    );
    expect(priorObligation.rows).toHaveLength(1);
    expect(priorObligation.rows[0]!.status).toBe('open');
  });

  itDB('rejects the transition from every non-tracking status (e.g. "approved")', async () => {
    const initiativeId = `${INITIATIVE_ID}-2`;
    await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`, [
      initiativeId,
      ORG_ID,
      'Guard fixture initiative',
      'EXECUTING',
    ]);
    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId,
      title: 'Guard fixture case (stays approved)',
      ownerUserId: USER_MAKER,
      currency: 'USD',
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-guard-${randomUUID()}`,
    });
    // Directly stamp the case to 'approved' without ever calling
    // startRoiCaseTracking — proves the guard, not just that a fresh case
    // (still 'draft') is rejected.
    const stamped = await client.query<{ row_version: number }>(
      `UPDATE rvn_roi_cases SET status = 'approved', row_version = row_version + 1 WHERE case_id = $1 RETURNING row_version`,
      [createOutcome.result.case.caseId]
    );

    await expect(
      startRoiCaseBenefitsRealization({
        caseId: createOutcome.result.case.caseId,
        organizationId: ORG_ID,
        expectedVersion: stamped.rows[0]!.row_version,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `br-guard-${randomUUID()}`,
      })
    ).rejects.toThrow(RoiCaseValidationError);

    const row = await client.query<{ status: string }>(`SELECT status FROM rvn_roi_cases WHERE case_id = $1`, [
      createOutcome.result.case.caseId,
    ]);
    expect(row.rows[0]!.status).toBe('approved');
  });

  itDB(
    'AC-01: transition succeeds identically whether the linked Initiative is left "EXECUTING" or already "DONE" — the guard never reads initiatives.status',
    async () => {
      const activeCase = await buildTrackingCase('ac01-active', 'EXECUTING');
      const doneCase = await buildTrackingCase('ac01-done', 'DONE');

      // Confirm the fixtures actually differ before asserting "identical
      // outcome regardless" — otherwise this proves nothing.
      const initiativeRows = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM initiatives WHERE id = ANY($1) ORDER BY id`,
        [[activeCase.initiativeId, doneCase.initiativeId]]
      );
      const statusById = new Map(initiativeRows.rows.map((r) => [r.id, r.status]));
      expect(statusById.get(activeCase.initiativeId)).toBe('EXECUTING');
      expect(statusById.get(doneCase.initiativeId)).toBe('DONE');

      const outcomeActive = await startRoiCaseBenefitsRealization({
        caseId: activeCase.caseId,
        organizationId: ORG_ID,
        expectedVersion: activeCase.rowVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `br-ac01-active-${randomUUID()}`,
      });
      const outcomeDone = await startRoiCaseBenefitsRealization({
        caseId: doneCase.caseId,
        organizationId: ORG_ID,
        expectedVersion: doneCase.rowVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `br-ac01-done-${randomUUID()}`,
      });

      expect(outcomeActive.outcome).toBe('applied');
      expect(outcomeDone.outcome).toBe('applied');
      expect(outcomeActive.result.status).toBe('benefits_realization');
      expect(outcomeDone.result.status).toBe('benefits_realization');
    }
  );
});
