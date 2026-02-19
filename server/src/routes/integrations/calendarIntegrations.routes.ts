/**
 * CalendarIntegrations Routes
 * API endpoints for calendar integrations
 *
 * Stub router - calendar integration endpoints to be implemented.
 */

import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.status(503).json({
    error: 'Calendar integrations are not available',
    code: 'FEATURE_UNAVAILABLE',
  });
});

export default router;
