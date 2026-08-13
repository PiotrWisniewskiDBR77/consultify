import { ANALYSIS_CARD_KEYS, evaluateAnalysisReadiness } from './analysisReadiness.js';
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
import type { InitiativeCardVersionReadModel } from './postgresInitiativeReader.js';
import type { InitiativeWithCardRefs } from './publishInitiativeCard.js';

interface AnalysisInitiative extends InitiativeWithCardRefs {
  lifecycleState: string;
  analysisDecisionId?: string;
  gateState?: string;
  gateReadiness?: string;
}
export interface AnalysisDecisionCase {
  decisionId: string;
  initiativeId: string;
  gate: 'ANALYSIS';
  status: 'PENDING' | 'APPROVED' | 'RETURNED';
  requesterId: string;
  authorityId: string;
  dueAt: string;
  requestedAt: string;
  decidedAt: string | null;
  rationale: string | null;
  cardVersions: Record<string, number>;
  policy: { policyId: string; policyVersion: number };
}

async function readiness(
  tx: MaterialCommandTransaction,
  org: string,
  id: string,
  initiative: AnalysisInitiative
) {
  const cards: InitiativeCardVersionReadModel[] = [];
  for (const key of ANALYSIS_CARD_KEYS) {
    const card = await tx.getLatestInitiativeCardForUpdate(org, id, key);
    if (card)
      cards.push({
        ...card,
        aggregateVersion: initiative.cardRefs?.[key]?.aggregateVersion ?? 0,
        publishedAt: '',
      });
  }
  return evaluateAnalysisReadiness(cards);
}

export async function startAnalysis(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Record<string, never>>
): Promise<MaterialCommandResult<{ initiativeId: string; lifecycleState: 'ANALYZING' }>> {
  if (
    envelope.commandType !== 'initiative.analysis.start' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Analysis start target');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const initiative = await tx.getAggregatePayload<AnalysisInitiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'DEFINED')
      throw new MaterialCommandValidationError('Only a DEFINED Initiative can start Analysis');
    const response = { initiativeId: envelope.aggregateId, lifecycleState: 'ANALYZING' as const };
    return {
      mutation: {
        ...initiative,
        lifecycleState: 'ANALYZING',
        gateState: 'PREPARING',
        gateReadiness: 'NOT_READY',
      },
      response,
      eventType: 'initiative.analysis.started',
      eventPayload: response,
      auditPayload: response,
    };
  });
}

export async function requestAnalysisDecision(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    decisionId: string;
    authorityId: string;
    dueAt: string;
    selfApprovalAllowed: boolean;
    governanceQuorumRequired?: boolean;
    governanceQuorumRef?: { quorumId: string; version: number; receiptId: string };
  }>
): Promise<MaterialCommandResult<AnalysisDecisionCase>> {
  if (
    envelope.commandType !== 'initiative.analysis.request' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Analysis Decision request target');
  const authorityId = envelope.payload.authorityId.trim();
  if (!authorityId) throw new MaterialCommandValidationError('authorityId is required');
  if (!envelope.payload.selfApprovalAllowed && authorityId === envelope.actorId)
    throw new MaterialCommandValidationError('Independent Analysis authority is required');
  if (!Number.isFinite(Date.parse(envelope.payload.dueAt)))
    throw new MaterialCommandValidationError('dueAt must be a valid timestamp');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const initiative = await tx.getAggregatePayload<AnalysisInitiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'ANALYZING')
      throw new MaterialCommandValidationError('Initiative is not ANALYZING');
    const r = await readiness(tx, envelope.organizationId, envelope.aggregateId, initiative);
    if (r.readiness !== 'READY')
      throw new MaterialCommandValidationError('Analysis is not ready for Decision');
    const decision: AnalysisDecisionCase = {
      decisionId: envelope.payload.decisionId,
      initiativeId: envelope.aggregateId,
      gate: 'ANALYSIS',
      status: 'PENDING',
      requesterId: envelope.actorId,
      authorityId,
      dueAt: new Date(envelope.payload.dueAt).toISOString(),
      requestedAt: new Date().toISOString(),
      decidedAt: null,
      rationale: null,
      cardVersions: r.cardVersions,
      policy: { policyId: envelope.policyId, policyVersion: envelope.policyVersion },
    };
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'decision',
      decision.decisionId,
      0,
      1,
      decision
    );
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `INITIATIVE_ANALYSIS_DECISION:${decision.decisionId}`,
      sourceType: 'initiative',
      sourceId: envelope.aggregateId,
      sourceVersion: envelope.expectedVersion,
      targetType: 'decision',
      targetId: decision.decisionId,
      payload: { gate: 'ANALYSIS', status: 'PENDING' },
    });
    return {
      mutation: {
        ...initiative,
        analysisDecisionId: decision.decisionId,
        gateState: 'PENDING_DECISION',
        gateReadiness: 'READY',
      },
      response: decision,
      eventType: 'initiative.analysis.requested',
      eventPayload: decision,
      auditPayload: decision,
    };
  });
}

export async function decideAnalysis(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    decisionId: string;
    outcome: 'APPROVED' | 'RETURNED';
    rationale: string;
    selfApprovalAllowed: boolean;
    governanceQuorumRequired?: boolean;
    governanceQuorumRef?: { quorumId: string; version: number; receiptId: string };
  }>
): Promise<MaterialCommandResult<AnalysisDecisionCase>> {
  if (
    envelope.commandType !== 'initiative.analysis.decide' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Analysis Decision command target');
  if (!envelope.payload.rationale.trim())
    throw new MaterialCommandValidationError('Decision rationale is required');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    await assertGateQuorumReceipt(tx, envelope.organizationId, {
      required: envelope.payload.governanceQuorumRequired,
      gate: 'ANALYSIS',
      decisionId: envelope.payload.decisionId,
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
      quorumRef: envelope.payload.governanceQuorumRef,
    });
    const initiative = await tx.getAggregatePayload<AnalysisInitiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'ANALYZING')
      throw new MaterialCommandValidationError('Initiative is not ANALYZING');
    const stored = await tx.getRelatedAggregateForUpdate<AnalysisDecisionCase>(
      envelope.organizationId,
      'decision',
      envelope.payload.decisionId
    );
    if (
      !stored ||
      stored.payload.initiativeId !== envelope.aggregateId ||
      stored.payload.gate !== 'ANALYSIS'
    )
      throw new MaterialCommandValidationError('Analysis Decision not found');
    if (stored.version !== 1 || stored.payload.status !== 'PENDING')
      throw new MaterialCommandValidationError('Analysis Decision is no longer pending');
    if (stored.payload.authorityId !== envelope.actorId)
      throw new MaterialCommandValidationError('Named Analysis authority is required');
    if (!envelope.payload.selfApprovalAllowed && stored.payload.requesterId === envelope.actorId)
      throw new MaterialCommandValidationError('Self-approval is not permitted');
    const r = await readiness(tx, envelope.organizationId, envelope.aggregateId, initiative);
    if (Object.entries(stored.payload.cardVersions).some(([k, v]) => r.cardVersions[k] !== v))
      throw new MaterialCommandConflictError(
        'Analysis evidence snapshot is stale',
        envelope.expectedVersion,
        envelope.expectedVersion
      );
    if (envelope.payload.outcome === 'APPROVED' && r.readiness !== 'READY')
      throw new MaterialCommandValidationError('Analysis is no longer ready');
    const decided = {
      ...stored.payload,
      status: envelope.payload.outcome,
      rationale: envelope.payload.rationale.trim(),
      decidedAt: new Date().toISOString(),
    };
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'decision',
      envelope.payload.decisionId,
      1,
      2,
      decided
    );
    return {
      mutation: {
        ...initiative,
        lifecycleState:
          envelope.payload.outcome === 'APPROVED' ? 'READY_FOR_DECISION' : 'ANALYZING',
        gateState: envelope.payload.outcome === 'APPROVED' ? 'APPROVED' : 'RETURNED',
        gateReadiness: r.readiness,
      },
      response: decided,
      eventType:
        envelope.payload.outcome === 'APPROVED'
          ? 'initiative.analysis.approved'
          : 'initiative.analysis.returned',
      eventPayload: decided,
      auditPayload: decided,
    };
  });
}
