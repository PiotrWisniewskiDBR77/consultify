/**
 * Governance Routes
 * API endpoints for governance
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const governanceRoutesJSPromise = (async () => {
    const module = await import('../../routes/governance.js');
    return module.default || module;
})();
const governanceRoutesJS = governanceRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof governanceRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(governanceRoutesJS);
} else if (governanceRoutesJS.default) {
    // If it has a default export
    router.use(governanceRoutesJS.default);
} else {
    // If it's the router itself
    router.use(governanceRoutesJS);
}

export default router;
