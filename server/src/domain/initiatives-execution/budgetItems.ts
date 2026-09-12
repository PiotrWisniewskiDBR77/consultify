import { z } from 'zod';
import {
  executeMaterialCommand,
  MaterialCommandValidationError,
  type MaterialCommandEnvelope,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
} from './materialCommand.js';

export class BudgetItemNotFoundError extends MaterialCommandValidationError {}

export const BudgetItemFieldsSchema = z.object({
  category: z.string().max(100).optional(),
  costType: z.string().max(40).optional(),
  amount: z.number().finite().optional(),
  currency: z.string().min(1).max(10).optional(),
  description: z.string().nullable().optional(),
  source: z.string().max(100).optional(),
});
export type BudgetItemFields = z.infer<typeof BudgetItemFieldsSchema>;
export type BudgetItemMutation = {
  initiativeId: string;
  operation: 'create' | 'update' | 'delete';
  fields: BudgetItemFields;
};
export type BudgetItemRecord = BudgetItemFields & {
  id: string;
  initiativeId: string;
  deleted?: true;
};
export interface BudgetItemTransaction extends MaterialCommandTransaction {
  writeInitiativeBudgetItem(input: BudgetItemMutation & {
    organizationId: string;
    itemId: string;
  }): Promise<BudgetItemRecord>;
}
function supportsBudgetItems(tx: MaterialCommandTransaction): tx is BudgetItemTransaction {
  return 'writeInitiativeBudgetItem' in tx && typeof tx.writeInitiativeBudgetItem === 'function';
}
/** Same transaction owns projection, aggregate CAS, receipt, audit and outbox. */
export async function writeBudgetItem(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<BudgetItemMutation>
) {
  if (envelope.aggregateType !== 'initiative_budget_item' ||
      envelope.commandType !== `initiative-budget-item.${envelope.payload.operation}`) {
    throw new MaterialCommandValidationError('Invalid initiative budget item command');
  }
  BudgetItemFieldsSchema.parse(envelope.payload.fields);
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    if (!supportsBudgetItems(tx)) {
      throw new MaterialCommandValidationError('Budget item projection writer is not configured');
    }
    const state = await tx.writeInitiativeBudgetItem({
      ...envelope.payload,
      organizationId: envelope.organizationId,
      itemId: envelope.aggregateId,
    });
    return {
      mutation: state,
      response: state,
      eventType: envelope.commandType,
      eventPayload: state,
      auditPayload: { disposition: envelope.commandType, after: state },
    };
  });
}

export async function writeLegacyBudgetItem(
  unitOfWork: MaterialCommandUnitOfWork,
  input: {
    organizationId: string; actorId: string; initiativeId: string;
    operation: BudgetItemMutation['operation']; fields: BudgetItemFields;
    itemId: string; clientRequestId: string; expectedVersion?: number;
  }
) {
  // Legacy callers do not yet send canonical versions. Resolve a prior receipt
  // first so a retry reuses the original expectedVersion and fingerprint.
  // Without an explicit expectedVersion this retains last-writer-wins; callers
  // using the canonical endpoint must always provide their observed version.
  const expectedVersion = input.expectedVersion ?? await unitOfWork.transaction(async tx => {
    const receipt = await tx.findReceipt(input.organizationId, input.clientRequestId);
    return receipt ? receipt.aggregateVersion - 1 :
      (await tx.getAggregateVersion(input.organizationId, 'initiative_budget_item', input.itemId)) ?? 0;
  });
  return writeBudgetItem(unitOfWork, {
    organizationId: input.organizationId, actorId: input.actorId,
    aggregateType: 'initiative_budget_item', aggregateId: input.itemId,
    expectedVersion, clientRequestId: input.clientRequestId, correlationId: input.clientRequestId,
    policyId: 'execution-control', policyVersion: 1,
    commandType: `initiative-budget-item.${input.operation}`, createIfMissing: true,
    payload: {initiativeId: input.initiativeId, operation: input.operation, fields: input.fields},
  });
}
