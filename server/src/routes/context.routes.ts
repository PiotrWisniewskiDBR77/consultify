/**
 * Context Routes
 * API endpoints for context
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const contextModuleResult = (await import('./context.js')) as any;
const contextRoutesJS = contextModuleResult.default || contextModuleResult;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof contextRoutesJS === 'function' || (contextRoutesJS && typeof contextRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(contextRoutesJS);
} else {
    // Fallback or error
    logger.error('context.js did not export a valid router');
}

export default router;
