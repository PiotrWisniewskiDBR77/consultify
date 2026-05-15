/**
 * Permission Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Database-backed permission checking middleware.
 * Uses PBAC (Permission-Based Access Control) with org-user overrides.
 */

import { NextFunction, Request, Response } from 'express';

import {
  hasEffectiveCapability,
  mapLegacyPermissionToCapability,
  resolveEffectiveAccess,
} from '../services/effectiveAccessService.js';
import GovernanceAuditService from '../services/governanceAuditService.js';
import PermissionService from '../services/permissionService.js';
import logger from '../utils/Logger.js';
import { getPermissionRoleCandidates } from '../utils/roleNormalization.js';
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

const getRoleCandidates = (role?: string): string[] => {
  return getPermissionRoleCandidates(role);
};

const normalizeRoleForDb = (role?: string): string => {
  return getRoleCandidates(role)[0] || 'USER';
};

const MAX_PERMISSION_KEYS_PER_REQUEST = 32;

async function shadowCompareEffectiveAccess(
  req: AuthRequest,
  permissionKey: string,
  oldAllowed: boolean
) {
  if (process.env.EFFECTIVE_ACCESS_SHADOW !== 'true') return;
  const userId = req.userId || req.user?.id;
  const organizationId = req.organizationId || req.user?.organizationId;
  const projectId = String(
    req.params?.projectId || req.params?.id || req.query?.projectId || ''
  ).trim();
  if (!userId || !organizationId) return;

  try {
    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole: req.userRole || req.user?.role,
      projectId: projectId || null,
      isImpersonating: Boolean(req.user?.impersonatorId),
    });
    const capability = mapLegacyPermissionToCapability(permissionKey);
    const newAllowed = hasEffectiveCapability(access, capability);
    if (newAllowed !== oldAllowed) {
      logger.warn('[PermissionMiddleware] Effective access shadow mismatch', {
        userId,
        organizationId,
        projectId: projectId || null,
        permissionKey,
        capability,
        oldAllowed,
        newAllowed,
        applicationRole: access.applicationRole,
        projectRole: access.projectRole,
        warnings: access.warnings,
      });
    }
  } catch (error: any) {
    logger.warn('[PermissionMiddleware] Effective access shadow check failed', {
      permissionKey,
      error: error?.message || String(error),
    });
  }
}

async function evaluateEffectiveAccess(
  req: AuthRequest,
  permissionKey: string
): Promise<boolean | null> {
  if (process.env.EFFECTIVE_ACCESS_ENFORCE !== 'true') return null;
  const userId = req.userId || req.user?.id;
  const organizationId = req.organizationId || req.user?.organizationId;
  const projectId = String(
    req.params?.projectId || req.params?.id || req.query?.projectId || ''
  ).trim();
  if (!userId || !organizationId) return null;

  const access = await resolveEffectiveAccess({
    userId,
    organizationId,
    applicationRole: req.userRole || req.user?.role,
    projectId: projectId || null,
    isImpersonating: Boolean(req.user?.impersonatorId),
  });
  return hasEffectiveCapability(access, mapLegacyPermissionToCapability(permissionKey));
}

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

      const effectiveDecision = await evaluateEffectiveAccess(req, permissionKey);
      if (effectiveDecision !== null) {
        hasPermission = effectiveDecision;
      }

      if (!hasPermission) {
        await shadowCompareEffectiveAccess(req, permissionKey, false);
        logger.info(`[PermissionMiddleware] Denied: ${permissionKey} for user ${userId}`);
        res.status(403).json({
          error: 'Permission denied',
          required: permissionKey,
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Attach permission info for audit logging
      await shadowCompareEffectiveAccess(req, permissionKey, true);
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

      if (permissionKeys.length > MAX_PERMISSION_KEYS_PER_REQUEST) {
        logger.warn('[PermissionMiddleware] Denied: permission key list exceeds max count', {
          userId,
          count: permissionKeys.length,
          max: MAX_PERMISSION_KEYS_PER_REQUEST,
        });
        res.status(403).json({
          error: 'Permission denied',
          requiredAny: [],
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      const roleCandidates = getRoleCandidates(userRole);
      for (const permissionKey of permissionKeys) {
        const effectiveDecision = await evaluateEffectiveAccess(req, permissionKey);
        if (effectiveDecision === true) {
          await shadowCompareEffectiveAccess(req, permissionKey, true);
          (req as AuthRequest & { permissionChecked?: string }).permissionChecked = permissionKey;
          next();
          return;
        }
        if (effectiveDecision === false) continue;
        for (const candidateRole of roleCandidates) {
          const hasPermission = await PermissionService.hasPermission(
            userId,
            orgId,
            permissionKey,
            candidateRole
          );
          if (hasPermission) {
            await shadowCompareEffectiveAccess(req, permissionKey, true);
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

      if (permissionKeys.length > MAX_PERMISSION_KEYS_PER_REQUEST) {
        logger.warn('[PermissionMiddleware] Denied: permission key list exceeds max count', {
          userId,
          count: permissionKeys.length,
          max: MAX_PERMISSION_KEYS_PER_REQUEST,
        });
        res.status(403).json({
          error: 'Permission denied',
          missing: [],
          code: 'PERMISSION_DENIED',
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
      if (res.headersSent) {
        return originalJson(data);
      }

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

/**
 * Internal helpers exposed for unit testing.
 * Not part of the public middleware API.
 */
export const __private__ = {
  normalizeRoleForDb: (role?: string) => getRoleCandidates(role)[0] || 'USER',
  getRoleCandidates,
};
