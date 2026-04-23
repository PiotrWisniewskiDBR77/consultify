import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  mapOnboardingRuntimeError,
  onboardingRuntimeService,
  type OnboardingRuntimeService,
} from '../../services/v10/onboarding/onboardingRuntimeService.js';
import {
  OnboardingPersonaRequestSchema,
  OnboardingResumeRequestSchema,
  OnboardingSnapshotSaveRequestSchema,
  OnboardingTelemetryEventRequestSchema,
} from '../../types/v10/onboarding-runtime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { respondWithData, runtimeMeta, withRuntimeScope, scopeFromAuthRequest } from './runtimeRouteUtils.js';

export const V10_ONBOARDING_RUNTIME_CONTRACT = 'onboarding_runtime_wave_a_v1';

async function createResponder(res: Response, operation: () => Promise<unknown>): Promise<void> {
  try {
    await respondWithData(res, V10_ONBOARDING_RUNTIME_CONTRACT, operation);
  } catch (error) {
    const mapped = mapOnboardingRuntimeError(error);
    res.status(mapped.status).json({ ...mapped.body, meta: runtimeMeta(V10_ONBOARDING_RUNTIME_CONTRACT) });
  }
}

export function createOnboardingRuntimeRouter(
  service: OnboardingRuntimeService = onboardingRuntimeService
) {
  const router = Router();

  router.use(verifyToken);
  router.use(requireOrganization);

  router.post(
    '/persona',
    validateBody(OnboardingPersonaRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.capturePersona(withRuntimeScope(req)));
    })
  );

  router.post(
    '/snapshot',
    validateBody(OnboardingSnapshotSaveRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.saveSnapshot(withRuntimeScope(req)));
    })
  );

  router.post(
    '/resume',
    validateBody(OnboardingResumeRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.resume(withRuntimeScope(req)));
    })
  );

  router.post(
    '/events',
    validateBody(OnboardingTelemetryEventRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.recordEvent(withRuntimeScope(req)));
    })
  );

  router.get(
    '/kpis/summary',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.summarizeKpis(scopeFromAuthRequest(req)));
    })
  );

  router.get(
    '/contract',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
      return res
        .status(200)
        .json({ data: { contract: V10_ONBOARDING_RUNTIME_CONTRACT }, meta: runtimeMeta(V10_ONBOARDING_RUNTIME_CONTRACT) });
    })
  );

  return router;
}

export default createOnboardingRuntimeRouter();

