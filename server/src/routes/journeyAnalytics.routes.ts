/**
 * JourneyAnalytics Routes
 * API endpoints for journeyAnalytics
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const journeyModule = (await import('./journeyAnalytics.js')) as any;
const journeyAnalyticsRoutesJS = journeyModule.default || journeyModule;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof journeyAnalyticsRoutesJS === 'function' ||
    (journeyAnalyticsRoutesJS && typeof journeyAnalyticsRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(journeyAnalyticsRoutesJS);
} else {
    // Fallback or error
    logger.error('journeyAnalytics.js did not export a valid router');
}

export default router;
