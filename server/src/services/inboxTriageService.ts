import { getTableColumns } from '../utils/dbSchema.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import inboxService, { type CanonicalInboxItem } from './inboxService.js';
import NotificationService from './notificationService.js';

export type InboxTriageAction =
  | 'accept_today'
  | 'accept_week'
  | 'accept_later'
  | 'schedule'
  | 'delegate'
  | 'archive'
  | 'dismiss'
  | 'done'
  | 'save'
  | 'reject';

type FocusColumn = 'today' | 'thisWeek' | 'later';

export const VALID_INBOX_TRIAGE_ACTIONS: InboxTriageAction[] = [
  'accept_today',
  'accept_week',
  'accept_later',
  'schedule',
  'delegate',
  'archive',
  'dismiss',
  'done',
  'save',
  'reject',
];

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

function mapActionToCanonicalMutation(action: InboxTriageAction): string {
  switch (action) {
    case 'done':
      return 'done';
    case 'save':
      return 'snooze';
    case 'archive':
    case 'dismiss':
    case 'reject':
      return 'resolve';
    case 'delegate':
      return 'delegate';
    default:
      return 'triage';
  }
}

async function applyInboxTriageSideEffects({
  userId,
  organizationId,
  itemKey,
  action,
  params,
  triagedAt,
}: {
  userId: string;
  organizationId: string;
  itemKey: string;
  action: InboxTriageAction;
  params?: Record<string, unknown>;
  triagedAt: string;
}): Promise<void> {
  const [kind, rawId] = itemKey.split(':') as [string, string];
  if (!kind || !rawId) return;

  const upsertFocusState = async (column: FocusColumn) => {
    await queryHelpers.queryRun(
      `INSERT INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
         column_name = excluded.column_name,
         position = excluded.position,
         updated_at = excluded.updated_at`,
      [userId, todayIsoDate(), itemKey, column, 0, triagedAt]
    );
  };

  if (action === 'accept_today') await upsertFocusState('today');
  if (action === 'accept_week') await upsertFocusState('thisWeek');
  if (action === 'accept_later') await upsertFocusState('later');

  if (action === 'schedule') {
    const date = typeof params?.date === 'string' ? params.date : undefined;
    if (date && kind === 'task') {
      await queryHelpers.queryRun(
        `UPDATE tasks SET due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
        [date, rawId, organizationId]
      );
    }
    if (date && kind === 'decision') {
      await queryHelpers.queryRun(
        `UPDATE decisions SET deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
        [date, rawId, organizationId]
      );
    }
  }

  if (action === 'delegate') {
    const delegateUserId = typeof params?.userId === 'string' ? params.userId : undefined;
    if (delegateUserId && kind === 'task') {
      await queryHelpers.queryRun(
        `UPDATE tasks SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
        [delegateUserId, rawId, organizationId]
      );
      await NotificationService.send({
        userId: delegateUserId,
        organizationId,
        type: 'TASK_ASSIGNED',
        title: 'Task delegated to you',
        body: 'A task was delegated to you from My Work inbox.',
        entityType: 'task',
        entityId: rawId,
        priority: 'normal',
      });
    }
    if (delegateUserId && kind === 'decision') {
      await queryHelpers.queryRun(
        `UPDATE decisions SET decision_maker_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
        [delegateUserId, rawId, organizationId]
      );
      await NotificationService.send({
        userId: delegateUserId,
        organizationId,
        type: 'DECISION_DELEGATED',
        title: 'Decision delegated to you',
        body: 'A decision was delegated to you from My Work inbox.',
        entityType: 'decision',
        entityId: rawId,
        priority: 'high',
      });
    }
  }

  if ((action === 'archive' || action === 'dismiss') && kind === 'notification') {
    try {
      await NotificationService.markAsRead(rawId, userId);
    } catch {
      // Ignore notification read-state failures for triage continuity.
    }
  }

  if (action === 'done' && kind === 'task') {
    await queryHelpers.queryRun(
      `UPDATE tasks SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [rawId, organizationId]
    );
  }
}

async function persistTriageRow({
  userId,
  itemKey,
  action,
  params,
  triagedAt,
  fromAISuggestion,
  confidence,
}: {
  userId: string;
  itemKey: string;
  action: InboxTriageAction;
  params?: Record<string, unknown>;
  triagedAt: string;
  fromAISuggestion?: boolean;
  confidence?: number;
}): Promise<void> {
  const triageCols = await getTableColumns('my_work_inbox_triage');
  const hasAiCols = triageCols.has('from_ai') && triageCols.has('ai_confidence');

  if (hasAiCols && fromAISuggestion) {
    await queryHelpers.queryRun(
      `INSERT INTO my_work_inbox_triage (user_id, item_key, action, params_json, triaged_at, from_ai, ai_confidence)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT (user_id, item_key) DO UPDATE SET
         action = excluded.action,
         params_json = excluded.params_json,
         triaged_at = excluded.triaged_at,
         from_ai = excluded.from_ai,
         ai_confidence = excluded.ai_confidence`,
      [
        userId,
        itemKey,
        action,
        params ? JSON.stringify(params) : null,
        triagedAt,
        confidence ?? null,
      ]
    );
    return;
  }

  await queryHelpers.queryRun(
    `INSERT INTO my_work_inbox_triage (user_id, item_key, action, params_json, triaged_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, item_key) DO UPDATE SET
       action = excluded.action,
       params_json = excluded.params_json,
       triaged_at = excluded.triaged_at`,
    [userId, itemKey, action, params ? JSON.stringify(params) : null, triagedAt]
  );
}

async function syncCanonicalInboxState({
  userId,
  organizationId,
  itemId,
  action,
  params,
  triagedAt,
  fromAISuggestion,
  confidence,
}: {
  userId: string;
  organizationId: string;
  itemId?: string;
  action: InboxTriageAction;
  params?: Record<string, unknown>;
  triagedAt: string;
  fromAISuggestion?: boolean;
  confidence?: number;
}): Promise<CanonicalInboxItem | null> {
  if (!itemId) return null;

  const metadata = {
    ...(params ?? {}),
    lastAction: action,
    triagedAt,
    governedBy: 'v8_inbox_triage_mutation',
    ...(fromAISuggestion ? { fromAISuggestion: true, confidence: confidence ?? null } : {}),
  };

  return inboxService.triageItem(itemId, mapActionToCanonicalMutation(action), metadata, {
    userId,
    organizationId,
  });
}

export async function applyGovernedInboxTriage({
  userId,
  organizationId,
  itemId,
  itemKey,
  action,
  params,
  fromAISuggestion,
  confidence,
}: {
  userId: string;
  organizationId: string;
  itemId?: string;
  itemKey: string;
  action: InboxTriageAction;
  params?: Record<string, unknown>;
  fromAISuggestion?: boolean;
  confidence?: number;
}): Promise<{ success: true; triagedAt: string; item: CanonicalInboxItem | null }> {
  const triagedAt = new Date().toISOString();

  await persistTriageRow({
    userId,
    itemKey,
    action,
    params,
    triagedAt,
    fromAISuggestion,
    confidence,
  });
  await applyInboxTriageSideEffects({
    userId,
    organizationId,
    itemKey,
    action,
    params,
    triagedAt,
  });
  const item = await syncCanonicalInboxState({
    userId,
    organizationId,
    itemId,
    action,
    params,
    triagedAt,
    fromAISuggestion,
    confidence,
  });

  return { success: true, triagedAt, item };
}

export async function applyGovernedBulkInboxTriage({
  userId,
  organizationId,
  items,
  itemKeys,
  action,
  params,
  aiItems,
}: {
  userId: string;
  organizationId: string;
  items?: Array<{ itemId?: string; itemKey: string }>;
  itemKeys: string[];
  action: InboxTriageAction;
  params?: Record<string, unknown>;
  aiItems?: Array<{ itemKey: string; confidence?: number | null }>;
}): Promise<{ success: true; triagedAt: string; processed: number }> {
  const triagedAt = new Date().toISOString();
  const aiConfidenceByKey = new Map<string, number | null>();
  const itemIdByKey = new Map<string, string>();

  for (const row of aiItems ?? []) {
    if (!row?.itemKey) continue;
    aiConfidenceByKey.set(row.itemKey, row.confidence ?? null);
  }

  for (const row of items ?? []) {
    if (!row?.itemKey || !row?.itemId) continue;
    itemIdByKey.set(row.itemKey, row.itemId);
  }

  for (const itemKey of itemKeys) {
    const confidence = aiConfidenceByKey.get(itemKey);

    await persistTriageRow({
      userId,
      itemKey,
      action,
      params,
      triagedAt,
      fromAISuggestion: aiConfidenceByKey.has(itemKey),
      confidence: confidence ?? undefined,
    });
    await applyInboxTriageSideEffects({
      userId,
      organizationId,
      itemKey,
      action,
      params,
      triagedAt,
    });
    await syncCanonicalInboxState({
      userId,
      organizationId,
      itemId: itemIdByKey.get(itemKey),
      action,
      params,
      triagedAt,
      fromAISuggestion: aiConfidenceByKey.has(itemKey),
      confidence: confidence ?? undefined,
    });
  }

  return {
    success: true,
    triagedAt,
    processed: itemKeys.length,
  };
}
