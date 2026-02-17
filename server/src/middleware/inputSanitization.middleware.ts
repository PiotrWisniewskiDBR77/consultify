/**
 * Input Sanitization Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Real sanitization that neutralizes XSS payloads in request body and query params.
 * Uses the sanitizeObject utility from security.utils.ts.
 *
 * Strategy:
 * - Sanitize req.body and req.query recursively (escape HTML entities)
 * - Reject payloads that exceed depth/size limits
 * - Skip binary/file uploads (multipart)
 * - Log suspicious payloads for monitoring
 */

import type { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';

const MAX_BODY_DEPTH = 10;
const MAX_STRING_LENGTH = 50000; // 50KB per string field
const isVitest = !!process.env.VITEST;

type SecurityUtilsModule = typeof import('../utils/security.utils.ts');
let securityUtilsPromise: Promise<Pick<SecurityUtilsModule, 'sanitizeObject'>> | null = null;

async function loadSecurityUtils(): Promise<Pick<SecurityUtilsModule, 'sanitizeObject'>> {
  if (!securityUtilsPromise) {
    // IMPORTANT:
    // - In Vitest we want TS source (stable + direct coverage).
    // - In built runtime (dist/) we must import JS (there is no *.ts in dist/).
    const isBuiltRuntime =
      import.meta.url.includes('/dist/') ||
      import.meta.url.includes('\\dist\\') ||
      import.meta.url.includes('/server/dist/');

    const spec = isBuiltRuntime ? '../utils/security.utils.js' : '../utils/security.utils.ts';

    // If the preferred spec fails (edge tooling), fall back to the other one.
    securityUtilsPromise = (async () => {
      try {
        const m = await import(spec);
        return m as Pick<SecurityUtilsModule, 'sanitizeObject'>;
      } catch {
        const fallback = spec.endsWith('.js')
          ? '../utils/security.utils.ts'
          : '../utils/security.utils.js';
        const m = await import(fallback);
        return m as Pick<SecurityUtilsModule, 'sanitizeObject'>;
      }
    })();
  }
  return securityUtilsPromise;
}

// Patterns that indicate potential XSS/injection
const SUSPICIOUS_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i, // onclick=, onerror=, etc.
  /data:\s*text\/html/i,
  /\beval\s*\(/i,
  /\bdocument\.\w/i,
  /\bwindow\.\w/i,
];

/**
 * Check if a string contains suspicious patterns
 */
function isSuspicious(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Truncate overly long string values
 */
function truncateStrings(obj: unknown, maxLen: number = MAX_STRING_LENGTH): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return obj.length > maxLen ? obj.substring(0, maxLen) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => truncateStrings(item, maxLen));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateStrings(value, maxLen);
    }
    return result;
  }

  return obj;
}

/**
 * Log suspicious payloads for security monitoring
 */
function checkForSuspiciousContent(body: unknown, path: string, method: string): void {
  if (!body || typeof body !== 'object') return;

  const checkValue = (value: unknown, fieldPath: string): void => {
    if (typeof value === 'string' && isSuspicious(value)) {
      logger.warn(
        `[Security] Suspicious input detected: ${method} ${path} field="${fieldPath}" pattern="${value.substring(0, 100)}"`
      );
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        checkValue(val, `${fieldPath}.${key}`);
      }
    }
  };

  checkValue(body, 'body');
}

/**
 * Input sanitization middleware
 * Sanitizes req.body and req.query to prevent XSS
 */
export const inputSanitizationMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip multipart/file uploads (binary data)
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      next();
      return Promise.resolve();
    }

    const { sanitizeObject } = await loadSecurityUtils();

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      // Log suspicious content before sanitization (for security monitoring)
      if (!isVitest) {
        checkForSuspiciousContent(req.body, req.path, req.method);
      }

      // Truncate overly long strings
      req.body = truncateStrings(req.body);

      // Sanitize HTML entities in all string values
      req.body = sanitizeObject(req.body, MAX_BODY_DEPTH);
    }

    // Sanitize query parameters (mutate in place - req.query may be read-only for reassignment)
    if (req.query && typeof req.query === 'object') {
      const sanitized = sanitizeObject(req.query, MAX_BODY_DEPTH) as Record<string, unknown>;
      try {
        for (const key of Object.keys(req.query)) {
          delete (req.query as Record<string, unknown>)[key];
        }
        Object.assign(req.query, sanitized);
      } catch {
        // req.query may be frozen/sealed in some setups - skip query sanitization
      }
    }

    next();
    return Promise.resolve();
  } catch (error) {
    logger.error('[Security] Input sanitization error:', error);
    // In production: don't block the request on sanitization errors — log and continue.
    // In tests: fail fast so CI/pre-commit can catch broken sanitization.
    if (isVitest) {
      throw error;
    }
    next();
    return Promise.resolve();
  }
};

export default inputSanitizationMiddleware;

/**
 * Internal helpers exposed for unit testing.
 * These are NOT part of the public middleware API.
 */
export const __private__ = {
  isSuspicious,
  truncateStrings,
  checkForSuspiciousContent,
  // Keep the loader available so tests can assert caching/behavior if needed.
  loadSecurityUtils,
};
