/**
 * SuperAdmin Analytics Routes
 * Dashboard Builder, Reports, Business Metrics, Predictive Analytics
 * @module routes/analytics-superadmin
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, requireSuperAdmin, verifyToken } from '../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(defaultRateLimiter);

// ==========================================
// ANALYTICS DASHBOARDS
// ==========================================

/**
 * Get all analytics dashboards
 */
router.get(
  '/dashboards',
  verifyToken,
  requireSuperAdmin,
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
      return res.json({ dashboards: [] });
    }
  })
);

/**
 * Get dashboard by ID with data
 */
router.get(
  '/dashboards/:id',
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
      return res.json({ data: {} });
    }
  })
);

/**
 * Create a new dashboard
 */
router.post(
  '/dashboards',
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
      return res.json({ reports: [] });
    }
  })
);

/**
 * Get report executions
 */
router.get(
  '/reports/:id/executions',
  verifyToken,
  requireSuperAdmin,
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
      return res.json({ executions: [] });
    }
  })
);

/**
 * Create a new report
 */
router.post(
  '/reports',
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { parameters } = req.body;

      const report = (await dbGet(`SELECT * FROM analytics_reports WHERE id = ?`, [id])) as any;
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Execute the report query (with proper sanitization in production)
      let results: any[] = [];
      if (
        report.query_sql &&
        !report.query_sql.toLowerCase().includes('drop') &&
        !report.query_sql.toLowerCase().includes('delete')
      ) {
        try {
          results = (await dbAll(report.query_sql, [])) || [];
        } catch (queryError) {
          logger.warn('[Analytics] Report query error:', queryError);
          results = [];
        }
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
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const metrics = await dbAll(`
                SELECT bm.*, 
                       (SELECT value FROM business_metric_values WHERE metric_id = bm.id ORDER BY recorded_at DESC LIMIT 1) as current_value,
                       (SELECT recorded_at FROM business_metric_values WHERE metric_id = bm.id ORDER BY recorded_at DESC LIMIT 1) as last_calculated
                FROM business_metrics bm
                ORDER BY bm.category, bm.name
            `);

      return res.json({ metrics: metrics || [] });
    } catch (error: any) {
      logger.error('[Analytics] Get metrics error:', error);
      return res.json({ metrics: [] });
    }
  })
);

/**
 * Get metrics statistics
 */
router.get(
  '/metrics/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    COUNT(DISTINCT category) as categories
                FROM business_metrics
            `)) as any;

      return res.json({
        total: stats?.total || 0,
        active: stats?.active || 0,
        categories: stats?.categories || 0,
      });
    } catch (error: any) {
      logger.error('[Analytics] Get metrics stats error:', error);
      return res.json({ total: 0, active: 0 });
    }
  })
);

/**
 * Get metric history
 */
router.get(
  '/metrics/:id/history',
  verifyToken,
  requireSuperAdmin,
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
      return res.json({ history: [] });
    }
  })
);

/**
 * Create a business metric
 */
router.post(
  '/metrics',
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
  verifyToken,
  requireSuperAdmin,
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
      return res.json({ models: [] });
    }
  })
);

/**
 * Get model predictions
 */
router.get(
  '/models/:id/predictions',
  verifyToken,
  requireSuperAdmin,
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
      return res.json({ predictions: [] });
    }
  })
);

/**
 * Create a predictive model
 */
router.post(
  '/models',
  verifyToken,
  requireSuperAdmin,
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
 * Train a model
 */
router.post(
  '/models/:id/train',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    } catch (error: any) {
      logger.error('[Analytics] Train model error:', error);
      return res.status(500).json({ error: 'Failed to train model' });
    }
  })
);

/**
 * Delete a model
 */
router.delete(
  '/models/:id',
  verifyToken,
  requireSuperAdmin,
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
