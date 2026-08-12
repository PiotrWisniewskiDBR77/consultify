/**
 * ROI-E004 — visibility-join regression for all 5 new tables, against a
 * REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §5 (Decision D13):
 * every new table inherits visibility via `case_id` only, `::text` cast on
 * every join — the same cast class missed 7 times across the KPI domain in
 * an earlier epic and only caught by a dedicated realDB test afterward
 * (ROI-E001 §5 / EXECUTION_LEDGER §24). Proves each of
 * `listRoiForecastVersions`/`getRoiForecastVersion`/`listActualEntries`/
 * `getActualEntry`/`listRoiActualSnapshots`/`getRoiActualSnapshot`/
 * `listVariances`/`getVariance` actually executes its join against real
 * rows (a missing `::text` cast throws Postgres 42883 "operator does not
 * exist: text = uuid" on the first real row) AND that RESTRICTED_ACL
 * visibility is enforced: the ACL grantee sees every row, a non-granted
 * outsider sees none.
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
const ORG_ID = `roi-e004-vis-join-org-${tag}`;
const USER_MAKER = `roi-e004-vis-join-maker-${tag}`;
const USER_APPROVER = `roi-e004-vis-join-approver-${tag}`;
const USER_GRANTEE = `roi-e004-vis-join-grantee-${tag}`;
const USER_OUTSIDER = `roi-e004-vis-join-outsider-${tag}`;
const INITIATIVE_ID = `roi-e004-vis-join-init-${tag}`;

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
type ForecastRepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiForecastVersionRepository.js');
type ActualEntryCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js');
type ActualEntryRepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualEntryRepository.js');
type ActualSnapshotCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js');
type ActualSnapshotRepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiActualSnapshotRepository.js');
type VarianceCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiVarianceCommands.js');
type VarianceRepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiVarianceRepository.js');
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
let listRoiForecastVersions: ForecastRepositoryModule['listRoiForecastVersions'];
let getRoiForecastVersion: ForecastRepositoryModule['getRoiForecastVersion'];
let recordActualEntry: ActualEntryCommandsModule['recordActualEntry'];
let listActualEntries: ActualEntryRepositoryModule['listActualEntries'];
let getActualEntry: ActualEntryRepositoryModule['getActualEntry'];
let publishRoiActualSnapshot: ActualSnapshotCommandsModule['publishRoiActualSnapshot'];
let listRoiActualSnapshots: ActualSnapshotRepositoryModule['listRoiActualSnapshots'];
let getRoiActualSnapshot: ActualSnapshotRepositoryModule['getRoiActualSnapshot'];
let recordVariance: VarianceCommandsModule['recordVariance'];
let addVarianceCause: VarianceCommandsModule['addVarianceCause'];
let listVariances: VarianceRepositoryModule['listVariances'];
let getVariance: VarianceRepositoryModule['getVariance'];
let closePgPool: (() => Promise<void>) | undefined;

let policyId: string;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<string> {
  const result = await client.query<{ policy_id: string }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)
     RETURNING policy_id`,
    [ORG_ID, domain, mode, createdBy]
  );
  return result.rows[0]!.policy_id;
}

async function grantAcl(caseId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ('roi_case', $1, 'user', $2, 'contribute', $3)`,
    [caseId, granteeUserId, grantedBy]
  );
}

describe('ROI-E004 forecast/actual/variance visibility-join regression (real Postgres)', () => {
  let caseId: string;
  let costLineId: string;
  let benefitLineId: string;
  let forecastVersionId: string;
  let actualEntryId: string;
  let actualSnapshotId: string;
  let varianceId: string;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E004 visibility-join realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_forecast_versions LIMIT 0');
      await client.query('SELECT 1 FROM rvn_roi_variance_causes LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id))`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiForecastActualVisibilityJoin realdb fixture org');
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
    const forecastRepository: ForecastRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiForecastVersionRepository.js'
    );
    listRoiForecastVersions = forecastRepository.listRoiForecastVersions;
    getRoiForecastVersion = forecastRepository.getRoiForecastVersion;
    const actualEntryCommands: ActualEntryCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js'
    );
    recordActualEntry = actualEntryCommands.recordActualEntry;
    const actualEntryRepository: ActualEntryRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualEntryRepository.js'
    );
    listActualEntries = actualEntryRepository.listActualEntries;
    getActualEntry = actualEntryRepository.getActualEntry;
    const actualSnapshotCommands: ActualSnapshotCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js'
    );
    publishRoiActualSnapshot = actualSnapshotCommands.publishRoiActualSnapshot;
    const actualSnapshotRepository: ActualSnapshotRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiActualSnapshotRepository.js'
    );
    listRoiActualSnapshots = actualSnapshotRepository.listRoiActualSnapshots;
    getRoiActualSnapshot = actualSnapshotRepository.getRoiActualSnapshot;
    const varianceCommands: VarianceCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiVarianceCommands.js'
    );
    recordVariance = varianceCommands.recordVariance;
    addVarianceCause = varianceCommands.addVarianceCause;
    const varianceRepository: VarianceRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiVarianceRepository.js'
    );
    listVariances = varianceRepository.listVariances;
    getVariance = varianceRepository.getVariance;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    policyId = await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_MAKER);
    void policyId;

    // ---- Drive a real case through the full lifecycle to Tracking, with
    // real rows in all 5 new tables. ----
    await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
      INITIATIVE_ID,
      ORG_ID,
      'Visibility-join fixture initiative',
    ]);
    const createOutcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId: INITIATIVE_ID,
      title: 'Visibility-join fixture case',
      ownerUserId: USER_MAKER,
      currency: 'USD',
      analysisStart: '2026-01-01',
      analysisEnd: '2026-12-31',
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-${randomUUID()}`,
    });
    caseId = createOutcome.result.case.caseId;
    await grantAcl(caseId, USER_GRANTEE, USER_MAKER);

    const startOutcome = await startModeling({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: createOutcome.result.case.rowVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `start-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
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
        access: { capabilities: ['*'], platformRole: null },
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
        access: { capabilities: ['*'], platformRole: null },
});
    costLineId = costLineOutcome.result.costLineId;
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
        access: { capabilities: ['*'], platformRole: null },
});
    benefitLineId = benefitLineOutcome.result.benefitLineId;
    await createRoiCalculationRun({
      organizationId: ORG_ID,
      caseId,
      scenarioId: null,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `run-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const readyOutcome = await markReadyForReview({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: startOutcome.resultingVersion,
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `ready-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
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
        access: { capabilities: ['*'], platformRole: null },
});

    const forecastOutcome = await createRoiForecastVersion({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: trackingOutcome.resultingVersion,
      reason: 'Visibility-join fixture forecast',
      actorUserId: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `forecast-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    forecastVersionId = forecastOutcome.result.forecastVersionId;

    const actualEntryOutcome = await recordActualEntry({
      caseId,
      organizationId: ORG_ID,
      entryType: 'cost',
      costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 950,
      currency: 'USD',
      source: 'invoice-1',
      recordedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `actual-${randomUUID()}`,
    });
    actualEntryId = actualEntryOutcome.result.actualEntryId;

    const snapshotOutcome = await publishRoiActualSnapshot({
      caseId,
      organizationId: ORG_ID,
      expectedVersion: forecastOutcome.resultingVersion,
      asOfPeriodEnd: '2026-01-31',
      publishedBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `snapshot-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    actualSnapshotId = snapshotOutcome.result.actualSnapshotId;

    const varianceOutcome = await recordVariance({
      caseId,
      organizationId: ORG_ID,
      comparisonType: 'approved_vs_forecast',
      metric: 'totalCosts',
      referenceApprovalSnapshotId: approveOutcome.result.snapshot.snapshotId,
      referenceForecastVersionId: forecastVersionId,
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `variance-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    varianceId = varianceOutcome.result.varianceId;
    await addVarianceCause({
      varianceId,
      organizationId: ORG_ID,
      causeCategory: 'timing',
      narrative: 'Fixture cause',
      createdBy: USER_MAKER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `cause-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  }, 60_000);

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

  itDB('listRoiForecastVersions/getRoiForecastVersion: grantee sees the row, outsider sees none', async () => {
    const grantedList = await listRoiForecastVersions({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId });
    expect(grantedList).toHaveLength(1);
    const outsiderList = await listRoiForecastVersions({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId });
    expect(outsiderList).toHaveLength(0);

    const grantedGet = await getRoiForecastVersion({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId, forecastVersionId });
    expect(grantedGet?.forecastVersionId).toBe(forecastVersionId);
    const outsiderGet = await getRoiForecastVersion({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId, forecastVersionId });
    expect(outsiderGet).toBeNull();
  });

  itDB('listActualEntries/getActualEntry: grantee sees the row, outsider sees none', async () => {
    const grantedList = await listActualEntries({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId });
    expect(grantedList.length).toBeGreaterThanOrEqual(1);
    const outsiderList = await listActualEntries({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId });
    expect(outsiderList).toHaveLength(0);

    const grantedGet = await getActualEntry({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId, actualEntryId });
    expect(grantedGet?.actualEntryId).toBe(actualEntryId);
    const outsiderGet = await getActualEntry({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId, actualEntryId });
    expect(outsiderGet).toBeNull();
  });

  itDB('listRoiActualSnapshots/getRoiActualSnapshot: grantee sees the row, outsider sees none', async () => {
    const grantedList = await listRoiActualSnapshots({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId });
    expect(grantedList).toHaveLength(1);
    const outsiderList = await listRoiActualSnapshots({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId });
    expect(outsiderList).toHaveLength(0);

    const grantedGet = await getRoiActualSnapshot({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId, actualSnapshotId });
    expect(grantedGet?.actualSnapshotId).toBe(actualSnapshotId);
    const outsiderGet = await getRoiActualSnapshot({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId, actualSnapshotId });
    expect(outsiderGet).toBeNull();
  });

  itDB('listVariances/getVariance (with its variance_causes join): grantee sees the row+cause, outsider sees none', async () => {
    const grantedList = await listVariances({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId });
    expect(grantedList).toHaveLength(1);
    const outsiderList = await listVariances({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId });
    expect(outsiderList).toHaveLength(0);

    const grantedGet = await getVariance({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId, varianceId });
    expect(grantedGet?.varianceId).toBe(varianceId);
    expect(grantedGet?.causes).toHaveLength(1);
    const outsiderGet = await getVariance({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId, varianceId });
    expect(outsiderGet).toBeNull();
  });
});
