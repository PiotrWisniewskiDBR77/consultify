import { describe, expect, it, vi } from 'vitest';

describe('rate limiters bypass OPTIONS', () => {
  it('does not rate limit OPTIONS', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { aiRateLimiter } =
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

    const req: any = { method: 'OPTIONS', ip: '1.2.3.4', headers: {} };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    aiRateLimiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });
});
