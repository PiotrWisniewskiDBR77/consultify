/**
 * Ai/processors/urlProcessor Service
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
const ai/processors/urlProcessorServiceJS = require('../../services/ai/processors/urlProcessor.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/processors/urlProcessorService = ai/processors/urlProcessorServiceJS.default || ai/processors/urlProcessorServiceJS;

// Export default instance (for backward compatibility)
export default ai/processors/urlProcessorService;

// Also export named exports if they exist
if (typeof ai/processors/urlProcessorServiceJS === 'object' && ai/processors/urlProcessorServiceJS !== null) {
    Object.keys(ai/processors/urlProcessorServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/processors/urlProcessorServiceJS[key];
        }
    });
}
