/**
 * Request Context Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Safely extracts user and organization context from a request object.
 * Used for logging, auditing, and server-side RBAC enforcement.
 */

import type { Request } from 'express';
import {
  normalizeOptionalString,
  resolveRequestOrganizationId,
  safeRead,
} from './requestOrganization.js';

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
  const requestUser = safeRead(() => anyReq.user, undefined) || safeRead(() => anyReq.session?.user, undefined);
  const userId =
    normalizeOptionalString(safeRead(() => anyReq.userId, null)) ||
    normalizeOptionalString(safeRead(() => requestUser?.id, null));
  const orgId = resolveRequestOrganizationId(req as Request);
  const role =
    normalizeOptionalString(safeRead(() => anyReq.userRole, null)) ||
    normalizeOptionalString(safeRead(() => requestUser?.role, null)) ||
    'GUEST';

  return {
    userId,
    orgId,
    role,
    ip:
      normalizeOptionalString(safeRead(() => req.ip, null)) ||
      normalizeOptionalString(safeRead(() => anyReq.connection?.remoteAddress, null)) ||
      'unknown',
    userAgent: normalizeOptionalString(safeRead(() => req.get('User-Agent'), null)) || 'unknown',
    method: normalizeOptionalString(safeRead(() => req.method, null)) || 'unknown',
    path: normalizeOptionalString(safeRead(() => req.path, null)) || 'unknown',
    requestId:
      normalizeOptionalString(safeRead(() => anyReq.correlationId, null)) ||
      normalizeOptionalString(safeRead(() => req.get('X-Correlation-ID') as string, null)) ||
      normalizeOptionalString(safeRead(() => req.get('X-Request-Id') as string, null)) ||
      'none',
  };
};
