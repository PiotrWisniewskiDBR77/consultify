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

export interface ExecutionRealizationEntry {
  realizationId: string;
  initiativeId: string;
  periodMonth: string;
  realizedRevenueDelta: number | null;
  realizedCostDelta: number | null;
  realizedSavings: number | null;
  varianceNotes: string | null;
  recordedBy: string;
  recordedAt: string;
}

type RealizationPayload = Omit<
  ExecutionRealizationEntry,
  'realizationId' | 'recordedBy' | 'recordedAt'
>;

export async function recordExecutionRealization(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RealizationPayload>
): Promise<MaterialCommandResult<ExecutionRealizationEntry>> {
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    const initiative = await tx.getRelatedAggregateForUpdate<Record<string, unknown>>(
      envelope.organizationId,
      'initiative',
      envelope.payload.initiativeId
    );
    if (!initiative) throw new MaterialCommandValidationError('Initiative not found');
    const entry: ExecutionRealizationEntry = {
      ...envelope.payload,
      realizationId: envelope.aggregateId,
      recordedBy: envelope.actorId,
      recordedAt: new Date().toISOString(),
    };
    return {
      mutation: entry,
      response: entry,
      eventType: 'execution-realization.recorded',
      eventPayload: entry,
      auditPayload: entry,
    };
  });
}

export interface RaidMitigationRecord {
  raidItemId: string;
  initiativeId: string;
  mitigationPlan: string;
  responseStrategy: string;
  mitigationOwnerId: string;
  mitigationDueDate: string | null;
  mitigationStatus: string;
  recordedBy: string;
  recordedAt: string;
}

type RaidMitigationPayload = Omit<RaidMitigationRecord, 'recordedBy' | 'recordedAt'>;

export async function recordRaidMitigation(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RaidMitigationPayload>
): Promise<MaterialCommandResult<RaidMitigationRecord>> {
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    const initiative = await tx.getRelatedAggregateForUpdate<Record<string, unknown>>(
      envelope.organizationId,
      'initiative',
      envelope.payload.initiativeId
    );
    if (!initiative) throw new MaterialCommandValidationError('Initiative not found');
    const record: RaidMitigationRecord = {
      ...envelope.payload,
      recordedBy: envelope.actorId,
      recordedAt: new Date().toISOString(),
    };
    return {
      mutation: record,
      response: record,
      eventType: 'raid-mitigation.recorded',
      eventPayload: record,
      auditPayload: record,
    };
  });
}
