/**
 * Ai/tools/updateAssessmentScore Service
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
const ai/tools/updateAssessmentScoreServiceJS = require('../../services/ai/tools/updateAssessmentScore.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/tools/updateAssessmentScoreService = ai/tools/updateAssessmentScoreServiceJS.default || ai/tools/updateAssessmentScoreServiceJS;

// Export default instance (for backward compatibility)
export default ai/tools/updateAssessmentScoreService;

// Also export named exports if they exist
if (typeof ai/tools/updateAssessmentScoreServiceJS === 'object' && ai/tools/updateAssessmentScoreServiceJS !== null) {
    Object.keys(ai/tools/updateAssessmentScoreServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/tools/updateAssessmentScoreServiceJS[key];
        }
    });
}
