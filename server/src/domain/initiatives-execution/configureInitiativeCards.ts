import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
  MaterialCommandRuleError,
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
  profile?: { templateId: string; version: number; contentHash: string };
}

export interface ConfiguredInitiativeCards {
  initiativeId: string;
  registryVersion: number;
  cards: InitiativeCardSelectionItem[];
}

export const CARD_PROFILE_KEYS = [
  'quick-improvement',
  'investment',
  'technology',
  'organizational-change',
  'regulatory-remediation',
  'complex-transformation',
] as const;
const profileSchema = z.object({
  profileKey: z.enum(CARD_PROFILE_KEYS),
  version: z.number().int().positive(),
  policy: z.object({ policyId: z.string().min(1), policyVersion: z.number().int().positive() }),
  cards: z
    .array(
      z.object({
        cardKey: z.string().min(1),
        included: z.boolean(),
        position: z.number().int().nonnegative(),
        requiredness: z.enum(['REQUIRED', 'OPTIONAL']),
        requiredFields: z.array(z.string().min(1)),
        reviewRequired: z.boolean(),
        reviewerIds: z.array(z.string().min(1)).refine(ids => new Set(ids).size === ids.length),
      }).refine(card => !card.reviewRequired || card.reviewerIds.length > 0)
    )
    .length(26),
});
export function configuredCardProfile(template: {
  id: string;
  updatedAt: string;
  sectionConfig: Record<string, unknown>;
}) {
  const parsed = profileSchema.safeParse(template.sectionConfig.initiativeCardProfile);
  if (!parsed.success)
    throw new MaterialCommandRuleError('CARD_PROFILE_CONFIGURATION_MISSING', 409);
  const profile = parsed.data;
  if (
    new Set(profile.cards.map((card) => card.cardKey)).size !== 26 ||
    new Set(profile.cards.map((card) => card.position)).size !== 26
  )
    throw new MaterialCommandRuleError('CARD_PROFILE_CONFIGURATION_INVALID', 409);
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ templateId: template.id, updatedAt: template.updatedAt, profile }))
    .digest('hex');
  return { ...profile, templateId: template.id, contentHash };
}
export type ConfiguredCardProfile = ReturnType<typeof configuredCardProfile>;

export async function configureInitiativeCards(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ConfigureInitiativeCardsPayload>,
  assertCurrentAuthority?: (initiative: InitiativeWithCardRefs) => Promise<void>,
  assertProfileAuthority?: (initiative: InitiativeWithCardRefs, profile: ConfiguredCardProfile) => Promise<void>
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

  return unitOfWork.transaction(async (transaction) => {
    let profile: ConfiguredCardProfile | undefined;
    if (envelope.payload.profile || assertCurrentAuthority || transaction.listInitiativeCardSelectionForUpdate) {
      const parent = await transaction.getRelatedAggregateForUpdate<InitiativeWithCardRefs>(
        envelope.organizationId,
        'initiative',
        envelope.aggregateId
      );
      if (!parent) throw new MaterialCommandRuleError('NOT_FOUND', 404);
      await assertCurrentAuthority?.(parent.payload);
      const previouslyConfigured = Boolean((parent.payload.cardSelection as { profile?: ConfiguredCardProfile } | undefined)?.profile);
      if ((envelope.payload.profile || previouslyConfigured) && parent.payload.lifecycleState !== 'REGISTERED_DRAFT') throw new MaterialCommandRuleError('CARD_PROFILE_CHANGE_REQUIRES_GOVERNED_DECISION', 409);
      if (previouslyConfigured && !envelope.payload.profile) throw new MaterialCommandRuleError('CARD_PROFILE_REFERENCE_REQUIRED', 409);
      if ((envelope.payload.profile || previouslyConfigured) && !assertCurrentAuthority) throw new MaterialCommandRuleError('CARD_PROFILE_AUTHORITY_REQUIRED', 403);
      if (envelope.payload.profile) {
        if (!transaction.getInitiativeTemplateForShare)
          throw new MaterialCommandRuleError('CARD_PROFILE_ADAPTER_UNAVAILABLE', 409);
        const template = await transaction.getInitiativeTemplateForShare({
          organizationId: envelope.organizationId,
          templateId: envelope.payload.profile.templateId,
        });
        if (!template) throw new MaterialCommandRuleError('NOT_FOUND', 404);
        profile = configuredCardProfile(template);
        if (!assertProfileAuthority) throw new MaterialCommandRuleError('CARD_PROFILE_REVIEWER_AUTHORITY_REQUIRED', 403);
        await assertProfileAuthority(parent.payload, profile);
        if (profile.policy.policyId !== envelope.policyId || profile.policy.policyVersion !== envelope.policyVersion)
          throw new MaterialCommandRuleError('CARD_PROFILE_POLICY_CONFLICT', 409);
        if (
          profile.version !== envelope.payload.profile.version ||
          profile.contentHash !== envelope.payload.profile.contentHash
        )
          throw new MaterialCommandRuleError('CARD_PROFILE_VERSION_CONFLICT', 409);
        const prior = parent.payload.cardSelection as
          | { profile?: ConfiguredCardProfile }
          | undefined;
        for (const card of envelope.payload.cards) {
          const requirement = profile.cards.find((item) => item.cardKey === card.cardKey);
          if (!requirement || requirement.requiredness !== card.requiredness)
            throw new MaterialCommandRuleError('CARD_PROFILE_REQUIREDNESS_MISMATCH', 409);
          if (card.waiverDecisionId || (card.requiredness === 'REQUIRED' && !card.included))
            throw new MaterialCommandRuleError('AUTHORIZED_CARD_WAIVER_REQUIRED', 403);
          const previous = prior?.profile?.cards.find((item) => item.cardKey === card.cardKey);
          if (
            previous?.requiredness === 'REQUIRED' &&
            (card.requiredness !== 'REQUIRED' || !card.included)
          )
            throw new MaterialCommandRuleError('AUTHORIZED_CARD_WAIVER_REQUIRED', 403);
        }
      }
    }
    if (transaction.listInitiativeCardSelectionForUpdate) {
      const previous = await transaction.listInitiativeCardSelectionForUpdate(envelope.organizationId, envelope.aggregateId);
      for (const old of previous) {
        const next = envelope.payload.cards.find((card) => card.cardKey === old.cardKey);
        if (old.requiredness === 'REQUIRED' && (!next || next.requiredness !== 'REQUIRED' || (!next.included && old.included)))
          throw new MaterialCommandRuleError('AUTHORIZED_CARD_WAIVER_REQUIRED', 403);
      }
    } else if (envelope.payload.profile) throw new MaterialCommandRuleError('CARD_PROFILE_ADAPTER_UNAVAILABLE', 409);
    const scopedUnitOfWork: MaterialCommandUnitOfWork = {
      transaction: async (work) => work(transaction),
    };
    return executeMaterialCommand(scopedUnitOfWork, envelope, async (transaction) => {
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
            ...(initiative.cardSelection && typeof initiative.cardSelection === 'object'
              ? initiative.cardSelection
              : {}),
            ...(profile ? { profile } : {}),
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
  });
}
