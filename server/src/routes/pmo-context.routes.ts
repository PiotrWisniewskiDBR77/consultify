/**
 * PmoContext Routes
 * API endpoints for pmo-context
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const instanceModule = (await import('./pmo-context.js')) as any;
const pmo_contextRoutesJS = instanceModule.default || instanceModule;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof pmo_contextRoutesJS === 'function' ||
    (pmo_contextRoutesJS && typeof pmo_contextRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(pmo_contextRoutesJS);
} else {
    // Fallback or error
    logger.error('pmo-context.js did not export a valid router');
}

export default router;
