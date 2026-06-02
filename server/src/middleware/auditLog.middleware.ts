// @ts-nocheck
/**
 * Audit Log Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of auditLog.js
 * Automatically logs successful state-changing requests (POST, PUT, PATCH, DELETE)
 */

import type { NextFunction, Response } from 'express';

import { resolveReachableDatabaseUrl } from '../config/databaseTargetResolver.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

const REDACTED_VALUE = '[REDACTED]';
const TRUNCATED_SUFFIX = '...[truncated]';
const MAX_SHORT_FIELD_LENGTH = 128;
const MAX_MEDIUM_FIELD_LENGTH = 256;
const MAX_LONG_FIELD_LENGTH = 512;
const MAX_PATH_LENGTH = 2048;
const MAX_TEXT_LEAF_LENGTH = 4096;
const MAX_OBJECT_KEYS = 250;
const MAX_ARRAY_ITEMS = 500;
const SENSITIVE_KEY_RE =
  /(pass(word)?|token|secret|api[_-]?key|cookie|session(id)?|otp|authorization)/i;
const AUDIT_WRAPPED_MARKER = Symbol.for('consultify.auditLog.endWrapped');
const AUDIT_COMPLETED_MARKER = Symbol.for('consultify.auditLog.completed');

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    const value = reader();
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
};

const toErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const truncateWithSuffix = (value: unknown, maxLength: number): string => {
  const input = typeof value === 'string' ? value : String(value ?? '');
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const head = normalized.slice(0, Math.max(0, maxLength - TRUNCATED_SUFFIX.length));
  return `${head}${TRUNCATED_SUFFIX}`;
};

const stripQueryAndHash = (urlLike: string): string => {
  const withoutQuery = urlLike.split('?')[0] ?? '';
  return withoutQuery.split('#')[0] ?? '';
};

const sanitizeIp = (value: unknown): string | undefined => {
  const ip = truncateWithSuffix(value, MAX_MEDIUM_FIELD_LENGTH);
  return ip.length > 0 ? ip : undefined;
};

const sanitizeUserAgent = (value: unknown): string | undefined => {
  const ua = truncateWithSuffix(value, MAX_LONG_FIELD_LENGTH);
  return ua.length > 0 ? ua : undefined;
};

const sanitizeCorrelationId = (value: unknown): string | undefined => {
  const id = truncateWithSuffix(value, MAX_SHORT_FIELD_LENGTH);
  return id.length > 0 ? id : undefined;
};

const sanitizeEntityId = (value: unknown): string =>
  truncateWithSuffix(
    typeof value === 'string' ? value : String(value ?? ''),
    MAX_MEDIUM_FIELD_LENGTH
  );

const sanitizeEntityType = (value: unknown): string =>
  truncateWithSuffix(
    typeof value === 'string' ? value : String(value ?? ''),
    MAX_SHORT_FIELD_LENGTH
  );

const sanitizeEntityName = (value: unknown): string =>
  truncateWithSuffix(
    typeof value === 'string' ? value : String(value ?? ''),
    MAX_LONG_FIELD_LENGTH
  );

const sanitizePath = (value: unknown): string => {
  const raw = typeof value === 'string' ? value : '';
  return truncateWithSuffix(stripQueryAndHash(raw), MAX_PATH_LENGTH);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  return !Array.isArray(value) && !Buffer.isBuffer(value);
};

const sanitizeAuditValue = (
  value: unknown,
  keyHint?: string,
  visited: WeakSet<object> = new WeakSet()
): unknown => {
  const key = typeof keyHint === 'string' ? keyHint : '';
  if (key && SENSITIVE_KEY_RE.test(key)) return REDACTED_VALUE;

  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncateWithSuffix(value, MAX_TEXT_LEAF_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'symbol') return String(value);
  if (typeof value === 'function') return '[Function]';

  if (Buffer.isBuffer(value)) {
    return {
      _auditBodyOmitted: 'buffer',
      byteLength: value.byteLength,
    };
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) {
      return {
        _auditArrayTruncated: true,
        originalLength: value.length,
        head: value
          .slice(0, MAX_ARRAY_ITEMS)
          .map((entry) => sanitizeAuditValue(entry, undefined, visited)),
      };
    }
    return value.map((entry) => sanitizeAuditValue(entry, undefined, visited));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (visited.has(obj)) return '[Circular]';
    visited.add(obj);

    const keys = Reflect.ownKeys(obj).filter((k): k is string => typeof k === 'string');

    const target = Object.create(null) as Record<string, unknown>;
    const selectedKeys = keys.slice(0, MAX_OBJECT_KEYS);
    for (const keyName of selectedKeys) {
      let propValue: unknown;
      try {
        propValue = obj[keyName];
      } catch {
        propValue = REDACTED_VALUE;
      }
      target[keyName] = sanitizeAuditValue(propValue, keyName, visited);
    }

    if (keys.length > MAX_OBJECT_KEYS) {
      target._auditKeysTruncated = true;
      target.originalKeyCount = keys.length;
    }
    return target;
  }

  return String(value);
};

// Dynamic import to avoid circular dependencies
let ActivityService: {
  log: (data: {
    organizationId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    entityName: string;
    newValue: unknown;
    ipAddress?: string;
    userAgent?: string;
  }) => Promise<void>;
};

let AuditEventsService: { log: (input: any) => Promise<string> };
let AuditService: {
  log: (input: {
    actorType: 'user';
    actorId?: string;
    actorEmail?: string;
    actorName?: string;
    actorIp?: string;
    actorUserAgent?: string;
    action: string;
    actionCategory: 'data';
    resourceType: string;
    resourceId?: string;
    organizationId?: string;
    newValues?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    requestId?: string;
    result?: 'success';
  }) => Promise<string>;
};

async function getActivityService() {
  if (!ActivityService) {
    const module = await import('../services/ActivityService.js');
    ActivityService = module.default || module;
  }
  return ActivityService;
}

async function getAuditEventsService() {
  if (!AuditEventsService) {
    const module = await import('../services/AuditEventsService.js');
    AuditEventsService = module.default || module;
  }
  return AuditEventsService;
}

async function getAuditService() {
  if (!AuditService) {
    const module = await import('../services/auditService.js');
    AuditService = module.default || module;
  }
  return AuditService;
}

/**
 * Audit Log Middleware
 * Automatically logs successful state-changing requests
 */
const auditLogMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const methodRaw = safeRead(() => req.method, '');
  const method = typeof methodRaw === 'string' ? methodRaw.toUpperCase() : '';
  // Only log state changes
  if (!method || ['GET', 'OPTIONS', 'HEAD'].includes(method)) {
    return next();
  }

  if ((res as any)[AUDIT_WRAPPED_MARKER]) {
    next();
    return;
  }

  // Capture original end function
  const rawEnd = safeRead(() => res.end, null);
  if (typeof rawEnd !== 'function') {
    next();
    return;
  }
  let originalEnd: (...args: unknown[]) => unknown;
  try {
    originalEnd = rawEnd.bind(res);
  } catch {
    next();
    return;
  }

  try {
    Object.defineProperty(res, AUDIT_WRAPPED_MARKER, {
      value: true,
      enumerable: false,
      configurable: true,
    });
  } catch {
    next();
    return;
  }

  const originalUrl = sanitizePath(safeRead(() => req.originalUrl, ''));
  const pathParts = originalUrl.split('/').filter((p) => p);
  const bodySnapshot = safeRead(() => req.body, undefined);
  const bodyForLogs = sanitizeAuditValue(bodySnapshot);
  const userSnapshot = safeRead(() => req.user, undefined) as
    | {
        id?: string;
        organizationId?: string;
        organization_id?: string;
        email?: string;
        name?: string;
      }
    | undefined;
  const userId = safeRead(() => (typeof userSnapshot?.id === 'string' ? userSnapshot.id : ''), '');
  const organizationId = truncateWithSuffix(
    safeRead(() => (req as any).organizationId, '') ||
      safeRead(() => userSnapshot?.organizationId, '') ||
      safeRead(() => userSnapshot?.organization_id, '') ||
      safeRead(() => (isPlainObject(bodySnapshot) ? (bodySnapshot as any).organizationId : ''), ''),
    MAX_MEDIUM_FIELD_LENGTH
  );
  const resourceType = sanitizeEntityType(
    (pathParts[1] || 'unknown').replace(/s$/, '') || 'unknown'
  );
  const entityId = sanitizeEntityId(
    pathParts[2] ||
      (isPlainObject(bodySnapshot) ? (bodySnapshot as { id?: unknown }).id : '') ||
      'new'
  );
  const entityName = sanitizeEntityName(
    (isPlainObject(bodySnapshot)
      ? ((bodySnapshot as { name?: unknown; title?: unknown }).name ??
        (bodySnapshot as { name?: unknown; title?: unknown }).title)
      : undefined) || resourceType
  );
  const actionMap: Record<string, string> = {
    POST: 'created',
    PUT: 'updated',
    PATCH: 'updated',
    DELETE: 'deleted',
  };
  const action = actionMap[method] || 'modified';
  const auditActionMap: Record<string, string> = {
    created: 'create',
    updated: 'update',
    modified: 'update',
    deleted: 'delete',
  };
  const auditAction = auditActionMap[action] || action;
  const correlationId = sanitizeCorrelationId(
    safeRead(() => (req as AuthRequest & { correlationId?: string }).correlationId, '') ||
      safeRead(() => req.get('X-Correlation-ID'), '')
  );
  const userAgent = sanitizeUserAgent(safeRead(() => req.get('user-agent'), ''));
  const ipAddress = sanitizeIp(safeRead(() => req.ip, ''));
  const demoSnapshot = safeRead(() => (req as any).demo, undefined);
  const demoEnabled = Boolean(safeRead(() => demoSnapshot?.enabled, false));
  const demoOrganizationId = truncateWithSuffix(
    safeRead(() => demoSnapshot?.organizationId, '') || '',
    MAX_MEDIUM_FIELD_LENGTH
  );

  const resolvedDb = (() => {
    try {
      return resolveReachableDatabaseUrl({
        databaseUrl: process.env.DATABASE_URL,
        publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
        env: process.env,
      });
    } catch {
      return {
        databaseUrl: undefined,
        source: 'unavailable',
        reason: 'resolver_error',
      };
    }
  })();
  const databaseHost = resolvedDb.databaseUrl
    ? (() => {
        try {
          return new URL(resolvedDb.databaseUrl).hostname;
        } catch {
          return null;
        }
      })()
    : null;

  // Override end to capture status
  (res.end as any) = function (chunk?: any, encodingOrCb?: any, cb?: any) {
    const endResult = originalEnd(chunk, encodingOrCb, cb);
    if ((res as any)[AUDIT_COMPLETED_MARKER]) {
      return endResult;
    }
    Object.defineProperty(res, AUDIT_COMPLETED_MARKER, {
      value: true,
      enumerable: false,
      configurable: true,
    });

    // Only log successful operations (2xx)
    const statusCode = safeRead(() => res.statusCode, 0);
    if (typeof statusCode === 'number' && statusCode >= 200 && statusCode < 300) {
      try {
        // Skip audit log if we don't have a valid user context
        // (avoids FK violation on activity_logs.organization_id)
        if (!organizationId || !userId) {
          return endResult;
        }

        // Skip when org unknown – Postgres FK requires organization_id to exist in organizations
        if (!organizationId || organizationId === 'unknown') {
          return endResult;
        }

        getActivityService()
          .then((service) => {
            return service.log({
              organizationId,
              userId,
              action,
              entityType: resourceType,
              entityId,
              entityName,
              newValue: method !== 'DELETE' ? bodyForLogs : null,
              ipAddress,
              userAgent,
            });
          })
          .catch((err: unknown) => logger.error('[AuditLog] Failed to log:', toErrorMessage(err)));
        // V4-ENT-03: dual-write to audit_events
        getAuditEventsService()
          .then((svc) =>
            svc.log({
              actorId: userId,
              actorType: 'USER',
              action: auditAction,
              resourceType,
              resourceId: entityId,
              after: method !== 'DELETE' ? (bodyForLogs as Record<string, unknown>) : undefined,
              organizationId,
              ip: ipAddress,
              userAgent,
              metadata: {
                correlationId,
                databaseHost,
                databaseSource: resolvedDb.source,
                demoEnabled,
                demoOrganizationId: demoOrganizationId || null,
                method,
                path: originalUrl,
              },
            })
          )
          .catch((err: unknown) =>
            logger.error('[AuditLog] Failed audit_events log:', toErrorMessage(err))
          );
        getAuditService()
          .then((svc) =>
            svc.log({
              actorType: 'user',
              actorId: userId,
              actorEmail: safeRead(
                () => truncateWithSuffix(userSnapshot?.email, MAX_LONG_FIELD_LENGTH),
                undefined as string | undefined
              ),
              actorName: safeRead(
                () => truncateWithSuffix(userSnapshot?.name, MAX_LONG_FIELD_LENGTH),
                undefined as string | undefined
              ),
              actorIp: ipAddress,
              actorUserAgent: userAgent,
              action: `data.${auditAction}`,
              actionCategory: 'data',
              resourceType,
              resourceId: entityId,
              organizationId,
              newValues: method !== 'DELETE' ? (bodyForLogs as Record<string, unknown>) : undefined,
              metadata: {
                correlationId,
                databaseHost,
                databaseSource: resolvedDb.source,
                databaseReason: resolvedDb.reason || null,
                demoEnabled,
                demoOrganizationId: demoOrganizationId || null,
                method,
                path: originalUrl,
                statusCode,
              },
              requestId: correlationId,
              result: 'success',
            })
          )
          .catch((err: unknown) =>
            logger.error('[AuditLog] Failed audit_log write:', toErrorMessage(err))
          );
      } catch (err: unknown) {
        logger.error('[AuditLog] Error processing log:', err);
      }
    }

    return endResult;
  };

  next();
};

export default auditLogMiddleware;
