/**
 * PromptAssistant Routes
 * API endpoints for prompt-assistant
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/prompt-assistant.js');
const prompt_assistantRoutesJS = module.default || module;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof prompt_assistantRoutesJS === 'function' ||
    (prompt_assistantRoutesJS && typeof prompt_assistantRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(prompt_assistantRoutesJS);
} else {
    // Fallback or error
    logger.error('prompt-assistant.js did not export a valid router');
}

export default router;
