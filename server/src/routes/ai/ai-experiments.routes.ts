import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { AIExperimentsController } from '../../controllers/ai/AIExperimentsController.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

router.get('/', asyncHandler(AIExperimentsController.getExperiments));
router.post('/', asyncHandler(AIExperimentsController.createExperiment));
router.get('/:id', asyncHandler(AIExperimentsController.getExperimentById));
router.put('/:id/status', asyncHandler(AIExperimentsController.updateStatus));
router.get('/:id/results', asyncHandler(AIExperimentsController.getResults));
router.delete('/:id', asyncHandler(AIExperimentsController.deleteExperiment));

export default router;
