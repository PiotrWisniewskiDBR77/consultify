import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { AIMemoryController } from '../../controllers/ai/AIMemoryController.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

router.get('/', asyncHandler(AIMemoryController.listMemories));
router.get('/context', asyncHandler(AIMemoryController.getContext));
router.put('/:key', asyncHandler(AIMemoryController.updateMemory));

export default router;
