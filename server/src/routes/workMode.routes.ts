/**
 * WorkMode Routes
 * API endpoints for workMode
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const workModeRoutesJSPromise = (async () => {
    const module = await import('../../routes/workMode.js');
    return module.default || module;
})();
const workModeRoutesJS = workModeRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof workModeRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(workModeRoutesJS);
} else if (workModeRoutesJS.default) {
    // If it has a default export
    router.use(workModeRoutesJS.default);
} else {
    // If it's the router itself
    router.use(workModeRoutesJS);
}

export default router;
