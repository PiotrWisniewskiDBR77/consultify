/**
 * Rate Limiting Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Production-grade rate limiting with in-memory sliding window.
 * Enforces real limits per endpoint category.
 */

import type { NextFunction, Request, Response } from 'express';

// ---------------------------------------------------------------------------
// In-Memory Sliding Window Store
// ---------------------------------------------------------------------------
interface Entry {
  count: number;
  resetAt: number;
}
const store = new Map<string, Entry>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}, 60_000);

function increment(key: string, windowMs: number): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    const e = { count: 1, resetAt: now + windowMs };
    store.set(key, e);
    return e;
  }
  entry.count++;
  return { count: entry.count, resetAt: entry.resetAt };
}

function extractKey(req: Request): string {
  const uid = (req as any).userId || (req as any).user?.id;
  if (uid) return `u:${uid}`;
  const ip =
    req.ip ||
    req.socket?.remoteAddress ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    'unknown';
  return `ip:${ip}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createLimiter(opts: { windowMs: number; max: number; prefix: string; message?: string }) {
  const { windowMs, max, prefix, message = 'Too many requests, please try again later.' } = opts;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test') return next();
    if (req.method === 'OPTIONS') return next();
    const key = `rl:${prefix}:${extractKey(req)}`;
    const { count, resetAt } = increment(key, windowMs);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
    if (count > max) {
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      });
      return;
    }
    next();
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

export default defaultRateLimiter;
