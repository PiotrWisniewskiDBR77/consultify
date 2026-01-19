import { Router } from 'express';

import { AITrainingController } from '../../controllers/ai/AITrainingController.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

router.get('/', asyncHandler(AITrainingController.listFeedback));
router.post('/', asyncHandler(AITrainingController.submitFeedback));
router.get('/stats', asyncHandler(AITrainingController.getStats));
router.get('/export', asyncHandler(AITrainingController.exportFeedback));
router.delete('/:id', asyncHandler(AITrainingController.deleteFeedback));

export default router;
