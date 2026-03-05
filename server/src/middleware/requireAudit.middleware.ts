/**
 * requireAudit middleware — V4-ENT-03
 * Attaches req.emitAuditEvent for routes that need explicit audit logging.
 * Use alongside write routes; handlers call req.emitAuditEvent({ ... }) after success.
 */

import type { NextFunction, Response } from 'express';

import auditEventsService from '../services/AuditEventsService.js';
import type { AuditEventInput } from '../services/AuditEventsService.js';
import type { AuthRequest } from './auth.middleware.js';

declare global {
  namespace Express {
    interface Request {
      emitAuditEvent?: (input: Omit<AuditEventInput, 'actorId' | 'organizationId' | 'ip' | 'userAgent'>) => Promise<string>;
    }
  }
}

export function requireAudit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  req.emitAuditEvent = async (input) => {
    return auditEventsService.log({
      ...input,
      actorId: req.user?.id,
      organizationId: req.user?.organizationId,
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  };
  next();
}
