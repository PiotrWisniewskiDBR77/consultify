import { type Request, type Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

function getAuthContext(req: any): { userId: string; organizationId: string } {
  return {
    userId: String(req?.user?.id || req?.userId || ''),
    organizationId: String(req?.user?.organizationId || req?.organizationId || ''),
  };
}

router.post(
  '/from-chat',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req);
    const result = await artifactRegistryService.createArtifactRunFromChat({
      organizationId,
      userId,
      conversationId: String(req.body?.conversationId || ''),
      contextSnapshotId: String(req.body?.contextSnapshotId || ''),
      goal: String(req.body?.goal || ''),
      requestedArtifactFamily: req.body?.requestedArtifactFamily,
      requestedOutputType: req.body?.requestedOutputType,
    });
    res.status(201).json({ data: result });
  }),
);

router.get(
  '/:runId',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const run = await artifactRegistryService.getArtifactRun(
      String(req.params.runId || ''),
      organizationId,
    );
    if (!run) {
      return res.status(404).json({ error: 'ArtifactRun not found' });
    }
    res.json({ data: run });
  }),
);

router.post(
  '/:runId/accept-plan',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req);
    const run = await artifactRegistryService.acceptArtifactRunPlan({
      runId: String(req.params.runId || ''),
      organizationId,
      actorUserId: userId,
    });
    res.status(200).json({ data: run });
  }),
);

router.post(
  '/:runId/retry',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req);
    const run = await artifactRegistryService.retryArtifactRun({
      runId: String(req.params.runId || ''),
      organizationId,
      actorUserId: userId,
    });
    res.status(201).json({ data: run });
  }),
);

export default router;
