/**
 * Notifications Routes Index
 * Aggregates all notification-related routes
 */

import { Router } from 'express';

import notificationRulesRoutes from './notification-rules.routes.js';
import notificationsRoutes from './notifications.routes.js';
import notificationSettingsRoutes from './notificationSettings.routes.js';

const router = Router();

// Mount all notification sub-routes
router.use('/rules', notificationRulesRoutes);
router.use('/settings', notificationSettingsRoutes);
router.use('/', notificationsRoutes);

export default router;




