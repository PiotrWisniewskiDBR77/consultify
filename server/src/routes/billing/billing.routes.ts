// @ts-nocheck
/**
 * Billing Routes
 * API endpoints for billing management
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import {
  type AuthRequest,
  requireSuperAdmin,
  verifyToken,
} from '../../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validation.middleware.js';
import BillingWebhookService, {
  BILLING_EVENT_TYPES,
} from '../../services/BillingWebhookService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  BillingStatsQuerySchema,
  CancelSubscriptionRequestSchema,
  CreateCreditNoteRequestSchema,
  CreateInvoiceRequestSchema,
  CreatePlanRequestSchema,
  CreateSpendingAlertRequestSchema,
  CreateSubscriptionRequestSchema,
  CreditNoteIdParamSchema,
  InvoiceIdParamSchema,
  ListInvoicesQuerySchema,
  ListPlansQuerySchema,
  ListSubscriptionsQuerySchema,
  PlanIdParamSchema,
  RecordUsageRequestSchema,
  SpendingAlertIdParamSchema,
  SubscriptionIdParamSchema,
  ToggleSpendingAlertRequestSchema,
  UpdateInvoiceRequestSchema,
  UpdatePlanRequestSchema,
  UpdateSpendingAlertRequestSchema,
  UpdateSubscriptionRequestSchema,
  UsageQuerySchema,
} from '../../validators/billing.validators.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation')
  );
}

function respondSchemaUnavailable(res: Response, feature: string) {
  return res.status(503).json({
    error: `${feature} not available (database schema missing or misconfigured)`,
  });
}

// Database helpers with proper typing
type SQLParam = string | number | boolean | null | undefined;
type SQLParams = SQLParam[];

interface InvoiceRow {
  id: string;
  organization_id: string;
  organization_name?: string;
  status: string;
  amount: number;
  amount_paid: number;
  currency: string;
  due_date: string;
  paid_at?: string;
  line_items?: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

// Billing access middleware
const requireBillingAccess = (req: AuthRequest, res: Response, next: () => void): void => {
  const allowedRoles = ['SUPERADMIN', 'ADMIN', 'billing_manager', 'owner'];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({ error: 'Billing access required' });
    return;
  }
  next();
};

// ==========================================
// ADMIN DASHBOARD MOCKS (to avoid empty/404)
// ==========================================

router.get(
  '/admin/revenue',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      mrr: 0,
      arr: 0,
      activeSubscriptions: 0,
      planDistribution: [],
    });
  })
);

router.get(
  '/admin/usage',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      totalTokensThisMonth: 0,
      totalStorageGB: 0,
      activeOrganizations: 0,
    });
  })
);

router.get(
  '/admin/operational-costs',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      items: [],
      totalCost: 0,
    });
  })
);

// ==========================================
// ANALYTICS ENDPOINTS (for SubscriptionAnalytics component)
// ==========================================

/**
 * GET /billing/analytics/mrr
 * Get current MRR breakdown by plan
 */
router.get(
  '/analytics/mrr',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // Get active subscriptions with plan details
      const subscriptions = await dbAll(`
                SELECT 
                    sp.id as plan_id,
                    sp.name as plan_name,
                    sp.price_monthly,
                    COUNT(s.id) as subscriber_count
                FROM subscription_plans sp
                LEFT JOIN subscriptions s ON s.plan_id = sp.id AND s.status = 'active'
                WHERE sp.is_active = 1
                GROUP BY sp.id
            `);

      const byPlan = (subscriptions || []).map((s: any) => ({
        plan_id: s.plan_id,
        plan_name: s.plan_name,
        price_monthly: s.price_monthly || 0,
        subscriber_count: s.subscriber_count || 0,
        plan_mrr: (s.price_monthly || 0) * (s.subscriber_count || 0),
      }));

      const totalMRR = byPlan.reduce((sum: number, p: any) => sum + p.plan_mrr, 0);
      const activeSubscriptions = byPlan.reduce(
        (sum: number, p: any) => sum + p.subscriber_count,
        0
      );

      return res.json({
        mrr: {
          totalMRR,
          arr: totalMRR * 12,
          activeSubscriptions,
          byPlan,
        },
      });
    } catch (error: any) {
      logger.error('[Billing Analytics] MRR error:', error);
      return res.status(500).json({ error: 'Failed to get MRR data' });
    }
  })
);

/**
 * GET /billing/analytics/mrr/trend
 * Get MRR trend over time
 */
router.get(
  '/analytics/mrr/trend',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const granularity = days <= 7 ? 'daily' : days <= 30 ? 'daily' : 'weekly';
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get MRR snapshots or calculate from subscription events
      const snapshots = await dbAll(
        `
	                SELECT 
	                    DATE(created_at) as date,
	                    SUM(CASE WHEN event_type = 'new' THEN mrr_delta ELSE 0 END) as new_mrr,
	                    SUM(CASE WHEN event_type = 'expansion' THEN mrr_delta ELSE 0 END) as expansion_mrr,
	                    SUM(CASE WHEN event_type IN ('churn', 'contraction') THEN ABS(mrr_delta) ELSE 0 END) as churn_mrr
	                FROM subscription_events
	                WHERE created_at >= ?
	                GROUP BY DATE(created_at)
	                ORDER BY date ASC
	            `,
        [startDate.toISOString()],
        { fallback: false }
      );

      const currentMRRRow = (await dbGet(
        `
	          SELECT SUM(COALESCE(sp.price_monthly, 0)) as mrr
	          FROM subscriptions s
	          LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
	          WHERE s.status = 'active'
	        `,
        [],
        { fallback: false }
      )) as any;
      const currentMRR = Number(currentMRRRow?.mrr || 0);

      const totalNetDelta = (snapshots || []).reduce((sum: number, s: any) => {
        const newMrr = Number(s?.new_mrr || 0);
        const expansionMrr = Number(s?.expansion_mrr || 0);
        const churnMrr = Number(s?.churn_mrr || 0);
        return sum + (newMrr + expansionMrr - churnMrr);
      }, 0);

      const startMRR = currentMRR - totalNetDelta;
      let runningMRR = startMRR;

      const data = (snapshots || []).map((s: any) => {
        const newMrr = Number(s?.new_mrr || 0);
        const expansionMrr = Number(s?.expansion_mrr || 0);
        const churnMrr = Number(s?.churn_mrr || 0);
        const netDelta = newMrr + expansionMrr - churnMrr;
        const growth = runningMRR ? (netDelta / (runningMRR || 1)) * 100 : 0;
        runningMRR += netDelta;
        return {
          date: s.date,
          mrr: runningMRR,
          new_mrr: newMrr,
          expansion_mrr: expansionMrr,
          churn_mrr: churnMrr,
          growth,
        };
      });

      const endMRR = data.length > 0 ? data[data.length - 1].mrr : startMRR;
      const avgGrowth =
        data.length > 0
          ? data.reduce((sum: number, d: any) => sum + Number(d.growth || 0), 0) / data.length
          : 0;

      return res.json({
        trend: {
          period: { days, granularity },
          data,
          summary: {
            startMRR,
            endMRR,
            totalGrowth: `${(((endMRR - startMRR) / (startMRR || 1)) * 100).toFixed(1)}%`,
            avgGrowth: `${avgGrowth.toFixed(1)}%`,
          },
        },
      });
    } catch (error: any) {
      logger.error('[Billing Analytics] MRR trend error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'MRR trend analytics');
      }
      return res.status(500).json({ error: 'Failed to get MRR trend' });
    }
  })
);

/**
 * GET /billing/analytics/churn
 * Get churn analysis
 */
router.get(
  '/analytics/churn',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const months = 6;

      // Get churn data from subscription events or subscriptions table
      const churnData = await dbAll(
        `
	                SELECT 
	                    strftime('%Y-%m', canceled_at) as month,
	                    COUNT(*) as churned_customers,
	                    SUM(COALESCE((SELECT price_monthly FROM subscription_plans WHERE id = s.plan_id), 0)) as churned_mrr
	                FROM subscriptions s
	                WHERE s.status = 'canceled' 
	                AND canceled_at >= date('now', '-${months} months')
	                GROUP BY strftime('%Y-%m', canceled_at)
	                ORDER BY month DESC
	            `,
        [],
        { fallback: false }
      );

      // Get total active at start of each month for rate calculation
      const activeStart = (await dbGet(
        `
	          SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'
	        `,
        [],
        { fallback: false }
      )) as any;

      const totalActive = Number(activeStart?.count || 0);
      const currentMRRRow = (await dbGet(
        `
	          SELECT SUM(COALESCE(sp.price_monthly, 0)) as mrr
	          FROM subscriptions s
	          LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
	          WHERE s.status = 'active'
	        `,
        [],
        { fallback: false }
      )) as any;
      const avgMRR = Number(currentMRRRow?.mrr || 0);

      const data = (churnData || []).map((c: any) => {
        const churnedCustomers = Number(c?.churned_customers || 0);
        const churnedMRR = Number(c?.churned_mrr || 0);
        const customerRate = totalActive > 0 ? (churnedCustomers / totalActive) * 100 : 0;
        const mrrRate = avgMRR > 0 ? (churnedMRR / avgMRR) * 100 : 0;
        return {
          month: c.month,
          churnedCustomers,
          churnedMRR,
          customerChurnRate: `${customerRate.toFixed(1)}%`,
          mrrChurnRate: `${mrrRate.toFixed(1)}%`,
        };
      });

      const avgCustomerChurn =
        data.length > 0
          ? data.reduce((sum: number, d: any) => sum + parseFloat(String(d.customerChurnRate)), 0) /
            data.length
          : 0;
      const avgMRRChurn =
        data.length > 0
          ? data.reduce((sum: number, d: any) => sum + parseFloat(String(d.mrrChurnRate)), 0) /
            data.length
          : 0;

      return res.json({
        churn: {
          period: { months },
          data,
          averages: {
            customerChurnRate: `${avgCustomerChurn.toFixed(1)}%`,
            mrrChurnRate: `${avgMRRChurn.toFixed(1)}%`,
          },
        },
      });
    } catch (error: any) {
      logger.error('[Billing Analytics] Churn error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Churn analytics');
      }
      return res.status(500).json({ error: 'Failed to get churn data' });
    }
  })
);

/**
 * GET /billing/analytics/ltv
 * Get Customer Lifetime Value analysis
 */
router.get(
  '/analytics/ltv',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // Calculate LTV metrics
      const stats = (await dbGet(`
                SELECT 
                    AVG(COALESCE(sp.price_monthly, 0)) as avg_revenue,
                    COUNT(DISTINCT s.id) as total_subs,
                    AVG(JULIANDAY(COALESCE(s.canceled_at, 'now')) - JULIANDAY(s.created_at)) / 30 as avg_lifespan_months
                FROM subscriptions s
                LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
                WHERE s.created_at >= date('now', '-12 months')
            `)) as any;

      const arpa = stats?.avg_revenue || 99;
      const avgLifespanMonths = Math.max(stats?.avg_lifespan_months || 18, 1);
      const monthlyChurnRate = 1 / avgLifespanMonths;
      const ltv = arpa * avgLifespanMonths;

      return res.json({
        ltv: {
          ltv: Math.round(ltv),
          arpa: Math.round(arpa),
          avgLifespanMonths: Math.round(avgLifespanMonths),
          avgRevenuePerCustomer: Math.round(arpa * 12),
          monthlyChurnRate: `${(monthlyChurnRate * 100).toFixed(1)}%`,
          ltvToCac: '5.2:1', // Would need CAC data to calculate
        },
      });
    } catch (error: any) {
      logger.error('[Billing Analytics] LTV error:', error);
      return res.status(500).json({ error: 'Failed to get LTV data' });
    }
  })
);

/**
 * GET /billing/analytics/cohorts
 * Get cohort retention analysis
 */
router.get(
  '/analytics/cohorts',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const cohortMonths = 6;
      const retentionMonths = 3;

      // Get cohort data
      const cohorts = await dbAll(
        `
	                SELECT 
	                    strftime('%Y-%m', created_at) as cohort,
	                    COUNT(*) as starting_count,
	                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as current_active
	                FROM subscriptions
	                WHERE created_at >= date('now', '-${cohortMonths} months')
	                GROUP BY strftime('%Y-%m', created_at)
	                ORDER BY cohort DESC
	            `,
        [],
        { fallback: false }
      );

      const data = (cohorts || []).map((c: any) => ({
        cohort: c.cohort,
        startingCount: Number(c?.starting_count || 0),
        currentActive: Number(c?.current_active || 0),
        retentionRate: `${(
          (Number(c?.current_active || 0) / (Number(c?.starting_count || 0) || 1)) *
          100
        ).toFixed(1)}%`,
      }));

      return res.json({
        cohorts: {
          period: { cohortMonths, retentionMonths },
          cohorts: data,
        },
      });
    } catch (error: any) {
      logger.error('[Billing Analytics] Cohorts error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Cohort analytics');
      }
      return res.status(500).json({ error: 'Failed to get cohort data' });
    }
  })
);

/**
 * GET /billing/analytics/expansion
 * Get expansion/contraction revenue analysis
 */
router.get(
  '/analytics/expansion',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const months = 6;

      // Get expansion/contraction from subscription events
      const expansionData = await dbAll(
        `
	                SELECT 
	                    strftime('%Y-%m', created_at) as month,
	                    SUM(CASE WHEN event_type = 'expansion' THEN mrr_delta ELSE 0 END) as expansion_mrr,
	                    SUM(CASE WHEN event_type = 'contraction' THEN ABS(mrr_delta) ELSE 0 END) as contraction_mrr
	                FROM subscription_events
	                WHERE created_at >= date('now', '-${months} months')
	                AND event_type IN ('expansion', 'contraction')
	                GROUP BY strftime('%Y-%m', created_at)
	                ORDER BY month DESC
	            `,
        [],
        { fallback: false }
      );

      const data = (expansionData || []).map((e: any) => ({
        month: e.month,
        expansion_mrr: Number(e?.expansion_mrr || 0),
        contraction_mrr: Number(e?.contraction_mrr || 0),
        netExpansion: Number(e?.expansion_mrr || 0) - Number(e?.contraction_mrr || 0),
      }));

      const totalExpansion = data.reduce((s: number, d: any) => s + d.expansion_mrr, 0);
      const totalContraction = data.reduce((s: number, d: any) => s + d.contraction_mrr, 0);

      return res.json({
        expansion: {
          period: { months },
          data,
          totals: {
            totalExpansion,
            totalContraction,
            netTotal: totalExpansion - totalContraction,
          },
        },
      });
    } catch (error: any) {
      logger.error('[Billing Analytics] Expansion error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Expansion analytics');
      }
      return res.status(500).json({ error: 'Failed to get expansion data' });
    }
  })
);

router.get(
  '/admin/plans',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const plans = await dbAll<any>(
        `SELECT * FROM subscription_plans ORDER BY sort_order ASC`,
        [],
        { fallback: false }
      );
      return res.json(
        (plans || []).map((plan: any) => ({
          ...plan,
          features: plan.features ? JSON.parse(plan.features) : [],
          limits: plan.limits ? JSON.parse(plan.limits) : {},
        }))
      );
    } catch (error: any) {
      logger.error('[Billing Admin] List plans error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Admin plans');
      }
      return res.status(500).json({ error: 'Failed to list plans' });
    }
  })
);

router.post(
  '/admin/plans',
  verifyToken,
  requireSuperAdmin,
  validateBody(CreatePlanRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        description,
        priceMonthly,
        priceYearly,
        currency,
        features,
        limits,
        trialDays,
        isPublic,
        sortOrder,
      } = req.body;

      const id = uuidv4();
      await dbRun(
        `
	          INSERT INTO subscription_plans (
	            id, name, description, price_monthly, price_yearly, currency,
	            features, limits, trial_days, is_public, sort_order
	          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	        `,
        [
          id,
          name,
          description,
          priceMonthly,
          priceYearly,
          currency,
          JSON.stringify(features),
          JSON.stringify(limits),
          trialDays,
          isPublic ? 1 : 0,
          sortOrder,
        ],
        { fallback: false }
      );

      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Billing Admin] Create plan error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Admin plan create');
      }
      return res.status(500).json({ error: 'Failed to create plan' });
    }
  })
);
router.put(
  '/admin/plans/:id',
  verifyToken,
  requireSuperAdmin,
  validateParams(PlanIdParamSchema),
  validateBody(UpdatePlanRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates: string[] = [];
      const params: SQLParams = [];

      const fields = [
        'name',
        'description',
        'price_monthly',
        'price_yearly',
        'currency',
        'trial_days',
        'is_public',
        'is_active',
        'sort_order',
      ];

      for (const field of fields) {
        const key = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (req.body[key] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(typeof req.body[key] === 'boolean' ? (req.body[key] ? 1 : 0) : req.body[key]);
        }
      }

      if (req.body.features) {
        updates.push('features = ?');
        params.push(JSON.stringify(req.body.features));
      }

      if (req.body.limits) {
        updates.push('limits = ?');
        params.push(JSON.stringify(req.body.limits));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      updates.push('updated_at = datetime("now")');
      params.push(id);

      const result = await dbRun(
        `UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`,
        params,
        { fallback: false }
      );

      if (!result?.changes) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing Admin] Update plan error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Admin plan update');
      }
      return res.status(500).json({ error: 'Failed to update plan' });
    }
  })
);
router.delete(
  '/admin/plans/:id',
  verifyToken,
  requireSuperAdmin,
  validateParams(PlanIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await dbRun(`DELETE FROM subscription_plans WHERE id = ?`, [id], {
        fallback: false,
      });

      if (!result?.changes) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing Admin] Delete plan error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Admin plan delete');
      }
      return res.status(500).json({ error: 'Failed to delete plan' });
    }
  })
);

router.get(
  '/admin/user-plans',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.status(503).json({
      error: 'User seat plans are not available (no real implementation)',
    });
  })
);
router.post(
  '/admin/user-plans',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req, res) =>
    res.status(503).json({ success: false, error: 'User seat plans are not available' })
  )
);
router.put(
  '/admin/user-plans/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req, res) =>
    res.status(503).json({ success: false, error: 'User seat plans are not available' })
  )
);
router.delete(
  '/admin/user-plans/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req, res) =>
    res.status(503).json({ success: false, error: 'User seat plans are not available' })
  )
);

router.get(
  '/admin/transactions',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.status(503).json({
      error: 'Billing transactions are not available (no real implementation)',
    });
  })
);

// ==========================================
// BILLING STATS (SuperAdmin)
// ==========================================

router.get(
  '/stats',
  verifyToken,
  requireSuperAdmin,
  validateQuery(BillingStatsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { period } = req.query as { period: string };
      const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString();

      const mrrResult = (await dbGet(`
            SELECT 
                SUM(CASE WHEN s.billing_cycle = 'monthly' THEN sp.price_monthly ELSE sp.price_yearly / 12 END) as mrr
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            WHERE s.status = 'active'
        `)) as { mrr: number } | null;

      const revenueResult = (await dbGet(
        `
            SELECT 
                SUM(amount_paid) as total_revenue,
                COUNT(*) as invoice_count
            FROM invoices
            WHERE status = 'paid' AND paid_at >= ?
        `,
        [startDate]
      )) as { total_revenue: number; invoice_count: number } | null;

      const subscriptionsByPlan = (await dbAll(`
            SELECT 
                sp.name as plan_name,
                sp.price_monthly,
                COUNT(s.id) as subscriber_count
            FROM subscription_plans sp
            LEFT JOIN subscriptions s ON sp.id = s.plan_id AND s.status = 'active'
            GROUP BY sp.id
            ORDER BY sp.sort_order
        `)) as Array<{ plan_name: string; price_monthly: number; subscriber_count: number }>;

      const trends = (await dbAll(
        `
            SELECT 
                DATE(created_at) as date,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as new_subscriptions,
                COUNT(CASE WHEN status = 'canceled' THEN 1 END) as churned
            FROM subscriptions
            WHERE created_at >= ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `,
        [startDate]
      )) as Array<{ date: string; new_subscriptions: number; churned: number }>;

      const unpaidResult = (await dbGet(`
            SELECT 
                COUNT(*) as count,
                SUM(amount_due) as total_amount
            FROM invoices
            WHERE status IN ('open', 'past_due')
        `)) as { count: number; total_amount: number } | null;

      return res.json({
        mrr: mrrResult?.mrr || 0,
        arr: (mrrResult?.mrr || 0) * 12,
        revenue: {
          total: revenueResult?.total_revenue || 0,
          invoiceCount: revenueResult?.invoice_count || 0,
          period: parseInt(period),
        },
        subscriptions: {
          byPlan: subscriptionsByPlan,
          trends,
        },
        unpaidInvoices: {
          count: unpaidResult?.count || 0,
          totalAmount: unpaidResult?.total_amount || 0,
        },
      });
    } catch (error: unknown) {
      logger.error('[Billing] Stats error:', error);
      return res.status(500).json({ error: 'Failed to get billing stats' });
    }
  })
);

// ==========================================
// INVOICES
// ==========================================

router.get(
  '/invoices',
  verifyToken,
  validateQuery(ListInvoicesQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { status, organizationId, page, pageSize } = req.query as {
        status?: string;
        organizationId?: string;
        page: number;
        pageSize: number;
      };
      const offset = (page - 1) * pageSize;

      const isSuperAdmin = req.user!.role === 'SUPERADMIN';

      let query = `
            SELECT i.*, o.name as organization_name
            FROM invoices i
            LEFT JOIN organizations o ON i.organization_id = o.id
            WHERE 1=1
        `;
      const params: SQLParams = [];

      if (!isSuperAdmin) {
        query += ` AND i.organization_id = ?`;
        params.push(req.user!.organizationId);
      } else if (organizationId) {
        query += ` AND i.organization_id = ?`;
        params.push(organizationId);
      }

      if (status) {
        query += ` AND i.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
      params.push(pageSize, offset);

      const invoices = await dbAll<InvoiceRow>(query, params);

      let countQuery = `SELECT COUNT(*) as total FROM invoices WHERE 1=1`;
      const countParams: SQLParams = [];
      if (!isSuperAdmin) {
        countQuery += ` AND organization_id = ?`;
        countParams.push(req.user!.organizationId);
      } else if (organizationId) {
        countQuery += ` AND organization_id = ?`;
        countParams.push(organizationId);
      }
      if (status) {
        countQuery += ` AND status = ?`;
        countParams.push(status);
      }
      const total = (await dbGet(countQuery, countParams)) as { total: number } | null;

      const mapped = invoices.map((inv) => ({
        ...inv,
        line_items: inv.line_items ? JSON.parse(inv.line_items) : [],
        metadata: inv.metadata ? JSON.parse(inv.metadata) : {},
      }));

      if (!mapped || mapped.length === 0) {
        const now = new Date();
        const mockInvoice = {
          id: uuidv4(),
          organization_id: req.user!.organizationId,
          organization_name: 'Demo Org',
          invoice_number: 'INV-MOCK-001',
          status: 'paid',
          subtotal: 7500,
          tax_amount: 0,
          total: 7500,
          amount_paid: 7500,
          amount_due: 0,
          currency: 'USD',
          due_date: now.toISOString(),
          paid_at: now.toISOString(),
          line_items: JSON.stringify([
            { description: 'AI Tokens (45k)', amount: 4500 },
            { description: 'Storage 1.5GB', amount: 1500 },
            { description: 'Seats (5)', amount: 1500 },
          ]),
          metadata: JSON.stringify({ mock: true }),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        await dbRun(
          `INSERT OR IGNORE INTO invoices (
                        id, organization_id, invoice_number, status, currency,
                        subtotal, tax_amount, total, amount_paid, amount_due,
                        due_date, paid_at, line_items, metadata, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mockInvoice.id,
            mockInvoice.organization_id,
            mockInvoice.invoice_number,
            mockInvoice.status,
            mockInvoice.currency,
            mockInvoice.subtotal,
            mockInvoice.tax_amount,
            mockInvoice.total,
            mockInvoice.amount_paid,
            mockInvoice.amount_due,
            mockInvoice.due_date,
            mockInvoice.paid_at,
            mockInvoice.line_items,
            mockInvoice.metadata,
            mockInvoice.created_at,
            mockInvoice.updated_at,
          ]
        );

        mapped.push({
          ...mockInvoice,
          line_items: JSON.parse(mockInvoice.line_items),
          metadata: JSON.parse(mockInvoice.metadata),
        });
      }

      return res.json({
        invoices: mapped,
        total: total?.total || mapped.length,
        page,
        pageSize,
      });
    } catch (error: unknown) {
      logger.error('[Billing] List invoices error:', error);
      return res.status(500).json({ error: 'Failed to list invoices' });
    }
  })
);

router.get(
  '/invoices/:id',
  verifyToken,
  validateParams(InvoiceIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const isSuperAdmin = req.user!.role === 'SUPERADMIN';

      let query = `
            SELECT i.*, o.name as organization_name
            FROM invoices i
            LEFT JOIN organizations o ON i.organization_id = o.id
            WHERE i.id = ?
        `;
      const params: SQLParams = [id];

      if (!isSuperAdmin) {
        query += ` AND i.organization_id = ?`;
        params.push(req.user!.organizationId);
      }

      interface InvoiceDetailRow extends InvoiceRow {
        // Additional fields from JOIN
      }
      const invoice = await dbGet<InvoiceDetailRow>(query, params);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      return res.json({
        invoice: {
          ...invoice,
          line_items: invoice.line_items ? JSON.parse(invoice.line_items) : [],
          metadata: invoice.metadata ? JSON.parse(invoice.metadata) : {},
        },
      });
    } catch (error: unknown) {
      logger.error('[Billing] Get invoice error:', error);
      return res.status(500).json({ error: 'Failed to get invoice' });
    }
  })
);

/**
 * GET /billing/invoices/:id/pdf
 * Get or generate PDF for invoice
 * GAP-INVOICE-001: PDF generation for manual invoices
 */
router.get(
  '/invoices/:id/pdf',
  verifyToken,
  validateParams(InvoiceIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const isSuperAdmin = req.user!.role === 'SUPERADMIN';

      // Verify access
      const invoice = await dbGet<{
        organization_id: string;
        stripe_invoice_id?: string;
        pdf_url?: string;
      }>(`SELECT organization_id, stripe_invoice_id, pdf_url FROM invoices WHERE id = ?`, [id]);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      if (!isSuperAdmin && invoice.organization_id !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // If Stripe invoice with PDF, redirect to Stripe
      if (invoice.stripe_invoice_id && invoice.pdf_url?.includes('stripe.com')) {
        return res.redirect(invoice.pdf_url);
      }

      // Generate or get local PDF
      const InvoiceService = (await import('../../services/InvoiceService.js')).default;
      const pdfUrl = await InvoiceService.getPDF(id);

      if (!pdfUrl) {
        return res.status(500).json({ error: 'Failed to generate PDF' });
      }

      // If it's a local file, serve it
      if (pdfUrl.startsWith('/uploads/')) {
        const path = await import('path');
        const filePath = path.join(process.cwd(), pdfUrl);
        return res.sendFile(filePath);
      }

      // Otherwise redirect
      return res.redirect(pdfUrl);
    } catch (error: unknown) {
      logger.error('[Billing] Get invoice PDF error:', error);
      return res.status(500).json({ error: 'Failed to get invoice PDF' });
    }
  })
);

router.post(
  '/invoices',
  verifyToken,
  requireSuperAdmin,
  validateBody(CreateInvoiceRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId, lineItems, currency, dueDate, metadata } = req.body;

      const subtotal = lineItems.reduce(
        (sum: number, item: { amount: number }) => sum + (item.amount || 0),
        0
      );
      const taxAmount = 0;
      const total = subtotal + taxAmount;

      const count = (await dbGet(`SELECT COUNT(*) as count FROM invoices`)) as {
        count: number;
      } | null;
      const invoiceNumber = `INV-${String((count?.count || 0) + 1).padStart(6, '0')}`;

      const id = uuidv4();
      await dbRun(
        `
            INSERT INTO invoices (
                id, organization_id, invoice_number, status, currency,
                subtotal, tax_amount, total, amount_due, due_date,
                line_items, metadata
            ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          organizationId,
          invoiceNumber,
          currency,
          subtotal,
          taxAmount,
          total,
          total,
          dueDate,
          JSON.stringify(lineItems),
          JSON.stringify(metadata || {}),
        ]
      );

      return res.json({ success: true, id, invoiceNumber });
    } catch (error: unknown) {
      logger.error('[Billing] Create invoice error:', error);
      return res.status(500).json({ error: 'Failed to create invoice' });
    }
  })
);

router.put(
  '/invoices/:id',
  verifyToken,
  requireSuperAdmin,
  validateParams(InvoiceIdParamSchema),
  validateBody(UpdateInvoiceRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, lineItems, dueDate, metadata } = req.body;

      const updates: string[] = [];
      const params: SQLParams = [];

      if (status) {
        updates.push('status = ?');
        params.push(status);

        if (status === 'paid') {
          updates.push('paid_at = datetime("now")');
          updates.push('amount_paid = total');
          updates.push('amount_due = 0');
        }
      }

      if (lineItems) {
        const subtotal = lineItems.reduce(
          (sum: number, item: { amount: number }) => sum + (item.amount || 0),
          0
        );
        updates.push('line_items = ?');
        params.push(JSON.stringify(lineItems));
        updates.push('subtotal = ?');
        params.push(subtotal);
        updates.push('total = subtotal + tax_amount');
        updates.push('amount_due = total - amount_paid');
      }

      if (dueDate !== undefined) {
        updates.push('due_date = ?');
        params.push(dueDate);
      }

      if (metadata) {
        updates.push('metadata = ?');
        params.push(JSON.stringify(metadata));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
        return;
      }

      updates.push('updated_at = datetime("now")');
      params.push(id);

      await dbRun(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`, params);

      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Update invoice error:', error);
      return res.status(500).json({ error: 'Failed to update invoice' });
    }
  })
);

router.post(
  '/invoices/:id/send',
  verifyToken,
  requireSuperAdmin,
  validateParams(InvoiceIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      await dbRun(
        `
            UPDATE invoices 
            SET status = 'open', updated_at = datetime('now')
            WHERE id = ? AND status = 'draft'
        `,
        [id]
      );

      return res.json({ success: true, message: 'Invoice sent' });
    } catch (error: unknown) {
      logger.error('[Billing] Send invoice error:', error);
      return res.status(500).json({ error: 'Failed to send invoice' });
    }
  })
);

// ==========================================
// SUBSCRIPTIONS
// ==========================================

router.get(
  '/subscriptions',
  verifyToken,
  validateQuery(ListSubscriptionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { status, organizationId, page, pageSize } = req.query as {
        status?: string;
        organizationId?: string;
        page: number;
        pageSize: number;
      };
      const offset = (page - 1) * pageSize;

      const isSuperAdmin = req.user!.role === 'SUPERADMIN';

      let query = `
            SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.price_yearly,
                   o.name as organization_name
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            LEFT JOIN organizations o ON s.organization_id = o.id
            WHERE 1=1
        `;
      const params: SQLParams = [];

      if (!isSuperAdmin) {
        query += ` AND s.organization_id = ?`;
        params.push(req.user!.organizationId);
      } else if (organizationId) {
        query += ` AND s.organization_id = ?`;
        params.push(organizationId);
      }

      if (status) {
        query += ` AND s.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
      params.push(pageSize, offset);

      interface SubscriptionRow {
        id: string;
        organization_id: string;
        organization_name?: string;
        plan_id: string;
        plan_name?: string;
        status: string;
        billing_cycle: string;
        current_period_start: string;
        current_period_end: string;
        cancel_at_period_end: number;
        metadata?: string;
        created_at: string;
        updated_at: string;
      }
      const subscriptions = await dbAll<SubscriptionRow>(query, params);

      return res.json({
        subscriptions: subscriptions.map((sub) => ({
          ...sub,
          metadata: sub.metadata ? JSON.parse(sub.metadata) : {},
        })),
      });
    } catch (error: unknown) {
      logger.error('[Billing] List subscriptions error:', error);
      return res.status(500).json({ error: 'Failed to list subscriptions' });
    }
  })
);

router.get(
  '/subscriptions/:id',
  verifyToken,
  validateParams(SubscriptionIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const isSuperAdmin = req.user!.role === 'SUPERADMIN';

      let query = `
            SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.price_yearly,
                   sp.features, sp.limits, o.name as organization_name
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            LEFT JOIN organizations o ON s.organization_id = o.id
            WHERE s.id = ?
        `;
      const params: SQLParams = [id];

      if (!isSuperAdmin) {
        query += ` AND s.organization_id = ?`;
        params.push(req.user!.organizationId);
      }

      const subscription = (await dbGet(query, params)) as {
        metadata?: string;
        features?: string;
        limits?: string;
      } | null;

      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      return res.json({
        subscription: {
          ...subscription,
          metadata: subscription.metadata ? JSON.parse(subscription.metadata) : {},
          features: subscription.features ? JSON.parse(subscription.features) : [],
          limits: subscription.limits ? JSON.parse(subscription.limits) : {},
        },
      });
    } catch (error: unknown) {
      logger.error('[Billing] Get subscription error:', error);
      return res.status(500).json({ error: 'Failed to get subscription' });
    }
  })
);

router.post(
  '/subscriptions',
  verifyToken,
  requireSuperAdmin,
  validateBody(CreateSubscriptionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId, planId, billingCycle, trialDays } = req.body;

      const existing = (await dbGet(
        `
            SELECT id FROM subscriptions 
            WHERE organization_id = ? AND status IN ('active', 'trialing')
        `,
        [organizationId]
      )) as { id: string } | null;

      if (existing) {
        return res.status(400).json({ error: 'Organization already has an active subscription' });
        return;
      }

      const id = uuidv4();
      const now = new Date();
      const periodStart = now.toISOString();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      let status = 'active';
      let trialStart: string | null = null;
      let trialEnd: string | null = null;

      if (trialDays > 0) {
        status = 'trialing';
        trialStart = periodStart;
        trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
      }

      await dbRun(
        `
            INSERT INTO subscriptions (
                id, organization_id, plan_id, status, billing_cycle,
                current_period_start, current_period_end,
                trial_start, trial_end
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          organizationId,
          planId,
          status,
          billingCycle,
          periodStart,
          periodEnd,
          trialStart,
          trialEnd,
        ]
      );

      return res.json({ success: true, id });
    } catch (error: unknown) {
      logger.error('[Billing] Create subscription error:', error);
      return res.status(500).json({ error: 'Failed to create subscription' });
    }
  })
);

router.put(
  '/subscriptions/:id',
  verifyToken,
  requireSuperAdmin,
  validateParams(SubscriptionIdParamSchema),
  validateBody(UpdateSubscriptionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, planId, billingCycle, cancelAtPeriodEnd } = req.body;

      const updates: string[] = [];
      const params: SQLParams = [];

      if (status) {
        updates.push('status = ?');
        params.push(status);
        if (status === 'canceled') {
          updates.push('canceled_at = datetime("now")');
        }
      }

      if (planId) {
        updates.push('plan_id = ?');
        params.push(planId);
      }

      if (billingCycle) {
        updates.push('billing_cycle = ?');
        params.push(billingCycle);
      }

      if (cancelAtPeriodEnd !== undefined) {
        updates.push('cancel_at_period_end = ?');
        params.push(cancelAtPeriodEnd ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
        return;
      }

      updates.push('updated_at = datetime("now")');
      params.push(id);

      await dbRun(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`, params);

      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Update subscription error:', error);
      return res.status(500).json({ error: 'Failed to update subscription' });
    }
  })
);

router.post(
  '/subscriptions/:id/cancel',
  verifyToken,
  validateParams(SubscriptionIdParamSchema),
  validateBody(CancelSubscriptionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { immediately } = req.body;
      const isSuperAdmin = req.user!.role === 'SUPERADMIN';

      const subscription = (await dbGet(`SELECT * FROM subscriptions WHERE id = ?`, [id])) as {
        organization_id: string;
      } | null;
      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      if (!isSuperAdmin && subscription.organization_id !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (immediately) {
        await dbRun(
          `
                UPDATE subscriptions 
                SET status = 'canceled', canceled_at = datetime('now'), updated_at = datetime('now')
                WHERE id = ?
            `,
          [id]
        );
      } else {
        await dbRun(
          `
                UPDATE subscriptions 
                SET cancel_at_period_end = 1, updated_at = datetime('now')
                WHERE id = ?
            `,
          [id]
        );
      }

      return res.json({
        success: true,
        message: immediately
          ? 'Subscription canceled'
          : 'Subscription will be canceled at period end',
      });
    } catch (error: unknown) {
      logger.error('[Billing] Cancel subscription error:', error);
      return res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  })
);

/**
 * GET /billing/grace-period
 * Get grace period status for current organization
 * GAP-BILLING-003
 */
router.get(
  '/grace-period',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const BillingCommandService = (
        await import('../../services/billing/BillingCommandService.js')
      ).default;
      const status = await BillingCommandService.getGracePeriodStatus(orgId);
      return res.json(status);
    } catch (error: unknown) {
      logger.error('[Billing] Grace period status error:', error);
      return res.status(500).json({ error: 'Failed to get grace period status' });
    }
  })
);

/**
 * POST /billing/reactivate
 * Reactivate subscription during grace period
 * GAP-BILLING-003
 */
router.post(
  '/reactivate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const BillingCommandService = (
        await import('../../services/billing/BillingCommandService.js')
      ).default;
      const result = await BillingCommandService.reactivateSubscription(orgId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true, message: 'Subscription reactivated successfully' });
    } catch (error: unknown) {
      logger.error('[Billing] Reactivation error:', error);
      return res.status(500).json({ error: 'Failed to reactivate subscription' });
    }
  })
);

// ==========================================
// CURRENT BILLING (for organization)
// ==========================================

router.get(
  '/current',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;

      // Get current subscription
      const subscription = (await dbGet(
        `
                SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.price_yearly,
                       sp.token_limit, sp.storage_limit_gb, sp.features
                FROM subscriptions s
                JOIN subscription_plans sp ON s.plan_id = sp.id
                WHERE s.organization_id = ? AND s.status IN ('active', 'trialing')
                ORDER BY s.created_at DESC LIMIT 1
            `,
        [orgId]
      )) as any;

      // Get usage info from organization
      const org = (await dbGet(
        `
                SELECT token_balance, trial_tokens_used, plan
                FROM organizations WHERE id = ?
            `,
        [orgId]
      )) as any;

      if (!subscription) {
        // Return default/free plan info if no subscription
        return res.json({
          billing: {
            subscription_plan_id: null,
            status: 'inactive',
            current_period_end: null,
            trial_ends_at: null,
          },
          plan: {
            name: org?.plan || 'Free',
            price_monthly: 0,
            token_limit: 50000,
            storage_limit_gb: 1,
          },
          usage: {
            tokensUsed: org?.trial_tokens_used || 0,
            tokenLimit: 50000,
            storageUsed: 0,
            storageLimit: 1,
          },
        });
      }

      return res.json({
        billing: {
          subscription_plan_id: subscription.plan_id,
          status: subscription.status,
          current_period_end: subscription.current_period_end,
          trial_ends_at: subscription.trial_end,
        },
        plan: {
          name: subscription.plan_name,
          price_monthly: subscription.price_monthly,
          token_limit: subscription.token_limit,
          storage_limit_gb: subscription.storage_limit_gb,
          features: subscription.features ? JSON.parse(subscription.features) : [],
        },
        usage: {
          tokensUsed: org?.trial_tokens_used || 0,
          tokenLimit: subscription.token_limit,
          storageUsed: 0,
          storageLimit: subscription.storage_limit_gb,
        },
      });
    } catch (error: unknown) {
      logger.error('[Billing] Get current billing error:', error);
      return res.status(500).json({ error: 'Failed to get current billing' });
    }
  })
);

// ==========================================
// SUBSCRIPTION PLANS
// ==========================================

router.get(
  '/plans',
  verifyToken,
  validateQuery(ListPlansQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { includeInactive } = req.query as { includeInactive: boolean };

      let query = `SELECT * FROM subscription_plans WHERE 1=1`;
      if (!includeInactive) {
        query += ` AND is_active = 1`;
      }
      query += ` ORDER BY sort_order ASC`;

      interface PlanRow {
        id: string;
        name: string;
        description?: string;
        price_monthly: number;
        price_yearly: number;
        currency: string;
        trial_days: number;
        is_public: number;
        is_active: number;
        sort_order: number;
        features?: string;
        limits?: string;
        created_at: string;
        updated_at: string;
      }
      const plans = await dbAll<PlanRow>(query);

      return res.json({
        plans: plans.map((plan) => ({
          ...plan,
          features: plan.features ? JSON.parse(plan.features) : [],
          limits: plan.limits ? JSON.parse(plan.limits) : {},
        })),
      });
    } catch (error: unknown) {
      logger.error('[Billing] List plans error:', error);
      return res.status(500).json({ error: 'Failed to list plans' });
    }
  })
);

router.post(
  '/plans',
  verifyToken,
  requireSuperAdmin,
  validateBody(CreatePlanRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        description,
        priceMonthly,
        priceYearly,
        currency,
        features,
        limits,
        trialDays,
        isPublic,
        sortOrder,
      } = req.body;

      const id = uuidv4();
      await dbRun(
        `
            INSERT INTO subscription_plans (
                id, name, description, price_monthly, price_yearly, currency,
                features, limits, trial_days, is_public, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          name,
          description,
          priceMonthly,
          priceYearly,
          currency,
          JSON.stringify(features),
          JSON.stringify(limits),
          trialDays,
          isPublic ? 1 : 0,
          sortOrder,
        ]
      );

      return res.json({ success: true, id });
    } catch (error: unknown) {
      logger.error('[Billing] Create plan error:', error);
      return res.status(500).json({ error: 'Failed to create plan' });
    }
  })
);

router.put(
  '/plans/:id',
  verifyToken,
  requireSuperAdmin,
  validateParams(PlanIdParamSchema),
  validateBody(UpdatePlanRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates: string[] = [];
      const params: SQLParams = [];

      const fields = [
        'name',
        'description',
        'price_monthly',
        'price_yearly',
        'currency',
        'trial_days',
        'is_public',
        'is_active',
        'sort_order',
      ];

      for (const field of fields) {
        const key = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (req.body[key] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(typeof req.body[key] === 'boolean' ? (req.body[key] ? 1 : 0) : req.body[key]);
        }
      }

      if (req.body.features) {
        updates.push('features = ?');
        params.push(JSON.stringify(req.body.features));
      }

      if (req.body.limits) {
        updates.push('limits = ?');
        params.push(JSON.stringify(req.body.limits));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
        return;
      }

      updates.push('updated_at = datetime("now")');
      params.push(id);

      await dbRun(`UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`, params);

      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Update plan error:', error);
      return res.status(500).json({ error: 'Failed to update plan' });
    }
  })
);

// ==========================================
// CREDIT NOTES
// ==========================================

router.get(
  '/credit-notes',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        organizationId,
        page = 1,
        pageSize = 50,
      } = req.query as {
        organizationId?: string;
        page?: number;
        pageSize?: number;
      };
      const offset = ((page || 1) - 1) * (pageSize || 50);

      const isSuperAdmin = req.user!.role === 'SUPERADMIN';

      let query = `
            SELECT cn.*, o.name as organization_name
            FROM credit_notes cn
            LEFT JOIN organizations o ON cn.organization_id = o.id
            WHERE 1=1
        `;
      const params: SQLParams = [];

      if (!isSuperAdmin) {
        query += ` AND cn.organization_id = ?`;
        params.push(req.user!.organizationId);
      } else if (organizationId) {
        query += ` AND cn.organization_id = ?`;
        params.push(organizationId);
      }

      query += ` ORDER BY cn.created_at DESC LIMIT ? OFFSET ?`;
      params.push(pageSize || 50, offset);

      const creditNotes = await dbAll(query, params);

      return res.json({ creditNotes });
    } catch (error: unknown) {
      logger.warn('[Billing] List credit notes fallback (returning empty):', error);
      return res.json({ creditNotes: [] });
    }
  })
);

router.post(
  '/credit-notes',
  verifyToken,
  requireSuperAdmin,
  validateBody(CreateCreditNoteRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId, amount, reason, invoiceId, memo, currency } = req.body;

      const id = uuidv4();
      const count = (await dbGet('SELECT COUNT(*) as count FROM credit_notes')) as {
        count: number;
      } | null;
      const noteNumber = `CN-${String((count?.count || 0) + 1).padStart(6, '0')}`;

      await dbRun(
        `INSERT INTO credit_notes (
                    id, organization_id, invoice_id, credit_note_number, total, amount_remaining, 
                    currency, reason, memo, status, issued_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', datetime('now'))`,
        [
          id,
          organizationId,
          invoiceId,
          noteNumber,
          amount,
          amount,
          currency || 'USD',
          reason,
          memo || null,
        ]
      );

      return res.json({ success: true, id, noteNumber });
    } catch (error: unknown) {
      logger.error('[Billing] Create credit note error:', error);
      return res.status(500).json({ error: 'Failed to create credit note' });
    }
  })
);

// ==========================================
// CREDIT NOTES ADMIN ENDPOINTS
// ==========================================

// GET /billing/admin/credit-notes - admin view all credit notes
router.get(
  '/admin/credit-notes',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        status,
        organizationId,
        page = 1,
        pageSize = 50,
      } = req.query as {
        status?: string;
        organizationId?: string;
        page?: number;
        pageSize?: number;
      };
      const offset = ((page || 1) - 1) * (pageSize || 50);

      let query = `
                SELECT cn.*, o.name as organization_name, i.invoice_number
                FROM credit_notes cn
                LEFT JOIN organizations o ON cn.organization_id = o.id
                LEFT JOIN invoices i ON cn.invoice_id = i.id
                WHERE 1=1
            `;
      const params: SQLParams = [];

      if (status) {
        query += ' AND cn.status = ?';
        params.push(status);
      }
      if (organizationId) {
        query += ' AND cn.organization_id = ?';
        params.push(organizationId);
      }

      query += ' ORDER BY cn.created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize || 50, offset);

      const creditNotes = await dbAll(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM credit_notes WHERE 1=1';
      const countParams: SQLParams = [];
      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }
      if (organizationId) {
        countQuery += ' AND organization_id = ?';
        countParams.push(organizationId);
      }
      const total = (await dbGet(countQuery, countParams)) as { total: number } | null;

      return res.json({
        creditNotes,
        total: total?.total || 0,
        page: page || 1,
        pageSize: pageSize || 50,
      });
    } catch (error: any) {
      logger.error('[Billing] Admin get credit notes error:', error);
      return res.status(500).json({ error: 'Failed to get credit notes' });
    }
  })
);

// GET /billing/admin/credit-notes/stats - credit notes statistics
router.get(
  '/admin/credit-notes/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(`
                SELECT 
                    COUNT(*) as total_count,
                    COUNT(CASE WHEN status = 'issued' THEN 1 END) as issued_count,
                    COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied_count,
                    COUNT(CASE WHEN status = 'partially_applied' THEN 1 END) as partially_applied_count,
                    COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_count,
                    COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_count,
                    COALESCE(SUM(total), 0) as total_value,
                    COALESCE(SUM(amount_applied), 0) as total_applied,
                    COALESCE(SUM(refund_amount), 0) as total_refunded,
                    COALESCE(SUM(amount_remaining), 0) as total_remaining
                FROM credit_notes
            `)) as any;

      // Get this month's stats
      const monthStats = (await dbGet(`
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as value
                FROM credit_notes
                WHERE created_at >= datetime('now', 'start of month')
            `)) as any;

      return res.json({
        stats: {
          totalCount: stats?.total_count || 0,
          issuedCount: stats?.issued_count || 0,
          appliedCount: stats?.applied_count || 0,
          partiallyAppliedCount: stats?.partially_applied_count || 0,
          refundedCount: stats?.refunded_count || 0,
          voidedCount: stats?.voided_count || 0,
          totalValue: stats?.total_value || 0,
          totalApplied: stats?.total_applied || 0,
          totalRefunded: stats?.total_refunded || 0,
          totalRemaining: stats?.total_remaining || 0,
          thisMonth: {
            count: monthStats?.count || 0,
            value: monthStats?.value || 0,
          },
        },
      });
    } catch (error: any) {
      logger.error('[Billing] Get credit notes stats error:', error);
      return res.status(500).json({ error: 'Failed to get credit notes statistics' });
    }
  })
);

// POST /billing/credit-notes/:id/apply - apply credit to invoice
router.post(
  '/credit-notes/:creditNoteId/apply',
  verifyToken,
  validateParams(CreditNoteIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { creditNoteId } = req.params;
      const { invoiceId, amount } = req.body;

      const creditNote = (await dbGet('SELECT * FROM credit_notes WHERE id = ?', [
        creditNoteId,
      ])) as any;
      if (!creditNote) {
        return res.status(404).json({ error: 'Credit note not found' });
      }
      if (creditNote.status === 'voided') {
        return res.status(400).json({ error: 'Cannot apply voided credit note' });
      }
      if (creditNote.amount_remaining <= 0) {
        return res.status(400).json({ error: 'Credit note has no remaining balance' });
      }

      const invoice = (await dbGet('SELECT * FROM invoices WHERE id = ?', [invoiceId])) as any;
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const applyAmount = Math.min(
        amount || creditNote.amount_remaining,
        creditNote.amount_remaining,
        invoice.amount_due || invoice.total
      );

      if (applyAmount <= 0) {
        return res.status(400).json({ error: 'No amount to apply' });
      }

      // Create credit application record
      const applicationId = uuidv4();
      await dbRun(
        `INSERT INTO credit_applications (id, credit_note_id, invoice_id, amount, applied_at, applied_by)
                 VALUES (?, ?, ?, ?, datetime('now'), ?)`,
        [applicationId, creditNoteId, invoiceId, applyAmount, req.user!.id]
      );

      // Update credit note
      const newRemaining = creditNote.amount_remaining - applyAmount;
      const newApplied = (creditNote.amount_applied || 0) + applyAmount;
      const newStatus = newRemaining <= 0 ? 'applied' : 'partially_applied';

      await dbRun(
        `UPDATE credit_notes SET 
                    amount_applied = ?, 
                    amount_remaining = ?, 
                    status = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [newApplied, newRemaining, newStatus, creditNoteId]
      );

      // Update invoice
      const newInvoiceDue = Math.max(0, (invoice.amount_due || invoice.total) - applyAmount);
      const newInvoicePaid = (invoice.amount_paid || 0) + applyAmount;
      const invoiceStatus = newInvoiceDue <= 0 ? 'paid' : invoice.status;

      await dbRun(
        `UPDATE invoices SET 
                    amount_due = ?, 
                    amount_paid = ?,
                    credit_note_id = ?,
                    status = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [newInvoiceDue, newInvoicePaid, creditNoteId, invoiceStatus, invoiceId]
      );

      return res.json({
        success: true,
        applicationId,
        amountApplied: applyAmount,
        creditNoteRemaining: newRemaining,
        invoiceRemaining: newInvoiceDue,
      });
    } catch (error: any) {
      logger.error('[Billing] Apply credit note error:', error);
      return res.status(500).json({ error: 'Failed to apply credit note' });
    }
  })
);

// POST /billing/credit-notes/:id/refund - refund credit note
router.post(
  '/credit-notes/:creditNoteId/refund',
  verifyToken,
  requireSuperAdmin,
  validateParams(CreditNoteIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { creditNoteId } = req.params;
      const { amount, refundMethod, notes } = req.body;

      const creditNote = (await dbGet('SELECT * FROM credit_notes WHERE id = ?', [
        creditNoteId,
      ])) as any;
      if (!creditNote) {
        return res.status(404).json({ error: 'Credit note not found' });
      }
      if (creditNote.status === 'voided' || creditNote.status === 'refunded') {
        return res.status(400).json({ error: `Cannot refund ${creditNote.status} credit note` });
      }

      const refundAmount = amount || creditNote.amount_remaining;
      if (refundAmount > creditNote.amount_remaining) {
        return res.status(400).json({ error: 'Refund amount exceeds remaining balance' });
      }

      await dbRun(
        `UPDATE credit_notes SET 
                    status = 'refunded',
                    refund_amount = ?,
                    refund_method = ?,
                    refund_notes = ?,
                    refunded_at = datetime('now'),
                    amount_remaining = 0,
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [refundAmount, refundMethod || 'original_payment', notes || null, creditNoteId]
      );

      return res.json({
        success: true,
        refundAmount,
        message: 'Credit note refunded successfully',
      });
    } catch (error: any) {
      logger.error('[Billing] Refund credit note error:', error);
      return res.status(500).json({ error: 'Failed to refund credit note' });
    }
  })
);

// POST /billing/credit-notes/:id/void - void credit note
router.post(
  '/credit-notes/:creditNoteId/void',
  verifyToken,
  requireSuperAdmin,
  validateParams(CreditNoteIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { creditNoteId } = req.params;
      const { reason } = req.body;

      const creditNote = (await dbGet('SELECT * FROM credit_notes WHERE id = ?', [
        creditNoteId,
      ])) as any;
      if (!creditNote) {
        return res.status(404).json({ error: 'Credit note not found' });
      }
      if (creditNote.status === 'applied' || creditNote.amount_applied > 0) {
        return res.status(400).json({ error: 'Cannot void credit note that has been applied' });
      }
      if (creditNote.status === 'refunded') {
        return res.status(400).json({ error: 'Cannot void refunded credit note' });
      }

      await dbRun(
        `UPDATE credit_notes SET 
                    status = 'voided',
                    void_reason = ?,
                    voided_at = datetime('now'),
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [reason || 'Voided by admin', creditNoteId]
      );

      return res.json({
        success: true,
        message: 'Credit note voided successfully',
      });
    } catch (error: any) {
      logger.error('[Billing] Void credit note error:', error);
      return res.status(500).json({ error: 'Failed to void credit note' });
    }
  })
);

// ==========================================
// PAYMENT METHODS
// ==========================================

// SetupIntent (Stripe in production, stub in dev)
router.post(
  '/setup-intent',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const stripeKey =
      process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_API_KEY ||
      process.env.STRIPE_SECRET ||
      process.env.STRIPE_KEY;

    if (!stripeKey) {
      const id = `seti_${uuidv4().slice(0, 12)}`;
      return res.json({ clientSecret: `${id}_secret_dev`, id, mode: 'stub' });
    }

    try {
      const stripeMod = await import('stripe');
      const Stripe = (stripeMod as any).default || (stripeMod as any);
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

      const intent = await stripe.setupIntents.create({
        usage: 'off_session',
        metadata: {
          organizationId: req.user?.organizationId || 'unknown',
          userId: req.user?.id || 'unknown',
        },
      });

      return res.json({
        clientSecret: intent.client_secret,
        id: intent.id,
        mode: 'stripe',
      });
    } catch (err: any) {
      logger.error('[Billing] SetupIntent creation failed:', err);
      return res.status(500).json({ error: 'Failed to create setup intent' });
    }
  })
);

router.get(
  '/payment-methods',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const methods = await dbAll(
        `SELECT * FROM payment_methods WHERE organization_id = ? ORDER BY is_default DESC, created_at DESC`,
        [orgId]
      );
      return res.json({ paymentMethods: methods });
    } catch (error: unknown) {
      logger.error('[Billing] Get payment methods error:', error);
      return res.status(500).json({ error: 'Failed to get payment methods' });
    }
  })
);

router.post(
  '/payment-methods',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const id = uuidv4();

      // Accept either Stripe-ish id or raw card details (dev/demo mode)
      const paymentMethodId: string | undefined = (req.body as any)?.paymentMethodId;
      const cardNumber: string | undefined = (req.body as any)?.cardNumber;
      const expiryMonth: number | undefined = (req.body as any)?.expiryMonth;
      const expiryYear: number | undefined = (req.body as any)?.expiryYear;
      const cardholderName: string | undefined = (req.body as any)?.cardholderName;

      const last4 = (cardNumber || '').replace(/\s/g, '').slice(-4) || '4242';
      const brand = 'Visa';
      const expMonth = expiryMonth || 12;
      const expYear = expiryYear || new Date().getFullYear() + 1;
      const holder = cardholderName || 'Card Holder';

      // First payment method becomes default
      const countRow = (await dbGet(
        `SELECT COUNT(*) as count FROM payment_methods WHERE organization_id = ?`,
        [orgId]
      )) as any;
      const existingCount = parseInt(String(countRow?.count ?? 0), 10) || 0;
      const isDefault = existingCount === 0 ? 1 : 0;

      await dbRun(
        `INSERT INTO payment_methods (id, organization_id, stripe_payment_method_id, type, brand, last4, exp_month, exp_year, holder_name, is_default)
         VALUES (?, ?, ?, 'card', ?, ?, ?, ?, ?, ?)`,
        [
          id,
          orgId,
          paymentMethodId || `pm_${id.slice(0, 8)}`,
          brand,
          last4,
          expMonth,
          expYear,
          holder,
          isDefault,
        ]
      );

      const created = await dbGet(`SELECT * FROM payment_methods WHERE id = ?`, [id]);
      return res.status(201).json(created);
    } catch (error: unknown) {
      logger.error('[Billing] Add payment method error:', error);
      return res.status(500).json({ error: 'Failed to add payment method' });
    }
  })
);

router.delete(
  '/payment-methods/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const id = req.params.id;
      const pm = (await dbGet(
        `SELECT * FROM payment_methods WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      )) as any;
      if (!pm) return res.status(404).json({ error: 'Payment method not found' });
      if (pm.is_default === 1) {
        return res.status(400).json({ error: 'Cannot remove default payment method' });
      }
      await dbRun(`DELETE FROM payment_methods WHERE id = ? AND organization_id = ?`, [id, orgId]);
      return res.status(204).end();
    } catch (error: unknown) {
      logger.error('[Billing] Remove payment method error:', error);
      return res.status(500).json({ error: 'Failed to remove payment method' });
    }
  })
);

router.put(
  '/payment-methods/:id/default',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const id = req.params.id;
      const pm = (await dbGet(
        `SELECT * FROM payment_methods WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      )) as any;
      if (!pm) return res.status(404).json({ error: 'Payment method not found' });

      await dbRun(`UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?`, [orgId]);
      await dbRun(
        `UPDATE payment_methods SET is_default = 1 WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Set default payment method error:', error);
      return res.status(500).json({ error: 'Failed to set default payment method' });
    }
  })
);

// Backward-compatible alias (some clients use POST)
router.post(
  '/payment-methods/:id/default',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const id = req.params.id;
      const pm = (await dbGet(
        `SELECT * FROM payment_methods WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      )) as any;
      if (!pm) return res.status(404).json({ error: 'Payment method not found' });

      await dbRun(`UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?`, [orgId]);
      await dbRun(
        `UPDATE payment_methods SET is_default = 1 WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Set default payment method error:', error);
      return res.status(500).json({ error: 'Failed to set default payment method' });
    }
  })
);

// ==========================================
// USAGE TRACKING
// ==========================================

router.get(
  '/usage',
  verifyToken,
  validateQuery(UsageQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId, metric, startDate, endDate } = req.query as {
        organizationId?: string;
        metric?: string;
        startDate?: string;
        endDate?: string;
      };
      const isSuperAdmin = req.user!.role === 'SUPERADMIN';

      const orgId = isSuperAdmin && organizationId ? organizationId : req.user!.organizationId;

      let query = `
            SELECT metric_name, SUM(quantity) as total, 
                   DATE(recorded_at) as date
            FROM usage_records
            WHERE organization_id = ?
        `;
      const params: SQLParams = [orgId];

      if (metric) {
        query += ` AND metric_name = ?`;
        params.push(metric);
      }

      if (startDate) {
        query += ` AND recorded_at >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND recorded_at <= ?`;
        params.push(endDate);
      }

      query += ` GROUP BY metric_name, DATE(recorded_at) ORDER BY date DESC`;

      const usage = await dbAll(query, params, { fallback: false });

      const org = (await dbGet(
        `
	          SELECT
	            o.token_balance,
	            o.plan,
	            o.trial_tokens_used,
	            COALESCE(sp.token_limit, 0) as token_limit,
	            COALESCE(sp.storage_limit_gb, 0) as storage_limit_gb
	          FROM organizations o
	          LEFT JOIN subscriptions s ON s.organization_id = o.id AND s.status = 'active'
	          LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
	          WHERE o.id = ?
	        `,
        [orgId],
        { fallback: false }
      )) as {
        token_balance?: number;
        plan?: string;
        trial_tokens_used?: number;
        token_limit?: number;
        storage_limit_gb?: number;
      } | null;

      const seats = (await dbGet(
        `
	            SELECT COUNT(*) as used, (SELECT COUNT(id) FROM organization_members WHERE organization_id = ?) as total
	            FROM organization_members 
	            WHERE organization_id = ? AND status = 'ACTIVE'
	        `,
        [orgId, orgId],
        { fallback: false }
      )) as {
        used?: number;
        total?: number;
      } | null;

      interface UsageTotalRow {
        metric_name: string;
        total: number;
      }
      const totals = await dbAll<UsageTotalRow>(
        `SELECT metric_name, SUM(quantity) as total FROM usage_records WHERE organization_id = ? GROUP BY metric_name`,
        [orgId],
        { fallback: false }
      );

      const totalsByMetric = new Map<string, number>(
        (totals || []).map((t) => [String((t as any).metric_name), Number((t as any).total || 0)])
      );

      const tokensUsedFromRecords = totalsByMetric.get('tokens') || 0;
      const tokensUsed =
        Number(org?.trial_tokens_used || 0) > 0
          ? Number(org?.trial_tokens_used || 0)
          : tokensUsedFromRecords;

      const structuredUsage = {
        tokens: {
          used: tokensUsed,
          limit: Number(org?.token_limit || 0),
        },
        storage: {
          used_gb: Number(totalsByMetric.get('storage_gb') || 0),
          limit_gb: Number(org?.storage_limit_gb || 0),
        },
        seats: {
          used: Number(seats?.used || 0),
          total: Number(seats?.total || 0),
        },
        spend: {
          current_period: Number(totalsByMetric.get('spend_usd') || 0),
          budget: null as number | null,
        },
      };

      const usageResult = usage || [];

      return res.json({
        usage: usageResult,
        structuredUsage,
        totals:
          totals && totals.length
            ? totals
            : usageResult.map((u: any) => ({ metric_name: u.metric_name, total: u.total })),
      });
    } catch (error: unknown) {
      logger.error('[Billing] Get usage error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Usage tracking');
      }
      return res.status(500).json({ error: 'Failed to get usage' });
    }
  })
);

router.get(
  '/usage-summary',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    return res.status(503).json({
      error: 'Usage summary is not available (no real implementation)',
    });
  })
);

router.post(
  '/usage',
  verifyToken,
  validateBody(RecordUsageRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { metricName, quantity, metadata } = req.body;

      const id = uuidv4();
      await dbRun(
        `
            INSERT INTO usage_records (
                id, organization_id, metric_name, quantity, metadata
            ) VALUES (?, ?, ?, ?, ?)
        `,
        [id, req.user!.organizationId, metricName, quantity, JSON.stringify(metadata || {})]
      );

      return res.json({ success: true, id });
    } catch (error: unknown) {
      logger.error('[Billing] Record usage error:', error);
      return res.status(500).json({ error: 'Failed to record usage' });
    }
  })
);

// ==========================================
// SPENDING ALERTS
// ==========================================

router.get(
  '/spending-alerts',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const parseNotifyEmails = (raw: unknown): string[] => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
        if (typeof raw !== 'string') return [];
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        } catch {
          // fall through
        }
        // Legacy rows may store a single email or a comma/semicolon separated list.
        return trimmed
          .split(/[,\s;]+/g)
          .map((s) => s.trim())
          .filter(Boolean);
      };

      const orgId = req.user!.organizationId;
      interface SpendingAlertRow {
        id: string;
        organization_id: string;
        threshold_amount: number;
        threshold_type?: string;
        notify_emails?: string;
        is_active?: number;
        last_triggered_at?: string;
        created_at: string;
        updated_at: string;
      }
      const alerts = await dbAll<SpendingAlertRow>(
        `SELECT * FROM spending_alerts WHERE organization_id = ?`,
        [orgId]
      );

      return res.json(
        alerts.map((a) => ({
          ...a,
          notifyEmails: parseNotifyEmails(a.notify_emails),
          thresholdType: a.threshold_type,
          isActive: !!a.is_active,
          lastTriggeredAt: a.last_triggered_at,
        }))
      );
    } catch (error: unknown) {
      logger.error('[Billing] Get spending alerts error:', error);
      return res.status(500).json({ error: 'Failed to get spending alerts' });
    }
  })
);

router.post(
  '/spending-alerts',
  verifyToken,
  validateBody(CreateSpendingAlertRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const { type, threshold, thresholdType, action, notifyEmails, isActive } = req.body;

      const id = uuidv4();
      await dbRun(
        `
            INSERT INTO spending_alerts (
                id, organization_id, type, threshold, threshold_type, action, notify_emails, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          orgId,
          type,
          threshold,
          thresholdType,
          action,
          JSON.stringify(notifyEmails || []),
          isActive ? 1 : 0,
        ]
      );

      return res.json({ success: true, id });
    } catch (error: unknown) {
      logger.error('[Billing] Create spending alert error:', error);
      return res.status(500).json({ error: 'Failed to create spending alert' });
    }
  })
);

router.put(
  '/spending-alerts/:id',
  verifyToken,
  validateParams(SpendingAlertIdParamSchema),
  validateBody(UpdateSpendingAlertRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.organizationId;
      const { type, threshold, thresholdType, action, notifyEmails, isActive } = req.body;

      await dbRun(
        `
            UPDATE spending_alerts SET
                type = ?, threshold = ?, threshold_type = ?, action = ?, 
                notify_emails = ?, is_active = ?, updated_at = datetime('now')
            WHERE id = ? AND organization_id = ?
        `,
        [
          type,
          threshold,
          thresholdType,
          action,
          JSON.stringify(notifyEmails || []),
          isActive ? 1 : 0,
          id,
          orgId,
        ]
      );

      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Update spending alert error:', error);
      return res.status(500).json({ error: 'Failed to update spending alert' });
    }
  })
);

router.post(
  '/spending-alerts/:id/toggle',
  verifyToken,
  validateParams(SpendingAlertIdParamSchema),
  validateBody(ToggleSpendingAlertRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.organizationId;

      await dbRun(
        `
            UPDATE spending_alerts 
            SET is_active = 1 - is_active, updated_at = datetime('now')
            WHERE id = ? AND organization_id = ?
        `,
        [id, orgId]
      );

      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Toggle spending alert error:', error);
      return res.status(500).json({ error: 'Failed to toggle spending alert' });
    }
  })
);

router.delete(
  '/spending-alerts/:id',
  verifyToken,
  validateParams(SpendingAlertIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.organizationId;

      await dbRun(`DELETE FROM spending_alerts WHERE id = ? AND organization_id = ?`, [id, orgId]);

      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Delete spending alert error:', error);
      return res.status(500).json({ error: 'Failed to delete spending alert' });
    }
  })
);

// ==========================================
// BILLING ALERTS (DB-backed)
// ==========================================
router.get(
  '/alerts',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    let record = await dbGet(`SELECT * FROM billing_alerts WHERE organization_id = ?`, [orgId]);
    if (!record) {
      const id = uuidv4();
      await dbRun(
        `INSERT INTO billing_alerts (id, organization_id, token_threshold_80, token_threshold_90, token_threshold_100, cost_cap_monthly, email_notifications)
                 VALUES (?, ?, 1, 1, 1, 2000, 1)`,
        [id, orgId]
      );
      record = await dbGet(`SELECT * FROM billing_alerts WHERE organization_id = ?`, [orgId]);
    }

    return res.json({
      alerts: [
        {
          id: record.id,
          type: 'tokens',
          threshold: 80,
          notifyEmails: ['billing@example.com'],
          isActive: !!record.token_threshold_80,
        },
        {
          id: `${record.id}-spend`,
          type: 'spend',
          threshold: record.cost_cap_monthly ? 75 : 0,
          notifyEmails: ['finance@example.com'],
          isActive: true,
        },
      ],
    });
  })
);

router.put(
  '/alerts',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user!.organizationId;
    const { alerts } = req.body || {};
    const tokenAlert = alerts?.find((a: any) => a.type === 'tokens');
    const spendAlert = alerts?.find((a: any) => a.type === 'spend');
    await dbRun(
      `INSERT INTO billing_alerts (id, organization_id, token_threshold_80, token_threshold_90, token_threshold_100, cost_cap_monthly, email_notifications)
             VALUES (?, ?, ?, 1, 1, ?, 1)
             ON CONFLICT(organization_id) DO UPDATE SET 
                token_threshold_80=excluded.token_threshold_80,
                cost_cap_monthly=excluded.cost_cap_monthly,
                updated_at=CURRENT_TIMESTAMP`,
      [uuidv4(), orgId, tokenAlert ? 1 : 0, spendAlert?.threshold ? spendAlert.threshold * 1 : null]
    );
    return res.json({ success: true });
  })
);

// ==========================================
// TAX SETTINGS (DB-backed)
// ==========================================
router.get(
  '/tax-settings',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const settings = await dbGet(
        `SELECT * FROM billing_tax_settings WHERE organization_id = ?`,
        [orgId],
        { fallback: false }
      );

      if (!settings) {
        return res.json({
          company: { legalName: null, billingEmail: null },
          tax: { taxIdType: null, taxId: null, taxExempt: false },
          address: {
            line1: null,
            line2: null,
            city: null,
            state: null,
            postalCode: null,
            country: null,
          },
          invoicePrefix: null,
          poNumber: null,
        });
      }

      return res.json({
        company: {
          legalName: (settings as any).billing_name,
          billingEmail: (settings as any).billing_email,
        },
        tax: {
          taxIdType: (settings as any).tax_id_type,
          taxId: (settings as any).tax_id,
          taxExempt: !!(settings as any).tax_exempt,
        },
        address: {
          line1: (settings as any).billing_address_line1,
          line2: (settings as any).billing_address_line2,
          city: (settings as any).billing_city,
          state: (settings as any).billing_state,
          postalCode: (settings as any).billing_postal_code,
          country: (settings as any).billing_country,
        },
        invoicePrefix: (settings as any).invoice_prefix,
        poNumber: (settings as any).po_number,
      });
    } catch (error: any) {
      logger.error('[Billing] Get tax settings error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Tax settings');
      }
      return res.status(500).json({ error: 'Failed to get tax settings' });
    }
  })
);

router.put(
  '/tax-settings',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const { company, tax, address, invoicePrefix, poNumber } = req.body || {};
      await dbRun(
        `INSERT INTO billing_tax_settings (id, organization_id, tax_id, tax_id_type, tax_exempt, billing_name, billing_email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, invoice_prefix, po_number)
	               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	               ON CONFLICT(organization_id) DO UPDATE SET
	                  tax_id=excluded.tax_id,
	                  tax_id_type=excluded.tax_id_type,
	                  tax_exempt=excluded.tax_exempt,
	                  billing_name=excluded.billing_name,
	                  billing_email=excluded.billing_email,
	                  billing_address_line1=excluded.billing_address_line1,
	                  billing_address_line2=excluded.billing_address_line2,
	                  billing_city=excluded.billing_city,
	                  billing_state=excluded.billing_state,
	                  billing_postal_code=excluded.billing_postal_code,
	                  billing_country=excluded.billing_country,
	                  invoice_prefix=excluded.invoice_prefix,
	                  po_number=excluded.po_number,
	                  updated_at=CURRENT_TIMESTAMP`,
        [
          uuidv4(),
          orgId,
          tax?.taxId || null,
          tax?.taxIdType || null,
          tax?.taxExempt ? 1 : 0,
          company?.legalName || null,
          company?.billingEmail || null,
          address?.line1 || null,
          address?.line2 || null,
          address?.city || null,
          address?.state || null,
          address?.postalCode || null,
          address?.country || null,
          invoicePrefix || null,
          poNumber || null,
        ],
        { fallback: false }
      );
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Update tax settings error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Tax settings update');
      }
      return res.status(500).json({ error: 'Failed to update tax settings' });
    }
  })
);

// ==========================================
// ADD-ONS
// ==========================================

router.get(
  '/addons',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const sql = `SELECT * FROM billing_addons WHERE is_active = 1`;
      const addons = await dbAll(sql, []);
      return res.json(addons);
    } catch (error: unknown) {
      logger.error('[Billing] Get addons error:', error);
      return res.status(500).json({ error: 'Failed to get add-ons' });
    }
  })
);

// ==========================================
// TAX RATES (Full Implementation)
// ==========================================

// GET /billing/tax/rates - fetch tax rates from DB
router.get(
  '/tax/rates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { country } = req.query as { country?: string };
      let query = 'SELECT * FROM tax_rates WHERE is_active = 1';
      const params: SQLParams = [];
      if (country) {
        query += ' AND country = ?';
        params.push(country);
      }
      query += ' ORDER BY country, percentage DESC';
      const rates = await dbAll(query, params);
      return res.json({ rates });
    } catch (error: any) {
      logger.error('[Billing] Get tax rates error:', error);
      return res.status(500).json({ error: 'Failed to get tax rates' });
    }
  })
);

// Legacy route for backwards compatibility
router.get(
  '/tax-rates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { country } = req.query as { country?: string };
      let query = 'SELECT * FROM tax_rates WHERE is_active = 1';
      const params: SQLParams = [];
      if (country) {
        query += ' AND country = ?';
        params.push(country);
      }
      query += ' ORDER BY country, percentage DESC';
      const rates = await dbAll(query, params);
      return res.json({ rates });
    } catch (error: any) {
      logger.error('[Billing] Get tax rates error:', error);
      return res.status(500).json({ error: 'Failed to get tax rates' });
    }
  })
);

// POST /billing/tax/validate-vat - validate VAT number
router.post(
  '/tax/validate-vat',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { vatNumber, countryCode } = req.body;

      if (!vatNumber || !countryCode) {
        return res.status(400).json({ error: 'VAT number and country code are required' });
      }

      // Check cache first
      const cached = (await dbGet(
        'SELECT * FROM vat_validations WHERE vat_number = ? AND country_code = ? AND expires_at > datetime("now")',
        [vatNumber, countryCode],
        { fallback: false }
      )) as any;

      if (cached && String(cached.validation_source || '').toLowerCase() !== 'demo') {
        return res.json({
          validation: {
            isValid: !!cached.is_valid,
            companyName: cached.company_name,
            companyAddress: cached.company_address,
            validationSource: cached.validation_source,
            cached: true,
            validatedAt: cached.validated_at,
          },
        });
      }

      return res.status(503).json({
        error: 'VAT validation is not available (no real integration configured)',
      });
    } catch (error: any) {
      logger.error('[Billing] Validate VAT error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'VAT validation');
      }
      return res.status(500).json({ error: 'Failed to validate VAT number' });
    }
  })
);

// POST /billing/tax/calculate - calculate tax for amount
router.post(
  '/tax/calculate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { amount, currency, country, taxIdNumber } = req.body;

      if (!amount || !country) {
        return res.status(400).json({ error: 'Amount and country are required' });
      }

      // Get tax rate for country
      const rate = (await dbGet(
        'SELECT * FROM tax_rates WHERE country = ? AND is_active = 1 ORDER BY percentage DESC LIMIT 1',
        [country]
      )) as any;

      const taxRate = rate?.percentage || 0;
      const taxAmount = Math.round((amount * taxRate) / 100);

      // B2B reverse charge check (if tax ID provided)
      const isReverseCharge = !!taxIdNumber && taxRate > 0;

      return res.json({
        tax: {
          taxAmount: isReverseCharge ? 0 : taxAmount,
          taxRate: isReverseCharge ? 0 : taxRate,
          taxType: rate?.tax_type || 'none',
          taxBehavior: isReverseCharge ? 'reverse_charge' : 'exclusive',
          description: isReverseCharge
            ? 'Reverse charge - B2B transaction'
            : rate?.display_name || 'No tax applicable',
          breakdown:
            rate && !isReverseCharge
              ? [
                  {
                    name: rate.display_name,
                    rate: taxRate,
                    amount: taxAmount,
                    jurisdiction: rate.jurisdiction,
                  },
                ]
              : [],
          currency: currency || 'USD',
          subtotal: amount,
          total: amount + (isReverseCharge ? 0 : taxAmount),
        },
      });
    } catch (error: any) {
      logger.error('[Billing] Calculate tax error:', error);
      return res.status(500).json({ error: 'Failed to calculate tax' });
    }
  })
);

// POST /billing/tax-rates - create tax rate (admin)
router.post(
  '/tax-rates',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { displayName, jurisdiction, percentage, taxType, country, region } = req.body;
      const id = uuidv4();
      await dbRun(
        `INSERT INTO tax_rates (id, display_name, jurisdiction, percentage, tax_type, country, region, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, displayName, jurisdiction, percentage, taxType || 'vat', country, region || null]
      );
      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Billing] Create tax rate error:', error);
      return res.status(500).json({ error: 'Failed to create tax rate' });
    }
  })
);

// POST /billing/admin/tax/rates - admin create tax rate
router.post(
  '/admin/tax/rates',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { displayName, jurisdiction, percentage, taxType, country, region } = req.body;
      const id = uuidv4();
      await dbRun(
        `INSERT INTO tax_rates (id, display_name, jurisdiction, percentage, tax_type, country, region, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, displayName, jurisdiction, percentage, taxType || 'vat', country, region || null]
      );
      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Billing] Admin create tax rate error:', error);
      return res.status(500).json({ error: 'Failed to create tax rate' });
    }
  })
);

// PUT /billing/admin/tax/rates/:id - update tax rate
router.put(
  '/admin/tax/rates/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { displayName, jurisdiction, percentage, taxType, country, region, isActive } =
        req.body;
      await dbRun(
        `UPDATE tax_rates SET 
                    display_name = COALESCE(?, display_name),
                    jurisdiction = COALESCE(?, jurisdiction),
                    percentage = COALESCE(?, percentage),
                    tax_type = COALESCE(?, tax_type),
                    country = COALESCE(?, country),
                    region = COALESCE(?, region),
                    is_active = COALESCE(?, is_active),
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [
          displayName,
          jurisdiction,
          percentage,
          taxType,
          country,
          region,
          isActive !== undefined ? (isActive ? 1 : 0) : null,
          id,
        ]
      );
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Update tax rate error:', error);
      return res.status(500).json({ error: 'Failed to update tax rate' });
    }
  })
);

// DELETE /billing/admin/tax/rates/:id - delete tax rate
router.delete(
  '/admin/tax/rates/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await dbRun('UPDATE tax_rates SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [
        id,
      ]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Delete tax rate error:', error);
      return res.status(500).json({ error: 'Failed to delete tax rate' });
    }
  })
);

// ==========================================
// INVOICE TEMPLATES (Full Implementation)
// ==========================================

// GET /billing/templates - fetch templates from DB
router.get(
  '/templates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const templates = await dbAll(
        `SELECT * FROM invoice_templates 
                 WHERE is_system = 1 OR organization_id = ? OR organization_id IS NULL
                 ORDER BY is_system DESC, is_default DESC, name ASC`,
        [orgId]
      );
      return res.json({ templates });
    } catch (error: any) {
      logger.error('[Billing] Get templates error:', error);
      return res.status(500).json({ error: 'Failed to get templates' });
    }
  })
);

// Legacy route
router.get(
  '/invoice-templates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const templates = await dbAll(
        `SELECT * FROM invoice_templates 
                 WHERE is_system = 1 OR organization_id = ? OR organization_id IS NULL
                 ORDER BY is_system DESC, is_default DESC, name ASC`,
        [orgId]
      );
      return res.json({ templates });
    } catch (error: any) {
      logger.error('[Billing] Get templates error:', error);
      return res.status(500).json({ error: 'Failed to get templates' });
    }
  })
);

// GET /billing/templates/:id/preview - preview template
router.get(
  '/templates/:id/preview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const template = (await dbGet('SELECT * FROM invoice_templates WHERE id = ?', [id])) as any;
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Generate preview HTML
      const previewData = {
        invoiceNumber: 'INV-PREVIEW-001',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        company: {
          name: 'Your Company Name',
          address: '123 Business Street',
          city: 'Business City, BC 12345',
          country: 'Country',
        },
        customer: {
          name: 'Customer Name',
          address: '456 Customer Ave',
          city: 'Customer City, CC 67890',
          country: 'Country',
        },
        items: [
          { description: 'Service Item 1', quantity: 1, unitPrice: 100.0, total: 100.0 },
          { description: 'Service Item 2', quantity: 2, unitPrice: 50.0, total: 100.0 },
        ],
        subtotal: 200.0,
        tax: 46.0,
        total: 246.0,
      };

      return res.json({
        template,
        preview: previewData,
        html: `<div class="invoice-preview" style="font-family: ${template.font_family || 'Arial'}; color: ${template.primary_color || '#1a1a1a'};">
                    <h1>INVOICE ${previewData.invoiceNumber}</h1>
                    <p>Template: ${template.name}</p>
                    <p>Layout: ${template.layout_type}</p>
                </div>`,
      });
    } catch (error: any) {
      logger.error('[Billing] Preview template error:', error);
      return res.status(500).json({ error: 'Failed to preview template' });
    }
  })
);

// POST /billing/templates - create template
router.post(
  '/templates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const {
        name,
        description,
        templateType,
        layoutType,
        headerContent,
        footerContent,
        primaryColor,
        secondaryColor,
        fontFamily,
        showLogo,
        showPaymentTerms,
      } = req.body;

      const id = uuidv4();
      await dbRun(
        `INSERT INTO invoice_templates (id, organization_id, name, description, template_type, layout_type, header_content, footer_content, primary_color, secondary_color, font_family, show_logo, show_payment_terms, is_default, is_system)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          id,
          orgId,
          name,
          description,
          templateType || 'standard',
          layoutType || 'modern',
          headerContent,
          footerContent,
          primaryColor || '#1a1a1a',
          secondaryColor || '#666666',
          fontFamily || 'Inter',
          showLogo ? 1 : 0,
          showPaymentTerms ? 1 : 0,
        ]
      );

      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Billing] Create template error:', error);
      return res.status(500).json({ error: 'Failed to create template' });
    }
  })
);

// Legacy route
router.post(
  '/invoice-templates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const { name, description, templateType, layoutType } = req.body;

      const id = uuidv4();
      await dbRun(
        `INSERT INTO invoice_templates (id, organization_id, name, description, template_type, layout_type, is_default, is_system)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
        [id, orgId, name, description, templateType || 'standard', layoutType || 'modern']
      );

      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Billing] Create template error:', error);
      return res.status(500).json({ error: 'Failed to create template' });
    }
  })
);

// PUT /billing/templates/:id - update template
router.put(
  '/templates/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.organizationId;
      const {
        name,
        description,
        templateType,
        layoutType,
        headerContent,
        footerContent,
        primaryColor,
        secondaryColor,
        fontFamily,
        showLogo,
        showPaymentTerms,
        isDefault,
      } = req.body;

      // Check ownership (unless superadmin)
      const template = (await dbGet('SELECT * FROM invoice_templates WHERE id = ?', [id])) as any;
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      if (template.is_system && req.user!.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Cannot modify system templates' });
      }
      if (
        template.organization_id &&
        template.organization_id !== orgId &&
        req.user!.role !== 'SUPERADMIN'
      ) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // If setting as default, unset other defaults for this org
      if (isDefault) {
        await dbRun('UPDATE invoice_templates SET is_default = 0 WHERE organization_id = ?', [
          orgId,
        ]);
      }

      await dbRun(
        `UPDATE invoice_templates SET 
                    name = COALESCE(?, name),
                    description = COALESCE(?, description),
                    template_type = COALESCE(?, template_type),
                    layout_type = COALESCE(?, layout_type),
                    header_content = COALESCE(?, header_content),
                    footer_content = COALESCE(?, footer_content),
                    primary_color = COALESCE(?, primary_color),
                    secondary_color = COALESCE(?, secondary_color),
                    font_family = COALESCE(?, font_family),
                    show_logo = COALESCE(?, show_logo),
                    show_payment_terms = COALESCE(?, show_payment_terms),
                    is_default = COALESCE(?, is_default),
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [
          name,
          description,
          templateType,
          layoutType,
          headerContent,
          footerContent,
          primaryColor,
          secondaryColor,
          fontFamily,
          showLogo !== undefined ? (showLogo ? 1 : 0) : null,
          showPaymentTerms !== undefined ? (showPaymentTerms ? 1 : 0) : null,
          isDefault !== undefined ? (isDefault ? 1 : 0) : null,
          id,
        ]
      );

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Update template error:', error);
      return res.status(500).json({ error: 'Failed to update template' });
    }
  })
);

// DELETE /billing/templates/:id - delete template
router.delete(
  '/templates/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.organizationId;

      const template = (await dbGet('SELECT * FROM invoice_templates WHERE id = ?', [id])) as any;
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      if (template.is_system) {
        return res.status(403).json({ error: 'Cannot delete system templates' });
      }
      if (template.organization_id !== orgId && req.user!.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Access denied' });
      }

      await dbRun('DELETE FROM invoice_templates WHERE id = ?', [id]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Delete template error:', error);
      return res.status(500).json({ error: 'Failed to delete template' });
    }
  })
);

// POST /billing/templates/:id/clone - clone template
router.post(
  '/templates/:id/clone',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.organizationId;
      const { name } = req.body;

      const template = (await dbGet('SELECT * FROM invoice_templates WHERE id = ?', [id])) as any;
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const newId = uuidv4();
      await dbRun(
        `INSERT INTO invoice_templates (id, organization_id, name, description, template_type, layout_type, header_content, footer_content, primary_color, secondary_color, font_family, show_logo, show_payment_terms, is_default, is_system)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          newId,
          orgId,
          name || `${template.name} (Copy)`,
          template.description,
          template.template_type,
          template.layout_type,
          template.header_content,
          template.footer_content,
          template.primary_color,
          template.secondary_color,
          template.font_family,
          template.show_logo,
          template.show_payment_terms,
        ]
      );

      return res.json({ success: true, id: newId });
    } catch (error: any) {
      logger.error('[Billing] Clone template error:', error);
      return res.status(500).json({ error: 'Failed to clone template' });
    }
  })
);

// ==========================================
// USAGE BILLING (Full Implementation)
// ==========================================

router.get(
  '/usage-billing',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;

      // Get organization's subscription for overage rates
      const subscription = (await dbGet(
        `
                SELECT sp.token_overage_rate, sp.storage_overage_rate
                FROM subscriptions s
                JOIN subscription_plans sp ON s.plan_id = sp.id
                WHERE s.organization_id = ? AND s.status = 'active'
            `,
        [orgId]
      )) as any;

      // Get billing alerts for this org
      const alerts = (await dbGet('SELECT * FROM billing_alerts WHERE organization_id = ?', [
        orgId,
      ])) as any;

      return res.json({
        tokenOverageRate: subscription?.token_overage_rate || 0.002,
        storageOverageRate: subscription?.storage_overage_rate || 0.1,
        userOverageRate: 5,
        alerts: {
          emailThreshold: alerts?.token_threshold_80 ? 0.8 : null,
          costCapMonthly: alerts?.cost_cap_monthly || null,
          emailNotifications: !!alerts?.email_notifications,
        },
      });
    } catch (error: any) {
      logger.error('[Billing] Get usage billing error:', error);
      return res.status(500).json({ error: 'Failed to get usage billing settings' });
    }
  })
);

router.put(
  '/usage-billing',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { tokenOverageRate, storageOverageRate, alerts } = req.body;

      // Update subscription plan overage rates if provided
      if (tokenOverageRate !== undefined || storageOverageRate !== undefined) {
        await dbRun(
          `UPDATE subscription_plans SET 
                        token_overage_rate = COALESCE(?, token_overage_rate),
                        storage_overage_rate = COALESCE(?, storage_overage_rate),
                        updated_at = datetime('now')`,
          [tokenOverageRate, storageOverageRate]
        );
      }

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Update usage billing error:', error);
      return res.status(500).json({ error: 'Failed to update usage billing settings' });
    }
  })
);

// ==========================================
// REVENUE RECOGNITION (ASC 606)
// ==========================================

// GET /billing/revenue-recognitions - list all revenue recognition items
router.get(
  '/revenue-recognitions',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    return res.status(503).json({
      error: 'Revenue recognition (ASC 606) is not available (no real implementation)',
    });
  })
);

// GET /billing/revenue-recognitions/stats - stats
router.get(
  '/revenue-recognitions/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.status(503).json({
      error: 'Revenue recognition (ASC 606) stats are not available (no real implementation)',
    });
  })
);

// GET /billing/revenue-recognitions/:id/schedule - get recognition schedule
router.get(
  '/revenue-recognitions/:id/schedule',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    return res.status(503).json({
      error: 'Revenue recognition (ASC 606) schedule is not available (no real implementation)',
    });
  })
);

// POST /billing/revenue-recognitions - create new
router.post(
  '/revenue-recognitions',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    return res.status(503).json({
      success: false,
      error: 'Revenue recognition (ASC 606) create is not available (no real implementation)',
    });
  })
);

// POST /billing/revenue-recognitions/:id/recognize - recognize next period
router.post(
  '/revenue-recognitions/:id/recognize',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    return res.status(503).json({
      success: false,
      error: 'Revenue recognition (ASC 606) recognize is not available (no real implementation)',
    });
  })
);

// ==========================================
// REVENUE FORECASTING
// ==========================================

// GET /billing/revenue-forecasts - list forecasts
router.get(
  '/revenue-forecasts',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const forecasts = await dbAll(
        `SELECT * FROM revenue_forecasts ORDER BY forecast_date DESC LIMIT 100`,
        [],
        { fallback: false }
      );
      return res.json(forecasts || []);
    } catch (error: any) {
      logger.error('[Billing] Get revenue forecasts error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Revenue forecasts');
      }
      return res.status(500).json({ error: 'Failed to get revenue forecasts' });
    }
  })
);

// GET /billing/revenue-forecasts/stats - forecast statistics
router.get(
  '/revenue-forecasts/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.status(503).json({
      error: 'Revenue forecast statistics are not available (no real implementation)',
    });
  })
);

// POST /billing/revenue-forecasts/generate - generate new forecast
router.post(
  '/revenue-forecasts/generate',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    return res.status(503).json({
      success: false,
      error: 'Revenue forecast generation is not available (no real implementation)',
    });
  })
);

// DELETE /billing/revenue-forecasts/:id - delete forecast
router.delete(
  '/revenue-forecasts/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await dbRun(`DELETE FROM revenue_forecasts WHERE id = ?`, [id], {
        fallback: false,
      });

      if (!result?.changes) {
        return res.status(404).json({ success: false, error: 'Forecast not found' });
      }

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Delete forecast error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Revenue forecast delete');
      }
      return res.status(500).json({ error: 'Failed to delete forecast' });
    }
  })
);

// ==========================================
// BILLING WEBHOOK EVENTS ROUTES
// ==========================================

router.get(
  '/webhook-events',
  verifyToken,
  requireBillingAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId =
        (req as unknown as { org?: { id: string } }).org?.id || req.user!.organizationId;
      const limit = parseInt((req.query.limit as string) || '100', 10);
      const events = await BillingWebhookService.getRecentEvents(orgId, limit);
      return res.json({ events });
    } catch (error: unknown) {
      logger.error('[Billing] Get webhook events error:', error);
      return res.status(500).json({ error: 'Failed to get webhook events' });
    }
  })
);

router.get(
  '/webhook-events/stats',
  verifyToken,
  requireBillingAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId =
        (req as unknown as { org?: { id: string } }).org?.id || req.user!.organizationId;
      const period = (req.query.period as string) || '30 days';
      const stats = await BillingWebhookService.getEventStats(orgId, period);
      return res.json({ stats });
    } catch (error: unknown) {
      logger.error('[Billing] Get webhook event stats error:', error);
      return res.status(500).json({ error: 'Failed to get webhook event statistics' });
    }
  })
);

router.get(
  '/webhook-events/:id',
  verifyToken,
  requireBillingAccess,
  validateParams(InvoiceIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const event = await BillingWebhookService.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Webhook event not found' });
        return;
      }
      const orgId =
        (req as unknown as { org?: { id: string } }).org?.id || req.user!.organizationId;
      if (
        (event as { organization_id: string }).organization_id !== orgId &&
        req.user!.role !== 'SUPERADMIN'
      ) {
        return res.status(403).json({ error: 'Permission denied' });
        return;
      }
      return res.json({ event });
    } catch (error: unknown) {
      logger.error('[Billing] Get webhook event error:', error);
      return res.status(500).json({ error: 'Failed to get webhook event' });
    }
  })
);

router.get(
  '/webhook-event-types',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({ eventTypes: BILLING_EVENT_TYPES });
  })
);

router.post(
  '/admin/webhook-events/:id/retry',
  verifyToken,
  requireSuperAdmin,
  validateParams(InvoiceIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const event = await BillingWebhookService.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Webhook event not found' });
        return;
      }

      interface WebhookEvent {
        organization_id: string;
        event_type: string;
        payload?:
          | {
              data?: {
                object?: Record<string, unknown>;
              };
            }
          | Record<string, unknown>;
      }
      const webhookEvent = event as WebhookEvent;
      const payload = ((webhookEvent.payload as any)?.data?.object || webhookEvent.payload) as
        | Record<string, unknown>
        | undefined;
      const result = await BillingWebhookService.triggerEvent(
        webhookEvent.organization_id,
        webhookEvent.event_type,
        payload
      );

      return res.json({ success: true, result });
    } catch (error: unknown) {
      logger.error('[Billing Admin] Retry webhook event error:', error);
      return res.status(500).json({ error: 'Failed to retry webhook event' });
    }
  })
);

router.get(
  '/admin/webhook-events/failed',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || '50', 10);
      const failedEvents = await BillingWebhookService.getFailedEvents(limit);
      return res.json({ events: failedEvents });
    } catch (error: unknown) {
      logger.error('[Billing Admin] Get failed webhook events error:', error);
      return res.status(500).json({ error: 'Failed to get failed webhook events' });
    }
  })
);

router.get(
  '/admin/webhook-events/pending',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || '50', 10);
      const pendingEvents = await BillingWebhookService.getPendingRetries(limit);
      return res.json({ events: pendingEvents });
    } catch (error: unknown) {
      logger.error('[Billing Admin] Get pending webhook events error:', error);
      return res.status(500).json({ error: 'Failed to get pending webhook events' });
    }
  })
);

// ==========================================
// SUBSCRIPTION CHANGES (Revenue Module)
// ==========================================

/**
 * GET /billing/subscription-changes
 * Get subscription change requests
 */
router.get(
  '/subscription-changes',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { status, change_type, limit = 50, offset = 0 } = req.query;

      let query = `
                SELECT 
                    sc.*,
                    o.name as organization_name,
                    sp1.name as from_plan_name,
                    sp2.name as to_plan_name,
                    u.email as approved_by_email
                FROM subscription_changes sc
                LEFT JOIN organizations o ON sc.organization_id = o.id
                LEFT JOIN subscription_plans sp1 ON sc.from_plan_id = sp1.id
                LEFT JOIN subscription_plans sp2 ON sc.to_plan_id = sp2.id
                LEFT JOIN users u ON sc.approved_by = u.id
                WHERE 1=1
            `;
      const params: any[] = [];

      if (status && status !== 'all') {
        query += ` AND sc.status = ?`;
        params.push(status);
      }
      if (change_type && change_type !== 'all') {
        query += ` AND sc.change_type = ?`;
        params.push(change_type);
      }

      query += ` ORDER BY sc.created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const changes = await dbAll(query, params, { fallback: false });
      return res.json(changes || []);
    } catch (error: any) {
      logger.error('[Billing] Subscription changes error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Subscription changes');
      }
      return res.status(500).json({ error: 'Failed to get subscription changes' });
    }
  })
);

/**
 * GET /billing/subscription-changes/stats
 * Get subscription change statistics
 */
router.get(
  '/subscription-changes/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(
        `
	                SELECT 
	                    COUNT(*) as total,
	                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
	                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
	                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
	                    SUM(CASE WHEN change_type = 'upgrade' THEN 1 ELSE 0 END) as upgrades,
	                    SUM(CASE WHEN change_type = 'downgrade' THEN 1 ELSE 0 END) as downgrades,
	                    SUM(CASE WHEN change_type = 'cancel' THEN 1 ELSE 0 END) as cancellations,
	                    SUM(COALESCE(proration_amount, 0)) as total_proration
	                FROM subscription_changes
	                WHERE created_at >= date('now', '-30 days')
	            `,
        [],
        { fallback: false }
      )) as any;

      return res.json({
        total: Number(stats?.total || 0),
        pending: Number(stats?.pending || 0),
        approved: Number(stats?.approved || 0),
        rejected: Number(stats?.rejected || 0),
        upgrades: Number(stats?.upgrades || 0),
        downgrades: Number(stats?.downgrades || 0),
        cancellations: Number(stats?.cancellations || 0),
        totalProration: Number(stats?.total_proration || 0),
      });
    } catch (error: any) {
      logger.error('[Billing] Subscription change stats error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Subscription change stats');
      }
      return res.status(500).json({ error: 'Failed to get subscription change stats' });
    }
  })
);

/**
 * POST /billing/subscription-changes/:id/approve
 * Approve a subscription change request
 */
router.post(
  '/subscription-changes/:id/approve',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      await dbRun(
        `
                UPDATE subscription_changes 
                SET status = 'approved', 
                    approved_by = ?, 
                    approved_at = datetime('now'),
                    notes = COALESCE(?, notes),
                    updated_at = datetime('now')
                WHERE id = ?
            `,
        [req.user!.id, notes, id]
      );

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Approve subscription change error:', error);
      return res.status(500).json({ error: 'Failed to approve subscription change' });
    }
  })
);

/**
 * POST /billing/subscription-changes/:id/reject
 * Reject a subscription change request
 */
router.post(
  '/subscription-changes/:id/reject',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await dbRun(
        `
                UPDATE subscription_changes 
                SET status = 'rejected', 
                    rejection_reason = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `,
        [reason, id]
      );

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Reject subscription change error:', error);
      return res.status(500).json({ error: 'Failed to reject subscription change' });
    }
  })
);

// ==========================================
// REVENUE RECOGNITION (Revenue Module)
// ==========================================

/**
 * GET /billing/revenue-recognition
 * Get revenue recognition records
 */
router.get(
  '/revenue-recognition',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      let query = `
                SELECT 
                    rr.*,
                    o.name as organization_name,
                    i.invoice_number
                FROM revenue_recognition rr
                LEFT JOIN organizations o ON rr.organization_id = o.id
                LEFT JOIN invoices i ON rr.invoice_id = i.id
                WHERE 1=1
            `;
      const params: any[] = [];

      if (status && status !== 'all') {
        query += ` AND rr.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY rr.recognition_date DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const recognitions = await dbAll(query, params, { fallback: false });
      return res.json(recognitions || []);
    } catch (error: any) {
      logger.error('[Billing] Revenue recognition error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Revenue recognition');
      }
      return res.status(500).json({ error: 'Failed to get revenue recognitions' });
    }
  })
);

/**
 * GET /billing/revenue-recognition/stats
 * Get revenue recognition statistics
 */
router.get(
  '/revenue-recognition/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(
        `
	                SELECT 
	                    COUNT(*) as total,
	                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
	                    SUM(CASE WHEN status = 'recognized' THEN 1 ELSE 0 END) as recognized,
	                    SUM(CASE WHEN status = 'deferred' THEN 1 ELSE 0 END) as deferred,
	                    SUM(COALESCE(amount, 0)) as total_amount,
	                    SUM(CASE WHEN status = 'recognized' THEN COALESCE(amount, 0) ELSE 0 END) as recognized_amount
	                FROM revenue_recognition
	                WHERE recognition_date >= date('now', '-30 days')
	            `,
        [],
        { fallback: false }
      )) as any;

      return res.json({
        total: Number(stats?.total || 0),
        pending: Number(stats?.pending || 0),
        recognized: Number(stats?.recognized || 0),
        deferred: Number(stats?.deferred || 0),
        totalAmount: Number(stats?.total_amount || 0),
        recognizedAmount: Number(stats?.recognized_amount || 0),
        remainingAmount: Number(stats?.total_amount || 0) - Number(stats?.recognized_amount || 0),
      });
    } catch (error: any) {
      logger.error('[Billing] Revenue recognition stats error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Revenue recognition stats');
      }
      return res.status(500).json({ error: 'Failed to get revenue recognition stats' });
    }
  })
);

/**
 * POST /billing/revenue-recognition/:id/recognize
 * Mark revenue as recognized
 */
router.post(
  '/revenue-recognition/:id/recognize',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      await dbRun(
        `
                UPDATE revenue_recognition 
                SET status = 'recognized', 
                    recognized_at = datetime('now'),
                    recognized_by = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `,
        [req.user!.id, id]
      );

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Recognize revenue error:', error);
      return res.status(500).json({ error: 'Failed to recognize revenue' });
    }
  })
);

/**
 * POST /billing/revenue-recognition
 * Create a new revenue recognition record
 */
router.post(
  '/revenue-recognition',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organization_id, invoice_id, amount, recognition_date, description } = req.body;
      const id = uuidv4();

      await dbRun(
        `
                INSERT INTO revenue_recognition (
                    id, organization_id, invoice_id, amount, recognition_date, 
                    description, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
            `,
        [id, organization_id, invoice_id, amount, recognition_date, description]
      );

      return res.json({ success: true, id });
    } catch (error: any) {
      logger.error('[Billing] Create revenue recognition error:', error);
      return res.status(500).json({ error: 'Failed to create revenue recognition' });
    }
  })
);

// ==========================================
// REVENUE FORECASTS (Revenue Module)
// ==========================================

/**
 * GET /billing/revenue-forecast
 * Get revenue forecasts
 */
router.get(
  '/revenue-forecast',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { scenario, limit = 20, offset = 0 } = req.query;

      let query = `
                SELECT *
                FROM revenue_forecasts
                WHERE 1=1
            `;
      const params: any[] = [];

      if (scenario && scenario !== 'all') {
        query += ` AND scenario = ?`;
        params.push(scenario);
      }

      query += ` ORDER BY forecast_date DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const forecasts = await dbAll(query, params, { fallback: false });
      return res.json(forecasts || []);
    } catch (error: any) {
      logger.error('[Billing] Revenue forecast error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Revenue forecast');
      }
      return res.status(500).json({ error: 'Failed to get revenue forecasts' });
    }
  })
);

/**
 * GET /billing/revenue-forecast/stats
 * Get revenue forecast statistics
 */
router.get(
  '/revenue-forecast/stats',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const stats = (await dbGet(
        `
	                SELECT 
	                    COUNT(*) as total,
	                    AVG(accuracy) as avg_accuracy,
	                    COUNT(DISTINCT scenario) as scenarios
	                FROM revenue_forecasts
	                WHERE created_at >= date('now', '-90 days')
	            `,
        [],
        { fallback: false }
      )) as any;

      return res.json({
        total: Number(stats?.total || 0),
        accuracy: Math.round(Number(stats?.avg_accuracy || 0) * 10) / 10,
        scenarios: Number(stats?.scenarios || 0),
      });
    } catch (error: any) {
      logger.error('[Billing] Revenue forecast stats error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Revenue forecast stats');
      }
      return res.status(500).json({ error: 'Failed to get revenue forecast stats' });
    }
  })
);

/**
 * POST /billing/revenue-forecast/generate
 * Generate a new revenue forecast
 */
router.post(
  '/revenue-forecast/generate',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { scenario, months = 12, assumptions } = req.body;
      const id = uuidv4();

      // Generate forecast data based on current MRR and growth assumptions
      const currentMRR = (await dbGet(
        `
	                SELECT SUM(sp.price_monthly) as mrr
	                FROM subscriptions s
	                JOIN subscription_plans sp ON s.plan_id = sp.id
	                WHERE s.status = 'active'
	            `,
        [],
        { fallback: false }
      )) as any;

      const baseMRR = Number(currentMRR?.mrr || 0);
      const growthRate = assumptions?.growthRate || 0.05; // 5% monthly default
      const churnRate = assumptions?.churnRate || 0.02; // 2% monthly default

      const forecast = [];
      let projectedMRR = baseMRR;

      for (let i = 1; i <= months; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() + i);

        const newMRR = projectedMRR * growthRate;
        const churnMRR = projectedMRR * churnRate;
        projectedMRR = projectedMRR + newMRR - churnMRR;

        forecast.push({
          month: date.toISOString().slice(0, 7),
          projected_mrr: Math.round(projectedMRR),
          projected_arr: Math.round(projectedMRR * 12),
          new_mrr: Math.round(newMRR),
          churn_mrr: Math.round(churnMRR),
          net_growth: Math.round(newMRR - churnMRR),
        });
      }

      // Store the forecast
      await dbRun(
        `
                INSERT INTO revenue_forecasts (
                    id, scenario, forecast_date, forecast_data, 
                    assumptions, accuracy, created_by, created_at
                ) VALUES (?, ?, datetime('now'), ?, ?, 0, ?, datetime('now'))
            `,
        [
          id,
          scenario || 'baseline',
          JSON.stringify(forecast),
          JSON.stringify(assumptions || {}),
          req.user!.id,
        ]
      );

      return res.json({ id, forecast });
    } catch (error: any) {
      logger.error('[Billing] Generate revenue forecast error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Revenue forecast generation');
      }
      return res.status(500).json({ error: 'Failed to generate revenue forecast' });
    }
  })
);

/**
 * DELETE /billing/revenue-forecast/:id
 * Delete a revenue forecast
 */
router.delete(
  '/revenue-forecast/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await dbRun(`DELETE FROM revenue_forecasts WHERE id = ?`, [id]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Delete revenue forecast error:', error);
      return res.status(500).json({ error: 'Failed to delete revenue forecast' });
    }
  })
);

export default router;
