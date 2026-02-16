import { describe, expect, it, vi } from 'vitest';

describe('aiRateLimiter (headers)', () => {
  it('sets X-RateLimit headers', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { aiRateLimiter } =
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

    const req: any = { method: 'POST', ip: '1.2.3.4', headers: {} };
    const res: any = {
      headers: {} as Record<string, any>,
      setHeader: (k: string, v: any) => (res.headers[k] = v),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    aiRateLimiter(req, res, next);
    expect(res.headers['X-RateLimit-Limit']).toBe(30);
    expect(Number(res.headers['X-RateLimit-Remaining'])).toBeGreaterThanOrEqual(0);
    expect(Number(res.headers['X-RateLimit-Reset'])).toBeGreaterThan(0);

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });
});
