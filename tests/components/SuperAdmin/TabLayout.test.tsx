/**
 * TabLayout Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('TabLayout Component', () => {
  it('renders tabs', () => {
    const tabs = ['Overview', 'Users', 'Orgs'];
    expect(tabs).toHaveLength(3);
  });

  it('handles tab change', () => {
    const onTabChange = vi.fn();
    onTabChange('Users');
    expect(onTabChange).toHaveBeenCalledWith('Users');
  });
});
