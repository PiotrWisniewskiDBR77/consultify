/**
 * Unit coverage for the recents reducer powering the Ideas "Recently opened"
 * rail (M2 home shell).
 */

import { describe, expect, it } from 'vitest';

import { MAX_RECENT_IDEAS, computeNextRecents } from '@/components/MyWork/hooks/useRecentIdeas';

describe('computeNextRecents', () => {
  it('prepends a new id (most-recent-first)', () => {
    expect(computeNextRecents(['b', 'c'], 'a')).toEqual(['a', 'b', 'c']);
  });

  it('dedupes: re-opening an existing id moves it to the front', () => {
    expect(computeNextRecents(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('caps the list at the max length', () => {
    const prev = Array.from({ length: MAX_RECENT_IDEAS }, (_, i) => `id-${i}`);
    const next = computeNextRecents(prev, 'fresh');
    expect(next).toHaveLength(MAX_RECENT_IDEAS);
    expect(next[0]).toBe('fresh');
    expect(next).not.toContain(`id-${MAX_RECENT_IDEAS - 1}`); // oldest dropped
  });

  it('ignores empty ids', () => {
    expect(computeNextRecents(['a'], '')).toEqual(['a']);
  });

  it('respects a custom max', () => {
    expect(computeNextRecents(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });
});
