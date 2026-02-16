import { describe, expect, it, vi } from 'vitest';

describe('defaultRateLimiter (window reset)', () => {
  it('resets counter after window', async () => {
    vi.useFakeTimers();
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { defaultRateLimiter } =
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

    const req: any = { method: 'GET', ip: '1.2.3.4', headers: {} };
    const mkRes = () => {
      const res: any = {
        statusCode: 200,
        headers: {} as Record<string, any>,
        setHeader: (k: string, v: any) => (res.headers[k] = v),
        status: (code: number) => {
          res.statusCode = code;
          return res;
        },
        json: vi.fn(() => res),
      };
      return res;
    };
    const next = vi.fn();

    const res1 = mkRes();
    defaultRateLimiter(req, res1, next);
    expect(res1.statusCode).toBe(200);

    await vi.advanceTimersByTimeAsync(15 * 60_000 + 1);

    const res2 = mkRes();
    defaultRateLimiter(req, res2, next);
    expect(res2.statusCode).toBe(200);

    vi.useRealTimers();
    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });
});
