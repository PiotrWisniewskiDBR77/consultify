/**
 * Admin Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Admin access control middleware
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

const isAdminRole = (role: UserRole | undefined): boolean => {
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
export const verifyAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const role = req.user?.role || req.userRole;

  if (!isAdminRole(role)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default verifyAdmin;
