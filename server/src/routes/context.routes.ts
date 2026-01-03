/**
 * Context Routes
 * API endpoints for context
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const contextRoutesJSPromise = (async () => {
    const module = await import('../../routes/context.js');
    return module.default || module;
})();
const contextRoutesJS = contextRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof contextRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(contextRoutesJS);
} else if (contextRoutesJS.default) {
    // If it has a default export
    router.use(contextRoutesJS.default);
} else {
    // If it's the router itself
    router.use(contextRoutesJS);
}

export default router;
