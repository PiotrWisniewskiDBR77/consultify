/**
 * Demo Routes
 * API endpoints for demo
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const demoRoutesJS = require('../../routes/demo.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof demoRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(demoRoutesJS);
} else if (demoRoutesJS.default) {
    // If it has a default export
    router.use(demoRoutesJS.default);
} else {
    // If it's the router itself
    router.use(demoRoutesJS);
}

export default router;
