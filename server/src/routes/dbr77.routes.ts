/**
 * Dbr77 Routes
 * API endpoints for dbr77
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const dbr77RoutesJSPromise = (async () => {
    const module = await import('../../routes/dbr77.js');
    return module.default || module;
})();
const dbr77RoutesJS = dbr77RoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof dbr77RoutesJS === 'function') {
    // If it's a router function, use it
    router.use(dbr77RoutesJS);
} else if (dbr77RoutesJS.default) {
    // If it has a default export
    router.use(dbr77RoutesJS.default);
} else {
    // If it's the router itself
    router.use(dbr77RoutesJS);
}

export default router;
