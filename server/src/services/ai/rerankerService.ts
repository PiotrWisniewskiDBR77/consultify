/**
 * Ai/rerankerService Service
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
const ai/rerankerServiceServiceJS = require('../../services/ai/rerankerService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/rerankerServiceService = ai/rerankerServiceServiceJS.default || ai/rerankerServiceServiceJS;

// Export default instance (for backward compatibility)
export default ai/rerankerServiceService;

// Also export named exports if they exist
if (typeof ai/rerankerServiceServiceJS === 'object' && ai/rerankerServiceServiceJS !== null) {
    Object.keys(ai/rerankerServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/rerankerServiceServiceJS[key];
        }
    });
}
