import { describe, it, expect, vi } from 'vitest';

import { inputSanitizationMiddleware } from '../../../../server/src/middleware/inputSanitization.middleware.ts';

function createReq(overrides: Partial<any> = {}) {
  return {
    method: 'POST',
    path: '/api/test',
    headers: { 'content-type': 'application/json' },
    body: {},
    query: {},
    ...overrides,
  } as any;
}

describe('inputSanitizationMiddleware (L1)', () => {
  it('sanitizes req.body (escapes HTML/script vectors)', async () => {
    const req = createReq({
      body: {
        title: '<script>alert(1)</script>',
        nested: { html: '<img src=x onerror="alert(1)">' },
        nullable: null,
        arr: ['<i>x</i>'],
      },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(String(req.body.title)).not.toContain('<script>');
    expect(String(req.body.nested.html)).not.toContain('<img');
    // We escape HTML entities; we don't remove attribute names from plain text.
    // The critical property is that it can't remain as an active attribute like `onerror=...`.
    expect(String(req.body.nested.html)).not.toContain('onerror=');
    expect(String(req.body.nested.html)).not.toContain('<');
    expect(req.body.nullable).toBeNull();
    expect(Array.isArray(req.body.arr)).toBe(true);
    expect(String(req.body.arr[0])).not.toContain('<i>');
  });

  it('sanitizes req.query by mutating keys in place', async () => {
    const req = createReq({
      method: 'GET',
      query: { q: '<b>bold</b>', ok: 'safe' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(String(req.query.q)).not.toContain('<b>');
    expect(req.query.ok).toBe('safe');
  });

  it('skips multipart/form-data payloads (file uploads)', async () => {
    const req = createReq({
      headers: { 'content-type': 'multipart/form-data; boundary=---x' },
      body: { html: '<script>nope</script>' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    // unchanged because we skip multipart
    expect(req.body.html).toContain('<script>');
  });

  it('does not crash when req.query is sealed/frozen', async () => {
    const query: any = { q: '<script>x</script>' };
    Object.seal(query);

    const req = createReq({ method: 'GET', query });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
  });
});
