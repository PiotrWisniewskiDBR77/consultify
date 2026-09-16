import { describe, expect, it } from 'vitest';

import { queryString } from '../paramHelpers.js';

describe('queryString', () => {
  it('reads a route parameter before a same-named query value', () => {
    expect(
      queryString(
        {
          params: { id: 'route-id' },
          query: { id: 'query-id' },
        },
        'id'
      )
    ).toBe('route-id');
  });

  it('reads the first scalar value from an Express query array', () => {
    expect(queryString({ query: { status: ['pending', 'approved'] } }, 'status')).toBe('pending');
  });

  it('returns an empty string for absent and non-string values', () => {
    expect(queryString({ query: {} }, 'missing')).toBe('');
    expect(queryString({ query: { page: { nested: true } } }, 'page')).toBe('');
  });
});
