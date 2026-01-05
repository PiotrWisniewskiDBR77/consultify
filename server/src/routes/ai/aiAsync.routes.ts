/**
 * AiAsync Routes
 * API endpoints for aiAsync
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../../utils/lazyRouteLoader.js';

const router = createLazyRoute('./aiAsync.js');

export default router;
