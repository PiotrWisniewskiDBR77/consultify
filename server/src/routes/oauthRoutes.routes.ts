/**
 * OauthRoutes Routes
 * API endpoints for oauthRoutes
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/oauthRoutes.js');
const oauthRoutesRoutesJS = module.default || module;

// Apply rate limiting
const router = Router();

router.use(authRateLimiter);

// Create router and apply JS routes

// Apply rate limiting
router.use(authRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof oauthRoutesRoutesJS === 'function' ||
    (oauthRoutesRoutesJS && typeof oauthRoutesRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(oauthRoutesRoutesJS);
} else {
    // Fallback or error
    logger.error('oauthRoutes.js did not export a valid router');
}

export default router;
