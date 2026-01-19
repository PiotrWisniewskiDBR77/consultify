/**
 * Connectors Routes
 * API endpoints for connectors
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { type RequestHandler, Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/connectors.js');
const connectorsRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof connectorsRoutesJS === 'function') {
  // If it's a router function, use it
  router.use(connectorsRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (
  connectorsRoutesJS &&
  typeof (connectorsRoutesJS as { handle?: unknown }).handle === 'function'
) {
  // If it's a router function or Router object, use it
  router.use(connectorsRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
  // Fallback or error
  console.error('connectors.js did not export a valid router');
}
export default router;
