/**
 * PmoAnalysis Routes
 * API endpoints for pmo-analysis
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/pmo-analysis.js');
const pmo_analysisRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof pmo_analysisRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(pmo_analysisRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (pmo_analysisRoutesJS && typeof (pmo_analysisRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function or Router object, use it
    router.use(pmo_analysisRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
    // Fallback or error
    console.error('pmo-analysis.js did not export a valid router');
}
export default router;
