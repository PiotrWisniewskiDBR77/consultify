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

// ==========================================
// DEPENDENCIES
// ==========================================

const deps: Dependencies = {
  PermissionService,
  GovernanceAuditService,
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Safely read user identity fields from req, returning nulls if the accessor throws.
 */
function safeReadUser(req: AuthRequest): {
  userId: string | null;
  orgId: string | null;
  userRole: string | null;
  threw: boolean;
} {
  try {
    const userId = (req as any).userId || req.user?.id || null;
    const orgId =
      (req as any).organizationId ||
      req.user?.organization_id ||
      (req.user as any)?.organizationId ||
      null;
    const userRole = (req as any).userRole || req.user?.role || null;
    return { userId: userId ?? null, orgId: orgId ?? null, userRole: userRole ?? null, threw: false };
  } catch {
    return { userId: null, orgId: null, userRole: null, threw: true };
  }
}

/**
 * Middleware factory to require a specific permission
 */
export const requirePermission = (permissionKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // If the response is already committed, do nothing
    if (res.headersSent) {
      return;
    }

    try {
      const { userId, orgId, userRole, threw } = safeReadUser(req);

      if (threw || !userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      // Deny on blank permission key
      if (!permissionKey || !permissionKey.trim()) {
        res.status(403).json({
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
        permissionKey,
        normalizedRole
      );

      // Require strict boolean true
      if (hasPermission !== true) {
        logger.warn(`[PermissionMiddleware] Denied: ${permissionKey} for user ${userId}`);
        res.status(403).json({
          error: 'Permission denied',
          required: permissionKey,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Attach permission info for audit logging
      (req as any).permissionChecked = permissionKey;
      next();
    } catch (err) {
      logger.error('[PermissionMiddleware] Error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Permission check failed',
          code: 'PERMISSION_ERROR',
        });
      }
    }
  };
};

/**
 * Middleware factory to require ANY of the specified permissions
 */
export const requireAnyPermission = (permissionKeys: string[]) => {
  // Normalize to array, trim whitespace, filter blanks — at factory time for immutability
  const safeKeys: string[] = Array.isArray(permissionKeys)
    ? permissionKeys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter((k) => k.length > 0)
    : [];

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, orgId, userRole, threw } = safeReadUser(req);

      if (threw || !userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      // Deny immediately when no valid keys
      if (safeKeys.length === 0) {
        res.status(403).json({
          error: 'Permission denied',
          requiredAny: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Normalize role to Role type
      const normalizedRole: Role = (userRole as Role) || ROLES.VIEWER;
      const normalizedOrgId = orgId || '';

      for (const permissionKey of safeKeys) {
        const hasPermission = await deps.PermissionService.hasPermission(
          userId,
          normalizedOrgId,
          permissionKey,
          normalizedRole
        );

        if (hasPermission === true) {
          (req as any).permissionChecked = permissionKey;
          next();
          return;
        }
      }

      logger.warn(
        `[PermissionMiddleware] Denied: none of [${safeKeys.join(', ')}] for user ${userId}`
      );
      res.status(403).json({
        error: 'Permission denied',
        requiredAny: [...safeKeys],
        code: 'PERMISSION_DENIED',
      });
    } catch (err) {
      logger.error('[PermissionMiddleware] Error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Permission check failed',
          code: 'PERMISSION_ERROR',
        });
      }
    }
  };
};

/**
 * Middleware factory to require ALL of the specified permissions
 */
export const requireAllPermissions = (permissionKeys: string[]) => {
  // Normalize to array at factory time
  const safeKeys: string[] = Array.isArray(permissionKeys) ? permissionKeys : [];

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, orgId, userRole, threw } = safeReadUser(req);

      if (threw || !userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      // Deny immediately when no keys provided (empty array = can't satisfy "all")
      if (safeKeys.length === 0) {
        res.status(403).json({
          error: 'Permission denied',
          missing: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      const missingPermissions: string[] = [];

      // Normalize role to Role type
      const normalizedRole: Role = (userRole as Role) || ROLES.VIEWER;
      const normalizedOrgId = orgId || '';

      for (const permissionKey of safeKeys) {
        const hasPermission = await deps.PermissionService.hasPermission(
          userId,
          normalizedOrgId,
          permissionKey,
          normalizedRole
        );

        if (hasPermission !== true) {
          missingPermissions.push(permissionKey);
        }
      }

      if (missingPermissions.length > 0) {
        logger.warn(
          `[PermissionMiddleware] Denied: missing [${missingPermissions.join(', ')}] for user ${userId}`
        );
        res.status(403).json({
          error: 'Permission denied',
          missing: missingPermissions,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      (req as any).permissionChecked = safeKeys;
      next();
    } catch (err) {
      logger.error('[PermissionMiddleware] Error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Permission check failed',
          code: 'PERMISSION_ERROR',
        });
      }
    }
  };
};

// Symbol used to mark a response object as already wrapped by auditAction
const AUDIT_WRAPPED = Symbol('auditWrapped');

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
    // Guard: if res.json accessor throws, skip wrapping but still call next
    let originalJsonMethod: ((data: unknown) => unknown) | null = null;
    try {
      // Idempotency: don't wrap again if already wrapped by this middleware
      if ((res as any)[AUDIT_WRAPPED]) {
        next();
        return;
      }
      originalJsonMethod = res.json.bind(res);
    } catch (bindErr) {
      logger.error('[AuditMiddleware] Could not bind res.json, skipping audit wrap:', bindErr);
      next();
      return;
    }

    // Mark as wrapped before installing the override
    (res as any)[AUDIT_WRAPPED] = true;

    // Override json to intercept response
    (res as any).json = async function (data: unknown) {
      // Only audit on success (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const { userId: actorId, orgId } = safeReadUser(req);
          if (actorId && orgId) {
            // Safely resolve correlation id — req.get may throw
            let correlationId: string | null = null;
            try {
              correlationId = (req as any).correlationId || req.get('X-Correlation-Id') || null;
            } catch {
              correlationId = null;
            }

            // Safely call resource accessors — each may throw
            let resourceId: string | null = null;
            try { resourceId = getResourceId(req as AuthRequest, data) || null; } catch { resourceId = null; }
            let before: unknown = null;
            try { before = getBefore(req as AuthRequest) || null; } catch { before = null; }
            let after: unknown = null;
            try { after = getAfter(req as AuthRequest, data) || null; } catch { after = null; }

            await deps.GovernanceAuditService.logAudit({
              actorId,
              actorRole: (req as any).userRole || req.user?.role,
              orgId,
              action,
              resourceType,
              resourceId,
              before,
              after,
              correlationId,
            });
          }
        } catch (auditErr) {
          logger.error('[AuditMiddleware] Error logging audit:', auditErr);
          // Don't fail the request if audit fails
        }
      }

      // Call original json method and propagate its result (or rejection)
      return originalJsonMethod!(data);
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
