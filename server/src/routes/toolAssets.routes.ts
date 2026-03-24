import { Router } from 'express';

import ToolAssetsController from '../controllers/ToolAssetsController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);

router.get('/audit', ToolAssetsController.getAuditReport);
router.get('/:toolSlug', ToolAssetsController.getAssetsByTool);
router.put('/:toolSlug/:assetType', ToolAssetsController.updateAssetStatus);

export default router;
