/**
 * ROI-E003 — AC-06 full reapproval cycle, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §4.5/§4.2 (Decision
 * D9/D10). approve -> reopen-for-revision -> edit something -> resubmit ->
 * approve again. Asserts `original_approved_snapshot_id` is IDENTICAL
 * before and after the second approval, `latest_approved_snapshot_id`
 * changed, `sequence_number` went 1->2, and — the single most important
 * assertion in this package — the FIRST snapshot's stored `content_hash` is
 * byte-identical before and after the whole reopen/reapprove cycle (proves
 * nothing about v1's frozen record changed).
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
const ORG_ID = `roi-e003-reapproval-org-${tag}`;
const USER_MAKER = `roi-e003-reapproval-maker-${tag}`;
const USER_APPROVER = `roi-e003-reapproval-approver-${tag}`;
const INITIATIVE_ID = `roi-e003-reapproval-init-${tag}`;

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

describe('ROI-E003 reapproval cycle — AC-06 (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E003 reapproval realdb tests did NOT run. This run is not evidence.');
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
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiCaseReapproval realdb fixture org');
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
    'approve -> reopen-for-revision -> edit baseline -> resubmit -> approve again: original pointer unchanged, ' +
      'latest pointer moved, sequence 1->2, v1 content_hash byte-identical across the whole cycle',
    async () => {
      const initiativeId = `${INITIATIVE_ID}-1`;
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        initiativeId,
        ORG_ID,
        'Reapproval fixture initiative',
      ]);

      const createOutcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId,
        title: 'Reapproval fixture case',
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
        idempotencyKey: `run-1-${randomUUID()}`,
      });

      const readyOutcome1 = await markReadyForReview({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: startOutcome.resultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `ready-1-${randomUUID()}`,
      });
      const submitOutcome1 = await submitRoiCaseForApproval({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: readyOutcome1.resultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit-1-${randomUUID()}`,
      });

      // ---- v1 approval ----
      const approveOutcome1 = await approveRoiCase({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: submitOutcome1.resultingVersion,
        approverId: USER_APPROVER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `approve-1-${randomUUID()}`,
      });
      expect(approveOutcome1.result.snapshot.sequenceNumber).toBe(1);
      const v1SnapshotId = approveOutcome1.result.snapshot.snapshotId;
      const originalSnapshotId = approveOutcome1.result.case.originalApprovedSnapshotId;
      expect(originalSnapshotId).toBe(v1SnapshotId);
      expect(approveOutcome1.result.case.latestApprovedSnapshotId).toBe(v1SnapshotId);

      const v1RowBefore = await client.query<{ content_hash: string; snapshot_payload: unknown }>(
        `SELECT content_hash, snapshot_payload FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`,
        [v1SnapshotId]
      );
      const v1ContentHashBefore = v1RowBefore.rows[0]!.content_hash;
      const v1PayloadBefore = v1RowBefore.rows[0]!.snapshot_payload;
      expect(v1ContentHashBefore.length).toBeGreaterThan(0);

      // ---- reopen for revision (AC-06, D9) ----
      const reopenOutcome = await reopenApprovedRoiCaseForRevision({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: approveOutcome1.resultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        reason: 'Baseline needs revision after downstream data correction',
        idempotencyKey: `reopen-${randomUUID()}`,
      });
      expect(reopenOutcome.result.status).toBe('modeling');
      // History preserved — reopen does NOT touch approved_by/approved_at/
      // the pointer columns.
      expect(reopenOutcome.result.approvedBy).toBe(USER_APPROVER);
      expect(reopenOutcome.result.originalApprovedSnapshotId).toBe(v1SnapshotId);
      expect(reopenOutcome.result.latestApprovedSnapshotId).toBe(v1SnapshotId);

      // Baseline is editable again post-reopen.
      const baselineVersionResult = await client.query<{ row_version: number; frozen_at: string | null }>(
        `SELECT row_version, frozen_at FROM rvn_roi_baselines WHERE baseline_id = $1`,
        [baselineId]
      );
      expect(baselineVersionResult.rows[0]!.frozen_at).toBeNull();

      // ---- edit something (the baseline's measured value) ----
      await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: baselineVersionResult.rows[0]!.row_version,
        currentMeasuredValue: 150,
        actorId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `baseline-revision-${randomUUID()}`,
      });

      // ---- resubmit -> approve again ----
      const readyOutcome2 = await markReadyForReview({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: reopenOutcome.resultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `ready-2-${randomUUID()}`,
      });
      const submitOutcome2 = await submitRoiCaseForApproval({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: readyOutcome2.resultingVersion,
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit-2-${randomUUID()}`,
      });

      const approveOutcome2 = await approveRoiCase({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: submitOutcome2.resultingVersion,
        approverId: USER_APPROVER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `approve-2-${randomUUID()}`,
      });

      expect(approveOutcome2.result.snapshot.sequenceNumber).toBe(2);
      const v2SnapshotId = approveOutcome2.result.snapshot.snapshotId;
      expect(v2SnapshotId).not.toBe(v1SnapshotId);

      // original_approved_snapshot_id IDENTICAL before and after the second
      // approval; latest_approved_snapshot_id MOVED to v2.
      expect(approveOutcome2.result.case.originalApprovedSnapshotId).toBe(originalSnapshotId);
      expect(approveOutcome2.result.case.originalApprovedSnapshotId).toBe(v1SnapshotId);
      expect(approveOutcome2.result.case.latestApprovedSnapshotId).toBe(v2SnapshotId);

      // Two distinct snapshot rows now exist for this case.
      const allSnapshotsResult = await client.query<{ sequence_number: number; snapshot_id: string }>(
        `SELECT sequence_number, snapshot_id FROM rvn_roi_approval_snapshots WHERE case_id = $1 ORDER BY sequence_number`,
        [caseId]
      );
      expect(allSnapshotsResult.rows).toHaveLength(2);
      expect(allSnapshotsResult.rows[0]).toMatchObject({ sequence_number: 1, snapshot_id: v1SnapshotId });
      expect(allSnapshotsResult.rows[1]).toMatchObject({ sequence_number: 2, snapshot_id: v2SnapshotId });

      // THE single most important assertion: v1's stored content_hash (and
      // full payload) is byte-identical to what it was immediately after
      // the FIRST approval — nothing about v1's frozen record changed
      // across the entire reopen/edit/resubmit/reapprove cycle.
      const v1RowAfter = await client.query<{ content_hash: string; snapshot_payload: unknown }>(
        `SELECT content_hash, snapshot_payload FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`,
        [v1SnapshotId]
      );
      expect(v1RowAfter.rows[0]!.content_hash).toBe(v1ContentHashBefore);
      expect(v1RowAfter.rows[0]!.snapshot_payload).toEqual(v1PayloadBefore);

      // v2's content_hash must differ from v1's — the baseline edit
      // (100 -> 150) is reflected in v2's payload.
      const v2Row = await client.query<{ content_hash: string; snapshot_payload: { baseline: { currentMeasuredValue: number } } }>(
        `SELECT content_hash, snapshot_payload FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`,
        [v2SnapshotId]
      );
      expect(v2Row.rows[0]!.content_hash).not.toBe(v1ContentHashBefore);
      expect(v2Row.rows[0]!.snapshot_payload.baseline.currentMeasuredValue).toBe(150);
    }
  );
});
