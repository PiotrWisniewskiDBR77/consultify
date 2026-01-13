/**
 * Server Entry Point
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/index.js (CommonJS) to TypeScript (ES Modules)
 * Handles both TypeScript routes (migrated) and CommonJS routes (legacy)
 */

import 'dotenv/config';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Express, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// TypeScript imports (ES Modules)
import { initSentry } from './config/index.js';
import { startHealthCheck } from './cron/HealthCheckJob.js';
import Scheduler from './cron/Scheduler.js';
import { getDatabase, getDatabaseAsync } from './database/Database.js';
// TypeScript routes (migrated)
import { apiGateway } from './Gateway.js';
import { get as dbGet } from './utils/DbPromise.js';
import logger from './utils/Logger.js';
import RedisRateLimitStore from './utils/RedisRateLimitStore.js';
import { correlationMiddleware } from './utils/RequestStore.js';
import { getShutdownManager } from './utils/ShutdownManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize app
const app: Express = express();
const PORT = process.env.PORT || 3005;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Trust proxy (required for Railway and other reverse proxies)
app.set('trust proxy', 1);

// Health Check Routes
import healthRoutes from './routes/healthRoutes.js';
import { HealthCheckController } from './controllers/HealthCheckController.js';

// Health Check (Ping) - synchronous
app.get('/ping', HealthCheckController.ping);

// Mount Health Check Routes
app.use('/api/health', healthRoutes);


// Initialize Sentry (must be before other middleware)
const sentryHandlers = initSentry(app);

// Logger is already imported as default export

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

// Initialize database asynchronously and verify schema
(async () => {
    try {
        logger.info('[Server] Initializing database...');
        const db = await getDatabaseAsync();
        console.log('[Server] Database instance created:', db ? 'OK' : 'MOCK');

        // Initialize and verify schema
        const { initializeDatabase } = await import('./database/DatabaseInitializer.js');
        const initResult = await initializeDatabase();

        if (!initResult.success) {
            logger.error(`[Server] Database initialization failed: ${initResult.message}`);
            if (isProduction) {
                logger.error('[Server] CRITICAL: Database schema incomplete. Application may not function correctly.');
                // In production, we might want to exit, but for now we'll continue with warnings
            }
        } else {
            logger.info(`[Server] Database initialized successfully: ${initResult.message}`);
        }

        // Schedule periodic schema verification (every 5 minutes)
        if (!isTest) {
            setInterval(async () => {
                try {
                    const { verifyDatabaseHealth } = await import('./database/DatabaseInitializer.js');
                    const healthy = await verifyDatabaseHealth();
                    if (!healthy) {
                        logger.warn('[Server] Database health check failed - schema may be incomplete');
                    }
                } catch (err: unknown) {
                    const error = err as Error;
                    logger.error(`[Server] Database health check error: ${error.message}`);
                }
            }, 5 * 60 * 1000); // Every 5 minutes
        }
    } catch (err: unknown) {
        const error = err as Error;
        logger.error(`[Server] Database initialization failed: ${error.message}`);
        if (isProduction) {
            logger.error('[Server] CRITICAL: Cannot proceed without database. Exiting...');
            process.exit(1);
        }
    }
})();

// ============================================================
// SCHEDULER & HEALTH CHECKS INITIALIZATION
// ============================================================

if (!isTest && process.env.DISABLE_SCHEDULER !== 'true') {
    // Init Scheduler (ES modules)
    try {
        Scheduler.init();
    } catch (err: unknown) {
        const error = err as Error;
        console.error('[Server] Scheduler initialization failed:', error.message);
    }

    // Init Health Check Monitor (ES modules)
    try {
        startHealthCheck();
    } catch (err: unknown) {
        const error = err as Error;
        console.error('[Server] Health Check initialization failed:', error.message);
    }

    // Init CQRS
    try {
        const { registerCQRSHandlers } = await import('./services/cqrs/registry.js');
        registerCQRSHandlers();
    } catch (err: unknown) {
        console.error('[Server] CQRS initialization failed:', err);
    }

    // ============================================================
    // LLM STARTUP VALIDATION - Single Source of Truth
    // ============================================================
    // Validate LLM configuration
    (async () => {
        try {
            const startupValidatorModule = await import('./services/ai/startupValidator.js');
            // Handle both named exports and default export wrapping (CJS/ESM interop)
            // @ts-ignore
            let validateOnStartup =
                startupValidatorModule.validateOnStartup || startupValidatorModule.default?.validateOnStartup;

            // Handle case where default export is a Promise (async module init)
            if (!validateOnStartup && startupValidatorModule.default instanceof Promise) {
                const resolvedDefault = await startupValidatorModule.default;
                validateOnStartup = (resolvedDefault as any)?.validateOnStartup;
            }

            if (typeof validateOnStartup === 'function') {
                const healthReport = await validateOnStartup({
                    testConnectivity: true,
                    parallel: true,
                });

                // Store health report for API access
                (global as typeof globalThis & { llmHealthReport?: unknown }).llmHealthReport = healthReport;

                if (healthReport.criticalErrors && healthReport.criticalErrors.length > 0) {
                    console.error('[Server] ⚠️  LLM CRITICAL: Some AI features may not work');
                    healthReport.criticalErrors.forEach((err: string) => console.error(`  - ${err}`));
                }

                if (healthReport.summary && healthReport.summary.healthy > 0) {
                    console.log(`[Server] ✅ LLM Ready: ${healthReport.summary.healthy} provider(s) healthy`);
                }
            } else {
                console.warn('[Server] Startup validation skipped (function not found)');
            }
        } catch (err: unknown) {
            const error = err as Error;
            console.error('[Server] LLM Startup Validation failed:', error.message);
        }
    })();

    // Init LLM Provider Health Monitoring (Auto-Fallback)
    try {
        const llmFallbackService = await import('./services/llmFallbackService.js');
        // @ts-ignore
        const service = llmFallbackService.default || llmFallbackService;
        if (service && typeof service.startHealthMonitoring === 'function') {
            service.startHealthMonitoring(60000);
            console.log('[Server] LLM Provider Health Monitoring started');
        }
    } catch (err: unknown) {
        const error = err as Error;
        console.warn('[Server] LLM Fallback Service not available:', error.message);
    }

    // Init AI Health Monitor (Self-Healing System)
    try {
        const healthMonitorModule = await import('./services/ai/healthMonitor.js');
        // Debug: Log imported module keys
        console.log('[Debug] healthMonitorModule keys:', Object.keys(healthMonitorModule));
        // Handle both named exports and default export wrapping (CJS/ESM interop)
        // @ts-ignore
        let healthMonitor = healthMonitorModule.healthMonitor || healthMonitorModule.default?.healthMonitor;

        // Handle case where default export is a Promise (async module init)
        if (!healthMonitor && healthMonitorModule.default instanceof Promise) {
            const resolvedDefault = await healthMonitorModule.default;
            healthMonitor = (resolvedDefault as any)?.healthMonitor;
        }

        if (healthMonitor) {
            healthMonitor.start(60000);

            healthMonitor.onAlert((alert: { message: string; checks?: string[] }) => {
                console.error('[AI Health] CRITICAL ALERT:', alert.message);
                console.error('[AI Health] Failed checks:', alert.checks?.join(', '));
            });

            console.log('[Server] AI Health Monitor started (self-healing enabled)');
        } else {
            console.warn('[Server] AI Health Monitor not available (export not found)');
        }
    } catch (err: unknown) {
        const error = err as Error;
        console.warn('[Server] AI Health Monitor not available:', error.message);
    }
}

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Security Headers (Enterprise SaaS Standard - OWASP Compliant)
app.use(
    helmet({
        contentSecurityPolicy: isProduction
            ? {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
                    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                    imgSrc: [
                        "'self'",
                        'data:',
                        'blob:',
                        'https://www.transparenttextures.com',
                        'https://*.stripe.com',
                        'https://www.gravatar.com',
                        'https://*.googleusercontent.com',
                    ],
                    connectSrc: [
                        "'self'",
                        'wss:',
                        'https://api.openai.com',
                        'https://generativelanguage.googleapis.com',
                        'https://api.anthropic.com',
                        'https://api.mistral.ai',
                        'https://api.stripe.com',
                        'https://*.sentry.io',
                    ],
                    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'", 'blob:'],
                    frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
                    workerSrc: ["'self'", 'blob:'],
                    childSrc: ["'self'", 'blob:'],
                    formAction: ["'self'"],
                    frameAncestors: ["'none'"],
                    baseUri: ["'self'"],
                    upgradeInsecureRequests: isProduction ? [] : null,
                },
                reportOnly: false,
            }
            : false,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },
        noSniff: true,
        frameguard: {
            action: 'deny',
        },
        xssFilter: true,
        dnsPrefetchControl: {
            allow: false,
        },
        ieNoOpen: true,
        permittedCrossDomainPolicies: {
            permittedPolicies: 'none',
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: {
            policy: 'same-origin',
        },
        crossOriginResourcePolicy: {
            policy: 'same-site',
        },
        originAgentCluster: true,
    }),
);

// Compression
app.use(
    compression({
        level: 6, // Optimal balance between speed and compression
        threshold: 1024, // Only compress responses > 1KB
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        },
    }),
);

// ============================================================
// RATE LIMITING
// ============================================================

const redisStore = new RedisRateLimitStore({ windowMs: 15 * 60 * 1000 });
const authRedisStore = new RedisRateLimitStore({ windowMs: 60 * 60 * 1000 });

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 300 : 1000, // Increased for production to support paginated calls
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore,
    skip: (req) => isTest || req.originalUrl.includes('/api/auth/'),
    message: { error: 'Too many requests, please try again later.' },
    keyGenerator: (req) => {
        // Intelligent Rate Limiting: Key by User ID if auth, else IP
        // This solves the "Office IP" problem where all users share one IP
        if ((req as any).user?.id) {
            return `api:user:${(req as any).user.id}`;
        }
        return `api:ip:${ipKeyGenerator(req as any)}`;
    },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 15 : 1000,
    store: authRedisStore,
    skip: (req) => {
        if (isTest) return true;
        if (req.method === 'OPTIONS') return true;
        return false;
    },
    message: { error: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const email = (req.body as { email?: string })?.email;
        const _ip = req.ip || req.socket.remoteAddress || 'unknown';

        if (email) {
            return `auth:${email.toLowerCase().trim()}`;
        }

        return `auth:ip:${ipKeyGenerator(req as any)}`;
    },
});

// ============================================================
// CORS CONFIGURATION
// ============================================================

const corsOptions: cors.CorsOptions = {
    origin:
        process.env.FRONTEND_URL || (isProduction ? false : ['http://localhost:3000', 'http://127.0.0.1:3000', '*']),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token', 'x-csrf-token'],
};
app.use(cors(corsOptions));

// Sentry Request Handler (must be FIRST middleware - before body parsing)
app.use(sentryHandlers.requestHandler);

// Sentry Tracing Handler (must be after request handler, before routes)
app.use(sentryHandlers.tracingHandler);

// Body Parsing, Cookies & Static Files
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser()); // Required for CSRF protection
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Correlation & Context Tracking
app.use(correlationMiddleware);

// ============================================================
// INPUT SANITIZATION & CSRF PROTECTION (Security Hardening)
// ============================================================

import { inputSanitizationMiddleware } from './middleware/inputSanitization.middleware.js';
import { csrfTokenMiddleware, getCsrfTokenHandler } from './middleware/csrf.middleware.js';

// Apply input sanitization to all requests
app.use(inputSanitizationMiddleware);

// CSRF Token endpoint (for SPAs to fetch token)
app.get('/api/csrf-token', getCsrfTokenHandler);

// Apply CSRF token generation (validation is opt-in per route)
// Note: CSRF validation is disabled by default for API-first architecture
// Enable per-route using csrfValidationMiddleware for sensitive operations
if (isProduction) {
    app.use('/api/', csrfTokenMiddleware);
}

// ============================================================
// PERFORMANCE METRICS & LOGGING MIDDLEWARE
// ============================================================

import { performanceMetricsMiddleware } from './middleware/performanceMetrics.middleware.js';
import { metricsMiddleware } from './middleware/metrics.middleware.js';

// Prometheus metrics middleware - collect HTTP request metrics
app.use('/api/', metricsMiddleware);

// Performance metrics middleware - collect detailed performance data
app.use('/api/', performanceMetricsMiddleware);

// Apply rate limiting and security logging to API routes
// app.use('/api/', apiLimiter);
import auditLogMiddleware from './middleware/auditLog.middleware.js';
// app.use('/api/', auditLogMiddleware);
app.use(logger.requestLogger);

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ============================================================
// ROUTE REGISTRATION
// ============================================================

// ============================================================
// ROUTE REGISTRATION - API GATEWAY
// ============================================================

// Initialize API Gateway Routes
app.use((req, res, next) => { console.log('[Index] Pre-Gateway:', req.path); next(); });
apiGateway.initializeRoutes(app);

// ============================================================
// STATIC FILES & CATCHALL
// ============================================================

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist'), {
    maxAge: '1y', // Cache static assets for 1 year
    etag: true,
}));

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.use((req: Request, res: Response) => {
    // Only send index.html if it's not an API route
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: `Route ${req.method} ${req.path} not found`,
                timestamp: new Date().toISOString(),
            },
        });
    }
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============================================================
// ERROR HANDLERS
// ============================================================

// Sentry Error Handler (must be before other error handlers)
app.use(sentryHandlers.errorHandler);

// Alert Watchdog: Catch 500 errors and trigger System Alerts
import alertWatchdog from './middleware/alertWatchdog.middleware.js';
app.use(alertWatchdog);

// Error Handler Middleware (must be last, after all routes)
import { errorHandlerMiddleware } from './utils/ErrorHandler.js';
app.use(errorHandlerMiddleware);

// 404 Handler (must be after error handler)
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
            timestamp: new Date().toISOString(),
        },
    });
});

// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================

if (!isTest) {
    // Handle uncaught exceptions
    process.on('uncaughtException', (err: Error) => {
        logger.error('[Server] Uncaught Exception:', err);
        if (isProduction) {
            console.error('[Server] Uncaught Exception (not exiting):', err.message);
        } else {
            console.error('[Server] Uncaught Exception:', err);
        }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
        logger.error('[Server] Unhandled Rejection:', { reason: String(reason), promise: String(promise) } as any);
        if (isProduction) {
            console.error('[Server] Unhandled Rejection (not exiting):', reason);
        } else {
            console.error('[Server] Unhandled Rejection:', reason);
        }
    });

    // Handle warnings
    process.on('warning', (warning: Error) => {
        logger.warn('[Server] Warning:', { message: warning.message, name: warning.name, stack: warning.stack } as any);
    });
}

// ============================================================
// SERVER STARTUP
// ============================================================

// Only listen if the file is run directly (not imported)
const startServer = true; // Always start server when running via tsx

if (startServer && !isTest) {
    const server = http.createServer(app);
    const shutdownManager = getShutdownManager(30000); // 30 second timeout

    // Handle server errors
    server.on('error', (err: NodeJS.ErrnoException) => {
        logger.error('[Server] HTTP Server Error:', err);
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use`);
            process.exit(1);
        }
    });

    // Initialize WebSocket server
    (async () => {
        try {
            const realtimeServiceModule = await import('../services/realtimeService.js');
            const realtimeServicePromise = realtimeServiceModule.default || realtimeServiceModule;
            const realtimeService = await realtimeServicePromise;
            const serviceInstance = (realtimeService as any).default || realtimeService;
            if (serviceInstance && typeof serviceInstance.initializeSimple === 'function') {
                serviceInstance.initializeSimple(server);
            }
        } catch (err: unknown) {
            const error = err as Error;
            logger.warn('[Server] Realtime service not available:', { message: error.message } as any);
        }
    })();

    // Start token cleanup cron job
    (async () => {
        try {
            const { startCleanupJob } = await import('../cron/cleanupRevokedTokens.js');
            startCleanupJob();
        } catch (err: unknown) {
            const error = err as Error;
            logger.warn('[Server] Token cleanup job failed to start:', error.message);
        }
    })();

    // Start metrics snapshot job
    (async () => {
        try {
            const snapshotMetricsModule = await import('../cron/snapshotMetrics.js');
            const initMetricsSnapshotJob = snapshotMetricsModule.default || snapshotMetricsModule;
            if (typeof initMetricsSnapshotJob === 'function') {
                initMetricsSnapshotJob();
            }
        } catch (err: unknown) {
            const error = err as Error;
            logger.warn('[Server] Metrics snapshot job failed to start:', error.message);
        }
    })();

    // Init AI Services (Redis, Cache, Rate Limiter)
    (async () => {
        try {
            const redisModule = await import('../services/ai/redisClient.js');
            const initRedis = redisModule.initRedis || (redisModule as any).default?.initRedis;
            const _getRedisClient = (redisModule as any)._getRedisClient || (redisModule as any).getRedisClient;
            const redisUrl = process.env.REDIS_URL;

            if (initRedis && typeof initRedis === 'function') {
                initRedis(redisUrl)
                    .then(async (redisClient: unknown) => {
                        if (redisClient && typeof redisClient === 'object') {
                            const { cacheService } = await import('../services/ai/cacheService.js');
                            cacheService.connectRedis(redisClient);

                            const { rateLimiter } = await import('../services/ai/rateLimiter.js');
                            rateLimiter.connectRedis(redisClient);
                        }
                    })
                    .then(async (redisClient: unknown) => {
                        if (redisClient && typeof redisClient === 'object') {
                            console.log('[AI Services] Redis connected for cache and rate limiting');
                        } else {
                            console.log('[AI Services] Using in-memory fallback (Redis not available)');
                        }
                    })
                    .catch((err: unknown) => {
                        const error = err instanceof Error ? err : new Error(String(err));
                        logger.warn('[Server] Redis initialization failed:', { message: error.message } as any);
                        console.warn('[AI Services] Redis init failed, using in-memory:', error.message);
                    });
            } else {
                console.log('[AI Services] Using in-memory fallback (Redis not available)');
            }
        } catch (err: unknown) {
            const error = err as Error;
            logger.warn('[Server] AI Services failed to initialize:', error.message);
        }
    })();

    // Init AI Worker
    (async () => {
        try {
            const { initWorker } = await import('../workers/aiWorker.js');
            initWorker();
        } catch (err: unknown) {
            const error = err as Error;
            logger.warn('[Server] AI Worker failed to start (likely Redis missing):', error.message);
        }
    })();

    // Run Integrity Check at Startup
    (async () => {
        if (!isTest && process.env.DISABLE_SYSTEM_INTEGRITY !== 'true') {
            try {
                const systemIntegrityModule = await import('../services/systemIntegrity.js');
                const SystemIntegrity = systemIntegrityModule.default || systemIntegrityModule;
                const integrityInstance = (SystemIntegrity as any).default || SystemIntegrity;
                if (integrityInstance && typeof integrityInstance.check === 'function') {
                    setTimeout(() => {
                        integrityInstance.check();
                    }, 2000);
                }
            } catch (err: unknown) {
                const error = err as Error;
                logger.warn('[Server] System Integrity check failed:', { message: error.message } as any);
            }
        }
    })();

    // ============================================================
    // GRACEFUL SHUTDOWN SETUP
    // ============================================================

    // Register cleanup handlers
    shutdownManager.registerCleanup('HTTP Server', async () => {
        return new Promise<void>((resolve) => {
            logger.info('[Shutdown] Closing HTTP server...');
            server.close(() => {
                logger.info('[Shutdown] HTTP server closed');
                resolve();
            });
        });
    });

    shutdownManager.registerCleanup('Database', async () => {
        try {
            logger.info('[Shutdown] Closing database connections...');
            const db = getDatabase();
            await db.close();
            logger.info('[Shutdown] Database connections closed');
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('[Shutdown] Error closing database:', { message: err.message } as any);
        }
    });

    shutdownManager.registerCleanup('Redis', async () => {
        try {
            logger.info('[Shutdown] Closing Redis connections...');
            const { getRedisClient, isRedisConnected } = await import('./services/ai/redisClient.js');
            if (isRedisConnected()) {
                const client = getRedisClient();
                if (client && typeof client.quit === 'function') {
                    await client.quit();
                }
            }
            logger.info('[Shutdown] Redis connections closed');
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('[Shutdown] Error closing Redis:', { message: err.message } as any);
        }
    });

    shutdownManager.registerCleanup('Scheduler', async () => {
        try {
            logger.info('[Shutdown] Stopping cron jobs...');
            if (Scheduler && typeof Scheduler.stop === 'function') {
                Scheduler.stop();
            }
            logger.info('[Shutdown] Cron jobs stopped');
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('[Shutdown] Error stopping scheduler:', { message: err.message } as any);
        }
    });

    shutdownManager.registerCleanup('WebSocket', async () => {
        try {
            logger.info('[Shutdown] Closing WebSocket connections...');
            const realtimeServiceModule = await import('../services/realtimeService.js').catch(() => null);
            if (realtimeServiceModule) {
                const realtimeService = realtimeServiceModule.default || realtimeServiceModule;
                if (realtimeService && typeof realtimeService.close === 'function') {
                    await realtimeService.close();
                }
            }
            logger.info('[Shutdown] WebSocket connections closed');
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('[Shutdown] Error closing WebSocket:', { message: err.message } as any);
        }
    });

    // Register signal handlers
    const shutdown = (signal: string) => {
        logger.info(`[Shutdown] Received ${signal}, starting graceful shutdown...`);
        shutdownManager
            .shutdown(signal)
            .then(() => {
                logger.info('[Shutdown] Graceful shutdown completed');
                process.exit(0);
            })
            .catch((error: unknown) => {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error('[Shutdown] Error during shutdown:', { message: err.message } as any);
                process.exit(1);
            });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions with graceful shutdown
    process.on('uncaughtException', (err: Error) => {
        logger.error('[Server] Uncaught Exception:', err);
        shutdownManager.shutdown('uncaughtException').finally(() => {
            process.exit(1);
        });
    });

    // Handle unhandled rejections with graceful shutdown
    process.on('unhandledRejection', (reason: unknown) => {
        logger.error('[Server] Unhandled Rejection:', reason);
        shutdownManager.shutdown('unhandledRejection').finally(() => {
            process.exit(1);
        });
    });

    console.log('[Debug] Calling server.listen...');
    server.listen(PORT, '0.0.0.0', () => {
        console.log('[Debug] server.listen callback fired!');
        console.log('Server running on http://0.0.0.0:' + PORT);
        console.log('WebSocket available at ws://0.0.0.0:' + PORT + '/ws');
        logger.info('[Server] Graceful shutdown handlers registered');
    });
}

export default app;
