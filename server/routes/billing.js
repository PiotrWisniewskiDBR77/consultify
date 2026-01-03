/**
 * Billing Routes
 * 
 * API endpoints for billing management:
 * - Invoices CRUD
 * - Subscriptions management
 * - Credit notes
 * - Usage tracking
 * - Billing stats
 */

import express from 'express';
const router = express.Router();
import authMiddleware from '../middleware/authMiddleware.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Billing access middleware - allows admins and billing managers
const requireBillingAccess = (req, res, next) => {
    const allowedRoles = ['super_admin', 'admin', 'billing_manager', 'owner'];
    if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Billing access required' });
    }
    next();
};

// Database helpers
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// ==========================================
// BILLING STATS (SuperAdmin)
// ==========================================

/**
 * GET /api/billing/stats
 * Get billing overview statistics
 */
router.get('/stats', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString();

        // MRR calculation
        const mrrResult = await dbGet(`
            SELECT 
                SUM(CASE WHEN s.billing_cycle = 'monthly' THEN sp.price_monthly ELSE sp.price_yearly / 12 END) as mrr
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            WHERE s.status = 'active'
        `);

        // Revenue in period
        const revenueResult = await dbGet(`
            SELECT 
                SUM(amount_paid) as total_revenue,
                COUNT(*) as invoice_count
            FROM invoices
            WHERE status = 'paid' AND paid_at >= ?
        `, [startDate]);

        // Active subscriptions by plan
        const subscriptionsByPlan = await dbAll(`
            SELECT 
                sp.name as plan_name,
                sp.price_monthly,
                COUNT(s.id) as subscriber_count
            FROM subscription_plans sp
            LEFT JOIN subscriptions s ON sp.id = s.plan_id AND s.status = 'active'
            GROUP BY sp.id
            ORDER BY sp.sort_order
        `);

        // Subscription trends
        const trends = await dbAll(`
            SELECT 
                DATE(created_at) as date,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as new_subscriptions,
                COUNT(CASE WHEN status = 'canceled' THEN 1 END) as churned
            FROM subscriptions
            WHERE created_at >= ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [startDate]);

        // Unpaid invoices
        const unpaidResult = await dbGet(`
            SELECT 
                COUNT(*) as count,
                SUM(amount_due) as total_amount
            FROM invoices
            WHERE status IN ('open', 'past_due')
        `);

        res.json({
            mrr: mrrResult?.mrr || 0,
            arr: (mrrResult?.mrr || 0) * 12,
            revenue: {
                total: revenueResult?.total_revenue || 0,
                invoiceCount: revenueResult?.invoice_count || 0,
                period: parseInt(period)
            },
            subscriptions: {
                byPlan: subscriptionsByPlan,
                trends
            },
            unpaidInvoices: {
                count: unpaidResult?.count || 0,
                totalAmount: unpaidResult?.total_amount || 0
            }
        });
    } catch (error) {
        console.error('[Billing] Stats error:', error);
        res.status(500).json({ error: 'Failed to get billing stats' });
    }
});

// ==========================================
// INVOICES
// ==========================================

/**
 * GET /api/billing/invoices
 * List invoices with filters
 */
router.get('/invoices', authMiddleware, async (req, res) => {
    try {
        const { status, organizationId, page = 1, pageSize = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        let query = `
            SELECT i.*, o.name as organization_name
            FROM invoices i
            LEFT JOIN organizations o ON i.organization_id = o.id
            WHERE 1=1
        `;
        const params = [];

        if (!isSuperAdmin) {
            query += ` AND i.organization_id = ?`;
            params.push(req.user.organizationId);
        } else if (organizationId) {
            query += ` AND i.organization_id = ?`;
            params.push(organizationId);
        }

        if (status) {
            query += ` AND i.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), offset);

        const invoices = await dbAll(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM invoices WHERE 1=1`;
        const countParams = [];
        if (!isSuperAdmin) {
            countQuery += ` AND organization_id = ?`;
            countParams.push(req.user.organizationId);
        } else if (organizationId) {
            countQuery += ` AND organization_id = ?`;
            countParams.push(organizationId);
        }
        if (status) {
            countQuery += ` AND status = ?`;
            countParams.push(status);
        }
        const total = await dbGet(countQuery, countParams);

        res.json({
            invoices: invoices.map(inv => ({
                ...inv,
                line_items: inv.line_items ? JSON.parse(inv.line_items) : [],
                metadata: inv.metadata ? JSON.parse(inv.metadata) : {}
            })),
            total: total?.total || 0,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });
    } catch (error) {
        console.error('[Billing] List invoices error:', error);
        res.status(500).json({ error: 'Failed to list invoices' });
    }
});

/**
 * GET /api/billing/invoices/:id
 * Get invoice details
 */
router.get('/invoices/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        let query = `
            SELECT i.*, o.name as organization_name
            FROM invoices i
            LEFT JOIN organizations o ON i.organization_id = o.id
            WHERE i.id = ?
        `;
        const params = [id];

        if (!isSuperAdmin) {
            query += ` AND i.organization_id = ?`;
            params.push(req.user.organizationId);
        }

        const invoice = await dbGet(query, params);

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({
            invoice: {
                ...invoice,
                line_items: invoice.line_items ? JSON.parse(invoice.line_items) : [],
                metadata: invoice.metadata ? JSON.parse(invoice.metadata) : {}
            }
        });
    } catch (error) {
        console.error('[Billing] Get invoice error:', error);
        res.status(500).json({ error: 'Failed to get invoice' });
    }
});

/**
 * POST /api/billing/invoices
 * Create new invoice
 */
router.post('/invoices', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const {
            organizationId,
            lineItems,
            currency = 'USD',
            dueDate,
            metadata
        } = req.body;

        if (!organizationId || !lineItems?.length) {
            return res.status(400).json({ error: 'Organization ID and line items required' });
        }

        // Calculate totals
        const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxAmount = 0; // Can be extended with tax calculations
        const total = subtotal + taxAmount;

        // Generate invoice number
        const count = await dbGet(`SELECT COUNT(*) as count FROM invoices`);
        const invoiceNumber = `INV-${String((count?.count || 0) + 1).padStart(6, '0')}`;

        const id = uuidv4();
        await dbRun(`
            INSERT INTO invoices (
                id, organization_id, invoice_number, status, currency,
                subtotal, tax_amount, total, amount_due, due_date,
                line_items, metadata
            ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, organizationId, invoiceNumber, currency,
            subtotal, taxAmount, total, total, dueDate,
            JSON.stringify(lineItems), JSON.stringify(metadata || {})
        ]);

        res.json({ success: true, id, invoiceNumber });
    } catch (error) {
        console.error('[Billing] Create invoice error:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

/**
 * PUT /api/billing/invoices/:id
 * Update invoice
 */
router.put('/invoices/:id', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, lineItems, dueDate, metadata } = req.body;

        const updates = [];
        const params = [];

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
            const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
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
        }

        updates.push('updated_at = datetime("now")');
        params.push(id);

        await dbRun(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`, params);

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Update invoice error:', error);
        res.status(500).json({ error: 'Failed to update invoice' });
    }
});

/**
 * POST /api/billing/invoices/:id/send
 * Send invoice to customer
 */
router.post('/invoices/:id/send', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Update status to 'open' and record send time
        await dbRun(`
            UPDATE invoices 
            SET status = 'open', updated_at = datetime('now')
            WHERE id = ? AND status = 'draft'
        `, [id]);

        // TODO: Integrate with email service to actually send the invoice

        res.json({ success: true, message: 'Invoice sent' });
    } catch (error) {
        console.error('[Billing] Send invoice error:', error);
        res.status(500).json({ error: 'Failed to send invoice' });
    }
});

// ==========================================
// SUBSCRIPTIONS
// ==========================================

/**
 * GET /api/billing/subscriptions
 * List subscriptions
 */
router.get('/subscriptions', authMiddleware, async (req, res) => {
    try {
        const { status, organizationId, page = 1, pageSize = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        let query = `
            SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.price_yearly,
                   o.name as organization_name
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            LEFT JOIN organizations o ON s.organization_id = o.id
            WHERE 1=1
        `;
        const params = [];

        if (!isSuperAdmin) {
            query += ` AND s.organization_id = ?`;
            params.push(req.user.organizationId);
        } else if (organizationId) {
            query += ` AND s.organization_id = ?`;
            params.push(organizationId);
        }

        if (status) {
            query += ` AND s.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), offset);

        const subscriptions = await dbAll(query, params);

        res.json({
            subscriptions: subscriptions.map(sub => ({
                ...sub,
                metadata: sub.metadata ? JSON.parse(sub.metadata) : {}
            }))
        });
    } catch (error) {
        console.error('[Billing] List subscriptions error:', error);
        res.status(500).json({ error: 'Failed to list subscriptions' });
    }
});

/**
 * GET /api/billing/subscriptions/:id
 * Get subscription details
 */
router.get('/subscriptions/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        let query = `
            SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.price_yearly,
                   sp.features, sp.limits, o.name as organization_name
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            LEFT JOIN organizations o ON s.organization_id = o.id
            WHERE s.id = ?
        `;
        const params = [id];

        if (!isSuperAdmin) {
            query += ` AND s.organization_id = ?`;
            params.push(req.user.organizationId);
        }

        const subscription = await dbGet(query, params);

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        res.json({
            subscription: {
                ...subscription,
                metadata: subscription.metadata ? JSON.parse(subscription.metadata) : {},
                features: subscription.features ? JSON.parse(subscription.features) : [],
                limits: subscription.limits ? JSON.parse(subscription.limits) : {}
            }
        });
    } catch (error) {
        console.error('[Billing] Get subscription error:', error);
        res.status(500).json({ error: 'Failed to get subscription' });
    }
});

/**
 * POST /api/billing/subscriptions
 * Create new subscription
 */
router.post('/subscriptions', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const {
            organizationId,
            planId,
            billingCycle = 'monthly',
            trialDays = 0
        } = req.body;

        if (!organizationId || !planId) {
            return res.status(400).json({ error: 'Organization ID and Plan ID required' });
        }

        // Check for existing active subscription
        const existing = await dbGet(`
            SELECT id FROM subscriptions 
            WHERE organization_id = ? AND status IN ('active', 'trialing')
        `, [organizationId]);

        if (existing) {
            return res.status(400).json({ error: 'Organization already has an active subscription' });
        }

        const id = uuidv4();
        const now = new Date();
        const periodStart = now.toISOString();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // +30 days

        let status = 'active';
        let trialStart = null;
        let trialEnd = null;

        if (trialDays > 0) {
            status = 'trialing';
            trialStart = periodStart;
            trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
        }

        await dbRun(`
            INSERT INTO subscriptions (
                id, organization_id, plan_id, status, billing_cycle,
                current_period_start, current_period_end,
                trial_start, trial_end
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, organizationId, planId, status, billingCycle, periodStart, periodEnd, trialStart, trialEnd]);

        res.json({ success: true, id });
    } catch (error) {
        console.error('[Billing] Create subscription error:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

/**
 * PUT /api/billing/subscriptions/:id
 * Update subscription (change plan, cancel, etc.)
 */
router.put('/subscriptions/:id', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, planId, billingCycle, cancelAtPeriodEnd } = req.body;

        const updates = [];
        const params = [];

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
        }

        updates.push('updated_at = datetime("now")');
        params.push(id);

        await dbRun(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`, params);

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Update subscription error:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

/**
 * POST /api/billing/subscriptions/:id/cancel
 * Cancel subscription
 */
router.post('/subscriptions/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { immediately = false } = req.body;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        // Verify ownership
        const subscription = await dbGet(`SELECT * FROM subscriptions WHERE id = ?`, [id]);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        if (!isSuperAdmin && subscription.organization_id !== req.user.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (immediately) {
            await dbRun(`
                UPDATE subscriptions 
                SET status = 'canceled', canceled_at = datetime('now'), updated_at = datetime('now')
                WHERE id = ?
            `, [id]);
        } else {
            await dbRun(`
                UPDATE subscriptions 
                SET cancel_at_period_end = 1, updated_at = datetime('now')
                WHERE id = ?
            `, [id]);
        }

        res.json({ success: true, message: immediately ? 'Subscription canceled' : 'Subscription will be canceled at period end' });
    } catch (error) {
        console.error('[Billing] Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

// ==========================================
// SUBSCRIPTION PLANS
// ==========================================

/**
 * GET /api/billing/plans
 * List subscription plans
 */
router.get('/plans', authMiddleware, async (req, res) => {
    try {
        const { includeInactive = 'false' } = req.query;

        let query = `SELECT * FROM subscription_plans WHERE 1=1`;
        if (includeInactive !== 'true') {
            query += ` AND is_active = 1`;
        }
        query += ` ORDER BY sort_order ASC`;

        const plans = await dbAll(query);

        res.json({
            plans: plans.map(plan => ({
                ...plan,
                features: plan.features ? JSON.parse(plan.features) : [],
                limits: plan.limits ? JSON.parse(plan.limits) : {}
            }))
        });
    } catch (error) {
        console.error('[Billing] List plans error:', error);
        res.status(500).json({ error: 'Failed to list plans' });
    }
});

/**
 * POST /api/billing/plans
 * Create subscription plan (SuperAdmin only)
 */
router.post('/plans', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const {
            name, description, priceMonthly, priceYearly,
            currency = 'USD', features = [], limits = {},
            trialDays = 0, isPublic = true, sortOrder = 0
        } = req.body;

        if (!name || priceMonthly === undefined) {
            return res.status(400).json({ error: 'Name and monthly price required' });
        }

        const id = uuidv4();
        await dbRun(`
            INSERT INTO subscription_plans (
                id, name, description, price_monthly, price_yearly, currency,
                features, limits, trial_days, is_public, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, name, description, priceMonthly, priceYearly, currency,
            JSON.stringify(features), JSON.stringify(limits),
            trialDays, isPublic ? 1 : 0, sortOrder
        ]);

        res.json({ success: true, id });
    } catch (error) {
        console.error('[Billing] Create plan error:', error);
        res.status(500).json({ error: 'Failed to create plan' });
    }
});

/**
 * PUT /api/billing/plans/:id
 * Update subscription plan
 */
router.put('/plans/:id', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = [];
        const params = [];

        const fields = ['name', 'description', 'price_monthly', 'price_yearly', 'currency',
            'trial_days', 'is_public', 'is_active', 'sort_order'];

        for (const field of fields) {
            const key = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); // Convert to camelCase
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

        await dbRun(`UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`, params);

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Update plan error:', error);
        res.status(500).json({ error: 'Failed to update plan' });
    }
});

// ==========================================
// CREDIT NOTES
// ==========================================

/**
 * GET /api/billing/credit-notes
 * List credit notes
 */
router.get('/credit-notes', authMiddleware, async (req, res) => {
    try {
        const { organizationId, page = 1, pageSize = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        let query = `
            SELECT cn.*, o.name as organization_name
            FROM credit_notes cn
            LEFT JOIN organizations o ON cn.organization_id = o.id
            WHERE 1=1
        `;
        const params = [];

        if (!isSuperAdmin) {
            query += ` AND cn.organization_id = ?`;
            params.push(req.user.organizationId);
        } else if (organizationId) {
            query += ` AND cn.organization_id = ?`;
            params.push(organizationId);
        }

        query += ` ORDER BY cn.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), offset);

        const creditNotes = await dbAll(query, params);

        res.json({ creditNotes });
    } catch (error) {
        console.error('[Billing] List credit notes error:', error);
        res.status(500).json({ error: 'Failed to list credit notes' });
    }
});

/**
 * POST /api/billing/credit-notes
 * Create credit note
 */
router.post('/credit-notes', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { organizationId, amount, reason, invoiceId } = req.body;

        if (!organizationId || !amount) {
            return res.status(400).json({ error: 'Organization ID and amount required' });
        }

        const id = uuidv4();
        const noteNumber = `CN-${String(Date.now()).slice(-8)}`;

        await dbRun(`
            INSERT INTO credit_notes (
                id, organization_id, invoice_id, note_number, amount, reason, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'issued')
        `, [id, organizationId, invoiceId, noteNumber, amount, reason]);

        res.json({ success: true, id, noteNumber });
    } catch (error) {
        console.error('[Billing] Create credit note error:', error);
        res.status(500).json({ error: 'Failed to create credit note' });
    }
});

// ==========================================
// USAGE TRACKING
// ==========================================

/**
 * GET /api/billing/usage
 * Get usage records for organization
 */
router.get('/usage', authMiddleware, async (req, res) => {
    try {
        const { organizationId, metric, startDate, endDate } = req.query;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        const orgId = isSuperAdmin && organizationId ? organizationId : req.user.organizationId;

        let query = `
            SELECT metric_name, SUM(quantity) as total, 
                   DATE(recorded_at) as date
            FROM usage_records
            WHERE organization_id = ?
        `;
        const params = [orgId];

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

        // Get structured usage for SpendingAlertsView and AdminBillingManagement
        const org = await dbGet(`
            SELECT token_balance, plan, trial_tokens_used
            FROM organizations 
            WHERE id = ?
        `, [orgId]);

        const seats = await dbGet(`
            SELECT COUNT(*) as used, (SELECT COUNT(id) FROM organization_members WHERE organization_id = ?) as total
            FROM organization_members 
            WHERE organization_id = ? AND status = 'ACTIVE'
        `, [orgId, orgId]);

        // Mocking some limits for now if not defined in plan
        const structuredUsage = {
            tokens: {
                used: org?.trial_tokens_used || 0,
                limit: 1000000 // Default 1M for demo
            },
            storage: {
                used_gb: 1.2,
                limit_gb: 10
            },
            seats: {
                used: seats?.used || 0,
                total: 10 // Default 10 seats for demo
            },
            spend: {
                current_period: 45.50,
                budget: 100
            }
        };

        const totals = await dbAll(`SELECT metric_name, SUM(quantity) as total FROM usage_records WHERE organization_id = ? GROUP BY metric_name`, [orgId]);

        res.json({ usage, structuredUsage, totals });
    } catch (error) {
        console.error('[Billing] Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage' });
    }
});

/**
 * POST /api/billing/usage
 * Record usage
 */
router.post('/usage', authMiddleware, async (req, res) => {
    try {
        const { metricName, quantity = 1, metadata } = req.body;

        if (!metricName) {
            return res.status(400).json({ error: 'Metric name required' });
        }

        const id = uuidv4();
        await dbRun(`
            INSERT INTO usage_records (
                id, organization_id, metric_name, quantity, metadata
            ) VALUES (?, ?, ?, ?, ?)
        `, [id, req.user.organizationId, metricName, quantity, JSON.stringify(metadata || {})]);

        res.json({ success: true, id });
    } catch (error) {
        console.error('[Billing] Record usage error:', error);
        res.status(500).json({ error: 'Failed to record usage' });
    }
});

// ==========================================
// SPENDING ALERTS
// ==========================================

/**
 * GET /api/billing/spending-alerts
 * Get spending alerts for organization
 */
router.get('/spending-alerts', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const alerts = await dbAll(`SELECT * FROM spending_alerts WHERE organization_id = ?`, [orgId]);

        res.json(alerts.map(a => ({
            ...a,
            notifyEmails: JSON.parse(a.notify_emails || '[]'),
            thresholdType: a.threshold_type,
            isActive: !!a.is_active,
            lastTriggeredAt: a.last_triggered_at
        })));
    } catch (error) {
        console.error('[Billing] Get spending alerts error:', error);
        res.status(500).json({ error: 'Failed to get spending alerts' });
    }
});

/**
 * POST /api/billing/spending-alerts
 * Create spending alert
 */
router.post('/spending-alerts', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { type, threshold, thresholdType, action, notifyEmails, isActive = true } = req.body;

        const id = uuidv4();
        await dbRun(`
            INSERT INTO spending_alerts (
                id, organization_id, type, threshold, threshold_type, action, notify_emails, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, orgId, type, threshold, thresholdType, action, JSON.stringify(notifyEmails || []), isActive ? 1 : 0]);

        res.json({ success: true, id });
    } catch (error) {
        console.error('[Billing] Create spending alert error:', error);
        res.status(500).json({ error: 'Failed to create spending alert' });
    }
});

/**
 * PUT /api/billing/spending-alerts/:id
 * Update spending alert
 */
router.put('/spending-alerts/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organizationId;
        const { type, threshold, thresholdType, action, notifyEmails, isActive } = req.body;

        await dbRun(`
            UPDATE spending_alerts SET
                type = ?, threshold = ?, threshold_type = ?, action = ?, 
                notify_emails = ?, is_active = ?, updated_at = datetime('now')
            WHERE id = ? AND organization_id = ?
        `, [type, threshold, thresholdType, action, JSON.stringify(notifyEmails || []), isActive ? 1 : 0, id, orgId]);

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Update spending alert error:', error);
        res.status(500).json({ error: 'Failed to update spending alert' });
    }
});

/**
 * POST /api/billing/spending-alerts/:id/toggle
 * Toggle spending alert
 */
router.post('/spending-alerts/:id/toggle', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organizationId;

        await dbRun(`
            UPDATE spending_alerts 
            SET is_active = 1 - is_active, updated_at = datetime('now')
            WHERE id = ? AND organization_id = ?
        `, [id, orgId]);

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Toggle spending alert error:', error);
        res.status(500).json({ error: 'Failed to toggle spending alert' });
    }
});

/**
 * DELETE /api/billing/spending-alerts/:id
 * Delete spending alert
 */
router.delete('/spending-alerts/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organizationId;

        await dbRun(`DELETE FROM spending_alerts WHERE id = ? AND organization_id = ?`, [id, orgId]);

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Delete spending alert error:', error);
        res.status(500).json({ error: 'Failed to delete spending alert' });
    }
});

// ==========================================
// ADD-ONS
// ==========================================

/**
 * GET /api/billing/addons
 * List available add-ons
 */
router.get('/addons', authMiddleware, async (req, res) => {
    try {
        const sql = `SELECT * FROM billing_addons WHERE is_active = 1`;
        const addons = await dbAll(sql, []);
        res.json(addons);
    } catch (error) {
        console.error('[Billing] Get addons error:', error);
        res.status(500).json({ error: 'Failed to get add-ons' });
    }
});

// ==========================================
// BILLING WEBHOOK EVENTS ROUTES
// ==========================================
const billingWebhookService = import('billingWebhookService.js');
const { BILLING_EVENT_TYPES } = billingWebhookService;

/**
 * GET /api/billing/webhook-events
 * Get recent billing webhook events for the organization
 */
router.get('/webhook-events', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const limit = parseInt(req.query.limit) || 100;
        const events = await billingWebhookService.getRecentEvents(orgId, limit);
        res.json({ events });
    } catch (error) {
        console.error('[Billing] Get webhook events error:', error);
        res.status(500).json({ error: 'Failed to get webhook events' });
    }
});

/**
 * GET /api/billing/webhook-events/stats
 * Get webhook event statistics for the organization
 */
router.get('/webhook-events/stats', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const period = req.query.period || '30 days';
        const stats = await billingWebhookService.getEventStats(orgId, period);
        res.json({ stats });
    } catch (error) {
        console.error('[Billing] Get webhook event stats error:', error);
        res.status(500).json({ error: 'Failed to get webhook event statistics' });
    }
});

/**
 * GET /api/billing/webhook-events/:id
 * Get a specific webhook event
 */
router.get('/webhook-events/:id', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const event = await billingWebhookService.getEventById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Webhook event not found' });
        }
        // Verify organization access
        const orgId = req.org?.id || req.user.organizationId;
        if (event.organization_id !== orgId && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Permission denied' });
        }
        res.json({ event });
    } catch (error) {
        console.error('[Billing] Get webhook event error:', error);
        res.status(500).json({ error: 'Failed to get webhook event' });
    }
});

/**
 * GET /api/billing/webhook-events/types
 * Get available billing event types
 */
router.get('/webhook-event-types', authMiddleware, (req, res) => {
    res.json({ eventTypes: BILLING_EVENT_TYPES });
});

/**
 * POST /api/billing/admin/webhook-events/retry (SuperAdmin only)
 * Retry a failed webhook event
 */
router.post('/admin/webhook-events/:id/retry', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const event = await billingWebhookService.getEventById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Webhook event not found' });
        }

        // Re-trigger the event
        const result = await billingWebhookService.triggerEvent(
            event.organization_id,
            event.event_type,
            event.payload?.data?.object || event.payload
        );

        res.json({ success: true, result });
    } catch (error) {
        console.error('[Billing Admin] Retry webhook event error:', error);
        res.status(500).json({ error: 'Failed to retry webhook event' });
    }
});

/**
 * GET /api/billing/admin/webhook-events/failed (SuperAdmin only)
 * Get all failed webhook events for manual review
 */
router.get('/admin/webhook-events/failed', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const failedEvents = await billingWebhookService.getFailedEvents(limit);
        res.json({ events: failedEvents });
    } catch (error) {
        console.error('[Billing Admin] Get failed webhook events error:', error);
        res.status(500).json({ error: 'Failed to get failed webhook events' });
    }
});

/**
 * GET /api/billing/admin/webhook-events/pending (SuperAdmin only)
 * Get pending webhook events for processing
 */
router.get('/admin/webhook-events/pending', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const pendingEvents = await billingWebhookService.getPendingRetries(limit);
        res.json({ events: pendingEvents });
    } catch (error) {
        console.error('[Billing Admin] Get pending webhook events error:', error);
        res.status(500).json({ error: 'Failed to get pending webhook events' });
    }
});

export default router;
