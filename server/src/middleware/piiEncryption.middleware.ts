/**
 * PII Encryption Middleware
 * Enterprise SaaS Architecture - Data Protection
 *
 * Automatically encrypts/decrypts PII fields in API requests/responses.
 *
 * Usage:
 * - Encryption: Request body PII fields are encrypted before reaching handlers
 * - Decryption: Response PII fields are decrypted before sending to client
 *
 * Note: This middleware is opt-in and should be applied to routes handling PII.
 */

import { NextFunction, Request, Response } from 'express';

import * as encryptionService from '../services/encryption/EncryptionService.js';
import logger from '../utils/Logger.js';

// ==========================================
// CONFIGURATION
// ==========================================

/**
 * Routes that should have PII encryption applied
 */
const PII_ENCRYPTION_ROUTES = [
  '/api/users',
  '/api/auth/register',
  '/api/organization-data',
  '/api/gdpr',
  '/api/settings/profile',
];

/**
 * Routes that should skip PII processing
 */
const SKIP_ROUTES = ['/api/health', '/api/ping', '/api/csrf-token'];
const RESPONSE_WRAPPED = Symbol('pii.response.wrapped');

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const safeNext = (next: NextFunction, context: string): void => {
  if (typeof next === 'function') {
    next();
    return;
  }
  logger.error('[PIIEncryption] next is not a function; skipping continuation', { context });
};

const normalizeRoutePath = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const withoutQuery = value.split('?')[0].split('#')[0].trim();
  if (!withoutQuery) return '';
  const normalized = withoutQuery.replace(/\/+/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const readRequestPath = (req: Request): string =>
  normalizeRoutePath(
    safeRead(
      () => req.path,
      safeRead(() => (req as unknown as { originalUrl?: string }).originalUrl || '', '')
    )
  );

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const matchesRouteBoundary = (path: string, route: string): boolean =>
  path === route || path.startsWith(`${route}/`);

const routeApplies = (path: string, routes: string[]): boolean => {
  const normalizedPath = normalizeRoutePath(path);
  return routes.some((route) => matchesRouteBoundary(normalizedPath, normalizeRoutePath(route)));
};

const normalizeRouteList = (routes: string[]): string[] =>
  routes.map((route) => normalizeRoutePath(route)).filter(Boolean);

export function getPiiRouteConfigIssues(
  piiRoutes: string[] = PII_ENCRYPTION_ROUTES,
  skipRoutes: string[] = SKIP_ROUTES
): string[] {
  const issues: string[] = [];
  const pushRouteIssues = (routes: string[], label: string) => {
    routes.forEach((route) => {
      if (typeof route !== 'string') {
        issues.push(`${label}: route must be a string`);
        return;
      }
      if (!route.trim()) {
        issues.push(`${label}: empty route entry`);
        return;
      }
      if (route !== route.trim()) {
        issues.push(`${label}: route has leading/trailing whitespace`);
      }
      if (!route.trim().startsWith('/')) {
        issues.push(`${label}: route must start with "/": ${route.trim()}`);
      }
    });
  };
  pushRouteIssues(piiRoutes, 'PII_ENCRYPTION_ROUTES');
  pushRouteIssues(skipRoutes, 'SKIP_ROUTES');

  const normalizedPii = normalizeRouteList(piiRoutes);
  const normalizedSkip = normalizeRouteList(skipRoutes);
  normalizedPii.forEach((piiRoute) => {
    normalizedSkip.forEach((skipRoute) => {
      if (matchesRouteBoundary(piiRoute, skipRoute) || matchesRouteBoundary(skipRoute, piiRoute)) {
        issues.push(`PII vs SKIP overlap: "${piiRoute}" <-> "${skipRoute}"`);
      }
    });
  });
  return Array.from(new Set(issues));
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Encrypt PII fields in request body
 * Applied before route handlers
 */
export function encryptRequestPII(req: Request, _res: Response, next: NextFunction): void {
  const path = readRequestPath(req);
  const method = safeRead(() => String(req.method || '').toUpperCase(), '');
  try {
    // Skip for non-applicable routes
    if (routeApplies(path, SKIP_ROUTES)) {
      safeNext(next, 'encryptRequestPII:skip');
      return;
    }

    // Only encrypt for write operations
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      safeNext(next, 'encryptRequestPII:readOnly');
      return;
    }

    // Encrypt PII in request body
    const body = safeRead(() => req.body, undefined as unknown);
    if (Array.isArray(body)) {
      const nextBody = body.map((item) =>
        isPlainObject(item) ? encryptionService.encryptPII(item as Record<string, unknown>) : item
      );
      safeRead(() => ((req.body = nextBody), true), false);
    } else if (isPlainObject(body)) {
      req.body = encryptionService.encryptPII(body);
    }

    safeNext(next, 'encryptRequestPII');
  } catch (error) {
    logger.error('[PIIEncryption] Request encryption error:', {
      path,
      method,
      error,
    });
    safeNext(next, 'encryptRequestPII:error'); // Continue without encryption on error
  }
}

/**
 * Decrypt PII fields in response
 * Uses response interceptor pattern
 */
export function decryptResponsePII(req: Request, res: Response, next: NextFunction): void {
  const path = readRequestPath(req);
  const method = safeRead(() => String(req.method || '').toUpperCase(), '');
  // Skip for non-applicable routes
  if (routeApplies(path, SKIP_ROUTES)) {
    safeNext(next, 'decryptResponsePII:skip');
    return;
  }

  if ((res as unknown as Record<symbol, unknown>)[RESPONSE_WRAPPED]) {
    safeNext(next, 'decryptResponsePII:alreadyWrapped');
    return;
  }

  const jsonFn = safeRead(() => res.json, undefined as unknown);
  if (typeof jsonFn !== 'function') {
    logger.warn('[PIIEncryption] res.json is not a function; skipping response wrap', {
      path,
      type: typeof jsonFn,
    });
    safeNext(next, 'decryptResponsePII:noJsonFunction');
    return;
  }

  let originalJson: ((body: unknown) => Response) | null = null;
  try {
    originalJson = jsonFn.bind(res);
  } catch {
    safeNext(next, 'decryptResponsePII:bindFailed');
    return;
  }

  // Override json to decrypt PII before sending
  try {
    (res as unknown as Record<symbol, unknown>)[RESPONSE_WRAPPED] = true;
    res.json = function (body: unknown): Response {
      try {
        if (Array.isArray(body)) {
          body = body.map((item) =>
            isPlainObject(item) ? encryptionService.decryptPII(item) : item
          );
        } else if (isPlainObject(body)) {
          body = encryptionService.decryptPII(body);
        }
      } catch (error) {
        logger.error('[PIIEncryption] Response decryption error:', error);
        // Send original body on error
      }

      try {
        return originalJson!(body);
      } catch (error) {
        logger.error('[PIIEncryption] res.json delegate error', {
          path,
          method,
          error,
        });
        throw error;
      }
    };
  } catch {
    safeNext(next, 'decryptResponsePII:setterFailed');
    return;
  }

  safeNext(next, 'decryptResponsePII');
}

/**
 * Combined PII encryption middleware
 * Handles both request encryption and response decryption
 */
export function piiEncryptionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if route should have PII encryption
  const shouldApply = routeApplies(readRequestPath(req), PII_ENCRYPTION_ROUTES);

  if (!shouldApply) {
    safeNext(next, 'piiEncryptionMiddleware:notApplicable');
    return;
  }

  // Apply response decryption interceptor
  decryptResponsePII(req, res, () => {
    // Apply request encryption
    encryptRequestPII(req, res, next);
  });
}

/**
 * Middleware for routes that explicitly need PII protection
 * Use: app.post('/api/sensitive', piiProtection, handler)
 */
export function piiProtection(req: Request, res: Response, next: NextFunction): void {
  decryptResponsePII(req, res, () => {
    encryptRequestPII(req, res, next);
  });
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if an object contains encrypted PII
 */
export function hasEncryptedPII(obj: Record<string, unknown>): boolean {
  if (!obj || typeof obj !== 'object') return false;

  for (const field of encryptionService.PII_FIELDS) {
    if (
      field in obj &&
      typeof obj[field] === 'string' &&
      encryptionService.isEncrypted(obj[field] as string)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get list of encrypted fields in an object
 */
export function getEncryptedFields(obj: Record<string, unknown>): string[] {
  if (!obj || typeof obj !== 'object') return [];

  const encryptedFields: string[] = [];

  for (const field of encryptionService.PII_FIELDS) {
    if (
      field in obj &&
      typeof obj[field] === 'string' &&
      encryptionService.isEncrypted(obj[field] as string)
    ) {
      encryptedFields.push(field);
    }
  }

  return encryptedFields;
}

// ==========================================
// EXPORTS
// ==========================================

export default {
  encryptRequestPII,
  decryptResponsePII,
  piiEncryptionMiddleware,
  piiProtection,
  hasEncryptedPII,
  getEncryptedFields,
  PII_ENCRYPTION_ROUTES,
};
