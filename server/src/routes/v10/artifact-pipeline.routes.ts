import { type Request, type Response, Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { requireV8OrgContext } from '../../middleware/v8Auth.middleware.js';
import { v8OutputsGate } from '../../middleware/v8FeatureGate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import artifactPipelineService, {
  mapArtifactPipelineError,
} from '../../services/v10/artifact/artifactPipelineService.js';
import type {
  ArtifactPipelinePreflightRequest,
  ArtifactPipelineRunRequest,
} from '../../types/v10/artifact-pipeline.js';

type ArtifactPipelineAuthRequest = Request & {
  user?: {
    id?: string;
    organizationId?: string;
    role?: string;
  };
  userId?: string;
  organizationId?: string;
  userRole?: string;
};

function getRequestScope(req: ArtifactPipelineAuthRequest) {
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
    scope: getRequestScope(req as ArtifactPipelineAuthRequest),
  };
}

function normalizeTenantAndIds<T extends ArtifactPipelinePreflightRequest | ArtifactPipelineRunRequest>(
  input: T
): T {
  const scopeTenantId = String(input?.scope?.tenantId || '').trim();
  const artifact = input?.artifact && typeof input.artifact === 'object' ? (input.artifact as any) : null;
  const proposal = input?.proposal && typeof input.proposal === 'object' ? (input.proposal as any) : null;
  const artifactId = artifact?.id ? String(artifact.id) : null;

  const next: any = { ...input };

  if (artifact && scopeTenantId) {
    next.artifact = { ...artifact, tenantId: scopeTenantId };
  }

  if (proposal && artifactId) {
    next.proposal = { ...proposal, artifactId };
  }

  if (next.selectionContext && artifactId) {
    next.selectionContext = { ...next.selectionContext, artifactId };
  }

  return next as T;
}

function createResponder(res: Response, operation: () => unknown): void {
  void (async () => {
    try {
      const result = operation();
      const resolved = result instanceof Promise ? await result : result;
      res.status(200).json({ data: resolved });
    } catch (error) {
      const mapped = mapArtifactPipelineError(error);
      res.status(mapped.status).json(mapped.body);
    }
  })();
}

export function createArtifactPipelineRouter(): Router {
  const router = Router();

  router.use(verifyToken);
  router.use(requireV8OrgContext);
  router.use(v8OutputsGate);

  router.post(
    '/preflight',
    asyncHandler(async (req: Request, res: Response) => {
      const input = normalizeTenantAndIds(withScope<ArtifactPipelinePreflightRequest>(req));
      createResponder(res, () => artifactPipelineService.preflight(input));
    })
  );

  router.post(
    '/run',
    asyncHandler(async (req: Request, res: Response) => {
      const input = normalizeTenantAndIds(withScope<ArtifactPipelineRunRequest>(req));
      createResponder(res, () => artifactPipelineService.run(input));
    })
  );

  router.get(
    '/artifacts/:artifactId',
    asyncHandler(async (req: Request, res: Response) => {
      const scope = getRequestScope(req as ArtifactPipelineAuthRequest);
      const artifactId = String(req.params.artifactId || '');
      createResponder(res, () => ({
        artifact: artifactPipelineService.getMaterializedArtifact({ scope, artifactId }),
      }));
    })
  );

  router.get(
    '/runs/:runId',
    asyncHandler(async (req: Request, res: Response) => {
      const scope = getRequestScope(req as ArtifactPipelineAuthRequest);
      const runId = String(req.params.runId || '');
      createResponder(res, () => ({ run: artifactPipelineService.getRun({ scope, runId }) }));
    })
  );

  router.post(
    '/runs/:runId/publish',
    asyncHandler(async (req: Request, res: Response) => {
      const scope = getRequestScope(req as ArtifactPipelineAuthRequest);
      const runId = String(req.params.runId || '');
      createResponder(res, () => artifactPipelineService.publishRunToOutputsLibrary({ scope, runId }));
    })
  );

  return router;
}

export default createArtifactPipelineRouter();

