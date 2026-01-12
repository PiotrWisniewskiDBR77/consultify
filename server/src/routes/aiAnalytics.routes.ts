/**
 * AiAnalytics Routes
 * API endpoints for aiAnalytics
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('../../routes/aiAnalytics.js');

export default router;
