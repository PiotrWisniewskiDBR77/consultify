/**
 * Token Billing Routes
 * 
 * API endpoints for 3-tier token billing system
 */

const express = require('express');
const router = express.Router();
const TokenBillingService = require('../services/tokenBillingService');
const authenticateToken = require('../middleware/authMiddleware');
const { verifyAdmin: requireAdmin } = require('../middleware/adminMiddleware');
const requireSuperAdmin = require('../middleware/superAdminMiddleware');

// ==========================================
// PUBLIC ROUTES (Authenticated Users)
// ==========================================

// Get current user's token balance
router.get('/balance', authenticateToken, async (req, res) => {
    try {
        const balance = await TokenBillingService.getBalance(req.user.id);
        res.json({ success: true, balance });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ success: false, error: 'Failed to get balance' });
    }
});

// Get available token packages
router.get('/packages', authenticateToken, async (req, res) => {
    try {
        const packages = await TokenBillingService.getPackages();
        res.json({ success: true, packages });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get packages' });
    }
});

// Get user's transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const transactions = await TokenBillingService.getTransactions(req.user.id, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get transactions' });
    }
});

// ==========================================
// BYOK (Bring Your Own Key) ROUTES
// ==========================================

// Get user's API keys (masked)
router.get('/api-keys', authenticateToken, async (req, res) => {
    try {
        const keys = await TokenBillingService.getUserApiKeys(req.user.id);
        res.json({ success: true, keys });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get API keys' });
    }
});

// Add new API key
router.post('/api-keys', authenticateToken, async (req, res) => {
    try {
        const { provider, apiKey, displayName, modelPreference } = req.body;
        if (!provider || !apiKey) {
            return res.status(400).json({ success: false, error: 'Provider and API key required' });
        }
        const result = await TokenBillingService.addUserApiKey(req.user.id, {
            provider,
            apiKey,
            displayName,
            modelPreference,
            organizationId: req.user.organization_id
        });
        res.json({ success: true, key: result });
    } catch (error) {
        console.error('Add API key error:', error);
        res.status(500).json({ success: false, error: 'Failed to add API key' });
    }
});

// Delete API key
router.delete('/api-keys/:keyId', authenticateToken, async (req, res) => {
    try {
        const result = await TokenBillingService.deleteUserApiKey(req.params.keyId, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete API key' });
    }
});

// ==========================================
// PURCHASE ROUTES (Stripe Integration)
// ==========================================

// Create checkout session for token purchase
router.post('/purchase', authenticateToken, async (req, res) => {
    try {
        const { packageId } = req.body;
        const pkg = await TokenBillingService.getPackage(packageId);

        if (!pkg) {
            return res.status(404).json({ success: false, error: 'Package not found' });
        }

        // If Stripe is configured, create checkout session
        if (process.env.STRIPE_SECRET_KEY && pkg.stripe_price_id) {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price: pkg.stripe_price_id,
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?canceled=true`,
                metadata: {
                    userId: req.user.id,
                    packageId: packageId,
                    tokens: pkg.tokens.toString(),
                    bonusPercent: (pkg.bonus_percent || 0).toString()
                }
            });
            res.json({ success: true, checkoutUrl: session.url, sessionId: session.id });
        } else {
            // Demo mode: directly credit tokens
            const bonusTokens = Math.floor(pkg.tokens * (pkg.bonus_percent / 100));
            await TokenBillingService.creditTokens(req.user.id, pkg.tokens, bonusTokens, {
                packageId,
                organizationId: req.user.organization_id
            });
            res.json({ success: true, message: 'Tokens credited (demo mode)', tokens: pkg.tokens + bonusTokens });
        }
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ success: false, error: 'Purchase failed' });
    }
});

// Stripe webhook for payment confirmation
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json({ error: 'Stripe not configured' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];

    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const { userId, packageId, tokens, bonusPercent } = session.metadata;

            const tokenCount = parseInt(tokens);
            const bonusTokens = Math.floor(tokenCount * (parseInt(bonusPercent) / 100));

            await TokenBillingService.creditTokens(userId, tokenCount, bonusTokens, {
                packageId,
                stripePaymentId: session.payment_intent
            });
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

// Get billing margins (admin)
router.get('/margins', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const margins = await TokenBillingService.getMargins();
        res.json({ success: true, margins });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get margins' });
    }
});

// Update billing margin (superadmin)
router.put('/margins/:sourceType', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { baseCostPer1k, marginPercent, minCharge, isActive } = req.body;
        const result = await TokenBillingService.updateMargin(req.params.sourceType, {
            baseCostPer1k,
            marginPercent,
            minCharge,
            isActive
        });
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update margin' });
    }
});

// Get revenue analytics (superadmin)
router.get('/analytics', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const analytics = await TokenBillingService.getRevenueAnalytics({ startDate, endDate });
        res.json({ success: true, analytics });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get analytics' });
    }
});

// Get operational costs (superadmin)
router.get('/costs', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Lazily require usageService to avoid circular dependency issues if any
        const UsageService = require('../services/usageService');
        const costs = await UsageService.getOperationalCosts(startDate, endDate);
        res.json({ success: true, costs });
    } catch (error) {
        console.error('Get costs error:', error);
        res.status(500).json({ success: false, error: 'Failed to get operational costs' });
    }
});

// Manage packages (superadmin)
router.post('/packages', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const result = await TokenBillingService.upsertPackage(req.body);
        res.json({ success: true, package: result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to save package' });
    }
});

module.exports = router;
