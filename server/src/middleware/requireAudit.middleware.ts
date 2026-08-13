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

    // Deep clone before/after state snapshots, under exactly the same rules as
    // metadata above (structuredClone -> serializable -> size-capped).
    //
    // WHY THIS EXISTS (found 2026-08-10 by querying the audit table instead of
    // reading the code): `AuditEventInput` accepts `before`/`after`,
    // `AuditEventsService.log` persists them into `before_json`/`after_json`, and
    // a dozen call sites across the app pass them — but the "controlled payload"
    // built below never forwarded them, so they were dropped in between. Every
    // audit row in the database had before_json = after_json = NULL (verified:
    // 0 of 8 IDEA_UPDATE rows carried a payload). The audit trail recorded who
    // touched which resource and never WHAT CHANGED. That is the difference
    // between an audit trail and a hit counter, and it matters most for the
    // fields where a change is itself the security event — e.g. downgrading an
    // Idea's `confidentiality` from `restricted`, which re-opens eight AI/export
    // endpoints on the next request.
    const cloneStateField = (
      value: unknown,
      label: 'before' | 'after'
    ): { ok: true; value: unknown } | { ok: false; err: TypeError } => {
      let cloned: unknown;
      try {
        cloned = structuredClone(value);
      } catch (err) {
        return { ok: false, err: err instanceof TypeError ? err : new TypeError(String(err)) };
      }
      try {
        const serialized = JSON.stringify(cloned);
        if (serialized !== undefined && serialized.length > MAX_METADATA_BYTES) {
          logger.warn(`[requireAudit] emitAuditEvent: ${label} payload too large`);
          return { ok: false, err: new TypeError(`emitAuditEvent: ${label} payload too large`) };
        }
      } catch {
        return { ok: false, err: new TypeError(`emitAuditEvent: ${label} is not serializable`) };
      }
      return { ok: true, value: cloned };
    };

    let clonedBefore: unknown;
    if (input.before !== undefined) {
      const r = cloneStateField(input.before, 'before');
      if (!r.ok) return Promise.reject(r.err);
      clonedBefore = r.value;
    }
    let clonedAfter: unknown;
    if (input.after !== undefined) {
      const r = cloneStateField(input.after, 'after');
      if (!r.ok) return Promise.reject(r.err);
      clonedAfter = r.value;
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
      // Same shape-cast the line below uses for metadata: `AuditEventInput` types
      // these as `Record<string, unknown>`, while `structuredClone` widens to
      // `unknown`. The value has already been proven cloneable and serializable
      // above, so the cast asserts nothing that was not checked.
      ...(clonedBefore !== undefined ? { before: clonedBefore as Record<string, unknown> } : {}),
      ...(clonedAfter !== undefined ? { after: clonedAfter as Record<string, unknown> } : {}),
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
