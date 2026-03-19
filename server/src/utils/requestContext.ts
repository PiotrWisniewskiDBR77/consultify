/**
 * Request Context Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Safely extracts user and organization context from a request object.
 * Used for logging, auditing, and server-side RBAC enforcement.
 */

import type { Request } from 'express';

export interface RequestContext {
  userId: string | null;
  orgId: string | null;
  role: string;
  ip: string;
  userAgent: string;
  method: string;
  path: string;
  requestId: string;
}

/**
 * Get context from request
 */
export const getRequestContext = (req: Request): RequestContext => {
  // Depending on auth middleware, user info might be in req.user or req.session.user
  const anyReq = req as any;
  const user = anyReq.user || (anyReq.session && anyReq.session.user) || {};

  return {
    userId: user.id || null,
    orgId: user.organization_id || user.organizationId || null,
    role: user.role || 'GUEST',
    ip: req.ip || anyReq.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    method: req.method,
    path: req.path,
    requestId:
      anyReq.correlationId ||
      (req.get('X-Correlation-ID') as string) ||
      (req.get('X-Request-Id') as string) ||
      'none',
  };
};
