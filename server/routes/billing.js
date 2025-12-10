/**
 * Billing Routes
 * API endpoints for subscription management, usage tracking, and invoices
 */

const express = require('express');
const router = express.Router();
const billingService = require('../services/billingService');
const usageService = require('../services/usageService');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

// ==========================================
// PUBLIC ROUTES (Authenticated Users)
// ==========================================

/**
 * GET /billing/plans
 * List all active subscription plans
 */
router.get('/plans', async (req, res) => {
    try {
        const plans = await billingService.getPlans();
        res.json(plans);
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});

/**
 * GET /billing/current
 * Get current organization's billing info and usage
 */
router.get('/current', async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const billing = await billingService.getOrganizationBilling(orgId);
        const usage = await usageService.getCurrentUsage(orgId);

        res.json({
            billing: billing || { status: 'no_subscription' },
            usage
        });
    } catch (error) {
        console.error('Get current billing error:', error);
        res.status(500).json({ error: 'Failed to fetch billing info' });
    }
});

/**
 * GET /billing/usage
 * Get current usage statistics
 */
router.get('/usage', async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const usage = await usageService.getCurrentUsage(orgId);
        res.json(usage);
    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});

/**
 * GET /billing/usage/history
 * Get usage history
 */
router.get('/usage/history', async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const history = await usageService.getUsageHistory(orgId);
        res.json(history);
    } catch (error) {
        console.error('Get usage history error:', error);
        res.status(500).json({ error: 'Failed to fetch usage history' });
    }
});

/**
 * GET /billing/invoices
 * Get invoice history for organization
 */
router.get('/invoices', async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const invoices = await billingService.getInvoices(orgId);
        res.json(invoices);
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// ==========================================
// ADMIN ROUTES (Organization Admins)
// ==========================================

/**
 * POST /billing/subscribe
 * Subscribe organization to a plan
 */
router.post('/subscribe', async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        const userRole = req.user?.role;

        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
        if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { planId, paymentMethodId } = req.body;
        if (!planId) return res.status(400).json({ error: 'Plan ID required' });

        const subscription = await billingService.createSubscription(
            orgId,
            planId,
            paymentMethodId,
            req.user.email,
            req.user.organization_name
        );

        res.json({ success: true, subscription });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: error.message || 'Subscription failed' });
    }
});

/**
 * POST /billing/change-plan
 * Change subscription plan
 */
router.post('/change-plan', async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        const userRole = req.user?.role;

        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
        if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { newPlanId } = req.body;
        if (!newPlanId) return res.status(400).json({ error: 'New plan ID required' });

        const result = await billingService.changePlan(orgId, newPlanId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Change plan error:', error);
        res.status(500).json({ error: error.message || 'Plan change failed' });
    }
});

/**
 * POST /billing/cancel
 * Cancel subscription at period end
 */
router.post('/cancel', async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        const userRole = req.user?.role;

        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
        if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await billingService.cancelSubscription(orgId);
        res.json({ success: true, status: result.status });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: error.message || 'Cancellation failed' });
    }
});

// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * GET /billing/admin/plans
 * Get all plans (including inactive)
 */
router.get('/admin/plans', verifySuperAdmin, async (req, res) => {
    try {
        const plans = await new Promise((resolve, reject) => {
            const db = require('../database');
            db.all('SELECT * FROM subscription_plans ORDER BY price_monthly ASC', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        res.json(plans);
    } catch (error) {
        console.error('Admin get plans error:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});

/**
 * POST /billing/admin/plans
 * Create a new subscription plan
 */
router.post('/admin/plans', verifySuperAdmin, async (req, res) => {
    try {
        const plan = await billingService.createPlan(req.body);
        res.json({ success: true, plan });
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ error: error.message || 'Failed to create plan' });
    }
});

/**
 * PUT /billing/admin/plans/:id
 * Update subscription plan
 */
router.put('/admin/plans/:id', verifySuperAdmin, async (req, res) => {
    try {
        const result = await billingService.updatePlan(req.params.id, req.body);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({ error: error.message || 'Failed to update plan' });
    }
});

/**
 * DELETE /billing/admin/plans/:id
 * Deactivate subscription plan
 */
router.delete('/admin/plans/:id', verifySuperAdmin, async (req, res) => {
    try {
        await billingService.deletePlan(req.params.id);
        res.json({ success: true, message: 'Plan deactivated' });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({ error: error.message || 'Failed to deactivate plan' });
    }
});

/**
 * GET /billing/admin/revenue
 * Get revenue statistics
 */
router.get('/admin/revenue', verifySuperAdmin, async (req, res) => {
    try {
        const stats = await billingService.getRevenueStats();
        res.json(stats);
    } catch (error) {
        console.error('Get revenue stats error:', error);
        res.status(500).json({ error: 'Failed to fetch revenue stats' });
    }
});

/**
 * GET /billing/admin/usage
 * Get global usage statistics
 */
router.get('/admin/usage', verifySuperAdmin, async (req, res) => {
    try {
        const stats = await usageService.getGlobalUsageStats();
        res.json(stats);
    } catch (error) {
        console.error('Get global usage error:', error);
        res.status(500).json({ error: 'Failed to fetch global usage' });
    }
});

module.exports = router;
