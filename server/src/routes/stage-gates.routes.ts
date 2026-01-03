/**
 * StageGates Routes
 * API endpoints for stage-gates
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const stage_gatesRoutesJSPromise = (async () => {
    const module = await import('../../routes/stage-gates.js');
    return module.default || module;
})();
const stage_gatesRoutesJS = stage_gatesRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof stage_gatesRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(stage_gatesRoutesJS);
} else if (stage_gatesRoutesJS.default) {
    // If it has a default export
    router.use(stage_gatesRoutesJS.default);
} else {
    // If it's the router itself
    router.use(stage_gatesRoutesJS);
}

export default router;
