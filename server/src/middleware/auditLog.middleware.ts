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

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function readMethod(req: AuthRequest): string {
  const method = normalizeOptionalString(safeRead(() => req.method, undefined)) || '';
  return method.toUpperCase();
}

function readPath(req: AuthRequest): string {
  return (
    normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
    normalizeOptionalString(safeRead(() => req.path, undefined)) ||
    ''
  );
}

const MAX_AUDIT_PATH_CHARS = 2048;
const MAX_AUDIT_CORRELATION_ID_CHARS = 128;
const MAX_AUDIT_USER_AGENT_CHARS = 512;
const MAX_AUDIT_ENTITY_ID_CHARS = 256;
const MAX_AUDIT_ENTITY_NAME_CHARS = 512;
const MAX_AUDIT_RESOURCE_TYPE_CHARS = 128;
const MAX_AUDIT_IP_CHARS = 256;
const AUDIT_LOG_END_PATCHED = Symbol.for('consultify.auditLog.endPatched');
const AUDIT_REDACT_KEYS = new Set([
  'password',
  'passwordconfirm',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'set-cookie',
  'session',
  'sessionid',
  'sessionsignature',
  'csrftoken',
  'csrf',
  'xsrf',
  'otp',
  'mfa',
  'totpsecret',
  'recoverycode',
  'recoverycodes',
  'clientsecret',
  'client_secret',
  'privatekey',
  'private_key',
]);
const MAX_AUDIT_BODY_REDACTION_DEPTH = 6;
const MAX_AUDIT_BODY_ARRAY_ITEMS = 500;
const isPlainObjectRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

function truncateAuditText(value: string): string {
  if (value.length <= MAX_AUDIT_PATH_CHARS) return value;
  return `${value.slice(0, MAX_AUDIT_PATH_CHARS)}...[truncated]`;
}

function truncateOptionalAuditString(value: string | undefined, maxChars: number): string | undefined {
  if (!value) return undefined;
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...[truncated]`;
}

function redactAuditBody(
  body: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!body) return undefined;
  const visit = (value: unknown, depth: number): unknown => {
    if (depth > MAX_AUDIT_BODY_REDACTION_DEPTH) return value;
    if (Array.isArray(value)) {
      if (value.length <= MAX_AUDIT_BODY_ARRAY_ITEMS) {
        return value.map((item) => visit(item, depth + 1));
      }
      return {
        _auditArrayTruncated: true,
        originalLength: value.length,
        head: value.slice(0, MAX_AUDIT_BODY_ARRAY_ITEMS).map((item) => visit(item, depth + 1)),
      };
    }
    if (!isPlainObjectRecord(value)) return value;
    const redactedNode: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (AUDIT_REDACT_KEYS.has(key.toLowerCase())) {
        redactedNode[key] = '[REDACTED]';
      } else {
        redactedNode[key] = visit(value[key], depth + 1);
      }
    }
    return redactedNode;
  };
  try {
    return visit(body, 0) as Record<string, unknown>;
  } catch {
    return { _auditBodySnapshotFailed: true };
  }
}

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
  // Only log state changes
  if (['GET', 'OPTIONS', 'HEAD'].includes(readMethod(req))) {
    return next();
  }

  if (safeRead(() => Boolean((res as Response & { [AUDIT_LOG_END_PATCHED]?: boolean })[AUDIT_LOG_END_PATCHED]), false)) {
    next();
    return;
  }
  // Capture original end function
  const originalEnd = safeRead(() => res.end.bind(res), null as unknown as Response['end']);
  if (!originalEnd) {
    next();
    return;
  }
  safeRead(() => {
    Object.defineProperty(res, AUDIT_LOG_END_PATCHED, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return true;
  }, false);

  // Override end to capture status
  (res.end as any) = function (chunk?: any, encodingOrCb?: any, cb?: any) {
    res.end = originalEnd;
    res.end(chunk, encodingOrCb, cb);

    const statusCode = safeRead(() => res.statusCode, 200);
    // Only log successful operations (2xx)
    if (statusCode >= 200 && statusCode < 300) {
      try {
        // Extract User Info
        const user = safeRead(() => req.user, undefined as unknown as AuthRequest['user']);
        const userId =
          normalizeOptionalString(safeRead(() => user?.id, undefined)) ||
          normalizeOptionalString(safeRead(() => req.userId, undefined)) ||
          null;
        const organizationId =
          normalizeOptionalString(safeRead(() => (req as any).organizationId, undefined)) ||
          normalizeOptionalString(safeRead(() => user?.organizationId, undefined)) ||
          normalizeOptionalString(
            safeRead(() => (user as { organization_id?: string } | undefined)?.organization_id, undefined)
          ) ||
          normalizeOptionalString(safeRead(() => (req.body as any)?.organizationId, undefined)) ||
          null;

        // Skip audit log if we don't have a valid user context
        // (avoids FK violation on activity_logs.organization_id)
        if (!organizationId || !userId) {
          return;
        }

        // Skip when org unknown – Postgres FK requires organization_id to exist in organizations
        if (!organizationId || organizationId === 'unknown') {
          return;
        }
        const httpMethod = readMethod(req);
        const auditPath = truncateAuditText(readPath(req));
        const bodySnapshot =
          httpMethod !== 'DELETE' ? safeRead(() => req.body, null) : null;
        const bodyRecord =
          bodySnapshot && typeof bodySnapshot === 'object'
            ? (bodySnapshot as Record<string, unknown>)
            : undefined;
        const auditBody = redactAuditBody(bodyRecord);

        // Determine Entity & Action
        // URL: /api/projects/:id -> Entity: project, ID: :id
        const parts = auditPath.split('/').filter((p) => p);
        const entityType = parts[1] || 'unknown'; // api / [entity]
        const entityId =
          parts[2] ||
          normalizeOptionalString(safeRead(() => bodyRecord?.id, undefined)) ||
          'new';

        const actionMap: Record<string, string> = {
          POST: 'created',
          PUT: 'updated',
          PATCH: 'updated',
          DELETE: 'deleted',
        };
        const action = actionMap[httpMethod] || 'modified';

        // Log asynchronously (ActivityService + V4 audit_events)
        const auditActionMap: Record<string, string> = {
          created: 'create',
          updated: 'update',
          modified: 'update',
          deleted: 'delete',
        };
        const auditAction = auditActionMap[action] || action;
        const resourceType = entityType.replace(/s$/, ''); // singularize roughly
        const entityNameRaw =
          normalizeOptionalString(safeRead(() => bodyRecord?.name, undefined)) ||
          normalizeOptionalString(safeRead(() => bodyRecord?.title, undefined)) ||
          entityType;
        const boundedEntityId = truncateOptionalAuditString(entityId, MAX_AUDIT_ENTITY_ID_CHARS) || entityId;
        const boundedResourceType =
          truncateOptionalAuditString(resourceType, MAX_AUDIT_RESOURCE_TYPE_CHARS) || resourceType;
        const boundedEntityName =
          truncateOptionalAuditString(entityNameRaw, MAX_AUDIT_ENTITY_NAME_CHARS) || entityNameRaw;
        const correlationId =
          truncateOptionalAuditString(
            normalizeOptionalString(
              safeRead(() => (req as AuthRequest & { correlationId?: string }).correlationId, undefined)
            ) ||
              normalizeOptionalString(safeRead(() => req.get?.('X-Correlation-ID'), undefined)) ||
              undefined,
            MAX_AUDIT_CORRELATION_ID_CHARS
          ) || undefined;
        const userAgent = truncateOptionalAuditString(
          normalizeOptionalString(safeRead(() => req.get?.('user-agent'), undefined)),
          MAX_AUDIT_USER_AGENT_CHARS
        );
        const actorIp = truncateOptionalAuditString(
          normalizeOptionalString(safeRead(() => req.ip, undefined)),
          MAX_AUDIT_IP_CHARS
        );
        const resolvedDb = resolveReachableDatabaseUrl({
          databaseUrl: process.env.DATABASE_URL,
          publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
          env: process.env,
        });
        const databaseHost = resolvedDb.databaseUrl
          ? (() => {
              try {
                return new URL(resolvedDb.databaseUrl).hostname;
              } catch {
                return null;
              }
            })()
          : null;
        getActivityService()
          .then((service) => {
            return service.log({
              organizationId,
              userId,
              action,
              entityType: boundedResourceType,
              entityId: boundedEntityId,
              entityName: boundedEntityName,
              newValue: auditBody || null,
              ipAddress: actorIp,
              userAgent,
            });
          })
          .catch((err: Error | null) =>
            logger.error('[AuditLog] Failed to log:', (err as Error).message)
          );
        // V4-ENT-03: dual-write to audit_events
        getAuditEventsService()
          .then((svc) =>
            svc.log({
              actorId: userId,
              actorType: 'USER',
              action: auditAction,
              resourceType: boundedResourceType,
              resourceId: boundedEntityId,
              after: auditBody,
              organizationId,
              ip: actorIp,
              userAgent,
              metadata: {
                correlationId,
                databaseHost,
                databaseSource: resolvedDb.source,
                demoEnabled: Boolean((req as any).demo?.enabled),
                demoOrganizationId: (req as any).demo?.organizationId || null,
                method: httpMethod,
                path: auditPath,
              },
            })
          )
          .catch((err: Error | null) =>
            logger.error('[AuditLog] Failed audit_events log:', (err as Error).message)
          );
        getAuditService()
          .then((svc) =>
            svc.log({
              actorType: 'user',
              actorId: userId,
              actorEmail: normalizeOptionalString(safeRead(() => user?.email, undefined)),
              actorName: normalizeOptionalString(safeRead(() => user?.name, undefined)),
              actorIp,
              actorUserAgent: userAgent,
              action: `data.${auditAction}`,
              actionCategory: 'data',
              resourceType: boundedResourceType,
              resourceId: boundedEntityId,
              organizationId,
              newValues: auditBody,
              metadata: {
                correlationId,
                databaseHost,
                databaseSource: resolvedDb.source,
                databaseReason: resolvedDb.reason || null,
                demoEnabled: Boolean((req as any).demo?.enabled),
                demoOrganizationId: (req as any).demo?.organizationId || null,
                method: httpMethod,
                path: auditPath,
                statusCode,
              },
              requestId: correlationId,
              result: 'success',
            })
          )
          .catch((err: Error | null) =>
            logger.error('[AuditLog] Failed audit_log write:', (err as Error).message)
          );
      } catch (err: any) {
        logger.error('[AuditLog] Error processing log:', err);
      }
    }
  };

  next();
};

export default auditLogMiddleware;
