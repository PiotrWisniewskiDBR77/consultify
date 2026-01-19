/**
 * UserGoals Routes
 * API endpoints for userGoals
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { type RequestHandler, Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/userGoals.js');
const userGoalsRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof userGoalsRoutesJS === 'function') {
  // If it's a router function, use it
  router.use(userGoalsRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (
  userGoalsRoutesJS &&
  typeof (userGoalsRoutesJS as { handle?: unknown }).handle === 'function'
) {
  // If it's a router function or Router object, use it
  router.use(userGoalsRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
  // Fallback or error
  console.error('userGoals.js did not export a valid router');
}
export default router;
