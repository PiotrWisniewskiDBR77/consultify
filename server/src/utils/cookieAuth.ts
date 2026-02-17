/**
 * Cookie-based Authentication Helpers
 *
 * Centralizes cookie configuration for access and refresh tokens.
 * All auth endpoints MUST use these helpers to set/clear cookies.
 *
 * Security properties:
 * - httpOnly: true  → JS cannot read (XSS-proof)
 * - secure: true    → HTTPS only in production
 * - sameSite: lax   → CSRF mitigation + allows top-level navigations
 * - path scoped     → cookies only sent to relevant endpoints
 */

import type { Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

// Cookie names (exported for use in middleware/tests)
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// Durations
const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 1000; // 1 hour in ms
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

const baseCookieOptions: Omit<CookieOptions, 'path' | 'maxAge'> = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
};

/**
 * Set access token cookie on the response.
 */
export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions,
    path: '/api',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

/**
 * Set refresh token cookie on the response.
 * Path is scoped to /api/auth/refresh so it's only sent for refresh requests.
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions,
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/**
 * Set both access and refresh token cookies.
 */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
}

/**
 * Clear all auth cookies (for logout).
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api',
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
  });
}
