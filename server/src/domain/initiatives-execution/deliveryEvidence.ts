import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export interface DeliveryEvidence {
  evidenceId: string;
  initiativeId: string;
  executionCaseId: string;
  taskId: string | null;
  evidenceRefs: Array<{ ref: string; version: number }>;
  submitterId: string;
  reviewerId: string;
  status: 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  rationale: string | null;
  resultsSignalId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface DeliveryResultsSignal {
  signalId: string;
  initiativeId: string;
  executionCaseId: string;
  deliveryEvidenceRef: { evidenceId: string; version: number };
  evidenceRefs: Array<{ ref: string; version: number }>;
  approvedBy: string;
  approvedAt: string;
}

export async function submitDeliveryEvidence(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    Pick<
      DeliveryEvidence,
      'initiativeId' | 'executionCaseId' | 'taskId' | 'evidenceRefs' | 'reviewerId'
    >
  >
): Promise<MaterialCommandResult<DeliveryEvidence>> {
  if (
    envelope.aggregateType !== 'delivery_evidence' ||
    envelope.commandType !== 'delivery-evidence.submit'
  )
    throw new MaterialCommandValidationError('Invalid delivery evidence submission');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    const executionCase = await tx.getRelatedAggregateForUpdate<any>(
      envelope.organizationId,
      'execution_case',
      p.executionCaseId
    );
    if (
      !executionCase ||
      executionCase.payload.initiativeId !== p.initiativeId ||
      executionCase.payload.state !== 'ACTIVE' ||
      !p.reviewerId ||
      p.reviewerId === envelope.actorId ||
      !p.evidenceRefs.length ||
      p.evidenceRefs.some((item) => !item.ref.trim() || item.version < 1)
    )
      throw new MaterialCommandValidationError(
        'Independent reviewer and versioned delivery evidence are required'
      );
    if (p.taskId) {
      const task = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'execution_task',
        p.taskId
      );
      if (!task || task.payload.executionCaseId !== p.executionCaseId)
        throw new MaterialCommandValidationError('Task must belong to the Execution Case');
    }
    const now = new Date().toISOString();
    const value: DeliveryEvidence = {
      evidenceId: envelope.aggregateId,
      ...p,
      submitterId: envelope.actorId,
      status: 'SUBMITTED',
      rationale: null,
      resultsSignalId: null,
      createdAt: now,
      reviewedAt: null,
    };
    return {
      mutation: value,
      response: value,
      eventType: 'delivery-evidence.submitted',
      eventPayload: value,
      auditPayload: value,
    };
  });
}

export async function decideDeliveryEvidence(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    outcome: 'APPROVE' | 'RETURN';
    rationale: string;
    resultsSignalId: string;
  }>
): Promise<MaterialCommandResult<DeliveryEvidence>> {
  if (
    envelope.aggregateType !== 'delivery_evidence' ||
    envelope.commandType !== 'delivery-evidence.decide'
  )
    throw new MaterialCommandValidationError('Invalid delivery evidence decision');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const evidence = await tx.getAggregatePayload<DeliveryEvidence>(
      envelope.organizationId,
      'delivery_evidence',
      envelope.aggregateId
    );
    if (
      !evidence ||
      evidence.status !== 'SUBMITTED' ||
      envelope.actorId !== evidence.reviewerId ||
      envelope.actorId === evidence.submitterId ||
      !envelope.payload.rationale.trim()
    )
      throw new MaterialCommandValidationError('Independent pending evidence review required');
    const approved = envelope.payload.outcome === 'APPROVE';
    const reviewedAt = new Date().toISOString();
    if (approved) {
      const signal: DeliveryResultsSignal = {
        signalId: envelope.payload.resultsSignalId,
        initiativeId: evidence.initiativeId,
        executionCaseId: evidence.executionCaseId,
        deliveryEvidenceRef: {
          evidenceId: evidence.evidenceId,
          version: envelope.expectedVersion + 1,
        },
        evidenceRefs: evidence.evidenceRefs,
        approvedBy: envelope.actorId,
        approvedAt: reviewedAt,
      };
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'results_delivery_signal',
        signal.signalId,
        0,
        1,
        signal
      );
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `DELIVERY_EVIDENCE_RESULTS:${signal.signalId}`,
        sourceType: 'delivery_evidence',
        sourceId: evidence.evidenceId,
        sourceVersion: envelope.expectedVersion + 1,
        targetType: 'results_delivery_signal',
        targetId: signal.signalId,
        payload: { initiativeId: evidence.initiativeId },
      });
    }
    const next: DeliveryEvidence = {
      ...evidence,
      status: approved ? 'APPROVED' : 'RETURNED',
      rationale: envelope.payload.rationale,
      resultsSignalId: approved ? envelope.payload.resultsSignalId : null,
      reviewedAt,
    };
    return {
      mutation: next,
      response: next,
      eventType: approved ? 'delivery-evidence.approved' : 'delivery-evidence.returned',
      eventPayload: next,
      auditPayload: next,
    };
  });
}
