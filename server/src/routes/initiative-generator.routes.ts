/**
 * InitiativeGenerator Routes
 * API endpoints for initiative-generator
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const initiative_generatorRoutesJSPromise = (async () => {
    const module = await import('../../routes/initiative-generator.js');
    return module.default || module;
})();
const initiative_generatorRoutesJS = initiative_generatorRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof initiative_generatorRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(initiative_generatorRoutesJS);
} else if (initiative_generatorRoutesJS.default) {
    // If it has a default export
    router.use(initiative_generatorRoutesJS.default);
} else {
    // If it's the router itself
    router.use(initiative_generatorRoutesJS);
}

export default router;
