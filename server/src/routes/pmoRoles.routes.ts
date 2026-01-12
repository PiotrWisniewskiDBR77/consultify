/**
 * PmoRoles Routes
 * API endpoints for pmoRoles
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/pmoRoles.js');
const pmoRolesRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof pmoRolesRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(pmoRolesRoutesJS as RequestHandler);
} else if (pmoRolesRoutesJS && typeof (pmoRolesRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function or Router object, use it
    router.use(pmoRolesRoutesJS as RequestHandler);
} else {
    // Fallback or error
    console.error('pmoRoles.js did not export a valid router');
}
}

export default router;
