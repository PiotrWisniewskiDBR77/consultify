import { getDatabase } from '../../database/Database.js';
import type { Task } from '../../types/index.js';
import { TaskService } from '../TaskService.js';
import { actionCardMessage } from './actionCardMessages.js';
import { getActionCard, type ActionCardScope } from './actionCardService.js';
import { resolveActionCardLocale } from './kpiDeviationActionCard.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionCardTaskResult {
  task: Task;
  replayed: boolean;
  source: { type: 'action_card'; id: string; url: string };
}

/** Materialize the canonical My Work task behind the card's Create task action. */
export async function createTaskFromActionCard(
  scope: ActionCardScope,
  actionCardId: string
): Promise<ActionCardTaskResult | null> {
  const card = await getActionCard(scope, actionCardId);
  if (!card) return null;

  const db = getDatabase();
  const idempotencyKey = `action-card-task:${card.id}`;
  const prior = await db.query<{ id: string }>(
    `SELECT id FROM tasks WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1`,
    [scope.organizationId, idempotencyKey]
  );
  const locale = await resolveActionCardLocale(scope.organizationId, card.ownerUserId);
  const title = (
    card.actionText ||
    card.problem ||
    actionCardMessage(locale, 'actionCards.task.fallbackTitle')
  ).slice(0, 255);
  const descriptionParts = [
    card.problem
      ? `${actionCardMessage(locale, 'actionCards.task.problemLabel')}: ${card.problem}`
      : null,
    card.rootCause
      ? `${actionCardMessage(locale, 'actionCards.task.rootCauseLabel')}: ${card.rootCause}`
      : null,
    card.ownerName
      ? `${actionCardMessage(locale, 'actionCards.task.ownerLabel')}: ${card.ownerName}`
      : null,
    `${actionCardMessage(locale, 'actionCards.task.periodLabel')}: ${card.periodStart} – ${card.periodEnd}`,
  ].filter((value): value is string => Boolean(value));

  const task = await new TaskService(db).createTask(
    {
      title,
      description: descriptionParts.join('\n'),
      status: 'todo',
      priority: 'high',
      assigneeId: UUID_RE.test(card.ownerUserId) ? card.ownerUserId : undefined,
      dueDate: card.dueDate ? `${card.dueDate}T00:00:00.000Z` : undefined,
    },
    scope.actorUserId,
    { idempotencyKey, sourceType: 'action_card', sourceId: card.id }
  );

  return {
    task,
    replayed: prior.rows.length > 0,
    source: {
      type: 'action_card',
      id: card.id,
      url: `/action-cards/${encodeURIComponent(card.id)}`,
    },
  };
}
