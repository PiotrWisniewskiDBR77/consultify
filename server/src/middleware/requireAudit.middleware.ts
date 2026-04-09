/**
 * requireAudit middleware — V4-ENT-03
 * Attaches req.emitAuditEvent for routes that need explicit audit logging.
 * Use alongside write routes; handlers call req.emitAuditEvent({ ... }) after success.
 *
 * FAIL-CLOSED: if audit persistence fails, emitAuditEvent throws so the caller
 * can return 503 (AUDIT_UNAVAILABLE) instead of silently dropping the record.
 */

import type { NextFunction, Response } from 'express';

import type { AuditEventInput } from '../services/AuditEventsService.js';
import auditEventsService from '../services/AuditEventsService.js';
import logger from '../utils/Logger.js';
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
    try {
      return await auditEventsService.log({
        ...input,
        actorType: input.actorType || 'USER',
        actorId: req.user?.id,
        organizationId: req.user?.organizationId,
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (err) {
      logger.error('[requireAudit] Audit write failed — fail-closed:', err);
      throw err;
    }
  };
  next();
}
