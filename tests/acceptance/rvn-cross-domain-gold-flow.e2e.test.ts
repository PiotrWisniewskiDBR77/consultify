/**
 * Acceptance E2E — RN-G0: cross-domain gold-flow.
 *
 * The gap this closes: RN-G3 (`rvn-outbox-mywork-projection.e2e.test.ts`)
 * proves `mywork_projection` in isolation. RN-G6
 * (`rvn-outbox-finance-projection.e2e.test.ts`) proves `finance_projection`
 * in isolation. Neither proves the three Results vNext domains (KPI/ROI/OKR)
 * plus the outbox machinery behave as ONE product on a single continuous
 * timeline — a KPI breach that becomes an Inbox item a human actually sees,
 * closed for real, independently of a ROI case whose Finance lineage is
 * pinned, diverges, and is caught, all under multi-tenant isolation, with
 * the event log itself asserted complete and ordered and NO row quietly
 * parked/failed/dead-lettered anywhere in the run. This suite is that proof.
 *
 * Harness precedent (verbatim conventions): `rvn-outbox-mywork-projection
 * .e2e.test.ts` and `rvn-outbox-finance-projection.e2e.test.ts` — real local
 * Postgres via `requireLocalDbUrl()`, raw `pg.Client`, marker-prefixed
 * fixtures, hard DB-state assertions, `afterAll` cleanup, `sendSystemAlert`
 * the one mocked seam (no live webhook in this environment).
 *
 * ZERO hand-inserted event/outbox rows anywhere in this file — unlike RN-G3
 * proof 8 and RN-G6 proofs 4/5/6 (which deliberately manufacture a collision
 * or a malformed payload no real command can produce, to exercise a specific
 * failure/isolation edge), every event in this scenario is the byproduct of
 * a real, exported domain command. This is possible here because the
 * scenario never needs to construct an adversarial edge case — only to walk
 * the real, happy, cross-domain path start to finish. If that ever stops
 * being true the exception will be documented inline, per the task brief.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

// The one deliberate mock in this suite — same rationale as RN-G3/RN-G6's
// own suites: the OUTBOUND alert channel has no live webhook in this
// environment. Everything else (Postgres, the real command layer, the real
// dispatcher/consumers) is untouched. This suite's scenario is not designed
// to dead-letter or park anything (see the final "no silent failure"
// assertion), so this mock is expected to see zero CRITICAL calls by the
// end of the run — asserted explicitly below.
vi.mock('../../server/src/services/systemAlertNotifier.js', () => ({
  sendSystemAlert: vi.fn().mockResolvedValue(undefined),
}));

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const MARKER = `odbior--rn-g0--gold-flow--${tag}`;

const ORG_A = `${MARKER}--org-a`;
const ORG_B = `${MARKER}--org-b`;
const OWNER_A = `${MARKER}--owner-a`;
const OWNER_B = `${MARKER}--owner-b`;
const APPROVER_A = `${MARKER}--approver-a`;
const APPROVER_B = `${MARKER}--approver-b`;

type CommandsKpiMeasurement = typeof import('../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js');
type CommandsKpiDeviation = typeof import('../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js');
type CommandsKpiCorrectiveAction = typeof import('../../server/src/services/resultsVnext/kpi/kpiCorrectiveActionCommands.js');
type CaseCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
type ActualEntryCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js');
type ActualSnapshotCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js');
type FinanceLinkCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js');
type FinanceLinkRepositoryModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js');
type FinanceProjectionRepositoryModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceProjectionRepository.js');
type AtomicWriteModule = typeof import('../../server/src/services/resultsVnext/platform/atomicWrite.js');
type ConsumerRegistryModule = typeof import('../../server/src/services/resultsVnext/platform/consumerRegistry.js');
type MyWorkProjectionModule = typeof import('../../server/src/services/resultsVnext/platform/myworkProjectionConsumer.js');
type PlatformCronModule = typeof import('../../server/src/services/resultsVnext/platform/platformOutboxDrainCron.js');
type InboxServiceModule = typeof import('../../server/src/services/inboxService.js');
type SystemAlertModule = typeof import('../../server/src/services/systemAlertNotifier.js');

let recordMeasurement: CommandsKpiMeasurement['recordMeasurement'];
let acknowledgeDeviationCase: CommandsKpiDeviation['acknowledgeDeviationCase'];
let submitRootCause: CommandsKpiDeviation['submitRootCause'];
let submitPlan: CommandsKpiDeviation['submitPlan'];
let approvePlan: CommandsKpiDeviation['approvePlan'];
let submitEffectivenessVerification: CommandsKpiDeviation['submitEffectivenessVerification'];
let closeDeviationCase: CommandsKpiDeviation['closeDeviationCase'];
let addCorrectiveAction: CommandsKpiCorrectiveAction['addCorrectiveAction'];
let updateCorrectiveAction: CommandsKpiCorrectiveAction['updateCorrectiveAction'];

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
let recordActualEntry: ActualEntryCommandsModule['recordActualEntry'];
let publishRoiActualSnapshot: ActualSnapshotCommandsModule['publishRoiActualSnapshot'];
let createRoiFinanceLink: FinanceLinkCommandsModule['createRoiFinanceLink'];
let listRoiFinanceReconciliations: FinanceLinkRepositoryModule['listRoiFinanceReconciliations'];
let listRoiFinanceProjections: FinanceProjectionRepositoryModule['listRoiFinanceProjections'];

let resolveConsumerGroups: AtomicWriteModule['resolveConsumerGroups'];
let CONSUMER_REGISTRY: ConsumerRegistryModule['CONSUMER_REGISTRY'];
let UNBUILT_CONSUMER_GROUPS: ConsumerRegistryModule['UNBUILT_CONSUMER_GROUPS'];
let RVN_CANONICAL_STATES: MyWorkProjectionModule['RVN_CANONICAL_STATES'];
let runOutboxDispatchTick: PlatformCronModule['runOutboxDispatchTick'];
let materializeInboxItems: InboxServiceModule['materializeInboxItems'];
let getInboxItems: InboxServiceModule['getInboxItems'];
let sendSystemAlertMock: SystemAlertModule['sendSystemAlert'];

async function insertOrgAndUser(orgId: string, userId: string, email: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())
       ON CONFLICT (id) DO NOTHING`,
      [orgId, `RN-G0 fixture org ${orgId}`]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'RNG0', 'Fixture', now())
       ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, email]
    );
  } finally {
    await client.end();
  }
}

async function insertVisibilityPolicy(orgId: string, domain: string, mode: string, createdBy: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO rvn_platform_visibility_policies
         (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1, $2, 1, $3, true, $4)`,
      [orgId, domain, mode, createdBy]
    );
  } finally {
    await client.end();
  }
}

async function insertFixtureKpi(
  orgId: string,
  ownerUserId: string,
  kpiId: string,
  versionId: string
): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
       VALUES ($1, $2, $3, 'active', $4, $4)`,
      [kpiId, orgId, `KPI-${kpiId.slice(0, 8)}`, ownerUserId]
    );
    await client.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id, kpi_id, organization_id, version_number, name, target_geometry,
          target_min, approval_status, created_by, effective_from)
       VALUES ($1, $2, $3, 1, 'RN-G0 fixture KPI', 'threshold_min', 100, 'approved', $4, now())`,
      [versionId, kpiId, orgId, ownerUserId]
    );
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`,
      [versionId, kpiId]
    );
  } finally {
    await client.end();
  }
}

/** Step 1: real command chain (recordMeasurement -> openOrEscalateDeviationCase,
 * same transaction, per RN-G3 precedent) that breaches threshold and opens a
 * deviation case. Returns the resulting case_id. */
async function openRealDeviationCase(params: {
  orgId: string;
  ownerUserId: string;
  kpiId: string;
  versionId: string;
  idempotencyKey: string;
}): Promise<string> {
  const outcome = await recordMeasurement({
    kpiId: params.kpiId,
    definitionVersionId: params.versionId,
    organizationId: params.orgId,
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2026-01-31T00:00:00.000Z',
    actualValue: 10,
    performanceStatus: 'critical',
    source: 'manual',
    recordedBy: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: params.idempotencyKey,
    access: { capabilities: ['*'], platformRole: null },
  });
  expect(outcome.outcome).toBe('applied');

  const client = pgClient();
  await client.connect();
  try {
    const row = await client.query<{ case_id: string }>(
      `SELECT case_id FROM rvn_kpi_deviation_cases WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
      [params.orgId, params.kpiId]
    );
    const caseId = row.rows[0]?.case_id;
    if (!caseId) throw new Error('[openRealDeviationCase] no case row found after recordMeasurement');
    return caseId;
  } finally {
    await client.end();
  }
}

/** Step 4: drives an already-open deviation case through the ENTIRE real
 * state machine to 'closed' — identical chain to RN-G3's own precedent
 * helper. Every step is a real, exported domain command. */
async function closeRealDeviationCase(params: {
  orgId: string;
  caseId: string;
  ownerUserId: string;
  approverUserId: string;
  idemPrefix: string;
}): Promise<void> {
  const ack = await acknowledgeDeviationCase({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 1,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--ack`,
    access: { capabilities: ['*'], platformRole: null },
  });
  expect(ack.outcome).toBe('applied');

  const rootCause = await submitRootCause({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 2,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--rootcause`,
    access: { capabilities: ['*'], platformRole: null },
    rootCauseSummary: 'RN-G0 gold-flow fixture root cause',
    rootCauseCategory: 'process',
  });
  expect(rootCause.outcome).toBe('applied');
  expect(rootCause.result.status).toBe('plan_required');

  const action = await addCorrectiveAction({
    deviationCaseId: params.caseId,
    organizationId: params.orgId,
    title: 'RN-G0 gold-flow fixture corrective action',
    ownerUserId: params.ownerUserId,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--action`,
    access: { capabilities: ['*'], platformRole: null },
  });
  expect(action.outcome).toBe('applied');

  const plan = await submitPlan({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 3,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--plan`,
    access: { capabilities: ['*'], platformRole: null },
  });
  expect(plan.outcome).toBe('applied');

  const approved = await approvePlan({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 4,
    approverId: params.approverUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--approve`,
    access: { capabilities: ['*'], platformRole: null },
  });
  expect(approved.outcome).toBe('applied');

  const activated = await updateCorrectiveAction({
    actionId: action.result.actionId,
    organizationId: params.orgId,
    expectedVersion: 1,
    status: 'active',
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--action-active`,
    access: { capabilities: ['*'], platformRole: null },
  });
  expect(activated.outcome).toBe('applied');
  expect(activated.result.caseAutoTransitionedToExecuting).toBe(true);

  const verification = await submitEffectivenessVerification({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 5,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--verify`,
    access: { capabilities: ['*'], platformRole: null },
    verificationWindowStart: '2026-02-01T00:00:00.000Z',
    verificationWindowEnd: '2026-02-07T00:00:00.000Z',
    outcome: 'effective',
  });
  expect(verification.outcome).toBe('applied');
  expect(verification.result.case.status).toBe('verification');

  const closed = await closeDeviationCase({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 6,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--close`,
    access: { capabilities: ['*'], platformRole: null },
  });
  expect(closed.outcome).toBe('applied');
  expect(closed.result.status).toBe('closed');
}

interface RoiCaseFixture {
  caseId: string;
  initiativeId: string;
  costLineId: string;
  benefitLineId: string;
  linkId: string;
  rowVersion: number; // after approval
  approvalSnapshotId: string;
  approvalSequenceNumber: number;
}

/** Step 5: drives a fresh ROI case from 'draft' to 'approved' with a finance
 * link (created immediately after `createRoiCase`, the only status at which
 * `createRoiFinanceLink` is legal — same NON_EDITABLE_STATUSES constraint
 * RN-G6's own precedent documents) whose `pinned_finance_value` is set to
 * MATCH the case's real cost total (`costAmount`), so the seed dispatch
 * produces zero reconciliations. */
async function buildApprovedRoiCaseWithMatchingLink(params: {
  orgId: string;
  ownerUserId: string;
  approverId: string;
  suffix: string;
  costAmount: number;
}): Promise<RoiCaseFixture> {
  const { orgId, ownerUserId, approverId, suffix, costAmount } = params;
  const currency = 'USD';
  const benefitAmount = 2000;
  const initiativeId = `${MARKER}--init-${suffix}`;

  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'DRAFT')`,
      [initiativeId, orgId, 'RN-G0 gold-flow fixture initiative']
    );
  } finally {
    await client.end();
  }

  const createOutcome = await createRoiCase({
    organizationId: orgId,
    initiativeId,
    title: 'RN-G0 gold-flow fixture ROI case',
    ownerUserId,
    currency,
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--create-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const caseId = createOutcome.result.case.caseId;
  trackEvent(orgId, caseId, 'roi.case_created');

  const linkOutcome = await createRoiFinanceLink({
    caseId,
    organizationId: orgId,
    financeArtifactType: 'financial_roi_link',
    financeArtifactId: `${MARKER}--${suffix}-artifact`,
    financeVersionId: 'v1',
    source: 'finance_enterprise_service',
    asOf: '2026-01-01T00:00:00.000Z',
    currency: null,
    linkPurpose: 'cost_reference',
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--link-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const linkId = linkOutcome.result.linkId;
  trackEvent(orgId, caseId, 'roi.finance_link_created');

  // IO-F1 stand-in (no command-layer writer exists — same documented gap
  // RN-G6's own suite relies on): pin tracked_metric/pinned_finance_value to
  // MATCH costAmount directly via SQL.
  const pinClient = pgClient();
  await pinClient.connect();
  try {
    await pinClient.query(
      `UPDATE rvn_roi_finance_links SET tracked_metric = 'totalCosts', pinned_finance_value = $1 WHERE link_id = $2`,
      [costAmount, linkId]
    );
  } finally {
    await pinClient.end();
  }

  const startOutcome = await startModeling({
    caseId,
    organizationId: orgId,
    expectedVersion: createOutcome.result.case.rowVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--start-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  trackEvent(orgId, caseId, 'roi.case_modeling_started');

  await captureOrUpdateBaseline({
    organizationId: orgId,
    caseId,
    expectedVersion: createOutcome.result.baseline.rowVersion,
    currentMeasuredValue: 100,
    baselinePeriodStart: '2026-01-01',
    baselinePeriodEnd: '2026-01-31',
    actorId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--baseline-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  trackEvent(orgId, caseId, 'roi.baseline_captured');

  const costLineOutcome = await addCostLine({
    caseId,
    organizationId: orgId,
    category: 'implementation',
    label: 'Setup',
    amount: costAmount,
    currency,
    timingType: 'one_time',
    oneTimePeriodDate: '2026-01-15',
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--cost-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  trackEvent(orgId, caseId, 'roi.cost_line_added');

  const benefitLineOutcome = await addBenefitLine({
    caseId,
    organizationId: orgId,
    category: 'revenue',
    label: 'New revenue',
    isFinancial: true,
    amount: benefitAmount,
    currency,
    timingType: 'one_time',
    oneTimePeriodDate: '2026-02-15',
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--benefit-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  trackEvent(orgId, caseId, 'roi.benefit_line_added');

  await createRoiCalculationRun({
    organizationId: orgId,
    caseId,
    scenarioId: null,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--run-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  trackEvent(orgId, caseId, 'roi.calculation_run_completed');

  const readyOutcome = await markReadyForReview({
    caseId,
    organizationId: orgId,
    expectedVersion: startOutcome.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--ready-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  trackEvent(orgId, caseId, 'roi.case_ready_for_review');

  const submitOutcome = await submitRoiCaseForApproval({
    caseId,
    organizationId: orgId,
    expectedVersion: readyOutcome.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--submit-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  trackEvent(orgId, caseId, 'roi.case_submitted_for_approval');

  const approveOutcome = await approveRoiCase({
    caseId,
    organizationId: orgId,
    expectedVersion: submitOutcome.resultingVersion,
    approverId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `${MARKER}--${suffix}--approve-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  // approveRoiCase is itself a compound command: it freezes the baseline and
  // the economic model (their own events, same transaction) BEFORE writing
  // roi.case_approved — discovered by this suite's own Step 10 event-order
  // assertion against the real code (not assumed from reading the command in
  // isolation), which is exactly the kind of gap this gold-flow test exists
  // to catch.
  trackEvent(orgId, caseId, 'roi.baseline_frozen');
  trackEvent(orgId, caseId, 'roi.economic_model_frozen');
  trackEvent(orgId, caseId, 'roi.case_approved');

  return {
    caseId,
    initiativeId,
    costLineId: costLineOutcome.result.costLineId,
    benefitLineId: benefitLineOutcome.result.benefitLineId,
    linkId,
    rowVersion: approveOutcome.resultingVersion,
    approvalSnapshotId: approveOutcome.result.snapshot.snapshotId,
    approvalSequenceNumber: approveOutcome.result.snapshot.sequenceNumber,
  };
}

// ==========================================================================
// Event-log completeness/ordering tracking (final assertion, not per-step) —
// every command call above and below pushes its own (org, aggregate, type)
// tuple here; the final "event log complete and ordered" assertion re-reads
// each one from rvn_platform_events + rvn_platform_outbox directly, never
// trusting in-memory state.
// ==========================================================================
interface TrackedEvent {
  orgId: string;
  aggregateId: string;
  eventType: string;
}
const eventLog: TrackedEvent[] = [];
function trackEvent(orgId: string, aggregateId: string, eventType: string): void {
  eventLog.push({ orgId, aggregateId, eventType });
}

describe('RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product)', () => {
  // Populated across the sequential steps below — every `it` in this
  // describe block is DELIBERATELY dependent on the ones before it (this is
  // the one suite in this repo's acceptance layer where that is the point:
  // proving continuity across an unbroken timeline, not independent unit
  // proofs). Vitest runs `it`s within a `describe` in declaration order,
  // never concurrently unless `.concurrent` is used (not used here) — this
  // is the same sequential-dependency contract `closeRealDeviationCase`'s
  // own internal step chain already relies on, just promoted to the `it`
  // level so failures are attributable to the specific step that broke.
  let kpiIdA: string;
  let versionIdA: string;
  let deviationCaseIdA: string;
  let deviationNotificationId: string;
  let roiCaseA: RoiCaseFixture;

  let kpiIdB: string;
  let versionIdB: string;
  let deviationCaseIdB: string;
  let roiCaseB: RoiCaseFixture;

  beforeAll(async () => {
    await insertOrgAndUser(ORG_A, OWNER_A, `${OWNER_A}@acceptance.local`);
    await insertOrgAndUser(ORG_B, OWNER_B, `${OWNER_B}@acceptance.local`);
    // Approvers carry no notifications/canonical-state writes and no FK
    // (rvn_roi_cases.approved_by / plan_approved_by are plain TEXT columns)
    // — same rationale RN-G3/RN-G6 already documented, kept as plain id
    // constants for readability.
    void APPROVER_A;
    void APPROVER_B;

    await insertVisibilityPolicy(ORG_A, 'roi', 'OPEN_ORG', OWNER_A);
    await insertVisibilityPolicy(ORG_B, 'roi', 'OPEN_ORG', OWNER_B);

    const measurementCommands: CommandsKpiMeasurement = await import(
      '../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js'
    );
    recordMeasurement = measurementCommands.recordMeasurement;

    const deviationCommands: CommandsKpiDeviation = await import(
      '../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js'
    );
    ({
      acknowledgeDeviationCase,
      submitRootCause,
      submitPlan,
      approvePlan,
      submitEffectivenessVerification,
      closeDeviationCase,
    } = deviationCommands);

    const correctiveActionCommands: CommandsKpiCorrectiveAction = await import(
      '../../server/src/services/resultsVnext/kpi/kpiCorrectiveActionCommands.js'
    );
    ({ addCorrectiveAction, updateCorrectiveAction } = correctiveActionCommands);

    const caseCommands: CaseCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
    );
    ({ createRoiCase, startModeling, markReadyForReview } = caseCommands);

    const baselineCommands: BaselineCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    ({ captureOrUpdateBaseline } = baselineCommands);

    const costLineCommands: CostLineCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCostLineCommands.js'
    );
    ({ addCostLine } = costLineCommands);

    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    ({ addBenefitLine } = benefitLineCommands);

    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    ({ createRoiCalculationRun } = calcRunCommands);

    const approvalCommands: ApprovalCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
    );
    ({ submitRoiCaseForApproval, approveRoiCase } = approvalCommands);

    const trackingCommands: TrackingCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiTrackingCommands.js'
    );
    ({ startRoiCaseTracking } = trackingCommands);

    const actualEntryCommands: ActualEntryCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js'
    );
    ({ recordActualEntry } = actualEntryCommands);

    const actualSnapshotCommands: ActualSnapshotCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js'
    );
    ({ publishRoiActualSnapshot } = actualSnapshotCommands);

    const financeLinkCommands: FinanceLinkCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js'
    );
    ({ createRoiFinanceLink } = financeLinkCommands);

    const financeLinkRepository: FinanceLinkRepositoryModule = await import(
      '../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js'
    );
    ({ listRoiFinanceReconciliations } = financeLinkRepository);

    const financeProjectionRepository: FinanceProjectionRepositoryModule = await import(
      '../../server/src/services/resultsVnext/roi/roiFinanceProjectionRepository.js'
    );
    ({ listRoiFinanceProjections } = financeProjectionRepository);

    const atomicWrite: AtomicWriteModule = await import(
      '../../server/src/services/resultsVnext/platform/atomicWrite.js'
    );
    ({ resolveConsumerGroups } = atomicWrite);

    const consumerRegistry: ConsumerRegistryModule = await import(
      '../../server/src/services/resultsVnext/platform/consumerRegistry.js'
    );
    ({ CONSUMER_REGISTRY, UNBUILT_CONSUMER_GROUPS } = consumerRegistry);

    const myworkProjection: MyWorkProjectionModule = await import(
      '../../server/src/services/resultsVnext/platform/myworkProjectionConsumer.js'
    );
    ({ RVN_CANONICAL_STATES } = myworkProjection);

    const platformCron: PlatformCronModule = await import(
      '../../server/src/services/resultsVnext/platform/platformOutboxDrainCron.js'
    );
    ({ runOutboxDispatchTick } = platformCron);

    const inboxService: InboxServiceModule = await import('../../server/src/services/inboxService.js');
    ({ materializeInboxItems, getInboxItems } = inboxService);

    const systemAlert: SystemAlertModule = await import(
      '../../server/src/services/systemAlertNotifier.js'
    );
    sendSystemAlertMock = systemAlert.sendSystemAlert;
  }, 60_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      // ---- shared platform tables (both domains write these) ----
      await client.query(`DELETE FROM notifications WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM canonical_inbox_items WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM v8_canonical_object_states WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `DELETE FROM rvn_platform_projection_checkpoints WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_platform_consumer_processed WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = ANY($1::text[])
         )`,
        [[ORG_A, ORG_B]]
      );
      await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `DELETE FROM rvn_platform_outbox WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = ANY($1::text[])
         ) OR consumer_group LIKE $2`,
        [[ORG_A, ORG_B], `${MARKER}%`]
      );
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);

      // ---- KPI domain ----
      await client.query(
        `DELETE FROM rvn_kpi_effectiveness_verification_measurements WHERE verification_id IN (
           SELECT verification_id FROM rvn_kpi_effectiveness_verifications WHERE organization_id = ANY($1::text[])
         )`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `UPDATE rvn_kpi_deviation_cases SET close_effectiveness_verification_id = NULL
          WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_kpi_effectiveness_verifications WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(`DELETE FROM rvn_kpi_corrective_actions WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);

      // ---- ROI domain ----
      await client.query(`DELETE FROM rvn_roi_finance_projections WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_finance_reconciliations WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_finance_links WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `UPDATE rvn_roi_cases SET current_forecast_version_id = NULL, current_actual_snapshot_id = NULL,
                original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
                decision_calculation_run_id = NULL
          WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(`DELETE FROM rvn_roi_actual_entries WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_actual_snapshots WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_forecast_versions WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_approval_snapshots WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `DELETE FROM rvn_platform_resource_acl
          WHERE resource_type = 'roi_case'
            AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = ANY($1::text[]))`,
        [[ORG_A, ORG_B]]
      );
      await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
      await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);

      // ---- shared fixture rows ----
      await client.query(`DELETE FROM initiatives WHERE organization_id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
    } finally {
      await client.end();
    }
  }, 120_000);

  // ==========================================================================
  // Step 1 — KPI breach opens a deviation case (real command, atomic write)
  // ==========================================================================
  it('Step 1 — a KPI measurement breaching threshold fires openOrEscalateDeviationCase; event + outbox written atomically', async () => {
    kpiIdA = randomUUID();
    versionIdA = randomUUID();
    await insertFixtureKpi(ORG_A, OWNER_A, kpiIdA, versionIdA);

    deviationCaseIdA = await openRealDeviationCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      kpiId: kpiIdA,
      versionId: versionIdA,
      idempotencyKey: `${MARKER}--step1--measure`,
      access: { capabilities: ['*'], platformRole: null },
    });
    trackEvent(ORG_A, kpiIdA, 'kpi.measurement_recorded');
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_opened');

    const client = pgClient();
    await client.connect();
    try {
      const measurementEvent = await client.query(
        `SELECT event_id FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.measurement_recorded'`,
        [ORG_A, kpiIdA]
      );
      expect(measurementEvent.rows).toHaveLength(1);

      const deviationEvent = await client.query(
        `SELECT event_id FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
        [ORG_A, deviationCaseIdA]
      );
      expect(deviationEvent.rows).toHaveLength(1);
      const eventId = deviationEvent.rows[0].event_id;

      const outbox = await client.query(
        `SELECT status, consumer_group FROM rvn_platform_outbox WHERE event_id = $1`,
        [eventId]
      );
      expect(outbox.rows).toHaveLength(1);
      expect(outbox.rows[0]).toMatchObject({ status: 'pending', consumer_group: 'mywork_projection' });

      // Both events landed in the SAME transaction (decision #3, RN-G3
      // precedent) — their outbox rows both exist before any dispatch tick
      // has run.
      const measurementOutbox = await client.query(
        `SELECT status FROM rvn_platform_outbox o
           JOIN rvn_platform_events e ON e.event_id = o.event_id
          WHERE e.event_id = $1`,
        [measurementEvent.rows[0].event_id]
      );
      expect(measurementOutbox.rows[0].status).toBe('pending');
    } finally {
      await client.end();
    }
  });

  // ==========================================================================
  // Step 2 — dispatch tick -> mywork_projection: obligation-backed
  // notification + canonical object state
  // ==========================================================================
  it('Step 2 — one dispatch tick projects the deviation to an obligation-backed notification + canonical state', async () => {
    const tickResult = await runOutboxDispatchTick();
    expect(tickResult.dispatched).toBeGreaterThanOrEqual(1);
    expect(tickResult.failed).toBe(0);
    expect(tickResult.deadLettered).toBe(0);
    expect(tickResult.parked).toBe(0);

    const client = pgClient();
    await client.connect();
    try {
      const canonicalState = await client.query(
        `SELECT canonical_state, object_type FROM v8_canonical_object_states
          WHERE object_id = $1 AND organization_id = $2`,
        [deviationCaseIdA, ORG_A]
      );
      expect(canonicalState.rows).toHaveLength(1);
      expect(canonicalState.rows[0].canonical_state).toBe(RVN_CANONICAL_STATES.NEEDS_ATTENTION);
      expect(canonicalState.rows[0].object_type).toBe('deviation_case');

      // "Obligation-backed": the notification's assignee must trace back to
      // a real, OPEN rvn_platform_obligations row for this case — not just
      // a coincidentally-matching user id.
      const obligation = await client.query<{ assignee_user_id: string; status: string }>(
        `SELECT assignee_user_id, status FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'deviation_case' AND reference_id = $2`,
        [ORG_A, deviationCaseIdA]
      );
      expect(obligation.rows).toHaveLength(1);
      expect(obligation.rows[0].status).toBe('open');
      expect(obligation.rows[0].assignee_user_id).toBe(OWNER_A);

      const notification = await client.query<{ id: string; user_id: string; read: number }>(
        `SELECT id, user_id, read FROM notifications
          WHERE organization_id = $1 AND entity_type = 'deviation_case' AND entity_id = $2`,
        [ORG_A, deviationCaseIdA]
      );
      expect(notification.rows).toHaveLength(1);
      expect(notification.rows[0].user_id).toBe(obligation.rows[0].assignee_user_id);
      expect(Number(notification.rows[0].read)).toBe(0);
      deviationNotificationId = notification.rows[0].id;
    } finally {
      await client.end();
    }
  });

  // ==========================================================================
  // Step 3 — materializeInboxItems: genuinely visible in canonical_inbox_items
  // ==========================================================================
  it('Step 3 — materializeInboxItems surfaces the projected notification as a real canonical_inbox_items row', async () => {
    await materializeInboxItems(OWNER_A, ORG_A);
    const items = await getInboxItems(OWNER_A, ORG_A, {});
    const deviationItem = items.find(
      (item) => item.sourceEntityType === 'notification' && item.sourceEntityId === deviationNotificationId
    );
    expect(deviationItem).toBeTruthy();
    expect(deviationItem!.status).not.toBe('resolved');
    expect(deviationItem!.organizationId).toBe(ORG_A);

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT id, status FROM canonical_inbox_items WHERE id = $1 AND organization_id = $2`,
        [deviationItem!.id, ORG_A]
      );
      expect(row.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  });

  // ==========================================================================
  // Step 4 — real lifecycle to closure: kpi.deviation_closed resolves the
  // stale notification (not left dangling) + canonical state -> resolved
  // ==========================================================================
  it('Step 4 — driving the deviation case through its REAL lifecycle to closure resolves the stale notification and canonical state', async () => {
    await closeRealDeviationCase({
      orgId: ORG_A,
      caseId: deviationCaseIdA,
      ownerUserId: OWNER_A,
      approverUserId: APPROVER_A,
      idemPrefix: `${MARKER}--step4`,
    });
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_acknowledged');
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_root_cause_submitted');
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_corrective_action_added');
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_corrective_plan_submitted');
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_corrective_plan_approved');
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_corrective_action_updated');
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_effectiveness_verified');
    trackEvent(ORG_A, deviationCaseIdA, 'kpi.deviation_closed');

    const tickResult = await runOutboxDispatchTick();
    expect(tickResult.failed).toBe(0);
    expect(tickResult.deadLettered).toBe(0);
    expect(tickResult.parked).toBe(0);

    const client = pgClient();
    await client.connect();
    try {
      const canonicalState = await client.query(
        `SELECT canonical_state FROM v8_canonical_object_states WHERE object_id = $1 AND organization_id = $2`,
        [deviationCaseIdA, ORG_A]
      );
      expect(canonicalState.rows[0].canonical_state).toBe(RVN_CANONICAL_STATES.RESOLVED);

      const notification = await client.query<{ read: number; is_read: number }>(
        `SELECT read, is_read FROM notifications WHERE id = $1`,
        [deviationNotificationId]
      );
      expect(notification.rows).toHaveLength(1);
      expect(Number(notification.rows[0].read)).toBe(1);
      expect(Number(notification.rows[0].is_read)).toBe(1);
    } finally {
      await client.end();
    }

    // Re-materialize (no in-memory state assumed) — the resolved
    // notification's projection no longer shows as unread/open.
    await materializeInboxItems(OWNER_A, ORG_A);
    const items = await getInboxItems(OWNER_A, ORG_A, {});
    const deviationItem = items.find((item) => item.sourceEntityId === deviationNotificationId);
    expect(deviationItem?.status).toBe('resolved');
  }, 30_000);

  // ==========================================================================
  // Step 5 — independently, a ROI case approved with a MATCHING pinned
  // finance link -> correct pinned lineage, zero reconciliations
  // ==========================================================================
  it('Step 5 — an approved ROI case with a matching pinned finance link projects correct lineage and zero reconciliations', async () => {
    roiCaseA = await buildApprovedRoiCaseWithMatchingLink({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      approverId: APPROVER_A,
      suffix: 'a',
      costAmount: 1000,
    });

    const tickResult = await runOutboxDispatchTick();
    expect(tickResult.failed).toBe(0);
    expect(tickResult.deadLettered).toBe(0);
    expect(tickResult.parked).toBe(0);

    const projections = await listRoiFinanceProjections({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseA.caseId,
    });
    expect(projections).toHaveLength(1);
    expect(projections[0].financeLinkId).toBe(roiCaseA.linkId);
    expect(projections[0].trackedMetric).toBe('totalCosts');
    expect(projections[0].roiValue).toBe(1000);
    expect(projections[0].sourceKind).toBe('approval_snapshot');
    expect(projections[0].sourceId).toBe(roiCaseA.approvalSnapshotId);
    expect(projections[0].sourceSequenceNumber).toBe(roiCaseA.approvalSequenceNumber);
    expect(projections[0].caseStatus).toBe('approved');
    expect(projections[0].reconciliationStatus).toBeNull();

    const reconciliations = await listRoiFinanceReconciliations({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseA.caseId,
    });
    expect(reconciliations).toHaveLength(0);
  });

  // ==========================================================================
  // Step 6 — a later actual snapshot diverges from the pinned value -> exactly
  // one open reconciliation; both sides provably unchanged
  // ==========================================================================
  it('Step 6 — a diverging actual snapshot opens exactly one reconciliation without mutating either side\'s authoritative source', async () => {
    const rowVersionAfterTracking = await (async () => {
      const outcome = await startRoiCaseTracking({
        caseId: roiCaseA.caseId,
        organizationId: ORG_A,
        expectedVersion: roiCaseA.rowVersion,
        actorUserId: OWNER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `${MARKER}--step6--tracking-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
      });
      trackEvent(ORG_A, roiCaseA.caseId, 'roi.tracking_started');
      return outcome.resultingVersion;
    })();
    await runOutboxDispatchTick();

    const costEntry = await recordActualEntry({
      caseId: roiCaseA.caseId,
      organizationId: ORG_A,
      entryType: 'cost',
      costLineId: roiCaseA.costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 1800, // != pinnedFinanceValue (1000) — the deliberate divergence
      currency: 'USD',
      source: 'invoice-rn-g0-step6',
      recordedBy: OWNER_A,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--step6--actual-entry-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    void costEntry;
    trackEvent(ORG_A, roiCaseA.caseId, 'roi.actual_recorded');

    const snapshotOutcome = await publishRoiActualSnapshot({
      caseId: roiCaseA.caseId,
      organizationId: ORG_A,
      expectedVersion: rowVersionAfterTracking,
      asOfPeriodEnd: '2026-01-31',
      publishedBy: OWNER_A,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--step6--actual-snapshot-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    trackEvent(ORG_A, roiCaseA.caseId, 'roi.actual_snapshot_published');
    expect(snapshotOutcome.result.totalActualCosts).toBe(1800);

    // Snapshot the three immutable ROI source tables (per
    // financeProjectionConsumer.ts's own header comment: "the three source
    // tables are immutable") + the link's pinned_finance_value, scoped to
    // THIS case, AFTER the real domain write (the actual snapshot's new row
    // already exists — that IS the expected product behavior) but BEFORE the
    // dispatch tick that resolves the divergence. The bracket below is
    // around the DISPATCH TICK specifically — proving the finance_projection
    // consumer's divergence detection never mutates the source-of-truth
    // tables it reads, only ever the derived projection/reconciliation
    // rows.
    const client = pgClient();
    await client.connect();
    let beforeSnapshot: Record<string, { count: number; hash: string }>;
    let pinnedValueBefore: string;
    try {
      const tables = ['rvn_roi_approval_snapshots', 'rvn_roi_forecast_versions', 'rvn_roi_actual_snapshots'];
      beforeSnapshot = {};
      for (const table of tables) {
        const countRes = await client.query(`SELECT count(*)::int AS c FROM "${table}" WHERE case_id = $1`, [
          roiCaseA.caseId,
        ]);
        const hashRes = await client.query(
          `SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), '')) AS h FROM "${table}" t WHERE t.case_id = $1`,
          [roiCaseA.caseId]
        );
        beforeSnapshot[table] = { count: countRes.rows[0].c, hash: hashRes.rows[0].h };
      }
      const linkRow = await client.query(`SELECT pinned_finance_value FROM rvn_roi_finance_links WHERE link_id = $1`, [
        roiCaseA.linkId,
      ]);
      pinnedValueBefore = linkRow.rows[0].pinned_finance_value;
    } finally {
      await client.end();
    }

    const tickResult = await runOutboxDispatchTick();
    expect(tickResult.failed).toBe(0);
    expect(tickResult.deadLettered).toBe(0);
    expect(tickResult.parked).toBe(0);

    const afterClient = pgClient();
    await afterClient.connect();
    try {
      const tables = ['rvn_roi_approval_snapshots', 'rvn_roi_forecast_versions', 'rvn_roi_actual_snapshots'];
      for (const table of tables) {
        const countRes = await afterClient.query(`SELECT count(*)::int AS c FROM "${table}" WHERE case_id = $1`, [
          roiCaseA.caseId,
        ]);
        const hashRes = await afterClient.query(
          `SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), '')) AS h FROM "${table}" t WHERE t.case_id = $1`,
          [roiCaseA.caseId]
        );
        expect({ count: countRes.rows[0].c, hash: hashRes.rows[0].h }).toEqual(beforeSnapshot[table]);
      }
      const linkRow = await afterClient.query(
        `SELECT pinned_finance_value FROM rvn_roi_finance_links WHERE link_id = $1`,
        [roiCaseA.linkId]
      );
      expect(linkRow.rows[0].pinned_finance_value).toBe(pinnedValueBefore);
    } finally {
      await afterClient.end();
    }

    const projections = await listRoiFinanceProjections({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseA.caseId,
    });
    expect(projections).toHaveLength(1);
    expect(projections[0].roiValue).toBe(1800);
    expect(projections[0].sourceKind).toBe('actual_snapshot');
    expect(projections[0].sourceId).toBe(snapshotOutcome.result.actualSnapshotId);
    expect(projections[0].reconciliationStatus).toBe('open');

    const reconciliations = await listRoiFinanceReconciliations({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseA.caseId,
    });
    const openOnes = reconciliations.filter((r) => r.status === 'open');
    expect(openOnes).toHaveLength(1);
    expect(openOnes[0].financeLinkId).toBe(roiCaseA.linkId);
    expect(openOnes[0].roiValue).toBe(1800);
    expect(openOnes[0].financeValue).toBe(1000);
    // The consumer's own openRoiFinanceReconciliation call (Layer 2, see
    // financeProjectionConsumer.ts's file header) is itself a real command
    // that writes its own event — track it so Step 10's per-event
    // completeness/dispatched-outbox check covers it too.
    trackEvent(ORG_A, roiCaseA.caseId, 'roi.finance_reconciliation_opened');
  }, 30_000);

  // ==========================================================================
  // Step 7 — cold reopen: re-read EVERYTHING above through the public paths
  // only, with no in-memory state assumed
  // ==========================================================================
  it("Step 7 — cold reopen: re-reading through materializeInboxItems/getInboxItems + listRoiFinance* confirms every earlier claim, nothing depended on in-memory state", async () => {
    await materializeInboxItems(OWNER_A, ORG_A);
    const items = await getInboxItems(OWNER_A, ORG_A, {});
    const deviationItem = items.find((item) => item.sourceEntityId === deviationNotificationId);
    expect(deviationItem).toBeTruthy();
    expect(deviationItem!.status).toBe('resolved');

    const projections = await listRoiFinanceProjections({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseA.caseId,
    });
    expect(projections).toHaveLength(1);
    expect(projections[0].roiValue).toBe(1800);
    expect(projections[0].sourceKind).toBe('actual_snapshot');
    expect(projections[0].reconciliationStatus).toBe('open');

    const reconciliations = await listRoiFinanceReconciliations({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseA.caseId,
    });
    const openOnes = reconciliations.filter((r) => r.status === 'open');
    expect(openOnes).toHaveLength(1);
    expect(openOnes[0].roiValue).toBe(1800);
    expect(openOnes[0].financeValue).toBe(1000);
  });

  // ==========================================================================
  // Step 8 — cross-org isolation, exercised through the SAME public paths
  // ==========================================================================
  it('Step 8 — a second organization, run through the same dispatch, sees none of org A\'s inbox items/projections/reconciliations via the public paths', async () => {
    kpiIdB = randomUUID();
    versionIdB = randomUUID();
    await insertFixtureKpi(ORG_B, OWNER_B, kpiIdB, versionIdB);
    deviationCaseIdB = await openRealDeviationCase({
      orgId: ORG_B,
      ownerUserId: OWNER_B,
      kpiId: kpiIdB,
      versionId: versionIdB,
      idempotencyKey: `${MARKER}--step8--measure-b`,
      access: { capabilities: ['*'], platformRole: null },
    });
    trackEvent(ORG_B, kpiIdB, 'kpi.measurement_recorded');
    trackEvent(ORG_B, deviationCaseIdB, 'kpi.deviation_opened');

    roiCaseB = await buildApprovedRoiCaseWithMatchingLink({
      orgId: ORG_B,
      ownerUserId: OWNER_B,
      approverId: APPROVER_B,
      suffix: 'b',
      costAmount: 2500,
    });

    // "Run the same dispatch": one shared tick drains BOTH orgs' pending
    // rows together — the isolation guarantee under test is that a SHARED
    // dispatch process never cross-wires org A's and org B's data, not that
    // they're processed by separate runs.
    const tickResult = await runOutboxDispatchTick();
    expect(tickResult.failed).toBe(0);
    expect(tickResult.deadLettered).toBe(0);
    expect(tickResult.parked).toBe(0);

    // ---- Inbox isolation ----
    await materializeInboxItems(OWNER_B, ORG_B);
    const itemsB = await getInboxItems(OWNER_B, ORG_B, {});
    for (const item of itemsB) {
      expect(item.organizationId).toBe(ORG_B);
      expect(item.sourceEntityId).not.toBe(deviationNotificationId);
    }
    const ownDeviationItemB = itemsB.find((item) => item.sourceEntityId !== undefined);
    void ownDeviationItemB;

    await materializeInboxItems(OWNER_A, ORG_A);
    const itemsA = await getInboxItems(OWNER_A, ORG_A, {});
    for (const item of itemsA) {
      expect(item.organizationId).toBe(ORG_A);
    }
    const bNotification = await (async () => {
      const client = pgClient();
      await client.connect();
      try {
        const row = await client.query<{ id: string }>(
          `SELECT id FROM notifications WHERE organization_id = $1 AND entity_type = 'deviation_case' AND entity_id = $2`,
          [ORG_B, deviationCaseIdB]
        );
        return row.rows[0]?.id;
      } finally {
        await client.end();
      }
    })();
    expect(bNotification).toBeTruthy();
    expect(itemsA.some((item) => item.sourceEntityId === bNotification)).toBe(false);

    // ---- ROI projection/reconciliation isolation ----
    const orgAQueryingOrgBCase = await listRoiFinanceProjections({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseB.caseId,
    });
    expect(orgAQueryingOrgBCase).toHaveLength(0);

    const orgBOwnProjections = await listRoiFinanceProjections({
      userId: OWNER_B,
      organizationId: ORG_B,
      caseId: roiCaseB.caseId,
    });
    expect(orgBOwnProjections).toHaveLength(1);
    expect(orgBOwnProjections[0].organizationId).toBe(ORG_B);
    expect(orgBOwnProjections[0].caseId).toBe(roiCaseB.caseId);
    expect(orgBOwnProjections[0].roiValue).toBe(2500);
    expect(orgBOwnProjections[0].reconciliationStatus).toBeNull(); // matching pin, no divergence for org B

    const orgAOwnProjectionsStillCorrect = await listRoiFinanceProjections({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseA.caseId,
    });
    expect(orgAOwnProjectionsStillCorrect).toHaveLength(1);
    expect(orgAOwnProjectionsStillCorrect[0].roiValue).toBe(1800); // org B's fixture never touched org A's figure

    const orgBReconciliations = await listRoiFinanceReconciliations({
      userId: OWNER_B,
      organizationId: ORG_B,
      caseId: roiCaseB.caseId,
    });
    expect(orgBReconciliations).toHaveLength(0);

    const orgAQueryingOrgBReconciliations = await listRoiFinanceReconciliations({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: roiCaseB.caseId,
    });
    expect(orgAQueryingOrgBReconciliations).toHaveLength(0);
  });

  // ==========================================================================
  // Step 9 — no silent failure: zero rows left failed/dead_letter/parked for
  // every fixture this suite created, and zero unexpected CRITICAL alerts
  // ==========================================================================
  it('Step 9 — zero outbox rows for this suite\'s fixtures are left failed/dead_letter/parked, and zero CRITICAL alerts fired', async () => {
    const client = pgClient();
    await client.connect();
    try {
      const badRows = await client.query<{ status: string; consumer_group: string; last_error: string | null }>(
        `SELECT o.status, o.consumer_group, o.last_error FROM rvn_platform_outbox o
           JOIN rvn_platform_events e ON e.event_id = o.event_id
          WHERE e.organization_id = ANY($1::text[]) AND o.status IN ('failed', 'dead_letter', 'parked')`,
        [[ORG_A, ORG_B]]
      );
      expect(badRows.rows).toEqual([]);

      const pendingRows = await client.query(
        `SELECT o.outbox_id FROM rvn_platform_outbox o
           JOIN rvn_platform_events e ON e.event_id = o.event_id
          WHERE e.organization_id = ANY($1::text[]) AND o.status = 'pending'`,
        [[ORG_A, ORG_B]]
      );
      expect(pendingRows.rows).toEqual([]);
    } finally {
      await client.end();
    }

    const criticalCalls = (sendSystemAlertMock as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([arg]: [any]) => arg.severity === 'CRITICAL'
    );
    expect(criticalCalls.length).toBe(0);

    // Sanity on the dispatcher's own bookkeeping, matching this suite's own
    // no-hand-inserted-rows design: nothing in this run should have ever hit
    // an unregistered/unbuilt group.
    expect(UNBUILT_CONSUMER_GROUPS.size).toBe(0);
    expect(Object.keys(CONSUMER_REGISTRY)).toEqual(
      expect.arrayContaining(['mywork_projection', 'finance_projection'])
    );
  });

  // ==========================================================================
  // Step 10 — the event log itself is complete and ordered: every tracked
  // command produced its expected rvn_platform_events row, with a matching
  // DISPATCHED outbox row for every consumer group it routes to
  // ==========================================================================
  it('Step 10 — the event log is complete and ordered: every tracked command has its event row + matching dispatched outbox row(s)', async () => {
    expect(eventLog.length).toBeGreaterThan(0);

    const client = pgClient();
    await client.connect();
    try {
      for (const tracked of eventLog) {
        const eventRows = await client.query<{ event_id: string; sequence: string }>(
          `SELECT event_id, sequence::text AS sequence FROM rvn_platform_events
            WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = $3`,
          [tracked.orgId, tracked.aggregateId, tracked.eventType]
        );
        expect(
          eventRows.rows.length,
          `expected exactly one ${tracked.eventType} event for aggregate ${tracked.aggregateId} (org ${tracked.orgId})`
        ).toBe(1);
        const eventId = eventRows.rows[0].event_id;

        const expectedGroups = resolveConsumerGroups(tracked.eventType);
        expect(
          expectedGroups.length,
          `${tracked.eventType} must route to at least one consumer group`
        ).toBeGreaterThan(0);

        const outboxRows = await client.query<{ consumer_group: string; status: string }>(
          `SELECT consumer_group, status FROM rvn_platform_outbox WHERE event_id = $1`,
          [eventId]
        );
        const groupsSeen = outboxRows.rows.map((r) => r.consumer_group).sort();
        expect(groupsSeen).toEqual([...expectedGroups].sort());
        for (const row of outboxRows.rows) {
          expect(
            row.status,
            `outbox row for ${tracked.eventType}/${row.consumer_group} must be dispatched, not ${row.status}`
          ).toBe('dispatched');
        }
      }

      // Ordering: the KPI deviation case's own full lifecycle must read back
      // in EXACTLY the order the real commands were issued in (Steps 1+4) —
      // event `sequence` is a strictly monotonic identity column, so this
      // proves the event log records causality, not just presence.
      const expectedDeviationOrder = [
        'kpi.deviation_opened',
        'kpi.deviation_acknowledged',
        'kpi.deviation_root_cause_submitted',
        'kpi.deviation_corrective_action_added',
        'kpi.deviation_corrective_plan_submitted',
        'kpi.deviation_corrective_plan_approved',
        'kpi.deviation_corrective_action_updated',
        'kpi.deviation_effectiveness_verified',
        'kpi.deviation_closed',
      ];
      const deviationEvents = await client.query<{ event_type: string; sequence: string }>(
        `SELECT event_type, sequence::text AS sequence FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 ORDER BY sequence ASC`,
        [ORG_A, deviationCaseIdA]
      );
      expect(deviationEvents.rows.map((r) => r.event_type)).toEqual(expectedDeviationOrder);

      // Ordering: org A's ROI case's own event history (Steps 5+6) reads
      // back in exactly the order the real commands were issued in.
      const expectedRoiOrder = [
        'roi.case_created',
        'roi.finance_link_created',
        'roi.case_modeling_started',
        'roi.baseline_captured',
        'roi.cost_line_added',
        'roi.benefit_line_added',
        'roi.calculation_run_completed',
        'roi.case_ready_for_review',
        'roi.case_submitted_for_approval',
        'roi.baseline_frozen',
        'roi.economic_model_frozen',
        'roi.case_approved',
        'roi.tracking_started',
        'roi.actual_recorded',
        'roi.actual_snapshot_published',
        'roi.finance_reconciliation_opened',
      ];
      const roiEvents = await client.query<{ event_type: string; sequence: string }>(
        `SELECT event_type, sequence::text AS sequence FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 ORDER BY sequence ASC`,
        [ORG_A, roiCaseA.caseId]
      );
      expect(roiEvents.rows.map((r) => r.event_type)).toEqual(expectedRoiOrder);
    } finally {
      await client.end();
    }
  });
});
