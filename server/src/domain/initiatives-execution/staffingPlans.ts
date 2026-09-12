import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  executeMaterialCommand,
  MaterialCommandValidationError,
  type MaterialCommandEnvelope,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
} from './materialCommand.js';
export class StaffingNotFoundError extends MaterialCommandValidationError {}
export const StaffingFieldsSchema = z.object({
  name: z.string().optional(),
  status: z.string().optional(),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  roleName: z.string().optional(),
  requiredSkills: z.array(z.string()).optional(),
  fteRequired: z.number().finite().optional(),
  fteAllocated: z.number().finite().optional(),
  assignedUserId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  priority: z.string().optional(),
});
export type StaffingFields = z.infer<typeof StaffingFieldsSchema>;
export type StaffingMutation = {
  initiativeId: string;
  planId: string;
  kind: 'plan' | 'role' | 'capacity';
  operation: 'create' | 'update' | 'delete' | 'sync';
  fields: StaffingFields;
};
export const staffingAggregateType = (kind: StaffingMutation['kind']) =>
  kind === 'plan'
    ? 'staffing_plan'
    : kind === 'role'
      ? 'staffing_plan_role'
      : 'initiative_capacity_snapshot';
interface StaffingTransaction extends MaterialCommandTransaction {
  writeStaffingProjection(
    input: StaffingMutation & { organizationId: string; actorId: string; itemId: string }
  ): Promise<Record<string, unknown>>;
}
function supportsStaffing(tx: MaterialCommandTransaction): tx is StaffingTransaction {
  return 'writeStaffingProjection' in tx && typeof tx.writeStaffingProjection === 'function';
}
export async function writeStaffing(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<StaffingMutation>
) {
  const p = envelope.payload;
  if (
    envelope.aggregateType !== staffingAggregateType(p.kind) ||
    envelope.commandType !== `staffing-${p.kind}.${p.operation}`
  )
    throw new MaterialCommandValidationError('Invalid staffing command');
  StaffingFieldsSchema.parse(p.fields);
  if (p.operation === 'create' && !(p.kind === 'plan' ? p.fields.name : p.fields.roleName)?.trim())
    throw new MaterialCommandValidationError('Name is required');
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    if (!supportsStaffing(tx))
      throw new MaterialCommandValidationError('Staffing projection writer is not configured');
    const state = await tx.writeStaffingProjection({
      ...p,
      organizationId: envelope.organizationId,
      actorId: envelope.actorId,
      itemId: envelope.aggregateId,
    });
    const { totalFteRequired: _required, totalFteAllocated: _allocated, ...metadata } = state;
    return {
      mutation: p.kind === 'plan' ? metadata : state,
      response: state,
      eventType: envelope.commandType,
      eventPayload: state,
      auditPayload: { disposition: envelope.commandType, after: state },
    };
  });
}
export async function writeLegacyStaffing(
  unitOfWork: MaterialCommandUnitOfWork,
  input: StaffingMutation & {
    organizationId: string;
    actorId: string;
    itemId: string;
    clientRequestId: string;
    expectedVersion?: number;
    hasIdempotencyKey: boolean;
  }
) {
  if (
    input.expectedVersion !== undefined &&
    (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0)
  )
    throw new MaterialCommandValidationError(
      'expectedCanonicalVersion must be a non-negative integer'
    );
  const type = staffingAggregateType(input.kind);
  const identity = await unitOfWork.transaction(async (tx) => {
    let itemId = input.itemId,
      clientRequestId = input.clientRequestId;
    if (input.operation === 'create' && !input.hasIdempotencyKey) {
      for (let generation = 0; ; generation++) {
        if (generation > 1000)
          throw new MaterialCommandValidationError('Supply an Idempotency-Key');
        const state = await tx.getAggregatePayload<{ deleted?: boolean }>(
          input.organizationId,
          type,
          itemId
        );
        if (!state?.deleted) break;
        const version = await tx.getAggregateVersion(input.organizationId, type, itemId);
        const hash = createHash('sha256')
          .update(JSON.stringify([input.organizationId, itemId, version]))
          .digest('hex');
        itemId = `staffing-recreate-${hash}`;
        clientRequestId = itemId;
      }
    }
    const version = (await tx.getAggregateVersion(input.organizationId, type, itemId)) ?? 0;
    if (input.operation !== 'create' && !input.hasIdempotencyKey) {
      const previous = await tx.findReceipt(
        input.organizationId,
        `${clientRequestId}-v${Math.max(0, version - 1)}`
      );
      clientRequestId += `-v${input.expectedVersion ?? (previous?.aggregateVersion === version ? Math.max(0, version - 1) : version)}`;
    }
    const receipt = await tx.findReceipt(input.organizationId, clientRequestId);
    return {
      itemId,
      clientRequestId,
      expectedVersion: input.expectedVersion ?? (receipt ? receipt.aggregateVersion - 1 : version),
    };
  });
  return writeStaffing(unitOfWork, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    aggregateType: type,
    aggregateId: identity.itemId,
    expectedVersion: identity.expectedVersion,
    clientRequestId: identity.clientRequestId,
    correlationId: input.clientRequestId,
    policyId: 'execution-control',
    policyVersion: 1,
    commandType: `staffing-${input.kind}.${input.operation}`,
    createIfMissing: true,
    payload: {
      initiativeId: input.initiativeId,
      planId: input.kind === 'plan' ? identity.itemId : input.planId,
      kind: input.kind,
      operation: input.operation,
      fields: input.fields,
    },
  });
}
