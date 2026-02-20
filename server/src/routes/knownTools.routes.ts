/**
 * Known Tools Routes
 * Tools library (T018/T021) backed by `tools` registry table.
 */

import { Router } from 'express';

import KnownToolsController from '../controllers/KnownToolsController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);

router.get('/', KnownToolsController.listKnownTools);
router.get('/:toolType', KnownToolsController.getKnownTool);

export default router;
