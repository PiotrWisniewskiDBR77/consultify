/**
 * Ai/intelligence/benchmarkDataService Service
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
const ai/intelligence/benchmarkDataServiceServiceJS = require('../../services/ai/intelligence/benchmarkDataService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/intelligence/benchmarkDataServiceService = ai/intelligence/benchmarkDataServiceServiceJS.default || ai/intelligence/benchmarkDataServiceServiceJS;

// Export default instance (for backward compatibility)
export default ai/intelligence/benchmarkDataServiceService;

// Also export named exports if they exist
if (typeof ai/intelligence/benchmarkDataServiceServiceJS === 'object' && ai/intelligence/benchmarkDataServiceServiceJS !== null) {
    Object.keys(ai/intelligence/benchmarkDataServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/intelligence/benchmarkDataServiceServiceJS[key];
        }
    });
}
