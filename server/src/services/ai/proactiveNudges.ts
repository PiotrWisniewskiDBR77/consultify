/**
 * Ai/proactiveNudges Service
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
const ai/proactiveNudgesServiceJS = require('../../services/ai/proactiveNudges.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/proactiveNudgesService = ai/proactiveNudgesServiceJS.default || ai/proactiveNudgesServiceJS;

// Export default instance (for backward compatibility)
export default ai/proactiveNudgesService;

// Also export named exports if they exist
if (typeof ai/proactiveNudgesServiceJS === 'object' && ai/proactiveNudgesServiceJS !== null) {
    Object.keys(ai/proactiveNudgesServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/proactiveNudgesServiceJS[key];
        }
    });
}
