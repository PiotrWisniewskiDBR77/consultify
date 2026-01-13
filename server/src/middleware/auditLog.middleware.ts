// @ts-nocheck
/**
 * Audit Log Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of auditLog.js
 * Automatically logs successful state-changing requests (POST, PUT, PATCH, DELETE)
 */

import type { NextFunction, Response } from 'express';

import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// Dynamic import for ActivityService to avoid circular dependencies
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

// Lazy load ActivityService
async function getActivityService() {
  if (!ActivityService) {
    const module = await import('../services/ActivityService.js');
    ActivityService = module.default || module;
  }
  return ActivityService;
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
        const userId = user ? user.id : 'anonymous';
        const organizationId = user
          ? user.organizationId
          : (req.body as any)?.organizationId || 'unknown';

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

        // Log asynchronously
        getActivityService()
          .then((service) => {
            return service.log({
              organizationId,
              userId,
              action,
              entityType: entityType.replace(/s$/, ''), // singularize roughly
              entityId,
              entityName:
                (req.body as { name?: string; title?: string })?.name ||
                (req.body as { name?: string; title?: string })?.title ||
                entityType,
              newValue: req.method !== 'DELETE' && req.body ? req.body : null,
              ipAddress: req.ip,
              userAgent: req.get('user-agent') || undefined,
            });
          })
          .catch((err: Error | null) =>
            logger.error('[AuditLog] Failed to log:', (err as Error).message)
          );
      } catch (err: any) {
        logger.error('[AuditLog] Error processing log:', err);
      }
    }
  };

  next();
};

export default auditLogMiddleware;
