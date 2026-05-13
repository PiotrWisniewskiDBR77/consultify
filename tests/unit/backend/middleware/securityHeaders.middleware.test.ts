import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('securityHeaders.middleware (L1)', () => {
  const originalEnv = { ...process.env };

  const mkRes = () => {
    const res: any = {};
    res.setHeader = vi.fn(() => res);
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
  };

  afterAll(() => {
    try {
      vi.useRealTimers();
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) delete (process.env as any)[key];
      }
      Object.assign(process.env, originalEnv);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('sets baseline security headers (no HSTS outside production)', async () => {
    vi.resetModules();
    const { securityHeaders } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const req: any = {};
    const res = mkRes();
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(res.setHeader).toHaveBeenCalledWith('X-DNS-Prefetch-Control', 'off');
    expect(res.setHeader).toHaveBeenCalledWith('X-Permitted-Cross-Domain-Policies', 'none');
    expect(res.setHeader).toHaveBeenCalledWith('Cross-Origin-Opener-Policy', 'same-origin');
    expect(res.setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'same-site');
    expect(res.setHeader).toHaveBeenCalledWith('Origin-Agent-Cluster', '?1');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'geolocation=(), microphone=(self), camera=(), payment=(), usb=(), bluetooth=(), display-capture=()'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'")
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("base-uri 'self'")
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("form-action 'self'")
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("frame-ancestors 'none'")
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.not.stringContaining('upgrade-insecure-requests')
    );
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.any(String)
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('securityHeaders continues when setHeader throws', async () => {
    vi.resetModules();
    const { securityHeaders } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const req: any = {};
    const res = mkRes();
    res.setHeader = vi.fn(() => {
      throw new Error('setHeader failed');
    });
    const next = vi.fn();

    expect(() => securityHeaders(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('securityHeaders does not throw when next throws', async () => {
    vi.resetModules();
    const { securityHeaders } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const req: any = {};
    const res = mkRes();
    const next = vi.fn(() => {
      throw new Error('next failed');
    });

    expect(() => securityHeaders(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('adds HSTS in production', async () => {
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { securityHeaders } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const req: any = {};
    const res = mkRes();
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining('upgrade-insecure-requests')
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('createRateLimiter allows up to max and then returns 429, then resets after window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T00:00:00.000Z'));
    vi.resetModules();
    const { createRateLimiter } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const limiter = createRateLimiter({ windowMs: 1000, max: 2, message: 'Nope' });

    const reqBase: any = { ip: '1.2.3.4', path: '/secure' };

    const res1 = mkRes();
    const next1 = vi.fn();
    limiter({ ...reqBase }, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);
    expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '2');
    expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');

    const res2 = mkRes();
    const next2 = vi.fn();
    limiter({ ...reqBase }, res2, next2);
    expect(next2).toHaveBeenCalledTimes(1);
    expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');

    const res3 = mkRes();
    const next3 = vi.fn();
    limiter({ ...reqBase }, res3, next3);
    expect(res3.status).toHaveBeenCalledWith(429);
    expect(res3.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Nope', code: 'RATE_LIMITED' })
    );
    expect(res3.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(res3.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res3.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(next3).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-02-18T00:00:01.001Z'));
    await vi.advanceTimersByTimeAsync(1001);

    const res4 = mkRes();
    const next4 = vi.fn();
    limiter({ ...reqBase }, res4, next4);
    expect(next4).toHaveBeenCalledTimes(1);
  });

  it('createRateLimiter does not throw when status/json accessors fail on 429 response', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T00:00:00.000Z'));
    vi.resetModules();
    const { createRateLimiter } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const limiter = createRateLimiter({ windowMs: 1000, max: 1, message: 'Nope' });
    const reqBase: any = { ip: '5.5.5.5', path: '/limited' };

    const res1 = mkRes();
    limiter({ ...reqBase }, res1, vi.fn());

    const res2: any = mkRes();
    res2.status = vi.fn(() => {
      throw new Error('status failed');
    });
    expect(() => limiter({ ...reqBase }, res2, vi.fn())).not.toThrow();

    const res3: any = mkRes();
    res3.status = vi.fn(() => res3);
    res3.json = vi.fn(() => {
      throw new Error('json failed');
    });
    expect(() => limiter({ ...reqBase }, res3, vi.fn())).not.toThrow();
  });

  it('rateLimitPresets expose working limiter functions', async () => {
    vi.resetModules();
    const { rateLimitPresets } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const baseReq: any = { ip: '9.9.9.9', path: '/preset' };
    const call = (fn: any) => {
      const res = mkRes();
      const next = vi.fn();
      fn({ ...baseReq }, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    };

    call(rateLimitPresets.admin);
    call(rateLimitPresets.auth);
    call(rateLimitPresets.breakGlass);
    call(rateLimitPresets.export);
    call(rateLimitPresets.api);
  });

  it('periodically cleans up stale rate limit keys', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T00:00:00.000Z'));
    vi.resetModules();
    const { createRateLimiter } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const req: any = { ip: '7.7.7.7', path: '/cleanup' };

    const res1 = mkRes();
    const next1 = vi.fn();
    limiter(req, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);

    // Advance beyond maxAge (1h) so the cleanup interval will delete this key.
    await vi.advanceTimersByTimeAsync(3_600_001);
  });

  it('unrefs cleanup interval so it does not pin event loop', async () => {
    const prev = process.env.NODE_ENV;
    const unrefSpy = vi.fn();
    const handle = { unref: unrefSpy } as unknown as NodeJS.Timeout;
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(handle);
    try {
      process.env.NODE_ENV = 'test';
      vi.resetModules();
      await import('../../../../server/src/middleware/securityHeaders.middleware.ts');
      expect(setIntervalSpy).toHaveBeenCalled();
      expect(unrefSpy).toHaveBeenCalledTimes(1);
    } finally {
      setIntervalSpy.mockRestore();
      process.env.NODE_ENV = prev;
    }
  });

  it('caps oversized path key material so suffix-only differences share a limiter bucket', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T00:00:00.000Z'));
    vi.resetModules();
    const { createRateLimiter } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const limiter = createRateLimiter({ windowMs: 1000, max: 1, message: 'Limited' });
    const sharedPrefix = '/secure/' + 'x'.repeat(600);
    const reqA: any = { ip: '1.2.3.4', path: `${sharedPrefix}-a` };
    const reqB: any = { ip: '1.2.3.4', path: `${sharedPrefix}-b` };

    const resA = mkRes();
    const nextA = vi.fn();
    limiter(reqA, resA, nextA);
    expect(nextA).toHaveBeenCalledTimes(1);

    const resB = mkRes();
    const nextB = vi.fn();
    limiter(reqB, resB, nextB);
    expect(resB.status).toHaveBeenCalledWith(429);
    expect(nextB).not.toHaveBeenCalled();
  });

  it('validateRequest returns 400 with detailed errors', async () => {
    vi.resetModules();
    const { validateRequest } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const mw = validateRequest({
      requiredField: { required: true, type: 'string' },
      strType: { type: 'string' },
      numType: { type: 'number' },
      numMin: { type: 'number', min: 5 },
      numMax: { type: 'number', max: 10 },
      boolType: { type: 'boolean' },
      enumField: { enum: ['a', 'b'] },
      minLen: { type: 'string', minLength: 2 },
      maxLen: { type: 'string', maxLength: 2 },
      patternField: { type: 'string', pattern: /^[a-z]+$/ },
    });

    const req: any = {
      body: {
        requiredField: '',
        strType: 123,
        numType: '3',
        numMin: 3,
        numMax: 11,
        boolType: 'true',
        enumField: 'c',
        minLen: 'a',
        maxLen: 'abc',
        patternField: 'abc123',
      },
    };
    const res = mkRes();
    const next = vi.fn();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: expect.any(Array),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('validateRequest passes when schema is satisfied', async () => {
    vi.resetModules();
    const { validateRequest } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const mw = validateRequest({
      email: { required: true, type: 'string', pattern: /^[^@]+@[^@]+$/ },
      count: { type: 'number', min: 1, max: 5 },
      flag: { type: 'boolean' },
      mode: { enum: ['a', 'b'] },
    });

    const req: any = {
      body: { email: 'a@b', count: 3, flag: true, mode: 'a' },
    };
    const res = mkRes();
    const next = vi.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('validateRequest returns 400 when req.body accessor throws and required field missing', async () => {
    vi.resetModules();
    const { validateRequest } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const mw = validateRequest({
      email: { required: true, type: 'string' },
    });

    const req: any = {};
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
    });

    const res = mkRes();
    const next = vi.fn();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateRequest does not throw when req.body is null and required field is missing', async () => {
    vi.resetModules();
    const { validateRequest } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const mw = validateRequest({
      email: { required: true, type: 'string' },
    });

    const req: any = { body: null };
    const res = mkRes();
    const next = vi.fn();

    expect(() => mw(req, res, next)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateRequest does not throw when next throws in success path', async () => {
    vi.resetModules();
    const { validateRequest } = await import(
      '../../../../server/src/middleware/securityHeaders.middleware.ts'
    );

    const mw = validateRequest({
      email: { required: true, type: 'string' },
    });
    const req: any = { body: { email: 'test@example.com' } };
    const res = mkRes();
    const next = vi.fn(() => {
      throw new Error('next failed');
    });

    expect(() => mw(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
