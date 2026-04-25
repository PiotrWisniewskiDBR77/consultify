import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  captureWave6ContextSnapshot,
  captureWave6MemoryCandidate,
  decideWave6MemoryCandidate,
  forgetWave6ContextLedgerEntry,
  listWave6ContextPanel,
  recordWave6ContextLedgerEntry,
} from '../services/wave6ContextLearningService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function getAuthContext(req: AuthRequest): { userId: string; organizationId: string } {
  const user = req.user as any;
  const userId = user?.id || user?.userId;
  const organizationId =
    user?.organizationId || user?.organization_id || (req as any).organizationId;
  if (!userId) throw new Error('Unauthorized');
  if (!organizationId) throw new Error('Organization context is required');
  return { userId, organizationId };
}

router.get(
  '/panel',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const panel = await listWave6ContextPanel({
      organizationId,
      userId,
      projectId: req.query.projectId ? String(req.query.projectId) : null,
    });
    return res.json({ success: true, panel });
  })
);

router.post(
  '/snapshots',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const snapshot = await captureWave6ContextSnapshot({
      organizationId,
      userId,
      snapshotType: req.body.snapshotType,
      projectId: req.body.projectId || null,
      facts: req.body.facts && typeof req.body.facts === 'object' ? req.body.facts : {},
      sourceRefs: Array.isArray(req.body.sourceRefs) ? req.body.sourceRefs : [],
      permissions:
        req.body.permissions && typeof req.body.permissions === 'object'
          ? req.body.permissions
          : {},
      freshnessAt: req.body.freshnessAt || null,
      privateMode: Boolean(req.body.privateMode),
    });
    return res.status(201).json({ success: true, snapshot });
  })
);

router.post(
  '/ledger',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const entry = await recordWave6ContextLedgerEntry({
      organizationId,
      userId,
      projectId: req.body.projectId || null,
      sourceType: String(req.body.sourceType || 'manual'),
      sourceId: req.body.sourceId || null,
      sourceTitle: req.body.sourceTitle || null,
      sourceUrl: req.body.sourceUrl || null,
      freshnessAt: req.body.freshnessAt || null,
      permissionScope: req.body.permissionScope || 'tenant',
    });
    return res.status(201).json({ success: true, entry });
  })
);

router.post(
  '/ledger/:ledgerId/forget',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await forgetWave6ContextLedgerEntry({
      organizationId,
      userId,
      ledgerId: String(req.params.ledgerId),
    });
    return res.json(result);
  })
);

router.post(
  '/memory/candidates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await captureWave6MemoryCandidate({
      organizationId,
      userId,
      assistantScope: 'teresa_tenant',
      memoryScope: req.body.memoryScope,
      key: String(req.body.key || ''),
      value: String(req.body.value || ''),
      projectId: req.body.projectId || null,
      sourceLabel: req.body.sourceLabel || null,
      sourceRefs: Array.isArray(req.body.sourceRefs) ? req.body.sourceRefs : [],
      privateMode: Boolean(req.body.privateMode),
      retentionDays: req.body.retentionDays ? Number(req.body.retentionDays) : null,
    });
    return res.status(result.blocked ? 200 : 201).json({ success: true, ...result });
  })
);

router.post(
  '/memory/candidates/:candidateId/decision',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const candidate = await decideWave6MemoryCandidate({
      organizationId,
      userId,
      candidateId: String(req.params.candidateId),
      decision: req.body.decision,
      reason: req.body.reason || null,
    });
    return res.json({ success: true, candidate });
  })
);

export default router;
