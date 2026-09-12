import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  executeMaterialCommand,
  MaterialCommandValidationError,
  type MaterialCommandEnvelope,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
} from './materialCommand.js';

export class MilestoneNotFoundError extends MaterialCommandValidationError {}

export const MilestoneFieldsSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  actualDate: z.string().nullable().optional(),
  status: z.string().optional(),
  orderIndex: z.number().int().optional(),
  isGate: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  rebaselineDecision: z
    .object({
      approvedBy: z.string().optional(),
      reason: z.string().optional(),
      decisionId: z.string().optional(),
      resetBaseline: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});
export type MilestoneFields = z.infer<typeof MilestoneFieldsSchema>;
export type MilestoneMutation = {
  initiativeId: string;
  operation: 'create' | 'update' | 'delete';
  fields: MilestoneFields;
};
export type MilestoneRecord = MilestoneFields & {
  id: string;
  initiativeId: string;
  deleted?: true;
  createdAt?: string;
};
export interface MilestoneTransaction extends MaterialCommandTransaction {
  writeInitiativeMilestone(
    input: MilestoneMutation & {
      organizationId: string;
      actorId: string;
      itemId: string;
    }
  ): Promise<MilestoneRecord>;
}
function supportsMilestones(tx: MaterialCommandTransaction): tx is MilestoneTransaction {
  return 'writeInitiativeMilestone' in tx && typeof tx.writeInitiativeMilestone === 'function';
}
/** Same transaction owns projection, aggregate CAS, receipt, audit and outbox. */
export async function writeMilestone(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<MilestoneMutation>
) {
  if (
    envelope.aggregateType !== 'initiative_milestone' ||
    envelope.commandType !== `initiative-milestone.${envelope.payload.operation}`
  ) {
    throw new MaterialCommandValidationError('Invalid initiative milestone command');
  }
  MilestoneFieldsSchema.parse(envelope.payload.fields);
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    if (!supportsMilestones(tx)) {
      throw new MaterialCommandValidationError('Budget item projection writer is not configured');
    }
    const state = await tx.writeInitiativeMilestone({
      ...envelope.payload,
      organizationId: envelope.organizationId,
      actorId: envelope.actorId,
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

export async function writeLegacyMilestone(
  unitOfWork: MaterialCommandUnitOfWork,
  input: {
    organizationId: string;
    actorId: string;
    initiativeId: string;
    operation: MilestoneMutation['operation'];
    fields: MilestoneFields;
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
          'initiative_milestone',
          itemId
        );
        if (!state?.deleted) break;
        const version = await tx.getAggregateVersion(
          input.organizationId,
          'initiative_milestone',
          itemId
        );
        const identityHash = createHash('sha256')
          .update(JSON.stringify([input.organizationId, itemId, version]))
          .digest('hex');
        itemId = `milestone-recreate-${identityHash}`;
        clientRequestId = `milestone-recreate-${identityHash}`;
      }
    }
    const current =
      (await tx.getAggregateVersion(input.organizationId, 'initiative_milestone', itemId)) ?? 0;
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
  return writeMilestone(unitOfWork, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    aggregateType: 'initiative_milestone',
    aggregateId: identity.itemId,
    expectedVersion: identity.expectedVersion,
    clientRequestId: identity.clientRequestId,
    correlationId: input.clientRequestId,
    policyId: 'execution-control',
    policyVersion: 1,
    commandType: `initiative-milestone.${input.operation}`,
    createIfMissing: true,
    payload: { initiativeId: input.initiativeId, operation: input.operation, fields: input.fields },
  });
}
