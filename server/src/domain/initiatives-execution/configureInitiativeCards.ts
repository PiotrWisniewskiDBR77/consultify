import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { InitiativeWithCardRefs } from './publishInitiativeCard.js';

export interface InitiativeCardSelectionItem {
  cardKey: string;
  included: boolean;
  position: number;
  requiredness: 'REQUIRED' | 'OPTIONAL';
  waiverDecisionId: string | null;
}

export interface ConfigureInitiativeCardsPayload {
  registryVersion: number;
  cards: InitiativeCardSelectionItem[];
}

export interface ConfiguredInitiativeCards {
  initiativeId: string;
  registryVersion: number;
  cards: InitiativeCardSelectionItem[];
}

export async function configureInitiativeCards(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ConfigureInitiativeCardsPayload>
): Promise<MaterialCommandResult<ConfiguredInitiativeCards>> {
  if (
    envelope.commandType !== 'initiative.cards.configure' ||
    envelope.aggregateType !== 'initiative'
  ) {
    throw new MaterialCommandValidationError('Invalid Initiative Card configuration target');
  }
  if (envelope.createIfMissing || envelope.payload.registryVersion !== 1) {
    throw new MaterialCommandValidationError('Invalid card registry version');
  }
  const positions = new Set<number>();
  const keys = new Set<string>();
  for (const card of envelope.payload.cards) {
    if (keys.has(card.cardKey)) throw new MaterialCommandValidationError('Duplicate card key');
    if (!Number.isInteger(card.position) || card.position < 0 || positions.has(card.position)) {
      throw new MaterialCommandValidationError(
        'Card positions must be unique non-negative integers'
      );
    }
    if (!card.included && card.requiredness === 'REQUIRED' && !card.waiverDecisionId?.trim()) {
      throw new MaterialCommandValidationError('Required card omission requires waiver Decision');
    }
    keys.add(card.cardKey);
    positions.add(card.position);
  }

  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const canonicalKeys = await transaction.listCanonicalInitiativeCardKeys();
    if (
      canonicalKeys.length !== envelope.payload.cards.length ||
      canonicalKeys.some((cardKey) => !keys.has(cardKey))
    ) {
      throw new MaterialCommandValidationError(
        'Selection must contain exactly the canonical cards'
      );
    }
    const initiative = await transaction.getAggregatePayload<InitiativeWithCardRefs>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative) throw new MaterialCommandValidationError('Initiative not found');
    await transaction.replaceInitiativeCardSelection({
      organizationId: envelope.organizationId,
      initiativeId: envelope.aggregateId,
      cards: envelope.payload.cards,
    });
    const response: ConfiguredInitiativeCards = {
      initiativeId: envelope.aggregateId,
      registryVersion: envelope.payload.registryVersion,
      cards: envelope.payload.cards,
    };
    return {
      mutation: {
        ...initiative,
        cardSelection: {
          registryVersion: envelope.payload.registryVersion,
          aggregateVersion: envelope.expectedVersion + 1,
          cards: envelope.payload.cards.map(({ cardKey, included, position }) => ({
            cardKey,
            included,
            position,
          })),
        },
      },
      response,
      eventType: 'initiative.cards.configured',
      eventPayload: response,
      auditPayload: response,
    };
  });
}
