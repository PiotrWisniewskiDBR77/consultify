import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type AdoptAcceptedClassicPayload = {
  candidateId: string;
  projectId: string;
  initiativeOwnerId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
};

export async function adoptAcceptedClassicInitiative(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<AdoptAcceptedClassicPayload>
): Promise<MaterialCommandResult<any>> {
  if (
    envelope.commandType !== 'initiative.adopt-accepted-classic' ||
    envelope.aggregateType !== 'initiative' ||
    !envelope.createIfMissing ||
    envelope.expectedVersion !== 0
  ) {
    throw new MaterialCommandValidationError('Invalid accepted-classic adoption target');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    const bridge = await tx.adoptAcceptedClassicInitiative({
      organizationId: envelope.organizationId,
      candidateId: envelope.payload.candidateId,
      initiativeId: envelope.aggregateId,
      projectId: envelope.payload.projectId,
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
        sourceType: 'accepted_classic_swot_candidate',
        sourceId: bridge.sourceReceiptId,
        sourceVersion: bridge.sourceVersion,
        freshness: 'CURRENT' as const,
        refreshedAt: new Date().toISOString(),
        toolOutputId: bridge.toolOutputId,
        toolOutputVersion: bridge.toolOutputVersion,
        sourceContentHash: bridge.sourceContentHash,
      },
      adoptionReceiptId: bridge.receiptId,
      governance: { policyId: envelope.policyId, policyVersion: envelope.policyVersion },
      readiness: 'NOT_EVALUATED' as const,
    };
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: 'ACCEPTED_CLASSIC_ADOPTION',
      sourceType: 'swot_candidate_handoff',
      sourceId: bridge.sourceReceiptId,
      sourceVersion: bridge.sourceVersion,
      targetType: 'initiative',
      targetId: envelope.aggregateId,
      payload: {
        candidateId: envelope.payload.candidateId,
        adoptionReceiptId: bridge.receiptId,
        toolOutputId: bridge.toolOutputId,
        toolOutputVersion: bridge.toolOutputVersion,
        sourceContentHash: bridge.sourceContentHash,
      },
    });
    return {
      mutation: state,
      response: state,
      eventType: 'initiative.accepted_classic_adopted',
      eventPayload: {
        initiativeId: envelope.aggregateId,
        candidateId: envelope.payload.candidateId,
        adoptionReceiptId: bridge.receiptId,
      },
      auditPayload: { disposition: 'ADOPT_ACCEPTED_CLASSIC', before: null, after: state },
    };
  });
}
