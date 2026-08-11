import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type ResolveDefinitionRemediationPayload =
  | { workType: 'FINANCE_EVIDENCE'; evidenceRefs: string[] }
  | { workType: 'TECHNICAL_OPTION'; selectedOption: string; rationale: string };

interface FinanceTask {
  taskId: string;
  parentId: string;
  findingId: string;
  workType: 'FINANCE_EVIDENCE';
  assigneeId: string;
  status: 'OPEN' | 'COMPLETED';
}

interface TechnicalDecision {
  decisionId: string;
  parentId: string;
  findingId: string;
  decisionType: 'TECHNICAL_OPTION';
  authorityId: string;
  options: string[];
  status: 'PENDING' | 'DECIDED';
}

export interface ResolvedDefinitionRemediationResult {
  aggregateType: 'task' | 'decision';
  aggregateId: string;
  initiativeId: string;
  findingId: string;
  status: 'COMPLETED' | 'DECIDED';
}

export async function resolveDefinitionRemediationWork(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ResolveDefinitionRemediationPayload>
): Promise<MaterialCommandResult<ResolvedDefinitionRemediationResult>> {
  if (
    envelope.commandType !== 'initiative.definition-remediation.resolve' ||
    !['task', 'decision'].includes(envelope.aggregateType) ||
    envelope.createIfMissing
  ) {
    throw new MaterialCommandValidationError('Invalid Definition remediation resolution');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    if (envelope.aggregateType === 'task') {
      if (envelope.payload.workType !== 'FINANCE_EVIDENCE') {
        throw new MaterialCommandValidationError('Finance Task resolution payload is required');
      }
      const task = await transaction.getAggregatePayload<FinanceTask>(
        envelope.organizationId,
        'task',
        envelope.aggregateId
      );
      if (!task || task.workType !== 'FINANCE_EVIDENCE' || task.status !== 'OPEN') {
        throw new MaterialCommandValidationError('Open Finance evidence Task not found');
      }
      if (task.assigneeId !== envelope.actorId) {
        throw new MaterialCommandValidationError('Only the Task assignee may complete it');
      }
      if (
        envelope.payload.evidenceRefs.length === 0 ||
        envelope.payload.evidenceRefs.some((ref) => !ref.trim())
      ) {
        throw new MaterialCommandValidationError('Finance evidence references are required');
      }
      const response: ResolvedDefinitionRemediationResult = {
        aggregateType: 'task',
        aggregateId: envelope.aggregateId,
        initiativeId: task.parentId,
        findingId: task.findingId,
        status: 'COMPLETED',
      };
      return {
        mutation: {
          ...task,
          status: 'COMPLETED',
          evidenceRefs: envelope.payload.evidenceRefs,
          completedAt: new Date().toISOString(),
          completedBy: envelope.actorId,
        },
        response,
        eventType: 'initiative.definition-remediation.task-completed',
        eventPayload: response,
        auditPayload: { ...response, evidenceRefs: envelope.payload.evidenceRefs },
      };
    }

    if (envelope.payload.workType !== 'TECHNICAL_OPTION') {
      throw new MaterialCommandValidationError('Technical Decision resolution payload is required');
    }
    const decision = await transaction.getAggregatePayload<TechnicalDecision>(
      envelope.organizationId,
      'decision',
      envelope.aggregateId
    );
    if (
      !decision ||
      decision.decisionType !== 'TECHNICAL_OPTION' ||
      decision.status !== 'PENDING'
    ) {
      throw new MaterialCommandValidationError('Pending technical Decision not found');
    }
    if (decision.authorityId !== envelope.actorId) {
      throw new MaterialCommandValidationError('Only the Decision authority may decide it');
    }
    const selectedOption = envelope.payload.selectedOption.trim();
    const rationale = envelope.payload.rationale.trim();
    if (!decision.options.includes(selectedOption) || !rationale) {
      throw new MaterialCommandValidationError('A listed option and rationale are required');
    }
    const response: ResolvedDefinitionRemediationResult = {
      aggregateType: 'decision',
      aggregateId: envelope.aggregateId,
      initiativeId: decision.parentId,
      findingId: decision.findingId,
      status: 'DECIDED',
    };
    return {
      mutation: {
        ...decision,
        status: 'DECIDED',
        selectedOption,
        rationale,
        decidedAt: new Date().toISOString(),
        decidedBy: envelope.actorId,
      },
      response,
      eventType: 'initiative.definition-remediation.decision-made',
      eventPayload: response,
      auditPayload: { ...response, selectedOption, rationale },
    };
  });
}
