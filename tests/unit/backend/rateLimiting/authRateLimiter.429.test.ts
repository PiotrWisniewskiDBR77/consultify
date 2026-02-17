import { describe, expect, it, vi } from 'vitest';

describe('authRateLimiter (production behavior)', () => {
  it('returns 429 after limit exceeded', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { authRateLimiter } =
      await import('../../../../server/src/middleware/rateLimiting.middleware.ts');

    const req: any = { method: 'POST', ip: '1.2.3.4', headers: {} };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, any>,
      setHeader: (k: string, v: any) => (res.headers[k] = v),
      status: (code: number) => {
        res.statusCode = code;
        return res;
      },
      jsonBody: undefined as any,
      json: (body: any) => {
        res.jsonBody = body;
        return res;
      },
    };
    const next = vi.fn();

    // max in prod: 15
    for (let i = 0; i < 16; i++) authRateLimiter(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: expect.any(Number),
      })
    );

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });
});
