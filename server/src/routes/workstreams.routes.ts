/**
 * Workstreams Routes
 * API endpoints for workstreams
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/workstreams.js');
const workstreamsRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof workstreamsRoutesJS === 'function' ||
    (workstreamsRoutesJS && typeof workstreamsRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(workstreamsRoutesJS);
} else {
    // Fallback or error
    logger.error('workstreams.js did not export a valid router');
}

export default router;
