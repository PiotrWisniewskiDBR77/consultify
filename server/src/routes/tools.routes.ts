/**
 * Tools Routes
 * Tools -> Initiatives workflow endpoints
 */

import { Router } from 'express';

import ToolControllerRaw from '../controllers/ToolController.js';
const ToolController = ToolControllerRaw as any;
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  ApproveToolSchema,
  CreateToolSessionSchema,
  GenerateInitiativesSchema,
  RequestReviewSchema,
  SendBackSchema,
  UpdateToolSessionSchema,
} from '../validators/tool.validators.js';

const router = Router();

router.use(authRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

router.post('/', validateBody(CreateToolSessionSchema), ToolController.createToolSession);
router.get('/', ToolController.listToolSessions);
router.get('/:toolId', ToolController.getToolSession);
router.put('/:toolId', validateBody(UpdateToolSessionSchema), ToolController.updateToolSession);
router.post(
  '/:toolId/request-review',
  validateBody(RequestReviewSchema),
  ToolController.requestReview
);
router.post('/:toolId/approve', validateBody(ApproveToolSchema), ToolController.approveTool);
router.post('/:toolId/send-back', validateBody(SendBackSchema), ToolController.sendBackToDraft);
router.post(
  '/:toolId/generate-initiatives',
  validateBody(GenerateInitiativesSchema),
  ToolController.generateInitiatives
);
router.get('/:toolId/generated-initiatives', ToolController.getGeneratedInitiatives);

export default router;
