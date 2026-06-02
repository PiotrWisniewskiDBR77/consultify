/**
 * Security Headers Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Adds security headers for SOC2/ISO compliance.
 */

import { NextFunction, Request, Response } from 'express';

// ==========================================
// TYPES
// ==========================================

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean';
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

interface ValidationSchema {
  [field: string]: ValidationRule;
}

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const MAX_RATE_LIMIT_KEY_SEGMENT = 512;
const RATE_LIMIT_STORE_MAX_KEYS = (() => {
  const raw = Number.parseInt(process.env.RATE_LIMIT_STORE_MAX_KEYS || '', 10);
  if (!Number.isFinite(raw) || raw <= 0) return 50_000;
  return Math.min(raw, 250_000);
})();
const truncateKeySegment = (value: string): string =>
  value.length > MAX_RATE_LIMIT_KEY_SEGMENT ? value.slice(0, MAX_RATE_LIMIT_KEY_SEGMENT) : value;

const safeSetHeader = (res: Response, key: string, value: string): void => {
  safeRead(() => {
    res.setHeader(key, value);
    return true;
  }, false);
};
const safeRemoveHeader = (res: Response, key: string): void => {
  safeRead(() => {
    res.removeHeader(key);
    return true;
  }, false);
};

const safeSendJson = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): void => {
  safeRead(() => {
    res.status(statusCode).json(payload);
    return true;
  }, false);
};

// ==========================================
// RATE LIMIT STORE
// ==========================================

const rateLimitStore = new Map<string, number[]>();

// Periodic cleanup of rate limit store (every 5 minutes)
const rateLimitStoreCleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxAge = 3600000; // 1 hour

  for (const [key, requests] of rateLimitStore.entries()) {
    const filtered = requests.filter((timestamp) => timestamp > now - maxAge);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}, 300000);
rateLimitStoreCleanupInterval.unref?.();

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Apply security headers to responses
 */
const isHttpsRequest = (req: Request): boolean => {
  if (safeRead(() => req.secure === true, false)) return true;
  const forwardedProtoRaw = normalizeOptionalString(
    safeRead(() => req.get?.('x-forwarded-proto'), undefined)
  );
  const forwardedProto = normalizeOptionalString((forwardedProtoRaw || '').split(',')[0]);
  return (forwardedProto || '').toLowerCase() === 'https';
};
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  safeRemoveHeader(res, 'X-Powered-By');
  safeRemoveHeader(res, 'Server');

  // Prevent MIME type sniffing
  safeSetHeader(res, 'X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  safeSetHeader(res, 'X-Frame-Options', 'DENY');

  // XSS protection (legacy browsers)
  safeSetHeader(res, 'X-XSS-Protection', '1; mode=block');

  // Referrer policy
  safeSetHeader(res, 'Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable browser DNS prefetching for stricter privacy and predictable network behavior.
  safeSetHeader(res, 'X-DNS-Prefetch-Control', 'off');
  safeSetHeader(res, 'X-Permitted-Cross-Domain-Policies', 'none');
  safeSetHeader(res, 'Cross-Origin-Opener-Policy', 'same-origin');
  safeSetHeader(res, 'Cross-Origin-Resource-Policy', 'same-site');
  safeSetHeader(res, 'Origin-Agent-Cluster', '?1');

  // Permissions policy (disable unnecessary features)
  safeSetHeader(
    res,
    'Permissions-Policy',
    'geolocation=(), microphone=(self), camera=(), payment=(), usb=(), bluetooth=(), display-capture=(), browsing-topics=(), join-ad-interest-group=(), run-ad-auction=(), accelerometer=(), gyroscope=(), magnetometer=(), ambient-light-sensor=(), serial=(), hid=(), gamepad=(), storage-access=(), web-share=(), window-management=(), identity-credentials-get=()'
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = isHttpsRequest(req);

  // HSTS (only in production with HTTPS)
  if (isProduction && isHttps) {
    const hstsParts = ['max-age=31536000', 'includeSubDomains'];
    if (process.env.HSTS_PRELOAD === '1') hstsParts.push('preload');
    safeSetHeader(res, 'Strict-Transport-Security', hstsParts.join('; '));
  }

  // Content Security Policy (customize as needed)
  // Allow images from transparenttextures.com for background patterns
  const cspBase =
    "default-src 'self'; " +
    "base-uri 'self'; " +
    "manifest-src 'self'; " +
    "form-action 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https://www.transparenttextures.com; " +
    "connect-src 'self'; " +
    "font-src 'self' data:; " +
    "worker-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-ancestors 'none'; " +
    "frame-src 'none'";
  const csp = isProduction && isHttps ? `${cspBase}; upgrade-insecure-requests` : cspBase;

  safeSetHeader(res, 'Content-Security-Policy', csp);

  safeRead(() => {
    next();
    return true;
  }, false);
};

/**
 * Rate limiter factory for sensitive endpoints
 * Uses in-memory store (consider Redis for production clustering)
 * @param options - Rate limit options
 */
export const createRateLimiter = (options: RateLimitOptions = {}) => {
  const { windowMs = 60000, max = 100, message = 'Too many requests' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      normalizeOptionalString(safeRead(() => req.ip, undefined)) ||
      normalizeOptionalString(safeRead(() => req.socket?.remoteAddress, undefined)) ||
      '';
    const ipSegment = truncateKeySegment(ip);
    const pathRaw =
      normalizeOptionalString(safeRead(() => req.path, undefined)) ||
      normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
      '';
    const path = truncateKeySegment(pathRaw);
    const key = `${ipSegment}-${path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this key
    let requests = rateLimitStore.get(key) || [];

    // Filter to only requests within the window
    requests = requests.filter((timestamp) => timestamp > windowStart);

    if (requests.length >= max) {
      const retryAfter = Math.ceil((requests[0] + windowMs - now) / 1000);
      safeSetHeader(res, 'X-Content-Type-Options', 'nosniff');
      safeSetHeader(res, 'X-Frame-Options', 'DENY');
      safeSetHeader(
        res,
        'Content-Security-Policy',
        "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      );
      safeSetHeader(res, 'Retry-After', retryAfter.toString());
      safeSetHeader(res, 'X-RateLimit-Limit', max.toString());
      safeSetHeader(res, 'X-RateLimit-Remaining', '0');
      safeSetHeader(res, 'X-RateLimit-Reset', new Date(requests[0] + windowMs).toISOString());
      safeSetHeader(res, 'Cache-Control', 'no-store');
      safeSetHeader(res, 'Pragma', 'no-cache');

      safeSendJson(res, 429, {
        error: message,
        retryAfter,
        code: 'RATE_LIMITED',
      });
      return;
    }

    // Add current request
    requests.push(now);
    if (!rateLimitStore.has(key) && rateLimitStore.size >= RATE_LIMIT_STORE_MAX_KEYS) {
      const oldestKey = rateLimitStore.keys().next().value;
      if (typeof oldestKey === 'string') rateLimitStore.delete(oldestKey);
    }
    rateLimitStore.set(key, requests);

    // Set rate limit headers
    safeSetHeader(res, 'X-RateLimit-Limit', max.toString());
    safeSetHeader(res, 'X-RateLimit-Remaining', (max - requests.length).toString());

    safeRead(() => {
      next();
      return true;
    }, false);
  };
};

/**
 * Rate limiter presets for common scenarios
 */
export const rateLimitPresets = {
  // Sensitive admin operations
  admin: createRateLimiter({
    windowMs: 60000, // 1 minute
    max: 30,
    message: 'Too many admin requests, please slow down',
  }),

  // Authentication endpoints
  auth: createRateLimiter({
    windowMs: 900000, // 15 minutes
    max: 10,
    message: 'Too many authentication attempts, please try again later',
  }),

  // Break-glass operations (very restrictive)
  breakGlass: createRateLimiter({
    windowMs: 3600000, // 1 hour
    max: 5,
    message: 'Break-glass operations are rate limited for security',
  }),

  // Export operations
  export: createRateLimiter({
    windowMs: 300000, // 5 minutes
    max: 10,
    message: 'Export operations are rate limited',
  }),

  // General API
  api: createRateLimiter({
    windowMs: 60000, // 1 minute
    max: 200,
    message: 'Too many requests',
  }),
};

/**
 * Request validation middleware factory
 * Validates request body against a simple schema
 * @param schema - Validation schema
 */
export const validateRequest = (schema: ValidationSchema) => {
  const formatEnumValuesForMessage = (values: unknown[]): string => {
    const formatted = values.map((entry) =>
      typeof entry === 'string' ? entry : safeRead(() => JSON.stringify(entry), String(entry))
    );
    return formatted.join(', ');
  };
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string }> = [];
    const rawBody = safeRead(
      () => req.body as Record<string, unknown>,
      {} as Record<string, unknown>
    );
    const body =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push({ field, message: `${field} must be a string` });
        }
        if (rules.type === 'number' && typeof value !== 'number') {
          errors.push({ field, message: `${field} must be a number` });
        }
        if (rules.type === 'boolean' && typeof value !== 'boolean') {
          errors.push({ field, message: `${field} must be a boolean` });
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push({
            field,
            message: `${field} must be one of: ${formatEnumValuesForMessage(rules.enum)}`,
          });
        }
        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
          errors.push({
            field,
            message: `${field} must be at least ${rules.minLength} characters`,
          });
        }
        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
          errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
        }
        if (rules.min && typeof value === 'number' && value < rules.min) {
          errors.push({ field, message: `${field} must be at least ${rules.min}` });
        }
        if (rules.max && typeof value === 'number' && value > rules.max) {
          errors.push({ field, message: `${field} must be at most ${rules.max}` });
        }
        if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
          errors.push({ field, message: `${field} format is invalid` });
        }
      }
    }

    if (errors.length > 0) {
      safeSetHeader(res, 'X-Content-Type-Options', 'nosniff');
      safeSetHeader(res, 'X-Frame-Options', 'DENY');
      safeSetHeader(res, 'Cache-Control', 'no-store');
      safeSetHeader(res, 'Pragma', 'no-cache');
      safeSendJson(res, 400, {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
      return;
    }

    safeRead(() => {
      next();
      return true;
    }, false);
  };
};
