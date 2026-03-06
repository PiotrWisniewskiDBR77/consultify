// DEPRECATED: Use /api/assessment-workflow-v2 instead. This file is kept for backward compatibility.
// V4-ASMT-02: All new assessment features go to assessment-workflow-v2.routes.ts

/**
 * assessment Routes (degraded mode)
 * Read operations return an empty contract to avoid hard UI dead-ends.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js'; // Optional
import logger from '../../utils/Logger.js';

const router = Router();

router.use((req, res) => {
  logger.warn(`[assessment] Feature not configured`);
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
});

export default router;
