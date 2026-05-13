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
const MAX_ARRAY_ELEMENTS = 10000;
const MAX_OBJECT_KEYS = 10000;
const MAX_SUSPICIOUS_GRAPH_NODES = 5000;
const isVitest = !!process.env.VITEST;

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

const normalizeContentTypeHeader = (req: Request): string => {
  const raw = safeRead(() => req.headers['content-type'], undefined as unknown);
  if (typeof raw === 'string') return raw.trim().toLowerCase();
  if (Array.isArray(raw)) {
    const firstString = raw.find((item) => typeof item === 'string');
    return typeof firstString === 'string' ? firstString.trim().toLowerCase() : '';
  }
  return '';
};

type SecurityUtilsModule = typeof import('../utils/security.utils.ts');
let securityUtilsPromise: Promise<Pick<SecurityUtilsModule, 'sanitizeObject'>> | null = null;

async function loadSecurityUtils(): Promise<Pick<SecurityUtilsModule, 'sanitizeObject'>> {
  if (!securityUtilsPromise) {
    const loaderPromise = (async () => {
      // IMPORTANT:
      // - In Vitest we want TS source (stable + direct coverage).
      // - In built runtime (dist/) we must import JS (there is no *.ts in dist/).
      const isBuiltRuntime =
        import.meta.url.includes('/dist/') ||
        import.meta.url.includes('\\dist\\') ||
        import.meta.url.includes('/server/dist/');

      const spec = isBuiltRuntime ? '../utils/security.utils.js' : '../utils/security.utils.ts';
      // If the preferred spec fails (edge tooling), fall back to the other one.
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
    securityUtilsPromise = loaderPromise.catch((error) => {
      securityUtilsPromise = null;
      throw error;
    });
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
function truncateStrings(
  obj: unknown,
  maxLen: number = MAX_STRING_LENGTH,
  depth: number = MAX_BODY_DEPTH
): unknown {
  if (depth <= 0) return obj;
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return obj.length > maxLen ? obj.substring(0, maxLen) : obj;
  }

  if (Array.isArray(obj)) {
    const bounded = obj.length > MAX_ARRAY_ELEMENTS ? obj.slice(0, MAX_ARRAY_ELEMENTS) : obj;
    return bounded.map((item) => truncateStrings(item, maxLen, depth - 1));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>);
    const boundedKeys = keys.length > MAX_OBJECT_KEYS ? keys.slice(0, MAX_OBJECT_KEYS) : keys;
    for (const key of boundedKeys) {
      result[key] = truncateStrings((obj as Record<string, unknown>)[key], maxLen, depth - 1);
    }
    return result;
  }

  return obj;
}

/**
 * Neutralize common inline event-handler patterns in plain text.
 *
 * We do NOT try to parse HTML here. This is a defensive pass that ensures
 * strings cannot resemble active attributes like `onerror=...` even after
 * entity-escaping. We only target `on*=` patterns; we intentionally keep
 * normal `/` and `=` intact for legitimate URLs/tokens/base64.
 */
function neutralizeInlineEventHandlers(
  obj: unknown,
  depth: number = MAX_BODY_DEPTH
): unknown {
  if (depth <= 0) return obj;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj.replace(/\bon[a-z]+\s*=/gi, (m) => m.replace('=', '&#61;'));
  }
  if (Array.isArray(obj)) return obj.map((x) => neutralizeInlineEventHandlers(x, depth - 1));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = neutralizeInlineEventHandlers(v, depth - 1);
    return out;
  }
  return obj;
}

/**
 * Log suspicious payloads for security monitoring
 */
function checkForSuspiciousContent(
  body: unknown,
  path: string,
  method: string,
  rootField: string = 'body'
): void {
  if (!body || typeof body !== 'object') return;
  const seen = new WeakSet<object>();
  let visitedNodes = 0;

  const checkValue = (value: unknown, fieldPath: string): void => {
    if (typeof value === 'string' && isSuspicious(value)) {
      logger.warn(
        `[Security] Suspicious input detected: ${method} ${path} field="${fieldPath}" pattern="${value.substring(0, 100)}"`
      );
    } else if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return;
      if (visitedNodes >= MAX_SUSPICIOUS_GRAPH_NODES) return;
      seen.add(value);
      visitedNodes += 1;
      for (const [key, val] of Object.entries(value)) {
        if (visitedNodes >= MAX_SUSPICIOUS_GRAPH_NODES) return;
        checkValue(val, `${fieldPath}.${key}`);
      }
    }
  };

  checkValue(body, rootField);
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
    const normalizedContentType = normalizeContentTypeHeader(req);
    if (normalizedContentType.startsWith('multipart/')) {
      next();
      return Promise.resolve();
    }

    const { sanitizeObject } = await loadSecurityUtils();

    // Sanitize request body
    const requestBody = safeRead(() => req.body, undefined as unknown);
    if (requestBody && typeof requestBody === 'object') {
      if (Buffer.isBuffer(requestBody)) {
        next();
        return Promise.resolve();
      }
      // Log suspicious content before sanitization (for security monitoring)
      if (!isVitest) {
        checkForSuspiciousContent(
          requestBody,
          safeRead(() => req.path, ''),
          safeRead(() => req.method, '')
        );
      }

      // Truncate overly long strings
      req.body = truncateStrings(requestBody);

      // Sanitize HTML entities in all string values
      req.body = sanitizeObject(req.body, MAX_BODY_DEPTH);
      req.body = neutralizeInlineEventHandlers(req.body);
    }

    // Sanitize query parameters (mutate in place - req.query may be read-only for reassignment)
    const requestQuery = safeRead(() => req.query, undefined as unknown);
    if (requestQuery && typeof requestQuery === 'object') {
      const truncatedQuery = truncateStrings(requestQuery);
      if (!isVitest) {
        checkForSuspiciousContent(
          truncatedQuery,
          safeRead(() => req.path, ''),
          safeRead(() => req.method, ''),
          'query'
        );
      }
      const sanitized = sanitizeObject(truncatedQuery, MAX_BODY_DEPTH) as Record<string, unknown>;
      const normalized = neutralizeInlineEventHandlers(sanitized) as Record<string, unknown>;
      try {
        for (const key of Object.keys(requestQuery as Record<string, unknown>)) {
          delete (requestQuery as Record<string, unknown>)[key];
        }
        Object.assign(requestQuery as Record<string, unknown>, normalized);
      } catch {
        // req.query may be frozen/sealed in some setups - skip query sanitization
      }
    }

    const requestParams = safeRead(() => req.params, undefined as unknown);
    if (requestParams && typeof requestParams === 'object') {
      const truncatedParams = truncateStrings(requestParams);
      if (!isVitest) {
        checkForSuspiciousContent(
          truncatedParams,
          safeRead(() => req.path, ''),
          safeRead(() => req.method, ''),
          'params'
        );
      }
      const sanitizedParams = sanitizeObject(truncatedParams, MAX_BODY_DEPTH) as Record<string, unknown>;
      const normalizedParams = neutralizeInlineEventHandlers(sanitizedParams) as Record<string, unknown>;
      try {
        for (const key of Object.keys(requestParams as Record<string, unknown>)) {
          delete (requestParams as Record<string, unknown>)[key];
        }
        Object.assign(requestParams as Record<string, unknown>, normalizedParams);
      } catch {
        // req.params may be frozen/sealed in some setups - skip param sanitization
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
