import { describe, expect, it, vi } from 'vitest';

function makeRes() {
  const res: any = {};
  res.headers = {};
  res.setHeader = vi.fn((k: string, v: any) => {
    res.headers[String(k).toLowerCase()] = String(v);
  });
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  res.end = vi.fn(() => res);
  return res;
}

describe('rateLimiting.middleware (L1)', () => {
  it('resolveLimiterParams falls back for invalid numeric options', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

    expect(mod.__private__.resolveLimiterParams(Number.NaN, 100)).toEqual({
      windowMs: 15 * 60_000,
      max: 100,
    });
    expect(mod.__private__.resolveLimiterParams(60_000, -1)).toEqual({
      windowMs: 60_000,
      max: 1,
    });
    expect(mod.__private__.resolveLimiterParams(0, 0)).toEqual({
      windowMs: 15 * 60_000,
      max: 1,
    });
    expect(mod.__private__.toSafeNonNegativeIntCount(Number.NaN)).toBe(0);
    expect(mod.__private__.toSafeNonNegativeIntCount(12.9)).toBe(12);
    expect(mod.__private__.toSafeNonNegativeIntSeconds(Number.POSITIVE_INFINITY)).toBe(0);
    expect(mod.__private__.toSafeNonNegativeIntSeconds(1.1)).toBe(2);
    expect(mod.__private__.resolveLimiterParams(365 * 24 * 60 * 60_000, 100)).toEqual({
      windowMs: mod.__private__.MAX_RATE_LIMIT_WINDOW_MS,
      max: 100,
    });
    expect(mod.__private__.resolveLimiterParams(60_000, 2_000_000_000)).toEqual({
      windowMs: 60_000,
      max: mod.__private__.MAX_RATE_LIMIT_MAX,
    });
  });

  it('is a no-op in NODE_ENV=test', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const next = vi.fn();
      const req: any = {
        method: 'GET',
        ip: '1.1.1.1',
        headers: {},
        socket: {},
        user: { id: 'u1' },
      };

      mod.defaultRateLimiter(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('is a no-op when DISABLE_RATE_LIMIT=true', async () => {
    const prev = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.DISABLE_RATE_LIMIT = 'true';
      process.env.RATE_LIMIT_ALLOW_PROD_DISABLE = 'true';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const next = vi.fn();
      const req: any = {
        method: 'GET',
        ip: '1.1.1.1',
        headers: {},
        socket: {},
        user: { id: 'u1' },
      };

      mod.defaultRateLimiter(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    } finally {
      process.env = prev;
    }
  });

  it('does not disable limiter in production without explicit RATE_LIMIT_ALLOW_PROD_DISABLE', async () => {
    const prev = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.DISABLE_RATE_LIMIT = 'true';
      delete process.env.RATE_LIMIT_ALLOW_PROD_DISABLE;
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const next = vi.fn();
      const req: any = {
        method: 'GET',
        ip: '1.1.1.1',
        headers: {},
        socket: {},
        user: { id: 'u1' },
      };

      mod.defaultRateLimiter(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.headers['x-ratelimit-limit']).toBe('300');
    } finally {
      process.env = prev;
    }
  });

  it('is a no-op for OPTIONS requests', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const next = vi.fn();
      const req: any = { method: 'OPTIONS', ip: '1.1.1.1', headers: {}, socket: {} };

      mod.defaultRateLimiter(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('does not throw when next is missing for OPTIONS request', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const req: any = { method: 'OPTIONS', ip: '1.1.1.1', headers: {}, socket: {} };

      expect(() => mod.defaultRateLimiter(req, res as any, undefined as any)).not.toThrow();
      expect(res.status).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('is a no-op for OPTIONS when req.method accessor throws', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const next = vi.fn();
      const req: any = { ip: '1.1.1.1', headers: {}, socket: {} };
      Object.defineProperty(req, 'method', {
        configurable: true,
        get: () => {
          throw new Error('method getter failed');
        },
      });

      mod.defaultRateLimiter(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('fails open to next when Date.now throws during limiter evaluation', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    // Import before replacing the global clock. Logger transports initialize
    // during module loading and legitimately read Date.now themselves; the
    // fault injection is intended for limiter evaluation only.
    const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('clock failure');
    });
    try {
      const res = makeRes();
      const next = vi.fn();
      const req: any = { method: 'GET', ip: '6.6.6.6', headers: {}, socket: {} };

      expect(() => mod.defaultRateLimiter(req, res as any, next as any)).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
      process.env.NODE_ENV = prev;
    }
  });

  it('limits in production and sets rate limit headers', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const next = vi.fn();
      const req: any = { method: 'GET', ip: '2.2.2.2', headers: {}, socket: {} };

      mod.defaultRateLimiter(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.headers['x-ratelimit-limit']).toBe('300');
      expect(Number(res.headers['x-ratelimit-remaining'])).toBe(299);
      expect(Number(res.headers['x-ratelimit-reset'])).toBeGreaterThan(0);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('uses userId when available for keying (apiAuthRateLimiter)', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = { method: 'GET', ip: '9.9.9.9', headers: {}, socket: {}, userId: 'u-123' };
      const res1 = makeRes();
      const next1 = vi.fn();
      mod.apiAuthRateLimiter(req, res1 as any, next1 as any);
      expect(next1).toHaveBeenCalledTimes(1);
      expect(res1.headers['x-ratelimit-limit']).toBe('12000');

      const res2 = makeRes();
      const next2 = vi.fn();
      mod.apiAuthRateLimiter(req, res2 as any, next2 as any);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(Number(res2.headers['x-ratelimit-remaining'])).toBeLessThan(
        Number(res1.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('prefers _rateLimitUserId over req.userId for keying consistency', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: {},
        socket: {},
        _rateLimitUserId: 'user-from-rate-limit-middleware',
        userId: 'user-from-auth',
      };
      const res1 = makeRes();
      const next1 = vi.fn();
      mod.apiAuthRateLimiter(req, res1 as any, next1 as any);
      expect(next1).toHaveBeenCalledTimes(1);

      const req2: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: {},
        socket: {},
        _rateLimitUserId: 'user-from-rate-limit-middleware',
        userId: 'another-user-from-auth',
      };
      const res2 = makeRes();
      const next2 = vi.fn();
      mod.apiAuthRateLimiter(req2, res2 as any, next2 as any);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(Number(res2.headers['x-ratelimit-remaining'])).toBeLessThan(
        Number(res1.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('falls back to req.user.id when req.userId accessor throws', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: {},
        socket: {},
        user: { id: 'u-from-user' },
      };
      Object.defineProperty(req, 'userId', {
        configurable: true,
        get: () => {
          throw new Error('userId getter failed');
        },
      });

      const res1 = makeRes();
      const next1 = vi.fn();
      mod.apiAuthRateLimiter(req, res1 as any, next1 as any);
      expect(next1).toHaveBeenCalledTimes(1);

      const res2 = makeRes();
      const next2 = vi.fn();
      mod.apiAuthRateLimiter(req, res2 as any, next2 as any);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(Number(res2.headers['x-ratelimit-remaining'])).toBeLessThan(
        Number(res1.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('uses decoded bearer token user id for keying before auth middleware runs', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({
        default: { decode: vi.fn(() => ({ id: 'u-token' })) },
        decode: vi.fn(() => ({ id: 'u-token' })),
      }));
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: { authorization: 'Bearer jwt-token' },
        socket: {},
      };
      const res1 = makeRes();
      const next1 = vi.fn();
      mod.apiAuthRateLimiter(req, res1 as any, next1 as any);
      expect(next1).toHaveBeenCalledTimes(1);

      const res2 = makeRes();
      const next2 = vi.fn();
      mod.apiAuthRateLimiter(req, res2 as any, next2 as any);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(Number(res2.headers['x-ratelimit-remaining'])).toBeLessThan(
        Number(res1.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('skips jwt.decode when extracted token exceeds decode safety length', async () => {
    const prev = process.env.NODE_ENV;
    const decodeSpy = vi.fn(() => ({ id: 'should-not-run' }));
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({
        default: { decode: decodeSpy },
        decode: decodeSpy,
      }));
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: { authorization: `Bearer ${'x'.repeat(16385)}` },
        socket: {},
      };
      const res = makeRes();
      const next = vi.fn();

      mod.apiAuthRateLimiter(req, res as any, next as any);

      expect(next).toHaveBeenCalledTimes(1);
      expect(decodeSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('falls back to decoded userId when decoded id accessor throws', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => {
        const decodedPayload: any = { userId: 'u-token-fallback' };
        Object.defineProperty(decodedPayload, 'id', {
          configurable: true,
          get: () => {
            throw new Error('id getter failed');
          },
        });
        return {
          default: { decode: vi.fn(() => decodedPayload) },
          decode: vi.fn(() => decodedPayload),
        };
      });
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: { authorization: 'Bearer jwt-token' },
        socket: {},
      };
      const res1 = makeRes();
      const next1 = vi.fn();
      mod.apiAuthRateLimiter(req, res1 as any, next1 as any);
      expect(next1).toHaveBeenCalledTimes(1);

      const res2 = makeRes();
      const next2 = vi.fn();
      mod.apiAuthRateLimiter(req, res2 as any, next2 as any);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(Number(res2.headers['x-ratelimit-remaining'])).toBeLessThan(
        Number(res1.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('trims decoded token subject before using it as key', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({
        default: { decode: vi.fn(() => ({ sub: '  u-token-trimmed  ' })) },
        decode: vi.fn(() => ({ sub: '  u-token-trimmed  ' })),
      }));
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: { authorization: 'Bearer jwt-token' },
        socket: {},
      };
      const res1 = makeRes();
      const next1 = vi.fn();
      mod.apiAuthRateLimiter(req, res1 as any, next1 as any);
      expect(next1).toHaveBeenCalledTimes(1);

      const req2: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: { authorization: 'Bearer jwt-token' },
        socket: {},
      };
      const res2 = makeRes();
      const next2 = vi.fn();
      mod.apiAuthRateLimiter(req2, res2 as any, next2 as any);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(Number(res2.headers['x-ratelimit-remaining'])).toBeLessThan(
        Number(res1.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('uses decoded cookie token user id for keying before auth middleware runs', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({
        default: { decode: vi.fn(() => ({ userId: 'u-cookie' })) },
        decode: vi.fn(() => ({ userId: 'u-cookie' })),
      }));
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: {},
        cookies: { access_token: 'cookie-jwt' },
        socket: {},
      };
      const res = makeRes();
      const next = vi.fn();
      mod.apiAuthRateLimiter(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.headers['x-ratelimit-limit']).toBe('12000');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('falls back to cookies.token when cookies.access_token accessor throws', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({
        default: { decode: vi.fn(() => ({ userId: 'u-cookie-fallback' })) },
        decode: vi.fn(() => ({ userId: 'u-cookie-fallback' })),
      }));
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const cookies: any = {};
      Object.defineProperty(cookies, 'access_token', {
        configurable: true,
        get: () => {
          throw new Error('access_token getter failed');
        },
      });
      Object.defineProperty(cookies, 'token', {
        configurable: true,
        get: () => 'cookie-token-fallback',
      });
      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        headers: {},
        cookies,
        socket: {},
      };
      const res = makeRes();
      const next = vi.fn();

      mod.apiAuthRateLimiter(req, res as any, next as any);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.headers['x-ratelimit-limit']).toBe('12000');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('falls back to cookie token when authorization header accessor throws', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({
        default: { decode: vi.fn(() => ({ id: 'u-cookie-fallback' })) },
        decode: vi.fn(() => ({ id: 'u-cookie-fallback' })),
      }));
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const req: any = {
        method: 'GET',
        ip: '9.9.9.9',
        cookies: { token: 'cookie-jwt-fallback' },
        socket: {},
      };
      Object.defineProperty(req, 'headers', {
        configurable: true,
        get: () => {
          throw new Error('headers getter failed');
        },
      });
      const res = makeRes();
      const next = vi.fn();

      mod.apiAuthRateLimiter(req, res as any, next as any);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.headers['x-ratelimit-limit']).toBe('12000');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('extracts token and forwarded IP from header arrays', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({
        default: { decode: vi.fn(() => ({ id: 'u-array-header' })) },
        decode: vi.fn(() => ({ id: 'u-array-header' })),
      }));
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        headers: {
          authorization: ['Bearer', 'Bearer jwt-array-token'],
          'x-forwarded-for': ['8.8.8.8, 10.0.0.1'],
        },
        socket: {},
      };
      const res = makeRes();
      const next = vi.fn();

      mod.apiAuthRateLimiter(req, res as any, next as any);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.headers['x-ratelimit-limit']).toBe('12000');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('uses first non-empty entry from x-forwarded-for header array', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const req: any = {
        method: 'GET',
        headers: { 'x-forwarded-for': ['', '11.11.11.11, 10.0.0.2'] },
        socket: {},
      };
      const res = makeRes();
      const next = vi.fn();

      mod.defaultRateLimiter(req, res as any, next as any);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.headers['x-ratelimit-limit']).toBe('300');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('ignores x-forwarded-for spoofing when trust proxy is disabled', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const reqA: any = {
        method: 'GET',
        ip: undefined,
        headers: { 'x-forwarded-for': '9.9.9.9' },
        socket: { remoteAddress: '10.0.0.1' },
        app: { get: () => false },
      };
      const reqB: any = {
        method: 'GET',
        ip: undefined,
        headers: { 'x-forwarded-for': '8.8.8.8' },
        socket: { remoteAddress: '10.0.0.1' },
        app: { get: () => false },
      };

      const resA = makeRes();
      const resB = makeRes();
      mod.defaultRateLimiter(reqA, resA as any, vi.fn() as any);
      mod.defaultRateLimiter(reqB, resB as any, vi.fn() as any);

      expect(Number(resB.headers['x-ratelimit-remaining'])).toBeLessThan(
        Number(resA.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('uses x-forwarded-for when trust proxy is enabled', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const reqA: any = {
        method: 'GET',
        ip: undefined,
        headers: { 'x-forwarded-for': '9.9.9.9' },
        socket: { remoteAddress: '10.0.0.1' },
        app: { get: () => true },
      };
      const reqB: any = {
        method: 'GET',
        ip: undefined,
        headers: { 'x-forwarded-for': '8.8.8.8' },
        socket: { remoteAddress: '10.0.0.1' },
        app: { get: () => true },
      };

      const resA = makeRes();
      const resB = makeRes();
      mod.defaultRateLimiter(reqA, resA as any, vi.fn() as any);
      mod.defaultRateLimiter(reqB, resB as any, vi.fn() as any);

      expect(Number(resB.headers['x-ratelimit-remaining'])).toBe(
        Number(resA.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('normalizes forwarded IPv4 host:port so equivalent client maps to same limiter key', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const reqA: any = {
        method: 'GET',
        ip: undefined,
        headers: { 'x-forwarded-for': '9.9.9.9:12345' },
        socket: { remoteAddress: '10.0.0.1' },
        app: { get: () => true },
      };
      const reqB: any = {
        method: 'GET',
        ip: undefined,
        headers: { 'x-forwarded-for': '9.9.9.9' },
        socket: { remoteAddress: '10.0.0.1' },
        app: { get: () => true },
      };

      const resA = makeRes();
      const resB = makeRes();
      mod.defaultRateLimiter(reqA, resA as any, vi.fn() as any);
      mod.defaultRateLimiter(reqB, resB as any, vi.fn() as any);

      expect(Number(resB.headers['x-ratelimit-remaining'])).toBeLessThan(
        Number(resA.headers['x-ratelimit-remaining'])
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('continues when setHeader throws', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const req: any = { method: 'GET', ip: '7.7.7.7', headers: {}, socket: {} };
      const res: any = makeRes();
      res.setHeader = vi.fn(() => {
        throw new Error('setHeader failed');
      });
      const next = vi.fn();

      mod.defaultRateLimiter(req, res as any, next as any);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('returns 429 when exceeding auth limiter max (prod)', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const req: any = { method: 'POST', ip: '3.3.3.3', headers: {}, socket: {} };

      let lastRes: any;
      for (let i = 0; i < 16; i++) {
        const res = makeRes();
        const next = vi.fn();
        mod.authRateLimiter(req, res as any, next as any);
        lastRes = res;
      }

      expect(lastRes.statusCode).toBe(429);
      expect(lastRes.body).toEqual(
        expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: expect.any(Number),
        })
      );
      expect(lastRes.headers['retry-after']).toBe(String(lastRes.body.retryAfter));
      expect(lastRes.body.retryAfter).toBeGreaterThanOrEqual(1);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('keeps over-limit counter clamped after first 429 burst', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const req: any = { method: 'POST', ip: '33.33.33.33', headers: {}, socket: {} };

      for (let i = 0; i < 16; i++) {
        mod.authRateLimiter(req, makeRes() as any, vi.fn() as any);
      }
      const baseline = mod.__private__.getStoreSize();

      for (let i = 0; i < 200; i++) {
        const res = makeRes();
        mod.authRateLimiter(req, res as any, vi.fn() as any);
        expect(res.statusCode).toBe(429);
      }

      expect(mod.__private__.getStoreSize()).toBe(baseline);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('calls next and avoids 429 body write when headers are already sent', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const req: any = { method: 'POST', ip: '13.13.13.13', headers: {}, socket: {} };

      let lastRes: any;
      let lastNext: any;
      for (let i = 0; i < 16; i++) {
        const res = makeRes();
        const next = vi.fn();
        if (i === 15) {
          res.headersSent = true;
        }
        mod.authRateLimiter(req, res as any, next as any);
        lastRes = res;
        lastNext = next;
      }

      expect(lastNext).toHaveBeenCalledTimes(1);
      expect(lastRes.status).not.toHaveBeenCalled();
      expect(lastRes.json).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('clamps retry-after to minimum 1 second when over limit at window boundary', async () => {
    const prev = process.env.NODE_ENV;
    const baseNow = 1_700_000_000_000;
    const windowMs = 15 * 60_000;
    const dateNowSpy = vi.spyOn(Date, 'now');
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const req: any = { method: 'POST', ip: '31.31.31.31', headers: {}, socket: {} };

      let nowCall = 0;
      dateNowSpy.mockImplementation(() => {
        nowCall += 1;
        if (nowCall <= 15) return baseNow;
        if (nowCall === 16) return baseNow + windowMs - 1;
        return baseNow + windowMs;
      });
      for (let i = 0; i < 16; i++) {
        if (i < 15) {
          mod.authRateLimiter(req, makeRes() as any, vi.fn() as any);
          continue;
        }
        const res = makeRes();
        const next = vi.fn();
        mod.authRateLimiter(req, res as any, next as any);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(429);
        expect(res.headers['retry-after']).toBe('1');
        expect(res.body.retryAfter).toBe(1);
      }
    } finally {
      dateNowSpy.mockRestore();
      process.env.NODE_ENV = prev;
    }
  });

  it('fails closed when 429 json write throws', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const req: any = { method: 'POST', ip: '32.32.32.32', headers: {}, socket: {} };

      for (let i = 0; i < 15; i++) {
        mod.authRateLimiter(req, makeRes() as any, vi.fn() as any);
      }

      const res = makeRes();
      const next = vi.fn();
      res.json = vi.fn(() => {
        throw new Error('json failed');
      });

      mod.authRateLimiter(req, res as any, next as any);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('covers store cleanup interval (deletes expired entries)', async () => {
    const prevEnv = process.env.NODE_ENV;
    vi.useFakeTimers();
    try {
      process.env.NODE_ENV = 'production';
      vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const req: any = { method: 'GET', ip: '4.4.4.4', headers: {}, socket: {} };

      mod.defaultRateLimiter(req, makeRes() as any, vi.fn() as any);

      // Move beyond the limiter window (15 min) and allow the 60s cleanup interval to run.
      vi.setSystemTime(new Date('2020-01-01T00:20:00.000Z'));
      vi.advanceTimersByTime(60_000);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('unrefs cleanup interval so it does not pin event loop', async () => {
    const prev = process.env.NODE_ENV;
    const unrefSpy = vi.fn();
    const handle = { unref: unrefSpy } as unknown as NodeJS.Timeout;
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(handle);

    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      expect(setIntervalSpy).toHaveBeenCalled();
      expect(unrefSpy).toHaveBeenCalledTimes(1);
    } finally {
      setIntervalSpy.mockRestore();
      process.env.NODE_ENV = prev;
    }
  });

  it('clears previous cleanup interval on module reload before starting a new one', async () => {
    const prev = process.env.NODE_ENV;
    const unrefSpy = vi.fn();
    const handle = { unref: unrefSpy } as unknown as NodeJS.Timeout;
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(handle);
    const clearIntervalSpy = vi
      .spyOn(globalThis, 'clearInterval')
      .mockImplementation(() => undefined);

    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      vi.resetModules();
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      expect(setIntervalSpy).toHaveBeenCalledTimes(2);
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(clearIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(unrefSpy).toHaveBeenCalledTimes(2);
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      process.env.NODE_ENV = prev;
    }
  });

  it('caps oversized ip key material so suffix-only differences share a bucket', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const sharedPrefix = '5.5.5.5-' + 'a'.repeat(300);
      const reqA: any = { method: 'GET', ip: `${sharedPrefix}-x`, headers: {}, socket: {} };
      const reqB: any = { method: 'GET', ip: `${sharedPrefix}-y`, headers: {}, socket: {} };
      const resA = makeRes();
      const nextA = vi.fn();
      mod.defaultRateLimiter(reqA, resA as any, nextA as any);
      expect(nextA).toHaveBeenCalledTimes(1);
      const remainingA = Number(resA.headers['x-ratelimit-remaining']);

      const resB = makeRes();
      const nextB = vi.fn();
      mod.defaultRateLimiter(reqB, resB as any, nextB as any);
      expect(nextB).toHaveBeenCalledTimes(1);
      const remainingB = Number(resB.headers['x-ratelimit-remaining']);

      expect(remainingB).toBeLessThan(remainingA);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('caps oversized user-id key material so suffix-only differences share a bucket', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      const sharedPrefix = 'user-' + 'a'.repeat(300);
      const reqA: any = {
        method: 'GET',
        userId: `${sharedPrefix}-x`,
        headers: {},
        socket: {},
      };
      const reqB: any = {
        method: 'GET',
        userId: `${sharedPrefix}-y`,
        headers: {},
        socket: {},
      };

      const resA = makeRes();
      const nextA = vi.fn();
      mod.apiAuthRateLimiter(reqA, resA as any, nextA as any);
      expect(nextA).toHaveBeenCalledTimes(1);
      const remainingA = Number(resA.headers['x-ratelimit-remaining']);

      const resB = makeRes();
      const nextB = vi.fn();
      mod.apiAuthRateLimiter(reqB, resB as any, nextB as any);
      expect(nextB).toHaveBeenCalledTimes(1);
      const remainingB = Number(resB.headers['x-ratelimit-remaining']);

      expect(remainingB).toBeLessThan(remainingA);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('enforces in-memory store cap for unique key bursts', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

      for (let i = 0; i < 50_200; i++) {
        const req: any = {
          method: 'GET',
          ip: `198.18.${Math.floor(i / 255)}.${i % 255}`,
          headers: {},
          socket: {},
        };
        mod.defaultRateLimiter(req, makeRes() as any, vi.fn() as any);
      }

      expect(mod.__private__.getStoreSize()).toBeLessThanOrEqual(50_000);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
