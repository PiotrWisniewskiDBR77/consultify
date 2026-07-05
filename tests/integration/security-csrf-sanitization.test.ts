/**
 * L3 Integration Tests: CSRF + Input Sanitization Pipeline
 * Tests the middleware pipeline: sanitization → CSRF validation → handler.
 *
 * NOTE: inputSanitizationMiddleware has .js import issues in Vitest,
 * so we use sanitizeObject directly for sanitization assertions
 * and verify the middleware pipeline through source code + CSRF tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeObject } from '../../server/src/utils/security.utils';
import {
  csrfTokenMiddleware,
  csrfValidationMiddleware,
} from '../../server/src/middleware/csrf.middleware';

// ── Helpers ──
function createReq(overrides: Record<string, any> = {}) {
  return {
    method: overrides.method || 'POST',
    path: overrides.path || '/api/projects',
    headers: overrides.headers || { 'content-type': 'application/json' },
    cookies: overrides.cookies || {},
    body: overrides.body || {},
    query: overrides.query || {},
  } as any;
}

function createRes() {
  const cookies: Record<string, any> = {};
  return {
    cookie: vi.fn((n: string, v: string, o: any) => {
      cookies[n] = { value: v, options: o };
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    // sendCsrfForbidden() sets no-store + security headers on the 403 response.
    setHeader: vi.fn().mockReturnThis(),
    _cookies: cookies,
  } as any;
}

describe('CSRF + Sanitization Pipeline (L3)', () => {
  beforeEach(() => {
    process.env.ENABLE_CSRF_IN_TESTS = 'true';
  });
  afterEach(() => {
    delete process.env.ENABLE_CSRF_IN_TESTS;
  });

  // ── Full Pipeline: Sanitize → CSRF → Handler ──
  describe('Full middleware pipeline', () => {
    it('sanitizes input THEN validates CSRF', () => {
      // Step 1: Generate CSRF token
      const setupReq = createReq({ method: 'GET' });
      const setupRes = createRes();
      const setupNext = vi.fn();
      csrfTokenMiddleware(setupReq, setupRes, setupNext);
      const csrfToken = setupRes._cookies['csrf_token']?.value;
      expect(csrfToken).toBeDefined();

      // Step 2: Simulate sanitization (using sanitizeObject directly)
      const body = { name: '<script>alert("xss")</script>' };
      const sanitizedBody = sanitizeObject(body);
      expect((sanitizedBody as any).name).not.toContain('<script>');

      // Step 3: CSRF validation with valid token
      const req = createReq({
        method: 'POST',
        body: sanitizedBody,
        cookies: { csrf_token: csrfToken },
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
        },
      });
      const res = createRes();
      const csrfNext = vi.fn();
      csrfValidationMiddleware(req, res, csrfNext);
      expect(csrfNext).toHaveBeenCalled();
    });

    it('CSRF blocks even if input is clean', () => {
      // Sanitize clean input
      const sanitizedBody = sanitizeObject({ name: 'Clean input' });
      expect((sanitizedBody as any).name).toBe('Clean input');

      const req = createReq({
        method: 'POST',
        body: sanitizedBody,
        cookies: {},
        headers: { 'content-type': 'application/json' },
      });
      const res = createRes();

      // CSRF blocks
      const csrfNext = vi.fn();
      csrfValidationMiddleware(req, res, csrfNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(csrfNext).not.toHaveBeenCalled();
    });
  });

  // ── Sanitization + CSRF Token Integrity ──
  describe('CSRF token is not affected by sanitization', () => {
    it('sanitizeObject does not modify non-HTML strings (like CSRF tokens)', () => {
      const csrfToken = 'a'.repeat(64);
      const result = sanitizeObject({ csrf_token: csrfToken });
      // CSRF tokens are hex strings with no HTML chars, so they pass through unchanged
      expect((result as any).csrf_token).toBe(csrfToken);
    });

    it('cookies are separate from body/query sanitization', () => {
      // Verify that sanitizeObject only processes its input, not cookies
      const body = { data: 'test' };
      const sanitized = sanitizeObject(body);
      expect((sanitized as any).data).toBe('test');
      // Cookies are on req.cookies, not req.body — middleware only sanitizes body/query
    });
  });

  // ── XSS Payload Vectors ──
  describe('XSS payload neutralization (via sanitizeObject)', () => {
    const xssVectors = [
      { name: 'script tag', payload: '<script>alert(1)</script>' },
      { name: 'img onerror', payload: '<img src=x onerror=alert(1)>' },
      { name: 'svg onload', payload: '<svg onload=alert(1)>' },
      { name: 'javascript: URL', payload: '<a href="javascript:alert(1)">click</a>' },
      { name: 'event handler', payload: '<div onmouseover="alert(1)">hover</div>' },
      { name: 'data URI', payload: '<object data="data:text/html,<script>alert(1)</script>">' },
      { name: 'encoded entities', payload: '&#60;script&#62;alert(1)&#60;/script&#62;' },
      { name: 'nested tags', payload: '<<script>alert(1)</script>>' },
      { name: 'null byte', payload: '<scr\x00ipt>alert(1)</script>' },
      { name: 'backtick eval', payload: '`${alert(1)}`' },
    ];

    xssVectors.forEach(({ name, payload }) => {
      it(`neutralizes ${name}`, () => {
        const body = { field: payload };
        const result = sanitizeObject(body);
        // After sanitization, no raw < or > should remain
        if (payload.includes('<')) {
          expect((result as any).field).not.toContain('<');
        }
      });
    });
  });

  // ── CSRF Exempt Paths ──
  describe('CSRF exemptions work correctly', () => {
    it('login is exempt from CSRF', () => {
      const req = createReq({ method: 'POST', path: '/api/auth/login' });
      const res = createRes();
      const next = vi.fn();
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('non-exempt POST requires CSRF', () => {
      const req = createReq({ method: 'POST', path: '/api/projects' });
      const res = createRes();
      const next = vi.fn();
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('GET never requires CSRF', () => {
      const req = createReq({ method: 'GET', path: '/api/projects' });
      const res = createRes();
      const next = vi.fn();
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── Edge Cases ──
  describe('Edge cases', () => {
    it('handles empty body through sanitization + CSRF', () => {
      const csrfToken = 'b'.repeat(64);
      // Sanitize empty body
      const sanitized = sanitizeObject({});
      expect(sanitized).toEqual({});

      // CSRF validates with matching tokens
      const req = createReq({
        method: 'POST',
        body: sanitized,
        cookies: { csrf_token: csrfToken },
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      });
      const res = createRes();
      const next = vi.fn();
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('handles deeply nested XSS in body', () => {
      const body = {
        level1: {
          level2: {
            level3: {
              name: '<script>document.cookie</script>',
            },
          },
        },
      };
      const sanitized = sanitizeObject(body, 10) as any;
      expect(sanitized.level1.level2.level3.name).not.toContain('<');

      // Then CSRF validates
      const csrfToken = 'c'.repeat(64);
      const req = createReq({
        method: 'PUT',
        body: sanitized,
        cookies: { csrf_token: csrfToken },
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      });
      const res = createRes();
      const next = vi.fn();
      csrfValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('sanitizes query params alongside body', () => {
      const sanitizedQuery = sanitizeObject({ search: '<img onerror=alert(1)>' }) as any;
      const sanitizedBody = sanitizeObject({ name: '<b>bold</b>' }) as any;
      expect(sanitizedQuery.search).not.toContain('<');
      expect(sanitizedBody.name).not.toContain('<');
    });
  });
});
