/**
 * Settings Routes
 * API endpoints for settings
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('./settings.js');

export default router;
