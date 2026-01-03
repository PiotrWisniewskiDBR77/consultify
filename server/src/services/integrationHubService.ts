/**
 * IntegrationHubService Service
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
const integrationHubServiceServiceJS = require('../../services/integrationHubService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const integrationHubServiceService = integrationHubServiceServiceJS.default || integrationHubServiceServiceJS;

// Export default instance (for backward compatibility)
export default integrationHubServiceService;

// Also export named exports if they exist
if (typeof integrationHubServiceServiceJS === 'object' && integrationHubServiceServiceJS !== null) {
    Object.keys(integrationHubServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = integrationHubServiceServiceJS[key];
        }
    });
}
