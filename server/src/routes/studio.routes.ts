/**
 * Studio Routes
 * API endpoints for studio
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const studioModule = (await import('./studio.js')) as any;
const studioRoutesJS = studioModule.default || studioModule;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof studioRoutesJS === 'function' || (studioRoutesJS && typeof studioRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(studioRoutesJS);
} else {
    // Fallback or error
    logger.error('studio.js did not export a valid router');
}

export default router;
