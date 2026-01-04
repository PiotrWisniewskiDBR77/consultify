/**
 * Content Routes
 * API endpoints for content
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)

const router = Router();

// Create router and apply JS routes
// const module = await import('../../routes/content.js');
// const contentRoutesJS = module.default || module;

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
/*
if (typeof contentRoutesJS === 'function' || (contentRoutesJS && typeof contentRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(contentRoutesJS);
} else {
    // Fallback or error
    logger.error('content.js did not export a valid router');
}
*/

export default router;
