/**
 * Ai/processors/imageProcessor Service
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
const ai/processors/imageProcessorServiceJS = require('../../services/ai/processors/imageProcessor.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/processors/imageProcessorService = ai/processors/imageProcessorServiceJS.default || ai/processors/imageProcessorServiceJS;

// Export default instance (for backward compatibility)
export default ai/processors/imageProcessorService;

// Also export named exports if they exist
if (typeof ai/processors/imageProcessorServiceJS === 'object' && ai/processors/imageProcessorServiceJS !== null) {
    Object.keys(ai/processors/imageProcessorServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/processors/imageProcessorServiceJS[key];
        }
    });
}
