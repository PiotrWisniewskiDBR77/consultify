/**
 * Ai/frameworks/strategicRecommendationService Service
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
const ai/frameworks/strategicRecommendationServiceServiceJS = require('../../services/ai/frameworks/strategicRecommendationService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/frameworks/strategicRecommendationServiceService = ai/frameworks/strategicRecommendationServiceServiceJS.default || ai/frameworks/strategicRecommendationServiceServiceJS;

// Export default instance (for backward compatibility)
export default ai/frameworks/strategicRecommendationServiceService;

// Also export named exports if they exist
if (typeof ai/frameworks/strategicRecommendationServiceServiceJS === 'object' && ai/frameworks/strategicRecommendationServiceServiceJS !== null) {
    Object.keys(ai/frameworks/strategicRecommendationServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/frameworks/strategicRecommendationServiceServiceJS[key];
        }
    });
}
