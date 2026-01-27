/**
 * RBAC Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Role-Based Access Control middleware
 */

import type { NextFunction, Request, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

type UserRole = string;

// ==========================================
// HELPERS
// ==========================================

const normalizeRole = (role: UserRole | undefined): string => {
  return String(role || '').toLowerCase();
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Require specific role(s)
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!roles || roles.length === 0) {
      return next();
    }

    const userRole = normalizeRole(req.user?.role || req.userRole);
    const allowed = roles.map(normalizeRole).includes(userRole);

    if (!allowed) {
      res.status(403).json({ error: 'Insufficient role' });
      return;
    }

    next();
  };
};

/**
 * Require organization access
 */
export const requireOrgAccess = () => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const orgId = req.user?.organizationId || req.organizationId;

    if (!orgId) {
      res.status(403).json({ error: 'Organization access required' });
      return;
    }

    next();
  };
};

/**
 * Require organization role(s) - alias for requireRole
 */
export const requireOrgRole = (...roles: UserRole[]) => {
  return requireRole(...roles);
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default requireRole;
