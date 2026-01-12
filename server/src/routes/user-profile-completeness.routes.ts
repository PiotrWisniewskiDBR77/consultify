/**
 * UserProfileCompleteness Routes
 * API endpoints for user-profile-completeness
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/user-profile-completeness.js');
const user_profile_completenessRoutesJS = module.default || module;

const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_profile_completenessRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_profile_completenessRoutesJS as RequestHandler);
} else if (user_profile_completenessRoutesJS && typeof (user_profile_completenessRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function, use it
    router.use(user_profile_completenessRoutesJS as RequestHandler);
} else {
    // Fallback or error
    console.error('user-profile-completeness.js did not export a valid router');
}
export default router;
