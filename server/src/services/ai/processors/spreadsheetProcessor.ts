/**
 * Ai/processors/spreadsheetProcessor Service
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
const ai/processors/spreadsheetProcessorServiceJS = require('../../services/ai/processors/spreadsheetProcessor.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/processors/spreadsheetProcessorService = ai/processors/spreadsheetProcessorServiceJS.default || ai/processors/spreadsheetProcessorServiceJS;

// Export default instance (for backward compatibility)
export default ai/processors/spreadsheetProcessorService;

// Also export named exports if they exist
if (typeof ai/processors/spreadsheetProcessorServiceJS === 'object' && ai/processors/spreadsheetProcessorServiceJS !== null) {
    Object.keys(ai/processors/spreadsheetProcessorServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/processors/spreadsheetProcessorServiceJS[key];
        }
    });
}
