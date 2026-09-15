import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  ACTION_CARD_SOURCE_KINDS,
  closeActionCard,
  reopenActionCard,
  createActionCard,
  getActionCard,
  listActionCards,
  updateActionCard,
  type ActionCardSourceKind,
  type ActionCardStatus,
} from '../services/actionCard/actionCardService.js';
import { createTaskFromActionCard } from '../services/actionCard/actionCardTaskService.js';

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

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const card = await getActionCard(scope(req), req.params.id);
  if (!card) return res.status(404).json({ ok: false, error: 'ACTION_CARD_NOT_FOUND' });
  res.json({ ok: true, card });
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

router.post('/:id/reopen', asyncHandler(async (req: AuthRequest, res: Response) => {
  const card = await reopenActionCard(scope(req), req.params.id);
  if (!card) return res.status(404).json({ ok: false, error: 'ACTION_CARD_NOT_FOUND' });
  res.json({ ok: true, card });
}));

/**
 * P7K część B — „UTWÓRZ ZADANIE" z karty działania.
 *
 * Kręgosłup wartości: karta mówi CO trzeba zrobić, zadanie jest tym, co
 * OSOBA widzi w swoich Zadaniach. Zadanie powstaje przez istniejący
 * `TaskService`, nie przez własny INSERT — jeden wzorzec z lejkiem
 * „punkt działania spotkania → zadanie" (`meeting.routes.ts`).
 *
 * IDEMPOTENCJA: `idempotency_key = action-card-task:<id>` na poziomie
 * `tasks` — drugi klik zwraca to samo zadanie (`replayed: true`), nigdy
 * drugiego wiersza.
 *
 * ZAŁOŻENIE CTO: przypisujemy zadanie odpowiedzialnemu z karty, ale tylko
 * gdy jego identyfikator jest UUID — `CreateTaskSchema.assigneeId` wymaga
 * UUID, a konta zasiewowe mają identyfikatory tekstowe. Zamiast wywracać
 * żądanie, zadanie powstaje wtedy bez przypisania (nazwisko zostaje w opisie).
 */
router.post('/:id/task', asyncHandler(async (req: AuthRequest, res: Response) => {
  const cardScope = scope(req);
  const result = await createTaskFromActionCard(cardScope, req.params.id);
  if (!result) return res.status(404).json({ ok: false, error: 'ACTION_CARD_NOT_FOUND' });
  res.status(result.replayed ? 200 : 201).json({
    ok: true,
    replayed: result.replayed,
    task: {
      id: result.task.id,
      title: result.task.title,
      status: result.task.status,
      source: result.source,
    },
  });
}));

export default router;
