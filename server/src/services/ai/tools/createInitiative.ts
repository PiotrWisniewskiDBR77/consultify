/**
 * Ai/tools/createInitiative Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript with proper types
 */

import { createRequire } from 'module';
import logger from '../utils/Logger.js';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const ai/tools/createInitiativeServiceJS = require('../../services/ai/tools/createInitiative.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/tools/createInitiativeService = ai/tools/createInitiativeServiceJS.default || ai/tools/createInitiativeServiceJS;

// Export default instance (for backward compatibility)
export default ai/tools/createInitiativeService;

// Also export named exports if they exist
if (typeof ai/tools/createInitiativeServiceJS === 'object' && ai/tools/createInitiativeServiceJS !== null) {
    Object.keys(ai/tools/createInitiativeServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/tools/createInitiativeServiceJS[key];
        }
    });
}
