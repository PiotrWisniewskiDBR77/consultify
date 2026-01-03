/**
 * Ai/processors/videoProcessor Service
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
const ai/processors/videoProcessorServiceJS = require('../../services/ai/processors/videoProcessor.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/processors/videoProcessorService = ai/processors/videoProcessorServiceJS.default || ai/processors/videoProcessorServiceJS;

// Export default instance (for backward compatibility)
export default ai/processors/videoProcessorService;

// Also export named exports if they exist
if (typeof ai/processors/videoProcessorServiceJS === 'object' && ai/processors/videoProcessorServiceJS !== null) {
    Object.keys(ai/processors/videoProcessorServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/processors/videoProcessorServiceJS[key];
        }
    });
}
