/**
 * PromptAssistant Routes
 * API endpoints for prompt-assistant
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const prompt_assistantRoutesJSPromise = (async () => {
    const module = await import('../../routes/prompt-assistant.js');
    return module.default || module;
})();
const prompt_assistantRoutesJS = prompt_assistantRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof prompt_assistantRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(prompt_assistantRoutesJS);
} else if (prompt_assistantRoutesJS.default) {
    // If it has a default export
    router.use(prompt_assistantRoutesJS.default);
} else {
    // If it's the router itself
    router.use(prompt_assistantRoutesJS);
}

export default router;
