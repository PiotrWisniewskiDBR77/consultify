/**
 * WorkspaceDefaults Routes
 * API endpoints for workspace-defaults
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = (await import('./workspace-defaults.js')) as any;
const workspace_defaultsRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof workspace_defaultsRoutesJS === 'function' ||
    (workspace_defaultsRoutesJS && typeof workspace_defaultsRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(workspace_defaultsRoutesJS);
} else {
    // Fallback or error
    logger.error('workspace-defaults.js did not export a valid router');
}

export default router;
