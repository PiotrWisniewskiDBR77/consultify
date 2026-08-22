import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/domain/initiatives-execution/materialCommand', async (load) => {
  const actual =
    await load<typeof import('../../../server/src/domain/initiatives-execution/materialCommand')>();
  return {
    ...actual,
    executeMaterialCommand: vi.fn(async (_uow, envelope, prepare) => {
      const prepared = await prepare((_uow as any).transaction);
      return {
        status: 'APPLIED',
        aggregateVersion: envelope.expectedVersion + 1,
        response: prepared.response,
      };
    }),
  };
});

import { amendInitiativeMetadata } from '../../../server/src/domain/initiatives-execution/amendInitiativeMetadata';
import { cancelInitiative } from '../../../server/src/domain/initiatives-execution/cancelInitiative';

const initiative = {
  initiativeId: 'init-1',
  lifecycleState: 'REGISTERED_DRAFT',
  title: 'Old',
  problem: 'Old problem',
  proposedOutcome: null,
  projectId: 'project-1',
  initiativeOwnerId: 'owner-1',
  readiness: 'NOT_EVALUATED',
  source: {
    proposalId: 'p-1',
    proposalVersion: 1,
    sourceType: 'MANUAL_HUB',
    sourceId: 's-1',
    sourceVersion: 1,
  },
};
const uow = (value: unknown) =>
  ({ transaction: { getAggregatePayload: vi.fn().mockResolvedValue(value) } }) as any;
const envelope = (commandType: string, payload: unknown) => ({
  organizationId: 'org-1',
  actorId: 'actor-1',
  aggregateType: 'initiative',
  aggregateId: 'init-1',
  expectedVersion: 1,
  clientRequestId: 'request-1',
  correlationId: 'correlation-1',
  policyId: 'policy-1',
  policyVersion: 1,
  commandType,
  payload,
});

describe('Initiatives Hub canonical commands', () => {
  it('amends only canonical metadata while preserving lifecycle/source', async () => {
    const result = await amendInitiativeMetadata(
      uow(initiative),
      envelope('initiative.metadata.amend', { title: 'New', initiativeOwnerId: 'owner-2' }) as any
    );
    expect(result.response).toMatchObject({
      title: 'New',
      initiativeOwnerId: 'owner-2',
      lifecycleState: 'REGISTERED_DRAFT',
      source: initiative.source,
    });
  });

  it('cancels an allowed state with immutable cancellation evidence', async () => {
    const result = await cancelInitiative(
      uow(initiative),
      envelope('initiative.cancel', { reason: 'No longer aligned' }) as any
    );
    expect(result.response).toMatchObject({
      lifecycleState: 'CANCELLED',
      cancellation: { reason: 'No longer aligned', cancelledBy: 'actor-1' },
    });
  });

  it('rejects cancellation after execution scheduling', async () => {
    await expect(
      cancelInitiative(
        uow({ ...initiative, lifecycleState: 'SCHEDULED' }),
        envelope('initiative.cancel', { reason: 'Late' }) as any
      )
    ).rejects.toThrow('cannot be cancelled');
  });
});
