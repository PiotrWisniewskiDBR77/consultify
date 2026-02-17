import { describe, it, expect, vi, afterEach } from 'vitest';
import { inputSanitizationMiddleware } from '../../server/src/middleware/inputSanitization.middleware';

describe('Real Input Sanitization Middleware (P0)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createReq = (overrides: Partial<any> = {}) => {
    const req: any = {
      method: 'POST',
      path: '/api/example',
      headers: {},
      body: undefined as unknown,
      query: {},
      ...overrides,
    };
    return req;
  };

  it('sanitizes XSS-like strings in req.body and req.query', async () => {
    const req = createReq({
      headers: { 'content-type': 'application/json' },
      body: { msg: '<script>alert(1)</script><img src=x onerror=evil()>' },
      query: { q: '<b>bold</b>' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req.body as any).msg).not.toContain('<script>');
    expect((req.body as any).msg).toContain('&lt;script&gt;');
    expect((req.query as any).q).toBe('&lt;b&gt;bold&lt;&#x2F;b&gt;');
  });

  it('truncates overly long string fields before sanitization', async () => {
    // Use plain text to avoid length expansion from HTML escaping.
    const long = 'a'.repeat(60000);
    const req = createReq({
      headers: { 'content-type': 'application/json' },
      body: { long },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(typeof (req.body as any).long).toBe('string');
    expect((req.body as any).long.length).toBe(50000);
  });

  it('skips multipart/form-data bodies (does not mutate)', async () => {
    const req = createReq({
      headers: { 'content-type': 'multipart/form-data; boundary=abc' },
      body: { msg: '<script>alert(1)</script>' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req.body as any).msg).toBe('<script>alert(1)</script>');
  });
});
