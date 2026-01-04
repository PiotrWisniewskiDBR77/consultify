/**
 * FrameworkRbac Routes
 * API endpoints for framework-rbac
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/framework-rbac.js');
const framework_rbacRoutesJS = module.default || module;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof framework_rbacRoutesJS === 'function' ||
    (framework_rbacRoutesJS && typeof framework_rbacRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(framework_rbacRoutesJS);
} else {
    // Fallback or error
    logger.error('framework-rbac.js did not export a valid router');
}

export default router;
