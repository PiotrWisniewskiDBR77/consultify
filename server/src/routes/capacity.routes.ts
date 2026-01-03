/**
 * Capacity Routes
 * API endpoints for capacity
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const capacityRoutesJSPromise = (async () => {
    const module = await import('../../routes/capacity.js');
    return module.default || module;
})();
const capacityRoutesJS = capacityRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof capacityRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(capacityRoutesJS);
} else if (capacityRoutesJS.default) {
    // If it has a default export
    router.use(capacityRoutesJS.default);
} else {
    // If it's the router itself
    router.use(capacityRoutesJS);
}

export default router;
