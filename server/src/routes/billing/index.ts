/**
 * Billing Routes Index
 * Aggregates all billing-related routes
 */

import { Router } from 'express';

import billingRoutes from './billing.routes.js';
import pricingRoutes from './pricing.routes.js';
import promoRoutes from './promo.routes.js';
import settlementsRoutes from './settlements.routes.js';
import tokenBillingRoutes from './tokenBilling.routes.js';

const router = Router();

// Mount all billing sub-routes
router.use('/main', billingRoutes);
router.use('/pricing', pricingRoutes);
router.use('/promo', promoRoutes);
router.use('/settlements', settlementsRoutes);
router.use('/tokens', tokenBillingRoutes);

export default router;




