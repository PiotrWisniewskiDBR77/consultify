import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { AICoachController } from '../../controllers/ai/AICoachController.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

router.get('/report/:orgId', asyncHandler(AICoachController.getAdvisoryReport));
router.get('/signals/:orgId', asyncHandler(AICoachController.getSignals));
router.get('/pmo-analysis', asyncHandler(AICoachController.getPMOAnalysis));

export default router;
