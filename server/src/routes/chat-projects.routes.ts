/**
 * ChatProjects Routes
 * API endpoints for chat-projects
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const chatModule = (await import('./chat-projects.js')) as any;
const chat_projectsRoutesJS = chatModule.default || chatModule;

// Create router and apply JS routes
const router = Router();

// Apply rate limiting
router.use(aiRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof chat_projectsRoutesJS === 'function' ||
    (chat_projectsRoutesJS && typeof chat_projectsRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(chat_projectsRoutesJS);
} else {
    // Fallback or error
    logger.error('chat-projects.js did not export a valid router');
}

export default router;
