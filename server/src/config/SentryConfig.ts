/**
 * Sentry Configuration
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * This module initializes Sentry error monitoring for the Express server.
 * Import this at the very top of server/index.js, before other imports.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import logger from '../utils/Logger.js';

// NOTE:
// Do NOT import @sentry/node at module scope.
// In some dev environments/package states, the @sentry/node ESM build can be partially missing files,
// which would crash the entire backend at startup even when Sentry is disabled.
// We therefore load Sentry lazily (only when enabled) and always fail-open.
let Sentry: any | null = null;
let sentryExpressIntegration: any | null = null;
let sentryHttpIntegration: any | null = null;
let sentryNodeProfilingIntegration: (() => unknown) | null = null;

// ==========================================
// ZOD SCHEMAS
// ==========================================

const SentryConfigSchema = z.object({
  dsn: z.string().url().optional(),
  environment: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  release: z.string().optional(),
  tracesSampleRate: z.number().min(0).max(1).default(0.1),
  profilesSampleRate: z.number().min(0).max(1).default(0.1),
});

export type SentryConfig = z.infer<typeof SentryConfigSchema>;

// ==========================================
// CONFIGURATION
// ==========================================

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const isEnabled = (isProduction || isStaging) && !!process.env.SENTRY_DSN;

async function ensureSentryLoaded(): Promise<boolean> {
  if (Sentry) return true;
  try {
    const sentryNode = await import('@sentry/node');
    Sentry = (sentryNode as any).default || sentryNode;
    sentryExpressIntegration = (sentryNode as any).expressIntegration || null;
    sentryHttpIntegration = (sentryNode as any).httpIntegration || null;

    // Profiling integration is optional
    try {
      const profiling = await import('@sentry/profiling-node');
      sentryNodeProfilingIntegration =
        (profiling as any).nodeProfilingIntegration || (profiling as any).default || null;
    } catch {
      sentryNodeProfilingIntegration = null;
    }

    return true;
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.warn('[Sentry] Failed to load @sentry/node; continuing without Sentry', {
      error: e.message,
    });
    Sentry = null;
    sentryExpressIntegration = null;
    sentryHttpIntegration = null;
    sentryNodeProfilingIntegration = null;
    return false;
  }
}

// ==========================================
// TYPES
// ==========================================

export interface SentryHandlers {
  requestHandler: (req: Request, res: Response, next: NextFunction) => void;
  tracingHandler: (req: Request, res: Response, next: NextFunction) => void;
  errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
}

export interface User {
  id?: string;
  email?: string;
  role?: string;
  organizationId?: string;
}

export interface Context {
  user?: User;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize Sentry
 */
export async function initSentry(app: Express): Promise<SentryHandlers> {
  if (!isEnabled) {
    logger.info('[Sentry] Disabled (no SENTRY_DSN or not in production/staging)');
    return {
      requestHandler: (_req: Request, _res: Response, next: NextFunction) => next(),
      tracingHandler: (_req: Request, _res: Response, next: NextFunction) => next(),
      errorHandler: (err: Error, _req: Request, _res: Response, next: NextFunction) => next(err),
    };
  }

  const loaded = await ensureSentryLoaded();
  if (!loaded || !Sentry) {
    // Fail-open: never crash the server because observability is misconfigured/broken.
    logger.warn('[Sentry] Disabled (failed to load @sentry/node)');
    return {
      requestHandler: (_req: Request, _res: Response, next: NextFunction) => next(),
      tracingHandler: (_req: Request, _res: Response, next: NextFunction) => next(),
      errorHandler: (err: Error, _req: Request, _res: Response, next: NextFunction) => next(err),
    };
  }

  const sentryConfig: SentryConfig = {
    dsn: process.env.SENTRY_DSN,
    environment: (process.env.NODE_ENV || 'development') as
      | 'development'
      | 'production'
      | 'test'
      | 'staging',
    release: process.env.npm_package_version || '1.0.0',
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: isProduction ? 0.1 : 1.0,
  };

  // Validate config
  const validatedConfig = SentryConfigSchema.parse(sentryConfig);

  const integrations = [
    // Express integration for request tracing
    sentryExpressIntegration ? sentryExpressIntegration({ app }) : null,
    // HTTP integration for tracing outgoing requests
    sentryHttpIntegration ? sentryHttpIntegration({ tracing: true }) : null,
    // Profiling (optional, requires @sentry/profiling-node)
    sentryNodeProfilingIntegration ? sentryNodeProfilingIntegration() : null,
  ].filter(Boolean);

  Sentry.init({
    dsn: validatedConfig.dsn,
    environment: validatedConfig.environment,
    release: validatedConfig.release,

    // Integrations
    integrations: integrations as any,

    // Performance Monitoring
    tracesSampleRate: validatedConfig.tracesSampleRate,
    profilesSampleRate: validatedConfig.profilesSampleRate,

    // Filter sensitive data
    beforeSend(event: any) {
      // Remove sensitive headers
      const request = event.request;
      if (request?.headers) {
        delete request.headers['authorization'];
        delete request.headers['cookie'];
        delete request.headers['x-access-token'];
      }

      // Remove sensitive data from request body
      if (request?.data) {
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'mfaToken', 'backupCode'];
        sensitiveFields.forEach((field) => {
          if (typeof request.data === 'object' && request.data && field in request.data) {
            (request.data as Record<string, unknown>)[field] = '[REDACTED]';
          }
        });
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Network errors
      'Network request failed',
      'Failed to fetch',
      // Common client errors
      'ResizeObserver loop limit exceeded',
      'Non-Error exception captured',
    ],
  });

  logger.info(`[Sentry] Initialized for ${validatedConfig.environment} environment`);

  // Sentry v10 - expressIntegration automatically handles request/tracing
  // We need to manually add request handler for user context
  // Error handler is separate
  return {
    // Request handler - setupExpressErrorHandler configures the integration
    // But we still need middleware for user context extraction
    requestHandler: (req: Request, res: Response, next: NextFunction) => {
      // Extract user context if available
      if ((req as any).user) {
        Sentry.setUser({
          id: (req as any).user.id,
          email: (req as any).user.email,
          role: (req as any).user.role,
        });
      }
      next();
    },

    // Tracing handler - expressIntegration handles this automatically
    tracingHandler: (_req: Request, _res: Response, next: NextFunction) => next(),

    // Error handler - must be after routes and before other error handlers
    // Sentry v10: use setupExpressErrorHandler or custom middleware
    errorHandler: (
      err: Error & { status?: number; statusCode?: number },
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      // Ensure error has a message for Sentry
      if (err instanceof Error && !err.message) {
        err.message = err.name || 'Unknown error';
      }

      // Determine status code
      const statusCode = err.statusCode || err.status || 500;

      // Only report 500+ errors automatically
      if (statusCode >= 500) {
        Sentry.captureException(err, {
          tags: {
            path: req.path,
            method: req.method,
            statusCode: String(statusCode),
          },
          extra: {
            userId: (req as any).user?.id,
            query: req.query,
            body: req.body,
          },
        });
      } else if (statusCode === 429) {
        // Also report 429 (rate limit) errors
        Sentry.captureException(err, {
          tags: {
            path: req.path,
            method: req.method,
            statusCode: '429',
          },
        });
      }
      // Always call next to pass error to Express error handling
      next(err);
    },
  };
}

/**
 * Capture exception manually
 */
export function captureException(error: Error, context: Context = {}): void {
  if (!isEnabled || !Sentry) {
    logger.error('[Error]', error, context);
    return;
  }

  Sentry.withScope((scope: any) => {
    if (context.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
        role: context.user.role,
      });
    }
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture message manually
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context: Context = {}
): void {
  if (!isEnabled || !Sentry) {
    logger.info(`[${level.toUpperCase()}]`, message, context);
    return;
  }

  Sentry.withScope((scope: any) => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Record<string, unknown>): void {
  if (!isEnabled || !Sentry) return;

  Sentry.addBreadcrumb({
    timestamp: Date.now() / 1000,
    ...breadcrumb,
  });
}

/**
 * Set user context
 */
export function setUser(user: User): void {
  if (!isEnabled || !Sentry) return;

  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
  if (!isEnabled || !Sentry) return;
  Sentry.setUser(null);
}

// Export raw Sentry for advanced usage
export { Sentry };
