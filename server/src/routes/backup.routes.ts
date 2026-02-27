/**
 * backup Routes (degraded mode)
 * Read operations return an empty contract to avoid hard UI dead-ends.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js'; // Optional
import logger from '../utils/Logger.js';

const router = Router();

router.use((req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.json({ feature: 'backup', status: 'not_configured', items: [], writable: false });
  }
  logger.warn(`[backup] Write blocked - feature not configured`);
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
});

export default router;
