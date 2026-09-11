import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getDatabase } from '../database/Database.js';
import { TaskService } from '../services/TaskService.js';
import {
  ACTION_CARD_SOURCE_KINDS,
  closeActionCard,
  createActionCard,
  getActionCard,
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post('/:id/task', asyncHandler(async (req: AuthRequest, res: Response) => {
  const cardScope = scope(req);
  const card = await getActionCard(cardScope, req.params.id);
  if (!card) return res.status(404).json({ ok: false, error: 'ACTION_CARD_NOT_FOUND' });

  const title = (card.actionText || card.problem || 'Karta działania').slice(0, 255);
  const descriptionParts = [
    card.problem ? `Problem: ${card.problem}` : null,
    card.rootCause ? `Główna przyczyna: ${card.rootCause}` : null,
    card.ownerName ? `Odpowiedzialność: ${card.ownerName}` : null,
    `Okres: ${card.periodStart} – ${card.periodEnd}`,
  ].filter(Boolean);

  const taskService = new TaskService((await getDatabase()) as any);
  const task = await taskService.createTask(
    {
      title,
      description: descriptionParts.join('\n'),
      status: 'todo',
      priority: 'high',
      assigneeId: UUID_RE.test(card.ownerUserId) ? card.ownerUserId : undefined,
      dueDate: card.dueDate ? `${card.dueDate}T00:00:00.000Z` : undefined,
    },
    cardScope.actorUserId,
    {
      idempotencyKey: `action-card-task:${card.id}`,
      sourceType: 'action_card',
      sourceId: card.id,
    }
  );
  res.status(201).json({ ok: true, task: { id: task.id, title: task.title, status: task.status } });
}));

export default router;
