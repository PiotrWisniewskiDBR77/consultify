/**
 * Database Health Check Endpoint
 * Provides real-time database health and connection pool status
 */

import { Request, Response, Router } from 'express';

import { resolveReachableDatabaseUrl } from '../config/databaseTargetResolver.js';
import { getConnectionPool, getHealthMonitor } from '../database/index.js';
import { verifyToken } from '../middleware/auth.middleware.js';
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
      error: String(error),
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
        active: `${((stats.active / stats.total) * 100).toFixed(1)}%`,
        idle: `${((stats.idle / stats.total) * 100).toFixed(1)}%`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[HealthCheck] Connection status check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Connection status check failed',
      error: String(error),
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

    res.json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      database: {
        source: resolved.source,
        host: resolved.databaseUrl ? (() => {
          try {
            return new URL(resolved.databaseUrl).hostname;
          } catch {
            return null;
          }
        })() : null,
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
    });
  } catch (error) {
    logger.error('[HealthCheck] Data context endpoint failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to resolve data context',
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
