/**
 * AiInfrastructure Routes
 * API endpoints for ai-infrastructure
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../../utils/lazyRouteLoader.js';

const router = createLazyRoute('./ai-infrastructure.js');

export default router;
