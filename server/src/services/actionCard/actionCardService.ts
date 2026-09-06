import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import notificationService from '../notificationService.js';
export { readLegacyActionCardCandidates } from './adapters/index.js';

export const ACTION_CARD_SOURCE_KINDS = [
  'kpi_deviation',
  'execution_delay',
  'audit_finding',
  'finance_variance',
  'meeting_action',
] as const;

export type ActionCardSourceKind = (typeof ACTION_CARD_SOURCE_KINDS)[number];
export type ActionCardStatus = 'OPEN' | 'CLOSED';

export interface ActionCard {
  id: string;
  organizationId: string;
  sourceKind: ActionCardSourceKind;
  sourceId: string;
  periodStart: string;
  periodEnd: string;
  goalMet: boolean;
  actionRequired: boolean;
  problem: string;
  rootCause: string;
  actionText: string;
  ownerUserId: string;
  ownerName?: string;
  dueDate: string;
  comment?: string;
  status: ActionCardStatus;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface CreateActionCardInput {
  sourceKind: ActionCardSourceKind;
  sourceId: string;
  periodStart: string;
  periodEnd: string;
  goalMet: boolean;
  actionRequired: boolean;
  problem: string;
  rootCause: string;
  actionText: string;
  ownerUserId: string;
  dueDate: string;
  comment?: string;
}

export interface ActionCardScope {
  organizationId: string;
  actorUserId: string;
}

function rowToActionCard(row: any): ActionCard {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    periodStart: String(row.period_start).slice(0, 10),
    periodEnd: String(row.period_end).slice(0, 10),
    goalMet: Boolean(row.goal_met),
    actionRequired: Boolean(row.action_required),
    problem: row.problem,
    rootCause: row.root_cause,
    actionText: row.action_text,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name || undefined,
    dueDate: String(row.due_date).slice(0, 10),
    comment: row.comment || undefined,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

const SELECT_ACTION_CARD = `SELECT ac.*,
  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS owner_name
 FROM action_cards ac
 LEFT JOIN users u ON u.id = ac.owner_user_id AND u.organization_id = ac.organization_id`;

export async function listActionCards(
  scope: ActionCardScope,
  filters: { ownerUserId?: string; status?: ActionCardStatus; sourceKind?: ActionCardSourceKind } = {}
): Promise<ActionCard[]> {
  const where = ['ac.organization_id = ?'];
  const params: unknown[] = [scope.organizationId];
  if (filters.ownerUserId) {
    where.push('ac.owner_user_id = ?');
    params.push(filters.ownerUserId);
  }
  if (filters.status) {
    where.push('ac.status = ?');
    params.push(filters.status);
  }
  if (filters.sourceKind) {
    where.push('ac.source_kind = ?');
    params.push(filters.sourceKind);
  }
  const rows = await queryHelpers.queryAll<any>(
    `${SELECT_ACTION_CARD} WHERE ${where.join(' AND ')} ORDER BY ac.due_date, ac.created_at DESC`,
    params
  );
  return rows.map(rowToActionCard);
}

export async function createActionCard(
  scope: ActionCardScope,
  input: CreateActionCardInput
): Promise<ActionCard> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await queryHelpers.queryRun(
    `INSERT INTO action_cards
      (id, organization_id, source_kind, source_id, period_start, period_end,
       goal_met, action_required, problem, root_cause, action_text, owner_user_id,
       due_date, comment, status, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)`,
    [id, scope.organizationId, input.sourceKind, input.sourceId, input.periodStart, input.periodEnd,
      input.goalMet, input.actionRequired, input.problem, input.rootCause, input.actionText,
      input.ownerUserId, input.dueDate, input.comment || null, scope.actorUserId, now,
      scope.actorUserId, now]
  );
  await notificationService.send({
    userId: input.ownerUserId,
    organizationId: scope.organizationId,
    type: 'ACTION_CARD_ASSIGNED',
    title: 'Karta działania wymaga reakcji',
    body: input.actionText,
    entityType: 'action_card',
    entityId: id,
    actionUrl: `/my-work/inbox?actionCardId=${encodeURIComponent(id)}`,
    isActionable: true,
    dedupeKey: `action-card:${id}`,
  });
  const [created] = await listActionCards(scope, { ownerUserId: input.ownerUserId });
  const exact = created?.id === id ? created : (await queryHelpers.queryAll<any>(`${SELECT_ACTION_CARD} WHERE ac.id = ? AND ac.organization_id = ?`, [id, scope.organizationId])).map(rowToActionCard)[0];
  return exact;
}

export async function updateActionCard(
  scope: ActionCardScope,
  id: string,
  patch: Partial<Pick<CreateActionCardInput, 'periodStart' | 'periodEnd' | 'goalMet' | 'actionRequired' | 'problem' | 'rootCause' | 'actionText' | 'ownerUserId' | 'dueDate' | 'comment'>>
): Promise<ActionCard | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  const mapping: Record<string, string> = { periodStart: 'period_start', periodEnd: 'period_end', goalMet: 'goal_met', actionRequired: 'action_required', problem: 'problem', rootCause: 'root_cause', actionText: 'action_text', ownerUserId: 'owner_user_id', dueDate: 'due_date', comment: 'comment' };
  for (const [key, column] of Object.entries(mapping)) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      fields.push(`${column} = ?`);
      params.push((patch as any)[key]);
    }
  }
  if (fields.length === 0) return null;
  fields.push('updated_by = ?', 'updated_at = ?');
  params.push(scope.actorUserId, new Date().toISOString(), id, scope.organizationId);
  const result = await queryHelpers.queryRun(`UPDATE action_cards SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`, params);
  if (!result) return null;
  const rows = await queryHelpers.queryAll<any>(`${SELECT_ACTION_CARD} WHERE ac.id = ? AND ac.organization_id = ?`, [id, scope.organizationId]);
  return rows[0] ? rowToActionCard(rows[0]) : null;
}

export async function closeActionCard(scope: ActionCardScope, id: string): Promise<ActionCard | null> {
  await queryHelpers.queryRun(
    `UPDATE action_cards SET status = 'CLOSED', updated_by = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
    [scope.actorUserId, new Date().toISOString(), id, scope.organizationId]
  );
  const rows = await queryHelpers.queryAll<any>(`${SELECT_ACTION_CARD} WHERE ac.id = ? AND ac.organization_id = ?`, [id, scope.organizationId]);
  return rows[0] ? rowToActionCard(rows[0]) : null;
}
