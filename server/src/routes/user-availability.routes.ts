/**
 * UserAvailability Routes
 * API endpoints for user-availability
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)

const router = Router();

// Import the JS implementation for now (will be fully migrated later)
const module = (await import('./user-availability.js')) as any;
const userAvailabilityRoutesJS = module.default || module;

// Apply rate limiting
router.use(aiRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof userAvailabilityRoutesJS === 'function' ||
    (userAvailabilityRoutesJS && typeof userAvailabilityRoutesJS.handle === 'function')
) {
    // If it's a router function, use it
    router.use(userAvailabilityRoutesJS);
} else {
    // Fallback or error
    logger.error('user-availability.js did not export a valid router');
}

export default router;
