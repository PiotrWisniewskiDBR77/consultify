/**
 * AI Analytics Routes
 * API endpoints for monitoring AI usage, costs, and performance metrics
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { getFinOpsOverview } from '../../services/ai/llmFinOpsService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();

// Dynamic imports for services (may not be migrated yet)
let aiLogger: { error?: (category: string, message: string) => void } | null = null;

try {
  const loggerModule = (await import('../../services/ai/logger.js')) as any;
  const module = loggerModule.default || loggerModule;
  aiLogger = module.aiLogger || module;
} catch {
  logger.warn('[AI Analytics Routes] aiLogger not available');
}

// All routes require authentication
router.use(verifyToken);

// Helper function
async function getOrganizationBudget(
  organizationId: string
): Promise<{ monthly_ai_budget?: number } | null> {
  return dbGet(
    `
        SELECT monthly_ai_budget FROM organizations WHERE id = ?
    `,
    [organizationId]
  ) as Promise<{ monthly_ai_budget?: number } | null>;
}

/**
 * GET /api/ai-analytics/costs
 * Get AI cost breakdown
 */
router.get(
  '/finops/overview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const overview = await getFinOpsOverview(organizationId);
      return res.json({ success: true, overview });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIAnalytics',
          `finops overview error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch FinOps overview' });
    }
  })
);

router.get(
  '/costs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = '30d', groupBy = 'day' } = req.query;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Parse period
      let daysBack = 30;
      if (period === '7d') daysBack = 7;
      else if (period === '90d') daysBack = 90;
      else if (period === '1y') daysBack = 365;

      // NOTE: `cost_usd` never existed on ai_usage_logs (real column is
      // `estimated_cost_usd` — same stale-schema class as aiObservabilityService.ts).
      // COALESCE still validates every referenced column at parse time in Postgres,
      // so this 500ed GET /api/ai/analytics/costs for groupBy=day|capability|model.
      const costExpr = 'COALESCE(estimated_cost_usd, 0)';
      const capabilityExpr = "COALESCE(NULLIF(purpose, ''), NULLIF(action, ''), 'unknown')";

      // Get cost data from ai_usage_logs (runtime SSOT)
      let sql = '';
      if (groupBy === 'day') {
        sql = `
                SELECT 
                    DATE(created_at) as date,
                    SUM(tokens_used) as total_tokens,
                    SUM(${costExpr}) as total_cost,
                    COUNT(*) as request_count,
                    ${capabilityExpr} as capability,
                    model
                FROM ai_usage_logs
                WHERE organization_id = ?
                AND created_at > datetime('now', '-${daysBack} days')
                GROUP BY DATE(created_at), ${capabilityExpr}, model
                ORDER BY date DESC
            `;
      } else if (groupBy === 'capability') {
        sql = `
                SELECT 
                    ${capabilityExpr} as capability,
                    SUM(tokens_used) as total_tokens,
                    SUM(${costExpr}) as total_cost,
                    COUNT(*) as request_count,
                    AVG(latency_ms) as avg_latency
                FROM ai_usage_logs
                WHERE organization_id = ?
                AND created_at > datetime('now', '-${daysBack} days')
                GROUP BY ${capabilityExpr}
                ORDER BY total_cost DESC
            `;
      } else if (groupBy === 'model') {
        sql = `
                SELECT 
                    model,
                    SUM(tokens_used) as total_tokens,
                    SUM(${costExpr}) as total_cost,
                    COUNT(*) as request_count,
                    AVG(latency_ms) as avg_latency
                FROM ai_usage_logs
                WHERE organization_id = ?
                AND created_at > datetime('now', '-${daysBack} days')
                GROUP BY model
                ORDER BY total_cost DESC
            `;
      }

      const costData = await dbAll(sql, [organizationId]);

      // Get totals
      const totals = (await dbGet(
        `
            SELECT 
                SUM(tokens_used) as total_tokens,
                SUM(COALESCE(estimated_cost_usd, 0)) as total_cost,
                COUNT(*) as total_requests,
                AVG(latency_ms) as avg_latency,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests
            FROM ai_usage_logs
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
        `,
        [organizationId]
      )) as {
        total_tokens?: number;
        total_cost?: number;
        total_requests?: number;
        successful_requests?: number;
      };

      // Get budget information
      const budget = await getOrganizationBudget(organizationId);

      return res.json({
        success: true,
        period,
        groupBy,
        data: costData,
        totals: {
          ...totals,
          successRate:
            totals.total_requests && totals.total_requests > 0
              ? (((totals.successful_requests || 0) / totals.total_requests) * 100).toFixed(1)
              : 0,
        },
        budget: budget
          ? {
              monthly: budget.monthly_ai_budget || 0,
              used: totals.total_cost || 0,
              remaining: (budget.monthly_ai_budget || 0) - (totals.total_cost || 0),
              utilization:
                budget.monthly_ai_budget && budget.monthly_ai_budget > 0
                  ? (((totals.total_cost || 0) / budget.monthly_ai_budget) * 100).toFixed(1)
                  : 0,
            }
          : null,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIAnalytics',
          `costs error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch cost data' });
    }
  })
);

/**
 * GET /api/ai-analytics/usage
 * Get AI usage metrics
 */
router.get(
  '/usage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = '30d' } = req.query;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let daysBack = 30;
      if (period === '7d') daysBack = 7;
      else if (period === '90d') daysBack = 90;

      // Get usage by user
      const userUsage = await dbAll(
        `
            SELECT
                COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.display_name, u.email) as user_name,
                u.email,
                COUNT(*) as request_count,
                SUM(a.tokens_used) as total_tokens,
                SUM(COALESCE(a.estimated_cost_usd, 0)) as total_cost
            FROM ai_usage_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.organization_id = ?
            AND a.created_at > datetime('now', '-${daysBack} days')
            GROUP BY a.user_id, u.first_name, u.last_name, u.display_name, u.email
            ORDER BY total_tokens DESC
            LIMIT 20
        `,
        [organizationId]
      );

      // Get usage trends (daily)
      const dailyTrends = await dbAll(
        `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as requests,
                SUM(tokens_used) as tokens,
                SUM(COALESCE(estimated_cost_usd, 0)) as cost
            FROM ai_usage_logs
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `,
        [organizationId]
      );

      // Get capability distribution
      const capabilityDistribution = await dbAll(
        `
            SELECT 
                COALESCE(NULLIF(purpose, ''), NULLIF(action, ''), 'unknown') as capability,
                COUNT(*) as count,
                SUM(tokens_used) as tokens
            FROM ai_usage_logs
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
            GROUP BY COALESCE(NULLIF(purpose, ''), NULLIF(action, ''), 'unknown')
            ORDER BY count DESC
        `,
        [organizationId]
      );

      return res.json({
        success: true,
        period,
        userUsage: (userUsage || []).map((r: any) => ({
          ...r,
          request_count: Number(r.request_count ?? 0),
          total_tokens: Number(r.total_tokens ?? 0),
        })),
        dailyTrends: (dailyTrends || []).map((r: any) => ({
          ...r,
          requests: Number(r.requests ?? 0),
          tokens: Number(r.tokens ?? 0),
        })),
        capabilityDistribution: (capabilityDistribution || []).map((r: any) => ({
          ...r,
          count: Number(r.count ?? 0),
          tokens: Number(r.tokens ?? 0),
        })),
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIAnalytics',
          `usage error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch usage data' });
    }
  })
);

/**
 * GET /api/ai-analytics/quotas
 * Get quota status for the organization
 */
router.get(
  '/quotas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get user quota
      const userQuota = (await dbGet(
        `
            SELECT * FROM ai_usage_quotas
            WHERE entity_type = 'user' AND entity_id = ?
        `,
        [userId]
      )) as {
        daily_token_limit?: number;
        tokens_used_today?: number;
        monthly_token_limit?: number;
        tokens_used_month?: number;
      } | null;

      // Get org quota
      const orgQuota = (await dbGet(
        `
            SELECT * FROM ai_usage_quotas
            WHERE entity_type = 'organization' AND entity_id = ?
        `,
        [organizationId]
      )) as {
        daily_token_limit?: number;
        tokens_used_today?: number;
        monthly_token_limit?: number;
        tokens_used_month?: number;
      } | null;

      return res.json({
        success: true,
        userQuota: userQuota
          ? {
              dailyLimit: userQuota.daily_token_limit || 0,
              dailyUsed: userQuota.tokens_used_today || 0,
              dailyRemaining:
                (userQuota.daily_token_limit || 0) - (userQuota.tokens_used_today || 0),
              monthlyLimit: userQuota.monthly_token_limit || 0,
              monthlyUsed: userQuota.tokens_used_month || 0,
              monthlyRemaining:
                (userQuota.monthly_token_limit || 0) - (userQuota.tokens_used_month || 0),
            }
          : null,
        organizationQuota: orgQuota
          ? {
              dailyLimit: orgQuota.daily_token_limit || 0,
              dailyUsed: orgQuota.tokens_used_today || 0,
              dailyRemaining: (orgQuota.daily_token_limit || 0) - (orgQuota.tokens_used_today || 0),
              monthlyLimit: orgQuota.monthly_token_limit || 0,
              monthlyUsed: orgQuota.tokens_used_month || 0,
              monthlyRemaining:
                (orgQuota.monthly_token_limit || 0) - (orgQuota.tokens_used_month || 0),
            }
          : null,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIAnalytics',
          `quotas error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch quota data' });
    }
  })
);

/**
 * GET /api/ai-analytics/performance
 * Get AI performance metrics
 */
router.get(
  '/performance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period = '7d' } = req.query;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let daysBack = 7;
      if (period === '30d') daysBack = 30;

      // Get latency percentiles
      const latencyStats = (await dbAll(
        `
            SELECT 
                model,
                COALESCE(NULLIF(purpose, ''), NULLIF(action, ''), 'unknown') as capability,
                AVG(latency_ms) as avg_latency,
                MIN(latency_ms) as min_latency,
                MAX(latency_ms) as max_latency,
                COUNT(*) as sample_count
            FROM ai_usage_logs
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
            AND status = 'success'
            GROUP BY model, COALESCE(NULLIF(purpose, ''), NULLIF(action, ''), 'unknown')
        `,
        [organizationId]
      )) as Array<{
        avg_latency?: number;
        min_latency?: number;
        max_latency?: number;
      }>;

      // Get error rates
      const errorRates = (await dbAll(
        `
            SELECT 
                model,
                COALESCE(NULLIF(purpose, ''), NULLIF(action, ''), 'unknown') as capability,
                COUNT(*) as total,
                SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as errors
            FROM ai_usage_logs
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
            GROUP BY model, COALESCE(NULLIF(purpose, ''), NULLIF(action, ''), 'unknown')
        `,
        [organizationId]
      )) as Array<{
        total?: number;
        errors?: number;
      }>;

      // Get cache hit rate
      const cacheStats = (await dbGet(
        `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN metadata IS NOT NULL AND TRIM(metadata) != '' THEN 1 ELSE 0 END) as with_context
            FROM ai_usage_logs
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
        `,
        [organizationId]
      )) as {
        total?: number;
        with_context?: number;
      } | null;

      return res.json({
        success: true,
        period,
        latency: latencyStats.map((l: any) => ({
          ...l,
          sample_count: Number(l.sample_count ?? 0),
          avg_latency: Math.round(Number(l.avg_latency) || 0),
          min_latency: Math.round(Number(l.min_latency) || 0),
          max_latency: Math.round(Number(l.max_latency) || 0),
        })),
        errorRates: errorRates.map((e) => {
          const tot = Number(e.total ?? 0);
          const err = Number(e.errors ?? 0);
          return {
            ...e,
            total: tot,
            errors: err,
            errorRate: tot > 0 ? ((err / tot) * 100).toFixed(2) : 0,
          };
        }),
        contextUtilization: (() => {
          const tot = Number(cacheStats?.total ?? 0);
          const ctx = Number(cacheStats?.with_context ?? 0);
          return tot > 0 ? ((ctx / tot) * 100).toFixed(1) : 0;
        })(),
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIAnalytics',
          `performance error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch performance data' });
    }
  })
);

/**
 * POST /api/ai-analytics/alerts/configure
 * Configure cost alerts (admin only)
 */
router.post(
  '/alerts/configure',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userRole = (req.user?.role || '').toLowerCase();
      if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(userRole)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { thresholds, emailNotifications, slackWebhook } = req.body;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Store alert configuration
      await dbRun(
        `
            INSERT OR REPLACE INTO organization_settings 
            (organization_id, setting_key, setting_value, updated_at)
            VALUES (?, 'ai_cost_alerts', ?, datetime('now'))
        `,
        [
          organizationId,
          JSON.stringify({
            thresholds: thresholds || [70, 85, 95],
            emailNotifications: emailNotifications || [],
            slackWebhook: slackWebhook || null,
          }),
        ]
      );

      return res.json({ success: true, message: 'Alert configuration saved' });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIAnalytics',
          `alerts configure error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to configure alerts' });
    }
  })
);

export default router;
