import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type ProposalEvidenceState = 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
export type ProposalDuplicateState = 'CLEAR' | 'POSSIBLE' | 'UNKNOWN';

export interface SubmitSourceProposalPayload {
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  provenance: { system: string; recordType: string; capturedAt: string; evidenceRefs: string[] };
  title: string;
  problem: string;
  proposedOutcome: string | null;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  projectId: string;
  initiativeOwnerId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
}

export interface SubmittedSourceProposal extends SubmitSourceProposalPayload {
  proposalId: string;
  proposalVersion: 1;
  policy: { policyId: string; policyVersion: number };
  evidenceState: ProposalEvidenceState;
  duplicateState: ProposalDuplicateState;
  status: 'pending';
  submittedBy: string;
  submittedAt: string;
}

interface SourceSubmitTransaction extends MaterialCommandTransaction {
  findProposalBySourceForUpdate(
    organizationId: string,
    sourceType: string,
    sourceId: string,
    sourceVersion: number
  ): Promise<{ id: string } | null>;
  insertSourceProposal(organizationId: string, proposal: SubmittedSourceProposal): Promise<void>;
}

const required = (value: string, field: string) => {
  const normalized = value.trim();
  if (!normalized) throw new MaterialCommandValidationError(`${field} is required`);
  return normalized;
};

function validate(payload: SubmitSourceProposalPayload): SubmitSourceProposalPayload {
  if (!Number.isInteger(payload.sourceVersion) || payload.sourceVersion < 1) {
    throw new MaterialCommandValidationError('sourceVersion must be a positive integer');
  }
  const capturedAt = required(payload.provenance?.capturedAt ?? '', 'provenance.capturedAt');
  if (Number.isNaN(Date.parse(capturedAt))) {
    throw new MaterialCommandValidationError('provenance.capturedAt must be an ISO timestamp');
  }
  return {
    ...payload,
    sourceType: required(payload.sourceType, 'sourceType'),
    sourceId: required(payload.sourceId, 'sourceId'),
    title: required(payload.title, 'title'),
    problem: required(payload.problem, 'problem'),
    projectId: required(payload.projectId, 'projectId'),
    initiativeOwnerId: required(payload.initiativeOwnerId, 'initiativeOwnerId'),
    priority: payload.priority || 'MEDIUM',
    provenance: {
      system: required(payload.provenance.system, 'provenance.system'),
      recordType: required(payload.provenance.recordType, 'provenance.recordType'),
      capturedAt,
      evidenceRefs: [
        ...new Set(payload.provenance.evidenceRefs.map((ref) => ref.trim()).filter(Boolean)),
      ],
    },
  };
}

export async function submitSourceProposal(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<SubmitSourceProposalPayload>
): Promise<MaterialCommandResult<SubmittedSourceProposal>> {
  if (
    envelope.commandType !== 'source-proposal.submit' ||
    envelope.aggregateType !== 'source_proposal'
  ) {
    throw new MaterialCommandValidationError('Invalid Source Submit command target');
  }
  if (!envelope.createIfMissing || envelope.expectedVersion !== 0) {
    throw new MaterialCommandValidationError(
      'Source Submit must create a missing version-0 aggregate'
    );
  }
  const payload = validate(envelope.payload);
  return executeMaterialCommand(unitOfWork, { ...envelope, payload }, async (baseTransaction) => {
    const transaction = baseTransaction as SourceSubmitTransaction;
    const existing = await transaction.findProposalBySourceForUpdate(
      envelope.organizationId,
      payload.sourceType,
      payload.sourceId,
      payload.sourceVersion
    );
    if (existing) {
      throw new MaterialCommandConflictError('source version already has a Proposal', 0, 1);
    }
    const submittedAt = new Date().toISOString();
    const evidenceState: ProposalEvidenceState =
      payload.provenance.evidenceRefs.length > 0 ? 'READY' : 'PARTIAL';
    const state: SubmittedSourceProposal = {
      ...payload,
      proposalId: envelope.aggregateId,
      proposalVersion: 1,
      policy: { policyId: envelope.policyId, policyVersion: envelope.policyVersion },
      evidenceState,
      duplicateState: 'CLEAR',
      status: 'pending',
      submittedBy: envelope.actorId,
      submittedAt,
    };
    await transaction.insertSourceProposal(envelope.organizationId, state);
    return {
      mutation: state,
      response: state,
      eventType: 'source_proposal.submitted',
      eventPayload: {
        proposalId: state.proposalId,
        source: { type: state.sourceType, id: state.sourceId, version: state.sourceVersion },
      },
      auditPayload: { before: null, after: state },
    };
  });
}
