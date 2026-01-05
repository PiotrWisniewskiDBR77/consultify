/**
 * AiLearning Routes
 * API endpoints for aiLearning
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../../utils/lazyRouteLoader.js';

const router = createLazyRoute('./aiLearning.js');

export default router;
