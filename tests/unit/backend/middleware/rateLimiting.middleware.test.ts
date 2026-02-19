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
  return res;
}

describe('rateLimiting.middleware (L1)', () => {
  it('is a no-op in NODE_ENV=test', async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const next = vi.fn();
      const req: any = { method: 'GET', ip: '1.1.1.1', headers: {}, socket: {}, user: { id: 'u1' } };

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
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.ts');
      const res = makeRes();
      const next = vi.fn();
      const req: any = { method: 'GET', ip: '1.1.1.1', headers: {}, socket: {}, user: { id: 'u1' } };

      mod.defaultRateLimiter(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
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
      expect(res1.headers['x-ratelimit-limit']).toBe('1000');

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
});

