import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export interface ExecutionBudgetEntry {
  entryId: string;
  initiativeId: string;
  entryType: string;
  costType: string;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  periodMonth: number;
  periodYear: number;
  source: string;
  recordedBy: string;
  recordedAt: string;
}

type BudgetEntryPayload = Omit<ExecutionBudgetEntry, 'entryId' | 'recordedBy' | 'recordedAt'>;

export async function createExecutionBudgetEntry(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<BudgetEntryPayload>
): Promise<MaterialCommandResult<ExecutionBudgetEntry>> {
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    const initiative = await tx.getRelatedAggregateForUpdate<Record<string, unknown>>(
      envelope.organizationId,
      'initiative',
      envelope.payload.initiativeId
    );
    if (!initiative) throw new MaterialCommandValidationError('Initiative not found');
    const recordedAt = new Date().toISOString();
    const entry: ExecutionBudgetEntry = {
      ...envelope.payload,
      entryId: envelope.aggregateId,
      recordedBy: envelope.actorId,
      recordedAt,
    };
    return {
      mutation: entry,
      response: entry,
      eventType: 'execution-budget-entry.created',
      eventPayload: entry,
      auditPayload: entry,
    };
  });
}
