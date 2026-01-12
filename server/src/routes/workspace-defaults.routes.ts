/**
 * WorkspaceDefaults Routes
 * API endpoints for workspace-defaults
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/workspace-defaults.js');
const workspace_defaultsRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof workspace_defaultsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(workspace_defaultsRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (workspace_defaultsRoutesJS && typeof (workspace_defaultsRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function or Router object, use it
    router.use(workspace_defaultsRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
    // Fallback or error
    console.error('workspace-defaults.js did not export a valid router');
}
export default router;
