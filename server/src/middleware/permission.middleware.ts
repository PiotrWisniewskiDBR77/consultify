/**
 * Permission Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Database-backed permission checking middleware.
 * Uses PBAC (Permission-Based Access Control) with org-user overrides.
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import type { Role } from '../services/permissionService.js';

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

let deps: Dependencies;

const getDeps = async (): Promise<Dependencies> => {
    if (!deps) {
        const { default: defaultPermissionService } = await import('../services/permissionService.js');
        const { default: defaultGovernanceAuditService } = await import('../services/governanceAuditService.js');
        
        deps = {
            PermissionService: defaultPermissionService,
            GovernanceAuditService: defaultGovernanceAuditService,
        };
    }
    return deps;
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
            const { PermissionService } = await getDeps();
            
            const userId = req.userId || req.user?.id;
            const orgId = req.organizationId || req.user?.organization_id;
            const userRole = req.userRole || req.user?.role;

            if (!userId) {
                res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            const hasPermission = await PermissionService.hasPermission(
                userId,
                orgId,
                permissionKey,
                userRole
            );

            if (!hasPermission) {
                console.log(`[PermissionMiddleware] Denied: ${permissionKey} for user ${userId}`);
                res.status(403).json({
                    error: 'Permission denied',
                    required: permissionKey,
                    code: 'PERMISSION_DENIED'
                });
                return;
            }

            // Attach permission info for audit logging
            (req as AuthRequest & { permissionChecked?: string }).permissionChecked = permissionKey;
            next();
        } catch (err) {
            console.error('[PermissionMiddleware] Error:', err);
            res.status(500).json({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
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
            const { PermissionService } = await getDeps();
            
            const userId = req.userId || req.user?.id;
            const orgId = req.organizationId || req.user?.organization_id;
            const userRole = req.userRole || req.user?.role;

            if (!userId) {
                res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            for (const permissionKey of permissionKeys) {
                const hasPermission = await PermissionService.hasPermission(
                    userId,
                    orgId,
                    permissionKey,
                    userRole
                );

                if (hasPermission) {
                    (req as AuthRequest & { permissionChecked?: string }).permissionChecked = permissionKey;
                    next();
                    return;
                }
            }

            console.log(`[PermissionMiddleware] Denied: none of [${permissionKeys.join(', ')}] for user ${userId}`);
            res.status(403).json({
                error: 'Permission denied',
                requiredAny: permissionKeys,
                code: 'PERMISSION_DENIED'
            });
        } catch (err) {
            console.error('[PermissionMiddleware] Error:', err);
            res.status(500).json({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
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
            const { PermissionService } = await getDeps();
            
            const userId = req.userId || req.user?.id;
            const orgId = req.organizationId || req.user?.organization_id;
            const userRole = req.userRole || req.user?.role;

            if (!userId) {
                res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            const missingPermissions: string[] = [];

            for (const permissionKey of permissionKeys) {
                const hasPermission = await PermissionService.hasPermission(
                    userId,
                    orgId,
                    permissionKey,
                    userRole
                );

                if (!hasPermission) {
                    missingPermissions.push(permissionKey);
                }
            }

            if (missingPermissions.length > 0) {
                console.log(`[PermissionMiddleware] Denied: missing [${missingPermissions.join(', ')}] for user ${userId}`);
                res.status(403).json({
                    error: 'Permission denied',
                    missing: missingPermissions,
                    code: 'PERMISSION_DENIED'
                });
                return;
            }

            (req as AuthRequest & { permissionChecked?: string[] }).permissionChecked = permissionKeys;
            next();
        } catch (err) {
            console.error('[PermissionMiddleware] Error:', err);
            res.status(500).json({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
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
        getAfter = () => null
    } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { GovernanceAuditService } = await getDeps();
        
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json to intercept response
        res.json = async function (data: unknown) {
            // Only audit on success (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    await GovernanceAuditService.logAudit({
                        actorId: (req as AuthRequest).userId || (req as AuthRequest).user?.id || '',
                        actorRole: (req as AuthRequest).userRole || (req as AuthRequest).user?.role,
                        orgId: (req as AuthRequest).organizationId || (req as AuthRequest).user?.organization_id,
                        action,
                        resourceType,
                        resourceId: getResourceId(req, data),
                        before: getBefore(req),
                        after: getAfter(req, data),
                        correlationId: (req as Request & { correlationId?: string }).correlationId || req.get('X-Correlation-Id') || undefined
                    });
                } catch (auditErr) {
                    console.error('[AuditMiddleware] Error logging audit:', auditErr);
                    // Don't fail the request if audit fails
                }
            }

            // Call original json method
            return originalJson(data);
        };

        next();
    };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = async (newDeps: Partial<Dependencies>): Promise<void> => {
    const currentDeps = await getDeps();
    deps = { ...currentDeps, ...newDeps };
};

