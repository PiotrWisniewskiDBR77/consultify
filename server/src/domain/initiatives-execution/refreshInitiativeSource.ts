import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { InitiativeWithCardRefs } from './publishInitiativeCard.js';
import type { RegisteredInitiative } from './registerInitiative.js';

export interface RefreshInitiativeSourcePayload {
  expectedProposalVersion: number;
  expectedSourceVersion: number;
}

export interface RefreshInitiativeSourceResult {
  initiativeId: string;
  proposalId: string;
  proposalVersion: number;
  sourceVersion: number;
  freshness: 'CURRENT';
  invalidatedCardKeys: string[];
}

interface RefreshableInitiative extends RegisteredInitiative, InitiativeWithCardRefs {}

export async function refreshInitiativeSource(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RefreshInitiativeSourcePayload>
): Promise<MaterialCommandResult<RefreshInitiativeSourceResult>> {
  if (
    envelope.commandType !== 'initiative.source.refresh' ||
    envelope.aggregateType !== 'initiative' ||
    envelope.createIfMissing
  ) {
    throw new MaterialCommandValidationError('Invalid Initiative source refresh target');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const initiative = await transaction.getAggregatePayload<RefreshableInitiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'REGISTERED_DRAFT') {
      throw new MaterialCommandValidationError('Only a Registered Draft source may be refreshed');
    }
    const proposal = await transaction.getSourceProposalForUpdate(
      envelope.organizationId,
      initiative.source.proposalId
    );
    if (!proposal) throw new MaterialCommandValidationError('Source proposal not found');
    if (proposal.version !== envelope.payload.expectedProposalVersion) {
      throw new MaterialCommandConflictError(
        'source proposal version conflict',
        envelope.payload.expectedProposalVersion,
        proposal.version
      );
    }
    if (proposal.sourceVersion !== envelope.payload.expectedSourceVersion) {
      throw new MaterialCommandConflictError(
        'source object version conflict',
        envelope.payload.expectedSourceVersion,
        proposal.sourceVersion
      );
    }
    if (
      proposal.sourceType !== initiative.source.sourceType ||
      proposal.sourceId !== initiative.source.sourceId
    ) {
      throw new MaterialCommandValidationError('Source identity cannot be replaced by refresh');
    }
    if (proposal.evidenceState !== 'READY') {
      throw new MaterialCommandValidationError('Source evidence is not ready for refresh');
    }
    if (
      proposal.sourceVersion < initiative.source.sourceVersion ||
      proposal.version < initiative.source.proposalVersion
    ) {
      throw new MaterialCommandValidationError('Source refresh cannot move backwards');
    }
    if (
      proposal.sourceVersion === initiative.source.sourceVersion &&
      proposal.version === initiative.source.proposalVersion
    ) {
      throw new MaterialCommandValidationError('Initiative source snapshot is already current');
    }
    const invalidatedCardKeys: string[] = [];
    const cardRefs = { ...(initiative.cardRefs ?? {}) };
    for (const cardKey of await transaction.listCanonicalInitiativeCardKeys()) {
      const current = await transaction.getLatestInitiativeCardForUpdate(
        envelope.organizationId,
        envelope.aggregateId,
        cardKey
      );
      if (!current) continue;
      const currentVersion = await transaction.getInitiativeCardVersionForUpdate(
        envelope.organizationId,
        envelope.aggregateId,
        cardKey
      );
      const nextVersion = currentVersion + 1;
      await transaction.publishInitiativeCardVersion({
        organizationId: envelope.organizationId,
        initiativeId: envelope.aggregateId,
        cardKey,
        cardVersion: nextVersion,
        aggregateVersion: envelope.expectedVersion + 1,
        applicability: current.applicability,
        completion: current.completion,
        quality: current.quality,
        freshness: 'STALE',
        reviewState: 'CHANGES_REQUESTED',
        content: current.content,
        evidenceRefs: current.evidenceRefs,
        waiverDecisionId: current.waiverDecisionId,
        publishedBy: envelope.actorId,
      });
      cardRefs[cardKey] = {
        cardVersion: nextVersion,
        aggregateVersion: envelope.expectedVersion + 1,
      };
      invalidatedCardKeys.push(cardKey);
    }
    const response: RefreshInitiativeSourceResult = {
      initiativeId: envelope.aggregateId,
      proposalId: proposal.id,
      proposalVersion: proposal.version,
      sourceVersion: proposal.sourceVersion,
      freshness: 'CURRENT',
      invalidatedCardKeys,
    };
    return {
      mutation: {
        ...initiative,
        source: {
          ...initiative.source,
          proposalVersion: proposal.version,
          sourceVersion: proposal.sourceVersion,
          freshness: 'CURRENT',
          refreshedAt: new Date().toISOString(),
        },
        cardRefs,
        gateReadiness: 'NOT_EVALUATED',
      },
      response,
      eventType: 'initiative.source.refreshed',
      eventPayload: response,
      auditPayload: {
        ...response,
        previousProposalVersion: initiative.source.proposalVersion,
        previousSourceVersion: initiative.source.sourceVersion,
      },
    };
  });
}
