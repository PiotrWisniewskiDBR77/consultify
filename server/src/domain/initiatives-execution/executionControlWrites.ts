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

export async function voidExecutionBudgetEntry(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{ initiativeId: string }>
): Promise<
  MaterialCommandResult<
    ExecutionBudgetEntry & { status: 'VOIDED'; voidedAt: string; voidedBy: string }
  >
> {
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    const current = await tx.getAggregatePayload<ExecutionBudgetEntry>(
      envelope.organizationId,
      'execution_budget_entry',
      envelope.aggregateId
    );
    if (!current || current.initiativeId !== envelope.payload.initiativeId)
      throw new MaterialCommandValidationError('Budget entry not found');
    const voided = {
      ...current,
      status: 'VOIDED' as const,
      voidedAt: new Date().toISOString(),
      voidedBy: envelope.actorId,
    };
    return {
      mutation: voided,
      response: voided,
      eventType: 'execution-budget-entry.voided',
      eventPayload: voided,
      auditPayload: voided,
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

export interface ManagerExecutionAction {
  managerActionId: string;
  initiativeId: string;
  laneId: string;
  problemId: string;
  actionId: string;
  rationale: string | null;
  executedBy: string;
  executedAt: string;
}

type ManagerActionPayload = Omit<
  ManagerExecutionAction,
  'managerActionId' | 'executedBy' | 'executedAt'
>;

export async function executeCanonicalManagerAction(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ManagerActionPayload>
): Promise<MaterialCommandResult<ManagerExecutionAction>> {
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    const initiative = await tx.getRelatedAggregateForUpdate<Record<string, unknown>>(
      envelope.organizationId,
      'initiative',
      envelope.payload.initiativeId
    );
    if (!initiative) throw new MaterialCommandValidationError('Initiative not found');
    const action: ManagerExecutionAction = {
      ...envelope.payload,
      managerActionId: envelope.aggregateId,
      executedBy: envelope.actorId,
      executedAt: new Date().toISOString(),
    };
    return {
      mutation: action,
      response: action,
      eventType: 'manager-action.executed',
      eventPayload: action,
      auditPayload: action,
    };
  });
}

export interface ManagerSuggestionReview {
  suggestionId: string;
  initiativeId: string;
  laneId: string;
  outcome: 'APPROVE' | 'DEFER';
  notes: string | null;
  reviewedBy: string;
  reviewedAt: string;
}

type ManagerSuggestionPayload = Omit<ManagerSuggestionReview, 'reviewedBy' | 'reviewedAt'>;

export async function reviewManagerSuggestion(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ManagerSuggestionPayload>
): Promise<MaterialCommandResult<ManagerSuggestionReview>> {
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    const initiative = await tx.getRelatedAggregateForUpdate<Record<string, unknown>>(
      envelope.organizationId,
      'initiative',
      envelope.payload.initiativeId
    );
    if (!initiative) throw new MaterialCommandValidationError('Initiative not found');
    const review: ManagerSuggestionReview = {
      ...envelope.payload,
      reviewedBy: envelope.actorId,
      reviewedAt: new Date().toISOString(),
    };
    return {
      mutation: review,
      response: review,
      eventType: 'manager-suggestion.reviewed',
      eventPayload: review,
      auditPayload: review,
    };
  });
}
