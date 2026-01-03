/**
 * Partners Routes
 * API endpoints for partners
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const partnersRoutesJSPromise = (async () => {
    const module = await import('../../routes/partners.js');
    return module.default || module;
})();
const partnersRoutesJS = partnersRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof partnersRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(partnersRoutesJS);
} else if (partnersRoutesJS.default) {
    // If it has a default export
    router.use(partnersRoutesJS.default);
} else {
    // If it's the router itself
    router.use(partnersRoutesJS);
}

export default router;
