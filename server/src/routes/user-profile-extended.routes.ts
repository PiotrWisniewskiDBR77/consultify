/**
 * UserProfileExtended Routes
 * API endpoints for user-profile-extended
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { fileUploadRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/user-profile-extended.js');
const user_profile_extendedRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Apply rate limiting
router.use(fileUploadRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_profile_extendedRoutesJS === 'function' ||
    (user_profile_extendedRoutesJS && typeof user_profile_extendedRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(user_profile_extendedRoutesJS);
} else {
    // Fallback or error
    logger.error('user-profile-extended.js did not export a valid router');
}

export default router;
