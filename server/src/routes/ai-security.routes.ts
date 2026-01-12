/**
 * AiSecurity Routes
 * API endpoints for ai-security
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('../../routes/ai-security.js');

export default router;
