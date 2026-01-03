/**
 * Ai/adaptiveResponseService Service
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
const ai/adaptiveResponseServiceServiceJS = require('../../services/ai/adaptiveResponseService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/adaptiveResponseServiceService = ai/adaptiveResponseServiceServiceJS.default || ai/adaptiveResponseServiceServiceJS;

// Export default instance (for backward compatibility)
export default ai/adaptiveResponseServiceService;

// Also export named exports if they exist
if (typeof ai/adaptiveResponseServiceServiceJS === 'object' && ai/adaptiveResponseServiceServiceJS !== null) {
    Object.keys(ai/adaptiveResponseServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/adaptiveResponseServiceServiceJS[key];
        }
    });
}
