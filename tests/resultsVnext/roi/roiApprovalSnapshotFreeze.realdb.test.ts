/**
 * ROI-E003 — post-approval freeze / post-reopen unfreeze / never-frozen-on-
 * reject-or-changes-requested, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §4.2/§4.5/§4.6.
 *
 * Three scenarios:
 * 1. A raw UPDATE against a frozen assumption/cost-line/benefit-line/
 *    scenario/policy row still fails post-approval — confirms the ROI-E002
 *    DB triggers are actually engaged by `approveRoiCase` (via
 *    `freezeRoiEconomicModel`), not bypassed.
 * 2. The SAME rows become editable again after
 *    `reopenApprovedRoiCaseForRevision` (via `unfreezeRoiEconomicModel`/
 *    `unfreezeRoiBaseline`, this epic's new symmetric functions).
 * 3. A rejected (or changes-requested) case never had anything frozen in
 *    the first place — `rejectRoiCase`/`requestChangesOnRoiCase` call
 *    neither freeze function (design §4.3/§4.4: "nothing is frozen
 *    pre-approval").
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
const ORG_ID = `roi-e003-freeze-org-${tag}`;
const USER_MAKER = `roi-e003-freeze-maker-${tag}`;
const USER_APPROVER = `roi-e003-freeze-approver-${tag}`;
const INITIATIVE_ID = `roi-e003-freeze-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CalcPolicyCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js');
type AssumptionCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type ScenarioCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiScenarioCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let captureOrUpdateCalculationPolicy: CalcPolicyCommandsModule['captureOrUpdateCalculationPolicy'];
let addAssumption: AssumptionCommandsModule['addAssumption'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let addScenario: ScenarioCommandsModule['addScenario'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let submitRoiCaseForApproval: ApprovalCommandsModule['submitRoiCaseForApproval'];
let approveRoiCase: ApprovalCommandsModule['approveRoiCase'];
let rejectRoiCase: ApprovalCommandsModule['rejectRoiCase'];
let requestChangesOnRoiCase: ApprovalCommandsModule['requestChangesOnRoiCase'];
let reopenApprovedRoiCaseForRevision: ApprovalCommandsModule['reopenApprovedRoiCaseForRevision'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

interface FullEconomicModelFixture {
  caseId: string;
  baselineId: string;
  assumptionId: string;
  costLineId: string;
  benefitLineId: string;
  scenarioId: string;
  readyResultingVersion: number;
}

/** Builds a case through 'ready_for_review' with one row in every mutable
 * ROI-E002 table (policy already exists as a 1:1 shell from createRoiCase). */
async function buildReadyCaseWithFullEconomicModel(initiativeId: string): Promise<FullEconomicModelFixture> {
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Freeze fixture initiative',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Freeze fixture case',
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

  await captureOrUpdateCalculationPolicy({
    organizationId: ORG_ID,
    caseId,
    expectedVersion: createOutcome.result.calculationPolicy.rowVersion,
    discountRatePct: 8,
    actorId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `policy-${randomUUID()}`,
  });

  const assumptionOutcome = await addAssumption({
    caseId,
    organizationId: ORG_ID,
    category: 'adoption',
    label: 'Adoption rate',
    baseValue: 100,
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
    amount: 2000,
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: '2026-02-15',
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `benefit-${randomUUID()}`,
  });
  const scenarioOutcome = await addScenario({
    caseId,
    organizationId: ORG_ID,
    scenarioType: 'downside',
    label: 'Downside scenario',
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `scenario-${randomUUID()}`,
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

  return {
    caseId,
    baselineId,
    assumptionId: assumptionOutcome.result.assumptionId,
    costLineId: costLineOutcome.result.costLineId,
    benefitLineId: benefitLineOutcome.result.benefitLineId,
    scenarioId: scenarioOutcome.result.scenarioId,
    readyResultingVersion: readyOutcome.resultingVersion,
  };
}

async function expectAllFrozen(fixture: FullEconomicModelFixture): Promise<void> {
  const checks = await Promise.all([
    client.query(`SELECT frozen_at FROM rvn_roi_baselines WHERE baseline_id = $1`, [fixture.baselineId]),
    client.query(`SELECT frozen_at FROM rvn_roi_calculation_policy WHERE case_id = $1`, [fixture.caseId]),
    client.query(`SELECT frozen_at FROM rvn_roi_assumptions WHERE assumption_id = $1`, [fixture.assumptionId]),
    client.query(`SELECT frozen_at FROM rvn_roi_cost_lines WHERE cost_line_id = $1`, [fixture.costLineId]),
    client.query(`SELECT frozen_at FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1`, [fixture.benefitLineId]),
    client.query(`SELECT frozen_at FROM rvn_roi_scenarios WHERE scenario_id = $1`, [fixture.scenarioId]),
  ]);
  for (const check of checks) {
    expect(check.rows[0]?.frozen_at).not.toBeNull();
  }
}

async function expectAllUnfrozen(fixture: FullEconomicModelFixture): Promise<void> {
  const checks = await Promise.all([
    client.query(`SELECT frozen_at FROM rvn_roi_baselines WHERE baseline_id = $1`, [fixture.baselineId]),
    client.query(`SELECT frozen_at FROM rvn_roi_calculation_policy WHERE case_id = $1`, [fixture.caseId]),
    client.query(`SELECT frozen_at FROM rvn_roi_assumptions WHERE assumption_id = $1`, [fixture.assumptionId]),
    client.query(`SELECT frozen_at FROM rvn_roi_cost_lines WHERE cost_line_id = $1`, [fixture.costLineId]),
    client.query(`SELECT frozen_at FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1`, [fixture.benefitLineId]),
    client.query(`SELECT frozen_at FROM rvn_roi_scenarios WHERE scenario_id = $1`, [fixture.scenarioId]),
  ]);
  for (const check of checks) {
    expect(check.rows[0]?.frozen_at).toBeNull();
  }
}

describe('ROI-E003 approval-driven freeze/unfreeze — real Postgres', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E003 freeze realdb tests did NOT run. This run is not evidence.');
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
    const baselineCommands: BaselineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;
    const calcPolicyCommands: CalcPolicyCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js'
    );
    captureOrUpdateCalculationPolicy = calcPolicyCommands.captureOrUpdateCalculationPolicy;
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
    const scenarioCommands: ScenarioCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiScenarioCommands.js');
    addScenario = scenarioCommands.addScenario;
    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;
    const approvalCommands: ApprovalCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
    );
    submitRoiCaseForApproval = approvalCommands.submitRoiCaseForApproval;
    approveRoiCase = approvalCommands.approveRoiCase;
    rejectRoiCase = approvalCommands.rejectRoiCase;
    requestChangesOnRoiCase = approvalCommands.requestChangesOnRoiCase;
    reopenApprovedRoiCaseForRevision = approvalCommands.reopenApprovedRoiCaseForRevision;

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
    'post-approval: raw UPDATE blocked on every frozen table (assumption/cost-line/benefit-line/scenario/policy + ' +
      'baseline); reopenApprovedRoiCaseForRevision makes the SAME rows editable again',
    async () => {
      const fixture = await buildReadyCaseWithFullEconomicModel(`${INITIATIVE_ID}-1`);

      const submitOutcome = await submitRoiCaseForApproval({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: fixture.readyResultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit-${randomUUID()}`,
      });

      const approveOutcome = await approveRoiCase({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: submitOutcome.resultingVersion,
        approverId: USER_APPROVER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `approve-${randomUUID()}`,
      });

      await expectAllFrozen(fixture);

      // Raw UPDATEs on frozen content columns all rejected — DB trigger,
      // not application code.
      await expect(
        client.query(`UPDATE rvn_roi_baselines SET current_measured_value = 999 WHERE baseline_id = $1`, [fixture.baselineId])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_calculation_policy SET discount_rate_pct = 999 WHERE case_id = $1`, [fixture.caseId])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_assumptions SET base_value = 999 WHERE assumption_id = $1`, [fixture.assumptionId])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_cost_lines SET amount = 999999 WHERE cost_line_id = $1`, [fixture.costLineId])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_benefit_lines SET amount = 999999 WHERE benefit_line_id = $1`, [fixture.benefitLineId])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_scenarios SET label = 'renamed after freeze' WHERE scenario_id = $1`, [fixture.scenarioId])
      ).rejects.toThrow(/frozen/i);

      // Reopen for revision — unfreezes both baseline and economic model on
      // the SAME pinned client, same transaction as the approved -> modeling
      // CAS.
      await reopenApprovedRoiCaseForRevision({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: approveOutcome.resultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        reason: 'Reopening to prove unfreeze',
        idempotencyKey: `reopen-${randomUUID()}`,
      });

      await expectAllUnfrozen(fixture);

      // The SAME rows are editable again — raw UPDATEs now succeed.
      await expect(
        client.query(`UPDATE rvn_roi_baselines SET current_measured_value = 111, row_version = row_version + 1 WHERE baseline_id = $1`, [
          fixture.baselineId,
        ])
      ).resolves.toBeTruthy();
      await expect(
        client.query(
          `UPDATE rvn_roi_cost_lines SET amount = 1111, row_version = row_version + 1 WHERE cost_line_id = $1`,
          [fixture.costLineId]
        )
      ).resolves.toBeTruthy();
      await expect(
        client.query(
          `UPDATE rvn_roi_scenarios SET label = 'renamed after unfreeze', row_version = row_version + 1 WHERE scenario_id = $1`,
          [fixture.scenarioId]
        )
      ).resolves.toBeTruthy();

      // roi.baseline_unfrozen / roi.economic_model_unfrozen events present.
      const eventsResult = await client.query<{ event_type: string }>(
        `SELECT event_type FROM rvn_platform_events WHERE organization_id = $1 AND aggregate_id = $2 ORDER BY sequence`,
        [ORG_ID, fixture.caseId]
      );
      const eventTypes = eventsResult.rows.map((r) => r.event_type);
      expect(eventTypes).toContain('roi.baseline_unfrozen');
      expect(eventTypes).toContain('roi.economic_model_unfrozen');
      expect(eventTypes).toContain('roi.case_reopened_from_approved');
    }
  );

  itDB('a rejected case never had anything frozen in the first place', async () => {
    const fixture = await buildReadyCaseWithFullEconomicModel(`${INITIATIVE_ID}-2`);
    const submitOutcome = await submitRoiCaseForApproval({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: fixture.readyResultingVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `submit-${randomUUID()}`,
    });

    const rejectOutcome = await rejectRoiCase({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: submitOutcome.resultingVersion,
      rejectedBy: USER_APPROVER,
      rejectionReason: 'Numbers do not add up',
      actorEffectiveRole: 'admin',
      idempotencyKey: `reject-${randomUUID()}`,
    });
    expect(rejectOutcome.result.status).toBe('rejected');
    expect(rejectOutcome.result.rejectionReason).toBe('Numbers do not add up');

    await expectAllUnfrozen(fixture);

    const eventsResult = await client.query<{ event_type: string }>(
      `SELECT event_type FROM rvn_platform_events WHERE organization_id = $1 AND aggregate_id = $2 ORDER BY sequence`,
      [ORG_ID, fixture.caseId]
    );
    const eventTypes = eventsResult.rows.map((r) => r.event_type);
    expect(eventTypes).toContain('roi.case_rejected');
    expect(eventTypes).not.toContain('roi.baseline_frozen');
    expect(eventTypes).not.toContain('roi.economic_model_frozen');
  });

  itDB('a changes-requested case never had anything frozen in the first place', async () => {
    const fixture = await buildReadyCaseWithFullEconomicModel(`${INITIATIVE_ID}-3`);
    const submitOutcome = await submitRoiCaseForApproval({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: fixture.readyResultingVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `submit-${randomUUID()}`,
    });

    const changesOutcome = await requestChangesOnRoiCase({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: submitOutcome.resultingVersion,
      actorUserId: USER_APPROVER,
      changeRequestNotes: 'Please re-verify the benefit assumptions',
      actorEffectiveRole: 'admin',
      idempotencyKey: `changes-${randomUUID()}`,
    });
    expect(changesOutcome.result.status).toBe('changes_requested');
    expect(changesOutcome.result.changesRequestedReason).toBe('Please re-verify the benefit assumptions');

    await expectAllUnfrozen(fixture);

    const eventsResult = await client.query<{ event_type: string }>(
      `SELECT event_type FROM rvn_platform_events WHERE organization_id = $1 AND aggregate_id = $2 ORDER BY sequence`,
      [ORG_ID, fixture.caseId]
    );
    const eventTypes = eventsResult.rows.map((r) => r.event_type);
    expect(eventTypes).toContain('roi.case_changes_requested');
    expect(eventTypes).not.toContain('roi.baseline_frozen');
    expect(eventTypes).not.toContain('roi.economic_model_frozen');

    // 'changes_requested' stays editable (D6/D7) — a cost-line edit
    // succeeds via the command layer (not just a raw UPDATE).
    const costLineVersionResult = await client.query<{ row_version: number }>(
      `SELECT row_version FROM rvn_roi_cost_lines WHERE cost_line_id = $1`,
      [fixture.costLineId]
    );
    const costLineCommands: CostLineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
    const editOutcome = await costLineCommands.updateCostLine({
      costLineId: fixture.costLineId,
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: costLineVersionResult.rows[0]!.row_version,
      amount: 1500,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `edit-after-changes-requested-${randomUUID()}`,
    });
    expect(editOutcome.outcome).toBe('applied');
    expect(editOutcome.result.amount).toBe(1500);
  });
});
