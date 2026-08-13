import { describe, expect, it } from 'vitest';
import { validateAccountableItems } from '../../../server/src/domain/initiatives-execution/handoffAcceptance';
describe('Handoff accountable gaps/blockers', () => {
  it('requires owner and valid due date', () => {
    expect(
      validateAccountableItems([
        { itemId: 'g1', description: 'Gap', ownerId: 'owner', dueAt: '2026-08-20T12:00:00Z' },
      ])
    ).toBe(true);
    expect(
      validateAccountableItems([
        { itemId: 'g1', description: 'Gap', ownerId: '', dueAt: 'invalid' },
      ])
    ).toBe(false);
  });
});
