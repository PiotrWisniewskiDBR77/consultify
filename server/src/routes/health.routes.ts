/**
 * Database Health Check Endpoint
 * Provides real-time database health and connection pool status
 */

import { Request, Response, Router } from 'express';

import { resolveReachableDatabaseUrl } from '../config/databaseTargetResolver.js';
import { resolveDemoPolicy } from '../config/demoPolicy.js';
import { resolveRateLimitStartupConfig } from '../config/rateLimitPosture.js';
import { getConnectionPool, getHealthMonitor } from '../database/index.js';
import { requireSuperAdmin, verifyToken } from '../middleware/auth.middleware.js';
import {
  getRateLimitTelemetry,
  probeRateLimiterHealth,
} from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';

const router = Router();

function parseDatabaseName(connectionString: string | undefined): string | null {
  if (!connectionString) return null;
  try {
    const parsed = new URL(connectionString);
    return parsed.pathname.replace(/^\/+/, '') || null;
  } catch {
    return null;
  }
}

function percentageString(part: number, total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '0.0%';
  if (!Number.isFinite(part) || part <= 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

/**
 * GET /api/health/database
 * Database health check
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const pool = getConnectionPool();
    const monitor = getHealthMonitor();

    if (!pool || !monitor) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Connection pool not initialized',
        timestamp: new Date().toISOString(),
      });
    }

    const stats = pool.getStats();
    const metrics = monitor.getMetrics();

    const isHealthy = stats.healthy > 0 && metrics.consecutiveFailures < 3 && metrics.uptime > 95;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      pool: stats,
      metrics: {
        uptime: `${metrics.uptime.toFixed(2)}%`,
        averageResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
        consecutiveFailures: metrics.consecutiveFailures,
        totalChecks: metrics.totalChecks,
        totalFailures: metrics.totalFailures,
        lastCheck: metrics.lastCheck,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[HealthCheck] Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      code: 'HEALTH_DATABASE_PROBE_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/connections
 * Connection pool detailed status
 */
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const pool = getConnectionPool();

    if (!pool) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Connection pool not initialized',
        timestamp: new Date().toISOString(),
      });
    }

    const stats = pool.getStats();

    res.json({
      status: 'ok',
      connections: stats,
      utilization: {
        active: percentageString(stats.active, stats.total),
        idle: percentageString(stats.idle, stats.total),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[HealthCheck] Connection status check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Connection status check failed',
      code: 'HEALTH_CONNECTION_POOL_STATUS_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/data-context', verifyToken, async (req: Request, res: Response) => {
  try {
    const resolved = resolveReachableDatabaseUrl({
      databaseUrl: process.env.DATABASE_URL,
      publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
      env: process.env,
    });

    const user = (req as any).user || {};
    const demo = (req as any).demo || null;
    const demoPolicy = resolveDemoPolicy(process.env);
    const correlationId =
      (req as Request & { correlationId?: string }).correlationId ||
      req.get('X-Correlation-ID') ||
      null;

    res.json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      database: {
        source: resolved.source,
        reason: resolved.reason || null,
        host: resolved.databaseUrl
          ? (() => {
              try {
                return new URL(resolved.databaseUrl).hostname;
              } catch {
                return null;
              }
            })()
          : null,
        name: parseDatabaseName(resolved.databaseUrl),
        readonly: process.env.DB_READONLY === '1' || process.env.DB_READONLY === 'true',
      },
      organization: {
        activeOrganizationId:
          (req as any).organizationId || user.organizationId || user.organization_id || null,
        userOrganizationId: user.organizationId || user.organization_id || null,
      },
      user: {
        id: user.id || null,
        email: user.email || null,
      },
      demo: {
        enabled: Boolean(demo?.enabled),
        organizationId: demo?.organizationId || null,
        headerActive: String(req.get('X-Demo-Mode') || '').toLowerCase() === 'true',
      },
      policy: {
        demoOrgId: demoPolicy.demoOrgId,
        demoOrgName: demoPolicy.demoOrgName,
        defaultDemoOrgId: demoPolicy.defaultDemoOrgId,
        usesNonDefaultDemoOrgId: demoPolicy.usesNonDefaultDemoOrgId,
        explicitApprovalEnabled: demoPolicy.explicitApprovalEnabled,
        approvedBy: demoPolicy.approvedBy,
      },
      request: {
        correlationId,
        path: req.originalUrl || req.url || null,
        method: req.method,
      },
      runtime: {
        nodeEnv: process.env.NODE_ENV || null,
        appEnv: process.env.APP_ENV || null,
        railwayEnvironmentName: process.env.RAILWAY_ENVIRONMENT_NAME || null,
        railwayServiceName: process.env.RAILWAY_SERVICE_NAME || null,
      },
    });
  } catch (error) {
    logger.error('[HealthCheck] Data context endpoint failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to resolve data context',
      code: 'HEALTH_DATA_CONTEXT_RESOLVE_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/ready/rate-limit
 *
 * UNAUTHENTICATED, by necessity: the platform health check that decides whether
 * a replica receives traffic cannot carry a token. It is therefore deliberately
 * DETAIL-FREE — a bare ready/not-ready verdict. It never reveals which store is
 * active, which fail mode is configured, how many requests were refused, or any
 * key. The only bit it leaks is "the limiter probe is unhealthy", which is the
 * entire purpose of a readiness endpoint; hiding that would make it useless.
 *
 * The probe itself is real: it increments a random throwaway key twice and
 * requires the count to advance (see `probeRateLimiterHealth`). A limiter backed
 * by the mock Redis client is fully "configured" and still fails this.
 *
 * NOTE: this path does not collide with `/api/health/ready`, which
 * `healthRoutes.ts` registers as an exact match on an earlier-mounted router.
 */
router.get('/ready/rate-limit', async (_req: Request, res: Response) => {
  try {
    const probe = await probeRateLimiterHealth();
    if (probe.ok) {
      res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
      return;
    }
    res.status(503).json({
      status: 'not ready',
      code: 'RATE_LIMIT_NOT_READY',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[HealthCheck] Rate limit readiness probe failed:', error);
    res.status(503).json({
      status: 'not ready',
      code: 'RATE_LIMIT_NOT_READY',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/rate-limit
 *
 * PROTECTED (`verifyToken` + `requireSuperAdmin`). The per-limiter breakdown,
 * the active store, the fail mode and the declared posture are operational
 * internals: together they tell an unauthenticated reader exactly how much
 * headroom a flood has and whether the brake is on at all. The existing detailed
 * health endpoints in this file are a mix — `/database` and `/connections` are
 * public, `/data-context` is behind `verifyToken` — and `/api/health/aggregated`
 * is fully public. So the per-limiter numbers go HERE, behind the strongest
 * guard already in the codebase, and the public aggregate keeps only the single
 * unlabelled `rateLimitHits` counter it already had.
 *
 * PRIVACY: the telemetry snapshot is keyed by limiter prefix (`demo-signup-ip`,
 * `auth`, ...) and carries only integers. No address, IP, or rate-limit key is
 * held anywhere in this payload — the limiter hashes identities before they ever
 * reach a counter.
 */
router.get('/rate-limit', verifyToken, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const config = resolveRateLimitStartupConfig(process.env);
    const probe = await probeRateLimiterHealth();

    res.status(200).json({
      status: probe.ok ? 'ok' : 'degraded',
      generatedAt: new Date().toISOString(),
      posture: {
        declared: config.postureInferred ? null : config.posture,
        effective: config.posture,
        errors: config.errors,
        warnings: config.warnings,
      },
      limiter: {
        activeStore: probe.store,
        failMode: probe.failMode,
        bypassed: probe.bypassed,
        probe: { ok: probe.ok, detail: probe.detail, durationMs: probe.durationMs },
      },
      counters: getRateLimitTelemetry(),
    });
  } catch (error) {
    logger.error('[HealthCheck] Rate limit telemetry endpoint failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to resolve rate limit telemetry',
      code: 'HEALTH_RATE_LIMIT_TELEMETRY_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
