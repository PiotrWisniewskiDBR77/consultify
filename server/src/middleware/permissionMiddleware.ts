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
 * Middleware factory to require a specific permission
 */
export const requirePermission = (permissionKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId || req.user?.id;
      const orgId = req.organizationId || req.user?.organization_id || req.user?.organizationId;
      const userRole = req.userRole || req.user?.role;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
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

      if (!hasPermission) {
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
      res.status(500).json({
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
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId || req.user?.id;
      const orgId = req.organizationId || req.user?.organization_id || req.user?.organizationId;
      const userRole = req.userRole || req.user?.role;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      // Normalize role to Role type
      const normalizedRole: Role = (userRole as Role) || ROLES.VIEWER;
      const normalizedOrgId = orgId || '';
      
      for (const permissionKey of permissionKeys) {
        const hasPermission = await deps.PermissionService.hasPermission(
          userId,
          normalizedOrgId,
          permissionKey,
          normalizedRole
        );

        if (hasPermission) {
          (req as any).permissionChecked = permissionKey;
          next();
          return;
        }
      }

      logger.warn(
        `[PermissionMiddleware] Denied: none of [${permissionKeys.join(', ')}] for user ${userId}`
      );
      res.status(403).json({
        error: 'Permission denied',
        requiredAny: permissionKeys,
        code: 'PERMISSION_DENIED',
      });
    } catch (err) {
      logger.error('[PermissionMiddleware] Error:', err);
      res.status(500).json({
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
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId || req.user?.id;
      const orgId = req.organizationId || req.user?.organization_id || req.user?.organizationId;
      const userRole = req.userRole || req.user?.role;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const missingPermissions: string[] = [];

      // Normalize role to Role type
      const normalizedRole: Role = (userRole as Role) || ROLES.VIEWER;
      const normalizedOrgId = orgId || '';
      
      for (const permissionKey of permissionKeys) {
        const hasPermission = await deps.PermissionService.hasPermission(
          userId,
          normalizedOrgId,
          permissionKey,
          normalizedRole
        );

        if (!hasPermission) {
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

      (req as any).permissionChecked = permissionKeys;
      next();
    } catch (err) {
      logger.error('[PermissionMiddleware] Error:', err);
      res.status(500).json({
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
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to intercept response
    const originalJsonMethod = res.json.bind(res);
    (res as any).json = async function (data: unknown) {
      // Only audit on success (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const actorId = req.userId || req.user?.id;
          const orgId = req.organizationId || req.user?.organization_id || req.user?.organizationId;
          if (actorId && orgId) {
            await deps.GovernanceAuditService.logAudit({
              actorId,
              actorRole: req.userRole || req.user?.role,
              orgId,
              action,
              resourceType,
              resourceId: getResourceId(req, data) || null,
              before: getBefore(req) || null,
              after: getAfter(req, data) || null,
              correlationId: (req as any).correlationId || req.get('X-Correlation-Id') || null,
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
