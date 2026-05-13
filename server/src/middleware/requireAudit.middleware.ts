/**
 * requireAudit middleware — V4-ENT-03
 * Attaches req.emitAuditEvent for routes that need explicit audit logging.
 * Use alongside write routes; handlers call req.emitAuditEvent({ ... }) after success.
 *
 * FAIL-CLOSED: if audit persistence fails, emitAuditEvent throws so the caller
 * can return 503 (AUDIT_UNAVAILABLE) instead of silently dropping the record.
 */

import type { NextFunction, Response } from 'express';

import type { ActorType, AuditEventInput } from '../services/AuditEventsService.js';
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
  if (typeof req.emitAuditEvent === 'function') {
    next();
    return;
  }

  const safeRead = <T>(reader: () => T, fallback: T): T => {
    try {
      return reader();
    } catch {
      return fallback;
    }
  };

  const normalizeOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized || undefined;
  };

  const MAX_AUDIT_USER_AGENT = 2048;
  const MAX_AUDIT_IP = 128;
  const MAX_AUDIT_ACTION = 128;
  const MAX_AUDIT_RESOURCE_TYPE = 128;
  const MAX_AUDIT_RESOURCE_ID = 256;
  const MAX_AUDIT_ACTOR_ID = 128;
  const MAX_AUDIT_ORGANIZATION_ID = 128;
  const MAX_AUDIT_JSON_FIELD_CHARS = 131072;
  const VALID_ACTOR_TYPES: ReadonlySet<ActorType> = new Set([
    'USER',
    'SYSTEM',
    'AI',
    'INTEGRATION',
    'CONSULTANT',
  ]);

  const clampOptionalString = (value: string | undefined, max: number): string | undefined => {
    if (!value) return value;
    return value.length > max ? value.slice(0, max) : value;
  };

  const clonePlainRecord = (
    value: unknown
  ): Record<string, unknown> | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return { ...(value as Record<string, unknown>) };
  };
  const cloneAuditStateObject = (value: unknown): unknown => {
    const shallowClone = clonePlainRecord(value);
    if (shallowClone === undefined) return value;
    try {
      return structuredClone(shallowClone);
    } catch {
      return shallowClone;
    }
  };

  const assertJsonSerializableAuditPayload = (field: string, value: unknown): void => {
    if (value === undefined) return;
    const assertWithinBounds = (jsonValue: string): void => {
      if (jsonValue.length > MAX_AUDIT_JSON_FIELD_CHARS) {
        throw new TypeError(
          `emitAuditEvent ${field} exceeds maximum serialized size of ${MAX_AUDIT_JSON_FIELD_CHARS} chars`
        );
      }
    };
    try {
      const serialized = JSON.stringify(value);
      if (serialized !== undefined) {
        assertWithinBounds(serialized);
      }
    } catch {
      throw new TypeError(`emitAuditEvent ${field} must be JSON-serializable`);
    }
  };
  const isEmitAuditValidationError = (error: unknown): boolean => {
    if (!(error instanceof TypeError)) return false;
    return normalizeOptionalString(error.message)?.startsWith('emitAuditEvent') === true;
  };

  const requireAuditField = (value: unknown, field: string, maxLength: number): string => {
    const normalized = normalizeOptionalString(value);
    if (!normalized) {
      throw new TypeError(`emitAuditEvent requires non-empty ${field}`);
    }
    return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
  };

  const normalizeActorType = (value: unknown): ActorType => {
    if (typeof value !== 'string') return 'USER';
    const normalized = value.trim().toUpperCase();
    return VALID_ACTOR_TYPES.has(normalized as ActorType) ? (normalized as ActorType) : 'USER';
  };

  req.emitAuditEvent = async (input) => {
    try {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('emitAuditEvent requires a non-null object payload');
      }
      const snapshotInput = {
        ...input,
        metadata: cloneAuditStateObject(input.metadata),
        before: cloneAuditStateObject(input.before),
        after: cloneAuditStateObject(input.after),
      };
      const normalizedAction = requireAuditField(snapshotInput.action, 'action', MAX_AUDIT_ACTION);
      const normalizedResourceType = requireAuditField(
        snapshotInput.resourceType,
        'resourceType',
        MAX_AUDIT_RESOURCE_TYPE
      );
      const normalizedResourceId = clampOptionalString(
        normalizeOptionalString(snapshotInput.resourceId),
        MAX_AUDIT_RESOURCE_ID
      );
      const normalizedMetadata = cloneAuditStateObject(snapshotInput.metadata);
      const normalizedBefore = cloneAuditStateObject(snapshotInput.before);
      const normalizedAfter = cloneAuditStateObject(snapshotInput.after);
      assertJsonSerializableAuditPayload('metadata', normalizedMetadata);
      assertJsonSerializableAuditPayload('before', normalizedBefore);
      assertJsonSerializableAuditPayload('after', normalizedAfter);

      const eventId = await auditEventsService.log({
        action: normalizedAction,
        resourceType: normalizedResourceType,
        resourceId: normalizedResourceId,
        metadata: normalizedMetadata,
        before: normalizedBefore,
        after: normalizedAfter,
        actorType: normalizeActorType(snapshotInput.actorType),
        actorId: clampOptionalString(
          normalizeOptionalString(safeRead(() => req.user?.id, undefined)) ||
            normalizeOptionalString(safeRead(() => req.userId, undefined)),
          MAX_AUDIT_ACTOR_ID
        ),
        organizationId: clampOptionalString(
          normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined)) ||
          normalizeOptionalString(
            safeRead(() => (req.user as { organization_id?: string } | undefined)?.organization_id, undefined)
          ) ||
          normalizeOptionalString(safeRead(() => req.organizationId, undefined)),
          MAX_AUDIT_ORGANIZATION_ID
        ),
        ip:
          clampOptionalString(
            normalizeOptionalString(safeRead(() => req.ip, undefined)) ||
              normalizeOptionalString(safeRead(() => req.socket?.remoteAddress, undefined)),
            MAX_AUDIT_IP
          ),
        userAgent: clampOptionalString(
          normalizeOptionalString(
            safeRead(() => {
              const getHeader = req.get;
              if (typeof getHeader !== 'function') return undefined;
              return getHeader.call(req, 'user-agent');
            }, undefined)
          ),
          MAX_AUDIT_USER_AGENT
        ),
      });
      if (typeof eventId !== 'string' || !eventId.trim()) {
        throw new TypeError('emitAuditEvent persistence returned an invalid event id');
      }
      return eventId.trim();
    } catch (err) {
      if (isEmitAuditValidationError(err)) {
        logger.warn('[requireAudit] emitAuditEvent validation rejected', err);
      } else {
        logger.error('[requireAudit] Audit write failed — fail-closed:', err);
      }
      throw err;
    }
  };
  next();
}
