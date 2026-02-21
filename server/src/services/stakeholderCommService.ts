import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StakeholderSegment {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  name: string;
  description: string | null;
  segmentType: string | null;
  membersJson: unknown[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationPlan {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  cadence: string;
  ownerUserId: string | null;
  description: string | null;
  isActive: boolean;
  nextDueAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationPlanItem {
  id: string;
  planId: string;
  commType: string;
  segmentIds: string[];
  subject: string | null;
  content: string | null;
  templateId: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  sentBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  channel: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationTemplate {
  id: string;
  organizationId: string;
  name: string;
  commType: string | null;
  subjectTemplate: string | null;
  bodyTemplate: string | null;
  fieldsJson: unknown[];
  isGlobal: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface SendLogEntry {
  id: string;
  planItemId: string | null;
  organizationId: string;
  initiativeId: string | null;
  segmentId: string | null;
  channel: string | null;
  recipientCount: number;
  sentBy: string | null;
  sentAt: string;
  followUpTask: string | null;
  metadata: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Row mappers                                                        */
/* ------------------------------------------------------------------ */

function mapSegment(row: any): StakeholderSegment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    name: row.name,
    description: row.description,
    segmentType: row.segment_type,
    membersJson:
      typeof row.members_json === 'string'
        ? JSON.parse(row.members_json)
        : (row.members_json ?? []),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlan(row: any): CommunicationPlan {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    cadence: row.cadence,
    ownerUserId: row.owner_user_id,
    description: row.description,
    isActive: Boolean(row.is_active),
    nextDueAt: row.next_due_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlanItem(row: any): CommunicationPlanItem {
  return {
    id: row.id,
    planId: row.plan_id,
    commType: row.comm_type,
    segmentIds:
      typeof row.segment_ids === 'string' ? JSON.parse(row.segment_ids) : (row.segment_ids ?? []),
    subject: row.subject,
    content: row.content,
    templateId: row.template_id,
    status: row.status,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    sentBy: row.sent_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    channel: row.channel ?? 'email',
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTemplate(row: any): CommunicationTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    commType: row.comm_type,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    fieldsJson:
      typeof row.fields_json === 'string' ? JSON.parse(row.fields_json) : (row.fields_json ?? []),
    isGlobal: Boolean(row.is_global),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapSendLog(row: any): SendLogEntry {
  return {
    id: row.id,
    planItemId: row.plan_item_id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    segmentId: row.segment_id,
    channel: row.channel,
    recipientCount: row.recipient_count,
    sentBy: row.sent_by,
    sentAt: row.sent_at,
    followUpTask: row.follow_up_task,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
  };
}

/* ------------------------------------------------------------------ */
/*  Segments CRUD                                                      */
/* ------------------------------------------------------------------ */

export async function createSegment(
  orgId: string,
  data: {
    initiativeId?: string;
    name: string;
    description?: string;
    segmentType?: string;
    membersJson?: unknown[];
    createdBy?: string;
  }
): Promise<StakeholderSegment> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO stakeholder_segments (id, organization_id, initiative_id, name, description, segment_type, members_json, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      orgId,
      data.initiativeId ?? null,
      data.name,
      data.description ?? null,
      data.segmentType ?? null,
      JSON.stringify(data.membersJson ?? []),
      data.createdBy ?? null,
    ]
  );
  return getSegment(orgId, id) as Promise<StakeholderSegment>;
}

export async function getSegments(
  orgId: string,
  initiativeId?: string
): Promise<StakeholderSegment[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM stakeholder_segments WHERE organization_id = $1`;
  if (initiativeId) {
    sql += ` AND initiative_id = $2`;
    params.push(initiativeId);
  }
  sql += ` ORDER BY name`;
  const rows = await dbAll(sql, params);
  return rows.map(mapSegment);
}

export async function getSegment(orgId: string, id: string): Promise<StakeholderSegment | null> {
  const row = await dbGet(
    `SELECT * FROM stakeholder_segments WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  return row ? mapSegment(row) : null;
}

export async function updateSegment(
  orgId: string,
  id: string,
  data: Partial<{ name: string; description: string; segmentType: string; membersJson: unknown[] }>
): Promise<StakeholderSegment | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(data.description);
  }
  if (data.segmentType !== undefined) {
    sets.push(`segment_type = $${idx++}`);
    params.push(data.segmentType);
  }
  if (data.membersJson !== undefined) {
    sets.push(`members_json = $${idx++}`);
    params.push(JSON.stringify(data.membersJson));
  }
  if (sets.length === 0) return getSegment(orgId, id);
  sets.push(`updated_at = NOW()`);
  params.push(id, orgId);
  await dbRun(
    `UPDATE stakeholder_segments SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
    params
  );
  return getSegment(orgId, id);
}

export async function deleteSegment(orgId: string, id: string): Promise<void> {
  await dbRun(`DELETE FROM stakeholder_segments WHERE id = $1 AND organization_id = $2`, [
    id,
    orgId,
  ]);
}

/* ------------------------------------------------------------------ */
/*  Communication Plans                                                */
/* ------------------------------------------------------------------ */

export async function createPlan(
  orgId: string,
  data: {
    initiativeId?: string;
    cadence?: string;
    ownerUserId?: string;
    description?: string;
    createdBy?: string;
  }
): Promise<CommunicationPlan> {
  const id = uuidv4();
  const cadence = data.cadence ?? 'weekly';
  const nextDue = computeNextDue(cadence);
  await dbRun(
    `INSERT INTO communication_plans (id, organization_id, initiative_id, cadence, owner_user_id, description, next_due_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      orgId,
      data.initiativeId ?? null,
      cadence,
      data.ownerUserId ?? null,
      data.description ?? null,
      nextDue,
      data.createdBy ?? null,
    ]
  );
  return getPlan(orgId, id) as Promise<CommunicationPlan>;
}

export async function getPlans(orgId: string, initiativeId?: string): Promise<CommunicationPlan[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM communication_plans WHERE organization_id = $1`;
  if (initiativeId) {
    sql += ` AND initiative_id = $2`;
    params.push(initiativeId);
  }
  sql += ` ORDER BY created_at DESC`;
  const rows = await dbAll(sql, params);
  return rows.map(mapPlan);
}

export async function getPlan(orgId: string, id: string): Promise<CommunicationPlan | null> {
  const row = await dbGet(
    `SELECT * FROM communication_plans WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  return row ? mapPlan(row) : null;
}

export async function updatePlan(
  orgId: string,
  id: string,
  data: Partial<{ cadence: string; ownerUserId: string; description: string; isActive: boolean }>
): Promise<CommunicationPlan | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (data.cadence !== undefined) {
    sets.push(`cadence = $${idx++}`);
    params.push(data.cadence);
  }
  if (data.ownerUserId !== undefined) {
    sets.push(`owner_user_id = $${idx++}`);
    params.push(data.ownerUserId);
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(data.description);
  }
  if (data.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(data.isActive);
  }
  if (sets.length === 0) return getPlan(orgId, id);
  sets.push(`updated_at = NOW()`);
  params.push(id, orgId);
  await dbRun(
    `UPDATE communication_plans SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
    params
  );
  return getPlan(orgId, id);
}

/* ------------------------------------------------------------------ */
/*  Plan Items                                                         */
/* ------------------------------------------------------------------ */

export async function createPlanItem(
  orgId: string,
  planId: string,
  data: {
    commType: string;
    segmentIds?: string[];
    subject?: string;
    content?: string;
    templateId?: string;
    scheduledAt?: string;
    channel?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<CommunicationPlanItem> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO communication_plan_items (id, plan_id, comm_type, segment_ids, subject, content, template_id, scheduled_at, channel, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      planId,
      data.commType,
      JSON.stringify(data.segmentIds ?? []),
      data.subject ?? null,
      data.content ?? null,
      data.templateId ?? null,
      data.scheduledAt ?? null,
      data.channel ?? 'email',
      JSON.stringify(data.metadata ?? {}),
    ]
  );
  return getPlanItem(planId, id) as Promise<CommunicationPlanItem>;
}

export async function getPlanItems(planId: string): Promise<CommunicationPlanItem[]> {
  const rows = await dbAll(
    `SELECT * FROM communication_plan_items WHERE plan_id = $1 ORDER BY created_at`,
    [planId]
  );
  return rows.map(mapPlanItem);
}

export async function getPlanItem(
  planId: string,
  id: string
): Promise<CommunicationPlanItem | null> {
  const row = await dbGet(`SELECT * FROM communication_plan_items WHERE id = $1 AND plan_id = $2`, [
    id,
    planId,
  ]);
  return row ? mapPlanItem(row) : null;
}

export async function markItemSent(
  planId: string,
  itemId: string,
  userId: string
): Promise<CommunicationPlanItem | null> {
  await dbRun(
    `UPDATE communication_plan_items SET status = 'sent', sent_at = NOW(), sent_by = $1, updated_at = NOW() WHERE id = $2 AND plan_id = $3`,
    [userId, itemId, planId]
  );
  return getPlanItem(planId, itemId);
}

/* ------------------------------------------------------------------ */
/*  Send Log                                                           */
/* ------------------------------------------------------------------ */

export async function logSend(
  orgId: string,
  data: {
    planItemId?: string;
    initiativeId?: string;
    segmentId?: string;
    channel?: string;
    recipientCount: number;
    sentBy?: string;
    followUpTask?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<SendLogEntry> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO communication_send_log (id, plan_item_id, organization_id, initiative_id, segment_id, channel, recipient_count, sent_by, follow_up_task, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      data.planItemId ?? null,
      orgId,
      data.initiativeId ?? null,
      data.segmentId ?? null,
      data.channel ?? null,
      data.recipientCount,
      data.sentBy ?? null,
      data.followUpTask ?? null,
      JSON.stringify(data.metadata ?? {}),
    ]
  );
  const row = await dbGet(`SELECT * FROM communication_send_log WHERE id = $1`, [id]);
  return mapSendLog(row);
}

export async function getSendLog(
  orgId: string,
  filters?: { initiativeId?: string; planItemId?: string; limit?: number }
): Promise<SendLogEntry[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM communication_send_log WHERE organization_id = $1`;
  let idx = 2;
  if (filters?.initiativeId) {
    sql += ` AND initiative_id = $${idx++}`;
    params.push(filters.initiativeId);
  }
  if (filters?.planItemId) {
    sql += ` AND plan_item_id = $${idx++}`;
    params.push(filters.planItemId);
  }
  sql += ` ORDER BY sent_at DESC`;
  if (filters?.limit) {
    sql += ` LIMIT $${idx++}`;
    params.push(filters.limit);
  }
  const rows = await dbAll(sql, params);
  return rows.map(mapSendLog);
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export async function getTemplates(orgId: string): Promise<CommunicationTemplate[]> {
  const rows = await dbAll(
    `SELECT * FROM communication_templates WHERE organization_id = $1 OR is_global = TRUE ORDER BY name`,
    [orgId]
  );
  return rows.map(mapTemplate);
}

export async function createTemplate(
  orgId: string,
  data: {
    name: string;
    commType?: string;
    subjectTemplate?: string;
    bodyTemplate?: string;
    fieldsJson?: unknown[];
    isGlobal?: boolean;
    createdBy?: string;
  }
): Promise<CommunicationTemplate> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO communication_templates (id, organization_id, name, comm_type, subject_template, body_template, fields_json, is_global, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      orgId,
      data.name,
      data.commType ?? null,
      data.subjectTemplate ?? null,
      data.bodyTemplate ?? null,
      JSON.stringify(data.fieldsJson ?? []),
      data.isGlobal ?? false,
      data.createdBy ?? null,
    ]
  );
  const row = await dbGet(`SELECT * FROM communication_templates WHERE id = $1`, [id]);
  return mapTemplate(row);
}

/* ------------------------------------------------------------------ */
/*  Overdue Plans & Cadence                                            */
/* ------------------------------------------------------------------ */

export async function getOverduePlans(orgId: string): Promise<CommunicationPlan[]> {
  const rows = await dbAll(
    `SELECT * FROM communication_plans WHERE organization_id = $1 AND is_active = TRUE AND next_due_at < NOW() ORDER BY next_due_at`,
    [orgId]
  );
  return rows.map(mapPlan);
}

export async function advancePlanDue(
  orgId: string,
  planId: string
): Promise<CommunicationPlan | null> {
  const plan = await getPlan(orgId, planId);
  if (!plan) return null;
  const nextDue = computeNextDue(plan.cadence);
  await dbRun(
    `UPDATE communication_plans SET next_due_at = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
    [nextDue, planId, orgId]
  );
  return getPlan(orgId, planId);
}

export function computeNextDue(cadence: string, from?: Date): string {
  const base = from ?? new Date();
  const next = new Date(base);
  switch (cadence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    default:
      next.setDate(next.getDate() + 7);
      break;
  }
  return next.toISOString();
}
