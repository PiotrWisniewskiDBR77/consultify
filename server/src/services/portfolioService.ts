/**
 * PortfolioService Service
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
const portfolioServiceServiceJS = require('../../services/portfolioService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const portfolioServiceService = portfolioServiceServiceJS.default || portfolioServiceServiceJS;

// Export default instance (for backward compatibility)
export default portfolioServiceService;

// Also export named exports if they exist
if (typeof portfolioServiceServiceJS === 'object' && portfolioServiceServiceJS !== null) {
    Object.keys(portfolioServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = portfolioServiceServiceJS[key];
        }
    });
}
