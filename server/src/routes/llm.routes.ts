/**
 * Llm Routes
 * API endpoints for llm
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('./llm.js');

export default router;
