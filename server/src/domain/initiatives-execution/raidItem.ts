import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type RaidItemCreatePayload = {
  initiativeId: string;
  type: 'RISK' | 'ASSUMPTION' | 'ISSUE' | 'DEPENDENCY';
  title: string;
  description: string | null;
  status: 'OPEN' | 'MITIGATED' | 'REALIZED' | 'CLOSED';
  probability: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  ownerId: string | null;
  dueDate: string | null;
  mitigationPlan: string | null;
  linkedItems: string[];
};

export type RaidItemDeletePayload = { initiativeId: string };

export async function createRaidItem(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RaidItemCreatePayload>
): Promise<MaterialCommandResult<RaidItemCreatePayload & { raidItemId: string }>> {
  if (envelope.commandType !== 'raid-item.create' || envelope.aggregateType !== 'raid_item') {
    throw new MaterialCommandValidationError('Invalid RAID item create target');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    await tx.createRaidItem({
      organizationId: envelope.organizationId,
      initiativeId: envelope.payload.initiativeId,
      raidItemId: envelope.aggregateId,
      type: envelope.payload.type,
      title: envelope.payload.title,
      description: envelope.payload.description,
      status: envelope.payload.status,
      probability: envelope.payload.probability,
      impact: envelope.payload.severity,
      ownerId: envelope.payload.ownerId,
      dueDate: envelope.payload.dueDate,
      mitigationPlan: envelope.payload.mitigationPlan,
      linkedItems: envelope.payload.linkedItems,
    });
    const state = { ...envelope.payload, raidItemId: envelope.aggregateId };
    return {
      mutation: state,
      response: state,
      eventType: 'raid-item.created',
      eventPayload: state,
      auditPayload: { disposition: 'CREATE_RAID_ITEM', before: null, after: state },
    };
  });
}

export async function deleteRaidItem(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RaidItemDeletePayload>
): Promise<MaterialCommandResult<{ raidItemId: string; deleted: true }>> {
  if (envelope.commandType !== 'raid-item.delete' || envelope.aggregateType !== 'raid_item') {
    throw new MaterialCommandValidationError('Invalid RAID item delete target');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    await tx.deleteRaidItem({
      organizationId: envelope.organizationId,
      initiativeId: envelope.payload.initiativeId,
      raidItemId: envelope.aggregateId,
    });
    const state = { raidItemId: envelope.aggregateId, deleted: true as const };
    return {
      mutation: state,
      response: state,
      eventType: 'raid-item.deleted',
      eventPayload: state,
      auditPayload: { disposition: 'DELETE_RAID_ITEM', after: state },
    };
  });
}
