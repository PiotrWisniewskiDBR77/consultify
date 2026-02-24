/**
 * AI Operations Routes
 * Module 3: AI Operations & Analytics
 * Routes for mission control, performance, costs, SLA, and analytics
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();

// ==========================================
// MISSION CONTROL ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/mission-control/status
 * Get overall AI system status
 */
router.get(
  '/mission-control/status',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // Get active requests count
      const activeRequests = (await dbGet(`
            SELECT COUNT(*) as count FROM ai_request_log 
            WHERE created_at > datetime('now', '-5 minutes')
        `).catch(() => ({ count: 0 }))) as { count?: number };

      // Get error rate last hour
      const errorRate = (await dbGet(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-1 hour')
        `).catch(() => ({ total: 0, errors: 0 }))) as { total?: number; errors?: number };

      // Get queue status
      const queueStatus = (await dbGet(`
            SELECT COUNT(*) as pending FROM ai_async_jobs 
            WHERE status = 'pending'
        `).catch(() => ({ pending: 0 }))) as { pending?: number };

      const errorRatePercent =
        errorRate.total && errorRate.total > 0
          ? (((errorRate.errors || 0) / errorRate.total) * 100).toFixed(2)
          : '0.00';

      return res.json({
        success: true,
        data: {
          status:
            parseFloat(errorRatePercent) < 5
              ? 'healthy'
              : parseFloat(errorRatePercent) < 15
                ? 'degraded'
                : 'critical',
          activeRequests: activeRequests.count || 0,
          errorRate: parseFloat(errorRatePercent),
          queuedJobs: queueStatus.pending || 0,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting mission control status:', error);
      return res.status(500).json({
        error: 'Failed to get status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-operations/mission-control/providers
 * Get provider status overview
 */
router.get(
  '/mission-control/providers',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const providers = (await dbAll(`
            SELECT 
                name,
                is_active,
                last_health_check,
                health_status,
                avg_latency_ms
            FROM llm_providers
            ORDER BY name
        `).catch(() => [])) as Array<{
        name?: string;
        is_active?: number;
        last_health_check?: string;
        health_status?: string;
        avg_latency_ms?: number;
      }>;

      return res.json({
        success: true,
        data: providers.map((p) => ({
          ...p,
          is_active: Boolean(p.is_active),
          health_status: p.health_status || 'unknown',
        })),
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting providers:', error);
      return res.status(500).json({
        error: 'Failed to get providers',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-operations/mission-control/alerts
 * Get active alerts
 */
router.get(
  '/mission-control/alerts',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const alerts = await dbAll(`
            SELECT * FROM ai_health_alerts 
            WHERE resolved_at IS NULL
            ORDER BY created_at DESC
            LIMIT 50
        `).catch(() => []);

      return res.json({ success: true, data: alerts });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting alerts:', error);
      return res.status(500).json({
        error: 'Failed to get alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-operations/mission-control/alerts/:id/resolve
 * Resolve an alert
 */
router.post(
  '/mission-control/alerts/:id/resolve',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { resolution } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const runResult = await dbRun(
        `
            UPDATE ai_health_alerts 
            SET resolved_at = datetime('now'), resolution = ?, resolved_by = ?
            WHERE id = ?
        `,
        [resolution || 'Manual resolution', userId, id]
      );

      if (!runResult.success) {
        throw new Error(runResult.error || 'Failed to update alert');
      }

      return res.json({ success: true, message: 'Alert resolved' });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error resolving alert:', error);
      return res.status(500).json({
        error: 'Failed to resolve alert',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// ==========================================
// PERFORMANCE ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/performance/metrics
 * Get performance metrics
 */
router.get(
  '/performance/metrics',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = '24h' } = req.query;

      let timeFilter: string;
      switch (period) {
        case '1h':
          timeFilter = "datetime('now', '-1 hour')";
          break;
        case '24h':
          timeFilter = "datetime('now', '-24 hours')";
          break;
        case '7d':
          timeFilter = "datetime('now', '-7 days')";
          break;
        case '30d':
          timeFilter = "datetime('now', '-30 days')";
          break;
        case '90d':
          timeFilter = "datetime('now', '-90 days')";
          break;
        default:
          timeFilter = "datetime('now', '-24 hours')";
      }

      const metrics = (await dbGet(`
            SELECT 
                COUNT(*) as total_requests,
                AVG(latency_ms) as avg_latency,
                MIN(latency_ms) as min_latency,
                MAX(latency_ms) as max_latency,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
                AVG(tokens_used) as avg_tokens
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
        `).catch(() => ({
        total_requests: 0,
        avg_latency: 0,
        min_latency: 0,
        max_latency: 0,
        successful: 0,
        failed: 0,
        avg_tokens: 0,
      }))) as {
        total_requests?: number;
        avg_latency?: number;
        min_latency?: number;
        max_latency?: number;
        successful?: number;
        failed?: number;
        avg_tokens?: number;
      };

      return res.json({
        success: true,
        data: {
          period,
          totalRequests: metrics.total_requests || 0,
          avgLatency: Math.round(metrics.avg_latency || 0),
          minLatency: metrics.min_latency || 0,
          maxLatency: metrics.max_latency || 0,
          successRate:
            metrics.total_requests && metrics.total_requests > 0
              ? (((metrics.successful || 0) / metrics.total_requests) * 100).toFixed(2)
              : '100',
          avgTokens: Math.round(metrics.avg_tokens || 0),
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting performance metrics:', error);
      return res.status(500).json({
        error: 'Failed to get metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-operations/performance/trends
 * Get performance trends over time
 */
router.get(
  '/performance/trends',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = '24h', _granularity = 'hour' } = req.query;

      let timeFilter: string;
      let groupBy: string;
      switch (period) {
        case '24h':
          timeFilter = "datetime('now', '-24 hours')";
          groupBy = "strftime('%Y-%m-%d %H:00', created_at)";
          break;
        case '7d':
          timeFilter = "datetime('now', '-7 days')";
          groupBy = "strftime('%Y-%m-%d', created_at)";
          break;
        case '30d':
          timeFilter = "datetime('now', '-30 days')";
          groupBy = "strftime('%Y-%m-%d', created_at)";
          break;
        case '90d':
          timeFilter = "datetime('now', '-90 days')";
          groupBy = "strftime('%Y-%m-%d', created_at)";
          break;
        default:
          timeFilter = "datetime('now', '-24 hours')";
          groupBy = "strftime('%Y-%m-%d %H:00', created_at)";
      }

      const trends = (await dbAll(`
            SELECT 
                ${groupBy} as timestamp,
                COUNT(*) as requests,
                AVG(latency_ms) as avg_latency,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
            GROUP BY ${groupBy}
            ORDER BY timestamp ASC
        `).catch(() => [])) as Array<{
        timestamp?: string;
        requests?: number;
        avg_latency?: number;
        successful?: number;
      }>;

      return res.json({
        success: true,
        data: trends.map((t) => ({
          timestamp: t.timestamp,
          requests: t.requests,
          avgLatency: Math.round(t.avg_latency || 0),
          successRate:
            t.requests && t.requests > 0
              ? (((t.successful || 0) / t.requests) * 100).toFixed(2)
              : '100',
        })),
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting performance trends:', error);
      return res.status(500).json({
        error: 'Failed to get trends',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// ==========================================
// COSTS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/costs/summary
 * Get cost summary
 */
router.get(
  '/costs/summary',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = 'month' } = req.query;

      let timeFilter: string;
      switch (period) {
        case 'day':
          timeFilter = "datetime('now', '-1 day')";
          break;
        case 'week':
          timeFilter = "datetime('now', '-7 days')";
          break;
        case 'month':
          timeFilter = "datetime('now', '-30 days')";
          break;
        default:
          timeFilter = "datetime('now', '-30 days')";
      }

      const costs = (await dbGet(`
            SELECT 
                SUM(tokens_used) as total_tokens,
                SUM(cost_usd) as total_cost,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(*) as total_requests
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
        `).catch(() => ({
        total_tokens: 0,
        total_cost: 0,
        unique_users: 0,
        total_requests: 0,
      }))) as {
        total_tokens?: number;
        total_cost?: number;
        unique_users?: number;
        total_requests?: number;
      };

      const byProvider = (await dbAll(`
            SELECT 
                provider,
                SUM(tokens_used) as tokens,
                SUM(cost_usd) as cost,
                COUNT(*) as requests
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
            GROUP BY provider
            ORDER BY cost DESC
        `).catch(() => [])) as Array<{
        provider?: string;
        tokens?: number;
        cost?: number;
        requests?: number;
      }>;

      return res.json({
        success: true,
        data: {
          period,
          totalTokens: costs.total_tokens || 0,
          totalCost: parseFloat((costs.total_cost || 0).toFixed(4)),
          uniqueUsers: costs.unique_users || 0,
          totalRequests: costs.total_requests || 0,
          byProvider: byProvider.map((p) => ({
            provider: p.provider,
            tokens: p.tokens || 0,
            cost: parseFloat((p.cost || 0).toFixed(4)),
            requests: p.requests,
          })),
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting cost summary:', error);
      return res.status(500).json({
        error: 'Failed to get costs',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-operations/costs/trends
 * Get cost trends over time
 */
router.get(
  '/costs/trends',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = 'month' } = req.query;

      let timeFilter: string;
      switch (period) {
        case 'week':
          timeFilter = "datetime('now', '-7 days')";
          break;
        case 'month':
          timeFilter = "datetime('now', '-30 days')";
          break;
        case 'quarter':
          timeFilter = "datetime('now', '-90 days')";
          break;
        default:
          timeFilter = "datetime('now', '-30 days')";
      }

      const trends = (await dbAll(`
            SELECT 
                strftime('%Y-%m-%d', created_at) as date,
                SUM(tokens_used) as tokens,
                SUM(cost_usd) as cost,
                COUNT(*) as requests
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
            GROUP BY strftime('%Y-%m-%d', created_at)
            ORDER BY date ASC
        `).catch(() => [])) as Array<{
        date?: string;
        tokens?: number;
        cost?: number;
        requests?: number;
      }>;

      return res.json({
        success: true,
        data: trends.map((t) => ({
          date: t.date,
          tokens: t.tokens || 0,
          cost: parseFloat((t.cost || 0).toFixed(4)),
          requests: t.requests,
        })),
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting cost trends:', error);
      return res.status(500).json({
        error: 'Failed to get trends',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-operations/costs/by-user
 * Get costs by user (top consumers)
 */
router.get(
  '/costs/by-user',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = 'month', limit = 20 } = req.query;

      let timeFilter: string;
      switch (period) {
        case 'week':
          timeFilter = "datetime('now', '-7 days')";
          break;
        case 'month':
          timeFilter = "datetime('now', '-30 days')";
          break;
        default:
          timeFilter = "datetime('now', '-30 days')";
      }

      const topUsers = (await dbAll(
        `
            SELECT 
                l.user_id,
                u.name as user_name,
                u.email,
                SUM(l.tokens_used) as tokens,
                SUM(l.cost_usd) as cost,
                COUNT(*) as requests
            FROM ai_request_log l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.created_at > ${timeFilter}
            GROUP BY l.user_id
            ORDER BY cost DESC
            LIMIT ?
        `,
        [parseInt(limit as string)]
      ).catch(() => [])) as Array<{
        user_id?: string;
        user_name?: string;
        email?: string;
        tokens?: number;
        cost?: number;
        requests?: number;
      }>;

      return res.json({
        success: true,
        data: topUsers.map((u) => ({
          userId: u.user_id,
          userName: u.user_name || 'Unknown',
          email: u.email,
          tokens: u.tokens || 0,
          cost: parseFloat((u.cost || 0).toFixed(4)),
          requests: u.requests,
        })),
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting costs by user:', error);
      return res.status(500).json({
        error: 'Failed to get user costs',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// ==========================================
// SLA ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/sla/status
 * Get SLA compliance status
 */
router.get(
  '/sla/status',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // SLA targets (could be configurable)
      const slaTargets = {
        availability: 99.9,
        avgLatency: 2000, // ms
        errorRate: 1, // %
        p95Latency: 5000, // ms
      };

      const metrics = (await dbGet(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                AVG(latency_ms) as avg_latency
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-24 hours')
        `).catch(() => ({ total: 0, successful: 0, avg_latency: 0 }))) as {
        total?: number;
        successful?: number;
        avg_latency?: number;
      };

      const p95Latency = (await dbGet(`
            SELECT latency_ms FROM (
                SELECT latency_ms, 
                       ROW_NUMBER() OVER (ORDER BY latency_ms) as row_num,
                       COUNT(*) OVER () as total
                FROM ai_request_log 
                WHERE created_at > datetime('now', '-24 hours')
            ) WHERE row_num >= total * 0.95
            LIMIT 1
        `).catch(() => ({ latency_ms: 0 }))) as { latency_ms?: number };

      const availability =
        metrics.total && metrics.total > 0
          ? ((metrics.successful || 0) / metrics.total) * 100
          : 100;
      const errorRate =
        metrics.total && metrics.total > 0
          ? ((metrics.total - (metrics.successful || 0)) / metrics.total) * 100
          : 0;

      return res.json({
        success: true,
        data: {
          targets: slaTargets,
          current: {
            availability: parseFloat(availability.toFixed(2)),
            avgLatency: Math.round(metrics.avg_latency || 0),
            errorRate: parseFloat(errorRate.toFixed(2)),
            p95Latency: p95Latency.latency_ms || 0,
          },
          compliance: {
            availability: availability >= slaTargets.availability,
            avgLatency: (metrics.avg_latency || 0) <= slaTargets.avgLatency,
            errorRate: errorRate <= slaTargets.errorRate,
            p95Latency: (p95Latency.latency_ms || 0) <= slaTargets.p95Latency,
          },
          overallCompliant:
            availability >= slaTargets.availability &&
            (metrics.avg_latency || 0) <= slaTargets.avgLatency &&
            errorRate <= slaTargets.errorRate,
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting SLA status:', error);
      return res.status(500).json({
        error: 'Failed to get SLA status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-operations/sla/history
 * Get SLA compliance history
 */
router.get(
  '/sla/history',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const history = (await dbAll(`
            SELECT 
                strftime('%Y-%m-%d', created_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                AVG(latency_ms) as avg_latency
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-30 days')
            GROUP BY strftime('%Y-%m-%d', created_at)
            ORDER BY date ASC
        `).catch(() => [])) as Array<{
        date?: string;
        total?: number;
        successful?: number;
        avg_latency?: number;
      }>;

      return res.json({
        success: true,
        data: history.map((h) => ({
          date: h.date,
          availability:
            h.total && h.total > 0
              ? parseFloat((((h.successful || 0) / h.total) * 100).toFixed(2))
              : 100,
          avgLatency: Math.round(h.avg_latency || 0),
          requests: h.total,
        })),
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting SLA history:', error);
      return res.status(500).json({
        error: 'Failed to get SLA history',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// ==========================================
// ANALYTICS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/analytics/usage
 * Get usage analytics
 */
router.get(
  '/analytics/usage',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = 'month' } = req.query;

      let timeFilter: string;
      switch (period) {
        case 'week':
          timeFilter = "datetime('now', '-7 days')";
          break;
        case 'month':
          timeFilter = "datetime('now', '-30 days')";
          break;
        case 'quarter':
          timeFilter = "datetime('now', '-90 days')";
          break;
        default:
          timeFilter = "datetime('now', '-30 days')";
      }

      const [byFeature, byModel, byTimeOfDay] = await Promise.all([
        dbAll(`
                SELECT 
                    feature,
                    COUNT(*) as requests,
                    AVG(latency_ms) as avg_latency
                FROM ai_request_log 
                WHERE created_at > ${timeFilter}
                GROUP BY feature
                ORDER BY requests DESC
            `).catch(() => []),
        dbAll(`
                SELECT 
                    model,
                    COUNT(*) as requests,
                    SUM(tokens_used) as tokens
                FROM ai_request_log 
                WHERE created_at > ${timeFilter}
                GROUP BY model
                ORDER BY requests DESC
            `).catch(() => []),
        dbAll(`
                SELECT 
                    strftime('%H', created_at) as hour,
                    COUNT(*) as requests
                FROM ai_request_log 
                WHERE created_at > ${timeFilter}
                GROUP BY strftime('%H', created_at)
                ORDER BY hour
            `).catch(() => []),
      ]);

      return res.json({
        success: true,
        data: {
          period,
          byFeature,
          byModel,
          byTimeOfDay: (byTimeOfDay as Array<{ hour?: string; requests?: number }>).map((t) => ({
            hour: parseInt(t.hour || '0'),
            requests: t.requests,
          })),
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting usage analytics:', error);
      return res.status(500).json({
        error: 'Failed to get analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-operations/analytics/insights
 * Get AI usage insights
 */
router.get(
  '/analytics/insights',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // Generate insights based on current data
      const insights: Array<{
        type: string;
        title: string;
        message: string;
        recommendation: string;
      }> = [];

      // Check for error rate spikes
      const errorRate = (await dbGet(`
            SELECT 
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as rate
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-1 hour')
        `).catch(() => ({ rate: 0 }))) as { rate?: number };

      if ((errorRate.rate || 0) > 5) {
        insights.push({
          type: 'warning',
          title: 'High Error Rate Detected',
          message: `Error rate is ${(errorRate.rate || 0).toFixed(1)}% in the last hour`,
          recommendation: 'Review recent error logs and check provider health',
        });
      }

      // Check for latency increases
      const latencyComparison = (await dbGet(`
            SELECT 
                (SELECT AVG(latency_ms) FROM ai_request_log WHERE created_at > datetime('now', '-1 hour')) as recent,
                (SELECT AVG(latency_ms) FROM ai_request_log WHERE created_at BETWEEN datetime('now', '-24 hours') AND datetime('now', '-1 hour')) as baseline
        `).catch(() => ({ recent: 0, baseline: 0 }))) as { recent?: number; baseline?: number };

      if (
        latencyComparison.baseline &&
        latencyComparison.baseline > 0 &&
        latencyComparison.recent &&
        latencyComparison.recent > latencyComparison.baseline * 1.5
      ) {
        insights.push({
          type: 'warning',
          title: 'Latency Increase Detected',
          message: `Average latency increased by ${((latencyComparison.recent / latencyComparison.baseline - 1) * 100).toFixed(0)}%`,
          recommendation: 'Consider scaling resources or investigating bottlenecks',
        });
      }

      // Cost optimization opportunity
      const costOptimization = (await dbGet(`
            SELECT 
                model,
                COUNT(*) as requests,
                SUM(cost_usd) as cost
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-7 days')
            GROUP BY model
            ORDER BY cost DESC
            LIMIT 1
        `).catch(() => null)) as { model?: string; requests?: number; cost?: number } | null;

      if (costOptimization && costOptimization.cost && costOptimization.cost > 100) {
        insights.push({
          type: 'info',
          title: 'Cost Optimization Opportunity',
          message: `Model "${costOptimization.model}" accounts for $${costOptimization.cost.toFixed(2)} this week`,
          recommendation: 'Consider using smaller models for simpler tasks',
        });
      }

      return res.json({
        success: true,
        data:
          insights.length > 0
            ? insights
            : [
                {
                  type: 'success',
                  title: 'All Systems Nominal',
                  message: 'No issues or optimization opportunities detected',
                  recommendation: 'Continue monitoring',
                },
              ],
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting insights:', error);
      return res.status(500).json({
        error: 'Failed to get insights',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// ==========================================
// SUMMARY ENDPOINT
// ==========================================

/**
 * GET /api/ai-operations/summary
 * Get operations module summary
 */
router.get(
  '/summary',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const [status, costs, performance] = await Promise.all([
        dbGet(`
                SELECT 
                    COUNT(*) as requests_today,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors_today
                FROM ai_request_log 
                WHERE created_at > datetime('now', 'start of day')
            `).catch(() => ({ requests_today: 0, errors_today: 0 })) as {
          requests_today?: number;
          errors_today?: number;
        },
        dbGet(`
                SELECT SUM(cost_usd) as cost_today
                FROM ai_request_log 
                WHERE created_at > datetime('now', 'start of day')
            `).catch(() => ({ cost_today: 0 })) as { cost_today?: number },
        dbGet(`
                SELECT AVG(latency_ms) as avg_latency
                FROM ai_request_log 
                WHERE created_at > datetime('now', '-1 hour')
            `).catch(() => ({ avg_latency: 0 })) as { avg_latency?: number },
      ]);

      const availability =
        status.requests_today && status.requests_today > 0
          ? ((status.requests_today - (status.errors_today || 0)) / status.requests_today) * 100
          : 100;

      return res.json({
        success: true,
        data: {
          missionControl: {
            status: availability >= 99 ? 'healthy' : availability >= 95 ? 'degraded' : 'critical',
            requestsToday: status.requests_today || 0,
            errorsToday: status.errors_today || 0,
          },
          performance: {
            avgLatency: Math.round(performance.avg_latency || 0),
            availability: parseFloat(availability.toFixed(2)),
          },
          costs: {
            today: parseFloat((costs.cost_today || 0).toFixed(4)),
          },
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting summary:', error);
      return res.status(500).json({
        error: 'Failed to get summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
