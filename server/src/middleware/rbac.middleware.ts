/**
 * RBAC Middleware (HARDENED)
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Provides granular role-based access control for multi-tenant organizations.
 * 
 * Key Guards:
 * - requireOrgAccess: Unified guard for members AND consultants
 * - requireOrgRole: Check org-level role (OWNER, ADMIN, MEMBER)
 * - requireConsultantScope: Check consultant permission scope
 * - requireOwnerOrSuperadmin: Destructive operations
 * 
 * SECURITY: All guards require orgContextMiddleware to be applied first.
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

// ==========================================
// TYPES
// ==========================================

interface OrgContext {
    id: string;
    source?: string;
    isMember: boolean;
    isConsultant: boolean;
    role: string;
    permissionScope?: {
        permissions?: string[];
        [key: string]: unknown;
    };
    membershipId?: string;
}

interface OrgRequest extends AuthRequest {
    org?: OrgContext;
    orgContext?: OrgContext;
}

interface RequireOrgAccessOptions {
    roles?: string[] | null;
    consultantPermissions?: string[] | null;
    allowConsultant?: boolean;
}

// ==========================================
// CONSTANTS
// ==========================================

// Organization Role Hierarchy
export const ORG_ROLE_HIERARCHY: Record<string, number> = {
    OWNER: 4,
    ADMIN: 3,
    MEMBER: 2,
    CONSULTANT: 1
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * requireOrgAccess - UNIFIED guard for both members and consultants
 * 
 * This is the PRIMARY guard to use. It handles:
 * - Members: checks if user has one of the allowed roles
 * - Consultants: checks if consultant has required permissions in scope
 */
export const requireOrgAccess = (options: RequireOrgAccessOptions = {}) => {
    const {
        roles = null,
        consultantPermissions = null,
        allowConsultant = true
    } = options;

    return (req: OrgRequest, res: Response, next: NextFunction): void => {
        // Must have org context (set by orgContextMiddleware)
        if (!req.org?.id) {
            res.status(400).json({
                error: 'Missing organization context',
                message: 'Organization context must be resolved before access check.'
            });
            return;
        }

        // Handle MEMBER access
        if (req.org.isMember) {
            // If no specific roles required, any member can access
            if (!roles || roles.length === 0) {
                next();
                return;
            }
            // Check if user's role is in allowed list
            if (roles.includes(req.org.role)) {
                next();
                return;
            }
            res.status(403).json({
                error: 'Insufficient role',
                message: `This action requires one of: ${roles.join(', ')}`,
                yourRole: req.org.role
            });
            return;
        }

        // Handle CONSULTANT access
        if (req.org.isConsultant) {
            if (!allowConsultant) {
                res.status(403).json({
                    error: 'Access denied',
                    message: 'This resource is not accessible to consultants.'
                });
                return;
            }

            // If no specific permissions required, any active consultant can access
            if (!consultantPermissions || consultantPermissions.length === 0) {
                next();
                return;
            }

            // Check consultant permission scope
            const scope = req.org.permissionScope || {};
            const permissions = (scope.permissions || []) as string[];

            // Also check for boolean flags (e.g., { can_view_initiatives: true })
            const hasAllPermissions = consultantPermissions.every(p =>
                permissions.includes(p) || scope[p] === true
            );

            if (hasAllPermissions) {
                next();
                return;
            }

            res.status(403).json({
                error: 'Insufficient consultant scope',
                message: `Required permissions: ${consultantPermissions.join(', ')}`,
                yourPermissions: permissions
            });
            return;
        }

        // No valid access type
        res.status(403).json({
            error: 'Access denied',
            message: 'You do not have access to this organization.'
        });
    };
};

/**
 * requireRole - Check GLOBAL user role (legacy, for non-org routes)
 * @param roles - Single role or array of allowed roles
 */
export const requireRole = (roles: string | string[]) => {
    // Normalize to array if single string provided
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        // Case-insensitive role check
        const userRole = (req.user.role || '').toUpperCase();
        const matches = allowedRoles.some(r => r.toUpperCase() === userRole);
        
        if (!matches) {
            res.status(403).json({
                error: 'Forbidden',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
                yourRole: req.user.role
            });
            return;
        }

        next();
    };
};

/**
 * requireOrgMember - Simple check that user is a member (not consultant)
 */
export const requireOrgMember = () => {
    return (req: OrgRequest, res: Response, next: NextFunction): void => {
        if (!req.org?.id) {
            res.status(400).json({ error: 'Missing organization context' });
            return;
        }

        if (!req.org.isMember) {
            res.status(403).json({
                error: 'Access denied',
                message: 'This action requires organization membership (consultants excluded).'
            });
            return;
        }

        next();
    };
};

/**
 * requireOrgRole - Check if user has one of the allowed org roles
 * NOTE: Prefer requireOrgAccess for new code (handles both members and consultants)
 */
export const requireOrgRole = (allowedRoles: string[]) => {
    return (req: OrgRequest, res: Response, next: NextFunction): void => {
        if (!req.org?.id) {
            res.status(400).json({ error: 'Missing organization context' });
            return;
        }

        if (!req.org.isMember) {
            res.status(403).json({
                error: 'Access denied',
                message: 'Organization membership required.'
            });
            return;
        }

        if (!allowedRoles.includes(req.org.role)) {
            res.status(403).json({
                error: 'Insufficient role',
                message: `Required: ${allowedRoles.join(', ')}`,
                yourRole: req.org.role
            });
            return;
        }

        next();
    };
};

/**
 * requireOrgRoleOrHigher - Check if user has minimum role level
 */
export const requireOrgRoleOrHigher = (minimumRole: string) => {
    return (req: OrgRequest, res: Response, next: NextFunction): void => {
        if (!req.org?.id) {
            res.status(400).json({ error: 'Missing organization context' });
            return;
        }

        const userLevel = ORG_ROLE_HIERARCHY[req.org.role] || 0;
        const requiredLevel = ORG_ROLE_HIERARCHY[minimumRole] || 0;

        if (userLevel < requiredLevel) {
            res.status(403).json({
                error: 'Insufficient role',
                message: `Requires ${minimumRole} or higher.`,
                yourRole: req.org.role
            });
            return;
        }

        next();
    };
};

/**
 * requireConsultantScope - Check consultant has specific permissions
 * NOTE: Prefer requireOrgAccess for new code
 */
export const requireConsultantScope = (requiredPermissions: string | string[]) => {
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    return (req: OrgRequest, res: Response, next: NextFunction): void => {
        if (!req.org?.id) {
            res.status(400).json({ error: 'Missing organization context' });
            return;
        }

        // Non-consultants automatically pass (they have full org access based on role)
        if (!req.org.isConsultant) {
            next();
            return;
        }

        const scope = req.org.permissionScope || {};
        const permissionArray = (scope.permissions || []) as string[];

        const hasAll = permissions.every(p =>
            permissionArray.includes(p) || scope[p] === true
        );

        if (!hasAll) {
            res.status(403).json({
                error: 'Insufficient consultant scope',
                message: `Required: ${permissions.join(', ')}`
            });
            return;
        }

        next();
    };
};

/**
 * requireOwnerOrSuperadmin - For destructive operations
 */
export const requireOwnerOrSuperadmin = () => {
    return (req: OrgRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        // Global superadmin always allowed
        if (req.user.role === 'SUPERADMIN') {
            next();
            return;
        }

        // Check org owner
        if (req.org?.isMember && req.org.role === 'OWNER') {
            next();
            return;
        }

        res.status(403).json({
            error: 'Forbidden',
            message: 'This action requires organization owner or superadmin privileges.'
        });
    };
};

