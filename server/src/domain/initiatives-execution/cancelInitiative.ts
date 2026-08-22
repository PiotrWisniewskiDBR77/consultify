import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { RegisteredInitiative } from './registerInitiative.js';

export interface CancelInitiativePayload {
  reason: string;
}
const cancellableStates = new Set([
  'REGISTERED_DRAFT',
  'DEFINED',
  'ANALYZING',
  'READY_FOR_DECISION',
  'APPROVED_BACKLOG',
]);

export async function cancelInitiative(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<CancelInitiativePayload>
): Promise<MaterialCommandResult<RegisteredInitiative>> {
  if (
    envelope.commandType !== 'initiative.cancel' ||
    envelope.aggregateType !== 'initiative' ||
    envelope.createIfMissing
  )
    throw new MaterialCommandValidationError('Invalid Initiative cancel target');
  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const current = await transaction.getAggregatePayload<RegisteredInitiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!current) throw new MaterialCommandValidationError('Initiative not found');
    if (!cancellableStates.has(current.lifecycleState))
      throw new MaterialCommandValidationError(
        'Initiative cannot be cancelled in this lifecycle state'
      );
    const reason = envelope.payload.reason.trim();
    if (!reason) throw new MaterialCommandValidationError('Cancellation reason is required');
    const mutation = {
      ...current,
      lifecycleState: 'CANCELLED' as any,
      cancellation: {
        reason,
        cancelledBy: envelope.actorId,
        cancelledAt: new Date().toISOString(),
      },
    };
    return {
      mutation,
      response: mutation,
      eventType: 'initiative.cancelled',
      eventPayload: mutation.cancellation,
      auditPayload: { before: current, after: mutation },
    };
  });
}
