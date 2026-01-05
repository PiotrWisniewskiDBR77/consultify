/**
 * Branding Routes
 * API endpoints for branding
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const brandingModule = (await import('./branding.js')) as any;
const brandingRoutesJS = brandingModule.default || brandingModule;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof brandingRoutesJS === 'function' || (brandingRoutesJS && typeof brandingRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(brandingRoutesJS);
} else {
    // Fallback or error
    logger.error('branding.js did not export a valid router');
}

export default router;
