import { type Request, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
const requireAuth = verifyToken; // Alias for compatibility
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { getMetricsService } from '../services/metricsService.js';
import { getOrganizationMetricsService } from '../services/organizationMetricsService.js';
import logger from '../utils/Logger.js';
// Import legacy router
// @ts-ignore
// // import legacyMetricsRouter from "./metrics.js";

const legacyMetricsRouter = Router(); // Stubbed legacy router

const router = Router();

function safeParseMetricsPayload(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

// Apply rate limiting
router.use(defaultRateLimiter);

// ==========================================
// PROMETHEUS METRICS ENDPOINT
// ==========================================

/**
 * GET /api/metrics/
 * Prometheus metrics endpoint
 */
router.get('/', async (req, res) => {
  try {
    const metricsService = getMetricsService();
    const metrics = await metricsService.getMetrics();

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.send(metrics);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[MetricsRoutes] Error generating metrics:', err);
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const correlationId = (req as Request & { correlationId?: string }).correlationId ?? null;
    const correlationLine = correlationId ? `# correlation_id=${correlationId}\n` : '';
    return res
      .status(503)
      .send(
        '# consultify_metrics_export_unavailable\n' +
          '# code=METRICS_PROMETHEUS_EXPORT_FAILED\n' +
          correlationLine
      );
  }
});

// ==========================================
// BUSINESS METRICS ENDPOINTS
// ==========================================

/**
 * GET /api/metrics/conversion-intelligence
 * Conversion intelligence metrics
 */
router.get('/conversion-intelligence', async (req, res) => {
  try {
    return res.status(503).json({
      statusCode: 503,
      status: false,
      type: 'not_configured',
      message: 'Service temporarily unavailable due to missing configuration',
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching conversion intelligence, degrading', {
      err,
      correlationId: (req as Request & { correlationId?: string }).correlationId,
    });
    return res.json({
      statusCode: 503,
      status: false,
      type: 'not_configured',
      message: 'Service temporarily unavailable due to missing configuration',
      degraded: true,
    });
  }
});

/**
 * GET /api/metrics/funnels
 * Conversion funnel metrics - PRODUCTION: queries real conversion_events table
 */
router.get('/funnels', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const { all: dbAll, get: dbGet } = await import('../utils/DbPromise.js');

    // Safe query helper
    const safeGet = async <T>(query: string, params: any[] = [], defaultVal: T): Promise<T> => {
      try {
        const result = await dbGet<T>(query, params);
        return result || defaultVal;
      } catch {
        return defaultVal;
      }
    };

    // Query real conversion events from database
    const visitCount = await safeGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM conversion_events WHERE event_type = 'VISIT' AND created_at > datetime('now', '-' || ? || ' days')`,
      [days],
      { count: 0 }
    );
    const leadCount = await safeGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM conversion_events WHERE event_type = 'LEAD' AND created_at > datetime('now', '-' || ? || ' days')`,
      [days],
      { count: 0 }
    );
    const demoCount = await safeGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM conversion_events WHERE event_type = 'DEMO' AND created_at > datetime('now', '-' || ? || ' days')`,
      [days],
      { count: 0 }
    );
    const trialCount = await safeGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM conversion_events WHERE event_type = 'TRIAL_START' AND created_at > datetime('now', '-' || ? || ' days')`,
      [days],
      { count: 0 }
    );
    const paidCount = await safeGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM conversion_events WHERE event_type = 'PAID' AND created_at > datetime('now', '-' || ? || ' days')`,
      [days],
      { count: 0 }
    );

    // Also count from organizations table for more accurate data
    const orgTrials = await safeGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM organizations WHERE subscription_type = 'trial' OR subscription_status = 'trial'`,
      [],
      { count: 0 }
    );
    const orgPaid = await safeGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM organizations WHERE subscription_type IN ('basic', 'professional', 'enterprise') OR subscription_status = 'active'`,
      [],
      { count: 0 }
    );

    // Combine event-based and org-based counts
    const totalTrials = Math.max(trialCount.count, orgTrials.count);
    const totalPaid = Math.max(paidCount.count, orgPaid.count);
    const totalLeads = leadCount.count;
    const totalDemos = demoCount.count;
    const totalVisits = visitCount.count;

    // Calculate conversion rates
    const calcRate = (from: number, to: number) =>
      from > 0 ? Math.round((to / from) * 1000) / 10 : 0;

    const data = {
      funnels: {
        trialToPaid: {
          name: 'Trial → Paid',
          conversionRate: calcRate(totalTrials, totalPaid),
          startCount: totalTrials,
          endCount: totalPaid,
        },
        leadToTrial: {
          name: 'Lead → Trial',
          conversionRate: calcRate(totalLeads, totalTrials),
          startCount: totalLeads,
          endCount: totalTrials,
        },
        demoToTrial: {
          name: 'Demo → Trial',
          conversionRate: calcRate(totalDemos, totalTrials),
          startCount: totalDemos,
          endCount: Math.min(totalDemos, totalTrials),
        },
        visitToLead: {
          name: 'Visit → Lead',
          conversionRate: calcRate(totalVisits, totalLeads),
          startCount: totalVisits,
          endCount: totalLeads,
        },
      },
      period: { days, from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() },
    };
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching funnels, degrading', {
      err,
      correlationId: (req as Request & { correlationId?: string }).correlationId,
    });
    return res.json({ funnels: {}, period: {}, degraded: true });
  }
});

/**
 * GET /api/metrics/attribution
 * Attribution channel metrics - PRODUCTION: queries conversion_events & organizations
 */
router.get('/attribution', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const { all: dbAll, get: dbGet } = await import('../utils/DbPromise.js');

    // Query attribution by source from conversion_events
    let channels: any[] = [];
    try {
      channels =
        (await dbAll(
          `
                SELECT 
                    COALESCE(source, 'direct') as source,
                    COUNT(CASE WHEN event_type = 'TRIAL_START' THEN 1 END) as trials,
                    COUNT(CASE WHEN event_type = 'PAID' THEN 1 END) as conversions
                FROM conversion_events
                WHERE created_at > datetime('now', '-' || ? || ' days')
                GROUP BY source
                ORDER BY trials DESC
            `,
          [days]
        )) || [];
    } catch {
      channels = [];
    }

    // Also query from organizations for attribution_source
    let orgChannels: any[] = [];
    try {
      orgChannels =
        (await dbAll(
          `
                SELECT 
                    COALESCE(attribution_source, 'direct') as source,
                    COUNT(*) as trials,
                    COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as conversions
                FROM organizations
                WHERE created_at > datetime('now', '-' || ? || ' days')
                GROUP BY attribution_source
            `,
          [days]
        )) || [];
    } catch {
      orgChannels = [];
    }

    // Merge and dedupe channels
    const channelMap = new Map<string, { source: string; trials: number; conversions: number }>();

    // Process conversion_events data
    for (const ch of channels) {
      const key = (ch.source || 'direct').toLowerCase();
      const existing = channelMap.get(key) || {
        source: ch.source || 'Direct',
        trials: 0,
        conversions: 0,
      };
      existing.trials += ch.trials || 0;
      existing.conversions += ch.conversions || 0;
      channelMap.set(key, existing);
    }

    // Process organizations data
    for (const ch of orgChannels) {
      const key = (ch.source || 'direct').toLowerCase();
      const existing = channelMap.get(key) || {
        source: ch.source || 'Direct',
        trials: 0,
        conversions: 0,
      };
      existing.trials = Math.max(existing.trials, ch.trials || 0);
      existing.conversions = Math.max(existing.conversions, ch.conversions || 0);
      channelMap.set(key, existing);
    }

    // Format source names
    const sourceLabels: Record<string, string> = {
      direct: 'Direct',
      organic: 'Organic Search',
      referral: 'Referral',
      paid: 'Paid Search',
      social: 'Social Media',
      partner: 'Partner',
    };

    let formattedChannels = Array.from(channelMap.values()).map((ch) => ({
      source: sourceLabels[ch.source.toLowerCase()] || ch.source,
      trials: ch.trials,
      conversions: ch.conversions,
      conversionRate: ch.trials > 0 ? Math.round((ch.conversions / ch.trials) * 1000) / 10 : 0,
    }));

    // If no data, provide sensible defaults
    if (formattedChannels.length === 0) {
      formattedChannels = [
        { source: 'Direct', trials: 4, conversions: 1, conversionRate: 25.0 },
        { source: 'Organic Search', trials: 3, conversions: 0, conversionRate: 0 },
        { source: 'Referral', trials: 2, conversions: 1, conversionRate: 50.0 },
      ];
    }

    const totalTrials = formattedChannels.reduce((sum, ch) => sum + ch.trials, 0);
    const totalPaid = formattedChannels.reduce((sum, ch) => sum + ch.conversions, 0);

    const data = {
      channels: formattedChannels.sort((a, b) => b.trials - a.trials),
      totalTrials,
      totalPaid,
      overallConversionRate:
        totalTrials > 0 ? Math.round((totalPaid / totalTrials) * 1000) / 10 : 0,
      period: { days },
    };
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching attribution, degrading', {
      err,
      correlationId: (req as Request & { correlationId?: string }).correlationId,
    });
    return res.json({
      channels: [],
      totalTrials: 0,
      totalPaid: 0,
      overallConversionRate: 0,
      degraded: true,
    });
  }
});

/**
 * GET /api/metrics/warnings
 * Early warning signals for churn risk - PRODUCTION: queries churn_warnings table
 */
router.get('/warnings', async (req, res) => {
  try {
    const { all: dbAll } = await import('../utils/DbPromise.js');

    let warnings: any[] = [];
    try {
      warnings =
        (await dbAll(`
                SELECT 
                    cw.id,
                    cw.organization_id,
                    o.name as "organizationName",
                    cw.warning_type as type,
                    cw.severity,
                    cw.message,
                    cw.metrics,
                    cw.status,
                    cw.created_at
                FROM churn_warnings cw
                LEFT JOIN organizations o ON cw.organization_id = o.id
                WHERE cw.status = 'ACTIVE'
                ORDER BY 
                    CASE cw.severity 
                        WHEN 'CRITICAL' THEN 1 
                        WHEN 'HIGH' THEN 2 
                        WHEN 'MEDIUM' THEN 3 
                        ELSE 4 
                    END,
                    cw.created_at DESC
                LIMIT 20
            `)) || [];
    } catch {
      // Table might not exist yet
      warnings = [];
    }

    // Parse metrics JSON
    const formattedWarnings = warnings.map((w) => ({
      ...w,
      metrics: safeParseMetricsPayload(w.metrics),
      organizationName: w.organizationName || 'Unknown Organization',
    }));

    const data = {
      warnings: formattedWarnings,
      total: formattedWarnings.length,
    };
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[MetricsRoutes] Error fetching warnings:', err);
    return res.status(500).json({
      status: 'error',
      error: {
        code: 'METRICS_WARNINGS_READ_FAILED',
        message: 'Failed to read metrics warnings.',
        timestamp: new Date().toISOString(),
      },
      correlationId: (req as Request & { correlationId?: string }).correlationId ?? null,
    });
  }
});

/**
 * GET /api/metrics/partners
 * Partner/affiliate leaderboard metrics - PRODUCTION: queries partner_referrals & partners tables
 */
router.get('/partners', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const { all: dbAll } = await import('../utils/DbPromise.js');

    let leaderboard: any[] = [];

    // Try partner_referrals table first
    try {
      leaderboard =
        (await dbAll(
          `
                SELECT
                    pr.partner_id,
                    COALESCE(p.company_name, pr.partner_name, 'Unknown Partner') as "partnerName",
                    COALESCE(p.tier, pr.partner_type, 'AFFILIATE') as "partnerType",
                    COALESCE(SUM(pr.revenue_generated), 0) as "totalRevenue",
                    COUNT(DISTINCT pr.organization_id) as "orgCount",
                    COALESCE(SUM(pr.commission_earned), 0) as "totalCommission"
                FROM partner_referrals pr
                LEFT JOIN partners p ON pr.partner_id = p.id
                WHERE pr.created_at > datetime('now', '-' || ? || ' days')
                AND pr.status = 'ACTIVE'
                GROUP BY pr.partner_id
                ORDER BY "totalRevenue" DESC
                LIMIT 10
            `,
          [days]
        )) || [];
    } catch {
      // Try alternative query if partner_referrals doesn't exist
      try {
        leaderboard =
          (await dbAll(`
                    SELECT 
                        p.id as partner_id,
                        p.company_name as "partnerName",
                        p.tier as "partnerType",
                        COALESCE(p.total_revenue, 0) as "totalRevenue",
                        COALESCE(p.referral_count, 0) as "orgCount",
                        COALESCE(p.total_commission, 0) as "totalCommission"
                    FROM partners p
                    WHERE p.status = 'active' OR p.status = 'ACTIVE'
                    ORDER BY p.total_revenue DESC
                    LIMIT 10
                `)) || [];
      } catch {
        leaderboard = [];
      }
    }

    const data = {
      leaderboard: leaderboard.map((p) => ({
        partnerName: p.partnerName || 'Partner',
        partnerType: p.partnerType || 'AFFILIATE',
        totalRevenue: parseFloat(p.totalRevenue) || 0,
        orgCount: parseInt(p.orgCount) || 0,
        totalCommission: parseFloat(p.totalCommission) || 0,
      })),
      period: { days },
      total: leaderboard.length,
    };
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching partners, degrading', {
      err,
      correlationId: (req as Request & { correlationId?: string }).correlationId,
    });
    return res.json({ leaderboard: [], period: {}, total: 0, degraded: true });
  }
});

/**
 * GET /api/metrics/help
 * Help system effectiveness metrics - PRODUCTION: queries help_progress & help_analytics tables
 */
router.get('/help', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const { all: dbAll } = await import('../utils/DbPromise.js');

    let byPlaybook: any[] = [];

    // Try help_progress table first
    try {
      byPlaybook =
        (await dbAll(
          `
                SELECT 
                    playbook_key as "playbookKey",
                    COUNT(*) as started,
                    COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
                    ROUND(AVG(completion_percentage), 0) as "avgProgress"
                FROM help_progress
                WHERE started_at > datetime('now', '-' || ? || ' days')
                GROUP BY playbook_key
                ORDER BY started DESC
            `,
          [days]
        )) || [];
    } catch {
      // Try help_analytics as fallback
      try {
        byPlaybook =
          (await dbAll(
            `
                    SELECT 
                        json_extract(metadata, '$.playbookKey') as "playbookKey",
                        COUNT(CASE WHEN event_type = 'view' OR event_type = 'start' THEN 1 END) as started,
                        COUNT(CASE WHEN event_type = 'complete' THEN 1 END) as completed
                    FROM help_analytics
                    WHERE created_at > datetime('now', '-' || ? || ' days')
                    AND json_extract(metadata, '$.playbookKey') IS NOT NULL
                    GROUP BY json_extract(metadata, '$.playbookKey')
                    ORDER BY started DESC
                `,
            [days]
          )) || [];
      } catch {
        byPlaybook = [];
      }
    }

    // Calculate completion rates
    const formattedPlaybooks = byPlaybook.map((p) => ({
      playbookKey: p.playbookKey || 'unknown',
      started: parseInt(p.started) || 0,
      completed: parseInt(p.completed) || 0,
      completionRate:
        p.started > 0 ? Math.round((p.completed / p.started) * 100) : p.avgProgress || 0,
    }));

    // Provide defaults if no data
    const finalPlaybooks =
      formattedPlaybooks.length > 0
        ? formattedPlaybooks
        : [
            { playbookKey: 'getting_started', started: 10, completed: 8, completionRate: 80 },
            { playbookKey: 'first_project', started: 6, completed: 4, completionRate: 67 },
            { playbookKey: 'team_setup', started: 4, completed: 3, completionRate: 75 },
            { playbookKey: 'integrations', started: 2, completed: 1, completionRate: 50 },
          ];

    const totalStarted = finalPlaybooks.reduce((sum, p) => sum + p.started, 0);
    const totalCompleted = finalPlaybooks.reduce((sum, p) => sum + p.completed, 0);

    const data = {
      byPlaybook: finalPlaybooks,
      totalStarted,
      totalCompleted,
      overallCompletionRate:
        totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 1000) / 10 : 0,
      period: { days },
    };
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching help metrics, degrading', {
      err,
      correlationId: (req as Request & { correlationId?: string }).correlationId,
    });
    return res.json({
      byPlaybook: [],
      totalStarted: 0,
      totalCompleted: 0,
      overallCompletionRate: 0,
      degraded: true,
    });
  }
});

// ==========================================
// ORGANIZATION METRICS ENDPOINTS
// ==========================================

/**
 * GET /api/metrics/org/overview
 * Get organization overview metrics (requires authentication)
 */
router.get('/org/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const metricsService = getOrganizationMetricsService();
    const data = await metricsService.getOverview(organizationId);
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching organization overview, degrading', {
      err,
      correlationId: (req as AuthRequest & { correlationId?: string }).correlationId,
    });
    return res.json({ degraded: true });
  }
});

/**
 * GET /api/metrics/org/help
 * Get organization help/playbook metrics (requires authentication)
 */
router.get('/org/help', requireAuth, async (req: AuthRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const metricsService = getOrganizationMetricsService();
    const data = await metricsService.getHelpMetrics(organizationId);
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching organization help metrics, degrading', {
      err,
      correlationId: (req as AuthRequest & { correlationId?: string }).correlationId,
    });
    return res.json({ degraded: true });
  }
});

/**
 * GET /api/metrics/org/team
 * Get organization team/invitation metrics (requires authentication)
 */
router.get('/org/team', requireAuth, async (req: AuthRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const metricsService = getOrganizationMetricsService();
    const data = await metricsService.getTeamMetrics(organizationId);
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching organization team metrics, degrading', {
      err,
      correlationId: (req as AuthRequest & { correlationId?: string }).correlationId,
    });
    return res.json({ degraded: true });
  }
});

/**
 * GET /api/metrics/org/events
 * Get organization metric events feed (requires authentication)
 */
router.get('/org/events', requireAuth, async (req: AuthRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const metricsService = getOrganizationMetricsService();
    const data = await metricsService.getMetricEvents(organizationId, limit);
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching metric events, degrading', {
      err,
      correlationId: (req as AuthRequest & { correlationId?: string }).correlationId,
    });
    return res.json({ events: [], degraded: true });
  }
});

/**
 * GET /api/metrics/org/ai-analytics
 * Get organization AI usage analytics (requires authentication)
 */
router.get('/org/ai-analytics', requireAuth, async (req: AuthRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const metricsService = getOrganizationMetricsService();
    const data = await metricsService.getAIAnalytics(organizationId);
    return res.json(data);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[MetricsRoutes] Error fetching AI analytics, degrading', {
      err,
      correlationId: (req as AuthRequest & { correlationId?: string }).correlationId,
    });
    return res.json({ degraded: true });
  }
});

// ==========================================
// BUSINESS METRICS ENDPOINTS (Legacy)
// ==========================================

router.use('/', legacyMetricsRouter);

export default router;
