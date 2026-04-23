import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  learningRuntimeService,
  type LearningRuntimeService,
} from '../../services/v10/learning/learningRuntimeService.js';
import { LearningIngestRequestSchema } from '../../types/v10/learning-runtime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const V10_LEARNING_RUNTIME_CONTRACT = 'learning_runtime_wave_a_v1';

function meta() {
  return { version: 'v10' as const, contract: V10_LEARNING_RUNTIME_CONTRACT };
}

export function createLearningRuntimeRouter(service: LearningRuntimeService = learningRuntimeService) {
  const router = Router();

  router.use(verifyToken);
  router.use(requireOrganization);

  router.post(
    '/ingest',
    validateBody(LearningIngestRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = service.ingest(req.body);
      return res.status(200).json({ data: result, meta: meta() });
    })
  );

  router.get(
    '/contract',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
      return res.status(200).json({ data: { contract: V10_LEARNING_RUNTIME_CONTRACT }, meta: meta() });
    })
  );

  return router;
}

export default createLearningRuntimeRouter();

