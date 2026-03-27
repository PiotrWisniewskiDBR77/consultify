import { describe, expect, it } from 'vitest';

import { Api } from '@/services/api';

describe('Api inbox V8 fallback guard', () => {
  it('allows legacy inbox fallback only for bounded non-supported statuses', () => {
    expect(Api.shouldFallbackToLegacyMyWorkInbox({ status: 404 })).toBe(true);
    expect(Api.shouldFallbackToLegacyMyWorkInbox({ status: 405 })).toBe(true);
    expect(Api.shouldFallbackToLegacyMyWorkInbox({ status: 501 })).toBe(true);
  });

  it('prevents silent legacy inbox fallback on transient V8 failures', () => {
    expect(Api.shouldFallbackToLegacyMyWorkInbox({ status: 429 })).toBe(false);
    expect(Api.shouldFallbackToLegacyMyWorkInbox({ status: 503 })).toBe(false);
    expect(Api.shouldFallbackToLegacyMyWorkInbox({ status: 500 })).toBe(false);
  });
});
