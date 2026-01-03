/**
 * WorkspaceDefaults Routes
 * API endpoints for workspace-defaults
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const workspace_defaultsRoutesJSPromise = (async () => {
    const module = await import('../../routes/workspace-defaults.js');
    return module.default || module;
})();
const workspace_defaultsRoutesJS = workspace_defaultsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof workspace_defaultsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(workspace_defaultsRoutesJS);
} else if (workspace_defaultsRoutesJS.default) {
    // If it has a default export
    router.use(workspace_defaultsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(workspace_defaultsRoutesJS);
}

export default router;
