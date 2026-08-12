import { Request, Response } from 'express';

import { getDatabase } from '../database/Database.js';

/**
 * Deploy identity exposed on the PUBLIC health endpoint.
 *
 * Resolved ONCE at module load, from the deploy environment only, and frozen
 * for the process lifetime: serving it costs a property read, never work.
 *
 * Why env-only (the git CLI fallback was deliberately removed):
 * - The previous implementation shelled out with `execSync('git rev-parse …')`
 *   whenever these vars were missing. `/api/health` is unauthenticated, so every
 *   anonymous request forked two processes synchronously and blocked the event
 *   loop — a cheap remote resource-exhaustion vector. No child process may run
 *   on the request path.
 * - Moving that shell-out to import time would not pay for itself either: it
 *   would fork in every process (including every test worker) for a value the
 *   target environment never uses. Railway injects RAILWAY_GIT_COMMIT_SHA, and
 *   the same env vars are already the *sole* source for `announceDeploy()` /
 *   `detectCrashLoop()` in `server/src/index.ts`, which simply fail soft when
 *   they are absent. Local dev now behaves identically: no env, no `gitSha`.
 * - CLI uploads may carry Railway's source-linked SHA from an older deployment.
 *   `APP_BUILD_SHA` is the explicit immutable release identity and therefore
 *   takes precedence when the release operator supplies it.
 *
 * The branch name is intentionally NOT exposed. It is internal information with
 * no consumer; only `gitSha` is read (by deploy verification, which curls
 * `/api/health` and compares the commit). Neither is any filesystem path.
 */
const PUBLIC_GIT_SHA: string | undefined = (() => {
  const raw =
    process.env.APP_BUILD_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.GIT_SHA;
  // Keep the value byte-identical to what the platform set (deploy checks compare
  // full 40-char SHAs); only trim and bound it so a malformed var cannot bloat
  // the public body.
  const sha = typeof raw === 'string' ? raw.trim().slice(0, 64) : '';
  return sha || undefined;
})();

/**
 * Health Check Controller
 * Handles application health monitoring endpoints
 */
export class HealthCheckController {
  /**
   * Simple ping endpoint (synchronous)
   * Used by load balancers for basic uptime check
   */
  static ping(_req: Request, res: Response): void {
    res.status(200).send('pong');
  }

  /**
   * Basic health check endpoint
   * Returns status and critical component connectivity
   * Optimized for speed - non-blocking checks
   */
  static async checkHealth(_req: Request, res: Response): Promise<void> {
    const health: {
      status: string;
      timestamp: string;
      database: string;
      dbResponseTime?: number;
      redis?: string;
      version: string;
      environment: string;
      gitSha?: string;
    } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected', // Optimistic default
      version: process.env.npm_package_version || '0.0.1',
      environment: process.env.NODE_ENV || 'development',
    };

    // Precomputed at module load — no work, no child process, on the request path.
    if (PUBLIC_GIT_SHA) health.gitSha = PUBLIC_GIT_SHA;

    // Check Database connectivity (fast, bounded)
    // - We use a strict timeout to keep this endpoint responsive.
    // - If DB is down/slow, we return degraded state (yellow in UI) instead of failing hard.
    try {
      const db = getDatabase();
      const dbCheck = (async () => {
        const startedAt = Date.now();
        await db.query('SELECT 1');
        return {
          database: 'connected',
          dbResponseTime: Date.now() - startedAt,
        };
      })();
      const timeout = new Promise<{ database: string; dbResponseTime?: number }>((resolve) =>
        setTimeout(() => resolve({ database: 'timeout' }), 800)
      );
      const dbResult = await Promise.race([dbCheck, timeout]);
      health.database = dbResult.database;
      if (typeof dbResult.dbResponseTime === 'number') {
        health.dbResponseTime = dbResult.dbResponseTime;
      }
    } catch {
      health.database = 'disconnected';
    }

    if (health.database !== 'connected') {
      health.status = 'degraded';
    }

    // Check Redis connectivity (non-blocking, timeout after 150ms)
    // We support two Redis client implementations in this codebase:
    // - `services/redis/RedisClient` (ioredis) via `services/ai/redisClient` bridge
    // - `utils/RedisClient` (node-redis)
    // For health reporting, treat Redis as connected if *either* is ready.
    try {
      if (process.env.MOCK_REDIS === 'true') {
        health.redis = 'mocked-unavailable';
      } else {
        const redisCheck = (async () => {
          let connected = false;

          try {
            const { isRedisConnected } = await import('../services/ai/redisClient.js');
            connected = connected || isRedisConnected();
          } catch {
            // ignore
          }

          try {
            const redis = (await import('../utils/RedisClient.js')).default as any;
            const isReady = typeof redis?.isReady === 'boolean' ? redis.isReady : undefined;
            const isOpen = typeof redis?.isOpen === 'boolean' ? redis.isOpen : undefined;
            connected = connected || Boolean(isReady ?? isOpen);
          } catch {
            // ignore
          }

          return connected ? 'connected' : 'disconnected';
        })();

        const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 150));
        health.redis = await Promise.race([redisCheck, timeout]);
      }
    } catch {
      health.redis = 'error';
    }

    if (health.redis !== 'connected') {
      health.status = 'degraded';
    }

    res.json(health);
  }

  /**
   * Deep readiness check (Kubernetes Readiness Probe)
   * Verifies if application is ready to serve traffic
   */
  static async checkReadiness(_req: Request, res: Response): Promise<void> {
    const checks: {
      database: boolean;
      redis: boolean;
      metrics: boolean;
    } = {
      database: false,
      redis: false,
      metrics: false,
    };

    // Check database
    try {
      const db = getDatabase();
      // Simple query to verify database is accessible
      await db.query('SELECT 1');
      checks.database = true;
    } catch (error) {
      checks.database = false;
    }

    // Check Redis
    try {
      if (process.env.MOCK_REDIS === 'true') {
        checks.redis = false;
      } else {
        let connected = false;

        try {
          const { isRedisConnected } = await import('../services/ai/redisClient.js');
          connected = connected || isRedisConnected();
        } catch {
          // ignore
        }

        try {
          const redis = (await import('../utils/RedisClient.js')).default as any;
          const isReady = typeof redis?.isReady === 'boolean' ? redis.isReady : undefined;
          const isOpen = typeof redis?.isOpen === 'boolean' ? redis.isOpen : undefined;
          connected = connected || Boolean(isReady ?? isOpen);
        } catch {
          // ignore
        }

        checks.redis = connected;
      }
    } catch {
      checks.redis = false;
    }

    // Check metrics service
    try {
      const { getMetricsService } = await import('../services/metricsService.js');
      const metricsService = getMetricsService();
      await metricsService.getMetrics();
      checks.metrics = true;
    } catch (error) {
      checks.metrics = false;
    }

    const isReady = checks.database && checks.redis && checks.metrics;

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Liveness probe (Kubernetes Liveness Probe)
   * Checks if application process is running
   */
  static async checkLiveness(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  /**
   * Aggregated health dashboard (T107)
   * Unified contract for SuperAdmin / monitoring
   */
  static async aggregatedHealth(_req: Request, res: Response): Promise<void> {
    const timestamp = new Date().toISOString();
    const components: Record<string, { status: string; details?: any }> = {};
    let overall: 'healthy' | 'degraded' | 'down' = 'healthy';

    try {
      const db = getDatabase();
      await db.query('SELECT 1');
      components.database = { status: 'healthy' };
    } catch (e: any) {
      components.database = { status: 'down', details: e.message };
      overall = 'down';
    }

    let redisConnected = false;
    try {
      const { isRedisConnected } = await import('../services/ai/redisClient.js');
      redisConnected = isRedisConnected();
    } catch {
      /* ignore */
    }
    components.redis = { status: redisConnected ? 'healthy' : 'degraded' };
    if (!redisConnected && overall === 'healthy') overall = 'degraded';

    try {
      const { getWatchdogStats } = await import('../middleware/alertWatchdog.middleware.js');
      const stats = getWatchdogStats();
      components.api = {
        status: stats.windowFiveXx > 10 ? 'degraded' : 'healthy',
        details: {
          totalRequests: stats.totalRequests,
          fiveXxRate: stats.totalFiveXx,
          p95Ms: stats.p95Ms,
        },
      };
      if (stats.windowFiveXx > 10 && overall === 'healthy') overall = 'degraded';
    } catch {
      components.api = { status: 'healthy' };
    }

    try {
      const { getRequestMetrics } = await import('../middleware/metrics.middleware.js');
      const m = getRequestMetrics();
      components.metrics = {
        status: 'healthy',
        details: {
          requests: m.requests,
          errors: m.errors,
          rateLimitHits: m.rateLimitHits,
          aiTimeouts: m.aiTimeouts,
        },
      };
    } catch {
      components.metrics = { status: 'healthy' };
    }

    const httpStatus = overall === 'down' ? 503 : 200;
    res
      .status(httpStatus)
      .json({ status: overall, timestamp, uptime: process.uptime(), components });
  }
}
