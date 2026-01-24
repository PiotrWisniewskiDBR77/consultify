/**
 * UserSettingsTemplates Routes
 * API endpoints for user-settings-templates
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { type RequestHandler, Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/user-settings-templates.js');
const user_settings_templatesRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_settings_templatesRoutesJS === 'function') {
  // If it's a router function, use it
  router.use(user_settings_templatesRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (
  user_settings_templatesRoutesJS &&
  typeof (user_settings_templatesRoutesJS as { handle?: unknown }).handle === 'function'
) {
  // If it's a router function or Router object, use it
  router.use(user_settings_templatesRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
  // Fallback or error
  console.error('user-settings-templates.js did not export a valid router');
}
export default router;
