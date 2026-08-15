import { describe, expect, it } from 'vitest';

import { Api } from '@/services/api';

describe('Api inbox V8 fallback guard', () => {
  it('never turns a canonical failure into a legacy false-green Inbox', () => {
    for (const status of [400, 404, 405, 429, 500, 501, 503]) {
      expect(Api.shouldFallbackToLegacyMyWorkInbox({ status })).toBe(false);
    }
    expect(Api.shouldFallbackToLegacyMyWorkInbox(undefined)).toBe(false);
  });
});
