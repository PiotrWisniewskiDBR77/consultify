/**
 * Dbr77 Routes
 * API endpoints for dbr77
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const dbrModule = (await import('./dbr77.js')) as any;
const dbr77RoutesJS = dbrModule.default || dbrModule;

// Create router and apply JS routes
const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof dbr77RoutesJS === 'function' || (dbr77RoutesJS && typeof dbr77RoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(dbr77RoutesJS);
} else {
    // Fallback or error
    logger.error('dbr77.js did not export a valid router');
}

export default router;
