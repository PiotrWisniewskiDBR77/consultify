/**
 * UserSettingsHistory Routes
 * API endpoints for user-settings-history
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)

const router = Router();

// Import the JS implementation for now (will be fully migrated later)
const historyModule = (await import('./user-settings-history.js')) as any;
const user_settings_historyRoutesJS = historyModule.default || historyModule;

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_settings_historyRoutesJS === 'function' ||
    (user_settings_historyRoutesJS && typeof user_settings_historyRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(user_settings_historyRoutesJS);
} else {
    // Fallback or error
    logger.error('user-settings-history.js did not export a valid router');
}

export default router;
