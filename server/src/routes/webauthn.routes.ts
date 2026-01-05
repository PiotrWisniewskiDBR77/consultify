/**
 * Webauthn Routes
 * API endpoints for webauthn
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const authModule = (await import('./webauthn.js')) as any;
const webauthnRoutesJS = authModule.default || authModule;

// Create router and apply JS routes
const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof webauthnRoutesJS === 'function' || (webauthnRoutesJS && typeof webauthnRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(webauthnRoutesJS);
} else {
    // Fallback or error
    logger.error('webauthn.js did not export a valid router');
}

export default router;
