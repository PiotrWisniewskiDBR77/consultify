import { describe, expect, it, vi } from 'vitest';

describe('rate limiter keying uses req.user.id', () => {
  it('sets headers and calls next when req.user.id exists', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { defaultRateLimiter } =
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

    const req: any = { method: 'GET', ip: '1.2.3.4', headers: {}, user: { id: 'u-1' } };
    const res: any = {
      headers: {} as Record<string, any>,
      setHeader: (k: string, v: any) => (res.headers[k] = v),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    defaultRateLimiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers['X-RateLimit-Limit']).toBe(300);

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });
});
