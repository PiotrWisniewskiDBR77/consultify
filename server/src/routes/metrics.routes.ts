/**
 * Metrics Routes
 * API endpoints for metrics
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/metrics.js');
const metricsRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof metricsRoutesJS === 'function' || (metricsRoutesJS && typeof metricsRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(metricsRoutesJS);
} else {
    // Fallback or error
    console.error('metrics.js did not export a valid router');
}

export default router;
