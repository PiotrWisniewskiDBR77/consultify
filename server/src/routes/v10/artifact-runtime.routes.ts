import { type Request, type Response, Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { requireV8OrgContext } from '../../middleware/v8Auth.middleware.js';
import { v8OutputsGate } from '../../middleware/v8FeatureGate.middleware.js';
import { mapArtifactRuntimeError } from '../../services/v10/artifact/artifactRuntimeService.js';
import artifactRuntimeService from '../../services/v10/artifact/artifactRuntimeService.js';
import type {
  ArtifactRuntimeApprovalEvaluateRequest,
  ArtifactRuntimeCommentPlanRequest,
  ArtifactRuntimeExportPlanRequest,
  ArtifactRuntimeMutationApplyRequest,
  ArtifactRuntimeMutationPlanRequest,
  ArtifactRuntimeServiceContract,
  ArtifactRuntimeTemplateFingerprintRequest,
} from '../../types/v10/artifact-runtime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

type ArtifactRuntimeAuthRequest = Request & {
  user?: {
    id?: string;
    organizationId?: string;
    role?: string;
  };
  userId?: string;
  organizationId?: string;
  userRole?: string;
};

function getRequestScope(req: ArtifactRuntimeAuthRequest) {
  return {
    tenantId: String(req?.user?.organizationId || req?.organizationId || ''),
    userId: String(req?.user?.id || req?.userId || ''),
    userRole: req?.user?.role ? String(req.user.role) : req?.userRole ? String(req.userRole) : null,
  };
}

function withScope<T extends Record<string, unknown>>(req: Request): T {
  const body = req.body && typeof req.body === 'object' ? (req.body as T) : ({} as T);
  return {
    ...body,
    scope: getRequestScope(req as ArtifactRuntimeAuthRequest),
  };
}

function createResponder(res: Response, operation: () => unknown): void {
  try {
    res.status(200).json({ data: operation() });
  } catch (error) {
    const mapped = mapArtifactRuntimeError(error);
    res.status(mapped.status).json(mapped.body);
  }
}

export function createArtifactRuntimeRouter(
  service: ArtifactRuntimeServiceContract = artifactRuntimeService
): Router {
  const router = Router();

  router.use(verifyToken);
  router.use(requireV8OrgContext);
  router.use(v8OutputsGate);

  router.post(
    '/mutations/plan',
    asyncHandler(async (req: Request, res: Response) => {
      createResponder(res, () =>
        service.planMutation(withScope<ArtifactRuntimeMutationPlanRequest>(req))
      );
    })
  );

  router.post(
    '/mutations/apply',
    asyncHandler(async (req: Request, res: Response) => {
      createResponder(res, () =>
        service.applyMutation(withScope<ArtifactRuntimeMutationApplyRequest>(req))
      );
    })
  );

  router.post(
    '/exports/plan',
    asyncHandler(async (req: Request, res: Response) => {
      createResponder(res, () =>
        service.planExport(withScope<ArtifactRuntimeExportPlanRequest>(req))
      );
    })
  );

  router.post(
    '/comments/plan',
    asyncHandler(async (req: Request, res: Response) => {
      createResponder(res, () =>
        service.planComment(withScope<ArtifactRuntimeCommentPlanRequest>(req))
      );
    })
  );

  router.post(
    '/templates/fingerprint',
    asyncHandler(async (req: Request, res: Response) => {
      createResponder(res, () =>
        service.fingerprintTemplate(withScope<ArtifactRuntimeTemplateFingerprintRequest>(req))
      );
    })
  );

  router.post(
    '/approvals/evaluate',
    asyncHandler(async (req: Request, res: Response) => {
      createResponder(res, () =>
        service.evaluateApprovals(withScope<ArtifactRuntimeApprovalEvaluateRequest>(req))
      );
    })
  );

  return router;
}

export default createArtifactRuntimeRouter();
