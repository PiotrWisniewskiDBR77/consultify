const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireOrgAccess } = require('../middleware/rbac');
const orgContextMiddleware = require('../middleware/orgContextMiddleware');
const InvoiceService = require('../services/invoiceService');
const CurrencyService = require('../services/currencyService');
const billingService = require('../services/billingService');
const seatManagementService = require('../services/seatManagementService');
const payAsYouGoService = require('../services/payAsYouGoService');

// Helper middleware for billing-specific org access
// Uses user's organizationId directly instead of orgContextMiddleware
const requireBillingAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const orgId = req.user.organizationId || req.user.organization_id;
    if (!orgId) {
        return res.status(400).json({ 
            error: 'No organization',
            message: 'User must belong to an organization to access billing'
        });
    }
    
    // Check role
    const userRole = (req.user.role || '').toUpperCase();
    if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
        return res.status(403).json({ 
            error: 'Permission denied',
            message: 'Billing access requires ADMIN or OWNER role'
        });
    }
    
    // Set org context for downstream handlers
    req.org = { id: orgId };
    next();
};

/**
 * GET /api/billing/invoices
 * Get invoices for organization
 */
router.get('/invoices', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.get('/invoices/:id', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.post('/invoices/:id/pay', authMiddleware, requireBillingAccess, async (req, res) => {
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
 * Get usage statistics for current organization (legacy endpoint)
 */
router.get('/usage', authMiddleware, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const UsageService = require('../services/usageService');
        const db = require('../database');
        
        // Get current period
        const periodStart = new Date(new Date().setDate(1));
        const periodEnd = new Date();
        
        // Get AI usage (tokens and requests)
        const aiUsage = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COALESCE(SUM(input_tokens + output_tokens), 0) as tokensUsed,
                    COUNT(*) as requestsCount
                FROM ai_logs 
                WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)
                AND created_at >= datetime('now', 'start of month')
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { tokensUsed: 0, requestsCount: 0 });
            });
        });
        
        // Get storage usage
        const storageUsage = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COALESCE(SUM(amount), 0) as used
                FROM usage_records 
                WHERE organization_id = ? 
                AND type = 'storage'
                AND created_at >= datetime('now', 'start of month')
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { used: 0 });
            });
        });
        
        // Get active users count
        const userCount = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as active
                FROM users 
                WHERE organization_id = ? AND status = 'active'
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { active: 0 });
            });
        });
        
        // Get plan limits
        const billing = await billingService.getOrganizationBilling(orgId);
        const plan = billing?.subscription_plan_id 
            ? await billingService.getPlanById(billing.subscription_plan_id)
            : null;
        
        const tokensLimit = plan?.tokens_included || 100000;
        const storageLimit = plan?.storage_gb_included ? plan.storage_gb_included * 1024 * 1024 * 1024 : 5368709120; // 5GB default
        const userLimit = plan?.seats || 5;
        
        res.json({
            currentPeriod: {
                start: periodStart.toISOString(),
                end: periodEnd.toISOString()
            },
            ai: {
                tokensUsed: aiUsage.tokensUsed || 0,
                tokensLimit: tokensLimit,
                requestsCount: aiUsage.requestsCount || 0
            },
            storage: {
                used: storageUsage.used || 0,
                limit: storageLimit
            },
            users: {
                active: userCount.active || 0,
                limit: userLimit
            }
        });
    } catch (error) {
        console.error('[Billing] Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage data' });
    }
});

/**
 * GET /api/billing/usage-summary
 * Get comprehensive usage dashboard data for organization
 * Aggregates data from ai_usage_log, ai_usage_quotas, and subscription_plans
 */
router.get('/usage-summary', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { days = 30 } = req.query;
        
        // Get current billing period
        const billing = await billingService.getOrganizationBilling(orgId);
        const now = new Date();
        const periodStart = billing?.current_period_start || new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = billing?.current_period_end || new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Get subscription plan limits
        const planLimits = await new Promise((resolve, reject) => {
            db.get(`
                SELECT sp.token_limit, sp.storage_limit_gb, sp.price_monthly,
                       ol.max_users
                FROM subscription_plans sp
                LEFT JOIN organization_billing ob ON sp.id = ob.subscription_plan_id
                LEFT JOIN organization_limits ol ON ol.organization_id = ob.organization_id
                WHERE ob.organization_id = ?
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { token_limit: 100000, storage_limit_gb: 5, max_users: 5, price_monthly: 0 });
            });
        });
        
        // Get AI usage quotas (current period usage)
        const quotas = await new Promise((resolve, reject) => {
            db.get(`
                SELECT tokens_used_month, monthly_token_limit
                FROM ai_usage_quotas
                WHERE entity_type = 'organization' AND entity_id = ?
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { tokens_used_month: 0, monthly_token_limit: planLimits.token_limit });
            });
        });
        
        // Get detailed AI usage from ai_usage_log for current period
        const aiUsageDetails = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
                    COALESCE(SUM(estimated_cost_usd), 0) as estimated_cost,
                    COUNT(*) as request_count,
                    COUNT(DISTINCT user_id) as active_users,
                    COUNT(DISTINCT project_id) as active_projects
                FROM ai_usage_log
                WHERE organization_id = ?
                AND created_at >= datetime('now', 'start of month')
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { total_tokens: 0, estimated_cost: 0, request_count: 0, active_users: 0, active_projects: 0 });
            });
        });
        
        // Get user count (seats)
        const userCount = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as count
                FROM users
                WHERE organization_id = ? AND status != 'deleted'
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            });
        });
        
        // Get storage usage (estimate from documents/attachments)
        const storageUsage = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COALESCE(SUM(file_size), 0) as total_bytes
                FROM documents
                WHERE organization_id = ?
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row?.total_bytes || 0);
            });
        });
        
        // Get usage breakdown by user
        const usageByUser = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    u.id,
                    u.first_name || ' ' || u.last_name as name,
                    u.email,
                    COALESCE(SUM(al.input_tokens + al.output_tokens), 0) as tokens,
                    COALESCE(SUM(al.estimated_cost_usd), 0) as cost,
                    COUNT(al.id) as requests
                FROM users u
                LEFT JOIN ai_usage_log al ON u.id = al.user_id 
                    AND al.created_at >= datetime('now', 'start of month')
                WHERE u.organization_id = ? AND u.status != 'deleted'
                GROUP BY u.id
                ORDER BY tokens DESC
                LIMIT 10
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Get usage breakdown by project
        const usageByProject = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    p.id,
                    p.name,
                    COALESCE(SUM(al.input_tokens + al.output_tokens), 0) as tokens,
                    COALESCE(SUM(al.estimated_cost_usd), 0) as cost,
                    COUNT(al.id) as requests
                FROM projects p
                LEFT JOIN ai_usage_log al ON p.id = al.project_id 
                    AND al.created_at >= datetime('now', 'start of month')
                WHERE p.organization_id = ?
                GROUP BY p.id
                ORDER BY tokens DESC
                LIMIT 10
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Get usage breakdown by feature/action
        const usageByFeature = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    COALESCE(action_type, 'unknown') as feature,
                    COALESCE(SUM(input_tokens + output_tokens), 0) as tokens,
                    COALESCE(SUM(estimated_cost_usd), 0) as cost,
                    COUNT(*) as requests
                FROM ai_usage_log
                WHERE organization_id = ?
                AND created_at >= datetime('now', 'start of month')
                GROUP BY action_type
                ORDER BY tokens DESC
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Get usage trend (daily for last N days)
        const usageTrend = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    date(created_at) as date,
                    COALESCE(SUM(input_tokens + output_tokens), 0) as tokens,
                    COALESCE(SUM(estimated_cost_usd), 0) as cost,
                    COUNT(*) as requests
                FROM ai_usage_log
                WHERE organization_id = ?
                AND created_at >= datetime('now', '-' || ? || ' days')
                GROUP BY date(created_at)
                ORDER BY date ASC
            `, [orgId, parseInt(days)], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Calculate percentages and projected usage
        const tokenLimit = quotas.monthly_token_limit || planLimits.token_limit || 100000;
        const tokensUsed = quotas.tokens_used_month || aiUsageDetails.total_tokens || 0;
        const tokenPercentage = tokenLimit > 0 ? Math.round((tokensUsed / tokenLimit) * 100) : 0;
        
        const storageLimit = (planLimits.storage_limit_gb || 5) * 1024 * 1024 * 1024; // Convert to bytes
        const storageUsed = storageUsage;
        const storagePercentage = storageLimit > 0 ? Math.round((storageUsed / storageLimit) * 100) : 0;
        
        const seatLimit = planLimits.max_users || 5;
        const seatsUsed = userCount;
        const seatPercentage = seatLimit > 0 ? Math.round((seatsUsed / seatLimit) * 100) : 0;
        
        // Calculate projected usage (linear extrapolation to end of period)
        const daysInPeriod = Math.ceil((new Date(periodEnd) - new Date(periodStart)) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil((now - new Date(periodStart)) / (1000 * 60 * 60 * 24));
        const dailyRate = daysElapsed > 0 ? tokensUsed / daysElapsed : 0;
        const projectedTokens = Math.round(dailyRate * daysInPeriod);
        const projectedCost = projectedTokens * (aiUsageDetails.estimated_cost / Math.max(tokensUsed, 1));
        
        // Calculate trend (compare to previous period)
        const previousPeriodUsage = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as tokens
                FROM ai_usage_log
                WHERE organization_id = ?
                AND created_at >= datetime('now', 'start of month', '-1 month')
                AND created_at < datetime('now', 'start of month')
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row?.tokens || 0);
            });
        });
        
        const tokenTrend = previousPeriodUsage > 0 
            ? Math.round(((tokensUsed - previousPeriodUsage) / previousPeriodUsage) * 100)
            : 0;
        
        res.json({
            currentPeriod: {
                start: periodStart,
                end: periodEnd,
                daysElapsed,
                daysRemaining: daysInPeriod - daysElapsed
            },
            tokens: {
                used: tokensUsed,
                limit: tokenLimit,
                percentage: tokenPercentage,
                trend: tokenTrend,
                requests: aiUsageDetails.request_count
            },
            storage: {
                used: storageUsed,
                usedFormatted: formatBytes(storageUsed),
                limit: storageLimit,
                limitFormatted: formatBytes(storageLimit),
                percentage: storagePercentage
            },
            seats: {
                used: seatsUsed,
                limit: seatLimit,
                percentage: seatPercentage
            },
            cost: {
                current: aiUsageDetails.estimated_cost || 0,
                projected: projectedCost || 0,
                planBase: planLimits.price_monthly || 0
            },
            breakdown: {
                byUser: usageByUser,
                byProject: usageByProject,
                byFeature: usageByFeature
            },
            trend: usageTrend,
            projectedUsage: projectedTokens
        });
    } catch (error) {
        console.error('[Billing] Get usage summary error:', error);
        res.status(500).json({ error: 'Failed to get usage summary' });
    }
});

// Helper function to format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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
// PLAN MANAGEMENT (for upgrade/downgrade flow)
// ==========================================

/**
 * GET /api/billing/plans
 * Get all available subscription plans for comparison
 */
router.get('/plans', authMiddleware, async (req, res) => {
    try {
        const plans = await billingService.getPlans();
        
        // Parse features JSON for each plan
        const formattedPlans = plans.map(plan => ({
            ...plan,
            features: plan.features ? JSON.parse(plan.features) : {}
        }));
        
        res.json({ plans: formattedPlans });
    } catch (error) {
        console.error('[Billing] Get plans error:', error);
        res.status(500).json({ error: 'Failed to get plans' });
    }
});

/**
 * GET /api/billing/current-plan
 * Get current organization's plan details
 */
router.get('/current-plan', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const billing = await billingService.getOrganizationBilling(orgId);
        
        if (!billing) {
            return res.json({ plan: null, message: 'No active subscription' });
        }
        
        res.json({
            plan: {
                id: billing.subscription_plan_id,
                name: billing.plan_name,
                price: billing.price_monthly,
                tokenLimit: billing.token_limit,
                storageLimit: billing.storage_limit_gb,
                status: billing.status,
                periodStart: billing.current_period_start,
                periodEnd: billing.current_period_end
            }
        });
    } catch (error) {
        console.error('[Billing] Get current plan error:', error);
        res.status(500).json({ error: 'Failed to get current plan' });
    }
});

/**
 * GET /api/billing/plan-comparison/:targetPlanId
 * Compare current plan with target plan, calculate proration
 */
router.get('/plan-comparison/:targetPlanId', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { targetPlanId } = req.params;
        
        const currentBilling = await billingService.getOrganizationBilling(orgId);
        const targetPlan = await billingService.getPlanById(targetPlanId);
        
        if (!targetPlan) {
            return res.status(404).json({ error: 'Target plan not found' });
        }
        
        // Calculate proration
        const now = new Date();
        const periodEnd = currentBilling?.current_period_end ? new Date(currentBilling.current_period_end) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysRemaining = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
        const daysInPeriod = 30; // Simplified
        
        const currentPrice = currentBilling?.price_monthly || 0;
        const targetPrice = targetPlan.price_monthly || 0;
        const priceDiff = targetPrice - currentPrice;
        const proratedAmount = Math.round((priceDiff * (daysRemaining / daysInPeriod)) * 100) / 100;
        
        const isUpgrade = targetPrice > currentPrice;
        const isDowngrade = targetPrice < currentPrice;
        
        res.json({
            currentPlan: currentBilling ? {
                id: currentBilling.subscription_plan_id,
                name: currentBilling.plan_name,
                price: currentPrice,
                tokenLimit: currentBilling.token_limit,
                storageLimit: currentBilling.storage_limit_gb
            } : null,
            targetPlan: {
                id: targetPlan.id,
                name: targetPlan.name,
                price: targetPrice,
                tokenLimit: targetPlan.token_limit,
                storageLimit: targetPlan.storage_limit_gb,
                features: targetPlan.features ? JSON.parse(targetPlan.features) : {}
            },
            comparison: {
                isUpgrade,
                isDowngrade,
                priceDifference: priceDiff,
                proratedAmount: isUpgrade ? proratedAmount : 0,
                creditAmount: isDowngrade ? Math.abs(proratedAmount) : 0,
                effectiveDate: isUpgrade ? 'immediate' : periodEnd.toISOString(),
                daysRemaining
            }
        });
    } catch (error) {
        console.error('[Billing] Plan comparison error:', error);
        res.status(500).json({ error: 'Failed to compare plans' });
    }
});

/**
 * POST /api/billing/change-plan
 * Upgrade or downgrade subscription plan
 */
router.post('/change-plan', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { planId, confirmProration } = req.body;
        
        if (!planId) {
            return res.status(400).json({ error: 'Plan ID is required' });
        }
        
        const result = await billingService.changePlan(orgId, planId);
        
        res.json({
            success: true,
            message: 'Plan changed successfully',
            newPlan: result.plan
        });
    } catch (error) {
        console.error('[Billing] Change plan error:', error);
        res.status(500).json({ error: error.message || 'Failed to change plan' });
    }
});

/**
 * GET /api/billing/addons
 * Get available add-ons (extra tokens, storage, seats)
 */
router.get('/addons', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        // Return available add-ons with pricing
        const addons = [
            {
                id: 'addon-tokens-50k',
                type: 'tokens',
                name: 'Extra 50,000 Tokens',
                description: 'One-time token package',
                amount: 50000,
                price: 5.00,
                currency: 'USD',
                recurring: false
            },
            {
                id: 'addon-tokens-200k',
                type: 'tokens',
                name: 'Extra 200,000 Tokens',
                description: 'One-time token package (best value)',
                amount: 200000,
                price: 15.00,
                currency: 'USD',
                recurring: false
            },
            {
                id: 'addon-storage-10gb',
                type: 'storage',
                name: 'Extra 10 GB Storage',
                description: 'Monthly storage add-on',
                amount: 10,
                price: 2.00,
                currency: 'USD',
                recurring: true
            },
            {
                id: 'addon-seats-5',
                type: 'seats',
                name: '5 Additional Seats',
                description: 'Monthly seat package',
                amount: 5,
                price: 50.00,
                currency: 'USD',
                recurring: true
            },
            {
                id: 'addon-seat-1',
                type: 'seats',
                name: '1 Additional Seat',
                description: 'Monthly per-seat pricing',
                amount: 1,
                price: 12.00,
                currency: 'USD',
                recurring: true
            }
        ];
        
        res.json({ addons });
    } catch (error) {
        console.error('[Billing] Get addons error:', error);
        res.status(500).json({ error: 'Failed to get addons' });
    }
});

/**
 * POST /api/billing/purchase-addon
 * Purchase an add-on
 */
router.post('/purchase-addon', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { addonId, quantity = 1, paymentMethodId } = req.body;
        
        if (!addonId) {
            return res.status(400).json({ error: 'Add-on ID is required' });
        }
        
        // In production, this would create a Stripe invoice
        // For now, we'll update the limits directly
        
        const addon = {
            'addon-tokens-50k': { type: 'tokens', amount: 50000, price: 5.00 },
            'addon-tokens-200k': { type: 'tokens', amount: 200000, price: 15.00 },
            'addon-storage-10gb': { type: 'storage', amount: 10, price: 2.00 },
            'addon-seats-5': { type: 'seats', amount: 5, price: 50.00 },
            'addon-seat-1': { type: 'seats', amount: 1, price: 12.00 }
        }[addonId];
        
        if (!addon) {
            return res.status(404).json({ error: 'Add-on not found' });
        }
        
        const totalAmount = addon.amount * quantity;
        const totalPrice = addon.price * quantity;
        
        // Update quotas/limits based on addon type
        if (addon.type === 'tokens') {
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE ai_usage_quotas 
                    SET monthly_token_limit = monthly_token_limit + ?
                    WHERE entity_type = 'organization' AND entity_id = ?
                `, [totalAmount, orgId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } else if (addon.type === 'seats') {
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE organization_limits 
                    SET max_users = max_users + ?
                    WHERE organization_id = ?
                `, [totalAmount, orgId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } else if (addon.type === 'storage') {
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE organization_limits 
                    SET max_storage_mb = max_storage_mb + ?
                    WHERE organization_id = ?
                `, [totalAmount * 1024, orgId], (err) => { // Convert GB to MB
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        
        // Log the purchase
        const { v4: uuidv4 } = require('uuid');
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO audit_events (id, org_id, user_id, event_type, resource_type, resource_id, details, created_at)
                VALUES (?, ?, ?, 'ADDON_PURCHASED', 'billing', ?, ?, datetime('now'))
            `, [uuidv4(), orgId, req.user.id, addonId, JSON.stringify({ addonId, quantity, totalAmount, totalPrice })], (err) => {
                if (err) console.warn('[Billing] Failed to log addon purchase:', err);
                resolve();
            });
        });
        
        res.json({
            success: true,
            message: `Successfully purchased ${totalAmount} ${addon.type}`,
            addon: {
                id: addonId,
                type: addon.type,
                amount: totalAmount,
                price: totalPrice
            }
        });
    } catch (error) {
        console.error('[Billing] Purchase addon error:', error);
        res.status(500).json({ error: 'Failed to purchase add-on' });
    }
});

// ==========================================
// BILLING SETTINGS (Tax, Notifications, Export)
// ==========================================

/**
 * GET /api/billing/settings
 * Get billing settings (tax info, contacts, notifications)
 */
router.get('/settings', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        
        // Get tax settings
        const taxSettings = await billingService.getTaxSettings(orgId);
        
        // Get notification preferences
        const notifications = await new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM billing_notification_preferences WHERE organization_id = ?
            `, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {
                    invoice_email: true,
                    payment_success: true,
                    payment_failed: true,
                    usage_warning: true,
                    renewal_reminder: true,
                    reminder_days_before: 7
                });
            });
        });
        
        // Get billing contacts
        const contacts = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM billing_contacts WHERE organization_id = ? ORDER BY is_primary DESC
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json({
            taxSettings,
            notifications,
            contacts
        });
    } catch (error) {
        console.error('[Billing] Get settings error:', error);
        res.status(500).json({ error: 'Failed to get billing settings' });
    }
});

/**
 * PUT /api/billing/settings
 * Update billing settings
 */
router.put('/settings', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { taxSettings, notifications, contacts } = req.body;
        
        // Update tax settings
        if (taxSettings) {
            await billingService.updateTaxSettings(orgId, taxSettings);
        }
        
        // Update notification preferences
        if (notifications) {
            const id = `notif-${require('uuid').v4()}`;
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO billing_notification_preferences 
                    (id, organization_id, invoice_email, payment_success, payment_failed, usage_warning, renewal_reminder, reminder_days_before)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(organization_id) DO UPDATE SET
                    invoice_email = excluded.invoice_email,
                    payment_success = excluded.payment_success,
                    payment_failed = excluded.payment_failed,
                    usage_warning = excluded.usage_warning,
                    renewal_reminder = excluded.renewal_reminder,
                    reminder_days_before = excluded.reminder_days_before,
                    updated_at = CURRENT_TIMESTAMP
                `, [id, orgId, 
                    notifications.invoice_email ? 1 : 0,
                    notifications.payment_success ? 1 : 0,
                    notifications.payment_failed ? 1 : 0,
                    notifications.usage_warning ? 1 : 0,
                    notifications.renewal_reminder ? 1 : 0,
                    notifications.reminder_days_before || 7
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        
        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        console.error('[Billing] Update settings error:', error);
        res.status(500).json({ error: 'Failed to update billing settings' });
    }
});

/**
 * GET /api/billing/export
 * Export billing data (invoices, transactions)
 */
router.get('/export', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { format = 'json', type = 'invoices', year } = req.query;
        
        let data = [];
        
        if (type === 'invoices') {
            data = await new Promise((resolve, reject) => {
                let query = `SELECT * FROM invoices WHERE organization_id = ?`;
                const params = [orgId];
                
                if (year) {
                    query += ` AND strftime('%Y', created_at) = ?`;
                    params.push(year);
                }
                
                query += ` ORDER BY created_at DESC`;
                
                db.all(query, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
        } else if (type === 'usage') {
            data = await new Promise((resolve, reject) => {
                let query = `
                    SELECT date(created_at) as date, 
                           SUM(input_tokens + output_tokens) as tokens,
                           SUM(estimated_cost_usd) as cost,
                           COUNT(*) as requests
                    FROM ai_usage_log 
                    WHERE organization_id = ?
                `;
                const params = [orgId];
                
                if (year) {
                    query += ` AND strftime('%Y', created_at) = ?`;
                    params.push(year);
                }
                
                query += ` GROUP BY date(created_at) ORDER BY date DESC`;
                
                db.all(query, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
        }
        
        if (format === 'csv') {
            // Convert to CSV
            if (data.length === 0) {
                return res.send('');
            }
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(row => Object.values(row).join(',')).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=billing-${type}-${Date.now()}.csv`);
            res.send(`${headers}\n${rows}`);
        } else {
            res.json({ data });
        }
    } catch (error) {
        console.error('[Billing] Export error:', error);
        res.status(500).json({ error: 'Failed to export billing data' });
    }
});

// ==========================================
// PAYMENT METHODS
// ==========================================

/**
 * GET /api/billing/payment-methods
 * Get all payment methods for organization
 */
router.get('/payment-methods', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.post('/payment-methods', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.delete('/payment-methods/:id', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.put('/payment-methods/:id/default', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.post('/setup-intent', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.get('/alerts', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.put('/alerts', authMiddleware, requireBillingAccess, async (req, res) => {
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
// SPENDING ALERTS (User-configurable alerts)
// ==========================================

const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/billing/spending-alerts
 * Get all spending alerts for organization
 */
router.get('/spending-alerts', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const alerts = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM spending_alerts WHERE organization_id = ? ORDER BY created_at DESC`,
                [orgId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Transform to frontend format
        const formattedAlerts = alerts.map(a => ({
            id: a.id,
            organizationId: a.organization_id,
            type: a.type,
            threshold: a.threshold,
            thresholdType: a.threshold_type,
            action: a.action,
            notifyEmails: JSON.parse(a.notify_emails || '[]'),
            isActive: Boolean(a.is_active),
            createdAt: a.created_at
        }));

        res.json(formattedAlerts);
    } catch (error) {
        console.error('[Billing] Get spending alerts error:', error);
        res.status(500).json({ error: 'Failed to get spending alerts' });
    }
});

/**
 * POST /api/billing/spending-alerts
 * Create a new spending alert
 */
router.post('/spending-alerts', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const { type, threshold, thresholdType, action, notifyEmails, isActive = true } = req.body;

        if (!type || threshold === undefined || !thresholdType || !action) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const alertId = uuidv4();
        const notifyEmailsJson = JSON.stringify(notifyEmails || []);

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO spending_alerts (id, organization_id, type, threshold, threshold_type, action, notify_emails, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [alertId, orgId, type, threshold, thresholdType, action, notifyEmailsJson, isActive ? 1 : 0],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.status(201).json({
            id: alertId,
            organizationId: orgId,
            type,
            threshold,
            thresholdType,
            action,
            notifyEmails: notifyEmails || [],
            isActive,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Billing] Create spending alert error:', error);
        res.status(500).json({ error: 'Failed to create spending alert' });
    }
});

/**
 * PUT /api/billing/spending-alerts/:id
 * Update a spending alert
 */
router.put('/spending-alerts/:id', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { id } = req.params;
        const { type, threshold, thresholdType, action, notifyEmails, isActive } = req.body;

        // Verify ownership
        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM spending_alerts WHERE id = ? AND organization_id = ?', [id, orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!existing) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        const notifyEmailsJson = notifyEmails ? JSON.stringify(notifyEmails) : existing.notify_emails;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE spending_alerts SET
                    type = COALESCE(?, type),
                    threshold = COALESCE(?, threshold),
                    threshold_type = COALESCE(?, threshold_type),
                    action = COALESCE(?, action),
                    notify_emails = ?,
                    is_active = COALESCE(?, is_active),
                    updated_at = datetime('now')
                 WHERE id = ?`,
                [type, threshold, thresholdType, action, notifyEmailsJson, isActive !== undefined ? (isActive ? 1 : 0) : null, id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Update spending alert error:', error);
        res.status(500).json({ error: 'Failed to update spending alert' });
    }
});

/**
 * POST /api/billing/spending-alerts/:id/toggle
 * Toggle alert active status
 */
router.post('/spending-alerts/:id/toggle', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE spending_alerts SET is_active = NOT is_active, updated_at = datetime('now')
                 WHERE id = ? AND organization_id = ?`,
                [id, orgId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Toggle spending alert error:', error);
        res.status(500).json({ error: 'Failed to toggle spending alert' });
    }
});

/**
 * DELETE /api/billing/spending-alerts/:id
 * Delete a spending alert
 */
router.delete('/spending-alerts/:id', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM spending_alerts WHERE id = ? AND organization_id = ?`,
                [id, orgId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Delete spending alert error:', error);
        res.status(500).json({ error: 'Failed to delete spending alert' });
    }
});

// ==========================================
// TAX SETTINGS
// ==========================================

/**
 * GET /api/billing/tax-settings
 * Get tax/VAT settings
 */
router.get('/tax-settings', authMiddleware, requireBillingAccess, async (req, res) => {
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
router.put('/tax-settings', authMiddleware, requireBillingAccess, async (req, res) => {
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
 * GET /api/billing/user-plans
 * Get user license plans (ADMIN/OWNER access for display)
 * This is a read-only endpoint for displaying license options
 */
router.get('/user-plans', authMiddleware, async (req, res) => {
    try {
        // Allow ADMIN and OWNER to view plans (for UI purposes)
        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(req.user?.role)) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        
        const plans = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM user_license_plans WHERE is_active = 1 ORDER BY price_monthly ASC`, [], (err, rows) => {
                if (err) {
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
        console.error('[Billing] Get user plans error:', error);
        res.json([]); // Return empty array instead of error for display purposes
    }
});

/**
 * GET /api/billing/admin/user-plans
 * Get user license plans (SuperAdmin only - includes inactive)
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

// ============================================================
// SEAT MANAGEMENT ENDPOINTS
// ============================================================

/**
 * GET /api/billing/seats
 * Get seat availability for organization
 */
router.get('/seats', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        
        // Count current users
        const userCount = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND status != 'deleted'`,
                [orgId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                }
            );
        });

        // Get organization limits
        const limits = await new Promise((resolve, reject) => {
            db.get(
                `SELECT max_users FROM organization_limits WHERE organization_id = ?`,
                [orgId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // Get organization type (PAID orgs have unlimited seats)
        const org = await new Promise((resolve, reject) => {
            db.get(
                `SELECT organization_type FROM organizations WHERE id = ?`,
                [orgId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        const isPaid = org?.organization_type === 'PAID';
        const maxSeats = isPaid ? -1 : (limits?.max_users || 5);
        const seatsUsed = userCount;
        const seatsRemaining = isPaid ? -1 : Math.max(0, maxSeats - seatsUsed);

        // Get price per seat (from subscription plan or default)
        const seatPrice = 15; // Default $15/seat/month - would come from billing plan in production

        res.json({
            maxSeats,
            seatsUsed,
            seatsRemaining,
            canAddSeats: !isPaid, // Only non-PAID orgs can add seats (PAID already has unlimited)
            seatPrice,
            currency: 'USD',
            isPaidOrg: isPaid
        });
    } catch (error) {
        console.error('[Billing] Get seats error:', error);
        res.status(500).json({ error: 'Failed to get seat information' });
    }
});

/**
 * POST /api/billing/seats/add
 * Add additional seats to organization
 * This auto-expands the user limit for the organization
 */
router.post('/seats/add', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { quantity = 1 } = req.body;

        // Check user has admin rights
        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Permission denied',
                message: 'Only admins can add seats'
            });
        }

        if (!orgId) {
            return res.status(400).json({ 
                error: 'Missing organization',
                message: 'User must be assigned to an organization'
            });
        }

        if (quantity < 1 || quantity > 100) {
            return res.status(400).json({ error: 'Quantity must be between 1 and 100' });
        }

        // Get organization info
        const org = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, name, organization_type FROM organizations WHERE id = ?`,
                [orgId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // PAID orgs already have unlimited - no need to add
        if (org.organization_type === 'PAID') {
            return res.json({
                success: true,
                message: 'Your organization has unlimited seats',
                newMaxSeats: -1
            });
        }

        // Get current limits
        const limits = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM organization_limits WHERE organization_id = ?`,
                [orgId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        const currentMaxUsers = limits?.max_users || 5;
        const newMaxUsers = currentMaxUsers + quantity;

        // Price calculation
        const seatPrice = 15; // $15/seat/month
        const totalCost = seatPrice * quantity;

        // Update or insert limits
        if (limits) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE organization_limits SET max_users = ?, updated_at = datetime('now') WHERE organization_id = ?`,
                    [newMaxUsers, orgId],
                    function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        } else {
            // Create limits record if doesn't exist
            const { v4: uuidv4 } = require('uuid');
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO organization_limits (id, organization_id, max_users, max_projects, max_ai_calls_per_day, max_initiatives, max_storage_mb)
                     VALUES (?, ?, ?, 10, 100, 20, 500)`,
                    [uuidv4(), orgId, newMaxUsers],
                    function(err) {
                        if (err) reject(err);
                        else resolve({ lastID: this.lastID });
                    }
                );
            });
        }

        // Log the seat addition as an audit event
        const { v4: uuidv4 } = require('uuid');
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO audit_events (id, org_id, user_id, event_type, resource_type, resource_id, details, created_at)
                 VALUES (?, ?, ?, 'SEATS_ADDED', 'organization_limits', ?, ?, datetime('now'))`,
                [
                    uuidv4(),
                    orgId,
                    req.user.id,
                    orgId,
                    JSON.stringify({ quantity, previousMax: currentMaxUsers, newMax: newMaxUsers, cost: totalCost })
                ],
                function(err) {
                    if (err) {
                        console.warn('[Billing] Failed to log seat addition audit:', err);
                        // Non-fatal
                    }
                    resolve();
                }
            );
        });

        console.log(`[Billing] Added ${quantity} seat(s) to org ${orgId}. New max: ${newMaxUsers}`);

        res.json({
            success: true,
            message: `Successfully added ${quantity} seat(s)`,
            previousMaxSeats: currentMaxUsers,
            newMaxSeats: newMaxUsers,
            quantity,
            cost: totalCost,
            currency: 'USD'
        });
    } catch (error) {
        console.error('[Billing] Add seats error:', error);
        res.status(500).json({ error: 'Failed to add seats' });
    }
});

// ==========================================
// SEAT MANAGEMENT ROUTES
// ==========================================

/**
 * GET /api/billing/seats
 * Get seat configuration
 */
router.get('/seats', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const config = await seatManagementService.getSeatConfiguration(orgId);
        res.json({ config });
    } catch (error) {
        console.error('[Billing] Get seats error:', error);
        res.status(500).json({ error: 'Failed to get seat configuration' });
    }
});

/**
 * POST /api/billing/seats/purchase
 * Purchase additional seats
 */
router.post('/seats/purchase', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { quantity, paymentMethodId } = req.body;

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Invalid quantity' });
        }

        const result = await seatManagementService.purchaseSeats(orgId, quantity, paymentMethodId, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[Billing] Purchase seats error:', error);
        res.status(500).json({ error: error.message || 'Failed to purchase seats' });
    }
});

/**
 * PUT /api/billing/seats/auto-add
 * Toggle auto-add seats on invite
 */
router.put('/seats/auto-add', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { enabled, threshold } = req.body;

        const result = await seatManagementService.toggleAutoAddSeats(orgId, enabled, threshold || 80);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[Billing] Toggle auto-add error:', error);
        res.status(500).json({ error: 'Failed to update auto-add settings' });
    }
});

/**
 * GET /api/billing/seats/transactions
 * Get seat transaction history
 */
router.get('/seats/transactions', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const limit = parseInt(req.query.limit) || 50;
        const history = await seatManagementService.getSeatHistory(orgId, limit);
        res.json({ transactions: history });
    } catch (error) {
        console.error('[Billing] Get seat history error:', error);
        res.status(500).json({ error: 'Failed to get seat history' });
    }
});

/**
 * POST /api/billing/seats/release
 * Release a seat
 */
router.post('/seats/release', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const result = await seatManagementService.releaseSeat(orgId, userId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[Billing] Release seat error:', error);
        res.status(500).json({ error: error.message || 'Failed to release seat' });
    }
});

// ==========================================
// PAY-AS-YOU-GO ROUTES
// ==========================================

/**
 * GET /api/billing/payg/usage
 * Get current PAYG usage
 */
router.get('/payg/usage', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { periodStart, periodEnd } = req.query;

        const usage = await payAsYouGoService.getCurrentPeriodUsage(
            orgId,
            periodStart ? new Date(periodStart) : null,
            periodEnd ? new Date(periodEnd) : null
        );
        res.json({ usage });
    } catch (error) {
        console.error('[Billing] Get PAYG usage error:', error);
        res.status(500).json({ error: 'Failed to get PAYG usage' });
    }
});

/**
 * GET /api/billing/payg/forecast
 * Get PAYG cost forecast
 */
router.get('/payg/forecast', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const forecast = await payAsYouGoService.getPayAsYouGoForecast(orgId);
        res.json({ forecast });
    } catch (error) {
        console.error('[Billing] Get PAYG forecast error:', error);
        res.status(500).json({ error: 'Failed to get PAYG forecast' });
    }
});

/**
 * POST /api/billing/payg/invoice
 * Generate PAYG invoice
 */
router.post('/payg/invoice', authMiddleware, requireBillingAccess, async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { periodStart, periodEnd } = req.body;

        if (!periodStart || !periodEnd) {
            return res.status(400).json({ error: 'Period start and end required' });
        }

        const result = await payAsYouGoService.generatePayAsYouGoInvoice(
            orgId,
            new Date(periodStart),
            new Date(periodEnd)
        );
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[Billing] Generate PAYG invoice error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate invoice' });
    }
});

module.exports = router;
