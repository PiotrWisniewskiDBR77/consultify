/**
 * helpAnalytics Routes (degraded mode)
 * Read operations return an empty contract to avoid hard UI dead-ends.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js'; // Optional
import logger from '../utils/Logger.js';

const router = Router();

router.use((req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.json({
      feature: 'helpAnalytics',
      status: 'not_configured',
      items: [],
      writable: false,
    });
  }
  logger.warn(`[helpAnalytics] Write blocked - feature not configured`);
  return res.status(501).json({
    error: 'Feature not configured in this deployment',
    code: 'FEATURE_NOT_CONFIGURED',
    feature: 'helpAnalytics',
    writable: false,
  });
});

export default router;
