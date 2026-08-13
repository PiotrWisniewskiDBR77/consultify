import { assertGateQuorumReceipt } from './gateSignoff.js';
import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { PortfolioScenario } from './portfolioScenario.js';
import type { InitiativeWithCardRefs } from './publishInitiativeCard.js';
type Outcome =
  | 'APPROVED'
  | 'CONDITIONALLY_APPROVED'
  | 'RETURNED'
  | 'DEFERRED'
  | 'REJECTED'
  | 'MERGED';
interface Initiative extends InitiativeWithCardRefs {
  lifecycleState: string;
  portfolioDecisionId?: string;
  disposition?: string;
}
export interface PortfolioDecision {
  decisionId: string;
  initiativeId: string;
  status: 'PENDING' | Outcome;
  requesterId: string;
  authorityId: string;
  scenarioId: string;
  scenarioVersion: number;
  initiativeVersion: number;
  cardVersions: Record<string, number>;
  membershipSnapshot: PortfolioScenario['memberships'][number];
  conditions: string[];
  mergeTargetInitiativeId: string | null;
  rationale: string | null;
  requestedAt: string;
  dueAt: string;
  decidedAt: string | null;
  policy: { policyId: string; policyVersion: number };
}
export async function requestPortfolioDecision(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    decisionId: string;
    authorityId: string;
    scenarioId: string;
    scenarioVersion: number;
    dueAt: string;
    selfApprovalAllowed: boolean;
    governanceQuorumRequired?: boolean;
    governanceQuorumRef?: { quorumId: string; version: number; receiptId: string };
  }>
): Promise<MaterialCommandResult<PortfolioDecision>> {
  if (
    envelope.commandType !== 'initiative.portfolio.request' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Portfolio Decision request');
  if (
    !envelope.payload.authorityId.trim() ||
    (!envelope.payload.selfApprovalAllowed && envelope.payload.authorityId === envelope.actorId)
  )
    throw new MaterialCommandValidationError('Independent Portfolio authority is required');
  if (!Number.isFinite(Date.parse(envelope.payload.dueAt)))
    throw new MaterialCommandValidationError('dueAt must be a valid timestamp');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const initiative = await tx.getAggregatePayload<Initiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'READY_FOR_DECISION')
      throw new MaterialCommandValidationError('Initiative is not READY_FOR_DECISION');
    const scenario = await tx.getRelatedAggregateForUpdate<PortfolioScenario>(
      envelope.organizationId,
      'portfolio_scenario',
      envelope.payload.scenarioId
    );
    if (
      !scenario ||
      scenario.payload.status !== 'PUBLISHED' ||
      scenario.payload.scenarioVersion !== envelope.payload.scenarioVersion
    )
      throw new MaterialCommandValidationError('Exact published Portfolio Scenario not found');
    const member = scenario.payload.memberships.find(
      (m) =>
        m.initiativeId === envelope.aggregateId && m.initiativeVersion === envelope.expectedVersion
    );
    if (!member)
      throw new MaterialCommandValidationError(
        'Initiative snapshot is not a member of the published scenario'
      );
    const d: PortfolioDecision = {
      decisionId: envelope.payload.decisionId,
      initiativeId: envelope.aggregateId,
      status: 'PENDING',
      requesterId: envelope.actorId,
      authorityId: envelope.payload.authorityId,
      scenarioId: scenario.payload.scenarioId,
      scenarioVersion: scenario.payload.scenarioVersion,
      initiativeVersion: envelope.expectedVersion,
      cardVersions: Object.fromEntries(
        Object.entries(initiative.cardRefs ?? {}).map(([k, v]) => [k, v.cardVersion])
      ),
      membershipSnapshot: member,
      conditions: [],
      mergeTargetInitiativeId: null,
      rationale: null,
      requestedAt: new Date().toISOString(),
      dueAt: new Date(envelope.payload.dueAt).toISOString(),
      decidedAt: null,
      policy: { policyId: envelope.policyId, policyVersion: envelope.policyVersion },
    };
    await tx.persistRelatedAggregate(envelope.organizationId, 'decision', d.decisionId, 0, 1, d);
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `INITIATIVE_PORTFOLIO_DECISION:${d.decisionId}`,
      sourceType: 'initiative',
      sourceId: envelope.aggregateId,
      sourceVersion: envelope.expectedVersion,
      targetType: 'decision',
      targetId: d.decisionId,
      payload: { scenarioId: d.scenarioId, scenarioVersion: d.scenarioVersion, status: 'PENDING' },
    });
    return {
      mutation: { ...initiative, portfolioDecisionId: d.decisionId },
      response: d,
      eventType: 'initiative.portfolio-decision.requested',
      eventPayload: d,
      auditPayload: d,
    };
  });
}
export async function decidePortfolio(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    decisionId: string;
    outcome: Outcome;
    rationale: string;
    conditions: string[];
    mergeTargetInitiativeId: string | null;
    selfApprovalAllowed: boolean;
    governanceQuorumRequired?: boolean;
    governanceQuorumRef?: { quorumId: string; version: number; receiptId: string };
  }>
): Promise<MaterialCommandResult<PortfolioDecision>> {
  if (
    envelope.commandType !== 'initiative.portfolio.decide' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Portfolio Decision command');
  if (!envelope.payload.rationale.trim())
    throw new MaterialCommandValidationError('Rationale is required');
  if (envelope.payload.outcome === 'CONDITIONALLY_APPROVED' && !envelope.payload.conditions.length)
    throw new MaterialCommandValidationError('Conditional approval requires conditions');
  if (envelope.payload.outcome === 'MERGED' && !envelope.payload.mergeTargetInitiativeId)
    throw new MaterialCommandValidationError('Merge target is required');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    await assertGateQuorumReceipt(tx, envelope.organizationId, {
      required: envelope.payload.governanceQuorumRequired,
      gate: 'PORTFOLIO',
      decisionId: envelope.payload.decisionId,
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
      quorumRef: envelope.payload.governanceQuorumRef,
    });
    const initiative = await tx.getAggregatePayload<Initiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'READY_FOR_DECISION')
      throw new MaterialCommandValidationError('Initiative is not READY_FOR_DECISION');
    const stored = await tx.getRelatedAggregateForUpdate<PortfolioDecision>(
      envelope.organizationId,
      'decision',
      envelope.payload.decisionId
    );
    if (
      !stored ||
      stored.version !== 1 ||
      stored.payload.status !== 'PENDING' ||
      stored.payload.initiativeId !== envelope.aggregateId
    )
      throw new MaterialCommandValidationError('Pending Portfolio Decision not found');
    if (
      stored.payload.authorityId !== envelope.actorId ||
      (!envelope.payload.selfApprovalAllowed && stored.payload.requesterId === envelope.actorId)
    )
      throw new MaterialCommandValidationError('Named independent Portfolio authority is required');
    const scenario = await tx.getRelatedAggregateForUpdate<PortfolioScenario>(
      envelope.organizationId,
      'portfolio_scenario',
      stored.payload.scenarioId
    );
    if (
      !scenario ||
      scenario.payload.status !== 'PUBLISHED' ||
      scenario.payload.scenarioVersion !== stored.payload.scenarioVersion
    )
      throw new MaterialCommandConflictError(
        'Portfolio Scenario snapshot is stale',
        envelope.expectedVersion,
        envelope.expectedVersion
      );
    const cards = Object.fromEntries(
      Object.entries(initiative.cardRefs ?? {}).map(([k, v]) => [k, v.cardVersion])
    );
    if (
      stored.payload.initiativeVersion !== envelope.expectedVersion - 1 ||
      JSON.stringify(cards) !== JSON.stringify(stored.payload.cardVersions)
    )
      throw new MaterialCommandConflictError(
        'Initiative snapshot is stale',
        envelope.expectedVersion,
        envelope.expectedVersion
      );
    const decided: PortfolioDecision = {
      ...stored.payload,
      status: envelope.payload.outcome,
      rationale: envelope.payload.rationale.trim(),
      conditions: envelope.payload.conditions,
      mergeTargetInitiativeId: envelope.payload.mergeTargetInitiativeId,
      decidedAt: new Date().toISOString(),
    };
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'decision',
      decided.decisionId,
      1,
      2,
      decided
    );
    const approved = decided.status === 'APPROVED' || decided.status === 'CONDITIONALLY_APPROVED';
    return {
      mutation: {
        ...initiative,
        lifecycleState: approved ? 'APPROVED_BACKLOG' : 'READY_FOR_DECISION',
        disposition: approved ? undefined : decided.status,
      },
      response: decided,
      eventType: `initiative.portfolio-decision.${decided.status.toLowerCase()}`,
      eventPayload: decided,
      auditPayload: decided,
    };
  });
}
