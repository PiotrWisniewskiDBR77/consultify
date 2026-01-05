/**
 * UserProfileCompleteness Routes
 * API endpoints for user-profile-completeness
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { fileUploadRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)

const router = Router();

// Import the JS implementation for now (will be fully migrated later)
const module = (await import('./user-profile-completeness.js')) as any;
const user_profile_completenessRoutesJS = module.default || module;

// Apply rate limiting
router.use(fileUploadRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_profile_completenessRoutesJS === 'function' ||
    (user_profile_completenessRoutesJS && typeof user_profile_completenessRoutesJS.handle === 'function')
) {
    // If it's a router function, use it
    router.use(user_profile_completenessRoutesJS);
} else {
    // Fallback or error
    logger.error('user-profile-completeness.js did not export a valid router');
}

export default router;
