/**
 * ROI-E006 — shared real-Postgres test fixtures for the PIR & Learning
 * realdb suites.
 *
 * NOT a `.test.ts` file itself — vitest never collects it. Every prior ROI
 * epic's realdb suites duplicate their own `buildClientConfig`/case-builder
 * boilerplate per file (see e.g. `roiBenefitsRealizationTransition.realdb
 * .test.ts`); ROI-E006 breaks from that convention on purpose: by this
 * epic the "get a fresh case to a useful starting status" chain is TEN
 * commands deep (create -> start-modeling -> baseline -> cost-line ->
 * benefit-line -> calc-run -> ready-for-review -> submit -> approve ->
 * start-tracking -> start-benefits-realization -> mark-pir-due ->
 * start-pir), and this epic alone needs SEVEN realdb suites that each need
 * a case at one of four different depths along that same chain.
 * Duplicating the full chain seven times would be ~1000 lines of pure
 * copy-paste with no new information — a real duplication-risk this file
 * exists to avoid, not a shortcut on rigor (every suite still drives real
 * Postgres through the real command layer, every suite still owns its own
 * `beforeAll`/`afterAll`/cleanup).
 */
import { randomUUID } from 'node:crypto';

import type { Client, ClientConfig } from 'pg';

export function buildClientConfig(): ClientConfig | null {
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

export const DB_CONFIGURED = buildClientConfig() !== null;

export async function insertVisibilityPolicy(
  client: Client,
  organizationId: string,
  domain: string,
  mode: string,
  createdBy: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [organizationId, domain, mode, createdBy]
  );
}

/** Re-exported under this epic's original name so ROI-E006's suites keep
 * their existing import; the single implementation now lives in
 * `roiRealdbOrgFixture.ts`, shared with every other ROI realdb suite
 * (CLOSEOUT-CO5). */
export { ensureRoiFixtureOrganization as insertOrganization } from './roiRealdbOrgFixture.js';

/** Raw-SQL Variance insert — `recordVariance` (the real command) requires a
 * live Forecast/Actual snapshot to compute against, which none of this
 * epic's fixture chains create (this epic starts one step past `'tracking'`,
 * never publishes a Forecast or Actual). These tests only need a Variance
 * ROW to exist so `startRoiCasePostInvestmentReview`'s frozen payload has
 * something non-empty to capture — a raw insert is the honest way to get
 * one without fabricating a Forecast/Actual pipeline the test does not
 * otherwise need. */
export async function insertRawVariance(
  client: Client,
  params: { caseId: string; organizationId: string; metric: string; createdBy: string; status?: string }
): Promise<{ varianceId: string }> {
  const { caseId, organizationId, metric, createdBy, status = 'open' } = params;
  const result = await client.query<{ variance_id: string }>(
    `INSERT INTO rvn_roi_variances (case_id, organization_id, comparison_type, metric, status, created_by)
     VALUES ($1, $2, 'approved_vs_actual', $3, $4, $5)
     RETURNING variance_id`,
    [caseId, organizationId, metric, status, createdBy]
  );
  return { varianceId: result.rows[0]!.variance_id };
}

export async function insertInitiative(
  client: Client,
  initiativeId: string,
  organizationId: string,
  name: string,
  status = 'EXECUTING'
): Promise<void> {
  await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`, [
    initiativeId,
    organizationId,
    name,
    status,
  ]);
}

/**
 * Dynamically imports every command/repository module the ROI-E006 test
 * suites need, once per `beforeAll`. Returned as a plain object rather than
 * many module-scoped `let` bindings — a single destructure at each call
 * site is shorter than the ~15-line block of individual reassignments every
 * prior suite's `beforeAll` repeats.
 */
export async function loadRoiPirTestModules() {
  const caseCommands = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
  const baselineCommands = await import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
  const costLineCommands = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
  const benefitLineCommands = await import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
  const calcRunCommands = await import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
  const approvalCommands = await import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
  const trackingCommands = await import('../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
  const benefitsRealizationCommands = await import(
    '../../../server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.js'
  );
  const pirCommands = await import('../../../server/src/services/resultsVnext/roi/roiPirCommands.js');
  const pirRepository = await import('../../../server/src/services/resultsVnext/roi/roiPirRepository.js');
  const varianceCommands = await import('../../../server/src/services/resultsVnext/roi/roiVarianceCommands.js');
  const orgPerspectiveRepository = await import(
    '../../../server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.js'
  );
  const pgModule = await import('../../../server/src/database/PostgresDatabase.js');

  return {
    createRoiCase: caseCommands.createRoiCase,
    startModeling: caseCommands.startModeling,
    markReadyForReview: caseCommands.markReadyForReview,
    captureOrUpdateBaseline: baselineCommands.captureOrUpdateBaseline,
    addCostLine: costLineCommands.addCostLine,
    addBenefitLine: benefitLineCommands.addBenefitLine,
    createRoiCalculationRun: calcRunCommands.createRoiCalculationRun,
    submitRoiCaseForApproval: approvalCommands.submitRoiCaseForApproval,
    approveRoiCase: approvalCommands.approveRoiCase,
    startRoiCaseTracking: trackingCommands.startRoiCaseTracking,
    startRoiCaseBenefitsRealization: benefitsRealizationCommands.startRoiCaseBenefitsRealization,
    scheduleRoiCasePostInvestmentReview: pirCommands.scheduleRoiCasePostInvestmentReview,
    markRoiCasePostInvestmentReviewDue: pirCommands.markRoiCasePostInvestmentReviewDue,
    startRoiCasePostInvestmentReview: pirCommands.startRoiCasePostInvestmentReview,
    updateRoiPostInvestmentReviewDraft: pirCommands.updateRoiPostInvestmentReviewDraft,
    recordRoiPirTeresaDraftDisposition: pirCommands.recordRoiPirTeresaDraftDisposition,
    closeRoiCase: pirCommands.closeRoiCase,
    RoiPirValidationError: pirCommands.RoiPirValidationError,
    RoiPirNotFoundError: pirCommands.RoiPirNotFoundError,
    RoiPirSelfCloseDeniedError: pirCommands.RoiPirSelfCloseDeniedError,
    CONDUCT_PIR_OBLIGATION_TYPE: pirCommands.CONDUCT_PIR_OBLIGATION_TYPE,
    RoiCaseValidationError: caseCommands.RoiCaseValidationError,
    listRoiPostInvestmentReviews: pirRepository.listRoiPostInvestmentReviews,
    getRoiPostInvestmentReview: pirRepository.getRoiPostInvestmentReview,
    recordVariance: varianceCommands.recordVariance,
    updateVarianceStatus: varianceCommands.updateVarianceStatus,
    listOrganizationRoiPirOutcomes: orgPerspectiveRepository.listOrganizationRoiPirOutcomes,
    closePgPool: (pgModule as unknown as { closePool?: () => Promise<void> }).closePool,
  };
}

export type RoiPirTestModules = Awaited<ReturnType<typeof loadRoiPirTestModules>>;

export interface CaseBuildResult {
  caseId: string;
  initiativeId: string;
  ownerUserId: string;
  rowVersion: number;
}

/** Drives a fresh case from 'draft' all the way to 'tracking' — identical
 * shape to `roiBenefitsRealizationTransition.realdb.test.ts`'s own
 * `buildTrackingCase`. */
export async function buildCaseThroughTracking(
  client: Client,
  modules: RoiPirTestModules,
  params: { organizationId: string; initiativeId: string; ownerUserId: string; approverId: string; title?: string }
): Promise<CaseBuildResult> {
  const { organizationId, initiativeId, ownerUserId, approverId, title = 'PIR fixture case' } = params;

  const createOutcome = await modules.createRoiCase({
    organizationId,
    initiativeId,
    title,
    ownerUserId,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `create-${randomUUID()}`,
  });
  const caseId = createOutcome.result.case.caseId;

  const startOutcome = await modules.startModeling({
    caseId,
    organizationId,
    expectedVersion: createOutcome.result.case.rowVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `start-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

  await modules.captureOrUpdateBaseline({
    organizationId,
    caseId,
    expectedVersion: createOutcome.result.baseline.rowVersion,
    currentMeasuredValue: 100,
    baselinePeriodStart: '2026-01-01',
    baselinePeriodEnd: '2026-01-31',
    actorId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `baseline-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

  await modules.addCostLine({
    caseId,
    organizationId,
    category: 'implementation',
    label: 'Setup',
    amount: 1000,
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: '2026-01-15',
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `cost-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  await modules.addBenefitLine({
    caseId,
    organizationId,
    category: 'revenue',
    label: 'New revenue',
    isFinancial: true,
    amount: 2000,
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: '2026-02-15',
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `benefit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

  await modules.createRoiCalculationRun({
    organizationId,
    caseId,
    scenarioId: null,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `run-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

  const readyOutcome = await modules.markReadyForReview({
    caseId,
    organizationId,
    expectedVersion: startOutcome.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `ready-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  // RN-G5: this fixture exercises the full ROI case decision flow, not
  // authorization — the wildcard makes the new command-capability guard
  // (commandCapabilityGuard.ts) always ALLOW, preserving every consuming
  // suite's pre-existing PIR/tracking coverage.
  const roi_gold_access = { capabilities: ['*'], platformRole: null } as const;
  const submitOutcome = await modules.submitRoiCaseForApproval({
    caseId,
    organizationId,
    expectedVersion: readyOutcome.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `submit-${randomUUID()}`,
    access: roi_gold_access,
  });
  const approveOutcome = await modules.approveRoiCase({
    caseId,
    organizationId,
    expectedVersion: submitOutcome.resultingVersion,
    approverId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `approve-${randomUUID()}`,
    access: roi_gold_access,
  });
  const trackingOutcome = await modules.startRoiCaseTracking({
    caseId,
    organizationId,
    expectedVersion: approveOutcome.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `tracking-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });

  return { caseId, initiativeId, ownerUserId, rowVersion: trackingOutcome.resultingVersion };
}

/** Extends `buildCaseThroughTracking` one more step: `'tracking' ->
 * 'benefits_realization'`. */
export async function buildCaseThroughBenefitsRealization(
  client: Client,
  modules: RoiPirTestModules,
  params: { organizationId: string; initiativeId: string; ownerUserId: string; approverId: string; title?: string }
): Promise<CaseBuildResult> {
  const tracking = await buildCaseThroughTracking(client, modules, params);
  const outcome = await modules.startRoiCaseBenefitsRealization({
    caseId: tracking.caseId,
    organizationId: params.organizationId,
    expectedVersion: tracking.rowVersion,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `br-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  return { ...tracking, rowVersion: outcome.resultingVersion };
}

/** Extends one more step: `'benefits_realization' ->
 * 'post_investment_review_due'`. */
export async function buildCaseThroughPirDue(
  client: Client,
  modules: RoiPirTestModules,
  params: { organizationId: string; initiativeId: string; ownerUserId: string; approverId: string; title?: string }
): Promise<CaseBuildResult> {
  const br = await buildCaseThroughBenefitsRealization(client, modules, params);
  const outcome = await modules.markRoiCasePostInvestmentReviewDue({
    caseId: br.caseId,
    organizationId: params.organizationId,
    expectedVersion: br.rowVersion,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `due-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  return { ...br, rowVersion: outcome.resultingVersion };
}

export interface PirStartedBuildResult extends CaseBuildResult {
  pirId: string;
  pirRowVersion: number;
  startedBy: string;
}

/** Extends one more step: `'post_investment_review_due' ->
 * 'post_investment_review'`, via `startRoiCasePostInvestmentReview`.
 * `starterUserId` defaults to the case owner — pass a different actor when
 * a test needs a starter distinct from whoever will later attempt to close
 * (D6's self-close denial needs the SAME actor for that half; a different
 * -actor close test needs this to differ). */
export async function buildCaseThroughPirStarted(
  client: Client,
  modules: RoiPirTestModules,
  params: {
    organizationId: string;
    initiativeId: string;
    ownerUserId: string;
    approverId: string;
    starterUserId?: string;
    title?: string;
  }
): Promise<PirStartedBuildResult> {
  const due = await buildCaseThroughPirDue(client, modules, params);
  const starterUserId = params.starterUserId ?? params.ownerUserId;
  const outcome = await modules.startRoiCasePostInvestmentReview({
    caseId: due.caseId,
    organizationId: params.organizationId,
    expectedVersion: due.rowVersion,
    actorUserId: starterUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `startpir-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  return {
    ...due,
    rowVersion: outcome.resultingVersion,
    pirId: outcome.result.pir.pirId,
    pirRowVersion: outcome.result.pir.rowVersion,
    startedBy: starterUserId,
  };
}

/** Full cleanup for every table this epic's fixtures can touch, scoped to
 * one `organizationId` — called from each suite's own `afterAll`. Mirrors
 * `roiBenefitsRealizationTransition.realdb.test.ts`'s own teardown order
 * (children before parents), extended with the two ROI-E006 additions
 * (`rvn_roi_post_investment_reviews`, and `rvn_platform_obligations` already
 * covered by the shared platform delete). */
export async function cleanupRoiPirFixtures(client: Client, organizationId: string): Promise<void> {
  await client.query(
    `UPDATE rvn_roi_cases SET current_forecast_version_id = NULL, current_actual_snapshot_id = NULL
      WHERE organization_id = $1`,
    [organizationId]
  );
  await client.query(`DELETE FROM rvn_roi_post_investment_reviews WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_variance_causes WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_variances WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_actual_snapshots WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_actual_entries WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_forecast_versions WHERE organization_id = $1`, [organizationId]);
  await client.query(
    `UPDATE rvn_roi_cases SET original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
            decision_calculation_run_id = NULL
      WHERE organization_id = $1`,
    [organizationId]
  );
  await client.query(`DELETE FROM rvn_roi_approval_snapshots WHERE organization_id = $1`, [organizationId]);
  await client.query(
    `DELETE FROM rvn_platform_resource_acl
      WHERE resource_type = 'roi_case'
        AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
    [organizationId]
  );
  await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [organizationId]);
  await client.query(
    `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
    [organizationId]
  );
  await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
}
