/**
 * AiMemory Routes
 * API endpoints for ai-memory
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('../../routes/ai-memory.js');

export default router;
