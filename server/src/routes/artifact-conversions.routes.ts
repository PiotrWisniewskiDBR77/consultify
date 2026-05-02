import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import verifyToken from '../middleware/auth.middleware.js';
import { artifactConversionService } from '../services/artifacts/ArtifactConversionService.js';
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
    const { organizationId } = getAuthContext(req);
    const conversions = await artifactConversionService.listConversions({
      organizationId,
      sourceConclusionId: req.query.sourceConclusionId
        ? String(req.query.sourceConclusionId)
        : undefined,
      targetArtifactType: req.query.targetArtifactType
        ? String(req.query.targetArtifactType)
        : undefined,
      targetArtifactId: req.query.targetArtifactId ? String(req.query.targetArtifactId) : undefined,
    });
    res.json({ conversions });
  })
);

router.post(
  '/propose',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const { conclusionId, targetArtifactType, intent } = req.body as {
      conclusionId?: string;
      targetArtifactType?: 'initiative';
      intent?: string;
    };
    if (!conclusionId) {
      return res.status(400).json({ error: 'conclusionId is required' });
    }
    if (targetArtifactType && targetArtifactType !== 'initiative') {
      return res.status(400).json({ error: 'Only initiative target is supported in this slice' });
    }

    const result = await artifactConversionService.proposeConversion({
      organizationId,
      actorUserId: userId,
      conclusionId,
      targetArtifactType: 'initiative',
      intent,
    });
    if (!result.conversion) {
      return res.status(400).json({ error: result.error || 'Failed to propose conversion' });
    }
    const status = result.error ? 422 : 201;
    res.status(status).json({ conversion: result.conversion, warning: result.error || null });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId } = getAuthContext(req);
    const conversion = await artifactConversionService.getConversion(organizationId, req.params.id);
    if (!conversion) return res.status(404).json({ error: 'Conversion not found' });
    res.json({ conversion });
  })
);

router.post(
  '/:id/convert',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await artifactConversionService.executeConversion({
      organizationId,
      actorUserId: userId,
      conversionId: req.params.id,
    });
    if (result.error) {
      return res.status(422).json({
        error: result.error,
        conversion: result.conversion || null,
      });
    }
    res.json({ conversion: result.conversion, initiative: result.initiative });
  })
);

export default router;
