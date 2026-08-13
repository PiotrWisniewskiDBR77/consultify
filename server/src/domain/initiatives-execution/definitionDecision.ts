import { evaluateDefinitionReadiness } from './definitionReadiness.js';
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

const DEFINITION_CARDS = [
  'summary-scope',
  'strategic-fit',
  'success-criteria',
  'outcomes-benefits',
  'options',
  'people-team',
  'roles-raci',
  'stakeholders',
] as const;

interface DefinitionInitiative extends InitiativeWithCardRefs {
  lifecycleState: string;
  source?: {
    proposalId?: string;
    proposalVersion?: number;
    sourceType?: string;
    sourceId?: string;
    sourceVersion?: number;
  };
  gateState?: string;
  gateReadiness?: string;
  disposition?: string;
}

export interface DefinitionDecisionCase {
  decisionId: string;
  initiativeId: string;
  gate: 'DEFINITION';
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

export interface RequestDefinitionDecisionPayload {
  decisionId: string;
  authorityId: string;
  dueAt: string;
  selfApprovalAllowed: boolean;
}

export interface DecideDefinitionPayload {
  decisionId: string;
  outcome: 'APPROVED' | 'RETURNED';
  rationale: string;
  selfApprovalAllowed: boolean;
  governanceQuorumRequired?: boolean;
  governanceQuorumRef?: { quorumId: string; version: number; receiptId: string };
}

async function currentReadiness(
  transaction: MaterialCommandTransaction,
  organizationId: string,
  initiativeId: string,
  initiative: DefinitionInitiative
) {
  const cards: InitiativeCardVersionReadModel[] = [];
  for (const cardKey of DEFINITION_CARDS) {
    const card = await transaction.getLatestInitiativeCardForUpdate(
      organizationId,
      initiativeId,
      cardKey
    );
    if (card) {
      cards.push({
        ...card,
        aggregateVersion: initiative.cardRefs?.[cardKey]?.aggregateVersion ?? 0,
        publishedAt: '',
      });
    }
  }
  const source = initiative.source;
  const proposal = source?.proposalId
    ? await transaction.getSourceProposalForUpdate(organizationId, source.proposalId)
    : null;
  const sourceFreshness = !proposal
    ? 'SOURCE_UNAVAILABLE'
    : proposal.evidenceState === 'STALE' ||
        proposal.sourceVersion !== source?.sourceVersion ||
        proposal.version !== source?.proposalVersion
      ? 'STALE'
      : proposal.evidenceState === 'READY'
        ? 'CURRENT'
        : 'SOURCE_UNAVAILABLE';
  return evaluateDefinitionReadiness(
    cards,
    Boolean(source?.sourceType && source.sourceId && Number(source.sourceVersion) > 0),
    sourceFreshness
  );
}

export async function requestDefinitionDecision(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RequestDefinitionDecisionPayload>
): Promise<MaterialCommandResult<DefinitionDecisionCase>> {
  if (
    envelope.commandType !== 'initiative.definition.request' ||
    envelope.aggregateType !== 'initiative'
  ) {
    throw new MaterialCommandValidationError('Invalid Definition Decision request target');
  }
  const authorityId = envelope.payload.authorityId.trim();
  if (!authorityId) throw new MaterialCommandValidationError('authorityId is required');
  if (!envelope.payload.selfApprovalAllowed && authorityId === envelope.actorId) {
    throw new MaterialCommandValidationError('Independent Definition authority is required');
  }
  if (!Number.isFinite(Date.parse(envelope.payload.dueAt))) {
    throw new MaterialCommandValidationError('dueAt must be a valid timestamp');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const initiative = await transaction.getAggregatePayload<DefinitionInitiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'REGISTERED_DRAFT') {
      throw new MaterialCommandValidationError('Initiative is not awaiting Definition');
    }
    const readiness = await currentReadiness(
      transaction,
      envelope.organizationId,
      envelope.aggregateId,
      initiative
    );
    if (readiness.readiness !== 'READY') {
      throw new MaterialCommandValidationError('Definition is not ready for Decision');
    }
    const decision: DefinitionDecisionCase = {
      decisionId: envelope.payload.decisionId,
      initiativeId: envelope.aggregateId,
      gate: 'DEFINITION',
      status: 'PENDING',
      requesterId: envelope.actorId,
      authorityId,
      dueAt: new Date(envelope.payload.dueAt).toISOString(),
      requestedAt: new Date().toISOString(),
      decidedAt: null,
      rationale: null,
      cardVersions: readiness.cardVersions,
      policy: { policyId: envelope.policyId, policyVersion: envelope.policyVersion },
    };
    await transaction.persistRelatedAggregate(
      envelope.organizationId,
      'decision',
      decision.decisionId,
      0,
      1,
      decision
    );
    await transaction.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `INITIATIVE_DEFINITION_DECISION:${decision.decisionId}`,
      sourceType: 'initiative',
      sourceId: envelope.aggregateId,
      sourceVersion: envelope.expectedVersion,
      targetType: 'decision',
      targetId: decision.decisionId,
      payload: { gate: 'DEFINITION', status: 'PENDING' },
    });
    return {
      mutation: {
        ...initiative,
        gateState: 'PENDING_DECISION',
        gateReadiness: 'READY',
        definitionDecisionId: decision.decisionId,
      },
      response: decision,
      eventType: 'initiative.definition.requested',
      eventPayload: decision,
      auditPayload: decision,
    };
  });
}

export async function decideDefinition(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<DecideDefinitionPayload>
): Promise<MaterialCommandResult<DefinitionDecisionCase>> {
  if (
    envelope.commandType !== 'initiative.definition.decide' ||
    envelope.aggregateType !== 'initiative'
  ) {
    throw new MaterialCommandValidationError('Invalid Definition Decision command target');
  }
  const rationale = envelope.payload.rationale.trim();
  if (!rationale) throw new MaterialCommandValidationError('Decision rationale is required');
  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    await assertGateQuorumReceipt(transaction, envelope.organizationId, {
      required: envelope.payload.governanceQuorumRequired,
      gate: 'DEFINITION',
      decisionId: envelope.payload.decisionId,
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
      quorumRef: envelope.payload.governanceQuorumRef,
    });
    const initiative = await transaction.getAggregatePayload<DefinitionInitiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'REGISTERED_DRAFT') {
      throw new MaterialCommandValidationError('Initiative is not awaiting Definition');
    }
    const stored = await transaction.getRelatedAggregateForUpdate<DefinitionDecisionCase>(
      envelope.organizationId,
      'decision',
      envelope.payload.decisionId
    );
    if (!stored || stored.payload.initiativeId !== envelope.aggregateId) {
      throw new MaterialCommandValidationError('Definition Decision not found');
    }
    if (stored.payload.status !== 'PENDING' || stored.version !== 1) {
      throw new MaterialCommandValidationError('Definition Decision is no longer pending');
    }
    if (stored.payload.authorityId !== envelope.actorId) {
      throw new MaterialCommandValidationError('Named Definition authority is required');
    }
    if (!envelope.payload.selfApprovalAllowed && stored.payload.requesterId === envelope.actorId) {
      throw new MaterialCommandValidationError('Self-approval is not permitted');
    }
    const readiness = await currentReadiness(
      transaction,
      envelope.organizationId,
      envelope.aggregateId,
      initiative
    );
    const snapshotChanged = Object.entries(stored.payload.cardVersions).some(
      ([cardKey, version]) => readiness.cardVersions[cardKey] !== version
    );
    if (snapshotChanged) {
      throw new MaterialCommandConflictError(
        'Definition evidence snapshot is stale',
        envelope.expectedVersion,
        envelope.expectedVersion
      );
    }
    if (envelope.payload.outcome === 'APPROVED' && readiness.readiness !== 'READY') {
      throw new MaterialCommandValidationError('Definition is no longer ready');
    }
    const decided: DefinitionDecisionCase = {
      ...stored.payload,
      status: envelope.payload.outcome,
      rationale,
      decidedAt: new Date().toISOString(),
    };
    await transaction.persistRelatedAggregate(
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
          envelope.payload.outcome === 'APPROVED' ? 'DEFINED' : initiative.lifecycleState,
        gateState: envelope.payload.outcome === 'APPROVED' ? 'APPROVED' : 'RETURNED',
        gateReadiness: readiness.readiness,
      },
      response: decided,
      eventType:
        envelope.payload.outcome === 'APPROVED'
          ? 'initiative.definition.approved'
          : 'initiative.definition.returned',
      eventPayload: decided,
      auditPayload: decided,
    };
  });
}
