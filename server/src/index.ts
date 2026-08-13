/**
 * Server Entry Point
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/index.js (CommonJS) to TypeScript (ES Modules)
 * Handles both TypeScript routes (migrated) and CommonJS routes (legacy)
 */

// CRITICAL (ESM): load env via a side-effect module that is imported FIRST.
import './config/loadEnv.js';
import { BUILD_SHA_UNKNOWN, resolveBuildSha } from './config/buildSha.js';
import type { SqlMigrationStatus } from './startup/databaseReadiness.js';

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
import { reportRateLimitStartupConfig } from './config/rateLimitPosture.js';
import { startHealthCheck } from './cron/HealthCheckJob.js';
import Scheduler from './cron/Scheduler.js';
import {
  getDatabase,
  getDatabaseAsync,
  initializeConnectionPool,
  shutdownConnectionPool,
} from './database/index.js';
import { rateLimitUserIdMiddleware } from './middleware/rateLimitUserId.middleware.js';
import { v8FeatureGate } from './middleware/v8FeatureGate.middleware.js';
import { publicKnowledgeBaseRoutes as publicV8KnowledgeBaseRoutes } from './routes/v8/knowledge-base.routes.js';
import { sendSystemAlert } from './services/systemAlertNotifier.js';
import {
  sendApiGatewayRateLimitedResponse,
  sendApiMethodNotAllowed,
  sendApiUnknownRouteNotFound,
} from './utils/apiContractResponses.js';
import { buildApiLimiterKey, getApiLimiterLimit } from './utils/apiLimiterPolicy.js';
import { resolveAllowedApiMethods } from './utils/apiRouteMethodAllowlist.js';
// TypeScript routes (migrated)
import { get as dbGet } from './utils/DbPromise.js';
import logger from './utils/Logger.js';
import RedisRateLimitStore from './utils/RedisRateLimitStore.js';
import { correlationMiddleware } from './utils/RequestStore.js';
import { getShutdownManager } from './utils/ShutdownManager.js';
import { uploadsDir } from './utils/storagePaths.js';

// Initialize app
const app: Express = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 3005;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
const skipRateLimit = process.env.DISABLE_RATE_LIMIT === 'true';
const enableRateLimitInNonProd = process.env.ENABLE_RATE_LIMIT === 'true';
const startServer = true; // Always start server when running via tsx
const shouldStartHttpServer =
  process.env.START_HTTP_SERVER !== 'false' && !process.env.VITEST && process.env.VITEST !== 'true';
let serverListening = false;

server.on('error', (err: NodeJS.ErrnoException) => {
  logger.error('[Server] HTTP Server Error:', err);
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
    if (!isTest) {
      process.exit(1);
    }
  }
});

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
import {
  createMigrationsHealthHandler,
  createReadinessGate,
  createReadyHandler,
} from './startup/readinessRoutes.js';

// Health Check (Ping) - synchronous
app.get('/ping', HealthCheckController.ping);

/**
 * REMOVED (SEC-PUB-002): `GET /test-frontend-path`.
 *
 * Anonymous, mounted here — before helmet, CORS, sanitisation, CSRF and the global
 * rate limiter — and it answered with `__dirname`, `NODE_ENV`, the resolved
 * frontend dist path and the existence of three container paths. That is the
 * deployment layout of the running container, handed to anyone who asks, with no
 * limiter and six `fs.existsSync` calls per request.
 *
 * Deleted rather than gated: it has zero consumers (`grep -rl "test-frontend-path"`
 * finds nothing in `src/`, `tests/`, `e2e/` or `scripts/`).
 *
 * CORRECTION: an earlier version of this note justified the deletion by saying the
 * resolved dist path was "already served by `/api/build-info`, which does have a
 * caller". That was wrong on both counts — the only reference to build-info was an
 * ALLOWLIST entry in `src/services/api.ts`, not a call, and build-info has since
 * been deleted for the same reasons (SEC-PUB-002).
 *
 * If a diagnostic like this is ever needed again it belongs behind the test
 * gateway conjunction used by `/api/auth/demo-login`: NODE_ENV === 'test' AND an
 * explicit enable flag AND a configured TEST_SUPPORT_KEY — never on a router that
 * production mounts.
 *
 * Coverage: tests/integration/publicSystemSurface.contract.test.ts
 */

// Mount Health Check Routes
// Registered BEFORE the shared health routers so this more specific path wins.
// Surfaces Table Platform migration state (including a deliberate
// DISABLE_TP_MIGRATIONS override) without editing shared health route files.
// `tpMigrationStatus` is declared below; the handler only reads it at request
// time, long after module initialisation.
app.get('/api/health/migrations', createMigrationsHealthHandler(getReadinessState));

app.use('/api/health', healthRoutes);
app.use('/api/health', dbHealthRoutes);
// app.use('/api/metrics', dbMetricsRoutes); // DISABLED: Conflicts with Gateway metrics routes
app.use('/api/system', systemHealthRoutes);

const CANONICAL_DEMO_HOST = 'demo.consultify.ai';
const STAGE_REDIRECT_HOSTS = new Set(['stage.consultinity.ai', 'stage.consultify.ai']);
const getRequestHost = (req: Request): string =>
  String(req.get('host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .split(':')[0];

const isStageRedirectHost = (req: Request): boolean =>
  STAGE_REDIRECT_HOSTS.has(getRequestHost(req));

// Keep staging hostname as a dead-end entrypoint and always send traffic to demo.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!isStageRedirectHost(req)) return next();
  const target = `https://${CANONICAL_DEMO_HOST}${req.originalUrl || req.url || '/'}`;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('X-Consultify-Stage-Redirect', CANONICAL_DEMO_HOST);
  return res.redirect(308, target);
});

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

/**
 * Table Platform migration outcome, surfaced on /api/ready and /api/health so
 * a failed run — or a deliberate DISABLE_TP_MIGRATIONS override — is visible
 * to operators instead of being buried in logs.
 */
let tpMigrationStatus: {
  state: 'pending' | 'ok' | 'failed' | 'disabled_by_operator';
  detail: string | null;
} = { state: 'pending', detail: null };

export function getTpMigrationStatus(): typeof tpMigrationStatus {
  return tpMigrationStatus;
}

/**
 * SQL-chain (schema_migrations) receipt, computed ONCE during startup readiness and served by
 * /api/ready and /api/health/migrations. Never recomputed per request.
 */
let sqlMigrationStatus: SqlMigrationStatus = {
  state: 'error',
  failed: 0,
  skipped: 0,
  pending: 0,
  unexplainedDrift: 0,
  approvedVariants: 0,
  attestedLegacyVariants: 0,
  detail: 'not evaluated yet',
};

/**
 * Single state source for the extracted readiness probes/gate.
 *
 * A function DECLARATION on purpose: `/api/health/migrations` is registered
 * earlier in this file than these `let` bindings, and a `const` arrow would
 * hit the temporal dead zone at module load. The body only reads the state at
 * request time, long after initialisation.
 */
function getReadinessState() {
  return {
    dbReady,
    dbInitError,
    migrations: tpMigrationStatus,
    sqlMigrations: sqlMigrationStatus,
    buildSha: resolveBuildSha(),
  };
}

// Readiness probe for load balancers / orchestration.
// Returns 503 until DB init + schema verification finishes successfully.
app.get('/api/ready', createReadyHandler(getReadinessState));

// IMPORTANT: In dev we want the HTTP server to LISTEN immediately (so the frontend proxy never sees ECONNREFUSED),
// but we must not run DB-dependent routes until initialization completes.
// We allow only health/readiness endpoints through; everything else returns 503 "starting".
app.use(createReadinessGate(getReadinessState));

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/')) {
    (req as any).db = getDatabase();
  }
  next();
});

const skipManagedSchema =
  process.env.DB_MANAGED_SCHEMA === 'false' ||
  process.env.DB_MANAGED_SCHEMA === '0' ||
  process.env.DB_MANAGED_SCHEMA === 'off';

if (skipManagedSchema) {
  logger.warn('[Server] DB_MANAGED_SCHEMA=off (no auto-DDL/migrations).');
}
if (String(process.env.DB_READONLY || '').trim()) {
  logger.warn('[Server] DB_READONLY is enabled (writes blocked).');
}

// Bind the port before heavy async startup completes so the frontend proxy does not see ECONNREFUSED.
startHttpListener();

const databaseInitPromise: Promise<void> =
  !isTest || process.env.E2E_MODE === 'true' || process.env.ENABLE_TEST_GATEWAY === 'true'
    ? (async () => {
        try {
          const mockDbEnabled =
            process.env.MOCK_DB === 'true' ||
            (process.env.NODE_ENV === 'test' &&
              process.env.RUN_DB_TESTS !== '1' &&
              process.env.MOCK_DB !== 'false');

          logger.info('[Server] Initializing database...');
          const db = await getDatabaseAsync();
          logger.info('[Server] Database instance created:', db ? 'OK' : 'MOCK');

          if ((db as any)?.isMock || mockDbEnabled) {
            logger.info('[Server] MOCK_DB enabled; skipping schema init + connection pool');
            dbReady = true;
            dbInitError = null;
            return;
          }

          // Initialize and verify schema
          const { initializeDatabase } = await import('./database/DatabaseInitializer.js');
          const initResult = skipManagedSchema
            ? {
                success: true,
                message: 'DB_MANAGED_SCHEMA disabled; skipping initializeDatabase()',
              }
            : await initializeDatabase();

          if (!initResult.success) {
            logger.error(`[Server] Database initialization failed: ${initResult.message}`);
            dbReady = false;
            dbInitError = initResult.message || 'Database initialization failed';
            if (isProduction) {
              logger.error(
                '[Server] CRITICAL: Database schema incomplete. Refusing to serve traffic. Exiting...'
              );
              process.exit(1);
            }
            // Dev/test: stay alive, but explicitly NOT ready. The /api gate
            // above keeps every business route on 503 while dbReady is false.
            logger.error(
              '[Server] Database schema incomplete — staying up in DEGRADED/NOT-READY state (no traffic served).'
            );
            return;
          }

          logger.info(`[Server] Database schema initialized: ${initResult.message}`);

          // Initialize connection pool
          if (process.env.DISABLE_CONNECTION_POOL !== 'true') {
            try {
              const poolTimeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Connection pool init timeout (15s)')), 15000)
              );
              await Promise.race([initializeConnectionPool(), poolTimeout]);
              logger.info('[Server] ✅ Connection pool initialized');
            } catch (poolError) {
              logger.error('[Server] Connection pool initialization failed:', poolError);
              logger.warn('[Server] Continuing with singleton database connection');
            }
          } else {
            logger.info('[Server] Connection pooling disabled (DISABLE_CONNECTION_POOL=true)');
          }

          // ── Table Platform migrations — PART OF READINESS ─────────────────
          // Previously deferred to a 5s setTimeout AFTER dbReady=true, which
          // published the app with a possibly incomplete schema and reduced a
          // migration failure to a log line. The sequence now lives in
          // ./startup/databaseReadiness.ts so its order and failure policy are
          // testable; schema init already succeeded above.
          const { establishDatabaseReadiness } = await import('./startup/databaseReadiness.js');
          const outcome = await establishDatabaseReadiness({
            initializeSchema: async () => ({ success: true, message: 'verified above' }),
            // No arguments: production always resolves the canonical directory.
            runMigrations: async () => {
              const { runMigrations } = await import('./services/tablePlatform/migrationRunner.js');
              return runMigrations();
            },
            evaluateSqlChain: async () => {
              const { evaluateSqlChain } = await import('./services/releaseGate/sqlChainEvaluator.js');
              const { getDatabase } = await import('./database/Database.js');
              const path = await import('path');
              return evaluateSqlChain({
                db: getDatabase() as any,
                migrationsDir: path.resolve(process.cwd(), 'server/migrations'),
              });
            },
            seedTemplates: async () => {
              const { default: templateService } =
                await import('./services/tablePlatform/TemplateService.js');
              if (templateService?.seedDefaultTemplates) {
                await templateService.seedDefaultTemplates();
              }
            },
            isProduction,
            migrationsDisabled: process.env.DISABLE_TP_MIGRATIONS === 'true',
            logger: {
              info: (m) => logger.info(m),
              warn: (m) => logger.warn(m),
              error: (m) => logger.error(m),
            },
            alert: async (title, message) => {
              await sendSystemAlert({
                title,
                message,
                severity: 'CRITICAL',
                source: 'Database',
                throttleKey: 'tp_migration_failed',
                throttleMs: 15 * 60 * 1000,
              });
            },
          });

          tpMigrationStatus = outcome.migrations;
          sqlMigrationStatus = outcome.sqlMigrations;

          if (!outcome.ready) {
            dbReady = false;
            dbInitError = outcome.error;
            if (outcome.shouldExitProcess) {
              logger.error('[Server] CRITICAL: incomplete schema in production. Exiting...');
              process.exit(1);
            }
            logger.error(
              '[Server] Staying up in DEGRADED/NOT-READY state — /api/ready reports 503 and no business route is served.'
            );
            return; // nothing seeded, never ready
          }

          // Schema verified AND migrations settled — only now is the app ready.
          dbReady = true;
          dbInitError = null;
          logger.info('[Server] ✅ Database ready — serving traffic');

          // Schedule periodic schema verification (every 5 minutes)
          const healthCheckInterval = setInterval(
            async () => {
              try {
                const { verifyDatabaseHealth } = await import('./database/DatabaseInitializer.js');
                const healthy = await verifyDatabaseHealth();
                if (!healthy) {
                  logger.warn('[Server] Database health check failed - schema may be incomplete');
                  await sendSystemAlert({
                    title: 'Database schema health degraded',
                    message:
                      'Periodic database verification failed. Schema may be incomplete or migrations are missing.',
                    severity: 'WARNING',
                    source: 'Database',
                    throttleKey: 'database_schema_health_failed',
                    throttleMs: 30 * 60 * 1000,
                  });
                }
              } catch (err: any) {
                const error = err as Error;
                logger.error(`[Server] Database health check error: ${error.message}`);
                await sendSystemAlert({
                  title: 'Database health check error',
                  message: error.message,
                  severity: 'CRITICAL',
                  source: 'Database',
                  throttleKey: 'database_health_check_error',
                  throttleMs: 15 * 60 * 1000,
                });
              }
            },
            5 * 60 * 1000
          ) as NodeJS.Timeout;

          (global as any).__HEALTH_CHECK_INTERVAL__ = healthCheckInterval;
        } catch (err: any) {
          const error = err as Error;
          logger.error(`[Server] Database initialization failed: ${error.message}`);
          await sendSystemAlert({
            title: 'Database initialization failed',
            message: error.message || 'Database initialization failed',
            severity: 'CRITICAL',
            source: 'Database',
            throttleKey: 'database_initialization_failed',
            throttleMs: 15 * 60 * 1000,
          });
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

const deferredStartupDelayMs = Number(process.env.DEFER_NONCRITICAL_STARTUP_MS || 0);
const llmConfigStartupDelayMs = Number(
  process.env.DEFER_LLM_CONFIG_INIT_MS || deferredStartupDelayMs
);

const scheduleStartupTask = (
  task: () => Promise<void>,
  delayMs: number = deferredStartupDelayMs
): void => {
  const timer = setTimeout(
    () => {
      void task();
    },
    Math.max(0, delayMs)
  );
  timer.unref?.();
};

if (!isTest && process.env.DISABLE_SCHEDULER !== 'true') {
  // Init Scheduler (ES modules) - non-blocking
  scheduleStartupTask(async () => {
    try {
      await Scheduler.init();
    } catch (err: any) {
      const error = err as Error;
      logger.error('[Server] Scheduler initialization failed:', error.message);
    }
  });

  // Hourly AI Ops snapshot to Slack (non-blocking)
  scheduleStartupTask(async () => {
    try {
      const { startAIOpsReportCron } = await import('./cron/AIOpsReportCron.js');
      startAIOpsReportCron();
    } catch (err: any) {
      logger.warn('[Server] AI Ops report cron failed to start', { error: err?.message || err });
    }
  });

  // Init Health Check Monitor (ES modules) - non-blocking
  if (process.env.DISABLE_STARTUP_HEALTH_MONITOR !== 'true') {
    scheduleStartupTask(async () => {
      try {
        startHealthCheck();
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Server] Health Check initialization failed:', error.message);
      }
    });
  } else {
    logger.info('[Server] Health Check monitor skipped via DISABLE_STARTUP_HEALTH_MONITOR');
  }

  // Init CQRS - non-blocking
  scheduleStartupTask(async () => {
    try {
      const { registerCQRSHandlers } = await import('./services/cqrs/registry.js');
      registerCQRSHandlers();
    } catch (err: any) {
      logger.error('[Server] CQRS initialization failed:', { error: err });
    }
  });

  // M16 P2-1: Organization Context background rebuild sweep (every 4h) - non-blocking
  scheduleStartupTask(async () => {
    try {
      const { startOrgContextRebuildJob } = await import('./jobs/orgContextRebuildJob.js');
      startOrgContextRebuildJob();
      logger.info('[Server] ✅ Org Context rebuild job scheduled');
    } catch (err: any) {
      logger.error('[Server] Org Context rebuild job failed to start:', err?.message);
    }
  });

  // H3.6: Deliverables generation watchdog (deck/doc/sheet timeout sweep) - non-blocking
  scheduleStartupTask(async () => {
    try {
      const { startGenerationWatchdog } =
        await import('./services/deliverables/generationWatchdog.js');
      startGenerationWatchdog();
      logger.info('[Server] ✅ Deliverables generation watchdog started');
    } catch (err: any) {
      logger.error('[Server] Deliverables generation watchdog failed to start:', err?.message);
    }
  });

  // V4-TASK-05: Init Automation Rules Engine - non-blocking
  scheduleStartupTask(async () => {
    try {
      const { initAutomationRulesEngine } = await import('./services/automationRulesEngine.js');
      initAutomationRulesEngine();
      logger.info('[Server] ✅ Automation Rules Engine initialized');
    } catch (err: any) {
      logger.error('[Server] Automation Rules Engine initialization failed:', err?.message);
    }
  });

  // Scheduled Automations Executor (cron-based) - non-blocking
  scheduleStartupTask(async () => {
    try {
      const { scheduledAutomationExecutor } =
        await import('./services/tablePlatform/ScheduledAutomationExecutor.js');
      scheduledAutomationExecutor.start(60_000);
      logger.info('[Server] ✅ Scheduled Automation Executor started (60s interval)');
    } catch (err: any) {
      logger.error('[Server] Scheduled Automation Executor failed:', err?.message);
    }
  });

  // Results enterprise runtime executor - non-blocking
  scheduleStartupTask(async () => {
    try {
      const { resultsEnterpriseRuntimeExecutor } =
        await import('./services/results/ResultsEnterpriseRuntimeExecutor.js');
      resultsEnterpriseRuntimeExecutor.start(60_000);
      logger.info('[Server] ✅ Results Enterprise Runtime Executor started (60s interval)');
    } catch (err: any) {
      logger.error('[Server] Results Enterprise Runtime Executor failed:', err?.message);
    }
  });

  // ============================================================
  // LLM CONFIG INITIALIZATION - Create tables & sync providers
  // ============================================================
  scheduleStartupTask(async () => {
    try {
      const { llmConfigService } = await import('./services/ai/llmConfigService.js');
      await llmConfigService.initialize();
      logger.info('[Server] ✅ LLM Config Service initialized (tables + providers synced)');

      // Ensure purpose routing schema + seed baseline assignments so model routing has coverage.
      // This prevents "Purpose coverage missing" alerts on fresh/legacy DBs.
      try {
        const { ensureRoutingSchemaAndSeedDefaults } =
          await import('./services/ai/aiRoutingBootstrapService.js');
        await ensureRoutingSchemaAndSeedDefaults();
        logger.info('[Server] ✅ AI purpose routing bootstrap complete');
      } catch (err: any) {
        const e = err as Error;
        logger.warn('[Server] AI purpose routing bootstrap failed (continuing):', e.message);
      }
    } catch (err: any) {
      const error = err as Error;
      logger.error('[Server] LLM Config initialization failed:', error.message);
      await sendSystemAlert({
        title: 'LLM config initialization failed',
        message: error.message,
        severity: 'CRITICAL',
        source: 'LLM',
        throttleKey: 'llm_config_initialization_failed',
        throttleMs: 30 * 60 * 1000,
      });
    }
  }, llmConfigStartupDelayMs);

  // ============================================================
  // LLM STARTUP VALIDATION - Single Source of Truth
  // ============================================================
  // Validate LLM configuration
  if (!process.env.SKIP_STARTUP_VALIDATOR) {
    scheduleStartupTask(async () => {
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
            await sendSystemAlert({
              title: 'LLM startup validation reported critical errors',
              message: healthReport.criticalErrors.join(' | '),
              severity: 'CRITICAL',
              source: 'LLM',
              throttleKey: 'llm_startup_validation_critical',
              throttleMs: 30 * 60 * 1000,
            });
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
        await sendSystemAlert({
          title: 'LLM startup validation failed',
          message: error.message,
          severity: 'CRITICAL',
          source: 'LLM',
          throttleKey: 'llm_startup_validation_failed',
          throttleMs: 30 * 60 * 1000,
        });
      }
    }, llmConfigStartupDelayMs);
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
  if (process.env.DISABLE_AI_HEALTH_MONITOR !== 'true') {
    scheduleStartupTask(async () => {
      try {
        const healthMonitorModule = await import('./services/ai/healthMonitor.js');
        logger.info('[Debug] healthMonitorModule keys:', Object.keys(healthMonitorModule));
        let healthMonitor: any = null;

        if (healthMonitorModule.default instanceof Promise) {
          healthMonitor = await healthMonitorModule.default;
        } else if (healthMonitorModule.default) {
          healthMonitor = healthMonitorModule.default;
        }

        if (healthMonitor) {
          healthMonitor.start(60000);

          healthMonitor.onAlert((alert: { message: string; checks?: string[] }) => {
            logger.error('[AI Health] CRITICAL ALERT:', alert.message);
            logger.error('[AI Health] Failed checks:', alert.checks?.join(', '));
            void sendSystemAlert({
              title: 'AI health monitor detected persistent failures',
              message: `${alert.message}${alert.checks?.length ? ` | Failed checks: ${alert.checks.join(', ')}` : ''}`,
              severity: 'CRITICAL',
              source: 'AI/LLM',
              throttleKey: 'ai_health_monitor_persistent_failures',
              throttleMs: 15 * 60 * 1000,
            });
          });

          logger.info('[Server] AI Health Monitor started (self-healing enabled)');
        } else {
          logger.warn('[Server] AI Health Monitor not available (export not found)');
        }
      } catch (err: any) {
        const error = err as Error;
        logger.warn('[Server] AI Health Monitor not available:', error.message);
      }
    }, llmConfigStartupDelayMs);
  } else {
    logger.info('[Server] AI Health Monitor skipped via DISABLE_AI_HEALTH_MONITOR');
  }

  // Init AI Provider Sentinel (continuous provider diagnostics) - non-blocking
  scheduleStartupTask(async () => {
    try {
      if (process.env.DISABLE_AI_PROVIDER_SENTINEL === 'true') return;
      const { default: providerSentinel } = await import('./services/ai/providerSentinel.js');
      const intervalMs = Number(process.env.AI_PROVIDER_SENTINEL_INTERVAL_MS || 120_000);
      providerSentinel.start(Number.isFinite(intervalMs) ? intervalMs : 120_000);
      logger.info('[Server] AI Provider Sentinel started');
    } catch (err: any) {
      const error = err as Error;
      logger.warn('[Server] AI Provider Sentinel not available:', error.message);
    }
  }, llmConfigStartupDelayMs);
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

/**
 * Declare the rate-limit posture ONCE, at boot, before a single request is
 * served. Until now the posture was only ever inferred per request from silent
 * env defaults, so a typo or a leftover `DISABLE_RATE_LIMIT=true` produced a
 * server that booted happily and enforced nothing.
 *
 * With `RATE_LIMIT_POSTURE` unset (today's staging) this only LOGS: the resolver
 * produces no errors for an inferred posture, so behaviour is unchanged. Errors
 * are only possible once someone declares the posture explicitly, which is the
 * point — declaring it buys fail-fast.
 */
const rateLimitStartupConfig = reportRateLimitStartupConfig(logger, process.env);
if (rateLimitStartupConfig.errors.length > 0 && !isTest) {
  logger.error(
    '[RateLimit] refusing to start: the declared rate limit posture cannot be satisfied'
  );
  process.exit(1);
}

// `throwOnError` is deliberately NOT passed here: these gateway limiters front
// authenticated product traffic and must keep failing OPEN on a Redis blip.
// The demo signup limiters opt in separately — see rateLimiting.middleware.ts.
const redisStore = new RedisRateLimitStore({ windowMs: 15 * 60 * 1000 });
const authRedisStore = new RedisRateLimitStore({ windowMs: 60 * 60 * 1000 });

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // The authenticated SPA shell fans out across multiple modules and background polls.
  // Keep a tighter bucket for anonymous traffic, but do not undercut authenticated
  // route-level limiters with the global gateway cap.
  limit: (req) => getApiLimiterLimit(req, isProduction),
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  skip: (req) =>
    skipRateLimit ||
    isTest ||
    (!isProduction && !enableRateLimitInNonProd) ||
    req.originalUrl.includes('/api/auth/'),
  handler: (req, res) => {
    sendApiGatewayRateLimitedResponse(req, res);
  },
  keyGenerator: (req) => {
    try {
      const rateLimitUserId = (req as Request & { _rateLimitUserId?: string })._rateLimitUserId;
      if (rateLimitUserId) return `api:v2:user:${rateLimitUserId}`;
      return buildApiLimiterKey(req);
    } catch (error) {
      logger.warn('[RateLimit] keyGenerator error, using fallback:', error);
      return 'api:v2:ip:unknown';
    }
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 15 : 1000,
  store: authRedisStore,
  skip: (req) => {
    if (skipRateLimit || isTest) return true;
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

const consultifyProdOriginRegex = /^https:\/\/(www\.)?consultify\.ai$/i;

// Fail-safe: keep a literal "isProduction ? false" branch so the security integrity gate can
// validate we deny CORS by default in production when FRONTEND_URL is missing.
const productionCorsDisabled: cors.CorsOptions['origin'] = isProduction ? false : undefined;

const productionCorsOrigin: cors.CorsOptions['origin'] = (origin, callback) => {
  const front = process.env.FRONTEND_URL?.trim();
  // Non-browser clients (same-origin server-side) often omit Origin.
  if (!origin) return callback(null, true);
  // FRONTEND_URL is required for browser-originated traffic in production.
  if (!front) return callback(null, false);
  if (origin === front) return callback(null, true);
  if (consultifyProdOriginRegex.test(origin)) return callback(null, true);
  return callback(null, false);
};

const corsOptions: cors.CorsOptions = {
  origin: isProduction
    ? process.env.FRONTEND_URL
      ? productionCorsOrigin
      : productionCorsDisabled
    : process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-access-token',
    'x-csrf-token',
    'X-Demo-Mode',
    'x-demo-mode',
    'X-Correlation-ID',
    'x-correlation-id',
    'X-App-Language',
    'x-app-language',
    'Accept-Language',
    'accept-language',
  ],
};
app.use(cors(corsOptions));

// Sentry Request Handler (must be FIRST middleware - before body parsing)
app.use(sentryHandlers.requestHandler);

// Sentry Tracing Handler (must be after request handler, before routes)
app.use(sentryHandlers.tracingHandler);

// Correlation & Context Tracking
// Keep before JSON parsing so malformed/oversized JSON still gets correlation headers.
app.use(correlationMiddleware);

// Body Parsing, Cookies & Static Files
// Stripe webhooks require the *raw* request body for signature verification.
// Since `express.json()` consumes the stream, we conditionally route body parsing.
const jsonParser = express.json({ limit: '10mb' });
const stripeRawParser = express.raw({ type: 'application/json' });
// Slack (Slack Command Center, F2) signs the *exact* raw request body
// (`v0:{timestamp}:{rawBody}` HMAC-SHA256). Re-serializing a JSON-parsed body
// would break the signature, so — like Stripe — we hand these endpoints the
// untouched bytes as a Buffer and parse them ourselves inside the route.
// `type: '*/*'` because interactions arrive as x-www-form-urlencoded and the
// Events API as application/json.
const slackRawParser = express.raw({ type: '*/*', limit: '1mb' });
app.use((req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  if (path === '/api/webhooks/stripe' || path === '/api/token-billing/webhook') {
    return stripeRawParser(req, res, next);
  }
  if (path === '/api/slack/events' || path === '/api/slack/interactions') {
    return slackRawParser(req, res, next);
  }
  return jsonParser(req, res, next);
});
app.use(cookieParser()); // Required for CSRF protection
// G2 fix (P0 storage volume): this used to be
// `express.static(path.join(__dirname, '../uploads'), ...)`. `__dirname` here
// is the compiled module's own directory (`dist/src` in the built container),
// so `../uploads` resolved to `<cwd>/dist/uploads` — ONE level short of every
// write-side call site in this codebase, which all write to
// `<cwd>/uploads/...` (now `uploadsDir()` / `baseStorageDir()/uploads`, see
// utils/storagePaths.ts). Routing the static mount through the same helper
// both fixes that write/read base-dir mismatch and makes `/uploads/*` respect
// STORAGE_DIR/RAILWAY_VOLUME_MOUNT_PATH once a persistent volume is mounted.
app.use(
  '/uploads',
  express.static(uploadsDir(), {
    // Stored-XSS hardening (M23 L-09) for user-uploaded assets (e.g. branding
    // SVG logos). Even if a malicious SVG slipped past upload-time
    // sanitization, these response headers prevent any embedded
    // <script>/on*-handler from executing in our origin when the file is
    // opened directly: the sandbox CSP runs the document in a unique opaque
    // origin with scripts disabled, and nosniff stops MIME-confusion attacks.
    setHeaders: (res: Response, filePath: string) => {
      const ext = path.extname(filePath).toLowerCase();
      if (
        ext === '.svg' ||
        ext === '.svgz' ||
        ext === '.xml' ||
        ext === '.html' ||
        ext === '.htm'
      ) {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; style-src 'unsafe-inline'; sandbox"
        );
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
    },
  })
);
const kbStaticCandidates = [
  path.join(__dirname, '../../public/kb'),
  path.join(__dirname, '../public/kb'),
  path.join(process.cwd(), 'public/kb'),
  path.join(process.cwd(), 'server/public/kb'),
];
const kbStaticDir = kbStaticCandidates.find((d) => fs.existsSync(d)) || kbStaticCandidates[0];
app.use('/kb', express.static(kbStaticDir, { maxAge: '7d', immutable: true }));

// Brand logos (#21): the Vite build's dist/assets/logos/* are not reliably
// packaged into the prod container, so /assets/logos/*.svg 404s on the login
// screen. Serve them authoritatively from the backend's bundled public dir
// (shipped via Dockerfile COPY server/public). fallthrough lets Vite's own
// hashed /assets/*.js|css continue to be served by the frontend static layer.
const brandLogoCandidates = [
  path.join(__dirname, '../../public/assets/logos'),
  path.join(__dirname, '../public/assets/logos'),
  path.join(process.cwd(), 'public/assets/logos'),
  path.join(process.cwd(), 'server/public/assets/logos'),
];
const brandLogoDir = brandLogoCandidates.find((d) => fs.existsSync(d)) || brandLogoCandidates[0];
app.use('/assets/logos', express.static(brandLogoDir, { maxAge: '7d' }));

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

// Public KB V8 bridge is mounted here as well as in ApiGateway.
// This avoids staged runtime drift where Gateway route updates may lag behind
// the rest of the deployed backend while we finish the anonymous KB packet.
app.use('/api/public/kb-v8', v8FeatureGate, publicV8KnowledgeBaseRoutes);

// MyWork Table UI expects workspace connectors endpoints to exist; when the
// connectors subsystem isn't enabled yet the frontend can get stuck retrying 404s.
const workspacesRoutes = await import('./routes/workspaces.routes.js').then((m) => m.default || m);
app.use('/api/workspaces', workspacesRoutes as any);

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
// 1. FRONTEND_DIST_PATH env var - explicit override for any deployment
// 2. Production (NODE_ENV=production): frontend is at /app/dist in Docker
// 3. Docker context (__dirname under /app/server): use /app/dist - avoids wrong path
//    when NODE_ENV isn't set but we're in Docker.api (path.join gives /app/server/dist)
// 4. Development: frontend is at project root /dist (path.join(__dirname, '../../dist'))
let frontendDistPath: string;
if (process.env.FRONTEND_DIST_PATH) {
  frontendDistPath = path.resolve(process.env.FRONTEND_DIST_PATH);
  logger.info(`[Server] Using FRONTEND_DIST_PATH: ${frontendDistPath}`);
} else if (process.env.NODE_ENV === 'production') {
  frontendDistPath = '/app/dist';
  logger.info(`[Server] Production mode - using frontend path: ${frontendDistPath}`);
} else if (__dirname.includes('/app/server')) {
  // Docker.api combined deployment when NODE_ENV isn't 'production'
  // path.join(__dirname, '../../dist') would wrongly resolve to /app/server/dist
  frontendDistPath = '/app/dist';
  logger.info(`[Server] Docker context detected - using frontend path: ${frontendDistPath}`);
} else {
  frontendDistPath = path.join(__dirname, '../../dist');
  logger.info(`[Server] Frontend dist path (dev): ${frontendDistPath}`);
}

// Verify it exists
const indexPath = path.join(frontendDistPath, 'index.html');
if (fs.existsSync(frontendDistPath) && fs.existsSync(indexPath)) {
  logger.info(`[Server] ✓ Frontend index.html confirmed at: ${indexPath}`);
} else if (fs.existsSync(indexPath)) {
  logger.info(`[Server] ✓ Frontend index.html found at: ${indexPath}`);
} else {
  logger.error(`[Server] Frontend index.html not found at: ${indexPath}`);
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

/**
 * REMOVED (SEC-PUB-002): `GET /__build-info`, `GET /api/build-info`,
 * `GET /__build-graph`, `GET /api/build-graph`.
 *
 * All four were unrate-limited and mounted here — ahead of helmet, CORS,
 * sanitisation, CSRF, the global limiter and audit logging.
 *
 * ACCESSIBILITY, precisely: the `/__*` pair was reachable ANONYMOUSLY; the
 * `/api/*` pair sat behind the auth catch-all at :222 and required a token. All
 * four were unnecessary and all four disclosed once the handler was reached, but
 * only two of them were anonymous.
 *
 * DISCLOSURE: they returned `frontendDistPath`, `indexPath`, `bundleFsPath`,
 * `bundlePublicPath`, `entryPublicPath` and `assetsPath` — the container's
 * directory layout, to anyone who asked, in a 200 body.
 *
 * COST: `build-info` did a `readdirSync` of the assets directory and a
 * `readFileSync` of EVERY `.js` chunk per request. `build-graph` did the same and
 * then walked the whole import graph. Both synchronous, both before any
 * authorization inside the handler — and on the `/__*` pair, reachable with no
 * credential at all. A resource-exhaustion surface as much as a disclosure one.
 *
 * Deleted rather than guarded: an exhaustive consumer hunt (frontend, backend,
 * scripts, CI, Dockerfiles, railway.json, Playwright configs, tests, runbooks and
 * handoffs, plus a search on the response field names rather than the paths)
 * found NO active consumer. Git history explains why: `6dc4063fef` added
 * build-info together with an allowlist entry in `src/services/api.ts` for a
 * caller that was never written, and `db065c29bc` described build-graph as
 * something that "can be used as a hard runtime gate in staging" — a gate nothing
 * in CI, scripts or Playwright ever implemented.
 *
 * RESIDUAL RISK, stated rather than hidden: static search cannot see a human.
 * build-graph was built to spot stale chunk/entry mismatches after a deploy, and
 * this project's operators do verify deploys by hand with curl. If that habit
 * exists and is undocumented, this removes it. The capability should then come
 * back as ONE superadmin-only route with a limiter, no filesystem paths in any
 * response including errors, and the scan cached or moved off the request path —
 * not as four anonymous aliases.
 *
 * Coverage: tests/integration/buildSurfaceRemoved.contract.test.ts
 */


const isStaticAssetRequest = (requestPath: string): boolean =>
  /\.[a-z0-9]+$/i.test(requestPath) ||
  requestPath.startsWith('/assets/') ||
  requestPath.startsWith('/icons/') ||
  requestPath.startsWith('/locales/') ||
  requestPath.startsWith('/manifest');

const isStagingOrDemoHost = (req: Request): boolean =>
  getRequestHost(req) === CANONICAL_DEMO_HOST || isStageRedirectHost(req);

const resolveCurrentIndexBundlePath = (): { publicPath: string; fsPath: string } | null => {
  const htmlPath = path.resolve(frontendDistPath, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;

  try {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const bundleMatch = html.match(/\/assets\/index-[^"']+\.js/);
    const publicPath = bundleMatch?.[0];
    if (!publicPath) return null;

    const fsPath = path.resolve(frontendDistPath, publicPath.replace(/^\//, ''));
    if (!fs.existsSync(fsPath)) return null;

    return { publicPath, fsPath };
  } catch (error: any) {
    logger.warn(`[Server] Failed to resolve current frontend bundle: ${error?.message || error}`);
    return null;
  }
};

// Helper function to serve index.html
const isViteServerReachable = async (viteUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const probeUrl = `${viteUrl}/@vite/client`;
    const response = await fetch(probeUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: '*/*' },
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * The one body the SPA catch-all is allowed to return when it cannot serve the
 * frontend. It is constant and carries no deployment detail: this handler answers
 * every unknown non-API path for anonymous callers, so any path, __dirname or
 * error message placed here would be a public disclosure of the deployment
 * layout. Diagnostics belong in the server log — see the two call sites below.
 *
 * Status stays 500: a missing frontend bundle is a server-side deployment fault,
 * and 503 would additionally promise the caller that retrying helps, which is
 * wrong for a bundle that is simply not on disk.
 */
const FRONTEND_UNAVAILABLE_BODY = Object.freeze({
  error: Object.freeze({
    code: 'FRONTEND_NOT_FOUND',
    message: 'Frontend unavailable',
  }),
});

const serveIndexHtml = async (req: Request, res: Response): Promise<void> => {
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
    const isReachable = await isViteServerReachable(viteUrl);
    if (isReachable) {
      const target = `${viteUrl}${req.originalUrl || req.path || '/'}`;
      res.redirect(302, target);
      return;
    }
    logger.warn(
      `[Server] Vite redirect requested but dev server is unreachable (${viteUrl}); serving dist index instead`
    );
  }

  // Use absolute path for res.sendFile (required for Railway/Docker)
  const indexPath = path.resolve(frontendDistPath, 'index.html');

  logger.info(`[Server] Serving index.html for ${req.path} from ${indexPath}`);

  if (!fs.existsSync(indexPath)) {
    // The deployment layout is an operator concern, never a caller concern: the
    // catch-all answers every unknown non-API path, so anything put in this body
    // is readable by any anonymous visitor. Detail goes to the log only.
    logger.error(
      `[Server] Frontend index.html not found for ${req.method} ${req.path} — ` +
        `indexPath=${indexPath} frontendDistPath=${frontendDistPath} __dirname=${__dirname}`
    );
    res.status(500).json(FRONTEND_UNAVAILABLE_BODY);
    return;
  }

  // Use absolute path - res.sendFile works with absolute paths
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('X-Consultify-Cache-Guard', 'staging-cache-kill-v3');
  res.sendFile(indexPath, (err: Error | null) => {
    if (err) {
      // Same reasoning as above: the failure detail is logged, never returned.
      logger.error(
        `[Server] Error sending index.html for ${req.method} ${req.path} — indexPath=${indexPath}`,
        err
      );
      if (!res.headersSent) {
        res.status(500).json(FRONTEND_UNAVAILABLE_BODY);
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
  void serveIndexHtml(req, res);
});

app.get('/sw.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Clear-Site-Data', '"cache"');
  res.setHeader('X-Consultify-Service-Worker', 'kill-switch-v1');
  res.status(200).send(`
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  })());
});
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map((client) => client.navigate(client.url)));
  })());
});
`);
});

// NOTE:
// Do not special-case all /assets/index-*.js requests here.
// Vite can emit non-entry chunks named index-*.js (e.g. module index.ts chunks),
// and intercepting them as "stale entry" can break lazy loading.

// Serve static files from the React app
// fallthrough: true means continue to next middleware if file not found
const isHashedAssetFilename = (filename: string): boolean =>
  /-[a-z0-9]{8,}\.(js|css|map|png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/i.test(filename);

const isMissingHashedJsChunkRequest = (requestPath: string): boolean =>
  /^\/assets\/[^/]+-[a-z0-9]{8,}\.js$/i.test(requestPath);

const extractRelativeJsImports = (jsSource: string): string[] => {
  if (!jsSource) return [];
  const matches = jsSource.matchAll(/['"]\.\/([^'"]+\.js)['"]/g);
  const out = new Set<string>();
  for (const match of matches) {
    const imported = String(match?.[1] || '').trim();
    if (!imported) continue;
    out.add(`/assets/${imported}`);
  }
  return Array.from(out);
};

const sendStaleChunkReloadScript = (req: Request, res: Response): void => {
  logger.warn(`[Server] Missing hashed JS chunk, forcing client reload: ${req.path}`);
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('X-Consultify-Stale-Chunk-Guard', 'reload-current-build-v1');
  res.status(200).send(`
console.warn('[Consultify] Stale application chunk missing: ${JSON.stringify(req.path)}. Reloading current build.');
(function () {
  try {
    var key = 'consultify:stale-chunk-reload';
    var now = Date.now();
    var last = Number(sessionStorage.getItem(key) || '0');
    if (now - last < 10000) {
      throw new Error('Stale chunk reload throttled');
    }
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  } catch (error) {
    window.location.href = '/?recoveredFromStaleChunk=1';
  }
})();
export {};
`);
};

const staticFrontendSmartCache = express.static(frontendDistPath, {
  maxAge: 0,
  setHeaders: (res, filePath) => {
    const normalized = String(filePath || '');
    const filename = path.basename(normalized);
    const isAssetsDir = normalized.includes(`${path.sep}assets${path.sep}`);

    // Prefer performance for content-hashed Vite assets: safe to cache forever.
    if (isAssetsDir && isHashedAssetFilename(filename)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Surrogate-Control', 'public, max-age=31536000, immutable');
      return;
    }

    // Never cache HTML (entry point is controlled by serveIndexHtml anyway).
    if (filename.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      return;
    }

    // Small non-hashed assets (manifest/locales/icons) can be cached briefly.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Surrogate-Control', 'public, max-age=3600');
  },
  fallthrough: true,
});

// Short, branded redirect for the VTS wave-2 shared invitation link.
// Keeps the e-mail clean: https://consultify.ai/vts -> full /invite/<token>.
app.get('/vts', (_req: Request, res: Response) =>
  res.redirect(302, '/invite/0728c1a701b9f5995810714921de5f6a3b201fd78d4665178e8c07bb6e69c7ea')
);

app.use(staticFrontendSmartCache);

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
// Use app.use to catch all HTTP methods and routes
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next(); // Let 404 handler catch it
  }

  // Skip static assets (they should be handled by express.static)
  if (isStaticAssetRequest(req.path)) {
    return next(); // Let 404 handler catch missing static files
  }

  // Skip root path (already handled above)
  if (req.path === '/') {
    return next();
  }

  // Serve index.html for all other routes (SPA routing)
  void serveIndexHtml(req, res);
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
    if (isStaticAssetRequest(req.path)) {
      if (/^\/assets\/index-[^/]+\.js$/.test(req.path)) {
        logger.warn(`[Server] 404 stale frontend entry requested: ${req.path}. Forcing reload.`);
        return sendStaleChunkReloadScript(req, res);
      }

      if (isMissingHashedJsChunkRequest(req.path)) {
        return sendStaleChunkReloadScript(req, res);
      }

      logger.warn(`[Server] Missing static asset: ${req.path}`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(404).json({
        error: {
          code: 'ASSET_NOT_FOUND',
          message: `Static asset ${req.path} not found`,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // This shouldn't happen if catchall is working, but log it and try to serve frontend
    logger.warn(`[Server] Non-API route reached 404 handler: ${req.path}`);
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      logger.info(`[Server] Fallback: Serving index.html from 404 handler for ${req.path}`);
      return res.sendFile(indexPath);
    }
  }

  const allowedMethods = resolveAllowedApiMethods(app, req);
  if (allowedMethods.length > 0 && !allowedMethods.includes(req.method.toUpperCase())) {
    sendApiMethodNotAllowed(req, res, allowedMethods);
    return;
  }

  sendApiUnknownRouteNotFound(req, res);
});

// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================

async function fireCrashAlert(label: string, detail: string): Promise<void> {
  try {
    await Promise.race([
      sendSystemAlert({
        title: `[${label}] Unhandled server error`,
        message: detail.slice(0, 1000),
        severity: 'CRITICAL',
        source: 'Process',
        throttleKey: `crash_${label}`,
        throttleMs: 60_000,
      }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ]);
  } catch {
    // best-effort — never block or delay process exit
  }
}

if (!isTest) {
  // Handle uncaught exceptions
  process.on('uncaughtException', (err: Error) => {
    logger.error('[Server] Uncaught Exception:', err);
    void fireCrashAlert('uncaughtException', err?.message || String(err));
    if (isProduction) {
      logger.error('[Server] Uncaught Exception (not exiting):', err.message);
    } else {
      logger.error('[Server] Validator critical error:', { error: err });
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('[Server] Unhandled Rejection:', { reason, promise });
    const detail = reason instanceof Error ? reason.message : String(reason);
    void fireCrashAlert('unhandledRejection', detail);
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

// IMPORTANT:
// - We DO want to start an HTTP server when this file is executed directly (e.g. `tsx src/index.ts`)
//   even if NODE_ENV=test (common for Playwright / smoke environments).
// - We do NOT want to start an HTTP server when running unit tests under Vitest, where this module
//   may be imported for app wiring.

function startHttpListener(): void {
  if (!startServer || !shouldStartHttpServer || serverListening) return;
  serverListening = true;
  logger.info('[Server] Starting HTTP listener eagerly (routes may still be warming up)...');
  server.listen(PORT, '0.0.0.0', () => {
    logger.info('✅ Server running on http://0.0.0.0:' + PORT);
    logger.info('✅ WebSocket available at ws://0.0.0.0:' + PORT + '/ws');
    logger.info(`[Server] ✅ Server started on port ${PORT}`);
    void announceDeploy();
    void detectCrashLoop();
  });
}

/**
 * Crash-loop detector. A container that OOMs or throws on boot restarts on the
 * SAME commit, so announceDeploy's env+sha dedup (by design) keeps it silent —
 * the platform quietly restarts in a loop with no operator signal. Here we
 * record every start and, if the same commit boots ≥3× within 10 minutes, fire
 * ONE throttled CRITICAL alert. Fully best-effort / fail-soft (DB + Slack).
 */
async function detectCrashLoop(): Promise<void> {
  if (isTest) return;
  try {
    // Shared resolver (server/src/config/buildSha.ts) — same precedence as /api/health,
    // /api/ready and the release receipt, so every surface reports the same commit.
    const resolvedSha = resolveBuildSha();
    const gitSha = resolvedSha === BUILD_SHA_UNKNOWN ? undefined : resolvedSha;
    if (!gitSha) return; // local dev / unconfigured
    const shortSha = gitSha.slice(0, 10);
    const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';

    const { run: dbRunLocal, get: dbGetLocal } = await import('./utils/DbPromise.js');
    const { randomUUID } = await import('node:crypto');

    await dbRunLocal(
      `CREATE TABLE IF NOT EXISTS server_start_events (
        id TEXT PRIMARY KEY,
        git_sha TEXT,
        app_env TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await dbRunLocal(
      `CREATE INDEX IF NOT EXISTS idx_server_start_events_started ON server_start_events(started_at)`
    );

    const nowMs = Date.now();
    await dbRunLocal(
      `INSERT INTO server_start_events (id, git_sha, app_env, started_at) VALUES (?, ?, ?, ?)`,
      [randomUUID(), shortSha, env, new Date(nowMs).toISOString()]
    );

    const windowIso = new Date(nowMs - 10 * 60 * 1000).toISOString();
    const row = await dbGetLocal<{ n?: number | string }>(
      `SELECT COUNT(*) AS n FROM server_start_events
        WHERE git_sha = ? AND app_env = ? AND started_at >= ?`,
      [shortSha, env, windowIso]
    );
    const count = Number(row?.n ?? 0);

    if (count >= 3) {
      await sendSystemAlert({
        title: `Możliwa pętla restartów (${count} startów / 10 min)`,
        message:
          `Serwer ${env} wystartował ${count}× w ciągu 10 min na tym samym commicie ${shortSha}. ` +
          `To wskazuje na crash-loop (np. OOM lub błąd przy starcie), który nie generuje osobnego wdrożenia ani alertu.`,
        severity: 'CRITICAL',
        source: 'Process',
        throttleKey: `crashloop:${env}:${shortSha}`,
        throttleMs: 15 * 60 * 1000,
      });
    }

    // Best-effort retention: drop start rows older than 24h so the table stays tiny.
    await dbRunLocal(`DELETE FROM server_start_events WHERE started_at < ?`, [
      new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(),
    ]).catch(() => undefined);
  } catch (err) {
    logger.warn('[Server] detectCrashLoop failed (non-fatal):', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Slack Command Center — announce a completed deploy on #cf-progress ("🚀
 * Wdrożenie"). Gives the real-time "what shipped, when" visibility that was
 * missing (deploys previously had no Slack signal at all). Dedup'd by
 * env+gitSha over a 12h DURABLE window (survives process restarts — a
 * crash-loop or a rolling redeploy restarts the process, and the router's
 * dedupe is DB-backed precisely so re-announcing the SAME commit doesn't
 * spam; previously it was in-memory only and reset on every restart, which
 * produced bursts of duplicate posts). A genuinely new deploy always gets a
 * fresh sha and announces immediately. No-op fail-soft when gitSha/Slack env
 * aren't configured (e.g. local dev).
 */
async function announceDeploy(): Promise<void> {
  if (isTest) return;
  try {
    // Shared resolver (server/src/config/buildSha.ts) — same precedence as /api/health,
    // /api/ready and the release receipt, so every surface reports the same commit.
    const resolvedSha = resolveBuildSha();
    const gitSha = resolvedSha === BUILD_SHA_UNKNOWN ? undefined : resolvedSha;
    if (!gitSha) return; // local dev / unconfigured — nothing to announce
    const shortSha = gitSha.slice(0, 10);
    const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';
    const branch =
      process.env.APP_BUILD_BRANCH ||
      process.env.RAILWAY_GIT_BRANCH ||
      process.env.GITHUB_REF_NAME ||
      process.env.GIT_BRANCH;
    const commitMsg = (
      process.env.RAILWAY_GIT_COMMIT_MESSAGE ||
      process.env.GITHUB_HEAD_COMMIT_MESSAGE ||
      ''
    )
      .split('\n')[0]
      .slice(0, 200);
    const { routeToSlack } = await import('./services/slack/slackRouter.js');
    await routeToSlack({
      channel: 'progress',
      severity: 'INFO',
      category: 'Wdrożenie',
      title: `${env}${branch ? ` (${branch})` : ''} — ${shortSha}`,
      text: commitMsg || 'Nowa wersja wdrożona.',
      dedupeKey: `deploy:${env}:${shortSha}`,
      dedupeWindowMs: 12 * 60 * 60 * 1000, // 12h — covers restart storms, not just one process's lifetime
    });
  } catch (err) {
    logger.warn('[Server] announceDeploy failed (non-fatal):', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

if (startServer && shouldStartHttpServer) {
  (async () => {
    logger.info('[Server] Starting HTTP server after route registration...');

    // Feedback artifact retention pruner (best-effort, daily, idempotent).
    // Keeps screenshot storage bounded even when the Railway volume is not
    // yet attached — safe to run on ephemeral dirs too.
    try {
      const { startArtifactPruner } = await import('./services/feedbackArtifacts.js');
      const maxAgeDays = Number(process.env.FEEDBACK_ARTIFACTS_RETENTION_DAYS || 30);
      startArtifactPruner({ maxAgeDays });
      logger.info(`[Server] Feedback artifact pruner started (retention: ${maxAgeDays} days).`);
    } catch (err: any) {
      logger.warn('[Server] Feedback artifact pruner not started:', err?.message);
    }

    // Feedback Slack digest (daily). Gated on FEEDBACK_DIGEST_ENABLED=true so
    // non-prod / local envs stay silent by default.
    try {
      const { startFeedbackDigestCron } = await import('./services/feedbackDigest.js');
      startFeedbackDigestCron();
    } catch (err: any) {
      logger.warn('[Server] Feedback digest cron not started:', err?.message);
    }

    // F5 (SLA): overdue-escalation sweep. Opt-OUT (on by default) — this is a
    // safety/communication guarantee that no report rots past its deadline.
    try {
      const { startFeedbackSlaSweepCron } = await import('./services/feedbackSla.js');
      startFeedbackSlaSweepCron();
    } catch (err: any) {
      logger.warn('[Server] Feedback SLA sweep not started:', err?.message);
    }

    // E-OUTBOX-01: notification_outbox drain. Opt-OUT (on by default) — rows
    // enqueued by slaService.ts (approval-assignment escalations) etc. sat in
    // PENDING forever with nothing draining the table; this loop delivers
    // each row (dedupe_key collapses duplicates to a single send) and marks
    // it SENT/FAILED.
    try {
      const { startNotificationOutboxDrainCron } =
        await import('./services/notificationOutboxService.js');
      startNotificationOutboxDrainCron();
    } catch (err: any) {
      logger.warn('[Server] Notification outbox drain not started:', err?.message);
    }

    // Results vNext events are written atomically with their outbox rows. Drain them by
    // default so KPI/ROI/OKR projections cannot remain permanently pending after a restart.
    try {
      const { startPlatformOutboxDrainCron } =
        await import('./services/resultsVnext/platform/platformOutboxDrainCron.js');
      startPlatformOutboxDrainCron();
    } catch (err: any) {
      logger.warn('[Server] Platform outbox drain not started:', err?.message);
    }

    // Case Workspace outbox drain — same reason as the notification drain
    // directly above, and it was missing entirely: every row committed to
    // case_workspace_event_outbox sat there forever in a real deployment
    // because nothing called the worker outside its own tests, so no
    // subscribeToOutboxDelivery consumer ever ran. The transactional write
    // side was correct; only the delivery side was never started.
    try {
      const { startCaseWorkspaceOutboxWorker } = await import(
        './services/caseWorkspace/outboxWorker.js'
      );
      startCaseWorkspaceOutboxWorker();
    } catch (err: any) {
      logger.warn('[Server] Case Workspace outbox worker not started:', err?.message);
    }

    // Capability bindings are in-memory and must be rebuilt on every boot. The bootstrap
    // remains fail-closed unless a configured actor is a real ADMIN of the configured org.
    try {
      const { bootstrapCaseWorkspaceCapabilities } = await import(
        './services/caseWorkspace/capabilityBootstrap.js'
      );
      const bootResult = await bootstrapCaseWorkspaceCapabilities();
      if (bootResult.status === 'REGISTERED') {
        logger.info('[Server] Case Workspace capability adapters registered (7 adapters).');
      } else {
        logger.warn(`[Server] Case Workspace capability adapters not registered: ${bootResult.status}.`);
      }
    } catch (err: any) {
      logger.warn('[Server] Case Workspace capability adapters not started:', err?.message);
    }

    // EXE-09: closure→Results/Finance delivery receipt reconciliation sweep.
    // Opt-OUT (on by default) — retries any closure_delivery_receipts row
    // whose Results/Finance leg is still PENDING/FAILED, so a failed or
    // interrupted delivery (including one lost to a process restart between
    // closure-commit and its first delivery attempt) is recovered
    // automatically rather than sitting stuck forever.
    try {
      const { startClosureReceiptReconciliationCron } =
        await import('./services/closureDeliveryReceiptService.js');
      startClosureReceiptReconciliationCron();
    } catch (err: any) {
      logger.warn(
        '[Server] Closure delivery receipt reconciliation sweep not started:',
        err?.message
      );
    }

    // Slack Command Center progress feed (Filar 4 / F3): batched #cf-progress
    // flush every 15 min. Fail-soft; sends nothing when the buffer is empty or
    // Slack is unconfigured.
    try {
      const { startProgressFeed } = await import('./services/slack/progressFeed.js');
      startProgressFeed();
    } catch (err: any) {
      logger.warn('[Server] Slack progress feed not started:', err?.message);
    }

    // V4-IDEA-02: Idea collab WebSocket /ws/collab/:ideaId (native ws for CollaborationOverlay)
    try {
      const { attachIdeaCollabWs } = await import('./gateways/ideaCollabWs.gateway.js');
      attachIdeaCollabWs(server);
      logger.info('[Server] Idea collab WebSocket /ws/collab/:ideaId initialized');
    } catch (err: any) {
      logger.warn('[Server] Idea collab WebSocket not available:', err?.message);
    }

    // P3.3: Presentation deck presence WebSocket /ws/presentations/:deckId.
    // Fail-open: if this does not attach, the Deck Builder still works fully in
    // solo mode (the FE useCollaboration hook just reports `disconnected`).
    try {
      const { attachPresentationCollabWs } =
        await import('./gateways/presentationCollabWs.gateway.js');
      attachPresentationCollabWs(server);
      logger.info('[Server] Presentation collab WebSocket /ws/presentations/:deckId initialized');
    } catch (err: any) {
      logger.warn('[Server] Presentation collab WebSocket not available:', err?.message);
    }

    // #23: Notebook presence WebSocket /ws/notebook/:noteId (mirror of the deck
    // gateway). Fail-open: if it does not attach, the Notebook still works fully
    // in solo mode (FE useNotebookPresence just reports `disconnected`).
    try {
      const { attachNotebookCollabWs } = await import('./gateways/notebookCollabWs.gateway.js');
      attachNotebookCollabWs(server);
      logger.info('[Server] Notebook collab WebSocket /ws/notebook/:noteId initialized');
    } catch (err: any) {
      logger.warn('[Server] Notebook collab WebSocket not available:', err?.message);
    }

    // Table Platform real-time collaboration (Socket.IO /table-platform namespace)
    try {
      const { Server: SocketIOServer } = await import('socket.io');
      const io = new SocketIOServer(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        path: '/socket.io',
      });
      // OPS-DEMO-002: middleware registered with `namespace.use` covers only that
      // namespace, and Socket.IO ALWAYS serves the default namespace `/`. It had no
      // middleware at all, so an unauthenticated client — and an expired demo
      // principal — could open a socket there. No handlers are registered on `/`,
      // so there is no event surface, but it is still an unauthenticated
      // resource-consuming connection and it falsified the stated policy.
      // `io.use` applies to the server, which is what the default namespace needs.
      const { socketAuthMiddleware } = await import('./realtime/socketAuth.js');
      io.use(socketAuthMiddleware);
      const { tablePlatformRealtime } = await import('./services/tablePlatform/RealtimeService.js');
      tablePlatformRealtime.init(io);
      logger.info('[Server] Table Platform Realtime (Socket.IO /table-platform) initialized');

      // M16 P1-3: Organization Context realtime (Socket.IO /org-context namespace)
      try {
        const { orgContextRealtime } = await import('./realtime/orgContextRealtime.js');
        orgContextRealtime.init(io);
        logger.info('[Server] Org Context Realtime (Socket.IO /org-context) initialized');
      } catch (err: any) {
        logger.warn('[Server] Org Context Realtime not available:', err?.message);
      }

      // History F4b: Chat projects realtime (Socket.IO /chat-projects namespace)
      try {
        const { chatProjectsRealtime } = await import('./realtime/chatProjectsRealtime.js');
        chatProjectsRealtime.init(io);
        logger.info('[Server] Chat Projects Realtime (Socket.IO /chat-projects) initialized');
      } catch (err: any) {
        logger.warn('[Server] Chat Projects Realtime not available:', err?.message);
      }

      // T9-1: Whiteboard facilitation realtime (Socket.IO /facilitation namespace) —
      // broadcasts phase advances, shared-timer arm/stop, and session-ended to
      // participants so they refresh without polling.
      try {
        const { facilitationRealtime } = await import('./realtime/facilitationRealtime.js');
        await facilitationRealtime.init(io);
        logger.info('[Server] Facilitation Realtime (Socket.IO /facilitation) initialized');
      } catch (err: any) {
        logger.warn('[Server] Facilitation Realtime not available:', err?.message);
      }
    } catch (err: any) {
      logger.warn('[Server] Table Platform Realtime not available:', err?.message);
    }

    // ShutdownManager will be used in graceful shutdown handler
    // const shutdownManager = getShutdownManager(30000); // 30 second timeout

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
      logger.info('[Process] exit', {
        code,
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
      });
    });
    process.on('beforeExit', (code) => {
      logger.info('[Process] beforeExit', {
        code,
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
      });
    });
    process.on('uncaughtException', (err) => {
      logger.error('[Process] uncaughtException', { message: err?.message, stack: err?.stack });
    });

    // Start listening immediately; DB-dependent routes are gated until dbReady=true.
    startHttpListener();
    logger.info(`[Server] Frontend will be served from: ${frontendDistPath}`);

    // Start conversation purge scheduler (P35 — auto-purge soft-deleted conversations)
    import('./services/conversationPurgeScheduler.js')
      .then((m) => m.startPurgeScheduler())
      .catch((err) => logger.warn('[Server] Purge scheduler init failed (non-fatal):', err));
  })();
}

export default app;
