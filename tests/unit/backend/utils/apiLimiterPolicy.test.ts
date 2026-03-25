import { describe, expect, it } from 'vitest';

import { buildApiLimiterKey, getApiLimiterLimit } from '../../../../server/src/utils/apiLimiterPolicy.ts';

describe('apiLimiterPolicy', () => {
  it('uses a higher global limit for authenticated requests', () => {
    const req: any = { _rateLimitUserId: 'user-1' };

    expect(getApiLimiterLimit(req, true)).toBe(1000);
    expect(getApiLimiterLimit(req, false)).toBe(20000);
  });

  it('keeps the anonymous production cap for requests without a user key', () => {
    const req: any = {};

    expect(getApiLimiterLimit(req, true)).toBe(300);
  });

  it('builds versioned user keys when rate limit user id exists', () => {
    const req: any = { _rateLimitUserId: 'user-1' };

    expect(buildApiLimiterKey(req)).toBe('api:v2:user:user-1');
  });

  it('falls back to versioned ip keys when no user id exists', () => {
    const req: any = {
      ip: '203.0.113.9',
      socket: {},
      headers: {},
    };

    expect(buildApiLimiterKey(req)).toMatch(/^api:v2:ip:/);
  });
});
