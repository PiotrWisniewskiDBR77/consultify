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

// ==========================================
// RATE LIMIT STORE
// ==========================================

const rateLimitStore = new Map<string, number[]>();

// Periodic cleanup of rate limit store (every 5 minutes)
setInterval(() => {
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

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Apply security headers to responses
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (disable unnecessary features)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self), camera=()');

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content Security Policy (customize as needed)
  // Allow images from transparenttextures.com for background patterns
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https://www.transparenttextures.com; " +
      "connect-src 'self'; " +
      "font-src 'self' data:; " +
      "object-src 'none'; " +
      "media-src 'self'; " +
      "frame-src 'none'"
  );

  next();
};

/**
 * Rate limiter factory for sensitive endpoints
 * Uses in-memory store (consider Redis for production clustering)
 * @param options - Rate limit options
 */
export const createRateLimiter = (options: RateLimitOptions = {}) => {
  const { windowMs = 60000, max = 100, message = 'Too many requests' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this key
    let requests = rateLimitStore.get(key) || [];

    // Filter to only requests within the window
    requests = requests.filter((timestamp) => timestamp > windowStart);

    if (requests.length >= max) {
      const retryAfter = Math.ceil((requests[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(requests[0] + windowMs).toISOString());

      res.status(429).json({
        error: message,
        retryAfter,
        code: 'RATE_LIMITED',
      });
      return;
    }

    // Add current request
    requests.push(now);
    rateLimitStore.set(key, requests);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', (max - requests.length).toString());

    next();
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
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string }> = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

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
          errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
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
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
      return;
    }

    next();
  };
};
