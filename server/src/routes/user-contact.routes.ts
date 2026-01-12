/**
 * UserContact Routes
 * API endpoints for user-contact
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/user-contact.js');
const user_contactRoutesJS = module.default || module;

const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_contactRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_contactRoutesJS as RequestHandler);
} else if (user_contactRoutesJS && typeof (user_contactRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function or Router object, use it
    router.use(user_contactRoutesJS as RequestHandler);
    // Fallback or error if not a valid router
    console.error('user-contact.js did not export a valid router');
}

export default router;
