/**
 * Billing Routes
 * API endpoints for billing management
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, requireSuperAdmin, verifyToken } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import BillingWebhookService, { BILLING_EVENT_TYPES } from '../services/BillingWebhookService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
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
} from '../validators/billing.validators.js';

const router = Router();

// Database helpers with proper typing
type SQLParam = string | number | boolean | null | undefined;
type SQLParams = SQLParam[];

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

      res.json({
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
      const queryParams = req.query as unknown as {
        status?: string;
        organizationId?: string;
        page?: string | number;
        pageSize?: string | number;
      };
      const { status, organizationId } = queryParams;
      const page = Number(queryParams.page) || 1;
      const pageSize = Number(queryParams.pageSize) || 20;
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

      res.json({
        invoices: invoices.map((inv) => ({
          ...inv,
          line_items: inv.line_items ? JSON.parse(inv.line_items) : [],
          metadata: inv.metadata ? JSON.parse(inv.metadata) : {},
        })),
        total: total?.total || 0,
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
      const idStr = Array.isArray(id) ? id[0] : id;
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

      let query = `
            SELECT i.*, o.name as organization_name
            FROM invoices i
            LEFT JOIN organizations o ON i.organization_id = o.id
            WHERE i.id = ?
        `;
      const params: SQLParams = [idStr];

      if (!isSuperAdmin) {
        query += ` AND i.organization_id = ?`;
        params.push(req.user!.organizationId);
      }

      interface InvoiceDetailRow {
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
      const invoice = await dbGet<InvoiceDetailRow>(query, params);

      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      res.json({
        invoice: {
          ...invoice,
          line_items: invoice.line_items ? JSON.parse(invoice.line_items as string) : [],
          metadata: invoice.metadata ? JSON.parse(invoice.metadata as string) : {},
        },
      });
    } catch (error: unknown) {
      logger.error('[Billing] Get invoice error:', error);
      return res.status(500).json({ error: 'Failed to get invoice' });
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

      res.json({ success: true, id, invoiceNumber });
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
        res.status(400).json({ error: 'No updates provided' });
        return;
      }

      updates.push('updated_at = datetime("now")');
      const idStr = Array.isArray(id) ? id[0] : id;
      params.push(idStr);

      await dbRun(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`, params);

      res.json({ success: true });
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

      res.json({ success: true, message: 'Invoice sent' });
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
      const queryParams = req.query as unknown as {
        status?: string;
        organizationId?: string;
        page?: string | number;
        pageSize?: string | number;
      };
      const { status, organizationId } = queryParams;
      const page = Number(queryParams.page) || 1;
      const pageSize = Number(queryParams.pageSize) || 20;
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

      res.json({
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
      const idStr = Array.isArray(id) ? id[0] : id;
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

      let query = `
            SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.price_yearly,
                   sp.features, sp.limits, o.name as organization_name
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            LEFT JOIN organizations o ON s.organization_id = o.id
            WHERE s.id = ?
        `;
      const params: SQLParams = [idStr];

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
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      res.json({
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
        res.status(400).json({ error: 'Organization already has an active subscription' });
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

      res.json({ success: true, id });
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
        res.status(400).json({ error: 'No updates provided' });
        return;
      }

      updates.push('updated_at = datetime("now")');
      const idStr = Array.isArray(id) ? id[0] : id;
      params.push(idStr);

      await dbRun(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`, params);

      res.json({ success: true });
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
      const idStr = Array.isArray(id) ? id[0] : id;
      const { immediately } = req.body;
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

      const subscription = (await dbGet(`SELECT * FROM subscriptions WHERE id = ?`, [idStr])) as {
        organization_id: string;
      } | null;
      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      if (!isSuperAdmin && subscription.organization_id !== req.user!.organizationId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (immediately) {
        await dbRun(
          `
                UPDATE subscriptions 
                SET status = 'canceled', canceled_at = datetime('now'), updated_at = datetime('now')
                WHERE id = ?
            `,
          [idStr]
        );
      } else {
        await dbRun(
          `
                UPDATE subscriptions 
                SET cancel_at_period_end = 1, updated_at = datetime('now')
                WHERE id = ?
            `,
          [idStr]
        );
      }

      res.json({
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

// ==========================================
// SUBSCRIPTION PLANS
// ==========================================

router.get(
  '/plans',
  verifyToken,
  validateQuery(ListPlansQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const queryParams = req.query as unknown as { includeInactive?: string | boolean };
      const includeInactive =
        queryParams.includeInactive === 'true' || queryParams.includeInactive === true;

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

      res.json({
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

      res.json({ success: true, id });
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
        res.status(400).json({ error: 'No updates provided' });
        return;
      }

      updates.push('updated_at = datetime("now")');
      const idStr = Array.isArray(id) ? id[0] : id;
      params.push(idStr);

      await dbRun(`UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`, params);

      res.json({ success: true });
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

      res.json({ creditNotes });
    } catch (error: unknown) {
      logger.error('[Billing] List credit notes error:', error);
      return res.status(500).json({ error: 'Failed to list credit notes' });
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
      const { organizationId, amount, reason, invoiceId } = req.body;

      const id = uuidv4();
      const noteNumber = `CN-${String(Date.now()).slice(-8)}`;

      await dbRun(
        `
            INSERT INTO credit_notes (
                id, organization_id, invoice_id, note_number, amount, reason, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'issued')
        `,
        [id, organizationId, invoiceId, noteNumber, amount, reason]
      );

      res.json({ success: true, id, noteNumber });
    } catch (error: unknown) {
      logger.error('[Billing] Create credit note error:', error);
      return res.status(500).json({ error: 'Failed to create credit note' });
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

      const usage = await dbAll(query, params);

      const org = (await dbGet(
        `
            SELECT token_balance, plan, trial_tokens_used
            FROM organizations 
            WHERE id = ?
        `,
        [orgId]
      )) as {
        token_balance?: number;
        plan?: string;
        trial_tokens_used?: number;
      } | null;

      const seats = (await dbGet(
        `
            SELECT COUNT(*) as used, (SELECT COUNT(id) FROM organization_members WHERE organization_id = ?) as total
            FROM organization_members 
            WHERE organization_id = ? AND status = 'ACTIVE'
        `,
        [orgId, orgId]
      )) as {
        used?: number;
        total?: number;
      } | null;

      const structuredUsage = {
        tokens: {
          used: org?.trial_tokens_used || 0,
          limit: 1000000,
        },
        storage: {
          used_gb: 1.2,
          limit_gb: 10,
        },
        seats: {
          used: seats?.used || 0,
          total: 10,
        },
        spend: {
          current_period: 45.5,
          budget: 100,
        },
      };

      interface UsageTotalRow {
        metric_name: string;
        total: number;
      }
      const totals = await dbAll<UsageTotalRow>(
        `SELECT metric_name, SUM(quantity) as total FROM usage_records WHERE organization_id = ? GROUP BY metric_name`,
        [orgId]
      );

      res.json({ usage, structuredUsage, totals });
    } catch (error: unknown) {
      logger.error('[Billing] Get usage error:', error);
      return res.status(500).json({ error: 'Failed to get usage' });
    }
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

      res.json({ success: true, id });
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

      res.json(
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

      res.json({ success: true, id });
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

      res.json({ success: true });
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

      res.json({ success: true });
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

      res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Billing] Delete spending alert error:', error);
      return res.status(500).json({ error: 'Failed to delete spending alert' });
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
      res.json(addons);
    } catch (error: unknown) {
      logger.error('[Billing] Get addons error:', error);
      return res.status(500).json({ error: 'Failed to get add-ons' });
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
      res.json({ events });
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
      res.json({ stats });
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
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;
      const event = await BillingWebhookService.getEventById(idStr);
      if (!event) {
        res.status(404).json({ error: 'Webhook event not found' });
        return;
      }
      const orgId =
        (req as unknown as { org?: { id: string } }).org?.id || req.user!.organizationId;
      if (
        (event as { organization_id: string }).organization_id !== orgId &&
        !req.user?.isSuperAdmin
      ) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }
      res.json({ event });
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
    res.json({ eventTypes: BILLING_EVENT_TYPES });
  })
);

router.post(
  '/admin/webhook-events/:id/retry',
  verifyToken,
  requireSuperAdmin,
  validateParams(InvoiceIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;
      const event = await BillingWebhookService.getEventById(idStr);
      if (!event) {
        res.status(404).json({ error: 'Webhook event not found' });
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
      const payloadData = (webhookEvent.payload as any)?.data as
        | { object?: Record<string, unknown> }
        | undefined;
      const payload = (payloadData?.object || webhookEvent.payload) as
        | Record<string, unknown>
        | undefined;
      const result = await BillingWebhookService.triggerEvent(
        webhookEvent.organization_id,
        webhookEvent.event_type,
        payload
      );

      res.json({ success: true, result });
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
      res.json({ events: failedEvents });
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
      res.json({ events: pendingEvents });
    } catch (error: unknown) {
      logger.error('[Billing Admin] Get pending webhook events error:', error);
      return res.status(500).json({ error: 'Failed to get pending webhook events' });
    }
  })
);

export default router;
