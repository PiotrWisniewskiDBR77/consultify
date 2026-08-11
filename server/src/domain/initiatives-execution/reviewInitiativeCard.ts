import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { InitiativeWithCardRefs } from './publishInitiativeCard.js';

export interface ReviewInitiativeCardPayload {
  cardKey: string;
  expectedCardVersion: number;
  outcome: 'CHANGES_REQUESTED' | 'ACCEPTED';
  rationale: string;
  selfApprovalAllowed: boolean;
}

export interface ReviewedInitiativeCard {
  initiativeId: string;
  cardKey: string;
  cardVersion: number;
  aggregateVersion: number;
  outcome: ReviewInitiativeCardPayload['outcome'];
  decisionId: string;
}

export async function reviewInitiativeCard(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ReviewInitiativeCardPayload>
): Promise<MaterialCommandResult<ReviewedInitiativeCard>> {
  if (
    envelope.commandType !== 'initiative.card.review' ||
    envelope.aggregateType !== 'initiative'
  ) {
    throw new MaterialCommandValidationError('Invalid Initiative Card review target');
  }
  const rationale = envelope.payload.rationale.trim();
  if (!rationale) throw new MaterialCommandValidationError('Review rationale is required');
  if (
    !Number.isInteger(envelope.payload.expectedCardVersion) ||
    envelope.payload.expectedCardVersion < 1
  ) {
    throw new MaterialCommandValidationError('expectedCardVersion must be positive');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const initiative = await transaction.getAggregatePayload<InitiativeWithCardRefs>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative) throw new MaterialCommandValidationError('Initiative not found');
    const current = await transaction.getLatestInitiativeCardForUpdate(
      envelope.organizationId,
      envelope.aggregateId,
      envelope.payload.cardKey
    );
    if (!current) throw new MaterialCommandValidationError('Published Initiative card not found');
    if (current.cardVersion !== envelope.payload.expectedCardVersion) {
      throw new MaterialCommandConflictError(
        'Initiative card version conflict',
        envelope.payload.expectedCardVersion,
        current.cardVersion
      );
    }
    if (!envelope.payload.selfApprovalAllowed && current.publishedBy === envelope.actorId) {
      throw new MaterialCommandValidationError('Independent reviewer is required');
    }
    if (!['REQUESTED', 'CHANGES_REQUESTED'].includes(current.reviewState)) {
      throw new MaterialCommandValidationError('Card is not awaiting review');
    }
    const nextCardVersion = current.cardVersion + 1;
    const nextAggregateVersion = envelope.expectedVersion + 1;
    const decisionId = `card-review:${envelope.aggregateId}:${envelope.payload.cardKey}:${nextCardVersion}`;
    await transaction.reviewInitiativeCardVersion({
      organizationId: envelope.organizationId,
      initiativeId: envelope.aggregateId,
      cardKey: envelope.payload.cardKey,
      fromCardVersion: current.cardVersion,
      toCardVersion: nextCardVersion,
      aggregateVersion: nextAggregateVersion,
      reviewState: envelope.payload.outcome,
      decisionId,
      reviewedBy: envelope.actorId,
      rationale,
    });
    const response: ReviewedInitiativeCard = {
      initiativeId: envelope.aggregateId,
      cardKey: envelope.payload.cardKey,
      cardVersion: nextCardVersion,
      aggregateVersion: nextAggregateVersion,
      outcome: envelope.payload.outcome,
      decisionId,
    };
    return {
      mutation: {
        ...initiative,
        cardRefs: {
          ...(initiative.cardRefs ?? {}),
          [envelope.payload.cardKey]: {
            cardVersion: nextCardVersion,
            aggregateVersion: nextAggregateVersion,
          },
        },
      },
      response,
      eventType: 'initiative.card.reviewed',
      eventPayload: response,
      auditPayload: {
        ...response,
        rationale,
        selfApprovalAllowed: envelope.payload.selfApprovalAllowed,
      },
    };
  });
}
