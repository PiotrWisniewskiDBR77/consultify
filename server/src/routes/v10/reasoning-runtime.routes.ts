import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { reasoningRuntimeService, type ReasoningRuntimeService } from '../../services/v10/reasoning/reasoningRuntimeService.js';
import { researchRuntimeService } from '../../services/v10/research/researchRuntimeService.js';
import { ReasoningFastChatRequestSchema } from '../../types/v10/reasoning-runtime.js';
import { ResearchMissionPlanRequestSchema } from '../../types/v10/research-runtime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { respondWithData, runtimeMeta, withRuntimeScope } from './runtimeRouteUtils.js';

export const V10_REASONING_RUNTIME_CONTRACT = 'reasoning_runtime_wave_a_v1';

export function createReasoningRuntimeRouter(service: ReasoningRuntimeService = reasoningRuntimeService) {
  const router = Router();

  router.use(verifyToken);
  router.use(requireOrganization);

  router.post(
    '/fast-chat',
    validateBody(ReasoningFastChatRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const result = service.fastChat(req.body);
      return res.status(200).json({ data: result, meta: runtimeMeta(V10_REASONING_RUNTIME_CONTRACT) });
    })
  );

  router.post(
    '/delegate/research/plan',
    validateBody(ResearchMissionPlanRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      return await respondWithData(
        res,
        V10_REASONING_RUNTIME_CONTRACT,
        () => researchRuntimeService.planMission(withRuntimeScope(req))
      );
    })
  );

  router.get(
    '/contract',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
      return res
        .status(200)
        .json({ data: { contract: V10_REASONING_RUNTIME_CONTRACT }, meta: runtimeMeta(V10_REASONING_RUNTIME_CONTRACT) });
    })
  );

  return router;
}

export default createReasoningRuntimeRouter();

