/**
 * Performance Monitoring Routes
 * API endpoints for database performance metrics
 */

import { Request, Response, Router } from 'express';

import { getDatabaseMetrics } from '../database/DatabaseMetrics.js';
import { getDatabase } from '../database/index.js';
import { getSlowQueryLogger } from '../database/SlowQueryLogger.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * GET /api/metrics/slow-queries
 * Get slow query statistics
 */
router.get('/slow-queries', async (req: Request, res: Response) => {
  try {
    const slowQueryLogger = getSlowQueryLogger();
    const stats = slowQueryLogger.getStatistics();

    res.json({
      status: 'ok',
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Metrics] Failed to get slow query stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get slow query statistics',
      error: String(error),
    });
  }
});

/**
 * GET /api/metrics/slow-queries/recent
 * Get recent slow queries
 */
router.get('/slow-queries/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const slowQueryLogger = getSlowQueryLogger();
    const queries = slowQueryLogger.getRecentSlowQueries(limit);

    res.json({
      status: 'ok',
      count: queries.length,
      queries,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Metrics] Failed to get recent slow queries:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get recent slow queries',
      error: String(error),
    });
  }
});

/**
 * GET /api/metrics/slow-queries/top
 * Get top slow queries
 */
router.get('/slow-queries/top', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const slowQueryLogger = getSlowQueryLogger();
    const topQueries = slowQueryLogger.getTopSlowQueries(limit);

    res.json({
      status: 'ok',
      count: topQueries.length,
      queries: topQueries,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Metrics] Failed to get top slow queries:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get top slow queries',
      error: String(error),
    });
  }
});

/**
 * POST /api/metrics/slow-queries/export
 * Export slow queries to JSON
 */
router.post('/slow-queries/export', async (req: Request, res: Response) => {
  try {
    const slowQueryLogger = getSlowQueryLogger();
    const filepath = await slowQueryLogger.exportToJson();

    res.json({
      status: 'ok',
      message: 'Slow queries exported successfully',
      filepath,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Metrics] Failed to export slow queries:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export slow queries',
      error: String(error),
    });
  }
});

/**
 * DELETE /api/metrics/slow-queries
 * Clear slow query logs
 */
router.delete('/slow-queries', async (req: Request, res: Response) => {
  try {
    const slowQueryLogger = getSlowQueryLogger();
    slowQueryLogger.clear();

    res.json({
      status: 'ok',
      message: 'Slow query logs cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Metrics] Failed to clear slow queries:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear slow queries',
      error: String(error),
    });
  }
});

/**
 * GET /api/metrics/database
 * Get comprehensive database metrics
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const metrics = getDatabaseMetrics();
    const db = getDatabase();
    const allMetrics = await metrics.getAllMetrics(db);

    res.json({
      status: 'ok',
      metrics: allMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Metrics] Failed to get database metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get database metrics',
      error: String(error),
    });
  }
});

/**
 * GET /api/metrics/performance
 * Get query performance metrics
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const metrics = getDatabaseMetrics();
    const queryMetrics = metrics.getQueryMetrics();

    res.json({
      status: 'ok',
      performance: queryMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Metrics] Failed to get performance metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get performance metrics',
      error: String(error),
    });
  }
});

export default router;
