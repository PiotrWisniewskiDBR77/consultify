/**
 * Connectors Routes
 * API endpoints for connectors
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const connectorsRoutesJSPromise = (async () => {
    const module = await import('../../routes/connectors.js');
    return module.default || module;
})();
const connectorsRoutesJS = connectorsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof connectorsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(connectorsRoutesJS);
} else if (connectorsRoutesJS.default) {
    // If it has a default export
    router.use(connectorsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(connectorsRoutesJS);
}

export default router;
