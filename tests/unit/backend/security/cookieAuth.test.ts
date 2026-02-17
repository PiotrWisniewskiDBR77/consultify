/**
 * L1 Unit Tests: cookieAuth.ts
 * Full branch coverage for cookie-based authentication utilities.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setAuthCookies,
  clearAuthCookies,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../../../../server/src/utils/cookieAuth';

function mockRes() {
  const cookies: Record<string, { value: string; options: any }> = {};
  const cleared: Record<string, any> = {};
  return {
    cookie: vi.fn((n: string, v: string, o: any) => {
      cookies[n] = { value: v, options: o };
    }),
    clearCookie: vi.fn((n: string, o: any) => {
      cleared[n] = o;
    }),
    _cookies: cookies,
    _cleared: cleared,
  };
}

describe('cookieAuth utility (L1)', () => {
  // ── Constants ──
  describe('constants', () => {
    it('ACCESS_TOKEN_COOKIE should be "access_token"', () => {
      expect(ACCESS_TOKEN_COOKIE).toBe('access_token');
    });
    it('REFRESH_TOKEN_COOKIE should be "refresh_token"', () => {
      expect(REFRESH_TOKEN_COOKIE).toBe('refresh_token');
    });
  });

  // ── setAccessTokenCookie ──
  describe('setAccessTokenCookie', () => {
    it('sets cookie with correct name and value', () => {
      const res = mockRes();
      setAccessTokenCookie(res as any, 'tok-abc');
      expect(res.cookie).toHaveBeenCalledTimes(1);
      expect(res._cookies[ACCESS_TOKEN_COOKIE].value).toBe('tok-abc');
    });

    it('cookie is httpOnly', () => {
      const res = mockRes();
      setAccessTokenCookie(res as any, 'x');
      expect(res._cookies[ACCESS_TOKEN_COOKIE].options.httpOnly).toBe(true);
    });

    it('cookie path is /api', () => {
      const res = mockRes();
      setAccessTokenCookie(res as any, 'x');
      expect(res._cookies[ACCESS_TOKEN_COOKIE].options.path).toBe('/api');
    });

    it('cookie sameSite is lax', () => {
      const res = mockRes();
      setAccessTokenCookie(res as any, 'x');
      expect(res._cookies[ACCESS_TOKEN_COOKIE].options.sameSite).toBe('lax');
    });

    it('maxAge is positive and <= 1 hour', () => {
      const res = mockRes();
      setAccessTokenCookie(res as any, 'x');
      const maxAge = res._cookies[ACCESS_TOKEN_COOKIE].options.maxAge;
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('handles empty string token', () => {
      const res = mockRes();
      setAccessTokenCookie(res as any, '');
      expect(res._cookies[ACCESS_TOKEN_COOKIE].value).toBe('');
    });

    it('handles very long token', () => {
      const res = mockRes();
      const longToken = 'a'.repeat(4096);
      setAccessTokenCookie(res as any, longToken);
      expect(res._cookies[ACCESS_TOKEN_COOKIE].value).toBe(longToken);
    });
  });

  // ── setRefreshTokenCookie ──
  describe('setRefreshTokenCookie', () => {
    it('sets cookie with correct name and value', () => {
      const res = mockRes();
      setRefreshTokenCookie(res as any, 'ref-xyz');
      expect(res._cookies[REFRESH_TOKEN_COOKIE].value).toBe('ref-xyz');
    });

    it('cookie is httpOnly', () => {
      const res = mockRes();
      setRefreshTokenCookie(res as any, 'x');
      expect(res._cookies[REFRESH_TOKEN_COOKIE].options.httpOnly).toBe(true);
    });

    it('cookie path is /api/auth (scoped)', () => {
      const res = mockRes();
      setRefreshTokenCookie(res as any, 'x');
      expect(res._cookies[REFRESH_TOKEN_COOKIE].options.path).toBe('/api/auth');
    });

    it('maxAge is longer than access token', () => {
      const res = mockRes();
      setAuthCookies(res as any, 'a', 'r');
      const accessMax = res._cookies[ACCESS_TOKEN_COOKIE].options.maxAge;
      const refreshMax = res._cookies[REFRESH_TOKEN_COOKIE].options.maxAge;
      expect(refreshMax).toBeGreaterThan(accessMax);
    });

    it('maxAge is approximately 7 days', () => {
      const res = mockRes();
      setRefreshTokenCookie(res as any, 'x');
      const maxAge = res._cookies[REFRESH_TOKEN_COOKIE].options.maxAge;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(maxAge).toBe(sevenDays);
    });
  });

  // ── setAuthCookies ──
  describe('setAuthCookies', () => {
    it('sets both access and refresh cookies', () => {
      const res = mockRes();
      setAuthCookies(res as any, 'access-val', 'refresh-val');
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res._cookies[ACCESS_TOKEN_COOKIE].value).toBe('access-val');
      expect(res._cookies[REFRESH_TOKEN_COOKIE].value).toBe('refresh-val');
    });

    it('both cookies are httpOnly', () => {
      const res = mockRes();
      setAuthCookies(res as any, 'a', 'r');
      expect(res._cookies[ACCESS_TOKEN_COOKIE].options.httpOnly).toBe(true);
      expect(res._cookies[REFRESH_TOKEN_COOKIE].options.httpOnly).toBe(true);
    });

    it('both cookies use sameSite lax', () => {
      const res = mockRes();
      setAuthCookies(res as any, 'a', 'r');
      expect(res._cookies[ACCESS_TOKEN_COOKIE].options.sameSite).toBe('lax');
      expect(res._cookies[REFRESH_TOKEN_COOKIE].options.sameSite).toBe('lax');
    });
  });

  // ── clearAuthCookies ──
  describe('clearAuthCookies', () => {
    it('clears both cookies', () => {
      const res = mockRes();
      clearAuthCookies(res as any);
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });

    it('clears access_token with correct path', () => {
      const res = mockRes();
      clearAuthCookies(res as any);
      expect(res.clearCookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        expect.objectContaining({ path: '/api', httpOnly: true })
      );
    });

    it('clears refresh_token with correct path', () => {
      const res = mockRes();
      clearAuthCookies(res as any);
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        expect.objectContaining({ path: '/api/auth', httpOnly: true })
      );
    });

    it('clear options include sameSite lax', () => {
      const res = mockRes();
      clearAuthCookies(res as any);
      expect(res._cleared[ACCESS_TOKEN_COOKIE].sameSite).toBe('lax');
      expect(res._cleared[REFRESH_TOKEN_COOKIE].sameSite).toBe('lax');
    });
  });
});
