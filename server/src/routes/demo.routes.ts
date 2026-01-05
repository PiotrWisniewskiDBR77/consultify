/**
 * Demo Routes
 * API endpoints for demo
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const demoModule = (await import('./demo.js')) as any;
const demoRoutesJS = demoModule.default || demoModule;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof demoRoutesJS === 'function' || (demoRoutesJS && typeof demoRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(demoRoutesJS);
} else {
    // Fallback or error
    logger.error('demo.js did not export a valid router');
}

export default router;
