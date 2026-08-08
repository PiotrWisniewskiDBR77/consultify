import { describe, expect, it } from 'vitest';

import { normalizeMediaTags } from '../MediaLibraryBrowser';

describe('normalizeMediaTags', () => {
  it('accepts persisted JSON tag arrays returned by SQLite', () => {
    expect(normalizeMediaTags('["pitch deck","fizzup"]')).toEqual(['pitch deck', 'fizzup']);
  });

  it('keeps array values and ignores invalid empty tags', () => {
    expect(normalizeMediaTags([' launchforge ', '', null])).toEqual(['launchforge']);
  });

  it('falls back to legacy comma-separated values', () => {
    expect(normalizeMediaTags('product, investor, hero')).toEqual([
      'product',
      'investor',
      'hero',
    ]);
  });
});
