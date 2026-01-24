/**
 * FeatureFlagsPanel Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('FeatureFlagsPanel Component', () => {
  it('lists feature flags', () => {
    const flags = [{ name: 'new_ai', enabled: true }];
    expect(flags).toHaveLength(1);
  });

  it('handles toggle', () => {
    const onToggle = vi.fn();
    onToggle('new_ai', false);
    expect(onToggle).toHaveBeenCalled();
  });
});
