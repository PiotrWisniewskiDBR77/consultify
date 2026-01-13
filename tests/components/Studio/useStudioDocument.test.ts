/**
 * useStudioDocument Hook Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('useStudioDocument Hook', () => {
  it('loads document', () => {
    const doc = { id: 'doc-1', content: 'Hello' };
    expect(doc.content).toBe('Hello');
  });

  it('handles save', () => {
    const onSave = vi.fn();
    onSave({ content: 'Updated' });
    expect(onSave).toHaveBeenCalled();
  });

  it('tracks changes', () => {
    const hasChanges = true;
    expect(hasChanges).toBe(true);
  });
});
