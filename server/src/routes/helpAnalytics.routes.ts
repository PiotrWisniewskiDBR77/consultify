/**
 * helpAnalytics Routes (degraded mode)
 * Returns empty-but-valid data so the frontend dashboard degrades gracefully
 * instead of showing a generic 503 error.
 */
import { Router } from 'express';

import logger from '../utils/Logger.js';

const router = Router();

router.get('/dashboard', (req, res) => {
  logger.info('[helpAnalytics] Dashboard requested — returning empty contract (analytics not yet configured)');
  return res.json({
    success: true,
    degraded: true,
    message: 'Help analytics are not yet configured. Data will appear here once analytics collection is enabled.',
    data: {
      period: { start: new Date().toISOString(), end: new Date().toISOString() },
      totalViews: 0,
      totalSearches: 0,
      topArticles: [],
      topSearchTerms: [],
      feedbackSummary: { helpful: 0, notHelpful: 0 },
    },
  });
});

router.use((req, res) => {
  logger.info(`[helpAnalytics] ${req.method} ${req.path} — feature not yet configured`);
  return res.json({
    success: true,
    degraded: true,
    message: 'Help analytics are not yet configured.',
    data: null,
  });
});

export default router;
