/**
 * Admin Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Admin access control middleware
 */

import type { NextFunction, Request, Response } from 'express';

import { normalizeOrganizationRole } from '../services/organizationService.js';
import { get as dbGet } from '../utils/DbPromise.js';
import type { AuthRequest } from './auth.middleware.js';
import { getRequestAccessRole, isRequestSuperAdmin } from './requestAccess.js';

// ==========================================
// TYPES
// ==========================================

type UserRole = string;

// ==========================================
// HELPERS
// ==========================================

export const isAdminRole = (role: UserRole | undefined): boolean => {
  if (!role) return false;
  const normalized = String(role).toLowerCase();
  return ['admin', 'administrator', 'superadmin', 'owner'].includes(normalized);
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Verify admin access
 */
export const verifyAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const role = getRequestAccessRole(req);
  const orgId = req.user?.organizationId || req.organizationId;
  const userId = req.user?.id;

  if (isRequestSuperAdmin(req)) {
    next();
    return;
  }

  if (orgId && userId) {
    try {
      const membership = await dbGet<{ role?: string }>(
        `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
        [orgId, userId],
        { fallback: true }
      );
      const normalizedRole = normalizeOrganizationRole(membership?.role || role);
      if (['OWNER', 'ADMIN'].includes(normalizedRole)) {
        next();
        return;
      }
    } catch {
      // fail closed
    }
  }

  res.status(403).json({ error: 'Admin access required' });
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default verifyAdmin;
