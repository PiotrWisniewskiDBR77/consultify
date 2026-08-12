/**
 * ROI-E004 — Variance commands (AC-05: Variance has a cause+contribution
 * structure), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decision D9.
 *
 * Proves: `recordVariance` snapshots baseline/comparison values and computes
 * `variance_amount`/`variance_pct`; `updateVarianceStatus`'s CAS (row_version
 * on the variance's OWN row, not the parent case); `addVarianceCause`/
 * `removeVarianceCause`; and — the literal AC-05 fact-protection proof — a
 * RAW `UPDATE` on the variance's comparison facts (via the migration's own
 * `rvn_roi_variances_protect_facts` trigger, which fires for ANY connection
 * including a superuser one, unlike the `REVOKE`-based append-only tables)
 * fails, while `status`/`owner_user_id` remain directly editable.
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
const ORG_ID = `roi-e004-variance-org-${tag}`;
const USER_MAKER = `roi-e004-variance-maker-${tag}`;
const USER_APPROVER = `roi-e004-variance-approver-${tag}`;
const INITIATIVE_ID = `roi-e004-variance-init-${tag}`;

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
type VarianceCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiVarianceCommands.js');
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
let recordVariance: VarianceCommandsModule['recordVariance'];
let updateVarianceStatus: VarianceCommandsModule['updateVarianceStatus'];
let addVarianceCause: VarianceCommandsModule['addVarianceCause'];
let removeVarianceCause: VarianceCommandsModule['removeVarianceCause'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

interface VarianceFixture {
  caseId: string;
  approvalSnapshotId: string;
  forecastVersionId: string;
}

async function buildForecastedCase(suffix: string): Promise<VarianceFixture> {
  const initiativeId = `${INITIATIVE_ID}-${suffix}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Variance fixture initiative',
  ]);

  const createOutcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: 'Variance fixture case',
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

  // Forecast WITH an override — a real, nonzero variance vs the frozen
  // approved model (1000 -> 1500).
  const forecastOutcome = await createRoiForecastVersion({
    caseId,
    organizationId: ORG_ID,
    expectedVersion: trackingOutcome.resultingVersion,
    reason: 'Vendor price increase',
    overrides: [{ targetType: 'cost_line', targetId: costLineOutcome.result.costLineId, overrideAmount: 1500 }],
    actorUserId: USER_MAKER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `forecast-${randomUUID()}`,
  });

  return {
    caseId,
    approvalSnapshotId: approveOutcome.result.snapshot.snapshotId,
    forecastVersionId: forecastOutcome.result.forecastVersionId,
  };
}

describe('ROI-E004 Variance commands — AC-05 (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E004 variance realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_variances LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id))`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiVariance realdb fixture org');
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
    const varianceCommands: VarianceCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiVarianceCommands.js'
    );
    recordVariance = varianceCommands.recordVariance;
    updateVarianceStatus = varianceCommands.updateVarianceStatus;
    addVarianceCause = varianceCommands.addVarianceCause;
    removeVarianceCause = varianceCommands.removeVarianceCause;

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

  itDB('recordVariance snapshots baseline/comparison values and computes variance_amount/variance_pct', async () => {
    const fixture = await buildForecastedCase('1');

    const outcome = await recordVariance({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      comparisonType: 'approved_vs_forecast',
      metric: 'totalCosts',
      referenceApprovalSnapshotId: fixture.approvalSnapshotId,
      referenceForecastVersionId: fixture.forecastVersionId,
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `variance-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    const variance = outcome.result;
    expect(variance.baselineValue).toBe(1000);
    expect(variance.comparisonValue).toBe(1500);
    expect(variance.varianceAmount).toBe(500);
    expect(variance.variancePct).toBeCloseTo(50, 6);
    expect(variance.status).toBe('open');
  });

  itDB('updateVarianceStatus: CAS on the variance\'s own row_version; status/owner_user_id writable', async () => {
    const fixture = await buildForecastedCase('2');
    const recordOutcome = await recordVariance({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      comparisonType: 'approved_vs_forecast',
      metric: 'totalCosts',
      referenceApprovalSnapshotId: fixture.approvalSnapshotId,
      referenceForecastVersionId: fixture.forecastVersionId,
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `variance-2-${randomUUID()}`,
    });
    const varianceId = recordOutcome.result.varianceId;

    const updateOutcome = await updateVarianceStatus({
      varianceId,
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      expectedVersion: recordOutcome.result.rowVersion,
      status: 'explained',
      ownerUserId: USER_APPROVER,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `update-status-${randomUUID()}`,
    });
    expect(updateOutcome.result.status).toBe('explained');
    expect(updateOutcome.result.ownerUserId).toBe(USER_APPROVER);
    // Facts unchanged by the status update.
    expect(updateOutcome.result.baselineValue).toBe(1000);
    expect(updateOutcome.result.comparisonValue).toBe(1500);

    const { AtomicWriteConflictError } = await import('../../../server/src/services/resultsVnext/platform/atomicWrite.js');
    await expect(
      updateVarianceStatus({
        varianceId,
        caseId: fixture.caseId,
        organizationId: ORG_ID,
        expectedVersion: recordOutcome.result.rowVersion, // stale — already moved to updateOutcome.resultingVersion
        status: 'resolved',
        actorUserId: USER_MAKER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `update-status-stale-${randomUUID()}`,
      })
    ).rejects.toThrow(AtomicWriteConflictError);
  });

  itDB('addVarianceCause / removeVarianceCause: simple child inserts/deletes', async () => {
    const fixture = await buildForecastedCase('3');
    const recordOutcome = await recordVariance({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      comparisonType: 'approved_vs_forecast',
      metric: 'totalCosts',
      referenceApprovalSnapshotId: fixture.approvalSnapshotId,
      referenceForecastVersionId: fixture.forecastVersionId,
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `variance-3-${randomUUID()}`,
    });
    const varianceId = recordOutcome.result.varianceId;

    const causeOutcome = await addVarianceCause({
      varianceId,
      organizationId: ORG_ID,
      causeCategory: 'vendor_price_change',
      contributionPct: 100,
      narrative: 'Vendor increased list price after contract renewal',
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `cause-${randomUUID()}`,
    });
    expect(causeOutcome.outcome).toBe('applied');
    expect(causeOutcome.result.varianceId).toBe(varianceId);

    const listBefore = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rvn_roi_variance_causes WHERE variance_id = $1`,
      [varianceId]
    );
    expect(listBefore.rows[0]!.count).toBe('1');

    await removeVarianceCause({
      causeId: causeOutcome.result.causeId,
      varianceId,
      organizationId: ORG_ID,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `remove-cause-${randomUUID()}`,
    });

    const listAfter = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rvn_roi_variance_causes WHERE variance_id = $1`,
      [varianceId]
    );
    expect(listAfter.rows[0]!.count).toBe('0');
  });

  itDB('AC-05 fact-protection: a raw UPDATE on comparison facts fails (trigger fires even for this superuser test connection); status/owner remain directly editable', async () => {
    const fixture = await buildForecastedCase('4');
    const recordOutcome = await recordVariance({
      caseId: fixture.caseId,
      organizationId: ORG_ID,
      comparisonType: 'approved_vs_forecast',
      metric: 'totalCosts',
      referenceApprovalSnapshotId: fixture.approvalSnapshotId,
      referenceForecastVersionId: fixture.forecastVersionId,
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `variance-4-${randomUUID()}`,
    });
    const varianceId = recordOutcome.result.varianceId;

    await expect(
      client.query(`UPDATE rvn_roi_variances SET baseline_value = 9999 WHERE variance_id = $1`, [varianceId])
    ).rejects.toThrow(/immutable/i);

    await expect(
      client.query(`UPDATE rvn_roi_variances SET comparison_type = 'forecast_vs_actual' WHERE variance_id = $1`, [varianceId])
    ).rejects.toThrow(/immutable/i);

    // status/owner_user_id are NOT protected by the trigger — a raw UPDATE
    // of only those columns succeeds directly.
    await client.query(`UPDATE rvn_roi_variances SET status = 'resolved', owner_user_id = $2 WHERE variance_id = $1`, [
      varianceId,
      USER_APPROVER,
    ]);
    const row = await client.query<{ status: string; owner_user_id: string; baseline_value: string }>(
      `SELECT status, owner_user_id, baseline_value FROM rvn_roi_variances WHERE variance_id = $1`,
      [varianceId]
    );
    expect(row.rows[0]!.status).toBe('resolved');
    expect(row.rows[0]!.owner_user_id).toBe(USER_APPROVER);
    expect(row.rows[0]!.baseline_value).toBe('1000'); // untouched by the earlier rejected attempt
  });
});
