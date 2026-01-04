/**
 * AiPlaybooks Routes
 * API endpoints for aiPlaybooks
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)
// const module = await import('../../routes/aiPlaybooks.js');
// const aiPlaybooksRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Apply rate limiting
router.use(aiRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
/*
if (
    typeof aiPlaybooksRoutesJS === 'function' ||
    (aiPlaybooksRoutesJS && typeof aiPlaybooksRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(aiPlaybooksRoutesJS);
} else {
    // Fallback or error
    logger.error('aiPlaybooks.js did not export a valid router');
}
*/

export default router;
