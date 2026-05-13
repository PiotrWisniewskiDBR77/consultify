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

  it('truncates overly long query strings before sanitization', async () => {
    const req = createReq({
      method: 'GET',
      query: { q: 'x'.repeat(50001) },
      body: {},
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(String(req.query.q).length).toBe(50000);
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

  it('skips multipart/form-data payloads when content-type header is an array', async () => {
    const req = createReq({
      headers: { 'content-type': ['MULTIPART/FORM-DATA; boundary=---x'] as any },
      body: { html: '<script>nope</script>' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.html).toContain('<script>');
  });

  it('skips multipart payloads when content-type header has leading whitespace', async () => {
    const req = createReq({
      headers: { 'content-type': '   multipart/form-data; boundary=---x' },
      body: { html: '<script>nope</script>' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
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

  it('continues sanitization when content-type header accessor throws', async () => {
    const req = createReq({
      body: { html: '<b>bold</b>' },
    });
    Object.defineProperty(req, 'headers', {
      configurable: true,
      get: () => {
        throw new Error('headers getter failed');
      },
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

  it('detects suspicious patterns (private helper)', () => {
    expect(__private__.isSuspicious('<script>alert(1)</script>')).toBe(true);
    expect(__private__.isSuspicious('javascript:alert(1)')).toBe(true);
    expect(__private__.isSuspicious('totally safe text')).toBe(false);
  });

  it.each([
    ['data:text/html,<h1>x</h1>'],
    ['eval(alert(1))'],
    ['document.cookie'],
    ['window.location'],
    ['onclick=alert(1)'],
  ])('detects additional suspicious patterns: %s', (value) => {
    expect(__private__.isSuspicious(value)).toBe(true);
  });

  it('truncates overly long strings (private helper)', () => {
    const long = 'x'.repeat(10);
    expect(__private__.truncateStrings(long, 5)).toBe('x'.repeat(5));
    expect(__private__.truncateStrings({ a: long }, 5)).toEqual({ a: 'x'.repeat(5) });
    expect(__private__.truncateStrings(['a', long], 5)).toEqual(['a', 'x'.repeat(5)]);
    // Non-string primitives are preserved
    expect(__private__.truncateStrings(123, 5)).toBe(123);
  });

  it('truncateStrings returns null/undefined unchanged (private helper)', () => {
    expect(__private__.truncateStrings(null as any, 5)).toBeNull();
    expect(__private__.truncateStrings(undefined as any, 5)).toBeUndefined();
  });

  it('truncateStrings traverses nested arrays/objects (private helper)', () => {
    const long = 'x'.repeat(10);
    const out = __private__.truncateStrings([{ a: long }, { b: [long] }], 3) as any;
    expect(out[0].a).toBe('x'.repeat(3));
    expect(out[1].b[0]).toBe('x'.repeat(3));
  });

  it('truncateStrings caps oversized arrays before recursive sanitization', () => {
    const large = Array.from({ length: 10001 }, () => 'x');
    const out = __private__.truncateStrings(large, 10) as unknown[];
    expect(out.length).toBe(10000);
  });

  it('truncateStrings caps oversized plain object key counts', () => {
    const oversized = Object.fromEntries(
      Array.from({ length: 10001 }, (_, i) => [`k${i}`, i === 0 ? 'x'.repeat(10) : 'x'])
    );
    const out = __private__.truncateStrings(oversized, 5) as Record<string, unknown>;
    expect(Object.keys(out).length).toBe(10000);
    expect(out.k0).toBe('x'.repeat(5));
    expect(out.k10000).toBeUndefined();
  });

  it('truncateStrings stops recursion at depth boundary (private helper)', () => {
    const deep = { a: { b: { c: 'x'.repeat(10) } } };
    const out = __private__.truncateStrings(deep, 5, 2) as any;
    // depth budget consumed before reaching c, so c remains unchanged
    expect(out.a.b.c).toBe('x'.repeat(10));
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

  it('checkForSuspiciousContent traverses arrays (private helper)', async () => {
    const logger = (await import('../../../../server/src/utils/Logger.js')).default as any;
    const origWarn = logger.warn;
    logger.warn = vi.fn();
    try {
      __private__.checkForSuspiciousContent(
        [{ x: '<script>alert(1)</script>' }],
        '/api/test',
        'POST'
      );
      expect(logger.warn).toHaveBeenCalled();
    } finally {
      logger.warn = origWarn;
    }
  });

  it('checkForSuspiciousContent does not throw on circular object graph', () => {
    const circular: any = { safe: 'ok' };
    circular.self = circular;

    expect(() =>
      __private__.checkForSuspiciousContent(circular, '/api/test', 'POST')
    ).not.toThrow();
  });

  it('sanitizes query even when req.body is a primitive', async () => {
    const req = createReq({
      body: '<b>not-an-object</b>',
      query: { q: '<b>bold</b>' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toBe('<b>not-an-object</b>');
    expect(String(req.query.q)).not.toContain('<b>');
  });

  it('does not throw when req.body accessor throws and still sanitizes query', async () => {
    const req = createReq({
      query: { q: '<b>bold</b>' },
    });
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
      set: () => {
        // ignore
      },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(String(req.query.q)).not.toContain('<b>');
  });

  it('sanitizes req.body when it is an array (treated as object)', async () => {
    const req = createReq({
      body: ['<i>x</i>', { nested: '<b>y</b>' }],
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(String(req.body[0])).not.toContain('<i>');
    expect(String(req.body[1].nested)).not.toContain('<b>');
  });

  it('preserves Buffer body without coercing it through object sanitization', async () => {
    const body = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const req = createReq({
      body,
      query: { q: 'safe' },
    });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(Buffer.isBuffer(req.body)).toBe(true);
    expect(req.body.equals(body)).toBe(true);
  });

  it('does not attempt query sanitization when req.query is null', async () => {
    const req = createReq({ method: 'GET', query: null as any, body: { x: '<b>y</b>' } });
    const next = vi.fn();

    await inputSanitizationMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(String(req.body.x)).not.toContain('<b>');
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

  it('in non-test env: logs suspicious content found in query payload', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origVitest = process.env.VITEST;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.VITEST;
      vi.resetModules();
      vi.doMock('../../../../server/src/utils/security.utils.js', () => ({
        sanitizeObject: (x: unknown) => x,
      }));

      const logger = (await import('../../../../server/src/utils/Logger.js')).default as any;
      const origWarn = logger.warn;
      logger.warn = vi.fn();
      try {
        const mod = await import('../../../../server/src/middleware/inputSanitization.middleware.ts');
        const req = createReq({
          body: { ok: 'safe' },
          query: { q: '<script>alert(1)</script>' },
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

  it('loadSecurityUtils: attempts fallback spec when preferred import fails', async () => {
    vi.resetModules();

    const sanitizeObject = vi.fn((x: unknown) => x);
    let loads = 0;

    // Force the preferred dynamic import to fail once, then succeed on fallback import.
    // NOTE: In Vitest, `.js` imports under `server/src/...` are aliased to `.ts`,
    // so we mock the TS module and let the fallback spec resolve to the same mocked module.
    vi.doMock('../../../../server/src/utils/security.utils.ts', () => {
      loads++;
      if (loads === 1) throw new Error('preferred import failed');
      return { sanitizeObject };
    });

    try {
      const mod = await import(
        '../../../../server/src/middleware/inputSanitization.middleware.ts?loader_fallback_v2'
      );
      const req = createReq({ body: { html: '<b>bold</b>' }, query: { q: '<i>x</i>' } });
      const next = vi.fn();

      await mod.inputSanitizationMiddleware(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      expect(sanitizeObject).toHaveBeenCalled();
      expect(loads).toBeGreaterThanOrEqual(2);
    } finally {
      vi.unmock('../../../../server/src/utils/security.utils.ts');
    }
  });

  it('loadSecurityUtils caches resolved module across middleware calls', async () => {
    vi.resetModules();

    const sanitizeObject = vi.fn((x: unknown) => x);
    let loads = 0;

    vi.doMock('../../../../server/src/utils/security.utils.ts', () => {
      loads++;
      return { sanitizeObject };
    });

    try {
      const mod = await import(
        '../../../../server/src/middleware/inputSanitization.middleware.ts?loader_cache'
      );

      const next1 = vi.fn();
      const next2 = vi.fn();
      const req1 = createReq({ body: { x: '<b>y</b>' } });
      const req2 = createReq({ body: { x: '<i>z</i>' } });

      await mod.inputSanitizationMiddleware(req1, {} as any, next1);
      await mod.inputSanitizationMiddleware(req2, {} as any, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
      expect(loads).toBe(1);
    } finally {
      vi.unmock('../../../../server/src/utils/security.utils.ts');
    }
  });

  it('loadSecurityUtils clears failed cache and retries import successfully on next request', async () => {
    vi.resetModules();

    const sanitizeObject = vi.fn((x: unknown) => x);
    let loads = 0;

    vi.doMock('../../../../server/src/utils/security.utils.ts', () => {
      loads++;
      if (loads === 1) {
        throw new Error('transient import failure');
      }
      return { sanitizeObject };
    });

    try {
      const mod = await import(
        '../../../../server/src/middleware/inputSanitization.middleware.ts?loader_retry_after_failure'
      );
      const req1 = createReq({ body: { x: '<b>one</b>' } });
      const req2 = createReq({ body: { x: '<i>two</i>' } });
      const next1 = vi.fn();
      const next2 = vi.fn();

      await mod.inputSanitizationMiddleware(req1, {} as any, next1);
      expect(next1).toHaveBeenCalled();

      await mod.inputSanitizationMiddleware(req2, {} as any, next2);
      expect(next2).toHaveBeenCalled();
      expect(sanitizeObject).toHaveBeenCalled();
      expect(loads).toBeGreaterThanOrEqual(2);
    } finally {
      vi.unmock('../../../../server/src/utils/security.utils.ts');
    }
  });
});
