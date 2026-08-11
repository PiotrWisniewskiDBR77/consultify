import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { InitiativeWithCardRefs } from './publishInitiativeCard.js';

export interface DefinitionRemediationWorkPayload {
  findingId: string;
  financeTask: {
    taskId: string;
    title: string;
    assigneeId: string;
    dueAt: string;
  };
  technicalDecision: {
    decisionId: string;
    title: string;
    authorityId: string;
    dueAt: string;
    options: string[];
  };
}

export interface DefinitionRemediationWorkResult {
  initiativeId: string;
  findingId: string;
  taskId: string;
  decisionId: string;
}

interface InitiativeWithWorkRefs extends InitiativeWithCardRefs {
  workRefs?: Array<{ findingId: string; taskId: string; decisionId: string }>;
}

export async function createDefinitionRemediationWork(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<DefinitionRemediationWorkPayload>
): Promise<MaterialCommandResult<DefinitionRemediationWorkResult>> {
  if (
    envelope.commandType !== 'initiative.definition-remediation.create' ||
    envelope.aggregateType !== 'initiative' ||
    envelope.createIfMissing
  ) {
    throw new MaterialCommandValidationError('Invalid Definition remediation command');
  }
  const { findingId, financeTask, technicalDecision } = envelope.payload;
  if (
    !findingId.trim() ||
    !financeTask.taskId.trim() ||
    !financeTask.title.trim() ||
    !financeTask.assigneeId.trim() ||
    !technicalDecision.decisionId.trim() ||
    !technicalDecision.title.trim() ||
    !technicalDecision.authorityId.trim() ||
    technicalDecision.options.length < 2 ||
    !technicalDecision.options.every((option) => option.trim())
  ) {
    throw new MaterialCommandValidationError('Definition remediation work is incomplete');
  }
  if (financeTask.taskId === technicalDecision.decisionId) {
    throw new MaterialCommandValidationError('Task and Decision IDs must be distinct');
  }

  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const initiative = await transaction.getAggregatePayload<InitiativeWithWorkRefs>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'REGISTERED_DRAFT') {
      throw new MaterialCommandValidationError(
        'Definition remediation requires a Registered Draft Initiative'
      );
    }
    if (
      (await transaction.getRelatedAggregateForUpdate(
        envelope.organizationId,
        'task',
        financeTask.taskId
      )) ||
      (await transaction.getRelatedAggregateForUpdate(
        envelope.organizationId,
        'decision',
        technicalDecision.decisionId
      ))
    ) {
      throw new MaterialCommandValidationError('Task or Decision ID already exists');
    }

    const createdAt = new Date().toISOString();
    await transaction.persistRelatedAggregate(
      envelope.organizationId,
      'task',
      financeTask.taskId,
      0,
      1,
      {
        taskId: financeTask.taskId,
        parentType: 'initiative',
        parentId: envelope.aggregateId,
        findingId,
        workType: 'FINANCE_EVIDENCE',
        title: financeTask.title,
        assigneeId: financeTask.assigneeId,
        dueAt: financeTask.dueAt,
        status: 'OPEN',
        createdAt,
      }
    );
    await transaction.persistRelatedAggregate(
      envelope.organizationId,
      'decision',
      technicalDecision.decisionId,
      0,
      1,
      {
        decisionId: technicalDecision.decisionId,
        parentType: 'initiative',
        parentId: envelope.aggregateId,
        findingId,
        decisionType: 'TECHNICAL_OPTION',
        title: technicalDecision.title,
        authorityId: technicalDecision.authorityId,
        dueAt: technicalDecision.dueAt,
        options: technicalDecision.options,
        status: 'PENDING',
        createdAt,
      }
    );
    await transaction.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `DEFINITION_REMEDIATION_TASK:${findingId}`,
      sourceType: 'initiative',
      sourceId: envelope.aggregateId,
      sourceVersion: envelope.expectedVersion,
      targetType: 'task',
      targetId: financeTask.taskId,
      payload: { findingId },
    });
    await transaction.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `DEFINITION_REMEDIATION_DECISION:${findingId}`,
      sourceType: 'initiative',
      sourceId: envelope.aggregateId,
      sourceVersion: envelope.expectedVersion,
      targetType: 'decision',
      targetId: technicalDecision.decisionId,
      payload: { findingId },
    });
    const response = {
      initiativeId: envelope.aggregateId,
      findingId,
      taskId: financeTask.taskId,
      decisionId: technicalDecision.decisionId,
    };
    return {
      mutation: {
        ...initiative,
        workRefs: [...(initiative.workRefs ?? []), response],
      },
      response,
      eventType: 'initiative.definition-remediation.created',
      eventPayload: response,
      auditPayload: response,
    };
  });
}
