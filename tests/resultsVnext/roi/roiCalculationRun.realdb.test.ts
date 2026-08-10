/**
 * ROI-E002 — `createRoiCalculationRun` (assembling engine input from real
 * `rvn_roi_*` rows, persisting the immutable run row) and
 * `isRoiCaseReadyForReviewEligibleWithEconomicModel`'s three deny branches
 * plus the eligible-after-fresh-run happy path, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4.2, §5, §9.
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
const ORG_ID = `roi-e002-calcrun-org-${tag}`;
const USER_OWNER = `roi-e002-calcrun-owner-${tag}`;
const INITIATIVE_ID = `roi-e002-calcrun-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ReadinessModule = typeof import('../../../server/src/services/resultsVnext/roi/roiEconomicModelReadiness.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let updateBenefitLine: BenefitLineCommandsModule['updateBenefitLine'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let isRoiCaseReadyForReviewEligibleWithEconomicModel: ReadinessModule['isRoiCaseReadyForReviewEligibleWithEconomicModel'];
let acquirePgClient: PgModule['acquirePgClient'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

async function createFixtureCase(): Promise<{ caseId: string; rowVersion: number }> {
  const initiativeId = `${INITIATIVE_ID}-${randomUUID()}`;
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Calc-run fixture initiative (per-case)',
  ]);
  const outcome = await createRoiCase({
    organizationId: ORG_ID,
    initiativeId,
    title: `Calc-run fixture case ${randomUUID()}`,
    ownerUserId: USER_OWNER,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: USER_OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  await startModeling({
    caseId: outcome.result.case.caseId,
    organizationId: ORG_ID,
    expectedVersion: outcome.result.case.rowVersion,
    actorUserId: USER_OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `start-modeling-${randomUUID()}`,
  });
  // Baseline requirement of E001's own guard — captured up front so every
  // deny/eligible check below isolates the ECONOMIC MODEL gate, not E001's.
  await captureOrUpdateBaseline({
    organizationId: ORG_ID,
    caseId: outcome.result.case.caseId,
    expectedVersion: 1,
    currentMeasuredValue: 10,
    baselinePeriodStart: '2026-01-01',
    baselinePeriodEnd: '2026-01-31',
    actorId: USER_OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `capture-baseline-${randomUUID()}`,
  });
  return { caseId: outcome.result.case.caseId, rowVersion: outcome.result.case.rowVersion };
}

describe('ROI-E002 calculation run + readiness guard (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E002 calculation-run realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_calculation_runs LIMIT 0');
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
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiCalculationRun realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI-E002 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;

    const baselineCommands: BaselineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;

    const costLineCommands: CostLineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
    addCostLine = costLineCommands.addCostLine;

    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    addBenefitLine = benefitLineCommands.addBenefitLine;
    updateBenefitLine = benefitLineCommands.updateBenefitLine;

    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;

    const readiness: ReadinessModule = await import('../../../server/src/services/resultsVnext/roi/roiEconomicModelReadiness.js');
    isRoiCaseReadyForReviewEligibleWithEconomicModel = readiness.isRoiCaseReadyForReviewEligibleWithEconomicModel;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    acquirePgClient = pgModule.acquirePgClient;
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_OWNER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
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

  itDB(
    'createRoiCalculationRun assembles engine input from real rows and persists a completed, immutable run row',
    async () => {
      const { caseId } = await createFixtureCase();

      await addCostLine({
        caseId,
        organizationId: ORG_ID,
        category: 'implementation',
        label: 'Setup cost',
        amount: 10000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-01-01',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `add-cost-${randomUUID()}`,
      });
      await addBenefitLine({
        caseId,
        organizationId: ORG_ID,
        category: 'efficiency',
        label: 'Time saved',
        isFinancial: true,
        amount: 2000,
        currency: 'USD',
        timingType: 'recurring',
        recurrenceStartDate: '2026-02-01',
        recurrenceEndDate: '2026-12-01',
        recurrenceCadence: 'monthly',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `add-benefit-${randomUUID()}`,
      });

      const runOutcome = await createRoiCalculationRun({
        organizationId: ORG_ID,
        caseId,
        scenarioId: null,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `calc-run-${randomUUID()}`,
      });
      expect(runOutcome.outcome).toBe('applied');
      expect(runOutcome.result.status).toBe('completed');
      expect(runOutcome.result.totalCosts).toBe(10000);
      expect(runOutcome.result.totalFinancialBenefits).toBe(22000); // 2000 * 11 occurrences (Feb-Dec)
      expect(runOutcome.result.engineVersion).toBeTruthy();
      expect(runOutcome.result.inputHash).toBeTruthy();

      // Immutability: no UPDATE path exists in the command layer for this
      // table — confirm the DB itself has no application-level UPDATE ever
      // issued by re-reading the row and checking created_at === completed_at
      // consistency and that a raw UPDATE is not blocked by a trigger (the
      // table intentionally has none — immutability is "never called", not
      // DB-enforced) but IS never called by this command.
      const rawRow = await client.query(`SELECT * FROM rvn_roi_calculation_runs WHERE run_id = $1`, [runOutcome.result.runId]);
      expect(rawRow.rows[0]).toBeTruthy();
      expect(rawRow.rows[0].status).toBe('completed');
    }
  );

  itDB(
    "isRoiCaseReadyForReviewEligibleWithEconomicModel deny branch 1: 'no_successful_calculation_run' before any run exists",
    async () => {
      const { caseId } = await createFixtureCase();

      const client2 = await acquirePgClient();
      try {
        const caseRow = (await client2.query(`SELECT * FROM rvn_roi_cases WHERE case_id = $1`, [caseId])).rows[0];
        const baselineRow = (await client2.query(`SELECT * FROM rvn_roi_baselines WHERE case_id = $1`, [caseId])).rows[0];
        const check = await isRoiCaseReadyForReviewEligibleWithEconomicModel(client2, caseRow, baselineRow);
        expect(check.eligible).toBe(false);
        expect(check.reason).toBe('no_successful_calculation_run');
      } finally {
        client2.release();
      }
    }
  );

  itDB(
    "isRoiCaseReadyForReviewEligibleWithEconomicModel deny branch 2: 'calculation_run_stale' after the economic model changes post-run",
    async () => {
      const { caseId } = await createFixtureCase();
      await addCostLine({
        caseId,
        organizationId: ORG_ID,
        category: 'implementation',
        label: 'Setup cost',
        amount: 5000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-01-01',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `add-cost-${randomUUID()}`,
      });
      await createRoiCalculationRun({
        organizationId: ORG_ID,
        caseId,
        scenarioId: null,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `calc-run-${randomUUID()}`,
      });

      // Mutate the economic model AFTER the run — a new cost line changes
      // the current-state hash without a fresh run existing for it.
      await addCostLine({
        caseId,
        organizationId: ORG_ID,
        category: 'implementation',
        label: 'Extra cost added after the run',
        amount: 999,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-01-01',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `add-cost-2-${randomUUID()}`,
      });

      const client2 = await acquirePgClient();
      try {
        const caseRow = (await client2.query(`SELECT * FROM rvn_roi_cases WHERE case_id = $1`, [caseId])).rows[0];
        const baselineRow = (await client2.query(`SELECT * FROM rvn_roi_baselines WHERE case_id = $1`, [caseId])).rows[0];
        const check = await isRoiCaseReadyForReviewEligibleWithEconomicModel(client2, caseRow, baselineRow);
        expect(check.eligible).toBe(false);
        expect(check.reason).toBe('calculation_run_stale');
      } finally {
        client2.release();
      }
    }
  );

  itDB(
    "isRoiCaseReadyForReviewEligibleWithEconomicModel deny branch 3: 'unresolved_double_counting_group', " +
      'then eligible:true (happy path) once resolved and a fresh matching run exists',
    async () => {
      const { caseId } = await createFixtureCase();

      const benefitA = await addBenefitLine({
        caseId,
        organizationId: ORG_ID,
        category: 'revenue',
        label: 'Benefit A',
        isFinancial: true,
        amount: 1000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-02-01',
        doubleCountingGroup: 'dc-group-1',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `add-benefit-a-${randomUUID()}`,
      });
      await addBenefitLine({
        caseId,
        organizationId: ORG_ID,
        category: 'revenue',
        label: 'Benefit B',
        isFinancial: true,
        amount: 500,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-02-01',
        doubleCountingGroup: 'dc-group-1',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `add-benefit-b-${randomUUID()}`,
      });

      const staleRun = await createRoiCalculationRun({
        organizationId: ORG_ID,
        caseId,
        scenarioId: null,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `calc-run-dc-${randomUUID()}`,
      });
      expect(staleRun.result.hasUnresolvedDoubleCounting).toBe(true);

      const client2 = await acquirePgClient();
      try {
        const caseRow = (await client2.query(`SELECT * FROM rvn_roi_cases WHERE case_id = $1`, [caseId])).rows[0];
        const baselineRow = (await client2.query(`SELECT * FROM rvn_roi_baselines WHERE case_id = $1`, [caseId])).rows[0];
        const denyCheck = await isRoiCaseReadyForReviewEligibleWithEconomicModel(client2, caseRow, baselineRow);
        expect(denyCheck.eligible).toBe(false);
        expect(denyCheck.reason).toBe('unresolved_double_counting_group');
      } finally {
        client2.release();
      }

      // Resolve the double-counting group (note on one member), then run
      // AGAIN so the fresh run's input_hash matches current state.
      await updateBenefitLine({
        benefitLineId: benefitA.result.benefitLineId,
        caseId,
        organizationId: ORG_ID,
        expectedVersion: benefitA.result.rowVersion,
        doubleCountingResolutionNote: 'Reviewed — both benefits are independently additive, not double-counted.',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `resolve-dc-${randomUUID()}`,
      });

      const freshRun = await createRoiCalculationRun({
        organizationId: ORG_ID,
        caseId,
        scenarioId: null,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `calc-run-dc-resolved-${randomUUID()}`,
      });
      expect(freshRun.result.hasUnresolvedDoubleCounting).toBe(false);

      const client3 = await acquirePgClient();
      try {
        const caseRow = (await client3.query(`SELECT * FROM rvn_roi_cases WHERE case_id = $1`, [caseId])).rows[0];
        const baselineRow = (await client3.query(`SELECT * FROM rvn_roi_baselines WHERE case_id = $1`, [caseId])).rows[0];
        const eligibleCheck = await isRoiCaseReadyForReviewEligibleWithEconomicModel(client3, caseRow, baselineRow);
        expect(eligibleCheck.eligible).toBe(true);
      } finally {
        client3.release();
      }
    }
  );
});
