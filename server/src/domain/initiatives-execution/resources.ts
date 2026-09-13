import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  executeMaterialCommand,
  MaterialCommandValidationError,
  type MaterialCommandEnvelope,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
} from './materialCommand.js';

export class ResourceNotFoundError extends MaterialCommandValidationError {}

export const ResourceFieldsSchema = z.object({
  userId: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  role: z.string().min(1).optional(),
  allocationPercentage: z.number().finite().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z.string().optional(),
  idempotencyKey: z.string().optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type ResourceFields = z.infer<typeof ResourceFieldsSchema>;
export type ResourceMutation = {
  initiativeId: string;
  operation: 'create' | 'update' | 'delete';
  fields: ResourceFields;
};
export type ResourceRecord = ResourceFields & {
  id: string;
  initiativeId: string;
  deleted?: true;
  version?: number;
};
export interface ResourceTransaction extends MaterialCommandTransaction {
  writeInitiativeResource(
    input: ResourceMutation & {
      organizationId: string;
      itemId: string;
    }
  ): Promise<ResourceRecord>;
}
function supportsResources(tx: MaterialCommandTransaction): tx is ResourceTransaction {
  return 'writeInitiativeResource' in tx && typeof tx.writeInitiativeResource === 'function';
}
/** Same transaction owns projection, aggregate CAS, receipt, audit and outbox. */
export async function writeResource(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ResourceMutation>
) {
  if (
    envelope.aggregateType !== 'initiative_resource' ||
    envelope.commandType !== `initiative-resource.${envelope.payload.operation}`
  ) {
    throw new MaterialCommandValidationError('Invalid initiative resource command');
  }
  ResourceFieldsSchema.parse(envelope.payload.fields);
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    if (!supportsResources(tx)) {
      throw new MaterialCommandValidationError('Budget item projection writer is not configured');
    }
    const state = await tx.writeInitiativeResource({
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

export async function writeLegacyResource(
  unitOfWork: MaterialCommandUnitOfWork,
  input: {
    organizationId: string;
    actorId: string;
    initiativeId: string;
    operation: ResourceMutation['operation'];
    fields: ResourceFields;
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
          'initiative_resource',
          itemId
        );
        if (!state?.deleted) break;
        const version = await tx.getAggregateVersion(
          input.organizationId,
          'initiative_resource',
          itemId
        );
        const identityHash = createHash('sha256')
          .update(JSON.stringify([input.organizationId, itemId, version]))
          .digest('hex');
        itemId = `resource-recreate-${identityHash}`;
        clientRequestId = `resource-recreate-${identityHash}`;
      }
    }
    const current =
      (await tx.getAggregateVersion(input.organizationId, 'initiative_resource', itemId)) ?? 0;
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
  return writeResource(unitOfWork, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    aggregateType: 'initiative_resource',
    aggregateId: identity.itemId,
    expectedVersion: identity.expectedVersion,
    clientRequestId: identity.clientRequestId,
    correlationId: input.clientRequestId,
    policyId: 'execution-control',
    policyVersion: 1,
    commandType: `initiative-resource.${input.operation}`,
    createIfMissing: true,
    payload: { initiativeId: input.initiativeId, operation: input.operation, fields: input.fields },
  });
}
