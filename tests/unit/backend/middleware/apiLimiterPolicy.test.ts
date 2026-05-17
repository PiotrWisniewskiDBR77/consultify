import { afterEach, describe, expect, it, vi } from 'vitest';

import { getApiLimiterLimit } from '../../../../server/src/utils/apiLimiterPolicy';

describe('apiLimiterPolicy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps non-production API traffic on the high development limit', () => {
    expect(getApiLimiterLimit({} as any, false)).toBe(20000);
  });

  it('uses API_RATE_LIMIT_MAX for authenticated production API traffic', () => {
    vi.stubEnv('API_RATE_LIMIT_MAX', '2500');

    expect(getApiLimiterLimit({ _rateLimitUserId: 'user-1' } as any, true)).toBe(2500);
  });

  it('uses API_RATE_LIMIT_MAX for anonymous production API traffic', () => {
    vi.stubEnv('API_RATE_LIMIT_MAX', '750');

    expect(getApiLimiterLimit({} as any, true)).toBe(750);
  });

  it('ignores invalid API_RATE_LIMIT_MAX values and preserves production defaults', () => {
    vi.stubEnv('API_RATE_LIMIT_MAX', 'not-a-number');

    expect(getApiLimiterLimit({ _rateLimitUserId: 'user-1' } as any, true)).toBe(1000);
    expect(getApiLimiterLimit({} as any, true)).toBe(300);
  });

  it('keeps stage-like authenticated production traffic on the staging-safe limit', () => {
    vi.stubEnv('API_RATE_LIMIT_MAX', '2500');
    vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', 'staging');

    expect(getApiLimiterLimit({ _rateLimitUserId: 'user-1' } as any, true)).toBe(20000);
  });
});
