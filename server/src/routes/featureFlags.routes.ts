/**
 * FeatureFlags Routes
 * API endpoints for featureFlags
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const featureFlagsRoutesJSPromise = (async () => {
    const module = await import('../../routes/featureFlags.js');
    return module.default || module;
})();
const featureFlagsRoutesJS = featureFlagsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof featureFlagsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(featureFlagsRoutesJS);
} else if (featureFlagsRoutesJS.default) {
    // If it has a default export
    router.use(featureFlagsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(featureFlagsRoutesJS);
}

export default router;
