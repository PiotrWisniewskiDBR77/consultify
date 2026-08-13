import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
  type SourceProposalDisposition,
} from './materialCommand.js';

type NonRegisterDisposition = Exclude<SourceProposalDisposition, 'REGISTER'>;

export interface DecideSourceProposalPayload {
  proposalId: string;
  proposalVersion: number;
  disposition: NonRegisterDisposition;
  targetInitiativeId: string | null;
  reasonCode: string;
  rationale: string;
  evidenceSnapshot: Record<string, unknown>;
  resolverId: string | null;
  dueAt: string | null;
  reviewTrigger: string | null;
}

export interface SourceProposalDecision {
  decisionId: string;
  proposalId: string;
  proposalVersion: number;
  disposition: NonRegisterDisposition;
  targetInitiativeId: string | null;
  reasonCode: string;
  rationale: string;
  evidenceSnapshot: Record<string, unknown>;
  resolverId: string | null;
  dueAt: string | null;
  reviewTrigger: string | null;
  governance: { policyId: string; policyVersion: number };
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new MaterialCommandValidationError(`${field} is required`);
  return normalized;
}

function validate(payload: DecideSourceProposalPayload): DecideSourceProposalPayload {
  if (!Number.isInteger(payload.proposalVersion) || payload.proposalVersion < 1) {
    throw new MaterialCommandValidationError('proposalVersion must be a positive integer');
  }
  if (
    (payload.disposition === 'MERGE' || payload.disposition === 'EXTEND') &&
    !payload.targetInitiativeId?.trim()
  ) {
    throw new MaterialCommandValidationError(`${payload.disposition} requires targetInitiativeId`);
  }
  if (payload.disposition === 'RETURN' && (!payload.resolverId?.trim() || !payload.dueAt)) {
    throw new MaterialCommandValidationError('RETURN requires resolverId and dueAt');
  }
  if (
    payload.disposition === 'DEFER' &&
    (!payload.resolverId?.trim() || !payload.reviewTrigger?.trim())
  ) {
    throw new MaterialCommandValidationError('DEFER requires resolverId and reviewTrigger');
  }
  return {
    ...payload,
    proposalId: required(payload.proposalId, 'proposalId'),
    reasonCode: required(payload.reasonCode, 'reasonCode'),
    rationale: required(payload.rationale, 'rationale'),
    targetInitiativeId: payload.targetInitiativeId?.trim() || null,
    resolverId: payload.resolverId?.trim() || null,
    reviewTrigger: payload.reviewTrigger?.trim() || null,
  };
}

export async function decideSourceProposal(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<DecideSourceProposalPayload>
): Promise<MaterialCommandResult<SourceProposalDecision>> {
  if (
    envelope.commandType !== 'source-proposal.decide' ||
    envelope.aggregateType !== 'source-proposal-decision'
  ) {
    throw new MaterialCommandValidationError('Invalid Source Proposal Decision target');
  }
  if (!envelope.createIfMissing || envelope.expectedVersion !== 0) {
    throw new MaterialCommandValidationError('Source Proposal Decision must be create-only');
  }
  const payload = validate(envelope.payload);
  return executeMaterialCommand(unitOfWork, { ...envelope, payload }, async (transaction) => {
    const proposal = await transaction.getSourceProposalForUpdate(
      envelope.organizationId,
      payload.proposalId
    );
    if (!proposal) throw new MaterialCommandValidationError('Source proposal not found');
    if (proposal.version !== payload.proposalVersion) {
      throw new MaterialCommandConflictError(
        'source proposal version conflict',
        payload.proposalVersion,
        proposal.version
      );
    }
    if (proposal.status !== 'pending' || proposal.registeredInitiativeId) {
      throw new MaterialCommandValidationError('Source proposal was already decided');
    }

    if (payload.targetInitiativeId) {
      await transaction.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `SOURCE_${payload.disposition}`,
        sourceType: proposal.sourceType,
        sourceId: proposal.sourceId,
        sourceVersion: proposal.sourceVersion,
        targetType: 'initiative',
        targetId: payload.targetInitiativeId,
        payload: {
          proposalId: proposal.id,
          proposalVersion: proposal.version,
          disposition: payload.disposition,
        },
      });
    }
    await transaction.markSourceProposalDisposition(
      envelope.organizationId,
      proposal.id,
      proposal.version,
      payload.disposition,
      payload.targetInitiativeId
    );

    const decision: SourceProposalDecision = {
      decisionId: envelope.aggregateId,
      ...payload,
      governance: { policyId: envelope.policyId, policyVersion: envelope.policyVersion },
    };
    return {
      mutation: decision,
      response: decision,
      eventType: 'source-proposal.decided',
      eventPayload: decision,
      auditPayload: { before: proposal, after: decision },
    };
  });
}
