/**
 * Aiworkloadintelligence Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadAiworkloadintelligence = createCachedLazyService('../../services/aiWorkloadIntelligence.js');

// Export default instance (for backward compatibility)
export default loadAiworkloadintelligence();
