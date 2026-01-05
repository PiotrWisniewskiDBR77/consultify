/**
 * UserDataControls Routes
 * API endpoints for user-data-controls
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
const controlsModule = (await import('./user-data-controls.js')) as any;
const user_data_controlsRoutesJS = controlsModule.default || controlsModule;

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_data_controlsRoutesJS === 'function' ||
    (user_data_controlsRoutesJS && typeof user_data_controlsRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(user_data_controlsRoutesJS);
} else {
    // Fallback or error
    logger.error('user-data-controls.js did not export a valid router');
}

export default router;
