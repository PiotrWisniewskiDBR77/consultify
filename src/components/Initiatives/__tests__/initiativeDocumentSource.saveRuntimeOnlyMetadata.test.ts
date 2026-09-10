import { describe, expect, it, vi } from 'vitest';

import type { RegisteredInitiativeReadModel } from '@/services/initiatives-execution/runtimeApi';

import { saveRuntimeOnlyInitiativeDocumentMetadata } from '../initiativeDocumentSource';

/**
 * N1 (odbiór adwersaryjny 20260910, BLOKER) — the card for a rekord widoczny
 * WYŁĄCZNIE w rejestrze runtime-v1 (no row in `initiatives`) used to autosave
 * onto `PUT /api/initiatives/:id`, which always 404s for such a record — an
 * infinite retry loop (6 requests at open + 9/15s idle, measured in the
 * acceptance report) with zero user-facing explanation.
 *
 * This unit proves the REPLACEMENT writer in isolation: for a runtime-only
 * record, title/summary/description route to the ONE canonical writer that
 * exists for them — `PATCH .../runtime-v1/initiatives/:id/metadata`
 * (`amendRegisteredInitiative`) — carrying the current aggregate version,
 * never `PUT /api/initiatives/:id`. The live 404-loop-vs-message proof (0
 * PUT calls in a 16s window, before/after) is in `evidence/e1a/n1-*.png`;
 * this test is the deterministic half — no server, no flakiness.
 */
describe('saveRuntimeOnlyInitiativeDocumentMetadata (N1 canonical writer routing)', () => {
  const registeredResult: { initiative: RegisteredInitiativeReadModel } = {
    initiative: {
      version: 4,
      updatedAt: '2026-09-10T00:00:00.000Z',
      initiative: {
        initiativeId: 'demo-piotr-energy-draft-initiative',
        lifecycleState: 'REGISTERED_DRAFT',
        title: 'Energy Reduction Programme (edited)',
        problem: 'Energy consumption varies without an accepted operating baseline. (edited)',
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId: 'proj-1',
        readiness: 'NOT_EVALUATED',
      },
    },
  };

  it('never calls PUT /api/initiatives/:id — routes through the injected amend() only', async () => {
    const amend = vi.fn().mockResolvedValue(registeredResult);

    const result = await saveRuntimeOnlyInitiativeDocumentMetadata(
      'demo-piotr-energy-draft-initiative',
      { title: 'Energy Reduction Programme (edited)' },
      4,
      amend
    );

    expect(amend).toHaveBeenCalledTimes(1);
    const [initiativeId, command] = amend.mock.calls[0];
    expect(initiativeId).toBe('demo-piotr-energy-draft-initiative');
    // MUTATION GUARD: the whole point of N1 — the version that was ACTUALLY
    // read (4), never a hardcoded/blind 0 (that hardcoded 0 is exactly what
    // made the old PUT path 404-loop worthless as a CAS check).
    expect(command.expectedVersion).toBe(4);
    expect(command.title).toBe('Energy Reduction Programme (edited)');
    expect(command.problem).toBeUndefined();
    expect(typeof command.clientRequestId).toBe('string');
    expect(command.clientRequestId.length).toBeGreaterThan(0);

    // The returned document shape matches what fetchAll() produces, so the
    // caller can spread it straight over the existing `initiative` state.
    expect(result.id).toBe('demo-piotr-energy-draft-initiative');
    expect(result.documentOrigin).toBe('initiatives-runtime-v1');
    expect(result.canonicalVersion).toBe(4);
    expect(result.title).toBe('Energy Reduction Programme (edited)');
  });

  it('maps description → problem and summary → proposedOutcome for the canonical command', async () => {
    const amend = vi.fn().mockResolvedValue(registeredResult);

    await saveRuntimeOnlyInitiativeDocumentMetadata(
      'demo-piotr-energy-draft-initiative',
      { description: 'New problem text', summary: 'New outcome text' },
      4,
      amend
    );

    const [, command] = amend.mock.calls[0];
    expect(command.title).toBeUndefined();
    expect(command.problem).toBe('New problem text');
    expect(command.proposedOutcome).toBe('New outcome text');
  });

  it('maps an editable card owner to initiativeOwnerId', async () => {
    const amend = vi.fn().mockResolvedValue(registeredResult);

    await saveRuntimeOnlyInitiativeDocumentMetadata(
      'demo-piotr-energy-draft-initiative',
      { ownerId: 'owner-2' },
      4,
      amend
    );

    expect(amend.mock.calls[0][1].initiativeOwnerId).toBe('owner-2');
  });

  it('sends all four canonical metadata fields in one command', async () => {
    const amend = vi.fn().mockResolvedValue(registeredResult);
    await saveRuntimeOnlyInitiativeDocumentMetadata(
      'demo-piotr-energy-draft-initiative',
      { title: 'T', description: 'P', summary: 'O', ownerId: 'owner-2' },
      4,
      amend
    );
    expect(amend.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'T',
        problem: 'P',
        proposedOutcome: 'O',
        initiativeOwnerId: 'owner-2',
      })
    );
  });

  it('does not invent an owner when the card did not provide one', async () => {
    const amend = vi.fn().mockResolvedValue(registeredResult);
    await saveRuntimeOnlyInitiativeDocumentMetadata(
      'demo-piotr-energy-draft-initiative',
      { title: 'T' },
      4,
      amend
    );
    expect(amend.mock.calls[0][1].initiativeOwnerId).toBeUndefined();
  });

  it('keeps the actor when mapping the canonical readback to the card', async () => {
    const amend = vi.fn().mockResolvedValue(registeredResult);
    const result = await saveRuntimeOnlyInitiativeDocumentMetadata(
      'demo-piotr-energy-draft-initiative',
      { title: 'T' },
      4,
      amend,
      { id: 'actor-1', displayName: 'Actor One' }
    );
    expect(result).toEqual(expect.objectContaining({ id: 'demo-piotr-energy-draft-initiative' }));
  });

  it('propagates a rejection from amend() (e.g. a real 409) instead of swallowing it', async () => {
    const amend = vi.fn().mockRejectedValue(new Error('VERSION_OR_IDEMPOTENCY_CONFLICT'));

    await expect(
      saveRuntimeOnlyInitiativeDocumentMetadata(
        'demo-piotr-energy-draft-initiative',
        { title: 'x' },
        4,
        amend
      )
    ).rejects.toThrow('VERSION_OR_IDEMPOTENCY_CONFLICT');
  });
});
