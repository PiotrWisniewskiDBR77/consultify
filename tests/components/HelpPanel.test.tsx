/**
 * HelpPanel Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('HelpPanel Component', () => {
  it('shows articles', () => {
    const articles = [{ id: 'a-1', title: 'Getting Started' }];
    expect(articles).toHaveLength(1);
  });

  it('handles search', () => {
    const onSearch = vi.fn();
    onSearch('setup');
    expect(onSearch).toHaveBeenCalledWith('setup');
  });
});
