/**
 * RBAC Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Role-Based Access Control middleware
 */

import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

type UserRole = string;

// ==========================================
// HELPERS
// ==========================================

type CanonicalRole = 'superadmin' | 'admin' | 'user' | string;

const toCanonicalRole = (role: UserRole | undefined): CanonicalRole => {
  const r = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (!r) return '';

  // SuperAdmin aliases (note: auth middleware may map SUPERADMIN -> owner in req.user.role)
  if (
    r === 'superadmin' ||
    r === 'super_admin' ||
    r === 'super-admin' ||
    r === 'super_admin_' ||
    r === 'owner'
  ) {
    return 'superadmin';
  }

  // Admin aliases
  if (r === 'admin' || r === 'administrator') return 'admin';

  // End-user aliases
  if (r === 'team_member' || r === 'member' || r === 'user' || r === 'viewer' || r === 'guest') {
    return 'user';
  }

  return r;
};

const getRequestRole = (req: AuthRequest): CanonicalRole => {
  // Prefer raw role from token (req.userRole). `req.user.role` may be mapped (e.g. SUPERADMIN -> owner).
  const raw = toCanonicalRole(req.userRole);
  if (raw) return raw;
  return toCanonicalRole(req.user?.role);
};

const roleSatisfies = (userRole: CanonicalRole, requiredRole: CanonicalRole): boolean => {
  if (!requiredRole) return true;

  // SuperAdmin can access everything.
  if (userRole === 'superadmin') return true;

  // Hierarchy for common roles.
  const level = (r: CanonicalRole): number => {
    if (r === 'admin') return 2;
    if (r === 'user') return 1;
    return 0;
  };

  const reqLevel = level(requiredRole);
  if (reqLevel > 0) return level(userRole) >= reqLevel;

  // Fallback to exact match for custom roles.
  return userRole === requiredRole;
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

    const userRole = getRequestRole(req);
    const required = roles.map(toCanonicalRole).filter(Boolean);
    const allowed = required.some((r) => roleSatisfies(userRole, r));

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
