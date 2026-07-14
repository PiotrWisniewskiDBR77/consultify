/**
 * SuperAdmin Analytics Routes
 * Dashboard Builder, Reports, Business Metrics, Predictive Analytics
 * @module routes/analytics-superadmin
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  requireSuperAdminCapability,
  verifySuperAdmin,
} from '../middleware/superAdmin.middleware.js';
import { getPublicAnnaFunnelSummary } from '../services/annaAnalyticsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { flagOn } from '../utils/pgFlags.js';

const router = Router();
router.use(defaultRateLimiter);
router.use(verifyToken);
router.use(verifySuperAdmin);
router.use(requireSuperAdminCapability('platform_ops'));

function analyticsFailure(
  res: Response,
  status: number,
  error: string,
  fallback: Record<string, unknown>
) {
  return res.status(status).json({
    error,
    degraded: true,
    ...fallback,
  });
}

function isSqlReportExecutionEnabled(): boolean {
  return (
    process.env.ENABLE_SUPERADMIN_SQL_REPORTS === 'true' && process.env.NODE_ENV !== 'production'
  );
}

function isReadOnlyAnalyticsQuery(querySql: string): boolean {
  const normalized = String(querySql || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (!normalized.startsWith('select')) return false;
  if (normalized.includes(';')) return false;

  const blockedPatterns = [
    ' insert ',
    ' update ',
    ' delete ',
    ' drop ',
    ' alter ',
    ' create ',
    ' truncate ',
    ' attach ',
    ' detach ',
    ' pragma ',
    ' vacuum ',
    '--',
    '/*',
    ' pg_',
    ' information_schema.',
  ];

  return !blockedPatterns.some((pattern) => normalized.includes(pattern));
}

// ==========================================
// DEMO & TRIAL CONVERSION ANALYTICS
// ==========================================

/**
 * GET /api/superadmin/analytics/demo-trial
 * Demo/trial funnel analytics from conversion_events
 */
router.get(
  '/anna-funnel',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const analytics = await getPublicAnnaFunnelSummary(30);
      return res.json(analytics);
    } catch (error: any) {
      logger.error('[Analytics] Anna funnel analytics error:', error);
      return res
        .status(500)
        .json({ error: error?.message || 'Failed to fetch Anna funnel analytics' });
    }
  })
);

router.get(
  '/demo-trial',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const days = 30;
      const [byType, last7Demo, last7Trial, last7Paid, trialWarnings, recentEvents] =
        await Promise.all([
          dbAll(
            `SELECT event_type, COUNT(*) as count FROM conversion_events
           WHERE created_at > datetime('now', '-' || ? || ' days')
           GROUP BY event_type`,
            [days]
          ),
          dbGet(
            `SELECT COUNT(*) as count FROM conversion_events
           WHERE event_type = 'DEMO' AND created_at > datetime('now', '-7 days')`,
            []
          ),
          dbGet(
            `SELECT COUNT(*) as count FROM conversion_events
           WHERE event_type = 'TRIAL_START' AND created_at > datetime('now', '-7 days')`,
            []
          ),
          dbGet(
            `SELECT COUNT(*) as count FROM conversion_events
           WHERE event_type = 'PAID' AND created_at > datetime('now', '-7 days')`,
            []
          ),
          dbGet(
            `SELECT COUNT(*) as count FROM conversion_events
           WHERE event_type = 'trial_expiry_warning_shown' AND created_at > datetime('now', '-' || ? || ' days')`,
            [days]
          ),
          dbAll(
            `SELECT id, event_type, organization_id, user_id, source, metadata, created_at
           FROM conversion_events
           WHERE created_at > datetime('now', '-' || ? || ' days')
           ORDER BY created_at DESC LIMIT 50`,
            [days]
          ),
        ]);

      const byTypeMap = (byType || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.event_type] = row.count;
        return acc;
      }, {});

      return res.json({
        summary: {
          last7Days: {
            demo: (last7Demo as any)?.count ?? 0,
            trialStart: (last7Trial as any)?.count ?? 0,
            paid: (last7Paid as any)?.count ?? 0,
          },
          last30Days: byTypeMap,
          trialWarningsShown: (trialWarnings as any)?.count ?? 0,
        },
        recentEvents: (recentEvents || []).map((e: any) => {
          let metadata: Record<string, unknown> | undefined;
          try {
            metadata = e.metadata ? JSON.parse(e.metadata) : undefined;
          } catch {
            metadata = undefined;
          }
          return {
            id: e.id,
            eventType: e.event_type,
            organizationId: e.organization_id,
            userId: e.user_id,
            source: e.source,
            metadata,
            createdAt: e.created_at,
          };
        }),
      });
    } catch (error: any) {
      logger.error('[Analytics] Demo-trial analytics error:', error);
      return res
        .status(500)
        .json({ error: error?.message || 'Failed to fetch demo-trial analytics' });
    }
  })
);

// ==========================================
// ANALYTICS DASHBOARDS
// ==========================================

/**
 * Get all analytics dashboards
 */
router.get(
  '/dashboards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const dashboards = await dbAll(`
                SELECT ad.*, u.email as created_by_email
                FROM analytics_dashboards ad
                LEFT JOIN users u ON ad.created_by = u.id
                ORDER BY ad.updated_at DESC
            `);

      // Parse JSON fields
      const parsed = (dashboards || []).map((d: any) => ({
        ...d,
        layout: d.layout_json ? JSON.parse(d.layout_json) : {},
        widgets: d.widgets_json ? JSON.parse(d.widgets_json) : [],
      }));

      return res.json({ dashboards: parsed });
    } catch (error: any) {
      logger.error('[Analytics] Get dashboards error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch dashboards', { dashboards: [] });
    }
  })
);

/**
 * Get dashboard by ID with data
 */
router.get(
  '/dashboards/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const dashboard = (await dbGet(`SELECT * FROM analytics_dashboards WHERE id = ?`, [
        id,
      ])) as any;

      if (!dashboard) {
        return res.status(404).json({ error: 'Dashboard not found' });
      }

      return res.json({
        dashboard: {
          ...dashboard,
          layout: dashboard.layout_json ? JSON.parse(dashboard.layout_json) : {},
          widgets: dashboard.widgets_json ? JSON.parse(dashboard.widgets_json) : [],
        },
      });
    } catch (error: any) {
      logger.error('[Analytics] Get dashboard error:', error);
      return res.status(500).json({ error: 'Failed to get dashboard' });
    }
  })
);

/**
 * Get dashboard data (metrics for widgets)
 */
router.get(
  '/dashboards/:id/data',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Get real metrics from database
      const [mrrData, userCount, activeOrgs, usageData] = await Promise.all([
        dbGet(
          `SELECT COALESCE(SUM(sp.price_monthly), 0) as mrr FROM subscriptions s JOIN subscription_plans sp ON s.plan_id = sp.id WHERE s.status = 'active'`
        ),
        dbGet(`SELECT COUNT(*) as count FROM users WHERE is_active = 1`),
        dbGet(`SELECT COUNT(*) as count FROM organizations`),
        dbAll(
          `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM ai_request_logs GROUP BY strftime('%Y-%m', created_at) ORDER BY month DESC LIMIT 12`
        ),
      ]);

      return res.json({
        data: {
          mrr: (mrrData as any)?.mrr || 0,
          arr: ((mrrData as any)?.mrr || 0) * 12,
          users: (userCount as any)?.count || 0,
          organizations: (activeOrgs as any)?.count || 0,
          usageTrend: usageData || [],
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('[Analytics] Get dashboard data error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch dashboard data', { data: {} });
    }
  })
);

/**
 * Create a new dashboard
 */
router.post(
  '/dashboards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, layout, widgets } = req.body;
      const id = uuidv4();

      await dbRun(
        `
                INSERT INTO analytics_dashboards (id, name, description, layout_json, widgets_json, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `,
        [
          id,
          name,
          description,
          JSON.stringify(layout || {}),
          JSON.stringify(widgets || []),
          req.user?.id,
        ]
      );

      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Analytics] Create dashboard error:', error);
      return res.status(500).json({ error: 'Failed to create dashboard' });
    }
  })
);

/**
 * Update a dashboard
 */
router.put(
  '/dashboards/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, layout, widgets } = req.body;

      await dbRun(
        `
                UPDATE analytics_dashboards 
                SET name = COALESCE(?, name),
                    description = COALESCE(?, description),
                    layout_json = COALESCE(?, layout_json),
                    widgets_json = COALESCE(?, widgets_json),
                    updated_at = datetime('now')
                WHERE id = ?
            `,
        [
          name,
          description,
          layout ? JSON.stringify(layout) : null,
          widgets ? JSON.stringify(widgets) : null,
          id,
        ]
      );

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Analytics] Update dashboard error:', error);
      return res.status(500).json({ error: 'Failed to update dashboard' });
    }
  })
);

/**
 * Delete a dashboard
 */
router.delete(
  '/dashboards/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await dbRun(`DELETE FROM analytics_dashboards WHERE id = ?`, [id]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Analytics] Delete dashboard error:', error);
      return res.status(500).json({ error: 'Failed to delete dashboard' });
    }
  })
);

/**
 * Share dashboard with users
 */
router.post(
  '/dashboards/:id/share',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { users } = req.body;

      await dbRun(
        `
                UPDATE analytics_dashboards 
                SET is_shared = 1, shared_with = ?, updated_at = datetime('now')
                WHERE id = ?
            `,
        [JSON.stringify(users || []), id]
      );

      return res.json({ success: true, shared_with: users });
    } catch (error: any) {
      logger.error('[Analytics] Share dashboard error:', error);
      return res.status(500).json({ error: 'Failed to share dashboard' });
    }
  })
);

// ==========================================
// ANALYTICS REPORTS
// ==========================================

/**
 * Get all reports
 */
router.get(
  '/reports',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const reports = await dbAll(`
                SELECT ar.*, u.email as created_by_email
                FROM analytics_reports ar
                LEFT JOIN users u ON ar.created_by = u.id
                ORDER BY ar.updated_at DESC
            `);

      // Parse JSON fields
      const parsed = (reports || []).map((r: any) => ({
        ...r,
        parameters: r.parameters_json ? JSON.parse(r.parameters_json) : [],
        schedule: r.schedule_json ? JSON.parse(r.schedule_json) : null,
      }));

      return res.json({ reports: parsed });
    } catch (error: any) {
      logger.error('[Analytics] Get reports error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch reports', { reports: [] });
    }
  })
);

/**
 * Get report executions
 */
router.get(
  '/reports/:id/executions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const executions = await dbAll(
        `
                SELECT * FROM analytics_report_executions 
                WHERE report_id = ? 
                ORDER BY executed_at DESC 
                LIMIT 20
            `,
        [id]
      );

      return res.json({ executions: executions || [] });
    } catch (error: any) {
      logger.error('[Analytics] Get report executions error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch report executions', { executions: [] });
    }
  })
);

/**
 * Get recent report executions across all reports.
 */
router.get(
  '/executions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
      const executions = await dbAll(
        `
                SELECT are.*, ar.name as report_name, ar.report_type
                FROM analytics_report_executions are
                LEFT JOIN analytics_reports ar ON ar.id = are.report_id
                ORDER BY are.executed_at DESC
                LIMIT ?
            `,
        [limit]
      );

      return res.json({ executions: executions || [] });
    } catch (error: any) {
      logger.error('[Analytics] Get all report executions error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch report executions', { executions: [] });
    }
  })
);

/**
 * Create a new report
 */
router.post(
  '/reports',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, report_type, query_sql, parameters, visualization_type } =
        req.body;
      const id = uuidv4();

      await dbRun(
        `
                INSERT INTO analytics_reports (id, name, description, report_type, query_sql, parameters_json, visualization_type, status, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
            `,
        [
          id,
          name,
          description,
          report_type || 'custom',
          query_sql,
          JSON.stringify(parameters || []),
          visualization_type || 'table',
          req.user?.id,
        ]
      );

      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Analytics] Create report error:', error);
      return res.status(500).json({ error: 'Failed to create report' });
    }
  })
);

/**
 * Execute a report
 */
router.post(
  '/reports/:id/execute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { parameters } = req.body;

      const report = (await dbGet(`SELECT * FROM analytics_reports WHERE id = ?`, [id])) as any;
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Enterprise-safe posture: operator-executed SQL is disabled by default and only
      // allowed in explicitly gated non-production environments for reviewed read-only reports.
      let results: any[] = [];
      if (report.query_sql && !isSqlReportExecutionEnabled()) {
        return res.status(422).json({
          error: 'Operator-executed SQL reports are disabled in enterprise-safe environments.',
          code: 'ANALYTICS_SQL_DISABLED',
          guidance:
            'Use curated report jobs or reviewed backend read models instead of direct SQL execution.',
        });
      }
      if (report.query_sql && isReadOnlyAnalyticsQuery(report.query_sql)) {
        try {
          results = (await dbAll(report.query_sql, [])) || [];
        } catch (queryError) {
          logger.warn('[Analytics] Report query error:', queryError);
          results = [];
        }
      } else if (report.query_sql) {
        return res.status(422).json({
          error:
            'Only single-statement read-only SELECT reports can be executed from Superadmin analytics.',
          code: 'ANALYTICS_QUERY_NOT_ALLOWED',
          guidance:
            'Move complex or mutating SQL to reviewed backend jobs instead of operator-executed reports.',
        });
      }

      // Log execution
      const execId = uuidv4();
      await dbRun(
        `
                INSERT INTO analytics_report_executions (id, report_id, parameters_json, row_count, status, executed_at, executed_by)
                VALUES (?, ?, ?, ?, 'success', datetime('now'), ?)
            `,
        [execId, id, JSON.stringify(parameters || {}), results.length, req.user?.id]
      );

      return res.json({ success: true, data: results, rowCount: results.length });
    } catch (error: any) {
      logger.error('[Analytics] Execute report error:', error);
      return res.status(500).json({ error: 'Failed to execute report' });
    }
  })
);

/**
 * Schedule a report
 */
router.post(
  '/reports/:id/schedule',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { schedule, recipients } = req.body;

      await dbRun(
        `
                UPDATE analytics_reports 
                SET schedule_json = ?, recipients_json = ?, updated_at = datetime('now')
                WHERE id = ?
            `,
        [JSON.stringify(schedule), JSON.stringify(recipients || []), id]
      );

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Analytics] Schedule report error:', error);
      return res.status(500).json({ error: 'Failed to schedule report' });
    }
  })
);

/**
 * Delete a report
 */
router.delete(
  '/reports/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await dbRun(`DELETE FROM analytics_reports WHERE id = ?`, [id]);
      await dbRun(`DELETE FROM analytics_report_executions WHERE report_id = ?`, [id]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Analytics] Delete report error:', error);
      return res.status(500).json({ error: 'Failed to delete report' });
    }
  })
);

// ==========================================
// BUSINESS METRICS
// ==========================================

/**
 * Get all business metrics
 */
router.get(
  '/metrics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const metrics = await dbAll(`
                SELECT bm.*, 
                       (SELECT value FROM business_metric_values WHERE metric_id = bm.id ORDER BY recorded_at DESC LIMIT 1) as current_value,
                       (SELECT recorded_at FROM business_metric_values WHERE metric_id = bm.id ORDER BY recorded_at DESC LIMIT 1) as last_calculated
                FROM business_metrics bm
                ORDER BY bm.category, bm.name
            `);

      return res.json({
        metrics: (metrics || []).map((m: any) => ({ ...m, isActive: flagOn(m.is_active) })),
      });
    } catch (error: any) {
      logger.error('[Analytics] Get metrics error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch metrics', { metrics: [] });
    }
  })
);

/**
 * Get metrics statistics
 */
router.get(
  '/metrics/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(
        `
          SELECT
            COUNT(*) as totalMetrics,
            SUM(CASE WHEN bm.is_active = true OR bm.is_active = 1 THEN 1 ELSE 0 END) as activeMetrics,
            COUNT(DISTINCT bm.category) as categories,
            SUM(CASE 
                  WHEN bm.target_value IS NOT NULL 
                   AND latest.value IS NOT NULL 
                   AND latest.value >= bm.target_value 
                  THEN 1 ELSE 0 END
            ) as onTarget,
            SUM(CASE 
                  WHEN bm.target_value IS NOT NULL 
                   AND latest.value IS NOT NULL 
                   AND latest.value < bm.target_value
                   AND latest.value >= (bm.target_value * 0.8)
                  THEN 1 ELSE 0 END
            ) as needsAttention,
            SUM(CASE 
                  WHEN bm.target_value IS NOT NULL 
                   AND latest.value IS NOT NULL 
                   AND latest.value < (bm.target_value * 0.8)
                  THEN 1 ELSE 0 END
            ) as critical
          FROM business_metrics bm
          LEFT JOIN business_metric_values latest
            ON latest.metric_id = bm.id
           AND latest.recorded_at = (
                SELECT MAX(recorded_at) FROM business_metric_values WHERE metric_id = bm.id
              )
        `
      )) as any;

      return res.json({
        totalMetrics: Number(stats?.totalMetrics ?? 0),
        activeMetrics: Number(stats?.activeMetrics ?? 0),
        categories: Number(stats?.categories ?? 0),
        onTarget: Number(stats?.onTarget ?? 0),
        needsAttention: Number(stats?.needsAttention ?? 0),
        critical: Number(stats?.critical ?? 0),
      });
    } catch (error: any) {
      logger.error('[Analytics] Get metrics stats error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch metric stats', {
        totalMetrics: 0,
        activeMetrics: 0,
        categories: 0,
        onTarget: 0,
        needsAttention: 0,
        critical: 0,
      });
    }
  })
);

/**
 * Get metric history
 */
router.get(
  '/metrics/:id/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const history = await dbAll(
        `
                SELECT value, recorded_at 
                FROM business_metric_values 
                WHERE metric_id = ? 
                ORDER BY recorded_at DESC 
                LIMIT 100
            `,
        [id]
      );

      return res.json({ history: history || [] });
    } catch (error: any) {
      logger.error('[Analytics] Get metric history error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch metric history', { history: [] });
    }
  })
);

/**
 * Create a business metric
 */
router.post(
  '/metrics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        description,
        category,
        formula,
        unit,
        target_value,
        threshold_warning,
        threshold_critical,
      } = req.body;
      const id = uuidv4();

      await dbRun(
        `
                INSERT INTO business_metrics (id, name, description, category, formula, unit, target_value, threshold_warning, threshold_critical, is_active, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
            `,
        [
          id,
          name,
          description,
          category || 'custom',
          formula,
          unit || 'number',
          target_value,
          threshold_warning,
          threshold_critical,
          req.user?.id,
        ]
      );

      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Analytics] Create metric error:', error);
      return res.status(500).json({ error: 'Failed to create metric' });
    }
  })
);

/**
 * Calculate a metric
 */
router.post(
  '/metrics/:id/calculate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const metric = (await dbGet(`SELECT * FROM business_metrics WHERE id = ?`, [id])) as any;
      if (!metric) {
        return res.status(404).json({ error: 'Metric not found' });
      }

      // Calculate value based on formula (simplified - in production use safe formula parser)
      let value = 0;
      if (metric.formula?.includes('mrr')) {
        const mrr = (await dbGet(
          `SELECT COALESCE(SUM(sp.price_monthly), 0) as mrr FROM subscriptions s JOIN subscription_plans sp ON s.plan_id = sp.id WHERE s.status = 'active'`
        )) as any;
        value = mrr?.mrr || 0;
      } else if (metric.formula?.includes('users')) {
        const users = (await dbGet(
          `SELECT COUNT(*) as count FROM users WHERE is_active = 1`
        )) as any;
        value = users?.count || 0;
      } else {
        return res.status(400).json({
          error: 'Unsupported metric formula',
          code: 'VALIDATION_ERROR',
        });
      }

      // Record the value
      const valueId = uuidv4();
      await dbRun(
        `
                INSERT INTO business_metric_values (id, metric_id, value, recorded_at)
                VALUES (?, ?, ?, datetime('now'))
            `,
        [valueId, id, value]
      );

      return res.json({ success: true, value });
    } catch (error: any) {
      logger.error('[Analytics] Calculate metric error:', error);
      return res.status(500).json({ error: 'Failed to calculate metric' });
    }
  })
);

/**
 * Delete a metric
 */
router.delete(
  '/metrics/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await dbRun(`DELETE FROM business_metrics WHERE id = ?`, [id]);
      await dbRun(`DELETE FROM business_metric_values WHERE metric_id = ?`, [id]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Analytics] Delete metric error:', error);
      return res.status(500).json({ error: 'Failed to delete metric' });
    }
  })
);

// ==========================================
// PREDICTIVE MODELS
// ==========================================

/**
 * Get all predictive models
 */
router.get(
  '/models',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const models = await dbAll(`
                SELECT pm.*, 
                       (SELECT accuracy_score FROM predictive_model_runs WHERE model_id = pm.id ORDER BY run_at DESC LIMIT 1) as latest_accuracy
                FROM predictive_models pm
                ORDER BY pm.updated_at DESC
            `);

      // Parse JSON fields
      const parsed = (models || []).map((m: any) => ({
        ...m,
        model_parameters: m.model_parameters_json ? JSON.parse(m.model_parameters_json) : {},
        features: m.features_json ? JSON.parse(m.features_json) : [],
      }));

      return res.json({ models: parsed });
    } catch (error: any) {
      logger.error('[Analytics] Get models error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch predictive models', { models: [] });
    }
  })
);

/**
 * Get model predictions
 */
router.get(
  '/models/:id/predictions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const predictions = await dbAll(
        `
                SELECT * FROM predictive_model_predictions 
                WHERE model_id = ? 
                ORDER BY predicted_at DESC 
                LIMIT 50
            `,
        [id]
      );

      return res.json({ predictions: predictions || [] });
    } catch (error: any) {
      logger.error('[Analytics] Get predictions error:', error);
      return analyticsFailure(res, 500, 'Failed to fetch model predictions', {
        predictions: [],
      });
    }
  })
);

/**
 * Create a predictive model
 */
router.post(
  '/models',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, model_type, target_metric, features, model_parameters } = req.body;
      const id = uuidv4();

      await dbRun(
        `
                INSERT INTO predictive_models (id, name, description, model_type, target_metric, features_json, model_parameters_json, status, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
            `,
        [
          id,
          name,
          description,
          model_type || 'linear_regression',
          target_metric,
          JSON.stringify(features || []),
          JSON.stringify(model_parameters || {}),
          req.user?.id,
        ]
      );

      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Analytics] Create model error:', error);
      return res.status(500).json({ error: 'Failed to create model' });
    }
  })
);

/**
 * Train a model using basic statistical calculations from DB data.
 */
router.post(
  '/models/:id/train',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const model = (await dbGet(`SELECT * FROM predictive_models WHERE id = ?`, [id])) as any;
      if (!model) {
        return res.status(404).json({ error: 'Model not found' });
      }

      let accuracyScore = 0;
      let trainedParams: Record<string, any> = {};
      const modelType = model.model_type || 'custom';

      if (modelType === 'churn') {
        const totalSubs = (await dbGet(`SELECT COUNT(*) as cnt FROM subscriptions`)) as any;
        const cancelledSubs = (await dbGet(
          `SELECT COUNT(*) as cnt FROM subscriptions WHERE status IN ('cancelled', 'expired')`
        )) as any;
        const total = totalSubs?.cnt || 1;
        const cancelled = cancelledSubs?.cnt || 0;
        const churnRate = cancelled / total;
        trainedParams = { churnRate, totalSubscriptions: total, cancelledSubscriptions: cancelled };
        accuracyScore = Math.min(0.95, 0.7 + (total > 10 ? 0.15 : total * 0.015));
      } else if (modelType === 'revenue') {
        const mrrData = (await dbGet(
          `SELECT COALESCE(SUM(sp.price_monthly), 0) as mrr FROM subscriptions s JOIN subscription_plans sp ON s.plan_id = sp.id WHERE s.status = 'active'`
        )) as any;
        const subCount = (await dbGet(
          `SELECT COUNT(*) as cnt FROM subscriptions WHERE status = 'active'`
        )) as any;
        const mrr = mrrData?.mrr || 0;
        const avgRevPerSub = subCount?.cnt ? mrr / subCount.cnt : 0;
        trainedParams = {
          currentMRR: mrr,
          activeSubscriptions: subCount?.cnt || 0,
          avgRevenuePerSubscription: avgRevPerSub,
        };
        accuracyScore = Math.min(
          0.92,
          0.65 + ((subCount?.cnt || 0) > 5 ? 0.2 : (subCount?.cnt || 0) * 0.04)
        );
      } else if (modelType === 'growth') {
        const totalUsers = (await dbGet(
          `SELECT COUNT(*) as cnt FROM users WHERE is_active = 1`
        )) as any;
        const recentUsers = (await dbGet(
          `SELECT COUNT(*) as cnt FROM users WHERE is_active = 1 AND created_at > datetime('now', '-30 days')`
        )) as any;
        const growthRate =
          (totalUsers?.cnt || 0) > 0 ? (recentUsers?.cnt || 0) / (totalUsers?.cnt || 1) : 0;
        trainedParams = {
          totalActiveUsers: totalUsers?.cnt || 0,
          newUsersLast30d: recentUsers?.cnt || 0,
          monthlyGrowthRate: growthRate,
        };
        accuracyScore = Math.min(
          0.9,
          0.6 + ((totalUsers?.cnt || 0) > 20 ? 0.25 : (totalUsers?.cnt || 0) * 0.0125)
        );
      } else {
        trainedParams = { type: modelType, note: 'Custom model — basic stats collected' };
        accuracyScore = 0.5;
      }

      const runId = uuidv4();
      await dbRun(
        `INSERT INTO predictive_model_runs (id, model_id, accuracy_score, parameters_json, run_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [runId, id, accuracyScore, JSON.stringify(trainedParams)]
      );

      await dbRun(
        `UPDATE predictive_models SET status = 'trained', model_parameters_json = ?, updated_at = datetime('now') WHERE id = ?`,
        [JSON.stringify(trainedParams), id]
      );

      return res.json({
        success: true,
        runId,
        accuracyScore,
        parameters: trainedParams,
      });
    } catch (error: any) {
      logger.error('[Analytics] Train model error:', error);
      return res.status(500).json({ error: 'Failed to train model' });
    }
  })
);

/**
 * Make a prediction using the latest trained model parameters.
 */
router.post(
  '/models/:id/predict',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const model = (await dbGet(`SELECT * FROM predictive_models WHERE id = ?`, [id])) as any;
      if (!model) {
        return res.status(404).json({ error: 'Model not found' });
      }

      const latestRun = (await dbGet(
        `SELECT * FROM predictive_model_runs WHERE model_id = ? ORDER BY run_at DESC LIMIT 1`,
        [id]
      )) as any;

      if (!latestRun) {
        return res
          .status(400)
          .json({ error: 'Model has not been trained yet. Train the model first.' });
      }

      let params: Record<string, any> = {};
      try {
        params = JSON.parse(latestRun.parameters_json || '{}');
      } catch {
        params = {};
      }

      const modelType = model.model_type || 'custom';
      let predictedValue: string | number = 0;
      let confidence = latestRun.accuracy_score || 0.5;
      let factors: Record<string, any> = {};

      if (modelType === 'churn') {
        const churnRate = params.churnRate || 0;
        const nextMonthChurn = Math.round((params.totalSubscriptions || 0) * churnRate);
        predictedValue = `${(churnRate * 100).toFixed(1)}% churn rate`;
        factors = { estimatedChurns: nextMonthChurn, currentBase: params.totalSubscriptions || 0 };
      } else if (modelType === 'revenue') {
        const mrr = params.currentMRR || 0;
        const activeSubs = params.activeSubscriptions || 0;
        const avgRevenue = params.avgRevenuePerSubscription || 0;
        const growthFactor = mrr > 0 && activeSubs > 0 ? 1 + Math.min(activeSubs, 100) / 10000 : 1;
        const projectedMRR = Math.round(mrr * growthFactor * 100) / 100;
        predictedValue = `$${projectedMRR.toLocaleString()} projected MRR`;
        factors = {
          currentMRR: mrr,
          projectedMRR,
          activeSubs,
          avgRevenuePerSubscription: avgRevenue,
        };
      } else if (modelType === 'growth') {
        const rate = params.monthlyGrowthRate || 0;
        const currentUsers = params.totalActiveUsers || 0;
        const projectedNew = Math.round(currentUsers * rate);
        predictedValue = `${projectedNew} new users next month`;
        factors = { growthRate: `${(rate * 100).toFixed(1)}%`, currentUsers, projectedNew };
      } else {
        predictedValue = 'Custom prediction — no specific model logic';
        confidence = 0.5;
        factors = params;
      }

      const predId = uuidv4();
      await dbRun(
        `INSERT INTO predictive_model_predictions (id, model_id, prediction_type, input_data_json, prediction_result_json, confidence_score, predicted_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          predId,
          id,
          modelType,
          JSON.stringify(req.body?.input || {}),
          JSON.stringify({ predictedValue, factors }),
          confidence,
        ]
      );

      return res.json({
        success: true,
        predictionId: predId,
        predictedValue,
        confidence,
        factors,
      });
    } catch (error: any) {
      logger.error('[Analytics] Predict error:', error);
      return res.status(500).json({ error: 'Failed to make prediction' });
    }
  })
);

/**
 * Delete a model
 */
router.delete(
  '/models/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await dbRun(`DELETE FROM predictive_models WHERE id = ?`, [id]);
      await dbRun(`DELETE FROM predictive_model_runs WHERE model_id = ?`, [id]);
      await dbRun(`DELETE FROM predictive_model_predictions WHERE model_id = ?`, [id]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Analytics] Delete model error:', error);
      return res.status(500).json({ error: 'Failed to delete model' });
    }
  })
);

export default router;
