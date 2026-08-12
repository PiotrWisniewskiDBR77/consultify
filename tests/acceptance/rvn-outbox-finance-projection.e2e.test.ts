/**
 * Acceptance E2E — RN-G6: `finance_projection` outbox consumer.
 *
 * Design: docs/product/results-vnext/RN_G6_FINANCE_PROJECTION_DESIGN.md §8
 * (the eight acceptance proofs, plus three required negative tests, are the
 * definition of done for this slice).
 *
 * Second consumer against the landed RN-G3 dispatcher (first:
 * `rvn-outbox-mywork-projection.e2e.test.ts`, whose harness conventions this
 * file follows: real local Postgres via `requireLocalDbUrl()`, raw
 * `pg.Client`, marker-prefixed fixtures, hard DB-state assertions, `afterAll`
 * cleanup, `sendSystemAlert` the one mocked seam). Fixtures call REAL ROI
 * commands (`createRoiCase` -> `startModeling` -> `captureOrUpdateBaseline`
 * -> `addCostLine`/`addBenefitLine` -> `createRoiCalculationRun` ->
 * `markReadyForReview` -> `submitRoiCaseForApproval` -> `approveRoiCase` ->
 * `startRoiCaseTracking` -> `createRoiForecastVersion`/`recordActualEntry`+
 * `publishRoiActualSnapshot`, `createRoiFinanceLink`), never hand-inserted
 * event rows — the ONE deliberate, documented exception is the malformed-
 * payload negative-control events used to drive proofs 4/8 (a producer bug
 * class no real command can construct; see those tests' own comments).
 *
 * VERIFIED, REAL-CODE CONSTRAINT THAT SHAPES EVERY FIXTURE BELOW:
 * `createRoiFinanceLink` is gated by the SAME `NON_EDITABLE_STATUSES` guard
 * as every other economic-model-adjacent command (`roiFinanceLinkCommands
 * .ts`, confirmed against `roiFinanceLink.realdb.test.ts`'s own "gated by
 * the SAME NON_EDITABLE_STATUSES guard" test) — 'approved'/'tracking'/etc.
 * are ALL non-editable. A finance link can therefore only ever be created
 * BEFORE a case is submitted for approval, never after. Every fixture below
 * creates its finance link immediately after `createRoiCase` (status
 * 'draft'), then progresses the SAME case through modeling/approval/
 * tracking — never the other way around, regardless of how a given proof's
 * prose in the design doc phrases the sequence.
 *
 * `tracked_metric`/`pinned_finance_value` have NO command-layer writer
 * (IO-F1: no owner built in this slice) — every fixture sets them via a
 * direct `UPDATE rvn_roi_finance_links` after `createRoiFinanceLink`,
 * standing in for the not-yet-built Finance-side integration IO-F1
 * describes.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { mintToken, pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

// The one deliberate mock in this suite — same rationale as RN-G3's own
// mywork suite: the OUTBOUND alert channel has no live webhook in this
// environment. Everything else (Postgres, the real command layer, the real
// dispatcher/consumer) is untouched.
vi.mock('../../server/src/services/systemAlertNotifier.js', () => ({
  sendSystemAlert: vi.fn().mockResolvedValue(undefined),
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONSUMER_SOURCE_PATH = path.resolve(
  __dirname,
  '../../server/src/services/resultsVnext/platform/financeProjectionConsumer.ts'
);

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const MARKER = `odbior--rn-g6--${tag}`;

const ORG_A = `${MARKER}--org-a`;
const ORG_B = `${MARKER}--org-b`;
const OWNER_A = `${MARKER}--owner-a`;
const OWNER_B = `${MARKER}--owner-b`;
const APPROVER_A = `${MARKER}--approver-a`;
const APPROVER_B = `${MARKER}--approver-b`;

type CaseCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
type ForecastCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiForecastVersionCommands.js');
type ActualEntryCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiActualEntryCommands.js');
type ActualSnapshotCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiActualSnapshotCommands.js');
type FinanceLinkCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js');
type FinanceLinkRepositoryModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js');
type FinanceProjectionRepositoryModule = typeof import('../../server/src/services/resultsVnext/roi/roiFinanceProjectionRepository.js');
type CalculationPolicyCommandsModule = typeof import('../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js');
type AtomicWriteModule = typeof import('../../server/src/services/resultsVnext/platform/atomicWrite.js');
type OutboxDrainModule = typeof import('../../server/src/services/resultsVnext/platform/outboxDrain.js');
type ConsumerRegistryModule = typeof import('../../server/src/services/resultsVnext/platform/consumerRegistry.js');
type FinanceProjectionConsumerModule = typeof import('../../server/src/services/resultsVnext/platform/financeProjectionConsumer.js');
type PlatformCronModule = typeof import('../../server/src/services/resultsVnext/platform/platformOutboxDrainCron.js');
type SystemAlertModule = typeof import('../../server/src/services/systemAlertNotifier.js');
type PgModule = typeof import('../../server/src/database/PostgresDatabase.js');

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
let recordActualEntry: ActualEntryCommandsModule['recordActualEntry'];
let publishRoiActualSnapshot: ActualSnapshotCommandsModule['publishRoiActualSnapshot'];
let createRoiFinanceLink: FinanceLinkCommandsModule['createRoiFinanceLink'];
let listRoiFinanceReconciliations: FinanceLinkRepositoryModule['listRoiFinanceReconciliations'];
let listRoiFinanceProjections: FinanceProjectionRepositoryModule['listRoiFinanceProjections'];
let RoiEconomicModelNotEditableError: CalculationPolicyCommandsModule['RoiEconomicModelNotEditableError'];
let executeAtomicCreate: AtomicWriteModule['executeAtomicCreate'];
let EVENT_INSERT_SQL: AtomicWriteModule['EVENT_INSERT_SQL'];
let markFailed: OutboxDrainModule['markFailed'];
let CONSUMER_REGISTRY: ConsumerRegistryModule['CONSUMER_REGISTRY'];
let UNBUILT_CONSUMER_GROUPS: ConsumerRegistryModule['UNBUILT_CONSUMER_GROUPS'];
let dispatchFinanceProjection: FinanceProjectionConsumerModule['dispatchFinanceProjection'];
let runOutboxDispatchTick: PlatformCronModule['runOutboxDispatchTick'];
let sendSystemAlertMock: SystemAlertModule['sendSystemAlert'];
let acquirePgClient: PgModule['acquirePgClient'];
let closePgPool: (() => Promise<void>) | undefined;
let roiRouterApp: Express;

/** Same rationale as RN-G3's own suite: rollback-on-error before release so
 * a poisoned pooled connection never leaks into an unrelated later test. */
async function withTransaction<T>(
  acquire: () => Promise<import('pg').PoolClient>,
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await acquire();
  let released = false;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // no-op
    }
    released = true;
    client.release(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    if (!released) client.release();
  }
}

async function insertOrgAndUser(orgId: string, userId: string, email: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())
       ON CONFLICT (id) DO NOTHING`,
      [orgId, `RN-G6 fixture org ${orgId}`]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'RNG6', 'Fixture', now())
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

/** Sets the two IO-F1 columns via raw SQL — standing in for the
 * deliberately-not-built Finance-side write command. */
async function pinLinkMetric(
  linkId: string,
  trackedMetric: string | null,
  pinnedFinanceValue: number | null
): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`UPDATE rvn_roi_finance_links SET tracked_metric = $1, pinned_finance_value = $2 WHERE link_id = $3`, [
      trackedMetric,
      pinnedFinanceValue,
      linkId,
    ]);
  } finally {
    await client.end();
  }
}

interface CaseFixture {
  caseId: string;
  initiativeId: string;
  costLineId: string;
  benefitLineId: string;
  linkId?: string;
  rowVersion: number; // after approval
  approvalSnapshotId: string;
  approvalSequenceNumber: number;
}

/**
 * Drives a fresh case from 'draft' to 'approved' (never past it — tracking
 * is a separate opt-in step via `startTracking` below, since not every
 * proof needs forecast/actual). Creates an optional finance link
 * IMMEDIATELY after `createRoiCase` — the only status at which
 * `createRoiFinanceLink` is legal (see file header).
 */
async function buildApprovedCase(params: {
  orgId: string;
  ownerUserId: string;
  approverId: string;
  suffix: string;
  currency?: string;
  costAmount?: number;
  benefitAmount?: number;
  link?: {
    financeArtifactType: string;
    financeArtifactId: string;
    financeVersionId: string;
    linkPurpose: string;
    linkCurrency?: string | null;
    trackedMetric?: string | null;
    pinnedFinanceValue?: number | null;
  };
}): Promise<CaseFixture> {
  const { orgId, ownerUserId, approverId, suffix } = params;
  const currency = params.currency ?? 'USD';
  const costAmount = params.costAmount ?? 1000;
  const benefitAmount = params.benefitAmount ?? 2000;
  const initiativeId = `${MARKER}--init-${suffix}`;

  const client = pgClient();
  await client.connect();
  try {
    await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
      initiativeId,
      orgId,
      'RN-G6 fixture initiative',
    ]);
  } finally {
    await client.end();
  }

  const createOutcome = await createRoiCase({
    organizationId: orgId,
    initiativeId,
    title: 'RN-G6 fixture case',
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

  let linkId: string | undefined;
  if (params.link) {
    const linkOutcome = await createRoiFinanceLink({
      caseId,
      organizationId: orgId,
      financeArtifactType: params.link.financeArtifactType,
      financeArtifactId: params.link.financeArtifactId,
      financeVersionId: params.link.financeVersionId,
      source: 'finance_enterprise_service',
      asOf: '2026-01-01T00:00:00.000Z',
      currency: params.link.linkCurrency ?? null,
      linkPurpose: params.link.linkPurpose,
      actorUserId: ownerUserId,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--${suffix}--link-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    linkId = linkOutcome.result.linkId;
    if (params.link.trackedMetric !== undefined || params.link.pinnedFinanceValue !== undefined) {
      await pinLinkMetric(linkId, params.link.trackedMetric ?? null, params.link.pinnedFinanceValue ?? null);
    }
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

  await createRoiCalculationRun({
    organizationId: orgId,
    caseId,
    scenarioId: null,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--run-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });

  const readyOutcome = await markReadyForReview({
    caseId,
    organizationId: orgId,
    expectedVersion: startOutcome.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--ready-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const submitOutcome = await submitRoiCaseForApproval({
    caseId,
    organizationId: orgId,
    expectedVersion: readyOutcome.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--submit-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const approveOutcome = await approveRoiCase({
    caseId,
    organizationId: orgId,
    expectedVersion: submitOutcome.resultingVersion,
    approverId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `${MARKER}--${suffix}--approve-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });

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

async function startTracking(params: {
  orgId: string;
  caseId: string;
  ownerUserId: string;
  expectedVersion: number;
}): Promise<number> {
  const outcome = await startRoiCaseTracking({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: params.expectedVersion,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--tracking-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  return outcome.resultingVersion;
}

/** Minimal fixture for tests that only need a case+link created (no
 * approval chain) — a plain 'draft' case, the ONE status a finance link can
 * always legally be created against. */
async function buildDraftCaseWithLink(params: {
  orgId: string;
  ownerUserId: string;
  suffix: string;
  financeArtifactId: string;
}): Promise<{ caseId: string; linkId: string }> {
  const { orgId, ownerUserId, suffix, financeArtifactId } = params;
  const initiativeId = `${MARKER}--init-${suffix}`;

  const client = pgClient();
  await client.connect();
  try {
    await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
      initiativeId,
      orgId,
      'RN-G6 fixture initiative (draft)',
    ]);
  } finally {
    await client.end();
  }

  const createOutcome = await createRoiCase({
    organizationId: orgId,
    initiativeId,
    title: 'RN-G6 fixture draft case',
    ownerUserId,
    currency: 'USD',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    createdBy: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--create-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const caseId = createOutcome.result.case.caseId;

  const linkOutcome = await createRoiFinanceLink({
    caseId,
    organizationId: orgId,
    financeArtifactType: 'financial_roi_link',
    financeArtifactId,
    financeVersionId: 'v1',
    source: 'finance_enterprise_service',
    asOf: '2026-01-01T00:00:00.000Z',
    linkPurpose: 'cost_reference',
    actorUserId: ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${MARKER}--${suffix}--link-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });

  return { caseId, linkId: linkOutcome.result.linkId };
}

async function fetchLatestEventAndOutbox(
  orgId: string,
  caseId: string,
  eventType: string,
  consumerGroup: string
): Promise<{ event: FinanceProjectionConsumerModule extends never ? never : any; outboxRow: any }> {
  const client = pgClient();
  await client.connect();
  try {
    const eventRow = await client.query(
      `SELECT event_id, sequence::text AS sequence, event_type, aggregate_type, aggregate_id,
              organization_id, actor_user_id, actor_effective_role, occurred_at, payload
         FROM rvn_platform_events
        WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = $3
        ORDER BY sequence DESC LIMIT 1`,
      [orgId, caseId, eventType]
    );
    const event = eventRow.rows[0];
    if (!event) throw new Error(`[fixture] no ${eventType} event found for case ${caseId}`);
    const outboxResult = await client.query(
      `SELECT outbox_id, event_id, consumer_group, status, attempts, max_attempts, next_attempt_at,
              claimed_by, claimed_at, claim_expires_at, dispatched_at, last_error, created_at
         FROM rvn_platform_outbox WHERE event_id = $1 AND consumer_group = $2`,
      [event.event_id, consumerGroup]
    );
    return { event, outboxRow: outboxResult.rows[0] };
  } finally {
    await client.end();
  }
}

describe('RN-G6 · finance_projection consumer (eight acceptance proofs + three negative tests)', () => {
  beforeAll(async () => {
    await insertOrgAndUser(ORG_A, OWNER_A, `${OWNER_A}@acceptance.local`);
    await insertOrgAndUser(ORG_B, OWNER_B, `${OWNER_B}@acceptance.local`);
    void APPROVER_A;
    void APPROVER_B;

    await insertVisibilityPolicy(ORG_A, 'roi', 'OPEN_ORG', OWNER_A);
    await insertVisibilityPolicy(ORG_B, 'roi', 'OPEN_ORG', OWNER_B);

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

    const forecastCommands: ForecastCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiForecastVersionCommands.js'
    );
    ({ createRoiForecastVersion } = forecastCommands);

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

    const calcPolicyCommands: CalculationPolicyCommandsModule = await import(
      '../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js'
    );
    ({ RoiEconomicModelNotEditableError } = calcPolicyCommands);

    const atomicWrite: AtomicWriteModule = await import(
      '../../server/src/services/resultsVnext/platform/atomicWrite.js'
    );
    ({ executeAtomicCreate, EVENT_INSERT_SQL } = atomicWrite);

    const outboxDrain: OutboxDrainModule = await import(
      '../../server/src/services/resultsVnext/platform/outboxDrain.js'
    );
    ({ markFailed } = outboxDrain);

    const consumerRegistry: ConsumerRegistryModule = await import(
      '../../server/src/services/resultsVnext/platform/consumerRegistry.js'
    );
    ({ CONSUMER_REGISTRY, UNBUILT_CONSUMER_GROUPS } = consumerRegistry);

    const financeProjectionConsumer: FinanceProjectionConsumerModule = await import(
      '../../server/src/services/resultsVnext/platform/financeProjectionConsumer.js'
    );
    ({ dispatchFinanceProjection } = financeProjectionConsumer);

    const platformCron: PlatformCronModule = await import(
      '../../server/src/services/resultsVnext/platform/platformOutboxDrainCron.js'
    );
    ({ runOutboxDispatchTick } = platformCron);

    const systemAlert: SystemAlertModule = await import('../../server/src/services/systemAlertNotifier.js');
    sendSystemAlertMock = systemAlert.sendSystemAlert;

    const pgModule: PgModule = await import('../../server/src/database/PostgresDatabase.js');
    acquirePgClient = pgModule.acquirePgClient;
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    const roiRouter = (await import('../../server/src/routes/resultsVnext/roi.routes.js')).default;
    roiRouterApp = express();
    roiRouterApp.use(express.json());
    roiRouterApp.use('/api/vnext/results/roi', roiRouter);
  }, 60_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `DELETE FROM rvn_roi_finance_projections WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(`DELETE FROM rvn_roi_finance_reconciliations WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_roi_finance_links WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `DELETE FROM rvn_platform_consumer_processed WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = ANY($1::text[])
         )`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_platform_outbox WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = ANY($1::text[])
         ) OR consumer_group LIKE $2`,
        [[ORG_A, ORG_B], `${MARKER}%`]
      );
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      // MUST run before the forecast/actual/approval-snapshot DELETEs below
      // — rvn_roi_cases.current_forecast_version_id/current_actual_snapshot_id/
      // original_approved_snapshot_id/latest_approved_snapshot_id all FK-
      // reference those tables.
      await client.query(
        `UPDATE rvn_roi_cases SET current_forecast_version_id = NULL, current_actual_snapshot_id = NULL,
                original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
                decision_calculation_run_id = NULL
          WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_roi_actual_entries WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_roi_actual_snapshots WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_roi_forecast_versions WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
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
      await client.query(`DELETE FROM initiatives WHERE organization_id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
    } finally {
      await client.end();
    }
    if (closePgPool) await closePgPool();
  }, 90_000);

  // ==========================================================================
  // Proof 1 — atomic event + outbox write, + negative control
  // ==========================================================================
  describe('Proof 1 — atomic event + outbox write', () => {
    it('createRoiFinanceLink writes exactly one event row and one finance_projection outbox row', async () => {
      const fixture = await buildApprovedCase({
        orgId: ORG_A,
        ownerUserId: OWNER_A,
        approverId: APPROVER_A,
        suffix: 'p1-positive',
        link: {
          financeArtifactType: 'financial_roi_link',
          financeArtifactId: `${MARKER}--p1-artifact`,
          financeVersionId: 'v1',
          linkPurpose: 'npv_reference',
        },
      });

      const client = pgClient();
      await client.connect();
      try {
        const events = await client.query(
          `SELECT event_id FROM rvn_platform_events
            WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'roi.finance_link_created'`,
          [ORG_A, fixture.caseId]
        );
        expect(events.rows).toHaveLength(1);
        const eventId = events.rows[0].event_id;

        const outbox = await client.query(
          `SELECT outbox_id, status, consumer_group FROM rvn_platform_outbox
            WHERE event_id = $1 AND consumer_group = 'finance_projection'`,
          [eventId]
        );
        expect(outbox.rows).toHaveLength(1);
        expect(outbox.rows[0].status).toBe('pending');
      } finally {
        await client.end();
      }
    });

    it('NEGATIVE CONTROL: createRoiFinanceLink on a NON-editable (approved) case throws — no link row, no event, no outbox row', async () => {
      const fixture = await buildApprovedCase({
        orgId: ORG_A,
        ownerUserId: OWNER_A,
        approverId: APPROVER_A,
        suffix: 'p1-negctl',
      });

      const idempotencyKey = `${MARKER}--p1-negctl--link-attempt`;
      const financeArtifactId = `${MARKER}--p1-negctl-artifact`;

      await expect(
        createRoiFinanceLink({
          caseId: fixture.caseId,
          organizationId: ORG_A,
          financeArtifactType: 'financial_roi_link',
          financeArtifactId,
          financeVersionId: 'v1',
          source: 'finance_enterprise_service',
          asOf: '2026-01-01T00:00:00.000Z',
          linkPurpose: 'npv_reference',
          actorUserId: OWNER_A,
          actorEffectiveRole: 'consultant',
          idempotencyKey,
        })
      ).rejects.toThrow(RoiEconomicModelNotEditableError);

      const client = pgClient();
      await client.connect();
      try {
        const link = await client.query(
          `SELECT link_id FROM rvn_roi_finance_links WHERE finance_artifact_id = $1`,
          [financeArtifactId]
        );
        expect(link.rows).toHaveLength(0);

        const events = await client.query(
          `SELECT event_id FROM rvn_platform_events WHERE organization_id = $1 AND idempotency_key = $2`,
          [ORG_A, idempotencyKey]
        );
        expect(events.rows).toHaveLength(0);

        const outbox = await client.query(
          `SELECT o.outbox_id FROM rvn_platform_outbox o
             JOIN rvn_platform_events e ON e.event_id = o.event_id
            WHERE e.idempotency_key = $1`,
          [idempotencyKey]
        );
        expect(outbox.rows).toHaveLength(0);
      } finally {
        await client.end();
      }
    });
  });

  // ==========================================================================
  // Proof 2 — real consumer effect
  // ==========================================================================
  it('Proof 2 — approved case + matching pinned link, one tick: correct roi_value/source_kind/source_id, zero reconciliations', async () => {
    const fixture = await buildApprovedCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      approverId: APPROVER_A,
      suffix: 'p2',
      costAmount: 1000,
      link: {
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: `${MARKER}--p2-artifact`,
        financeVersionId: 'v1',
        linkPurpose: 'cost_reference',
        trackedMetric: 'totalCosts',
        pinnedFinanceValue: 1000,
      },
    });

    const tickResult = await runOutboxDispatchTick();
    expect(tickResult.dispatched).toBeGreaterThanOrEqual(1);

    const projections = await listRoiFinanceProjections({ userId: OWNER_A, organizationId: ORG_A, caseId: fixture.caseId });
    expect(projections).toHaveLength(1);
    const projection = projections[0];
    expect(projection.financeLinkId).toBe(fixture.linkId);
    expect(projection.trackedMetric).toBe('totalCosts');
    expect(projection.roiValue).toBe(1000);
    expect(projection.roiValueCurrency).toBe('USD');
    expect(projection.sourceKind).toBe('approval_snapshot');
    expect(projection.sourceId).toBe(fixture.approvalSnapshotId);
    expect(projection.sourceSequenceNumber).toBe(fixture.approvalSequenceNumber);
    expect(projection.caseStatus).toBe('approved');
    expect(projection.isLinkActive).toBe(true);
    expect(projection.reconciliationStatus).toBeNull();
    expect(projection.lastReconciliationId).toBeNull();

    const reconciliations = await listRoiFinanceReconciliations({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: fixture.caseId,
    });
    expect(reconciliations).toHaveLength(0);

    // Lifecycle sync bonus check: tracking_started updates case_status on the
    // SAME projection row without touching its figure.
    const newRowVersion = await startTracking({
      orgId: ORG_A,
      caseId: fixture.caseId,
      ownerUserId: OWNER_A,
      expectedVersion: fixture.rowVersion,
    });
    void newRowVersion;
    await runOutboxDispatchTick();
    const afterTracking = await listRoiFinanceProjections({ userId: OWNER_A, organizationId: ORG_A, caseId: fixture.caseId });
    expect(afterTracking[0].caseStatus).toBe('tracking');
    expect(afterTracking[0].roiValue).toBe(1000); // untouched by the lifecycle-only event
  });

  it('currency mismatch is a hard-fail divergence even when the numbers would otherwise match', async () => {
    const fixture = await buildApprovedCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      approverId: APPROVER_A,
      suffix: 'p2-currency',
      costAmount: 1000,
      currency: 'USD',
      link: {
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: `${MARKER}--p2-currency-artifact`,
        financeVersionId: 'v1',
        linkPurpose: 'cost_reference',
        linkCurrency: 'EUR', // mismatched vs the case's USD
        trackedMetric: 'totalCosts',
        pinnedFinanceValue: 1000, // numerically identical to totalCosts
      },
    });

    await runOutboxDispatchTick();

    const reconciliations = await listRoiFinanceReconciliations({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: fixture.caseId,
    });
    expect(reconciliations).toHaveLength(1);
    expect(reconciliations[0].status).toBe('open');
    expect(reconciliations[0].divergenceReason).toBe('currency_mismatch');
    expect(reconciliations[0].financeLinkId).toBe(fixture.linkId);
  });

  // ==========================================================================
  // Proof 3 — idempotency
  // ==========================================================================
  it('Proof 3 — calling dispatchFinanceProjection twice on the same claimed row produces one claim row, one projection row, unchanged updated_at', async () => {
    const fixture = await buildApprovedCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      approverId: APPROVER_A,
      suffix: 'p3',
      costAmount: 1000,
      link: {
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: `${MARKER}--p3-artifact`,
        financeVersionId: 'v1',
        linkPurpose: 'cost_reference',
        trackedMetric: 'totalCosts',
        pinnedFinanceValue: 1000,
      },
    });

    const { event, outboxRow } = await fetchLatestEventAndOutbox(
      ORG_A,
      fixture.caseId,
      'roi.case_approved',
      'finance_projection'
    );

    await withTransaction(acquirePgClient, (client) => dispatchFinanceProjection(client, event, outboxRow));

    const readClient = pgClient();
    await readClient.connect();
    let updatedAtFirst: string;
    try {
      const row = await readClient.query(
        `SELECT updated_at FROM rvn_roi_finance_projections WHERE finance_link_id = $1`,
        [fixture.linkId]
      );
      expect(row.rows).toHaveLength(1);
      updatedAtFirst = row.rows[0].updated_at;
    } finally {
      await readClient.end();
    }

    // Redelivery of the SAME event.
    await withTransaction(acquirePgClient, (client) => dispatchFinanceProjection(client, event, outboxRow));

    const finalClient = pgClient();
    await finalClient.connect();
    try {
      const projections = await finalClient.query(
        `SELECT updated_at FROM rvn_roi_finance_projections WHERE finance_link_id = $1`,
        [fixture.linkId]
      );
      expect(projections.rows).toHaveLength(1);
      expect(projections.rows[0].updated_at).toEqual(updatedAtFirst);

      const claimed = await finalClient.query(
        `SELECT consumer_group FROM rvn_platform_consumer_processed WHERE event_id = $1 AND consumer_group = 'finance_projection'`,
        [event.event_id]
      );
      expect(claimed.rows).toHaveLength(1);
    } finally {
      await finalClient.end();
    }
  });

  // ==========================================================================
  // Proof 4 — retry with backoff
  // ==========================================================================
  it('Proof 4 — a malformed event (missing payload.snapshotId) fails through the REAL consumer and backs off next_attempt_at', async () => {
    const fixture = await buildApprovedCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      approverId: APPROVER_A,
      suffix: 'p4',
    });

    const idempotencyKey = `${MARKER}--p4--malformed-event`;
    const dedicatedClient = await acquirePgClient();
    let outboxId: string;
    let beforeNextAttemptAt: string;
    try {
      await dedicatedClient.query('BEGIN');
      const eventInsert = await dedicatedClient.query<{ event_id: string }>(EVENT_INSERT_SQL, [
        1,
        'roi.case_approved',
        'roi_case',
        fixture.caseId,
        ORG_A,
        null,
        'system',
        randomUUID(),
        randomUUID(),
        null,
        new Date().toISOString(),
        '',
        null,
        JSON.stringify({}),
        'rn-g6-proof4-state-hash',
        null,
        JSON.stringify([]),
        'rn-g6-test',
        idempotencyKey,
        null,
        1,
        JSON.stringify({}), // deliberately missing snapshotId
      ]);
      const eventId = eventInsert.rows[0].event_id;
      const outboxInsert = await dedicatedClient.query<{ outbox_id: string; next_attempt_at: string }>(
        `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
         VALUES ($1, 'finance_projection', 'pending') RETURNING outbox_id, next_attempt_at`,
        [eventId]
      );
      outboxId = outboxInsert.rows[0].outbox_id;
      beforeNextAttemptAt = outboxInsert.rows[0].next_attempt_at;
      await dedicatedClient.query('COMMIT');
    } catch (err) {
      await dedicatedClient.query('ROLLBACK');
      throw err;
    } finally {
      dedicatedClient.release();
    }

    await runOutboxDispatchTick();

    const readClient = pgClient();
    await readClient.connect();
    try {
      const row = await readClient.query<{ status: string; attempts: number; next_attempt_at: string; last_error: string }>(
        `SELECT status, attempts, next_attempt_at, last_error FROM rvn_platform_outbox WHERE outbox_id = $1`,
        [outboxId]
      );
      expect(row.rows[0].status).toBe('failed');
      expect(row.rows[0].attempts).toBe(1);
      expect(row.rows[0].last_error).toContain('missing required payload.snapshotId');

      const deltaMs =
        new Date(row.rows[0].next_attempt_at).getTime() - new Date(beforeNextAttemptAt).getTime();
      expect(deltaMs).toBeGreaterThan(20_000);
      expect(deltaMs).toBeLessThan(45_000);
    } finally {
      await readClient.end();
    }
  });

  // ==========================================================================
  // Proof 5 — dead-letter + alert, and "graduated out of UNBUILT_CONSUMER_GROUPS"
  // ==========================================================================
  describe('Proof 5 — dead-letter + real alert', () => {
    it('finance_projection is registered and no longer in UNBUILT_CONSUMER_GROUPS', () => {
      expect(UNBUILT_CONSUMER_GROUPS.has('finance_projection')).toBe(false);
      expect(CONSUMER_REGISTRY['finance_projection']).toBeDefined();
    });

    it('a malformed event driven to max_attempts via the REAL dispatch path dead-letters and fires exactly one CRITICAL alert', async () => {
      const fixture = await buildApprovedCase({
        orgId: ORG_A,
        ownerUserId: OWNER_A,
        approverId: APPROVER_A,
        suffix: 'p5',
      });

      const idempotencyKey = `${MARKER}--p5--malformed-event`;
      const dedicatedClient = await acquirePgClient();
      let outboxId: string;
      let maxAttempts: number;
      try {
        await dedicatedClient.query('BEGIN');
        const eventInsert = await dedicatedClient.query<{ event_id: string }>(EVENT_INSERT_SQL, [
          1,
          'roi.forecast_published',
          'roi_case',
          fixture.caseId,
          ORG_A,
          null,
          'system',
          randomUUID(),
          randomUUID(),
          null,
          new Date().toISOString(),
          '',
          null,
          JSON.stringify({}),
          'rn-g6-proof5-state-hash',
          null,
          JSON.stringify([]),
          'rn-g6-test',
          idempotencyKey,
          null,
          1,
          JSON.stringify({}), // missing forecastVersionId
        ]);
        const eventId = eventInsert.rows[0].event_id;
        const outboxInsert = await dedicatedClient.query<{ outbox_id: string; max_attempts: number }>(
          `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           VALUES ($1, 'finance_projection', 'pending') RETURNING outbox_id, max_attempts`,
          [eventId]
        );
        outboxId = outboxInsert.rows[0].outbox_id;
        maxAttempts = outboxInsert.rows[0].max_attempts;
        await dedicatedClient.query('COMMIT');
      } catch (err) {
        await dedicatedClient.query('ROLLBACK');
        throw err;
      } finally {
        dedicatedClient.release();
      }

      // Pre-seed attempts up to (but not including) max_attempts via direct
      // markFailed calls (backoffSeconds=0 keeps next_attempt_at claimable
      // immediately) — the REAL tick's own dispatch attempt crosses the
      // threshold.
      const preSeedClient = await acquirePgClient();
      try {
        for (let i = 0; i < maxAttempts - 1; i++) {
          await markFailed(preSeedClient, outboxId, 'RN-G6 proof 5 pre-seeded failure', 0);
        }
      } finally {
        preSeedClient.release();
      }

      (sendSystemAlertMock as ReturnType<typeof vi.fn>).mockClear();
      await runOutboxDispatchTick();

      const readClient = pgClient();
      await readClient.connect();
      try {
        const row = await readClient.query<{ status: string; attempts: number }>(
          `SELECT status, attempts FROM rvn_platform_outbox WHERE outbox_id = $1`,
          [outboxId]
        );
        expect(row.rows[0].status).toBe('dead_letter');
        expect(row.rows[0].attempts).toBe(maxAttempts);
      } finally {
        await readClient.end();
      }

      const criticalCalls = (sendSystemAlertMock as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([arg]: [any]) => arg.severity === 'CRITICAL' && arg.throttleKey === 'outbox_dead_letter:finance_projection'
      );
      expect(criticalCalls.length).toBe(1);
    }, 30_000);

    it('a PREVIOUSLY PARKED row (simulating the pre-RN-G6 backlog) is replayable once flipped back to pending', async () => {
      const fixture = await buildApprovedCase({
        orgId: ORG_A,
        ownerUserId: OWNER_A,
        approverId: APPROVER_A,
        suffix: 'p5-parked',
      });
      await startTracking({
        orgId: ORG_A,
        caseId: fixture.caseId,
        ownerUserId: OWNER_A,
        expectedVersion: fixture.rowVersion,
      });

      const { event } = await fetchLatestEventAndOutbox(ORG_A, fixture.caseId, 'roi.tracking_started', 'finance_projection');

      const client = pgClient();
      await client.connect();
      let outboxId: string;
      try {
        // Simulate a row parked BEFORE this session (the exact state every
        // finance_projection row was in prior to RN-G6): the earlier outbox
        // row for THIS SAME event is already 'pending' from
        // atomicWrite.ts's own fan-out — mark it 'parked' directly, matching
        // markParked's own column touch (status + last_error only).
        const outboxRow = await client.query(
          `SELECT outbox_id FROM rvn_platform_outbox WHERE event_id = $1 AND consumer_group = 'finance_projection'`,
          [event.event_id]
        );
        outboxId = outboxRow.rows[0].outbox_id;
        await client.query(`UPDATE rvn_platform_outbox SET status = 'parked', last_error = 'CONSUMER_NOT_BUILT' WHERE outbox_id = $1`, [
          outboxId,
        ]);

        // The one-time backfill this package's EXECUTION_LEDGER closure
        // entry documents — not run automatically, a deliberate manual/ops
        // step now that a consumer exists.
        await client.query(
          `UPDATE rvn_platform_outbox SET status = 'pending' WHERE consumer_group = 'finance_projection' AND status = 'parked'`
        );
      } finally {
        await client.end();
      }

      await runOutboxDispatchTick();

      const readClient = pgClient();
      await readClient.connect();
      try {
        const row = await readClient.query(`SELECT status FROM rvn_platform_outbox WHERE outbox_id = $1`, [outboxId]);
        expect(row.rows[0].status).toBe('dispatched');
      } finally {
        await readClient.end();
      }
    });
  });

  // ==========================================================================
  // Proof 6 — cross-org isolation (shared literal finance_artifact_id)
  // ==========================================================================
  it('Proof 6 — two orgs whose links share the same literal finance_artifact_id/type never leak into each other', async () => {
    const sharedArtifactId = `${MARKER}--p6-shared-artifact`;
    const sharedArtifactType = 'financial_roi_link';

    const fixtureA = await buildApprovedCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      approverId: APPROVER_A,
      suffix: 'p6-a',
      costAmount: 1000,
      link: {
        financeArtifactType: sharedArtifactType,
        financeArtifactId: sharedArtifactId,
        financeVersionId: 'v1',
        linkPurpose: 'cost_reference',
        trackedMetric: 'totalCosts',
        pinnedFinanceValue: 1000,
      },
    });
    const fixtureB = await buildApprovedCase({
      orgId: ORG_B,
      ownerUserId: OWNER_B,
      approverId: APPROVER_B,
      suffix: 'p6-b',
      costAmount: 2500,
      link: {
        financeArtifactType: sharedArtifactType,
        financeArtifactId: sharedArtifactId,
        financeVersionId: 'v1',
        linkPurpose: 'cost_reference',
        trackedMetric: 'totalCosts',
        pinnedFinanceValue: 2500,
      },
    });
    expect(fixtureA.caseId).not.toBe(fixtureB.caseId);

    await runOutboxDispatchTick();

    const orgBOnly = await listRoiFinanceProjections({ userId: OWNER_B, organizationId: ORG_B, caseId: fixtureB.caseId });
    expect(orgBOnly).toHaveLength(1);
    expect(orgBOnly[0].organizationId).toBe(ORG_B);
    expect(orgBOnly[0].caseId).toBe(fixtureB.caseId);
    expect(orgBOnly[0].roiValue).toBe(2500);

    const orgAOnly = await listRoiFinanceProjections({ userId: OWNER_A, organizationId: ORG_A, caseId: fixtureA.caseId });
    expect(orgAOnly).toHaveLength(1);
    expect(orgAOnly[0].roiValue).toBe(1000);

    const client = pgClient();
    await client.connect();
    try {
      const rows = await client.query(
        `SELECT p.organization_id, p.case_id, p.roi_value
           FROM rvn_roi_finance_projections p
           JOIN rvn_roi_finance_links l ON l.link_id = p.finance_link_id
          WHERE l.finance_artifact_id = $1 AND l.finance_artifact_type = $2
          ORDER BY p.organization_id`,
        [sharedArtifactId, sharedArtifactType]
      );
      expect(rows.rows).toHaveLength(2);
      const byOrg = Object.fromEntries(rows.rows.map((r) => [r.organization_id, r]));
      expect(byOrg[ORG_A].case_id).toBe(fixtureA.caseId);
      expect(Number(byOrg[ORG_A].roi_value)).toBe(1000);
      expect(byOrg[ORG_B].case_id).toBe(fixtureB.caseId);
      expect(Number(byOrg[ORG_B].roi_value)).toBe(2500);
    } finally {
      await client.end();
    }
  });

  // ==========================================================================
  // Proof 7 — cold reopen/readback (+ NEGATIVE: divergence never overwrites
  // either side)
  // ==========================================================================
  it('Proof 7 — GET .../finance-projections readback, then a diverging actual snapshot updates lineage and opens a reconciliation; neither side is overwritten', async () => {
    const fixture = await buildApprovedCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      approverId: APPROVER_A,
      suffix: 'p7',
      costAmount: 1000,
      link: {
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: `${MARKER}--p7-artifact`,
        financeVersionId: 'v1',
        linkPurpose: 'cost_reference',
        trackedMetric: 'totalCosts',
        pinnedFinanceValue: 1000,
      },
    });
    let rowVersion = await startTracking({
      orgId: ORG_A,
      caseId: fixture.caseId,
      ownerUserId: OWNER_A,
      expectedVersion: fixture.rowVersion,
    });
    await runOutboxDispatchTick();

    // Cold reopen readback via the REAL HTTP route.
    const token = mintToken({ id: OWNER_A, organizationId: ORG_A, organization_id: ORG_A, role: 'consultant' });
    const httpRes = await request(roiRouterApp)
      .get(`/api/vnext/results/roi/cases/${fixture.caseId}/finance-projections`)
      .set('Authorization', `Bearer ${token}`);
    expect(httpRes.status).toBe(200);
    expect(httpRes.body.financeProjections).toHaveLength(1);
    expect(httpRes.body.financeProjections[0].financeLinkId).toBe(fixture.linkId);
    expect(httpRes.body.financeProjections[0].roiValue).toBe(1000);
    expect(httpRes.body.financeProjections[0].sourceKind).toBe('approval_snapshot');

    // NEGATIVE (before/after checksums for "divergence never overwrites
    // either side"): snapshot the approval snapshot's content_hash and the
    // link's pinned_finance_value BEFORE the diverging event.
    const beforeClient = pgClient();
    await beforeClient.connect();
    let approvalHashBefore: string;
    let pinnedValueBefore: string;
    try {
      const snap = await beforeClient.query(`SELECT content_hash FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`, [
        fixture.approvalSnapshotId,
      ]);
      approvalHashBefore = snap.rows[0].content_hash;
      const link = await beforeClient.query(`SELECT pinned_finance_value FROM rvn_roi_finance_links WHERE link_id = $1`, [
        fixture.linkId,
      ]);
      pinnedValueBefore = link.rows[0].pinned_finance_value;
    } finally {
      await beforeClient.end();
    }

    // Publish a diverging actual snapshot: one cost actual entry at 1800,
    // != pinnedFinanceValue (1000).
    const costEntry = await recordActualEntry({
      caseId: fixture.caseId,
      organizationId: ORG_A,
      entryType: 'cost',
      costLineId: fixture.costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 1800,
      currency: 'USD',
      source: 'invoice-1',
      recordedBy: OWNER_A,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--p7--actual-entry-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    void costEntry;
    const snapshotOutcome = await publishRoiActualSnapshot({
      caseId: fixture.caseId,
      organizationId: ORG_A,
      expectedVersion: rowVersion,
      asOfPeriodEnd: '2026-01-31',
      publishedBy: OWNER_A,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--p7--actual-snapshot-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    rowVersion = snapshotOutcome.resultingVersion;
    expect(snapshotOutcome.result.totalActualCosts).toBe(1800);

    await runOutboxDispatchTick();

    const afterProjections = await listRoiFinanceProjections({ userId: OWNER_A, organizationId: ORG_A, caseId: fixture.caseId });
    expect(afterProjections).toHaveLength(1);
    expect(afterProjections[0].roiValue).toBe(1800);
    expect(afterProjections[0].sourceKind).toBe('actual_snapshot');
    expect(afterProjections[0].sourceId).toBe(snapshotOutcome.result.actualSnapshotId);
    expect(afterProjections[0].sourceSequenceNumber).toBe(snapshotOutcome.result.sequenceNumber);
    expect(afterProjections[0].reconciliationStatus).toBe('open');
    expect(afterProjections[0].lastReconciliationId).toBeTruthy();

    const reconciliations = await listRoiFinanceReconciliations({
      userId: OWNER_A,
      organizationId: ORG_A,
      caseId: fixture.caseId,
    });
    const openOnes = reconciliations.filter((r) => r.status === 'open');
    expect(openOnes).toHaveLength(1);
    expect(openOnes[0].financeLinkId).toBe(fixture.linkId);
    expect(openOnes[0].roiValue).toBe(1800);
    expect(openOnes[0].financeValue).toBe(1000);
    expect(afterProjections[0].lastReconciliationId).toBe(openOnes[0].reconciliationId);

    // NEGATIVE assertions: neither side was overwritten.
    const afterClient = pgClient();
    await afterClient.connect();
    try {
      const snap = await afterClient.query(`SELECT content_hash FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1`, [
        fixture.approvalSnapshotId,
      ]);
      expect(snap.rows[0].content_hash).toBe(approvalHashBefore);

      const link = await afterClient.query(`SELECT pinned_finance_value FROM rvn_roi_finance_links WHERE link_id = $1`, [
        fixture.linkId,
      ]);
      expect(link.rows[0].pinned_finance_value).toBe(pinnedValueBefore);

      const actualSnapshotRow = await afterClient.query(
        `SELECT total_actual_costs FROM rvn_roi_actual_snapshots WHERE actual_snapshot_id = $1`,
        [snapshotOutcome.result.actualSnapshotId]
      );
      expect(Number(actualSnapshotRow.rows[0].total_actual_costs)).toBe(1800);
    } finally {
      await afterClient.end();
    }
  }, 30_000);

  // ==========================================================================
  // Proof 8 — no silent failure
  // ==========================================================================
  it('Proof 8 — a genuine consumer-side exception (finance link vanished before dispatch) propagates to markFailed with the real error message', async () => {
    const { caseId, linkId } = await buildDraftCaseWithLink({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      suffix: 'p8',
      financeArtifactId: `${MARKER}--p8-artifact`,
    });

    const { event } = await fetchLatestEventAndOutbox(ORG_A, caseId, 'roi.finance_link_created', 'finance_projection');

    // Vanish the link row BEFORE dispatch — a deliberately contrived but
    // real code path: handleFinanceLinkCreated's own defensive "not found"
    // throw, never a fabricated unrelated error.
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM rvn_roi_finance_links WHERE link_id = $1`, [linkId]);
    } finally {
      await client.end();
    }

    await runOutboxDispatchTick();

    const readClient = pgClient();
    await readClient.connect();
    try {
      const row = await readClient.query<{ status: string; last_error: string }>(
        `SELECT status, last_error FROM rvn_platform_outbox WHERE event_id = $1 AND consumer_group = 'finance_projection'`,
        [event.event_id]
      );
      expect(row.rows[0].status).toBe('failed');
      expect(row.rows[0].last_error).toContain('rvn_roi_finance_links row not found');
      expect(row.rows[0].last_error).toContain(linkId);
    } finally {
      await readClient.end();
    }
  });

  // ==========================================================================
  // Negative test — never writes to any financial_* table
  // ==========================================================================
  describe('NEGATIVE — never writes to any financial_* table', () => {
    it('grep gate: financeProjectionConsumer.ts source contains zero financial_* references', () => {
      const source = readFileSync(CONSUMER_SOURCE_PATH, 'utf8');
      // Word-boundary lookbehind: a `financial_*` TABLE reference is a
      // standalone identifier/string token starting with "financial_" (e.g.
      // `financial_roi_links`), never a substring inside an unrelated
      // longer identifier like `total_financial_benefits` (a real, legal
      // rvn_roi_forecast_versions/rvn_roi_actual_snapshots COLUMN name this
      // file legitimately reads).
      const matches = source.match(/(?<![a-zA-Z0-9_])financial_[a-zA-Z_]*/g) ?? [];
      expect(matches).toEqual([]);
    });

    it('real-DB companion: every financial_* table is byte-identical before/after a full dispatch tick', async () => {
      const fixture = await buildApprovedCase({
        orgId: ORG_A,
        ownerUserId: OWNER_A,
        approverId: APPROVER_A,
        suffix: 'neg1',
        costAmount: 1000,
        link: {
          financeArtifactType: 'financial_roi_link',
          financeArtifactId: `${MARKER}--neg1-artifact`,
          financeVersionId: 'v1',
          linkPurpose: 'cost_reference',
          trackedMetric: 'totalCosts',
          pinnedFinanceValue: 1000,
        },
      });
      void fixture;

      const client = pgClient();
      await client.connect();
      let tableNames: string[];
      try {
        const tables = await client.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name LIKE 'financial\\_%' ORDER BY table_name`
        );
        tableNames = tables.rows.map((r) => r.table_name);
      } finally {
        await client.end();
      }
      expect(tableNames.length).toBeGreaterThan(0);

      async function snapshot(): Promise<Record<string, { count: number; hash: string }>> {
        const c = pgClient();
        await c.connect();
        try {
          const out: Record<string, { count: number; hash: string }> = {};
          for (const tableName of tableNames) {
            const countRes = await c.query(`SELECT count(*)::int AS c FROM "${tableName}"`);
            const hashRes = await c.query(
              `SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), '')) AS h FROM "${tableName}" t`
            );
            out[tableName] = { count: countRes.rows[0].c, hash: hashRes.rows[0].h };
          }
          return out;
        } finally {
          await c.end();
        }
      }

      const before = await snapshot();
      await runOutboxDispatchTick();
      const after = await snapshot();

      expect(after).toEqual(before);
    }, 30_000);
  });

  // ==========================================================================
  // Negative test — re-delivered event never double-opens a reconciliation
  // ==========================================================================
  it('NEGATIVE — two different events for the same still-diverging link produce exactly one open reconciliation', async () => {
    const fixture = await buildApprovedCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      approverId: APPROVER_A,
      suffix: 'neg2',
      costAmount: 1000,
      link: {
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: `${MARKER}--neg2-artifact`,
        financeVersionId: 'v1',
        linkPurpose: 'cost_reference',
        trackedMetric: 'totalCosts',
        pinnedFinanceValue: 1000, // will diverge from BOTH the forecast and the actual below
      },
    });
    let rowVersion = await startTracking({
      orgId: ORG_A,
      caseId: fixture.caseId,
      ownerUserId: OWNER_A,
      expectedVersion: fixture.rowVersion,
    });
    await runOutboxDispatchTick(); // baseline: tracking_started + finance_link_created/case_approved already handled by earlier ticks in this case's own history

    // Event 1: forecast_published, overridden cost total 1500 (!= 1000).
    const forecastOutcome = await createRoiForecastVersion({
      caseId: fixture.caseId,
      organizationId: ORG_A,
      expectedVersion: rowVersion,
      reason: 'RN-G6 negative-test forecast',
      overrides: [{ targetType: 'cost_line', targetId: fixture.costLineId, overrideAmount: 1500 }],
      actorUserId: OWNER_A,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--neg2--forecast-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    rowVersion = forecastOutcome.resultingVersion;
    expect(forecastOutcome.result.totalCosts).toBe(1500);

    await runOutboxDispatchTick();

    const afterForecastClient = pgClient();
    await afterForecastClient.connect();
    let reconciliationIdAfterForecast: string;
    try {
      const rows = await afterForecastClient.query(
        `SELECT reconciliation_id, status FROM rvn_roi_finance_reconciliations
          WHERE finance_link_id = $1 AND status IN ('open','investigating')`,
        [fixture.linkId]
      );
      expect(rows.rows).toHaveLength(1);
      reconciliationIdAfterForecast = rows.rows[0].reconciliation_id;
    } finally {
      await afterForecastClient.end();
    }

    // Sub-case (a): literal redelivery of the SAME forecast_published event.
    const { event: forecastEvent, outboxRow: forecastOutboxRow } = await fetchLatestEventAndOutbox(
      ORG_A,
      fixture.caseId,
      'roi.forecast_published',
      'finance_projection'
    );
    await withTransaction(acquirePgClient, (client) => dispatchFinanceProjection(client, forecastEvent, forecastOutboxRow));

    const afterRedeliveryClient = pgClient();
    await afterRedeliveryClient.connect();
    try {
      const rows = await afterRedeliveryClient.query(
        `SELECT reconciliation_id FROM rvn_roi_finance_reconciliations
          WHERE finance_link_id = $1 AND status IN ('open','investigating')`,
        [fixture.linkId]
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].reconciliation_id).toBe(reconciliationIdAfterForecast);
    } finally {
      await afterRedeliveryClient.end();
    }

    // Sub-case (b): a DIFFERENT event (actual_snapshot_published, totalActualCosts
    // 1800 — different figure than the forecast's 1500, still != pinned 1000)
    // for the SAME still-diverging link.
    const actualEntry = await recordActualEntry({
      caseId: fixture.caseId,
      organizationId: ORG_A,
      entryType: 'cost',
      costLineId: fixture.costLineId,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: 1800,
      currency: 'USD',
      source: 'invoice-neg2',
      recordedBy: OWNER_A,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--neg2--actual-entry-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    void actualEntry;
    const actualOutcome = await publishRoiActualSnapshot({
      caseId: fixture.caseId,
      organizationId: ORG_A,
      expectedVersion: rowVersion,
      asOfPeriodEnd: '2026-01-31',
      publishedBy: OWNER_A,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `${MARKER}--neg2--actual-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    expect(actualOutcome.result.totalActualCosts).toBe(1800);

    await runOutboxDispatchTick();

    const finalClient = pgClient();
    await finalClient.connect();
    try {
      const rows = await finalClient.query(
        `SELECT reconciliation_id, status FROM rvn_roi_finance_reconciliations
          WHERE finance_link_id = $1 AND status IN ('open','investigating')`,
        [fixture.linkId]
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].reconciliation_id).toBe(reconciliationIdAfterForecast);

      // The projection's own lineage DID move on to the actual snapshot
      // (roi_value tracks the latest figure), while the reconciliation stays
      // the SAME single still-open case.
      const projection = await finalClient.query(
        `SELECT roi_value, source_kind FROM rvn_roi_finance_projections WHERE finance_link_id = $1`,
        [fixture.linkId]
      );
      expect(Number(projection.rows[0].roi_value)).toBe(1800);
      expect(projection.rows[0].source_kind).toBe('actual_snapshot');
    } finally {
      await finalClient.end();
    }
  }, 30_000);
});
