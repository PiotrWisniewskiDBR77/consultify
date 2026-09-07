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

export type RaidItemUpdatePayload = {
  initiativeId: string;
  title: string | null;
  description: string | null;
  status: 'OPEN' | 'MITIGATED' | 'REALIZED' | 'CLOSED' | null;
  probability: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  ownerId: string | null;
  dueDate: string | null;
  mitigationPlan: string | null;
};

/**
 * Kanoniczny (26A) zapis edycji pozycji RAID.
 *
 * POWOD: wycofanie `PATCH /api/initiatives/:id/raid/:raidId` (bramka
 * `requireCanonicalInitiativeExecutionWriter`) nie mialo nastepcy w Runtime-v1
 * — istnialy tylko create i delete. Bez tej komendy edycja RAID byla martwa
 * na obu drogach naraz: legacy 409, kanoniczna nieistniejaca.
 *
 * Pola `null` znacza "nie zmieniaj" (UPDATE ... COALESCE), tak samo jak w
 * wycofanym zapisie legacy, zeby czesciowa edycja z UI nie zerowala reszty.
 */
export async function updateRaidItem(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RaidItemUpdatePayload>
): Promise<MaterialCommandResult<RaidItemUpdatePayload & { raidItemId: string }>> {
  if (envelope.commandType !== 'raid-item.update' || envelope.aggregateType !== 'raid_item') {
    throw new MaterialCommandValidationError('Invalid RAID item update target');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    await tx.updateRaidItem({
      organizationId: envelope.organizationId,
      initiativeId: envelope.payload.initiativeId,
      raidItemId: envelope.aggregateId,
      title: envelope.payload.title,
      description: envelope.payload.description,
      status: envelope.payload.status,
      probability: envelope.payload.probability,
      impact: envelope.payload.severity,
      ownerId: envelope.payload.ownerId,
      dueDate: envelope.payload.dueDate,
      mitigationPlan: envelope.payload.mitigationPlan,
    });
    const state = { ...envelope.payload, raidItemId: envelope.aggregateId };
    return {
      mutation: state,
      response: state,
      eventType: 'raid-item.updated',
      eventPayload: state,
      auditPayload: { disposition: 'UPDATE_RAID_ITEM', after: state },
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
