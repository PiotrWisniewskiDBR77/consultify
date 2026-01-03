/**
 * AiCharterGeneratorService Service
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
const aiCharterGeneratorServiceServiceJS = require('../../services/aiCharterGeneratorService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const aiCharterGeneratorServiceService = aiCharterGeneratorServiceServiceJS.default || aiCharterGeneratorServiceServiceJS;

// Export default instance (for backward compatibility)
export default aiCharterGeneratorServiceService;

// Also export named exports if they exist
if (typeof aiCharterGeneratorServiceServiceJS === 'object' && aiCharterGeneratorServiceServiceJS !== null) {
    Object.keys(aiCharterGeneratorServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = aiCharterGeneratorServiceServiceJS[key];
        }
    });
}
