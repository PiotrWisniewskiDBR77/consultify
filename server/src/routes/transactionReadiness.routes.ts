import { Router, type Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { requireConfirmation } from '../middleware/confirmAction.middleware.js';
import adminAuditService from '../services/adminAuditService.js';
import { computeScore, getHistory, getLatestScore, getRanking, logTierChange, saveSnapshot } from '../services/transactionReadinessService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

router.get('/organizations/:id/transaction-readiness', asyncHandler(async (req: AuthRequest, res: Response) => {
  const snapshot = await getLatestScore(req.params.id);
  if (!snapshot) { res.status(404).json({ error: 'No readiness data for this organization' }); return; }
  res.json(snapshot);
}));

router.get('/transaction-readiness/ranking', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const ranking = await getRanking(limit);
  res.json({ items: ranking, total: ranking.length });
}));

router.get('/organizations/:id/transaction-readiness/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const history = await getHistory(req.params.id, days);
  res.json({ items: history, total: history.length });
}));

router.post('/organizations/:id/transaction-readiness/recompute', requireConfirmation('recompute_readiness', 'high'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.params.id;
  const adminId = req.userId || 'unknown';
  const previous = await getLatestScore(orgId);
  const snapshot = await computeScore(orgId);
  snapshot.computedBy = adminId;
  await saveSnapshot(snapshot);
  if (previous && previous.tier !== snapshot.tier) {
    await logTierChange(orgId, previous.tier, snapshot.tier, previous.score, snapshot.score);
  }
  try { await adminAuditService.logAction({ adminId, actionType: 'recompute_readiness', details: { orgId, oldScore: previous?.score, newScore: snapshot.score, oldTier: previous?.tier, newTier: snapshot.tier } }); } catch { /* best-effort */ }
  logger.info('[Readiness] Recomputed', { orgId, score: snapshot.score, tier: snapshot.tier });
  res.json(snapshot);
}));

export default router;
