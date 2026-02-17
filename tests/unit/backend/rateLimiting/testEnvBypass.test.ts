import { describe, expect, it, vi } from 'vitest';

describe('rate limiting bypass in test env', () => {
  it('calls next() when NODE_ENV=test', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    vi.resetModules();
    const { authRateLimiter } =
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

    const req: any = { method: 'POST', ip: '1.2.3.4', headers: {} };
    const res: any = { setHeader: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    authRateLimiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });
});
