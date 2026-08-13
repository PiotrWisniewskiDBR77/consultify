import type { CapacityScenario } from './capacityScenario.js';
import { assertGateQuorumReceipt } from './gateSignoff.js';
import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { PlanScenario } from './planScenario.js';
import type { PortfolioScenario } from './portfolioScenario.js';
import type { InitiativeWithCardRefs } from './publishInitiativeCard.js';
import type { ResourceCommitment } from './resourceCommitment.js';
type Outcome = 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'RETURNED' | 'HELD';
interface Initiative extends InitiativeWithCardRefs {
  lifecycleState: string;
  projectId: string;
  scheduleDecisionId?: string;
  handoffPackageId?: string;
}
export interface HandoffSnapshot {
  scope: Record<string, unknown>;
  selectedOptions: Record<string, unknown>;
  success: Record<string, unknown>;
  baseline: Record<string, unknown>;
  openWork: Array<Record<string, unknown>>;
  raid: Array<Record<string, unknown>>;
  outcomeRefs: string[];
  sourceVersions: Record<string, number>;
}
export interface ScheduleDecisionCase {
  decisionId: string;
  initiativeId: string;
  status: 'PENDING' | Outcome;
  requesterId: string;
  authorityId: string;
  executionManagerId: string;
  initiativeVersion: number;
  cardVersions: Record<string, number>;
  portfolio: { id: string; version: number };
  plan: {
    id: string;
    version: number;
    windowUnit: string;
    timezone: string;
    window: { earliest: string | null; target: string | null; latest: string | null };
  };
  capacity: { id: string; version: number };
  commitmentVersions: Record<string, number>;
  criticalPeriodIds: string[];
  criticalDependencies: Array<{
    dependencyId: string;
    state: 'RESOLVED' | 'UNRESOLVED';
    critical: boolean;
  }>;
  handoff: HandoffSnapshot;
  conditions: string[];
  rationale: string | null;
  requestedAt: string;
  dueAt: string;
  decidedAt: string | null;
}
interface RequestPayload {
  decisionId: string;
  authorityId: string;
  executionManagerId: string;
  dueAt: string;
  portfolioScenarioId: string;
  portfolioScenarioVersion: number;
  planScenarioId: string;
  planScenarioVersion: number;
  capacityScenarioId: string;
  capacityScenarioVersion: number;
  commitmentIds: string[];
  criticalPeriodIds: string[];
  criticalDependencies: ScheduleDecisionCase['criticalDependencies'];
  handoff: HandoffSnapshot;
  selfApprovalAllowed: boolean;
}
export function criticalCapacityReady(capacity: CapacityScenario, periodIds: string[]) {
  return periodIds.every((id) => {
    const period = capacity.periods.find((candidate) => candidate.periodId === id);
    return Boolean(
      period &&
      !['UNKNOWN', 'UNCONFIRMED'].includes(period.supply.knowledgeState) &&
      period.supply.base !== null
    );
  });
}
async function sources(
  tx: MaterialCommandTransaction,
  org: string,
  id: string,
  initiative: Initiative,
  p: RequestPayload
) {
  const portfolio = await tx.getRelatedAggregateForUpdate<PortfolioScenario>(
    org,
    'portfolio_scenario',
    p.portfolioScenarioId
  );
  const plan = await tx.getRelatedAggregateForUpdate<PlanScenario>(
    org,
    'plan_scenario',
    p.planScenarioId
  );
  const capacity = await tx.getRelatedAggregateForUpdate<CapacityScenario>(
    org,
    'capacity_scenario',
    p.capacityScenarioId
  );
  if (
    !portfolio ||
    portfolio.payload.status !== 'PUBLISHED' ||
    portfolio.payload.scenarioVersion !== p.portfolioScenarioVersion
  )
    throw new MaterialCommandValidationError(
      'Exact published Portfolio Scenario is stale or missing'
    );
  if (
    !plan ||
    plan.payload.status !== 'PUBLISHED' ||
    plan.payload.scenarioVersion !== p.planScenarioVersion ||
    plan.payload.portfolioScenarioId !== p.portfolioScenarioId ||
    plan.payload.portfolioScenarioVersion !== p.portfolioScenarioVersion
  )
    throw new MaterialCommandValidationError(
      'Exact published Plan Scenario is stale or mismatched'
    );
  if (
    !capacity ||
    capacity.payload.status !== 'PUBLISHED' ||
    capacity.payload.scenarioVersion !== p.capacityScenarioVersion ||
    capacity.payload.planScenarioId !== p.planScenarioId ||
    capacity.payload.planScenarioVersion !== p.planScenarioVersion
  )
    throw new MaterialCommandValidationError(
      'Exact published Capacity Scenario is stale or mismatched'
    );
  const window = plan.payload.windows.find(
    (w) => w.initiativeId === id && w.initiativeVersion === p.handoff.sourceVersions.initiative
  );
  if (!window)
    throw new MaterialCommandValidationError('Exact Initiative planned window is missing');
  const planBasis = plan.payload as PlanScenario & { windowUnit?: string; timezone?: string };
  if (
    planBasis.windowUnit !== capacity.payload.windowUnit ||
    planBasis.timezone !== capacity.payload.timezone
  )
    throw new MaterialCommandValidationError('Plan and Capacity window unit/timezone mismatch');
  if (!criticalCapacityReady(capacity.payload, p.criticalPeriodIds))
    throw new MaterialCommandValidationError('Critical capacity is UNKNOWN or UNCONFIRMED');
  if (p.criticalDependencies.some((d) => d.critical && d.state !== 'RESOLVED'))
    throw new MaterialCommandValidationError('Critical dependency is unresolved');
  const commitmentVersions: Record<string, number> = {};
  for (const commitmentId of p.commitmentIds) {
    const c = await tx.getRelatedAggregateForUpdate<ResourceCommitment>(
      org,
      'resource_commitment',
      commitmentId
    );
    if (
      !c ||
      !['CONFIRMED', 'CONDITIONALLY_CONFIRMED'].includes(c.payload.status) ||
      c.payload.initiativeId !== id ||
      c.payload.capacityScenarioId !== p.capacityScenarioId ||
      c.payload.capacityScenarioVersion !== p.capacityScenarioVersion
    )
      throw new MaterialCommandValidationError('Critical assignment is not accepted and confirmed');
    commitmentVersions[commitmentId] = c.version;
  }
  return {
    portfolio: portfolio.payload,
    plan: plan.payload,
    capacity: capacity.payload,
    window,
    commitmentVersions,
  };
}
export async function requestScheduleDecision(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RequestPayload>
): Promise<MaterialCommandResult<ScheduleDecisionCase>> {
  if (
    envelope.commandType !== 'initiative.schedule.request' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Schedule Decision request');
  if (
    !envelope.payload.executionManagerId.trim() ||
    !envelope.payload.authorityId.trim() ||
    (!envelope.payload.selfApprovalAllowed && envelope.payload.authorityId === envelope.actorId)
  )
    throw new MaterialCommandValidationError(
      'Execution Manager and independent Schedule authority are required'
    );
  if (!Number.isFinite(Date.parse(envelope.payload.dueAt)))
    throw new MaterialCommandValidationError('dueAt must be a valid timestamp');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const i = await tx.getAggregatePayload<Initiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!i || i.lifecycleState !== 'APPROVED_BACKLOG')
      throw new MaterialCommandValidationError('Initiative is not APPROVED_BACKLOG');
    if (envelope.payload.handoff.sourceVersions.initiative !== envelope.expectedVersion)
      throw new MaterialCommandValidationError('Handoff Initiative version mismatch');
    const s = await sources(tx, envelope.organizationId, envelope.aggregateId, i, envelope.payload);
    const d: ScheduleDecisionCase = {
      decisionId: envelope.payload.decisionId,
      initiativeId: envelope.aggregateId,
      status: 'PENDING',
      requesterId: envelope.actorId,
      authorityId: envelope.payload.authorityId,
      executionManagerId: envelope.payload.executionManagerId,
      initiativeVersion: envelope.expectedVersion,
      cardVersions: Object.fromEntries(
        Object.entries(i.cardRefs ?? {}).map(([k, v]) => [k, v.cardVersion])
      ),
      portfolio: { id: s.portfolio.scenarioId, version: s.portfolio.scenarioVersion },
      plan: {
        id: s.plan.scenarioId,
        version: s.plan.scenarioVersion,
        windowUnit: s.capacity.windowUnit,
        timezone: s.capacity.timezone,
        window: { earliest: s.window.earliest, target: s.window.target, latest: s.window.latest },
      },
      capacity: { id: s.capacity.scenarioId, version: s.capacity.scenarioVersion },
      commitmentVersions: s.commitmentVersions,
      criticalPeriodIds: envelope.payload.criticalPeriodIds,
      criticalDependencies: envelope.payload.criticalDependencies,
      handoff: envelope.payload.handoff,
      conditions: [],
      rationale: null,
      requestedAt: new Date().toISOString(),
      dueAt: new Date(envelope.payload.dueAt).toISOString(),
      decidedAt: null,
    };
    await tx.persistRelatedAggregate(envelope.organizationId, 'decision', d.decisionId, 0, 1, d);
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `INITIATIVE_SCHEDULE_DECISION:${d.decisionId}`,
      sourceType: 'initiative',
      sourceId: envelope.aggregateId,
      sourceVersion: envelope.expectedVersion,
      targetType: 'decision',
      targetId: d.decisionId,
      payload: { status: 'PENDING' },
    });
    return {
      mutation: { ...i, scheduleDecisionId: d.decisionId },
      response: d,
      eventType: 'initiative.schedule.requested',
      eventPayload: d,
      auditPayload: d,
    };
  });
}
export async function decideSchedule(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    decisionId: string;
    outcome: Outcome;
    rationale: string;
    conditions: string[];
    selfApprovalAllowed: boolean;
    governanceQuorumRequired?: boolean;
    governanceQuorumRef?: { quorumId: string; version: number; receiptId: string };
  }>
): Promise<MaterialCommandResult<ScheduleDecisionCase & { handoffPackageId: string | null }>> {
  if (
    envelope.commandType !== 'initiative.schedule.decide' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Schedule Decision command');
  if (
    !envelope.payload.rationale.trim() ||
    (envelope.payload.outcome === 'CONDITIONALLY_APPROVED' && !envelope.payload.conditions.length)
  )
    throw new MaterialCommandValidationError('Rationale and conditional conditions are required');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    await assertGateQuorumReceipt(tx, envelope.organizationId, {
      required: envelope.payload.governanceQuorumRequired,
      gate: 'SCHEDULE',
      decisionId: envelope.payload.decisionId,
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
      quorumRef: envelope.payload.governanceQuorumRef,
    });
    const i = await tx.getAggregatePayload<Initiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!i || i.lifecycleState !== 'APPROVED_BACKLOG')
      throw new MaterialCommandValidationError('Initiative is not APPROVED_BACKLOG');
    const stored = await tx.getRelatedAggregateForUpdate<ScheduleDecisionCase>(
      envelope.organizationId,
      'decision',
      envelope.payload.decisionId
    );
    if (
      !stored ||
      stored.version !== 1 ||
      stored.payload.status !== 'PENDING' ||
      stored.payload.authorityId !== envelope.actorId ||
      (!envelope.payload.selfApprovalAllowed && stored.payload.requesterId === envelope.actorId)
    )
      throw new MaterialCommandValidationError(
        'Named independent pending Schedule Decision is required'
      );
    const cardVersions = Object.fromEntries(
      Object.entries(i.cardRefs ?? {}).map(([k, v]) => [k, v.cardVersion])
    );
    if (
      stored.payload.initiativeVersion !== envelope.expectedVersion - 1 ||
      JSON.stringify(cardVersions) !== JSON.stringify(stored.payload.cardVersions)
    )
      throw new MaterialCommandConflictError(
        'Initiative/card snapshot is stale',
        envelope.expectedVersion,
        envelope.expectedVersion
      );
    const p: RequestPayload = {
      decisionId: stored.payload.decisionId,
      authorityId: stored.payload.authorityId,
      executionManagerId: stored.payload.executionManagerId,
      dueAt: stored.payload.dueAt,
      portfolioScenarioId: stored.payload.portfolio.id,
      portfolioScenarioVersion: stored.payload.portfolio.version,
      planScenarioId: stored.payload.plan.id,
      planScenarioVersion: stored.payload.plan.version,
      capacityScenarioId: stored.payload.capacity.id,
      capacityScenarioVersion: stored.payload.capacity.version,
      commitmentIds: Object.keys(stored.payload.commitmentVersions),
      criticalPeriodIds: stored.payload.criticalPeriodIds,
      criticalDependencies: stored.payload.criticalDependencies,
      handoff: stored.payload.handoff,
      selfApprovalAllowed: envelope.payload.selfApprovalAllowed,
    };
    const refreshed = await sources(tx, envelope.organizationId, envelope.aggregateId, i, p);
    if (
      JSON.stringify(refreshed.commitmentVersions) !==
      JSON.stringify(stored.payload.commitmentVersions)
    )
      throw new MaterialCommandConflictError(
        'Resource commitment snapshot is stale',
        envelope.expectedVersion,
        envelope.expectedVersion
      );
    const approved = ['APPROVED', 'CONDITIONALLY_APPROVED'].includes(envelope.payload.outcome);
    const handoffPackageId = approved
      ? `handoff:${envelope.aggregateId}:v${envelope.expectedVersion + 1}`
      : null;
    if (handoffPackageId) {
      const pack = {
        handoffPackageId,
        version: 1,
        initiativeId: envelope.aggregateId,
        decisionId: stored.payload.decisionId,
        executionManagerId: stored.payload.executionManagerId,
        snapshot: stored.payload.handoff,
        portfolio: stored.payload.portfolio,
        plan: stored.payload.plan,
        capacity: stored.payload.capacity,
        commitmentVersions: stored.payload.commitmentVersions,
        createdAt: new Date().toISOString(),
      };
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'handoff_package',
        handoffPackageId,
        0,
        1,
        pack
      );
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `INITIATIVE_HANDOFF_PACKAGE:${handoffPackageId}`,
        sourceType: 'initiative',
        sourceId: envelope.aggregateId,
        sourceVersion: envelope.expectedVersion,
        targetType: 'handoff_package',
        targetId: handoffPackageId,
        payload: { version: 1 },
      });
    }
    const decided = {
      ...stored.payload,
      status: envelope.payload.outcome,
      rationale: envelope.payload.rationale,
      conditions: envelope.payload.conditions,
      decidedAt: new Date().toISOString(),
      handoffPackageId,
    };
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'decision',
      stored.payload.decisionId,
      1,
      2,
      decided
    );
    return {
      mutation: {
        ...i,
        lifecycleState: approved ? 'SCHEDULED' : 'APPROVED_BACKLOG',
        handoffPackageId: handoffPackageId ?? i.handoffPackageId,
      },
      response: decided,
      eventType: `initiative.schedule.${envelope.payload.outcome.toLowerCase()}`,
      eventPayload: decided,
      auditPayload: decided,
    };
  });
}
