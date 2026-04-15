import { describe, expect, it } from 'vitest';

import {
  buildCaseInsensitiveUserEmailLookupQuery,
  normalizeAuthEmail,
} from '../../../../server/src/utils/authEmail.js';

describe('authEmail helpers', () => {
  it('normalizes auth emails case-insensitively', () => {
    expect(normalizeAuthEmail(' DrDioniz@gmail.com ')).toBe('drdioniz@gmail.com');
  });

  it('builds a shared case-insensitive users lookup query', () => {
    expect(buildCaseInsensitiveUserEmailLookupQuery('id, email, status')).toBe(
      'SELECT id, email, status FROM users WHERE LOWER(email) = LOWER(?)'
    );
  });
});
