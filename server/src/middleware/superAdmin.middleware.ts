/**
 * Super Admin Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Verifies user has SUPERADMIN privileges.
 * Checks both token and database for role verification.
 */

import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import config from '../config/Config.js';
import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface JWTPayload {
  id: string;
  role?: string;
  organizationId?: string;
  organization_id?: string;
  superadminCapabilities?: string[];
}

// Database interface no longer needed - using DbPromise directly

interface UserRow {
  role?: string;
}

interface Dependencies {
  jwt: typeof jwt;
  config: { JWT_SECRET: string };
  dbGet: <T>(sql: string, params?: any[]) => Promise<T | undefined>;
}

export const SUPERADMIN_CAPABILITIES = [
  'platform_ops',
  'security_ops',
  'billing_ops',
  'support_ops',
  'ai_ops',
] as const;

export type SuperAdminCapability = (typeof SUPERADMIN_CAPABILITIES)[number];

const normalizeSuperAdminRole = (role?: string): string => {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  // Supported aliases: SUPERADMIN, SUPER_ADMIN, superadmin, super_admin.
  if (
    normalized === 'superadmin' ||
    normalized === 'super_admin' ||
    normalized === 'super-admin'
  ) {
    return 'superadmin';
  }

  return normalized;
};

const normalizeCapability = (capability?: string): SuperAdminCapability | null => {
  const normalized = String(capability || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_') as SuperAdminCapability;
  return SUPERADMIN_CAPABILITIES.includes(normalized) ? normalized : null;
};

export const getSuperAdminCapabilities = (
  role?: string,
  explicitCapabilities?: string[]
): SuperAdminCapability[] => {
  const normalizedRole = normalizeSuperAdminRole(role);
  const hasExplicitCapabilityOverride =
    Array.isArray(explicitCapabilities) && explicitCapabilities.length > 0;
  const normalizedExplicit = Array.isArray(explicitCapabilities)
    ? explicitCapabilities.map(normalizeCapability).filter(Boolean)
    : [];

  // Honor explicit capability subsets when they contain at least one valid capability.
  // Empty or malformed capability arrays should not accidentally strip a real superadmin
  // down to zero access.
  if (hasExplicitCapabilityOverride && normalizedExplicit.length > 0) {
    return Array.from(new Set(normalizedExplicit)) as SuperAdminCapability[];
  }

  if (normalizedRole === 'superadmin') {
    return [...SUPERADMIN_CAPABILITIES];
  }

  return [];
};

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
  jwt,
  config,
  dbGet,
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Verify Super Admin - Checks token and database for SUPERADMIN role
 */
export const verifySuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { jwt: jwtLib, config: depsConfig, dbGet: db } = deps;

  const headers = req.headers || {};
  const token = headers['authorization'];

  if (!token) {
    res.status(401).json({
      error: 'Authorization token required',
      code: 'UNAUTHORIZED',
      guidance: 'Sign in with a platform superadmin account and retry.',
    });
    return;
  }

  const cleanToken =
    typeof token === 'string' && token.startsWith('Bearer ')
      ? token.split(' ')[1]
      : typeof token === 'string'
        ? token
        : '';

  try {
    const decoded = await new Promise<JWTPayload>((resolve, reject) => {
      jwtLib.verify(cleanToken, depsConfig.JWT_SECRET, (err: any, decoded: any) => {
        if (err) return reject(err);
        resolve(decoded as JWTPayload);
      });
    });

    // Check role from token first, but ALWAYS verify against DB to prevent stale privilege tokens.
    let userRole = decoded.role;

    let dbRole: string | undefined;
    try {
      const user = await db<UserRow>('SELECT role FROM users WHERE id = ?', [decoded.id]);
      dbRole = user?.role;
    } catch (dbError) {
      logger.error('[SuperAdmin Middleware] Database check error:', dbError);
      res.status(403).json({
        error: 'Requires Super Admin privileges',
        code: 'INSUFFICIENT_PLATFORM_ROLE',
        guidance: 'Use a platform superadmin session to access this control plane.',
      });
      return;
    }

    // Prefer DB truth when available; fall back to token role if DB doesn't return a row.
    const effectiveRole = dbRole || userRole;

    if (normalizeSuperAdminRole(effectiveRole) !== 'superadmin') {
      logger.info(`[SuperAdmin Middleware] Access Denied. Role: ${effectiveRole}`);
      res.status(403).json({
        error: 'Requires Super Admin privileges',
        code: 'INSUFFICIENT_PLATFORM_ROLE',
        guidance: 'Use a platform superadmin session to access this control plane.',
      });
      return;
    }

    userRole = effectiveRole;

    // Attach super admin status to request
    if (req.user) {
      req.user.isSuperAdmin = true;
      req.user.role =
        normalizeSuperAdminRole(userRole) === 'superadmin' ? 'SUPERADMIN' : (userRole as any);
      req.user.organizationId = decoded.organizationId || decoded.organization_id || '';
      req.user.superadminCapabilities = getSuperAdminCapabilities(
        userRole,
        decoded.superadminCapabilities
      );
    } else {
      req.user = {
        id: decoded.id,
        email: '',
        name: '',
        role:
          normalizeSuperAdminRole(userRole) === 'superadmin' ? 'SUPERADMIN' : (userRole as any),
        organizationId: decoded.organizationId || decoded.organization_id || '',
        isSuperAdmin: true,
        superadminCapabilities: getSuperAdminCapabilities(userRole, decoded.superadminCapabilities),
      };
    }
    req.userId = decoded.id;
    req.userRole = userRole;
    req.organizationId = decoded.organizationId || decoded.organization_id;

    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      guidance: 'Refresh your session and retry.',
    });
  }
};

export const requireSuperAdminCapability =
  (...requiredCapabilities: SuperAdminCapability[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    const granted = new Set(
      getSuperAdminCapabilities(
        req.userRole || req.user?.role,
        req.user?.superadminCapabilities || []
      )
    );

    const hasCapability = requiredCapabilities.some((capability) => granted.has(capability));
    if (hasCapability) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Requires additional platform capability',
      code: 'INSUFFICIENT_PLATFORM_CAPABILITY',
      guidance: `Use a privileged session with one of: ${requiredCapabilities.join(', ')}.`,
      requiredCapabilities,
      grantedCapabilities: Array.from(granted),
    });
  };

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
