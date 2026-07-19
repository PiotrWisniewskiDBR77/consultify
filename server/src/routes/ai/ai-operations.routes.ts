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
// KNOWLEDGE OPS (Tool Knowledge Packs / RAG)
// ==========================================

/**
 * POST /api/ai-operations/knowledge/tool-packs/index
 *
 * Index `knowledge/tool-kb/**` markdown packs into `knowledge_docs` + `knowledge_chunks`.
 * SuperAdmin/Admin only.
 *
 * Body:
 * - forceReindex?: boolean
 */
router.post(
  '/knowledge/tool-packs/index',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const forceReindex = Boolean((req.body as any)?.forceReindex);

      const mod = (await import('../../services/ai/knowledgeIndexer.js')) as any;
      const knowledgeIndexer = (mod.knowledgeIndexer || mod.default?.knowledgeIndexer) as {
        initialize: () => Promise<boolean>;
        indexToolKnowledgePacks: (opts: { forceReindex?: boolean }) => Promise<unknown>;
      };

      if (!knowledgeIndexer?.initialize || !knowledgeIndexer?.indexToolKnowledgePacks) {
        return res.status(503).json({
          statusCode: 503,
          status: false,
          type: 'not_configured',
          message: 'Service temporarily unavailable due to missing configuration',
        });
      }

      const ok = await knowledgeIndexer.initialize();
      if (!ok) return res.status(500).json({ error: 'KnowledgeIndexer initialize() failed' });

      const result = await knowledgeIndexer.indexToolKnowledgePacks({ forceReindex });
      return res.json({ success: true, forceReindex, result });
    } catch (error: unknown) {
      logger.error('[AI Operations] Tool packs indexing failed:', error);
      return res.status(500).json({
        error: 'Tool packs indexing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-operations/knowledge/product-pills/index
 *
 * Index `knowledge/Pigułki wiedzy/**` markdown pills into `knowledge_docs` + `knowledge_chunks`.
 * SuperAdmin/Admin only.
 */
router.post(
  '/knowledge/product-pills/index',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const forceReindex = Boolean((req.body as any)?.forceReindex);

      const mod = (await import('../../services/ai/knowledgeIndexer.js')) as any;
      const knowledgeIndexer = (mod.knowledgeIndexer || mod.default?.knowledgeIndexer) as {
        initialize: () => Promise<boolean>;
        indexProductKnowledgePills: (opts: { forceReindex?: boolean }) => Promise<unknown>;
      };

      if (!knowledgeIndexer?.initialize || !knowledgeIndexer?.indexProductKnowledgePills) {
        return res.status(503).json({
          statusCode: 503,
          status: false,
          type: 'not_configured',
          message: 'Service temporarily unavailable due to missing configuration',
        });
      }

      const ok = await knowledgeIndexer.initialize();
      if (!ok) return res.status(500).json({ error: 'KnowledgeIndexer initialize() failed' });

      const result = await knowledgeIndexer.indexProductKnowledgePills({ forceReindex });
      return res.json({ success: true, forceReindex, result });
    } catch (error: unknown) {
      logger.error('[AI Operations] Product pills indexing failed:', error);
      return res.status(500).json({
        error: 'Product pills indexing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

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
      const activeRequests = ((await dbGet(`
            SELECT COUNT(*) as count FROM ai_usage_logs
            WHERE created_at > now() - interval '5 minutes'
        `).catch(() => ({ count: 0 }))) ?? { count: 0 }) as { count?: number };

      // Get error rate last hour
      const errorRate = ((await dbGet(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
            FROM ai_usage_logs
            WHERE created_at > now() - interval '1 hour'
        `).catch(() => ({ total: 0, errors: 0 }))) ?? { total: 0, errors: 0 }) as {
        total?: number;
        errors?: number;
      };

      // Get queue status (ai_async_jobs may not exist in every deployment —
      // degrade to zero rather than 500 if the relation is absent)
      const queueStatus = ((await dbGet(`
            SELECT COUNT(*) as pending FROM ai_async_jobs
            WHERE status = 'pending'
        `).catch(() => ({ pending: 0 }))) ?? { pending: 0 }) as { pending?: number };

      // Postgres returns COUNT/SUM (bigint) as strings — coerce to Number.
      const totalReqs = Number(errorRate.total ?? 0) || 0;
      const errorCount = Number(errorRate.errors ?? 0) || 0;
      const errorRatePercent =
        totalReqs > 0 ? ((errorCount / totalReqs) * 100).toFixed(2) : '0.00';

      return res.json({
        success: true,
        data: {
          status:
            parseFloat(errorRatePercent) < 5
              ? 'healthy'
              : parseFloat(errorRatePercent) < 15
                ? 'degraded'
                : 'critical',
          activeRequests: Number(activeRequests.count ?? 0) || 0,
          errorRate: parseFloat(errorRatePercent),
          queuedJobs: Number(queueStatus.pending ?? 0) || 0,
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
          timeFilter = "now() - interval '1 hour'";
          break;
        case '24h':
          timeFilter = "now() - interval '24 hours'";
          break;
        case '7d':
          timeFilter = "now() - interval '7 days'";
          break;
        case '30d':
          timeFilter = "now() - interval '30 days'";
          break;
        case '90d':
          timeFilter = "now() - interval '90 days'";
          break;
        default:
          timeFilter = "now() - interval '24 hours'";
      }

      const metrics = ((await dbGet(`
            SELECT
                COUNT(*) as total_requests,
                AVG(latency_ms) as avg_latency,
                MIN(latency_ms) as min_latency,
                MAX(latency_ms) as max_latency,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
                AVG(tokens_used) as avg_tokens
            FROM ai_usage_logs
            WHERE created_at > ${timeFilter}
        `).catch(() => ({
        total_requests: 0,
        avg_latency: 0,
        min_latency: 0,
        max_latency: 0,
        successful: 0,
        failed: 0,
        avg_tokens: 0,
      }))) ?? {
        total_requests: 0,
        avg_latency: 0,
        min_latency: 0,
        max_latency: 0,
        successful: 0,
        failed: 0,
        avg_tokens: 0,
      }) as {
        total_requests?: number;
        avg_latency?: number;
        min_latency?: number;
        max_latency?: number;
        successful?: number;
        failed?: number;
        avg_tokens?: number;
      };

      // Postgres returns COUNT/SUM (bigint) and AVG (numeric) as strings — coerce.
      const totalRequests = Number(metrics.total_requests ?? 0) || 0;
      const successful = Number(metrics.successful ?? 0) || 0;

      return res.json({
        success: true,
        data: {
          period,
          totalRequests,
          avgLatency: Math.round(Number(metrics.avg_latency ?? 0) || 0),
          minLatency: Number(metrics.min_latency ?? 0) || 0,
          maxLatency: Number(metrics.max_latency ?? 0) || 0,
          successRate:
            totalRequests > 0 ? ((successful / totalRequests) * 100).toFixed(2) : '100',
          avgTokens: Math.round(Number(metrics.avg_tokens ?? 0) || 0),
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
          timeFilter = "now() - interval '1 day'";
          break;
        case 'week':
          timeFilter = "now() - interval '7 days'";
          break;
        case 'month':
          timeFilter = "now() - interval '30 days'";
          break;
        default:
          timeFilter = "now() - interval '30 days'";
      }

      const costs = ((await dbGet(`
            SELECT
                SUM(tokens_used) as total_tokens,
                SUM(estimated_cost_usd) as total_cost,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(*) as total_requests
            FROM ai_usage_logs
            WHERE created_at > ${timeFilter}
        `).catch(() => ({
        total_tokens: 0,
        total_cost: 0,
        unique_users: 0,
        total_requests: 0,
      }))) ?? {
        total_tokens: 0,
        total_cost: 0,
        unique_users: 0,
        total_requests: 0,
      }) as {
        total_tokens?: number;
        total_cost?: number;
        unique_users?: number;
        total_requests?: number;
      };

      const byProvider = ((await dbAll(`
            SELECT
                provider,
                SUM(tokens_used) as tokens,
                SUM(estimated_cost_usd) as cost,
                COUNT(*) as requests
            FROM ai_usage_logs
            WHERE created_at > ${timeFilter}
            GROUP BY provider
            ORDER BY cost DESC
        `).catch(() => [])) ?? []) as Array<{
        provider?: string;
        tokens?: number;
        cost?: number;
        requests?: number;
      }>;

      // Postgres returns COUNT/SUM (bigint) and SUM(numeric) as strings — coerce.
      return res.json({
        success: true,
        data: {
          period,
          totalTokens: Number(costs.total_tokens ?? 0) || 0,
          totalCost: parseFloat((Number(costs.total_cost ?? 0) || 0).toFixed(4)),
          uniqueUsers: Number(costs.unique_users ?? 0) || 0,
          totalRequests: Number(costs.total_requests ?? 0) || 0,
          byProvider: byProvider.map((p) => ({
            provider: p.provider,
            tokens: Number(p.tokens ?? 0) || 0,
            cost: parseFloat((Number(p.cost ?? 0) || 0).toFixed(4)),
            requests: Number(p.requests ?? 0) || 0,
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

      const metrics = ((await dbGet(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                AVG(latency_ms) as avg_latency
            FROM ai_usage_logs
            WHERE created_at > now() - interval '24 hours'
        `).catch(() => ({ total: 0, successful: 0, avg_latency: 0 }))) ?? {
        total: 0,
        successful: 0,
        avg_latency: 0,
      }) as {
        total?: number;
        successful?: number;
        avg_latency?: number;
      };

      const p95Latency = ((await dbGet(`
            SELECT latency_ms FROM (
                SELECT latency_ms,
                       ROW_NUMBER() OVER (ORDER BY latency_ms) as row_num,
                       COUNT(*) OVER () as total
                FROM ai_usage_logs
                WHERE created_at > now() - interval '24 hours'
            ) sub WHERE row_num >= total * 0.95
            LIMIT 1
        `).catch(() => ({ latency_ms: 0 }))) ?? { latency_ms: 0 }) as { latency_ms?: number };

      // Postgres returns COUNT/SUM (bigint) and AVG (numeric) as strings — coerce.
      const totalReqs = Number(metrics.total ?? 0) || 0;
      const successfulReqs = Number(metrics.successful ?? 0) || 0;
      const avgLatencyVal = Number(metrics.avg_latency ?? 0) || 0;
      const availability = totalReqs > 0 ? (successfulReqs / totalReqs) * 100 : 100;
      const errorRate = totalReqs > 0 ? ((totalReqs - successfulReqs) / totalReqs) * 100 : 0;

      return res.json({
        success: true,
        data: {
          targets: slaTargets,
          current: {
            availability: parseFloat(availability.toFixed(2)),
            avgLatency: Math.round(avgLatencyVal),
            errorRate: parseFloat(errorRate.toFixed(2)),
            p95Latency: Number(p95Latency.latency_ms ?? 0) || 0,
          },
          compliance: {
            availability: availability >= slaTargets.availability,
            avgLatency: avgLatencyVal <= slaTargets.avgLatency,
            errorRate: errorRate <= slaTargets.errorRate,
            p95Latency: (Number(p95Latency.latency_ms ?? 0) || 0) <= slaTargets.p95Latency,
          },
          overallCompliant:
            availability >= slaTargets.availability &&
            avgLatencyVal <= slaTargets.avgLatency &&
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
 * GET /api/ai-operations/analytics/llm-observatory
 * Unified historical LLM analytics for SuperAdmin.
 */
router.get(
  '/analytics/llm-observatory',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = '30d' } = req.query;

      let requestTimeFilter: string;
      let eventTimeFilter: string;
      let groupBy: string;

      switch (period) {
        case '24h':
          requestTimeFilter = "datetime('now', '-24 hours')";
          eventTimeFilter = "datetime('now', '-24 hours')";
          groupBy = "strftime('%Y-%m-%d %H:00', created_at)";
          break;
        case '7d':
          requestTimeFilter = "datetime('now', '-7 days')";
          eventTimeFilter = "datetime('now', '-7 days')";
          groupBy = "strftime('%Y-%m-%d', created_at)";
          break;
        case '90d':
          requestTimeFilter = "datetime('now', '-90 days')";
          eventTimeFilter = "datetime('now', '-90 days')";
          groupBy = "strftime('%Y-%m-%d', created_at)";
          break;
        case '30d':
        default:
          requestTimeFilter = "datetime('now', '-30 days')";
          eventTimeFilter = "datetime('now', '-30 days')";
          groupBy = "strftime('%Y-%m-%d', created_at)";
          break;
      }

      const [
        summary,
        timelineRows,
        providerRequestRows,
        providerHealthRows,
        activeProviderRows,
        modelRows,
        errorRows,
        healthEventRows,
      ] = await Promise.all([
        dbGet(`
          SELECT
            COUNT(*) as total_requests,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_requests,
            AVG(latency_ms) as avg_latency_ms,
            SUM(tokens_used) as total_tokens,
            SUM(cost_usd) as total_cost,
            COUNT(DISTINCT provider) as providers_used,
            COUNT(DISTINCT model) as models_used
          FROM ai_request_log
          WHERE created_at > ${requestTimeFilter}
        `).catch(() => ({
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          avg_latency_ms: 0,
          total_tokens: 0,
          total_cost: 0,
          providers_used: 0,
          models_used: 0,
        })),
        dbAll(`
          SELECT
            ${groupBy} as bucket,
            COUNT(*) as requests,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
            AVG(latency_ms) as avg_latency_ms,
            SUM(tokens_used) as tokens,
            SUM(cost_usd) as cost
          FROM ai_request_log
          WHERE created_at > ${requestTimeFilter}
          GROUP BY ${groupBy}
          ORDER BY bucket ASC
        `).catch(() => []),
        dbAll(`
          SELECT
            provider,
            COUNT(*) as requests,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
            AVG(latency_ms) as avg_latency_ms,
            SUM(tokens_used) as tokens,
            SUM(cost_usd) as cost
          FROM ai_request_log
          WHERE created_at > ${requestTimeFilter}
          GROUP BY provider
          ORDER BY requests DESC
        `).catch(() => []),
        dbAll(`
          SELECT
            provider,
            COUNT(*) as samples,
            SUM(CASE WHEN available = 1 THEN 1 ELSE 0 END) as available_samples,
            SUM(CASE WHEN available = 0 THEN 1 ELSE 0 END) as unavailable_samples,
            AVG(latency_ms) as avg_latency_ms,
            MAX(timestamp) as last_event_at
          FROM llm_health_events
          WHERE timestamp > ${eventTimeFilter}
          GROUP BY provider
        `).catch(() => []),
        dbAll(`
          SELECT
            provider,
            name,
            is_active,
            health_status,
            last_health_check,
            avg_latency_ms,
            model_id
          FROM llm_providers
          ORDER BY provider ASC, name ASC
        `).catch(() => []),
        dbAll(`
          SELECT
            provider,
            model,
            COUNT(*) as requests,
            SUM(tokens_used) as tokens,
            SUM(cost_usd) as cost,
            AVG(latency_ms) as avg_latency_ms
          FROM ai_request_log
          WHERE created_at > ${requestTimeFilter}
          GROUP BY provider, model
          ORDER BY requests DESC
          LIMIT 15
        `).catch(() => []),
        dbAll(`
          SELECT
            provider,
            COALESCE(NULLIF(error_message, ''), 'Unknown error') as error_message,
            COUNT(*) as occurrences
          FROM ai_request_log
          WHERE created_at > ${requestTimeFilter}
            AND status = 'error'
          GROUP BY provider, COALESCE(NULLIF(error_message, ''), 'Unknown error')
          ORDER BY occurrences DESC
          LIMIT 20
        `).catch(() => []),
        dbAll(`
          SELECT
            provider,
            model,
            status,
            available,
            latency_ms,
            error_message,
            timestamp
          FROM llm_health_events
          WHERE timestamp > ${eventTimeFilter}
          ORDER BY provider ASC, timestamp ASC
        `).catch(() => []),
      ]);

      const activeProviders = Array.isArray(activeProviderRows)
        ? (activeProviderRows as Array<{
            provider?: string;
            name?: string;
            is_active?: number | boolean;
            health_status?: string;
            last_health_check?: string;
            avg_latency_ms?: number;
            model_id?: string;
          }>)
        : [];

      const providerHealthMap = new Map<
        string,
        {
          samples: number;
          availableSamples: number;
          unavailableSamples: number;
          avgLatencyMs: number;
          lastEventAt: string | null;
        }
      >(
        ((providerHealthRows as Array<any>) || []).map((row) => [
          String(row.provider || '').toLowerCase(),
          {
            samples: Number(row.samples || 0),
            availableSamples: Number(row.available_samples || 0),
            unavailableSamples: Number(row.unavailable_samples || 0),
            avgLatencyMs: Math.round(Number(row.avg_latency_ms || 0)),
            lastEventAt: row.last_event_at ? String(row.last_event_at) : null,
          },
        ])
      );

      const providerRequestMap = new Map<
        string,
        {
          requests: number;
          successful: number;
          failed: number;
          avgLatencyMs: number;
          tokens: number;
          cost: number;
        }
      >(
        ((providerRequestRows as Array<any>) || []).map((row) => [
          String(row.provider || '').toLowerCase(),
          {
            requests: Number(row.requests || 0),
            successful: Number(row.successful || 0),
            failed: Number(row.failed || 0),
            avgLatencyMs: Math.round(Number(row.avg_latency_ms || 0)),
            tokens: Number(row.tokens || 0),
            cost: Number(row.cost || 0),
          },
        ])
      );

      const allProviderKeys = new Set<string>();
      activeProviders.forEach((row) =>
        allProviderKeys.add(String(row.provider || '').toLowerCase())
      );
      providerHealthMap.forEach((_value, key) => allProviderKeys.add(key));
      providerRequestMap.forEach((_value, key) => allProviderKeys.add(key));

      const providers = Array.from(allProviderKeys)
        .map((providerKey) => {
          const providerMeta = activeProviders.find(
            (row) => String(row.provider || '').toLowerCase() === providerKey
          );
          const requestData = providerRequestMap.get(providerKey);
          const healthData = providerHealthMap.get(providerKey);
          const samples = healthData?.samples || 0;
          const uptimePct =
            samples > 0
              ? Number((((healthData?.availableSamples || 0) / samples) * 100).toFixed(1))
              : null;
          const requestCount = requestData?.requests || 0;
          const successRate =
            requestCount > 0
              ? Number((((requestData?.successful || 0) / requestCount) * 100).toFixed(1))
              : null;
          const errorRate =
            requestCount > 0
              ? Number((((requestData?.failed || 0) / requestCount) * 100).toFixed(1))
              : null;

          return {
            provider: providerKey,
            name: providerMeta?.name || providerKey,
            active: Boolean(providerMeta?.is_active),
            currentStatus: String(providerMeta?.health_status || 'unknown'),
            lastHealthCheck: providerMeta?.last_health_check || healthData?.lastEventAt || null,
            requestCount,
            successRate,
            errorRate,
            avgLatencyMs:
              requestData?.avgLatencyMs ||
              providerMeta?.avg_latency_ms ||
              healthData?.avgLatencyMs ||
              0,
            totalTokens: requestData?.tokens || 0,
            totalCost: Number((requestData?.cost || 0).toFixed(4)),
            uptimePct,
            healthSamples: samples,
            unavailableSamples: healthData?.unavailableSamples || 0,
            modelId: providerMeta?.model_id || null,
          };
        })
        .sort((a, b) => {
          const requestDiff = (b.requestCount || 0) - (a.requestCount || 0);
          if (requestDiff !== 0) return requestDiff;
          return String(a.provider).localeCompare(String(b.provider));
        });

      const incidents: Array<{
        provider: string;
        start: string;
        end: string | null;
        durationMs: number;
        samples: number;
        lastError: string | null;
      }> = [];

      const currentIncidentByProvider = new Map<
        string,
        {
          startTs: number;
          samples: number;
          lastError: string | null;
        }
      >();

      for (const row of (healthEventRows as Array<any>) || []) {
        const providerKey = String(row.provider || '').toLowerCase();
        const ts = new Date(String(row.timestamp || '')).getTime();
        if (!Number.isFinite(ts) || !providerKey) continue;

        const isAvailable =
          row.available === true ||
          row.available === 1 ||
          String(row.status || '').toLowerCase() === 'healthy' ||
          String(row.status || '').toLowerCase() === 'degraded';

        const currentIncident = currentIncidentByProvider.get(providerKey);
        if (!isAvailable) {
          if (!currentIncident) {
            currentIncidentByProvider.set(providerKey, {
              startTs: ts,
              samples: 1,
              lastError: row.error_message ? String(row.error_message) : null,
            });
          } else {
            currentIncident.samples += 1;
            if (row.error_message) currentIncident.lastError = String(row.error_message);
          }
          continue;
        }

        if (currentIncident) {
          incidents.push({
            provider: providerKey,
            start: new Date(currentIncident.startTs).toISOString(),
            end: new Date(ts).toISOString(),
            durationMs: Math.max(0, ts - currentIncident.startTs),
            samples: currentIncident.samples,
            lastError: currentIncident.lastError,
          });
          currentIncidentByProvider.delete(providerKey);
        }
      }

      const nowTs = Date.now();
      currentIncidentByProvider.forEach((incident, providerKey) => {
        incidents.push({
          provider: providerKey,
          start: new Date(incident.startTs).toISOString(),
          end: null,
          durationMs: Math.max(0, nowTs - incident.startTs),
          samples: incident.samples,
          lastError: incident.lastError,
        });
      });

      incidents.sort((a, b) => {
        const aTs = new Date(a.start).getTime();
        const bTs = new Date(b.start).getTime();
        return bTs - aTs;
      });

      const totalRequests = Number((summary as any)?.total_requests || 0);
      const successfulRequests = Number((summary as any)?.successful_requests || 0);
      const failedRequests = Number((summary as any)?.failed_requests || 0);
      const successRate =
        totalRequests > 0 ? Number(((successfulRequests / totalRequests) * 100).toFixed(1)) : 100;
      const errorRate =
        totalRequests > 0 ? Number(((failedRequests / totalRequests) * 100).toFixed(1)) : 0;

      return res.json({
        success: true,
        data: {
          period,
          summary: {
            totalRequests,
            successfulRequests,
            failedRequests,
            successRate,
            errorRate,
            avgLatencyMs: Math.round(Number((summary as any)?.avg_latency_ms || 0)),
            totalTokens: Number((summary as any)?.total_tokens || 0),
            totalCost: Number(Number((summary as any)?.total_cost || 0).toFixed(4)),
            providersUsed: Number((summary as any)?.providers_used || 0),
            modelsUsed: Number((summary as any)?.models_used || 0),
            incidents: incidents.length,
            activeIncidents: incidents.filter((incident) => incident.end === null).length,
          },
          timeline: ((timelineRows as Array<any>) || []).map((row) => ({
            bucket: row.bucket,
            requests: Number(row.requests || 0),
            successful: Number(row.successful || 0),
            failed: Number(row.failed || 0),
            successRate:
              Number(row.requests || 0) > 0
                ? Number(
                    ((Number(row.successful || 0) / Number(row.requests || 0)) * 100).toFixed(1)
                  )
                : 100,
            avgLatencyMs: Math.round(Number(row.avg_latency_ms || 0)),
            tokens: Number(row.tokens || 0),
            cost: Number(Number(row.cost || 0).toFixed(4)),
          })),
          providers,
          models: ((modelRows as Array<any>) || []).map((row) => ({
            provider: row.provider,
            model: row.model || 'unknown',
            requests: Number(row.requests || 0),
            tokens: Number(row.tokens || 0),
            cost: Number(Number(row.cost || 0).toFixed(4)),
            avgLatencyMs: Math.round(Number(row.avg_latency_ms || 0)),
          })),
          errorCategories: ((errorRows as Array<any>) || []).map((row) => ({
            provider: row.provider,
            error: row.error_message,
            occurrences: Number(row.occurrences || 0),
          })),
          incidents: incidents.slice(0, 50),
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Operations] Error getting LLM observatory analytics:', error);
      return res.status(500).json({
        error: 'Failed to get LLM observatory analytics',
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
      // (Postgres returns numeric aggregates as strings — coerce to Number.)
      const errorRateRow = ((await dbGet(`
            SELECT
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as rate
            FROM ai_usage_logs
            WHERE created_at > now() - interval '1 hour'
        `).catch(() => ({ rate: 0 }))) ?? { rate: 0 }) as { rate?: number | string | null };
      const errorRateValue = Number(errorRateRow.rate ?? 0) || 0;

      if (errorRateValue > 5) {
        insights.push({
          type: 'warning',
          title: 'High Error Rate Detected',
          message: `Error rate is ${errorRateValue.toFixed(1)}% in the last hour`,
          recommendation: 'Review recent error logs and check provider health',
        });
      }

      // Check for latency increases
      const latencyRow = ((await dbGet(`
            SELECT
                (SELECT AVG(latency_ms) FROM ai_usage_logs WHERE created_at > now() - interval '1 hour') as recent,
                (SELECT AVG(latency_ms) FROM ai_usage_logs WHERE created_at BETWEEN now() - interval '24 hours' AND now() - interval '1 hour') as baseline
        `).catch(() => ({ recent: 0, baseline: 0 }))) ?? { recent: 0, baseline: 0 }) as {
        recent?: number | string | null;
        baseline?: number | string | null;
      };
      const recentLatency = Number(latencyRow.recent ?? 0) || 0;
      const baselineLatency = Number(latencyRow.baseline ?? 0) || 0;

      if (baselineLatency > 0 && recentLatency > baselineLatency * 1.5) {
        insights.push({
          type: 'warning',
          title: 'Latency Increase Detected',
          message: `Average latency increased by ${((recentLatency / baselineLatency - 1) * 100).toFixed(0)}%`,
          recommendation: 'Consider scaling resources or investigating bottlenecks',
        });
      }

      // Cost optimization opportunity
      const costOptimizationRow = (await dbGet(`
            SELECT
                model,
                COUNT(*) as requests,
                SUM(estimated_cost_usd) as cost
            FROM ai_usage_logs
            WHERE created_at > now() - interval '7 days'
            GROUP BY model
            ORDER BY cost DESC
            LIMIT 1
        `).catch(() => null)) as { model?: string; requests?: number | string; cost?: number | string } | null;
      const costOptimization = costOptimizationRow
        ? { model: costOptimizationRow.model, cost: Number(costOptimizationRow.cost ?? 0) || 0 }
        : null;

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
      const [statusRaw, costsRaw, performanceRaw] = await Promise.all([
        dbGet(`
                SELECT
                    COUNT(*) as requests_today,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors_today
                FROM ai_usage_logs
                WHERE created_at > date_trunc('day', now())
            `).catch(() => ({ requests_today: 0, errors_today: 0 })),
        dbGet(`
                SELECT SUM(estimated_cost_usd) as cost_today
                FROM ai_usage_logs
                WHERE created_at > date_trunc('day', now())
            `).catch(() => ({ cost_today: 0 })),
        dbGet(`
                SELECT AVG(latency_ms) as avg_latency
                FROM ai_usage_logs
                WHERE created_at > now() - interval '1 hour'
            `).catch(() => ({ avg_latency: 0 })),
      ]);

      const status = (statusRaw ?? { requests_today: 0, errors_today: 0 }) as {
        requests_today?: number | string;
        errors_today?: number | string;
      };
      const costs = (costsRaw ?? { cost_today: 0 }) as { cost_today?: number | string };
      const performance = (performanceRaw ?? { avg_latency: 0 }) as {
        avg_latency?: number | string;
      };

      // Postgres returns COUNT/SUM (bigint) and AVG/SUM(numeric) as strings — coerce.
      const requestsToday = Number(status.requests_today ?? 0) || 0;
      const errorsToday = Number(status.errors_today ?? 0) || 0;
      const availability =
        requestsToday > 0 ? ((requestsToday - errorsToday) / requestsToday) * 100 : 100;

      return res.json({
        success: true,
        data: {
          missionControl: {
            status: availability >= 99 ? 'healthy' : availability >= 95 ? 'degraded' : 'critical',
            requestsToday,
            errorsToday,
          },
          performance: {
            avgLatency: Math.round(Number(performance.avg_latency ?? 0) || 0),
            availability: parseFloat(availability.toFixed(2)),
          },
          costs: {
            today: parseFloat((Number(costs.cost_today ?? 0) || 0).toFixed(4)),
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
