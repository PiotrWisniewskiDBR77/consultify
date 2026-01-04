/**
 * Videos Routes
 * API endpoints for videos
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/videos.js');
const videosRoutesJS = module.default || module;

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Create router and apply JS routes
// const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof videosRoutesJS === 'function' || (videosRoutesJS && typeof videosRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(videosRoutesJS);
} else {
    // Fallback or error
    logger.error('videos.js did not export a valid router');
}

export default router;
