/**
 * Security Routes
 * API endpoints for security
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const securityRoutesJS = require('../../routes/security.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof securityRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(securityRoutesJS);
} else if (securityRoutesJS.default) {
    // If it has a default export
    router.use(securityRoutesJS.default);
} else {
    // If it's the router itself
    router.use(securityRoutesJS);
}

export default router;
