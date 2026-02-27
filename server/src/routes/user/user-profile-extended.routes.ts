/**
 * user-profile-extended Routes (degraded mode)
 * Read operations return a safe empty profile contract.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js'; // Optional
import logger from '../../utils/Logger.js';

const router = Router();

router.use((req, res) => {
  logger.warn(`[user-profile-extended] Feature not configured`);
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
});

export default router;
