/**
 * GovernanceAdmin Routes
 * API endpoints for governanceAdmin
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const governanceAdminRoutesJS = require('../../routes/governanceAdmin.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof governanceAdminRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(governanceAdminRoutesJS);
} else if (governanceAdminRoutesJS.default) {
    // If it has a default export
    router.use(governanceAdminRoutesJS.default);
} else {
    // If it's the router itself
    router.use(governanceAdminRoutesJS);
}

export default router;
