import { assertGateQuorumReceipt } from './gateSignoff.js';
import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { PortfolioConsultingAnalysis } from './portfolioConsultingAnalysis.js';
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
  portfolioDisposition?: PortfolioDisposition;
}
export type PortfolioDispositionKind = 'IN' | 'PARKING' | 'ARCHIVE';
export interface PortfolioDisposition {
  kind: PortfolioDispositionKind;
  reason: string;
  returnCondition: string | null;
  actorId: string;
  decidedAt: string;
  inputSnapshot: {
    analysisId: string;
    analysisVersion: number;
    itemId: string;
    asOf: string;
  };
  frozenInput: {
    snapshotVersion: number;
    asOf: string;
    initiative: PortfolioConsultingAnalysis['snapshot']['initiatives'][number];
    item: PortfolioConsultingAnalysis['items'][number];
  };
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
  disposition?: PortfolioDisposition;
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
      relationType: 'INITIATIVE_PORTFOLIO_DECISION',
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
    disposition?: Omit<PortfolioDisposition, 'actorId' | 'decidedAt' | 'frozenInput'>;
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
  const requestedDisposition = envelope.payload.disposition;
  if (requestedDisposition) {
    if (
      !requestedDisposition.reason.trim() ||
      !requestedDisposition.inputSnapshot.analysisId.trim() ||
      !requestedDisposition.inputSnapshot.itemId.trim() ||
      !Number.isInteger(requestedDisposition.inputSnapshot.analysisVersion) ||
      requestedDisposition.inputSnapshot.analysisVersion < 1 ||
      !Number.isFinite(Date.parse(requestedDisposition.inputSnapshot.asOf))
    )
      throw new MaterialCommandValidationError(
        'Complete Portfolio disposition evidence is required'
      );
    if (
      (requestedDisposition.kind === 'PARKING' || requestedDisposition.kind === 'ARCHIVE') &&
      !requestedDisposition.returnCondition?.trim()
    )
      throw new MaterialCommandValidationError(
        'Parking and archive dispositions require a return condition'
      );
    if (
      (envelope.payload.outcome === 'APPROVED' ||
        envelope.payload.outcome === 'CONDITIONALLY_APPROVED') !==
      (requestedDisposition.kind === 'IN')
    )
      throw new MaterialCommandValidationError(
        'Portfolio disposition must match the human decision outcome'
      );
  }
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
    let dispositionSource:
      | {
          analysis: PortfolioConsultingAnalysis;
          item: PortfolioConsultingAnalysis['items'][number];
          initiative: PortfolioConsultingAnalysis['snapshot']['initiatives'][number];
        }
      | undefined;
    if (requestedDisposition) {
      const analysisRow = await tx.getRelatedAggregateForUpdate<PortfolioConsultingAnalysis>(
        envelope.organizationId,
        'portfolio_analysis',
        requestedDisposition.inputSnapshot.analysisId
      );
      const sourceItem = (
        Array.isArray(analysisRow?.payload.items) ? analysisRow.payload.items : []
      ).find((item) => item.itemId === requestedDisposition.inputSnapshot.itemId);
      const sourceInitiative = (
        Array.isArray(analysisRow?.payload.snapshot?.initiatives)
          ? analysisRow.payload.snapshot.initiatives
          : []
      ).find((item) => item.initiativeId === envelope.aggregateId);
      if (
        !analysisRow ||
        analysisRow.version !== requestedDisposition.inputSnapshot.analysisVersion ||
        analysisRow.payload.snapshot.asOf !== requestedDisposition.inputSnapshot.asOf ||
        analysisRow.payload.status !== 'PENDING_REVIEW' ||
        analysisRow.payload.snapshot.portfolio.scenarioId !== stored.payload.scenarioId ||
        sourceItem?.kind !== 'DECISION' ||
        !sourceInitiative ||
        sourceInitiative.initiativeVersion !== stored.payload.initiativeVersion ||
        !sourceItem.initiativeIds.includes(envelope.aggregateId) ||
        sourceItem.proposedDisposition?.kind !== requestedDisposition.kind
      )
        throw new MaterialCommandValidationError('Exact Portfolio analysis Decision item required');
      dispositionSource = {
        analysis: analysisRow.payload,
        item: sourceItem,
        initiative: sourceInitiative,
      };
    }
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
    const decidedAt = new Date().toISOString();
    const disposition: PortfolioDisposition | undefined =
      requestedDisposition && dispositionSource
        ? {
            ...requestedDisposition,
            reason: requestedDisposition.reason.trim(),
            returnCondition: requestedDisposition.returnCondition?.trim() || null,
            actorId: envelope.actorId,
            decidedAt,
            frozenInput: {
              snapshotVersion: dispositionSource.analysis.snapshot.snapshotVersion,
              asOf: dispositionSource.analysis.snapshot.asOf,
              initiative: dispositionSource.initiative,
              item: dispositionSource.item,
            },
          }
        : undefined;
    const decided: PortfolioDecision = {
      ...stored.payload,
      status: envelope.payload.outcome,
      rationale: envelope.payload.rationale.trim(),
      conditions: envelope.payload.conditions,
      mergeTargetInitiativeId: envelope.payload.mergeTargetInitiativeId,
      decidedAt,
      ...(disposition ? { disposition } : {}),
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
        disposition: disposition ? undefined : approved ? undefined : decided.status,
        ...(disposition ? { portfolioDisposition: disposition } : {}),
      },
      response: decided,
      eventType: `initiative.portfolio-decision.${decided.status.toLowerCase()}`,
      eventPayload: decided,
      auditPayload: decided,
    };
  });
}
