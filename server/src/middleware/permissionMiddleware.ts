/**
 * Permission Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Database-backed permission checking middleware.
 * Uses PBAC (Permission-Based Access Control) with org-user overrides.
 */

import type { NextFunction, Request, Response } from 'express';

import GovernanceAuditService, {
  type AuditAction,
  type ResourceType,
} from '../services/governanceAuditService.js';
import PermissionService, { type Role, ROLES } from '../services/permissionService.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface Dependencies {
  PermissionService: typeof PermissionService;
  GovernanceAuditService: typeof GovernanceAuditService;
}

interface AuditOptions {
  action: AuditAction;
  resourceType: ResourceType;
  getResourceId?: (req: AuthRequest, data?: unknown) => string | null;
  getBefore?: (req: AuthRequest) => unknown;
  getAfter?: (req: AuthRequest, data?: unknown) => unknown;
}

const AUDIT_JSON_WRAPPED = Symbol.for('consultify.permissionMiddleware.auditActionWrapped');

// ==========================================
// DEPENDENCIES
// ==========================================

const deps: Dependencies = {
  PermissionService,
  GovernanceAuditService,
};

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
const isResponseCommitted = (res: Response): boolean =>
  safeRead(
    () =>
      Boolean(
        res.headersSent ||
          (res as Response & { writableEnded?: boolean; finished?: boolean }).writableEnded ||
          (res as Response & { writableEnded?: boolean; finished?: boolean }).finished
      ),
    false
  );
const sendJsonIfWritable = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  if (isResponseCommitted(res)) {
    logger.warn('[PermissionMiddleware] Skipped write: response already committed');
    return false;
  }
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch (err) {
    logger.warn('[PermissionMiddleware] Failed to write JSON response', err);
    return false;
  }
};
const asPermissionKeyList = (permissionKeys: string[]): string[] =>
  Array.isArray(permissionKeys) ? permissionKeys : [];

const hasExplicitPermissionGrant = (value: unknown): boolean => value === true;

const getAuthContext = (
  req: AuthRequest
): {
  userId?: string;
  orgId?: string;
  userRole?: string;
} => {
  const userId =
    normalizeOptionalString(safeRead(() => req.userId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req.user?.id, undefined as unknown));
  const orgId =
    normalizeOptionalString(safeRead(() => req.organizationId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req.user?.organization_id, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined as unknown));
  const userRole =
    normalizeOptionalString(safeRead(() => req.userRole, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req.user?.role, undefined as unknown));
  return { userId, orgId, userRole };
};

const getCorrelationId = (req: AuthRequest): string | null => {
  const requestCorrelationId = normalizeOptionalString(
    safeRead(() => (req as any).correlationId, undefined as unknown)
  );
  if (requestCorrelationId) return requestCorrelationId;
  const headerCorrelationId = normalizeOptionalString(
    safeRead(() => req.get?.('X-Correlation-Id'), undefined as unknown)
  );
  return headerCorrelationId || null;
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Middleware factory to require a specific permission
 */
export const requirePermission = (permissionKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (isResponseCommitted(res)) {
      logger.warn('[PermissionMiddleware] Skipped check: response already committed');
      return;
    }
    try {
      const { userId, orgId, userRole } = getAuthContext(req);

      if (!userId) {
        sendJsonIfWritable(res, 401, {
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      const normalizedPermissionKey = normalizeOptionalString(permissionKey);
      if (!normalizedPermissionKey) {
        logger.warn(
          `[PermissionMiddleware] Denied: blank permission key for user ${userId}`
        );
        sendJsonIfWritable(res, 403, {
          error: 'Permission denied',
          required: permissionKey,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Normalize role to Role type
      const normalizedRole: Role = (userRole as Role) || ROLES.VIEWER;

      const hasPermission = await deps.PermissionService.hasPermission(
        userId,
        orgId || '',
        normalizedPermissionKey,
        normalizedRole
      );

      if (!hasExplicitPermissionGrant(hasPermission)) {
        logger.warn(`[PermissionMiddleware] Denied: ${normalizedPermissionKey} for user ${userId}`);
        sendJsonIfWritable(res, 403, {
          error: 'Permission denied',
          required: normalizedPermissionKey,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Attach permission info for audit logging
      (req as any).permissionChecked = normalizedPermissionKey;
      next();
    } catch (err) {
      logger.error('[PermissionMiddleware] Error:', err);
      sendJsonIfWritable(res, 500, {
        error: 'Permission check failed',
        code: 'PERMISSION_ERROR',
      });
    }
  };
};

/**
 * Middleware factory to require ANY of the specified permissions
 */
export const requireAnyPermission = (permissionKeys: string[]) => {
  const keyList = asPermissionKeyList(permissionKeys);
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (isResponseCommitted(res)) {
      logger.warn('[PermissionMiddleware] Skipped check: response already committed');
      return;
    }
    try {
      const { userId, orgId, userRole } = getAuthContext(req);

      if (!userId) {
        sendJsonIfWritable(res, 401, {
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      const normalizedPermissionKeys = keyList
        .map((permissionKey) => normalizeOptionalString(permissionKey))
        .filter((permissionKey): permissionKey is string => Boolean(permissionKey));
      if (normalizedPermissionKeys.length === 0) {
        logger.warn(
          `[PermissionMiddleware] Denied: requireAnyPermission invoked with empty or invalid key list for user ${userId}`
        );
        sendJsonIfWritable(res, 403, {
          error: 'Permission denied',
          requiredAny: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Normalize role to Role type
      const normalizedRole: Role = (userRole as Role) || ROLES.VIEWER;
      const normalizedOrgId = orgId || '';

      for (const permissionKey of normalizedPermissionKeys) {
        const hasPermission = await deps.PermissionService.hasPermission(
          userId,
          normalizedOrgId,
          permissionKey,
          normalizedRole
        );

        if (hasExplicitPermissionGrant(hasPermission)) {
          (req as any).permissionChecked = permissionKey;
          next();
          return;
        }
      }

      logger.warn(
        `[PermissionMiddleware] Denied: none of [${normalizedPermissionKeys.join(', ')}] for user ${userId}`
      );
      sendJsonIfWritable(res, 403, {
        error: 'Permission denied',
        requiredAny: [...normalizedPermissionKeys],
        code: 'PERMISSION_DENIED',
      });
    } catch (err) {
      logger.error('[PermissionMiddleware] Error:', err);
      sendJsonIfWritable(res, 500, {
        error: 'Permission check failed',
        code: 'PERMISSION_ERROR',
      });
    }
  };
};

/**
 * Middleware factory to require ALL of the specified permissions
 */
export const requireAllPermissions = (permissionKeys: string[]) => {
  const keyList = asPermissionKeyList(permissionKeys);
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (isResponseCommitted(res)) {
      logger.warn('[PermissionMiddleware] Skipped check: response already committed');
      return;
    }
    try {
      const { userId, orgId, userRole } = getAuthContext(req);

      if (!userId) {
        sendJsonIfWritable(res, 401, {
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const missingPermissions: string[] = [];
      const normalizedPermissionKeys = keyList
        .map((permissionKey) => normalizeOptionalString(permissionKey))
        .filter((permissionKey): permissionKey is string => Boolean(permissionKey));
      if (normalizedPermissionKeys.length === 0) {
        logger.warn(
          `[PermissionMiddleware] Denied: requireAllPermissions invoked with empty or invalid key list for user ${userId}`
        );
        sendJsonIfWritable(res, 403, {
          error: 'Permission denied',
          missing: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Normalize role to Role type
      const normalizedRole: Role = (userRole as Role) || ROLES.VIEWER;
      const normalizedOrgId = orgId || '';

      for (const permissionKey of normalizedPermissionKeys) {
        const hasPermission = await deps.PermissionService.hasPermission(
          userId,
          normalizedOrgId,
          permissionKey,
          normalizedRole
        );

        if (!hasExplicitPermissionGrant(hasPermission)) {
          missingPermissions.push(permissionKey);
        }
      }

      if (missingPermissions.length > 0) {
        logger.warn(
          `[PermissionMiddleware] Denied: missing [${missingPermissions.join(', ')}] for user ${userId}`
        );
        sendJsonIfWritable(res, 403, {
          error: 'Permission denied',
          missing: missingPermissions,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      (req as any).permissionChecked = normalizedPermissionKeys;
      next();
    } catch (err) {
      logger.error('[PermissionMiddleware] Error:', err);
      sendJsonIfWritable(res, 500, {
        error: 'Permission check failed',
        code: 'PERMISSION_ERROR',
      });
    }
  };
};

/**
 * Middleware to audit-log the action after successful completion
 * Use AFTER requirePermission middleware and the route handler
 */
export const auditAction = (options: AuditOptions) => {
  const {
    action,
    resourceType,
    getResourceId = () => null,
    getBefore = () => null,
    getAfter = () => null,
  } = options;

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (
      safeRead(
        () => Boolean((res as Response & { [AUDIT_JSON_WRAPPED]?: boolean })[AUDIT_JSON_WRAPPED]),
        false
      )
    ) {
      next();
      return;
    }

    // Override json to intercept response
    const originalJsonMethod = safeRead(
      () => res.json.bind(res),
      null as unknown as ((data: unknown) => unknown)
    );
    if (!originalJsonMethod) {
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
    (res as any).json = async function (data: unknown) {
      // Only audit on success (2xx status codes)
      const statusCode = safeRead(() => res.statusCode, 200);
      if (statusCode >= 200 && statusCode < 300) {
        try {
          const { userId: actorId, orgId, userRole } = getAuthContext(req);
          if (actorId && orgId) {
            await deps.GovernanceAuditService.logAudit({
              actorId,
              actorRole: userRole,
              orgId,
              action,
              resourceType,
              resourceId: safeRead(() => getResourceId(req, data) || null, null),
              before: safeRead(() => getBefore(req) || null, null),
              after: safeRead(() => getAfter(req, data) || null, null),
              correlationId: getCorrelationId(req),
            });
          }
        } catch (auditErr) {
          logger.error('[AuditMiddleware] Error logging audit:', auditErr);
          // Don't fail the request if audit fails
        }
      }

      // Call original json method
      return originalJsonMethod(data);
    };

    next();
  };
};

/**
 * Inject dependencies for testing
 */
export function setDependencies(newDeps: Partial<Dependencies>): void {
  Object.assign(deps, newDeps);
}
