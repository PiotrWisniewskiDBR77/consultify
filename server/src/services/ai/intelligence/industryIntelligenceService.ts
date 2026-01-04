/**
 * Industryintelligence Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.ts';

// Lazy load the JS service module
const loadIndustryintelligence = createCachedLazyService(
    '../../services/ai/intelligence/industryIntelligenceService.js',
);

// Export default instance (for backward compatibility)
export default loadIndustryintelligence();
