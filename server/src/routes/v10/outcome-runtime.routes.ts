import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  mapOutcomeRuntimeError,
  type OutcomeRuntimeService,
  outcomeRuntimeService,
} from '../../services/v10/outcome/outcomeRuntimeService.js';
import {
  OutcomeAcceptancePreviewBodySchema,
  OutcomeAcceptanceResolveBodySchema,
  OutcomeBusinessLinkBodySchema,
  OutcomeResolveRequestSchema,
  OutcomeSignalIngestBodySchema,
} from '../../types/v10/outcome-runtime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { respondWithData, runtimeMeta, withRuntimeScope } from './runtimeRouteUtils.js';

export const V10_OUTCOME_RUNTIME_CONTRACT = 'outcome_runtime_wave_b_v1';

async function createResponder(res: Response, operation: () => unknown): Promise<void> {
  try {
    await respondWithData(res, V10_OUTCOME_RUNTIME_CONTRACT, operation);
  } catch (error) {
    const mapped = mapOutcomeRuntimeError(error);
    res
      .status(mapped.status)
      .json({ ...(mapped.body as object), meta: runtimeMeta(V10_OUTCOME_RUNTIME_CONTRACT) });
  }
}

export function createOutcomeRuntimeRouter(service: OutcomeRuntimeService = outcomeRuntimeService) {
  const router = Router();

  router.use(verifyToken);
  router.use(requireOrganization);

  router.post(
    '/resolve',
    validateBody(OutcomeResolveRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.resolve(req.body));
    })
  );

  router.post(
    '/acceptance/preview',
    validateBody(OutcomeAcceptancePreviewBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.previewAcceptance(withRuntimeScope(req)));
    })
  );

  router.post(
    '/signals/ingest',
    validateBody(OutcomeSignalIngestBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.ingestSignal(withRuntimeScope(req)));
    })
  );

  router.post(
    '/acceptance/resolve',
    validateBody(OutcomeAcceptanceResolveBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.resolveAcceptance(withRuntimeScope(req)));
    })
  );

  router.post(
    '/analysis/business-link',
    validateBody(OutcomeBusinessLinkBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () =>
        service.linkAnalysisToBusinessOutcome(withRuntimeScope(req))
      );
    })
  );

  router.get(
    '/contract',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
      await createResponder(res, () => ({ contract: V10_OUTCOME_RUNTIME_CONTRACT }));
    })
  );

  return router;
}

export default createOutcomeRuntimeRouter();
