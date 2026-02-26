import { Request, Response } from 'express';

import { getDatabase } from '../database/Database.js';

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
      redis?: string;
      version: string;
      environment: string;
    } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected', // Optimistic default
      version: process.env.npm_package_version || '0.0.1',
      environment: process.env.NODE_ENV || 'development',
    };

    // Check Database connectivity (fast, bounded)
    // - We use a strict timeout to keep this endpoint responsive.
    // - If DB is down/slow, we return degraded state (yellow in UI) instead of failing hard.
    try {
      const db = getDatabase();
      const dbCheck = (async () => {
        await db.query('SELECT 1');
        return 'connected';
      })();
      const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 150));
      health.database = await Promise.race([dbCheck, timeout]);
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

    try {
      let connected = false;
      try {
        const { isRedisConnected } = await import('../services/ai/redisClient.js');
        connected = isRedisConnected();
      } catch {
        /* ignore */
      }
      components.redis = { status: connected ? 'healthy' : 'degraded' };
      if (!connected && overall === 'healthy') overall = 'degraded';
    } catch {
      components.redis = { status: 'degraded' };
      if (overall === 'healthy') overall = 'degraded';
    }

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
