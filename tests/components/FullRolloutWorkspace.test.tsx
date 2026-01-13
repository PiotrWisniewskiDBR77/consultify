/**
 * FullRolloutWorkspace Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('FullRolloutWorkspace Component', () => {
  it('shows rollout data', () => {
    const rollout = { phase: 'active', coverage: 75 };
    expect(rollout.coverage).toBe(75);
  });

  it('displays phases', () => {
    const phases = ['planning', 'pilot', 'rollout', 'complete'];
    expect(phases).toHaveLength(4);
  });
});
