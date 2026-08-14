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
import { flagOn } from '../../utils/pgFlags.js';
import {
  BillingStatsQuerySchema,
  CancelSubscriptionRequestSchema,
  ChangePlanRequestSchema,
  CreateCreditNoteRequestSchema,
  CreateInvoiceRequestSchema,
  CreatePlanRequestSchema,
  CreateSpendingAlertRequestSchema,
  CreateSubscriptionRequestSchema,
  CreateUsagePricingTierSchema,
  CreditNoteIdParamSchema,
  InvoiceIdParamSchema,
  ListInvoicesQuerySchema,
  ListPlansQuerySchema,
  ListSubscriptionsQuerySchema,
  PlanIdParamSchema,
  RecordUsageRequestSchema,
  SpendingAlertIdParamSchema,
  SubscribeToPlanRequestSchema,
  SubscriptionIdParamSchema,
  ToggleSpendingAlertRequestSchema,
  UpdateInvoiceRequestSchema,
  UpdatePlanRequestSchema,
  UpdateSpendingAlertRequestSchema,
  UpdateSubscriptionRequestSchema,
  UpdateUsagePricingTierSchema,
  UsagePricingTierIdParamSchema,
  UsageQuerySchema,
} from '../../validators/billing.validators.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('does not exist') ||
    msg.includes('relation')
  );
}

function respondSchemaUnavailable(res: Response, _feature: string) {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
}

// Database helpers with proper typing
type SQLParam = string | number | boolean | null | undefined;
type SQLParams = SQLParam[];

interface InvoiceRow {
  id: string;
  organization_id: string;
  organization_name?: string;
  invoice_number?: string;
  status: string;
  // NOTE: `invoices` has never had an `amount` column (see 030_multi_currency.sql.sql /
  // 160_configuration_enhancements.sql / confirmed on parity :5443) — only subtotal,
  // tax_amount, total, amount_due, amount_paid. Do not add `amount` back here.
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  amount_due?: number;
  amount_paid: number;
  currency: string;
  due_date: string;
  paid_at?: string;
  line_items?: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeInvoiceLineItems(lineItems: any[]) {
  return lineItems.map((item) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? item.amount);
    const amount = Number((quantity * unitPrice).toFixed(2));
    return {
      description: String(item.description || 'Invoice item').trim(),
      quantity,
      unitPrice,
      amount,
    };
  });
}

function mapInvoiceRow(inv: InvoiceRow) {
  const lineItems = parseJsonField<any[]>(inv.line_items, []);
  const metadata = parseJsonField<Record<string, unknown>>(inv.metadata, {});
  // RED invoices.amount: `inv.amount` never exists on the invoices row (see
  // InvoiceRow above) — it read as `undefined` forever, silently masking any
  // invoice with a null/zero subtotal down to $0 instead of falling back to a
  // real column. Map to amount_due/total, which do exist.
  const subtotal = Number(inv.subtotal ?? inv.amount_due ?? inv.total ?? 0);
  const taxAmount = Number(inv.tax_amount ?? 0);
  const total = Number(inv.total ?? subtotal + taxAmount);

  return {
    ...inv,
    line_items: lineItems,
    lineItems,
    items: lineItems,
    metadata,
    invoiceNumber: inv.invoice_number,
    organizationId: inv.organization_id,
    organizationName: inv.organization_name,
    amount: subtotal,
    tax: taxAmount,
    total,
    amountDue: Number(inv.amount_due ?? total),
    amountPaid: Number(inv.amount_paid ?? 0),
    dueDate: inv.due_date,
    paidAt: inv.paid_at,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
  };
}

async function fetchInvoiceById(id: string) {
  const invoice = await dbGet<InvoiceRow>(
    `
      SELECT i.*, o.name as organization_name
      FROM invoices i
      LEFT JOIN organizations o ON i.organization_id = o.id
      WHERE i.id = ?
    `,
    [id]
  );
  return invoice ? mapInvoiceRow(invoice) : null;
}

async function organizationExists(organizationId: string) {
  const organization = await dbGet<{ id: string }>(`SELECT id FROM organizations WHERE id = ?`, [
    organizationId,
  ]);
  return Boolean(organization);
}

// Billing access middleware
const hasBillingAccess = (req: AuthRequest): boolean => {
  const role = String(req.user?.role || '')
    .trim()
    .toLowerCase();
  const allowedRoles = new Set([
    'superadmin',
    'admin',
    'administrator',
    'billing_manager',
    'owner',
  ]);
  return Boolean(req.user && (req.user.isSuperAdmin || allowedRoles.has(role)));
};

const requireBillingAccess = (req: AuthRequest, res: Response, next: () => void): void => {
  if (!hasBillingAccess(req)) {
    res.status(403).json({ error: 'Billing access required' });
    return;
  }
  next();
};

// ==========================================
// ADMIN DASHBOARD — real queries
// ==========================================

router.get(
  '/admin/revenue',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const plans = (await dbAll(`
        SELECT sp.name, sp.price_monthly, COUNT(s.id) as subscriber_count
        FROM subscription_plans sp
        LEFT JOIN subscriptions s ON s.plan_id = sp.id AND s.status = 'active'
        WHERE sp.is_active = 1
        GROUP BY sp.id
        ORDER BY sp.price_monthly DESC
      `)) as any[];

      const mrr = plans.reduce((sum: number, p: any) => {
        const priceMonthly = Number(p.price_monthly || 0);
        const subscriberCount = Number(p.subscriber_count || 0);
        return sum + priceMonthly * subscriberCount;
      }, 0);

      return res.json({
        mrr,
        arr: mrr * 12,
        activeSubscriptions: plans.reduce(
          (sum: number, p: any) => sum + Number(p.subscriber_count || 0),
          0
        ),
        planDistribution: plans.map((p: any) => {
          const priceMonthly = Number(p.price_monthly || 0);
          const subscriberCount = Number(p.subscriber_count || 0);
          return {
            plan: p.name,
            price: priceMonthly,
            subscribers: subscriberCount,
            revenue: priceMonthly * subscriberCount,
          };
        }),
      });
    } catch {
      return res.json({ mrr: 0, arr: 0, activeSubscriptions: 0, planDistribution: [] });
    }
  })
);

router.get(
  '/admin/usage',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const tokenRow = (await dbGet(`
        SELECT COALESCE(SUM(tokens_used), 0) as total_tokens
        FROM ai_usage_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `)) as any;

      const orgRow = (await dbGet(`
        SELECT COUNT(DISTINCT organization_id) as active_orgs
        FROM ai_usage_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `)) as any;

      return res.json({
        totalTokensThisMonth: Number(tokenRow?.total_tokens || 0),
        totalStorageGB: 0,
        activeOrganizations: Number(orgRow?.active_orgs || 0),
      });
    } catch {
      return res.json({ totalTokensThisMonth: 0, totalStorageGB: 0, activeOrganizations: 0 });
    }
  })
);

router.get(
  '/admin/operational-costs',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // NOTE: `model_id`/`cost` never existed on ai_usage_logs (real columns: `model`,
      // `estimated_cost_usd` — same stale-schema class as aiObservabilityService.ts).
      // Silently caught below -> superadmin billing dashboard always showed empty/0.
      const costs = (await dbAll(`
        SELECT provider, model,
          COUNT(*) as request_count,
          COALESCE(SUM(estimated_cost_usd), 0) as total_cost
        FROM ai_usage_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY provider, model
        ORDER BY total_cost DESC
        LIMIT 20
      `)) as any[];

      return res.json({
        items: costs.map((c: any) => ({
          provider: c.provider,
          model: c.model,
          requests: c.request_count,
          cost: c.total_cost,
        })),
        totalCost: costs.reduce((sum: number, c: any) => sum + (c.total_cost || 0), 0),
      });
    } catch {
      return res.json({ items: [], totalCost: 0 });
    }
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

      const byPlan = (subscriptions || []).map((s: any) => {
        const priceMonthly = Number(s.price_monthly || 0);
        const subscriberCount = Number(s.subscriber_count || 0);
        return {
          plan_id: s.plan_id,
          plan_name: s.plan_name,
          price_monthly: priceMonthly,
          subscriber_count: subscriberCount,
          plan_mrr: priceMonthly * subscriberCount,
        };
      });

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

      let cohorts = await dbAll(
        `SELECT
            strftime('%Y-%m', created_at) as cohort,
            COUNT(*) as starting_count,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as current_active
         FROM subscriptions
         WHERE created_at >= date('now', '-${cohortMonths} months')
         GROUP BY strftime('%Y-%m', created_at)
         ORDER BY cohort DESC`,
        [],
        { fallback: true }
      );

      if (!cohorts || cohorts.length === 0) {
        cohorts = await dbAll(
          `SELECT
              strftime('%Y-%m', created_at) as cohort,
              COUNT(*) as starting_count,
              SUM(CASE WHEN subscription_status IN ('active', 'trialing') THEN 1
                   WHEN EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = o.id AND s.status = 'active') THEN 1
                   ELSE 0 END) as current_active
           FROM organizations o
           WHERE created_at >= date('now', '-${cohortMonths} months')
           GROUP BY strftime('%Y-%m', created_at)
           ORDER BY cohort DESC`,
          [],
          { fallback: true }
        );
      }

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

      let expansionData = await dbAll(
        `SELECT 
            strftime('%Y-%m', created_at) as month,
            SUM(CASE WHEN event_type IN ('expansion', 'plan_upgraded', 'upgraded', 'seat_added')
                 THEN COALESCE(mrr_delta, mrr_change, 0) ELSE 0 END) as expansion_mrr,
            SUM(CASE WHEN event_type IN ('contraction', 'plan_downgraded', 'downgraded', 'seat_removed')
                 THEN ABS(COALESCE(mrr_delta, mrr_change, 0)) ELSE 0 END) as contraction_mrr
         FROM subscription_events
         WHERE created_at >= date('now', '-${months} months')
           AND event_type IN ('expansion', 'contraction', 'plan_upgraded', 'plan_downgraded',
                              'upgraded', 'downgraded', 'seat_added', 'seat_removed')
         GROUP BY strftime('%Y-%m', created_at)
         ORDER BY month DESC`,
        [],
        { fallback: true }
      );

      if (!expansionData || expansionData.length === 0) {
        expansionData = await dbAll(
          `SELECT
              strftime('%Y-%m', COALESCE(effective_date, created_at)) as month,
              SUM(CASE WHEN change_type = 'upgrade' THEN COALESCE(mrr_impact, new_amount - old_amount, 0) ELSE 0 END) as expansion_mrr,
              SUM(CASE WHEN change_type = 'downgrade' THEN ABS(COALESCE(mrr_impact, old_amount - new_amount, 0)) ELSE 0 END) as contraction_mrr
           FROM subscription_changes
           WHERE COALESCE(effective_date, created_at) >= date('now', '-${months} months')
             AND change_type IN ('upgrade', 'downgrade')
             AND status = 'approved'
           GROUP BY strftime('%Y-%m', COALESCE(effective_date, created_at))
           ORDER BY month DESC`,
          [],
          { fallback: true }
        );
      }

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
        `SELECT * FROM subscription_plans ORDER BY price_monthly ASC`,
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

      updates.push('updated_at = CURRENT_TIMESTAMP');
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
    return respondSchemaUnavailable(res, 'User seat plans');
  })
);
router.get(
  '/user-plans',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return respondSchemaUnavailable(res, 'User seat plans');
  })
);
router.post(
  '/admin/user-plans',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req, res) => respondSchemaUnavailable(res, 'User seat plans'))
);
router.put(
  '/admin/user-plans/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req, res) => respondSchemaUnavailable(res, 'User seat plans'))
);
router.delete(
  '/admin/user-plans/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req, res) => respondSchemaUnavailable(res, 'User seat plans'))
);

router.get(
  '/admin/transactions',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return respondSchemaUnavailable(res, 'Billing transactions');
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
        mrr: Number(mrrResult?.mrr || 0),
        arr: Number(mrrResult?.mrr || 0) * 12,
        revenue: {
          total: Number(revenueResult?.total_revenue || 0),
          invoiceCount: Number(revenueResult?.invoice_count || 0),
          period: parseInt(period),
        },
        subscriptions: {
          byPlan: subscriptionsByPlan.map((p) => ({
            ...p,
            subscriber_count: Number(p.subscriber_count || 0),
          })),
          trends: trends.map((t) => ({
            ...t,
            new_subscriptions: Number(t.new_subscriptions || 0),
            churned: Number(t.churned || 0),
          })),
        },
        unpaidInvoices: {
          count: Number(unpaidResult?.count || 0),
          totalAmount: Number(unpaidResult?.total_amount || 0),
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

      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

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

      const mapped = invoices.map(mapInvoiceRow);

      return res.json({
        invoices: mapped,
        total: Number(total?.total ?? mapped.length),
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
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

      interface InvoiceDetailRow extends InvoiceRow {
        // Additional fields from JOIN
      }
      const invoice = await dbGet<InvoiceDetailRow>(
        `
          SELECT i.*, o.name as organization_name
          FROM invoices i
          LEFT JOIN organizations o ON i.organization_id = o.id
          WHERE i.id = ?
        `,
        [id]
      );

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      if (!isSuperAdmin && invoice.organization_id !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({ invoice: mapInvoiceRow(invoice) });
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
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

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

      if (!(await organizationExists(organizationId))) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const normalizedLineItems = normalizeInvoiceLineItems(lineItems);
      const subtotal = normalizedLineItems.reduce(
        (sum: number, item: { amount: number }) => sum + item.amount,
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
          JSON.stringify(normalizedLineItems),
          JSON.stringify(metadata || {}),
        ]
      );

      const invoice = await fetchInvoiceById(id);
      return res.status(201).json({ success: true, id, invoiceNumber, invoice });
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
          updates.push('paid_at = CURRENT_TIMESTAMP');
          updates.push('amount_paid = total');
          updates.push('amount_due = 0');
        }
      }

      if (lineItems) {
        const normalizedLineItems = normalizeInvoiceLineItems(lineItems);
        const subtotal = normalizedLineItems.reduce(
          (sum: number, item: { amount: number }) => sum + item.amount,
          0
        );
        updates.push('line_items = ?');
        params.push(JSON.stringify(normalizedLineItems));
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

      updates.push('updated_at = CURRENT_TIMESTAMP');
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
            SET status = 'open', updated_at = CURRENT_TIMESTAMP
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
// CURRENT USER SUBSCRIPTION (convenience endpoint)
// ==========================================

/**
 * GET /billing/subscription
 * Get current subscription for the authenticated user's organization
 */
router.get(
  '/subscription',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        return res.json({ data: null });
      }

      const billing = await dbGet(
        `SELECT *
         FROM organization_billing
         WHERE organization_id = ?
         ORDER BY CASE WHEN subscription_plan_id IS NULL THEN 1 ELSE 0 END
         LIMIT 1`,
        [orgId]
      );
      if (!billing || !(billing as any).subscription_plan_id) {
        return res.json({ data: null });
      }

      const plan = await dbGet(
        `SELECT name, price_monthly, price_yearly
         FROM subscription_plans
         WHERE id = ?
         LIMIT 1`,
        [(billing as any).subscription_plan_id]
      );

      return res.json({
        data: {
          plan: (billing as any).subscription_plan_id,
          planName: (plan as any)?.name ?? null,
          status: (billing as any).status || 'trialing',
          billingRail: (billing as any).billing_rail || 'stripe_subscription',
          contractStatus: (billing as any).contract_status || null,
          renewalAt: (billing as any).renewal_at || null,
          graceUntil: (billing as any).grace_until || null,
          accessExpiresAt: (billing as any).access_expires_at || null,
          managedByUserId: (billing as any).managed_by_user_id || null,
          isManualBilling: Boolean((billing as any).is_manual_override),
          currentPeriodEnd: (billing as any).current_period_end,
          cancelAtPeriodEnd: (billing as any).status === 'canceling',
          priceMonthly: (plan as any)?.price_monthly ?? null,
        },
      });
    } catch (error: any) {
      logger.error('[Billing] Subscription fetch error:', error);
      return res.json({ data: null });
    }
  })
);

/**
 * GET /billing/usage
 * Get current usage for the authenticated user's organization
 */
router.get(
  '/usage',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const empty = {
      usage: [] as unknown[],
      structuredUsage: {} as Record<string, unknown>,
      totals: [] as unknown[],
      data: null as unknown,
    };
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        return res.json(empty);
      }

      let accessPolicyService: any = null;
      try {
        const mod = await import('../../services/accessPolicyService.js');
        accessPolicyService = mod.default || mod;
      } catch {
        // not available
      }

      if (accessPolicyService?.buildPolicySnapshot) {
        const snapshot = await accessPolicyService.buildPolicySnapshot(orgId);
        if (snapshot) {
          const data = {
            users: {
              used: Number(snapshot.usageToday.users ?? 0),
              limit: snapshot.limits?.maxUsers ?? -1,
            },
            projects: {
              used: Number(snapshot.usageToday.projects ?? 0),
              limit: snapshot.limits?.maxProjects ?? -1,
            },
            storage: {
              used: Number(snapshot.usageToday.storageMb ?? 0),
              limit: snapshot.limits?.maxStorageMb ?? -1,
              unit: 'MB',
            },
            aiTokens: {
              used: Number(snapshot.usageToday.tokensUsed ?? 0),
              limit: snapshot.limits?.maxTotalTokens ?? -1,
            },
          };
          return res.json({
            usage: [],
            structuredUsage: data,
            totals: [],
            data,
          });
        }
      }

      return res.json(empty);
    } catch (error: any) {
      logger.error('[Billing] Usage fetch error:', error);
      return res.json(empty);
    }
  })
);

// ==========================================
// SUBSCRIPTION ACTIONS (Stripe-backed)
// ==========================================

/**
 * POST /billing/subscribe
 * Subscribe current organization to a plan (Stripe is SSOT).
 */
router.post(
  '/subscribe',
  verifyToken,
  validateBody(SubscribeToPlanRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const userId = req.user!.id;
      const { planId, paymentMethodId } = req.body as {
        planId: string;
        paymentMethodId?: string;
      };

      const user = (await dbGet(`SELECT email FROM users WHERE id = ?`, [userId])) as {
        email: string;
      } | null;
      const org = (await dbGet(`SELECT name FROM organizations WHERE id = ?`, [orgId])) as {
        name: string;
      } | null;

      const email = user?.email;
      const orgName = org?.name || 'Organization';
      if (!email) {
        return res.status(400).json({ error: 'User email not found' });
      }

      let pmId = paymentMethodId;
      if (!pmId) {
        const pm = (await dbGet(
          `SELECT stripe_payment_method_id
           FROM payment_methods
           WHERE organization_id = ?
           ORDER BY is_default DESC, created_at DESC
           LIMIT 1`,
          [orgId]
        )) as { stripe_payment_method_id?: string } | null;
        pmId = pm?.stripe_payment_method_id;
      }

      if (!pmId) {
        return res.status(400).json({ error: 'Payment method is required' });
      }

      const BillingService = await import('../../services/BillingService.js');
      const subscription = await BillingService.createSubscription(
        orgId,
        planId,
        pmId,
        email,
        orgName
      );

      return res.json({ success: true, subscription });
    } catch (error: any) {
      logger.error('[Billing] Subscribe error', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to subscribe', code: 'BILLING_SUBSCRIBE_FAILED' });
    }
  })
);

/**
 * POST /billing/change-plan
 * Change current organization's plan (Stripe is SSOT).
 */
router.post(
  '/change-plan',
  verifyToken,
  validateBody(ChangePlanRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const { newPlanId } = req.body as { newPlanId: string };
      const BillingService = await import('../../services/BillingService.js');
      const subscription = await BillingService.changePlan(orgId, newPlanId);
      return res.json({ success: true, subscription });
    } catch (error: any) {
      logger.error('[Billing] Change plan error', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to change plan', code: 'BILLING_CHANGE_PLAN_FAILED' });
    }
  })
);

/**
 * POST /billing/cancel
 * Cancel current organization's subscription (grace period when supported).
 */
router.post(
  '/cancel',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      const BillingService = await import('../../services/BillingService.js');
      const result = await BillingService.cancelSubscription(orgId);
      return res.json({ success: true, result });
    } catch (error: any) {
      logger.error('[Billing] Cancel subscription error', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Failed to cancel subscription',
        code: 'BILLING_CANCEL_SUBSCRIPTION_FAILED',
      });
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

      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

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
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

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
          updates.push('canceled_at = CURRENT_TIMESTAMP');
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

      updates.push('updated_at = CURRENT_TIMESTAMP');
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
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

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
                SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
          [id]
        );
      } else {
        await dbRun(
          `
                UPDATE subscriptions 
                SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP
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
      const billing = (await dbGet(
        `SELECT status, current_period_end
         FROM organization_billing
         WHERE organization_id = ?
         LIMIT 1`,
        [orgId]
      )) as { status?: string; current_period_end?: string | null } | null;
      if (!billing || billing.status !== 'canceling' || !billing.current_period_end) {
        return res.json({ isInGracePeriod: false, accessUntil: null, daysRemaining: null });
      }

      const accessUntil = new Date(billing.current_period_end);
      if (Number.isNaN(accessUntil.getTime())) {
        return res.json({ isInGracePeriod: false, accessUntil: null, daysRemaining: null });
      }

      const now = new Date();
      const daysRemaining = Math.max(
        0,
        Math.ceil((accessUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      return res.json({
        isInGracePeriod: true,
        accessUntil: accessUntil.toISOString(),
        daysRemaining,
      });
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
      const billing = (await dbGet(
        `SELECT status
         FROM organization_billing
         WHERE organization_id = ?
         LIMIT 1`,
        [orgId]
      )) as { status?: string } | null;

      if (!billing || billing.status !== 'canceling') {
        return res.status(400).json({ error: 'No subscription in cancellation period' });
      }

      await dbRun(
        `UPDATE organization_billing
         SET status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = ?`,
        [orgId]
      );

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

      // Stripe is SSOT; read canonical state from organization_billing.
      const billing = (await dbGet(
        `
                SELECT ob.subscription_plan_id, ob.status, ob.current_period_start, ob.current_period_end,
                       sp.name as plan_name, sp.price_monthly, sp.price_yearly,
                       sp.token_limit, sp.storage_limit_gb, sp.features, sp.limits
                FROM organization_billing ob
                LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
                WHERE ob.organization_id = ?
                LIMIT 1
            `,
        [orgId]
      )) as any;

      // Get usage info from organization
      const org = (await dbGet(
        `
                SELECT trial_tokens_used, trial_expires_at, plan
                FROM organizations WHERE id = ?
            `,
        [orgId]
      )) as any;

      if (!billing || !billing.subscription_plan_id) {
        // Fall back to policy snapshot (no UI hardcoded limits).
        let snapshot: any = null;
        try {
          const accessPolicyService = (await import('../../services/accessPolicyService.js'))
            .default;
          snapshot = await accessPolicyService.buildPolicySnapshot(orgId);
        } catch {
          // ignore
        }

        const tokenLimit = snapshot?.limits?.maxTotalTokens ?? null;
        const storageLimitMb = snapshot?.limits?.maxStorageMb ?? null;

        return res.json({
          billing: {
            subscription_plan_id: null,
            status: snapshot?.subscriptionStatus || 'inactive',
            current_period_end: null,
            trial_ends_at: snapshot?.trialExpiresAt || org?.trial_expires_at || null,
          },
          plan: {
            name: snapshot?.isTrial ? 'Trial' : org?.plan || 'Free',
            price_monthly: 0,
            token_limit: tokenLimit,
            storage_limit_gb: typeof storageLimitMb === 'number' ? storageLimitMb / 1024 : null,
            features: [],
          },
          usage: {
            tokensUsed: snapshot?.usageToday?.tokensUsed ?? org?.trial_tokens_used ?? 0,
            tokenLimit,
            storageUsed: snapshot?.usageToday?.storageMb ?? 0,
            storageLimit: typeof storageLimitMb === 'number' ? storageLimitMb / 1024 : null,
          },
        });
      }

      const planLimits = billing.limits ? JSON.parse(billing.limits) : {};
      const tokenLimit =
        typeof planLimits?.tokens === 'number' ? planLimits.tokens : billing.token_limit;
      const storageLimitGb =
        typeof planLimits?.storage_gb === 'number'
          ? planLimits.storage_gb
          : billing.storage_limit_gb;

      return res.json({
        billing: {
          subscription_plan_id: billing.subscription_plan_id,
          status: billing.status,
          current_period_end: billing.current_period_end,
          trial_ends_at: org?.trial_expires_at || null,
        },
        plan: {
          name: billing.plan_name,
          price_monthly: billing.price_monthly,
          token_limit: tokenLimit,
          storage_limit_gb: storageLimitGb,
          features: billing.features ? JSON.parse(billing.features) : [],
        },
        usage: {
          tokensUsed: org?.trial_tokens_used || 0,
          tokenLimit,
          storageUsed: 0,
          storageLimit: storageLimitGb,
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

      updates.push('updated_at = CURRENT_TIMESTAMP');
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

      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

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

      return res.json({
        creditNotes: (creditNotes as any[]).map((cn) => ({
          ...cn,
          subtotal: Number(cn.subtotal ?? 0),
          total: Number(cn.total ?? 0),
          amount_remaining: Number(cn.amount_remaining ?? 0),
          base_total: cn.base_total != null ? Number(cn.base_total) : undefined,
          tax_amount: cn.tax_amount != null ? Number(cn.tax_amount) : undefined,
        })),
      });
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
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', CURRENT_TIMESTAMP)`,
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
                WHERE created_at >= date_trunc('month', NOW())
            `)) as any;

      return res.json({
        stats: {
          totalCount: Number(stats?.total_count ?? 0),
          issuedCount: Number(stats?.issued_count ?? 0),
          appliedCount: Number(stats?.applied_count ?? 0),
          partiallyAppliedCount: Number(stats?.partially_applied_count ?? 0),
          refundedCount: Number(stats?.refunded_count ?? 0),
          voidedCount: Number(stats?.voided_count ?? 0),
          totalValue: Number(stats?.total_value ?? 0),
          totalApplied: Number(stats?.total_applied ?? 0),
          totalRefunded: Number(stats?.total_refunded ?? 0),
          totalRemaining: Number(stats?.total_remaining ?? 0),
          thisMonth: {
            count: Number(monthStats?.count ?? 0),
            value: Number(monthStats?.value ?? 0),
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
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
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
                    updated_at = CURRENT_TIMESTAMP
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
                    updated_at = CURRENT_TIMESTAMP
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
                    refunded_at = CURRENT_TIMESTAMP,
                    amount_remaining = 0,
                    updated_at = CURRENT_TIMESTAMP
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
                    voided_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
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
      return respondSchemaUnavailable(res, 'Stripe');
    }

    if (process.env.MOCK_BILLING === 'true') {
      return res.json({
        clientSecret: 'seti_mock_secret',
        id: 'seti_mock',
        mode: 'mock',
      });
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
      return respondSchemaUnavailable(res, 'Stripe setup intent');
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

      // Accept Stripe-ish id or demo-mode identifiers; never accept raw card number (PCI, DP-11)
      const paymentMethodId: string | undefined = (req.body as any)?.paymentMethodId;
      const expiryMonth: number | undefined = (req.body as any)?.expiryMonth;
      const expiryYear: number | undefined = (req.body as any)?.expiryYear;
      const cardholderName: string | undefined = (req.body as any)?.cardholderName;

      // last4 is cosmetic only (mock billing); derive from PM id suffix, never from raw card number
      const pmId = paymentMethodId || `pm_${id.slice(0, 8)}`;
      const last4 = pmId.slice(-4) || '0000';
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
        [id, orgId, pmId, brand, last4, expMonth, expYear, holder, isDefault]
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
  '/usage-records',
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
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

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
      // FIX (NOT-NULL sweep): usage_records.type/amount are NOT NULL with no DB
      // default (Postgres) — this endpoint only wrote the newer metric_name/quantity
      // pair, which 500s with 23502. Mirror into the legacy type/amount columns too.
      await dbRun(
        `
            INSERT INTO usage_records (
                id, organization_id, type, amount, metric_name, quantity, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          req.user!.organizationId,
          metricName,
          Math.round(Number(quantity) || 0),
          metricName,
          quantity,
          JSON.stringify(metadata || {}),
        ]
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
                notify_emails = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
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
            SET is_active = 1 - is_active, updated_at = CURRENT_TIMESTAMP
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
          isActive: flagOn(record.token_threshold_80),
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
      return res.json({
        rates: (rates as any[]).map((r) => ({
          ...r,
          is_active: Boolean(r.is_active),
          automatic_tax: Boolean(r.automatic_tax),
          inclusive: Boolean(r.inclusive),
          percentage: Number(r.percentage),
        })),
      });
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
      return res.json({
        rates: (rates as any[]).map((r) => ({
          ...r,
          is_active: Boolean(r.is_active),
          automatic_tax: Boolean(r.automatic_tax),
          inclusive: Boolean(r.inclusive),
          percentage: Number(r.percentage),
        })),
      });
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
        'SELECT * FROM vat_validations WHERE vat_number = ? AND country_code = ? AND expires_at > CURRENT_TIMESTAMP',
        [vatNumber, countryCode],
        { fallback: false }
      )) as any;

      if (cached && String(cached.validation_source || '').toLowerCase() !== 'demo') {
        return res.json({
          validation: {
            // is_valid is bigint on Postgres → node-pg returns "1"/"0" as STRINGS;
            // `!!"0"` is true, which would report an INVALID cached VAT as valid.
            // Coerce numerically.
            isValid: Number(cached.is_valid) === 1,
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
      const {
        display_name,
        displayName,
        jurisdiction,
        percentage,
        tax_type,
        taxType,
        country,
        region,
      } = req.body;
      const resolvedDisplayName = display_name || displayName;
      const resolvedTaxType = tax_type || taxType;
      const id = uuidv4();
      await dbRun(
        `INSERT INTO tax_rates (id, display_name, jurisdiction, percentage, tax_type, country, region, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          resolvedDisplayName,
          jurisdiction,
          percentage,
          resolvedTaxType || 'vat',
          country,
          region || null,
        ]
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
      const {
        display_name,
        displayName,
        jurisdiction,
        percentage,
        tax_type,
        taxType,
        country,
        region,
      } = req.body;
      const resolvedDisplayName = display_name || displayName;
      const resolvedTaxType = tax_type || taxType;
      const id = uuidv4();
      await dbRun(
        `INSERT INTO tax_rates (id, display_name, jurisdiction, percentage, tax_type, country, region, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          resolvedDisplayName,
          jurisdiction,
          percentage,
          resolvedTaxType || 'vat',
          country,
          region || null,
        ]
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
      const {
        display_name,
        displayName,
        jurisdiction,
        percentage,
        tax_type,
        taxType,
        country,
        region,
        isActive,
      } = req.body;
      const resolvedDisplayName = display_name || displayName;
      const resolvedTaxType = tax_type || taxType;
      await dbRun(
        `UPDATE tax_rates SET 
                    display_name = COALESCE(?, display_name),
                    jurisdiction = COALESCE(?, jurisdiction),
                    percentage = COALESCE(?, percentage),
                    tax_type = COALESCE(?, tax_type),
                    country = COALESCE(?, country),
                    region = COALESCE(?, region),
                    is_active = COALESCE(?, is_active),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
        [
          resolvedDisplayName,
          jurisdiction,
          percentage,
          resolvedTaxType,
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
      await dbRun(
        'UPDATE tax_rates SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
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
      if (template.is_system && !req.user?.isSuperAdmin) {
        return res.status(403).json({ error: 'Cannot modify system templates' });
      }
      if (
        template.organization_id &&
        template.organization_id !== orgId &&
        !req.user?.isSuperAdmin
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
                    updated_at = CURRENT_TIMESTAMP
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
      if (flagOn(template.is_system)) {
        return res.status(403).json({ error: 'Cannot delete system templates' });
      }
      if (template.organization_id !== orgId && !req.user?.isSuperAdmin) {
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
          emailThreshold: flagOn(alerts?.token_threshold_80) ? 0.8 : null,
          costCapMonthly: alerts?.cost_cap_monthly || null,
          emailNotifications: flagOn(alerts?.email_notifications),
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
                        updated_at = CURRENT_TIMESTAMP`,
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
      if (!hasBillingAccess(req)) {
        return res.status(403).json({ error: 'Billing access required' });
      }
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
      if (!hasBillingAccess(req)) {
        return res.status(403).json({ error: 'Billing access required' });
      }
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
      if (!hasBillingAccess(req)) {
        return res.status(403).json({ error: 'Billing access required' });
      }
      const event = await BillingWebhookService.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Webhook event not found' });
        return;
      }
      const orgId =
        (req as unknown as { org?: { id: string } }).org?.id || req.user!.organizationId;
      if (
        (event as { organization_id: string }).organization_id !== orgId &&
        !req.user?.isSuperAdmin
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
                    approved_at = CURRENT_TIMESTAMP,
                    notes = COALESCE(?, notes),
                    updated_at = CURRENT_TIMESTAMP
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
                    updated_at = CURRENT_TIMESTAMP
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
                    recognized_at = CURRENT_TIMESTAMP,
                    recognized_by = ?,
                    updated_at = CURRENT_TIMESTAMP
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
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
                ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, 0, ?, CURRENT_TIMESTAMP)
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

// ==========================================
// USAGE PRICING TIERS — CRUD
// ==========================================

/**
 * GET /billing/usage-pricing-tiers
 * List all usage pricing tiers (optionally filter by active only)
 */
router.get(
  '/usage-pricing-tiers',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await dbAll(
        `SELECT id, name, unit, price_per_unit, currency, tier_type, min_quantity, max_quantity, is_active, created_at, updated_at
         FROM usage_pricing_tiers ORDER BY created_at ASC`,
        []
      );
      const tiers = (rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        unit: r.unit,
        pricePerUnit: r.price_per_unit,
        currency: r.currency,
        tierType: r.tier_type,
        minQuantity: r.min_quantity,
        maxQuantity: r.max_quantity,
        isActive: !!r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      return res.json({ tiers });
    } catch (error: any) {
      logger.error('[Billing] List usage pricing tiers error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Usage pricing tiers');
      }
      return res.status(500).json({ error: 'Failed to list usage pricing tiers' });
    }
  })
);

/**
 * GET /billing/usage-pricing-tiers/:id
 */
router.get(
  '/usage-pricing-tiers/:id',
  verifyToken,
  requireSuperAdmin,
  validateParams(UsagePricingTierIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const row: any = await dbGet(`SELECT * FROM usage_pricing_tiers WHERE id = ?`, [
        req.params.id,
      ]);
      if (!row) return res.status(404).json({ error: 'Tier not found' });
      return res.json({
        id: row.id,
        name: row.name,
        unit: row.unit,
        pricePerUnit: row.price_per_unit,
        currency: row.currency,
        tierType: row.tier_type,
        minQuantity: row.min_quantity,
        maxQuantity: row.max_quantity,
        isActive: !!row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (error: any) {
      logger.error('[Billing] Get usage pricing tier error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Usage pricing tier');
      }
      return res.status(500).json({ error: 'Failed to get usage pricing tier' });
    }
  })
);

/**
 * POST /billing/usage-pricing-tiers
 */
router.post(
  '/usage-pricing-tiers',
  verifyToken,
  requireSuperAdmin,
  validateBody(CreateUsagePricingTierSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { name, unit, pricePerUnit, currency, tierType, minQuantity, maxQuantity, isActive } =
        req.body;
      const id = `upt-${uuidv4()}`;
      await dbRun(
        `INSERT INTO usage_pricing_tiers (id, name, unit, price_per_unit, currency, tier_type, min_quantity, max_quantity, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          name,
          unit,
          pricePerUnit,
          currency ?? 'USD',
          tierType ?? 'standard',
          minQuantity ?? 0,
          maxQuantity ?? null,
          isActive === false ? 0 : 1,
        ]
      );
      const row: any = await dbGet(`SELECT * FROM usage_pricing_tiers WHERE id = ?`, [id]);
      return res.status(201).json({
        id: row.id,
        name: row.name,
        unit: row.unit,
        pricePerUnit: row.price_per_unit,
        currency: row.currency,
        tierType: row.tier_type,
        minQuantity: row.min_quantity,
        maxQuantity: row.max_quantity,
        isActive: !!row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (error: any) {
      logger.error('[Billing] Create usage pricing tier error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Usage pricing tier');
      }
      return res.status(500).json({ error: 'Failed to create usage pricing tier' });
    }
  })
);

/**
 * PUT /billing/usage-pricing-tiers/:id
 */
router.put(
  '/usage-pricing-tiers/:id',
  verifyToken,
  requireSuperAdmin,
  validateParams(UsagePricingTierIdParamSchema),
  validateBody(UpdateUsagePricingTierSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const existing: any = await dbGet(`SELECT * FROM usage_pricing_tiers WHERE id = ?`, [
        req.params.id,
      ]);
      if (!existing) return res.status(404).json({ error: 'Tier not found' });

      const fields: string[] = [];
      const values: SQLParams = [];
      const fieldMap: Record<string, string> = {
        name: 'name',
        unit: 'unit',
        pricePerUnit: 'price_per_unit',
        currency: 'currency',
        tierType: 'tier_type',
        minQuantity: 'min_quantity',
        maxQuantity: 'max_quantity',
      };
      for (const [bodyKey, colName] of Object.entries(fieldMap)) {
        if (req.body[bodyKey] !== undefined) {
          fields.push(`${colName} = ?`);
          values.push(req.body[bodyKey]);
        }
      }
      if (req.body.isActive !== undefined) {
        fields.push('is_active = ?');
        values.push(req.body.isActive ? 1 : 0);
      }
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.params.id);

      await dbRun(`UPDATE usage_pricing_tiers SET ${fields.join(', ')} WHERE id = ?`, values);

      const row: any = await dbGet(`SELECT * FROM usage_pricing_tiers WHERE id = ?`, [
        req.params.id,
      ]);
      return res.json({
        id: row.id,
        name: row.name,
        unit: row.unit,
        pricePerUnit: row.price_per_unit,
        currency: row.currency,
        tierType: row.tier_type,
        minQuantity: row.min_quantity,
        maxQuantity: row.max_quantity,
        isActive: !!row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (error: any) {
      logger.error('[Billing] Update usage pricing tier error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Usage pricing tier');
      }
      return res.status(500).json({ error: 'Failed to update usage pricing tier' });
    }
  })
);

/**
 * DELETE /billing/usage-pricing-tiers/:id
 */
router.delete(
  '/usage-pricing-tiers/:id',
  verifyToken,
  requireSuperAdmin,
  validateParams(UsagePricingTierIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const existing: any = await dbGet(`SELECT * FROM usage_pricing_tiers WHERE id = ?`, [
        req.params.id,
      ]);
      if (!existing) return res.status(404).json({ error: 'Tier not found' });
      await dbRun(`DELETE FROM usage_pricing_tiers WHERE id = ?`, [req.params.id]);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Billing] Delete usage pricing tier error:', error);
      if (isSchemaMissingError(error)) {
        return respondSchemaUnavailable(res, 'Usage pricing tier');
      }
      return res.status(500).json({ error: 'Failed to delete usage pricing tier' });
    }
  })
);

export default router;
