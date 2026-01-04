/**
 * Aimemorymetrics Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader';

// Lazy load the JS service module
const loadAimemorymetrics = createCachedLazyService('../../../services/ai/aiMemoryMetricsService.js');

// Export default instance (for backward compatibility)
export default loadAimemorymetrics();
