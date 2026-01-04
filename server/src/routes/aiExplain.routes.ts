/**
 * AiExplain Routes
 * API endpoints for aiExplain
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('../../routes/aiExplain.js');

export default router;
