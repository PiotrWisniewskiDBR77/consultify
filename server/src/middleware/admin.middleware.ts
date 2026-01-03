/**
 * Admin Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Verifies user is an ADMIN or SUPERADMIN for their organization.
 * Use this for organization-scoped admin actions (user management, team creation, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface JWTPayload {
    id: string;
    role?: string;
    organizationId?: string;
    organization_id?: string;
}

interface Dependencies {
    jwt: typeof jwt;
    config: { JWT_SECRET: string };
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
    jwt,
    config
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Admin Middleware - Verifies user is an ADMIN or SUPERADMIN for their organization
 */
export const verifyAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const { jwt: jwtLib, config: depsConfig } = deps;

    const headers = req.headers || {};
    const token = headers['authorization'] || headers['x-access-token'];

    if (!token) {
        res.status(403).json({ error: 'No token provided' });
        return;
    }

    const cleanToken = typeof token === 'string' && token.startsWith('Bearer ')
        ? token.slice(7)
        : token;

    jwtLib.verify(cleanToken as string, depsConfig.JWT_SECRET, (err, decoded) => {
        if (err) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const payload = decoded as JWTPayload;

        // Check if user is ADMIN or SUPERADMIN
        if (payload.role !== 'ADMIN' && payload.role !== 'SUPERADMIN') {
            res.status(403).json({ error: 'Admin privileges required' });
            return;
        }

        req.userId = payload.id;
        req.userRole = payload.role;
        req.organizationId = payload.organizationId || payload.organization_id;
        req.user = {
            id: payload.id,
            role: payload.role || 'user',
            organizationId: req.organizationId,
            isSuperAdmin: payload.role === 'SUPERADMIN',
        };

        next();
    });
};

/**
 * Permission Checker - Granular permission checking utility
 * @param requiredPermission - The permission key to check
 * @returns Middleware function
 */
export const checkPermission = (requiredPermission: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        // Permission matrix by role
        const permissions: Record<string, string[]> = {
            SUPERADMIN: [
                'org:create', 'org:read', 'org:update', 'org:delete',
                'user:create', 'user:read', 'user:update', 'user:delete', 'user:reset_password',
                'project:create', 'project:read', 'project:update', 'project:delete',
                'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
                'team:create', 'team:read', 'team:update', 'team:delete',
                'settings:global', 'analytics:global',
                'connectors:manage'
            ],
            ADMIN: [
                'user:create', 'user:read', 'user:update', 'user:delete',
                'project:create', 'project:read', 'project:update', 'project:delete',
                'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
                'team:create', 'team:read', 'team:update', 'team:delete',
                'settings:org', 'analytics:org',
                'connectors:manage'
            ],
            USER: [
                'project:read',
                'task:create', 'task:read', 'task:update:own', 'task:delete:own',
                'team:read',
                'settings:own'
            ]
        };

        const userRole = req.userRole || req.user?.role;
        const userPermissions = permissions[userRole || ''] || [];

        // Check for exact match or wildcard match
        const hasPermission = userPermissions.some(perm => {
            if (perm === requiredPermission) return true;
            // Check :own suffix - if user has :own, they can do action on their own resources
            if (requiredPermission.endsWith(':own') && perm === requiredPermission) return true;
            // If user has full permission, :own is also granted
            const basePermission = requiredPermission.replace(':own', '');
            return perm === basePermission;
        });

        if (!hasPermission) {
            res.status(403).json({
                error: 'Permission denied',
                required: requiredPermission,
                role: userRole
            });
            return;
        }

        next();
    };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
    deps = { ...deps, ...newDeps };
};




