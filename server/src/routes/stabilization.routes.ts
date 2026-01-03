/**
 * Stabilization Routes
 * API endpoints for stabilization
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const stabilizationRoutesJSPromise = (async () => {
    const module = await import('../../routes/stabilization.js');
    return module.default || module;
})();
const stabilizationRoutesJS = stabilizationRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof stabilizationRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(stabilizationRoutesJS);
} else if (stabilizationRoutesJS.default) {
    // If it has a default export
    router.use(stabilizationRoutesJS.default);
} else {
    // If it's the router itself
    router.use(stabilizationRoutesJS);
}

export default router;
