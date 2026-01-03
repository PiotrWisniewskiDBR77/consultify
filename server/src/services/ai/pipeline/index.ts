/**
 * Ai/pipeline/index Service
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
const ai/pipeline/indexServiceJS = require('../../services/ai/pipeline/index.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/pipeline/indexService = ai/pipeline/indexServiceJS.default || ai/pipeline/indexServiceJS;

// Export default instance (for backward compatibility)
export default ai/pipeline/indexService;

// Also export named exports if they exist
if (typeof ai/pipeline/indexServiceJS === 'object' && ai/pipeline/indexServiceJS !== null) {
    Object.keys(ai/pipeline/indexServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/pipeline/indexServiceJS[key];
        }
    });
}
