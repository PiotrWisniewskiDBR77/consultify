/**
 * Ai/intelligence/industryIntelligenceService Service
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
const ai/intelligence/industryIntelligenceServiceServiceJS = require('../../services/ai/intelligence/industryIntelligenceService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/intelligence/industryIntelligenceServiceService = ai/intelligence/industryIntelligenceServiceServiceJS.default || ai/intelligence/industryIntelligenceServiceServiceJS;

// Export default instance (for backward compatibility)
export default ai/intelligence/industryIntelligenceServiceService;

// Also export named exports if they exist
if (typeof ai/intelligence/industryIntelligenceServiceServiceJS === 'object' && ai/intelligence/industryIntelligenceServiceServiceJS !== null) {
    Object.keys(ai/intelligence/industryIntelligenceServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/intelligence/industryIntelligenceServiceServiceJS[key];
        }
    });
}
