import { type Request, type Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import { requireV8OrgContext } from '../middleware/v8Auth.middleware.js';
import { v8OutputsGate } from '../middleware/v8FeatureGate.middleware.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import * as executionSpineService from '../services/v8/executionSpineService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);
router.use(requireV8OrgContext);
router.use(v8OutputsGate);

function getAuthContext(req: any): {
  userId: string;
  organizationId: string;
  roleKey: string | null;
} {
  return {
    userId: String(req?.user?.id || req?.userId || ''),
    organizationId: String(req?.user?.organizationId || req?.organizationId || ''),
    roleKey: req?.user?.role ? String(req.user.role) : null,
  };
}

function canManageArtifactAccess(params: {
  userId: string;
  roleKey: string | null;
  ownerUserId?: string | null;
}): boolean {
  if (params.ownerUserId && params.ownerUserId === params.userId) return true;
  const normalizedRole = String(params.roleKey || '').toUpperCase();
  return (
    normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN' || normalizedRole === 'OWNER'
  );
}

function buildActionTargetPayload(artifact: {
  artifactId: string;
  originRuntime?: string | null;
  originRecordId?: string | null;
}) {
  const originRuntime = String(artifact.originRuntime || '');
  const originRecordId = String(artifact.originRecordId || '');
  const reviewPath = `/api/artifacts/${artifact.artifactId}/start-review`;

  if (!originRuntime || !originRecordId) {
    return {
      artifactId: artifact.artifactId,
      originRuntime: null,
      originRecordId: null,
      openPath: null,
      exportPath: null,
      deletePath: null,
      reviewPath,
      authority: 'artifact_registry',
    };
  }

  if (originRuntime === 'report') {
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: `/reports/builder/${originRecordId}`,
      exportPath: `/api/report-builder/${originRecordId}/export/pdf`,
      deletePath: `/api/report-builder/${originRecordId}`,
      reviewPath,
      authority: 'report_builder',
    };
  }

  if (originRuntime === 'presentation') {
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: `/presentations/builder/${originRecordId}`,
      exportPath: `/api/presentations/decks/${originRecordId}/download`,
      deletePath: `/api/presentations/decks/${originRecordId}`,
      reviewPath,
      authority: 'presentations_runtime',
    };
  }

  return {
    artifactId: artifact.artifactId,
    originRuntime,
    originRecordId,
    openPath: null,
    exportPath: null,
    deletePath: null,
    reviewPath,
    authority: 'artifact_registry',
  };
}

async function buildArtifactTrustPayload(params: {
  artifact: Awaited<ReturnType<typeof artifactRegistryService.getArtifactForUser>>;
  organizationId: string;
}) {
  const artifact = params.artifact;
  if (!artifact) return null;

  const [links, grants, executionRun] = await Promise.all([
    artifactRegistryService.getArtifactOriginLinks(artifact.artifactId, params.organizationId),
    artifactRegistryService.getArtifactAccessGrantsForArtifact(artifact.artifactId, params.organizationId),
    artifact.executionRunId
      ? executionSpineService.getRun(artifact.executionRunId, params.organizationId)
      : Promise.resolve(null),
  ]);

  const actionTarget = buildActionTargetPayload(artifact);
  const validation = artifactRegistryService.deriveArtifactValidationSnapshot({
    artifact,
    executionState: executionRun?.state,
    sourceRefs: artifact.sourceRefs,
  });

  return {
    artifactId: artifact.artifactId,
    outputType: artifact.outputType,
    canonicalHome: artifact.canonicalHome,
    visibilityScope: artifact.visibilityScope,
    projectId: artifact.projectId,
    publishState: artifact.publishState,
    validationState: validation.state,
    validationChecks: validation.checks,
    reviewers: artifact.publishReviewers,
    reviewGateCount: artifact.reviewGateCount,
    executionRunId: artifact.executionRunId,
    executionState: executionRun?.state || null,
    contextSnapshotId: artifact.contextSnapshotId,
    lastTransitionAt: artifact.lastTransitionAt,
    sourceRefs: artifact.sourceRefs,
    originSummary: artifact.originSummary,
    originLinks: links,
    accessGrants: grants,
    openPath: actionTarget.openPath,
    exportPath: actionTarget.exportPath,
    authority: actionTarget.authority,
    reviewAuthority: 'artifact_review',
    executionAuthority: 'execution_spine',
  };
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const items = await artifactRegistryService.listArtifactsForUser({
      organizationId,
      userId,
      roleKey,
      filters: {
        outputType:
          req.query.outputType === 'report' ||
          req.query.outputType === 'presentation' ||
          req.query.outputType === 'sheet'
            ? req.query.outputType
            : undefined,
        artifactFamily:
          req.query.artifactFamily === 'document' ||
          req.query.artifactFamily === 'presentation' ||
          req.query.artifactFamily === 'sheet'
            ? req.query.artifactFamily
            : undefined,
        visibilityScope:
          req.query.visibilityScope === 'private' ||
          req.query.visibilityScope === 'project' ||
          req.query.visibilityScope === 'organization' ||
          req.query.visibilityScope === 'review_shared' ||
          req.query.visibilityScope === 'demo'
            ? req.query.visibilityScope
            : undefined,
        sourceInitiativeId:
          typeof req.query.sourceInitiativeId === 'string' && req.query.sourceInitiativeId.trim()
            ? req.query.sourceInitiativeId.trim()
            : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        onlyMine: req.query.view === 'mine',
        reviewSharedForUserId: req.query.view === 'review' ? userId : undefined,
        limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      },
    });

    res.json({ data: items, total: items.length, canonicalHome: 'outputs_library' });
  })
);

router.get(
  '/my-work',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const result = await artifactRegistryService.listMyWorkArtifacts({
      organizationId,
      userId,
      roleKey,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    });
    res.json(result);
  })
);

router.get(
  '/origin/:originRuntime/:originRecordId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const originRuntime = String(req.params.originRuntime || '');
    const originRecordId = String(req.params.originRecordId || '');
    if (
      originRuntime !== 'report' &&
      originRuntime !== 'presentation' &&
      originRuntime !== 'sheet' &&
      originRuntime !== 'native_artifact'
    ) {
      return res.status(400).json({ error: 'Invalid originRuntime' });
    }

    const artifact = await artifactRegistryService.getArtifactByOrigin({
      organizationId,
      originRuntime,
      originRecordId,
      userId,
      roleKey,
    });

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.json({ data: artifact });
  })
);

// Legacy compatibility alias. Canonical ArtifactRun contract lives under /api/artifact-runs/*.
router.post(
  '/runs/from-chat',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req);
    const result = await artifactRegistryService.planArtifactFromChat({
      organizationId,
      userId,
      conversationId: String(req.body?.conversationId || ''),
      contextSnapshotId: String(req.body?.contextSnapshotId || ''),
      goal: String(req.body?.goal || ''),
      requestedArtifactFamily: req.body?.requestedArtifactFamily,
      requestedOutputType: req.body?.requestedOutputType,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/:id/action-target',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    res.json({ data: buildActionTargetPayload(artifact) });
  })
);

router.get(
  '/:id/access',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const payload = await buildArtifactTrustPayload({ artifact, organizationId });
    res.json(payload);
  })
);

router.get(
  '/:id/trust-state',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const payload = await buildArtifactTrustPayload({ artifact, organizationId });
    res.json({ data: payload });
  })
);

router.post(
  '/:id/access',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    if (!canManageArtifactAccess({ userId, roleKey, ownerUserId: artifact.ownerUserId })) {
      return res.status(403).json({ error: 'Insufficient permissions to change artifact access' });
    }

    const grant = await artifactRegistryService.createArtifactAccessGrant({
      organizationId,
      artifactId: artifact.artifactId,
      grantKind: req.body?.grantKind,
      userId: req.body?.userId ?? null,
      roleKey: req.body?.roleKey ?? null,
      createdBy: userId,
    });
    res.status(201).json({ data: grant });
  })
);

router.post(
  '/:id/start-review',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    try {
      const started = await artifactRegistryService.startArtifactReview({
        artifactId: artifact.artifactId,
        organizationId,
        actorUserId: userId,
        reviewers: Array.isArray(req.body?.reviewers)
          ? req.body.reviewers.map((value: unknown) => String(value))
          : [],
      });

      return res.status(200).json({ data: started });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start artifact review';
      if (message.includes('cannot enter review before artifact validation passes')) {
        return res.status(409).json({ error: message });
      }
      throw error;
    }
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const originLinks = await artifactRegistryService.getArtifactOriginLinks(
      artifact.artifactId,
      organizationId
    );
    res.json({ data: artifact, originLinks });
  })
);

export default router;
