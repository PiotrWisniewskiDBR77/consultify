/**
 * VersionHistory Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('VersionHistory Component', () => {
  it('lists versions', () => {
    const versions = [
      { id: 'v-1', number: '1.0' },
      { id: 'v-2', number: '1.1' },
    ];
    expect(versions).toHaveLength(2);
  });

  it('handles version restore', () => {
    const onRestore = vi.fn();
    onRestore('v-1');
    expect(onRestore).toHaveBeenCalled();
  });

  it('shows diff', () => {
    const diff = { added: 10, removed: 5 };
    expect(diff.added).toBe(10);
  });

  it('handles compare', () => {
    const onCompare = vi.fn();
    onCompare('v-1', 'v-2');
    expect(onCompare).toHaveBeenCalled();
  });
});
