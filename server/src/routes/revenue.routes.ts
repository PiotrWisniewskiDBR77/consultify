// @ts-nocheck
/**
 * Revenue Routes
 * API endpoints for Revenue Management Module
 * Covers: Subscription Changes, Revenue Recognition (ASC 606), Forecasts, Payment Failures
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, requireSuperAdmin, verifyToken } from '../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Database helpers
type SQLParam = string | number | boolean | null | undefined;
type SQLParams = SQLParam[];

// ==========================================
// SUBSCRIPTION CHANGES
// ==========================================

// GET /revenue/subscription-changes - list subscription changes
router.get(
  '/subscription-changes',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        status,
        change_type,
        page = 1,
        pageSize = 50,
      } = req.query as {
        status?: string;
        change_type?: string;
        page?: number;
        pageSize?: number;
      };
      const offset = ((page || 1) - 1) * (pageSize || 50);

      let query = `
                SELECT sc.*, o.name as organization_name, sp_from.name as from_plan_name, sp_to.name as to_plan_name
                FROM subscription_changes sc
                LEFT JOIN organizations o ON sc.organization_id = o.id
                LEFT JOIN subscription_plans sp_from ON sc.from_plan_id = sp_from.id
                LEFT JOIN subscription_plans sp_to ON sc.to_plan_id = sp_to.id
                WHERE 1=1
            `;
      const params: SQLParams = [];

      if (status) {
        query += ' AND sc.status = ?';
        params.push(status);
      }
      if (change_type) {
        query += ' AND sc.change_type = ?';
        params.push(change_type);
      }

      query += ' ORDER BY sc.created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize || 50, offset);

      const changes = await dbAll(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM subscription_changes WHERE 1=1';
      const countParams: SQLParams = [];
      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }
      if (change_type) {
        countQuery += ' AND change_type = ?';
        countParams.push(change_type);
      }
      const total = (await dbGet(countQuery, countParams)) as { total: number } | null;

      return res.json({
        changes,
        total: total?.total || 0,
        page: page || 1,
        pageSize: pageSize || 50,
      });
    } catch (error: any) {
      logger.error('[Revenue] Get subscription changes error:', error);
      return res.status(500).json({ error: 'Failed to get subscription changes' });
    }
  })
);

// GET /revenue/subscription-changes/stats
router.get(
  '/subscription-changes/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                    COUNT(CASE WHEN change_type = 'upgrade' THEN 1 END) as upgrades,
                    COUNT(CASE WHEN change_type = 'downgrade' THEN 1 END) as downgrades,
                    COUNT(CASE WHEN change_type = 'cancel' THEN 1 END) as cancellations,
                    COALESCE(SUM(proration_amount), 0) as "totalProration"
                FROM subscription_changes
            `)) as any;

      return res.json({
        total: stats?.total || 0,
        pending: stats?.pending || 0,
        approved: stats?.approved || 0,
        rejected: stats?.rejected || 0,
        upgrades: stats?.upgrades || 0,
        downgrades: stats?.downgrades || 0,
        cancellations: stats?.cancellations || 0,
        totalProration: stats?.totalProration || 0,
      });
    } catch (error: any) {
      logger.error('[Revenue] Get subscription change stats error:', error);
      return res.status(500).json({ error: 'Failed to get subscription change stats' });
    }
  })
);

// POST /revenue/subscription-changes/:id/approve
router.post(
  '/subscription-changes/:id/approve',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      await dbRun(
        `UPDATE subscription_changes SET 
                    status = 'approved',
                    processed_at = datetime('now'),
                    processed_by = ?,
                    admin_notes = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [req.user!.id, notes || null, id]
      );

      return res.json({ success: true, message: 'Subscription change approved' });
    } catch (error: any) {
      logger.error('[Revenue] Approve subscription change error:', error);
      return res.status(500).json({ error: 'Failed to approve subscription change' });
    }
  })
);

// POST /revenue/subscription-changes/:id/reject
router.post(
  '/subscription-changes/:id/reject',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await dbRun(
        `UPDATE subscription_changes SET 
                    status = 'rejected',
                    processed_at = datetime('now'),
                    processed_by = ?,
                    rejection_reason = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [req.user!.id, reason || 'No reason provided', id]
      );

      return res.json({ success: true, message: 'Subscription change rejected' });
    } catch (error: any) {
      logger.error('[Revenue] Reject subscription change error:', error);
      return res.status(500).json({ error: 'Failed to reject subscription change' });
    }
  })
);

// ==========================================
// REVENUE RECOGNITION (ASC 606)
// ==========================================

// GET /revenue/revenue-recognition
router.get(
  '/revenue-recognition',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { status, method } = req.query as { status?: string; method?: string };

      let query = `
                SELECT rr.*, o.name as organization_name
                FROM revenue_recognition rr
                LEFT JOIN organizations o ON rr.organization_id = o.id
                WHERE 1=1
            `;
      const params: SQLParams = [];

      if (status) {
        query += ' AND rr.status = ?';
        params.push(status);
      }
      if (method) {
        query += ' AND rr.recognition_method = ?';
        params.push(method);
      }

      query += ' ORDER BY rr.created_at DESC';

      const items = await dbAll(query, params);
      return res.json(items);
    } catch (error: any) {
      logger.error('[Revenue] Get revenue recognition error:', error);
      return res.status(500).json({ error: 'Failed to get revenue recognition items' });
    }
  })
);

// GET /revenue/revenue-recognition/stats
router.get(
  '/revenue-recognition/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(COALESCE(total_amount, revenue_amount, amount, 0)), 0) as "totalRevenue",
                    COALESCE(SUM(recognized_amount), 0) as "recognizedRevenue",
                    COALESCE(SUM(remaining_amount), 0) as "remainingRevenue",
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as "pendingItems",
                    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as "inProgressItems",
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as "completedItems"
                FROM revenue_recognition
            `)) as any;

      const totalRev = Number(stats?.totalRevenue || 0);
      const recognizedRev = Number(stats?.recognizedRevenue || 0);
      const remainingRev = Number(stats?.remainingRevenue || 0);

      return res.json({
        total: Number(stats?.total || 0),
        totalRevenue: totalRev,
        total_revenue: totalRev,
        recognizedRevenue: recognizedRev,
        recognized_revenue: recognizedRev,
        remainingRevenue: remainingRev > 0 ? remainingRev : Math.max(0, totalRev - recognizedRev),
        remaining_revenue: remainingRev > 0 ? remainingRev : Math.max(0, totalRev - recognizedRev),
        pendingItems: Number(stats?.pendingItems || 0),
        pending_items: Number(stats?.pendingItems || 0),
        inProgressItems: Number(stats?.inProgressItems || 0),
        in_progress_items: Number(stats?.inProgressItems || 0),
        completedItems: Number(stats?.completedItems || 0),
        completed_items: Number(stats?.completedItems || 0),
      });
    } catch (error: any) {
      logger.error('[Revenue] Get revenue recognition stats error:', error);
      return res.status(500).json({ error: 'Failed to get revenue recognition stats' });
    }
  })
);

// GET /revenue/revenue-recognition/:id/schedule
router.get(
  '/revenue-recognition/:id/schedule',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const item = (await dbGet(
        'SELECT recognition_schedule FROM revenue_recognition WHERE id = ?',
        [id]
      )) as any;

      let schedule = [];
      if (item?.recognition_schedule) {
        try {
          schedule = JSON.parse(item.recognition_schedule);
        } catch {
          schedule = [];
        }
      }

      return res.json({ schedule });
    } catch (error: any) {
      logger.error('[Revenue] Get recognition schedule error:', error);
      return res.status(500).json({ error: 'Failed to get recognition schedule' });
    }
  })
);

// POST /revenue/revenue-recognition
router.post(
  '/revenue-recognition',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        organization_id,
        contract_id,
        contract_name,
        total_amount,
        currency,
        recognition_method,
        periods,
        start_date,
      } = req.body;

      const id = uuidv4();

      // Generate schedule based on method
      const schedule = [];
      const amountPerPeriod = Math.round(total_amount / (periods || 12));
      const startDateObj = start_date ? new Date(start_date) : new Date();

      for (let i = 0; i < (periods || 12); i++) {
        const periodDate = new Date(startDateObj);
        periodDate.setMonth(periodDate.getMonth() + i);
        schedule.push({
          period: periodDate.toISOString().slice(0, 7),
          amount: amountPerPeriod,
          recognized: false,
          recognized_at: null,
        });
      }

      await dbRun(
        `INSERT INTO revenue_recognition (
                    id, organization_id, contract_id, contract_name, total_amount, 
                    recognized_amount, remaining_amount, currency, recognition_method,
                    recognition_schedule, status, start_date
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'pending', ?)`,
        [
          id,
          organization_id,
          contract_id,
          contract_name,
          total_amount,
          total_amount,
          currency || 'USD',
          recognition_method || 'straight_line',
          JSON.stringify(schedule),
          startDateObj.toISOString(),
        ]
      );

      return res.json({ success: true, id, schedule });
    } catch (error: any) {
      logger.error('[Revenue] Create revenue recognition error:', error);
      return res.status(500).json({ error: 'Failed to create revenue recognition' });
    }
  })
);

// POST /revenue/revenue-recognition/:id/recognize
router.post(
  '/revenue-recognition/:id/recognize',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      const item = (await dbGet('SELECT * FROM revenue_recognition WHERE id = ?', [id])) as any;
      if (!item) {
        return res.status(404).json({ error: 'Revenue recognition item not found' });
      }

      let schedule = [];
      try {
        schedule = JSON.parse(item.recognition_schedule || '[]');
      } catch {
        schedule = [];
      }

      // Find next unrecognized period and mark it
      const nextPeriod = schedule.find((p: any) => !p.recognized);
      if (nextPeriod) {
        nextPeriod.recognized = true;
        nextPeriod.recognized_at = new Date().toISOString();
      }

      const recognizeAmount = amount || nextPeriod?.amount || 0;
      const newRecognized = (item.recognized_amount || 0) + recognizeAmount;
      const newRemaining = Math.max(0, item.total_amount - newRecognized);
      const newStatus = newRemaining <= 0 ? 'completed' : 'in_progress';

      await dbRun(
        `UPDATE revenue_recognition SET 
                    recognized_amount = ?,
                    remaining_amount = ?,
                    recognition_schedule = ?,
                    status = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [newRecognized, newRemaining, JSON.stringify(schedule), newStatus, id]
      );

      return res.json({
        success: true,
        recognizedAmount: recognizeAmount,
        totalRecognized: newRecognized,
        remaining: newRemaining,
        status: newStatus,
      });
    } catch (error: any) {
      logger.error('[Revenue] Recognize revenue error:', error);
      return res.status(500).json({ error: 'Failed to recognize revenue' });
    }
  })
);

// ==========================================
// REVENUE FORECASTS
// ==========================================

// GET /revenue/forecasts
router.get(
  '/forecasts',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { scenario, forecast_type, status } = req.query as {
        scenario?: string;
        forecast_type?: string;
        status?: string;
      };

      let query = 'SELECT * FROM revenue_forecasts WHERE 1=1';
      const params: SQLParams = [];

      if (scenario) {
        query += ' AND scenario = ?';
        params.push(scenario);
      }
      if (forecast_type) {
        query += ' AND forecast_type = ?';
        params.push(forecast_type);
      }
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC';

      const forecasts = await dbAll(query, params);
      return res.json(forecasts);
    } catch (error: any) {
      logger.error('[Revenue] Get forecasts error:', error);
      return res.status(500).json({ error: 'Failed to get forecasts' });
    }
  })
);

// GET /revenue/forecasts/stats
router.get(
  '/forecasts/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(`
                SELECT 
                    COUNT(*) as total,
                    AVG(accuracy) as accuracy,
                    COUNT(DISTINCT scenario) as scenarios,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as "activeForecasts"
                FROM revenue_forecasts
            `)) as any;

      return res.json({
        total: stats?.total || 0,
        accuracy: stats?.accuracy || 0,
        scenarios: stats?.scenarios || 0,
        activeForecasts: stats?.activeForecasts || 0,
      });
    } catch (error: any) {
      logger.error('[Revenue] Get forecast stats error:', error);
      return res.status(500).json({ error: 'Failed to get forecast stats' });
    }
  })
);

// POST /revenue/forecasts - generate new forecast
router.post(
  '/forecasts',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { forecast_type, scenario, period_months, method, confidence_level } = req.body;

      const id = uuidv4();
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (period_months || 12));

      // Calculate forecast amount based on historical data
      const mrrData = (await dbGet(`
                SELECT COALESCE(AVG(mrr), 50000) as avg_mrr
                FROM mrr_snapshots
                WHERE snapshot_date >= datetime('now', '-6 months')
            `)) as any;

      const baseMrr = mrrData?.avg_mrr || 50000;
      const growthRate =
        scenario === 'optimistic' ? 1.15 : scenario === 'pessimistic' ? 0.95 : 1.05;
      const forecastedAmount = Math.round(
        baseMrr * Math.pow(growthRate, period_months || 12) * (period_months || 12)
      );

      await dbRun(
        `INSERT INTO revenue_forecasts (
                    id, forecast_type, scenario, period_start, period_end,
                    forecasted_amount, currency, confidence_level, method,
                    status, accuracy
                ) VALUES (?, ?, ?, ?, ?, ?, 'USD', ?, ?, 'active', 0)`,
        [
          id,
          forecast_type || 'mrr',
          scenario || 'base',
          startDate.toISOString(),
          endDate.toISOString(),
          forecastedAmount,
          confidence_level || 0.75,
          method || 'linear',
        ]
      );

      return res.json({
        success: true,
        id,
        forecast: {
          id,
          forecast_type: forecast_type || 'mrr',
          scenario: scenario || 'base',
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          forecasted_amount: forecastedAmount,
          confidence_level: confidence_level || 0.75,
        },
      });
    } catch (error: any) {
      logger.error('[Revenue] Generate forecast error:', error);
      return res.status(500).json({ error: 'Failed to generate forecast' });
    }
  })
);

// DELETE /revenue/forecasts/:id
router.delete(
  '/forecasts/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await dbRun('DELETE FROM revenue_forecasts WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Forecast deleted' });
    } catch (error: any) {
      logger.error('[Revenue] Delete forecast error:', error);
      return res.status(500).json({ error: 'Failed to delete forecast' });
    }
  })
);

// ==========================================
// PAYMENT FAILURES (Dunning)
// ==========================================

// ==========================================
// PAYMENT METHODS (SuperAdmin read access)
// ==========================================

// GET /revenue/payment-methods - list payment methods across orgs
router.get(
  '/payment-methods',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organization_id } = req.query as { organization_id?: string };

      let query = `
        SELECT pm.*, o.name as organization_name
        FROM payment_methods pm
        LEFT JOIN organizations o ON pm.organization_id = o.id
        WHERE 1=1
      `;
      const params: SQLParams = [];

      if (organization_id) {
        query += ' AND pm.organization_id = ?';
        params.push(organization_id);
      }

      query += ' ORDER BY pm.is_default DESC, pm.created_at DESC';

      const methods = await dbAll(query, params);
      return res.json(methods);
    } catch (error: any) {
      logger.error('[Revenue] Get payment methods error:', error);
      return res.status(500).json({ error: 'Failed to get payment methods' });
    }
  })
);

// DELETE /revenue/payment-methods/:id - delete payment method (DB row only)
router.delete(
  '/payment-methods/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await dbRun('DELETE FROM payment_methods WHERE id = ?', [id]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Revenue] Delete payment method error:', error);
      return res.status(500).json({ error: 'Failed to delete payment method' });
    }
  })
);

// GET /revenue/payment-failures
router.get(
  '/payment-failures',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { recovery_status } = req.query as { recovery_status?: string };

      let query = `
                SELECT pf.*, o.name as organization_name
                FROM payment_failures pf
                LEFT JOIN organizations o ON pf.organization_id = o.id
                WHERE 1=1
            `;
      const params: SQLParams = [];

      if (recovery_status) {
        query += ' AND pf.recovery_status = ?';
        params.push(recovery_status);
      }

      query += ' ORDER BY pf.failed_at DESC';

      const failures = await dbAll(query, params);
      return res.json(failures);
    } catch (error: any) {
      logger.error('[Revenue] Get payment failures error:', error);
      return res.status(500).json({ error: 'Failed to get payment failures' });
    }
  })
);

// GET /revenue/payment-failures/stats
router.get(
  '/payment-failures/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN recovery_status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN recovery_status = 'recovered' THEN 1 END) as recovered,
                    COUNT(CASE WHEN recovery_status = 'failed' THEN 1 END) as failed
                FROM payment_failures
            `)) as any;

      const recoveryRate =
        stats?.total > 0 ? Math.round((stats?.recovered / stats?.total) * 100) : 0;

      return res.json({
        total: stats?.total || 0,
        pending: stats?.pending || 0,
        recovered: stats?.recovered || 0,
        failed: stats?.failed || 0,
        recoveryRate,
      });
    } catch (error: any) {
      logger.error('[Revenue] Get payment failure stats error:', error);
      return res.status(500).json({ error: 'Failed to get payment failure stats' });
    }
  })
);

// POST /revenue/payment-failures/:id/retry
router.post(
  '/payment-failures/:id/retry',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const failure = (await dbGet('SELECT * FROM payment_failures WHERE id = ?', [id])) as any;
      if (!failure) {
        return res.status(404).json({ error: 'Payment failure not found' });
      }

      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    } catch (error: any) {
      logger.error('[Revenue] Retry payment error:', error);
      return res.status(500).json({ error: 'Failed to retry payment' });
    }
  })
);

// POST /revenue/payment-failures/:id/resolve
router.post(
  '/payment-failures/:id/resolve',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { resolution_type } = req.body;

      await dbRun(
        `UPDATE payment_failures SET 
                    recovery_status = 'resolved',
                    resolution_type = ?,
                    resolved_at = datetime('now'),
                    resolved_by = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [resolution_type || 'manual', req.user!.id, id]
      );

      return res.json({ success: true, message: 'Payment failure resolved' });
    } catch (error: any) {
      logger.error('[Revenue] Resolve payment failure error:', error);
      return res.status(500).json({ error: 'Failed to resolve payment failure' });
    }
  })
);

// ==========================================
// PRICING PLANS (Advanced Features)
// ==========================================

// GET /revenue/plans/compare
router.get(
  '/plans/compare',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { planIds } = req.query as { planIds?: string };

      let plans = [];
      if (planIds) {
        const ids = planIds.split(',');
        const placeholders = ids.map(() => '?').join(',');
        plans = await dbAll(`SELECT * FROM subscription_plans WHERE id IN (${placeholders})`, ids);
      } else {
        plans = await dbAll(
          'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order'
        );
      }

      // Get features for comparison
      const features = await dbAll(`
                SELECT DISTINCT feature_key, feature_name, category
                FROM pricing_plan_features
                ORDER BY category, feature_name
            `);

      // Get feature values for each plan
      const planFeatures = await dbAll(`
                SELECT plan_id, feature_key, feature_value, is_included
                FROM pricing_plan_features
            `);

      // Build comparison matrix
      const comparison = plans.map((plan: any) => ({
        ...plan,
        features: plan.features ? JSON.parse(plan.features) : [],
        limits: plan.limits ? JSON.parse(plan.limits) : {},
        featureMatrix: planFeatures
          .filter((pf: any) => pf.plan_id === plan.id)
          .reduce((acc: any, pf: any) => {
            acc[pf.feature_key] = { value: pf.feature_value, included: pf.is_included };
            return acc;
          }, {}),
      }));

      return res.json({ plans: comparison, features });
    } catch (error: any) {
      logger.error('[Revenue] Compare plans error:', error);
      return res.status(500).json({ error: 'Failed to compare plans' });
    }
  })
);

// GET /revenue/plans/:id/features
router.get(
  '/plans/:id/features',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const features = await dbAll(
        `SELECT * FROM pricing_plan_features WHERE plan_id = ? ORDER BY category, feature_name`,
        [id]
      );

      return res.json(features);
    } catch (error: any) {
      logger.error('[Revenue] Get plan features error:', error);
      return res.status(500).json({ error: 'Failed to get plan features' });
    }
  })
);

// ==========================================
// ANALYTICS (MRR, Churn, LTV)
// ==========================================

const toNumber = (value: any, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// GET /revenue/analytics/mrr
router.get(
  '/analytics/mrr',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const summary = (await dbGet(
        `
          SELECT 
            COALESCE(SUM(sp.price_monthly), 0) as total_mrr,
            COUNT(*) as active_subscriptions
          FROM subscriptions s
          LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
          WHERE s.status = 'active'
        `
      )) as any;

      const byPlan = await dbAll(
        `
          SELECT 
            s.plan_id as plan_id,
            sp.name as plan_name,
            COALESCE(sp.price_monthly, 0) as price_monthly,
            COUNT(*) as subscriber_count,
            COALESCE(SUM(sp.price_monthly), 0) as plan_mrr
          FROM subscriptions s
          LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
          WHERE s.status = 'active'
          GROUP BY s.plan_id, sp.name, sp.price_monthly
          ORDER BY plan_mrr DESC
        `
      );

      const totalMRR = toNumber(summary?.total_mrr, 0);
      const activeSubscriptions = toNumber(summary?.active_subscriptions, 0);
      const arr = totalMRR * 12;

      // Backwards-compatible keys + SubscriptionAnalytics shape
      return res.json({
        current: totalMRR,
        arr,
        growth: 0,
        history: [],
        mrr: {
          totalMRR,
          arr,
          activeSubscriptions,
          byPlan: (byPlan || []).map((p: any) => ({
            plan_id: p.plan_id,
            plan_name: p.plan_name,
            price_monthly: toNumber(p.price_monthly, 0),
            subscriber_count: toNumber(p.subscriber_count, 0),
            plan_mrr: toNumber(p.plan_mrr, 0),
          })),
        },
      });
    } catch (error: any) {
      logger.error('[Revenue] Get MRR analytics error:', error);
      return res.status(500).json({ error: 'Failed to get MRR analytics' });
    }
  })
);

// GET /revenue/analytics/mrr/trend?days=30
router.get(
  '/analytics/mrr/trend',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { days = 30 } = req.query as { days?: string | number };
      const daysNum = Math.max(1, toNumber(days, 30));

      const rows = await dbAll(
        `
          SELECT 
            snapshot_date,
            COALESCE(mrr, total_mrr, 0) as mrr,
            COALESCE(new_mrr, 0) as new_mrr,
            COALESCE(expansion_mrr, 0) as expansion_mrr,
            COALESCE(contraction_mrr, 0) as contraction_mrr,
            COALESCE(churned_mrr, churn_mrr, 0) as churn_mrr,
            COALESCE(growth_rate, 0) as growth_rate
          FROM mrr_snapshots
          WHERE snapshot_date >= datetime('now', '-' || ? || ' days')
          ORDER BY snapshot_date ASC
        `,
        [daysNum]
      );

      const data = (rows || []).map((r: any) => ({
        date: r.snapshot_date,
        mrr: toNumber(r.mrr, 0),
        new_mrr: toNumber(r.new_mrr, 0),
        expansion_mrr: toNumber(r.expansion_mrr, 0),
        churn_mrr: toNumber(r.churn_mrr, 0),
        growth: toNumber(r.growth_rate, 0),
      }));

      const startMRR = data.length > 0 ? toNumber(data[0].mrr, 0) : 0;
      const endMRR = data.length > 0 ? toNumber(data[data.length - 1].mrr, 0) : 0;
      const totalGrowth =
        startMRR > 0 ? (((endMRR - startMRR) / startMRR) * 100).toFixed(2) : '0.00';
      const avgGrowth =
        data.length > 1
          ? (
              data.reduce((acc: number, d: any) => acc + toNumber(d.growth, 0), 0) / data.length
            ).toFixed(2)
          : '0.00';

      return res.json({
        trend: {
          period: { days: daysNum, granularity: 'day' },
          data,
          summary: { startMRR, endMRR, totalGrowth, avgGrowth },
        },
      });
    } catch (error: any) {
      logger.error('[Revenue] Get MRR trend analytics error:', error);
      return res.status(500).json({ error: 'Failed to get MRR trend analytics' });
    }
  })
);

// GET /revenue/analytics/churn
router.get(
  '/analytics/churn',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const churnData = (await dbGet(`
                SELECT 
                    COUNT(CASE WHEN status = 'canceled' AND canceled_at >= datetime('now', '-30 days') THEN 1 END) as monthly_churned,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active
                FROM subscriptions
            `)) as any;

      const churnRate =
        churnData?.active > 0
          ? Math.round((churnData?.monthly_churned / churnData?.active) * 100 * 100) / 100
          : 0;

      // SubscriptionAnalytics-compatible shape (monthly series)
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      return res.json({
        churn: {
          period: { months: 1 },
          data: [
            {
              month: monthKey,
              churnedCustomers: toNumber(churnData?.monthly_churned, 0),
              churnedMRR: 0,
              customerChurnRate: churnRate.toFixed(2),
              mrrChurnRate: churnRate.toFixed(2),
            },
          ],
          averages: {
            customerChurnRate: churnRate.toFixed(2),
            mrrChurnRate: churnRate.toFixed(2),
          },
        },
      });
    } catch (error: any) {
      logger.error('[Revenue] Get churn analytics error:', error);
      return res.status(500).json({ error: 'Failed to get churn analytics' });
    }
  })
);

// GET /revenue/analytics/ltv
router.get(
  '/analytics/ltv',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // Calculate average LTV from invoices
      const ltvData = (await dbGet(`
                SELECT 
                    AVG(total_paid) as avg_ltv,
                    MAX(total_paid) as max_ltv,
                    MIN(total_paid) as min_ltv
                FROM (
                    SELECT organization_id, SUM(amount_paid) as total_paid
                    FROM invoices
                    WHERE status = 'paid'
                    GROUP BY organization_id
                )
            `)) as any;

      const ltv = Math.round(toNumber(ltvData?.avg_ltv, 0));
      // Keep the rest as safe defaults (can be enriched later)
      return res.json({
        ltv: {
          ltv,
          arpa: 0,
          avgLifespanMonths: 0,
          avgRevenuePerCustomer: ltv,
          monthlyChurnRate: '0.00',
          ltvToCac: null,
        },
        average: ltv,
        max: toNumber(ltvData?.max_ltv, 0),
        min: toNumber(ltvData?.min_ltv, 0),
      });
    } catch (error: any) {
      logger.error('[Revenue] Get LTV analytics error:', error);
      return res.status(500).json({ error: 'Failed to get LTV analytics' });
    }
  })
);

// GET /revenue/analytics/cohorts
router.get(
  '/analytics/cohorts',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // Minimal, non-breaking payload for SubscriptionAnalytics
    return res.json({
      cohorts: {
        period: { cohortMonths: 0, retentionMonths: 0 },
        cohorts: [],
      },
    });
  })
);

// GET /revenue/analytics/expansion
router.get(
  '/analytics/expansion',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // Minimal, non-breaking payload for SubscriptionAnalytics
    return res.json({
      expansion: {
        period: { months: 0 },
        data: [],
        totals: { totalExpansion: 0, totalContraction: 0, netTotal: 0 },
      },
    });
  })
);

export default router;
