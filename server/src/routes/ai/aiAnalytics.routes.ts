import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { AIAnalyticsController } from '../../controllers/ai/AIAnalyticsController.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use((req, res, next) => {
    console.log(`[aiAnalytics.routes] Request: ${req.method} ${req.url}`);
    next();
});

router.use(verifyToken);

router.get('/dashboard', asyncHandler(AIAnalyticsController.getDashboard));
router.get('/actions', asyncHandler(AIAnalyticsController.getActions));
router.get('/actions/:actionId', asyncHandler(AIAnalyticsController.getActionDetails));
router.get('/playbooks', asyncHandler(AIAnalyticsController.getPlaybooks));
router.get('/playbooks/:playbookId', asyncHandler(AIAnalyticsController.getPlaybookDetails));
router.get('/policies', asyncHandler(AIAnalyticsController.getPolicies));
router.get('/roi', asyncHandler(AIAnalyticsController.getROI));
router.get('/export', asyncHandler(AIAnalyticsController.exportData));

export default router;
