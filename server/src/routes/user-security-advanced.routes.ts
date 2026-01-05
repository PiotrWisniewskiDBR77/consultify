/**
 * UserSecurityAdvanced Routes
 * API endpoints for user-security-advanced
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)

const router = Router();

// Import the JS implementation for now (will be fully migrated later)
const securityModule = (await import('./user-security-advanced.js')) as any;
const user_security_advancedRoutesJS = securityModule.default || securityModule;

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_security_advancedRoutesJS === 'function' ||
    (user_security_advancedRoutesJS && typeof user_security_advancedRoutesJS.handle === 'function')
) {
    // If it's a router function, use it
    router.use(user_security_advancedRoutesJS);
} else {
    // Fallback or error
    logger.error('user-security-advanced.js did not export a valid router');
}

export default router;
