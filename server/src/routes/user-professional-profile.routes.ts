/**
 * UserProfessionalProfile Routes
 * API endpoints for user-professional-profile
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/user-professional-profile.js');
const user_professional_profileRoutesJS = module.default || module;

const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_professional_profileRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_professional_profileRoutesJS as RequestHandler);
} else if (user_professional_profileRoutesJS && typeof (user_professional_profileRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function, use it
    router.use(user_professional_profileRoutesJS as RequestHandler);
} else {
    // Fallback or error
    console.error('user-professional-profile.js did not export a valid router');
}
}

export default router;
