/**
 * Alert Watchdog Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of alertWatchdog.js
 * Intercepts server errors and generates SYSTEM_ALERT notifications
 * for 500-level errors or explicit critical errors.
 *
 * Must be placed BEFORE the final error handler.
 */

import type { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';

// Dynamic import for NotificationService to avoid circular dependencies
let NotificationService: {
  create: (data: {
    userId: string;
    organizationId: string;
    projectId: string | null;
    type: string;
    severity: string;
    title: string;
    message: string;
    relatedObjectType: string;
    relatedObjectId: string | null;
    isActionable: boolean;
  }) => Promise<void>;
};

// Lazy load NotificationService
async function getNotificationService() {
  if (!NotificationService) {
    const module = await import('../services/notificationService.js');
    NotificationService = (module.default || module) as any;
  }
  return NotificationService;
}

/**
 * Safely extract error message from various error types
 */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || 'Unknown error';
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String(err.message) || 'Unknown error';
  }
  return 'Unknown error';
}

/**
 * Alert Watchdog Middleware
 * Intercepts server errors and generates SYSTEM_ALERT notifications
 */
const alertWatchdog = async (
  err: Error & { statusCode?: number; status?: number },
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Determine status code (default to 500 if not specified)
    const statusCode = err.statusCode || err.status || 500;
    
    // Safely extract error message
    const errorMessage = getErrorMessage(err);
    const errorName = err instanceof Error ? err.name : 'Error';

    // Only alert on 500-level errors (server errors), ignore 4xx (client errors)
    if (statusCode >= 500) {
      logger.error('[AlertWatchdog] Detected Server Error:', {
        message: errorMessage,
        name: errorName,
        statusCode,
        path: req.path,
        method: req.method,
      });

      // Avoid alerting for expected "operational" errors if marked so (optional pattern)
      // if (err.isOperational) return next(err);

      const location = `${req.method} ${req.originalUrl}`;
      const message = `Server Error at ${location}: ${errorMessage}`;
      const title = `Server Error: ${errorMessage.substring(0, 50)}`;

      // Fire and forget notification
      getNotificationService()
        .then((service) => {
          return service.create({
            userId: 'system', // System-created
            organizationId: 'system',
            projectId: null,
            type: 'SYSTEM_ALERT',
            severity: 'CRITICAL',
            title: title,
            message: message.substring(0, 500), // Truncate for DB
            relatedObjectType: 'ERROR',
            relatedObjectId: null,
            isActionable: false,
          });
        })
        .catch((noteErr) => {
          logger.error('[AlertWatchdog] Failed to create notification:', noteErr);
        });
    }
  } catch (watchdogErr) {
    // Safety net: ensure watchdog failure doesn't crash the request or hide the original error
    logger.error('[AlertWatchdog] Internal Error:', watchdogErr);
  }

  // Always pass to the next error handler (which sends the response)
  next(err);
};

export default alertWatchdog;
