import { Router } from 'express';

import ToolAssetsController from '../controllers/ToolAssetsController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);

router.get('/audit', ToolAssetsController.getAuditReport);
router.get('/:toolSlug', ToolAssetsController.getAssetsByTool);
// Mutates the GLOBAL static tool-asset catalog (thumbnails/videos), not org data —
// restrict writes to platform admins/superadmins (consistent with other global mutations).
router.put(
  '/:toolSlug/:assetType',
  requireRole('super_admin', 'admin'),
  ToolAssetsController.updateAssetStatus
);

export default router;
