/**
 * Baselines Routes
 * API endpoints for baselines
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const baselinesRoutesJSPromise = (async () => {
    const module = await import('../../routes/baselines.js');
    return module.default || module;
})();
const baselinesRoutesJS = baselinesRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof baselinesRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(baselinesRoutesJS);
} else if (baselinesRoutesJS.default) {
    // If it has a default export
    router.use(baselinesRoutesJS.default);
} else {
    // If it's the router itself
    router.use(baselinesRoutesJS);
}

export default router;
