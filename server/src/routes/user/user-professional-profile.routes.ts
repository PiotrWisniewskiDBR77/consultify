/**
 * user-professional-profile Routes (degraded mode)
 * Read operations return a safe empty professional profile contract.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js'; // Optional
import logger from '../../utils/Logger.js';

const router = Router();

router.use((req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.json({
      success: true,
      feature: 'user-professional-profile',
      status: 'not_configured',
      profile: {},
      writable: false,
    });
  }
  logger.warn(`[user-professional-profile] Write blocked - feature not configured`);
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
});

export default router;
