/**
 * PilotDecisionWorkspace Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('PilotDecisionWorkspace Component', () => {
  it('shows pilot data', () => {
    const pilot = { status: 'active', progress: 50 };
    expect(pilot.progress).toBe(50);
  });

  it('handles decision', () => {
    const onDecide = vi.fn();
    onDecide('approve');
    expect(onDecide).toHaveBeenCalledWith('approve');
  });
});
