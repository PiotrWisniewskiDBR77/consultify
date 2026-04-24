import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  ResearchRuntimeInputError,
  ResearchRuntimeMissionNotFoundError,
  type ResearchRuntimeService,
  researchRuntimeService,
} from '../../services/v10/research/researchRuntimeService.js';
import {
  ResearchMissionPlanRequestSchema,
  ResearchMissionRequestSchema,
  ResearchMissionSummaryRequestSchema,
  ResearchMissionWatchRequestSchema,
} from '../../types/v10/research-runtime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { respondWithData, runtimeMeta, withRuntimeScope } from './runtimeRouteUtils.js';

export const V10_RESEARCH_RUNTIME_CONTRACT = 'research_runtime_wave_a_v1';

function handleResearchRuntimeError(res: Response, error: unknown) {
  if (
    error instanceof ResearchRuntimeMissionNotFoundError ||
    error instanceof ResearchRuntimeInputError
  ) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      meta: runtimeMeta(V10_RESEARCH_RUNTIME_CONTRACT),
    });
  }
  throw error;
}

export function createResearchRuntimeRouter(
  service: ResearchRuntimeService = researchRuntimeService
) {
  const router = Router();

  router.use(verifyToken);
  router.use(requireOrganization);

  router.post(
    '/missions/plan',
    validateBody(ResearchMissionPlanRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_RESEARCH_RUNTIME_CONTRACT, () =>
          service.planMission(withRuntimeScope(req))
        );
      } catch (error) {
        return handleResearchRuntimeError(res, error);
      }
    })
  );

  router.post(
    '/missions/start',
    validateBody(ResearchMissionRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_RESEARCH_RUNTIME_CONTRACT, () =>
          service.startMission(withRuntimeScope(req))
        );
      } catch (error) {
        return handleResearchRuntimeError(res, error);
      }
    })
  );

  router.post(
    '/missions/watch',
    validateBody(ResearchMissionWatchRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_RESEARCH_RUNTIME_CONTRACT, () =>
          service.watchMission(withRuntimeScope(req))
        );
      } catch (error) {
        return handleResearchRuntimeError(res, error);
      }
    })
  );

  router.post(
    '/missions/summary',
    validateBody(ResearchMissionSummaryRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_RESEARCH_RUNTIME_CONTRACT, () =>
          service.getMissionSummary(withRuntimeScope(req))
        );
      } catch (error) {
        return handleResearchRuntimeError(res, error);
      }
    })
  );

  router.get(
    '/contract',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
      return res.status(200).json({
        data: { contract: V10_RESEARCH_RUNTIME_CONTRACT },
        meta: runtimeMeta(V10_RESEARCH_RUNTIME_CONTRACT),
      });
    })
  );

  return router;
}

export default createResearchRuntimeRouter();
