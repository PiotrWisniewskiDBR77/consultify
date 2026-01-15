/**
 * Mediaingestion Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.js';

// Lazy load the JS service module - file is in the ai directory
// The .js file is a re-export wrapper that exports from the .ts file
// Path is relative to services/ directory: ./ai/mediaIngestionService.js
const loadMediaingestion = createCachedLazyService('./ai/mediaIngestionService.js');

// Export default instance (for backward compatibility)
export default loadMediaingestion();
