/**
 * Sentry Configuration for Frontend
 * 
 * Initialize Sentry error monitoring for React app.
 * Import this in main.tsx before React renders.
 */

import * as Sentry from '@sentry/react';

const isProduction = import.meta.env.MODE === 'production';
const isStaging = import.meta.env.MODE === 'staging';
const dsn = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
    if (!dsn || (!isProduction && !isStaging)) {
        console.log('[Sentry] Disabled (no DSN or not in production/staging)');
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE || 'development',
        release: import.meta.env.VITE_APP_VERSION || '1.0.0',

        integrations: [
            // Browser Tracing for performance
            Sentry.browserTracingIntegration(),
            // Session Replay for debugging
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],

        // Performance Monitoring
        tracesSampleRate: isProduction ? 0.1 : 1.0,

        // Session Replay
        replaysSessionSampleRate: isProduction ? 0.1 : 1.0,
        replaysOnErrorSampleRate: 1.0, // Always capture replay on error

        // Filter out common noise
        ignoreErrors: [
            // Network errors
            'Network request failed',
            'Failed to fetch',
            'Load failed',
            // Browser extensions
            'Non-Error exception captured',
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
            // User aborted
            'AbortError',
            'The operation was aborted',
        ],

        // Don't send events from these URLs
        denyUrls: [
            /extensions\//i,
            /^chrome:\/\//i,
            /^chrome-extension:\/\//i,
            /^moz-extension:\/\//i,
        ],

        // Sanitize sensitive data
        beforeSend(event, hint) {
            // Remove sensitive query params
            if (event.request?.url) {
                const url = new URL(event.request.url);
                const sensitiveParams = ['token', 'key', 'secret', 'password'];
                sensitiveParams.forEach(param => {
                    if (url.searchParams.has(param)) {
                        url.searchParams.set(param, '[REDACTED]');
                    }
                });
                event.request.url = url.toString();
            }

            return event;
        },
    });

    console.log(`[Sentry] Initialized for ${import.meta.env.MODE} environment`);
}

/**
 * Set user context (call after login)
 */
export function setUser(user: { id: string; email: string; role?: string; organizationId?: string }) {
    Sentry.setUser({
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
    });
}

/**
 * Clear user context (call after logout)
 */
export function clearUser() {
    Sentry.setUser(null);
}

/**
 * Capture exception manually
 */
export function captureException(error: Error, context?: Record<string, any>) {
    Sentry.captureException(error, {
        extra: context,
    });
}

/**
 * Create Sentry error boundary for React
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Wrap component with Sentry profiler
 */
export const withSentryProfiler = Sentry.withProfiler;
