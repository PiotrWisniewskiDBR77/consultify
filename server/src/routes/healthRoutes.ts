import { Router } from 'express';

import { HealthCheckController } from '../controllers/HealthCheckController.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// /ping (handled in index.ts for raw speed often, but good to expose here too if mounted)
router.get('/ping', HealthCheckController.ping);

// /api/health
router.get('/', HealthCheckController.checkHealth);

// /api/health/ready
router.get('/ready', HealthCheckController.checkReadiness);

// /api/health/live
router.get('/live', HealthCheckController.checkLiveness);

export default router;
