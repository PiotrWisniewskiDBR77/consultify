/**
 * UserAvailability Routes
 * API endpoints for user-availability
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/user-availability.js');
const user_availabilityRoutesJS = module.default || module;

const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_availabilityRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_availabilityRoutesJS as RequestHandler);
} else if (user_availabilityRoutesJS && typeof (user_availabilityRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function, use it
    router.use(user_availabilityRoutesJS as RequestHandler);
} else {
    // Fallback or error
    console.error('user-availability.js did not export a valid router');
}
export default router;
