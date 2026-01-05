/**
 * AiActions Routes
 * API endpoints for aiActions
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../../utils/lazyRouteLoader.js';

const router = createLazyRoute('./aiActions.js');

export default router;
