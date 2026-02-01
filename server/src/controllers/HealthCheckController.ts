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

    // Check Redis connectivity (non-blocking, timeout after 50ms)
    // Use Promise.race to avoid blocking the healthcheck
    try {
      const redisCheck = import('../services/ai/redisClient.js')
        .then(({ isRedisConnected }) => (isRedisConnected() ? 'connected' : 'disconnected'))
        .catch(() => 'error');

      const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 50));

      health.redis = await Promise.race([redisCheck, timeout]);
    } catch (error) {
      health.redis = 'error';
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
      // In local dev we often run without Redis (MOCK_REDIS=true).
      // Treat mocked Redis as "ready" so the app can start cleanly.
      if (process.env.MOCK_REDIS === 'true') {
        checks.redis = true;
      } else {
        const { isRedisConnected } = await import('../services/ai/redisClient.js');
        checks.redis = isRedisConnected();
      }
    } catch (error) {
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
}
