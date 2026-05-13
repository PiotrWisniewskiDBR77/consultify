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

import {
  decryptPII,
  encryptPII,
  isEncrypted,
  PII_FIELDS,
} from '../services/encryption/EncryptionService.js';
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

const readPath = (req: Request): string =>
  (() => {
    const normalizePathSlashes = (value: string): string => {
      const collapsed = value.replace(/\/{2,}/g, '/');
      return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
    };
    const raw =
      normalizeOptionalString(safeRead(() => req.path, undefined)) ||
      normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
      '';
    const noQuery = raw.split('?')[0] ?? raw;
    const noHash = noQuery.split('#')[0] ?? noQuery;
    return normalizePathSlashes(noHash);
  })();

const readMethod = (req: Request): string =>
  (normalizeOptionalString(safeRead(() => req.method, undefined)) || '').toUpperCase();

const matchesConfiguredRoute = (path: string, route: string): boolean =>
  path === route || path.startsWith(`${route}/`);
const isPlainObjectRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const responseJsonWrapped = new WeakSet<Response>();
const _piiRouteConfigIssuesLogged = { done: false };
const safeCallNext = (next: NextFunction, context: string): void => {
  if (typeof next !== 'function') {
    logger.error('[PIIEncryption] next is not a function; skipping continuation', { context });
    return;
  }
  next();
};

export function getPiiRouteConfigIssues(
  piiRoutes: readonly string[] = PII_ENCRYPTION_ROUTES,
  skipRoutes: readonly string[] = SKIP_ROUTES
): string[] {
  const issues: string[] = [];
  const normalizedPiiRoutes: string[] = [];
  const normalizedSkipRoutes: string[] = [];
  const checkRoutes = (label: string, routes: readonly string[]) => {
    for (const route of routes) {
      if (typeof route !== 'string') {
        issues.push(`${label}: non-string route entry`);
        continue;
      }
      if (!route.trim()) {
        issues.push(`${label}: empty route entry`);
        continue;
      }
      if (route !== route.trim()) {
        issues.push(`${label}: route has leading/trailing whitespace`);
      }
      if (!route.startsWith('/')) {
        issues.push(`${label}: route must start with "/": ${route}`);
      }
      if (label === 'PII_ENCRYPTION_ROUTES') normalizedPiiRoutes.push(route.trim());
      if (label === 'SKIP_ROUTES') normalizedSkipRoutes.push(route.trim());
    }
  };
  checkRoutes('PII_ENCRYPTION_ROUTES', piiRoutes);
  checkRoutes('SKIP_ROUTES', skipRoutes);
  for (const piiRoute of normalizedPiiRoutes) {
    for (const skipRoute of normalizedSkipRoutes) {
      if (
        matchesConfiguredRoute(piiRoute, skipRoute) ||
        matchesConfiguredRoute(skipRoute, piiRoute)
      ) {
        issues.push(`PII vs SKIP overlap: "${piiRoute}" <-> "${skipRoute}"`);
      }
    }
  }
  return issues;
}

const logPiiRouteManifestIssuesOnce = (): void => {
  if (_piiRouteConfigIssuesLogged.done) return;
  _piiRouteConfigIssuesLogged.done = true;
  const issues = getPiiRouteConfigIssues();
  if (issues.length === 0) return;
  for (const issue of issues) {
    logger.error('[PIIEncryption] Route manifest issue:', issue);
  }
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Encrypt PII fields in request body
 * Applied before route handlers
 */
export function encryptRequestPII(req: Request, _res: Response, next: NextFunction): void {
  try {
    logPiiRouteManifestIssuesOnce();
    const requestPath = readPath(req);
    // Skip for non-applicable routes
    if (SKIP_ROUTES.some((route) => matchesConfiguredRoute(requestPath, route))) {
      safeCallNext(next, 'encryptRequestPII:skipRoute');
      return;
    }

    // Only encrypt for write operations
    if (!['POST', 'PUT', 'PATCH'].includes(readMethod(req))) {
      safeCallNext(next, 'encryptRequestPII:readOnlyMethod');
      return;
    }

    // Encrypt PII in request body
    const body = safeRead(() => req.body, undefined as unknown);
    if (isPlainObjectRecord(body)) {
      req.body = encryptPII(body);
    } else if (Array.isArray(body)) {
      req.body = body.map((item) =>
        isPlainObjectRecord(item) ? encryptPII(item as Record<string, unknown>) : item
      );
    }

    safeCallNext(next, 'encryptRequestPII:success');
  } catch (error) {
    logger.error('[PIIEncryption] Request encryption error:', error);
    safeCallNext(next, 'encryptRequestPII:error'); // Continue without encryption on error
  }
}

/**
 * Decrypt PII fields in response
 * Uses response interceptor pattern
 */
export function decryptResponsePII(req: Request, res: Response, next: NextFunction): void {
  try {
    logPiiRouteManifestIssuesOnce();
  } catch (error) {
    logger.error('[PIIEncryption] Route manifest logging failed:', error);
  }
  const requestPath = readPath(req);
  // Skip for non-applicable routes
  if (SKIP_ROUTES.some((route) => matchesConfiguredRoute(requestPath, route))) {
    safeCallNext(next, 'decryptResponsePII:skipRoute');
    return;
  }

  // Already wrapped on this response object
  if (responseJsonWrapped.has(res)) {
    safeCallNext(next, 'decryptResponsePII:alreadyWrapped');
    return;
  }

  // Store original json function
  const jsonCandidate = safeRead(() => res.json as unknown, undefined as unknown);
  if (typeof jsonCandidate !== 'function') {
    logger.warn('[PIIEncryption] res.json is not a function; skipping response wrap', {
      path: requestPath,
      type: typeof jsonCandidate,
    });
    safeCallNext(next, 'decryptResponsePII:jsonNotFunction');
    return;
  }
  const originalJson = safeRead(
    () => (jsonCandidate as Response['json']).bind(res),
    null as unknown as Response['json']
  );
  if (!originalJson) {
    safeCallNext(next, 'decryptResponsePII:bindFailed');
    return;
  }

  // Override json to decrypt PII before sending
  try {
    res.json = function (body: unknown): Response {
      try {
        if (body && typeof body === 'object') {
          if (Array.isArray(body)) {
            body = body.map((item) =>
              isPlainObjectRecord(item)
                ? decryptPII(item as Record<string, unknown>)
                : item
            );
          } else if (isPlainObjectRecord(body)) {
            body = decryptPII(body as Record<string, unknown>);
          }
        }
      } catch (error) {
        logger.error('[PIIEncryption] Response decryption error:', error);
        // Send original body on error
      }
      try {
        return Reflect.apply(originalJson, res, [body]);
      } catch (error) {
        logger.error('[PIIEncryption] res.json delegate error', {
          path: requestPath,
          method: readMethod(req),
          error,
        });
        throw error;
      }
    };
    responseJsonWrapped.add(res);
  } catch (error) {
    logger.error('[PIIEncryption] Unable to wrap res.json:', error);
  }

  safeCallNext(next, 'decryptResponsePII:success');
}

/**
 * Combined PII encryption middleware
 * Handles both request encryption and response decryption
 */
export function piiEncryptionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if route should have PII encryption
  const requestPath = readPath(req);
  const shouldApply = PII_ENCRYPTION_ROUTES.some((route) =>
    matchesConfiguredRoute(requestPath, route)
  );

  if (!shouldApply) {
    safeCallNext(next, 'piiEncryptionMiddleware:notApplicable');
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

  for (const field of PII_FIELDS) {
    if (field in obj && typeof obj[field] === 'string' && isEncrypted(obj[field] as string)) {
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

  for (const field of PII_FIELDS) {
    if (field in obj && typeof obj[field] === 'string' && isEncrypted(obj[field] as string)) {
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
