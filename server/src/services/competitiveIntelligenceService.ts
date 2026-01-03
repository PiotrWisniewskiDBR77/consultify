/**
 * CompetitiveIntelligenceService Service
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
const competitiveIntelligenceServiceServiceJS = require('../../services/competitiveIntelligenceService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const competitiveIntelligenceServiceService = competitiveIntelligenceServiceServiceJS.default || competitiveIntelligenceServiceServiceJS;

// Export default instance (for backward compatibility)
export default competitiveIntelligenceServiceService;

// Also export named exports if they exist
if (typeof competitiveIntelligenceServiceServiceJS === 'object' && competitiveIntelligenceServiceServiceJS !== null) {
    Object.keys(competitiveIntelligenceServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = competitiveIntelligenceServiceServiceJS[key];
        }
    });
}
