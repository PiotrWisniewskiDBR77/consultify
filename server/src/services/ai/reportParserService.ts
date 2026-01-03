/**
 * Reportparser Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadReportparser = createCachedLazyService('../../services/ai/reportParserService.js');

// Export default instance (for backward compatibility)
export default loadReportparser();
