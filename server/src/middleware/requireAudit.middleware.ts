/**
 * requireAudit middleware — V4-ENT-03
 * Attaches req.emitAuditEvent for routes that need explicit audit logging.
 * Use alongside write routes; handlers call req.emitAuditEvent({ ... }) after success.
 */

import type { NextFunction, Response } from 'express';

import type { AuditEventInput } from '../services/AuditEventsService.js';
import auditEventsService from '../services/AuditEventsService.js';
import type { AuthRequest } from './auth.middleware.js';

declare module 'express-serve-static-core' {
  interface Request {
    emitAuditEvent?: (
      input: Omit<
        AuditEventInput,
        'actorId' | 'organizationId' | 'ip' | 'userAgent' | 'actorType'
      > & {
        actorType?: AuditEventInput['actorType'];
      }
    ) => Promise<string>;
  }
}

export function requireAudit(req: AuthRequest, res: Response, next: NextFunction): void {
  req.emitAuditEvent = async (input) => {
    return auditEventsService.log({
      ...input,
      actorType: input.actorType || 'USER',
      actorId: req.user?.id,
      organizationId: req.user?.organizationId,
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
  };
  next();
}
