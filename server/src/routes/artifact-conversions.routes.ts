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
      sourceArtifactType: req.query.sourceArtifactType
        ? String(req.query.sourceArtifactType)
        : undefined,
      sourceArtifactId: req.query.sourceArtifactId ? String(req.query.sourceArtifactId) : undefined,
      targetArtifactType: req.query.targetArtifactType
        ? String(req.query.targetArtifactType)
        : undefined,
      targetArtifactId: req.query.targetArtifactId ? String(req.query.targetArtifactId) : undefined,
    });
    res.json({ conversions });
  })
);

router.post(
  '/record',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const {
      sourceConclusionId,
      sourceArtifactType,
      sourceArtifactId,
      sourceArtifactTitle,
      sourceModule,
      targetArtifactType,
      targetArtifactId,
      conversionIntent,
      projectId,
      confidenceLevel,
      limits,
      evidenceRefs,
      sourcePack,
      payload,
    } = req.body as Record<string, unknown>;

    if (!sourceArtifactType || !sourceArtifactId || !sourceArtifactTitle) {
      return res.status(400).json({
        error: 'sourceArtifactType, sourceArtifactId, and sourceArtifactTitle are required',
      });
    }
    if (!targetArtifactType || !targetArtifactId) {
      return res
        .status(400)
        .json({ error: 'targetArtifactType and targetArtifactId are required' });
    }

    const conversion = await artifactConversionService.recordCompletedConversion({
      organizationId,
      actorUserId: userId,
      sourceConclusionId: sourceConclusionId ? String(sourceConclusionId) : null,
      sourceArtifactType: String(sourceArtifactType),
      sourceArtifactId: String(sourceArtifactId),
      sourceArtifactTitle: String(sourceArtifactTitle),
      sourceModule: sourceModule ? String(sourceModule) : 'interview',
      targetArtifactType: String(targetArtifactType),
      targetArtifactId: String(targetArtifactId),
      conversionIntent: conversionIntent ? String(conversionIntent) : 'Artifact action conversion',
      projectId: projectId ? String(projectId) : null,
      confidenceLevel: confidenceLevel ? String(confidenceLevel) : null,
      limits: limits ? String(limits) : null,
      evidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs : [],
      sourcePack:
        sourcePack && typeof sourcePack === 'object' && !Array.isArray(sourcePack)
          ? (sourcePack as Record<string, unknown>)
          : {},
      payload:
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : {},
    });

    res.status(201).json({ conversion });
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
