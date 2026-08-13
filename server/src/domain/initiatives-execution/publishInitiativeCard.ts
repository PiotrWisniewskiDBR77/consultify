import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export interface PublishInitiativeCardPayload {
  cardKey: string;
  expectedCardVersion: number;
  applicability: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
  completion: 'EMPTY' | 'IN_PROGRESS' | 'COMPLETE';
  quality: 'UNKNOWN' | 'SUFFICIENT' | 'WARNING' | 'BLOCKER';
  freshness: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
  reviewState: 'NOT_REQUESTED' | 'REQUESTED' | 'CHANGES_REQUESTED' | 'ACCEPTED';
  content: Record<string, unknown>;
  evidenceRefs: string[];
  waiverDecisionId: string | null;
}

export interface InitiativeWithCardRefs {
  initiativeId: string;
  projectId: string;
  lifecycleState: string;
  cardRefs?: Record<string, { cardVersion: number; aggregateVersion: number }>;
  [key: string]: unknown;
}

export interface PublishedInitiativeCard {
  initiativeId: string;
  cardKey: string;
  cardVersion: number;
  aggregateVersion: number;
}

export async function publishInitiativeCard(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<PublishInitiativeCardPayload>
): Promise<MaterialCommandResult<PublishedInitiativeCard>> {
  if (
    envelope.commandType !== 'initiative.card.publish' ||
    envelope.aggregateType !== 'initiative'
  ) {
    throw new MaterialCommandValidationError('Invalid Initiative Card publish target');
  }
  if (envelope.createIfMissing) {
    throw new MaterialCommandValidationError('Card publish cannot create an Initiative');
  }
  if (!envelope.payload.cardKey.trim()) {
    throw new MaterialCommandValidationError('cardKey is required');
  }
  if (
    !Number.isInteger(envelope.payload.expectedCardVersion) ||
    envelope.payload.expectedCardVersion < 0
  ) {
    throw new MaterialCommandValidationError('expectedCardVersion must be non-negative');
  }
  if (
    envelope.payload.applicability === 'NOT_APPLICABLE' &&
    !envelope.payload.waiverDecisionId?.trim()
  ) {
    throw new MaterialCommandValidationError('NOT_APPLICABLE requires waiverDecisionId');
  }
  if (!['NOT_REQUESTED', 'REQUESTED'].includes(envelope.payload.reviewState)) {
    throw new MaterialCommandValidationError(
      'Content publication cannot accept or return its own independent review'
    );
  }

  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    if (!(await transaction.isCanonicalInitiativeCard(envelope.payload.cardKey))) {
      throw new MaterialCommandValidationError('Unknown Initiative card');
    }
    const initiative = await transaction.getAggregatePayload<InitiativeWithCardRefs>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative) throw new MaterialCommandValidationError('Initiative not found');
    const currentCardVersion = await transaction.getInitiativeCardVersionForUpdate(
      envelope.organizationId,
      envelope.aggregateId,
      envelope.payload.cardKey
    );
    if (currentCardVersion !== envelope.payload.expectedCardVersion) {
      throw new MaterialCommandConflictError(
        'Initiative card version conflict',
        envelope.payload.expectedCardVersion,
        currentCardVersion
      );
    }
    const nextCardVersion = currentCardVersion + 1;
    const nextAggregateVersion = envelope.expectedVersion + 1;
    await transaction.publishInitiativeCardVersion({
      organizationId: envelope.organizationId,
      initiativeId: envelope.aggregateId,
      cardKey: envelope.payload.cardKey,
      cardVersion: nextCardVersion,
      aggregateVersion: nextAggregateVersion,
      applicability: envelope.payload.applicability,
      completion: envelope.payload.completion,
      quality: envelope.payload.quality,
      freshness: envelope.payload.freshness,
      reviewState: envelope.payload.reviewState,
      content: envelope.payload.content,
      evidenceRefs: envelope.payload.evidenceRefs,
      waiverDecisionId: envelope.payload.waiverDecisionId,
      publishedBy: envelope.actorId,
    });
    const response: PublishedInitiativeCard = {
      initiativeId: envelope.aggregateId,
      cardKey: envelope.payload.cardKey,
      cardVersion: nextCardVersion,
      aggregateVersion: nextAggregateVersion,
    };
    const mutation: InitiativeWithCardRefs = {
      ...initiative,
      cardRefs: {
        ...(initiative.cardRefs ?? {}),
        [envelope.payload.cardKey]: {
          cardVersion: nextCardVersion,
          aggregateVersion: nextAggregateVersion,
        },
      },
    };
    return {
      mutation,
      response,
      eventType: 'initiative.card.published',
      eventPayload: response,
      auditPayload: {
        cardKey: envelope.payload.cardKey,
        fromCardVersion: currentCardVersion,
        toCardVersion: nextCardVersion,
        evidenceRefs: envelope.payload.evidenceRefs,
      },
    };
  });
}
