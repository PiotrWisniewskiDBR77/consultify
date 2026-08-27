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
const MAX_CSRF_TOKEN_CHARS = 256;
const CSRF_TOKEN_CANONICAL_CHARS = 64;
const CSRF_TOKEN_CANONICAL_RE = /^[a-f0-9]{64}$/;

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

function readCsrfCookieRaw(req: Request): unknown {
  return safeRead(() => req.cookies?.[CSRF_COOKIE_NAME], undefined as unknown);
}

function readCsrfCookie(req: Request): string | undefined {
  const raw = readCsrfCookieRaw(req);
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function readCsrfHeader(req: Request): string | undefined {
  const normalizeHeaderValue = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    }
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string') {
        const normalized = first.trim();
        return normalized.length > 0 ? normalized : undefined;
      }
    }
    return undefined;
  };

  const lower = safeRead(() => req.headers?.[CSRF_HEADER_NAME], undefined as unknown);
  const normalizedLower = normalizeHeaderValue(lower);
  if (normalizedLower) return normalizedLower;
  const upper = safeRead(
    () => (req.headers as Record<string, unknown>)?.[CSRF_HEADER_NAME.toUpperCase()],
    undefined as unknown
  );
  return normalizeHeaderValue(upper);
}

function readForwardedProtoFromRfc7239(req: Request): string | undefined {
  const raw = safeRead(() => req.headers['forwarded'], undefined as unknown);
  const value =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? raw.find((entry) => typeof entry === 'string')
        : undefined;
  if (!value || typeof value !== 'string') return undefined;
  const firstElement = value.split(',')[0]?.trim();
  if (!firstElement) return undefined;
  const params = firstElement.split(';');
  for (const param of params) {
    const [rawKey, ...rawValueParts] = param.split('=');
    if (!rawKey || rawValueParts.length === 0) continue;
    if (rawKey.trim().toLowerCase() !== 'proto') continue;
    const rawValue = rawValueParts.join('=').trim();
    const unquoted =
      rawValue.length >= 2 && rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue;
    const normalized = unquoted.trim().toLowerCase();
    return normalized || undefined;
  }
  return undefined;
}

function hasConflictingCsrfHeaderValues(req: Request): boolean {
  const raw = safeRead(() => req.headers?.[CSRF_HEADER_NAME], undefined as unknown);
  if (!Array.isArray(raw) || raw.length <= 1) return false;
  const normalized = raw
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (normalized.length <= 1) return false;
  return new Set(normalized).size > 1;
}
function hasConflictingCsrfHeaderKeySources(req: Request): boolean {
  const normalizeHeaderValue = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    }
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string') {
        const normalized = first.trim();
        return normalized.length > 0 ? normalized : undefined;
      }
    }
    return undefined;
  };
  const lower = safeRead(() => req.headers?.[CSRF_HEADER_NAME], undefined as unknown);
  const upper = safeRead(
    () => (req.headers as Record<string, unknown>)?.[CSRF_HEADER_NAME.toUpperCase()],
    undefined as unknown
  );
  const normalizedLower = normalizeHeaderValue(lower);
  const normalizedUpper = normalizeHeaderValue(upper);
  if (!normalizedLower || !normalizedUpper) return false;
  return normalizedLower !== normalizedUpper;
}
function hasConflictingCsrfCookieAssignments(req: Request): boolean {
  const rawCookieHeader = safeRead(() => req.headers?.cookie, undefined as unknown);
  if (typeof rawCookieHeader !== 'string' || !rawCookieHeader.trim()) return false;
  const observed = new Set<string>();
  for (const segment of rawCookieHeader.split(';')) {
    const equalsIndex = segment.indexOf('=');
    if (equalsIndex <= 0) continue;
    const rawName = segment.slice(0, equalsIndex).trim();
    if (rawName !== CSRF_COOKIE_NAME) continue;
    const rawValue = segment.slice(equalsIndex + 1).trim();
    if (!rawValue) continue;
    observed.add(rawValue);
    if (observed.size > 1) return true;
  }
  return false;
}

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
function isCanonicalCsrfToken(value: string | undefined): boolean {
  if (!value) return false;
  if (value.length !== CSRF_TOKEN_CANONICAL_CHARS) return false;
  return CSRF_TOKEN_CANONICAL_RE.test(value);
}

function cookieOptions(req: Request) {
  const readForwardedProto = (): string | undefined => {
    const raw = safeRead(() => req.headers['x-forwarded-proto'], undefined as unknown);
    if (typeof raw !== 'string') return undefined;
    const firstHop = raw.split(',')[0]?.trim().toLowerCase();
    return firstHop || undefined;
  };

  // In production behind HTTPS we want secure cookies; in tests/dev allow http.
  const isSecure =
    safeRead(() => req.secure, false) ||
    readForwardedProto() === 'https' ||
    readForwardedProtoFromRfc7239(req) === 'https' ||
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
  if (a.length !== CSRF_TOKEN_CANONICAL_CHARS || b.length !== CSRF_TOKEN_CANONICAL_CHARS) {
    return false;
  }
  try {
    const aBuffer = Buffer.from(a, 'hex');
    const bBuffer = Buffer.from(b, 'hex');
    if (aBuffer.length !== 32 || bBuffer.length !== 32) return false;
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}

function isSafeMethod(method: string | undefined) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function sendCsrfForbidden(
  res: Response,
  body: { code: 'CSRF_MISSING' | 'CSRF_INVALID'; message: string }
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(403).json(body);
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
    // Pre-session, like /login: no session cookie exists yet for a forged
    // cross-site POST to ride on, and every existing auth entry point here is
    // exempt for the same reason.
    '/api/auth/quick-access',
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

  const existing = readCsrfCookie(req);
  if (isCanonicalCsrfToken(existing)) return next();

  const token = generateToken();
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions(req));
  return next();
};

/**
 * CSRF validation middleware (double-submit cookie)
 */
export const csrfValidationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!shouldEnforceInCurrentEnv()) return next();
  const rawRequestMethod = safeRead(() => req.method, undefined as unknown as string | undefined);
  const requestMethod =
    typeof rawRequestMethod === 'string' ? rawRequestMethod.trim().toUpperCase() : undefined;
  const requestPath = safeRead(() => req.path, undefined as unknown as string | undefined);
  if (isSafeMethod(requestMethod)) return next();
  if (isExemptPath(requestPath)) return next();

  const cookieTok = readCsrfCookieRaw(req);
  const headerTok = readCsrfHeader(req);
  if (hasConflictingCsrfHeaderValues(req) || hasConflictingCsrfHeaderKeySources(req)) {
    sendCsrfForbidden(res, { code: 'CSRF_INVALID', message: 'CSRF token invalid' });
    return;
  }
  if (hasConflictingCsrfCookieAssignments(req)) {
    sendCsrfForbidden(res, { code: 'CSRF_INVALID', message: 'CSRF token invalid' });
    return;
  }

  if (cookieTok === undefined || cookieTok === null || !headerTok) {
    sendCsrfForbidden(res, { code: 'CSRF_MISSING', message: 'CSRF token missing' });
    return;
  }
  if (typeof cookieTok !== 'string') {
    sendCsrfForbidden(res, { code: 'CSRF_INVALID', message: 'CSRF token invalid' });
    return;
  }
  if (cookieTok.length > MAX_CSRF_TOKEN_CHARS || headerTok.length > MAX_CSRF_TOKEN_CHARS) {
    sendCsrfForbidden(res, { code: 'CSRF_INVALID', message: 'CSRF token invalid' });
    return;
  }
  if (!isCanonicalCsrfToken(cookieTok) || !isCanonicalCsrfToken(headerTok)) {
    sendCsrfForbidden(res, { code: 'CSRF_INVALID', message: 'CSRF token invalid' });
    return;
  }

  if (!safeEqual(cookieTok, headerTok)) {
    sendCsrfForbidden(res, { code: 'CSRF_INVALID', message: 'CSRF token invalid' });
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
    const existing = readCsrfCookie(req);
    if (isCanonicalCsrfToken(existing)) {
      res.json({ token: existing });
      return;
    }
    res.json({ token: generateToken() });
    return;
  }

  const existing = readCsrfCookie(req);
  if (isCanonicalCsrfToken(existing)) {
    res.json({ token: existing });
    return;
  }

  const token = generateToken();
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions(req));
  res.json({ token });
};

export default csrfTokenMiddleware;
