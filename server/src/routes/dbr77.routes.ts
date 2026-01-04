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
const module = await import('../../routes/dbr77.js');
const dbr77RoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof dbr77RoutesJS === 'function' || (dbr77RoutesJS && typeof dbr77RoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(dbr77RoutesJS);
} else {
    // Fallback or error
    console.error('dbr77.js did not export a valid router');
}

export default router;
