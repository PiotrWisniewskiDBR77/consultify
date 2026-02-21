import { describe, it, expect, vi } from 'vitest';

import {
  __private__,
  inputSanitizationMiddleware,
} from '../../../../server/src/middleware/inputSanitization.middleware.ts';

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

  it('treats missing content-type header as empty string (still sanitizes)', async () => {
    const req = createReq({
      headers: {},
      body: { html: '<b>bold</b>' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(String(req.body.html)).not.toContain('<b>');
  });

  it('does not crash when req.query is sealed/frozen', async () => {
    const query: any = { q: '<script>x</script>' };
    Object.seal(query);

    const req = createReq({ method: 'GET', query });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
  });

  it.each([
    '<script>alert(1)</script>',
    '<ScRiPt>alert(1)</ScRiPt>',
    'javascript:alert(1)',
    'onerror=alert(1)',
    'onload = alert(1)',
    'data:text/html,<svg/onload=alert(1)>',
    'eval(alert(1))',
    'document.cookie',
    'window.location',
    '<img src=x onerror="alert(1)">',
  ])('detects suspicious patterns: %s', (value) => {
    expect(__private__.isSuspicious(value)).toBe(true);
  });

  it.each([
    'totally safe text',
    '<scrpt>alert(1)</scrpt>',
    'java script:alert(1)',
    'on load=alert(1)',
    'data:text/plain,hello',
  ])('does not flag safe-ish text: %s', (value) => {
    expect(__private__.isSuspicious(value)).toBe(false);
  });

  it('truncates overly long strings (private helper)', () => {
    const long = 'x'.repeat(10);
    expect(__private__.truncateStrings(long, 5)).toBe('x'.repeat(5));
    expect(__private__.truncateStrings({ a: long }, 5)).toEqual({ a: 'x'.repeat(5) });
    expect(__private__.truncateStrings(['a', long], 5)).toEqual(['a', 'x'.repeat(5)]);
    // Non-string primitives are preserved
    expect(__private__.truncateStrings(123, 5)).toBe(123);
  });

  it('truncateStrings: preserves null/undefined and exact-length strings', () => {
    expect(__private__.truncateStrings(null, 5)).toBeNull();
    expect(__private__.truncateStrings(undefined, 5)).toBeUndefined();
    expect(__private__.truncateStrings('abcde', 5)).toBe('abcde');
  });

  it('truncateStrings: truncates deeply nested objects/arrays', () => {
    const long = 'x'.repeat(10);
    const input = { a: [{ b: { c: long } }], ok: true, n: 1 };
    expect(__private__.truncateStrings(input, 5)).toEqual({
      a: [{ b: { c: 'x'.repeat(5) } }],
      ok: true,
      n: 1,
    });
  });

  it('logs suspicious nested payloads (private helper)', async () => {
    const logger = (await import('../../../../server/src/utils/Logger.js')).default as any;
    const origWarn = logger.warn;
    logger.warn = vi.fn();
    try {
      __private__.checkForSuspiciousContent(
        { a: { b: '<img src=x onerror=\"alert(1)\" />' } },
        '/api/test',
        'POST'
      );
      expect(logger.warn).toHaveBeenCalled();
    } finally {
      logger.warn = origWarn;
    }
  });

  it('no-ops suspicious check on non-object bodies (private helper)', () => {
    expect(() =>
      __private__.checkForSuspiciousContent('not-an-object' as any, '/api/test', 'POST')
    ).not.toThrow();
  });

  it('checkForSuspiciousContent: logs suspicious strings inside arrays', async () => {
    const logger = (await import('../../../../server/src/utils/Logger.js')).default as any;
    const origWarn = logger.warn;
    logger.warn = vi.fn();
    try {
      __private__.checkForSuspiciousContent(['safe', 'javascript:alert(1)'], '/api/test', 'POST');
      expect(logger.warn).toHaveBeenCalledTimes(1);
    } finally {
      logger.warn = origWarn;
    }
  });

  it('middleware: preserves non-string primitives while sanitizing strings', async () => {
    const req = createReq({
      body: {
        count: 123,
        ok: true,
        html: '<b>bold</b>',
        tricky: 'onload=alert(1)',
      },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.count).toBe(123);
    expect(req.body.ok).toBe(true);
    expect(String(req.body.html)).not.toContain('<b>');
    expect(String(req.body.tricky)).not.toContain('onload=');
  });

  it('middleware: ignores non-object bodies (still calls next)', async () => {
    const req = createReq({ body: '<b>not-an-object</b>' });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toBe('<b>not-an-object</b>');
  });

  it('middleware: ignores null query (still calls next)', async () => {
    const req = createReq({ method: 'GET', query: null });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('in non-test env: logs suspicious content during middleware execution', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origVitest = process.env.VITEST;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.VITEST;
      vi.resetModules();

      // Provide a JS-version security utils module for the non-test import path.
      vi.doMock('../../../../server/src/utils/security.utils.js', () => ({
        sanitizeObject: (x: unknown) => x,
      }));

      const logger = (await import('../../../../server/src/utils/Logger.js')).default as any;
      const origWarn = logger.warn;
      logger.warn = vi.fn();
      try {
        const mod =
          await import('../../../../server/src/middleware/inputSanitization.middleware.ts');
        const req = createReq({
          body: { html: '<script>alert(1)</script>' },
        });
        const next = vi.fn();

        await mod.inputSanitizationMiddleware(req, {} as any, next);
        expect(next).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
      } finally {
        logger.warn = origWarn;
      }
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origVitest !== undefined) process.env.VITEST = origVitest;
      else delete process.env.VITEST;
    }
  });

  it('in non-test env: does not throw on sanitization errors (logs + continues)', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origVitest = process.env.VITEST;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.VITEST;
      vi.resetModules();

      vi.doMock('../../../../server/src/utils/security.utils.js', () => ({
        sanitizeObject: () => {
          throw new Error('boom');
        },
      }));

      const mod = await import('../../../../server/src/middleware/inputSanitization.middleware.ts');
      const req = createReq({ body: { x: '<b>y</b>' } });
      const next = vi.fn();

      await expect(mod.inputSanitizationMiddleware(req, {} as any, next)).resolves.toBeUndefined();
      expect(next).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origVitest !== undefined) process.env.VITEST = origVitest;
      else delete process.env.VITEST;
    }
  });

  it('fails fast in test env when sanitization throws', async () => {
    vi.resetModules();
    vi.doMock('../../../../server/src/utils/security.utils.ts', () => ({
      sanitizeObject: () => {
        throw new Error('boom');
      },
    }));

    const mod = await import('../../../../server/src/middleware/inputSanitization.middleware.ts');
    const req = createReq({ body: { x: '<b>y</b>' } });
    const next = vi.fn();

    await expect(mod.inputSanitizationMiddleware(req, {} as any, next)).rejects.toThrow('boom');
  });

});
