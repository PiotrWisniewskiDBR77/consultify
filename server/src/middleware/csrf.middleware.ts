/**
 * CSRF Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * CSRF protection middleware (double-submit cookie)
 *
 * Design goals:
 * - Deterministic in tests (opt-in validation via ENABLE_CSRF_IN_TESTS=true)
 * - Safe default for local/dev (token cookie is readable by frontend; header must match)
 */

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isTestEnv() {
  return process.env.NODE_ENV === 'test' || !!process.env.VITEST;
}

function shouldEnforceInCurrentEnv() {
  // In unit tests we run under NODE_ENV=test; we *only* enforce when explicitly enabled.
  if (isTestEnv() && process.env.ENABLE_CSRF_IN_TESTS !== 'true') return false;
  return true;
}

function generateToken() {
  // 32 bytes -> 64 hex chars
  return crypto.randomBytes(32).toString('hex');
}

function cookieOptions(req: Request) {
  // In production behind HTTPS we want secure cookies; in tests/dev allow http.
  const isSecure =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  return {
    httpOnly: false, // frontend must read and send in header
    sameSite: 'lax' as const,
    secure: !!isSecure,
    path: '/',
    maxAge: ONE_DAY_MS,
  };
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function isSafeMethod(method: string | undefined) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function isExemptPath(path: string | undefined) {
  if (!path) return false;

  // Exact exemptions (auth flows, webhooks, token endpoint)
  const exact = new Set([
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/register',
    '/api/auth/register-demo',
    '/api/auth/demo-login',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/csrf-token',
    '/api/webhooks',
  ]);
  if (exact.has(path)) return true;

  // Prefix exemptions
  const prefixes = ['/api/auth/callback/', '/api/webhooks/stripe', '/api/stripe/webhook'];
  return prefixes.some((p) => path.startsWith(p));
}

/**
 * CSRF token middleware
 */
export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!shouldEnforceInCurrentEnv()) return next();

  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === 'string' && existing.length > 0) return next();

  const token = generateToken();
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions(req));
  return next();
};

/**
 * CSRF validation middleware (double-submit cookie)
 */
export const csrfValidationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!shouldEnforceInCurrentEnv()) return next();
  if (isSafeMethod(req.method)) return next();
  if (isExemptPath(req.path)) return next();

  const cookieTok = req.cookies?.[CSRF_COOKIE_NAME];
  const headerTok = (req.headers?.[CSRF_HEADER_NAME] ??
    // Some frameworks provide non-lowercased header access
    (req.headers as any)?.[CSRF_HEADER_NAME.toUpperCase()]) as string | undefined;

  if (!cookieTok || !headerTok) {
    res.status(403).json({ code: 'CSRF_MISSING', message: 'CSRF token missing' });
    return;
  }

  if (!safeEqual(String(cookieTok), String(headerTok))) {
    res.status(403).json({ code: 'CSRF_INVALID', message: 'CSRF token invalid' });
    return;
  }

  return next();
};

/**
 * Get CSRF token handler
 */
export const getCsrfTokenHandler = (req: Request, res: Response): void => {
  if (!shouldEnforceInCurrentEnv()) {
    // In test mode with CSRF disabled, still provide a token so the frontend can mount.
    // Do NOT use a static token (security integrity gate).
    const existing = req.cookies?.[CSRF_COOKIE_NAME];
    if (typeof existing === 'string' && existing.length > 0) {
      res.json({ token: existing });
      return;
    }
    res.json({ token: generateToken() });
    return;
  }

  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === 'string' && existing.length > 0) {
    res.json({ token: existing });
    return;
  }

  const token = generateToken();
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions(req));
  res.json({ token });
};

export default csrfTokenMiddleware;
