const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireOrgAccess } = require('../middleware/rbac');
const InvoiceService = require('../services/invoiceService');
const CurrencyService = require('../services/currencyService');
const billingService = require('../services/billingService');

/**
 * GET /api/billing/invoices
 * Get invoices for organization
 */
router.get('/invoices', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { status, limit, offset } = req.query;

        const invoices = await InvoiceService.getInvoices(orgId, {
            status,
            limit: parseInt(limit) || 20,
            offset: parseInt(offset) || 0
        });

        res.json({ invoices });
    } catch (error) {
        console.error('[Billing] Get invoices error:', error);
        res.status(500).json({ error: 'Failed to get invoices' });
    }
});

/**
 * GET /api/billing/invoices/:id
 * Get single invoice details
 */
router.get('/invoices/:id', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const invoice = await InvoiceService.getInvoice(req.params.id);

        if (!invoice || invoice.organization_id !== (req.org?.id || req.user.organizationId)) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({ invoice });
    } catch (error) {
        console.error('[Billing] Get invoice error:', error);
        res.status(500).json({ error: 'Failed to get invoice' });
    }
});

/**
 * POST /api/billing/invoices/:id/pay
 * Mark invoice as paid (manual action for testing/admin)
 */
router.post('/invoices/:id/pay', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const invoice = await InvoiceService.getInvoice(req.params.id);
        if (!invoice || invoice.organization_id !== (req.org?.id || req.user.organizationId)) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        await InvoiceService.markAsPaid(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Pay invoice error:', error);
        res.status(500).json({ error: 'Failed to pay invoice' });
    }
});

/**
 * GET /api/billing/currencies
 * Get supported currencies
 */
router.get('/currencies', async (req, res) => {
    try {
        const currencies = await CurrencyService.getSupportedCurrencies();
        res.json({ currencies });
    } catch (error) {
        console.error('[Billing] Get currencies error:', error);
        res.status(500).json({ error: 'Failed to get currencies' });
    }
});

/**
 * GET /api/billing/usage
 * Get usage statistics for current organization
 */
router.get('/usage', authMiddleware, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        
        // Return mock usage data for now
        res.json({
            currentPeriod: {
                start: new Date(new Date().setDate(1)).toISOString(),
                end: new Date().toISOString()
            },
            ai: {
                tokensUsed: 0,
                tokensLimit: 100000,
                requestsCount: 0
            },
            storage: {
                used: 0,
                limit: 5368709120 // 5GB
            },
            users: {
                active: 1,
                limit: 5
            }
        });
    } catch (error) {
        console.error('[Billing] Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage data' });
    }
});

/**
 * GET /api/billing/exchange-rates
 * Get exchange rate for currency
 */
router.get('/exchange-rate', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'Missing currency codes' });

        const rate = await CurrencyService.getExchangeRate(from, to);
        res.json({ from, to, rate });
    } catch (error) {
        console.error('[Billing] Exchange rate error:', error);
        res.status(500).json({ error: 'Failed to get exchange rate' });
    }
});

// ==========================================
// PAYMENT METHODS
// ==========================================

/**
 * GET /api/billing/payment-methods
 * Get all payment methods for organization
 */
router.get('/payment-methods', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const paymentMethods = await billingService.getPaymentMethods(orgId);
        res.json({ paymentMethods });
    } catch (error) {
        console.error('[Billing] Get payment methods error:', error);
        res.status(500).json({ error: 'Failed to get payment methods' });
    }
});

/**
 * POST /api/billing/payment-methods
 * Add a new payment method
 */
router.post('/payment-methods', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { paymentMethodId } = req.body;

        if (!paymentMethodId) {
            return res.status(400).json({ error: 'Payment method ID is required' });
        }

        const paymentMethod = await billingService.addPaymentMethod(orgId, paymentMethodId);
        res.status(201).json({ paymentMethod });
    } catch (error) {
        console.error('[Billing] Add payment method error:', error);
        res.status(500).json({ error: error.message || 'Failed to add payment method' });
    }
});

/**
 * DELETE /api/billing/payment-methods/:id
 * Remove a payment method
 */
router.delete('/payment-methods/:id', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const result = await billingService.removePaymentMethod(req.params.id, orgId);
        
        if (!result.deleted) {
            return res.status(404).json({ error: 'Payment method not found' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('[Billing] Remove payment method error:', error);
        res.status(500).json({ error: error.message || 'Failed to remove payment method' });
    }
});

/**
 * PUT /api/billing/payment-methods/:id/default
 * Set payment method as default
 */
router.put('/payment-methods/:id/default', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const result = await billingService.setDefaultPaymentMethod(req.params.id, orgId);
        res.json({ paymentMethod: result });
    } catch (error) {
        console.error('[Billing] Set default payment method error:', error);
        res.status(500).json({ error: error.message || 'Failed to set default payment method' });
    }
});

/**
 * POST /api/billing/setup-intent
 * Create a Stripe SetupIntent for adding a new card
 */
router.post('/setup-intent', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const orgName = req.org?.name || 'Organization';
        const email = req.user.email;

        const setupIntent = await billingService.createSetupIntent(orgId, email, orgName);
        res.json(setupIntent);
    } catch (error) {
        console.error('[Billing] Create setup intent error:', error);
        res.status(500).json({ error: 'Failed to create setup intent' });
    }
});

// ==========================================
// BILLING ALERTS
// ==========================================

/**
 * GET /api/billing/alerts
 * Get billing alert configuration
 */
router.get('/alerts', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const alerts = await billingService.getBillingAlerts(orgId);
        res.json({ alerts });
    } catch (error) {
        console.error('[Billing] Get alerts error:', error);
        res.status(500).json({ error: 'Failed to get billing alerts' });
    }
});

/**
 * PUT /api/billing/alerts
 * Update billing alert configuration
 */
router.put('/alerts', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const alerts = await billingService.updateBillingAlerts(orgId, req.body);
        res.json({ alerts });
    } catch (error) {
        console.error('[Billing] Update alerts error:', error);
        res.status(500).json({ error: 'Failed to update billing alerts' });
    }
});

// ==========================================
// TAX SETTINGS
// ==========================================

/**
 * GET /api/billing/tax-settings
 * Get tax/VAT settings
 */
router.get('/tax-settings', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const taxSettings = await billingService.getTaxSettings(orgId);
        res.json({ taxSettings });
    } catch (error) {
        console.error('[Billing] Get tax settings error:', error);
        res.status(500).json({ error: 'Failed to get tax settings' });
    }
});

/**
 * PUT /api/billing/tax-settings
 * Update tax/VAT settings
 */
router.put('/tax-settings', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const taxSettings = await billingService.updateTaxSettings(orgId, req.body);
        res.json({ taxSettings });
    } catch (error) {
        console.error('[Billing] Update tax settings error:', error);
        res.status(500).json({ error: 'Failed to update tax settings' });
    }
});

// ==========================================
// DISCOUNT CODES
// ==========================================

/**
 * POST /api/billing/validate-discount
 * Validate a discount code
 */
router.post('/validate-discount', authMiddleware, async (req, res) => {
    try {
        const { code, planId } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Discount code is required' });
        }

        const result = await billingService.validateDiscountCode(code, planId);
        res.json(result);
    } catch (error) {
        console.error('[Billing] Validate discount error:', error);
        res.status(500).json({ error: 'Failed to validate discount code' });
    }
});

// ==========================================
// ADMIN BILLING ENDPOINTS (SuperAdmin only)
// ==========================================

const verifySuperAdmin = require('../middleware/superAdminMiddleware');
const db = require('../database');

/**
 * GET /api/billing/admin/revenue
 * Get global revenue statistics (SuperAdmin only)
 */
router.get('/admin/revenue', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        // Get subscription plans with their subscriber counts
        const planDistribution = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    sp.name,
                    sp.price_monthly,
                    COUNT(DISTINCT o.id) as count
                FROM subscription_plans sp
                LEFT JOIN organizations o ON o.plan = sp.name AND o.status = 'active'
                WHERE sp.is_active = 1
                GROUP BY sp.id, sp.name, sp.price_monthly
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Calculate MRR and ARR
        const mrr = planDistribution.reduce((sum, p) => sum + (p.price_monthly * p.count), 0);
        const arr = mrr * 12;
        const activeSubscriptions = planDistribution.reduce((sum, p) => sum + p.count, 0);

        res.json({
            mrr,
            arr,
            activeSubscriptions,
            planDistribution
        });
    } catch (error) {
        console.error('[Billing Admin] Get revenue error:', error);
        res.status(500).json({ error: 'Failed to get revenue stats' });
    }
});

/**
 * GET /api/billing/admin/usage
 * Get global usage statistics (SuperAdmin only)
 */
router.get('/admin/usage', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const usage = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COALESCE(SUM(al.input_tokens + al.output_tokens), 0) as totalTokensThisMonth,
                    COUNT(DISTINCT u.organization_id) as activeOrganizations
                FROM ai_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE al.created_at > datetime('now', 'start of month')
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row || { totalTokensThisMonth: 0, activeOrganizations: 0 });
            });
        });

        res.json({
            totalTokensThisMonth: usage.totalTokensThisMonth || 0,
            totalStorageGB: 0, // TODO: implement storage tracking
            activeOrganizations: usage.activeOrganizations || 0
        });
    } catch (error) {
        console.error('[Billing Admin] Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage stats' });
    }
});

/**
 * GET /api/billing/admin/costs
 * Get operational costs by provider (SuperAdmin only)
 */
router.get('/admin/costs', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let whereClause = "WHERE created_at > datetime('now', '-30 days')";
        if (startDate && endDate) {
            whereClause = `WHERE created_at BETWEEN '${startDate}' AND '${endDate}'`;
        }

        const costs = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    COALESCE(model, 'unknown') as provider,
                    model,
                    SUM(input_tokens + output_tokens) as totalTokens,
                    COUNT(*) as requestCount
                FROM ai_logs
                ${whereClause}
                GROUP BY model
                ORDER BY totalTokens DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Calculate estimated costs based on typical pricing
        const pricingPerMillion = {
            'gpt-4o': 5.0,
            'gpt-4o-mini': 0.15,
            'gpt-4-turbo': 10.0,
            'gpt-3.5-turbo': 0.5,
            'claude-3-opus': 15.0,
            'claude-3-sonnet': 3.0,
            'claude-3-haiku': 0.25,
            'default': 2.0
        };

        const items = costs.map(c => {
            const pricePerMillion = pricingPerMillion[c.model] || pricingPerMillion['default'];
            const cost = (c.totalTokens / 1000000) * pricePerMillion;
            return {
                provider: c.provider.split('-')[0] || 'openai',
                model: c.model,
                totalTokens: c.totalTokens || 0,
                requestCount: c.requestCount || 0,
                cost
            };
        });

        const totalCost = items.reduce((sum, i) => sum + i.cost, 0);

        res.json({
            costs: {
                items,
                totalCost
            }
        });
    } catch (error) {
        console.error('[Billing Admin] Get costs error:', error);
        res.status(500).json({ error: 'Failed to get operational costs' });
    }
});

/**
 * GET /api/billing/admin/plans
 * Get all subscription plans (SuperAdmin only)
 */
router.get('/admin/plans', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const plans = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM subscription_plans ORDER BY price_monthly ASC`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        res.json(plans);
    } catch (error) {
        console.error('[Billing Admin] Get plans error:', error);
        res.status(500).json({ error: 'Failed to get plans' });
    }
});

/**
 * POST /api/billing/admin/plans
 * Create a new subscription plan (SuperAdmin only)
 */
router.post('/admin/plans', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, features } = req.body;
        const id = `plan-${Date.now()}`;
        
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, features, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [id, name, price_monthly || 0, token_limit || 100000, storage_limit_gb || 5, token_overage_rate || 0.015, storage_overage_rate || 0.10, stripe_price_id, features || '{}'], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });
        
        res.status(201).json({ id, message: 'Plan created' });
    } catch (error) {
        console.error('[Billing Admin] Create plan error:', error);
        res.status(500).json({ error: 'Failed to create plan' });
    }
});

/**
 * PUT /api/billing/admin/plans/:id
 * Update a subscription plan (SuperAdmin only)
 */
router.put('/admin/plans/:id', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, features, is_active } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE subscription_plans SET 
                    name = COALESCE(?, name),
                    price_monthly = COALESCE(?, price_monthly),
                    token_limit = COALESCE(?, token_limit),
                    storage_limit_gb = COALESCE(?, storage_limit_gb),
                    token_overage_rate = COALESCE(?, token_overage_rate),
                    storage_overage_rate = COALESCE(?, storage_overage_rate),
                    stripe_price_id = COALESCE(?, stripe_price_id),
                    features = COALESCE(?, features),
                    is_active = COALESCE(?, is_active)
                WHERE id = ?
            `, [name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, features, is_active, req.params.id], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });
        
        res.json({ message: 'Plan updated' });
    } catch (error) {
        console.error('[Billing Admin] Update plan error:', error);
        res.status(500).json({ error: 'Failed to update plan' });
    }
});

/**
 * DELETE /api/billing/admin/plans/:id
 * Deactivate a subscription plan (SuperAdmin only)
 */
router.delete('/admin/plans/:id', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            db.run(`UPDATE subscription_plans SET is_active = 0 WHERE id = ?`, [req.params.id], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });
        res.json({ message: 'Plan deactivated' });
    } catch (error) {
        console.error('[Billing Admin] Delete plan error:', error);
        res.status(500).json({ error: 'Failed to delete plan' });
    }
});

/**
 * GET /api/billing/admin/user-plans
 * Get user license plans (SuperAdmin only)
 */
router.get('/admin/user-plans', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const plans = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM user_license_plans ORDER BY price_monthly ASC`, [], (err, rows) => {
                if (err) {
                    // If table doesn't exist, return empty array
                    if (err.message.includes('no such table')) {
                        resolve([]);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(rows || []);
                }
            });
        });
        res.json(plans);
    } catch (error) {
        console.error('[Billing Admin] Get user plans error:', error);
        res.json([]);
    }
});

/**
 * POST /api/billing/admin/user-plans
 * Create a user license plan (SuperAdmin only)
 */
router.post('/admin/user-plans', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { name, price_monthly, features } = req.body;
        const id = `ulp-${Date.now()}`;
        
        // First ensure table exists
        await new Promise((resolve) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS user_license_plans (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    price_monthly REAL DEFAULT 0,
                    features TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, [], () => resolve(null));
        });
        
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO user_license_plans (id, name, price_monthly, features, is_active)
                VALUES (?, ?, ?, ?, 1)
            `, [id, name, price_monthly || 0, features || '{}'], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });
        
        res.status(201).json({ id, message: 'User plan created' });
    } catch (error) {
        console.error('[Billing Admin] Create user plan error:', error);
        res.status(500).json({ error: 'Failed to create user plan' });
    }
});

/**
 * PUT /api/billing/admin/user-plans/:id
 * Update a user license plan (SuperAdmin only)
 */
router.put('/admin/user-plans/:id', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { name, price_monthly, features, is_active } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE user_license_plans SET 
                    name = COALESCE(?, name),
                    price_monthly = COALESCE(?, price_monthly),
                    features = COALESCE(?, features),
                    is_active = COALESCE(?, is_active)
                WHERE id = ?
            `, [name, price_monthly, features, is_active, req.params.id], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });
        
        res.json({ message: 'User plan updated' });
    } catch (error) {
        console.error('[Billing Admin] Update user plan error:', error);
        res.status(500).json({ error: 'Failed to update user plan' });
    }
});

/**
 * DELETE /api/billing/admin/user-plans/:id
 * Deactivate a user license plan (SuperAdmin only)
 */
router.delete('/admin/user-plans/:id', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            db.run(`UPDATE user_license_plans SET is_active = 0 WHERE id = ?`, [req.params.id], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });
        res.json({ message: 'User plan deactivated' });
    } catch (error) {
        console.error('[Billing Admin] Delete user plan error:', error);
        res.status(500).json({ error: 'Failed to delete user plan' });
    }
});

/**
 * GET /api/billing/admin/transactions
 * Get all token transactions (SuperAdmin only)
 */
router.get('/admin/transactions', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        
        const transactions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    tt.*,
                    o.name as organization_name
                FROM token_transactions tt
                LEFT JOIN organizations o ON tt.organization_id = o.id
                ORDER BY tt.created_at DESC
                LIMIT ?
            `, [parseInt(limit)], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json(transactions);
    } catch (error) {
        console.error('[Billing Admin] Get transactions error:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

module.exports = router;
