/**
 * Sentry Configuration for Backend
 * 
 * This module initializes Sentry error monitoring for the Express server.
 * Import this at the very top of server/index.js, before other imports.
 */

const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const isEnabled = (isProduction || isStaging) && process.env.SENTRY_DSN;

/**
 * Initialize Sentry
 * @param {Express} app - Express application instance
 */
function initSentry(app) {
    if (!isEnabled) {
        console.log('[Sentry] Disabled (no SENTRY_DSN or not in production/staging)');
        return {
            requestHandler: () => (req, res, next) => next(),
            tracingHandler: () => (req, res, next) => next(),
            errorHandler: () => (err, req, res, next) => next(err),
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
                    if (typeof event.request.data === 'object' && event.request.data[field]) {
                        event.request.data[field] = '[REDACTED]';
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
            shouldHandleError(error) {
                // Only report 500+ errors automatically
                if (error.status >= 500) {
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
 * @param {Error} error 
 * @param {Object} context - Additional context
 */
function captureException(error, context = {}) {
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
 * @param {string} message 
 * @param {string} level - 'info', 'warning', 'error'
 * @param {Object} context
 */
function captureMessage(message, level = 'info', context = {}) {
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
 * @param {Object} breadcrumb
 */
function addBreadcrumb(breadcrumb) {
    if (!isEnabled) return;

    Sentry.addBreadcrumb({
        timestamp: Date.now() / 1000,
        ...breadcrumb,
    });
}

/**
 * Set user context
 * @param {Object} user
 */
function setUser(user) {
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
function clearUser() {
    if (!isEnabled) return;
    Sentry.setUser(null);
}

module.exports = {
    initSentry,
    captureException,
    captureMessage,
    addBreadcrumb,
    setUser,
    clearUser,
    Sentry, // Export raw Sentry for advanced usage
};
