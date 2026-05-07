import { describe, expect, it } from 'vitest';

import {
  evaluateRevertEligibility,
  type RevertSnapshotInput,
} from '../presentationDeckRevertService.js';

function buildInput(overrides: Partial<RevertSnapshotInput> = {}): RevertSnapshotInput {
  const base: RevertSnapshotInput = {
    operation: {
      id: 'op-1',
      deckId: 'deck-1',
      organizationId: 'org-1',
      status: 'applied',
      originalDeckJson: '{"cards":[]}',
      versionBefore: 3,
      createdAt: '2026-05-01T10:00:00.000Z',
    },
    deck: { id: 'deck-1', organizationId: 'org-1' },
    requestOrgId: 'org-1',
    newerAppliedOperationsCount: 0,
  };
  return {
    ...base,
    ...overrides,
    operation: { ...base.operation, ...(overrides.operation || {}) },
    deck: { ...base.deck, ...(overrides.deck || {}) },
  };
}

describe('evaluateRevertEligibility', () => {
  it('marks an applied operation with snapshot as eligible (happy path)', () => {
    const result = evaluateRevertEligibility(buildInput());
    expect(result).toEqual({ eligible: true });
  });

  it('rejects when operation status is draft (not applied)', () => {
    const result = evaluateRevertEligibility(
      buildInput({ operation: { status: 'draft' } as any })
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('operation_not_applied');
  });

  it('rejects when operation belongs to a different organization', () => {
    const result = evaluateRevertEligibility(
      buildInput({ operation: { organizationId: 'org-other' } as any })
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('operation_org_mismatch');
  });

  it('rejects when originalDeckJson snapshot is missing', () => {
    const result = evaluateRevertEligibility(
      buildInput({ operation: { originalDeckJson: null } as any })
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no_snapshot');
  });

  it('rejects when newer applied operations exist on the same deck', () => {
    const result = evaluateRevertEligibility(buildInput({ newerAppliedOperationsCount: 2 }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('newer_operation_exists');
  });

  it('rejects when operation.deckId does not match the loaded deck (deck_not_found)', () => {
    const result = evaluateRevertEligibility(
      buildInput({ operation: { deckId: 'deck-other' } as any })
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('deck_not_found');
  });

  it('treats accepted status as eligible too', () => {
    const result = evaluateRevertEligibility(
      buildInput({ operation: { status: 'accepted' } as any })
    );
    expect(result).toEqual({ eligible: true });
  });

  it('treats empty string snapshot as no_snapshot', () => {
    const result = evaluateRevertEligibility(
      buildInput({ operation: { originalDeckJson: '   ' } as any })
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no_snapshot');
  });
});
