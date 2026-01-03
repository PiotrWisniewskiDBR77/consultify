/**
 * Intelligence Routes
 * API endpoints for intelligence
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const intelligenceRoutesJSPromise = (async () => {
    const module = await import('../../routes/intelligence.js');
    return module.default || module;
})();
const intelligenceRoutesJS = intelligenceRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof intelligenceRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(intelligenceRoutesJS);
} else if (intelligenceRoutesJS.default) {
    // If it has a default export
    router.use(intelligenceRoutesJS.default);
} else {
    // If it's the router itself
    router.use(intelligenceRoutesJS);
}

export default router;
