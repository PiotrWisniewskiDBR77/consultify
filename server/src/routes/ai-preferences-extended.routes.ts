/**
 * AiPreferencesExtended Routes
 * API endpoints for ai-preferences-extended
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('./ai-preferences-extended.js');

export default router;
