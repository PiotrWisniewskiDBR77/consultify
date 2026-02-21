/**
 * L1 Unit Tests: csrf.middleware.ts
 * Full branch coverage for CSRF double-submit cookie middleware.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  csrfTokenMiddleware,
  csrfValidationMiddleware,
  getCsrfTokenHandler,
} from '../../../../server/src/middleware/csrf.middleware';

function createMocks(
  overrides: {
    method?: string;
    path?: string;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
) {
  const resCookies: Record<string, any> = {};
  const req = {
    method: overrides.method || 'GET',
    path: overrides.path || '/api/test',
    cookies: overrides.cookies || {},
    headers: overrides.headers || {},
  } as any;
  const res = {
    cookie: vi.fn((n: string, v: string, o: any) => {
      resCookies[n] = { value: v, options: o };
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    _cookies: resCookies,
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('CSRF middleware (L1)', () => {
  beforeEach(() => {
    process.env.ENABLE_CSRF_IN_TESTS = 'true';
  });
  afterEach(() => {
    delete process.env.ENABLE_CSRF_IN_TESTS;
  });

  // ── csrfTokenMiddleware ──
  describe('csrfTokenMiddleware', () => {
    it('generates a cookie when none exists', () => {
      const { req, res, next } = createMocks();
      csrfTokenMiddleware(req, res, next);
      expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('does NOT overwrite existing cookie', () => {
      const { req, res, next } = createMocks({ cookies: { csrf_token: 'existing' } });
      csrfTokenMiddleware(req, res, next);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('treats non-string csrf_token cookie as missing (generates a new token)', () => {
      const { req, res, next } = createMocks({ cookies: { csrf_token: 123 as any } });
      csrfTokenMiddleware(req, res, next);
      expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('generated token is at least 32 chars', () => {
      const { req, res, next } = createMocks();
      csrfTokenMiddleware(req, res, next);
      const token = res.cookie.mock.calls[0][1];
      expect(token.length).toBeGreaterThanOrEqual(32);
    });

    it('cookie is NOT httpOnly (frontend must read it)', () => {
      const { req, res, next } = createMocks();
      csrfTokenMiddleware(req, res, next);
      const opts = res.cookie.mock.calls[0][2];
      expect(opts.httpOnly).toBe(false);
    });

    it('cookie sameSite is lax', () => {
      const { req, res, next } = createMocks();
      csrfTokenMiddleware(req, res, next);
      expect(res.cookie.mock.calls[0][2].sameSite).toBe('lax');
    });

    it('cookie path is /', () => {
      const { req, res, next } = createMocks();
      csrfTokenMiddleware(req, res, next);
      expect(res.cookie.mock.calls[0][2].path).toBe('/');
    });

    it('generates unique tokens across calls', () => {
      const tokens: string[] = [];
      for (let i = 0; i < 10; i++) {
        const { req, res, next } = createMocks();
        csrfTokenMiddleware(req, res, next);
        tokens.push(res.cookie.mock.calls[0][1]);
      }
      expect(new Set(tokens).size).toBe(10);
    });

    it('never generates "test-csrf-token"', () => {
      for (let i = 0; i < 20; i++) {
        const { req, res, next } = createMocks();
        csrfTokenMiddleware(req, res, next);
        expect(res.cookie.mock.calls[0][1]).not.toBe('test-csrf-token');
      }
    });

    it('is a no-op in test env unless ENABLE_CSRF_IN_TESTS=true', () => {
      delete process.env.ENABLE_CSRF_IN_TESTS;
      const { req, res, next } = createMocks();
      csrfTokenMiddleware(req, res, next);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('enforces in NODE_ENV=test even when VITEST is unset', () => {
      const origVitest = process.env.VITEST;
      try {
        delete process.env.VITEST;
        process.env.NODE_ENV = 'test';
        process.env.ENABLE_CSRF_IN_TESTS = 'true';
        const { req, res, next } = createMocks();
        csrfTokenMiddleware(req, res, next);
        expect(res.cookie).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      } finally {
        if (origVitest !== undefined) process.env.VITEST = origVitest;
      }
    });

    it('sets secure cookie when req.secure is true', () => {
      const { req, res, next } = createMocks();
      (req as any).secure = true;
      csrfTokenMiddleware(req, res, next);
      const opts = res.cookie.mock.calls[0][2];
      expect(opts.secure).toBe(true);
    });

    it('sets secure cookie when x-forwarded-proto is https', () => {
      const { req, res, next } = createMocks({
        headers: { 'x-forwarded-proto': 'https' },
      });
      csrfTokenMiddleware(req, res, next);
      const opts = res.cookie.mock.calls[0][2];
      expect(opts.secure).toBe(true);
    });

    it('sets secure cookie in production env', () => {
      const origNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const { req, res, next } = createMocks();
        csrfTokenMiddleware(req, res, next);
        const opts = res.cookie.mock.calls[0][2];
        expect(opts.secure).toBe(true);
      } finally {
        process.env.NODE_ENV = origNodeEnv;
      }
    });
  });

  // ── csrfValidationMiddleware ──
  describe('csrfValidationMiddleware', () => {
    // Safe methods
    it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s without token', (method) => {
      const { req, res, next } = createMocks({ method });
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    // State-changing methods without tokens
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s without token (403)', (method) => {
      const { req, res, next } = createMocks({ method, path: '/api/projects' });
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_MISSING' }));
      expect(next).not.toHaveBeenCalled();
    });

    // Missing header only
    it('rejects POST with cookie but no header', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/test',
        cookies: { csrf_token: 'abc' },
        headers: {},
      });
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_MISSING' }));
    });

    // Missing cookie only
    it('rejects POST with header but no cookie', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/test',
        cookies: {},
        headers: { 'x-csrf-token': 'abc' },
      });
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    // Mismatched tokens
    it('rejects mismatched cookie and header', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/test',
        cookies: { csrf_token: 'aaa' },
        headers: { 'x-csrf-token': 'bbb' },
      });
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_INVALID' }));
    });

    // Matching tokens
    it('accepts matching cookie and header', () => {
      const tok = 'x'.repeat(64);
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/test',
        cookies: { csrf_token: tok },
        headers: { 'x-csrf-token': tok },
      });
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('accepts matching cookie and header when header is provided with uppercase key', () => {
      const tok = 'x'.repeat(64);
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/test',
        cookies: { csrf_token: tok },
        headers: { 'X-CSRF-TOKEN': tok } as any,
      });
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('accepts non-string tokens that stringify to the same value', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/test',
        cookies: { csrf_token: 123 as any },
        headers: { 'x-csrf-token': 123 as any } as any,
      });
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
    // Exempt paths
    it.each([
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/register',
      '/api/auth/demo-login',
      '/api/auth/reset-password',
      '/api/auth/verify-email',
      '/api/csrf-token',
      '/api/webhooks',
    ])('exempts %s from CSRF', (path) => {
      const { req, res, next } = createMocks({ method: 'POST', path });
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    // Exempt prefixes
    it.each(['/api/auth/callback/google', '/api/webhooks/stripe', '/api/stripe/webhook'])(
      'exempts prefix %s from CSRF',
      (path) => {
        const { req, res, next } = createMocks({ method: 'POST', path });
        csrfValidationMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    );

    // Non-exempt paths
    it.each([
      '/api/users',
      '/api/projects/123',
      '/api/security/settings',
      '/api/billing/subscribe',
    ])('requires CSRF for %s', (path) => {
      const { req, res, next } = createMocks({ method: 'PUT', path });
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    // Test mode bypass
    it('skips validation in test mode when ENABLE_CSRF_IN_TESTS is not set', () => {
      delete process.env.ENABLE_CSRF_IN_TESTS;
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      try {
        const { req, res, next } = createMocks({ method: 'POST', path: '/api/test' });
        csrfValidationMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    // Different length tokens (safeCompare edge case)
    it('rejects tokens of different lengths', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/test',
        cookies: { csrf_token: 'short' },
        headers: { 'x-csrf-token': 'much-longer-token-value' },
      });
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('handles multi-byte strings safely (timingSafeEqual throw path)', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/test',
        cookies: { csrf_token: 'ą' }, // length 1, byteLength 2
        headers: { 'x-csrf-token': 'a' }, // length 1, byteLength 1
      });
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_INVALID' }));
    });

    it('treats undefined path as non-exempt', () => {
      const { req, res, next } = createMocks({ method: 'POST' });
      (req as any).path = undefined;
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_MISSING' }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── getCsrfTokenHandler ──
  describe('getCsrfTokenHandler', () => {
    it('returns existing token from cookie', () => {
      const { req, res } = createMocks({ cookies: { csrf_token: 'existing-tok' } });
      getCsrfTokenHandler(req, res);
      expect(res.json).toHaveBeenCalledWith({ token: 'existing-tok' });
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('generates a new token when cookie exists but is an empty string', () => {
      const { req, res } = createMocks({ cookies: { csrf_token: '' } });
      getCsrfTokenHandler(req, res);
      expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
      const token = res.cookie.mock.calls[0][1];
      expect(token.length).toBeGreaterThanOrEqual(32);
    });

    it('generates and sets new token when no cookie', () => {
      const { req, res } = createMocks();
      getCsrfTokenHandler(req, res);
      expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
      const token = res.cookie.mock.calls[0][1];
      expect(res.json).toHaveBeenCalledWith({ token });
    });

    it('new token cookie is not httpOnly', () => {
      const { req, res } = createMocks();
      getCsrfTokenHandler(req, res);
      expect(res.cookie.mock.calls[0][2].httpOnly).toBe(false);
    });

    it('new token has 24h maxAge', () => {
      const { req, res } = createMocks();
      getCsrfTokenHandler(req, res);
      expect(res.cookie.mock.calls[0][2].maxAge).toBe(24 * 60 * 60 * 1000);
    });

    it('returns deterministic test token when CSRF is disabled in test env', () => {
      delete process.env.ENABLE_CSRF_IN_TESTS;
      const { req, res } = createMocks();
      getCsrfTokenHandler(req, res);
      expect(res.json).toHaveBeenCalledWith({ token: expect.any(String) });
      const token = res.json.mock.calls[0][0].token as string;
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('returns existing cookie token when CSRF is disabled in test env', () => {
      delete process.env.ENABLE_CSRF_IN_TESTS;
      const { req, res } = createMocks({ cookies: { csrf_token: 'existing-disabled' } });
      getCsrfTokenHandler(req, res);
      expect(res.json).toHaveBeenCalledWith({ token: 'existing-disabled' });
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });
});
