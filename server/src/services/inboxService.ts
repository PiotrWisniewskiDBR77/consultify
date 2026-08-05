/**
 * Canonical Inbox Service (V4-INBX-01)
 *
 * Materializes inbox items from tasks/decisions/notifications into a persistent
 * canonical_inbox_items table with lifecycle, SLA, and delegation support.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export interface CanonicalInboxItem {
  id: string;
  userId: string;
  organizationId: string;
  itemType: 'task' | 'decision' | 'approval' | 'signal' | 'mention' | 'escalation';
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description?: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  section: string;
  status: 'pending' | 'triaged' | 'delegated' | 'resolved' | 'snoozed';
  slaDeadline?: string;
  slaStatus: 'on_track' | 'at_risk' | 'breached' | 'resolved';
  delegatedTo?: string;
  delegatedAt?: string;
  delegatedBy?: string;
  delegationNotes?: string;
  metadata?: Record<string, unknown>;
  /**
   * Status of the SOURCE entity (task/decision) at materialization time —
   * distinct from this inbox item's own triage `status` above. Copied at
   * upsert time (matching how title/description are handled), not a live
   * join. Always null for notification-sourced items (notifications have
   * no "current status" concept).
   */
  sourceStatus?: string;
  /**
   * initiative_id of the SOURCE task/decision, copied at materialization
   * time. Always null for notification-sourced items.
   */
  initiativeId?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface InboxFilters {
  section?: string;
  status?: string;
  priority?: string;
  slaStatus?: string;
  limit?: number;
  offset?: number;
}

export interface InboxStats {
  total: number;
  bySection: Record<string, number>;
  bySlaStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
}

function rowToItem(r: any): CanonicalInboxItem {
  let metadata: Record<string, unknown> | undefined;
  if (r.metadata_json) {
    try {
      metadata = JSON.parse(r.metadata_json);
    } catch {
      metadata = undefined;
    }
  }
  return {
    id: r.id,
    userId: r.user_id,
    organizationId: r.organization_id,
    itemType: r.item_type,
    sourceEntityType: r.source_entity_type,
    sourceEntityId: r.source_entity_id,
    title: r.title,
    description: r.description || undefined,
    priority: r.priority || 'normal',
    section: r.section,
    status: r.status,
    slaDeadline: r.sla_deadline || undefined,
    slaStatus: r.sla_status || 'on_track',
    delegatedTo: r.delegated_to || undefined,
    delegatedAt: r.delegated_at || undefined,
    delegatedBy: r.delegated_by || undefined,
    delegationNotes: r.delegation_notes || undefined,
    metadata,
    sourceStatus: r.source_status || undefined,
    initiativeId: r.initiative_id || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at || undefined,
    resolvedAt: r.resolved_at || undefined,
  };
}

function sectionForTask(
  status: string,
  dueDate: string | null,
  today: string,
  isBlocked: boolean
): string {
  if (isBlocked) return 'blocked_escalations';
  const s = (status || '').toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'validated') return 'assigned_tasks';
  if (dueDate && dueDate < today) return 'overdue_sla_breach';
  return 'assigned_tasks';
}

function priorityForItem(raw?: string | null): CanonicalInboxItem['priority'] {
  const p = (raw || '').toLowerCase();
  if (p === 'urgent' || p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
}

export async function materializeInboxItems(
  userId: string,
  orgId: string
): Promise<{ upserted: number }> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  let upserted = 0;

  // M02-002 (reopen half of the lifecycle; fix for the 704/706-pending
  // backlog documented in M02_OPEN_FINDINGS.csv). The delete/archive
  // triggers (20260805_m02p03_inbox_projection_lifecycle.sql) retire a
  // projection to `resolved` with an `mwLifecycle` tombstone once its source
  // leaves the eligible set. Without the CASE arms below the lifecycle would
  // be one-way in the OTHER direction too: a task going done -> todo again,
  // a decision re-escalated, a notification "unread"-again, or a source
  // deleted and recreated under the same id, would re-materialize here but
  // stay `resolved` forever — eligible work would go invisible.
  //
  // Reopen is deliberately narrow: ONLY rows THIS system retired, identified
  // by metadata_json.mwLifecycle IN ('source_archived','source_deleted'). An
  // item a USER resolved/dismissed by hand through the Inbox UI has no such
  // tombstone (triageItem() never writes mwLifecycle) and is therefore never
  // revived here — otherwise every re-materialization would resurrect work
  // people already triaged away, which is the opposite of the fix. On reopen
  // the tombstone keys are stripped, so the row returns to a clean pending
  // state rather than carrying a stale lifecycle marker forward.
  const SYSTEM_RETIRED = `mw_safe_jsonb(canonical_inbox_items.metadata_json) ->> 'mwLifecycle'
      IN ('source_archived', 'source_deleted')`;

  const UPSERT_SQL = `INSERT INTO canonical_inbox_items
    (id, user_id, organization_id, item_type, source_entity_type, source_entity_id,
     title, description, priority, section, status, sla_deadline, source_status,
     initiative_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
  ON CONFLICT (user_id, source_entity_type, source_entity_id) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    priority = excluded.priority,
    section = excluded.section,
    sla_deadline = excluded.sla_deadline,
    source_status = excluded.source_status,
    initiative_id = excluded.initiative_id,
    status = CASE WHEN ${SYSTEM_RETIRED} THEN 'pending'
                  ELSE canonical_inbox_items.status END,
    resolved_at = CASE WHEN ${SYSTEM_RETIRED} THEN NULL
                       ELSE canonical_inbox_items.resolved_at END,
    metadata_json = CASE WHEN ${SYSTEM_RETIRED}
                         THEN (mw_safe_jsonb(canonical_inbox_items.metadata_json)
                               - 'mwLifecycle' - 'mwLifecycleAt')::text
                         ELSE canonical_inbox_items.metadata_json END,
    updated_at = excluded.updated_at`;

  const BATCH_SIZE = 40;

  async function upsertBatch(rows: unknown[][]): Promise<number> {
    let count = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((params) =>
          queryHelpers.queryRun(UPSERT_SQL, params).catch((err: any) => {
            logger.warn(`[InboxService] Upsert failed: ${err.message}`);
            return null;
          })
        )
      );
      count += results.filter(Boolean).length;
    }
    return count;
  }

  const [tasks, decisions, notifications] = await Promise.all([
    queryHelpers.queryAll<any>(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
              t.initiative_id, t.blocked_reason, t.blocked_by_decision_id
       FROM tasks t
       WHERE t.organization_id = ?
         AND t.assignee_id = ?
         AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')
       LIMIT 500`,
      [orgId, userId]
    ),
    queryHelpers.queryAll<any>(
      `SELECT d.id, d.title, d.description, d.type, d.priority, d.deadline, d.status,
              d.initiative_id
       FROM decisions d
       WHERE d.organization_id = ?
         AND d.decision_maker_id = ?
         AND lower(coalesce(d.status,'')) IN ('pending','escalated')
       LIMIT 200`,
      [orgId, userId]
    ),
    queryHelpers
      .queryAll<any>(
        `SELECT id, type, title, COALESCE(message, body, '') as body, priority, created_at
       FROM notifications
       WHERE user_id = ? AND COALESCE(read, 0) = 0
       LIMIT 200`,
        [userId]
      )
      .catch(() => [] as any[]),
  ]);

  const taskRows = tasks.map((t) => {
    const isBlocked = !!(t.blocked_reason || t.blocked_by_decision_id);
    const section = sectionForTask(t.status, t.due_date, today, isBlocked);
    return [
      uuidv4(),
      userId,
      orgId,
      'task',
      'task',
      t.id,
      t.title,
      t.description || null,
      priorityForItem(t.priority),
      section,
      t.due_date || null,
      t.status || null,
      t.initiative_id || null,
      now,
      now,
    ];
  });

  const decisionRows = decisions.map((d) => {
    const itemType = (d.type || '').toUpperCase().includes('APPROVAL') ? 'approval' : 'decision';
    const section = itemType === 'approval' ? 'approvals_gates' : 'decisions_required';
    return [
      uuidv4(),
      userId,
      orgId,
      itemType,
      'decision',
      d.id,
      d.title,
      d.description || null,
      priorityForItem(d.priority),
      section,
      d.deadline || null,
      d.status || null,
      d.initiative_id || null,
      now,
      now,
    ];
  });

  const notifRows = notifications.map((n) => {
    const nType = (n.type || '').toUpperCase();
    let itemType: CanonicalInboxItem['itemType'] = 'signal';
    let section = 'fyi_system';
    if (nType.includes('MENTION')) {
      itemType = 'mention';
      section = 'fyi_mentions';
    } else if (nType.includes('ESCALATION')) {
      itemType = 'escalation';
      section = 'blocked_escalations';
    } else if (nType.includes('REVIEW') || nType.includes('APPROVAL')) {
      itemType = 'approval';
      section = 'approvals_gates';
    } else if (nType.includes('AI') || nType.includes('INSIGHT')) {
      itemType = 'signal';
      section = 'ai_insights';
    }
    return [
      uuidv4(),
      userId,
      orgId,
      itemType,
      'notification',
      n.id,
      n.title || 'Notification',
      n.body || null,
      priorityForItem(n.priority),
      section,
      null,
      // Notifications have no "current status"/initiative concept — both
      // source_status and initiative_id are legitimately null here.
      null,
      null,
      now,
      now,
    ];
  });

  const [taskCount, decisionCount, notifCount] = await Promise.all([
    upsertBatch(taskRows),
    upsertBatch(decisionRows),
    upsertBatch(notifRows),
  ]);
  upserted = taskCount + decisionCount + notifCount;

  return { upserted };
}

export async function getInboxItems(
  userId: string,
  orgId: string,
  filters: InboxFilters = {}
): Promise<CanonicalInboxItem[]> {
  const conditions = ['user_id = ?', 'organization_id = ?'];
  const params: unknown[] = [userId, orgId];

  if (filters.section) {
    conditions.push('section = ?');
    params.push(filters.section);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }
  if (filters.slaStatus) {
    conditions.push('sla_status = ?');
    params.push(filters.slaStatus);
  }

  const limit = Math.min(filters.limit || 100, 500);
  const offset = filters.offset || 0;

  const rows = await queryHelpers.queryAll<any>(
    `SELECT * FROM canonical_inbox_items
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
       CASE sla_status WHEN 'breached' THEN 0 WHEN 'at_risk' THEN 1 WHEN 'on_track' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows.map(rowToItem);
}

export interface InboxOwnershipScope {
  userId: string;
  organizationId: string;
}

/**
 * Mutates a single canonical_inbox_items row, scoped to its owner.
 *
 * `scope` is mandatory: without it, any caller who knows/guesses an itemId
 * could mutate another user's or another org's inbox item (this was a real,
 * pre-existing tenancy gap — the UPDATE/SELECT below now carry an explicit
 * `user_id`/`organization_id` predicate). A non-owner and a nonexistent
 * itemId both resolve to `null` here — never distinguish the two, to avoid
 * leaking existence of another tenant's/user's item.
 */
export async function triageItem(
  itemId: string,
  action: string,
  params: Record<string, unknown> | undefined,
  scope: InboxOwnershipScope
): Promise<CanonicalInboxItem | null> {
  const now = new Date().toISOString();
  let newStatus: string;
  switch (action) {
    case 'resolve':
    case 'done':
      newStatus = 'resolved';
      break;
    case 'snooze':
      newStatus = 'snoozed';
      break;
    case 'delegate':
      newStatus = 'delegated';
      break;
    default:
      newStatus = 'triaged';
  }

  await queryHelpers.queryRun(
    `UPDATE canonical_inbox_items
     SET status = ?, updated_at = ?,
         resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END,
         metadata_json = COALESCE(?, metadata_json)
     WHERE id = ? AND user_id = ? AND organization_id = ?`,
    [
      newStatus,
      now,
      newStatus,
      now,
      params ? JSON.stringify(params) : null,
      itemId,
      scope.userId,
      scope.organizationId,
    ]
  );

  const row = await queryHelpers.queryOne<any>(
    `SELECT * FROM canonical_inbox_items WHERE id = ? AND user_id = ? AND organization_id = ?`,
    [itemId, scope.userId, scope.organizationId]
  );
  return row ? rowToItem(row) : null;
}

export async function delegateItem(
  itemId: string,
  toUserId: string,
  notes: string | undefined,
  delegatedBy: string
): Promise<CanonicalInboxItem | null> {
  const now = new Date().toISOString();

  const original = await queryHelpers.queryOne<any>(
    `SELECT * FROM canonical_inbox_items WHERE id = ?`,
    [itemId]
  );
  if (!original) return null;

  await queryHelpers.queryRun(
    `UPDATE canonical_inbox_items
     SET status = 'delegated', delegated_to = ?, delegated_at = ?,
         delegated_by = ?, delegation_notes = ?, updated_at = ?
     WHERE id = ?`,
    [toUserId, now, delegatedBy, notes || null, now, itemId]
  );

  const newId = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO canonical_inbox_items
       (id, user_id, organization_id, item_type, source_entity_type, source_entity_id,
        title, description, priority, section, status, sla_deadline, source_status,
        initiative_id, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      toUserId,
      original.organization_id,
      original.item_type,
      original.source_entity_type,
      original.source_entity_id,
      original.title,
      original.description,
      original.priority,
      original.section,
      original.sla_deadline || null,
      // Carry the source's status/initiative forward — delegation should not
      // silently drop these fields for the new recipient's copy.
      original.source_status || null,
      original.initiative_id || null,
      JSON.stringify({ delegatedFrom: delegatedBy, originalItemId: itemId }),
      now,
      now,
    ]
  );

  const row = await queryHelpers.queryOne<any>(`SELECT * FROM canonical_inbox_items WHERE id = ?`, [
    itemId,
  ]);
  return row ? rowToItem(row) : null;
}

export type InboxCloseResult = 'closed' | 'already_closed' | 'not_materialized';

/**
 * Closes the canonical inbox item projected from a given source entity
 * (e.g. a Task), scoped to the caller's ownership. This is the Inbox side
 * of the golden flow: Task is the source of truth, Inbox is a projection,
 * this function must never fabricate a success.
 *
 * Looks up the row via the unique (user_id, source_entity_type,
 * source_entity_id) key. Three honest outcomes, never a silent 200:
 * - `not_materialized`: no canonical_inbox_items row exists for this source
 *   at all (not an error — the item may never have been materialized).
 * - `already_closed`: the row exists and is already `status='resolved'`
 *   (idempotent no-op, safe to call repeatedly).
 * - `closed`: the row existed in a non-resolved state and was just resolved
 *   via `triageItem()`, under the same ownership scope used to find it.
 */
export async function closeInboxItemForSource(
  userId: string,
  organizationId: string,
  sourceEntityType: string,
  sourceEntityId: string,
  metadata?: Record<string, unknown>
): Promise<{ status: InboxCloseResult; item: CanonicalInboxItem | null }> {
  const row = await queryHelpers.queryOne<any>(
    `SELECT * FROM canonical_inbox_items
     WHERE user_id = ? AND organization_id = ? AND source_entity_type = ? AND source_entity_id = ?`,
    [userId, organizationId, sourceEntityType, sourceEntityId]
  );

  if (!row) {
    return { status: 'not_materialized', item: null };
  }

  if (row.status === 'resolved') {
    return { status: 'already_closed', item: rowToItem(row) };
  }

  const closed = await triageItem(row.id, 'done', metadata, { userId, organizationId });
  return { status: 'closed', item: closed };
}

export async function updateSlaStatus(orgId: string): Promise<{ updated: number }> {
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const breached = await queryHelpers.queryRun(
    `UPDATE canonical_inbox_items
     SET sla_status = 'breached', updated_at = ?
     WHERE organization_id = ?
       AND sla_deadline IS NOT NULL
       AND sla_deadline < ?
       AND sla_status NOT IN ('breached', 'resolved')
       AND status NOT IN ('resolved')`,
    [nowIso, orgId, nowIso]
  );

  const atRisk = await queryHelpers.queryRun(
    `UPDATE canonical_inbox_items
     SET sla_status = 'at_risk', updated_at = ?
     WHERE organization_id = ?
       AND sla_deadline IS NOT NULL
       AND sla_deadline >= ?
       AND sla_deadline <= ?
       AND sla_status NOT IN ('at_risk', 'breached', 'resolved')
       AND status NOT IN ('resolved')`,
    [nowIso, orgId, nowIso, twoHoursFromNow]
  );

  return { updated: (breached?.changes || 0) + (atRisk?.changes || 0) };
}

export async function getInboxStats(userId: string, orgId: string): Promise<InboxStats> {
  const rows = await queryHelpers.queryAll<any>(
    `SELECT section, sla_status, priority, status, COUNT(*) as cnt
     FROM canonical_inbox_items
     WHERE user_id = ? AND organization_id = ?
     GROUP BY section, sla_status, priority, status`,
    [userId, orgId]
  );

  const stats: InboxStats = {
    total: 0,
    bySection: {},
    bySlaStatus: {},
    byPriority: {},
    byStatus: {},
  };

  for (const r of rows) {
    const cnt = Number(r.cnt) || 0;
    stats.total += cnt;
    stats.bySection[r.section] = (stats.bySection[r.section] || 0) + cnt;
    stats.bySlaStatus[r.sla_status] = (stats.bySlaStatus[r.sla_status] || 0) + cnt;
    stats.byPriority[r.priority] = (stats.byPriority[r.priority] || 0) + cnt;
    stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + cnt;
  }

  return stats;
}

export default {
  materializeInboxItems,
  getInboxItems,
  triageItem,
  delegateItem,
  closeInboxItemForSource,
  updateSlaStatus,
  getInboxStats,
};
