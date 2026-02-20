import { Router } from 'express';

import { HealthCheckController } from '../controllers/HealthCheckController.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';

const router = Router();

// Apply rate limiting (fallback to no-op if not available)
const safeRateLimiter =
  typeof defaultRateLimiter === 'function'
    ? defaultRateLimiter
    : (_req: unknown, _res: unknown, next: () => void) => next();
router.use(safeRateLimiter);

// /ping (handled in index.ts for raw speed often, but good to expose here too if mounted)
router.get('/ping', HealthCheckController.ping);

// /api/health
router.get('/', HealthCheckController.checkHealth);

// /api/health/ready
router.get('/ready', HealthCheckController.checkReadiness);

// /api/health/live
router.get('/live', HealthCheckController.checkLiveness);

// /api/health/aggregated (T107)
router.get('/aggregated', HealthCheckController.aggregatedHealth);

export default router;
