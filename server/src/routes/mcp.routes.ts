/**
 * Mcp Routes
 * API endpoints for mcp
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const mcpRoutesJSPromise = (async () => {
    const module = await import('../../routes/mcp.js');
    return module.default || module;
})();
const mcpRoutesJS = mcpRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof mcpRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(mcpRoutesJS);
} else if (mcpRoutesJS.default) {
    // If it has a default export
    router.use(mcpRoutesJS.default);
} else {
    // If it's the router itself
    router.use(mcpRoutesJS);
}

export default router;
