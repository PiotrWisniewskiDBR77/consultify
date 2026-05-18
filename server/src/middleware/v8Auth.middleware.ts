import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

export interface V8RequestContext {
  organizationId: string;
  userId: string;
  userRole: string;
  isSuperAdmin: boolean;
}

/**
 * Ensures the request has a valid organizationId for V8 operations.
 * V8 services require org-scoped access — this middleware rejects
 * requests without org context early.
 */
export const requireV8OrgContext = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.organizationId) {
    res.status(403).json({
      error: 'V8 operations require organization context',
      code: 'V8_MISSING_ORG_CONTEXT',
    });
    return;
  }
  next();
};

/**
 * Extracts and validates the V8 request context, attaching it to the request
 * for use by downstream route handlers.
 */
export const attachV8Context = (req: AuthRequest, res: Response, next: NextFunction): void => {
  (req as any).v8Context = {
    organizationId: req.organizationId,
    userId: req.userId,
    userRole: req.userRole,
    isSuperAdmin: req.user?.isSuperAdmin ?? false,
  };
  next();
};

/**
 * Helper to extract V8 context from a request.
 * Throws if context is not attached (middleware not applied).
 */
export function getV8Context(req: AuthRequest): V8RequestContext {
  const ctx = (req as any).v8Context;
  if (!ctx || !ctx.organizationId) {
    throw new Error('V8 context not attached. Ensure attachV8Context middleware is applied.');
  }
  return ctx;
}

export default { requireV8OrgContext, attachV8Context, getV8Context };
