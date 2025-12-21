/**
 * Sentry Configuration for Backend
 * 
 * This module initializes Sentry error monitoring for the Express server.
 * Import this at the very top of server/index.js, before other imports.
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Express, Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const isEnabled = (isProduction || isStaging) && !!process.env.SENTRY_DSN;

interface SentryHandlers {
    requestHandler: (req: Request, res: Response, next: NextFunction) => void;
    tracingHandler: (req: Request, res: Response, next: NextFunction) => void;
    errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
}

interface User {
    id?: string;
    email?: string;
    role?: string;
    organizationId?: string;
}

interface Context {
    user?: User;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
}

/**
 * Initialize Sentry
 */
export function initSentry(app: Express): SentryHandlers {
    if (!isEnabled) {
        console.log('[Sentry] Disabled (no SENTRY_DSN or not in production/staging)');
        return {
            requestHandler: () => (req: Request, res: Response, next: NextFunction) => next(),
            tracingHandler: () => (req: Request, res: Response, next: NextFunction) => next(),
            errorHandler: () => (err: Error, req: Request, res: Response, next: NextFunction) => next(err),
        };
    }

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.npm_package_version || '1.0.0',

        // Integrations
        integrations: [
            // Express integration
            new Sentry.Integrations.Express({ app }),
            // HTTP integration for tracing outgoing requests
            new Sentry.Integrations.Http({ tracing: true }),
            // Profiling (optional, requires @sentry/profiling-node)
            nodeProfilingIntegration(),
        ],

        // Performance Monitoring
        tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in prod, 100% in staging
        profilesSampleRate: isProduction ? 0.1 : 1.0,

        // Filter sensitive data
        beforeSend(event, hint) {
            // Remove sensitive headers
            if (event.request && event.request.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
                delete event.request.headers['x-access-token'];
            }

            // Remove sensitive data from request body
            if (event.request && event.request.data) {
                const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'mfaToken', 'backupCode'];
                sensitiveFields.forEach(field => {
                    if (typeof event.request.data === 'object' && event.request.data && field in event.request.data) {
                        (event.request.data as Record<string, unknown>)[field] = '[REDACTED]';
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

    console.log(`[Sentry] Initialized for ${process.env.NODE_ENV} environment`);

    return {
        // Request handler - must be first middleware
        requestHandler: Sentry.Handlers.requestHandler({
            user: ['id', 'email', 'role'],
            ip: true,
        }),

        // Tracing handler - must be after request handler and before routes
        tracingHandler: Sentry.Handlers.tracingHandler(),

        // Error handler - must be after routes and before other error handlers
        errorHandler: Sentry.Handlers.errorHandler({
            shouldHandleError(error: Error & { status?: number }) {
                // Only report 500+ errors automatically
                if (error.status && error.status >= 500) {
                    return true;
                }
                // Also report 429 (rate limit) errors
                if (error.status === 429) {
                    return true;
                }
                return false;
            },
        }),
    };
}

/**
 * Capture exception manually
 */
export function captureException(error: Error, context: Context = {}): void {
    if (!isEnabled) {
        console.error('[Error]', error, context);
        return;
    }

    Sentry.withScope(scope => {
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
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context: Context = {}): void {
    if (!isEnabled) {
        console.log(`[${level.toUpperCase()}]`, message, context);
        return;
    }

    Sentry.withScope(scope => {
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
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!isEnabled) return;

    Sentry.addBreadcrumb({
        timestamp: Date.now() / 1000,
        ...breadcrumb,
    });
}

/**
 * Set user context
 */
export function setUser(user: User): void {
    if (!isEnabled) return;

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
    if (!isEnabled) return;
    Sentry.setUser(null);
}

// Export raw Sentry for advanced usage
export { Sentry };

