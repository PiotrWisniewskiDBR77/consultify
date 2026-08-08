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

declare global {
  namespace Express {
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
}

const MAX_USER_AGENT = 2048;
const MAX_IP = 128;
const MAX_ACTOR_ID = 128;
const MAX_ORG_ID = 128;
const MAX_RESOURCE_ID = 256;
const MAX_METADATA_BYTES = 131072;
const MAX_EMISSIONS = 50;
// eslint-disable-next-line no-control-regex -- sanityzacja: celowo usuwamy znaki kontrolne z metadanych audytu
const CONTROL_RE = /[\x00-\x1f\x7f]/g;
const VALID_ACTOR_TYPES: ReadonlySet<string> = new Set([
  'USER',
  'SYSTEM',
  'AI',
  'INTEGRATION',
  'CONSULTANT',
]);

function clampStr(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.slice(0, max);
}

function stripCtrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.replace(CONTROL_RE, '');
}

function safeGetHeader(req: AuthRequest, name: string): string | undefined {
  try {
    const fn = (req as any).get;
    if (typeof fn !== 'function') return undefined;
    const v = fn.call(req, name);
    return typeof v === 'string' ? v : undefined;
  } catch {
    return undefined;
  }
}

function safeUser(req: AuthRequest): Record<string, unknown> | null {
  try {
    return (req.user as any) ?? null;
  } catch {
    return null;
  }
}

export function requireAudit(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.emitAuditEvent) {
    next();
    return;
  }

  let emissionCount = 0;
  let queue: Promise<unknown> = Promise.resolve();

  req.emitAuditEvent = (input: any): Promise<string> => {
    // Validate input type
    if (
      input === null ||
      input === undefined ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      logger.warn('[requireAudit] emitAuditEvent: invalid input type');
      return Promise.reject(new TypeError('emitAuditEvent: input must be a non-null object'));
    }

    // Validate required fields
    if (
      typeof input.action !== 'string' ||
      !input.action ||
      typeof input.resourceType !== 'string' ||
      !input.resourceType
    ) {
      logger.warn('[requireAudit] emitAuditEvent: missing action or resourceType');
      return Promise.reject(new TypeError('emitAuditEvent: action and resourceType are required'));
    }

    // Deep clone metadata (throws TypeError on circular references)
    let clonedMetadata: unknown;
    if (input.metadata !== undefined) {
      try {
        clonedMetadata = structuredClone(input.metadata);
      } catch (err) {
        return Promise.reject(err instanceof TypeError ? err : new TypeError(String(err)));
      }

      try {
        const serialized = JSON.stringify(clonedMetadata);
        if (serialized.length > MAX_METADATA_BYTES) {
          logger.warn('[requireAudit] emitAuditEvent: metadata payload too large');
          return Promise.reject(new TypeError('emitAuditEvent: metadata payload too large'));
        }
      } catch {
        return Promise.reject(new TypeError('emitAuditEvent: metadata is not serializable'));
      }
    }

    // Cap check (before incrementing)
    if (emissionCount >= MAX_EMISSIONS) {
      logger.warn('[requireAudit] emitAuditEvent: per-request emission cap exceeded');
      return Promise.reject(new TypeError('emitAuditEvent: per-request emission cap exceeded'));
    }

    // Count this emission
    emissionCount++;

    // Read actor info with fallbacks for throwing getters
    const user = safeUser(req);
    const actorId = clampStr(user?.id ?? (req as any).userId, MAX_ACTOR_ID);
    const organizationId = clampStr(
      user?.organizationId ?? (req as any).organizationId,
      MAX_ORG_ID
    );
    const ip = clampStr((req as any).ip, MAX_IP);
    const userAgent = clampStr(safeGetHeader(req, 'user-agent'), MAX_USER_AGENT);

    // Normalize actorType
    const rawActorType = input.actorType;
    const actorType: AuditEventInput['actorType'] =
      typeof rawActorType === 'string' && VALID_ACTOR_TYPES.has(rawActorType)
        ? (rawActorType as AuditEventInput['actorType'])
        : 'USER';

    // Sanitize string fields
    const action = stripCtrl(input.action.trim())!;
    const resourceType = stripCtrl((input.resourceType as string).trim())!;
    const resourceId =
      input.resourceId != null
        ? clampStr(stripCtrl(String(input.resourceId).trim()), MAX_RESOURCE_ID)
        : undefined;

    // Build controlled payload (only known fields, no arbitrary caller properties)
    const payload: AuditEventInput = {
      action,
      resourceType,
      actorType,
      actorId,
      organizationId,
      ip,
      userAgent,
      ...(resourceId !== undefined ? { resourceId } : {}),
      ...(clonedMetadata !== undefined
        ? { metadata: clonedMetadata as Record<string, unknown> }
        : {}),
    };

    // Queue the persistence call (serialize concurrent calls per request)
    const myTurn = queue.then(async () => {
      let eventId: unknown;
      try {
        eventId = await auditEventsService.log(payload);
      } catch (err) {
        logger.error('[requireAudit] Audit write failed — fail-closed:', err);
        throw err;
      }

      if (typeof eventId !== 'string' || !eventId.trim()) {
        logger.warn('[requireAudit] Persistence layer returned invalid event id');
        throw new TypeError('emitAuditEvent: persistence returned invalid event id');
      }
      return eventId.trim();
    });
    queue = myTurn.then(
      () => {},
      () => {}
    );

    return myTurn;
  };

  next();
}
