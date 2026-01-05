/**
 * UserContact Routes
 * API endpoints for user-contact
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const contactModule = (await import('./user-contact.js')) as any;
const user_contactRoutesJS = contactModule.default || contactModule;

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_contactRoutesJS === 'function' ||
    (user_contactRoutesJS && typeof user_contactRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(user_contactRoutesJS);
} else {
    // Fallback or error if not a valid router
    logger.error('user-contact.js did not export a valid router');
}

export default router;
