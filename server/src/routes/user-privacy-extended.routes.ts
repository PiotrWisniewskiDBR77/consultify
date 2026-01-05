/**
 * UserPrivacyExtended Routes
 * API endpoints for user-privacy-extended
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
const module = (await import('./user-privacy-extended.js')) as any;
const user_privacy_extendedRoutesJS = module.default || module;

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_privacy_extendedRoutesJS === 'function' ||
    (user_privacy_extendedRoutesJS && typeof user_privacy_extendedRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(user_privacy_extendedRoutesJS);
} else {
    // Fallback or error
    logger.error('user-privacy-extended.js did not export a valid router');
}

export default router;
