/**
 * Database Health Check Endpoint
 * Provides real-time database health and connection pool status
 */

import { Request, Response, Router } from 'express';

import { getConnectionPool, getHealthMonitor } from '../database/index.js';
import logger from '../utils/Logger.js';

const router = Router();

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
        });
    }
});

export default router;
