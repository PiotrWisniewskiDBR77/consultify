/**
 * Scenarios Routes
 * API endpoints for scenarios
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const scenariosRoutesJSPromise = (async () => {
    const module = await import('../../routes/scenarios.js');
    return module.default || module;
})();
const scenariosRoutesJS = scenariosRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof scenariosRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(scenariosRoutesJS);
} else if (scenariosRoutesJS.default) {
    // If it has a default export
    router.use(scenariosRoutesJS.default);
} else {
    // If it's the router itself
    router.use(scenariosRoutesJS);
}

export default router;
