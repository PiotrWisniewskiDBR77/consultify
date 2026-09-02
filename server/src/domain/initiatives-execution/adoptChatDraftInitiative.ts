import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type AdoptChatDraftPayload = {
  chatInitiativeId: string;
  projectId: string;
  initiativeOwnerId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
};

type ChatDraftAdoptionTransaction = MaterialCommandTransaction & {
  adoptChatDraftInitiative(input: {
    organizationId: string;
    chatInitiativeId: string;
    initiativeId: string;
    projectId: string;
    initiativeOwnerId: string;
    actorId: string;
    policyId: string;
    policyVersion: number;
    correlationId: string;
  }): Promise<{ receiptId: string; title: string; problem: string; sourceId: string }>;
};

export async function adoptChatDraftInitiative(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<AdoptChatDraftPayload>
): Promise<MaterialCommandResult<any>> {
  if (
    envelope.commandType !== 'initiative.adopt-chat-draft' ||
    envelope.aggregateType !== 'initiative' ||
    !envelope.createIfMissing ||
    envelope.expectedVersion !== 0 ||
    envelope.aggregateId !== envelope.payload.chatInitiativeId
  ) {
    throw new MaterialCommandValidationError('Invalid Teresa chat-draft adoption target');
  }

  return executeMaterialCommand(unitOfWork, envelope, async (baseTx) => {
    const tx = baseTx as ChatDraftAdoptionTransaction;
    if (typeof tx.adoptChatDraftInitiative !== 'function') {
      throw new MaterialCommandValidationError('Chat-draft adoption transaction is unavailable');
    }
    const bridge = await tx.adoptChatDraftInitiative({
      organizationId: envelope.organizationId,
      chatInitiativeId: envelope.payload.chatInitiativeId,
      initiativeId: envelope.aggregateId,
      projectId: envelope.payload.projectId,
      initiativeOwnerId: envelope.payload.initiativeOwnerId,
      actorId: envelope.actorId,
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
      correlationId: envelope.correlationId,
    });
    const state = {
      initiativeId: envelope.aggregateId,
      lifecycleState: 'REGISTERED_DRAFT' as const,
      title: bridge.title,
      problem: bridge.problem,
      proposedOutcome: null,
      projectId: envelope.payload.projectId,
      visibility: envelope.payload.visibility,
      initiativeOwnerId: envelope.payload.initiativeOwnerId,
      source: {
        proposalId: null,
        proposalVersion: null,
        sourceType: 'teresa_chat',
        sourceId: bridge.sourceId,
        sourceVersion: 1,
        freshness: 'CURRENT' as const,
        refreshedAt: new Date().toISOString(),
      },
      adoptionReceiptId: bridge.receiptId,
      governance: { policyId: envelope.policyId, policyVersion: envelope.policyVersion },
      readiness: 'NOT_EVALUATED' as const,
    };
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: 'TERESA_CHAT_DRAFT_ADOPTION',
      sourceType: 'teresa_chat_initiative',
      sourceId: envelope.payload.chatInitiativeId,
      sourceVersion: 1,
      targetType: 'initiative',
      targetId: envelope.aggregateId,
      payload: { adoptionReceiptId: bridge.receiptId },
    });
    return {
      mutation: state,
      response: state,
      eventType: 'initiative.teresa_chat_draft_adopted',
      eventPayload: {
        initiativeId: envelope.aggregateId,
        chatInitiativeId: envelope.payload.chatInitiativeId,
        adoptionReceiptId: bridge.receiptId,
      },
      auditPayload: { disposition: 'ADOPT_TERESA_CHAT_DRAFT', before: null, after: state },
    };
  });
}
