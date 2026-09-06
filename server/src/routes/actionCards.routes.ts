import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  ACTION_CARD_SOURCE_KINDS,
  closeActionCard,
  createActionCard,
  listActionCards,
  updateActionCard,
  type ActionCardSourceKind,
  type ActionCardStatus,
} from '../services/actionCard/actionCardService.js';

const router = Router();
router.use(verifyToken);
router.use(isAuthenticated);

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

function scope(req: AuthRequest) {
  return {
    organizationId: String(req.user?.organizationId || ''),
    actorUserId: String(req.user?.id || ''),
  };
}

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = req.query.status === 'OPEN' || req.query.status === 'CLOSED' ? req.query.status as ActionCardStatus : undefined;
  const sourceKind = ACTION_CARD_SOURCE_KINDS.includes(req.query.sourceKind as ActionCardSourceKind) ? req.query.sourceKind as ActionCardSourceKind : undefined;
  const requestedOwner = req.query.ownerUserId ? String(req.query.ownerUserId) : undefined;
  const ownerUserId = requestedOwner === 'me' ? scope(req).actorUserId : requestedOwner;
  const cards = await listActionCards(scope(req), { ownerUserId, status, sourceKind });
  res.json({ ok: true, cards });
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const card = await createActionCard(scope(req), req.body);
  res.status(201).json({ ok: true, card });
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const card = await updateActionCard(scope(req), req.params.id, req.body);
  if (!card) return res.status(404).json({ ok: false, error: 'ACTION_CARD_NOT_FOUND' });
  res.json({ ok: true, card });
}));

router.post('/:id/close', asyncHandler(async (req: AuthRequest, res: Response) => {
  const card = await closeActionCard(scope(req), req.params.id);
  if (!card) return res.status(404).json({ ok: false, error: 'ACTION_CARD_NOT_FOUND' });
  res.json({ ok: true, card });
}));

export default router;
