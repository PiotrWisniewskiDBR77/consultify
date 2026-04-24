/**
 * UserSecurityAdvanced Routes
 * API endpoints for user-security-advanced
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { type RequestHandler, Router } from 'express';

import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/user-security-advanced.js');
const user_security_advancedRoutesJS = module.default || module;

const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_security_advancedRoutesJS === 'function') {
  // If it's a router function, use it
  router.use(user_security_advancedRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (
  user_security_advancedRoutesJS &&
  typeof (user_security_advancedRoutesJS as { handle?: unknown }).handle === 'function'
) {
  // If it's a router function, use it
  router.use(user_security_advancedRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
  // Fallback or error
  logger.error('user-security-advanced.js did not export a valid router');
}
export default router;
