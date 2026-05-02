import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import verifyToken from '../middleware/auth.middleware.js';
import { artifactConversionService } from '../services/artifacts/ArtifactConversionService.js';
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
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const conclusion = await conclusionService.getConclusion(organizationId, req.params.id, userId);
    if (!conclusion) return res.status(404).json({ error: 'Conclusion not found' });
    const conversions = await artifactConversionService.listConversions({
      organizationId,
      sourceConclusionId: conclusion.id,
    });
    res.json({ conclusion, conversions });
  })
);

export default router;
