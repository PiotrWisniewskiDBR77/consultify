/**
 * Intelligentresearch Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.ts';

// Lazy load the JS service module
const loadIntelligentresearch = createCachedLazyService('../../services/ai/intelligentResearch.js');

// Export default instance (for backward compatibility)
export default loadIntelligentresearch();
