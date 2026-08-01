/**
 * Rate Limiting Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Production-grade rate limiting with in-memory sliding window.
 * Enforces real limits per endpoint category.
 */

import crypto from 'crypto';
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
const MAX_RATE_LIMIT_WINDOW_MS = 7 * 24 * 60 * 60_000;
const MAX_RATE_LIMIT_MAX = 1_000_000;
const STORE_CLEANUP_INTERVAL_KEY = '__consultifyRateLimitStoreCleanup__';
type RateLimitGlobal = typeof globalThis & {
  [STORE_CLEANUP_INTERVAL_KEY]?: ReturnType<typeof setInterval>;
};
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

function normalizeIpKeyMaterial(value: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return '';
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(normalized)) {
    return normalized.replace(/:\d+$/, '');
  }
  if (normalized.startsWith('[')) {
    const bracketCloseIndex = normalized.indexOf(']');
    if (bracketCloseIndex > 1) {
      return normalized.slice(1, bracketCloseIndex);
    }
  }
  return normalized;
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

function clampOverLimitCount(key: string, max: number): void {
  const entry = store.get(key);
  if (!entry) return;
  const clamped = Math.max(1, max + 1);
  if (entry.count > clamped) {
    entry.count = clamped;
  }
}

function enforceStoreCap(now: number): void {
  if (store.size <= MAX_RATE_LIMIT_STORE_KEYS) return;
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
  if (store.size <= MAX_RATE_LIMIT_STORE_KEYS) return;
  let keysToDelete = store.size - STORE_CAP_PRUNE_TARGET;
  if (keysToDelete <= 0) return;
  const candidates: Array<{ key: string; resetAt: number }> = [];
  for (const [key, entry] of store) {
    if (keysToDelete <= 0) break;
    if (candidates.length < keysToDelete) {
      candidates.push({ key, resetAt: entry.resetAt });
      continue;
    }
    let maxIndex = 0;
    for (let i = 1; i < candidates.length; i += 1) {
      if (candidates[i].resetAt > candidates[maxIndex].resetAt) {
        maxIndex = i;
      }
    }
    if (entry.resetAt < candidates[maxIndex].resetAt) {
      candidates[maxIndex] = { key, resetAt: entry.resetAt };
    }
  }
  for (const candidate of candidates) {
    if (store.size <= STORE_CAP_PRUNE_TARGET) break;
    if (store.delete(candidate.key)) {
      keysToDelete -= 1;
    }
  }
}

function resolveLimiterParams(windowMs: number, max: number): { windowMs: number; max: number } {
  const resolvedWindowMsRaw =
    typeof windowMs === 'number' && Number.isFinite(windowMs) && windowMs > 0
      ? Math.floor(windowMs)
      : 15 * 60_000;
  const resolvedMaxRaw =
    typeof max === 'number' && Number.isFinite(max) && max > 0 ? Math.floor(max) : 1;
  const resolvedWindowMs = Math.min(resolvedWindowMsRaw, MAX_RATE_LIMIT_WINDOW_MS);
  const resolvedMax = Math.min(resolvedMaxRaw, MAX_RATE_LIMIT_MAX);
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

function safeSetHeader(res: Response, headerName: string, value: string | number): void {
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
  const ipFromReq = ipFromReqRaw ? capKeySegment(normalizeIpKeyMaterial(ipFromReqRaw)) : null;
  const ipFromSocketRaw = normalizeOptionalString(
    safeRead(() => req.socket?.remoteAddress, undefined as unknown)
  );
  const ipFromSocket = ipFromSocketRaw
    ? capKeySegment(normalizeIpKeyMaterial(ipFromSocketRaw))
    : null;
  const forwardedHeader = safeRead(() => req.headers['x-forwarded-for'], undefined as unknown);
  const trustProxy = Boolean(
    safeRead(
      () =>
        (req as Request & { app?: { get?: (name: string) => unknown } }).app?.get?.('trust proxy'),
      false
    )
  );
  const ipFromForwarded = (() => {
    if (!trustProxy) return null;
    if (typeof forwardedHeader === 'string') {
      const candidate = normalizeOptionalString(forwardedHeader.split(',')[0]);
      return candidate ? capKeySegment(normalizeIpKeyMaterial(candidate)) : null;
    }
    if (Array.isArray(forwardedHeader)) {
      for (const forwardedEntry of forwardedHeader) {
        if (typeof forwardedEntry !== 'string') continue;
        const candidate = normalizeOptionalString(forwardedEntry.split(',')[0]);
        if (candidate) return capKeySegment(normalizeIpKeyMaterial(candidate));
      }
    }
    return null;
  })();
  const ip = capKeySegment(ipFromReq || ipFromForwarded || ipFromSocket || 'unknown');
  return `ip:${ip}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createLimiter(opts: {
  windowMs: number;
  max: number;
  prefix: string;
  message?: string;
  /**
   * Overrides the default identity (user id, else IP). Must return an ALREADY
   * OPAQUE value — the returned string lands in the store key verbatim, so a raw
   * email address here would put registered addresses in the key space. Return
   * an empty string to fall back to the default identity, which is what an
   * anonymous request with no usable identifier should do.
   */
  keyResolver?: (req: Request) => string;
}) {
  const { prefix, message = 'Too many requests, please try again later.', keyResolver } = opts;
  const { windowMs, max } = resolveLimiterParams(opts.windowMs, opts.max);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test') {
      safeInvokeNext(next);
      return;
    }
    const disableRateLimitRequested = process.env.DISABLE_RATE_LIMIT === 'true';
    const allowProdDisable = process.env.RATE_LIMIT_ALLOW_PROD_DISABLE === 'true';
    if (disableRateLimitRequested && (process.env.NODE_ENV !== 'production' || allowProdDisable)) {
      safeInvokeNext(next);
      return;
    }
    const method = normalizeOptionalString(safeRead(() => req.method, undefined as unknown));
    if (method?.toUpperCase() === 'OPTIONS') {
      safeInvokeNext(next);
      return;
    }
    try {
      const resolved = keyResolver
        ? normalizeOptionalString(safeRead(() => keyResolver(req), undefined as unknown))
        : undefined;
      const key = `rl:${prefix}:${resolved ? capKeySegment(resolved) : extractKey(req)}`;
      const { count, resetAt } = increment(key, windowMs);
      const remaining = toSafeNonNegativeIntCount(max - count, 0);
      const resetSeconds = toSafeNonNegativeIntSeconds(resetAt / 1000, 0);

      safeSetHeader(res, 'X-RateLimit-Limit', max);
      safeSetHeader(res, 'X-RateLimit-Remaining', remaining);
      safeSetHeader(res, 'X-RateLimit-Reset', resetSeconds);

      if (count > max) {
        clampOverLimitCount(key, max);
        const retryAfter = Math.max(
          1,
          toSafeNonNegativeIntSeconds((resetAt - Date.now()) / 1000, 0)
        );
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
          if (!safeRead(() => res.headersSent, false)) {
            safeRead(() => {
              const statusResult = res.status(429) as Response | { end?: () => void };
              if (statusResult && typeof statusResult.end === 'function') {
                statusResult.end();
                return;
              }
              if (typeof (res as Response & { end?: () => void }).end === 'function') {
                (res as Response & { end?: () => void }).end?.();
              }
            }, undefined as void);
          }
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
 * API routes (initiatives, tasks, tools, etc.).
 * Keys by userId when authenticated (see extractKey -> `u:<uid>`), else IP.
 *
 * FIX-1 (429 self-storm): the previous 1000/2000-per-15min bucket was too low
 * for a single real SPA session. One My Work / Ideas screen load legitimately
 * fans out across dozens of authenticated GETs (hub loaders, session-context,
 * inbox, notebooks, tasks, polling) and was tripping its OWN per-user limit ->
 * 429 death-spiral that made most screens "Failed to load". Because this bucket
 * is per-authenticated-user, a high ceiling here does NOT weaken cross-user
 * abuse protection — it only stops the app from rate-limiting itself. Kept
 * generous-but-finite in prod so a single compromised session still can't run
 * unbounded; non-prod is very high to make StrictMode double-fire + dev polling
 * a non-issue.
 */
export const apiAuthRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 12_000 : 60_000,
  prefix: 'api-auth',
  message: 'Too many requests, please try again later.',
});

// ---------------------------------------------------------------------------
// Public demo signup (OPS-DEMO-002)
// ---------------------------------------------------------------------------

/**
 * Opaque identity for the per-address demo signup quota.
 *
 * The address is hashed with a domain-separated prefix and truncated, so the
 * rate-limit key space never contains a registered address. Callers must pass
 * the SAME normalized form the account lookup uses (lowercased, trimmed),
 * otherwise `Foo@x.test` and `foo@x.test` would get separate quotas.
 */
export function hashRateLimitIdentity(namespace: string, value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return crypto
    .createHash('sha256')
    .update(`rate-limit-identity-v1:${namespace}:${normalized}`)
    .digest('hex')
    .slice(0, 32);
}

function demoSignupIdentityKey(req: Request): string {
  const email = normalizeOptionalString(
    safeRead(() => (req.body as { email?: unknown } | undefined)?.email, undefined as unknown)
  );
  if (!email) return '';
  const hashed = hashRateLimitIdentity('demo-signup', email.trim().toLowerCase());
  return hashed ? `id:${hashed}` : '';
}

/**
 * Public demo signup, per source IP. This is the endpoint's only network-level
 * brake: it provisions a seeded tenant per success, so an unthrottled caller can
 * fill the demo database and enumerate addresses at will.
 */
export const demoSignupIpRateLimiter = createLimiter({
  windowMs: 60 * 60_000,
  max: isProd ? 5 : 500,
  prefix: 'demo-signup-ip',
  message: 'Too many demo requests from this network. Please try again later.',
});

/**
 * Public demo signup, per address (hashed). Distinct from the IP bucket so that
 * hammering one address from many networks is still bounded — that is the shape
 * an enumeration or provisioning-abuse attempt takes behind a proxy pool.
 * Falls back to the IP identity when the body carries no address.
 */
export const demoSignupIdentityRateLimiter = createLimiter({
  windowMs: 60 * 60_000,
  max: isProd ? 3 : 500,
  prefix: 'demo-signup-id',
  message: 'Too many demo requests for this address. Please try again later.',
  keyResolver: demoSignupIdentityKey,
});

/** Public invitation token endpoints: stricter anti-enumeration limits */
export const invitePublicRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 15 : 300,
  prefix: 'invite-public',
  message: 'Too many invitation attempts. Please try again later.',
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
  MAX_RATE_LIMIT_WINDOW_MS,
  MAX_RATE_LIMIT_MAX,
  getStoreSize: (): number => store.size,
};

export default defaultRateLimiter;
