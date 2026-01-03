/**
 * ReportEmailService Service
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
const reportEmailServiceServiceJS = require('../../services/reportEmailService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const reportEmailServiceService = reportEmailServiceServiceJS.default || reportEmailServiceServiceJS;

// Export default instance (for backward compatibility)
export default reportEmailServiceService;

// Also export named exports if they exist
if (typeof reportEmailServiceServiceJS === 'object' && reportEmailServiceServiceJS !== null) {
    Object.keys(reportEmailServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = reportEmailServiceServiceJS[key];
        }
    });
}
