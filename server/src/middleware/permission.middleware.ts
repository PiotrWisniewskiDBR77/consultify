/**
 * Permission Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Database-backed permission checking middleware.
 * Uses PBAC (Permission-Based Access Control) with org-user overrides.
 */

import { NextFunction, Request, Response } from 'express';

import GovernanceAuditService from '../services/governanceAuditService.js';
import PermissionService from '../services/permissionService.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface PermissionService {
  hasPermission: (
    userId: string,
    orgId: string | undefined,
    permissionKey: string,
    userRole?: string
  ) => Promise<boolean>;
}

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};
const hasExplicitPermissionGrant = (value: unknown): boolean => value === true;
const AUDIT_JSON_WRAPPED = Symbol.for('consultify.permissionMiddleware.auditActionWrapped');
const MAX_PERMISSION_KEY_LENGTH = 128;
const MAX_PERMISSION_KEYS_PER_REQUEST = 32;
const MAX_PERMISSION_ROLE_INPUT_LENGTH = 128;
const ROLE_CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const ROLE_INVISIBLE_FORMAT_CHARS =
  /[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069\u2060\u2061\u2062\u2063]/g;

const readOptionalString = (reader: () => unknown): string | undefined => {
  try {
    return normalizeOptionalString(reader());
  } catch {
    return undefined;
  }
};

const readOwnOptionalString = (
  record: unknown,
  key: string
): string | undefined => {
  if (!record || typeof record !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;
  return readOptionalString(() => (record as Record<string, unknown>)[key]);
};

const sanitizeRoleInput = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const bounded = value.length > MAX_PERMISSION_ROLE_INPUT_LENGTH
    ? value.slice(0, MAX_PERMISSION_ROLE_INPUT_LENGTH)
    : value;
  const normalized = safeRead(() => bounded.normalize('NFKC'), bounded);
  const stripped = normalized
    .replace(ROLE_CONTROL_CHARS, '')
    .replace(ROLE_INVISIBLE_FORMAT_CHARS, '');
  return normalizeOptionalString(stripped);
};

const getAuthContext = (
  req: AuthRequest
): { userId?: string; orgId?: string; userRole?: string } => {
  const requestRecord = req as unknown as Record<string, unknown>;
  const requestUser = safeRead(
    () => (requestRecord as Record<string, unknown>).user,
    undefined as unknown
  );
  const userRecord =
    Object.prototype.hasOwnProperty.call(requestRecord, 'user') &&
    requestUser &&
    typeof requestUser === 'object'
      ? (requestUser as Record<string, unknown>)
      : undefined;
  const userId =
    readOwnOptionalString(requestRecord, 'userId') ||
    readOwnOptionalString(userRecord, 'id') ||
    undefined;
  const orgId =
    readOwnOptionalString(requestRecord, 'organizationId') ||
    readOwnOptionalString(userRecord, 'organization_id') ||
    readOwnOptionalString(userRecord, 'organizationId') ||
    undefined;
  const userRole =
    sanitizeRoleInput(readOwnOptionalString(requestRecord, 'userRole')) ||
    sanitizeRoleInput(readOwnOptionalString(userRecord, 'role')) ||
    undefined;
  return { userId, orgId, userRole };
};

const safeGetCorrelationId = (req: Request): string | undefined => {
  const fromRequest = readOptionalString(
    () => (req as Request & { correlationId?: string }).correlationId
  );
  if (fromRequest) return fromRequest;
  try {
    return normalizeOptionalString(req.get?.('X-Correlation-Id'));
  } catch {
    return undefined;
  }
};

const sendJsonIfHeadersOpen = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  if (safeRead(() => res.headersSent, false)) {
    logger.warn('[PermissionMiddleware] Skipped response write: headers already sent', {
      statusCode,
      code: payload.code,
    });
    return false;
  }
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch (error) {
    logger.error('[PermissionMiddleware] Failed response write', {
      statusCode,
      code: payload.code,
      error,
    });
    return false;
  }
};
const isResponseCommitted = (res: Response): boolean =>
  safeRead(
    () =>
      res.headersSent ||
      (res as Response & { writableEnded?: boolean; destroyed?: boolean }).writableEnded === true ||
      (res as Response & { writableEnded?: boolean; destroyed?: boolean }).destroyed === true,
    false
  );
const shouldSkipPermissionCheck = (
  res: Response,
  middlewareName: 'requirePermission' | 'requireAnyPermission' | 'requireAllPermissions'
): boolean => {
  if (!isResponseCommitted(res)) return false;
  logger.warn('[PermissionMiddleware] Skipped permission check: response already committed', {
    middleware: middlewareName,
    code: 'RESPONSE_ALREADY_COMMITTED',
  });
  return true;
};
const asPermissionKeyList = (permissionKeys: unknown): string[] =>
  Array.isArray(permissionKeys) ? permissionKeys : [];
const isPermissionKeyWithinLimit = (key: string): boolean => key.length <= MAX_PERMISSION_KEY_LENGTH;
const dedupePermissionKeys = (permissionKeys: string[]): string[] => {
  if (permissionKeys.length <= 1) return permissionKeys;
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const permissionKey of permissionKeys) {
    if (seen.has(permissionKey)) continue;
    seen.add(permissionKey);
    deduped.push(permissionKey);
  }
  return deduped;
};

const normalizeRoleForDb = (role?: string): string => {
  const sanitizedRole = sanitizeRoleInput(role);
  if (!sanitizedRole) return 'VIEWER';
  const r = sanitizedRole.toString().trim();
  const upper = r.toUpperCase();
  if (!upper) return 'VIEWER';

  // Common aliases from JWT/app layer
  if (upper === 'ADMINISTRATOR' || upper === 'ADMIN') return 'ADMIN';
  if (upper === 'SUPER_ADMIN' || upper === 'SUPERADMIN') return 'SUPERADMIN';
  if (upper === 'OWNER') return 'SUPERADMIN';
  if (upper === 'PROJECT_MANAGER' || upper === 'MANAGER') return 'PROJECT_MANAGER';
  if (upper === 'TEAM_MEMBER' || upper === 'MEMBER') return 'TEAM_MEMBER';
  if (upper === 'GUEST' || upper === 'CLIENT') return 'VIEWER';

  // Legacy app role
  if (upper === 'USER') return 'USER';

  return upper;
};

const getRoleCandidates = (role?: string): string[] => {
  const normalized = normalizeRoleForDb(role);
  // Backward-compatible bridging between legacy 'USER' and newer 'TEAM_MEMBER'
  if (normalized === 'USER') return ['USER', 'TEAM_MEMBER'];
  if (normalized === 'TEAM_MEMBER') return ['TEAM_MEMBER', 'USER'];
  return [normalized];
};

interface GovernanceAuditService {
  logAudit: (data: {
    actorId: string;
    actorRole?: string;
    orgId?: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    before?: unknown;
    after?: unknown;
    correlationId?: string;
  }) => Promise<void>;
}

interface Dependencies {
  PermissionService: PermissionService;
  GovernanceAuditService: GovernanceAuditService;
}

interface AuditOptions {
  action: string;
  resourceType: string;
  getResourceId?: (req: Request, data?: unknown) => string | null;
  getBefore?: (req: Request) => unknown;
  getAfter?: (req: Request, data?: unknown) => unknown;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
  PermissionService: PermissionService as unknown as PermissionService,
  GovernanceAuditService: GovernanceAuditService as unknown as GovernanceAuditService,
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Middleware factory to require a specific permission
 * @param permissionKey - Permission key to check (e.g., 'PLAYBOOK_PUBLISH')
 * @returns Express middleware
 */
export const requirePermission = (permissionKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { PermissionService } = deps;

      const { userId, orgId, userRole } = getAuthContext(req);

      if (!userId) {
        sendJsonIfHeadersOpen(res, 401, {
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      const normalizedPermissionKey = normalizeOptionalString(permissionKey);
      if (!normalizedPermissionKey || !isPermissionKeyWithinLimit(normalizedPermissionKey)) {
        logger.info(`[PermissionMiddleware] Denied: blank permission key for user ${userId}`);
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          code: 'PERMISSION_DENIED',
        });
        return;
      }
      if (shouldSkipPermissionCheck(res, 'requirePermission')) return;

      const roleCandidates = getRoleCandidates(userRole);
      let hasPermission = false;
      for (const candidateRole of roleCandidates) {
        hasPermission = await PermissionService.hasPermission(
          userId,
          orgId,
          normalizedPermissionKey,
          candidateRole
        );
        if (hasExplicitPermissionGrant(hasPermission)) break;
      }

      if (!hasExplicitPermissionGrant(hasPermission)) {
        logger.info(`[PermissionMiddleware] Denied: ${normalizedPermissionKey} for user ${userId}`);
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          required: normalizedPermissionKey,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Attach permission info for audit logging
      (req as AuthRequest & { permissionChecked?: string }).permissionChecked = normalizedPermissionKey;
      next();
    } catch (err: any) {
      logger.error('[PermissionMiddleware] Error:', err);
      sendJsonIfHeadersOpen(res, 500, {
        error: 'Permission check failed',
        code: 'PERMISSION_ERROR',
      });
    }
  };
};

/**
 * Middleware factory to require ANY of the specified permissions
 * @param permissionKeys - Array of permission keys
 * @returns Express middleware
 */
export const requireAnyPermission = (permissionKeys: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { PermissionService } = deps;

      const { userId, orgId, userRole } = getAuthContext(req);

      if (!userId) {
        sendJsonIfHeadersOpen(res, 401, {
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      if (shouldSkipPermissionCheck(res, 'requireAnyPermission')) return;
      const permissionKeyList = asPermissionKeyList(permissionKeys);
      if (permissionKeyList !== permissionKeys) {
        logger.warn('[PermissionMiddleware] Invalid permission key list input for requireAnyPermission', {
          inputType: typeof permissionKeys,
        });
      }
      const normalizedPermissionKeys = dedupePermissionKeys(permissionKeyList
        .map((permissionKey) => normalizeOptionalString(permissionKey))
        .filter((permissionKey): permissionKey is string => Boolean(permissionKey)));
      if (normalizedPermissionKeys.length === 0) {
        logger.info(
          `[PermissionMiddleware] Denied: requireAnyPermission invoked with no valid permission keys for user ${userId}`
        );
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          requiredAny: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }
      if (normalizedPermissionKeys.some((permissionKey) => !isPermissionKeyWithinLimit(permissionKey))) {
        logger.warn('[PermissionMiddleware] Denied: permission key over max length', {
          userId,
          max: MAX_PERMISSION_KEY_LENGTH,
        });
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          requiredAny: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }
      if (normalizedPermissionKeys.length > MAX_PERMISSION_KEYS_PER_REQUEST) {
        logger.warn('[PermissionMiddleware] Denied: permission key list exceeds max count', {
          userId,
          count: normalizedPermissionKeys.length,
          max: MAX_PERMISSION_KEYS_PER_REQUEST,
        });
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          requiredAny: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      const roleCandidates = getRoleCandidates(userRole);
      for (const permissionKey of normalizedPermissionKeys) {
        for (const candidateRole of roleCandidates) {
          const hasPermission = await PermissionService.hasPermission(
            userId,
            orgId,
            permissionKey,
            candidateRole
          );
          if (hasExplicitPermissionGrant(hasPermission)) {
            (req as AuthRequest & { permissionChecked?: string }).permissionChecked = permissionKey;
            next();
            return;
          }
        }
      }

      logger.info(
        `[PermissionMiddleware] Denied: none of [${normalizedPermissionKeys.join(', ')}] for user ${userId}`
      );
      sendJsonIfHeadersOpen(res, 403, {
        error: 'Permission denied',
        requiredAny: [...normalizedPermissionKeys],
        code: 'PERMISSION_DENIED',
      });
    } catch (err: any) {
      logger.error('[PermissionMiddleware] Error:', err);
      sendJsonIfHeadersOpen(res, 500, {
        error: 'Permission check failed',
        code: 'PERMISSION_ERROR',
      });
    }
  };
};

/**
 * Middleware factory to require ALL of the specified permissions
 * @param permissionKeys - Array of permission keys
 * @returns Express middleware
 */
export const requireAllPermissions = (permissionKeys: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { PermissionService } = deps;

      const { userId, orgId, userRole } = getAuthContext(req);

      if (!userId) {
        sendJsonIfHeadersOpen(res, 401, {
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      if (shouldSkipPermissionCheck(res, 'requireAllPermissions')) return;
      const permissionKeyList = asPermissionKeyList(permissionKeys);
      if (permissionKeyList !== permissionKeys) {
        logger.warn('[PermissionMiddleware] Invalid permission key list input for requireAllPermissions', {
          inputType: typeof permissionKeys,
        });
      }
      const normalizedPermissionKeys = dedupePermissionKeys(permissionKeyList
        .map((permissionKey) => normalizeOptionalString(permissionKey))
        .filter((permissionKey): permissionKey is string => Boolean(permissionKey)));
      if (normalizedPermissionKeys.length === 0) {
        logger.info(
          `[PermissionMiddleware] Denied: requireAllPermissions invoked with no valid permission keys for user ${userId}`
        );
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          missing: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }
      if (normalizedPermissionKeys.some((permissionKey) => !isPermissionKeyWithinLimit(permissionKey))) {
        logger.warn('[PermissionMiddleware] Denied: permission key over max length', {
          userId,
          max: MAX_PERMISSION_KEY_LENGTH,
        });
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          missing: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }
      if (normalizedPermissionKeys.length > MAX_PERMISSION_KEYS_PER_REQUEST) {
        logger.warn('[PermissionMiddleware] Denied: permission key list exceeds max count', {
          userId,
          count: normalizedPermissionKeys.length,
          max: MAX_PERMISSION_KEYS_PER_REQUEST,
        });
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          missing: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      const missingPermissions: string[] = [];
      const roleCandidates = getRoleCandidates(userRole);

      for (const permissionKey of normalizedPermissionKeys) {
        let hasPermission = false;
        for (const candidateRole of roleCandidates) {
          hasPermission = await PermissionService.hasPermission(
            userId,
            orgId,
            permissionKey,
            candidateRole
          );
          if (hasExplicitPermissionGrant(hasPermission)) break;
        }
        if (!hasExplicitPermissionGrant(hasPermission)) missingPermissions.push(permissionKey);
      }

      if (missingPermissions.length > 0) {
        logger.info(
          `[PermissionMiddleware] Denied: missing [${missingPermissions.join(', ')}] for user ${userId}`
        );
        sendJsonIfHeadersOpen(res, 403, {
          error: 'Permission denied',
          missing: missingPermissions,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      (req as AuthRequest & { permissionChecked?: string[] }).permissionChecked =
        normalizedPermissionKeys;
      next();
    } catch (err: any) {
      logger.error('[PermissionMiddleware] Error:', err);
      sendJsonIfHeadersOpen(res, 500, {
        error: 'Permission check failed',
        code: 'PERMISSION_ERROR',
      });
    }
  };
};

/**
 * Middleware to audit-log the action after successful completion
 * Use AFTER requirePermission middleware and the route handler
 * @param options - Audit options
 */
export const auditAction = (options: AuditOptions) => {
  const {
    action,
    resourceType,
    getResourceId = () => null,
    getBefore = () => null,
    getAfter = () => null,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { GovernanceAuditService } = deps;
    if (
      safeRead(
        () =>
          Boolean(
            (res as Response & { [AUDIT_JSON_WRAPPED]?: boolean })[AUDIT_JSON_WRAPPED]
          ),
        false
      )
    ) {
      next();
      return;
    }

    // Store original json method
    const originalJson = safeRead(() => res.json.bind(res), null as unknown as ((data: unknown) => unknown));
    if (!originalJson) {
      next();
      return;
    }
    safeRead(() => {
      Object.defineProperty(res, AUDIT_JSON_WRAPPED, {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false,
      });
      return true;
    }, false);
    let auditEmitted = false;

    // Override json to intercept response
    res.json = (async (data: unknown) => {
      const callOriginalJson = async (): Promise<unknown> => {
        try {
          return await Promise.resolve(originalJson(data));
        } catch (error) {
          logger.error('[AuditMiddleware] Response json handler failed', error);
          throw error;
        }
      };
      if (safeRead(() => res.headersSent, false)) {
        return callOriginalJson();
      }
      const statusCode = safeRead(() => res.statusCode, 200);
      // Only audit on success (2xx status codes)
      if (statusCode >= 200 && statusCode < 300 && !auditEmitted) {
        auditEmitted = true;
        try {
          const { userId, orgId, userRole } = getAuthContext(req as AuthRequest);
          const resourceId = safeRead(() => getResourceId(req, data), null);
          const before = safeRead(() => getBefore(req), null);
          const after = safeRead(() => getAfter(req, data), null);
          await GovernanceAuditService.logAudit({
            actorId: userId || '',
            actorRole: userRole,
            orgId,
            action,
            resourceType,
            resourceId,
            before,
            after,
            correlationId: safeGetCorrelationId(req),
          });
        } catch (auditErr) {
          logger.error('[AuditMiddleware] Error logging audit:', auditErr);
          // Don't fail the request if audit fails
        }
      }

      // Call original json method
      return callOriginalJson();
    }) as any;

    next();
  };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};

/**
 * Internal helpers exposed for unit testing.
 * Not part of the public middleware API.
 */
export const __private__ = {
  normalizeRoleForDb,
  getRoleCandidates,
};
