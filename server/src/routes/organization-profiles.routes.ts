/**
 * OrganizationProfiles Routes
 * API endpoints for organization-profiles
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { fileUploadRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const profileModule = (await import('./organization-profiles.js')) as any;
const organization_profilesRoutesJS = profileModule.default || profileModule;

// Create router and apply JS routes
const router = Router();

// Apply rate limiting
router.use(fileUploadRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof organization_profilesRoutesJS === 'function' ||
    (organization_profilesRoutesJS && typeof organization_profilesRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(organization_profilesRoutesJS);
} else {
    // Fallback or error
    logger.error('organization-profiles.js did not export a valid router');
}

export default router;
