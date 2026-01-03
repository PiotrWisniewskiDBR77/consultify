/**
 * UserKeyboardShortcuts Routes
 * API endpoints for user-keyboard-shortcuts
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const user_keyboard_shortcutsRoutesJSPromise = (async () => {
    const module = await import('../../routes/user-keyboard-shortcuts.js');
    return module.default || module;
})();
const user_keyboard_shortcutsRoutesJS = user_keyboard_shortcutsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_keyboard_shortcutsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_keyboard_shortcutsRoutesJS);
} else if (user_keyboard_shortcutsRoutesJS.default) {
    // If it has a default export
    router.use(user_keyboard_shortcutsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(user_keyboard_shortcutsRoutesJS);
}

export default router;
