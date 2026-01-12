/**
 * GenericReports Routes
 * API endpoints for generic-reports
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/generic-reports.js');
const generic_reportsRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof generic_reportsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(generic_reportsRoutesJS as RequestHandler);
} else if (generic_reportsRoutesJS && typeof (generic_reportsRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a Router object with handle method, use it
    router.use(generic_reportsRoutesJS as RequestHandler);
} else {
    // Fallback or error
    console.error('generic-reports.js did not export a valid router');
}

export default router;
