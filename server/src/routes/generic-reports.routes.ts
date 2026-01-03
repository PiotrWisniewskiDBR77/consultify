/**
 * GenericReports Routes
 * API endpoints for generic-reports
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const generic_reportsRoutesJS = require('../../routes/generic-reports.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof generic_reportsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(generic_reportsRoutesJS);
} else if (generic_reportsRoutesJS.default) {
    // If it has a default export
    router.use(generic_reportsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(generic_reportsRoutesJS);
}

export default router;
