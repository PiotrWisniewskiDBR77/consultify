/**
 * Verify Routes
 * API endpoints for verify
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/verify.js');
const verifyRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof verifyRoutesJS === 'function' || (verifyRoutesJS && typeof verifyRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(verifyRoutesJS);
} else {
    // Fallback or error
    console.error('verify.js did not export a valid router');
}

export default router;
