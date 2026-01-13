import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { AIExplainabilityController } from '../../controllers/ai/AIExplainabilityController.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

router.get('/evidences', asyncHandler(AIExplainabilityController.listEvidences));
router.get(
  '/validation/:validationId',
  asyncHandler(AIExplainabilityController.getValidationResult)
);
router.get(
  '/export/:entityType/:entityId',
  asyncHandler(AIExplainabilityController.exportEvidencePack)
);
router.get('/:entityType/:entityId', asyncHandler(AIExplainabilityController.getExplanation));
router.get('/:entityType/:entityId/evidence', asyncHandler(AIExplainabilityController.getEvidence));
router.post(
  '/:entityType/:entityId/validate',
  asyncHandler(AIExplainabilityController.validateExplanation)
);

export default router;
