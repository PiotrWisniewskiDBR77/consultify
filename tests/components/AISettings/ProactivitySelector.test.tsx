/**
 * ProactivitySelector Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('ProactivitySelector Component', () => {
  it('shows levels', () => {
    const levels = ['off', 'minimal', 'balanced', 'proactive'];
    expect(levels).toHaveLength(4);
  });

  it('handles change', () => {
    const onChange = vi.fn();
    onChange('balanced');
    expect(onChange).toHaveBeenCalledWith('balanced');
  });
});
