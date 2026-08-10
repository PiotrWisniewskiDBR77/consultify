/**
 * ROI-E003 — AC-01 submit guard + edit-lock proof, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §1 Decision D1/D3/D4,
 * §4.1.
 *
 * Two scenarios:
 * 1. AC-01 — get a case to `ready_for_review`, then edit the baseline (legal
 *    at that point — `'ready_for_review'` is deliberately NOT in
 *    `NON_EDITABLE_STATUSES`) to make it ineligible again, then attempt
 *    `submitRoiCaseForApproval` and confirm it is rejected
 *    (`RoiCaseNotReadyForReviewError`) — proves D1's re-run of the readiness
 *    guard at the submit boundary, not only relied on from when the case
 *    first reached `ready_for_review`.
 * 2. Edit-lock proof for BOTH halves the design doc explicitly separates —
 *    E001/E002 never wired `rvn_roi_baselines` to the shared
 *    `NON_EDITABLE_STATUSES` constant: after a successful submit, attempt a
 *    cost-line edit (expect `RoiEconomicModelNotEditableError` via the
 *    pre-existing `NON_EDITABLE_STATUSES` check in
 *    `roiCostLineCommands.ts`) AND a baseline edit (expect
 *    `RoiCaseValidationError` `'NOT_EDITABLE'` via the NEW Decision D4
 *    guard added to `captureOrUpdateBaseline` in THIS epic).
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
const ORG_ID = `roi-e003-submitguard-org-${tag}`;
const USER_MAKER = `roi-e003-submitguard-maker-${tag}`;
const INITIATIVE_ID = `roi-e003-submitguard-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcPolicyCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let RoiCaseNotReadyForReviewError: CaseCommandsModule['RoiCaseNotReadyForReviewError'];
let RoiCaseValidationError: CaseCommandsModule['RoiCaseValidationError'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let updateCostLine: CostLineCommandsModule['updateCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let RoiEconomicModelNotEditableError: CalcPolicyCommandsModule['RoiEconomicModelNotEditableError'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let submitRoiCaseForApproval: ApprovalCommandsModule['submitRoiCaseForApproval'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

/** Drives a fresh case to 'ready_for_review' — shared setup for both
 * scenarios below. Returns everything each scenario needs to continue from
 * there down its own path. */
async function buildReadyForReviewCase(initiativeId: string): Promise<{
  caseId: string;
  baselineId: string;
  costLineId: string;
  readyResultingVersion: number;
}> {
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Submit-guard fixture initiative',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Submit-guard fixture case',
    ownerUserId: USER_MAKER,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  const caseId = createOutcome.result.case.caseId;
  const baselineId = createOutcome.result.baseline.baselineId;

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
  await addBenefitLine({
    caseId,
    organizationId: ORG_ID,
    category: 'revenue',
    label: 'New revenue',
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
  expect(readyOutcome.result.status).toBe('ready_for_review');

  return {
    caseId,
    baselineId,
    costLineId: costLineOutcome.result.costLineId,
    readyResultingVersion: readyOutcome.resultingVersion,
  };
}

describe('ROI-E003 submit guard (AC-01) + edit-lock (D3/D4) — real Postgres', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E003 submit-guard realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_approval_snapshots LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI-E003 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;
    markReadyForReview = caseCommands.markReadyForReview;
    RoiCaseNotReadyForReviewError = caseCommands.RoiCaseNotReadyForReviewError;
    RoiCaseValidationError = caseCommands.RoiCaseValidationError;
    const baselineCommands: BaselineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;
    const costLineCommands: CostLineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
    addCostLine = costLineCommands.addCostLine;
    updateCostLine = costLineCommands.updateCostLine;
    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    addBenefitLine = benefitLineCommands.addBenefitLine;
    const calcPolicyCommands: CalcPolicyCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js'
    );
    RoiEconomicModelNotEditableError = calcPolicyCommands.RoiEconomicModelNotEditableError;
    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;
    const approvalCommands: ApprovalCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
    );
    submitRoiCaseForApproval = approvalCommands.submitRoiCaseForApproval;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertVisibilityPolicy('roi', 'OPEN_ORG', USER_MAKER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
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
    await client.query(`DELETE FROM rvn_roi_scenario_overrides WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_scenarios WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_evidence_links WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_assumptions WHERE organization_id = $1`, [ORG_ID]);
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

  itDB(
    'AC-01: readiness broken AFTER reaching ready_for_review (baseline edited back to ineligible) is caught at submit, ' +
      'not silently trusted from when the case first got there',
    async () => {
      const fixture = await buildReadyForReviewCase(`${INITIATIVE_ID}-1`);

      // Legal at 'ready_for_review' — NOT in NON_EDITABLE_STATUSES (that is
      // exactly AC-01's gap). Clear the measured value to make the baseline
      // ineligible again.
      const baselineVersionResult = await client.query<{ row_version: number }>(
        `SELECT row_version FROM rvn_roi_baselines WHERE baseline_id = $1`,
        [fixture.baselineId]
      );
      await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId: fixture.caseId,
        expectedVersion: baselineVersionResult.rows[0]!.row_version,
        currentMeasuredValue: null,
        actorId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `break-baseline-${randomUUID()}`,
      });

      await expect(
        submitRoiCaseForApproval({
          caseId: fixture.caseId,
          organizationId: ORG_ID,
          expectedVersion: fixture.readyResultingVersion,
          actorUserId: USER_MAKER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `submit-fail-${randomUUID()}`,
        })
      ).rejects.toBeInstanceOf(RoiCaseNotReadyForReviewError);

      // Case must still be 'ready_for_review' — the failed submit did not
      // partially apply.
      const caseStatusResult = await client.query<{ status: string }>(`SELECT status FROM rvn_roi_cases WHERE case_id = $1`, [
        fixture.caseId,
      ]);
      expect(caseStatusResult.rows[0]!.status).toBe('ready_for_review');
    }
  );

  itDB(
    'edit-lock proven for BOTH halves once submitted: cost-line edit blocked via NON_EDITABLE_STATUSES (D3), ' +
      'baseline edit blocked via the new D4 case-status guard',
    async () => {
      const fixture = await buildReadyForReviewCase(`${INITIATIVE_ID}-2`);

      const submitOutcome = await submitRoiCaseForApproval({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: fixture.readyResultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit-ok-${randomUUID()}`,
      });
      expect(submitOutcome.result.status).toBe('submitted_for_approval');

      // Half 1 (D3, pre-existing NON_EDITABLE_STATUSES wiring in
      // roiCostLineCommands.ts): a cost-line edit is now blocked.
      const costLineVersionResult = await client.query<{ row_version: number }>(
        `SELECT row_version FROM rvn_roi_cost_lines WHERE cost_line_id = $1`,
        [fixture.costLineId]
      );
      await expect(
        updateCostLine({
          costLineId: fixture.costLineId,
          caseId: fixture.caseId,
          organizationId: ORG_ID,
          expectedVersion: costLineVersionResult.rows[0]!.row_version,
          amount: 12345,
          actorUserId: USER_MAKER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `edit-cost-blocked-${randomUUID()}`,
        })
      ).rejects.toBeInstanceOf(RoiEconomicModelNotEditableError);

      // Half 2 (D4, NEW in this epic): a baseline edit is now ALSO blocked
      // — E001/E002 never wired rvn_roi_baselines to the shared constant.
      const baselineVersionResult = await client.query<{ row_version: number }>(
        `SELECT row_version FROM rvn_roi_baselines WHERE baseline_id = $1`,
        [fixture.baselineId]
      );
      let baselineEditError: unknown;
      try {
        await captureOrUpdateBaseline({
          organizationId: ORG_ID,
          caseId: fixture.caseId,
          expectedVersion: baselineVersionResult.rows[0]!.row_version,
          currentMeasuredValue: 999,
          actorId: USER_MAKER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `edit-baseline-blocked-${randomUUID()}`,
        });
      } catch (err) {
        baselineEditError = err;
      }
      expect(baselineEditError).toBeInstanceOf(RoiCaseValidationError);
      expect((baselineEditError as InstanceType<typeof RoiCaseValidationError>).code).toBe('NOT_EDITABLE');

      // Neither blocked write partially applied.
      const finalCostLine = await client.query<{ amount: string }>(`SELECT amount FROM rvn_roi_cost_lines WHERE cost_line_id = $1`, [
        fixture.costLineId,
      ]);
      expect(Number(finalCostLine.rows[0]!.amount)).toBe(1000);
      const finalBaseline = await client.query<{ current_measured_value: string }>(
        `SELECT current_measured_value FROM rvn_roi_baselines WHERE baseline_id = $1`,
        [fixture.baselineId]
      );
      expect(Number(finalBaseline.rows[0]!.current_measured_value)).toBe(100);
    }
  );
});
