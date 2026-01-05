/**
 * NotificationRules Routes
 * API endpoints for notification-rules
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const rulesModule = (await import('./notification-rules.js')) as any;
const notification_rulesRoutesJS = rulesModule.default || rulesModule;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof notification_rulesRoutesJS === 'function' ||
    (notification_rulesRoutesJS && typeof notification_rulesRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(notification_rulesRoutesJS);
} else {
    // Fallback or error
    logger.error('notification-rules.js did not export a valid router');
}

export default router;
