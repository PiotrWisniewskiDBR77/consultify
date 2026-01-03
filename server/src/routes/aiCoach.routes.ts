/**
 * AiCoach Routes
 * API endpoints for aiCoach
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createLazyRoute } from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('../../routes/aiCoach.js');

export default router;
