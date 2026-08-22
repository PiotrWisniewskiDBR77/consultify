import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { RegisteredInitiative } from './registerInitiative.js';

export interface AmendInitiativeMetadataPayload {
  title?: string;
  problem?: string;
  proposedOutcome?: string | null;
  initiativeOwnerId?: string;
}

const editableStates = new Set([
  'REGISTERED_DRAFT',
  'DEFINED',
  'ANALYZING',
  'READY_FOR_DECISION',
  'APPROVED_BACKLOG',
]);

export async function amendInitiativeMetadata(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<AmendInitiativeMetadataPayload>
): Promise<MaterialCommandResult<RegisteredInitiative>> {
  if (
    envelope.commandType !== 'initiative.metadata.amend' ||
    envelope.aggregateType !== 'initiative' ||
    envelope.createIfMissing
  ) {
    throw new MaterialCommandValidationError('Invalid Initiative metadata amend target');
  }
  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const current = await transaction.getAggregatePayload<RegisteredInitiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!current) throw new MaterialCommandValidationError('Initiative not found');
    if (!editableStates.has(current.lifecycleState))
      throw new MaterialCommandValidationError(
        'Initiative metadata is locked in this lifecycle state'
      );
    const mutation = { ...current };
    if (envelope.payload.title !== undefined) mutation.title = envelope.payload.title.trim();
    if (envelope.payload.problem !== undefined) mutation.problem = envelope.payload.problem.trim();
    if (envelope.payload.proposedOutcome !== undefined)
      mutation.proposedOutcome = envelope.payload.proposedOutcome?.trim() || null;
    if (envelope.payload.initiativeOwnerId !== undefined)
      mutation.initiativeOwnerId = envelope.payload.initiativeOwnerId.trim();
    if (!mutation.title || !mutation.problem || !mutation.initiativeOwnerId)
      throw new MaterialCommandValidationError('title, problem and initiativeOwnerId are required');
    return {
      mutation,
      response: mutation,
      eventType: 'initiative.metadata.amended',
      eventPayload: envelope.payload,
      auditPayload: { before: current, after: mutation },
    };
  });
}
