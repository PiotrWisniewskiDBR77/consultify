/**
 * user-privacy-extended Routes (degraded mode)
 * Read operations return a safe privacy-settings contract.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js'; // Optional
import logger from '../../utils/Logger.js';

const router = Router();

router.use((req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.json({
      success: true,
      feature: 'user-privacy-extended',
      status: 'not_configured',
      settings: {},
      writable: false,
    });
  }
  logger.warn(`[user-privacy-extended] Write blocked - feature not configured`);
  return res.status(501).json({
    success: false,
    code: 'FEATURE_NOT_CONFIGURED',
    error: 'User privacy settings (extended) write operations are not configured',
    feature: 'user-privacy-extended',
    writable: false,
  });
});

export default router;
