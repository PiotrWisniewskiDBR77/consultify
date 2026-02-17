/**
 * Real Rate Limiting Tests (P0)
 *
 * Tests the ACTUAL rateLimiting.middleware.ts logic.
 * Verifies:
 * - Request counting
 * - Limit enforcement (429 Too Many Requests)
 * - Header injection (X-RateLimit-Remaining)
 * - Bypass in test environment (default) vs Active in Prod
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Real Rate Limiting (P0)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const createRes = () => {
    const res: any = {
      headers: {} as Record<string, unknown>,
      statusCode: 200,
      body: undefined as unknown,
      setHeader(name: string, value: unknown) {
        res.headers[String(name).toLowerCase()] = value;
      },
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(payload: unknown) {
        res.body = payload;
        return res;
      },
    };
    return res;
  };

  const createReq = (overrides: Partial<any> = {}) => {
    const req: any = {
      method: 'GET',
      ip: undefined,
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
      ...overrides,
    };
    return req;
  };

  const loadLimiters = async () => {
    const mod = await import('../../server/src/middleware/rateLimiting.middleware');
    return {
      defaultRateLimiter: mod.defaultRateLimiter,
      aiMemoryRateLimiter: mod.aiMemoryRateLimiter,
    };
  };

  it('bypasses limiter in NODE_ENV=test (no header injection, just next())', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.resetModules();

    const req = createReq({ socket: { remoteAddress: '10.0.0.1' } });
    const res = createRes();
    const next = vi.fn();

    const { defaultRateLimiter } = await loadLimiters();
    defaultRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.headers).not.toHaveProperty('x-ratelimit-limit');
    expect(res.headers).not.toHaveProperty('x-ratelimit-remaining');
  });

  it('injects headers and blocks after max is exceeded (aiMemory limiter in prod)', async () => {
    vi.stubEnv('NODE_ENV', 'production'); // Enable limiter with max=20 at module init time
    vi.resetModules();

    const req = createReq({
      socket: { remoteAddress: `172.16.${Math.floor(Math.random() * 255)}.1` },
    });
    const next = vi.fn();

    const { aiMemoryRateLimiter } = await loadLimiters();

    // First 20 requests should pass
    for (let i = 0; i < 20; i++) {
      const res = createRes();
      aiMemoryRateLimiter(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.headers).toHaveProperty('x-ratelimit-limit');
      expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    }

    // Next should be blocked
    const blocked = createRes();
    aiMemoryRateLimiter(req, blocked, next);

    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
  });
});
