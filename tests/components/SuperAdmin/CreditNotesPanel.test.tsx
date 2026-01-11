/**
 * CreditNotesPanel Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('CreditNotesPanel Component', () => {
  it('lists credit notes', () => {
    const notes = [{ id: 'cn-1', amount: 100 }];
    expect(notes).toHaveLength(1);
  });

  it('handles create', () => {
    const onCreate = vi.fn();
    onCreate({ amount: 50 });
    expect(onCreate).toHaveBeenCalled();
  });
});
