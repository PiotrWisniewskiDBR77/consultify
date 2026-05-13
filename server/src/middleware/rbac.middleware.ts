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

const RBAC_FORBIDDEN_CODES = {
  INSUFFICIENT_ROLE: 'RBAC_INSUFFICIENT_ROLE',
  ORGANIZATION_ACCESS_REQUIRED: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
} as const;
const RBAC_MAX_ROLE_INPUT_CHARS = 1024;
const RBAC_MAX_ORG_ID_CHARS = 256;
const responseWriteBlocked = (res: Response): boolean =>
  safeRead(() => res.headersSent, false) ||
  safeRead(() => (res as Response & { writableEnded?: boolean }).writableEnded, false) ||
  safeRead(() => (res as Response & { finished?: boolean }).finished, false) ||
  safeRead(() => (res as Response & { destroyed?: boolean }).destroyed, false);
const invokeNextIfFunction = (next: NextFunction): boolean => {
  if (typeof next !== 'function') return false;
  next();
  return true;
};

const sendRbacForbidden = (res: Response, error: string, code: string): void => {
  if (responseWriteBlocked(res)) return;
  try {
    res.status(403);
  } catch {
    return;
  }
  try {
    res.json({ error, code });
  } catch {
    // fail-closed: RBAC deny path should not throw
  }
};
const isInvalidOrgToken = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === 'null' || normalized === 'undefined' || normalized === 'none';
};
const containsInvalidOrgChars = (value: string): boolean =>
  /[\u0000-\u001F\u007F\u2028\u2029\u202A-\u202E\u2066-\u2069\u200B-\u200D\uFEFF]/.test(value);

const toCanonicalRole = (role: UserRole | undefined): CanonicalRole => {
  const r = safeRead(
    () => {
      const raw = String(role ?? '');
      if (raw.length > RBAC_MAX_ROLE_INPUT_CHARS) return '';
      return raw
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    },
    ''
  );

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
  const raw = toCanonicalRole(normalizeOptionalString(safeRead(() => req.userRole, undefined as unknown)));
  if (raw) return raw;
  return toCanonicalRole(
    normalizeOptionalString(safeRead(() => req.user?.role, undefined as unknown))
  );
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
    if (typeof next !== 'function') return;
    if (!roles || roles.length === 0) {
      invokeNextIfFunction(next);
      return;
    }

    const userRole = getRequestRole(req);
    const required = safeRead(
      () => roles.map(toCanonicalRole).filter(Boolean),
      [] as CanonicalRole[]
    );
    const allowed = safeRead(() => required.some((r) => roleSatisfies(userRole, r)), false);

    if (!allowed) {
      sendRbacForbidden(
        res,
        'Insufficient role',
        RBAC_FORBIDDEN_CODES.INSUFFICIENT_ROLE
      );
      return;
    }

    invokeNextIfFunction(next);
  };
};

/**
 * Require organization access
 */
export const requireOrgAccess = () => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (typeof next !== 'function') return;
    const orgId =
      normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined as unknown)) ||
      normalizeOptionalString(safeRead(() => req.user?.organization_id, undefined as unknown)) ||
      normalizeOptionalString(safeRead(() => req.organizationId, undefined as unknown));

    if (
      !orgId ||
      isInvalidOrgToken(orgId) ||
      orgId.length > RBAC_MAX_ORG_ID_CHARS ||
      containsInvalidOrgChars(orgId)
    ) {
      sendRbacForbidden(
        res,
        'Organization access required',
        RBAC_FORBIDDEN_CODES.ORGANIZATION_ACCESS_REQUIRED
      );
      return;
    }

    invokeNextIfFunction(next);
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
