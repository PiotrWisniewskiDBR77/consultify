/**
 * Rate Limiting Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Production-grade rate limiting with in-memory sliding window.
 * Enforces real limits per endpoint category.
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// In-Memory Sliding Window Store
// ---------------------------------------------------------------------------
interface Entry {
  count: number;
  resetAt: number;
}
const store = new Map<string, Entry>();
const MAX_RATE_LIMIT_IP_KEY_LEN = 256;
const MAX_RATE_LIMIT_JWT_DECODE_LEN = 16384;
const MAX_RATE_LIMIT_STORE_KEYS = 50_000;
const STORE_CAP_PRUNE_TARGET = 45_000;
const STORE_CLEANUP_INTERVAL_KEY = '__consultifyRateLimitStoreCleanup__';
type RateLimitGlobal = typeof globalThis & { [STORE_CLEANUP_INTERVAL_KEY]?: ReturnType<typeof setInterval> };
const globalRateLimit = globalThis as RateLimitGlobal;
if (globalRateLimit[STORE_CLEANUP_INTERVAL_KEY]) {
  clearInterval(globalRateLimit[STORE_CLEANUP_INTERVAL_KEY]);
}
const storeCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}, 60_000);
globalRateLimit[STORE_CLEANUP_INTERVAL_KEY] = storeCleanupInterval;
storeCleanupInterval.unref?.();

function safeInvokeNext(next: NextFunction): void {
  if (typeof next !== 'function') return;
  try {
    next();
  } catch {
    // Rate limiter must never crash due to downstream handler failures.
  }
}

function capKeySegment(value: string): string {
  if (value.length <= MAX_RATE_LIMIT_IP_KEY_LEN) return value;
  return value.slice(0, MAX_RATE_LIMIT_IP_KEY_LEN);
}

function increment(key: string, windowMs: number): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    const e = { count: 1, resetAt: now + windowMs };
    store.set(key, e);
    enforceStoreCap(now);
    return e;
  }
  entry.count++;
  return { count: entry.count, resetAt: entry.resetAt };
}

function enforceStoreCap(now: number): void {
  if (store.size <= MAX_RATE_LIMIT_STORE_KEYS) return;
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
  if (store.size <= MAX_RATE_LIMIT_STORE_KEYS) return;

  const byResetAt = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  for (const [key] of byResetAt) {
    if (store.size <= STORE_CAP_PRUNE_TARGET) break;
    store.delete(key);
  }
}

function resolveLimiterParams(windowMs: number, max: number): { windowMs: number; max: number } {
  const resolvedWindowMs =
    typeof windowMs === 'number' && Number.isFinite(windowMs) && windowMs > 0
      ? Math.floor(windowMs)
      : 15 * 60_000;
  const resolvedMax =
    typeof max === 'number' && Number.isFinite(max) && max > 0 ? Math.floor(max) : 1;
  return { windowMs: resolvedWindowMs, max: resolvedMax };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

function safeSetHeader(res: Response, headerName: string, value: string): void {
  try {
    res.setHeader(headerName, value);
  } catch {
    // Best effort only; limiter still functions without headers.
  }
}
function toSafeNonNegativeIntCount(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}
function toSafeNonNegativeIntSeconds(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.ceil(numeric));
}

function extractToken(req: Request): string | null {
  const authHeader = safeRead(() => req.headers['authorization'], undefined as unknown);
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = normalizeOptionalString(authHeader.slice(7));
    if (bearerToken) return bearerToken;
  }
  if (typeof authHeader === 'string') {
    const normalizedAuthHeader = normalizeOptionalString(authHeader);
    if (normalizedAuthHeader) return normalizedAuthHeader;
  }
  if (Array.isArray(authHeader)) {
    for (const authHeaderValue of authHeader) {
      if (typeof authHeaderValue !== 'string') continue;
      if (authHeaderValue.startsWith('Bearer ')) {
        const bearerToken = normalizeOptionalString(authHeaderValue.slice(7));
        if (bearerToken) return bearerToken;
      }
      const normalizedAuthHeader = normalizeOptionalString(authHeaderValue);
      if (normalizedAuthHeader) return normalizedAuthHeader;
    }
  }

  const cookieToken =
    safeRead(() => (req as any).cookies?.access_token, undefined as unknown) ||
    safeRead(() => (req as any).cookies?.token, undefined as unknown);
  if (typeof cookieToken === 'string') {
    const normalizedCookieToken = normalizeOptionalString(cookieToken);
    if (normalizedCookieToken) return normalizedCookieToken;
  }

  return null;
}

function tryExtractUserIdFromToken(req: Request): string | null {
  const token = extractToken(req);
  if (!token) return null;
  if (token.length > MAX_RATE_LIMIT_JWT_DECODE_LEN) return null;

  try {
    const decoded = jwt.decode(token) as { id?: string; userId?: string; sub?: string } | null;
    const candidate =
      normalizeOptionalString(safeRead(() => decoded?.id, undefined as unknown)) ||
      normalizeOptionalString(safeRead(() => decoded?.userId, undefined as unknown)) ||
      normalizeOptionalString(safeRead(() => decoded?.sub, undefined as unknown));
    return candidate;
  } catch {
    return null;
  }
}

function extractKey(req: Request): string {
  const uid =
    normalizeOptionalString(safeRead(() => (req as any)._rateLimitUserId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => (req as any).userId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => (req as any).user?.id, undefined as unknown));
  if (uid) return `u:${capKeySegment(uid)}`;
  const tokenUid = tryExtractUserIdFromToken(req);
  if (tokenUid) return `u:${capKeySegment(tokenUid)}`;
  const ipFromReqRaw = normalizeOptionalString(safeRead(() => req.ip, undefined as unknown));
  const ipFromReq = ipFromReqRaw ? capKeySegment(ipFromReqRaw) : null;
  const ipFromSocketRaw = normalizeOptionalString(
    safeRead(() => req.socket?.remoteAddress, undefined as unknown)
  );
  const ipFromSocket = ipFromSocketRaw ? capKeySegment(ipFromSocketRaw) : null;
  const forwardedHeader = safeRead(() => req.headers['x-forwarded-for'], undefined as unknown);
  const ipFromForwarded = (() => {
    if (typeof forwardedHeader === 'string') {
      const candidate = normalizeOptionalString(forwardedHeader.split(',')[0]);
      return candidate ? capKeySegment(candidate) : null;
    }
    if (Array.isArray(forwardedHeader)) {
      for (const forwardedEntry of forwardedHeader) {
        if (typeof forwardedEntry !== 'string') continue;
        const candidate = normalizeOptionalString(forwardedEntry.split(',')[0]);
        if (candidate) return capKeySegment(candidate);
      }
    }
    return null;
  })();
  const ip = capKeySegment(ipFromReq || ipFromSocket || ipFromForwarded || 'unknown');
  return `ip:${ip}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createLimiter(opts: { windowMs: number; max: number; prefix: string; message?: string }) {
  const { prefix, message = 'Too many requests, please try again later.' } = opts;
  const { windowMs, max } = resolveLimiterParams(opts.windowMs, opts.max);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      safeInvokeNext(next);
      return;
    }
    const method = normalizeOptionalString(safeRead(() => req.method, undefined as unknown));
    if (method?.toUpperCase() === 'OPTIONS') {
      safeInvokeNext(next);
      return;
    }
    try {
      const key = `rl:${prefix}:${extractKey(req)}`;
      const { count, resetAt } = increment(key, windowMs);
      const remaining = toSafeNonNegativeIntCount(max - count, 0);
      const resetSeconds = toSafeNonNegativeIntSeconds(resetAt / 1000, 0);

      safeSetHeader(res, 'X-RateLimit-Limit', String(max));
      safeSetHeader(res, 'X-RateLimit-Remaining', String(remaining));
      safeSetHeader(res, 'X-RateLimit-Reset', String(resetSeconds));

      if (count > max) {
        const retryAfter = toSafeNonNegativeIntSeconds((resetAt - Date.now()) / 1000, 0);
        safeSetHeader(res, 'Retry-After', String(retryAfter));
        if (safeRead(() => res.headersSent, false)) {
          safeInvokeNext(next);
          return;
        }
        try {
          res.status(429).json({
            error: message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter,
          });
        } catch {
          safeInvokeNext(next);
        }
        return;
      }
      safeInvokeNext(next);
    } catch {
      // Limiter is defense-in-depth; unexpected internal failures should not block requests.
      if (safeRead(() => res.headersSent, false)) {
        safeInvokeNext(next);
        return;
      }
      safeInvokeNext(next);
    }
  };
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------
const isProd = process.env.NODE_ENV === 'production';

/** Auth (login/register only): 15 req / 15 min - brute force protection */
export const authRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 15 : 5000,
  prefix: 'auth',
  message: 'Too many authentication attempts.',
});

/**
 * API routes (initiatives, tasks, tools, etc.): 1000 req / 15 min.
 * Keys by userId when authenticated, else IP. Use this for general authenticated API routes.
 */
export const apiAuthRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 1000 : 2000,
  prefix: 'api-auth',
  message: 'Too many requests, please try again later.',
});

/** Default API: 300 req / 15 min (prod) */
export const defaultRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 300 : 1000,
  prefix: 'api',
});

/** AI Chat stream: 30 req / min (prod) */
export const aiRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 30 : 200,
  prefix: 'ai',
  message: 'AI request rate limit exceeded.',
});

/** AI Memory: 20 req / min (prod) */
export const aiMemoryRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 20 : 200,
  prefix: 'ai-mem',
});

/** AI Actions: 50 req / min (prod) */
export const aiActionsRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 50 : 200,
  prefix: 'ai-act',
});

/** Conversations: 100 req / min (prod) */
export const conversationsRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 100 : 500,
  prefix: 'conv',
});

/**
 * Feedback submission: 10 req / min (prod).
 *
 * Keys by userId when authenticated, else IP. Scoped narrowly because each
 * POST /api/feedback payload can hold up to ~1.2 MB of diagnostics (screenshot
 * + breadcrumbs + console + network buffers). Without a dedicated limiter one
 * bored user could easily fill the feedback_items table and the
 * FEEDBACK_ARTIFACTS_DIR volume in minutes.
 */
export const feedbackRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 10 : 100,
  prefix: 'feedback',
  message: 'Feedback submission rate limit exceeded. Please try again in a moment.',
});

export const __private__ = {
  resolveLimiterParams,
  toSafeNonNegativeIntCount,
  toSafeNonNegativeIntSeconds,
  getStoreSize: (): number => store.size,
};

export default defaultRateLimiter;
