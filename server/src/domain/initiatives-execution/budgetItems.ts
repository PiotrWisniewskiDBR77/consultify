import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  executeMaterialCommand,
  MaterialCommandValidationError,
  MaterialCommandRuleError,
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
  writeInitiativeBudgetItem(
    input: BudgetItemMutation & {
      organizationId: string;
      itemId: string;
    }
  ): Promise<BudgetItemRecord>;
}
function supportsBudgetItems(tx: MaterialCommandTransaction): tx is BudgetItemTransaction {
  return 'writeInitiativeBudgetItem' in tx && typeof tx.writeInitiativeBudgetItem === 'function';
}
/** Same transaction owns projection, aggregate CAS, receipt, audit and outbox. */
export async function writeBudgetItem(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<BudgetItemMutation>
) {
  if (
    envelope.aggregateType !== 'initiative_budget_item' ||
    envelope.commandType !== `initiative-budget-item.${envelope.payload.operation}`
  ) {
    throw new MaterialCommandValidationError('Invalid initiative budget item command');
  }
  BudgetItemFieldsSchema.parse(envelope.payload.fields);
  const initiative = await unitOfWork.transaction((tx) =>
    tx.getAggregatePayload<{ status?: string; lifecycleState?: string }>(
      envelope.organizationId,
      'initiative',
      envelope.payload.initiativeId
    )
  );
  if (initiative?.status === 'ARCHIVED' || initiative?.lifecycleState === 'ARCHIVED') {
    throw new MaterialCommandRuleError('INITIATIVE_ARCHIVED_READ_ONLY', 409);
  }

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
    organizationId: string;
    actorId: string;
    initiativeId: string;
    operation: BudgetItemMutation['operation'];
    fields: BudgetItemFields;
    itemId: string;
    clientRequestId: string;
    expectedVersion?: number;
    hasIdempotencyKey?: boolean;
  }
) {
  if (
    input.expectedVersion !== undefined &&
    (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0)
  ) {
    throw new MaterialCommandValidationError(
      'expectedCanonicalVersion must be a non-negative integer'
    );
  }
  const identity = await unitOfWork.transaction(async (tx) => {
    let itemId = input.itemId;
    let clientRequestId = input.clientRequestId;
    if (input.operation === 'create' && !input.hasIdempotencyKey) {
      // A content-derived create identifies the live item. After deletion, a
      // new incarnation gets a new deterministic identity instead of replaying
      // a receipt whose projection no longer exists. Same payload+live item
      // remains intentionally deduplicated; distinct intent needs a key.
      for (let generation = 0; ; generation++) {
        if (generation > 1000)
          throw new MaterialCommandValidationError(
            'Create history exceeds safe replay depth; supply an Idempotency-Key'
          );
        const state = await tx.getAggregatePayload<{ deleted?: boolean }>(
          input.organizationId,
          'initiative_budget_item',
          itemId
        );
        if (!state?.deleted) break;
        const version = await tx.getAggregateVersion(
          input.organizationId,
          'initiative_budget_item',
          itemId
        );
        const identityHash = createHash('sha256')
          .update(JSON.stringify([input.organizationId, itemId, version]))
          .digest('hex');
        itemId = `budget-recreate-${identityHash}`;
        clientRequestId = `budget-recreate-${identityHash}`;
      }
    }
    const current =
      (await tx.getAggregateVersion(input.organizationId, 'initiative_budget_item', itemId)) ?? 0;
    if (!input.hasIdempotencyKey && input.operation !== 'create') {
      if (input.expectedVersion !== undefined) clientRequestId += `-v${input.expectedVersion}`;
      else {
        const previous = await tx.findReceipt(
          input.organizationId,
          `${clientRequestId}-v${Math.max(0, current - 1)}`
        );
        clientRequestId += `-v${previous?.aggregateVersion === current ? Math.max(0, current - 1) : current}`;
      }
    }
    const receipt = await tx.findReceipt(input.organizationId, clientRequestId);
    return {
      itemId,
      clientRequestId,
      expectedVersion: input.expectedVersion ?? (receipt ? receipt.aggregateVersion - 1 : current),
    };
  });
  return writeBudgetItem(unitOfWork, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    aggregateType: 'initiative_budget_item',
    aggregateId: identity.itemId,
    expectedVersion: identity.expectedVersion,
    clientRequestId: identity.clientRequestId,
    correlationId: input.clientRequestId,
    policyId: 'execution-control',
    policyVersion: 1,
    commandType: `initiative-budget-item.${input.operation}`,
    createIfMissing: true,
    payload: { initiativeId: input.initiativeId, operation: input.operation, fields: input.fields },
  });
}
