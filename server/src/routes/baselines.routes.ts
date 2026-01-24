/**
 * Baselines Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 */
import { Router } from 'express';

import { BaselinesController } from '../controllers/BaselinesController.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

router.post('/:roadmapId/capture', BaselinesController.capture);
router.get('/:roadmapId/current', BaselinesController.getCurrent);
router.get('/:roadmapId/variance', BaselinesController.getVariance);

export default router;
