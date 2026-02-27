/**
 * user-profile-extended Routes (degraded mode)
 * Read operations return a safe empty profile contract.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js'; // Optional
import logger from '../../utils/Logger.js';

const router = Router();

router.use((req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.json({
      success: true,
      feature: 'user-profile-extended',
      status: 'not_configured',
      profile: {},
      writable: false,
    });
  }
  logger.warn(`[user-profile-extended] Write blocked - feature not configured`);
  return res.status(501).json({
    success: false,
    code: 'FEATURE_NOT_CONFIGURED',
    error: 'User profile (extended) write operations are not configured',
    feature: 'user-profile-extended',
    writable: false,
  });
});

export default router;
