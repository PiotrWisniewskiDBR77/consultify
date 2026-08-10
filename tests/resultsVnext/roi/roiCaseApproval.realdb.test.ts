/**
 * ROI-E003 — `approveRoiCase` full happy path, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §4.2 (AC-03/AC-04).
 *
 * Drives a case from `draft` all the way through `submitted_for_approval` ->
 * `approved`, then proves: the immutable `ApprovalSnapshot` row was
 * inserted (correct `sequence_number`/`content_hash`/`snapshot_payload`
 * shape), BOTH cross-epic freeze contracts (`freezeRoiBaseline`/
 * `freezeRoiEconomicModel`) were actually called — verified by attempting a
 * raw UPDATE on a frozen row afterward and confirming it fails (DB trigger,
 * not application code) — both case pointer columns
 * (`original_approved_snapshot_id`/`latest_approved_snapshot_id`) are
 * correct on this first approval, and both `roi.baseline_frozen`/
 * `roi.economic_model_frozen` events are present in the event log alongside
 * `roi.case_submitted_for_approval`/`roi.case_approved`.
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
const ORG_ID = `roi-e003-approval-org-${tag}`;
const USER_MAKER = `roi-e003-approval-maker-${tag}`; // creates, submits
const USER_APPROVER = `roi-e003-approval-approver-${tag}`; // approves — distinct identity
const INITIATIVE_ID = `roi-e003-approval-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
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
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

/** Drives a fresh case all the way to 'submitted_for_approval', ready for
 * `approveRoiCase`. Returns the ids the approval assertions need. */
async function buildSubmittedCase(initiativeId: string): Promise<{
  caseId: string;
  baselineId: string;
  costLineId: string;
  benefitLineId: string;
  runId: string;
  submitResultingVersion: number;
}> {
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Approval fixture initiative',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Approval fixture case',
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

  const runOutcome = await createRoiCalculationRun({
    organizationId: ORG_ID,
    caseId,
    scenarioId: null,
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `run-${randomUUID()}`,
  });
  expect(runOutcome.result.status).toBe('completed');

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
  expect(submitOutcome.result.status).toBe('submitted_for_approval');
  expect(submitOutcome.result.submittedBy).toBe(USER_MAKER);
  expect(submitOutcome.result.decisionCalculationRunId).toBe(runOutcome.result.runId);

  return {
    caseId,
    baselineId,
    costLineId: costLineOutcome.result.costLineId,
    benefitLineId: benefitLineOutcome.result.benefitLineId,
    runId: runOutcome.result.runId,
    submitResultingVersion: submitOutcome.resultingVersion,
  };
}

describe('ROI-E003 approveRoiCase — full happy path (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E003 approveRoiCase realdb tests did NOT run. This run is not evidence.');
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
    'approveRoiCase inserts the immutable snapshot, calls both freeze contracts, sets both pointer columns, ' +
      'and both frozen events are present in the event log',
    async () => {
      const fixture = await buildSubmittedCase(`${INITIATIVE_ID}-1`);

      const approveOutcome = await approveRoiCase({
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: fixture.submitResultingVersion,
        approverId: USER_APPROVER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `approve-${randomUUID()}`,
      });

      expect(approveOutcome.outcome).toBe('applied');
      expect(approveOutcome.result.case.status).toBe('approved');
      expect(approveOutcome.result.case.approvedBy).toBe(USER_APPROVER);
      expect(approveOutcome.result.snapshot.sequenceNumber).toBe(1);
      expect(approveOutcome.result.snapshot.caseId).toBe(fixture.caseId);
      expect(approveOutcome.result.snapshot.contentHash).toEqual(expect.any(String));
      expect(approveOutcome.result.snapshot.contentHash.length).toBeGreaterThan(0);

      // Both pointer columns correct on first approval.
      expect(approveOutcome.result.case.originalApprovedSnapshotId).toBe(approveOutcome.result.snapshot.snapshotId);
      expect(approveOutcome.result.case.latestApprovedSnapshotId).toBe(approveOutcome.result.snapshot.snapshotId);

      // The snapshot row itself: correct shape, immutable payload.
      const snapshotRowResult = await client.query<{
        snapshot_id: string;
        case_id: string;
        sequence_number: number;
        decision_calculation_run_id: string;
        content_hash: string;
        snapshot_payload: Record<string, unknown>;
      }>(`SELECT * FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`, [approveOutcome.result.snapshot.snapshotId]);
      const snapshotRow = snapshotRowResult.rows[0];
      expect(snapshotRow).toBeTruthy();
      expect(snapshotRow!.decision_calculation_run_id).toBe(fixture.runId);
      const payload = snapshotRow!.snapshot_payload;
      expect(payload).toHaveProperty('case');
      expect(payload).toHaveProperty('baseline');
      expect(payload).toHaveProperty('calculationPolicy');
      expect(payload).toHaveProperty('assumptions');
      expect(payload).toHaveProperty('costLines');
      expect(payload).toHaveProperty('benefitLines');
      expect(payload).toHaveProperty('benefitEvidenceLinks');
      expect(payload).toHaveProperty('scenarios');
      expect(payload).toHaveProperty('scenarioOverrides');
      expect(payload).toHaveProperty('decisionCalculationRun');
      expect((payload as { costLines: unknown[] }).costLines).toHaveLength(1);
      expect((payload as { benefitLines: unknown[] }).benefitLines).toHaveLength(1);

      // Both cross-epic freeze contracts actually ran — proven by a raw
      // post-approval UPDATE still failing on a DB trigger, not application
      // code.
      await expect(
        client.query(`UPDATE rvn_roi_baselines SET current_measured_value = 999 WHERE baseline_id = $1`, [
          fixture.baselineId,
        ])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_cost_lines SET amount = 999999 WHERE cost_line_id = $1`, [fixture.costLineId])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_benefit_lines SET amount = 999999 WHERE benefit_line_id = $1`, [
          fixture.benefitLineId,
        ])
      ).rejects.toThrow(/frozen/i);

      const frozenChecks = await Promise.all([
        client.query(`SELECT frozen_at FROM rvn_roi_baselines WHERE baseline_id = $1`, [fixture.baselineId]),
        client.query(`SELECT frozen_at FROM rvn_roi_calculation_policy WHERE case_id = $1`, [fixture.caseId]),
        client.query(`SELECT frozen_at FROM rvn_roi_cost_lines WHERE cost_line_id = $1`, [fixture.costLineId]),
        client.query(`SELECT frozen_at FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1`, [fixture.benefitLineId]),
      ]);
      for (const check of frozenChecks) {
        expect(check.rows[0]?.frozen_at).not.toBeNull();
      }

      // Both frozen events present, plus the submit/approve events.
      const eventsResult = await client.query<{ event_type: string }>(
        `SELECT event_type FROM rvn_platform_events WHERE organization_id = $1 AND aggregate_id = $2 ORDER BY sequence`,
        [ORG_ID, fixture.caseId]
      );
      const eventTypes = eventsResult.rows.map((r) => r.event_type);
      expect(eventTypes).toContain('roi.case_submitted_for_approval');
      expect(eventTypes).toContain('roi.baseline_frozen');
      expect(eventTypes).toContain('roi.economic_model_frozen');
      expect(eventTypes).toContain('roi.case_approved');
    }
  );
});
