import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { requireRole as requireRbacRole } from '../../middleware/rbac.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  type LearningLoopService,
  learningLoopService,
  mapLearningLoopError,
} from '../../services/v10/learning/learningLoopService.js';
import {
  LearningFeedbackSubmitBodySchema,
  LearningIncidentReportBodySchema,
  LearningRetentionPreviewBodySchema,
  LearningStewardshipResolveBodySchema,
} from '../../types/v10/learning-loop.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  respondWithData,
  runtimeMeta,
  scopeFromAuthRequest,
  withRuntimeScope,
} from './runtimeRouteUtils.js';

export const V10_LEARNING_LOOP_CONTRACT = 'learning_loop_wave_b_v1';

async function createResponder(res: Response, operation: () => unknown): Promise<void> {
  try {
    await respondWithData(res, V10_LEARNING_LOOP_CONTRACT, operation);
  } catch (error) {
    const mapped = mapLearningLoopError(error);
    res
      .status(mapped.status)
      .json({ ...(mapped.body as object), meta: runtimeMeta(V10_LEARNING_LOOP_CONTRACT) });
  }
}

export function createLearningLoopRouter(service: LearningLoopService = learningLoopService) {
  const router = Router();

  router.use(verifyToken);
  router.use(requireOrganization);
  router.use(requireRbacRole('admin'));

  router.post(
    '/feedback/submit',
    validateBody(LearningFeedbackSubmitBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.submitFeedback(withRuntimeScope(req)));
    })
  );

  router.post(
    '/retention/preview',
    validateBody(LearningRetentionPreviewBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.retentionPreview(withRuntimeScope(req)));
    })
  );

  router.get(
    '/stewardship/queue',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const scope = scopeFromAuthRequest(req);
      await createResponder(res, () => service.listStewardship({ tenantId: scope.tenantId }));
    })
  );

  router.post(
    '/stewardship/:itemId/resolve',
    validateBody(LearningStewardshipResolveBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () =>
        service.resolveStewardship(String(req.params.itemId || ''), withRuntimeScope(req))
      );
    })
  );

  router.get(
    '/coverage/summary',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const scope = scopeFromAuthRequest(req);
      await createResponder(res, () => service.coverage({ tenantId: scope.tenantId }));
    })
  );

  router.get(
    '/quality/dashboard',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const scope = scopeFromAuthRequest(req);
      await createResponder(res, () => service.dashboard({ tenantId: scope.tenantId }));
    })
  );

  router.post(
    '/incidents/report',
    validateBody(LearningIncidentReportBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      await createResponder(res, () => service.reportIncident(withRuntimeScope(req)));
    })
  );

  router.get(
    '/incidents',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const scope = scopeFromAuthRequest(req);
      await createResponder(res, () => service.listIncidents({ tenantId: scope.tenantId }));
    })
  );

  router.get(
    '/contract',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
      await createResponder(res, () => ({ contract: V10_LEARNING_LOOP_CONTRACT }));
    })
  );

  return router;
}

export default createLearningLoopRouter();
