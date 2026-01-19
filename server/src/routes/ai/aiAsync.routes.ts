/**
 * AI Async Routes
 */
import { Router } from 'express';

import AIAsyncController from '../../controllers/ai/AIAsyncController.js';
import { verifyToken } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/ai-async/jobs
 */
router.post('/jobs', AIAsyncController.submitJob);

/**
 * GET /api/ai-async/jobs/:id
 */
router.get('/jobs/:id', AIAsyncController.getJobStatus);

export default router;
