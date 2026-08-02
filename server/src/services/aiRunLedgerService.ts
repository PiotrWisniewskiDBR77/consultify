import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

type AIRunStatus =
  | 'proposed'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'audited'
  | 'closed';

interface ActionRow {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  project_id?: string | null;
  action_type?: string | null;
  payload?: string | Record<string, unknown> | null;
  draft_content?: string | Record<string, unknown> | null;
  status?: string | null;
  current_policy_level?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  executed_at?: string | null;
}

interface RecordEventInput {
  action: ActionRow;
  eventType: string;
  status: AIRunStatus;
  actorUserId?: string | null;
  details?: Record<string, unknown>;
  outputRefs?: unknown[];
  audit?: Record<string, unknown>;
}

let schemaReady: Promise<void> | null = null;

const ACTION_CENTER_SORT_EXPR = 'COALESCE(CAST(l.updated_at AS TEXT), CAST(a.created_at AS TEXT))';

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

export function lifecycleFromDbStatus(status: string | null | undefined): AIRunStatus {
  switch (String(status || '').toUpperCase()) {
    case 'PENDING':
      return 'pending_review';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'EXECUTING':
      return 'executing';
    case 'EXECUTED':
      return 'executed';
    case 'FAILED':
      return 'failed';
    case 'AUDITED':
      return 'audited';
    case 'CLOSED':
      return 'closed';
    default:
      return 'proposed';
  }
}

function severityForAction(action: ActionRow): 'low' | 'medium' | 'high' {
  const payload = safeJsonParse<Record<string, unknown>>(action.payload, {});
  const explicit = String(payload.riskLevel || payload.risk || '').toLowerCase();
  if (explicit === 'high' || explicit === 'critical') return 'high';
  if (explicit === 'low') return 'low';
  const type = String(action.action_type || '').toUpperCase();
  if (type.includes('UPDATE') || type.includes('DELETE') || type.includes('DECISION'))
    return 'high';
  if (type.includes('CREATE') || type.includes('GENERATE') || type.includes('REPORT'))
    return 'medium';
  return 'low';
}

function buildTrigger(action: ActionRow): string {
  const payload = safeJsonParse<Record<string, unknown>>(action.payload, {});
  return String(payload.trigger || payload.goal || payload.prompt || 'chat_execution_proposal');
}

function mapActionRow(row: any) {
  const payload = safeJsonParse<Record<string, unknown>>(row.payload, {});
  const draftContent = safeJsonParse<Record<string, unknown> | null>(row.draft_content, null);
  const sourceContext = safeJsonParse<Record<string, unknown>>(row.source_context, {});
  const outputRefs = safeJsonParse<unknown[]>(row.output_refs, []);
  const audit = safeJsonParse<Record<string, unknown>>(row.audit, {});
  const events = safeJsonParse<unknown[]>(row.events, []);

  return {
    id: row.action_id || row.id,
    actionId: row.action_id || row.id,
    runId: row.run_id || null,
    type: row.action_type,
    actionType: row.action_type,
    title:
      payload.title || payload.name || draftContent?.title || draftContent?.name || row.action_type,
    description:
      payload.description ||
      draftContent?.description ||
      `Governed AI action: ${row.action_type || 'unknown'}`,
    payload,
    draftContent,
    status: lifecycleFromDbStatus(row.action_status || row.status),
    dbStatus: row.action_status || row.status,
    severity: row.severity || severityForAction(row),
    risk: row.severity || severityForAction(row),
    trigger: row.trigger || buildTrigger(row),
    userId: row.user_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    tool: row.tool || row.action_type,
    sourceContext,
    outputRefs,
    audit,
    events,
    proposedAt: row.action_created_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    executedAt: row.executed_at,
    closedAt: row.closed_at,
  };
}

export async function ensureAIRunLedgerSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS ai_run_ledger (
        run_id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL UNIQUE,
        trigger TEXT NOT NULL,
        user_id TEXT,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        tool TEXT,
        source_context TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        output_refs TEXT NOT NULL DEFAULT '[]',
        audit TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at TEXT
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS ai_run_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_user_id TEXT,
        status TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_ai_run_ledger_org_status ON ai_run_ledger(organization_id, status)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_ai_run_events_action ON ai_run_events(action_id, created_at)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export async function ensureRunForAction(action: ActionRow): Promise<any> {
  await ensureAIRunLedgerSchema();
  const existing = await dbGet(`SELECT * FROM ai_run_ledger WHERE action_id = ?`, [action.id]);
  if (existing) return existing;

  const runId = `airun-${uuidv4()}`;
  const status = lifecycleFromDbStatus(action.status);
  const sourceContext = {
    actionId: action.id,
    payload: safeJsonParse<Record<string, unknown>>(action.payload, {}),
    draftContent: safeJsonParse<Record<string, unknown> | null>(action.draft_content, null),
  };
  await dbRun(
    `INSERT INTO ai_run_ledger (
      run_id, action_id, trigger, user_id, organization_id, project_id, tool,
      source_context, status, severity, output_refs, audit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      action.id,
      buildTrigger(action),
      action.user_id || null,
      action.organization_id || 'unknown',
      action.project_id || null,
      action.action_type || 'unknown',
      safeJsonStringify(sourceContext),
      status,
      severityForAction(action),
      '[]',
      safeJsonStringify({
        approvalRequired: true,
        noSilentExecution: true,
        policyLevel: action.current_policy_level || null,
      }),
    ]
  );
  return dbGet(`SELECT * FROM ai_run_ledger WHERE action_id = ?`, [action.id]);
}

export async function recordAIRunEvent(input: RecordEventInput): Promise<any> {
  await ensureAIRunLedgerSchema();
  const run = await ensureRunForAction(input.action);
  const eventId = uuidv4();
  const auditPatch = {
    ...(safeJsonParse<Record<string, unknown>>(run.audit, {}) || {}),
    ...(input.audit || {}),
    lastEventType: input.eventType,
    lastActorUserId: input.actorUserId || null,
    lastUpdatedAt: new Date().toISOString(),
  };
  const outputRefs =
    input.outputRefs !== undefined
      ? input.outputRefs
      : safeJsonParse<unknown[]>(run.output_refs, []);

  await dbRun(
    `INSERT INTO ai_run_events
      (id, run_id, action_id, event_type, actor_user_id, status, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      run.run_id,
      input.action.id,
      input.eventType,
      input.actorUserId || null,
      input.status,
      safeJsonStringify(input.details || {}),
    ]
  );
  await dbRun(
    `UPDATE ai_run_ledger
     SET status = ?, output_refs = ?, audit = ?, updated_at = CURRENT_TIMESTAMP,
         closed_at = CASE
           WHEN ? IN ('rejected', 'failed', 'audited', 'closed') THEN CURRENT_TIMESTAMP
           ELSE NULLIF(closed_at::text, '')::timestamptz
         END
     WHERE run_id = ?`,
    [
      input.status,
      safeJsonStringify(outputRefs),
      safeJsonStringify(auditPatch),
      input.status,
      run.run_id,
    ]
  );
  return getAIRunByAction(input.action.id);
}

export async function getAIRunByAction(actionId: string): Promise<any | null> {
  await ensureAIRunLedgerSchema();
  const row = await dbGet(
    `SELECT
      a.id AS action_id,
      a.status AS action_status,
      a.action_type,
      a.payload,
      a.draft_content,
      a.user_id,
      a.organization_id,
      a.project_id,
      a.created_at AS action_created_at,
      a.approved_at,
      a.approved_by,
      a.executed_at,
      l.*
     FROM ai_actions a
     LEFT JOIN ai_run_ledger l ON l.action_id = a.id
     WHERE a.id = ?`,
    [actionId]
  );
  if (!row) return null;
  const events = await listAIRunEvents(actionId);
  return mapActionRow({ ...row, events: safeJsonStringify(events) });
}

export async function listAIRunEvents(actionId: string): Promise<any[]> {
  await ensureAIRunLedgerSchema();
  const rows = await dbAll(
    `SELECT id, run_id, action_id, event_type, actor_user_id, status, details, created_at
     FROM ai_run_events
     WHERE action_id = ?
     ORDER BY created_at ASC`,
    [actionId]
  );
  return (rows || []).map((row: any) => ({
    id: row.id,
    runId: row.run_id,
    actionId: row.action_id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    status: row.status,
    details: safeJsonParse<Record<string, unknown>>(row.details, {}),
    createdAt: row.created_at,
  }));
}

export async function listActionCenter(params: {
  organizationId: string;
  userId?: string | null;
  projectId?: string | null;
  status?: string | null;
  limit?: number;
  adminView?: boolean;
}): Promise<any[]> {
  await ensureAIRunLedgerSchema();
  const filters = [`a.organization_id = ?`];
  const values: unknown[] = [params.organizationId];
  if (!params.adminView && params.userId) {
    filters.push(`a.user_id = ?`);
    values.push(params.userId);
  }
  if (params.projectId) {
    filters.push(`a.project_id = ?`);
    values.push(params.projectId);
  }
  if (params.status) {
    filters.push(`UPPER(a.status) = ?`);
    values.push(String(params.status).toUpperCase());
  }
  values.push(Math.min(Math.max(params.limit || 100, 1), 250));

  const rows = await dbAll(
    `SELECT
      a.id AS action_id,
      a.status AS action_status,
      a.action_type,
      a.payload,
      a.draft_content,
      a.user_id,
      a.organization_id,
      a.project_id,
      a.created_at AS action_created_at,
      a.approved_at,
      a.approved_by,
      a.executed_at,
      l.*
     FROM ai_actions a
     LEFT JOIN ai_run_ledger l ON l.action_id = a.id
     WHERE ${filters.join(' AND ')}
     ORDER BY ${ACTION_CENTER_SORT_EXPR} DESC
     LIMIT ?`,
    values
  );
  return Promise.all(
    (rows || []).map(async (row: any) => {
      const events = await listAIRunEvents(row.action_id);
      return mapActionRow({ ...row, events: safeJsonStringify(events.slice(-12)) });
    })
  );
}

export async function listAIRuns(params: {
  organizationId: string;
  userId?: string | null;
  projectId?: string | null;
  status?: string | null;
  limit?: number;
  adminView?: boolean;
}): Promise<any[]> {
  return listActionCenter({
    organizationId: params.organizationId,
    userId: params.userId,
    projectId: params.projectId,
    status: params.status,
    limit: params.limit,
    adminView: params.adminView === true,
  });
}

export async function recordLegacyAuditSafely(
  fn: () => Promise<unknown>,
  context: Record<string, unknown>
): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    logger.warn('[AIRunLedger] Legacy audit write failed', {
      ...context,
      error: err?.message || String(err),
    });
  }
}
