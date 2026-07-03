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

/**
 * POST /api/conclusions — push-based CONCLUSION_LAYER ingest.
 * Used by generation flows whose conclusion models live client-side
 * (SIRI/ADMA report W1 layers) to persist their verdicts as Conclusion
 * candidates. Idempotent per (sourceModule, sourceRefs) — regeneration
 * updates the existing conclusion instead of duplicating it.
 */
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { organizationId, userId } = getAuthContext(req);
    const body = (req.body || {}) as Record<string, unknown>;

    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '';
    const statement =
      typeof body.statement === 'string' ? body.statement.trim().slice(0, 4000) : '';
    const sourceModule =
      typeof body.sourceModule === 'string' ? body.sourceModule.trim().slice(0, 60) : '';
    const sourceRefs = Array.isArray(body.sourceRefs)
      ? (body.sourceRefs as any[])
          .filter((ref) => ref && typeof ref === 'object' && ref.type && ref.id)
          .map((ref) => ({
            type: String(ref.type).slice(0, 60),
            id: String(ref.id).slice(0, 120),
            title: ref.title ? String(ref.title).slice(0, 180) : null,
            url: ref.url ? String(ref.url).slice(0, 500) : null,
          }))
      : [];

    if (!title || !statement || !sourceModule || sourceRefs.length === 0) {
      return res
        .status(400)
        .json({ error: 'title, statement, sourceModule and sourceRefs are required' });
    }

    const evidenceRefs = Array.isArray(body.evidenceRefs)
      ? (body.evidenceRefs as any[])
          .filter((ref) => ref && typeof ref === 'object' && ref.type && ref.ref)
          .map((ref) => ({
            type: String(ref.type).slice(0, 60),
            ref: String(ref.ref).slice(0, 200),
            excerpt: ref.excerpt ? String(ref.excerpt).slice(0, 300) : null,
          }))
      : [];

    const allowedStatuses = ['candidate', 'needs_evidence', 'needs_review'];
    const status = allowedStatuses.includes(String(body.status || ''))
      ? (String(body.status) as 'candidate' | 'needs_evidence' | 'needs_review')
      : 'candidate';

    await conclusionService.createConclusion({
      organizationId,
      projectId: body.projectId ? String(body.projectId) : null,
      title,
      statement,
      sourceModule,
      sourceRefs,
      confidenceLevel: String(body.confidenceLevel || 'insufficient'),
      limits:
        typeof body.limits === 'string' && body.limits.trim()
          ? body.limits.trim().slice(0, 1000)
          : 'No limits provided.',
      evidenceRefs,
      recommendedNextAction: body.recommendedNextAction
        ? String(body.recommendedNextAction).slice(0, 500)
        : null,
      status,
      createdBy: userId,
      contextSummary:
        typeof body.contextSummary === 'string' ? body.contextSummary.slice(0, 2000) : statement,
    });

    res.status(201).json({ ok: true });
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
