import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import verifyToken from '../middleware/auth.middleware.js';
import { artifactConversionService } from '../services/artifacts/ArtifactConversionService.js';
import { conclusionReadoutService } from '../services/conclusions/ConclusionReadoutService.js';
import { conclusionService } from '../services/conclusions/ConclusionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

function getAuthContext(req: AuthRequest): { organizationId: string; userId: string } {
  const organizationId = String(req.user?.organizationId || req.organizationId || '');
  const userId = String(req.user?.id || req.userId || '');
  if (!organizationId || !userId) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
  return { organizationId, userId };
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const conclusions = await conclusionService.listConclusions({
      organizationId,
      actorUserId: userId,
      status: req.query.status ? String(req.query.status) : undefined,
      sourceModule: req.query.sourceModule ? String(req.query.sourceModule) : undefined,
      projectId: req.query.projectId ? String(req.query.projectId) : undefined,
    });
    res.json({ conclusions });
  })
);

router.get(
  '/readouts',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId } = getAuthContext(req);
    const readouts = await conclusionReadoutService.listReadouts(organizationId);
    res.json({ readouts });
  })
);

router.post(
  '/readouts',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const { title, conclusionIds, visibilityScope } = req.body as {
      title?: string;
      conclusionIds?: string[];
      visibilityScope?: 'private' | 'project' | 'organization' | 'review_shared';
    };
    if (!Array.isArray(conclusionIds) || conclusionIds.length === 0) {
      return res.status(400).json({ error: 'conclusionIds are required' });
    }
    const readout = await conclusionReadoutService.createReadout({
      organizationId,
      actorUserId: userId,
      title,
      conclusionIds,
      visibilityScope,
    });
    res.status(201).json({ readout });
  })
);

router.get(
  '/readouts/:readoutId',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId } = getAuthContext(req);
    const readout = await conclusionReadoutService.getReadout(organizationId, req.params.readoutId);
    if (!readout) return res.status(404).json({ error: 'Readout not found' });
    res.json({ readout });
  })
);

router.post(
  '/readouts/:readoutId/generate-report',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await conclusionReadoutService.generateReportFromReadout({
      organizationId,
      actorUserId: userId,
      readoutId: req.params.readoutId,
    });
    res.json(result);
  })
);

router.post(
  '/readouts/:readoutId/chat-context',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId } = getAuthContext(req);
    const readout = await conclusionReadoutService.getReadout(organizationId, req.params.readoutId);
    if (!readout) return res.status(404).json({ error: 'Readout not found' });
    res.json({ context: conclusionReadoutService.buildChatContext(readout) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const conclusion = await conclusionService.getConclusion(organizationId, req.params.id, userId);
    if (!conclusion) return res.status(404).json({ error: 'Conclusion not found' });
    const conversions = await artifactConversionService.listConversions({
      organizationId,
      sourceConclusionId: conclusion.id,
    });
    const sourcePack = conclusion.sourcePackId
      ? await conclusionService.getSourcePack(organizationId, conclusion.sourcePackId)
      : null;
    res.json({ conclusion, sourcePack, conversions });
  })
);

export default router;
