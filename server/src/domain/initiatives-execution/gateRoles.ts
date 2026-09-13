import { z } from 'zod';
import {
  executeMaterialCommand,
  MaterialCommandValidationError,
  type MaterialCommandEnvelope,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
} from './materialCommand.js';

export const GateRolesSchema = z.array(
  z.object({ gateRole: z.string().min(1), userId: z.string().min(1) })
);
export type GateRoleAssignment = z.infer<typeof GateRolesSchema>[number];
export class GateRolesNotFoundError extends MaterialCommandValidationError {}
export type GateRolesPayload = { initiativeId: string; roles: GateRoleAssignment[] };
interface GateRolesTransaction extends MaterialCommandTransaction {
  replaceInitiativeGateRoles(
    input: GateRolesPayload & { organizationId: string; actorId: string }
  ): Promise<{
    roles: Array<GateRoleAssignment & { id: string }>;
    previousRoles: GateRoleAssignment[];
  }>;
}
function supportsGateRoles(tx: MaterialCommandTransaction): tx is GateRolesTransaction {
  return 'replaceInitiativeGateRoles' in tx && typeof tx.replaceInitiativeGateRoles === 'function';
}
export async function replaceGateRoles(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<GateRolesPayload>
) {
  if (
    envelope.aggregateType !== 'initiative_gate_role_profile' ||
    envelope.commandType !== 'initiative-gate-roles.replace'
  )
    throw new MaterialCommandValidationError('Invalid gate role profile command');
  GateRolesSchema.parse(envelope.payload.roles);
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    if (!supportsGateRoles(tx))
      throw new MaterialCommandValidationError('Gate role profile writer is not configured');
    const result = await tx.replaceInitiativeGateRoles({
      ...envelope.payload,
      organizationId: envelope.organizationId,
      actorId: envelope.actorId,
    });
    const state = { initiativeId: envelope.payload.initiativeId, roles: result.roles };
    return {
      mutation: state,
      response: state,
      eventType: 'initiative-gate-roles.replaced',
      eventPayload: state,
      auditPayload: {
        disposition: 'REPLACE_GATE_ROLE_PROFILE',
        before: result.previousRoles,
        after: result.roles,
      },
    };
  });
}
export async function replaceLegacyGateRoles(
  unitOfWork: MaterialCommandUnitOfWork,
  input: GateRolesPayload & {
    organizationId: string;
    actorId: string;
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
  const identity = await unitOfWork.transaction(async (tx) => {
    const version =
      (await tx.getAggregateVersion(
        input.organizationId,
        'initiative_gate_role_profile',
        input.initiativeId
      )) ?? 0;
    let clientRequestId = input.clientRequestId;
    if (!input.hasIdempotencyKey) {
      const prior = await tx.findReceipt(
        input.organizationId,
        `${clientRequestId}-v${Math.max(0, version - 1)}`
      );
      clientRequestId += `-v${input.expectedVersion ?? (prior?.aggregateVersion === version ? Math.max(0, version - 1) : version)}`;
    }
    const receipt = await tx.findReceipt(input.organizationId, clientRequestId);
    return {
      clientRequestId,
      expectedVersion: input.expectedVersion ?? (receipt ? receipt.aggregateVersion - 1 : version),
    };
  });
  return replaceGateRoles(unitOfWork, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    aggregateType: 'initiative_gate_role_profile',
    aggregateId: input.initiativeId,
    expectedVersion: identity.expectedVersion,
    clientRequestId: identity.clientRequestId,
    correlationId: input.clientRequestId,
    policyId: 'execution-control',
    policyVersion: 1,
    commandType: 'initiative-gate-roles.replace',
    createIfMissing: true,
    payload: { initiativeId: input.initiativeId, roles: input.roles },
  });
}
