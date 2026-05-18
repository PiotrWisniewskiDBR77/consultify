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
  if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
    return next();
  }

  // Capture original end function
  const originalEnd = res.end.bind(res);

  // Override end to capture status
  (res.end as any) = function (chunk?: any, encodingOrCb?: any, cb?: any) {
    res.end = originalEnd;
    res.end(chunk, encodingOrCb, cb);

    // Only log successful operations (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        // Extract User Info
        const user = req.user;
        const userId = user ? user.id : null;
        const organizationId =
          (req as any).organizationId ||
          user?.organizationId ||
          user?.organization_id ||
          (req.body as any)?.organizationId ||
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

        // Determine Entity & Action
        // URL: /api/projects/:id -> Entity: project, ID: :id
        const parts = req.originalUrl.split('/').filter((p) => p);
        const entityType = parts[1] || 'unknown'; // api / [entity]
        const entityId = parts[2] || (req.body as { id?: string })?.id || 'new';

        const actionMap: Record<string, string> = {
          POST: 'created',
          PUT: 'updated',
          PATCH: 'updated',
          DELETE: 'deleted',
        };
        const action = actionMap[req.method] || 'modified';

        // Log asynchronously (ActivityService + V4 audit_events)
        const auditActionMap: Record<string, string> = {
          created: 'create',
          updated: 'update',
          modified: 'update',
          deleted: 'delete',
        };
        const auditAction = auditActionMap[action] || action;
        const resourceType = entityType.replace(/s$/, ''); // singularize roughly
        const entityName =
          (req.body as { name?: string; title?: string })?.name ||
          (req.body as { name?: string; title?: string })?.title ||
          entityType;
        const correlationId =
          (req as AuthRequest & { correlationId?: string }).correlationId ||
          req.get('X-Correlation-ID') ||
          undefined;
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
              entityType: resourceType,
              entityId,
              entityName,
              newValue: req.method !== 'DELETE' && req.body ? req.body : null,
              ipAddress: req.ip,
              userAgent: req.get('user-agent') || undefined,
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
              resourceType,
              resourceId: entityId,
              after:
                req.method !== 'DELETE' && req.body
                  ? (req.body as Record<string, unknown>)
                  : undefined,
              organizationId,
              ip: req.ip,
              userAgent: req.get('user-agent') || undefined,
              metadata: {
                correlationId,
                databaseHost,
                databaseSource: resolvedDb.source,
                demoEnabled: Boolean((req as any).demo?.enabled),
                demoOrganizationId: (req as any).demo?.organizationId || null,
                method: req.method,
                path: req.originalUrl,
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
              actorEmail: user?.email,
              actorName: user?.name,
              actorIp: req.ip,
              actorUserAgent: req.get('user-agent') || undefined,
              action: `data.${auditAction}`,
              actionCategory: 'data',
              resourceType,
              resourceId: entityId,
              organizationId,
              newValues:
                req.method !== 'DELETE' && req.body
                  ? (req.body as Record<string, unknown>)
                  : undefined,
              metadata: {
                correlationId,
                databaseHost,
                databaseSource: resolvedDb.source,
                databaseReason: resolvedDb.reason || null,
                demoEnabled: Boolean((req as any).demo?.enabled),
                demoOrganizationId: (req as any).demo?.organizationId || null,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
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
