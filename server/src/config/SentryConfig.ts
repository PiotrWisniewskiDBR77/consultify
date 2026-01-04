/**
 * Sentry Configuration
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * This module initializes Sentry error monitoring for the Express server.
 * Import this at the very top of server/index.js, before other imports.
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Express, NextFunction, Request, Response } from 'express';
import { z } from 'zod';

// Use Handlers from @sentry/node for compatibility

const Handlers = (Sentry as any).Handlers;

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
export function initSentry(app: Express): SentryHandlers {
    if (!isEnabled) {
        console.log('[Sentry] Disabled (no SENTRY_DSN or not in production/staging)');
        return {
            requestHandler: (_req: Request, _res: Response, next: NextFunction) => next(),
            tracingHandler: (_req: Request, _res: Response, next: NextFunction) => next(),
            errorHandler: (err: Error, _req: Request, _res: Response, next: NextFunction) => next(err),
        };
    }

    const sentryConfig: SentryConfig = {
        dsn: process.env.SENTRY_DSN,
        environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test' | 'staging',
        release: process.env.npm_package_version || '1.0.0',
        tracesSampleRate: isProduction ? 0.1 : 1.0,
        profilesSampleRate: isProduction ? 0.1 : 1.0,
    };

    // Validate config
    const validatedConfig = SentryConfigSchema.parse(sentryConfig);

    Sentry.init({
        dsn: validatedConfig.dsn,
        environment: validatedConfig.environment,
        release: validatedConfig.release,

        // Integrations
        integrations: [
            // Express integration (legacy API for compatibility)

            new (Sentry as any).Integrations.Express({ app }),
            // HTTP integration for tracing outgoing requests

            new (Sentry as any).Integrations.Http({ tracing: true }),
            // Profiling (optional, requires @sentry/profiling-node)
            nodeProfilingIntegration(),
        ],

        // Performance Monitoring
        tracesSampleRate: validatedConfig.tracesSampleRate,
        profilesSampleRate: validatedConfig.profilesSampleRate,

        // Filter sensitive data
        beforeSend(event) {
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

    console.log(`[Sentry] Initialized for ${validatedConfig.environment} environment`);

    return {
        // Request handler - must be first middleware
        requestHandler: Handlers.requestHandler({
            user: ['id', 'email', 'role'],
            ip: true,
        }),

        // Tracing handler - must be after request handler and before routes
        tracingHandler: Handlers.tracingHandler(),

        // Error handler - must be after routes and before other error handlers
        errorHandler: Handlers.errorHandler({
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

    Sentry.withScope((scope) => {
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
    context: Context = {},
): void {
    if (!isEnabled) {
        console.log(`[${level.toUpperCase()}]`, message, context);
        return;
    }

    Sentry.withScope((scope) => {
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
