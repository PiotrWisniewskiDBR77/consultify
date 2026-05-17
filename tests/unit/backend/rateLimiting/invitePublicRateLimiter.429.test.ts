import { describe, expect, it, vi } from 'vitest';

describe('invitePublicRateLimiter (production behavior)', () => {
  it('returns 429 after limit exceeded', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { invitePublicRateLimiter } = await import(
      '../../../../server/src/middleware/rateLimiting.middleware.ts'
    );

    const req: any = { method: 'POST', ip: '5.6.7.8', headers: {} };
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

    for (let i = 0; i < 16; i += 1) invitePublicRateLimiter(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        error: 'Too many invitation attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      })
    );

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });
});
