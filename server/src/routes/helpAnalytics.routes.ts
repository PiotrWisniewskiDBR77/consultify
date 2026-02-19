/**
 * helpAnalytics Routes (Feature unavailable)
 * Honest runtime contract: return 503 until implemented.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js'; // Optional
import logger from '../utils/Logger.js';

const router = Router();

// Stub for missing JS routes
router.use((req, res) => {
  logger.warn(`[helpAnalytics] Feature unavailable`);
  res.status(503).json({
    error: 'Feature unavailable',
    code: 'FEATURE_UNAVAILABLE',
    feature: 'helpAnalytics',
  });
});

export default router;
