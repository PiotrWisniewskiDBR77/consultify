/**
 * Unit coverage for the favorites toggle powering the Ideas "Starred" feature
 * (M2 home shell).
 */

import { describe, expect, it } from 'vitest';

import { toggleFavoriteId } from '@/components/MyWork/hooks/useFavoriteIdeas';

describe('toggleFavoriteId', () => {
  it('adds an id when absent', () => {
    expect(toggleFavoriteId(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes an id when present', () => {
    expect(toggleFavoriteId(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('is its own inverse (toggle twice = no-op)', () => {
    const once = toggleFavoriteId(['a'], 'b');
    const twice = toggleFavoriteId(once, 'b');
    expect(twice).toEqual(['a']);
  });

  it('ignores empty ids', () => {
    expect(toggleFavoriteId(['a'], '')).toEqual(['a']);
  });
});
