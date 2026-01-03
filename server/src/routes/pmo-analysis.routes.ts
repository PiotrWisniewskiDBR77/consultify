/**
 * PmoAnalysis Routes
 * API endpoints for pmo-analysis
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const pmo_analysisRoutesJS = require('../../routes/pmo-analysis.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof pmo_analysisRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(pmo_analysisRoutesJS);
} else if (pmo_analysisRoutesJS.default) {
    // If it has a default export
    router.use(pmo_analysisRoutesJS.default);
} else {
    // If it's the router itself
    router.use(pmo_analysisRoutesJS);
}

export default router;
