/**
 * Server Entry Point
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/index.js (CommonJS) to TypeScript (ES Modules)
 * Handles both TypeScript routes (migrated) and CommonJS routes (legacy)
 */

// CRITICAL (ESM): load env via a side-effect module that is imported FIRST.
import './config/loadEnv.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Now import other modules (they can use environment variables)
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import http from 'http';

// TypeScript imports (ES Modules)
import { initSentry } from './config/index.js';
import { startHealthCheck } from './cron/HealthCheckJob.js';
import Scheduler from './cron/Scheduler.js';
import {
  getDatabase,
  getDatabaseAsync,
  initializeConnectionPool,
  shutdownConnectionPool,
} from './database/index.js';
// TypeScript routes (migrated)
import { get as dbGet } from './utils/DbPromise.js';
import logger from './utils/Logger.js';
import RedisRateLimitStore from './utils/RedisRateLimitStore.js';
import { rateLimitUserIdMiddleware } from './middleware/rateLimitUserId.middleware.js';
import { correlationMiddleware } from './utils/RequestStore.js';
import { getShutdownManager } from './utils/ShutdownManager.js';

// Initialize app
const app: Express = express();

const PORT = Number(process.env.PORT) || 3005;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

// Validate environment variables on startup (skip in test mode)
if (!isTest && !process.env.SKIP_ENV_VALIDATION) {
  try {
    const { validateEnvOrThrow } = await import('./config/envValidator.js');
    validateEnvOrThrow();
  } catch (error: any) {
    // envValidator might not exist yet or validation failed
    if (error.code === 'MODULE_NOT_FOUND') {
      logger.warn('[Server] Environment validator not found, skipping validation');
    } else {
      logger.error('[Server] Environment validation failed:', error.message);
      if (isProduction) {
        logger.error('[Server] CRITICAL: Invalid environment configuration. Exiting...');
        process.exit(1);
      }
    }
  }
}

// Trust proxy (required for Railway and other reverse proxies)
app.set('trust proxy', 1);

// Health Check Routes
import { HealthCheckController } from './controllers/HealthCheckController.js';
import dbMetricsRoutes from './routes/db-metrics.routes.js';
import dbHealthRoutes from './routes/health.routes.js';
import healthRoutes from './routes/healthRoutes.js';
import systemHealthRoutes from './routes/system-health.routes.js';

// Health Check (Ping) - synchronous
app.get('/ping', HealthCheckController.ping);

// Test route to verify server is working
app.get('/test-frontend-path', (req: Request, res: Response) => {
  const testPaths = [
    '/app/dist',
    path.join(__dirname, '../../../dist'),
    path.join(__dirname, '../../dist'),
  ];

  const results = testPaths.map((p) => ({
    path: p,
    exists: fs.existsSync(p),
    hasIndex: fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html')),
  }));

  // Try to detect frontend path if not set
  let detectedPath = (global as any).frontendDistPath;
  if (!detectedPath || detectedPath === 'not set') {
    const found = testPaths.find(
      (p) => fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))
    );
    detectedPath = found || 'not found';
  }

  res.json({
    __dirname,
    NODE_ENV: process.env.NODE_ENV,
    paths: results,
    frontendDistPath: detectedPath,
    globalFrontendDistPath: (global as any).frontendDistPath || 'not set',
  });
});

// Mount Health Check Routes
app.use('/api/health', healthRoutes);
app.use('/api/health', dbHealthRoutes);
// app.use('/api/metrics', dbMetricsRoutes); // DISABLED: Conflicts with Gateway metrics routes
app.use('/api/system', systemHealthRoutes);

// Initialize Sentry (must be before other middleware)
const sentryHandlers = await initSentry(app);

// Logger is already imported as default export

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

// IMPORTANT: do not accept requests before DB is ready.
// Many routes use synchronous DB access and will throw if initialization is still in progress.
let dbReady = false;
let dbInitError: string | null = null;

// Readiness probe for load balancers / orchestration.
// Returns 503 until DB init + schema verification finishes successfully.
app.get('/api/ready', (_req: Request, res: Response) => {
  if (dbReady) {
    return res.status(200).json({
      status: 'ready',
      database: 'ready',
      timestamp: new Date().toISOString(),
    });
  }
  return res.status(503).json({
    status: 'not_ready',
    database: 'initializing',
    error: dbInitError,
    timestamp: new Date().toISOString(),
  });
});

// IMPORTANT: In dev we want the HTTP server to LISTEN immediately (so the frontend proxy never sees ECONNREFUSED),
// but we must not run DB-dependent routes until initialization completes.
// We allow only health/readiness endpoints through; everything else returns 503 "starting".
app.use((req: Request, res: Response, next: NextFunction) => {
  if (dbReady) return next();

  // Only gate API routes; static assets / SPA shell can still be served.
  if (!req.path.startsWith('/api')) return next();

  // Allow health + readiness probes even before DB is ready.
  if (req.path.startsWith('/api/health') || req.path === '/api/ready') return next();

  return res.status(503).json({
    error: 'Server starting',
    code: 'SERVER_STARTING',
    database: 'initializing',
    timestamp: new Date().toISOString(),
  });
});

const databaseInitPromise: Promise<void> =
  !isTest || process.env.E2E_MODE === 'true' || process.env.ENABLE_TEST_GATEWAY === 'true'
    ? (async () => {
        try {
          logger.info('[Server] Initializing database...');
          const db = await getDatabaseAsync();
          logger.info('[Server] Database instance created:', db ? 'OK' : 'MOCK');

          // Initialize and verify schema
          const { initializeDatabase } = await import('./database/DatabaseInitializer.js');
          const initResult = await initializeDatabase();

          if (!initResult.success) {
            logger.error(`[Server] Database initialization failed: ${initResult.message}`);
            dbReady = false;
            dbInitError = initResult.message || 'Database initialization failed';
            if (isProduction) {
              logger.error(
                '[Server] CRITICAL: Database schema incomplete. Application may not function correctly.'
              );
            }
          } else {
            logger.info(`[Server] Database initialized successfully: ${initResult.message}`);
            dbReady = true;
            dbInitError = null;
          }

          // Initialize connection pool
          if (process.env.DISABLE_CONNECTION_POOL !== 'true') {
            try {
              await initializeConnectionPool();
              logger.info('[Server] ✅ Connection pool initialized');
            } catch (poolError) {
              logger.error('[Server] Connection pool initialization failed:', poolError);
              logger.warn('[Server] Continuing with singleton database connection');
            }
          } else {
            logger.info('[Server] Connection pooling disabled (DISABLE_CONNECTION_POOL=true)');
          }

          // Schedule periodic schema verification (every 5 minutes)
          const healthCheckInterval = setInterval(
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
            5 * 60 * 1000
          ) as NodeJS.Timeout;

          (global as any).__HEALTH_CHECK_INTERVAL__ = healthCheckInterval;
        } catch (err: any) {
          const error = err as Error;
          logger.error(`[Server] Database initialization failed: ${error.message}`);
          dbReady = false;
          dbInitError = error.message || 'Database initialization failed';
          if (isProduction) {
            logger.error('[Server] CRITICAL: Cannot proceed without database. Exiting...');
            process.exit(1);
          }
        }
      })()
    : Promise.resolve();

// ============================================================
// SERVER STARTUP (moved to end of file after all routes registered)
// ============================================================

// Server will be started after all routes are registered (see end of file)

// ============================================================
// SCHEDULER & HEALTH CHECKS INITIALIZATION
// ============================================================

if (!isTest && process.env.DISABLE_SCHEDULER !== 'true') {
  // Init Scheduler (ES modules) - non-blocking
  (async () => {
    try {
      await Scheduler.init();
    } catch (err: any) {
      const error = err as Error;
      logger.error('[Server] Scheduler initialization failed:', error.message);
    }
  })();

  // Init Health Check Monitor (ES modules) - non-blocking
  (async () => {
    try {
      startHealthCheck();
    } catch (err: any) {
      const error = err as Error;
      logger.error('[Server] Health Check initialization failed:', error.message);
    }
  })();

  // Init CQRS - non-blocking
  (async () => {
    try {
      const { registerCQRSHandlers } = await import('./services/cqrs/registry.js');
      registerCQRSHandlers();
    } catch (err: any) {
      logger.error('[Server] CQRS initialization failed:', { error: err });
    }
  })();

  // ============================================================
  // LLM CONFIG INITIALIZATION - Create tables & sync providers
  // ============================================================
  (async () => {
    try {
      const { llmConfigService } = await import('./services/ai/llmConfigService.js');
      await llmConfigService.initialize();
      logger.info('[Server] ✅ LLM Config Service initialized (tables + providers synced)');
    } catch (err: any) {
      const error = err as Error;
      logger.error('[Server] LLM Config initialization failed:', error.message);
    }
  })();

  // ============================================================
  // LLM STARTUP VALIDATION - Single Source of Truth
  // ============================================================
  // Validate LLM configuration
  if (!process.env.SKIP_STARTUP_VALIDATOR) {
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
          (global as typeof globalThis & { llmHealthReport?: unknown }).llmHealthReport =
            healthReport;

          if (healthReport.criticalErrors && healthReport.criticalErrors.length > 0) {
            logger.error('[Server] ⚠️  LLM CRITICAL: Some AI features may not work');
            healthReport.criticalErrors.forEach((err: string) => logger.error(`  - ${err}`));
          }

          if (healthReport.summary && healthReport.summary.healthy > 0) {
            logger.info(
              `[Server] ✅ LLM Ready: ${healthReport.summary.healthy} provider(s) healthy`
            );
          }
        } else {
          logger.warn('[Server] Startup validation skipped (function not found)');
        }
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Server] LLM Startup Validation failed:', error.message);
      }
    })();
  } else {
    logger.info('[Server] Startup validation skipped via SKIP_STARTUP_VALIDATOR');
  }

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

  // Init AI Health Monitor (Self-Healing System) - non-blocking
  (async () => {
    try {
      const healthMonitorModule = await import('./services/ai/healthMonitor.js');
      // Debug: Log imported module keys
      logger.info('[Debug] healthMonitorModule keys:', Object.keys(healthMonitorModule));
      // The module exports a Promise as default (from lazy service loader)
      // We need to await it to get the actual healthMonitor service
      let healthMonitor: any = null;

      // Handle case where default export is a Promise (lazy loaded service)
      if (healthMonitorModule.default instanceof Promise) {
        healthMonitor = await healthMonitorModule.default;
      } else if (healthMonitorModule.default) {
        // Direct default export
        healthMonitor = healthMonitorModule.default;
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
  })();
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
              'https://fonts.googleapis.com',
              'https://fonts.gstatic.com',
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
  })
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
  })
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
    try {
      // Key by User ID when authenticated (rateLimitUserIdMiddleware sets req._rateLimitUserId)
      // This solves the "Office IP" problem where all users share one IP
      const userId = (req as any)._rateLimitUserId;
      if (userId) {
        return `api:user:${userId}`;
      }

      // Fall back to IP for unauthenticated requests
      const ip =
        req.ip ||
        req.socket?.remoteAddress ||
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.headers['x-real-ip']?.toString() ||
        'unknown';
      const safeIpKey = ip !== 'unknown' ? ipKeyGenerator(ip, 56) : 'unknown';
      const key = `api:ip:${safeIpKey}`;
      return key && key !== 'api:ip:' ? key : 'api:ip:unknown';
    } catch (error) {
      logger.warn('[RateLimit] keyGenerator error, using fallback:', error);
      return 'api:ip:unknown';
    }
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
    try {
      const email = (req.body as { email?: string })?.email;

      if (email && typeof email === 'string' && email.trim()) {
        return `auth:${email.toLowerCase().trim()}`;
      }

      // Using ipKeyGenerator for IPv6 compatibility (masks IPv6 to /56 subnet)
      // This prevents IPv6 users from bypassing limits by rotating addresses
      const ip =
        req.ip ||
        req.socket?.remoteAddress ||
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.headers['x-real-ip']?.toString() ||
        'unknown';

      // Use ipKeyGenerator helper to properly handle IPv6 addresses
      const safeIpKey = ip !== 'unknown' ? ipKeyGenerator(ip, 56) : 'unknown';

      // Ensure we return a valid string (express-rate-limit requires this)
      const key = `auth:ip:${safeIpKey}`;
      if (!key || key === 'auth:ip:') {
        return 'auth:ip:unknown';
      }
      return key;
    } catch (error) {
      // Fallback if keyGenerator throws an error
      logger.warn('[RateLimit] authLimiter keyGenerator error, using fallback:', error);
      return 'auth:ip:unknown';
    }
  },
});

// ============================================================
// CORS CONFIGURATION
// ============================================================

const corsOptions: cors.CorsOptions = {
  origin:
    process.env.FRONTEND_URL ||
    (isProduction ? false : ['http://localhost:3000', 'http://127.0.0.1:3000']),
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

// Optional JWT parse for rate-limit keying by user (avoids shared IP quota in offices)
app.use('/api/', rateLimitUserIdMiddleware);

// Apply rate limiting and security logging to API routes
app.use('/api/', apiLimiter);
import auditLogMiddleware from './middleware/auditLog.middleware.js';
app.use('/api/', auditLogMiddleware);
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
  if (
    req.path === '/auth/login' ||
    req.path === '/api/auth/login' ||
    req.originalUrl.includes('/auth/login')
  ) {
    // Do NOT log request body/headers here (credentials/token leak risk).
    logger.info('[Index] Login request received');
  }
  next();
});
if (isTest && process.env.ENABLE_TEST_GATEWAY !== 'true') {
  const managementReportsRoutes = await import('./routes/managementReports.routes.js').then(
    (m) => m.default || m
  );
  app.use('/api/management-reports', managementReportsRoutes as any);
} else {
  const { apiGateway } = await import('./Gateway.js');
  apiGateway.initializeRoutes(app);
}

// ============================================================
// STATIC FILES & CATCHALL
// ============================================================

// Determine frontend dist path
// In Docker: frontend is at /app/dist, backend runs from /app/server/dist/src or /app/server/dist
// In development: frontend is at project root /dist
logger.info('[Server] ==========================================');
logger.info('[Server] Setting up frontend static file serving...');
logger.info(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
logger.info(`[Server] __dirname: ${__dirname}`);

// Determine frontend dist path
// In production Docker: frontend is at /app/dist (confirmed by test route)
let frontendDistPath: string;
if (process.env.NODE_ENV === 'production') {
  // Production (Docker): frontend is at /app/dist
  frontendDistPath = '/app/dist';

  logger.info(`[Server] Production mode - using frontend path: ${frontendDistPath}`);
  logger.info(`[Server] Production mode - using frontend path: ${frontendDistPath}`);

  // Verify it exists
  if (fs.existsSync(frontendDistPath)) {
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      logger.info(`[Server] ✓ Frontend index.html confirmed at: ${indexPath}`);
    } else {
      logger.error(`[Server] ✗ Frontend index.html NOT found at: ${indexPath}`);
      logger.error(`[Server] ✗ Frontend index.html NOT found at: ${indexPath}`);
    }
  } else {
    logger.error(`[Server] ✗ Frontend dist directory NOT found at: ${frontendDistPath}`);
    logger.error(`[Server] ✗ Frontend dist directory NOT found at: ${frontendDistPath}`);
  }
} else {
  // Development: frontend is at project root /dist
  frontendDistPath = path.join(__dirname, '../../dist');
  logger.info(`[Server] Frontend dist path (dev): ${frontendDistPath}`);
  logger.info(`[Server] Frontend dist path (dev): ${frontendDistPath}`);
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    logger.info(`[Server] ✓ Frontend index.html found at: ${indexPath}`);
    logger.info(`[Server] ✓ Frontend index.html found at: ${indexPath}`);
  } else {
    logger.warn(`[Server] Frontend index.html NOT found at: ${indexPath}`);
    logger.warn(`[Server] Frontend index.html NOT found at: ${indexPath}`);
  }
}

// Store globally for test route and ensure it's set
try {
  (global as any).frontendDistPath = frontendDistPath;
  logger.info(`[Server] ✓ Stored frontend dist path globally: ${frontendDistPath}`);
} catch (e) {
  logger.error(`[Server] Error storing frontend dist path: ${e}`);
  logger.error(`[Server] Error storing frontend dist path: ${e}`);
}

logger.info(`[Server] Final frontend dist path: ${frontendDistPath}`);
logger.info(`[Server] Final frontend dist path: ${frontendDistPath}`);

// Helper function to serve index.html
const serveIndexHtml = (req: Request, res: Response): void => {
  // In stable dev mode we run Vite separately on :3000.
  // Serving /dist from the backend (:3001) in dev is a common source of "dead UI"
  // (stale assets, missing HMR, mismatched chunks) where navigation/sidebar appears unresponsive.
  // When VITE_STABLE_DEV=1 is set (used by `npm run dev:stable`), redirect HTML requests to Vite.
  const isDev = process.env.NODE_ENV !== 'production';
  const shouldRedirectToVite =
    isDev &&
    (process.env.VITE_STABLE_DEV === '1' || process.env.VITE_REDIRECT_TO_DEV_SERVER === '1');
  const accept = String(req.headers.accept || '');
  const wantsHtml = accept.includes('text/html') || accept.includes('application/xhtml+xml');
  const viteUrl = String(process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );

  if (shouldRedirectToVite && req.method === 'GET' && wantsHtml) {
    const target = `${viteUrl}${req.originalUrl || req.path || '/'}`;
    res.redirect(302, target);
    return;
  }

  // Use absolute path for res.sendFile (required for Railway/Docker)
  const indexPath = path.resolve(frontendDistPath, 'index.html');

  logger.info(`[Server] Serving index.html for ${req.path} from ${indexPath}`);

  if (!fs.existsSync(indexPath)) {
    logger.error(`[Server] Frontend index.html not found at: ${indexPath}`);
    res.status(500).json({
      error: {
        code: 'FRONTEND_NOT_FOUND',
        message: 'Frontend files not found',
        path: indexPath,
        __dirname,
        frontendDistPath,
        resolvedPath: path.resolve(frontendDistPath, 'index.html'),
      },
    });
    return;
  }

  // Use absolute path - res.sendFile works with absolute paths
  res.sendFile(indexPath, (err: Error | null) => {
    if (err) {
      logger.error(`[Server] Error sending index.html: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'SERVE_ERROR',
            message: 'Failed to serve frontend',
            error: err.message,
            path: indexPath,
          },
        });
      }
    } else {
      logger.info(`[Server] ✓ Successfully sent index.html for ${req.path}`);
    }
  });
};

// Explicit root route handler - MUST be before static middleware
logger.info(`[Server] Registering root route handler with frontendDistPath: ${frontendDistPath}`);

app.get('/', (req: Request, res: Response) => {
  logger.info(`[Server] ===== Root route handler EXECUTED for: ${req.path} =====`);
  logger.debug(`[Server] frontendDistPath: ${frontendDistPath}`);
  logger.debug(`[Server] indexPath will be: ${path.join(frontendDistPath, 'index.html')}`);
  serveIndexHtml(req, res);
});

// Serve static files from the React app
// fallthrough: true means continue to next middleware if file not found
app.use(
  express.static(frontendDistPath, {
    maxAge: '1y', // Cache static assets for 1 year
    etag: true,
    fallthrough: true, // Continue to next middleware if file not found
  })
);

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
// Use app.use to catch all HTTP methods and routes
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next(); // Let 404 handler catch it
  }

  // Skip static assets (they should be handled by express.static)
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return next(); // Let 404 handler catch missing static files
  }

  // Skip root path (already handled above)
  if (req.path === '/') {
    return next();
  }

  // Serve index.html for all other routes (SPA routing)
  serveIndexHtml(req, res);
});

// ============================================================
// ERROR HANDLERS
// ============================================================

// Sentry Error Handler (must be before other error handlers)
app.use(sentryHandlers.errorHandler);

// Alert Watchdog: Catch 500 errors and trigger System Alerts
import alertWatchdog from './middleware/alertWatchdog.middleware.js';
if (typeof alertWatchdog === 'function') {
  app.use(alertWatchdog);
}

// Error Handler Middleware (must be last, after all routes)
import { errorHandlerMiddleware } from './utils/ErrorHandler.js';
app.use(errorHandlerMiddleware);

// 404 Handler (must be after error handler and catchall)
// Only handle API routes that weren't caught by catchall
app.use((req: Request, res: Response) => {
  // Don't handle non-API routes here - they should be handled by catchall
  if (!req.path.startsWith('/api/')) {
    // This shouldn't happen if catchall is working, but log it and try to serve frontend
    logger.warn(`[Server] Non-API route reached 404 handler: ${req.path}`);
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      logger.info(`[Server] Fallback: Serving index.html from 404 handler for ${req.path}`);
      return res.sendFile(indexPath);
    }
  }

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
// START SERVER (after all routes are registered)
// ============================================================

const startServer = true; // Always start server when running via tsx
// IMPORTANT:
// - We DO want to start an HTTP server when this file is executed directly (e.g. `tsx src/index.ts`)
//   even if NODE_ENV=test (common for Playwright / smoke environments).
// - We do NOT want to start an HTTP server when running unit tests under Vitest, where this module
//   may be imported for app wiring.
const shouldStartHttpServer =
  process.env.START_HTTP_SERVER !== 'false' && !process.env.VITEST && process.env.VITEST !== 'true';

if (startServer && shouldStartHttpServer) {
  (async () => {
    logger.info('[Server] Starting HTTP server after route registration...');
    const server = http.createServer(app);
    // ShutdownManager will be used in graceful shutdown handler
    // const shutdownManager = getShutdownManager(30000); // 30 second timeout

    // Handle server errors
    server.on('error', (err: NodeJS.ErrnoException) => {
      logger.error('[Server] HTTP Server Error:', err);
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        // Don't exit in test mode - let the test framework handle it
        if (!isTest) {
          process.exit(1);
        }
      }
    });

    // Interval reference is stored in global scope during database initialization

    // Register shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info(`[Shutdown] Received ${signal}, initiating graceful shutdown...`);
      try {
        const mem = process.memoryUsage();
        logger.info('[Shutdown] Process context:', {
          pid: process.pid,
          ppid: process.ppid,
          platform: process.platform,
          node: process.version,
          cwd: process.cwd(),
          uptimeSeconds: Math.round(process.uptime()),
          argv: process.argv,
          env: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            DB_TYPE: process.env.DB_TYPE,
            START_HTTP_SERVER: process.env.START_HTTP_SERVER,
          },
          memory: {
            rss: mem.rss,
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external,
          },
        });
      } catch {
        // ignore
      }

      // Stop accepting new connections
      server.close(async () => {
        logger.info('[Shutdown] HTTP server closed');

        try {
          // Clear health check interval (stored in global scope)
          const healthCheckInterval = (global as any).__HEALTH_CHECK_INTERVAL__;
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            (global as any).__HEALTH_CHECK_INTERVAL__ = null;
            logger.info('[Shutdown] Health check interval cleared');
          }

          // Close BullMQ queue
          try {
            const aiQueueModule = await import('./queues/aiQueue.js');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const aiQueue: any = aiQueueModule.default;
            if (aiQueue && typeof aiQueue.close === 'function') {
              await aiQueue.close();
              logger.info('[Shutdown] BullMQ queue closed');
            }
          } catch (err: any) {
            logger.warn('[Shutdown] Error closing queue:', err.message);
          }

          // Shutdown database connection pool
          try {
            await shutdownConnectionPool();
            logger.info('[Shutdown] Database connection pool closed');
          } catch (err: any) {
            logger.warn('[Shutdown] Error closing database pool:', err.message);
          }

          // Use ShutdownManager for any registered cleanups
          const shutdownManager = getShutdownManager(10000); // 10 second timeout
          await shutdownManager.shutdown(signal);

          logger.info('[Shutdown] Graceful shutdown complete');
          // NOTE: `concurrently --restart-tries` only restarts processes that exit non-zero.
          // In dev "stable" runners we intentionally exit non-zero after SIGTERM/SIGINT so the
          // supervisor restarts the backend instead of leaving the frontend "Offline".
          const restartOnShutdown =
            process.env.DEV_RESTART_ON_SHUTDOWN === 'true' && process.env.NODE_ENV !== 'production';
          process.exit(restartOnShutdown ? 1 : 0);
        } catch (err: any) {
          logger.error('[Shutdown] Error during cleanup:', err);
          process.exit(1);
        }
      });

      // Force exit after timeout
      setTimeout(() => {
        logger.error('[Shutdown] Forced shutdown after timeout');
        process.exit(1);
      }, 15000); // 15 second timeout
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Extra diagnostics: capture exits and crashes (helps identify "who killed us" vs internal exit paths)
    process.on('exit', (code) => {
      logger.info('[Process] exit', { code, pid: process.pid, uptimeSeconds: Math.round(process.uptime()) });
    });
    process.on('beforeExit', (code) => {
      logger.info('[Process] beforeExit', { code, pid: process.pid, uptimeSeconds: Math.round(process.uptime()) });
    });
    process.on('uncaughtException', (err) => {
      logger.error('[Process] uncaughtException', { message: err?.message, stack: err?.stack });
    });

    // Start listening immediately; DB-dependent routes are gated until dbReady=true.
    logger.info('[Server] Listening immediately (API gated until DB ready)');
    server.listen(PORT, '0.0.0.0', () => {
      logger.info('✅ Server running on http://0.0.0.0:' + PORT);
      logger.info('✅ WebSocket available at ws://0.0.0.0:' + PORT + '/ws');
      logger.info(`[Server] ✅ Server started on port ${PORT}`);
      logger.info(`[Server] Frontend will be served from: ${frontendDistPath}`);
    });
  })();
}

export default app;
