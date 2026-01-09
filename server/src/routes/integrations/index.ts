/**
 * Integrations Routes Index
 * Aggregates all integration-related routes
 */

import { Router } from 'express';

import calendarIntegrationsRoutes from './calendarIntegrations.routes.js';
import connectorsRoutes from './connectors.routes.js';
import integrationsRoutes from './integrations.routes.js';
import scimRoutes from './scim.routes.js';
import ssoRoutes from './sso.routes.js';
import webhooksRoutes from './webhooks.routes.js';
import webhookSubscriptionsRoutes from './webhookSubscriptions.routes.js';

const router = Router();

// Mount all integration sub-routes
router.use('/calendar', calendarIntegrationsRoutes);
router.use('/connectors', connectorsRoutes);
router.use('/scim', scimRoutes);
router.use('/sso', ssoRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/webhook-subscriptions', webhookSubscriptionsRoutes);
router.use('/', integrationsRoutes);

export default router;




