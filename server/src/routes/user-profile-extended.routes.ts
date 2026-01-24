/**
 * UserProfileExtended Routes
 * API endpoints for user-profile-extended
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { type RequestHandler, Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/user-profile-extended.js');
const user_profile_extendedRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_profile_extendedRoutesJS === 'function') {
  // If it's a router function, use it
  router.use(user_profile_extendedRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (
  user_profile_extendedRoutesJS &&
  typeof (user_profile_extendedRoutesJS as { handle?: unknown }).handle === 'function'
) {
  // If it's a router function or Router object, use it
  router.use(user_profile_extendedRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
  // Fallback or error
  console.error('user-profile-extended.js did not export a valid router');
}
export default router;
