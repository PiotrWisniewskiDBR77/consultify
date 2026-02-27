/**
 * Token Billing Routes
 * API endpoints for 3-tier token billing system
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import express from 'express';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();
const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Dynamic imports for services that may not be migrated yet
let TokenBillingService: any = null;
let UsageService: any = null;
let stripe: any = null;

try {
  // Import compiled JavaScript module
  const tokenBillingModule = await import('../../services/tokenBillingService.js');
  TokenBillingService = tokenBillingModule.default || tokenBillingModule;
} catch (error: any) {
  logger.warn(`[TokenBilling] TokenBillingService not available: ${error.message}`);
}

try {
  const usageModule = (await import('../../services/usageService.js')) as any;
  UsageService = usageModule.default || usageModule;
} catch {
  logger.warn('[TokenBilling] UsageService not available');
}

// Initialize Stripe if configured
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const stripeModule = (await import('stripe')) as any;
    stripe = stripeModule.default(process.env.STRIPE_SECRET_KEY);
  } catch {
    logger.warn('[TokenBilling] Stripe not available');
  }
}

/**
 * GET /api/token-billing/balance
 * Get current user's token balance
 */
router.get(
  '/balance',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.getBalance) {
      return notConfigured(res);
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const balance = await TokenBillingService.getBalance(userId);
      return res.json({ success: true, balance });
    } catch (error: any) {
      logger.error('Get balance error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get balance' });
    }
  })
);

/**
 * GET /api/token-billing/packages
 * Get available token packages
 */
router.get(
  '/packages',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.getPackages) {
      return notConfigured(res);
    }

    try {
      const packages = await TokenBillingService.getPackages();
      return res.json({ success: true, packages });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to get packages' });
    }
  })
);

/**
 * GET /api/token-billing/transactions
 * Get user's transaction history
 */
router.get(
  '/transactions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.getTransactions) {
      return notConfigured(res);
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { limit = 50, offset = 0 } = req.query;
      const transactions = await TokenBillingService.getTransactions(userId, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
      return res.json({ success: true, transactions });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to get transactions' });
    }
  })
);

/**
 * GET /api/token-billing/api-keys
 * Get user's API keys (masked)
 */
router.get(
  '/api-keys',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.getUserApiKeys) {
      return notConfigured(res);
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const keys = await TokenBillingService.getUserApiKeys(userId);
      return res.json({ success: true, keys });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to get API keys' });
    }
  })
);

/**
 * POST /api/token-billing/api-keys
 * Add new API key
 */
router.post(
  '/api-keys',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.addUserApiKey) {
      return notConfigured(res);
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { provider, apiKey, displayName, modelPreference } = req.body;
      if (!provider || !apiKey) {
        return res.status(400).json({ success: false, error: 'Provider and API key required' });
      }
      const result = await TokenBillingService.addUserApiKey(userId, {
        provider,
        apiKey,
        displayName,
        modelPreference,
        organizationId: req.user?.organizationId,
      });
      return res.json({ success: true, key: result });
    } catch (error: any) {
      logger.error('Add API key error:', error);
      return res.status(500).json({ success: false, error: 'Failed to add API key' });
    }
  })
);

/**
 * DELETE /api/token-billing/api-keys/:keyId
 * Delete API key
 */
router.delete(
  '/api-keys/:keyId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.deleteUserApiKey) {
      return notConfigured(res);
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const result = await TokenBillingService.deleteUserApiKey(req.params.keyId, userId);
      return res.json({ success: true, ...result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to delete API key' });
    }
  })
);

/**
 * POST /api/token-billing/purchase
 * Create checkout session for token purchase
 */
router.post(
  '/purchase',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.getPackage) {
      return notConfigured(res);
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { packageId } = req.body;
      const pkg = await TokenBillingService.getPackage(packageId);

      if (!pkg) {
        return res.status(404).json({ success: false, error: 'Package not found' });
      }

      // If Stripe is configured, create checkout session
      if (stripe && pkg.stripe_price_id) {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price: pkg.stripe_price_id,
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?canceled=true`,
          metadata: {
            userId: userId,
            packageId: packageId,
            tokens: pkg.tokens.toString(),
            bonusPercent: (pkg.bonus_percent || 0).toString(),
          },
        });
        return res.json({ success: true, checkoutUrl: session.url, sessionId: session.id });
      } else {
        return notConfigured(res);
      }
    } catch (error: any) {
      logger.error('Purchase error:', error);
      return res.status(500).json({ success: false, error: 'Purchase failed' });
    }
  })
);

/**
 * POST /api/token-billing/webhook
 * Stripe webhook for payment confirmation
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    if (!stripe) {
      return notConfigured(res);
    }

    if (!TokenBillingService?.creditTokens) {
      return notConfigured(res);
    }

    const sig = req.headers['stripe-signature'] as string;

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, packageId, tokens, bonusPercent } = session.metadata;

        const tokenCount = parseInt(tokens);
        const bonusTokens = Math.floor(tokenCount * (parseInt(bonusPercent) / 100));

        await TokenBillingService.creditTokens(userId, tokenCount, bonusTokens, {
          packageId,
          stripePaymentId: session.payment_intent,
        });
      }

      return res.json({ received: true });
    } catch (err: any) {
      logger.error('Webhook error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  })
);

/**
 * GET /api/token-billing/margins
 * Get billing margins (admin)
 */
router.get(
  '/margins',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.getMargins) {
      return notConfigured(res);
    }

    try {
      const margins = await TokenBillingService.getMargins();
      return res.json({ success: true, margins });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to get margins' });
    }
  })
);

/**
 * PUT /api/token-billing/margins/:sourceType
 * Update billing margin (superadmin)
 */
router.put(
  '/margins/:sourceType',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.updateMargin) {
      return notConfigured(res);
    }

    try {
      const { baseCostPer1k, marginPercent, minCharge, isActive } = req.body;
      const result = await TokenBillingService.updateMargin(req.params.sourceType, {
        baseCostPer1k,
        marginPercent,
        minCharge,
        isActive,
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to update margin' });
    }
  })
);

/**
 * GET /api/token-billing/analytics
 * Get revenue analytics (superadmin)
 */
router.get(
  '/analytics',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.getRevenueAnalytics) {
      return notConfigured(res);
    }

    try {
      const { startDate, endDate } = req.query;
      const analytics = await TokenBillingService.getRevenueAnalytics({ startDate, endDate });
      return res.json({ success: true, analytics });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to get analytics' });
    }
  })
);

/**
 * GET /api/token-billing/costs
 * Get operational costs (superadmin)
 */
router.get(
  '/costs',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!UsageService?.getOperationalCosts) {
      return notConfigured(res);
    }

    try {
      const { startDate, endDate } = req.query;
      const costs = await UsageService.getOperationalCosts(
        startDate as string | undefined,
        endDate as string | undefined
      );
      return res.json({ success: true, costs });
    } catch (error: any) {
      logger.error('Get costs error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get operational costs' });
    }
  })
);

/**
 * POST /api/token-billing/packages
 * Manage packages (superadmin)
 */
router.post(
  '/packages',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TokenBillingService?.upsertPackage) {
      return notConfigured(res);
    }

    try {
      const result = await TokenBillingService.upsertPackage(req.body);
      return res.json({ success: true, package: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Failed to save package' });
    }
  })
);

export default router;
