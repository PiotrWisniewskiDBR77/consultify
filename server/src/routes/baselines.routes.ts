/**
 * Baselines Routes
 * API endpoints for baselines
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/baselines.js');
const baselinesRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof baselinesRoutesJS === 'function' || (baselinesRoutesJS && typeof baselinesRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(baselinesRoutesJS);
} else {
    // Fallback or error
    console.error('baselines.js did not export a valid router');
}

export default router;
