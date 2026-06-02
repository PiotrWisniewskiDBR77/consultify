/**
 * SuperAdmin Audit 5xx Monitor Middleware
 *
 * Wraps response.send/json so we can detect 5xx status codes returned for
 * `/api/superadmin/admin/audit-logs*` paths and emit a structured warning.
 *
 * The structured log line is intentionally well-shaped so existing Sentry/Slack
 * sinks can route on `[ALERT][superadmin.audit]` without code changes.
 *
 * Mount once on the superadmin router (after verifyToken so we get user id).
 */

import type { NextFunction, Response } from 'express';

import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

const AUDIT_PATH_PATTERN = /^\/admin\/audit(-logs)?(\/|$)/i;
const AUDIT_PATH_FULL_PATTERN = /^\/api\/superadmin\/admin\/audit(-logs)?(\/|$)/i;

const isAuditPath = (req: AuthRequest): boolean => {
  const reqPath = req.path || '';
  if (AUDIT_PATH_PATTERN.test(reqPath)) return true;
  const original = req.originalUrl || '';
  if (AUDIT_PATH_FULL_PATTERN.test(original.split('?')[0] || '')) return true;
  return false;
};

const emitAlert = (req: AuthRequest, res: Response, body?: unknown): void => {
  const status = res.statusCode || 0;
  if (status < 500) return;
  const errorBody = (() => {
    if (!body || typeof body !== 'object') return undefined;
    const errAny = body as Record<string, unknown>;
    return errAny.error || errAny.message || undefined;
  })();
  logger.warn('[ALERT][superadmin.audit] 5xx response on audit endpoint', {
    statusCode: status,
    method: req.method,
    path: req.originalUrl || req.path,
    userId: (req as any).user?.id,
    organizationId: (req as any).user?.organizationId,
    bodySummary: errorBody,
    monitor: 'superadmin-audit-5xx',
  });
};

export function superadminAuditMonitor(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!isAuditPath(req)) {
    next();
    return;
  }

  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  (res as any).send = (body?: any) => {
    try {
      emitAlert(req, res, body);
    } catch {
      // Monitoring must never affect the response.
    }
    return originalSend(body);
  };

  (res as any).json = (body?: any) => {
    try {
      emitAlert(req, res, body);
    } catch {
      // Monitoring must never affect the response.
    }
    return originalJson(body);
  };

  next();
}
