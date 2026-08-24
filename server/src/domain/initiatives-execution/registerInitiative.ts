import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export interface RegisterInitiativePayload {
  proposalId: string;
  proposalVersion: number;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  title: string;
  problem: string;
  proposedOutcome: string | null;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  projectId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
  initiativeOwnerId: string;
  validatorCapability: 'INITIATIVE_REGISTER';
}

export interface RegisteredInitiative {
  initiativeId: string;
  lifecycleState: 'REGISTERED_DRAFT';
  title: string;
  problem: string;
  proposedOutcome: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  projectId: string;
  visibility: RegisterInitiativePayload['visibility'];
  initiativeOwnerId: string;
  source: {
    proposalId: string;
    proposalVersion: number;
    sourceType: string;
    sourceId: string;
    sourceVersion: number;
    freshness: 'CURRENT';
    refreshedAt: string;
  };
  governance: { policyId: string; policyVersion: number };
  readiness: 'NOT_EVALUATED';
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new MaterialCommandValidationError(`${field} is required`);
  return normalized;
}

function validate(payload: RegisterInitiativePayload): RegisterInitiativePayload {
  if (payload.validatorCapability !== 'INITIATIVE_REGISTER') {
    throw new MaterialCommandValidationError('INITIATIVE_REGISTER capability is required');
  }
  for (const [field, version] of [
    ['proposalVersion', payload.proposalVersion],
    ['sourceVersion', payload.sourceVersion],
  ] as const) {
    if (!Number.isInteger(version) || version < 1) {
      throw new MaterialCommandValidationError(`${field} must be a positive integer`);
    }
  }
  return {
    ...payload,
    proposalId: required(payload.proposalId, 'proposalId'),
    sourceType: required(payload.sourceType, 'sourceType'),
    sourceId: required(payload.sourceId, 'sourceId'),
    title: required(payload.title, 'title'),
    problem: required(payload.problem, 'problem'),
    projectId: required(payload.projectId, 'projectId'),
    initiativeOwnerId: required(payload.initiativeOwnerId, 'initiativeOwnerId'),
    priority: payload.priority || 'MEDIUM',
  };
}

export async function registerInitiative(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RegisterInitiativePayload>
): Promise<MaterialCommandResult<RegisteredInitiative>> {
  if (envelope.commandType !== 'initiative.register' || envelope.aggregateType !== 'initiative') {
    throw new MaterialCommandValidationError('Invalid Register command target');
  }
  if (!envelope.createIfMissing || envelope.expectedVersion !== 0) {
    throw new MaterialCommandValidationError('Register must create a missing version-0 aggregate');
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
      throw new MaterialCommandValidationError('Source proposal is no longer registerable');
    }
    if (proposal.evidenceState !== 'READY' || proposal.duplicateState !== 'CLEAR') {
      throw new MaterialCommandValidationError('Source proposal is not ready for Register');
    }
    if (!proposal.problem || !proposal.projectId || !proposal.initiativeOwnerId) {
      throw new MaterialCommandValidationError('Source proposal governance data is incomplete');
    }
    const sourceMatches =
      proposal.sourceType === payload.sourceType &&
      proposal.sourceId === payload.sourceId &&
      proposal.sourceVersion === payload.sourceVersion;
    const contentMatches =
      proposal.title === payload.title &&
      proposal.problem === payload.problem &&
      proposal.proposedOutcome === payload.proposedOutcome &&
      (proposal.priority || 'MEDIUM') === payload.priority &&
      proposal.projectId === payload.projectId &&
      proposal.visibility === payload.visibility &&
      proposal.initiativeOwnerId === payload.initiativeOwnerId;
    if (!sourceMatches || !contentMatches) {
      throw new MaterialCommandConflictError(
        'source proposal content conflict',
        payload.proposalVersion,
        proposal.version
      );
    }

    const state: RegisteredInitiative = {
      initiativeId: envelope.aggregateId,
      lifecycleState: 'REGISTERED_DRAFT',
      title: proposal.title,
      problem: proposal.problem,
      proposedOutcome: proposal.proposedOutcome,
      priority: proposal.priority || 'MEDIUM',
      projectId: proposal.projectId,
      visibility: proposal.visibility,
      initiativeOwnerId: proposal.initiativeOwnerId,
      source: {
        proposalId: proposal.id,
        // Registration advances the source Proposal disposition version in the same transaction.
        // The Initiative snapshot must point at that post-write version or it would be stale
        // immediately after a successful Register.
        proposalVersion: proposal.version + 1,
        sourceType: proposal.sourceType,
        sourceId: proposal.sourceId,
        sourceVersion: proposal.sourceVersion,
        freshness: 'CURRENT',
        refreshedAt: new Date().toISOString(),
      },
      governance: { policyId: envelope.policyId, policyVersion: envelope.policyVersion },
      readiness: 'NOT_EVALUATED',
    };
    await transaction.claimRelation({
      organizationId: envelope.organizationId,
      relationType: 'SOURCE_REGISTRATION',
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      sourceVersion: payload.sourceVersion,
      targetType: 'initiative',
      targetId: envelope.aggregateId,
      payload: {
        proposalId: payload.proposalId,
        proposalVersion: payload.proposalVersion,
        disposition: 'REGISTER',
      },
    });
    await transaction.markSourceProposalRegistered(
      envelope.organizationId,
      proposal.id,
      proposal.version,
      envelope.aggregateId
    );
    return {
      mutation: state,
      response: state,
      eventType: 'initiative.registered',
      eventPayload: {
        initiativeId: state.initiativeId,
        lifecycleState: state.lifecycleState,
        source: state.source,
      },
      auditPayload: {
        disposition: 'REGISTER',
        before: null,
        after: state,
      },
    };
  });
}
