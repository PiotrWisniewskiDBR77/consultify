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
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
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

const PORT = Number(process.env.PORT) || 3005;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Trust proxy (required for Railway and other reverse proxies)
app.set('trust proxy', 1);

// Health Check Routes
import { HealthCheckController } from './controllers/HealthCheckController.js';
import healthRoutes from './routes/healthRoutes.js';

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
if (!isTest || process.env.E2E_MODE === 'true') {
    (async () => {
        try {
            logger.info('[Server] Initializing database...');
            const db = await getDatabaseAsync();
            logger.info('[Server] Database instance created:', db ? 'OK' : 'MOCK');

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
            setInterval(
                async () => {
                    try {
                        const { verifyDatabaseHealth } = await import('./database/DatabaseInitializer.js');
                        const healthy = await verifyDatabaseHealth();
                        if (!healthy) {
                            logger.warn('[Server] Database health check failed - schema may be incomplete');
                        }
                    } catch (err: any) {
                        const error = err as Error;
                        logger.error(`[Server] Database health check error: ${error.message}`);
                    }
                },
                5 * 60 * 1000,
            ); // Every 5 minutes
        } catch (err: any) {
            const error = err as Error;
            logger.error(`[Server] Database initialization failed: ${error.message}`);
            if (isProduction) {
                logger.error('[Server] CRITICAL: Cannot proceed without database. Exiting...');
                process.exit(1);
            }
        }
    })();
}

// ============================================================
// SCHEDULER & HEALTH CHECKS INITIALIZATION
// ============================================================

if (!isTest && process.env.DISABLE_SCHEDULER !== 'true') {
    // Init Scheduler (ES modules)
    try {
        await Scheduler.init();
    } catch (err: any) {
        const error = err as Error;
        logger.error('[Server] Scheduler initialization failed:', error.message);
    }

    // Init Health Check Monitor (ES modules)
    try {
        startHealthCheck();
    } catch (err: any) {
        const error = err as Error;
        logger.error('[Server] Health Check initialization failed:', error.message);
    }

    // Init CQRS
    try {
        const { registerCQRSHandlers } = await import('./services/cqrs/registry.js');
        registerCQRSHandlers();
    } catch (err: any) {
        logger.error('[Server] CQRS initialization failed:', { error: err });
    }

    // ============================================================
    // LLM STARTUP VALIDATION - Single Source of Truth
    // ============================================================
    // Validate LLM configuration
    (async () => {
        try {
            const startupValidatorModule = await import('./services/ai/startupValidator.js');
            // Handle both named exports and default export wrapping (CJS/ESM interop)
            let validateOnStartup: any =
                (startupValidatorModule as any).validateOnStartup ||
                (startupValidatorModule as any).default?.validateOnStartup;

            // Handle case where default export is a Promise (async module init)
            if (!validateOnStartup && (startupValidatorModule as any).default instanceof Promise) {
                const resolvedDefault = (await (startupValidatorModule as any).default) as any;
                validateOnStartup = resolvedDefault.validateOnStartup;
            }

            if (typeof validateOnStartup === 'function') {
                const healthReport = await validateOnStartup({
                    testConnectivity: true,
                    parallel: true,
                });

                // Store health report for API access
                (global as typeof globalThis & { llmHealthReport?: unknown }).llmHealthReport = healthReport;

                if (healthReport.criticalErrors && healthReport.criticalErrors.length > 0) {
                    logger.error('[Server] ⚠️  LLM CRITICAL: Some AI features may not work');
                    healthReport.criticalErrors.forEach((err: string) => logger.error(`  - ${err}`));
                }

                if (healthReport.summary && healthReport.summary.healthy > 0) {
                    logger.info(`[Server] ✅ LLM Ready: ${healthReport.summary.healthy} provider(s) healthy`);
                }
            } else {
                logger.warn('[Server] Startup validation skipped (function not found)');
            }
        } catch (err: any) {
            const error = err as Error;
            logger.error('[Server] LLM Startup Validation failed:', error.message);
        }
    })();

    // Init LLM Provider Health Monitoring (Auto-Fallback)
    try {
        // const llmFallbackService = await import('./services/llmFallbackService.js');
        // // @ts-ignore
        // const service = llmFallbackService.default || llmFallbackService;
        // if (service && typeof service.startHealthMonitoring === 'function') {
        //     service.startHealthMonitoring(60000);
        //     logger.info('[Server] LLM Provider Health Monitoring started');
        // }
    } catch (err: any) {
        const error = err as Error;
        logger.warn('[Server] LLM Fallback Service not available:', error.message);
    }

    // Init AI Health Monitor (Self-Healing System)
    try {
        const healthMonitorModule = await import('./services/ai/healthMonitor.js');
        // Debug: Log imported module keys
        logger.info('[Debug] healthMonitorModule keys:', Object.keys(healthMonitorModule));
        // Handle both named exports and default export wrapping (CJS/ESM interop)
        // @ts-ignore
        let healthMonitor = healthMonitorModule.healthMonitor || healthMonitorModule.default?.healthMonitor;

        // Handle case where default export is a Promise (async module init)
        if (!healthMonitor && (healthMonitorModule as any).default instanceof Promise) {
            const resolvedDefault = (await (healthMonitorModule as any).default) as any;
            healthMonitor = resolvedDefault.healthMonitor;
        }

        if (healthMonitor) {
            healthMonitor.start(60000);

            healthMonitor.onAlert((alert: { message: string; checks?: string[] }) => {
                logger.error('[AI Health] CRITICAL ALERT:', alert.message);
                logger.error('[AI Health] Failed checks:', alert.checks?.join(', '));
            });

            logger.info('[Server] AI Health Monitor started (self-healing enabled)');
        } else {
            logger.warn('[Server] AI Health Monitor not available (export not found)');
        }
    } catch (err: any) {
        const error = err as Error;
        logger.warn('[Server] AI Health Monitor not available:', error.message);
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
    keyGenerator: (req, res) => {
        // Intelligent Rate Limiting: Key by User ID if auth, else IP
        // This solves the "Office IP" problem where all users share one IP
        if ((req as any).user?.id) {
            return `api:user:${(req as any).user.id}`;
        }
        return `api:ip:${ipKeyGenerator(req, res)}`;
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
    keyGenerator: (req, res) => {
        const email = (req.body as { email?: string })?.email;

        if (email) {
            return `auth:${email.toLowerCase().trim()}`;
        }

        return `auth:ip:${ipKeyGenerator(req, res)}`;
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

import { csrfTokenMiddleware, getCsrfTokenHandler } from './middleware/csrf.middleware.js';
import { inputSanitizationMiddleware } from './middleware/inputSanitization.middleware.js';

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

import { metricsMiddleware } from './middleware/metrics.middleware.js';
import { performanceMetricsMiddleware } from './middleware/performanceMetrics.middleware.js';

// Prometheus metrics middleware - collect HTTP request metrics
app.use('/api/', metricsMiddleware);

// Performance metrics middleware - collect detailed performance data
app.use('/api/', performanceMetricsMiddleware);

// Apply rate limiting and security logging to API routes
// app.use('/api/', apiLimiter);
import auditLogMiddleware from './middleware/auditLog.middleware.js';
// app.use('/api/', auditLogMiddleware);
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.http(`${req.method} ${req.url}`);
    next();
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ============================================================
// ROUTE REGISTRATION
// ============================================================

// ============================================================
// ROUTE REGISTRATION - API GATEWAY
// ============================================================

// Initialize API Gateway Routes
app.use((req, res, next) => {
    logger.info(`[Index] Pre-Gateway: ${req.method} ${req.path}`);
    if (req.path === '/auth/login' || req.path === '/api/auth/login' || req.originalUrl.includes('/auth/login')) {
        logger.info('[Index] Login Request Body:', JSON.stringify(req.body));
        logger.info('[Index] Login Request Headers:', JSON.stringify(req.headers));
    }
    next();
});
apiGateway.initializeRoutes(app);

// ============================================================
// STATIC FILES & CATCHALL
// ============================================================

// Serve static files from the React app
app.use(
    express.static(path.join(__dirname, '../dist'), {
        maxAge: '1y', // Cache static assets for 1 year
        etag: true,
    }),
);

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.use((req: Request, res: Response) => {
    // Only send index.html if it's not an API route
    if (req.path.startsWith('/api/')) {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: `Route ${req.method} ${req.path} not found`,
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }
    res.sendFile(path.join(__dirname, '../dist/index.html'));
    return;
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
import { errorHandlerMiddleware } from './utils/errorHandler.js';
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
            logger.error('[Server] Uncaught Exception (not exiting):', err.message);
        } else {
            logger.error('[Server] Validator critical error:', { error: err });
        }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
        logger.error('[Server] Unhandled Rejection:', { reason, promise });
        if (isProduction) {
            logger.error('[Server] Unhandled Rejection (not exiting):', reason);
        } else {
            logger.error('[Server] Unhandled Rejection:', reason);
        }
    });

    // Handle warnings
    process.on('warning', (warning: Error) => {
        logger.warn('[Server] Warning:', warning);
    });
}

// ============================================================
// SERVER STARTUP
// ============================================================

// Only listen if the file is run directly (not imported)
const startServer = true; // Always start server when running via tsx

if (startServer && (!isTest || process.env.E2E_MODE === 'true')) {
    const server = http.createServer(app);
    const shutdownManager = getShutdownManager(30000); // 30 second timeout

    // Handle server errors
    server.on('error', (err: NodeJS.ErrnoException) => {
        logger.error('[Server] HTTP Server Error:', err);
        if (err.code === 'EADDRINUSE') {
            logger.error(`Port ${PORT} is already in use`);
            process.exit(1);
        }
    });

    // Initialize WebSocket server
    (async () => {
        // try {
        //     const realtimeServiceModule = await import('./services/realtimeService.js');
        //     const realtimeServicePromise = realtimeServiceModule.default || realtimeServiceModule;
        //     const realtimeService = await realtimeServicePromise;
        //     if (realtimeService && typeof realtimeService.initializeSimple === 'function') {
        //         realtimeService.initializeSimple(server);
        //     }
        // } catch (err: any) {
        //     const error = err as Error;
        //     logger.warn('[Server] Realtime service not available:', error.message);
        // }
    })();

    // Start token cleanup cron job
    (async () => {
        // try {
        //     const cleanupModule = (await import('./cron/CleanupRevokedTokens.js')) as any;
        //     const startCleanupJob = cleanupModule.startCleanupJob || cleanupModule.default?.startCleanupJob;
        //     if (typeof startCleanupJob === 'function') {
        //         startCleanupJob();
        //     }
        // } catch (err: any) {
        //     const error = err as Error;
        //     logger.warn('[Server] Token cleanup job failed to start:', error.message);
        // }
    })();

    // Start metrics snapshot job
    (async () => {
        // try {
        //     const metricsModule = (await import('./cron/SnapshotMetrics.js')) as any;
        //     const SnapshotMetricsCron = metricsModule.SnapshotMetricsCron || metricsModule.default || metricsModule;
        //     if (typeof SnapshotMetricsCron === 'function') {
        //         SnapshotMetricsCron();
        //     } else if (SnapshotMetricsCron && typeof SnapshotMetricsCron.start === 'function') {
        //         SnapshotMetricsCron.start();
        //     }
        // } catch (err: any) {
        //     const error = err as Error;
        //     logger.warn('[Server] Metrics snapshot job failed to start:', error.message);
        // }
    })();

    // Init AI Services (Redis, Cache, Rate Limiter)
    (async () => {
        try {
            const redisModule = (await import('./services/ai/redisClient.js')) as any;
            const initRedis = redisModule.initRedis;
            const redisUrl = process.env.REDIS_URL;

            initRedis(redisUrl)
                .then(async (redisClient: any) => {
                    if (redisClient) {
                        const cacheModule = (await import('./services/ai/cacheService.js')) as any;
                        const cacheService = cacheModule.cacheService || cacheModule.default || cacheModule;
                        if (cacheService && typeof cacheService.connectRedis === 'function') {
                            cacheService.connectRedis(redisClient);
                        }

                        const rateLimiterModule = (await import('./services/ai/rateLimiter.js')) as any;
                        const rateLimiter =
                            rateLimiterModule.rateLimiter || rateLimiterModule.default || rateLimiterModule;
                        if (rateLimiter && typeof rateLimiter.connectRedis === 'function') {
                            rateLimiter.connectRedis(redisClient);
                        }
                    } else {
                        logger.info('[AI Services] Using in-memory fallback (Redis not available)');
                    }
                })
                .catch((err: Error) => {
                    logger.warn('[AI Services] Redis init failed, using in-memory:', err.message);
                });
        } catch (err: any) {
            const error = err as Error;
            logger.warn('[Server] AI Services failed to initialize:', error.message);
        }
    })();

    // Init AI Worker
    (async () => {
        try {
            const workerModule = (await import('./workers/aiWorker.js')) as any;
            const initWorker = workerModule.initWorker || workerModule.default || workerModule;
            if (typeof initWorker === 'function') {
                initWorker();
            }
        } catch (err: any) {
            const error = err as Error;
            logger.warn('[Server] AI Worker failed to start (likely Redis missing):', error.message);
        }
    })();

    // Run Integrity Check at Startup
    (async () => {
        if (!isTest && process.env.DISABLE_SYSTEM_INTEGRITY !== 'true') {
            try {
                const systemIntegrityModule = await import('./services/systemIntegrity.js');
                const SystemIntegrity = systemIntegrityModule.default || systemIntegrityModule;
                if (SystemIntegrity && typeof SystemIntegrity.check === 'function') {
                    setTimeout(() => {
                        SystemIntegrity.check();
                    }, 2000);
                }
            } catch (err: any) {
                const error = err as Error;
                logger.warn('[Server] System Integrity check failed:', error.message);
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
            logger.error('[Shutdown] Error closing database:', err.message);
        }
    });

    shutdownManager.registerCleanup('Redis', async () => {
        try {
            logger.info('[Shutdown] Closing Redis connections...');
            const redisModule = (await import('./services/ai/redisClient.js')) as any;
            const getRedisClient = redisModule.getRedisClient;
            const isRedisConnected = redisModule.isRedisConnected;

            if (typeof isRedisConnected === 'function' && isRedisConnected()) {
                const client = typeof getRedisClient === 'function' ? getRedisClient() : null;
                if (client && typeof client.quit === 'function') {
                    await client.quit();
                }
            }
            logger.info('[Shutdown] Redis connections closed');
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('[Shutdown] Error closing Redis:', err.message);
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
            logger.error('[Shutdown] Error stopping scheduler:', err.message);
        }
    });

    shutdownManager.registerCleanup('WebSocket', async () => {
        // try {
        //     logger.info('[Shutdown] Closing WebSocket connections...');
        //     const realtimeServiceModule = await import('./services/realtimeService.js').catch(() => null);
        //     if (realtimeServiceModule) {
        //         const realtimeService = realtimeServiceModule.default || realtimeServiceModule;
        //         if (realtimeService && typeof realtimeService.close === 'function') {
        //             await realtimeService.close();
        //         }
        //     }
        //     logger.info('[Shutdown] WebSocket connections closed');
        // } catch (error: unknown) {
        //     const err = error instanceof Error ? error : new Error(String(error));
        //     logger.error('[Shutdown] Error closing WebSocket:', err.message);
        // }
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
                logger.error('[Shutdown] Error during shutdown:', err.message);
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

    logger.info('[Debug] Calling server.listen...');
    server.listen(PORT, '0.0.0.0', () => {
        logger.info('[Debug] server.listen callback fired!');
        logger.info('Server running on http://0.0.0.0:' + PORT);
        logger.info('WebSocket available at ws://0.0.0.0:' + PORT + '/ws');
        logger.info('[Server] Graceful shutdown handlers registered');
    });
}

export default app;
