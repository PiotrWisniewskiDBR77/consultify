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

const normalizeRoleForDb = (role?: string): string => {
  if (!role) return 'VIEWER';
  const r = role.toString().trim();
  const upper = r.toUpperCase();

  // Common aliases from JWT/app layer
  if (upper === 'ADMINISTRATOR' || upper === 'ADMIN') return 'ADMIN';
  if (upper === 'OWNER' || upper === 'SUPER_ADMIN' || upper === 'SUPERADMIN') return 'SUPERADMIN';
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

      const userId = req.userId || req.user?.id;
      const orgId = req.organizationId || req.user?.organizationId;
      const userRole = req.userRole || req.user?.role;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const roleCandidates = getRoleCandidates(userRole);
      let hasPermission = false;
      for (const candidateRole of roleCandidates) {
        hasPermission = await PermissionService.hasPermission(
          userId,
          orgId,
          permissionKey,
          candidateRole
        );
        if (hasPermission) break;
      }

      if (!hasPermission) {
        logger.info(`[PermissionMiddleware] Denied: ${permissionKey} for user ${userId}`);
        res.status(403).json({
          error: 'Permission denied',
          required: permissionKey,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Attach permission info for audit logging
      (req as AuthRequest & { permissionChecked?: string }).permissionChecked = permissionKey;
      next();
    } catch (err: any) {
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
 * @param permissionKeys - Array of permission keys
 * @returns Express middleware
 */
export const requireAnyPermission = (permissionKeys: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { PermissionService } = deps;

      const userId = req.userId || req.user?.id;
      const orgId = req.organizationId || req.user?.organizationId;
      const userRole = req.userRole || req.user?.role;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const roleCandidates = getRoleCandidates(userRole);
      for (const permissionKey of permissionKeys) {
        for (const candidateRole of roleCandidates) {
          const hasPermission = await PermissionService.hasPermission(
            userId,
            orgId,
            permissionKey,
            candidateRole
          );
          if (hasPermission) {
            (req as AuthRequest & { permissionChecked?: string }).permissionChecked = permissionKey;
            next();
            return;
          }
        }
      }

      logger.info(
        `[PermissionMiddleware] Denied: none of [${permissionKeys.join(', ')}] for user ${userId}`
      );
      res.status(403).json({
        error: 'Permission denied',
        requiredAny: permissionKeys,
        code: 'PERMISSION_DENIED',
      });
    } catch (err: any) {
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
 * @param permissionKeys - Array of permission keys
 * @returns Express middleware
 */
export const requireAllPermissions = (permissionKeys: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { PermissionService } = deps;

      const userId = req.userId || req.user?.id;
      const orgId = req.organizationId || req.user?.organizationId;
      const userRole = req.userRole || req.user?.role;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const missingPermissions: string[] = [];
      const roleCandidates = getRoleCandidates(userRole);

      for (const permissionKey of permissionKeys) {
        let hasPermission = false;
        for (const candidateRole of roleCandidates) {
          hasPermission = await PermissionService.hasPermission(
            userId,
            orgId,
            permissionKey,
            candidateRole
          );
          if (hasPermission) break;
        }
        if (!hasPermission) missingPermissions.push(permissionKey);
      }

      if (missingPermissions.length > 0) {
        logger.info(
          `[PermissionMiddleware] Denied: missing [${missingPermissions.join(', ')}] for user ${userId}`
        );
        res.status(403).json({
          error: 'Permission denied',
          missing: missingPermissions,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      (req as AuthRequest & { permissionChecked?: string[] }).permissionChecked = permissionKeys;
      next();
    } catch (err: any) {
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

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to intercept response
    res.json = (async (data: unknown) => {
      // Only audit on success (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await GovernanceAuditService.logAudit({
            actorId: (req as AuthRequest).userId || (req as AuthRequest).user?.id || '',
            actorRole: (req as AuthRequest).userRole || (req as AuthRequest).user?.role,
            orgId: (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId,
            action,
            resourceType,
            resourceId: getResourceId(req, data),
            before: getBefore(req),
            after: getAfter(req, data),
            correlationId:
              (req as Request & { correlationId?: string }).correlationId ||
              req.get('X-Correlation-Id') ||
              undefined,
          });
        } catch (auditErr) {
          logger.error('[AuditMiddleware] Error logging audit:', auditErr);
          // Don't fail the request if audit fails
        }
      }

      // Call original json method
      return originalJson(data);
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
