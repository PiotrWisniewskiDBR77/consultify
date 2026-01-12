/**
 * FeatureFlags Routes
 * API endpoints for featureFlags
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/featureFlags.js');
const featureFlagsRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof featureFlagsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(featureFlagsRoutesJS as RequestHandler);
} else if (featureFlagsRoutesJS && typeof (featureFlagsRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function or Router object, use it
    router.use(featureFlagsRoutesJS as RequestHandler);
} else {
    // Fallback or error
    console.error('featureFlags.js did not export a valid router');
}
}

export default router;
