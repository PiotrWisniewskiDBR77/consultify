import { Router } from 'express';

import { AIPromptsController } from '../../controllers/ai/AIPromptsController.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

router.get('/', asyncHandler(AIPromptsController.getPrompts));
router.post('/', asyncHandler(AIPromptsController.createPrompt));
router.get('/capabilities', asyncHandler(AIPromptsController.getCapabilities));
router.get('/:id', asyncHandler(AIPromptsController.getPromptById));
router.put('/:id', asyncHandler(AIPromptsController.updatePrompt));
router.delete('/:id', asyncHandler(AIPromptsController.deletePrompt));
router.get('/:id/versions', asyncHandler(AIPromptsController.getVersions));
router.post('/:id/test', asyncHandler(AIPromptsController.testPrompt));
router.post('/:id/clone', asyncHandler(AIPromptsController.clonePrompt));

export default router;
