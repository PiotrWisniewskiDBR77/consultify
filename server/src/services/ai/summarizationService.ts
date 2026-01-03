/**
 * Ai/summarizationService Service
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
const ai/summarizationServiceServiceJS = require('../../services/ai/summarizationService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/summarizationServiceService = ai/summarizationServiceServiceJS.default || ai/summarizationServiceServiceJS;

// Export default instance (for backward compatibility)
export default ai/summarizationServiceService;

// Also export named exports if they exist
if (typeof ai/summarizationServiceServiceJS === 'object' && ai/summarizationServiceServiceJS !== null) {
    Object.keys(ai/summarizationServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/summarizationServiceServiceJS[key];
        }
    });
}
