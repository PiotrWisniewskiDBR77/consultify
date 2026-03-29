/**
 * My Work Routes
 *
 * Provides aggregated endpoints for the My Work module:
 * - Inbox (triage)
 * - Focus (lightweight focus state)
 * - Stats / Team workload (executive view)
 *
 * IMPORTANT:
 * - No mock/demo/sample data. All outputs are derived from real tables.
 * - Uses small state tables created with IF NOT EXISTS for triage/focus persistence.
 */

import { type Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { featureFlags } from '../config/FeatureFlags.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import auditEventsService from '../services/AuditEventsService.js';
import { getAiNews, pickTipOfDay } from '../services/homeCoverFeedService.js';
import type { OutcomeType } from '../services/ideaClusterService.js';
import { createOutcomeFromCluster, materializeClusters } from '../services/ideaClusterService.js';
import { InboxAiAssistItemSchema, runInboxAiAssist } from '../services/inboxAiAssistService.js';
import inboxService from '../services/inboxService.js';
import {
  addNotebookAttachmentsToPage,
  NotebookAttachmentMutationError,
  parseNotebookAttachments,
  removeNotebookAttachmentFromPage,
  resolveNotebookAttachmentFile,
  toPublicNotebookAttachments,
} from '../services/notebookAttachmentService.js';
import notebookService from '../services/notebookService.js';
import {
  resolveStoredNotebookSourceFile,
  toPublicNotebookCaptureMetadata,
} from '../services/notebookSourceFileService.js';
import NotificationService from '../services/notificationService.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import { radarActionService } from '../services/radar/radarActionService.js';
import { radarRankingService } from '../services/radar/radarRankingService.js';
import { radarService } from '../services/radar/radarService.js';
import projectionService from '../services/tablePlatform/ProjectionService.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import { getActiveRoomsByOrg, getRoomHealth } from '../services/v8/collaborationRoomService.js';
import { rollupSignals } from '../services/v8/executionVisibilityService.js';
import { getPendingDecisions } from '../services/v8/planningContinuityService.js';
import { getCapacityOverview, getOverloadAlerts } from '../services/workloadCapacityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import {
  ensureLatestSchema,
  normalizeGraphForStorage,
  validateAndNormalizeGraph,
} from '../validators/ideaWorkspaceGraph.validators.js';

const router = Router();

const isPostgres = process.env.DB_TYPE === 'postgres';
const nowSql = () => (isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')");
const daysAgoSql = (days: number) =>
  isPostgres ? `CURRENT_TIMESTAMP - INTERVAL '${days} days'` : `datetime('now', '-${days} days')`;
const daysAheadSql = (days: number) =>
  isPostgres ? `CURRENT_TIMESTAMP + INTERVAL '${days} days'` : `datetime('now', '+${days} days')`;
const weekBucketSql = (column: string) =>
  isPostgres
    ? `to_char(date_trunc('week', ${column}), 'IYYY-"W"IW')`
    : `strftime('%Y-W%W', ${column})`;
const dayDiffSql = (endColumn: string, startColumn: string) =>
  isPostgres
    ? `EXTRACT(EPOCH FROM (${endColumn} - ${startColumn})) / 86400.0`
    : `julianday(${endColumn}) - julianday(${startColumn})`;

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

type InboxItemType =
  | 'new_assignment'
  | 'mention'
  | 'escalation'
  | 'review_request'
  | 'decision_request'
  | 'ai_suggestion'
  | 'system_alert'
  | 'billing_alert'
  | 'project_update';

type TriageAction =
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

type InboxUrgency = 'critical' | 'high' | 'normal' | 'low';

type FocusColumn = 'today' | 'thisWeek' | 'later';

type InboxItemKey = `task:${string}` | `decision:${string}` | `notification:${string}`;

/** V4-INBX-01: Canonical item type for routing and filtering */
type CanonicalItemType = 'task' | 'decision' | 'approval' | 'signal';

type InboxSection =
  | 'decisions_required'
  | 'approvals_gates'
  | 'assigned_tasks'
  | 'blocked_escalations'
  | 'overdue_sla_breach'
  | 'fyi_system'
  | 'fyi_mentions'
  | 'ai_insights'
  | 'other';

type SlaLevel = 'none' | 'L1' | 'L2' | 'L3';

interface InboxItem {
  id: string;
  type: InboxItemType;
  section: InboxSection;
  title: string;
  description?: string;
  source: {
    type: 'user' | 'system' | 'ai';
    userId?: string;
    userName?: string;
    avatarUrl?: string;
  };
  receivedAt: string;
  urgency: InboxUrgency;
  dueDate?: string;
  sla?: {
    dueAt: string;
    remainingMs: number;
    isBreached: boolean;
    level: SlaLevel;
  };
  linkedTaskId?: string;
  linkedDecisionId?: string;
  linkedInitiativeId?: string;
  linkedTask?: { id: string; title: string; status: string; priority: string; dueDate?: string };
  triaged: boolean;
  triagedAt?: string;
  triageAction?: TriageAction;
  triageParams?: Record<string, unknown>;
  // N1: Read vs Done semantics
  itemStatus: 'open' | 'done' | 'saved' | 'snoozed' | 'dismissed';
  // N7: "Why am I seeing this?"
  reason: string;
  // N2: Is this item actionable (requires my action)?
  isActionable: boolean;
  // C1: AI suggestions (V4-INBX-03: confidence score 0–1)
  suggestedAction?: TriageAction;
  suggestedReason?: string;
  suggestedConfidence?: number;
  // V4-INBX-01: Canonical type for routing (task|decision|approval|signal)
  itemType: CanonicalItemType;
  _key: InboxItemKey;
}

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

async function applyInboxTriageSideEffects({
  userId,
  orgId,
  itemKey,
  action,
  params,
  triagedAt,
}: {
  userId: string;
  orgId: string;
  itemKey: string;
  action: TriageAction;
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
        [date, rawId, orgId]
      );
    }
    if (date && kind === 'decision') {
      await queryHelpers.queryRun(
        `UPDATE decisions SET deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
        [date, rawId, orgId]
      );
    }
  }

  if (action === 'delegate') {
    const delegateUserId = typeof params?.userId === 'string' ? params.userId : undefined;
    if (delegateUserId && kind === 'task') {
      await queryHelpers.queryRun(
        `UPDATE tasks SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
        [delegateUserId, rawId, orgId]
      );
      await NotificationService.send({
        userId: delegateUserId,
        organizationId: orgId,
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
        [delegateUserId, rawId, orgId]
      );
      await NotificationService.send({
        userId: delegateUserId,
        organizationId: orgId,
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
      // ignore read-state failures for notifications
    }
  }

  if (action === 'done' && kind === 'task') {
    await queryHelpers.queryRun(
      `UPDATE tasks SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [rawId, orgId]
    );
  }
}

const normalizeTaskStatus = (status?: string | null) => String(status || '').toLowerCase();
const isTaskDone = (status?: string | null) => {
  const s = normalizeTaskStatus(status);
  return s === 'done' || s === 'completed' || s === 'validated';
};

const parseTagsArray = (input: unknown): string[] => {
  if (Array.isArray(input)) return input.map((x) => String(x).trim()).filter(Boolean);
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // ignore
    }
    if (s.includes(','))
      return s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
  }
  return [];
};

const normalizeDecisionStatus = (status?: string | null) => String(status || '').toLowerCase();
const isDecisionPending = (status?: string | null) => {
  const s = normalizeDecisionStatus(status);
  return s === 'pending' || s === 'escalated';
};

const urgencyFromPriority = (priority?: string | null): InboxUrgency => {
  const p = String(priority || '').toLowerCase();
  if (p === 'urgent' || p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
};

const addDaysIso = (baseIso: string, days: number): string => {
  const ms = new Date(baseIso).getTime();
  return new Date(ms + days * 24 * 60 * 60 * 1000).toISOString();
};

const defaultSlaDaysBySection: Record<InboxSection, number | null> = {
  decisions_required: 5,
  approvals_gates: 3,
  blocked_escalations: 2,
  overdue_sla_breach: 0,
  assigned_tasks: 7,
  fyi_system: null,
  fyi_mentions: null,
  ai_insights: null,
  other: null,
};

const computeSla = (
  nowIso: string,
  receivedAtIso: string,
  section: InboxSection,
  dueAt?: string
): InboxItem['sla'] => {
  const effectiveDue =
    dueAt ||
    (defaultSlaDaysBySection[section] != null
      ? addDaysIso(receivedAtIso, defaultSlaDaysBySection[section] as number)
      : undefined);
  if (!effectiveDue) return undefined;

  const remainingMs = new Date(effectiveDue).getTime() - new Date(nowIso).getTime();
  const isBreached = remainingMs < 0;
  const absMs = Math.abs(remainingMs);

  let level: SlaLevel = 'none';
  if (!isBreached && remainingMs <= 24 * 60 * 60 * 1000) level = 'L1';
  if (isBreached && absMs <= 72 * 60 * 60 * 1000) level = 'L2';
  if (isBreached && absMs > 72 * 60 * 60 * 1000) level = 'L3';

  return { dueAt: effectiveDue, remainingMs, isBreached, level };
};

const mapNotificationToInboxType = (type?: string | null): InboxItemType => {
  const t = String(type || '').toUpperCase();
  if (t.includes('MENTION')) return 'mention';
  if (t.includes('ESCALATION')) return 'escalation';
  if (t.includes('REVIEW') || t.includes('APPROVAL')) return 'review_request';
  if (t.includes('DECISION')) return 'decision_request';
  if (
    t.includes('AI') ||
    t.includes('RECOMMENDATION') ||
    t.includes('INSIGHT') ||
    t.includes('RISK')
  )
    return 'ai_suggestion';
  if (
    t.includes('BILLING') ||
    t.includes('PAYMENT') ||
    t.includes('SUBSCRIPTION') ||
    t.includes('USAGE') ||
    t.includes('INVOICE') ||
    t.includes('LIMIT')
  )
    return 'billing_alert';
  if (t.includes('SYSTEM') || t.includes('SECURITY')) return 'system_alert';
  if (t.includes('PROJECT') || t.includes('INITIATIVE')) return 'project_update';
  return 'new_assignment';
};

/** V4-INBX-01: Map item to canonical type for routing/filtering */
const toCanonicalItemType = (key: InboxItemKey, inboxType: InboxItemType): CanonicalItemType => {
  if (key.startsWith('task:')) return 'task';
  if (key.startsWith('decision:')) return 'decision';
  if (key.startsWith('notification:')) {
    if (inboxType === 'review_request') return 'approval';
    return 'signal';
  }
  return 'signal';
};

// C1: Heuristic auto-triage suggestions (V4-INBX-03: includes confidence 0–1)
const suggestTriageAction = (
  item: InboxItem
): { action?: TriageAction; reason?: string; confidence?: number } => {
  // FYI notifications older than 3 days → suggest archive
  if (
    (item.section === 'fyi_system' || item.section === 'fyi_mentions') &&
    Date.now() - new Date(item.receivedAt).getTime() > 3 * 86400000
  ) {
    return { action: 'archive', reason: 'FYI notification older than 3 days', confidence: 0.92 };
  }

  // SLA-breached overdue items → suggest accept_today (urgent)
  if (item.sla?.isBreached && item.section === 'overdue_sla_breach') {
    return {
      action: 'accept_today',
      reason: 'SLA breached — needs immediate attention',
      confidence: 0.98,
    };
  }

  // Critical/high urgency decisions → suggest accept_today
  if (
    item.type === 'decision_request' &&
    (item.urgency === 'critical' || item.urgency === 'high')
  ) {
    return {
      action: 'accept_today',
      reason: 'High-priority decision awaiting you',
      confidence: 0.9,
    };
  }

  // Low urgency system notifications → suggest archive
  if (item.urgency === 'low' && item.type === 'new_assignment' && !item.dueDate) {
    return {
      action: 'schedule',
      reason: 'Low priority, no due date — consider scheduling',
      confidence: 0.75,
    };
  }

  return {};
};

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = (req as any).userId || req.user?.id;
  const orgId = req.user?.organizationId;
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { userId, orgId };
};

const resolveCanonicalPersonalTaskIdentity = async (
  req: AuthRequest,
  identity: { userId: string; orgId: string }
): Promise<{ userId: string; orgId: string }> => {
  const email = typeof req.user?.email === 'string' ? req.user.email.trim().toLowerCase() : '';
  if (!email) return identity;

  try {
    const { getDatabaseAsync } = await import('../database/Database.js');
    const db = await getDatabaseAsync();
    const result = await db.query<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM users WHERE lower(coalesce(email,'')) = $1 ORDER BY CASE WHEN organization_id = $2 THEN 0 ELSE 1 END, id ASC LIMIT 5`,
      [email, identity.orgId]
    );
    const matches: Array<{ id: string; organization_id: string }> = result?.rows || [];

    logger.info('[MyWork] resolveCanonical lookup', {
      email,
      sessionUserId: identity.userId,
      sessionOrgId: identity.orgId,
      matchCount: matches.length,
      matches: matches.map((m) => ({ id: m.id, org: m.organization_id })),
    });

    if (matches.length === 0) return identity;

    const exact = matches.find(
      (row) => row.id === identity.userId && row.organization_id === identity.orgId
    );
    if (exact) return identity;

    if (matches.length === 1) {
      return { userId: matches[0].id, orgId: matches[0].organization_id };
    }

    const sameOrg = matches.find((row) => row.organization_id === identity.orgId);
    if (sameOrg) {
      return { userId: sameOrg.id, orgId: sameOrg.organization_id };
    }

    return { userId: matches[0].id, orgId: matches[0].organization_id };
  } catch (err) {
    logger.error('[MyWork] resolveCanonical error', { error: String(err), email });
    return identity;
  }
};

const buildPersonalTaskOwnerScope = (
  req: AuthRequest,
  taskAlias = 't',
  overrides?: { userId?: string; email?: string }
) => {
  const allowLegacyEmailOwnerMatch =
    String(process.env.ENABLE_PERSONAL_TASK_EMAIL_MATCH || '').trim() === '1';
  const userId = overrides?.userId || (req as any).userId || req.user?.id;
  const email =
    overrides?.email ||
    (typeof req.user?.email === 'string' ? req.user.email.trim().toLowerCase() : '');
  const assigneeIdCol = taskAlias ? `${taskAlias}.assignee_id` : 'assignee_id';

  if (allowLegacyEmailOwnerMatch && email) {
    return {
      whereSql: `(${assigneeIdCol} = ? OR EXISTS (SELECT 1 FROM users pu WHERE pu.id = ${assigneeIdCol} AND lower(coalesce(pu.email,'')) = ?))`,
      params: [userId, email],
    };
  }

  return {
    whereSql: `${assigneeIdCol} = ?`,
    params: [userId],
  };
};

const radarProfilePatchSchema = z.object({
  trackedTopics: z.array(z.string()).optional(),
  trackedCompanies: z.array(z.string()).optional(),
  mutedTopics: z.array(z.string()).optional(),
  mutedSources: z.array(z.string()).optional(),
  preferredContentTypes: z.array(z.string()).optional(),
  strategicInterests: z.array(z.string()).optional(),
  personalizationWeights: z.record(z.string(), z.number()).optional(),
});

const radarActionSchema = z.object({
  signalId: z.string().optional(),
  actionType: z.enum([
    'view_briefing',
    'open_signal',
    'ask_ai',
    'save',
    'add_to_note',
    'create_task',
    'add_to_decision',
    'add_to_watchlist',
    'more_like_this',
    'less_like_this',
    'dismiss',
  ]),
  sourceContext: z.string().optional(),
  createdObjectType: z.string().optional(),
  createdObjectId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const requireTables = async (res: Response, tables: string[]): Promise<boolean> => {
  const isTestGateway =
    process.env.NODE_ENV === 'test' ||
    process.env.E2E_MODE === 'true' ||
    process.env.ENABLE_TEST_GATEWAY === 'true';
  const mockDbEnabled =
    process.env.MOCK_DB === 'true' ||
    (process.env.NODE_ENV === 'test' &&
      process.env.RUN_DB_TESTS !== '1' &&
      process.env.MOCK_DB !== 'false');

  // Mock/test gateways do not expose a real schema catalog, so table introspection
  // would otherwise block the whole My Work surface with false 503s.
  if (isTestGateway && mockDbEnabled) {
    return true;
  }

  for (const t of tables) {
    const cols = await getTableColumns(t);
    if (!cols || cols.size === 0) {
      res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
      return false;
    }
  }
  return true;
};

const createMyWorkToolSession = async (params: {
  userId: string;
  orgId: string;
  sourceType: 'idea' | 'notebook';
  sourceId: string;
  title: string;
  summary?: string;
}): Promise<string> => {
  const { userId, orgId, sourceType, sourceId, title, summary } = params;
  const cols = await getTableColumns('tool_sessions');
  if (!cols || cols.size === 0) {
    throw new Error(
      'Database table missing: tool_sessions. Run migrations (npm run db:migrate:*).'
    );
  }

  const toolSessionId = uuidv4();
  const now = new Date().toISOString();
  const insertCols: string[] = ['id'];
  const insertVals: string[] = ['?'];
  const insertParams: any[] = [toolSessionId];
  const add = (col: string, val: any) => {
    if (!cols.has(col)) return;
    insertCols.push(col);
    insertVals.push('?');
    insertParams.push(val);
  };

  const safeTitle = String(title || 'MyWork Session')
    .trim()
    .slice(0, 255);
  const normalizedSummary = String(summary || '')
    .trim()
    .slice(0, 4000);
  const myWorkPayload = {
    origin: 'MYWORK',
    source: { type: sourceType, id: sourceId },
    summary: normalizedSummary || null,
  };

  add('organization_id', orgId);
  add('project_id', null);
  add('tool_type', 'MYWORK');
  add('name', `MyWork ${sourceType}: ${safeTitle}`.slice(0, 255));
  add('status', 'APPROVED');
  add('completion_percent', 100);
  add('confidence_avg', 1);
  add('answers_json', JSON.stringify(myWorkPayload));
  add('context_snapshot', JSON.stringify({ myWork: true, ...myWorkPayload }));
  add('approved_at', now);
  add('created_by', userId);
  add('updated_by', userId);
  add('created_at', now);
  add('updated_at', now);

  await queryHelpers.queryRun(
    `INSERT INTO tool_sessions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
    insertParams
  );

  return toolSessionId;
};

type LinkGraphRelation = 'ref';

const linkGraphAddEdge = async (params: {
  orgId: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relation?: LinkGraphRelation;
  containerType?: string | null;
  containerId?: string | null;
  blockId?: string | null;
  /** V4-IDEA-05: Node-level backlink (idea map node id) */
  nodeId?: string | null;
}): Promise<{ id: string } | null> => {
  const cols = await getTableColumns('link_graph_edges');
  if (!cols || cols.size === 0) return null;

  const id = uuidv4();
  const now = new Date().toISOString();
  const relation = params.relation || 'ref';

  const insertCols: string[] = ['id'];
  const insertVals: string[] = ['?'];
  const insertParams: any[] = [id];

  const add = (col: string, val: any) => {
    if (!cols.has(col)) return;
    insertCols.push(col);
    insertVals.push('?');
    insertParams.push(val);
  };

  add('organization_id', params.orgId);
  add('created_by', params.userId);
  add('source_type', params.sourceType);
  add('source_id', params.sourceId);
  add('target_type', params.targetType);
  add('target_id', params.targetId);
  add('relation', relation);
  add('container_type', params.containerType ?? null);
  add('container_id', params.containerId ?? null);
  add('block_id', params.blockId ?? params.nodeId ?? null);
  add('created_at', now);

  try {
    await queryHelpers.queryRun(
      `INSERT INTO link_graph_edges (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );
    return { id };
  } catch (e: any) {
    // Best-effort idempotency: unique index may reject duplicates.
    const msg = String(e?.message || '');
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate'))
      return null;
    throw e;
  }
};

/**
 * Link Graph v3 — Backlinks (“Used in”)
 * SSOT: docs/product/LINK_GRAPH_V3.md
 */
router.get(
  '/link-graph/backlinks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    if (!(await requireTables(res, ['link_graph_edges']))) return;

    const type = String(req.query.type || '').trim();
    const id = String(req.query.id || '').trim();
    if (!type || !id) {
      res.status(400).json({ error: 'type and id are required' });
      return;
    }

    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          e.id,
          e.source_type as "sourceType",
          e.source_id as "sourceId",
          e.relation,
          e.container_type as "containerType",
          e.container_id as "containerId",
          e.block_id as "blockId",
          e.created_at as "createdAt"
        FROM link_graph_edges e
        WHERE e.organization_id = ?
          AND e.target_type = ?
          AND e.target_id = ?
        ORDER BY e.created_at DESC
        LIMIT ?
      `,
        [orgId, type, id, limit]
      )) || [];

    res.json(rows);
  })
);

router.post(
  '/link-graph/edges',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    if (!(await requireTables(res, ['link_graph_edges']))) return;

    const schema = z.object({
      source: z.object({ type: z.string().min(1), id: z.string().min(1) }),
      target: z.object({ type: z.string().min(1), id: z.string().min(1) }),
      relation: z.literal('ref').optional(),
      context: z
        .object({
          containerType: z.string().min(1).optional(),
          containerId: z.string().min(1).optional(),
          blockId: z.string().min(1).optional(),
        })
        .optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const created = await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: parsed.data.source.type,
      sourceId: parsed.data.source.id,
      targetType: parsed.data.target.type,
      targetId: parsed.data.target.id,
      relation: 'ref',
      containerType: parsed.data.context?.containerType ?? null,
      containerId: parsed.data.context?.containerId ?? null,
      blockId: parsed.data.context?.blockId ?? null,
    });

    await req.emitAuditEvent?.({
      action: 'LINK_GRAPH_EDGE_CREATE',
      resourceType: 'LINK_GRAPH_EDGE',
      resourceId: created?.id || 'unknown',
    });

    res.status(201).json({ ok: true, edgeId: created?.id || null });
  })
);

/**
 * GET /api/my-work/tasks
 * Lightweight list for Focus + My Work aggregations
 */
router.get(
  '/tasks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const limit = Number(req.query.limit) || 50;
    const onlyOpen = String(req.query.onlyOpen ?? 'true') !== 'false';
    const taskCols = await getTableColumns('tasks');
    const customFieldsSelect = taskCols.has('custom_fields_json')
      ? 't.custom_fields_json as customFields'
      : 'NULL as customFields';

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as dueDate,
          t.initiative_id as initiativeId,
          i.name as initiativeName,
          p.name as projectName,
          t.assignee_id as assigneeId,
          a.first_name as assigneeFirstName,
          a.last_name as assigneeLastName,
          a.avatar_url as assigneeAvatarUrl,
          t.estimated_hours as estimatedHours,
          t.checklist,
          ${customFieldsSelect}
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users a ON t.assignee_id = a.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          ${onlyOpen ? "AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')" : ''}
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.due_date, '9999-12-31') ASC,
          t.updated_at DESC
        LIMIT ?
      `,
        [orgId, userId, limit]
      )) || [];

    const parseCustomFields = (raw: string | null) => {
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    };
    res.json(
      rows.map((r: any) => ({
        ...r,
        customFields: parseCustomFields(r.customFields),
      }))
    );
  })
);

/**
 * T007 (V2) — Personal Tasks (private per-user)
 *
 * NOTE: stored in `tasks` with `task_type='personal'` and filtered by assignee + org.
 */
router.get(
  '/personal-tasks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const baseIdentity = requireUser(req, res);
    if (!baseIdentity) return;
    const identity = await resolveCanonicalPersonalTaskIdentity(req, baseIdentity);
    const { userId, orgId } = identity;
    const ownerScope = buildPersonalTaskOwnerScope(req, 't', {
      userId,
      email: req.user?.email?.trim().toLowerCase(),
    });

    const includeDone = String(req.query.includeDone || 'false') === 'true';
    const status = req.query.status ? String(req.query.status).trim().toLowerCase() : '';
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;

    const taskCols = await getTableColumns('tasks');
    const sourceTypeSelect = taskCols.has('source_type') ? 't.source_type' : 'NULL as source_type';
    const sourceIdSelect = taskCols.has('source_id') ? 't.source_id' : 'NULL as source_id';

    const params: any[] = [orgId, ...ownerScope.params];
    let whereExtra = '';

    if (!includeDone) {
      whereExtra += " AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')";
    }
    if (status) {
      whereExtra += " AND lower(coalesce(t.status,'')) = ?";
      params.push(status);
    }
    if (q) {
      whereExtra +=
        " AND (lower(coalesce(t.title,'')) LIKE ? OR lower(coalesce(t.description,'')) LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    params.push(limit);

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as "dueDate",
          t.tags,
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
          t.completed_at as "completedAt",
          t.assignee_id as "assigneeId",
          a.first_name as "assigneeFirstName",
          a.last_name as "assigneeLastName",
          a.avatar_url as "assigneeAvatarUrl",
          ${sourceTypeSelect} as "sourceType",
          ${sourceIdSelect} as "sourceId"
        FROM tasks t
        LEFT JOIN users a ON t.assignee_id = a.id
        WHERE t.organization_id = ?
          AND ${ownerScope.whereSql}
          AND lower(coalesce(t.task_type,'')) = 'personal'
          ${whereExtra}
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.due_date, '9999-12-31') ASC,
          t.updated_at DESC
        LIMIT ?
      `,
        params
      )) || [];

    logger.info('[MyWork] personal-tasks resolved identity', {
      sessionEmail: req.user?.email || null,
      sessionUserId: baseIdentity.userId,
      sessionOrgId: baseIdentity.orgId,
      resolvedUserId: userId,
      resolvedOrgId: orgId,
      count: rows.length,
    });

    res.json(
      rows.map((r: any) => {
        const base = { ...r, tags: parseTagsArray(r?.tags) };
        base.assignee =
          r.assigneeId && (r.assigneeFirstName || r.assigneeLastName)
            ? {
                id: r.assigneeId,
                firstName: r.assigneeFirstName || '',
                lastName: r.assigneeLastName || '',
                avatarUrl: r.assigneeAvatarUrl || null,
              }
            : undefined;
        delete base.assigneeFirstName;
        delete base.assigneeLastName;
        delete base.assigneeAvatarUrl;
        return base;
      })
    );
  })
);

router.post(
  '/personal-tasks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const baseIdentity = requireUser(req, res);
    if (!baseIdentity) return;
    const identity = await resolveCanonicalPersonalTaskIdentity(req, baseIdentity);
    const { userId, orgId } = identity;

    const title = String(req.body?.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const description =
      typeof req.body?.description === 'string' ? req.body.description : undefined;
    const status = String(req.body?.status || 'todo').trim() || 'todo';
    const priority = String(req.body?.priority || 'medium').trim() || 'medium';
    const dueDate = req.body?.dueDate ? String(req.body.dueDate).trim() : undefined;
    const tags = parseTagsArray(req.body?.tags);
    const sourceTypeRaw = req.body?.sourceType ?? req.body?.source_type;
    const sourceIdRaw = req.body?.sourceId ?? req.body?.source_id;
    const sourceType =
      typeof sourceTypeRaw === 'string' && sourceTypeRaw.trim() ? sourceTypeRaw.trim() : null;
    const sourceId =
      typeof sourceIdRaw === 'string' && sourceIdRaw.trim() ? sourceIdRaw.trim() : null;

    const id = uuidv4();
    const cols = await getTableColumns('tasks');

    const insertCols: string[] = ['id'];
    const insertVals: string[] = ['?'];
    const insertParams: any[] = [id];

    const add = (col: string, val: any) => {
      if (!cols.has(col)) return;
      insertCols.push(col);
      insertVals.push('?');
      insertParams.push(val);
    };

    add('organization_id', orgId);
    add('title', title);
    add('description', description ?? null);
    add('status', status);
    add('priority', priority);
    add('assignee_id', userId);
    add('reporter_id', userId);
    if (dueDate) add('due_date', dueDate);
    add('tags', JSON.stringify(tags));
    add('task_type', 'personal');
    if (sourceType && sourceId) {
      add('source_type', sourceType);
      add('source_id', sourceId);
    }

    await queryHelpers.queryRun(
      `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );

    // V4-NOTE-06: Audit when task created from AI-extracted actions (insert-as-blocks apply)
    const isFromAIApply = tags.some((t) => String(t).toLowerCase() === 'ai-extracted');
    if (isFromAIApply) {
      try {
        await auditEventsService.log({
          actorId: userId,
          actorType: 'USER',
          action: 'NOTE_AI_APPLY',
          resourceType: 'task',
          resourceId: id,
          organizationId: orgId,
          after: { title, sourceType, sourceId },
          metadata: { fromAI: true, source: 'extract-actions' },
        });
      } catch (_e) {
        /* audit best-effort */
      }
    }

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date as "dueDate",
        t.tags,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.completed_at as "completedAt",
        ${cols.has('source_type') ? 't.source_type' : 'NULL'} as "sourceType",
        ${cols.has('source_id') ? 't.source_id' : 'NULL'} as "sourceId"
      FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND t.assignee_id = ?
        AND lower(coalesce(t.task_type,'')) = 'personal'
      LIMIT 1
    `,
      [id, orgId, userId]
    );

    res.status(201).json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.get(
  '/personal-tasks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const baseIdentity = requireUser(req, res);
    if (!baseIdentity) return;
    const identity = await resolveCanonicalPersonalTaskIdentity(req, baseIdentity);
    const { userId, orgId } = identity;
    const ownerScope = buildPersonalTaskOwnerScope(req, 't', {
      userId,
      email: req.user?.email?.trim().toLowerCase(),
    });

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date as "dueDate",
        t.tags,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.completed_at as "completedAt"
      FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND ${ownerScope.whereSql}
        AND lower(coalesce(t.task_type,'')) = 'personal'
      LIMIT 1
    `,
      [id, orgId, ...ownerScope.params]
    );

    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.put(
  '/personal-tasks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const baseIdentity = requireUser(req, res);
    if (!baseIdentity) return;
    const identity = await resolveCanonicalPersonalTaskIdentity(req, baseIdentity);
    const { userId, orgId } = identity;
    const ownerScope = buildPersonalTaskOwnerScope(req, 't', {
      userId,
      email: req.user?.email?.trim().toLowerCase(),
    });
    const ownerScopeNoAlias = buildPersonalTaskOwnerScope(req, '', {
      userId,
      email: req.user?.email?.trim().toLowerCase(),
    });

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, status FROM tasks t WHERE id = ? AND organization_id = ? AND ${ownerScope.whereSql} AND lower(coalesce(task_type,''))='personal' LIMIT 1`,
      [id, orgId, ...ownerScope.params]
    );
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const cols = await getTableColumns('tasks');
    const setParts: string[] = [];
    const params: any[] = [];

    const setIf = (col: string, val: any) => {
      if (!cols.has(col)) return;
      setParts.push(`${col} = ?`);
      params.push(val);
    };

    if (typeof req.body?.title === 'string') setIf('title', String(req.body.title).trim());
    if (typeof req.body?.description === 'string') setIf('description', req.body.description);
    if (typeof req.body?.priority === 'string') setIf('priority', String(req.body.priority).trim());
    if (req.body?.dueDate !== undefined) {
      const d = req.body.dueDate ? String(req.body.dueDate).trim() : null;
      setIf('due_date', d);
    }
    if (req.body?.tags !== undefined) setIf('tags', JSON.stringify(parseTagsArray(req.body.tags)));

    let nextStatus: string | null = null;
    if (typeof req.body?.status === 'string') {
      nextStatus = String(req.body.status).trim();
      setIf('status', nextStatus);
    }

    // completed_at bookkeeping
    const wasDone = isTaskDone(existing?.status);
    const isDoneNow = nextStatus ? isTaskDone(nextStatus) : wasDone;
    if (nextStatus) {
      if (!wasDone && isDoneNow) {
        setIf('completed_at', new Date().toISOString());
      } else if (wasDone && !isDoneNow) {
        setIf('completed_at', null);
      }
    }

    if (cols.has('updated_at')) {
      setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    }

    if (setParts.length === 0) {
      const row = await queryHelpers.queryOne<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as "dueDate",
          t.tags,
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
          t.completed_at as "completedAt"
        FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND ${ownerScope.whereSql}
          AND lower(coalesce(t.task_type,'')) = 'personal'
        LIMIT 1
      `,
        [id, orgId, ...ownerScope.params]
      );
      res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
      return;
    }

    params.push(id, orgId, ...ownerScopeNoAlias.params);
    await queryHelpers.queryRun(
      `UPDATE tasks SET ${setParts.join(', ')} WHERE id = ? AND organization_id = ? AND ${ownerScopeNoAlias.whereSql} AND lower(coalesce(task_type,''))='personal'`,
      params
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date as "dueDate",
        t.tags,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.completed_at as "completedAt"
      FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND ${ownerScope.whereSql}
        AND lower(coalesce(t.task_type,'')) = 'personal'
      LIMIT 1
    `,
      [id, orgId, ...ownerScope.params]
    );

    res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.delete(
  '/personal-tasks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const baseIdentity = requireUser(req, res);
    if (!baseIdentity) return;
    const identity = await resolveCanonicalPersonalTaskIdentity(req, baseIdentity);
    const { userId, orgId } = identity;
    const ownerScope = buildPersonalTaskOwnerScope(req, '', {
      userId,
      email: req.user?.email?.trim().toLowerCase(),
    });

    const id = String(req.params.id || '').trim();
    await queryHelpers.queryRun(
      `DELETE FROM tasks WHERE id = ? AND organization_id = ? AND ${ownerScope.whereSql} AND lower(coalesce(task_type,''))='personal'`,
      [id, orgId, ...ownerScope.params]
    );
    res.status(204).send();
  })
);

/**
 * GET /api/my-work/calendar
 * Query:
 * - source=personal|project|all (default: all)
 * - projectId? (optional, for project filtering)
 * - includeDone=true|false (default: false)
 * - limit (default: 500)
 */
router.get(
  '/calendar',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const source = String(req.query.source || 'all').toLowerCase();
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const includeDone = String(req.query.includeDone || 'false') === 'true';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 2000) : 500;

    const where: string[] = ['t.organization_id = ?', 't.assignee_id = ?'];
    const params: any[] = [orgId, userId];

    if (!includeDone) {
      where.push("lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')");
    }

    if (source === 'personal') {
      where.push("lower(coalesce(t.task_type,'')) = 'personal'");
    } else if (source === 'project') {
      where.push('t.project_id IS NOT NULL');
      where.push("lower(coalesce(t.task_type,'')) != 'personal'");
    } else if (source !== 'all') {
      return res.status(400).json({ error: 'Invalid source (expected personal|project|all)' });
    }

    if (projectId) {
      where.push('t.project_id = ?');
      params.push(projectId);
    }

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as dueDate,
          t.task_type as taskType,
          t.project_id as projectId,
          p.name as projectName,
          t.initiative_id as initiativeId,
          i.name as initiativeName,
          t.created_at as createdAt,
          t.updated_at as updatedAt
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
          date(COALESCE(t.due_date, '9999-12-31')) ASC,
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          t.updated_at DESC
        LIMIT ?
      `,
        [...params, limit]
      )) || [];

    res.json({ tasks: rows });
  })
);

/**
 * GET /api/my-work/decisions
 * Lightweight list for Focus + Inbox
 */
router.get(
  '/decisions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const limit = Number(req.query.limit) || 50;
    const onlyPending = String(req.query.onlyPending ?? 'true') !== 'false';

    const decisionCols = await getTableColumns('decisions');
    const prioritySelect = decisionCols.has('priority') ? 'd.priority' : `'MEDIUM' as priority`;
    const impactSelect = decisionCols.has('impact') ? 'd.impact' : `'MEDIUM' as impact`;
    const dSourceTypeSelect = decisionCols.has('source_type')
      ? 'd.source_type'
      : 'NULL as source_type';
    const dSourceIdSelect = decisionCols.has('source_id') ? 'd.source_id' : 'NULL as source_id';
    const workflowStatusSelect = decisionCols.has('workflow_status')
      ? 'd.workflow_status'
      : `'proposed' as workflow_status`;

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          d.id,
          d.title,
          d.description,
          d.type as decisionType,
          d.status,
          ${workflowStatusSelect} as workflowStatus,
          ${prioritySelect},
          ${impactSelect},
          d.deadline as dueDate,
          d.created_at as createdAt,
          p.name as projectName,
          ${dSourceTypeSelect} as "sourceType",
          ${dSourceIdSelect} as "sourceId"
        FROM decisions d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.organization_id = ?
          AND d.decision_maker_id = ?
          ${onlyPending ? "AND lower(coalesce(d.status,'')) IN ('pending','escalated')" : ''}
        ORDER BY d.created_at DESC
        LIMIT ?
      `,
        [orgId, userId, limit]
      )) || [];

    const now = Date.now();
    const out = rows.map((d: any) => {
      const createdAt = d.createdAt ? new Date(d.createdAt).getTime() : now;
      const daysWaiting = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));
      const due = d.dueDate ? new Date(d.dueDate).getTime() : null;
      const isOverdue = typeof due === 'number' ? due < now : false;
      return { ...d, daysWaiting, isOverdue };
    });

    res.json(out);
  })
);

/**
 * GET /api/my-work/decisions/queue
 * Query:
 * - mode=my|requests_pending|all|snoozed (default: my)
 * - limit (default: 25, max: 200)
 * - cursor (optional; numeric offset for now)
 *
 * Notes:
 * - Excludes snoozed decisions for the caller in modes my/requests_pending/all.
 * - Mode=snoozed returns only snoozed decisions (snoozed_until > now).
 */
router.get(
  '/decisions/queue',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_snoozes', 'decisions']))) return;

    const modeRaw = String(req.query.mode || 'my')
      .trim()
      .toLowerCase();
    const mode =
      modeRaw === 'requests_pending' || modeRaw === 'requests' || modeRaw === 'pending_requests'
        ? 'requests_pending'
        : modeRaw === 'all'
          ? 'all'
          : modeRaw === 'snoozed'
            ? 'snoozed'
            : 'my';

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 25;

    const cursorRaw = req.query.cursor ? Number(req.query.cursor) : 0;
    const offset = Number.isFinite(cursorRaw) && cursorRaw >= 0 ? cursorRaw : 0;

    const nowIso = new Date().toISOString();

    const decisionCols = await getTableColumns('decisions');
    const hasPriority = decisionCols.has('priority');
    const hasImpact = decisionCols.has('impact');
    const hasEscalationLevelCol = decisionCols.has('escalation_level');
    const workflowStatusSelect = decisionCols.has('workflow_status')
      ? 'd.workflow_status'
      : `'proposed' as workflow_status`;

    // For "requests pending" we rely on decisions.created_by (canonical).
    if (!decisionCols.has('created_by')) {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }

    const prioritySelect = hasPriority ? 'd.priority' : `'MEDIUM' as priority`;
    const impactSelect = hasImpact ? 'd.impact' : `'MEDIUM' as impact`;
    const escalationSelect = hasEscalationLevelCol
      ? 'd.escalation_level'
      : `'none' as escalation_level`;

    const where: string[] = [
      `d.organization_id = ?`,
      `lower(coalesce(d.status,'')) IN ('pending','escalated')`,
    ];
    const params: any[] = [orgId];

    if (mode === 'my') {
      where.push(`d.decision_maker_id = ?`);
      params.push(userId);
    } else if (mode === 'requests_pending') {
      where.push(`d.created_by = ?`);
      params.push(userId);
      where.push(`d.decision_maker_id != ?`);
      params.push(userId);
    } else if (mode === 'all') {
      where.push(`(d.decision_maker_id = ? OR d.created_by = ?)`);
      params.push(userId, userId);
    } else if (mode === 'snoozed') {
      // handled below; keep base where for pending/escalated
      where.push(`(d.decision_maker_id = ? OR d.created_by = ?)`);
      params.push(userId, userId);
    }

    // Snooze join (per-user)
    const snoozeJoin = `
      LEFT JOIN my_work_decision_snoozes s
        ON s.decision_id = d.id
       AND s.user_id = ?
       AND s.organization_id = ?
    `;
    const snoozeParams = [userId, orgId];

    // Exclude snoozed unless mode=snoozed
    if (mode !== 'snoozed') {
      where.push(`(s.snoozed_until IS NULL OR s.snoozed_until <= ?)`);
      params.push(nowIso);
    } else {
      where.push(`(s.snoozed_until IS NOT NULL AND s.snoozed_until > ?)`);
      params.push(nowIso);
    }

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          d.id,
          d.title,
          d.description,
          d.type as decisionType,
          d.status,
          ${workflowStatusSelect} as workflowStatus,
          ${prioritySelect},
          ${impactSelect},
          ${escalationSelect},
          d.deadline as dueDate,
          d.created_at as createdAt,
          d.updated_at as updatedAt,
          d.project_id as projectId,
          d.initiative_id as initiativeId,
          d.task_id as taskId,
          d.decision_maker_id as decisionOwnerId,
          d.created_by as requestedById,
          owner.first_name || ' ' || owner.last_name as ownerName,
          requester.first_name || ' ' || requester.last_name as requestedByName,
          p.name as projectName,
          (SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = TRUE) as blockedItemsCount,
          s.snoozed_until as snoozedUntil
        FROM decisions d
        ${snoozeJoin}
        LEFT JOIN users owner ON d.decision_maker_id = owner.id
        LEFT JOIN users requester ON d.created_by = requester.id
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE lower(coalesce(d.status,'')) WHEN 'pending' THEN 0 WHEN 'escalated' THEN 1 ELSE 2 END,
          CASE lower(coalesce(${hasPriority ? 'd.priority' : `'MEDIUM'`},'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          CASE WHEN d.deadline IS NULL THEN 1 ELSE 0 END,
          COALESCE(d.deadline, '9999-12-31') ASC,
          d.created_at ASC,
          d.id ASC
        LIMIT ?
        OFFSET ?
      `,
        [...snoozeParams, ...params, limit, offset]
      )) || [];

    const out = rows.map((r: any) => ({ ...r, canRemind: true, lastRemindedAt: null }));

    const nextCursor = out.length === limit ? offset + limit : null;
    res.json({ items: out, nextCursor, mode });
  })
);

/**
 * POST /api/my-work/decisions/:id/snooze
 * Body: { until?: string, preset?: string }
 */
router.post(
  '/decisions/:id/snooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_snoozes', 'decisions']))) return;

    const decisionId = String(req.params.id || '').trim();
    if (!decisionId) return res.status(400).json({ error: 'id is required' });

    const until =
      typeof req.body?.until === 'string' && req.body.until.trim()
        ? String(req.body.until).trim()
        : snoozePresetToUntil(String(req.body?.preset || 'tomorrow'));

    const untilDate = new Date(until);
    if (Number.isNaN(untilDate.getTime())) {
      return res.status(400).json({ error: 'Invalid until (expected ISO date string)' });
    }

    // Access control: allow snooze only if the decision is relevant to this user.
    const access = await queryHelpers.queryOne<{ ok: number }>(
      `
      SELECT 1 as ok
      FROM decisions d
      WHERE d.id = ?
        AND d.organization_id = ?
        AND (d.decision_maker_id = ? OR d.created_by = ?)
      LIMIT 1
    `,
      [decisionId, orgId, userId, userId]
    );
    if (!access) return res.status(404).json({ error: 'Not found' });

    await queryHelpers.queryRun(
      `
      INSERT INTO my_work_decision_snoozes
        (user_id, organization_id, decision_id, snoozed_until, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, organization_id, decision_id) DO UPDATE SET
        snoozed_until = excluded.snoozed_until,
        updated_at = CURRENT_TIMESTAMP
    `,
      [userId, orgId, decisionId, untilDate.toISOString()]
    );

    res.json({ success: true, decisionId, snoozedUntil: untilDate.toISOString() });
  })
);

/**
 * POST /api/my-work/decisions/:id/unsnooze
 */
router.post(
  '/decisions/:id/unsnooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_snoozes']))) return;

    const decisionId = String(req.params.id || '').trim();
    if (!decisionId) return res.status(400).json({ error: 'id is required' });

    await queryHelpers.queryRun(
      `DELETE FROM my_work_decision_snoozes WHERE user_id = ? AND organization_id = ? AND decision_id = ?`,
      [userId, orgId, decisionId]
    );
    res.json({ success: true, decisionId });
  })
);

/**
 * GET /api/my-work/decisions/preferences
 * Returns user preferences JSON (and defaults when missing).
 */
router.get(
  '/decisions/preferences',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_prefs']))) return;

    const row = await queryHelpers.queryOne<{ prefs_json: string; updated_at: string }>(
      `SELECT prefs_json, updated_at FROM my_work_decision_prefs WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId]
    );

    const defaults = {
      defaultViewMode: 'split',
      defaultFilterMode: 'my',
      savedViews: [],
    };

    if (!row?.prefs_json) {
      return res.json({ prefs: defaults, updatedAt: null });
    }

    try {
      const parsed = JSON.parse(row.prefs_json);
      res.json({ prefs: { ...defaults, ...(parsed || {}) }, updatedAt: row.updated_at || null });
    } catch {
      res.json({ prefs: defaults, updatedAt: row.updated_at || null });
    }
  })
);

/**
 * PUT /api/my-work/decisions/preferences
 * Body: { prefs: object } or raw object
 */
router.put(
  '/decisions/preferences',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_prefs']))) return;

    const prefsObj =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body.prefs && typeof req.body.prefs === 'object'
          ? req.body.prefs
          : req.body
        : null;
    if (!prefsObj) return res.status(400).json({ error: 'prefs object is required' });

    // Safety: cap size to avoid abusing TEXT column and logs.
    const prefsJson = JSON.stringify(prefsObj);
    if (prefsJson.length > 50_000) {
      return res.status(413).json({ error: 'prefs payload too large' });
    }

    const nowIso = new Date().toISOString();
    await queryHelpers.queryRun(
      `
      INSERT INTO my_work_decision_prefs (user_id, organization_id, prefs_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, organization_id) DO UPDATE SET
        prefs_json = excluded.prefs_json,
        updated_at = excluded.updated_at
    `,
      [userId, orgId, prefsJson, nowIso]
    );

    res.json({ success: true, prefs: prefsObj, updatedAt: nowIso });
  })
);

/**
 * GET /api/my-work/inbox
 * Derived inbox items + triage state
 */
router.get(
  '/inbox',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_inbox_triage']))) return;

    const limit = Number(req.query.limit) || 50;
    const nowIso = new Date().toISOString();
    const today = todayIsoDate();

    const triagedRows =
      (await queryHelpers.queryAll<{
        item_key: string;
        action: string;
        params_json?: string;
        triaged_at: string;
      }>(
        `SELECT item_key, action, params_json, triaged_at FROM my_work_inbox_triage WHERE user_id = ?`,
        [userId]
      )) || [];
    const triagedMap = new Map<
      string,
      { action: TriageAction; params?: Record<string, unknown>; triagedAt: string }
    >();
    for (const r of triagedRows) {
      let params: Record<string, unknown> | undefined;
      if (r.params_json) {
        try {
          params = JSON.parse(r.params_json);
        } catch {
          params = undefined;
        }
      }
      triagedMap.set(r.item_key, {
        action: r.action as TriageAction,
        params,
        triagedAt: r.triaged_at,
      });
    }

    // 1) Overdue tasks (assigned)
    const overdueTasks =
      (await queryHelpers.queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as dueDate,
               t.initiative_id as initiativeId, i.name as initiativeName,
               t.blocked_reason as blockedReason,
               t.blocked_by_decision_id as blockedByDecisionId,
               t.blocked_at as blockedAt,
               t.created_at as createdAt
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          AND t.due_date IS NOT NULL
          AND date(t.due_date) < date(?)
          AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')
        ORDER BY date(t.due_date) ASC
        LIMIT ?
      `,
        [orgId, userId, today, Math.min(25, limit)]
      )) || [];

    // 1b) Blocked tasks (assigned)
    const blockedTasks =
      (await queryHelpers.queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as dueDate,
               t.initiative_id as initiativeId, i.name as initiativeName,
               t.blocked_reason as blockedReason,
               t.blocked_by_decision_id as blockedByDecisionId,
               t.blocked_at as blockedAt,
               t.updated_at as updatedAt,
               t.created_at as createdAt
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')
          AND (
            lower(coalesce(t.status,'')) = 'blocked'
            OR t.blocked_by_decision_id IS NOT NULL
            OR t.blocked_reason IS NOT NULL
          )
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.updated_at, t.created_at) DESC
        LIMIT ?
      `,
        [orgId, userId, Math.min(25, limit)]
      )) || [];

    // 1c) Assigned open tasks (non-overdue, non-blocked)
    const assignedOpenTasks =
      (await queryHelpers.queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as dueDate,
               t.initiative_id as initiativeId, i.name as initiativeName,
               t.updated_at as updatedAt,
               t.created_at as createdAt
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')
          AND lower(coalesce(t.status,'')) != 'blocked'
          AND (t.blocked_by_decision_id IS NULL AND t.blocked_reason IS NULL)
          AND (
            t.due_date IS NULL
            OR date(t.due_date) >= date(?)
          )
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.due_date, '9999-12-31') ASC,
          COALESCE(t.updated_at, t.created_at) DESC
        LIMIT ?
      `,
        [orgId, userId, today, Math.min(25, limit)]
      )) || [];

    // 2) Pending decisions (owned)
    const decisionCols = await getTableColumns('decisions');
    const decisionPrioritySelect = decisionCols.has('priority')
      ? 'd.priority'
      : `'MEDIUM' as priority`;
    const pendingDecisions =
      (await queryHelpers.queryAll<any>(
        `
        SELECT d.id, d.title, d.description, d.type as decisionType, d.status, ${decisionPrioritySelect}, d.deadline as dueDate, d.created_at as createdAt,
               p.name as projectName
        FROM decisions d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.organization_id = ?
          AND d.decision_maker_id = ?
          AND lower(coalesce(d.status,'')) IN ('pending','escalated')
        ORDER BY d.created_at DESC
        LIMIT ?
      `,
        [orgId, userId, Math.min(25, limit)]
      )) || [];

    // 3) Unread notifications (owned)
    const notifCols = await getTableColumns('notifications');
    const notifHasRead = notifCols.has('read');
    const notifReadExpr = notifHasRead ? 'COALESCE(read, 0)' : '0';
    const notifPrioritySelect = notifCols.has('priority') ? 'priority' : `'normal' as priority`;
    const notifMessageSelect = notifCols.has('message')
      ? 'message as body'
      : notifCols.has('body')
        ? 'body as body'
        : `'' as body`;
    const notifEntityTypeSelect = notifCols.has('entity_type')
      ? 'entity_type as entityType'
      : notifCols.has('entityType')
        ? 'entityType as entityType'
        : 'NULL as entityType';
    const notifEntityIdSelect = notifCols.has('entity_id')
      ? 'entity_id as entityId'
      : notifCols.has('entityId')
        ? 'entityId as entityId'
        : 'NULL as entityId';

    const unreadNotifications =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          type,
          title,
          ${notifMessageSelect},
          ${notifPrioritySelect},
          ${notifEntityTypeSelect},
          ${notifEntityIdSelect},
          created_at as createdAt
        FROM notifications
        WHERE user_id = ?
          AND ${notifReadExpr} = 0
        ORDER BY created_at DESC
        LIMIT ?
      `,
        [userId, Math.min(25, limit)]
      )) || [];

    // Anti-spam aggregation (best-effort): group notifications by (type, entityType, entityId) when possible
    const aggregatedNotifications: any[] = [];
    {
      const byKey = new Map<string, any>();
      for (const n of unreadNotifications) {
        const type = String(n.type || '');
        const entityType = n.entityType ? String(n.entityType) : '';
        const entityId = n.entityId ? String(n.entityId) : '';
        const key =
          entityType && entityId ? `${type}:${entityType}:${entityId}` : `id:${String(n.id)}`;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, n);
          continue;
        }
        const exTs = new Date(existing.createdAt || 0).getTime();
        const nTs = new Date(n.createdAt || 0).getTime();
        if (nTs > exTs) byKey.set(key, n);
      }
      aggregatedNotifications.push(...Array.from(byKey.values()));
    }

    const items: InboxItem[] = [];

    for (const t of overdueTasks) {
      const key: InboxItemKey = `task:${t.id}`;
      const triaged = triagedMap.get(key);
      const urgency: InboxUrgency = urgencyFromPriority(t.priority);
      const section: InboxSection = 'overdue_sla_breach';
      const receivedAt = t.dueDate ? new Date(t.dueDate).toISOString() : nowIso;
      const dueDate = t.dueDate ? new Date(t.dueDate).toISOString() : undefined;
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: 'escalation',
        title: t.title,
        description: t.description || undefined,
        source: { type: 'system' },
        receivedAt,
        urgency: urgency === 'low' ? 'normal' : urgency, // overdue can't be "low" priority in UI
        dueDate,
        sla: computeSla(nowIso, receivedAt, section, dueDate),
        linkedTaskId: t.id,
        linkedInitiativeId: t.initiativeId || undefined,
        linkedTask: {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate || undefined,
        },
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        itemStatus: 'open',
        reason: '',
        isActionable: false,
        itemType: 'task',
        _key: key,
      });
    }

    for (const t of blockedTasks) {
      const key: InboxItemKey = `task:${t.id}`;
      const triaged = triagedMap.get(key);
      const section: InboxSection = 'blocked_escalations';
      const urgency: InboxUrgency = urgencyFromPriority(t.priority);
      const receivedAt = t.blockedAt || t.updatedAt || t.createdAt || nowIso;
      const dueDate = t.dueDate ? new Date(t.dueDate).toISOString() : undefined;
      const descParts = [
        t.blockedReason ? `Blocked: ${String(t.blockedReason)}` : null,
        t.description ? String(t.description) : null,
      ].filter(Boolean);
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: 'escalation',
        title: t.title,
        description: descParts.length ? descParts.join('\n') : undefined,
        source: { type: 'system' },
        receivedAt,
        urgency: urgency === 'low' ? 'normal' : urgency,
        dueDate,
        sla: computeSla(nowIso, receivedAt, section, dueDate),
        linkedTaskId: t.id,
        linkedDecisionId: t.blockedByDecisionId || undefined,
        linkedInitiativeId: t.initiativeId || undefined,
        linkedTask: {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate || undefined,
        },
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        itemStatus: 'open',
        reason: '',
        isActionable: false,
        itemType: 'task',
        _key: key,
      });
    }

    for (const t of assignedOpenTasks) {
      const key: InboxItemKey = `task:${t.id}`;
      const triaged = triagedMap.get(key);
      const section: InboxSection = 'assigned_tasks';
      const urgency: InboxUrgency = urgencyFromPriority(t.priority);
      const receivedAt = t.updatedAt || t.createdAt || nowIso;
      const dueDate = t.dueDate ? new Date(t.dueDate).toISOString() : undefined;
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: 'new_assignment',
        title: t.title,
        description: t.description || undefined,
        source: { type: 'system' },
        receivedAt,
        urgency,
        dueDate,
        sla: computeSla(nowIso, receivedAt, section, dueDate),
        linkedTaskId: t.id,
        linkedInitiativeId: t.initiativeId || undefined,
        linkedTask: {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate || undefined,
        },
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        itemStatus: 'open',
        reason: '',
        isActionable: false,
        itemType: 'task',
        _key: key,
      });
    }

    for (const d of pendingDecisions) {
      const key: InboxItemKey = `decision:${d.id}`;
      const triaged = triagedMap.get(key);
      const urgency = urgencyFromPriority(d.priority);
      const section: InboxSection = 'decisions_required';
      const receivedAt = d.createdAt || nowIso;
      const dueDate = d.dueDate ? new Date(d.dueDate).toISOString() : undefined;
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: 'decision_request',
        title: d.title,
        description: d.description || undefined,
        source: { type: 'system' },
        receivedAt,
        urgency,
        dueDate,
        sla: computeSla(nowIso, receivedAt, section, dueDate),
        linkedDecisionId: d.id,
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        itemStatus: 'open',
        reason: '',
        isActionable: false,
        itemType: 'decision',
        _key: key,
      });
    }

    for (const n of aggregatedNotifications) {
      const key: InboxItemKey = `notification:${n.id}`;
      const triaged = triagedMap.get(key);
      const inboxType = mapNotificationToInboxType(n.type);
      const section: InboxSection =
        inboxType === 'review_request'
          ? 'approvals_gates'
          : inboxType === 'decision_request'
            ? 'decisions_required'
            : inboxType === 'escalation'
              ? 'blocked_escalations'
              : inboxType === 'ai_suggestion'
                ? 'ai_insights'
                : inboxType === 'mention'
                  ? 'fyi_mentions'
                  : 'fyi_system';
      const receivedAt = n.createdAt || nowIso;
      const sourceType: 'user' | 'system' | 'ai' =
        inboxType === 'ai_suggestion'
          ? 'ai'
          : inboxType === 'mention' || inboxType === 'review_request'
            ? 'user'
            : 'system';
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: inboxType,
        title: n.title || 'Notification',
        description: n.body || undefined,
        source: { type: sourceType },
        receivedAt,
        urgency: urgencyFromPriority(n.priority),
        sla: computeSla(nowIso, receivedAt, section, undefined),
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        itemStatus: 'open',
        reason: '',
        isActionable: false,
        itemType: toCanonicalItemType(key, inboxType),
        _key: key,
      });
    }

    // ── Enrich items with status, reason, isActionable (N1, N2, N7) ──
    const ACTIONABLE_SECTIONS = new Set<InboxSection>([
      'decisions_required',
      'approvals_gates',
      'blocked_escalations',
      'overdue_sla_breach',
      'assigned_tasks',
    ]);
    const ACTIONABLE_TYPES = new Set<InboxItemType>([
      'decision_request',
      'review_request',
      'escalation',
      'new_assignment',
    ]);

    const reasonForSection = (section: InboxSection, type: InboxItemType): string => {
      if (section === 'overdue_sla_breach') return 'Task is overdue (assigned to you)';
      if (section === 'blocked_escalations') return 'Task is blocked (assigned to you)';
      if (section === 'decisions_required') return 'Decision pending (you are decision maker)';
      if (section === 'approvals_gates') return 'Approval/review requested for you';
      if (section === 'assigned_tasks') return 'Task assigned to you';
      if (type === 'mention') return 'You were mentioned';
      if (type === 'ai_suggestion') return 'AI insight relevant to your work';
      if (section === 'fyi_system') return 'System notification';
      if (section === 'fyi_mentions') return 'You were mentioned or tagged';
      if (section === 'ai_insights') return 'AI signal for your review';
      return 'Notification for your awareness';
    };

    for (const item of items) {
      // N1: Item status (open by default; triaged items get their action as status)
      if (item.triaged) {
        const act = item.triageAction;
        if (act === 'done') item.itemStatus = 'done';
        else if (act === 'save') item.itemStatus = 'saved';
        else if (act === 'dismiss' || act === 'archive' || act === 'reject')
          item.itemStatus = 'dismissed';
        else item.itemStatus = 'open';
      } else {
        item.itemStatus = 'open';
      }

      // N7: Reason
      item.reason = reasonForSection(item.section, item.type);

      // N2: Is actionable?
      item.isActionable = ACTIONABLE_SECTIONS.has(item.section) || ACTIONABLE_TYPES.has(item.type);

      // C1: Apply heuristic auto-triage suggestions (V4-INBX-03: confidence)
      if (!item.triaged) {
        const suggestion = suggestTriageAction(item);
        if (suggestion.action) {
          item.suggestedAction = suggestion.action;
          item.suggestedReason = suggestion.reason;
          item.suggestedConfidence = suggestion.confidence;
        }
      }
    }

    // Return all items (not just non-triaged) so frontend can show Done/Saved/Snoozed views
    const openItems = items.filter((i) => i.itemStatus === 'open');
    const doneItems = items.filter((i) => i.itemStatus === 'done');
    const savedItems = items.filter((i) => i.itemStatus === 'saved');
    const dismissedItems = items.filter((i) => i.itemStatus === 'dismissed');

    // Summary
    const summary = {
      total: openItems.length,
      critical: openItems.filter((i) => i.urgency === 'critical').length,
      newToday: openItems.filter((i) => i.receivedAt.slice(0, 10) === today).length,
      actionRequired: openItems.filter((i) => i.isActionable).length,
      counts: {
        open: openItems.length,
        done: doneItems.length,
        saved: savedItems.length,
        dismissed: dismissedItems.length,
      },
    };

    // F3: Smart composite sorting — urgency × SLA breach × section priority × recency
    const urgencyRank: Record<InboxUrgency, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    const sectionRank: Record<InboxSection, number> = {
      overdue_sla_breach: 0,
      blocked_escalations: 1,
      decisions_required: 2,
      approvals_gates: 3,
      assigned_tasks: 4,
      ai_insights: 5,
      fyi_mentions: 6,
      fyi_system: 7,
      other: 8,
    };
    const smartSort = (arr: InboxItem[]) => {
      arr.sort((a, b) => {
        const aBreach = a.sla?.isBreached ? 0 : 1;
        const bBreach = b.sla?.isBreached ? 0 : 1;
        if (aBreach !== bBreach) return aBreach - bBreach;
        const ra = urgencyRank[a.urgency];
        const rb = urgencyRank[b.urgency];
        if (ra !== rb) return ra - rb;
        const sa = sectionRank[a.section] ?? 8;
        const sb = sectionRank[b.section] ?? 8;
        if (sa !== sb) return sa - sb;
        return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
      });
      return arr;
    };

    smartSort(openItems);
    doneItems.sort(
      (a, b) =>
        new Date(b.triagedAt || b.receivedAt).getTime() -
        new Date(a.triagedAt || a.receivedAt).getTime()
    );
    savedItems.sort(
      (a, b) =>
        new Date(b.triagedAt || b.receivedAt).getTime() -
        new Date(a.triagedAt || a.receivedAt).getTime()
    );

    // Query filter: ?status=open|done|saved|dismissed|all (default: open)
    const statusFilter = (req.query.status as string) || 'open';
    let resultItems: InboxItem[];
    if (statusFilter === 'all') resultItems = items;
    else if (statusFilter === 'done') resultItems = doneItems;
    else if (statusFilter === 'saved') resultItems = savedItems;
    else if (statusFilter === 'dismissed') resultItems = dismissedItems;
    else resultItems = openItems;

    res.json({ summary, items: resultItems.slice(0, limit) });
  })
);

/**
 * POST /api/my-work/inbox/:id/triage
 * Body: { action, params }
 */
router.post(
  '/inbox/:id/triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_inbox_triage', 'my_work_focus_state']))) return;

    const action = String(req.body?.action || '') as TriageAction;
    const params = (req.body?.params || undefined) as Record<string, unknown> | undefined;
    const fromAISuggestion = Boolean(req.body?.fromAISuggestion);
    const confidence = typeof req.body?.confidence === 'number' ? req.body.confidence : undefined;
    const itemKey = String(
      req.body?.itemKey || req.body?._key || req.query.itemKey || ''
    ) as InboxItemKey;

    const VALID_TRIAGE_ACTIONS: TriageAction[] = [
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
    if (!action || !VALID_TRIAGE_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!itemKey || !itemKey.includes(':')) {
      return res.status(400).json({
        error: 'Missing itemKey (expected task:<id> | decision:<id> | notification:<id>)',
      });
    }

    const triagedAt = new Date().toISOString();
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
    } else {
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

    await applyInboxTriageSideEffects({ userId, orgId, itemKey, action, params, triagedAt });

    res.json({ success: true, triagedAt });
  })
);

/**
 * POST /api/my-work/inbox/undo-last-ai-triage (V4-INBX-03)
 * Removes the most recent AI-applied triage so the item returns to inbox.
 */
router.post(
  '/inbox/undo-last-ai-triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_inbox_triage']))) return;

    const triageCols = await getTableColumns('my_work_inbox_triage');
    if (!triageCols.has('from_ai')) {
      return res.json({ success: false, message: 'Undo not available (schema not migrated)' });
    }

    const last = await queryHelpers.queryOne<{ item_key: string; triaged_at: string }>(
      `SELECT item_key, triaged_at FROM my_work_inbox_triage
         WHERE user_id = ? AND from_ai = 1
         ORDER BY triaged_at DESC LIMIT 1`,
      [userId]
    );

    if (!last) {
      return res.json({ success: false, message: 'No AI triage to undo' });
    }

    await queryHelpers.queryRun(
      `DELETE FROM my_work_inbox_triage WHERE user_id = ? AND item_key = ?`,
      [userId, last.item_key]
    );

    res.json({ success: true, undoneItemKey: last.item_key });
  })
);

/**
 * POST /api/my-work/inbox/bulk-triage
 * Body: { itemIds: string[], action, params?, itemKeys?: string[] }
 */
router.post(
  '/inbox/bulk-triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_inbox_triage', 'my_work_focus_state']))) return;

    const action = String(req.body?.action || '') as TriageAction;
    const params = (req.body?.params || undefined) as Record<string, unknown> | undefined;
    const itemKeys = (req.body?.itemKeys || req.body?.item_keys || []) as string[];
    const aiItemsRaw = Array.isArray(req.body?.aiItems) ? req.body.aiItems : [];
    const aiItems = new Map<string, number | null>();
    for (const row of aiItemsRaw) {
      const key = typeof row?.itemKey === 'string' ? row.itemKey : '';
      if (!key) continue;
      aiItems.set(
        key,
        typeof row?.confidence === 'number' && Number.isFinite(row.confidence)
          ? row.confidence
          : null
      );
    }

    const VALID_BULK: TriageAction[] = [
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
    if (!action || !VALID_BULK.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!Array.isArray(itemKeys) || itemKeys.length === 0) {
      return res.status(400).json({ error: 'Missing itemKeys[]' });
    }

    const triagedAt = new Date().toISOString();
    const triageCols = await getTableColumns('my_work_inbox_triage');
    const hasAiCols = triageCols.has('from_ai') && triageCols.has('ai_confidence');
    for (const key of itemKeys) {
      const itemKey = String(key);
      if (hasAiCols && aiItems.has(itemKey)) {
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
            aiItems.get(itemKey),
          ]
        );
      } else {
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
      await applyInboxTriageSideEffects({ userId, orgId, itemKey, action, params, triagedAt });
    }

    res.json({ success: true, count: itemKeys.length, triagedAt });
  })
);

// ==========================================
// V4-INBX-01: CANONICAL INBOX ENDPOINTS
// ==========================================

/**
 * POST /api/my-work/inbox/materialize
 * Trigger materialization of inbox items from tasks/decisions/notifications
 */
router.post(
  '/inbox/materialize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const result = await inboxService.materializeInboxItems(userId, orgId);
    res.json({ success: true, ...result });
  })
);

/**
 * GET /api/my-work/inbox/canonical
 * Get canonical inbox items with filtering
 */
router.get(
  '/inbox/canonical',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const filters = {
      section: req.query.section ? String(req.query.section) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      priority: req.query.priority ? String(req.query.priority) : undefined,
      slaStatus: req.query.slaStatus ? String(req.query.slaStatus) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };

    const items = await inboxService.getInboxItems(userId, orgId, filters);
    res.json({ items });
  })
);

/**
 * GET /api/my-work/inbox/canonical/stats
 * Inbox statistics by section, SLA status, priority
 */
router.get(
  '/inbox/canonical/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const stats = await inboxService.getInboxStats(userId, orgId);
    res.json(stats);
  })
);

/**
 * POST /api/my-work/inbox/canonical/:id/delegate
 * Delegate an inbox item to another user
 */
router.post(
  '/inbox/canonical/:id/delegate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const { id } = req.params;
    const { toUserId, notes } = req.body || {};
    if (!toUserId || typeof toUserId !== 'string') {
      return res.status(400).json({ error: 'toUserId is required' });
    }

    const item = await inboxService.delegateItem(id, toUserId, notes, userId);
    if (!item) return res.status(404).json({ error: 'Inbox item not found' });
    res.json({ success: true, item });
  })
);

/**
 * POST /api/my-work/inbox/canonical/:id/snooze
 * Snooze an inbox item until a given date
 */
router.post(
  '/inbox/canonical/:id/snooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const { id } = req.params;
    const { until } = req.body || {};
    if (!until || typeof until !== 'string') {
      return res.status(400).json({ error: 'until (ISO date) is required' });
    }

    const item = await inboxService.triageItem(id, 'snooze', { snoozedUntil: until });
    if (!item) return res.status(404).json({ error: 'Inbox item not found' });
    res.json({ success: true, item });
  })
);

/**
 * PATCH /api/my-work/inbox/canonical/:id/sla
 * Update SLA deadline for an inbox item
 */
router.patch(
  '/inbox/canonical/:id/sla',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const { id } = req.params;
    const { slaDeadline } = req.body || {};
    if (!slaDeadline || typeof slaDeadline !== 'string') {
      return res.status(400).json({ error: 'slaDeadline (ISO datetime) is required' });
    }

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE canonical_inbox_items SET sla_deadline = ?, updated_at = ? WHERE id = ?`,
      [slaDeadline, now, id]
    );

    const row = await queryHelpers.queryOne<any>(
      `SELECT * FROM canonical_inbox_items WHERE id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Inbox item not found' });
    res.json({ success: true, slaDeadline });
  })
);

/**
 * POST /api/my-work/inbox/sla/refresh
 * Recalculate SLA statuses for the organization
 */
router.post(
  '/inbox/sla/refresh',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const result = await inboxService.updateSlaStatus(orgId);
    res.json({ success: true, ...result });
  })
);

/**
 * PUT /api/my-work/focus/move
 * Body: { itemId: string, column: 'today'|'thisWeek'|'later' }
 */
router.put(
  '/focus/move',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_focus_state']))) return;

    const itemId = String(req.body?.itemId || '');
    const column = String(req.body?.column || '') as FocusColumn;
    if (!itemId || !['today', 'thisWeek', 'later'].includes(column)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await queryHelpers.queryRun(
      `INSERT INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
         column_name = excluded.column_name,
         position = excluded.position,
         updated_at = excluded.updated_at`,
      [userId, todayIsoDate(), itemId, column, 0, new Date().toISOString()]
    );

    res.json({ success: true });
  })
);

/**
 * PUT /api/my-work/focus/reorder
 * Body: { itemId: string, column: 'today'|'thisWeek'|'later', position: number }
 */
router.put(
  '/focus/reorder',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_focus_state']))) return;

    const itemId = String(req.body?.itemId || '');
    const column = String(req.body?.column || '') as FocusColumn;
    const position = Number(req.body?.position || 0);
    if (!itemId || !['today', 'thisWeek', 'later'].includes(column) || !Number.isFinite(position)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await queryHelpers.queryRun(
      `INSERT INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
         column_name = excluded.column_name,
         position = excluded.position,
         updated_at = excluded.updated_at`,
      [userId, todayIsoDate(), itemId, column, position, new Date().toISOString()]
    );

    res.json({ success: true });
  })
);

/**
 * GET /api/my-work/focus/rules (V4-INBX-02)
 * Returns focus board rules: max_today, max_week, capacity_aware.
 */
router.get(
  '/focus/rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const rulesTable = await getTableColumns('my_work_focus_rules');
    if (!rulesTable || rulesTable.size === 0) {
      return res.json({
        maxToday: 5,
        maxWeek: 15,
        capacityAware: true,
      });
    }

    const row = await queryHelpers.queryOne<{
      max_today: number;
      max_week: number;
      capacity_aware: number;
    }>(`SELECT max_today, max_week, capacity_aware FROM my_work_focus_rules WHERE user_id = ?`, [
      userId,
    ]);
    if (!row) {
      return res.json({ maxToday: 5, maxWeek: 15, capacityAware: true });
    }
    res.json({
      maxToday: row.max_today ?? 5,
      maxWeek: row.max_week ?? 15,
      capacityAware: Boolean(row.capacity_aware),
    });
  })
);

/**
 * PUT /api/my-work/focus/rules (V4-INBX-02)
 * Body: { maxToday?, maxWeek?, capacityAware? }
 */
router.put(
  '/focus/rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const rulesTable = await getTableColumns('my_work_focus_rules');
    if (!rulesTable || rulesTable.size === 0) {
      return res.status(503).json({ error: 'Focus rules table not available' });
    }

    const maxToday =
      typeof req.body?.maxToday === 'number'
        ? Math.max(1, Math.min(20, req.body.maxToday))
        : undefined;
    const maxWeek =
      typeof req.body?.maxWeek === 'number'
        ? Math.max(1, Math.min(50, req.body.maxWeek))
        : undefined;
    const capacityAware =
      typeof req.body?.capacityAware === 'boolean' ? req.body.capacityAware : undefined;

    const existing = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM my_work_focus_rules WHERE user_id = ?`,
      [userId]
    );

    const now = new Date().toISOString();
    if (existing) {
      const updates: string[] = ['updated_at = ?'];
      const params: unknown[] = [now];
      if (maxToday != null) {
        updates.push('max_today = ?');
        params.push(maxToday);
      }
      if (maxWeek != null) {
        updates.push('max_week = ?');
        params.push(maxWeek);
      }
      if (capacityAware != null) {
        updates.push('capacity_aware = ?');
        params.push(capacityAware ? 1 : 0);
      }
      params.push(userId);
      await queryHelpers.queryRun(
        `UPDATE my_work_focus_rules SET ${updates.join(', ')} WHERE user_id = ?`,
        params
      );
    } else {
      await queryHelpers.queryRun(
        `INSERT INTO my_work_focus_rules (id, user_id, organization_id, max_today, max_week, capacity_aware, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          userId,
          orgId,
          maxToday ?? 5,
          maxWeek ?? 15,
          capacityAware !== false ? 1 : 0,
          now,
          now,
        ]
      );
    }
    res.json({ success: true });
  })
);

/**
 * GET /api/my-work/focus/state?date=YYYY-MM-DD
 * Returns persisted focus board state for a user/date.
 */
router.get(
  '/focus/state',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_focus_state']))) return;

    const focusDate = req.query.date ? String(req.query.date) : todayIsoDate();
    const rows =
      (await queryHelpers.queryAll<{
        item_key: string;
        column_name: string;
        position: number;
        updated_at: string;
      }>(
        `SELECT item_key, column_name, position, updated_at
         FROM my_work_focus_state
         WHERE user_id = ? AND focus_date = ?
         ORDER BY column_name ASC, position ASC, updated_at DESC`,
        [userId, focusDate]
      )) || [];

    res.json({
      date: focusDate,
      items: rows.map((r) => ({
        itemKey: r.item_key,
        column: r.column_name as FocusColumn,
        position: Number(r.position || 0),
        updatedAt: r.updated_at,
      })),
    });
  })
);

/**
 * DELETE /api/my-work/focus/item?itemId=task:<id>|decision:<id>
 * Removes an item from focus state for the given day.
 */
router.delete(
  '/focus/item',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_focus_state']))) return;

    const itemId = String(req.query.itemId || req.body?.itemId || '');
    const focusDate = req.query.date ? String(req.query.date) : todayIsoDate();
    if (!itemId || !itemId.includes(':')) {
      return res.status(400).json({ error: 'Missing itemId' });
    }

    await queryHelpers.queryRun(
      `DELETE FROM my_work_focus_state WHERE user_id = ? AND focus_date = ? AND item_key = ?`,
      [userId, focusDate, itemId]
    );

    res.json({ success: true });
  })
);

/**
 * GET /api/my-work/stats?period=week
 * Aggregates for ExecutiveDashboard — real trend + previous period comparison
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const period = String(req.query.period || 'week');
    const days = period === 'month' ? 30 : 7;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const prevSinceIso = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString();
    const today = todayIsoDate();

    // --- Current period ---
    const totals = await queryHelpers.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM tasks WHERE organization_id = ? AND assignee_id = ? AND created_at >= ?`,
      [orgId, userId, sinceIso]
    );
    const completed = await queryHelpers.queryOne<{ completed: number }>(
      `SELECT COUNT(*) as completed FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ?`,
      [orgId, userId, sinceIso]
    );
    const overdue = await queryHelpers.queryOne<{ overdue: number }>(
      `SELECT COUNT(*) as overdue FROM tasks
       WHERE organization_id = ? AND assignee_id = ?
         AND due_date IS NOT NULL AND date(due_date) < date(?)
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
      [orgId, userId, today]
    );
    const onTime = await queryHelpers.queryOne<{ onTime: number; totalDone: number }>(
      `SELECT
         SUM(CASE WHEN due_date IS NOT NULL AND completed_at IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) as onTime,
         SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as totalDone
       FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ?`,
      [orgId, userId, sinceIso]
    );

    // --- Previous period (for trend calculation) ---
    const prevTotals = await queryHelpers.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM tasks WHERE organization_id = ? AND assignee_id = ? AND created_at >= ? AND created_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );
    const prevCompleted = await queryHelpers.queryOne<{ completed: number }>(
      `SELECT COUNT(*) as completed FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );
    const prevOnTime = await queryHelpers.queryOne<{ onTime: number; totalDone: number }>(
      `SELECT
         SUM(CASE WHEN due_date IS NOT NULL AND completed_at IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) as onTime,
         SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as totalDone
       FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );

    // --- Escalations count ---
    const escalations = await queryHelpers.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM decisions
       WHERE organization_id = ? AND lower(coalesce(status,'')) = 'escalated'`,
      [orgId]
    );

    // --- Blocked tasks count ---
    const blocked = await queryHelpers.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM tasks
       WHERE organization_id = ? AND assignee_id = ?
         AND (lower(coalesce(status,'')) = 'blocked' OR blocked_reason IS NOT NULL OR blocked_by_decision_id IS NOT NULL)
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
      [orgId, userId]
    );

    const total = Number((totals as any)?.total || 0);
    const completedCount = Number((completed as any)?.completed || 0);
    const overdueCount = Number((overdue as any)?.overdue || 0);
    const totalDone = Number((onTime as any)?.totalDone || 0);
    const onTimeRate =
      totalDone > 0 ? Math.round((Number((onTime as any)?.onTime || 0) / totalDone) * 100) : 0;

    const prevTotal = Number((prevTotals as any)?.total || 0);
    const prevCompletedCount = Number((prevCompleted as any)?.completed || 0);
    const prevTotalDone = Number((prevOnTime as any)?.totalDone || 0);
    const prevOnTimeRate =
      prevTotalDone > 0
        ? Math.round((Number((prevOnTime as any)?.onTime || 0) / prevTotalDone) * 100)
        : 0;

    const currentScore = total > 0 ? (completedCount / total) * 100 : 0;
    const prevScore = prevTotal > 0 ? (prevCompletedCount / prevTotal) * 100 : 0;
    const trend: 'up' | 'down' | 'stable' =
      currentScore > prevScore + 5 ? 'up' : currentScore < prevScore - 5 ? 'down' : 'stable';

    res.json({
      total,
      completed: completedCount,
      onTimeRate,
      trend,
      byStatus: {
        overdue: overdueCount,
        blocked: Number((blocked as any)?.cnt || 0),
        escalated: Number((escalations as any)?.cnt || 0),
      },
      previous: {
        total: prevTotal,
        completed: prevCompletedCount,
        onTimeRate: prevOnTimeRate,
      },
    });
  })
);

/**
 * GET /api/my-work/team-workload
 * Simple team rollup for ExecutiveDashboard (no mock data)
 */
router.get(
  '/team-workload',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const [overview, completedRows] = await Promise.all([
      getCapacityOverview(orgId),
      queryHelpers.queryAll<{ assignee_id: string; cnt: number }>(
        `SELECT assignee_id, COUNT(*) as cnt
         FROM tasks
         WHERE organization_id = ? AND completed_at IS NOT NULL
          AND completed_at >= ${daysAgoSql(7)}
         GROUP BY assignee_id`,
        [orgId]
      ),
    ]);
    const completedMap = new Map(
      (completedRows || []).map((row) => [String(row.assignee_id), Number(row.cnt || 0)])
    );
    res.json(
      overview.users.map((user) => ({
        id: user.userId,
        name: user.name,
        capacity: user.utilizationPercent,
        tasksAssigned: Math.round(user.allocatedHours),
        tasksCompleted: completedMap.get(user.userId) || 0,
        capacityHours: user.capacityHours,
        allocatedHours: user.allocatedHours,
        overloaded: user.overloaded,
      }))
    );
  })
);

/**
 * T012 (V2) — Contextual Intelligence Feed (Signals)
 * Backend-driven feed derived from notifications + persisted user prefs (mute/snooze/dismiss).
 */
const isAiSignalNotification = (nType?: string | null) => {
  const t = String(nType || '').toUpperCase();
  return (
    t.includes('AI') || t.includes('RECOMMENDATION') || t.includes('INSIGHT') || t.includes('RISK')
  );
};

const snoozePresetToUntil = (preset: string): string => {
  const now = Date.now();
  const p = String(preset || '').toLowerCase();
  if (p === '1h') return new Date(now + 60 * 60 * 1000).toISOString();
  if (p === '4h') return new Date(now + 4 * 60 * 60 * 1000).toISOString();
  if (p === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  if (p === 'week' || p === 'next_week')
    return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(now + 24 * 60 * 60 * 1000).toISOString();
};

/**
 * M1 — Chat Context Enrichment
 * Aggregates the user's current MyWork state for AI system prompt enrichment.
 */
router.get(
  '/context-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const summary: Record<string, any> = {};

    try {
      const taskCols = await getTableColumns('tasks');
      if (taskCols.has('assignee_id')) {
        const taskStats = await queryHelpers.queryAll<{ status: string; cnt: number }>(
          `SELECT status, COUNT(*) as cnt FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND status != 'done'
           GROUP BY status`,
          [userId, orgId]
        );
        summary.tasksByStatus = {};
        let totalOpen = 0;
        for (const row of taskStats || []) {
          summary.tasksByStatus[row.status] = row.cnt;
          totalOpen += row.cnt;
        }
        summary.totalOpenTasks = totalOpen;

        const overdue = await queryHelpers.queryAll<{ id: string; title: string }>(
          `SELECT id, title FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND status != 'done' 
           AND due_date IS NOT NULL AND due_date < ${nowSql()}
           ORDER BY due_date ASC LIMIT 3`,
          [userId, orgId]
        );
        summary.overdueTasks = overdue || [];
        summary.overdueCount = summary.overdueTasks.length;
      }

      const decCols = await getTableColumns('decisions');
      const decisionDueColumn = decCols.has('due_date')
        ? 'due_date'
        : decCols.has('deadline')
          ? 'deadline'
          : null;
      if (decCols.has('decision_maker_id')) {
        const pendingDecs = await queryHelpers.queryAll<{
          id: string;
          title: string;
          due_date: string | null;
        }>(
          `SELECT id, title, ${decisionDueColumn ? `${decisionDueColumn} as due_date` : 'NULL as due_date'} FROM decisions 
           WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ? AND status = 'pending'
           ORDER BY ${decisionDueColumn ? `${decisionDueColumn} ASC NULLS LAST,` : ''} updated_at DESC LIMIT 3`,
          [userId, userId, orgId]
        );
        summary.pendingDecisions = pendingDecs || [];
        summary.pendingDecisionCount = summary.pendingDecisions.length;
      }

      if (await requireTables(res, ['my_work_inbox_triage'])) {
        const notifCols = await getTableColumns('notifications');
        if (notifCols.size > 0) {
          const readExpr = notifCols.has('read')
            ? 'COALESCE(read, 0)'
            : notifCols.has('is_read')
              ? `CASE
                   WHEN COALESCE(is_read::text, '0') IN ('1','true','t','TRUE','T') THEN 1
                   ELSE 0
                 END`
              : '0';
          const unprocessed = await queryHelpers.queryOne<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM notifications 
             WHERE user_id = ? AND organization_id = ? AND ${readExpr} = 0`,
            [userId, orgId]
          );
          summary.inboxUnprocessed = unprocessed?.cnt || 0;
        }
      }

      if (await requireTables(res, ['my_work_focus_state'])) {
        const todayCount = await queryHelpers.queryOne<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM my_work_focus_state 
           WHERE user_id = ? AND column_name = 'today'`,
          [userId]
        );
        summary.focusTodayCount = todayCount?.cnt || 0;
      }
    } catch (err) {
      console.error('[context-summary]', err);
    }

    res.json(summary);
  })
);

router.get(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (
      !(await requireTables(res, [
        'my_work_signal_prefs',
        'my_work_signal_snoozes',
        'my_work_signal_dismissals',
        'notifications',
      ]))
    )
      return;

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const nowIso = new Date().toISOString();

    const prefs = await queryHelpers.queryOne<{ muted_types_json?: string }>(
      `SELECT muted_types_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId]
    );
    const mutedTypes = parseTagsArray((prefs as any)?.muted_types_json).map((x) => x.toUpperCase());
    const mutedSet = new Set(mutedTypes);

    const snoozedRows =
      (await queryHelpers.queryAll<{ signal_key: string }>(
        `SELECT signal_key FROM my_work_signal_snoozes WHERE user_id = ? AND snoozed_until > ?`,
        [userId, nowIso]
      )) || [];
    const snoozedSet = new Set(snoozedRows.map((r) => String(r.signal_key)));

    const dismissedRows =
      (await queryHelpers.queryAll<{ signal_key: string }>(
        `SELECT signal_key FROM my_work_signal_dismissals WHERE user_id = ?`,
        [userId]
      )) || [];
    const dismissedSet = new Set(dismissedRows.map((r) => String(r.signal_key)));

    const notifCols = await getTableColumns('notifications');
    const notifHasRead = notifCols.has('read');
    const notifReadExpr = notifHasRead ? 'COALESCE(read, 0)' : '0';
    const notifMessageSelect = notifCols.has('message')
      ? 'message as body'
      : notifCols.has('body')
        ? 'body as body'
        : `'' as body`;
    const notifEntityTypeSelect = notifCols.has('entity_type')
      ? 'entity_type as entityType'
      : notifCols.has('entityType')
        ? 'entityType as entityType'
        : 'NULL as entityType';
    const notifEntityIdSelect = notifCols.has('entity_id')
      ? 'entity_id as entityId'
      : notifCols.has('entityId')
        ? 'entityId as entityId'
        : 'NULL as entityId';
    const notifProjectIdSelect = notifCols.has('project_id')
      ? 'project_id as projectId'
      : notifCols.has('projectId')
        ? 'projectId as projectId'
        : 'NULL as projectId';
    const notifProjectNameSelect = notifCols.has('project_name')
      ? 'project_name as projectName'
      : notifCols.has('projectName')
        ? 'projectName as projectName'
        : 'NULL as projectName';
    const notifSeveritySelect = notifCols.has('severity') ? 'severity' : `'INFO' as severity`;

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          type,
          title,
          ${notifMessageSelect},
          ${notifSeveritySelect},
          ${notifEntityTypeSelect},
          ${notifEntityIdSelect},
          ${notifProjectIdSelect},
          ${notifProjectNameSelect},
          created_at as createdAt
        FROM notifications
        WHERE user_id = ?
          AND ${notifReadExpr} = 0
        ORDER BY created_at DESC
        LIMIT 200
      `,
        [userId]
      )) || [];

    // Aggregate + filter
    const byKey = new Map<string, any>();
    for (const n of rows) {
      if (!isAiSignalNotification(n.type)) continue;
      const typeUp = String(n.type || '').toUpperCase();
      if (mutedSet.has(typeUp)) continue;

      const key = `notification:${String(n.id)}`;
      if (snoozedSet.has(key) || dismissedSet.has(key)) continue;
      if (projectId && n.projectId && String(n.projectId) !== String(projectId)) continue;

      const aggKey =
        n.entityType && n.entityId
          ? `${typeUp}:${String(n.entityType)}:${String(n.entityId)}`
          : key;
      const existing = byKey.get(aggKey);
      if (!existing) {
        byKey.set(aggKey, { ...n, key });
        continue;
      }
      const exTs = new Date(existing.createdAt || 0).getTime();
      const nTs = new Date(n.createdAt || 0).getTime();
      if (nTs > exTs) byKey.set(aggKey, { ...n, key });
    }

    const signals: any[] = Array.from(byKey.values())
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit)
      .map((n) => ({
        key: String(n.key),
        type: String(n.type || ''),
        title: String(n.title || 'Signal'),
        body: String(n.body || ''),
        severity: String(n.severity || 'INFO'),
        createdAt: n.createdAt || nowIso,
        projectId: n.projectId || null,
        projectName: n.projectName || null,
        entityType: n.entityType || null,
        entityId: n.entityId || null,
      }));

    // M6: Predictive signals — velocity-based predictions
    try {
      const taskCols = await getTableColumns('tasks');
      if (taskCols.has('due_date') && taskCols.has('assignee_id')) {
        const atRisk = await queryHelpers.queryAll<any>(
          `SELECT id, title, due_date FROM tasks
           WHERE assignee_id = ? AND organization_id = ?
           AND status IN ('todo', 'blocked')
           AND due_date IS NOT NULL AND due_date BETWEEN datetime('now') AND datetime('now', '+3 days')
           LIMIT 3`,
          [userId, orgId]
        );
        for (const task of atRisk || []) {
          const key = `predict_overdue_${task.id}`;
          if (!snoozedSet.has(key) && !dismissedSet.has(key)) {
            signals.push({
              key,
              type: 'prediction',
              severity: 'warning',
              title: `At risk: ${task.title}`,
              message: `Due ${task.due_date} but status is not in progress. Consider starting or rescheduling.`,
              source: 'ai_prediction',
              createdAt: new Date().toISOString(),
            });
          }
        }

        const decCols = await getTableColumns('decisions');
        if (decCols.has('decision_maker_id')) {
          const staleDecisions = await queryHelpers.queryAll<any>(
            `SELECT id, title, created_at FROM decisions
             WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ?
             AND status = 'pending' AND created_at < datetime('now', '-5 days')
             LIMIT 3`,
            [userId, userId, orgId]
          );
          for (const dec of staleDecisions || []) {
            const key = `bottleneck_decision_${dec.id}`;
            if (!snoozedSet.has(key) && !dismissedSet.has(key)) {
              signals.push({
                key,
                type: 'bottleneck',
                severity: 'warning',
                title: `Decision bottleneck: ${dec.title}`,
                message: `Pending for ${Math.round((Date.now() - new Date(dec.created_at).getTime()) / 86400000)} days. May be blocking dependent work.`,
                source: 'ai_prediction',
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[signals:predictions]', err);
    }

    res.json({ signals, mutedTypes });
  })
);

router.post(
  '/signals/mute-type',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_signal_prefs']))) return;

    const type = String(req.body?.type || '')
      .trim()
      .toUpperCase();
    if (!type) return res.status(400).json({ error: 'type is required' });

    const existing = await queryHelpers.queryOne<any>(
      `SELECT muted_types_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId]
    );
    const current = parseTagsArray(existing?.muted_types_json).map((x) => x.toUpperCase());
    const next = Array.from(new Set([...current, type]));

    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_prefs (user_id, organization_id, muted_types_json, quiet_hours_json, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT quiet_hours_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ?), '{}'), ?)`,
      [userId, orgId, JSON.stringify(next), userId, orgId, new Date().toISOString()]
    );

    res.json({ success: true, mutedTypes: next });
  })
);

router.post(
  '/signals/:key/snooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_signal_snoozes']))) return;

    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ error: 'key is required' });

    const until =
      typeof req.body?.until === 'string' && req.body.until.trim()
        ? String(req.body.until).trim()
        : snoozePresetToUntil(String(req.body?.preset || 'tomorrow'));

    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_snoozes (user_id, signal_key, snoozed_until, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, key, until]
    );
    res.json({ success: true, snoozedUntil: until });
  })
);

router.post(
  '/signals/:key/dismiss',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_signal_dismissals']))) return;

    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ error: 'key is required' });

    const dismissedAt = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_dismissals (user_id, signal_key, dismissed_at)
       VALUES (?, ?, ?)`,
      [userId, key, dismissedAt]
    );

    // If this is a notification-backed signal, mark as read as well.
    if (key.startsWith('notification:')) {
      const notifId = key.replace(/^notification:/, '');
      try {
        await NotificationService.markAsRead(notifId, userId);
      } catch {
        // ignore
      }
    }

    res.json({ success: true, dismissedAt });
  })
);

/**
 * T009 (V2) — My Ideas (private per-user repository)
 */
router.get(
  '/my-ideas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const tag = req.query.tag ? String(req.query.tag).trim().toLowerCase() : '';

    const params: any[] = [userId, orgId];
    let whereExtra = '';
    if (q) {
      whereExtra += " AND (lower(coalesce(title,'')) LIKE ? OR lower(coalesce(body,'')) LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }
    if (tag) {
      whereExtra += " AND lower(coalesce(tags,'')) LIKE ?";
      params.push(`%${tag}%`);
    }
    params.push(limit);

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          title,
          body,
          tags,
          source_type as "sourceType",
          source_conversation_id as "sourceConversationId",
          source_message_id as "sourceMessageId",
          stage,
          potential,
          complexity,
          area,
          priority,
          branch,
          promoted_to as "promotedTo",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM my_ideas
        WHERE user_id = ? AND organization_id = ?
          ${whereExtra}
        ORDER BY created_at DESC
        LIMIT ?
      `,
        params
      )) || [];

    res.json(rows.map((r: any) => ({ ...r, tags: parseTagsArray(r?.tags) })));
  })
);

router.get(
  '/my-ideas/suggest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 5;

    const params: any[] = [userId, orgId];
    let whereExtra = '';
    if (q) {
      whereExtra += " AND (lower(coalesce(title,'')) LIKE ? OR lower(coalesce(body,'')) LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }
    params.push(limit);

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          title,
          body,
          tags,
          created_at as "createdAt"
        FROM my_ideas
        WHERE user_id = ? AND organization_id = ?
          ${whereExtra}
        ORDER BY created_at DESC
        LIMIT ?
      `,
        params
      )) || [];

    res.json(rows.map((r: any) => ({ ...r, tags: parseTagsArray(r?.tags) })));
  })
);

router.post(
  '/my-ideas',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const title = String(req.body?.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const body = typeof req.body?.body === 'string' ? req.body.body : null;
    const tags = parseTagsArray(req.body?.tags);
    const sourceType = req.body?.sourceType ? String(req.body.sourceType) : null;
    const sourceConversationId = req.body?.sourceConversationId
      ? String(req.body.sourceConversationId)
      : null;
    const sourceMessageId = req.body?.sourceMessageId ? String(req.body.sourceMessageId) : null;

    const id = uuidv4();
    await queryHelpers.queryRun(
      `
      INSERT INTO my_ideas (
        id, user_id, organization_id, title, body, tags, source_type, source_conversation_id, source_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        userId,
        orgId,
        title,
        body,
        JSON.stringify(tags),
        sourceType,
        sourceConversationId,
        sourceMessageId,
      ]
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        title,
        body,
        tags,
        source_type as "sourceType",
        source_conversation_id as "sourceConversationId",
        source_message_id as "sourceMessageId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [id, userId, orgId]
    );

    req
      .emitAuditEvent?.({
        actorType: req.body?.fromAI ? 'AI' : 'USER',
        action: 'IDEA_CREATE',
        resourceType: 'idea',
        resourceId: id,
        after: { title, body, tags, sourceType },
        metadata: { fromAI: Boolean(req.body?.fromAI) },
      })
      .catch((err: any) => logger.warn('[MyIdeas] Audit log failed:', err?.message));

    await organizationContextService.recordMyWorkIdea({
      organizationId: orgId,
      userId,
      payload: {
        ideaId: id,
        title,
        body,
        tags,
        sourceType,
        sourceConversationId,
        sourceMessageId,
      },
    });

    res.status(201).json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.get(
  '/my-ideas/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        title,
        body,
        tags,
        source_type as "sourceType",
        source_conversation_id as "sourceConversationId",
        source_message_id as "sourceMessageId",
        stage,
        seed_text as "seedText",
        ai_expansion as "aiExpansion",
        research_data as "researchData",
        creative_proposals as "creativeProposals",
        summary_data as "summaryData",
        potential,
        complexity,
        area,
        priority,
        branch,
        promoted_to as "promotedTo",
        promoted_entity_id as "promotedEntityId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [id, userId, orgId]
    );

    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.put(
  '/my-ideas/:id',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, title, body, tags, stage, branch, area, priority FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [id, userId, orgId]
    );
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const setParts: string[] = [];
    const params: any[] = [];

    const set = (col: string, val: any) => {
      setParts.push(`${col} = ?`);
      params.push(val);
    };

    if (typeof req.body?.title === 'string') set('title', String(req.body.title).trim());
    if (typeof req.body?.body === 'string') set('body', req.body.body);
    if (req.body?.tags !== undefined) set('tags', JSON.stringify(parseTagsArray(req.body.tags)));
    if (typeof req.body?.branch === 'string') set('branch', req.body.branch);
    if (typeof req.body?.area === 'string') set('area', req.body.area);
    if (typeof req.body?.priority === 'number')
      set('priority', Math.max(0, Math.min(100, req.body.priority)));
    if (typeof req.body?.stage === 'string') set('stage', req.body.stage);

    if (setParts.length === 0) {
      const row = await queryHelpers.queryOne<any>(
        `
        SELECT
          id,
          title,
          body,
          tags,
          source_type as "sourceType",
          source_conversation_id as "sourceConversationId",
          source_message_id as "sourceMessageId",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM my_ideas
        WHERE id = ? AND user_id = ? AND organization_id = ?
        LIMIT 1
      `,
        [id, userId, orgId]
      );
      res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
      return;
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id, userId, orgId);
    await queryHelpers.queryRun(
      `UPDATE my_ideas SET ${setParts.join(', ')} WHERE id = ? AND user_id = ? AND organization_id = ?`,
      params
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        title,
        body,
        tags,
        source_type as "sourceType",
        source_conversation_id as "sourceConversationId",
        source_message_id as "sourceMessageId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [id, userId, orgId]
    );

    req
      .emitAuditEvent?.({
        actorType: req.body?.fromAI ? 'AI' : 'USER',
        action: 'IDEA_UPDATE',
        resourceType: 'idea',
        resourceId: id,
        before: {
          title: existing.title,
          body: existing.body,
          tags: existing.tags,
          stage: existing.stage,
          branch: existing.branch,
          area: existing.area,
          priority: existing.priority,
        },
        after: {
          title: (row as any)?.title,
          body: (row as any)?.body,
          tags: (row as any)?.tags,
          stage: (row as any)?.stage,
        },
        metadata: { fromAI: Boolean(req.body?.fromAI) },
      })
      .catch((err: any) => logger.warn('[MyIdeas] Audit log failed:', err?.message));

    await organizationContextService.recordMyWorkIdea({
      organizationId: orgId,
      userId,
      payload: {
        ideaId: id,
        title: (row as any)?.title,
        body: (row as any)?.body,
        tags: parseTagsArray((row as any)?.tags),
        stage: (row as any)?.stage,
      },
    });

    res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.delete(
  '/my-ideas/:id',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const id = String(req.params.id || '').trim();
    const before = await queryHelpers.queryOne<any>(
      `SELECT id, title, tags, stage FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [id, userId, orgId]
    );

    await queryHelpers.queryRun(
      `DELETE FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [id, userId, orgId]
    );

    if (before) {
      req
        .emitAuditEvent?.({
          actorType: 'USER',
          action: 'IDEA_DELETE',
          resourceType: 'idea',
          resourceId: id,
          before: { title: before.title, tags: before.tags, stage: before.stage },
        })
        .catch((err: any) => logger.warn('[MyIdeas] Audit log failed:', err?.message));
    }

    res.status(204).send();
  })
);

// ============================================================================
// T009 Enhancement — My Ideas Mind Map Edges (persistent relationships)
// ============================================================================

/**
 * GET /api/my-work/my-ideas/:id/edges
 * Special-case: :id = 'all' returns all edges for the user.
 */
router.get(
  '/my-ideas/:id/edges',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_edges']))) return;

    const id = String(req.params.id || '').trim();
    const kind = req.query.kind ? String(req.query.kind).trim() : '';

    const params: any[] = [userId, orgId];
    let whereExtra = '';

    if (id && id !== 'all') {
      whereExtra += ' AND (source_idea_id = ? OR target_idea_id = ?)';
      params.push(id, id);
    }
    if (kind) {
      whereExtra += ' AND kind = ?';
      params.push(kind);
    }

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          source_idea_id as "sourceIdeaId",
          target_idea_id as "targetIdeaId",
          kind,
          created_at as "createdAt"
        FROM my_idea_edges
        WHERE user_id = ? AND organization_id = ?
          ${whereExtra}
        ORDER BY created_at DESC
      `,
        params
      )) || [];

    res.json({ edges: rows });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/edges
 * Body: { targetIdeaId: string, kind?: string }
 */
router.post(
  '/my-ideas/:id/edges',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_edges']))) return;

    const sourceIdeaId = String(req.params.id || '').trim();
    const targetIdeaId = String(req.body?.targetIdeaId || req.body?.target_idea_id || '').trim();
    const kind = String(req.body?.kind || 'relates_to').trim() || 'relates_to';

    if (!sourceIdeaId || sourceIdeaId === 'all') {
      return res.status(400).json({ error: 'Invalid source idea id' });
    }
    if (!targetIdeaId) {
      return res.status(400).json({ error: 'targetIdeaId is required' });
    }
    if (sourceIdeaId === targetIdeaId) {
      return res.status(400).json({ error: 'Cannot connect idea to itself' });
    }

    const sourceOk = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [sourceIdeaId, userId, orgId]
    );
    if (!sourceOk) return res.status(404).json({ error: 'Source idea not found' });

    const targetOk = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [targetIdeaId, userId, orgId]
    );
    if (!targetOk) return res.status(404).json({ error: 'Target idea not found' });

    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO my_idea_edges (id, user_id, organization_id, source_idea_id, target_idea_id, kind)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, source_idea_id, target_idea_id, kind) DO NOTHING`,
      [id, userId, orgId, sourceIdeaId, targetIdeaId, kind]
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        source_idea_id as "sourceIdeaId",
        target_idea_id as "targetIdeaId",
        kind,
        created_at as "createdAt"
      FROM my_idea_edges
      WHERE user_id = ? AND organization_id = ?
        AND source_idea_id = ? AND target_idea_id = ? AND kind = ?
      LIMIT 1
    `,
      [userId, orgId, sourceIdeaId, targetIdeaId, kind]
    );

    req
      .emitAuditEvent?.({
        actorType: 'USER',
        action: 'IDEA_EDGE_CREATE',
        resourceType: 'idea_edge',
        resourceId: (row as any)?.id || id,
        after: { sourceIdeaId, targetIdeaId, kind },
      })
      .catch((err: any) => logger.warn('[MyIdeas] Audit log failed:', err?.message));

    res.status(201).json({ edge: row });
  })
);

/**
 * DELETE /api/my-work/my-ideas/:id/edges/:edgeId
 */
router.delete(
  '/my-ideas/:id/edges/:edgeId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_idea_edges']))) return;

    const ideaId = String(req.params.id || '').trim();
    const edgeId = String(req.params.edgeId || '').trim();
    if (!edgeId) return res.status(400).json({ error: 'edgeId is required' });

    const before = await queryHelpers.queryOne<any>(
      `SELECT id, source_idea_id as "sourceIdeaId", target_idea_id as "targetIdeaId", kind FROM my_idea_edges WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [edgeId, userId, orgId]
    );

    await queryHelpers.queryRun(
      `DELETE FROM my_idea_edges
       WHERE id = ? AND user_id = ? AND organization_id = ?
         ${ideaId && ideaId !== 'all' ? 'AND source_idea_id = ?' : ''}`,
      ideaId && ideaId !== 'all' ? [edgeId, userId, orgId, ideaId] : [edgeId, userId, orgId]
    );

    if (before) {
      req
        .emitAuditEvent?.({
          actorType: 'USER',
          action: 'IDEA_EDGE_DELETE',
          resourceType: 'idea_edge',
          resourceId: edgeId,
          before: {
            sourceIdeaId: before.sourceIdeaId,
            targetIdeaId: before.targetIdeaId,
            kind: before.kind,
          },
        })
        .catch((err: any) => logger.warn('[MyIdeas] Audit log failed:', err?.message));
    }

    res.status(204).send();
  })
);

// ============================================================================
// T009 Enhancement — My Ideas Recommendation Map (per-idea working graph)
// ============================================================================

type IdeaMapPayload = { nodes: any[]; edges: any[]; version?: number };

function buildDefaultIdeaMap(idea: { id: string; title: string }, isPl: boolean): IdeaMapPayload {
  return {
    nodes: [
      {
        id: 'root',
        type: 'center',
        position: { x: 0, y: 0 },
        data: {
          label: idea.title || (isPl ? 'Mój pomysł' : 'My idea'),
          ideaId: idea.id,
        },
      },
    ],
    edges: [],
    version: 1,
  };
}

function parseIdeaMapArray(raw: unknown): any[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseIdeaMapObject(raw: unknown): Record<string, unknown> {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isPlainIdeaMapObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeIdeaMapExtensions(
  existing: Record<string, unknown>,
  patch: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!patch) return existing;
  const next: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isPlainIdeaMapObject(next[key]) && isPlainIdeaMapObject(value)) {
      next[key] = mergeIdeaMapExtensions(next[key] as Record<string, unknown>, value);
      continue;
    }
    next[key] = value;
  }
  return next;
}

function isSuspiciousEmptyTableReset(params: {
  preferredTool?: string | null;
  normalizedNodes: any[];
  mergedExtensions: Record<string, unknown> | null | undefined;
  existingNodes: any[];
  existingExtensions: Record<string, unknown> | null | undefined;
}): boolean {
  const preferredTool = String(params.preferredTool || '').toLowerCase();
  if (!preferredTool.includes('table')) return false;

  const nextHasContent =
    (Array.isArray(params.normalizedNodes) && params.normalizedNodes.length > 0) ||
    Object.keys(params.mergedExtensions || {}).length > 0;
  if (nextHasContent) return false;

  const existingHasContent =
    (Array.isArray(params.existingNodes) && params.existingNodes.length > 0) ||
    Object.keys(params.existingExtensions || {}).length > 0;
  return existingHasContent;
}

/**
 * GET /api/my-work/my-ideas/:id/map
 * Returns per-idea working map (nodes + edges). If missing, returns a default skeleton.
 */
router.get(
  '/my-ideas/:id/map',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = String(req.params.id || '').trim();
    if (ideaId === 'metrics') {
      const idsRaw = String(req.query.ids || '').trim();
      const ids = idsRaw
        ? Array.from(
            new Set(
              idsRaw
                .split(',')
                .map((x) => String(x || '').trim())
                .filter(Boolean)
            )
          ).slice(0, 250)
        : [];

      if (!ids.length) return res.json({ metrics: {} });

      const placeholders = queryHelpers.buildInPlaceholders(ids);
      const rows =
        (await queryHelpers.queryAll<any>(
          `
          SELECT
            idea_id as "ideaId",
            nodes_json as "nodesJson",
            edges_json as "edgesJson",
            updated_at as "updatedAt"
          FROM my_idea_maps
          WHERE user_id = ? AND organization_id = ?
            AND idea_id IN (${placeholders})
        `,
          [userId, orgId, ...ids]
        )) || [];

      const byId = new Map<string, any>();
      for (const row of rows) {
        const rowIdeaId = String(row?.ideaId || '').trim();
        if (rowIdeaId) byId.set(rowIdeaId, row);
      }

      const metrics: Record<string, any> = {};
      for (const id of ids) {
        const row = byId.get(id);
        let n = 0;
        let e = 0;
        if (row) {
          try {
            const arr = JSON.parse(String(row.nodesJson || '[]'));
            n = Array.isArray(arr) ? arr.length : 0;
          } catch {
            n = 0;
          }
          try {
            const arr = JSON.parse(String(row.edgesJson || '[]'));
            e = Array.isArray(arr) ? arr.length : 0;
          } catch {
            e = 0;
          }
        }
        metrics[id] = { nodes: n, edges: e, items: n + e, updatedAt: row?.updatedAt || null };
      }

      return res.json({ metrics });
    }
    if (!ideaId || ideaId === 'all') return res.status(400).json({ error: 'Invalid idea id' });

    const language = String(req.query.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const mapCols = await getTableColumns('my_idea_maps');
    const preferredToolSelect = mapCols.has('preferred_tool')
      ? `, preferred_tool as "preferredTool"`
      : `, NULL as "preferredTool"`;
    const extensionsSelect = mapCols.has('extensions_json')
      ? `, extensions_json as "extensionsJson"`
      : `, '{}' as "extensionsJson"`;
    const schemaVersionSelect = mapCols.has('schema_version')
      ? `, schema_version as "schemaVersion"`
      : `, 1 as "schemaVersion"`;

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT id, nodes_json as "nodesJson", edges_json as "edgesJson", version, updated_at as "updatedAt"${preferredToolSelect}${extensionsSelect}${schemaVersionSelect}
      FROM my_idea_maps
      WHERE idea_id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [ideaId, userId, orgId]
    );

    if (!row) {
      const def = buildDefaultIdeaMap({ id: ideaId, title: String(idea?.title || '') }, isPl);
      return res.json({
        map: { ...def, preferredTool: null, extensions: {}, schemaVersion: 1 },
        isDefault: true,
      });
    }

    let nodes: any[] = [];
    let edges: any[] = [];
    let extensions: any = {};
    try {
      nodes = JSON.parse(String(row.nodesJson || '[]'));
    } catch {
      nodes = [];
    }
    try {
      edges = JSON.parse(String(row.edgesJson || '[]'));
    } catch {
      edges = [];
    }
    try {
      extensions = row?.extensionsJson ? JSON.parse(String(row.extensionsJson || '{}')) : {};
    } catch {
      extensions = {};
    }

    const rawGraph = {
      nodes,
      edges,
      extensions: extensions && typeof extensions === 'object' ? extensions : {},
      preferredTool: row?.preferredTool ? String(row.preferredTool) : null,
      schemaVersion: Number(row.schemaVersion || 1),
    };
    const upgraded = ensureLatestSchema(rawGraph as any);

    const responseMap: any = {
      ...upgraded,
      version: Number(row.version || 1),
    };

    if (featureFlags.ENABLE_TABLE_PLATFORM_METADATA_FIRST) {
      try {
        const projection = await projectionService.getFullProjection(ideaId, orgId, userId);
        if (projection) {
          responseMap.nodes = [...(responseMap.nodes || []), ...projection.nodes];
          responseMap.edges = [...(responseMap.edges || []), ...projection.edges];
          if (!responseMap.extensions) responseMap.extensions = {};
          responseMap.extensions.table = projection.extensions.table;
        }
      } catch (projErr) {
        logger.error('[ProjectionService] Failed to project table data:', projErr);
      }
    }

    res.json({
      map: responseMap,
      isDefault: false,
      updatedAt: row.updatedAt,
    });
  })
);

/**
 * GET /api/my-work/my-ideas/metrics/map?ids=comma,separated,ideaIds
 * Returns nodes/edges/items counts for many ideas (for list/table rendering).
 *
 * Notes:
 * - Keeps list fast by avoiding N calls to /:id/map
 * - JSON is parsed in JS for cross-DB compatibility.
 */
router.get(
  '/my-ideas/metrics/map',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_idea_maps']))) return;

    const idsRaw = String(req.query.ids || '').trim();
    const ids = idsRaw
      ? Array.from(
          new Set(
            idsRaw
              .split(',')
              .map((x) => String(x || '').trim())
              .filter(Boolean)
          )
        ).slice(0, 250)
      : [];

    if (!ids.length) return res.json({ metrics: {} });

    const placeholders = queryHelpers.buildInPlaceholders(ids);
    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          idea_id as "ideaId",
          nodes_json as "nodesJson",
          edges_json as "edgesJson",
          updated_at as "updatedAt"
        FROM my_idea_maps
        WHERE user_id = ? AND organization_id = ?
          AND idea_id IN (${placeholders})
      `,
        [userId, orgId, ...ids]
      )) || [];

    const byId = new Map<string, any>();
    for (const r of rows) {
      const id = String(r?.ideaId || '').trim();
      if (id) byId.set(id, r);
    }

    const metrics: Record<string, any> = {};
    for (const id of ids) {
      const row = byId.get(id);
      let n = 0;
      let e = 0;
      if (row) {
        try {
          const arr = JSON.parse(String(row.nodesJson || '[]'));
          n = Array.isArray(arr) ? arr.length : 0;
        } catch {
          n = 0;
        }
        try {
          const arr = JSON.parse(String(row.edgesJson || '[]'));
          e = Array.isArray(arr) ? arr.length : 0;
        } catch {
          e = 0;
        }
      }
      metrics[id] = { nodes: n, edges: e, items: n + e, updatedAt: row?.updatedAt || null };
    }

    res.json({ metrics });
  })
);

/**
 * PUT /api/my-work/my-ideas/:id/map
 * Body: { nodes: any[], edges: any[], version?: number }
 */
router.put(
  '/my-ideas/:id/map',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId || ideaId === 'all') return res.status(400).json({ error: 'Invalid idea id' });

    const nodes = Array.isArray(req.body?.nodes) ? req.body.nodes : null;
    const edges = Array.isArray(req.body?.edges) ? req.body.edges : null;
    if (!nodes || !edges)
      return res.status(400).json({ error: 'nodes and edges are required arrays' });

    const preferredToolRaw = req.body?.preferredTool ?? req.body?.preferred_tool ?? null;
    const preferredTool =
      typeof preferredToolRaw === 'string' && preferredToolRaw.trim()
        ? preferredToolRaw.trim()
        : null;
    const extensionsRaw = req.body?.extensions ?? req.body?.extensions_json ?? null;
    const extensions =
      extensionsRaw && typeof extensionsRaw === 'object' && !Array.isArray(extensionsRaw)
        ? extensionsRaw
        : null;

    // V4-IDEA-01: Validate and normalize canonical schema (no data loss, reject invalid)
    const validation = validateAndNormalizeGraph({
      nodes,
      edges,
      extensions: extensions ?? {},
      preferredTool,
    });
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid graph schema',
        details: validation.errors,
      });
    }
    const normalizedNodes = validation.normalized.nodes;
    const normalizedEdges = validation.normalized.edges;

    const ideaOk = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!ideaOk) return res.status(404).json({ error: 'Idea not found' });

    const mapCols = await getTableColumns('my_idea_maps');
    const extColSelect = mapCols.has('extensions_json') ? ', extensions_json' : '';
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, version, nodes_json, edges_json${extColSelect} FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );

    // V4-IDEA-01: Merge extensions for no-data-loss tool switch (preserve other tools' view state)
    let mergedExtensions = extensions;
    if (existing?.extensions_json && extensions) {
      try {
        const existingExt = JSON.parse(String(existing.extensions_json || '{}'));
        mergedExtensions = mergeIdeaMapExtensions(
          isPlainIdeaMapObject(existingExt) ? existingExt : {},
          extensions
        );
      } catch {
        mergedExtensions = extensions;
      }
    } else if (existing?.extensions_json) {
      try {
        mergedExtensions = JSON.parse(String(existing.extensions_json || '{}'));
      } catch {
        mergedExtensions = null;
      }
    }
    const existingNodes = parseIdeaMapArray(existing?.nodes_json);
    const existingExtensions = parseIdeaMapObject(existing?.extensions_json);
    if (
      existing &&
      isSuspiciousEmptyTableReset({
        preferredTool,
        normalizedNodes,
        mergedExtensions,
        existingNodes,
        existingExtensions,
      })
    ) {
      const currentGraph = ensureLatestSchema({
        nodes: existingNodes,
        edges: parseIdeaMapArray(existing.edges_json),
        extensions: existingExtensions,
        preferredTool,
        schemaVersion: 3,
      } as any);
      return res.status(409).json({
        error: 'Idea map conflict',
        code: 'IDEA_MAP_EMPTY_RESET_BLOCKED',
        currentVersion: Number(existing.version || 1),
        map: {
          ...currentGraph,
          version: Number(existing.version || 1),
        },
      });
    }
    const now = new Date().toISOString();
    const nextVersion = existing ? Number(existing.version || 1) + 1 : 1;

    if (!existing) {
      const id = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [id];
      const add = (col: string, val: any) => {
        if (!mapCols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };
      add('idea_id', ideaId);
      add('user_id', userId);
      add('organization_id', orgId);
      add('nodes_json', JSON.stringify(normalizedNodes));
      add('edges_json', JSON.stringify(normalizedEdges));
      add('version', nextVersion);
      add('schema_version', 3);
      if (preferredTool) add('preferred_tool', preferredTool);
      if (mergedExtensions) add('extensions_json', JSON.stringify(mergedExtensions));
      add('created_at', now);
      add('updated_at', now);
      await queryHelpers.queryRun(
        `INSERT INTO my_idea_maps (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
    } else {
      const setParts: string[] = [];
      const params: any[] = [];
      const set = (col: string, val: any) => {
        if (!mapCols.has(col)) return;
        setParts.push(`${col} = ?`);
        params.push(val);
      };
      set('nodes_json', JSON.stringify(normalizedNodes));
      set('edges_json', JSON.stringify(normalizedEdges));
      set('version', nextVersion);
      set('schema_version', 3);
      if (preferredTool !== null) set('preferred_tool', preferredTool);
      if (mergedExtensions !== null) set('extensions_json', JSON.stringify(mergedExtensions));
      set('updated_at', now);
      params.push(ideaId, userId, orgId);
      await queryHelpers.queryRun(
        `UPDATE my_idea_maps
         SET ${setParts.join(', ')}
         WHERE idea_id = ? AND user_id = ? AND organization_id = ?`,
        params
      );
    }

    const appliedFromAI = Boolean(req.body?.fromAI);
    let beforeSummary: { nodeCount: number; edgeCount: number; version: number } | undefined;
    if (existing) {
      try {
        const prevNodes = JSON.parse(existing.nodes_json || '[]') as any[];
        const prevEdges = JSON.parse(existing.edges_json || '[]') as any[];
        beforeSummary = {
          nodeCount: prevNodes.length,
          edgeCount: prevEdges.length,
          version: Number(existing.version) || 1,
        };
      } catch {
        beforeSummary = undefined;
      }
    }
    req
      .emitAuditEvent?.({
        actorType: appliedFromAI ? 'AI' : 'USER',
        action: existing ? 'IDEA_MAP_UPDATE' : 'IDEA_MAP_CREATE',
        resourceType: 'idea_map',
        resourceId: ideaId,
        before: beforeSummary,
        after: {
          nodeCount: normalizedNodes.length,
          edgeCount: normalizedEdges.length,
          version: nextVersion,
        },
        metadata: {
          preferredTool: preferredTool || undefined,
          appliedFromAI: appliedFromAI || undefined,
        },
      })
      .catch((err: any) => logger.warn('[IdeaMap] Audit log failed:', err?.message));

    res.json({ success: true, version: nextVersion });
  })
);

router.post(
  '/my-ideas/:id/map/sync',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId || ideaId === 'all') return res.status(400).json({ error: 'Invalid idea id' });

    const nodes = Array.isArray(req.body?.nodes) ? req.body.nodes : null;
    const edges = Array.isArray(req.body?.edges) ? req.body.edges : null;
    if (!nodes || !edges) {
      return res.status(400).json({ error: 'nodes and edges are required arrays' });
    }

    const preferredToolRaw = req.body?.preferredTool ?? req.body?.preferred_tool ?? null;
    const preferredTool =
      typeof preferredToolRaw === 'string' && preferredToolRaw.trim()
        ? preferredToolRaw.trim()
        : null;
    const extensionsRaw = req.body?.extensions ?? req.body?.extensions_json ?? null;
    const extensions =
      extensionsRaw && typeof extensionsRaw === 'object' && !Array.isArray(extensionsRaw)
        ? extensionsRaw
        : null;
    const baseVersionRaw = req.body?.baseVersion ?? req.body?.version ?? null;
    const baseVersion =
      baseVersionRaw == null || baseVersionRaw === ''
        ? null
        : Number.isFinite(Number(baseVersionRaw))
          ? Number(baseVersionRaw)
          : null;

    const validation = validateAndNormalizeGraph({
      nodes,
      edges,
      extensions: extensions ?? {},
      preferredTool,
    });
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid graph schema',
        details: validation.errors,
      });
    }

    const ideaOk = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!ideaOk) return res.status(404).json({ error: 'Idea not found' });

    const mapCols = await getTableColumns('my_idea_maps');
    const preferredToolSelect = mapCols.has('preferred_tool')
      ? `, preferred_tool as "preferredTool"`
      : `, NULL as "preferredTool"`;
    const extColSelect = mapCols.has('extensions_json')
      ? `, extensions_json as "extensionsJson"`
      : `, '{}' as "extensionsJson"`;
    const schemaVersionSelect = mapCols.has('schema_version')
      ? `, schema_version as "schemaVersion"`
      : `, 1 as "schemaVersion"`;
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson"${preferredToolSelect}${extColSelect}${schemaVersionSelect}
       FROM my_idea_maps
       WHERE idea_id = ? AND user_id = ? AND organization_id = ?
       LIMIT 1`,
      [ideaId, userId, orgId]
    );

    const currentVersion = existing ? Number(existing.version || 1) : 1;
    const hasVersionConflict =
      baseVersion !== null &&
      ((existing && baseVersion !== currentVersion) || (!existing && baseVersion > 1));
    if (hasVersionConflict) {
      const currentGraph = existing
        ? ensureLatestSchema({
            nodes: parseIdeaMapArray(existing.nodesJson),
            edges: parseIdeaMapArray(existing.edgesJson),
            extensions: parseIdeaMapObject(existing.extensionsJson),
            preferredTool: existing?.preferredTool ? String(existing.preferredTool) : null,
            schemaVersion: Number(existing?.schemaVersion || 1),
          } as any)
        : buildDefaultIdeaMap({ id: ideaId, title: '' }, false);
      return res.status(409).json({
        error: 'Idea map conflict',
        code: 'IDEA_MAP_CONFLICT',
        currentVersion,
        map: {
          ...currentGraph,
          version: currentVersion,
        },
      });
    }

    let mergedExtensions = extensions;
    if (existing?.extensionsJson && extensions) {
      mergedExtensions = mergeIdeaMapExtensions(
        parseIdeaMapObject(existing.extensionsJson),
        extensions
      );
    } else if (existing?.extensionsJson) {
      mergedExtensions = parseIdeaMapObject(existing.extensionsJson);
    }

    const existingNodes = parseIdeaMapArray(existing?.nodesJson);
    const existingEdges = parseIdeaMapArray(existing?.edgesJson);
    const existingExtensions = parseIdeaMapObject(existing?.extensionsJson);
    if (
      existing &&
      isSuspiciousEmptyTableReset({
        preferredTool,
        normalizedNodes: validation.normalized.nodes,
        mergedExtensions,
        existingNodes,
        existingExtensions,
      })
    ) {
      const currentGraph = ensureLatestSchema({
        nodes: existingNodes,
        edges: existingEdges,
        extensions: existingExtensions,
        preferredTool: existing?.preferredTool ? String(existing.preferredTool) : preferredTool,
        schemaVersion: Number(existing?.schemaVersion || 1),
      } as any);
      return res.status(409).json({
        error: 'Idea map conflict',
        code: 'IDEA_MAP_EMPTY_RESET_BLOCKED',
        currentVersion,
        map: {
          ...currentGraph,
          version: currentVersion,
        },
      });
    }

    const normalizedNodes = validation.normalized.nodes;
    const normalizedEdges = validation.normalized.edges;
    const now = new Date().toISOString();
    const nextVersion = existing ? currentVersion + 1 : 1;

    if (!existing) {
      const id = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [id];
      const add = (col: string, val: any) => {
        if (!mapCols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };
      add('idea_id', ideaId);
      add('user_id', userId);
      add('organization_id', orgId);
      add('nodes_json', JSON.stringify(normalizedNodes));
      add('edges_json', JSON.stringify(normalizedEdges));
      add('version', nextVersion);
      add('schema_version', 3);
      if (preferredTool) add('preferred_tool', preferredTool);
      if (mergedExtensions) add('extensions_json', JSON.stringify(mergedExtensions));
      add('created_at', now);
      add('updated_at', now);
      await queryHelpers.queryRun(
        `INSERT INTO my_idea_maps (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
    } else {
      const setParts: string[] = [];
      const params: any[] = [];
      const set = (col: string, val: any) => {
        if (!mapCols.has(col)) return;
        setParts.push(`${col} = ?`);
        params.push(val);
      };
      set('nodes_json', JSON.stringify(normalizedNodes));
      set('edges_json', JSON.stringify(normalizedEdges));
      set('version', nextVersion);
      set('schema_version', 3);
      if (preferredTool !== null) set('preferred_tool', preferredTool);
      if (mergedExtensions !== null) set('extensions_json', JSON.stringify(mergedExtensions));
      set('updated_at', now);
      params.push(ideaId, userId, orgId);
      await queryHelpers.queryRun(
        `UPDATE my_idea_maps
         SET ${setParts.join(', ')}
         WHERE idea_id = ? AND user_id = ? AND organization_id = ?`,
        params
      );
    }

    res.json({ ok: true, version: nextVersion, updatedAt: now });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/map/expand
 * AI-assisted expansion: returns nodes+edges to be appended client-side.
 * Body: { anchorNodeId?: string, branchKey?: string, count?: number, language?: string }
 */
router.post(
  '/my-ideas/:id/map/expand',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId || ideaId === 'all') return res.status(400).json({ error: 'Invalid idea id' });

    const countRaw = Number(req.body?.count);
    const count =
      Number.isFinite(countRaw) && countRaw > 0 ? Math.min(10, Math.max(1, countRaw)) : 5;
    const branchKey = String(req.body?.branchKey || 'options').trim() || 'options';
    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title, body, seed_text as "seedText", ai_expansion as "aiExpansion" FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    // Load current map (or default skeleton)
    const mapRow = await queryHelpers.queryOne<any>(
      `SELECT nodes_json as "nodesJson", edges_json as "edgesJson" FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    let nodes: any[] = [];
    let edges: any[] = [];
    if (mapRow) {
      try {
        nodes = JSON.parse(String(mapRow.nodesJson || '[]'));
      } catch {
        nodes = [];
      }
      try {
        edges = JSON.parse(String(mapRow.edgesJson || '[]'));
      } catch {
        edges = [];
      }
    } else {
      const def = buildDefaultIdeaMap({ id: ideaId, title: String(idea?.title || '') }, isPl);
      nodes = def.nodes;
      edges = def.edges;
    }

    const anchorNodeId = String(req.body?.anchorNodeId || 'root').trim() || 'root';
    const anchor =
      nodes.find((n) => String(n?.id) === anchorNodeId) ||
      nodes.find((n) => String(n?.id) === 'root');
    const branchNode =
      nodes.find((n) => String(n?.id) === `branch-${branchKey}`) ||
      nodes.find((n) => String(n?.type) === 'branch' && String(n?.data?.branchKey) === branchKey);

    const existingLabels = nodes
      .map((n) => String(n?.data?.label || '').trim())
      .filter(Boolean)
      .slice(0, 200);

    const seed = String(idea?.seedText || idea?.body || idea?.title || '').trim();
    const expansion = String(idea?.aiExpansion || '').trim();

    // Ask LLM for new node titles (JSON only)
    let suggestions: { title: string; nodeType?: string }[] = [];
    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      const nodeTypeHint =
        branchKey === 'problem'
          ? 'problem'
          : branchKey === 'goal'
            ? 'goal'
            : branchKey === 'evidence'
              ? 'evidence'
              : branchKey === 'risks'
                ? 'risk'
                : branchKey === 'experiments'
                  ? 'experiment'
                  : 'option';

      const prompt = isPl
        ? `Użytkownik pracuje na mapie rekomendacji biznesowych dla pomysłu/wyzwania.

Kontekst pomysłu:
${seed ? `"${seed}"` : '(brak)'}

Rozwinięcie (jeśli jest):
${expansion ? expansion.slice(0, 1200) : '(brak)'}

Istniejące elementy mapy (unikaj duplikatów): ${existingLabels.slice(0, 80).join(' | ')}

Wygeneruj ${count} nowych propozycji do gałęzi: "${branchKey}".
Każda propozycja ma być krótka, konkretna, biznesowa.

Zwróć TYLKO poprawny JSON array:
[{"title":"...","nodeType":"${nodeTypeHint}"}]
Bez markdown, bez komentarzy.`
        : `The user is building a business recommendation map for an idea/challenge.

Idea context:
${seed ? `"${seed}"` : '(none)'}

Expansion (if available):
${expansion ? expansion.slice(0, 1200) : '(none)'}

Existing map items (avoid duplicates): ${existingLabels.slice(0, 80).join(' | ')}

Generate ${count} new items for branch: "${branchKey}".
Keep each item short, concrete, business-oriented.

Return ONLY valid JSON array:
[{"title":"...","nodeType":"${nodeTypeHint}"}]
No markdown, no extra text.`;

      const r = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Jesteś konsultantem biznesowym. Odpowiadasz wyłącznie poprawnym JSON.'
          : 'You are a business consultant. You respond only with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = String((r as any)?.content || '[]');
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .map((x: any) => ({
            title: String(x?.title || '').trim(),
            nodeType: x?.nodeType ? String(x.nodeType).trim() : undefined,
          }))
          .filter((x) => x.title);
      }
    } catch (err: any) {
      logger.warn('[IdeaMapExpand] LLM expand failed:', err?.message);
      suggestions = [];
    }

    if (!suggestions.length) {
      return res.json({ added: { nodes: [], edges: [] }, reason: 'no_suggestions' });
    }

    const basePos = branchNode?.position || anchor?.position || { x: 0, y: 0 };
    const dx = branchNode ? 220 : 280;
    const startX = Number(basePos.x || 0) + dx;
    const startY = Number(basePos.y || 0) - Math.max(0, (suggestions.length - 1) * 35);

    const addedNodes: any[] = [];
    const addedEdges: any[] = [];

    const connectFrom = branchNode ? String(branchNode.id) : anchor ? String(anchor.id) : 'root';

    for (let i = 0; i < Math.min(suggestions.length, count); i++) {
      const s = suggestions[i];
      const nodeId = `rec-${uuidv4()}`;
      addedNodes.push({
        id: nodeId,
        type: 'idea',
        position: { x: startX, y: startY + i * 70 },
        data: {
          label: s.title,
          branchKey,
          sourceType: 'ai_suggestion',
          nodeType: s.nodeType || null,
          ideaId,
        },
      });
      addedEdges.push({
        id: `edge-${uuidv4()}`,
        source: connectFrom,
        target: nodeId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.75 },
        data: { userCreated: true, kind: 'ai_expansion' },
      });
    }

    const proposeOnly = String(req.body?.proposeOnly ?? 'false') === 'true';

    await req.emitAuditEvent?.({
      action: 'IDEA_MAP_AI_EXPAND',
      resourceType: 'IDEA_MAP',
      resourceId: ideaId,
    });

    if (proposeOnly) {
      return res.json({
        proposal: {
          add: { nodes: addedNodes, edges: addedEdges },
          remove: { nodeIds: [], edgeIds: [] },
          reorder: null,
          rationale: null,
        },
      });
    }

    res.json({ added: { nodes: addedNodes, edges: addedEdges } });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/map/ai-suggestions
 * Context-aware AI suggestions for the idea map.
 * Body: { seedText, mapNodes, mapEdges?, activeTool?, language? }
 */
router.post(
  '/my-ideas/:id/map/ai-suggestions',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId || ideaId === 'all') return res.status(400).json({ error: 'Invalid idea id' });

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title, seed_text as "seedText" FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const seedText = String(req.body?.seedText || idea?.seedText || '').trim();
    const mapNodes = Array.isArray(req.body?.mapNodes) ? req.body.mapNodes : [];
    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    const existingLabels = mapNodes
      .map((n: any) => String(n?.data?.label || '').trim())
      .filter(Boolean)
      .slice(0, 100);

    let suggestions: Array<{
      id: string;
      category: string;
      text: string;
      detail: string;
      confidence: number;
    }> = [];

    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      const prompt = isPl
        ? `Analizujesz mapę pomysłów biznesowych. Kontekst: "${seedText}".
Istniejące elementy: ${existingLabels.join(' | ')}.
Zaproponuj 5-8 sugestii w kategoriach: topics, findings, next_steps.
Zwróć TYLKO JSON array: [{"id":"s1","category":"topics|findings|next_steps","text":"...","detail":"...","confidence":0.8}]`
        : `You are analyzing a business idea map. Context: "${seedText}".
Existing items: ${existingLabels.join(' | ')}.
Propose 5-8 suggestions in categories: topics, findings, next_steps.
Return ONLY JSON array: [{"id":"s1","category":"topics|findings|next_steps","text":"...","detail":"...","confidence":0.8}]`;

      const r = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Jesteś konsultantem biznesowym. Odpowiadasz wyłącznie poprawnym JSON.'
          : 'You are a business consultant. You respond only with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = String((r as any)?.content || '[]');
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter((x: any) => x?.text)
          .map((x: any, idx: number) => ({
            id: String(x.id || `s${idx + 1}`),
            category: String(x.category || 'topics'),
            text: String(x.text || '').trim(),
            detail: String(x.detail || '').trim(),
            confidence: Number(x.confidence) || 0.7,
          }));
      }
    } catch (err: any) {
      logger.warn('[IdeaMapAISuggestions] LLM failed:', err?.message);
    }

    await req.emitAuditEvent?.({
      action: 'IDEA_MAP_AI_SUGGESTIONS',
      resourceType: 'IDEA_MAP',
      resourceId: ideaId,
    });

    res.json({ suggestions });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/map/gap-analysis
 * Identifies missing areas in the idea map.
 * Body: { seedText, mapNodes, branchKeys?, language? }
 */
router.post(
  '/my-ideas/:id/map/gap-analysis',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId || ideaId === 'all') return res.status(400).json({ error: 'Invalid idea id' });

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title, seed_text as "seedText" FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const seedText = String(req.body?.seedText || idea?.seedText || '').trim();
    const mapNodes = Array.isArray(req.body?.mapNodes) ? req.body.mapNodes : [];
    const branchKeys = Array.isArray(req.body?.branchKeys) ? req.body.branchKeys : [];
    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    const existingLabels = mapNodes
      .map((n: any) => String(n?.data?.label || '').trim())
      .filter(Boolean)
      .slice(0, 100);

    const gapNodes: any[] = [];
    const gapEdges: any[] = [];
    let rationale = '';

    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      const prompt = isPl
        ? `Analizujesz mapę pomysłów biznesowych. Kontekst: "${seedText}".
Istniejące gałęzie: ${branchKeys.join(', ')}.
Istniejące elementy: ${existingLabels.join(' | ')}.
Zidentyfikuj 3-5 brakujących obszarów (ryzyka, stakeholderzy, koszty, timeline, compliance itp.).
Zwróć TYLKO JSON: {"rationale":"...","gaps":[{"title":"...","branchKey":"risks|goal|options|evidence|experiments|problem","nodeType":"gap"}]}`
        : `You are analyzing a business idea map. Context: "${seedText}".
Existing branches: ${branchKeys.join(', ')}.
Existing items: ${existingLabels.join(' | ')}.
Identify 3-5 missing areas (risks, stakeholders, costs, timeline, compliance, etc.).
Return ONLY JSON: {"rationale":"...","gaps":[{"title":"...","branchKey":"risks|goal|options|evidence|experiments|problem","nodeType":"gap"}]}`;

      const r = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Jesteś konsultantem biznesowym. Odpowiadasz wyłącznie poprawnym JSON.'
          : 'You are a business consultant. You respond only with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = String((r as any)?.content || '{}');
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
      rationale = String(parsed?.rationale || '');
      const gaps = Array.isArray(parsed?.gaps) ? parsed.gaps : [];

      for (let i = 0; i < gaps.length; i++) {
        const g = gaps[i];
        const branchKey = String(g?.branchKey || 'risks');
        const branchNodeId = `branch-${branchKey}`;
        const nodeId = `gap-${uuidv4()}`;
        const branchNode = mapNodes.find((n: any) => String(n?.id) === branchNodeId);
        const basePos = branchNode?.position || { x: 0, y: 0 };

        gapNodes.push({
          id: nodeId,
          type: 'idea',
          position: { x: Number(basePos.x || 0) + 220, y: Number(basePos.y || 0) + i * 70 },
          data: {
            label: String(g?.title || ''),
            branchKey,
            sourceType: 'ai_suggestion',
            nodeType: String(g?.nodeType || 'gap'),
            ideaId,
          },
        });
        gapEdges.push({
          id: `edge-${uuidv4()}`,
          source: branchNodeId,
          target: nodeId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.75 },
          data: { userCreated: false, kind: 'gap_analysis' },
        });
      }
    } catch (err: any) {
      logger.warn('[IdeaMapGapAnalysis] LLM failed:', err?.message);
    }

    await req.emitAuditEvent?.({
      action: 'IDEA_MAP_GAP_ANALYSIS',
      resourceType: 'IDEA_MAP',
      resourceId: ideaId,
    });

    res.json({
      proposal: {
        add: { nodes: gapNodes, edges: gapEdges },
        rationale,
      },
    });
  })
);

// ============================================================================
// Snapshots — server-persisted map version history
// ============================================================================

/**
 * GET /api/my-work/my-ideas/:id/map/snapshots
 */
router.get(
  '/my-ideas/:id/map/snapshots',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const hasTables = await requireTables(res, ['my_idea_map_snapshots']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    const rows = await queryHelpers.query<any>(
      `SELECT id, label, node_count as "nodeCount", edge_count as "edgeCount", data_json as "dataJson", created_at as "createdAt"
       FROM my_idea_map_snapshots
       WHERE idea_id = ? AND user_id = ? AND organization_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [ideaId, userId, orgId]
    );

    const snapshots = rows.map((r: any) => {
      let data: any = {};
      try {
        data = JSON.parse(String(r.dataJson || '{}'));
      } catch {
        /* ignore */
      }
      return {
        id: r.id,
        label: r.label,
        nodeCount: r.nodeCount,
        edgeCount: r.edgeCount,
        timestamp: new Date(r.createdAt).getTime(),
        nodes: data.nodes || [],
        edges: data.edges || [],
      };
    });

    res.json({ snapshots });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/map/snapshots
 */
router.post(
  '/my-ideas/:id/map/snapshots',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const hasTables = await requireTables(res, ['my_idea_map_snapshots']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    const schema = z.object({
      label: z.string().min(1).max(200),
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const id = uuidv4();
    const dataJson = JSON.stringify({ nodes: parsed.data.nodes, edges: parsed.data.edges });

    await queryHelpers.run(
      `INSERT INTO my_idea_map_snapshots (id, idea_id, user_id, organization_id, label, node_count, edge_count, data_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        ideaId,
        userId,
        orgId,
        parsed.data.label,
        parsed.data.nodes.length,
        parsed.data.edges.length,
        dataJson,
      ]
    );

    await req.emitAuditEvent?.({
      action: 'IDEA_MAP_SNAPSHOT_CREATE',
      resourceType: 'IDEA_MAP_SNAPSHOT',
      resourceId: id,
    });

    res.status(201).json({
      ok: true,
      snapshot: {
        id,
        label: parsed.data.label,
        nodeCount: parsed.data.nodes.length,
        edgeCount: parsed.data.edges.length,
        timestamp: Date.now(),
      },
    });
  })
);

/**
 * DELETE /api/my-work/my-ideas/:id/map/snapshots/:snapshotId
 */
router.delete(
  '/my-ideas/:id/map/snapshots/:snapshotId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const hasTables = await requireTables(res, ['my_idea_map_snapshots']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    const snapshotId = String(req.params.snapshotId || '').trim();
    if (!ideaId || !snapshotId) return res.status(400).json({ error: 'Invalid id' });

    await queryHelpers.run(
      `DELETE FROM my_idea_map_snapshots WHERE id = ? AND idea_id = ? AND user_id = ? AND organization_id = ?`,
      [snapshotId, ideaId, userId, orgId]
    );

    await req.emitAuditEvent?.({
      action: 'IDEA_MAP_SNAPSHOT_DELETE',
      resourceType: 'IDEA_MAP_SNAPSHOT',
      resourceId: snapshotId,
    });

    res.json({ ok: true });
  })
);

// ============================================================================
// Node Comments — server-persisted per-node comment threads
// ============================================================================

/**
 * GET /api/my-work/my-ideas/:id/map/nodes/:nodeId/comments
 */
router.get(
  '/my-ideas/:id/map/nodes/:nodeId/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const hasTables = await requireTables(res, ['idea_node_comments']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    const nodeId = String(req.params.nodeId || '').trim();
    if (!ideaId || !nodeId) return res.status(400).json({ error: 'Missing ideaId or nodeId' });

    const rows = await queryHelpers.query<any>(
      `SELECT id, node_id, user_id, user_name, text, mentions, created_at
       FROM idea_node_comments
       WHERE idea_id = ? AND node_id = ? AND organization_id = ?
       ORDER BY created_at ASC`,
      [ideaId, nodeId, orgId]
    );

    res.json({
      comments: rows.map((c: any) => ({
        id: c.id,
        nodeId: c.node_id,
        author: c.user_name || c.user_id,
        text: c.text,
        mentions: c.mentions
          ? typeof c.mentions === 'string'
            ? JSON.parse(c.mentions)
            : c.mentions
          : [],
        createdAt: c.created_at,
      })),
    });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/map/nodes/:nodeId/comments
 */
router.post(
  '/my-ideas/:id/map/nodes/:nodeId/comments',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const hasTables = await requireTables(res, ['idea_node_comments']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    const nodeId = String(req.params.nodeId || '').trim();
    if (!ideaId || !nodeId) return res.status(400).json({ error: 'Missing ideaId or nodeId' });

    const schema = z.object({
      text: z.string().min(1).max(5000),
      mentions: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const userName = req.user?.name || req.user?.email || 'User';
    const id = uuidv4();

    await queryHelpers.run(
      `INSERT INTO idea_node_comments (id, idea_id, node_id, user_id, organization_id, user_name, text, mentions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        id,
        ideaId,
        nodeId,
        userId,
        orgId,
        userName,
        parsed.data.text,
        parsed.data.mentions ? JSON.stringify(parsed.data.mentions) : null,
      ]
    );

    await req.emitAuditEvent?.({
      action: 'IDEA_NODE_COMMENT_CREATE',
      resourceType: 'IDEA_NODE_COMMENT',
      resourceId: id,
    });

    res.status(201).json({
      comment: {
        id,
        nodeId,
        author: userName,
        text: parsed.data.text,
        mentions: parsed.data.mentions || [],
        createdAt: new Date().toISOString(),
      },
    });
  })
);

/**
 * DELETE /api/my-work/my-ideas/:id/map/nodes/:nodeId/comments/:commentId
 */
router.delete(
  '/my-ideas/:id/map/nodes/:nodeId/comments/:commentId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const hasTables = await requireTables(res, ['idea_node_comments']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    const nodeId = String(req.params.nodeId || '').trim();
    const commentId = String(req.params.commentId || '').trim();
    if (!ideaId || !nodeId || !commentId)
      return res.status(400).json({ error: 'Missing required params' });

    await queryHelpers.run(
      `DELETE FROM idea_node_comments WHERE id = ? AND idea_id = ? AND node_id = ? AND organization_id = ?`,
      [commentId, ideaId, nodeId, orgId]
    );

    await req.emitAuditEvent?.({
      action: 'IDEA_NODE_COMMENT_DELETE',
      resourceType: 'IDEA_NODE_COMMENT',
      resourceId: commentId,
    });

    res.json({ ok: true });
  })
);

// ============================================================================
// Activity Feed — server-persisted map activity log
// ============================================================================

/**
 * GET /api/my-work/my-ideas/:id/activity
 */
router.get(
  '/my-ideas/:id/activity',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const hasTables = await requireTables(res, ['my_idea_activity']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const rows = await queryHelpers.query<any>(
      `SELECT id, type, actor, node_id as "nodeId", node_label as "nodeLabel", detail, created_at as "createdAt"
       FROM my_idea_activity
       WHERE idea_id = ? AND user_id = ? AND organization_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [ideaId, userId, orgId, limit, offset]
    );

    const entries = rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      actor: r.actor,
      nodeId: r.nodeId,
      nodeLabel: r.nodeLabel,
      detail: r.detail,
      timestamp: new Date(r.createdAt).getTime(),
    }));

    res.json({ entries });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/activity
 */
router.post(
  '/my-ideas/:id/activity',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const hasTables = await requireTables(res, ['my_idea_activity']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    const schema = z.object({
      type: z.string().min(1).max(100),
      actor: z.string().min(1).max(200),
      nodeId: z.string().optional(),
      nodeLabel: z.string().optional(),
      detail: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const id = uuidv4();
    await queryHelpers.run(
      `INSERT INTO my_idea_activity (id, idea_id, user_id, organization_id, type, actor, node_id, node_label, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        ideaId,
        userId,
        orgId,
        parsed.data.type,
        parsed.data.actor,
        parsed.data.nodeId || null,
        parsed.data.nodeLabel || null,
        parsed.data.detail || null,
      ]
    );

    res.status(201).json({ ok: true, entryId: id });
  })
);

// ============================================================================
// AI Generator — context-aware LLM generation for Idea Workspace tools
// ============================================================================

const IdeaAIGenerateBodySchema = z.object({
  generatorType: z.enum([
    'lane_generator',
    'flow_generator',
    'suggestions',
    'bottleneck',
    'enrichment',
    'mindmap_expand',
    'table_columns',
    'table_views',
    'node_context',
    'auto_cluster',
    'whiteboard_brainstorm',
    'whiteboard_clusters',
    'whiteboard_organize',
    'sticky_summarize',
    'summary',
    'mm_branch_generator',
    'mm_expand',
    'mm_what_if',
    // V51-01: Artifact linking
    'ai_retrieve_artifacts',
    'ai_propose_attachments',
    'ai_build_linked_table',
    'ai_autofill_mappings',
    // V51-05: Whiteboard facilitation
    'wb_find_themes',
    'wb_name_clusters',
    'wb_to_map_branches',
    'wb_to_table',
    'wb_extract_actions',
    // V51-06: Table AI
    'table_rows',
    'table_simplify',
    // Existing but missing from route schema
    'node_expand',
    'process_coach',
    'next_step',
    'process_summary',
    'vsm_generator',
    'vsm_future_state',
  ]),
  tool: z.enum(['process_flow', 'mindmap', 'table', 'whiteboard']),
  context: z.object({
    seedText: z.string().default(''),
    title: z.string().default(''),
    branch: z.string().optional(),
    area: z.string().optional(),
    existingNodes: z.array(z.any()).default([]),
    existingEdges: z.array(z.any()).default([]),
    existingLanes: z.array(z.any()).optional(),
    language: z.string().default('en'),
    selection: z
      .object({
        type: z.string().optional(),
        count: z.number().optional(),
        ids: z.array(z.string()).optional(),
        primaryId: z.string().optional(),
      })
      .optional(),
  }),
});

/**
 * POST /api/my-work/my-ideas/:id/ai-generate
 * Context-aware AI generation for Idea Workspace canvas tools.
 * Returns AIProposalBatch (propose → accept pattern).
 */
router.post(
  '/my-ideas/:id/ai-generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    const parsed = IdeaAIGenerateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid request body', details: parsed.error.flatten() });
    }

    const { generatorType, tool, context } = parsed.data;

    try {
      const { generateIdeaAI } = await import('../services/ideaAIGeneratorService.js');
      const result = await generateIdeaAI({
        generatorType: generatorType as any,
        tool: tool as any,
        context: {
          seedText: context.seedText,
          title: context.title,
          branch: context.branch,
          area: context.area,
          existingNodes: context.existingNodes,
          existingEdges: context.existingEdges,
          existingLanes: context.existingLanes,
          language: context.language,
          selection: context.selection,
        },
        userId,
        orgId,
      });
      res.json(result);
    } catch (err: any) {
      logger.error('[IdeaAIGenerate] Failed:', err?.message);
      res.status(500).json({ error: err?.message || 'AI generation failed' });
    }
  })
);

// ============================================================================
// V51-04: Artifact attachment persistence API
// ============================================================================

const ArtifactAttachBodySchema = z.object({
  artifactRef: z.object({ type: z.string().min(1), id: z.string().min(1) }),
  artifactIndex: z.string().optional(),
  label: z.string().optional(),
  linkRole: z.enum(['context', 'source', 'output', 'evidence', 'related']).optional(),
});

router.post(
  '/my-ideas/:id/objects/:objectId/artifacts',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const ideaId = req.params.id;
    const objectId = req.params.objectId;
    if (!ideaId || !objectId) return res.status(400).json({ error: 'Missing ideaId or objectId' });

    const parsed = ArtifactAttachBodySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });

    const { artifactRef, artifactIndex, label, linkRole } = parsed.data;

    if (!(await requireTables(res, ['my_idea_maps']))) return;

    const map = await queryHelpers.queryOne<any>(
      `SELECT id, nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!map) return res.status(404).json({ error: 'Idea map not found' });

    let nodes: any[];
    try {
      const parsed = JSON.parse(map.nodes_json || '[]');
      nodes = Array.isArray(parsed) ? parsed : [];
    } catch {
      nodes = [];
    }

    const nodeIdx = nodes.findIndex((n: any) => String(n.id) === String(objectId));
    if (nodeIdx === -1) return res.status(404).json({ error: 'Object not found in workspace' });

    const node = nodes[nodeIdx];
    if (!node.data || typeof node.data !== 'object') node.data = {};
    const existingLinks: any[] = Array.isArray(node.data.artifactLinks)
      ? node.data.artifactLinks
      : Array.isArray(node.artifactLinks)
        ? node.artifactLinks
        : [];
    const duplicate = existingLinks.some(
      (l: any) => l.artifactRef?.type === artifactRef.type && l.artifactRef?.id === artifactRef.id
    );
    if (duplicate) return res.status(409).json({ error: 'Artifact already attached' });

    const newLink = {
      artifactRef,
      ...(artifactIndex ? { artifactIndex } : {}),
      ...(label ? { label } : {}),
      ...(linkRole ? { linkRole } : {}),
    };
    const updatedLinks = [...existingLinks, newLink];
    node.data.artifactLinks = updatedLinks;
    node.artifactLinks = updatedLinks;
    nodes[nodeIdx] = node;

    await queryHelpers.queryRun(
      `UPDATE my_idea_maps
       SET nodes_json = ?, version = COALESCE(version, 1) + 1, updated_at = ${nowSql()}
       WHERE id = ?`,
      [JSON.stringify(nodes), map.id]
    );

    // Create LinkGraph edge for cross-platform traceability
    try {
      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'idea',
        sourceId: ideaId,
        targetType: artifactRef.type,
        targetId: artifactRef.id,
        relation: 'ref',
        containerType: 'idea_workspace',
        containerId: ideaId,
        blockId: objectId,
      });
    } catch {
      /* best-effort — link_graph_edges table may not exist */
    }

    res.status(201).json({ ok: true, artifactLink: newLink });
  })
);

router.delete(
  '/my-ideas/:id/objects/:objectId/artifacts/:artifactType/:artifactId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const { id: ideaId, objectId, artifactType, artifactId } = req.params;
    if (!ideaId || !objectId || !artifactType || !artifactId) {
      return res.status(400).json({ error: 'Missing required params' });
    }

    if (!(await requireTables(res, ['my_idea_maps']))) return;

    const map = await queryHelpers.queryOne<any>(
      `SELECT id, nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!map) return res.status(404).json({ error: 'Idea map not found' });

    let nodes: any[];
    try {
      const parsed = JSON.parse(map.nodes_json || '[]');
      nodes = Array.isArray(parsed) ? parsed : [];
    } catch {
      nodes = [];
    }

    const nodeIdx = nodes.findIndex((n: any) => String(n.id) === String(objectId));
    if (nodeIdx === -1) return res.status(404).json({ error: 'Object not found' });

    const node = nodes[nodeIdx];
    if (!node.data || typeof node.data !== 'object') node.data = {};
    const links: any[] = Array.isArray(node.data.artifactLinks)
      ? node.data.artifactLinks
      : Array.isArray(node.artifactLinks)
        ? node.artifactLinks
        : [];
    const filtered = links.filter(
      (l: any) => !(l.artifactRef?.type === artifactType && l.artifactRef?.id === artifactId)
    );
    if (filtered.length === links.length)
      return res.status(404).json({ error: 'Artifact link not found' });

    node.data.artifactLinks = filtered.length > 0 ? filtered : undefined;
    node.artifactLinks = filtered.length > 0 ? filtered : undefined;
    nodes[nodeIdx] = node;

    await queryHelpers.queryRun(
      `UPDATE my_idea_maps
       SET nodes_json = ?, version = COALESCE(version, 1) + 1, updated_at = ${nowSql()}
       WHERE id = ?`,
      [JSON.stringify(nodes), map.id]
    );

    // V51-04: Remove corresponding LinkGraph edge on detach (scoped to block_id)
    try {
      const lgCols = await getTableColumns('link_graph_edges');
      if (lgCols && lgCols.size > 0) {
        const hasBlockId = lgCols.has('block_id');
        if (hasBlockId) {
          await queryHelpers.queryRun(
            `DELETE FROM link_graph_edges WHERE source_type = 'idea' AND source_id = ? AND target_type = ? AND target_id = ? AND block_id = ?`,
            [ideaId, artifactType, artifactId, objectId]
          );
        } else {
          await queryHelpers.queryRun(
            `DELETE FROM link_graph_edges WHERE source_type = 'idea' AND source_id = ? AND target_type = ? AND target_id = ?`,
            [ideaId, artifactType, artifactId]
          );
        }
      }
    } catch {
      /* best-effort — link_graph_edges may not exist */
    }

    res.json({ ok: true });
  })
);

router.get(
  '/my-ideas/:id/objects/:objectId/artifacts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const { id: ideaId, objectId } = req.params;
    if (!ideaId || !objectId) return res.status(400).json({ error: 'Missing params' });

    if (!(await requireTables(res, ['my_idea_maps']))) return;

    const map = await queryHelpers.queryOne<any>(
      `SELECT nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!map) return res.status(404).json({ error: 'Idea map not found' });

    let nodes: any[];
    try {
      const parsed = JSON.parse(map.nodes_json || '[]');
      nodes = Array.isArray(parsed) ? parsed : [];
    } catch {
      nodes = [];
    }

    const node = nodes.find((n: any) => String(n.id) === String(objectId));
    if (!node) return res.status(404).json({ error: 'Object not found' });

    const links = Array.isArray(node.data?.artifactLinks)
      ? node.data.artifactLinks
      : Array.isArray(node.artifactLinks)
        ? node.artifactLinks
        : [];
    res.json({ artifactLinks: links });
  })
);

// ============================================================================
// V51-02: Chat-to-workspace handoff endpoint
// ============================================================================

const ChatHandoffBodySchema = z.object({
  title: z.string().min(1).max(500),
  seedText: z.string().default(''),
  preferredSystem: z.enum(['mindmap', 'process_flow', 'table', 'whiteboard']).optional(),
  templateId: z.string().optional(),
  startMode: z.enum(['describe_with_ai', 'blank_canvas', 'use_template']).optional(),
  structuredBrief: z
    .object({
      problem: z.string().optional(),
      currentState: z.string().optional(),
      desiredOutcome: z.string().optional(),
      constraints: z.string().optional(),
      evidence: z.string().optional(),
    })
    .optional(),
  sourceConversationId: z.string().optional(),
  sourceMessageId: z.string().optional(),
});

router.post(
  '/my-ideas/from-chat',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const parsed = ChatHandoffBodySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });

    const {
      title,
      seedText,
      preferredSystem,
      templateId,
      startMode,
      structuredBrief,
      sourceConversationId,
      sourceMessageId,
    } = parsed.data;

    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const briefJson = structuredBrief ? JSON.stringify(structuredBrief) : null;
    const body =
      seedText ||
      (structuredBrief
        ? [structuredBrief.problem, structuredBrief.currentState, structuredBrief.desiredOutcome]
            .filter(Boolean)
            .join('\n\n')
        : '');

    await queryHelpers.queryRun(
      `INSERT INTO my_ideas (id, user_id, organization_id, title, body, seed_text, stage, source_type, source_conversation_id, source_message_id, area, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'spark', 'chat', ?, ?, ?, ?, ?)`,
      [
        ideaId,
        userId,
        orgId,
        title,
        body,
        seedText,
        sourceConversationId || null,
        sourceMessageId || null,
        null,
        now,
        now,
      ]
    );

    const mapId = `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const extensions: Record<string, unknown> = {};
    if (templateId) extensions.templateId = templateId;
    if (startMode) extensions.startMode = startMode;
    if (briefJson) extensions.structuredBrief = structuredBrief;

    const chatMapCols = await getTableColumns('my_idea_maps');
    const hasSchemaVer = chatMapCols.has('schema_version');
    const hasPrefTool = chatMapCols.has('preferred_tool');
    const hasExtJson = chatMapCols.has('extensions_json');

    const insertCols = [
      'id',
      'idea_id',
      'user_id',
      'organization_id',
      'nodes_json',
      'edges_json',
      'created_at',
      'updated_at',
    ];
    const insertVals: unknown[] = [mapId, ideaId, userId, orgId, '[]', '[]', now, now];

    if (hasPrefTool) {
      insertCols.push('preferred_tool');
      insertVals.push(preferredSystem || null);
    }
    if (hasExtJson) {
      insertCols.push('extensions_json');
      insertVals.push(JSON.stringify(extensions));
    }
    if (hasSchemaVer) {
      insertCols.push('schema_version');
      insertVals.push(3);
    }

    await queryHelpers.queryRun(
      `INSERT INTO my_idea_maps (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`,
      insertVals
    );

    res.status(201).json({
      ok: true,
      ideaId,
      mapId,
      preferredSystem: preferredSystem || null,
      startMode: startMode || 'blank_canvas',
    });
  })
);

// ============================================================================
// V4-IDEA-05: Cluster / Outcome model
// ============================================================================

/**
 * POST /api/my-work/my-ideas/:id/clusters/materialize
 * Convert AI cluster assignments to first-class cluster nodes in the graph.
 * Body: { clusters: [{ id, name, nodeIds, color? }] }
 */
router.post(
  '/my-ideas/:id/clusters/materialize',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing idea id' });

    const clusters = req.body?.clusters;
    if (!Array.isArray(clusters) || clusters.length === 0) {
      return res.status(400).json({ error: 'clusters array is required' });
    }

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const mapRow = await queryHelpers.queryOne<any>(
      `SELECT id, nodes_json as "nodesJson", edges_json as "edgesJson", version FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!mapRow) return res.status(404).json({ error: 'Idea map not found' });

    let existingNodes: any[] = [];
    let existingEdges: any[] = [];
    try {
      existingNodes =
        typeof mapRow.nodesJson === 'string'
          ? JSON.parse(mapRow.nodesJson)
          : mapRow.nodesJson || [];
      existingEdges =
        typeof mapRow.edgesJson === 'string'
          ? JSON.parse(mapRow.edgesJson)
          : mapRow.edgesJson || [];
    } catch {
      /* keep defaults */
    }

    const assignments = clusters.map((c: any) => ({
      id: String(c.id || ''),
      name: String(c.name || 'Cluster'),
      nodeIds: Array.isArray(c.nodeIds) ? c.nodeIds.map(String) : [],
      color: c.color ? String(c.color) : undefined,
    }));

    const { clusterNodes, edges: newEdges } = materializeClusters(existingNodes, assignments);

    const mergedNodes = [...existingNodes, ...clusterNodes];
    const existingEdgeIds = new Set(existingEdges.map((e: any) => e.id));
    const mergedEdges = [...existingEdges, ...newEdges.filter((e) => !existingEdgeIds.has(e.id))];

    const { normalized } = validateAndNormalizeGraph({
      nodes: mergedNodes,
      edges: mergedEdges,
    });

    const nextVersion = Number(mapRow.version || 1) + 1;
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `UPDATE my_idea_maps SET nodes_json = ?, edges_json = ?, version = ?, updated_at = ? WHERE idea_id = ? AND user_id = ? AND organization_id = ?`,
      [
        JSON.stringify(normalized.nodes),
        JSON.stringify(normalized.edges),
        nextVersion,
        now,
        ideaId,
        userId,
        orgId,
      ]
    );

    req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'IDEA_CLUSTERS_MATERIALIZE',
      resourceType: 'idea_map',
      resourceId: ideaId,
      after: { clusterCount: clusterNodes.length, version: nextVersion },
    });

    res.json({
      graph: normalized,
      clusterIds: clusterNodes.map((n) => n.id),
      version: nextVersion,
    });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/clusters/:clusterId/outcome
 * Create an outcome node from a cluster.
 * Body: { outcomeType: 'task' | 'decision' | 'initiative' | 'insight', label: string }
 */
router.post(
  '/my-ideas/:id/clusters/:clusterId/outcome',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = String(req.params.id || '').trim();
    const clusterId = String(req.params.clusterId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing idea id' });
    if (!clusterId) return res.status(400).json({ error: 'Missing cluster id' });

    const outcomeType = String(req.body?.outcomeType || '').trim() as OutcomeType;
    const label = String(req.body?.label || '').trim();
    if (!['task', 'decision', 'initiative', 'insight'].includes(outcomeType)) {
      return res.status(400).json({ error: 'Invalid outcomeType' });
    }
    if (!label) return res.status(400).json({ error: 'label is required' });

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const mapRow = await queryHelpers.queryOne<any>(
      `SELECT id, nodes_json as "nodesJson", edges_json as "edgesJson", version FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!mapRow) return res.status(404).json({ error: 'Idea map not found' });

    let existingNodes: any[] = [];
    let existingEdges: any[] = [];
    try {
      existingNodes =
        typeof mapRow.nodesJson === 'string'
          ? JSON.parse(mapRow.nodesJson)
          : mapRow.nodesJson || [];
      existingEdges =
        typeof mapRow.edgesJson === 'string'
          ? JSON.parse(mapRow.edgesJson)
          : mapRow.edgesJson || [];
    } catch {
      /* keep defaults */
    }

    const clusterNode = existingNodes.find(
      (n: any) => n.id === clusterId && (n.kind === 'cluster' || n.type === 'cluster')
    );
    if (!clusterNode) return res.status(404).json({ error: 'Cluster node not found in graph' });

    const outcomeNode = createOutcomeFromCluster(clusterId, outcomeType, label, clusterNode);

    const outcomeEdge = {
      id: `e-${clusterId}-${outcomeNode.id}`,
      fromNodeId: clusterId,
      toNodeId: outcomeNode.id,
      relationType: 'flow' as const,
      label: outcomeType,
    };

    const mergedNodes = [...existingNodes, outcomeNode];
    const mergedEdges = [...existingEdges, outcomeEdge];

    const { normalized } = validateAndNormalizeGraph({
      nodes: mergedNodes,
      edges: mergedEdges,
    });

    const nextVersion = Number(mapRow.version || 1) + 1;
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `UPDATE my_idea_maps SET nodes_json = ?, edges_json = ?, version = ?, updated_at = ? WHERE idea_id = ? AND user_id = ? AND organization_id = ?`,
      [
        JSON.stringify(normalized.nodes),
        JSON.stringify(normalized.edges),
        nextVersion,
        now,
        ideaId,
        userId,
        orgId,
      ]
    );

    req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'IDEA_OUTCOME_CREATE',
      resourceType: 'idea_map',
      resourceId: ideaId,
      after: { outcomeId: outcomeNode.id, outcomeType, clusterId },
    });

    res.json({ outcome: outcomeNode, version: nextVersion });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/outcomes/:outcomeId/convert
 * Convert an outcome node to a real entity (task/decision/initiative).
 * Body: { target: 'task' | 'decision' | 'initiative' }
 */
router.post(
  '/my-ideas/:id/outcomes/:outcomeId/convert',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_maps']))) return;

    const ideaId = String(req.params.id || '').trim();
    const outcomeId = String(req.params.outcomeId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing idea id' });
    if (!outcomeId) return res.status(400).json({ error: 'Missing outcome id' });

    const target = String(req.body?.target || '').trim();
    if (!['task', 'decision', 'initiative'].includes(target)) {
      return res
        .status(400)
        .json({ error: 'Invalid target — must be task, decision, or initiative' });
    }

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title, body, seed_text as "seedText", ai_expansion as "aiExpansion" FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const mapRow = await queryHelpers.queryOne<any>(
      `SELECT id, nodes_json as "nodesJson", edges_json as "edgesJson", version FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!mapRow) return res.status(404).json({ error: 'Idea map not found' });

    let existingNodes: any[] = [];
    let existingEdges: any[] = [];
    try {
      existingNodes =
        typeof mapRow.nodesJson === 'string'
          ? JSON.parse(mapRow.nodesJson)
          : mapRow.nodesJson || [];
      existingEdges =
        typeof mapRow.edgesJson === 'string'
          ? JSON.parse(mapRow.edgesJson)
          : mapRow.edgesJson || [];
    } catch {
      /* keep defaults */
    }

    const outcomeNode = existingNodes.find(
      (n: any) => n.id === outcomeId && (n.kind === 'outcome' || n.type === 'outcome')
    );
    if (!outcomeNode) return res.status(404).json({ error: 'Outcome node not found in graph' });

    const safeTitle = String(outcomeNode.label || idea.title || 'Outcome')
      .trim()
      .slice(0, 255);
    const safeBody = String(idea.body || '').trim();
    const safeExpansion = String(idea.aiExpansion || '').trim();

    const toolSessionId = await createMyWorkToolSession({
      userId,
      orgId,
      sourceType: 'idea',
      sourceId: ideaId,
      title: safeTitle,
      summary: safeExpansion || safeBody,
    });

    let entityId: string | null = null;
    const entityType = target;

    if (target === 'initiative') {
      if (!(await requireTables(res, ['initiatives']))) return;
      const cols = await getTableColumns('initiatives');
      entityId = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [entityId];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };
      add('organization_id', orgId);
      add('name', safeTitle);
      add('summary', (safeExpansion || safeBody).slice(0, 5000) || null);
      add('owner_execution_id', userId);
      add('source_type', 'tool');
      add('source_id', toolSessionId);
      await queryHelpers.queryRun(
        `INSERT INTO initiatives (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
    } else if (target === 'decision') {
      if (!(await requireTables(res, ['decisions']))) return;
      const cols = await getTableColumns('decisions');
      entityId = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [entityId];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };
      add('organization_id', orgId);
      add('title', safeTitle);
      add('description', (safeExpansion || safeBody).slice(0, 12000) || null);
      add('type', 'general');
      add('decision_maker_id', userId);
      add('created_by', userId);
      add('status', 'pending');
      add('source_type', 'idea');
      add('source_id', ideaId);
      await queryHelpers.queryRun(
        `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
    } else if (target === 'task') {
      if (!(await requireTables(res, ['tasks']))) return;
      const cols = await getTableColumns('tasks');
      entityId = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [entityId];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };
      add('organization_id', orgId);
      add('title', safeTitle);
      add(
        'description',
        `Origin idea: ${String(idea.title || '')}\n${safeBody}`.slice(0, 9000) || null
      );
      add('status', 'todo');
      add('priority', 'medium');
      add('assignee_id', userId);
      add('reporter_id', userId);
      add('source_type', 'idea');
      add('source_id', ideaId);
      await queryHelpers.queryRun(
        `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
    }

    if (entityId) {
      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: entityType,
        sourceId: entityId,
        targetType: 'idea',
        targetId: ideaId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
        nodeId: outcomeId,
      });

      const updatedNodes = existingNodes.map((n: any) => {
        if (n.id !== outcomeId) return n;
        return {
          ...n,
          artifactRef: { type: entityType, id: entityId },
          metadata: { ...(n.metadata || {}), convertedAt: new Date().toISOString() },
        };
      });

      const { normalized } = validateAndNormalizeGraph({
        nodes: updatedNodes,
        edges: existingEdges,
      });

      const nextVersion = Number(mapRow.version || 1) + 1;
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `UPDATE my_idea_maps SET nodes_json = ?, edges_json = ?, version = ?, updated_at = ? WHERE idea_id = ? AND user_id = ? AND organization_id = ?`,
        [
          JSON.stringify(normalized.nodes),
          JSON.stringify(normalized.edges),
          nextVersion,
          now,
          ideaId,
          userId,
          orgId,
        ]
      );

      req.emitAuditEvent?.({
        actorType: 'USER',
        action: 'IDEA_OUTCOME_CONVERT',
        resourceType: entityType,
        resourceId: entityId,
        after: { outcomeId, entityType, entityId, ideaId },
      });
    }

    res.json({ entityId, entityType, outcomeId, sourceSessionId: toolSessionId });
  })
);

// ============================================================================
// T009 Enhancement — My Ideas Convert/Promote
// ============================================================================

/**
 * POST /api/my-work/my-ideas/:id/convert
 * Body: { target: 'initiative'|'task_set'|'decision'|'team_chat', options?: {...} }
 */
router.post(
  '/my-ideas/:id/convert',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const ideaId = String(req.params.id || '').trim();
    const target = String(req.body?.target || '').trim();
    const options = (req.body?.options || {}) as Record<string, unknown>;
    const nodeIds = Array.isArray(options?.nodeIds)
      ? (options.nodeIds as string[]).filter((id) => typeof id === 'string' && id.trim())
      : [];

    if (!ideaId) return res.status(400).json({ error: 'Missing idea id' });
    if (
      !['initiative', 'task_set', 'decision', 'team_chat', 'report', 'presentation'].includes(
        target
      )
    ) {
      return res.status(400).json({ error: 'Invalid target' });
    }

    const idea = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        title,
        body,
        tags,
        seed_text as "seedText",
        ai_expansion as "aiExpansion",
        summary_data as "summaryData",
        potential,
        complexity,
        area,
        priority,
        stage,
        promoted_to as "promotedTo",
        promoted_entity_id as "promotedEntityId"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const tags = parseTagsArray(idea?.tags);
    const safeTitle = String(idea?.title || 'Idea').trim() || 'Idea';
    const safeBody = String(idea?.body || '').trim();
    const safeExpansion = String(idea?.aiExpansion || '').trim();

    let summary: any = null;
    try {
      summary = idea?.summaryData
        ? typeof idea.summaryData === 'string'
          ? JSON.parse(idea.summaryData)
          : idea.summaryData
        : null;
    } catch {
      summary = null;
    }
    const nextSteps: string[] = Array.isArray(summary?.nextSteps)
      ? summary.nextSteps.map((s: any) => String(s || '').trim()).filter(Boolean)
      : [];

    const promote = async (promotedTo: string, promotedEntityId: string | null) => {
      await queryHelpers.queryRun(
        `UPDATE my_ideas
         SET promoted_to = ?, promoted_entity_id = ?, stage = 'promoted', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND organization_id = ?`,
        [promotedTo, promotedEntityId, ideaId, userId, orgId]
      );
    };

    // ----- Convert: Initiative -----
    if (target === 'initiative') {
      if (!(await requireTables(res, ['initiatives', 'tool_sessions']))) return;
      const cols = await getTableColumns('initiatives');
      const toolSessionId = await createMyWorkToolSession({
        userId,
        orgId,
        sourceType: 'idea',
        sourceId: ideaId,
        title: safeTitle,
        summary: safeExpansion || safeBody,
      });
      // V3-A01: Traceability guard — abort if MYWORK ToolSession materialization failed
      if (!toolSessionId) {
        return res
          .status(500)
          .json({ error: 'Failed to materialize MYWORK ToolSession for traceability' });
      }

      const initiativeId = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [initiativeId];

      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('name', safeTitle.slice(0, 255));

      // V51-15: When nodeIds provided, enrich summary with selected node labels
      let initSummary = (safeExpansion || safeBody).slice(0, 5000) || null;
      if (nodeIds.length > 0) {
        try {
          const mapRow = await queryHelpers.queryOne<any>(
            `SELECT nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? LIMIT 1`,
            [ideaId, userId]
          );
          const allNodes: any[] = mapRow?.nodes_json ? JSON.parse(mapRow.nodes_json) : [];
          const nodeIdSet = new Set(nodeIds);
          const selectedLabels = allNodes
            .filter((n: any) => nodeIdSet.has(String(n?.id)))
            .map((n: any) => String(n?.data?.label || n?.data?.text || '').trim())
            .filter(Boolean);
          if (selectedLabels.length > 0) {
            initSummary =
              `Selected elements: ${selectedLabels.join(', ')}\n\n${initSummary || ''}`.slice(
                0,
                5000
              );
          }
        } catch {
          /* best-effort */
        }
      }
      add('summary', initSummary);
      add('area', idea?.area ? String(idea.area).slice(0, 120) : null);
      add('owner_execution_id', userId);
      add('owner_business_id', userId);
      add('sponsor_id', userId);
      add('source_type', 'tool');
      add('source_id', toolSessionId);

      await queryHelpers.queryRun(
        `INSERT INTO initiatives (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );

      await promote('initiative', initiativeId);

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'initiative',
        sourceId: initiativeId,
        targetType: 'idea',
        targetId: ideaId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
        nodeId: nodeIds[0] || null,
      });

      return res.json({
        promotedTo: 'initiative',
        promotedEntityId: initiativeId,
        created: { initiativeId },
        sourceSessionId: toolSessionId,
        sourceNodeIds: nodeIds,
      });
    }

    // ----- Convert: Task set -----
    if (target === 'task_set') {
      if (!(await requireTables(res, ['tasks', 'tool_sessions']))) return;
      const cols = await getTableColumns('tasks');
      const toolSessionId = await createMyWorkToolSession({
        userId,
        orgId,
        sourceType: 'idea',
        sourceId: ideaId,
        title: safeTitle,
        summary: safeExpansion || safeBody,
      });

      // V51-15: When nodeIds provided, use selected nodes' labels as task titles
      let steps: string[];
      if (nodeIds.length > 0) {
        try {
          const mapRow = await queryHelpers.queryOne<any>(
            `SELECT nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? LIMIT 1`,
            [ideaId, userId]
          );
          const allNodes: any[] = mapRow?.nodes_json ? JSON.parse(mapRow.nodes_json) : [];
          const nodeIdSet = new Set(nodeIds);
          const selectedLabels = allNodes
            .filter((n: any) => nodeIdSet.has(String(n?.id)))
            .map((n: any) => String(n?.data?.label || n?.data?.text || '').trim())
            .filter(Boolean);
          steps = selectedLabels.length > 0 ? selectedLabels.slice(0, 20) : [safeTitle];
        } catch {
          steps = nextSteps.length > 0 ? nextSteps.slice(0, 20) : [safeTitle];
        }
      } else {
        steps = nextSteps.length > 0 ? nextSteps.slice(0, 20) : [safeTitle];
      }
      const taskIds: string[] = [];

      const baseTags = Array.from(new Set([`idea:${ideaId}`, ...tags].filter(Boolean)));

      for (const step of steps) {
        const taskId = uuidv4();
        taskIds.push(taskId);

        const insertCols: string[] = ['id'];
        const insertVals: string[] = ['?'];
        const insertParams: any[] = [taskId];
        const add = (col: string, val: any) => {
          if (!cols.has(col)) return;
          insertCols.push(col);
          insertVals.push('?');
          insertParams.push(val);
        };

        add('organization_id', orgId);
        add('title', String(step).slice(0, 255) || safeTitle.slice(0, 255));
        add(
          'description',
          [
            `Origin idea: ${safeTitle}`,
            safeBody ? `\n${safeBody}` : null,
            safeExpansion ? `\nAI expansion:\n${safeExpansion}` : null,
          ]
            .filter(Boolean)
            .join('\n')
            .slice(0, 9000)
        );
        add('status', 'todo');
        add('priority', 'medium');
        add('assignee_id', userId);
        add('reporter_id', userId);
        add('tags', JSON.stringify(baseTags));
        add('task_type', 'personal');
        add('source_type', 'idea');
        add('source_id', ideaId);

        await queryHelpers.queryRun(
          `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );

        await linkGraphAddEdge({
          orgId,
          userId,
          sourceType: 'task',
          sourceId: taskId,
          targetType: 'idea',
          targetId: ideaId,
          relation: 'ref',
          containerType: 'mywork_convert',
          containerId: toolSessionId,
        });
        await linkGraphAddEdge({
          orgId,
          userId,
          sourceType: 'task',
          sourceId: taskId,
          targetType: 'tool_session',
          targetId: toolSessionId,
          relation: 'ref',
          containerType: 'mywork_convert',
          containerId: toolSessionId,
        });
      }

      await promote('task_set', JSON.stringify(taskIds));

      return res.json({
        promotedTo: 'task_set',
        promotedEntityId: JSON.stringify(taskIds),
        created: { taskIds },
        sourceSessionId: toolSessionId,
      });
    }

    // ----- Convert: Decision -----
    if (target === 'decision') {
      if (!(await requireTables(res, ['decisions', 'tool_sessions']))) return;
      const cols = await getTableColumns('decisions');
      const toolSessionId = await createMyWorkToolSession({
        userId,
        orgId,
        sourceType: 'idea',
        sourceId: ideaId,
        title: safeTitle,
        summary: safeExpansion || safeBody,
      });

      const decisionId = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [decisionId];

      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('title', safeTitle.slice(0, 255));
      add(
        'description',
        [
          safeBody ? `Idea:\n${safeBody}` : null,
          safeExpansion ? `\nAI expansion:\n${safeExpansion}` : null,
          summary?.verdict ? `\nSummary:\n${String(summary.verdict)}` : null,
          nextSteps.length ? `\nNext steps:\n- ${nextSteps.join('\n- ')}` : null,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 12000)
      );
      add('type', 'general');
      add('decision_maker_id', userId);
      add('created_by', userId);
      add('status', 'pending');
      add('source_type', 'idea');
      add('source_id', ideaId);

      await queryHelpers.queryRun(
        `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );

      await promote('decision', decisionId);

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'decision',
        sourceId: decisionId,
        targetType: 'idea',
        targetId: ideaId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });
      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'decision',
        sourceId: decisionId,
        targetType: 'tool_session',
        targetId: toolSessionId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });

      return res.json({
        promotedTo: 'decision',
        promotedEntityId: decisionId,
        created: { decisionId },
        sourceSessionId: toolSessionId,
      });
    }

    // ----- Convert: Report -----
    if (target === 'report') {
      const reportsTbl = await getTableColumns('reports');
      if (!reportsTbl || reportsTbl.size === 0) {
        return res.status(501).json({ error: 'Reports table not available' });
      }
      const toolSessionId = await createMyWorkToolSession({
        userId,
        orgId,
        sourceType: 'idea',
        sourceId: ideaId,
        title: safeTitle,
        summary: safeExpansion || safeBody,
      });

      const reportId = uuidv4();
      const now = new Date().toISOString();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [reportId];
      const add = (col: string, val: any) => {
        if (!reportsTbl.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('user_id', userId);
      add('created_by', userId);
      add('title', safeTitle.slice(0, 255));
      add(
        'description',
        [
          safeBody ? `Idea:\n${safeBody}` : null,
          safeExpansion ? `\nAI expansion:\n${safeExpansion}` : null,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 12000)
      );
      add('status', 'draft');
      add('source_type', 'idea');
      add('source_id', ideaId);
      add('tags', JSON.stringify(tags));
      add('created_at', now);
      add('updated_at', now);

      await queryHelpers.queryRun(
        `INSERT INTO reports (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );

      await promote('report', reportId);

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'report',
        sourceId: reportId,
        targetType: 'idea',
        targetId: ideaId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });

      return res.json({
        promotedTo: 'report',
        promotedEntityId: reportId,
        outputId: reportId,
        created: { reportId },
        sourceSessionId: toolSessionId,
      });
    }

    // ----- Convert: Presentation -----
    if (target === 'presentation') {
      const presTbl = await getTableColumns('presentations');
      if (!presTbl || presTbl.size === 0) {
        return res.status(501).json({ error: 'Presentations table not available' });
      }
      const toolSessionId = await createMyWorkToolSession({
        userId,
        orgId,
        sourceType: 'idea',
        sourceId: ideaId,
        title: safeTitle,
        summary: safeExpansion || safeBody,
      });

      const presId = uuidv4();
      const now = new Date().toISOString();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [presId];
      const add = (col: string, val: any) => {
        if (!presTbl.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('user_id', userId);
      add('created_by', userId);
      add('title', safeTitle.slice(0, 255));
      add(
        'description',
        [
          safeBody ? `Idea:\n${safeBody}` : null,
          safeExpansion ? `\nAI expansion:\n${safeExpansion}` : null,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 12000)
      );
      add('status', 'draft');
      add('source_type', 'idea');
      add('source_id', ideaId);
      add('tags', JSON.stringify(tags));
      add('created_at', now);
      add('updated_at', now);

      await queryHelpers.queryRun(
        `INSERT INTO presentations (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );

      await promote('presentation', presId);

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'presentation',
        sourceId: presId,
        targetType: 'idea',
        targetId: ideaId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });

      return res.json({
        promotedTo: 'presentation',
        promotedEntityId: presId,
        outputId: presId,
        created: { presentationId: presId },
        sourceSessionId: toolSessionId,
      });
    }

    // ----- Convert: Team chat -----
    if (target === 'team_chat') {
      if (!(await requireTables(res, ['chat_projects', 'conversations', 'conversation_messages'])))
        return;

      const chatProjectIdOpt =
        typeof options?.chatProjectId === 'string' ? options.chatProjectId : null;
      let chatProjectId: string | null = chatProjectIdOpt;

      if (!chatProjectId) {
        const existingTeamProject = await queryHelpers.queryOne<any>(
          `SELECT id FROM chat_projects WHERE organization_id = ? AND scope = 'team' ORDER BY updated_at DESC LIMIT 1`,
          [orgId]
        );
        chatProjectId = existingTeamProject?.id ? String(existingTeamProject.id) : null;
      }

      if (!chatProjectId) {
        const cpCols = await getTableColumns('chat_projects');
        const newProjectId = uuidv4();
        const now = new Date().toISOString();

        const insertCols: string[] = ['id'];
        const insertVals: string[] = ['?'];
        const insertParams: any[] = [newProjectId];
        const add = (col: string, val: any) => {
          if (!cpCols.has(col)) return;
          insertCols.push(col);
          insertVals.push('?');
          insertParams.push(val);
        };

        add('user_id', userId);
        add('organization_id', orgId);
        add('name', 'Team Ideas');
        add('description', 'Ideas shared for team discussion');
        add('color', '#8b5cf6');
        add('icon', 'sparkles');
        add('scope', 'team');
        add('created_at', now);
        add('updated_at', now);

        await queryHelpers.queryRun(
          `INSERT INTO chat_projects (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );
        chatProjectId = newProjectId;
      }

      const convCols = await getTableColumns('conversations');
      const conversationId = uuidv4();
      const now = new Date().toISOString();

      const convInsertCols: string[] = ['id'];
      const convInsertVals: string[] = ['?'];
      const convInsertParams: any[] = [conversationId];
      const addConv = (col: string, val: any) => {
        if (!convCols.has(col)) return;
        convInsertCols.push(col);
        convInsertVals.push('?');
        convInsertParams.push(val);
      };

      addConv('user_id', userId);
      addConv('organization_id', orgId);
      addConv('chat_project_id', chatProjectId);
      addConv('created_by', userId);
      addConv('title', safeTitle.slice(0, 255));
      addConv('title_source', 'user');
      addConv('tags', JSON.stringify(['idea', 'my_work']));
      addConv('pmo_context', JSON.stringify({ ideaId }));
      addConv('language', typeof options?.language === 'string' ? String(options.language) : 'en');
      addConv('created_at', now);
      addConv('updated_at', now);

      await queryHelpers.queryRun(
        `INSERT INTO conversations (${convInsertCols.join(', ')}) VALUES (${convInsertVals.join(', ')})`,
        convInsertParams
      );

      const msgCols = await getTableColumns('conversation_messages');
      const messageId = uuidv4();

      const content = [
        `Idea: ${safeTitle}`,
        safeBody ? `\n${safeBody}` : null,
        safeExpansion ? `\nAI expansion:\n${safeExpansion}` : null,
        summary?.verdict ? `\nAI verdict:\n${String(summary.verdict)}` : null,
        nextSteps.length ? `\nNext steps:\n- ${nextSteps.join('\n- ')}` : null,
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 12000);

      const msgInsertCols: string[] = ['id'];
      const msgInsertVals: string[] = ['?'];
      const msgInsertParams: any[] = [messageId];
      const addMsg = (col: string, val: any) => {
        if (!msgCols.has(col)) return;
        msgInsertCols.push(col);
        msgInsertVals.push('?');
        msgInsertParams.push(val);
      };

      addMsg('conversation_id', conversationId);
      addMsg('role', 'user');
      addMsg('content', content || `Idea: ${safeTitle}`);
      addMsg('message_type', 'text');
      addMsg('metadata', JSON.stringify({ origin: 'my_ideas', ideaId }));
      addMsg('author_user_id', userId);
      addMsg('created_at', now);

      await queryHelpers.queryRun(
        `INSERT INTO conversation_messages (${msgInsertCols.join(', ')}) VALUES (${msgInsertVals.join(', ')})`,
        msgInsertParams
      );

      // Best-effort metadata update for list previews (if columns exist)
      const setParts: string[] = [];
      const setParams: any[] = [];
      const setIf = (col: string, val: any) => {
        if (!convCols.has(col)) return;
        setParts.push(`${col} = ?`);
        setParams.push(val);
      };
      setIf('message_count', 1);
      setIf('last_message_preview', String(content || '').slice(0, 200));
      setIf('last_message_at', now);
      setIf('updated_at', now);
      if (setParts.length) {
        await queryHelpers.queryRun(
          `UPDATE conversations SET ${setParts.join(', ')} WHERE id = ?`,
          [...setParams, conversationId]
        );
      }

      await promote('team_chat', conversationId);

      return res.json({
        promotedTo: 'team_chat',
        promotedEntityId: conversationId,
        created: { conversationId, chatProjectId },
      });
    }
  })
);

// ============================================================================
// T009 Enhancement — AI Idea Incubator (develop endpoint)
// ============================================================================

router.post(
  '/my-ideas/:id/develop',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const { id } = req.params;
    const existing = await queryHelpers.queryOne<any>(
      `SELECT * FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [id, userId, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Idea not found' });

    const seedText = String(req.body.seedText || existing.body || existing.title || '').trim();
    if (!seedText) return res.status(400).json({ error: 'Seed text is required' });
    const language = String(req.body.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    // SSE setup
    if (req.socket) {
      req.socket.setTimeout(120_000);
      req.socket.setNoDelay(true);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (type: string, data: any) => {
      try {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      } catch {}
    };

    emit('stage', {
      stage: 'expanding',
      label: isPl ? 'Rozwijam Twój pomysł...' : 'Expanding your idea...',
    });

    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      // STAGE 1: AI Expansion
      const expansionPrompt = isPl
        ? `Jesteś kreatywnym konsultantem strategicznym. Użytkownik ma pomysł:\n\n"${seedText}"\n\nRozwiń ten pomysł w 3-4 akapitach. Opisz:\n1. Na czym dokładnie polega ten pomysł\n2. Jaką wartość przyniesie\n3. Jak mógłby wyglądać w praktyce\n4. Co czyni go wyjątkowym\n\nBądź entuzjastyczny ale rzeczowy. Pisz po polsku.`
        : `You are a creative strategic consultant. The user has an idea:\n\n"${seedText}"\n\nExpand this idea in 3-4 paragraphs. Describe:\n1. What exactly this idea entails\n2. What value it would bring\n3. How it could look in practice\n4. What makes it unique\n\nBe enthusiastic but grounded.`;

      const expansionResult = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Jesteś kreatywnym partnerem do rozwoju pomysłów.'
          : 'You are a creative idea development partner.',
        messages: [{ role: 'user', content: expansionPrompt }],
      });
      const aiExpansion = String((expansionResult as any)?.content || '');
      emit('expansion', { content: aiExpansion });

      // Save expansion to DB
      await queryHelpers.queryRun(
        `UPDATE my_ideas SET seed_text = ?, ai_expansion = ?, stage = 'expanding', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [seedText, aiExpansion, id, userId]
      );

      // STAGE 2: Web Research
      emit('stage', {
        stage: 'researching',
        label: isPl ? 'Szukam informacji w sieci...' : 'Researching the web...',
      });

      let researchResults: any[] = [];
      try {
        const tavilyKey = process.env.TAVILY_API_KEY;
        if (tavilyKey) {
          const { TavilyWebSearchService } =
            await import('../services/ai/tavilyWebSearchService.js');
          const tavily = new (TavilyWebSearchService as any)(tavilyKey);

          const searchQuery = aiExpansion.split('\n').slice(0, 2).join(' ').slice(0, 200);
          const searchRes = await tavily.search(searchQuery, {
            maxResults: 5,
            searchDepth: 'advanced',
          });
          researchResults = (searchRes?.results || []).map((r: any) => ({
            title: String(r?.title || '').slice(0, 200),
            url: String(r?.url || ''),
            snippet: String(r?.content || '').slice(0, 400),
          }));
          emit('research', { results: researchResults, answer: searchRes?.answer || null });
        }
      } catch (err: any) {
        logger.warn('[IdeaDevelop] Web search failed:', err?.message);
        emit('research', { results: [], answer: null, error: 'Web search unavailable' });
      }

      // Save research
      await queryHelpers.queryRun(
        `UPDATE my_ideas SET research_data = ?, stage = 'researching', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(researchResults), id]
      );

      // STAGE 3: Creative Proposals
      emit('stage', {
        stage: 'proposing',
        label: isPl ? 'Generuję kreatywne propozycje...' : 'Generating creative proposals...',
      });

      const researchContext = researchResults.map((r) => `- ${r.title}: ${r.snippet}`).join('\n');
      const proposalsPrompt = isPl
        ? `Na podstawie pomysłu użytkownika i badań, zaproponuj 4 kreatywne warianty/rozszerzenia.\n\nPomysł: "${seedText}"\n\nRozwinięcie:\n${aiExpansion}\n\nBadania:\n${researchContext}\n\nDla każdego wariantu podaj:\n- Tytuł (krótki, chwytliwy)\n- Opis (2-3 zdania)\n- Dlaczego warto (1 zdanie)\n\nOdpowiedz jako JSON array: [{"title":"...","description":"...","whyItMatters":"..."}]\nTylko JSON, bez markdown.`
        : `Based on the user's idea and research, propose 4 creative variants/extensions.\n\nIdea: "${seedText}"\n\nExpansion:\n${aiExpansion}\n\nResearch:\n${researchContext}\n\nFor each variant provide:\n- Title (short, catchy)\n- Description (2-3 sentences)\n- Why it matters (1 sentence)\n\nRespond as JSON array: [{"title":"...","description":"...","whyItMatters":"..."}]\nOnly JSON, no markdown.`;

      const proposalsResult = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Jesteś kreatywnym generatorem pomysłów. Odpowiadasz tylko poprawnym JSON.'
          : 'You are a creative idea generator. You respond only with valid JSON.',
        messages: [{ role: 'user', content: proposalsPrompt }],
      });

      let proposals: any[] = [];
      try {
        const raw = String((proposalsResult as any)?.content || '[]');
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        proposals = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
      } catch {
        proposals = [];
      }

      emit('proposals', { proposals });

      await queryHelpers.queryRun(
        `UPDATE my_ideas SET creative_proposals = ?, stage = 'proposing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(proposals), id]
      );

      // STAGE 4: Summary
      emit('stage', {
        stage: 'summary',
        label: isPl ? 'Tworzę podsumowanie...' : 'Creating summary...',
      });

      const summaryPrompt = isPl
        ? `Podsumuj ten pomysł jako kreatywny konsultant.\n\nPomysł: "${seedText}"\nRozwinięcie: ${aiExpansion.slice(0, 500)}\nPropozycje: ${proposals.map((p) => p.title).join(', ')}\n\nOdpowiedz jako JSON:\n{"verdict":"...(1-2 zdania entuzjastycznej oceny)","potential":"high|medium|low","complexity":"low|medium|high","timeToValue":"...(np. 2-4 tygodnie)","nextSteps":["krok1","krok2","krok3"]}\nTylko JSON.`
        : `Summarize this idea as a creative consultant.\n\nIdea: "${seedText}"\nExpansion: ${aiExpansion.slice(0, 500)}\nProposals: ${proposals.map((p) => p.title).join(', ')}\n\nRespond as JSON:\n{"verdict":"...(1-2 sentence enthusiastic assessment)","potential":"high|medium|low","complexity":"low|medium|high","timeToValue":"...(e.g. 2-4 weeks)","nextSteps":["step1","step2","step3"]}\nOnly JSON.`;

      const summaryResult = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Jesteś pozytywnym konsultantem strategicznym. Odpowiadasz JSON.'
          : 'You are a positive strategic consultant. You respond with JSON.',
        messages: [{ role: 'user', content: summaryPrompt }],
      });

      let summary: any = {};
      try {
        const raw = String((summaryResult as any)?.content || '{}');
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        summary = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
      } catch {
        summary = {
          verdict: '',
          potential: 'medium',
          complexity: 'medium',
          timeToValue: '?',
          nextSteps: [],
        };
      }

      emit('summary', { summary });

      // Auto-priority: calculate from AI assessment
      let autoPriority = 50;
      const pot = summary.potential || 'medium';
      const cmplx = summary.complexity || 'medium';
      if (pot === 'high') autoPriority += 25;
      else if (pot === 'low') autoPriority -= 15;
      if (cmplx === 'low') autoPriority += 10;
      else if (cmplx === 'high') autoPriority -= 5;
      if (proposals.length >= 3) autoPriority += 5;
      if (researchResults.length >= 3) autoPriority += 5;
      autoPriority = Math.max(10, Math.min(100, autoPriority));

      // Auto-detect area from content
      let autoArea: string | null = null;
      const allText = `${seedText} ${aiExpansion}`.toLowerCase();
      if (/strateg|vision|roadmap|competitive/.test(allText)) autoArea = 'strategy';
      else if (/product|feature|ux|user experience|interface/.test(allText)) autoArea = 'product';
      else if (/process|workflow|operations|efficiency|automat/.test(allText)) autoArea = 'process';
      else if (/culture|team|hr|hiring|talent|wellbeing/.test(allText)) autoArea = 'culture';
      else if (/tech|architecture|infra|devops|security|code/.test(allText)) autoArea = 'tech';
      else if (/growth|market|sales|revenue|customer|acqui/.test(allText)) autoArea = 'growth';

      await queryHelpers.queryRun(
        `UPDATE my_ideas
         SET summary_data = ?, potential = ?, complexity = ?, stage = 'ready', priority = ?, area = COALESCE(area, ?), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [JSON.stringify(summary), pot, cmplx, autoPriority, autoArea, id]
      );

      emit('done', { stage: 'ready', priority: autoPriority, area: autoArea });
      res.end();
    } catch (err: any) {
      logger.error('[IdeaDevelop] Error:', err);
      emit('error', { message: err?.message || 'Development failed' });
      res.end();
    }
  })
);

// ============================================================================
// T011 — Notebook (backend persistence)
// ============================================================================

type NotebookVisibility = 'private' | 'project';

const safeJsonString = (v: unknown, fallback: string) => {
  if (typeof v === 'string') {
    try {
      JSON.parse(v);
      return v;
    } catch {
      // fall through
    }
  }
  try {
    return JSON.stringify(v ?? JSON.parse(fallback));
  } catch {
    return fallback;
  }
};

const canAccessNotebookRow = async (
  userId: string,
  orgId: string,
  row: {
    owner_user_id?: string;
    ownerUserId?: string;
    organization_id?: string;
    organizationId?: string;
    visibility?: string;
    project_id?: string;
    projectId?: string | null;
  }
): Promise<boolean> => {
  if (!row) return false;
  if (String(row.organization_id ?? row.organizationId ?? '') !== String(orgId)) return false;
  const owner = String(row.owner_user_id ?? row.ownerUserId ?? '');
  const vis = String(row.visibility || 'private').toLowerCase() as NotebookVisibility;
  const projectId = row.project_id ? String(row.project_id) : row.projectId ? String(row.projectId) : null;

  if (owner === userId) return true;
  if (vis !== 'project' || !projectId) return false;

  const pm = await queryHelpers.queryOne<{ ok: number }>(
    `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
    [projectId, userId]
  );
  return Boolean((pm as any)?.ok);
};

const parseCaptureMetadata = (raw: string | null | undefined) =>
  toPublicNotebookCaptureMetadata(raw);
const parseAttachments = (raw: string | null | undefined) => toPublicNotebookAttachments(raw);

/**
 * GET /api/my-work/notebook/pages?projectId?&q?&status?&pinned?&sort?&limit?&offset?
 */
router.get(
  '/notebook/pages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const statusFilter = req.query.status ? String(req.query.status).trim().toLowerCase() : '';
    const pinnedFilter = req.query.pinned !== undefined ? String(req.query.pinned) : '';
    const sortParam = req.query.sort ? String(req.query.sort).trim().toLowerCase() : 'updated';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
    const offsetRaw = Number(req.query.offset);
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const where: string[] = ['np.organization_id = ?'];
    const params: any[] = [orgId];

    if (projectId) {
      where.push('np.project_id = ?');
      params.push(projectId);
    }

    if (statusFilter && ['inbox', 'active', 'converted', 'archived'].includes(statusFilter)) {
      where.push("lower(coalesce(np.status, 'active')) = ?");
      params.push(statusFilter);
    }

    if (pinnedFilter === '1') {
      where.push('np.pinned = 1');
    } else if (pinnedFilter === '0') {
      where.push('(np.pinned = 0 OR np.pinned IS NULL)');
    }

    if (q) {
      const isPg = process.env.DB_TYPE === 'postgres';
      if (isPg) {
        // V4-NOTE-03: FTS on Postgres (search_vector from migration 627)
        const ftsQuery = q.replace(/'/g, "''").trim();
        where.push(`np.search_vector @@ plainto_tsquery('simple', ?)`);
        params.push(ftsQuery);
      } else {
        where.push(
          `(lower(np.title) LIKE ? OR lower(coalesce(np.content_text,'')) LIKE ? OR lower(coalesce(np.tags_json,'')) LIKE ?)`
        );
        const like = `%${q}%`;
        params.push(like, like, like);
      }
    }

    const orderClauses: Record<string, string> = {
      updated: 'np.pinned DESC, np.updated_at DESC',
      created: 'np.pinned DESC, np.created_at DESC',
      title: 'np.pinned DESC, np.title ASC',
    };
    const orderBy = orderClauses[sortParam] || orderClauses.updated;

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          np.id,
          np.owner_user_id as "ownerUserId",
          np.organization_id as "organizationId",
          np.project_id as "projectId",
          np.visibility,
          np.title,
          np.content_json as "contentJson",
          np.content_text as "contentText",
          np.tags_json as tags,
          np.maturity,
          np.icon,
          np.summary,
          coalesce(np.status, 'active') as status,
          coalesce(np.pinned, 0) as pinned,
          coalesce(np.verification_status, 'unverified') as verificationStatus,
          coalesce(np.review_cadence, 'monthly') as reviewCadence,
          np.stale_at as staleAt,
          np.last_reviewed_at as lastReviewedAt,
          np.capture_source as "captureSource",
          np.capture_metadata as "captureMetadataJson",
          np.attachments_json as "attachmentsJson",
          np.converted_to_json as "convertedToJson",
          np.created_at as "createdAt",
          np.updated_at as "updatedAt"
        FROM notebook_pages np
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy}
      `,
        params
      )) || [];

    const accessibleRows: any[] = [];
    for (const row of rows) {
      if (await canAccessNotebookRow(userId, orgId, row)) {
        accessibleRows.push(row);
      }
    }
    const pagedRows = accessibleRows.slice(offset, offset + limit);

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };
    res.json(
      pagedRows.map((r: any) => ({
        ...r,
        tags: parseTagsArray(r.tags),
        pinned: Boolean(r.pinned),
        captureSource: r.captureSource ?? null,
        captureMetadata: parseCaptureMetadata(r.captureMetadataJson),
        attachments: parseAttachments(r.attachmentsJson),
        convertedTo: parseConvertedTo(r.convertedToJson),
        convertedToJson: undefined,
        captureMetadataJson: undefined,
        attachmentsJson: undefined,
        contentJson: (() => {
          try {
            return r.contentJson ? JSON.parse(r.contentJson) : { type: 'doc', content: [] };
          } catch {
            return { type: 'doc', content: [] };
          }
        })(),
      }))
    );
  })
);

/**
 * POST /api/my-work/notebook/pages
 */
router.post(
  '/notebook/pages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'title is required' });

    const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    const visibility = (
      req.body?.visibility
        ? String(req.body.visibility).toLowerCase()
        : projectId
          ? 'project'
          : 'private'
    ) as NotebookVisibility;

    if (visibility === 'project' && !projectId) {
      return res.status(400).json({ error: 'projectId is required for visibility=project' });
    }

    // If creating a project-visible note, require membership
    if (visibility === 'project' && projectId) {
      const pm = await queryHelpers.queryOne<{ ok: number }>(
        `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
        [projectId, userId]
      );
      if (!pm) return res.status(403).json({ error: 'Not a project member' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const tags = JSON.stringify(parseTagsArray(req.body?.tags));
    const contentJson = safeJsonString(
      req.body?.contentJson,
      JSON.stringify({ type: 'doc', content: [] })
    );
    const contentText = typeof req.body?.contentText === 'string' ? req.body.contentText : null;
    const icon = typeof req.body?.icon === 'string' ? req.body.icon : null;
    const maturity = typeof req.body?.maturity === 'string' ? req.body.maturity : 'seed';
    const status =
      typeof req.body?.status === 'string' && ['inbox', 'active'].includes(req.body.status)
        ? req.body.status
        : 'active';

    await queryHelpers.queryRun(
      `INSERT INTO notebook_pages
        (id, owner_user_id, organization_id, project_id, visibility, title, content_json, content_text, tags_json, icon, maturity, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        orgId,
        projectId,
        visibility,
        title,
        contentJson,
        contentText,
        tags,
        icon,
        maturity,
        status,
        now,
        now,
      ]
    );

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id as "ownerUserId",
        organization_id as "organizationId",
        project_id as "projectId",
        visibility,
        title,
        content_json as "contentJson",
        content_text as "contentText",
        tags_json as tags,
        maturity,
        icon,
        summary,
        coalesce(status, 'active') as status,
        coalesce(pinned, 0) as pinned,
        capture_source as "captureSource",
        capture_metadata as "captureMetadataJson",
        attachments_json as "attachmentsJson",
        converted_to_json as "convertedToJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };
    res.status(201).json({
      ...row,
      tags: parseTagsArray((row as any)?.tags),
      pinned: Boolean(row?.pinned),
      captureSource: row?.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
      attachments: parseAttachments(row?.attachmentsJson),
      convertedTo: parseConvertedTo(row?.convertedToJson),
      convertedToJson: undefined,
      captureMetadataJson: undefined,
      attachmentsJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

// V4-NOTE-01: Capture connector — upload PDF/XLSX/TXT → extract text → create notebook page
const notebookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'text/markdown' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel';
    if (ok) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF, XLSX, TXT, MD allowed'));
  },
});
const notebookAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

router.post(
  '/notebook/upload',
  notebookUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'File required (PDF, XLSX, TXT, MD)' });

    let captureResult: { pageId: string };
    try {
      captureResult = await notebookService.capture(orgId, userId, {
        source: 'upload',
        fileBuffer: file.buffer,
        fileMimetype: file.mimetype,
        fileOriginalname: file.originalname,
      });
    } catch (e: any) {
      logger.warn('[MyWork] Notebook upload capture failed:', e?.message);
      return res.status(422).json({ error: 'File extraction failed', detail: e?.message });
    }

    const row = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id as "ownerUserId", organization_id as "organizationId", project_id as "projectId",
        visibility, title, content_json as "contentJson", content_text as "contentText", tags_json as tags,
        maturity, icon, summary, coalesce(status, 'active') as status, coalesce(pinned, 0) as pinned,
        capture_source as "captureSource", capture_metadata as "captureMetadataJson",
        attachments_json as "attachmentsJson",
        converted_to_json as "convertedToJson", created_at as "createdAt", updated_at as "updatedAt"
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [captureResult.pageId]
    );
    const parseCT = (r: any) =>
      r?.convertedToJson
        ? (() => {
            try {
              return JSON.parse(r.convertedToJson);
            } catch {
              return null;
            }
          })()
        : null;
    res.status(201).json({
      ...row,
      tags: parseTagsArray((row as any)?.tags),
      pinned: false,
      captureSource: row?.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
      attachments: parseAttachments(row?.attachmentsJson),
      convertedTo: parseCT(row),
      captureMetadataJson: undefined,
      attachmentsJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch (_) {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

/**
 * GET /api/my-work/notebook/pages/:id
 */
router.get(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id,
        organization_id,
        project_id,
        visibility,
        title,
        content_json as "contentJson",
        content_text as "contentText",
        tags_json as tags,
        maturity,
        icon,
        summary,
        coalesce(status, 'active') as status,
        coalesce(pinned, 0) as pinned,
        coalesce(verification_status, 'unverified') as verificationStatus,
        coalesce(review_cadence, 'monthly') as reviewCadence,
        stale_at as staleAt,
        last_reviewed_at as lastReviewedAt,
        capture_source as "captureSource",
        capture_metadata as "captureMetadataJson",
        attachments_json as "attachmentsJson",
        converted_to_json as "convertedToJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!(await canAccessNotebookRow(userId, orgId, row)))
      return res.status(403).json({ error: 'Forbidden' });

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };
    res.json({
      id: row.id,
      projectId: row.project_id || null,
      visibility: row.visibility,
      title: row.title,
      contentText: row.contentText,
      tags: parseTagsArray(row.tags),
      maturity: row.maturity || 'seed',
      icon: row.icon || null,
      summary: row.summary || null,
      status: row.status,
      pinned: Boolean(row.pinned),
      verificationStatus: row.verificationStatus ?? 'unverified',
      reviewCadence: row.reviewCadence ?? 'monthly',
      staleAt: row.staleAt ?? null,
      lastReviewedAt: row.lastReviewedAt ?? null,
      captureSource: row.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row.captureMetadataJson),
      attachments: parseAttachments(row.attachmentsJson),
      convertedTo: parseConvertedTo(row.convertedToJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

router.get(
  '/notebook/pages/:id/source-file',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id,
        organization_id,
        project_id,
        visibility,
        capture_source as "captureSource",
        capture_metadata as "captureMetadataJson"
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!(await canAccessNotebookRow(userId, orgId, row)))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(row.captureSource || '').toLowerCase() !== 'upload') {
      return res.status(404).json({ error: 'Source file not found' });
    }

    const storedFile = await resolveStoredNotebookSourceFile(row.captureMetadataJson);
    if (!storedFile) {
      return res.status(404).json({ error: 'Source file not found' });
    }

    res.setHeader('Content-Type', storedFile.mimeType || 'application/octet-stream');
    return res.download(storedFile.filePath, storedFile.fileName);
  })
);

router.post(
  '/notebook/pages/:id/attachments',
  notebookAttachmentUpload.array('files', 10),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const files = ((req.files as Express.Multer.File[] | undefined) || []).filter(Boolean);
    if (files.length === 0) return res.status(400).json({ error: 'Files required' });

    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, attachments_json as "attachmentsJson"
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    try {
      await addNotebookAttachmentsToPage({
        organizationId: orgId,
        pageId: id,
        files: files.map((file) => ({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        })),
        userId,
      });
    } catch (error) {
      return res.status(error instanceof NotebookAttachmentMutationError ? error.status : 400).json({
        error: error instanceof Error ? error.message : 'Attachment upload failed',
        code:
          error instanceof NotebookAttachmentMutationError
            ? error.code
            : 'NOTEBOOK_ATTACHMENT_UPLOAD_FAILED',
      });
    }

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id as "ownerUserId",
        organization_id as "organizationId",
        project_id as "projectId",
        visibility,
        title,
        content_json as "contentJson",
        content_text as "contentText",
        tags_json as tags,
        maturity,
        icon,
        summary,
        coalesce(status, 'active') as status,
        coalesce(pinned, 0) as pinned,
        coalesce(verification_status, 'unverified') as verificationStatus,
        coalesce(review_cadence, 'monthly') as reviewCadence,
        stale_at as staleAt,
        last_reviewed_at as lastReviewedAt,
        capture_source as "captureSource",
        capture_metadata as "captureMetadataJson",
        attachments_json as "attachmentsJson",
        converted_to_json as "convertedToJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );

    const parseCT = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    return res.status(201).json({
      ...row,
      tags: parseTagsArray(row?.tags),
      pinned: Boolean(row?.pinned),
      verificationStatus: row?.verificationStatus ?? 'unverified',
      reviewCadence: row?.reviewCadence ?? 'monthly',
      staleAt: row?.staleAt ?? null,
      lastReviewedAt: row?.lastReviewedAt ?? null,
      captureSource: row?.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
      attachments: parseAttachments(row?.attachmentsJson),
      convertedTo: parseCT(row?.convertedToJson),
      convertedToJson: undefined,
      captureMetadataJson: undefined,
      attachmentsJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

router.get(
  '/notebook/pages/:id/attachments/:attachmentId/download',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const attachmentId = String(req.params.attachmentId || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, project_id, visibility, attachments_json as "attachmentsJson"
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!(await canAccessNotebookRow(userId, orgId, row)))
      return res.status(403).json({ error: 'Forbidden' });

    const storedFile = await resolveNotebookAttachmentFile(row.attachmentsJson, attachmentId);
    if (!storedFile) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    res.setHeader('Content-Type', storedFile.mimeType || 'application/octet-stream');
    return res.download(storedFile.filePath, storedFile.fileName);
  })
);

router.delete(
  '/notebook/pages/:id/attachments/:attachmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const attachmentId = String(req.params.attachmentId || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, attachments_json as "attachmentsJson"
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    if (!parseNotebookAttachments(existing.attachmentsJson).some((attachment) => attachment.id === attachmentId)) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    try {
      await removeNotebookAttachmentFromPage({
        pageId: id,
        attachmentId,
      });
    } catch (error) {
      return res.status(error instanceof NotebookAttachmentMutationError ? error.status : 400).json({
        error: error instanceof Error ? error.message : 'Attachment delete failed',
        code:
          error instanceof NotebookAttachmentMutationError
            ? error.code
            : 'NOTEBOOK_ATTACHMENT_DELETE_FAILED',
      });
    }

    const selectNotebookFull = `
      SELECT
        id,
        owner_user_id as "ownerUserId",
        organization_id as "organizationId",
        project_id as "projectId",
        visibility,
        title,
        content_json as "contentJson",
        content_text as "contentText",
        tags_json as tags,
        maturity,
        icon,
        summary,
        coalesce(status, 'active') as status,
        coalesce(pinned, 0) as pinned,
        coalesce(verification_status, 'unverified') as verificationStatus,
        coalesce(review_cadence, 'monthly') as reviewCadence,
        stale_at as staleAt,
        last_reviewed_at as lastReviewedAt,
        capture_source as "captureSource",
        capture_metadata as "captureMetadataJson",
        attachments_json as "attachmentsJson",
        converted_to_json as "convertedToJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM notebook_pages WHERE id = ? LIMIT 1`;
    const row = await queryHelpers.queryOne<any>(selectNotebookFull, [id]);
    const parseCT = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    return res.json({
      ...row,
      tags: parseTagsArray(row?.tags),
      pinned: Boolean(row?.pinned),
      verificationStatus: row?.verificationStatus ?? 'unverified',
      reviewCadence: row?.reviewCadence ?? 'monthly',
      staleAt: row?.staleAt ?? null,
      lastReviewedAt: row?.lastReviewedAt ?? null,
      captureSource: row?.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
      attachments: parseAttachments(row?.attachmentsJson),
      convertedTo: parseCT(row?.convertedToJson),
      convertedToJson: undefined,
      captureMetadataJson: undefined,
      attachmentsJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id
 * Owner-only updates.
 */
router.put(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, project_id, visibility
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const setParts: string[] = [];
    const params: any[] = [];
    const set = (col: string, val: any) => {
      setParts.push(`${col} = ?`);
      params.push(val);
    };

    if (typeof req.body?.title === 'string') set('title', String(req.body.title).trim());
    if (req.body?.tags !== undefined)
      set('tags_json', JSON.stringify(parseTagsArray(req.body.tags)));
    if (req.body?.contentJson !== undefined)
      set(
        'content_json',
        safeJsonString(req.body.contentJson, JSON.stringify({ type: 'doc', content: [] }))
      );
    if (typeof req.body?.contentText === 'string') set('content_text', req.body.contentText);
    if (typeof req.body?.maturity === 'string') set('maturity', req.body.maturity);
    if (typeof req.body?.icon === 'string') set('icon', req.body.icon);
    if (typeof req.body?.summary === 'string') set('summary', req.body.summary);
    if (
      typeof req.body?.status === 'string' &&
      ['inbox', 'active', 'converted', 'archived'].includes(req.body.status)
    )
      set('status', req.body.status);
    // V4-NOTE-05: lifecycle
    if (
      typeof req.body?.verificationStatus === 'string' &&
      ['unverified', 'verified', 'disputed'].includes(req.body.verificationStatus)
    )
      set('verification_status', req.body.verificationStatus);
    if (
      typeof req.body?.reviewCadence === 'string' &&
      ['weekly', 'monthly', 'quarterly', 'never'].includes(req.body.reviewCadence)
    )
      set('review_cadence', req.body.reviewCadence);
    if (req.body?.staleAt === null || (typeof req.body?.staleAt === 'string' && req.body.staleAt))
      set('stale_at', req.body.staleAt || null);
    if (req.body?.lastReviewedAt !== undefined)
      set('last_reviewed_at', req.body.lastReviewedAt || null);

    if (req.body?.projectId !== undefined) {
      const nextProjectId = req.body.projectId ? String(req.body.projectId) : null;
      set('project_id', nextProjectId);
      const nextVis = nextProjectId ? 'project' : 'private';
      set('visibility', nextVis);
    }
    if (req.body?.convertedTo !== undefined) {
      set(
        'converted_to_json',
        safeJsonString(Array.isArray(req.body.convertedTo) ? req.body.convertedTo : [], '[]')
      );
    }

    const selectNotebookFull = `
      SELECT
        id,
        owner_user_id as "ownerUserId",
        organization_id as "organizationId",
        project_id as "projectId",
        visibility,
        title,
        content_json as "contentJson",
        content_text as "contentText",
        tags_json as tags,
        maturity,
        icon,
        summary,
        coalesce(status, 'active') as status,
        coalesce(pinned, 0) as pinned,
        coalesce(verification_status, 'unverified') as verificationStatus,
        coalesce(review_cadence, 'monthly') as reviewCadence,
        stale_at as staleAt,
        last_reviewed_at as lastReviewedAt,
        capture_source as "captureSource",
        capture_metadata as "captureMetadataJson",
        attachments_json as "attachmentsJson",
        converted_to_json as "convertedToJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM notebook_pages WHERE id = ? LIMIT 1`;

    const formatNotebookRow = (r: any) => {
      const parseCT = (raw: string | null) => {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };
      return {
        ...r,
        tags: parseTagsArray(r?.tags),
        pinned: Boolean(r?.pinned),
        verificationStatus: r?.verificationStatus ?? 'unverified',
        reviewCadence: r?.reviewCadence ?? 'monthly',
        staleAt: r?.staleAt ?? null,
        lastReviewedAt: r?.lastReviewedAt ?? null,
        captureSource: r?.captureSource ?? null,
        captureMetadata: parseCaptureMetadata(r?.captureMetadataJson),
        attachments: parseAttachments(r?.attachmentsJson),
        convertedTo: parseCT(r?.convertedToJson),
        convertedToJson: undefined,
        captureMetadataJson: undefined,
        attachmentsJson: undefined,
        contentJson: (() => {
          try {
            return r?.contentJson ? JSON.parse(r.contentJson) : { type: 'doc', content: [] };
          } catch {
            return { type: 'doc', content: [] };
          }
        })(),
      };
    };

    if (setParts.length === 0) {
      const row = await queryHelpers.queryOne<any>(selectNotebookFull, [id]);
      return res.json(formatNotebookRow(row));
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);
    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET ${setParts.join(', ')} WHERE id = ?`,
      params
    );

    const row = await queryHelpers.queryOne<any>(selectNotebookFull, [id]);
    res.json(formatNotebookRow(row));
  })
);

/**
 * DELETE /api/my-work/notebook/pages/:id
 * Owner-only delete.
 */
router.delete(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    await queryHelpers.queryRun(`DELETE FROM notebook_pages WHERE id = ?`, [id]);
    res.status(204).send();
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id/pin
 * Toggle pinned state.
 */
router.put(
  '/notebook/pages/:id/pin',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, coalesce(pinned, 0) as pinned FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const newPinned = existing.pinned ? 0 : 1;
    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newPinned, id]
    );

    res.json({ id, pinned: Boolean(newPinned) });
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id/status
 * Change note status (inbox/active/converted/archived).
 */
router.put(
  '/notebook/pages/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const status = String(req.body?.status || '')
      .trim()
      .toLowerCase();
    if (!['inbox', 'active', 'converted', 'archived'].includes(status)) {
      return res
        .status(400)
        .json({ error: 'Invalid status. Must be inbox|active|converted|archived' });
    }

    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );

    res.json({ id, status });
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/convert
 * Convert a notebook page to a task, decision, initiative, report, or presentation.
 */
router.post(
  '/notebook/pages/:id/convert',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const pageId = String(req.params.id || '').trim();
    const target = String(req.body?.target || '')
      .trim()
      .toLowerCase();
    if (
      !['task', 'decision', 'initiative', 'report', 'presentation', 'assessment'].includes(target)
    ) {
      return res
        .status(400)
        .json({ error: 'target must be task|decision|initiative|report|presentation|assessment' });
    }

    const page = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, project_id, title, content_text, tags_json, converted_to_json
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );
    if (!page) return res.status(404).json({ error: 'Not found' });
    if (String(page.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(page.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const overrideTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const overrideDesc = typeof req.body?.description === 'string' ? req.body.description : '';
    const entityTitle = overrideTitle || page.title || 'Untitled';
    const entityDesc = overrideDesc || (page.content_text || '').slice(0, 2000);
    const newId = uuidv4();
    let createdEntity: {
      id: string;
      type: string;
      title: string;
      sourceSessionId?: string;
    } | null = null;

    if (target === 'task') {
      const cols = await getTableColumns('tasks');
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [newId];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };
      add('organization_id', orgId);
      add('title', entityTitle);
      add('description', entityDesc);
      add('status', 'todo');
      add('priority', 'medium');
      add('assignee_id', userId);
      add('reporter_id', userId);
      add('tags', page.tags_json || '[]');
      add('task_type', 'personal');
      add('source_type', 'notebook');
      add('source_id', pageId);
      await queryHelpers.queryRun(
        `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
      createdEntity = { id: newId, type: 'task', title: entityTitle };

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'task',
        sourceId: newId,
        targetType: 'notebook',
        targetId: pageId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: pageId,
      });
    } else if (target === 'decision') {
      const cols = await getTableColumns('decisions');
      if (cols.size > 0) {
        const insertCols: string[] = ['id'];
        const insertVals: string[] = ['?'];
        const insertParams: any[] = [newId];
        const add = (col: string, val: any) => {
          if (!cols.has(col)) return;
          insertCols.push(col);
          insertVals.push('?');
          insertParams.push(val);
        };
        add('organization_id', orgId);
        add('title', entityTitle);
        add('description', entityDesc);
        add('status', 'pending');
        add('decision_maker_id', userId);
        add('created_by', userId);
        add('priority', 'medium');
        add('source_type', 'notebook');
        add('source_id', pageId);
        await queryHelpers.queryRun(
          `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );
      }
      createdEntity = { id: newId, type: 'decision', title: entityTitle };

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'decision',
        sourceId: newId,
        targetType: 'notebook',
        targetId: pageId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: pageId,
      });
    } else if (target === 'initiative') {
      if (!(await requireTables(res, ['initiatives', 'tool_sessions']))) return;
      const cols = await getTableColumns('initiatives');
      const toolSessionId = await createMyWorkToolSession({
        userId,
        orgId,
        sourceType: 'notebook',
        sourceId: pageId,
        title: entityTitle,
        summary: entityDesc,
      });
      // V3-A01: Traceability guard
      if (!toolSessionId) {
        return res
          .status(500)
          .json({ error: 'Failed to materialize MYWORK ToolSession for traceability' });
      }

      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [newId];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('name', entityTitle.slice(0, 255));
      add('title', entityTitle.slice(0, 255));
      add('summary', entityDesc.slice(0, 5000));
      add('description', entityDesc.slice(0, 5000));
      add('status', 'DRAFT');
      add('owner_execution_id', userId);
      add('owner_business_id', userId);
      add('sponsor_id', userId);
      add('source_type', 'tool');
      add('source_id', toolSessionId);

      await queryHelpers.queryRun(
        `INSERT INTO initiatives (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
      createdEntity = {
        id: newId,
        type: 'initiative',
        title: entityTitle,
        sourceSessionId: toolSessionId,
      };

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'initiative',
        sourceId: newId,
        targetType: 'notebook',
        targetId: pageId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });
      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'initiative',
        sourceId: newId,
        targetType: 'tool_session',
        targetId: toolSessionId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });
    } else if (target === 'assessment') {
      if (!(await requireTables(res, ['assessments']))) return;
      const cols = await getTableColumns('assessments');
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [newId];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('project_id', page.project_id || null);
      add('assessment_type', String(req.body?.assessmentType || 'DRD').toUpperCase());
      add('name', entityTitle.slice(0, 255));
      add('description', entityDesc.slice(0, 5000));
      add('status', 'DRAFT');
      add('created_by', userId);
      add('updated_by', userId);
      add('source_type', 'notebook');
      add('source_id', pageId);

      await queryHelpers.queryRun(
        `INSERT INTO assessments (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );

      createdEntity = { id: newId, type: 'assessment', title: entityTitle };

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'assessment',
        sourceId: newId,
        targetType: 'notebook_page',
        targetId: pageId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: pageId,
      });
    } else if (target === 'report') {
      if (!(await requireTables(res, ['tool_sessions']))) return;
      const toolSessionId = await createMyWorkToolSession({
        userId,
        orgId,
        sourceType: 'notebook',
        sourceId: pageId,
        title: entityTitle,
        summary: entityDesc,
      });
      // V3-A01: Traceability guard
      if (!toolSessionId) {
        return res
          .status(500)
          .json({ error: 'Failed to materialize MYWORK ToolSession for traceability' });
      }

      const reportBuilderService = await import('../services/reportBuilderService.js');
      const v3Params: Record<string, any> = {};
      if (req.body.reportTypeV3) v3Params.reportTypeV3 = req.body.reportTypeV3;
      if (req.body.goalV3) v3Params.goalV3 = req.body.goalV3;
      if (req.body.communicationRegister)
        v3Params.communicationRegister = req.body.communicationRegister;
      if (req.body.density) v3Params.density = req.body.density;
      if (req.body.periodFrom) v3Params.periodFrom = req.body.periodFrom;
      if (req.body.periodTo) v3Params.periodTo = req.body.periodTo;
      if (req.body.confidentiality) v3Params.confidentiality = req.body.confidentiality;

      const created = await reportBuilderService.createReport({
        organizationId: orgId,
        sourceType: 'TOOL',
        sourceId: toolSessionId,
        title: entityTitle.slice(0, 255),
        description: entityDesc.slice(0, 2000),
        createdBy: userId,
        ...v3Params,
      });
      createdEntity = {
        id: String(created.report.id),
        type: 'report',
        title: String(created.report.title || entityTitle),
        sourceSessionId: toolSessionId,
      };

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'report',
        sourceId: String(created.report.id),
        targetType: 'notebook',
        targetId: pageId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });
      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'report',
        sourceId: String(created.report.id),
        targetType: 'tool_session',
        targetId: toolSessionId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });
    } else {
      if (!(await requireTables(res, ['tool_sessions']))) return;
      const toolSessionId = await createMyWorkToolSession({
        userId,
        orgId,
        sourceType: 'notebook',
        sourceId: pageId,
        title: entityTitle,
        summary: entityDesc,
      });
      // V3-A01: Traceability guard
      if (!toolSessionId) {
        return res
          .status(500)
          .json({ error: 'Failed to materialize MYWORK ToolSession for traceability' });
      }

      const presentationGeneratorService =
        await import('../services/presentationGeneratorService.js');
      const outline = await presentationGeneratorService.generateOutline(
        {
          title: entityTitle.slice(0, 255),
          audience: 'internal',
          goal: 'inform',
          language: 'en',
          theme: 'corporate',
          confidentiality: 'internal',
          sourceType: 'tool',
          sourceId: toolSessionId,
          sourceArtifacts: [
            {
              type: 'tool_session',
              id: toolSessionId,
              label: `MyWork session: ${entityTitle.slice(0, 120)}`,
              data: {
                sourceType: 'notebook',
                sourceId: pageId,
              },
            },
          ],
        },
        orgId
      );
      createdEntity = {
        id: String(outline.deckId),
        type: 'presentation',
        title: entityTitle,
        sourceSessionId: toolSessionId,
      };

      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'presentation',
        sourceId: String(outline.deckId),
        targetType: 'notebook',
        targetId: pageId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });
      await linkGraphAddEdge({
        orgId,
        userId,
        sourceType: 'presentation',
        sourceId: String(outline.deckId),
        targetType: 'tool_session',
        targetId: toolSessionId,
        relation: 'ref',
        containerType: 'mywork_convert',
        containerId: toolSessionId,
      });
    }

    // Update notebook page: track conversion + set status
    let existingConverted: any[] = [];
    try {
      existingConverted = JSON.parse(page.converted_to_json || '[]');
    } catch {
      existingConverted = [];
    }
    if (!Array.isArray(existingConverted)) existingConverted = [];
    if (createdEntity?.id) {
      existingConverted.push({ type: target, id: createdEntity.id });
    }

    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET status = 'converted', converted_to_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(existingConverted), pageId]
    );

    res.status(201).json(createdEntity);
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/extract-actions
 * AI-based action item extraction via SSE.
 */
router.post(
  '/notebook/pages/:id/extract-actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const pageId = String(req.params.id || '').trim();
    const page = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, title, content_text
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );
    if (!page) return res.status(404).json({ error: 'Not found' });
    if (String(page.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(page.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const noteContent = String(page.content_text || page.title || '').trim();
    if (!noteContent) return res.status(400).json({ error: 'Note has no content to analyze' });

    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    if (req.socket) {
      req.socket.setTimeout(120_000);
      req.socket.setNoDelay(true);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (type: string, data: any) => {
      try {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      } catch {}
    };

    emit('stage', {
      stage: 'extracting',
      label: isPl ? 'Analizuję notatkę...' : 'Analyzing note...',
    });

    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      const prompt = isPl
        ? `Przeanalizuj poniższą notatkę i wyodrębnij konkretne akcje (action items) do wykonania.\n\nNotatka: "${noteContent.slice(0, 3000)}"\n\nDla każdej akcji podaj:\n- title: krótki tytuł\n- suggestedOwner: sugerowany właściciel (lub null)\n- suggestedDue: sugerowany termin jako opis (np. "do końca tygodnia") lub null\n- priority: high|medium|low\n\nOdpowiedz JSON array: [{"title":"...","suggestedOwner":null,"suggestedDue":null,"priority":"medium"}]\nTylko JSON, bez markdown.`
        : `Analyze the following note and extract concrete action items.\n\nNote: "${noteContent.slice(0, 3000)}"\n\nFor each action provide:\n- title: short task title\n- suggestedOwner: suggested owner (or null)\n- suggestedDue: suggested due description (e.g. "end of week") or null\n- priority: high|medium|low\n\nRespond as JSON array: [{"title":"...","suggestedOwner":null,"suggestedDue":null,"priority":"medium"}]\nOnly JSON, no markdown.`;

      const result = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Jesteś asystentem do analizy notatek. Odpowiadasz tylko JSON.'
          : 'You are a note analysis assistant. You respond only with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      });

      let items: any[] = [];
      try {
        const raw = String((result as any)?.content || '[]');
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        items = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
      } catch {
        items = [];
      }

      emit('actions', { items });
      emit('done', { count: items.length });
      res.end();
    } catch (err: any) {
      logger.error('[NotebookExtractActions] Error:', err);
      emit('error', { message: err?.message || 'Extraction failed' });
      res.end();
    }
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/suggest-topics
 * AI suggests topics worth analyzing for the note (company + tags context).
 */
router.post(
  '/notebook/pages/:id/suggest-topics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const pageId = String(req.params.id || '').trim();
    const page = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, title, content_text, tags_json
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );
    if (!page) return res.status(404).json({ error: 'Not found' });
    if (String(page.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(page.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const title = String(page.title || '').trim();
    const contentText = String(page.content_text || '')
      .trim()
      .slice(0, 2000);
    const tags = parseTagsArray(page.tags_json);
    const tagsStr = tags.join(', ');

    const excludedTopics: string[] = Array.isArray(req.body?.excludedTopics)
      ? req.body.excludedTopics
      : [];
    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    let topics: string[] = [];

    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      const excludeHint =
        excludedTopics.length > 0
          ? isPl
            ? `\nNIE sugeruj tych tematów (już odrzucone): ${excludedTopics.join(', ')}`
            : `\nDo NOT suggest these (already dismissed): ${excludedTopics.join(', ')}`
          : '';

      const prompt = isPl
        ? `Jesteś asystentem strategicznym. Na podstawie notatki użytkownika (tytuł, treść, tagi) zaproponuj 3-5 tematów wartych przeanalizowania w kontekście firmy. Tematy powinny być konkretne, praktyczne i powiązane z przedmiotem notatki.

Notatka:
Tytuł: ${title}
Tagi: ${tagsStr}
Treść (fragment): ${contentText || '(brak)'}
${excludeHint}

Odpowiedz TYLKO jako JSON array stringów: ["temat 1", "temat 2", ...]
Bez markdown, bez numeracji, tylko tablica JSON.`
        : `You are a strategic assistant. Based on the user's note (title, content, tags) suggest 3-5 topics worth analyzing in a business context. Topics should be concrete, practical, and related to the note subject.

Note:
Title: ${title}
Tags: ${tagsStr}
Content (excerpt): ${contentText || '(none)'}
${excludeHint}

Respond ONLY as a JSON array of strings: ["topic 1", "topic 2", ...]
No markdown, no numbering, just a JSON array.`;

      const result = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Odpowiadasz tylko poprawnym JSON array stringów.'
          : 'You respond only with a valid JSON array of strings.',
        messages: [{ role: 'user', content: prompt }],
      });

      try {
        const raw = String((result as any)?.content || '[]');
        const jsonMatch = raw.match(/\[[\s\S]*?\]/);
        topics = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
        if (!Array.isArray(topics)) topics = [];
        topics = topics
          .filter((t) => typeof t === 'string' && t.trim().length > 0)
          .map((t) => String(t).trim());
      } catch {
        topics = [];
      }
    } catch (err: any) {
      logger.error('[NotebookSuggestTopics] Error:', err);
      // Fallback: derive topics from title + tags when LLM fails
      const fallback: string[] = [];
      if (title) {
        const words = title.split(/\s+/).filter((w) => w.length > 2);
        if (words.length > 0) {
          fallback.push(isPl ? `Jak mierzyć ${words[0]}?` : `How to measure ${words[0]}?`);
          fallback.push(
            isPl
              ? `Ryzyka w ${words.slice(0, 2).join(' ')}`
              : `Risks in ${words.slice(0, 2).join(' ')}`
          );
        }
      }
      tags
        .filter((t) => !excludedTopics.includes(t))
        .slice(0, 3)
        .forEach((t) => {
          fallback.push(isPl ? `Szczegóły: ${t}` : `Details: ${t}`);
        });
      topics =
        fallback.length > 0
          ? fallback
          : isPl
            ? ['Przeanalizuj kontekst', 'Dodaj metryki', 'Benchmark']
            : ['Analyze context', 'Add metrics', 'Benchmark'];
    }

    res.json({ topics });
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/classify
 * Heuristic classification — suggests conversion target for mature notes.
 */
router.post(
  '/notebook/pages/:id/classify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const pageId = String(req.params.id || '').trim();

    if (!(await requireTables(res, ['notebook_pages']))) return;

    const page = await queryHelpers.queryOne<any>(
      `SELECT id, title, content_text, maturity
       FROM notebook_pages
       WHERE id = ? AND owner_user_id = ? AND organization_id = ? LIMIT 1`,
      [pageId, userId, orgId]
    );
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const text = String(page.content_text || page.title || '').toLowerCase();

    let suggestedType = 'none';
    let reason = '';

    const decisionKeywords = [
      'decide',
      'decision',
      'approve',
      'reject',
      'choose',
      'option',
      'alternative',
      'decyzja',
      'zdecydować',
      'opcja',
    ];
    const taskKeywords = [
      'todo',
      'action',
      'implement',
      'fix',
      'create',
      'build',
      'do',
      'task',
      'step',
      'zadanie',
      'zrobić',
      'naprawić',
    ];
    const ideaKeywords = [
      'idea',
      'concept',
      'what if',
      'imagine',
      'brainstorm',
      'explore',
      'pomysł',
      'koncept',
    ];

    const decisionScore = decisionKeywords.filter((k) => text.includes(k)).length;
    const taskScore = taskKeywords.filter((k) => text.includes(k)).length;
    const ideaScore = ideaKeywords.filter((k) => text.includes(k)).length;

    const actionItemCount = (
      text.match(/[-•]\s*(create|fix|update|send|review|check|build|implement|add|remove)/gi) || []
    ).length;
    if (actionItemCount >= 2) {
      suggestedType = 'tasks';
      reason = `Found ${actionItemCount} action items`;
    } else if (decisionScore > taskScore && decisionScore > ideaScore && decisionScore >= 2) {
      suggestedType = 'decision';
      reason = 'Contains decision-related language';
    } else if (taskScore > decisionScore && taskScore > ideaScore && taskScore >= 2) {
      suggestedType = 'task';
      reason = 'Contains task-oriented language';
    } else if (ideaScore >= 2) {
      suggestedType = 'idea';
      reason = 'Contains exploratory/idea language';
    }

    res.json({ pageId, suggestedType, reason, maturity: page.maturity });
  })
);

// ─── Morning Brief ──────────────────────────────────────────────────────────
router.get(
  '/morning-brief',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const brief: Record<string, any> = { generatedAt: new Date().toISOString() };

    try {
      const taskCols = await getTableColumns('tasks');
      if (taskCols.has('assignee_id')) {
        const newTasks = await queryHelpers.queryAll<any>(
          `SELECT id, title, priority FROM tasks
           WHERE assignee_id = ? AND organization_id = ?
           AND created_at > ${daysAgoSql(1)} AND status != 'done'
           ORDER BY priority DESC LIMIT 5`,
          [userId, orgId]
        );
        brief.newTasks = newTasks || [];
      }

      if (taskCols.has('due_date')) {
        const overdue = await queryHelpers.queryAll<any>(
          `SELECT id, title, due_date FROM tasks
           WHERE assignee_id = ? AND organization_id = ? AND status != 'done'
           AND due_date IS NOT NULL AND due_date < ${nowSql()}
           ORDER BY due_date ASC LIMIT 5`,
          [userId, orgId]
        );
        brief.overdueTasks = overdue || [];
      }

      if (taskCols.has('due_date')) {
        const dueSoon = await queryHelpers.queryAll<any>(
          `SELECT id, title, due_date FROM tasks
           WHERE assignee_id = ? AND organization_id = ? AND status != 'done'
           AND due_date IS NOT NULL
           AND due_date BETWEEN ${nowSql()} AND ${daysAheadSql(2)}
           ORDER BY due_date ASC LIMIT 5`,
          [userId, orgId]
        );
        brief.dueSoon = dueSoon || [];
      }

      const decCols = await getTableColumns('decisions');
      const decisionDueColumn = decCols.has('due_date')
        ? 'due_date'
        : decCols.has('deadline')
          ? 'deadline'
          : null;
      if (decCols.has('decision_maker_id')) {
        const pending = await queryHelpers.queryAll<any>(
          `SELECT id, title, ${decisionDueColumn ? `${decisionDueColumn} as due_date` : 'NULL as due_date'} FROM decisions
           WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ? AND status = 'pending'
           ORDER BY ${decisionDueColumn ? `${decisionDueColumn} ASC NULLS LAST,` : ''} updated_at DESC LIMIT 5`,
          [userId, userId, orgId]
        );
        brief.pendingDecisions = pending || [];
      }

      const priorities: string[] = [];
      if ((brief.overdueTasks || []).length > 0)
        priorities.push(`Address ${brief.overdueTasks.length} overdue task(s) first`);
      if ((brief.pendingDecisions || []).length > 0)
        priorities.push(`Review ${brief.pendingDecisions.length} pending decision(s)`);
      if ((brief.dueSoon || []).length > 0)
        priorities.push(`${brief.dueSoon.length} task(s) due soon — plan time`);
      brief.recommendation = priorities.join('. ') || 'All clear — focus on deep work today!';
    } catch (err) {
      console.error('[morning-brief]', err);
    }

    res.json(brief);
  })
);

// ---------------------------------------------------------------------------
// M2: Chat -> Action Bridge
// ---------------------------------------------------------------------------

router.post(
  '/chat-actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const action = String(req.body?.action || '').trim();
    const payload = req.body?.payload || {};

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    try {
      switch (action) {
        case 'create_task': {
          const id = uuidv4();
          const cols = await getTableColumns('tasks');
          const insertCols: string[] = ['id'];
          const insertVals: string[] = ['?'];
          const insertParams: any[] = [id];
          const add = (col: string, val: any) => {
            if (!cols.has(col)) return;
            insertCols.push(col);
            insertVals.push('?');
            insertParams.push(val);
          };
          add('organization_id', orgId);
          add('title', String(payload.title || 'New Task').slice(0, 500));
          add('description', payload.description || null);
          add('status', payload.status || 'todo');
          add('priority', payload.priority || 'medium');
          add('assignee_id', userId);
          add('reporter_id', userId);
          if (payload.dueDate) add('due_date', payload.dueDate);
          add('tags', JSON.stringify(payload.tags || []));
          add('task_type', 'personal');
          await queryHelpers.queryRun(
            `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
            insertParams
          );
          return res.status(201).json({ success: true, action, id, title: payload.title });
        }
        case 'update_task_status': {
          const { taskId, status } = payload;
          if (!taskId || !status)
            return res.status(400).json({ error: 'taskId and status required' });
          await queryHelpers.queryRun(
            `UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND assignee_id = ? AND organization_id = ?`,
            [status, taskId, userId, orgId]
          );
          return res.json({ success: true, action, taskId, status });
        }
        case 'create_decision': {
          const id = uuidv4();
          const cols = await getTableColumns('decisions');
          const insertCols: string[] = ['id'];
          const insertVals: string[] = ['?'];
          const insertParams: any[] = [id];
          const add = (col: string, val: any) => {
            if (!cols.has(col)) return;
            insertCols.push(col);
            insertVals.push('?');
            insertParams.push(val);
          };
          add('organization_id', orgId);
          add('title', String(payload.title || 'New Decision').slice(0, 500));
          add('description', payload.description || null);
          add('status', 'pending');
          add('created_by', userId);
          add('decision_maker_id', userId);
          await queryHelpers.queryRun(
            `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
            insertParams
          );
          return res.status(201).json({ success: true, action, id, title: payload.title });
        }
        default:
          return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Action failed' });
    }
  })
);

// ---------------------------------------------------------------------------
// M5: AI Decision Briefs
// ---------------------------------------------------------------------------

router.get(
  '/decisions/:id/brief',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const decisionId = String(req.params.id || '').trim();
    if (!decisionId) return res.status(400).json({ error: 'Missing decision id' });

    const decision = await queryHelpers.queryOne<any>(
      `SELECT id, title, description, status, priority, category, created_at, deadline
       FROM decisions WHERE id = ? AND organization_id = ? LIMIT 1`,
      [decisionId, orgId]
    );
    if (!decision) return res.status(404).json({ error: 'Decision not found' });

    const urgency =
      decision.deadline && new Date(decision.deadline) < new Date(Date.now() + 86400000 * 3)
        ? 'urgent'
        : 'normal';
    const summary = `${decision.title}${decision.description ? '. ' + String(decision.description).slice(0, 200) : ''}`;
    const recommendation =
      urgency === 'urgent' ? 'Review soon — approaching deadline' : 'Standard review recommended';

    res.json({
      decisionId,
      summary: summary.slice(0, 300),
      recommendation,
      urgency,
      category: decision.category || null,
      createdAt: decision.created_at,
      dueDate: decision.deadline,
    });
  })
);

// ────────────────────────────────────────────────────────────────────────────
// Related Context (KnowledgePulse expansion for Tasks / Decisions)
// ────────────────────────────────────────────────────────────────────────────
router.get(
  '/related-context',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const entityType = String(req.query.entityType || '').trim();
    const entityId = String(req.query.entityId || '').trim();
    const title = String(req.query.title || '').trim();

    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }

    const results: { type: string; id: string; title: string; relevance: string }[] = [];

    try {
      if (title) {
        const keywords = title
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 3);
        for (const keyword of keywords) {
          const pages = await queryHelpers.queryAll<any>(
            `SELECT id, title, 'notebook' as type FROM notebook_pages 
             WHERE user_id = ? AND organization_id = ? AND title LIKE ? 
             AND id != ? LIMIT 3`,
            [userId, orgId, `%${keyword}%`, entityId]
          );
          for (const p of pages || []) {
            if (!results.find((r) => r.id === p.id)) {
              results.push({
                type: 'notebook',
                id: p.id,
                title: p.title,
                relevance: 'title_match',
              });
            }
          }
        }
      }

      const taskCols = await getTableColumns('tasks');
      if (entityType === 'decision' && taskCols.has('initiative_id')) {
        const dec = await queryHelpers.queryOne<any>(
          `SELECT initiative_id FROM decisions WHERE id = ? AND organization_id = ? LIMIT 1`,
          [entityId, orgId]
        );
        if (dec?.initiative_id) {
          const tasks = await queryHelpers.queryAll<any>(
            `SELECT id, title, status FROM tasks 
             WHERE initiative_id = ? AND organization_id = ? AND id != ? 
             LIMIT 5`,
            [dec.initiative_id, orgId, entityId]
          );
          for (const t of tasks || []) {
            results.push({ type: 'task', id: t.id, title: t.title, relevance: 'same_initiative' });
          }
        }
      }

      if (entityType === 'task') {
        const decCols = await getTableColumns('decisions');
        if (decCols.has('title') && title) {
          const keywords = title
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .slice(0, 2);
          for (const keyword of keywords) {
            const decs = await queryHelpers.queryAll<any>(
              `SELECT id, title, status FROM decisions 
               WHERE organization_id = ? AND title LIKE ? AND id != ? 
               LIMIT 3`,
              [orgId, `%${keyword}%`, entityId]
            );
            for (const d of decs || []) {
              if (!results.find((r) => r.id === d.id)) {
                results.push({
                  type: 'decision',
                  id: d.id,
                  title: d.title,
                  relevance: 'title_match',
                });
              }
            }
          }
        }
      }

      const ideaCols = await getTableColumns('my_ideas');
      if (ideaCols.has('title') && title) {
        const keyword = title.split(/\s+/).filter((w) => w.length > 3)[0];
        if (keyword) {
          const ideas = await queryHelpers.queryAll<any>(
            `SELECT id, title FROM my_ideas 
             WHERE user_id = ? AND organization_id = ? AND title LIKE ? 
             LIMIT 3`,
            [userId, orgId, `%${keyword}%`]
          );
          for (const i of ideas || []) {
            if (!results.find((r) => r.id === i.id)) {
              results.push({ type: 'idea', id: i.id, title: i.title, relevance: 'title_match' });
            }
          }
        }
      }
    } catch (err) {
      console.error('[related-context]', err);
    }

    res.json({ results: results.slice(0, 10) });
  })
);

// ============================================================================
// L1: AI Priority Coach
// ============================================================================

router.get(
  '/priority-advice',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    try {
      const { taskAdvisorService } = await import('../services/ai/taskAdvisorService.js');
      const result = await taskAdvisorService.analyzePortfolio(userId, orgId);
      res.json(result);
    } catch (err: any) {
      res.json({ recommendations: [], overcommitWarning: null, summary: 'Service unavailable' });
    }
  })
);

// ============================================================================
// L2: AI Weekly Review
// ============================================================================

router.post(
  '/weekly-review/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const review: Record<string, any> = { generatedAt: new Date().toISOString() };

    try {
      const taskCols = await getTableColumns('tasks');
      if (taskCols.has('assignee_id')) {
        const completed = await queryHelpers.queryAll<any>(
          `SELECT id, title, completed_at FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND status IN ('done', 'completed')
           AND updated_at > ${daysAgoSql(7)}
           ORDER BY updated_at DESC LIMIT 20`,
          [userId, orgId]
        );
        review.completedTasks = completed || [];
        review.completedCount = review.completedTasks.length;
      }

      const decCols = await getTableColumns('decisions');
      if (decCols.has('decision_maker_id')) {
        const decided = await queryHelpers.queryAll<any>(
          `SELECT id, title, status, updated_at FROM decisions 
           WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ? 
           AND status IN ('approved', 'rejected') AND updated_at > ${daysAgoSql(7)}
           ORDER BY updated_at DESC LIMIT 10`,
          [userId, userId, orgId]
        );
        review.decisionsMade = decided || [];
        review.decisionsCount = review.decisionsMade.length;
      }

      if (taskCols.has('due_date')) {
        const overdue = await queryHelpers.queryAll<any>(
          `SELECT id, title, due_date FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND status NOT IN ('done', 'completed')
           AND due_date IS NOT NULL AND due_date < ${nowSql()}
           LIMIT 10`,
          [userId, orgId]
        );
        review.overdueItems = overdue || [];
        review.overdueCount = review.overdueItems.length;
      }

      const stuck = await queryHelpers.queryAll<any>(
        `SELECT id, title, updated_at FROM tasks 
         WHERE assignee_id = ? AND organization_id = ? AND status NOT IN ('done', 'completed')
         AND updated_at < ${daysAgoSql(5)}
         LIMIT 5`,
        [userId, orgId]
      );
      review.stuckItems = stuck || [];

      const lines: string[] = ['# Weekly Review\n'];
      lines.push(`## Wins`);
      lines.push(`- Completed ${review.completedCount || 0} tasks`);
      lines.push(`- Made ${review.decisionsCount || 0} decisions\n`);
      lines.push(`## Blockers`);
      if (review.overdueCount) lines.push(`- ${review.overdueCount} overdue items`);
      if (review.stuckItems?.length)
        lines.push(`- ${review.stuckItems.length} tasks stuck (no update 5+ days)`);
      if (!review.overdueCount && !review.stuckItems?.length) lines.push('- None!\n');
      lines.push(`\n## Next Week Priorities`);
      lines.push(`- Review overdue items and reschedule or delegate`);
      lines.push(`- Address stuck tasks`);
      lines.push(`- Plan Monday focus items`);

      review.markdownContent = lines.join('\n');
    } catch (err) {
      console.error('[weekly-review]', err);
    }

    res.json(review);
  })
);

// ────────────────────────────────────────────────────────────────────────────
// L3: Work Pattern Analysis
// ────────────────────────────────────────────────────────────────────────────
router.get(
  '/work-patterns',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const patterns: Record<string, any> = {};

    try {
      const taskCols = await getTableColumns('tasks');

      if (taskCols.has('assignee_id')) {
        const weeklyVelocity = await queryHelpers.queryAll<any>(
          `SELECT 
            ${weekBucketSql('updated_at')} as week,
            COUNT(*) as completed
           FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND status IN ('done', 'completed')
           AND updated_at > ${daysAgoSql(28)}
           GROUP BY week ORDER BY week`,
          [userId, orgId]
        );
        patterns.weeklyVelocity = weeklyVelocity || [];
        const velocities = (weeklyVelocity || []).map((w: any) => w.completed);
        patterns.avgVelocity =
          velocities.length > 0
            ? Math.round(velocities.reduce((a: number, b: number) => a + b, 0) / velocities.length)
            : 0;
      }

      if (taskCols.has('created_at')) {
        const avgTime = await queryHelpers.queryOne<any>(
          `SELECT AVG(${dayDiffSql('updated_at', 'created_at')}) as avg_days
           FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND status IN ('done', 'completed')
           AND updated_at > ${daysAgoSql(30)}`,
          [userId, orgId]
        );
        patterns.avgCompletionDays = avgTime?.avg_days
          ? Math.round(avgTime.avg_days * 10) / 10
          : null;
      }

      const decCols = await getTableColumns('decisions');
      if (decCols.has('decision_maker_id') && decCols.has('created_at')) {
        const avgDecision = await queryHelpers.queryOne<any>(
          `SELECT AVG(${dayDiffSql('updated_at', 'created_at')}) as avg_days
           FROM decisions 
           WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ? 
           AND status IN ('approved', 'rejected')
           AND updated_at > ${daysAgoSql(30)}`,
          [userId, userId, orgId]
        );
        patterns.avgDecisionDays = avgDecision?.avg_days
          ? Math.round(avgDecision.avg_days * 10) / 10
          : null;
      }

      if (taskCols.has('due_date')) {
        const totalWithDue = await queryHelpers.queryOne<any>(
          `SELECT COUNT(*) as total FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND due_date IS NOT NULL
           AND updated_at > ${daysAgoSql(30)}`,
          [userId, orgId]
        );
        const overdueCompleted = await queryHelpers.queryOne<any>(
          `SELECT COUNT(*) as total FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND due_date IS NOT NULL
           AND status IN ('done', 'completed') AND updated_at > due_date
           AND updated_at > ${daysAgoSql(30)}`,
          [userId, orgId]
        );
        if (totalWithDue?.total > 0) {
          patterns.overdueRate = Math.round(
            ((overdueCompleted?.total || 0) / totalWithDue.total) * 100
          );
        }
      }

      const openCount = await queryHelpers.queryOne<any>(
        `SELECT COUNT(*) as total FROM tasks 
         WHERE assignee_id = ? AND organization_id = ? AND status NOT IN ('done', 'completed')`,
        [userId, orgId]
      );
      patterns.currentOpenTasks = openCount?.total || 0;

      const insights: string[] = [];
      if (patterns.avgVelocity && patterns.currentOpenTasks > patterns.avgVelocity * 2) {
        insights.push(
          `You have ${patterns.currentOpenTasks} open tasks but average ${patterns.avgVelocity}/week. Consider delegating or deferring.`
        );
      }
      if (patterns.overdueRate && patterns.overdueRate > 30) {
        insights.push(
          `${patterns.overdueRate}% of your tasks with deadlines are completed late. Try adding buffer time.`
        );
      }
      if (patterns.avgDecisionDays && patterns.avgDecisionDays > 5) {
        insights.push(
          `Average decision time is ${patterns.avgDecisionDays} days. Faster decisions could unblock teams.`
        );
      }
      patterns.insights = insights;
    } catch (err) {
      console.error('[work-patterns]', err);
    }

    res.json(patterns);
  })
);

// ────────────────────────────────────────────────────────────────────────────
// L4: Intelligent Auto-Triage
// ────────────────────────────────────────────────────────────────────────────
router.post(
  '/inbox/auto-triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const thresholdRaw = Number(req.body?.threshold);
    const threshold =
      Number.isFinite(thresholdRaw) && thresholdRaw >= 0.5 && thresholdRaw <= 0.99
        ? thresholdRaw
        : 0.85;

    const suggestions: any[] = [];
    const triagedKeys = new Set(
      (
        (await queryHelpers.queryAll<{ item_key: string }>(
          `SELECT item_key FROM my_work_inbox_triage WHERE user_id = ?`,
          [userId]
        )) || []
      ).map((row) => String(row.item_key))
    );

    const notifCols = await getTableColumns('notifications');
    if (notifCols.size > 0) {
      const readExpr = notifCols.has('read') ? 'COALESCE(n.read, 0)' : '0';
      const notificationItems = await queryHelpers.queryAll<any>(
        `SELECT n.id, n.title, n.message, n.type, n.priority, n.created_at
         FROM notifications n
         WHERE n.user_id = ? AND n.organization_id = ? AND ${readExpr} = 0
         ORDER BY n.created_at DESC LIMIT 20`,
        [userId, orgId]
      );

      for (const item of notificationItems || []) {
        const itemKey = `notification:${item.id}`;
        if (triagedKeys.has(itemKey)) continue;
        const text = `${item.title || ''} ${item.message || ''}`.toLowerCase();
        let action: TriageAction = 'accept_today';
        let confidence = 0.55;
        let reason = 'Default attention rule';

        if (
          item.priority === 'critical' ||
          item.priority === 'high' ||
          text.includes('urgent') ||
          text.includes('asap')
        ) {
          action = 'accept_today';
          confidence = 0.9;
          reason = 'High-priority notification requires same-day attention';
        } else if (
          item.priority === 'low' ||
          text.includes('fyi') ||
          text.includes('for your information') ||
          text.includes('newsletter')
        ) {
          action = 'archive';
          confidence = 0.82;
          reason = 'Informational notification can be archived';
        } else if (
          text.includes('review') ||
          text.includes('feedback') ||
          text.includes('mention')
        ) {
          action = 'accept_week';
          confidence = 0.74;
          reason = 'Review-style item fits this-week planning';
        }

        suggestions.push({
          itemId: item.id,
          itemKey,
          title: item.title,
          suggestedAction: action,
          confidence,
          reason,
          sourceType: 'notification',
          autoApply: confidence >= threshold,
        });
      }
    }

    const taskItems = await queryHelpers.queryAll<any>(
      `SELECT t.id, t.title, t.description, t.priority, t.due_date, t.estimated_hours
       FROM tasks t
       WHERE t.organization_id = ? AND t.assignee_id = ?
         AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated','cancelled')
       ORDER BY COALESCE(t.due_date, '9999-12-31') ASC, t.updated_at DESC
       LIMIT 20`,
      [orgId, userId]
    );
    for (const item of taskItems || []) {
      const itemKey = `task:${item.id}`;
      if (triagedKeys.has(itemKey)) continue;
      const dueTs = item.due_date ? new Date(item.due_date).getTime() : Number.NaN;
      const daysToDue = Number.isFinite(dueTs)
        ? (dueTs - Date.now()) / 86400000
        : Number.POSITIVE_INFINITY;
      const priority = String(item.priority || '').toLowerCase();
      let action: TriageAction = 'accept_later';
      let confidence = 0.62;
      let reason = 'Default task planning rule';

      if (daysToDue <= 1 || priority === 'critical' || priority === 'urgent') {
        action = 'accept_today';
        confidence = 0.93;
        reason = 'Overdue, near-due, or critical task should land in Today';
      } else if (daysToDue <= 7 || priority === 'high') {
        action = 'accept_week';
        confidence = 0.81;
        reason = 'Upcoming or high-priority task should be planned this week';
      }

      suggestions.push({
        itemId: item.id,
        itemKey,
        title: item.title,
        suggestedAction: action,
        confidence,
        reason,
        sourceType: 'task',
        autoApply: confidence >= threshold,
      });
    }

    const decisionItems = await queryHelpers.queryAll<any>(
      `SELECT d.id, d.title, d.description, d.priority, d.deadline,
              CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as days_waiting
       FROM decisions d
       WHERE d.organization_id = ?
         AND (d.decision_maker_id = ? OR d.created_by = ?)
         AND upper(coalesce(d.status,'')) IN ('PENDING','ESCALATED')
       ORDER BY COALESCE(d.deadline, '9999-12-31') ASC, d.created_at ASC
       LIMIT 20`,
      [orgId, userId, userId]
    );
    for (const item of decisionItems || []) {
      const itemKey = `decision:${item.id}`;
      if (triagedKeys.has(itemKey)) continue;
      const priority = String(item.priority || '').toLowerCase();
      const waiting = Number(item.days_waiting || 0);
      let action: TriageAction = 'accept_week';
      let confidence = 0.73;
      let reason = 'Pending decision should stay visible this week';

      if (waiting >= 3 || priority === 'critical' || priority === 'high') {
        action = 'accept_today';
        confidence = 0.88;
        reason = 'Aging or high-priority decision should be handled today';
      }

      suggestions.push({
        itemId: item.id,
        itemKey,
        title: item.title,
        suggestedAction: action,
        confidence,
        reason,
        sourceType: 'decision',
        autoApply: confidence >= threshold,
      });
    }

    res.json({ suggestions, totalUntriaged: suggestions.length, threshold });
  })
);

// ────────────────────────────────────────────────────────────────────────────
// L4b: Inbox Preview AI Assist (LLM)
// ────────────────────────────────────────────────────────────────────────────
router.post(
  '/inbox/ai-assist',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const body = req.body || {};
    const payload = InboxAiAssistItemSchema.safeParse(body.item);
    if (!payload.success) {
      return res.status(400).json({ error: 'Invalid item payload' });
    }

    try {
      const result = await runInboxAiAssist({
        organizationId: orgId,
        language: body.language,
        item: payload.data,
      });
      return res.json({ result });
    } catch (err: any) {
      logger.error('[InboxAIAssist] Failed:', err);
      return res.status(503).json({ error: 'AI assist unavailable', message: err?.message });
    }
  })
);

// ────────────────────────────────────────────────────────────────────────────
// V4-INBX-04: Evals dla AI triage (accuracy na golden set) + cost controls
// ────────────────────────────────────────────────────────────────────────────
router.get(
  '/inbox/evals/golden-set',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const rows = await queryHelpers.queryAll<{
      id: string;
      item_key: string;
      expected_action: string;
      expected_reason: string | null;
    }>(
      `SELECT id, item_key, expected_action, expected_reason FROM inbox_ai_eval_golden_set WHERE organization_id = ?`,
      [orgId]
    );
    res.json({ items: rows || [] });
  })
);

router.post(
  '/inbox/evals/golden-set',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;
    const { itemKey, itemSnapshot, expectedAction, expectedReason } = req.body || {};
    if (!itemKey || !expectedAction) {
      return res.status(400).json({ error: 'itemKey and expectedAction required' });
    }
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO inbox_ai_eval_golden_set (id, organization_id, item_key, item_snapshot_json, expected_action, expected_reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, item_key) DO UPDATE SET
         item_snapshot_json = excluded.item_snapshot_json,
         expected_action = excluded.expected_action,
         expected_reason = excluded.expected_reason`,
      [
        id,
        orgId,
        String(itemKey),
        itemSnapshot ? JSON.stringify(itemSnapshot) : null,
        String(expectedAction),
        expectedReason ? String(expectedReason) : null,
        userId,
      ]
    );
    res.status(201).json({ success: true, id });
  })
);

router.post(
  '/inbox/evals/run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    if (!(await requireTables(res, ['inbox_ai_eval_golden_set']))) return;

    const golden = await queryHelpers.queryAll<{
      item_key: string;
      item_snapshot_json: string | null;
      expected_action: string;
    }>(
      `SELECT item_key, item_snapshot_json, expected_action FROM inbox_ai_eval_golden_set WHERE organization_id = ?`,
      [orgId]
    );

    if (!golden?.length) {
      return res.json({ success: true, totalItems: 0, correct: 0, accuracy: 0, costUsd: 0 });
    }

    let correct = 0;
    let costUsd = 0;
    const { llmService } = await import('../services/ai/llmService.js');
    const modelRouter = (await import('../services/ai/modelRouter.js')).default;
    const modelCfg = await modelRouter.select({
      capability: 'chat',
      organizationId: orgId,
      options: { tier: 'STANDARD' },
    });
    const outSchema = z.object({
      recommendedAction: z.enum([
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
      ]),
    });

    for (const g of golden) {
      const snapshot = g.item_snapshot_json ? JSON.parse(g.item_snapshot_json) : {};
      try {
        const r = await llmService.call({
          type: 'structured',
          schema: outSchema,
          modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
          systemPrompt: 'Return only valid JSON with recommendedAction.',
          messages: [
            {
              role: 'user',
              content: `Item: ${JSON.stringify(snapshot.title || g.item_key)}. Context: ${JSON.stringify(snapshot).slice(0, 1500)}. Return JSON with recommendedAction.`,
            },
          ],
          temperature: 0.1,
          maxTokens: 100,
        });
        const obj = (r as any)?.object;
        const parsed = outSchema.safeParse(obj);
        const predicted = parsed.success ? parsed.data.recommendedAction : null;
        if (predicted === g.expected_action) correct++;
      } catch (_e) {
        // skip failed item
      }
    }
    const costRow = await queryHelpers.queryOne<{ cost: number }>(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) as cost FROM ai_usage_logs
       WHERE organization_id = ? AND (action = 'inbox_ai_triage' OR purpose = 'inbox_triage')
       AND created_at >= datetime('now', '-1 hour')`,
      [orgId]
    );
    costUsd = Number(costRow?.cost || 0);

    const runId = uuidv4();
    const accuracy = golden.length > 0 ? correct / golden.length : 0;
    await queryHelpers.queryRun(
      `INSERT INTO inbox_ai_eval_runs (id, organization_id, ran_at, total_items, correct, accuracy, cost_usd, model_id)
       VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?)`,
      [runId, orgId, golden.length, correct, accuracy, costUsd, modelCfg?.id || null]
    );

    res.json({
      success: true,
      runId,
      totalItems: golden.length,
      correct,
      accuracy: Math.round(accuracy * 1000) / 1000,
      costUsd,
    });
  })
);

router.get(
  '/inbox/evals/runs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const limit = Math.min(50, parseInt(String(req.query.limit || '20'), 10) || 20);
    const rows = await queryHelpers.queryAll<{
      id: string;
      ran_at: string;
      total_items: number;
      correct: number;
      accuracy: number;
      cost_usd: number | null;
    }>(
      `SELECT id, ran_at, total_items, correct, accuracy, cost_usd FROM inbox_ai_eval_runs
       WHERE organization_id = ? ORDER BY ran_at DESC LIMIT ?`,
      [orgId, limit]
    );
    res.json({ runs: rows || [] });
  })
);

router.get(
  '/inbox/evals/cost-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const days = Math.min(90, parseInt(String(req.query.days || '30'), 10) || 30);
    const modifier = `-${days} days`;
    const row = await queryHelpers.queryOne<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) as total, COUNT(*) as count FROM ai_usage_logs
       WHERE organization_id = ? AND (action = 'inbox_ai_triage' OR purpose = 'inbox_triage')
       AND created_at >= datetime('now', ?)`,
      [orgId, modifier]
    );
    res.json({
      totalCostUsd: Number(row?.total || 0),
      callCount: Number(row?.count || 0),
      days,
    });
  })
);

// ────────────────────────────────────────────────────────────────────────────
// V4-INBX-06: Routing rules for connectors
// ────────────────────────────────────────────────────────────────────────────
router.get(
  '/inbox/routing-rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const rows = await queryHelpers.queryAll<{
      id: string;
      channel: string;
      conditions_json: string | null;
      target_user_id: string | null;
      target_project_id: string | null;
      priority: number;
      is_active: number;
    }>(
      `SELECT id, channel, conditions_json, target_user_id, target_project_id, priority, is_active
       FROM inbox_routing_rules WHERE organization_id = ? ORDER BY priority DESC`,
      [orgId]
    );
    res.json({ rules: rows || [] });
  })
);

router.put(
  '/inbox/routing-rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    if (!(await requireTables(res, ['inbox_routing_rules']))) return;
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : [];
    for (const r of rules) {
      const id = r.id || uuidv4();
      const channel = String(r.channel || 'slack').toLowerCase();
      const conditions = r.conditions ? JSON.stringify(r.conditions) : null;
      const targetUserId = r.targetUserId || null;
      const targetProjectId = r.targetProjectId || null;
      const priority = Number(r.priority) || 0;
      const isActive = r.isActive !== false ? 1 : 0;
      await queryHelpers.queryRun(
        `INSERT INTO inbox_routing_rules (id, organization_id, channel, conditions_json, target_user_id, target_project_id, priority, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET
           channel = excluded.channel,
           conditions_json = excluded.conditions_json,
           target_user_id = excluded.target_user_id,
           target_project_id = excluded.target_project_id,
           priority = excluded.priority,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at`,
        [id, orgId, channel, conditions, targetUserId, targetProjectId, priority, isActive]
      );
    }
    res.json({ success: true });
  })
);

// ────────────────────────────────────────────────────────────────────────────
// V4-INBX-07: Executive analytics z real capacity (allocations) i initiatives linkage
// ────────────────────────────────────────────────────────────────────────────
router.get(
  '/executive-analytics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const projectId = String(req.query.projectId || '');
    if (!projectId) {
      const [capacityOverview, overloads, initiativeSummary, initiativeBreakdown] =
        await Promise.all([
          getCapacityOverview(orgId),
          getOverloadAlerts(orgId),
          queryHelpers.queryOne<{ total: number; executing: number; blocked: number }>(
            `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN UPPER(status) IN ('EXECUTING','ACTIVE','IN_PROGRESS') THEN 1 ELSE 0 END) as executing,
             SUM(CASE WHEN UPPER(status) = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
           FROM initiatives
           WHERE organization_id = ?`,
            [orgId]
          ),
          queryHelpers.queryAll<{
            id: string;
            name: string;
            status: string;
            total_tasks: number;
            open_tasks: number;
            overdue_tasks: number;
          }>(
            `SELECT i.id, i.name, i.status,
                  COUNT(t.id) as total_tasks,
                  SUM(CASE WHEN lower(coalesce(t.status,'')) NOT IN ('done','completed','validated','cancelled') THEN 1 ELSE 0 END) as open_tasks,
                  SUM(CASE WHEN t.due_date IS NOT NULL
                             AND datetime(t.due_date) < datetime('now')
                             AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated','cancelled')
                           THEN 1 ELSE 0 END) as overdue_tasks
           FROM initiatives i
           LEFT JOIN tasks t ON t.initiative_id = i.id AND t.organization_id = i.organization_id
           WHERE i.organization_id = ?
           GROUP BY i.id, i.name, i.status
           ORDER BY overdue_tasks DESC, open_tasks DESC, i.updated_at DESC
           LIMIT 6`,
            [orgId]
          ),
        ]);

      const totalRequired = Number(capacityOverview.summary.totalAllocated || 0);
      const totalCapacity = Number(capacityOverview.summary.totalCapacity || 0);
      return res.json({
        projectId: null,
        capacity: {
          totalTeamCapacityHours: totalCapacity,
          totalRequiredHours: totalRequired,
          shortfallHours: Math.max(0, Math.round((totalRequired - totalCapacity) * 10) / 10),
          avgUtilization: capacityOverview.summary.avgUtilization,
        },
        initiatives: {
          total: Number(initiativeSummary?.total || 0),
          executing: Number(initiativeSummary?.executing || 0),
          blocked: Number(initiativeSummary?.blocked || 0),
        },
        initiativeBreakdown: (initiativeBreakdown || []).map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          tasksTotal: Number(row.total_tasks || 0),
          tasksOpen: Number(row.open_tasks || 0),
          overdueCount: Number(row.overdue_tasks || 0),
          completionPct:
            Number(row.total_tasks || 0) > 0
              ? Math.round(
                  ((Number(row.total_tasks || 0) - Number(row.open_tasks || 0)) /
                    Number(row.total_tasks || 0)) *
                    100
                )
              : 0,
        })),
        overloads: overloads.map((row) => ({
          userId: row.userId,
          assignedHours: row.allocatedHours,
          capacityHours: row.capacityHours,
          overloadHours: row.overloadHours,
          severity: row.severity,
          name: row.name,
        })),
      });
    }

    const DEFAULT_WEEKLY_HOURS = 40;
    const [capacityRow, initiativeRow, overloadRows] = await Promise.all([
      queryHelpers.queryOne<{ cap: number }>(
        `SELECT COALESCE(SUM((COALESCE(pm.allocation_percent, 100) / 100.0) * ?), 0) as cap
         FROM project_members pm WHERE pm.project_id = ?`,
        [DEFAULT_WEEKLY_HOURS, projectId]
      ),
      queryHelpers.queryOne<{ executing: number; blocked: number; total: number }>(
        `SELECT
           SUM(CASE WHEN UPPER(status) = 'EXECUTING' THEN 1 ELSE 0 END) as executing,
           SUM(CASE WHEN UPPER(status) = 'BLOCKED' THEN 1 ELSE 0 END) as blocked,
           COUNT(*) as total
         FROM initiatives WHERE project_id = ? AND organization_id = ?`,
        [projectId, orgId]
      ),
      queryHelpers.queryAll<{
        user_id: string;
        assigned: number;
        capacity: number;
        overload: number;
      }>(
        `SELECT m.user_id,
          COALESCE(SUM(t.estimated_hours), 0) as assigned,
          (COALESCE(m.allocation_percent, 100) / 100.0) * ? as capacity,
          COALESCE(SUM(t.estimated_hours), 0) - ((COALESCE(m.allocation_percent, 100) / 100.0) * ?) as overload
         FROM project_members m
         LEFT JOIN tasks t ON t.assignee_id = m.user_id AND t.project_id = m.project_id
           AND LOWER(COALESCE(t.status,'')) NOT IN ('done','completed','validated','cancelled')
         WHERE m.project_id = ?
         GROUP BY m.user_id HAVING overload > 0`,
        [DEFAULT_WEEKLY_HOURS, DEFAULT_WEEKLY_HOURS, projectId]
      ),
    ]);

    const totalCapacity = Number(capacityRow?.cap || 0);
    const required = await queryHelpers.queryOne<{ hours: number }>(
      `SELECT COALESCE(SUM(estimated_hours), 0) as hours FROM tasks
       WHERE project_id = ? AND organization_id = ? AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','validated','cancelled')`,
      [projectId, orgId]
    );
    const totalRequired = Number(required?.hours || 0);
    const shortfall = Math.max(0, totalRequired - totalCapacity);

    res.json({
      projectId,
      capacity: {
        totalTeamCapacityHours: Math.round(totalCapacity * 10) / 10,
        totalRequiredHours: Math.round(totalRequired * 10) / 10,
        shortfallHours: Math.round(shortfall * 10) / 10,
      },
      initiatives: {
        total: Number(initiativeRow?.total || 0),
        executing: Number(initiativeRow?.executing || 0),
        blocked: Number(initiativeRow?.blocked || 0),
      },
      overloads: (overloadRows || []).map((r) => ({
        userId: r.user_id,
        assignedHours: Math.round(Number(r.assigned) * 10) / 10,
        capacityHours: Math.round(Number(r.capacity) * 10) / 10,
        overloadHours: Math.round(Math.max(0, Number(r.overload)) * 10) / 10,
      })),
    });
  })
);

// ────────────────────────────────────────────────────────────────────────────
// V4-TASK-05: Automation rules engine (stub — triggers, conditions, actions)
// ────────────────────────────────────────────────────────────────────────────
router.get(
  '/automation-rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    if (!(await requireTables(res, ['task_automation_rules']))) return res.json({ rules: [] });
    const rows = await queryHelpers.queryAll<{
      id: string;
      name: string;
      trigger_type: string;
      conditions_json: string | null;
      actions_json: string;
      is_active: number;
    }>(
      `SELECT id, name, trigger_type, conditions_json, actions_json, is_active
       FROM task_automation_rules WHERE organization_id = ? ORDER BY created_at DESC`,
      [orgId]
    );
    res.json({
      rules: (rows || []).map((r) => ({
        id: r.id,
        name: r.name,
        triggerType: r.trigger_type,
        conditions: r.conditions_json ? JSON.parse(r.conditions_json) : [],
        actions: JSON.parse(r.actions_json || '[]'),
        isActive: Boolean(r.is_active),
      })),
    });
  })
);

router.post(
  '/automation-rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;
    if (!(await requireTables(res, ['task_automation_rules'])))
      return res.status(503).json({ error: 'Schema not ready' });
    const name = String(req.body?.name || 'Rule').trim();
    const triggerType = String(req.body?.triggerType || req.body?.trigger_type || 'manual');
    const conditions = req.body?.conditions;
    const actions = req.body?.actions;
    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'actions array required' });
    }
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO task_automation_rules (id, organization_id, name, trigger_type, trigger_config_json, conditions_json, actions_json, is_active, created_by, updated_at)
       VALUES (?, ?, ?, ?, '{}', ?, ?, 1, ?, datetime('now'))`,
      [
        id,
        orgId,
        name,
        triggerType,
        JSON.stringify(Array.isArray(conditions) ? conditions : []),
        JSON.stringify(actions),
        userId,
      ]
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/automation-rules/:ruleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    if (!(await requireTables(res, ['task_automation_rules'])))
      return res.status(503).json({ error: 'Schema not ready' });

    const { ruleId } = req.params;
    const { updateRule } = await import('../services/automationRulesService.js');
    const updated = await updateRule(ruleId, orgId, req.body);
    if (!updated) return res.status(404).json({ error: 'Rule not found' });

    res.json({
      success: true,
      rule: {
        id: updated.id,
        name: updated.name,
        triggerType: updated.triggerType,
        conditions: updated.conditions,
        actions: updated.actions,
        isActive: updated.isActive,
      },
    });
  })
);

router.delete(
  '/automation-rules/:ruleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    if (!(await requireTables(res, ['task_automation_rules'])))
      return res.status(503).json({ error: 'Schema not ready' });

    const { ruleId } = req.params;
    const { deleteRule } = await import('../services/automationRulesService.js');
    const deleted = await deleteRule(ruleId, orgId);
    if (!deleted) return res.status(404).json({ error: 'Rule not found' });

    res.json({ success: true });
  })
);

router.post(
  '/automation-rules/:ruleId/dry-run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    if (!(await requireTables(res, ['task_automation_rules'])))
      return res.status(503).json({ error: 'Schema not ready' });

    const { ruleId } = req.params;
    const context = req.body?.context;
    if (!context || typeof context !== 'object') {
      return res.status(400).json({ error: 'context object required in body' });
    }

    const { getRuleById, dryRunRule } = await import('../services/automationRulesService.js');
    const rule = await getRuleById(ruleId, orgId);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const result = dryRunRule(rule, context as Record<string, unknown>);
    res.json(result);
  })
);

router.post(
  '/automation-rules/:ruleId/test',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    if (!(await requireTables(res, ['task_automation_rules'])))
      return res.status(503).json({ error: 'Schema not ready' });

    const { ruleId } = req.params;
    const taskId = req.body?.taskId as string;
    if (!taskId) return res.status(400).json({ error: 'taskId required in body' });

    const { getRuleById, dryRunRule } = await import('../services/automationRulesService.js');
    const rule = await getRuleById(ruleId, orgId);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const task = await queryHelpers.queryOne<Record<string, unknown>>(
      `SELECT * FROM tasks WHERE id = ? AND organization_id = ?`,
      [taskId, orgId]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const context: Record<string, unknown> = {
      taskId: task.id,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assignee_id,
      title: task.title,
      dueDate: task.due_date,
    };

    const result = dryRunRule(rule, context);
    res.json({ ...result, task: { id: task.id, title: task.title, status: task.status } });
  })
);

// ────────────────────────────────────────────────────────────────────────────
// L4c: Tasks Preview AI Text (LLM) — details/actions hints
// ────────────────────────────────────────────────────────────────────────────
router.post(
  '/tasks/ai-text',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const body = req.body || {};
    const language = String(body.language || 'pl')
      .toLowerCase()
      .startsWith('pl')
      ? 'pl'
      : 'en';

    const inputSchema = z.object({
      language: z.string().optional(),
      intent: z.enum(['why_urgent', 'plan', 'who_can_help', 'expand_details', 'summarize_details']),
      task: z.object({
        title: z.string().min(1).max(400),
        description: z.string().max(8000).optional().nullable(),
        status: z.string().max(64).optional().nullable(),
        priority: z.string().max(64).optional().nullable(),
        dueDate: z.string().max(64).optional().nullable(),
        projectName: z.string().max(200).optional().nullable(),
        initiativeName: z.string().max(200).optional().nullable(),
      }),
    });

    const payload = inputSchema.safeParse({
      language,
      intent: body.intent,
      task: body.task,
    });
    if (!payload.success) {
      return res.status(400).json({ error: 'Invalid task payload' });
    }

    const { intent, task } = payload.data;

    const outSchema = z.object({
      text: z.string().min(1).max(1200),
    });

    const intentPrompt = (lang: 'pl' | 'en') => {
      const baseContext =
        lang === 'pl'
          ? `Użytkownik ogląda zadanie w Preview (MyWork → Zadania).
Nie powtarzaj tytułu. Odpowiedz zwięźle i konkretnie.

Dane zadania:
- title: ${JSON.stringify(task.title)}
- status: ${JSON.stringify(task.status || '')}
- priority: ${JSON.stringify(task.priority || '')}
- dueDate: ${JSON.stringify(task.dueDate || '')}
- projectName: ${JSON.stringify(task.projectName || '')}
- initiativeName: ${JSON.stringify(task.initiativeName || '')}
- description: ${JSON.stringify(String(task.description || '').slice(0, 2500))}
`
          : `The user is viewing a Task in the Preview pane (MyWork → Tasks).
Do not repeat the title. Be concise and specific.

Task data:
- title: ${JSON.stringify(task.title)}
- status: ${JSON.stringify(task.status || '')}
- priority: ${JSON.stringify(task.priority || '')}
- dueDate: ${JSON.stringify(task.dueDate || '')}
- projectName: ${JSON.stringify(task.projectName || '')}
- initiativeName: ${JSON.stringify(task.initiativeName || '')}
- description: ${JSON.stringify(String(task.description || '').slice(0, 2500))}
`;

      const ask =
        lang === 'pl'
          ? intent === 'why_urgent'
            ? `Zadanie: odpowiedz w 2–4 zdaniach dlaczego to zadanie może być pilne i jaki jest największy risk, jeśli nie zrobimy go teraz.`
            : intent === 'plan'
              ? `Zadanie: zaproponuj plan działania w 3–6 punktach (krótkie, wykonawcze kroki).`
              : intent === 'who_can_help'
                ? `Zadanie: wskaż 3–5 ról/osób, które mogą pomóc (np. DevOps, PM, Data Owner), oraz co dokładnie od nich potrzebujemy.`
                : intent === 'expand_details'
                  ? `Zadanie: rozwiń opis do jasnego brifu (max 10 zdań): kontekst, cel, definicja “done”, ryzyka, następny krok.`
                  : `Zadanie: podsumuj opis do krótkiego brifu (max 3 zdania) + 3 bullet points "next steps".`
          : intent === 'why_urgent'
            ? `Task: in 2–4 sentences explain why this may be urgent and the biggest risk if we delay it.`
            : intent === 'plan'
              ? `Task: propose an action plan in 3–6 bullets (short, executable steps).`
              : intent === 'who_can_help'
                ? `Task: suggest 3–5 roles/people who can help and what we need from them.`
                : intent === 'expand_details'
                  ? `Task: expand into a clear brief (max 10 sentences): context, goal, definition of done, risks, next step.`
                  : `Task: summarize into a short brief (max 3 sentences) + 3 "next steps" bullets.`;

      return `${baseContext}\n${ask}\n\nZwróć TYLKO JSON {"text":"..."} bez markdown i bez dodatkowego tekstu.`;
    };

    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      const prompt = intentPrompt(language);

      const r = await llmService.call({
        type: 'structured',
        schema: outSchema,
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt:
          language === 'pl'
            ? 'Jesteś asystentem wykonawczym. Odpowiadasz krótko i praktycznie. Zwracasz wyłącznie poprawny JSON.'
            : 'You are an execution assistant. Be concise and practical. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 700,
        timeoutMs: 12000,
        breakerOptions: { retryAttempts: 1 },
      });

      const object = (r as any)?.object;
      const parsed = outSchema.safeParse(object);
      if (!parsed.success) {
        return res.status(500).json({ error: 'AI response invalid' });
      }

      return res.json({ result: parsed.data });
    } catch (err: any) {
      logger.error('[TasksAIText] Failed:', err);
      return res.status(503).json({ error: 'AI assist unavailable', message: err?.message });
    }
  })
);

// ============================================================================
// L5: AI Delegation Advisor
// ============================================================================

router.get(
  '/delegation-suggestions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const taskId = String(req.query.taskId || '').trim();

    const suggestions: any[] = [];

    try {
      const teamMembers = await queryHelpers.queryAll<any>(
        `SELECT u.id, u.name, u.email,
          (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.organization_id = ? AND t.status NOT IN ('done', 'completed')) as open_tasks
         FROM users u
         WHERE u.organization_id = ? AND u.id != ? AND u.is_active = 1
         ORDER BY open_tasks ASC
         LIMIT 10`,
        [orgId, orgId, userId]
      );

      let taskContext: any = null;
      if (taskId) {
        taskContext = await queryHelpers.queryOne<any>(
          `SELECT title, description, tags, initiative_id, project_id FROM tasks WHERE id = ? AND organization_id = ?`,
          [taskId, orgId]
        );
      }

      for (const member of teamMembers || []) {
        let score = 100 - (member.open_tasks || 0) * 10;
        const reasons: string[] = [];

        if (member.open_tasks < 5) {
          reasons.push(`Has capacity (${member.open_tasks} open tasks)`);
          score += 20;
        } else if (member.open_tasks < 10) {
          reasons.push(`Moderate load (${member.open_tasks} open tasks)`);
        } else {
          reasons.push(`Heavy load (${member.open_tasks} open tasks)`);
          score -= 20;
        }

        if (taskContext?.initiative_id) {
          const sameInit = await queryHelpers.queryOne<any>(
            `SELECT COUNT(*) as cnt FROM tasks WHERE assignee_id = ? AND initiative_id = ? AND organization_id = ?`,
            [member.id, taskContext.initiative_id, orgId]
          );
          if (sameInit?.cnt > 0) {
            reasons.push('Works on same initiative');
            score += 15;
          }
        }

        const prevDelegations = await queryHelpers.queryOne<any>(
          `SELECT COUNT(*) as cnt FROM tasks WHERE assignee_id = ? AND reporter_id = ? AND organization_id = ?`,
          [member.id, userId, orgId]
        );
        if (prevDelegations?.cnt > 2) {
          reasons.push(`Previously delegated ${prevDelegations.cnt} tasks to`);
          score += 10;
        }

        suggestions.push({
          userId: member.id,
          name: member.name || member.email || 'Unknown',
          email: member.email,
          openTasks: member.open_tasks,
          score: Math.max(0, Math.min(100, score)),
          reasons,
        });
      }

      suggestions.sort((a, b) => b.score - a.score);
    } catch (err) {
      logger.error('[delegation-suggestions]', err);
    }

    res.json({ suggestions: suggestions.slice(0, 5) });
  })
);

// ============================================================================
// L6: Predictive Focus Planning
// ============================================================================

router.post(
  '/focus/ai-plan',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const plan: any = { generatedAt: new Date().toISOString(), blocks: [] };

    try {
      const tasks = await queryHelpers.queryAll<any>(
        `SELECT id, title, status, priority, due_date, estimated_hours
         FROM tasks
         WHERE assignee_id = ? AND organization_id = ? AND status NOT IN ('done', 'completed')
         ORDER BY
           CASE WHEN due_date IS NOT NULL AND due_date < datetime('now') THEN 0 ELSE 1 END,
           CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           due_date ASC NULLS LAST
         LIMIT 15`,
        [userId, orgId]
      );

      const decisions = await queryHelpers.queryAll<any>(
        `SELECT id, title, priority, deadline
         FROM decisions
         WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ? AND status = 'pending'
         ORDER BY deadline ASC NULLS LAST
         LIMIT 5`,
        [userId, userId, orgId]
      );

      const timeSlots = [
        { start: '09:00', label: 'Deep Work', type: 'deep', hours: 2 },
        { start: '11:00', label: 'Decisions & Reviews', type: 'review', hours: 1.5 },
        { start: '13:00', label: 'Collaborative Work', type: 'collab', hours: 2 },
        { start: '15:00', label: 'Admin & Follow-ups', type: 'admin', hours: 1.5 },
        { start: '16:30', label: 'Planning & Wrap-up', type: 'plan', hours: 1 },
      ];

      const urgentTasks = (tasks || []).filter(
        (t: any) =>
          ['urgent', 'high'].includes(t.priority) ||
          (t.due_date && new Date(t.due_date) < new Date(Date.now() + 86400000))
      );
      const regularTasks = (tasks || []).filter((t: any) => !urgentTasks.includes(t));

      plan.blocks.push({
        ...timeSlots[0],
        items: urgentTasks.slice(0, 3).map((t: any) => ({
          type: 'task',
          id: t.id,
          title: t.title,
          estimatedHours: t.estimated_hours || 1,
        })),
      });

      plan.blocks.push({
        ...timeSlots[1],
        items: (decisions || []).slice(0, 4).map((d: any) => ({
          type: 'decision',
          id: d.id,
          title: d.title,
          estimatedHours: 0.25,
        })),
      });

      plan.blocks.push({
        ...timeSlots[2],
        items: regularTasks.slice(0, 3).map((t: any) => ({
          type: 'task',
          id: t.id,
          title: t.title,
          estimatedHours: t.estimated_hours || 1,
        })),
      });

      plan.blocks.push({
        ...timeSlots[3],
        items: regularTasks.slice(3, 5).map((t: any) => ({
          type: 'task',
          id: t.id,
          title: t.title,
          estimatedHours: 0.5,
        })),
      });

      plan.blocks.push({
        ...timeSlots[4],
        items: [
          { type: 'meta', title: "Review today's progress and plan tomorrow", estimatedHours: 0.5 },
        ],
      });

      plan.totalItems = (tasks || []).length + (decisions || []).length;
      plan.summary = `${urgentTasks.length} urgent items for deep work, ${(decisions || []).length} decisions to review, ${regularTasks.length} regular tasks planned.`;
    } catch (err) {
      logger.error('[focus-ai-plan]', err);
    }

    res.json(plan);
  })
);

// ============================================================================
// L7: Context Carry-over — Session Context for MyWork
// ============================================================================

router.post(
  '/session-context',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const { lastViewedItems, activeTab, chatTopics } = req.body || {};
    const contextData = JSON.stringify({
      lastViewedItems: (lastViewedItems || []).slice(0, 10),
      activeTab,
      chatTopics: (chatTopics || []).slice(0, 5),
      savedAt: new Date().toISOString(),
    });

    try {
      const updateResult = await queryHelpers.queryRun(
        `UPDATE my_work_session_context
         SET context_data = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND organization_id = ?`,
        [contextData, userId, orgId]
      );

      if ((updateResult?.changes || 0) === 0) {
        await queryHelpers.queryRun(
          `INSERT INTO my_work_session_context (user_id, organization_id, context_data, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [userId, orgId, contextData]
        );
      }

      res.json({ saved: true });
    } catch (err: any) {
      if (
        String(err?.message || '')
          .toLowerCase()
          .includes('duplicate key')
      ) {
        await queryHelpers.queryRun(
          `UPDATE my_work_session_context
           SET context_data = ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND organization_id = ?`,
          [contextData, userId, orgId]
        );
        return res.json({ saved: true });
      }
      logger.error('[session-context:save]', err);
      res.json({ saved: false });
    }
  })
);

router.get(
  '/session-context',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    try {
      const row = await queryHelpers.queryOne<any>(
        `SELECT context_data, updated_at FROM my_work_session_context
         WHERE user_id = ? AND organization_id = ? LIMIT 1`,
        [userId, orgId]
      );

      if (!row) return res.json({ context: null });

      const context = JSON.parse(row.context_data || '{}');
      context.lastSessionAt = row.updated_at;
      res.json({ context });
    } catch (err) {
      logger.error('[session-context:get]', err);
      res.json({ context: null });
    }
  })
);

// ============================================================================
// L8: AI Relationships Graph — Semantic Matching
// ============================================================================

router.get(
  '/relationships',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const entityId = String(req.query.entityId || '').trim();
    const entityType = String(req.query.entityType || '').trim();
    if (!entityId) return res.status(400).json({ error: 'entityId is required' });

    const relationships: any[] = [];

    try {
      let sourceTitle = '';

      if (entityType === 'task') {
        const task = await queryHelpers.queryOne<any>(
          `SELECT title, tags, initiative_id, project_id FROM tasks WHERE id = ? AND organization_id = ?`,
          [entityId, orgId]
        );
        sourceTitle = task?.title || '';

        if (task?.initiative_id) {
          const related = await queryHelpers.queryAll<any>(
            `SELECT id, title, status FROM tasks WHERE initiative_id = ? AND organization_id = ? AND id != ? LIMIT 5`,
            [task.initiative_id, orgId, entityId]
          );
          for (const r of related || []) {
            relationships.push({
              type: 'task',
              id: r.id,
              title: r.title,
              relationship: 'same_initiative',
              strength: 0.8,
            });
          }
        }

        const titleWords = sourceTitle.split(' ').slice(0, 2).join('%');
        if (titleWords) {
          const blockingDecs = await queryHelpers.queryAll<any>(
            `SELECT id, title FROM decisions WHERE organization_id = ? AND status = 'pending' AND title LIKE ?`,
            [orgId, `%${titleWords}%`]
          );
          for (const d of blockingDecs || []) {
            relationships.push({
              type: 'decision',
              id: d.id,
              title: d.title,
              relationship: 'potentially_blocking',
              strength: 0.6,
            });
          }
        }
      } else if (entityType === 'idea') {
        const idea = await queryHelpers.queryOne<any>(
          `SELECT title, body FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ?`,
          [entityId, userId, orgId]
        );
        sourceTitle = idea?.title || '';

        const keywords = sourceTitle
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
          .slice(0, 3);
        for (const kw of keywords) {
          const related = await queryHelpers.queryAll<any>(
            `SELECT id, title FROM my_ideas WHERE user_id = ? AND organization_id = ? AND id != ? AND title LIKE ? LIMIT 3`,
            [userId, orgId, entityId, `%${kw}%`]
          );
          for (const r of related || []) {
            if (!relationships.find((rel: any) => rel.id === r.id)) {
              relationships.push({
                type: 'idea',
                id: r.id,
                title: r.title,
                relationship: 'keyword_match',
                strength: 0.5,
              });
            }
          }
        }
      } else if (entityType === 'decision') {
        const dec = await queryHelpers.queryOne<any>(
          `SELECT title FROM decisions WHERE id = ? AND organization_id = ?`,
          [entityId, orgId]
        );
        sourceTitle = dec?.title || '';
      }

      if (sourceTitle) {
        const titleWords = sourceTitle
          .split(/\s+/)
          .filter((w: string) => w.length > 4)
          .slice(0, 2);
        for (const word of titleWords) {
          const pages = await queryHelpers.queryAll<any>(
            `SELECT id, title FROM notebook_pages WHERE user_id = ? AND organization_id = ? AND (title LIKE ? OR content_text LIKE ?) LIMIT 3`,
            [userId, orgId, `%${word}%`, `%${word}%`]
          );
          for (const p of pages || []) {
            if (!relationships.find((r: any) => r.id === p.id)) {
              relationships.push({
                type: 'notebook',
                id: p.id,
                title: p.title,
                relationship: 'mentioned_in',
                strength: 0.4,
              });
            }
          }
        }
      }

      relationships.sort((a, b) => b.strength - a.strength);
    } catch (err) {
      logger.error('[relationships]', err);
    }

    res.json({ entityId, entityType, relationships: relationships.slice(0, 15) });
  })
);

// ══════════════════════════════════════════════════════════════════════════════
// AI Suggestions for Idea Workspace
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/my-work/my-ideas/:id/ai-suggestions
 * Generate contextual AI suggestions grounded in company data.
 */
router.post(
  '/my-ideas/:id/ai-suggestions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    const context = req.body?.context || {};
    const mode = String(req.body?.mode || 'passive');
    const prompt = req.body?.prompt ? String(req.body.prompt) : undefined;
    const language = String(req.body?.language || req.query?.language || 'en');

    try {
      const { generateSuggestions } = await import('../services/ideaAISuggestionsService.js');
      const result = await generateSuggestions(
        ideaId,
        {
          title: String(context.title || ''),
          seedText: String(context.seedText || ''),
          currentNodes: Array.isArray(context.currentNodes) ? context.currentNodes : [],
          currentEdges: Array.isArray(context.currentEdges) ? context.currentEdges : [],
          activeTool: String(context.activeTool || 'table'),
        },
        mode as any,
        prompt,
        userId,
        orgId,
        queryHelpers,
        language
      );
      res.json(result);
    } catch (err: any) {
      logger.error('[ai-suggestions]', err);
      res.status(500).json({ error: err?.message || 'Failed to generate suggestions' });
    }
  })
);

/**
 * POST /api/my-work/my-ideas/:id/ai-table-action
 * Natural language -> table operation via structured LLM output.
 */
router.post(
  '/my-ideas/:id/ai-table-action',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const command = String(req.body?.command || '').trim();
    if (!command) return res.status(400).json({ error: 'Command required' });

    const tableSchema = Array.isArray(req.body?.schema) ? req.body.schema : [];
    const language = String(req.body?.language || 'en');

    try {
      const { generateTableAction } = await import('../services/ideaAISuggestionsService.js');
      const action = await generateTableAction(
        String(req.params.id),
        command,
        tableSchema,
        userId,
        orgId,
        language
      );
      res.json({ action });
    } catch (err: any) {
      logger.error('[ai-table-action]', err);
      res.status(500).json({ error: err?.message || 'Failed to process command' });
    }
  })
);

/**
 * POST /api/my-work/my-ideas/:id/ai-fill
 * AI auto-fill for ai_generated column type.
 */
router.post(
  '/my-ideas/:id/ai-fill',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const columnPrompt = String(req.body?.prompt || '').trim();
    if (!columnPrompt) return res.status(400).json({ error: 'Prompt required' });

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const language = String(req.body?.language || 'en');

    try {
      const { generateAIFill } = await import('../services/ideaAISuggestionsService.js');
      const results = await generateAIFill(
        columnPrompt,
        rows,
        userId,
        orgId,
        queryHelpers,
        language
      );
      res.json({ results });
    } catch (err: any) {
      logger.error('[ai-fill]', err);
      res.status(500).json({ error: err?.message || 'Failed to generate fill' });
    }
  })
);

// ═══════════════════════════════════════════
// Idea Table CSV Export (server-side)
// ═══════════════════════════════════════════

/**
 * GET /api/my-work/my-ideas/:id/export-csv
 * Server-side CSV export of the idea table data.
 */
router.get(
  '/my-ideas/:id/export-csv',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    try {
      const mapRow = await queryHelpers.queryOne<any>(
        `SELECT nodes_json, extensions_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
        [ideaId, userId, orgId]
      );
      if (!mapRow) return res.status(404).json({ error: 'Idea map not found' });

      let nodes: any[] = [];
      let extensions: any = {};
      try {
        nodes = JSON.parse(String(mapRow.nodes_json || '[]'));
      } catch {
        nodes = [];
      }
      try {
        extensions = JSON.parse(String(mapRow.extensions_json || '{}'));
      } catch {
        extensions = {};
      }

      const columns: Array<{ key: string; header: string; visible?: boolean }> = extensions?.table
        ?.columns || [{ key: 'label', header: 'Name' }];
      const visibleCols = columns.filter((c: any) => c.visible !== false);

      const escapeCSV = (val: string): string => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const headerLine = visibleCols.map((c: any) => escapeCSV(c.header || c.key)).join(',');
      const dataLines = nodes.map((node: any) =>
        visibleCols
          .map((col: any) => {
            const val = col.key === 'type' ? node.type || '' : (node.data?.[col.key] ?? '');
            if (Array.isArray(val)) return escapeCSV(val.join('; '));
            return escapeCSV(String(val));
          })
          .join(',')
      );

      const csv = '\uFEFF' + [headerLine, ...dataLines].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="idea-table-${ideaId}.csv"`);
      res.send(csv);
    } catch (err: any) {
      logger.error('[export-csv]', err);
      res.status(500).json({ error: err?.message || 'Failed to export CSV' });
    }
  })
);

// ═══════════════════════════════════════════
// Idea Table Presence (collaboration cursors)
// ═══════════════════════════════════════════

/**
 * POST /api/my-work/my-ideas/:id/presence
 * Broadcast current user's presence (cursor, active cell) for real-time collaboration.
 */
router.post(
  '/my-ideas/:id/presence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const ideaId = String(req.params.id);
    const channelId = `idea-table-${ideaId}`;
    const { userId, userName, color, activeCell, timestamp } = req.body || {};

    try {
      const realtimePlatformService = (await import('../services/realtimePlatformService.js'))
        .default;
      await realtimePlatformService.upsertPresence(channelId, {
        userId: userId || identity.userId,
        userName: userName || identity.userId,
        userColor: color,
        cursorState: activeCell ? { activeCell, timestamp } : undefined,
        activeElement: activeCell ? `${activeCell.nodeId}:${activeCell.colKey}` : undefined,
      });
      res.json({ ok: true });
    } catch (err: any) {
      logger.error('[idea-presence-broadcast]', err);
      res.status(500).json({ error: err?.message || 'Failed to broadcast presence' });
    }
  })
);

/**
 * GET /api/my-work/my-ideas/:id/presence
 * Poll active users editing this idea table.
 */
router.get(
  '/my-ideas/:id/presence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const ideaId = String(req.params.id);
    const channelId = `idea-table-${ideaId}`;

    try {
      const realtimePlatformService = (await import('../services/realtimePlatformService.js'))
        .default;
      const rows = await realtimePlatformService.listPresence(channelId);
      const users = (Array.isArray(rows) ? rows : []).map((r: any) => {
        const cursor = r.cursor_state
          ? typeof r.cursor_state === 'string'
            ? JSON.parse(r.cursor_state)
            : r.cursor_state
          : {};
        return {
          id: r.user_id,
          name: r.user_name || r.user_id,
          color: r.user_color || '#6366f1',
          activeCell: cursor?.activeCell || null,
          lastSeen: r.last_heartbeat_at ? new Date(r.last_heartbeat_at).getTime() : Date.now(),
          isTyping: false,
        };
      });
      res.json({ users });
    } catch (err: any) {
      logger.error('[idea-presence-poll]', err);
      res.json({ users: [] });
    }
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED CALENDAR ENDPOINT
// Merges tasks, initiative milestones, and decision deadlines into a single
// event stream. External calendar (Google/Outlook) events are fetched
// separately via /api/integrations/calendar/* and merged on the frontend.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/calendar/unified',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const startRaw = req.query.start ? String(req.query.start).trim() : '';
    const endRaw = req.query.end ? String(req.query.end).trim() : '';
    const start = startRaw || null;
    const end = endRaw || null; // FullCalendar endStr is typically exclusive
    const hasRange = Boolean(start && end);

    const sourcesParam = req.query.sources ? String(req.query.sources) : null;
    const requestedSources = sourcesParam
      ? sourcesParam
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : ['task', 'initiative', 'decision', 'outlook', 'google', 'consultify'];

    const projectId = req.query.projectId ? String(req.query.projectId).trim() : '';

    const toDateOnly = (val: unknown): string | null => {
      if (!val) return null;
      if (val instanceof Date) {
        if (Number.isNaN(val.getTime())) return null;
        return val.toISOString().slice(0, 10);
      }
      const raw = String(val).trim();
      if (!raw) return null;
      const d = raw.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    };

    const addDaysDateOnly = (dateOnly: string, days: number): string => {
      const d = new Date(`${dateOnly}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return dateOnly;
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };

    try {
      const events: Array<{
        id: string;
        title: string;
        start: string;
        end?: string;
        allDay: boolean;
        source: string;
        sourceId: string;
        color?: string;
        status?: string;
        priority?: string;
        description?: string;
      }> = [];

      // ── TASKS (due/start/end) ───────────────────────────────────────────────
      if (requestedSources.includes('task')) {
        const taskCols = await getTableColumns('tasks');
        const hasDue = taskCols.has('due_date');
        const hasStart = taskCols.has('start_date');
        const hasEnd = taskCols.has('end_date');
        const hasPlannedStart = taskCols.has('planned_start_date');
        const hasPlannedEnd = taskCols.has('planned_end_date');
        const hasProjectId = taskCols.has('project_id');
        const hasAssigneeId = taskCols.has('assignee_id');
        const hasAssignedTo = taskCols.has('assigned_to');
        const hasOwnerId = taskCols.has('owner_id');
        const hasCreatedBy = taskCols.has('created_by');

        const dateExprParts: string[] = [];
        if (hasDue) dateExprParts.push('t.due_date');
        if (hasStart) dateExprParts.push('t.start_date');
        if (hasPlannedStart) dateExprParts.push('t.planned_start_date');
        const primaryDateExpr =
          dateExprParts.length > 0 ? `COALESCE(${dateExprParts.join(', ')})` : null;

        const assignmentParts: string[] = [];
        if (hasAssigneeId) assignmentParts.push('t.assignee_id = ?');
        if (hasAssignedTo) assignmentParts.push('t.assigned_to = ?');
        if (hasOwnerId) assignmentParts.push('t.owner_id = ?');
        if (assignmentParts.length === 0 && hasCreatedBy) assignmentParts.push('t.created_by = ?');

        const where: string[] = ['t.organization_id = ?'];
        const params: any[] = [orgId];
        if (assignmentParts.length > 0) {
          where.push(`(${assignmentParts.join(' OR ')})`);
          for (let i = 0; i < assignmentParts.length; i++) params.push(userId);
        } else {
          where.push('1=0');
        }

        where.push("LOWER(COALESCE(t.status,'')) NOT IN ('done','completed','cancelled')");

        const hasAnyDateParts: string[] = [];
        if (hasDue) hasAnyDateParts.push('t.due_date IS NOT NULL');
        if (hasStart) hasAnyDateParts.push('t.start_date IS NOT NULL');
        if (hasPlannedStart) hasAnyDateParts.push('t.planned_start_date IS NOT NULL');
        if (hasAnyDateParts.length > 0) {
          where.push(`(${hasAnyDateParts.join(' OR ')})`);
        }

        if (projectId && hasProjectId) {
          where.push('t.project_id = ?');
          params.push(projectId);
        }

        if (hasRange && primaryDateExpr) {
          where.push(`${primaryDateExpr} >= ? AND ${primaryDateExpr} < ?`);
          params.push(start, end);
        }

        const select: string[] = ['t.id', 't.title', 't.status', 't.priority', 't.description'];
        if (hasDue) select.push('t.due_date as due_date');
        if (hasStart) select.push('t.start_date as start_date');
        if (hasEnd) select.push('t.end_date as end_date');
        if (hasPlannedStart) select.push('t.planned_start_date as planned_start_date');
        if (hasPlannedEnd) select.push('t.planned_end_date as planned_end_date');

        const rows =
          (await queryHelpers.queryAll<any>(
            `
            SELECT ${select.join(', ')}
            FROM tasks t
            WHERE ${where.join(' AND ')}
            ORDER BY ${primaryDateExpr ? `${primaryDateExpr} ASC` : 't.updated_at DESC'}
            LIMIT 800
          `,
            params
          )) || [];

        for (const t of rows) {
          const due = toDateOnly(t?.due_date);
          const s = toDateOnly(t?.start_date) || toDateOnly(t?.planned_start_date);
          const e = toDateOnly(t?.end_date) || toDateOnly(t?.planned_end_date);
          const startDate = due || s;
          if (!startDate) continue;

          const endExclusive =
            e && /^\d{4}-\d{2}-\d{2}$/.test(e) ? addDaysDateOnly(e, 1) : undefined;

          events.push({
            id: `task-${t.id}`,
            title: String(t.title || '').trim() || 'Task',
            start: startDate,
            end: due ? undefined : endExclusive,
            allDay: true,
            source: 'task',
            sourceId: String(t.id),
            color: '#2563eb',
            status: t.status,
            priority: t.priority,
            description: t.description,
          });
        }
      }

      // ── INITIATIVES (planned ranges) + MILESTONES (target dates) ───────────
      if (requestedSources.includes('initiative')) {
        const initCols = await getTableColumns('initiatives');
        const hasInitPlannedStart = initCols.has('planned_start_date');
        const hasInitPlannedEnd = initCols.has('planned_end_date');
        const hasInitStart = initCols.has('start_date');
        const hasInitEnd = initCols.has('end_date');
        const hasInitTarget = initCols.has('target_date');
        const hasInitProjectId = initCols.has('project_id');
        const hasInitOwnerBusiness = initCols.has('owner_business_id');
        const hasInitOwnerExecution = initCols.has('owner_execution_id');
        const hasInitOwnerLegacy = initCols.has('owner_id');
        const hasInitSponsor = initCols.has('sponsor_id');
        const hasInitCreatedBy = initCols.has('created_by');
        const stakeholderCols = await getTableColumns('initiative_stakeholders');
        const hasStakeholders =
          stakeholderCols.has('initiative_id') && stakeholderCols.has('user_id');

        const startExpr =
          (hasInitPlannedStart && 'i.planned_start_date') ||
          (hasInitStart && 'i.start_date') ||
          (hasInitTarget && 'i.target_date') ||
          null;
        const endExpr =
          (hasInitPlannedEnd && 'i.planned_end_date') ||
          (hasInitEnd && 'i.end_date') ||
          (hasInitTarget && 'i.target_date') ||
          null;

        if (startExpr) {
          const relationParts: string[] = [];
          if (hasInitOwnerExecution) relationParts.push('i.owner_execution_id = ?');
          if (hasInitOwnerBusiness) relationParts.push('i.owner_business_id = ?');
          if (hasInitOwnerLegacy) relationParts.push('i.owner_id = ?');
          if (hasInitSponsor) relationParts.push('i.sponsor_id = ?');
          if (hasStakeholders) {
            relationParts.push(
              'EXISTS (SELECT 1 FROM initiative_stakeholders s WHERE s.initiative_id = i.id AND s.user_id = ?)'
            );
          }
          if (relationParts.length === 0 && hasInitCreatedBy)
            relationParts.push('i.created_by = ?');

          const where: string[] = ['i.organization_id = ?'];
          const params: any[] = [orgId];

          if (relationParts.length > 0) {
            where.push(`(${relationParts.join(' OR ')})`);
            for (let i = 0; i < relationParts.length; i++) params.push(userId);
          } else {
            where.push('1=0');
          }

          where.push(`${startExpr} IS NOT NULL`);
          where.push("LOWER(COALESCE(i.status,'')) NOT IN ('completed','done','cancelled')");

          if (projectId && hasInitProjectId) {
            where.push('i.project_id = ?');
            params.push(projectId);
          }

          // If we have a range, include overlaps: start <= end AND (endOrStart) >= start
          if (hasRange) {
            const endOrStart = endExpr ? `COALESCE(${endExpr}, ${startExpr})` : startExpr;
            where.push(`${startExpr} < ? AND ${endOrStart} >= ?`);
            params.push(end, start);
          }

          const rows =
            (await queryHelpers.queryAll<any>(
              `
              SELECT i.id, i.name, i.status,
                     ${startExpr} as start_date
                     ${endExpr ? `, ${endExpr} as end_date` : ''}
              FROM initiatives i
              WHERE ${where.join(' AND ')}
              ORDER BY ${startExpr} ASC
              LIMIT 400
            `,
              params
            )) || [];

          for (const i of rows) {
            const s = toDateOnly(i?.start_date);
            const e = toDateOnly(i?.end_date);
            if (!s) continue;
            const endExclusive =
              e && /^\d{4}-\d{2}-\d{2}$/.test(e) ? addDaysDateOnly(e, 1) : undefined;
            events.push({
              id: `initiative-${i.id}`,
              title: String(i.name || '').trim() || 'Initiative',
              start: s,
              end: endExclusive,
              allDay: true,
              source: 'initiative',
              sourceId: String(i.id),
              color: '#7c3aed',
              status: i.status,
            });
          }
        }

        // Optional milestones table (common in PMO schema)
        const msCols = await getTableColumns('initiative_milestones');
        const hasMilestones = msCols.has('target_date');
        const hasMsProjectId = msCols.has('project_id');
        if (hasMilestones) {
          const milestoneRelationParts: string[] = [];
          if (hasInitOwnerExecution) milestoneRelationParts.push('i.owner_execution_id = ?');
          if (hasInitOwnerBusiness) milestoneRelationParts.push('i.owner_business_id = ?');
          if (hasInitOwnerLegacy) milestoneRelationParts.push('i.owner_id = ?');
          if (hasInitSponsor) milestoneRelationParts.push('i.sponsor_id = ?');
          if (hasStakeholders) {
            milestoneRelationParts.push(
              'EXISTS (SELECT 1 FROM initiative_stakeholders s WHERE s.initiative_id = i.id AND s.user_id = ?)'
            );
          }
          if (milestoneRelationParts.length === 0 && hasInitCreatedBy) {
            milestoneRelationParts.push('i.created_by = ?');
          }

          const where: string[] = ['m.organization_id = ?', 'm.target_date IS NOT NULL'];
          const params: any[] = [orgId];

          if (milestoneRelationParts.length > 0) {
            where.push(`(${milestoneRelationParts.join(' OR ')})`);
            for (let i = 0; i < milestoneRelationParts.length; i++) params.push(userId);
          } else {
            where.push('1=0');
          }

          if (projectId && hasMsProjectId) {
            where.push('m.project_id = ?');
            params.push(projectId);
          }

          if (hasRange) {
            where.push('m.target_date >= ? AND m.target_date < ?');
            params.push(start, end);
          }

          const rows =
            (await queryHelpers.queryAll<any>(
              `
              SELECT
                m.id,
                m.initiative_id,
                m.name,
                m.status,
                m.target_date,
                i.name as initiative_name
              FROM initiative_milestones m
              LEFT JOIN initiatives i ON i.id = m.initiative_id
              WHERE ${where.join(' AND ')}
              ORDER BY m.target_date ASC
              LIMIT 600
            `,
              params
            )) || [];

          for (const m of rows) {
            const d = toDateOnly(m?.target_date);
            if (!d) continue;
            const initName = String(m?.initiative_name || '').trim();
            const msName = String(m?.name || '').trim();
            events.push({
              id: `initiative-ms-${m.id}`,
              title: initName ? `${initName}: ${msName || 'Milestone'}` : msName || 'Milestone',
              start: d,
              allDay: true,
              source: 'initiative',
              sourceId: String(m.initiative_id || m.id),
              color: '#7c3aed',
              status: m.status,
            });
          }
        }
      }

      // ── DECISIONS (deadlines) ──────────────────────────────────────────────
      if (requestedSources.includes('decision')) {
        const decisionCols = await getTableColumns('decisions');
        const hasDecisionMaker = decisionCols.has('decision_maker_id');
        const hasCreatedBy = decisionCols.has('created_by');
        const hasAssignedTo = decisionCols.has('assigned_to');
        const hasDecisionOwner = decisionCols.has('decision_owner_id');
        const hasProjectId = decisionCols.has('project_id');

        const ownerParts: string[] = [];
        if (hasDecisionOwner) ownerParts.push('d.decision_owner_id = ?');
        if (hasDecisionMaker) ownerParts.push('d.decision_maker_id = ?');
        if (hasAssignedTo) ownerParts.push('d.assigned_to = ?');
        if (ownerParts.length === 0 && hasCreatedBy) ownerParts.push('d.created_by = ?');
        if (ownerParts.length === 0) ownerParts.push('1=0');

        const where: string[] = [
          'd.organization_id = ?',
          'd.deadline IS NOT NULL',
          `(${ownerParts.join(' OR ')})`,
          "LOWER(COALESCE(d.status,'')) NOT IN ('resolved','done','completed','cancelled')",
        ];
        const params: any[] = [orgId];
        // add userId for each ownerPart placeholder we included
        const ownerParamCount =
          (hasDecisionOwner ? 1 : 0) +
          (hasDecisionMaker ? 1 : 0) +
          (hasAssignedTo ? 1 : 0) +
          (ownerParts.includes('d.created_by = ?') ? 1 : 0);
        for (let i = 0; i < ownerParamCount; i++) params.push(userId);

        if (projectId && hasProjectId) {
          where.push('d.project_id = ?');
          params.push(projectId);
        }

        if (hasRange) {
          where.push('d.deadline >= ? AND d.deadline < ?');
          params.push(start, end);
        }

        const rows =
          (await queryHelpers.queryAll<any>(
            `
            SELECT d.id, d.title, d.deadline, d.status,
                   ${decisionCols.has('priority') ? 'd.priority' : `'MEDIUM' as priority`}
            FROM decisions d
            WHERE ${where.join(' AND ')}
            ORDER BY d.deadline ASC
            LIMIT 400
          `,
            params
          )) || [];

        for (const d of rows) {
          const due = toDateOnly(d?.deadline);
          if (!due) continue;
          events.push({
            id: `decision-${d.id}`,
            title: String(d.title || '').trim() || 'Decision',
            start: due,
            allDay: true,
            source: 'decision',
            sourceId: String(d.id),
            color: '#d97706',
            status: d.status,
            priority: d.priority,
          });
        }
      }

      // ── MEETINGS (Outlook / Google / Consultify) ──────────────────────
      const wantOutlook = requestedSources.includes('outlook');
      const wantGoogle = requestedSources.includes('google');
      const wantConsultify = requestedSources.includes('consultify');
      if (wantOutlook || wantGoogle || wantConsultify) {
        const meetingCols = await getTableColumns('meetings');
        if (meetingCols.has('start_at') && meetingCols.has('end_at')) {
          const where: string[] = ['m.organization_id = ?'];
          const params: any[] = [orgId];

          if (meetingCols.has('created_by')) {
            where.push('m.created_by = ?');
            params.push(userId);
          }

          if (hasRange) {
            where.push('m.start_at >= ? AND m.start_at < ?');
            params.push(start, end);
          }

          const rows =
            (await queryHelpers.queryAll<any>(
              `SELECT m.id, m.title, m.start_at, m.end_at, m.location, m.status, m.agenda_json
               FROM meetings m
               WHERE ${where.join(' AND ')}
               ORDER BY m.start_at ASC
               LIMIT 200`,
              params
            )) || [];

          const sourceColorMap: Record<string, string> = {
            google: '#059669',
            outlook: '#4f46e5',
            consultify: '#6d28d9',
          };

          for (const m of rows) {
            let agenda: any = {};
            try {
              agenda = JSON.parse(m.agenda_json || '{}');
            } catch {
              /* ignore */
            }
            const calSource = agenda.calendarSource || 'outlook';
            if (calSource === 'outlook' && !wantOutlook) continue;
            if (calSource === 'google' && !wantGoogle) continue;
            if (calSource === 'consultify' && !wantConsultify) continue;

            const meetingType = agenda.meetingType || 'team';
            const prefix = meetingType === 'personal' ? '👤 ' : '👥 ';

            const startIso = m.start_at ? new Date(m.start_at).toISOString() : null;
            const endIso = m.end_at ? new Date(m.end_at).toISOString() : null;
            if (!startIso) continue;

            events.push({
              id: `${calSource}-${m.id}`,
              title: `${prefix}${String(m.title || '').trim() || 'Meeting'}`,
              start: startIso,
              end: endIso || undefined,
              allDay: false,
              source: calSource as any,
              sourceId: String(m.id),
              color: sourceColorMap[calSource] || '#4f46e5',
              status: m.status || 'confirmed',
              description: m.location ? `📍 ${m.location}` : undefined,
            });
          }
        }
      }

      // ── AI FOCUS TIME SUGGESTIONS ─────────────────────────────────────────
      // Generate ghost blocks for "own work" time in gaps between meetings
      if (hasRange && start && end) {
        const meetingStarts = events
          .filter(
            (e) =>
              !e.allDay &&
              (e.source === 'outlook' || e.source === 'google' || e.source === 'consultify')
          )
          .map((e) => ({
            start: new Date(e.start),
            end: e.end ? new Date(e.end) : new Date(new Date(e.start).getTime() + 3600000),
          }));

        const rangeStart = new Date(start);
        const rangeEnd = new Date(end);
        const dayMs = 86400000;

        for (let d = new Date(rangeStart); d < rangeEnd; d = new Date(d.getTime() + dayMs)) {
          const dow = d.getUTCDay();
          if (dow === 0 || dow === 6) continue; // skip weekends

          const dayStr = d.toISOString().slice(0, 10);
          const dayMeetings = meetingStarts
            .filter((m) => m.start.toISOString().slice(0, 10) === dayStr)
            .sort((a, b) => a.start.getTime() - b.start.getTime());

          // Find largest gap between 8:00-17:00 that's >= 90 min
          const workStart = new Date(`${dayStr}T08:00:00Z`);
          const workEnd = new Date(`${dayStr}T17:00:00Z`);

          // Build free slots: gaps between meetings within work hours
          const slots: Array<{ start: Date; end: Date }> = [];
          let cursor = workStart;
          for (const m of dayMeetings) {
            const mStart = m.start < workStart ? workStart : m.start;
            if (mStart > cursor) {
              slots.push({ start: cursor, end: mStart });
            }
            if (m.end > cursor) cursor = m.end;
          }
          if (cursor < workEnd) {
            slots.push({ start: cursor, end: workEnd });
          }

          let bestGap = { start: workStart, end: workStart, duration: 0 };
          for (const s of slots) {
            const dur = s.end.getTime() - s.start.getTime();
            if (dur > bestGap.duration) bestGap = { ...s, duration: dur };
          }

          if (dayMeetings.length > 0 && bestGap.duration >= 5400000) {
            // >= 90 min, only on days with meetings
            const focusStart = bestGap.start;
            const focusDur = Math.min(bestGap.duration, 7200000); // max 2h
            const focusEnd = new Date(focusStart.getTime() + focusDur);

            events.push({
              id: `ai-focus-${dayStr}`,
              title: '🧠 Focus time (AI suggestion)',
              start: focusStart.toISOString(),
              end: focusEnd.toISOString(),
              allDay: false,
              source: 'task' as any,
              sourceId: `ai-focus-${dayStr}`,
              color: 'rgba(124, 58, 237, 0.15)',
              status: 'ai_suggestion',
              description: 'AI-suggested deep work block based on your calendar gaps',
            });
          }
        }
      }

      events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      res.json({ events });
    } catch (err: any) {
      logger.error('[calendar-unified]', err);
      res.status(500).json({ error: err?.message || 'Failed to load unified calendar' });
    }
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR V2: EVENT CREATION + CONFLICT DETECTION (scaffolded for future use)
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/calendar/events',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    const schema = z.object({
      title: z.string().min(1).max(500),
      start: z.string(),
      end: z.string().optional(),
      allDay: z.boolean().optional().default(true),
      source: z.enum(['task', 'initiative', 'decision']).optional().default('task'),
      description: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid event data', details: parsed.error.issues });
    }

    const { title, start, end, allDay, source, description } = parsed.data;

    try {
      if (source === 'task') {
        const id = uuidv4();
        await db.query(
          `INSERT INTO tasks (id, title, description, due_date, assignee_id, organization_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'todo', ${nowSql()}, ${nowSql()})`,
          [id, title, description || null, start, userId, orgId]
        );
        res.json({ id, source: 'task', message: 'Task created from calendar' });
      } else {
        res
          .status(501)
          .json({ error: `Creating ${source} events from calendar is not yet supported` });
      }
    } catch (err: any) {
      logger.error('[calendar-create-event]', err);
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  })
);

router.get(
  '/calendar/conflicts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    const date = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];

    try {
      const tasksOnDateResult = await db.query(
        `SELECT id, title, due_date FROM tasks
         WHERE assignee_id = ? AND organization_id = ?
           AND date(due_date) = date(?)
           AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','cancelled')
         ORDER BY due_date ASC`,
        [userId, orgId, date]
      );

      const decisionsOnDateResult = await db.query(
        `SELECT id, title, deadline FROM decisions
         WHERE organization_id = ?
           AND (created_by = ? OR assigned_to = ?)
           AND date(deadline) = date(?)
           AND LOWER(COALESCE(status,'')) NOT IN ('resolved','cancelled')
         ORDER BY deadline ASC`,
        [orgId, userId, userId, date]
      );

      const tasksOnDate = tasksOnDateResult.rows;
      const decisionsOnDate = decisionsOnDateResult.rows;

      const hasConflicts = tasksOnDate.length + decisionsOnDate.length > 3;

      res.json({
        date,
        tasks: tasksOnDate,
        decisions: decisionsOnDate,
        totalItems: tasksOnDate.length + decisionsOnDate.length,
        hasConflicts,
        suggestion: hasConflicts
          ? 'This day looks busy. Consider rescheduling lower-priority items.'
          : null,
      });
    } catch (err: any) {
      logger.error('[calendar-conflicts]', err);
      res.status(500).json({ error: 'Failed to check conflicts' });
    }
  })
);

router.patch(
  '/calendar/events/:eventId/reschedule',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;
    const { eventId } = req.params;

    const schema = z.object({
      newStart: z.string(),
      newEnd: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reschedule data' });
    }

    const { newStart } = parsed.data;

    try {
      // Determine source from eventId prefix
      if (eventId.startsWith('task-')) {
        const taskId = eventId.replace('task-', '');
        await db.query(
          `UPDATE tasks SET due_date = ?, updated_at = ${nowSql()} WHERE id = ? AND assignee_id = ? AND organization_id = ?`,
          [newStart, taskId, userId, orgId]
        );
        res.json({ success: true, source: 'task', id: taskId });
      } else if (eventId.startsWith('decision-')) {
        const decisionId = eventId.replace('decision-', '');
        await db.query(
          `UPDATE decisions SET deadline = ?, updated_at = ${nowSql()} WHERE id = ? AND organization_id = ? AND (created_by = ? OR assigned_to = ?)`,
          [newStart, decisionId, orgId, userId, userId]
        );
        res.json({ success: true, source: 'decision', id: decisionId });
      } else {
        res.status(400).json({ error: 'Unknown event source' });
      }
    } catch (err: any) {
      logger.error('[calendar-reschedule]', err);
      res.status(500).json({ error: 'Failed to reschedule event' });
    }
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// HOME TAB ENDPOINTS (V1 — mock data, V2 will integrate real AI + feeds)
// ─────────────────────────────────────────────────────────────────────────────

type HomeV2IndustryPreset = {
  industryLabel: string;
  marketSignalTitle: string;
  marketSignalSummary: string;
  technologySignalTitle: string;
  technologySignalSummary: string;
  benchmarkLabel: string;
  benchmarkValue: string;
  benchmarkDelta: string;
  benchmarkImplication: string;
  peerCaseTitle: string;
  peerCaseSummary: string;
  peerCaseImplication: string;
};

const DEFAULT_HOME_V2_PRESET: HomeV2IndustryPreset = {
  industryLabel: 'Transformation',
  marketSignalTitle: 'Transformation funding is moving toward cross-functional value pools',
  marketSignalSummary:
    'Leaders are backing programs that connect strategy, execution, and capability-building rather than isolated pilots.',
  technologySignalTitle:
    'AI copilots are being embedded into operating models, not launched as side tools',
  technologySignalSummary:
    'The strongest programs redesign rituals, decisions, and flows around AI assistance instead of adding another disconnected interface.',
  benchmarkLabel: 'Transformation benchmark',
  benchmarkValue: '10-15%',
  benchmarkDelta: 'value capture in 12 months',
  benchmarkImplication:
    'Programs that tie governance, workflow redesign, and AI adoption together capture value faster.',
  peerCaseTitle: 'Transformation office reframed AI as a portfolio lane',
  peerCaseSummary:
    'Instead of scattered pilots, one organization grouped initiatives into a single leadership narrative with weekly decision cadences.',
  peerCaseImplication:
    'Use the Home screen to sharpen one storyline, not to display disconnected updates.',
};

const MANUFACTURING_HOME_V2_PRESET: HomeV2IndustryPreset = {
  industryLabel: 'Manufacturing',
  marketSignalTitle: 'Energy pressure is changing transformation prioritization in manufacturing',
  marketSignalSummary:
    'Manufacturing programs are getting funded fastest when they connect planning, quality, and efficiency levers rather than isolated automation ideas.',
  technologySignalTitle:
    'Computer vision and planning copilots are moving from pilot to operating lane',
  technologySignalSummary:
    'Plants are redesigning quality triage, maintenance decisions, and production planning around AI-assisted workflows.',
  benchmarkLabel: 'Manufacturing transformation benchmark',
  benchmarkValue: '14-18%',
  benchmarkDelta: 'value uplift in 12 months',
  benchmarkImplication:
    'Programs that combine quality, planning, and governance outperform single-tool pilots.',
  peerCaseTitle: 'Tier-1 supplier shifted from AI PoC to transformation lane',
  peerCaseSummary:
    'The team stopped framing AI as a one-off experiment and created one cross-functional lane with owners, KPIs, and weekly steering decisions.',
  peerCaseImplication:
    'Your strongest opportunity likely needs the same reframing: initiative, owner, and executive storyline.',
};

function inferHomeV2TimeMode(date: Date): 'morning' | 'liveDay' | 'eveningWrap' {
  const hour = date.getHours();
  if (hour < 11) return 'morning';
  if (hour < 17) return 'liveDay';
  return 'eveningWrap';
}

function inferRoleLens(role: unknown, isPolish: boolean): string {
  const normalized = String(role || '')
    .trim()
    .toLowerCase();
  if (['owner', 'admin', 'administrator', 'superadmin', 'super_admin'].includes(normalized)) {
    return isPolish ? 'Sponsor wykonawczy' : 'Executive sponsor';
  }
  if (['manager'].includes(normalized)) {
    return isPolish ? 'Lider transformacji' : 'Transformation lead';
  }
  return isPolish ? 'Współtwórca programu' : 'Program contributor';
}

function selectHomeV2Preset(industry: string | null | undefined): HomeV2IndustryPreset {
  const normalized = String(industry || '')
    .trim()
    .toLowerCase();
  if (
    normalized.includes('manufact') ||
    normalized.includes('factory') ||
    normalized.includes('plant') ||
    normalized.includes('production') ||
    normalized.includes('automotive') ||
    normalized.includes('industrial')
  ) {
    return MANUFACTURING_HOME_V2_PRESET;
  }
  return DEFAULT_HOME_V2_PRESET;
}

function computePriorityWeight(base: number, freshness: number, extra = 0): number {
  return Math.max(40, Math.min(100, base + Math.round(freshness / 5) + extra));
}

function computeRecommendedSize(
  priorityWeight: number,
  preferred: 'sm' | 'md' | 'lg' | 'hero'
): 'sm' | 'md' | 'lg' | 'hero' {
  if (preferred === 'hero') return 'hero';
  if (priorityWeight >= 88) return 'lg';
  if (priorityWeight >= 72) return 'md';
  return preferred;
}

router.get(
  '/radar',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (
      !(await requireTables(res, [
        'radar_sources',
        'radar_raw_items',
        'radar_processed_signals',
        'user_radar_profiles',
        'radar_ranked_signals',
        'radar_actions',
        'watchlist_items',
      ]))
    )
      return;

    const orgContext = await organizationContextService.buildResolvedContext(identity.orgId);
    const appLanguage = req.headers['x-app-language'] ?? req.headers['accept-language'];
    const langRaw = Array.isArray(appLanguage) ? appLanguage.join(',') : String(appLanguage || '');
    const isPolish = langRaw.trim().toLowerCase().startsWith('pl');

    const payload = await radarService.buildView({
      userId: identity.userId,
      orgId: identity.orgId,
      role: req.user?.role,
      industry: orgContext.profile.industry || null,
      isPolish,
    });

    return res.json(payload);
  })
);

router.get(
  '/radar/sources',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!(await requireTables(res, ['radar_sources']))) return;
    const sources = await radarService.listSources();
    return res.json({ sources });
  })
);

router.get(
  '/radar/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['user_radar_profiles']))) return;

    const orgContext = await organizationContextService.buildResolvedContext(identity.orgId);
    const profile = await radarRankingService.getOrCreateProfile({
      userId: identity.userId,
      orgId: identity.orgId,
      role: req.user?.role,
      industry: orgContext.profile.industry || null,
    });

    return res.json(profile);
  })
);

router.patch(
  '/radar/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['user_radar_profiles']))) return;

    const parsed = radarProfilePatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid profile payload', details: parsed.error.flatten() });
    }

    const updated = await radarRankingService.updateProfile(identity.userId, {
      ...parsed.data,
      organizationId: identity.orgId,
    });

    return res.json({ success: true, profile: updated });
  })
);

router.post(
  '/radar/actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['radar_actions']))) return;

    const parsed = radarActionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid radar action payload', details: parsed.error.flatten() });
    }

    const orgContext = await organizationContextService.buildResolvedContext(identity.orgId);
    const result = await radarActionService.record({
      userId: identity.userId,
      orgId: identity.orgId,
      role: req.user?.role,
      industry: orgContext.profile.industry || null,
      signalId: parsed.data.signalId || null,
      actionType: parsed.data.actionType,
      sourceContext: parsed.data.sourceContext,
      createdObjectType: parsed.data.createdObjectType,
      createdObjectId: parsed.data.createdObjectId,
      payload: parsed.data.payload,
    });

    return res.json(result);
  })
);

router.get(
  '/radar/metrics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['radar_actions', 'radar_processed_signals']))) return;

    const metrics = await radarService.getMetrics(identity.userId);
    return res.json({ metrics });
  })
);

router.get(
  '/home/v2',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    if (!db) {
      return res.status(503).json({ error: 'Database not ready', cards: [], meta: {} });
    }

    try {
      const now = new Date();
      const signalWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const timeMode = inferHomeV2TimeMode(now);
      const appLanguage = req.headers['x-app-language'] ?? req.headers['accept-language'];
      const langRaw = Array.isArray(appLanguage)
        ? appLanguage.join(',')
        : String(appLanguage || '');
      const isPolish = langRaw.trim().toLowerCase().startsWith('pl');
      const L = (en: string, pl: string) => (isPolish ? pl : en);

      const roleLens = inferRoleLens(req.user?.role, isPolish);
      const orgContext = await organizationContextService.buildResolvedContext(orgId);
      const preset = selectHomeV2Preset(orgContext.profile.industry);

      const safeHomeV2Query = async <T = any>(
        label: string,
        attempts: Array<{ sql: string; params: unknown[] }>
      ): Promise<T[]> => {
        for (const attempt of attempts) {
          try {
            const rows = await db.query(attempt.sql, attempt.params);
            return Array.isArray(rows) ? (rows as T[]) : [];
          } catch (err: any) {
            logger.warn(`[home-v2] ${label} query fallback`, {
              message: err?.message,
            });
          }
        }
        return [];
      };

      const [
        tasks,
        decisions,
        ideas,
        notes,
        orgIdeas,
        peerTipEvents,
        initiatives,
        aiNews,
        outputs,
        inboxStats,
        executionSignalRollup,
        activeRooms,
        pendingDecisionChains,
      ] = await Promise.all([
        safeHomeV2Query('tasks', [
          {
            sql: `SELECT id, title, description, status, priority, due_date, updated_at
                  FROM tasks
                  WHERE organization_id = ? AND assignee_id = ?
                    AND due_date IS NOT NULL
                    AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','cancelled')
                  ORDER BY due_date ASC, updated_at DESC
                  LIMIT 8`,
            params: [orgId, userId],
          },
          {
            sql: `SELECT id, title, description, status, NULL::int as priority, due_date, updated_at
                  FROM tasks
                  WHERE organization_id = ? AND assignee_id = ?
                    AND due_date IS NOT NULL
                    AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','cancelled')
                  ORDER BY due_date ASC, updated_at DESC
                  LIMIT 8`,
            params: [orgId, userId],
          },
        ]),
        safeHomeV2Query('decisions', [
          {
            sql: `SELECT id, title, status, priority, deadline, created_at
                  FROM decisions
                  WHERE organization_id = ? AND (created_by = ? OR decision_maker_id = ?)
                    AND LOWER(COALESCE(status,'')) NOT IN ('resolved','cancelled')
                  ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at DESC
                  LIMIT 6`,
            params: [orgId, userId, userId],
          },
          {
            sql: `SELECT id, title, status, NULL::int as priority, deadline, created_at
                  FROM decisions
                  WHERE organization_id = ? AND (created_by = ? OR decision_maker_id = ?)
                    AND LOWER(COALESCE(status,'')) NOT IN ('resolved','cancelled')
                  ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at DESC
                  LIMIT 6`,
            params: [orgId, userId, userId],
          },
        ]),
        safeHomeV2Query('ideas', [
          {
            sql: `SELECT i.id, i.title, i.description, i.stage, i.updated_at, COUNT(t.id) as task_count
                  FROM ideas i
                  LEFT JOIN tasks t ON t.idea_id = i.id
                  WHERE i.organization_id = ? AND i.created_by = ?
                  GROUP BY i.id, i.title, i.description, i.stage, i.updated_at
                  ORDER BY i.updated_at DESC
                  LIMIT 4`,
            params: [orgId, userId],
          },
          {
            sql: `SELECT i.id, i.title, NULL::text as description, i.stage, i.updated_at, 0::int as task_count
                  FROM ideas i
                  WHERE i.organization_id = ? AND i.created_by = ?
                  ORDER BY i.updated_at DESC
                  LIMIT 4`,
            params: [orgId, userId],
          },
        ]),
        safeHomeV2Query('notes', [
          {
            sql: `SELECT id, title, content_text as content, updated_at
                  FROM notebook_pages
                  WHERE organization_id = ? AND owner_user_id = ?
                  ORDER BY updated_at DESC
                  LIMIT 3`,
            params: [orgId, userId],
          },
          {
            sql: `SELECT id, title, NULL::text as content, updated_at
                  FROM notebook_pages
                  WHERE organization_id = ? AND owner_user_id = ?
                  ORDER BY updated_at DESC
                  LIMIT 3`,
            params: [orgId, userId],
          },
        ]),
        safeHomeV2Query('org_ideas', [
          {
            sql: `SELECT i.id, i.title, i.description, i.stage, i.updated_at, COUNT(t.id) as task_count
                  FROM ideas i
                  LEFT JOIN tasks t ON t.idea_id = i.id
                  WHERE i.organization_id = ? AND i.created_by <> ?
                  GROUP BY i.id, i.title, i.description, i.stage, i.updated_at
                  ORDER BY i.updated_at DESC
                  LIMIT 3`,
            params: [orgId, userId],
          },
          {
            sql: `SELECT i.id, i.title, NULL::text as description, i.stage, i.updated_at, 0::int as task_count
                  FROM ideas i
                  WHERE i.organization_id = ? AND i.created_by <> ?
                  ORDER BY i.updated_at DESC
                  LIMIT 3`,
            params: [orgId, userId],
          },
        ]),
        safeHomeV2Query('peer_tips', [
          {
            sql: `SELECT id, event_data, created_at
                  FROM organization_events
                  WHERE organization_id = ? AND event_type = 'peer_tip'
                  ORDER BY created_at DESC
                  LIMIT 6`,
            params: [orgId],
          },
          {
            sql: `SELECT id, event_data, created_at
                  FROM organization_events
                  WHERE organization_id = ?
                  ORDER BY created_at DESC
                  LIMIT 6`,
            params: [orgId],
          },
        ]),
        safeHomeV2Query('initiatives_upcoming', [
          {
            sql: `SELECT id, name as title, target_date, status
                  FROM initiatives
                  WHERE organization_id = ?
                    AND target_date IS NOT NULL
                    AND LOWER(COALESCE(status,'')) NOT IN ('completed','cancelled')
                  ORDER BY target_date ASC
                  LIMIT 12`,
            params: [orgId],
          },
          {
            sql: `SELECT id, name as title, target_date, status
                  FROM initiatives
                  WHERE organization_id = ?
                    AND target_date IS NOT NULL
                  ORDER BY target_date ASC
                  LIMIT 12`,
            params: [orgId],
          },
        ]),
        getAiNews(now, 6).catch(() => []),
        artifactRegistryService.listMyWorkArtifacts({
          organizationId: orgId,
          userId,
          roleKey: req.user?.role ? String(req.user.role) : null,
          limit: 8,
        }),
        inboxService.getInboxStats(userId, orgId).catch(() => ({
          total: 0,
          bySection: {},
          bySlaStatus: {},
          byPriority: {},
          byStatus: {},
        })),
        rollupSignals(orgId, signalWindowStart.toISOString(), now.toISOString()).catch(() => ({
          byType: new Map<string, number>(),
          byInitiative: new Map<string, number>(),
          total: 0,
        })),
        getActiveRoomsByOrg(orgId, 12).catch(() => []),
        getPendingDecisions(orgId).catch(() => []),
      ]);

      const roomHealths = await Promise.all(
        (activeRooms || [])
          .slice(0, 6)
          .map((room) => getRoomHealth(room.roomId, orgId).catch(() => null))
      );

      const { appTip, aiPlaybookTip } = pickTipOfDay(now);

      const peerTips = (Array.isArray(peerTipEvents) ? peerTipEvents : [])
        .map((e: any) => {
          const raw = e?.event_data ?? e?.eventData ?? e?.event_json ?? e?.metadata ?? '{}';
          let data: any = {};
          try {
            data = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
          } catch {
            data = {};
          }
          const text = String(data?.text || data?.tip || '').trim();
          if (!text) return null;
          return {
            id: String(e?.id || uuidv4()),
            text,
            authorName: data?.authorName ? String(data.authorName) : undefined,
            createdAt: e?.created_at ? String(e.created_at) : now.toISOString(),
          };
        })
        .filter(Boolean)
        .slice(0, 4);

      const orgIdeasPayload = (Array.isArray(orgIdeas) ? orgIdeas : []).map((i: any) => ({
        id: String(i.id),
        type: 'idea' as const,
        title: String(i.title || ''),
        snippet: String(i.description || '').substring(0, 220),
        stage: i.stage || 'spark',
        updatedAt: String(i.updated_at || now.toISOString()),
        nodeCount: 0,
        taskCount: typeof i.task_count === 'number' ? i.task_count : 0,
      }));

      const outputFlow = (outputs?.recent || []).slice(0, 3).map((artifact: any) => ({
        id: String(artifact.originRecordId || artifact.artifactId),
        artifactId: String(artifact.artifactId),
        title: String(artifact.resolvedTitle || artifact.titleSnapshot || 'Untitled artifact'),
        outputType: String(artifact.outputType || 'report'),
        originRuntime: String(artifact.originRuntime || artifact.outputType || 'report'),
        deliveryState: String(artifact.deliveryState || 'draft'),
        visibilityScope: String(artifact.visibilityScope || 'private'),
        publishState: artifact.publishState ? String(artifact.publishState) : null,
        reviewGateCount:
          typeof artifact.reviewGateCount === 'number' ? artifact.reviewGateCount : 0,
      }));

      const executionSignalTypes = Array.from(executionSignalRollup.byType.entries()).sort(
        (left, right) => right[1] - left[1]
      );
      const topExecutionSignalType = executionSignalTypes[0]?.[0] ?? null;
      const formatExecutionSignalType = (value: string | null): string => {
        if (!value) {
          return L('no dominant pattern yet', 'brak dominujacego wzorca');
        }

        const normalized = value.replace(/_/g, ' ').trim();
        if (!normalized) {
          return L('no dominant pattern yet', 'brak dominujacego wzorca');
        }

        return normalized;
      };

      const collaborationHealth = roomHealths.filter(Boolean);
      const degradedRoomCount = collaborationHealth.filter(
        (room) => room && (room.state === 'error' || room.degradedSince)
      ).length;
      const activePresenceCount = collaborationHealth.reduce(
        (sum, room) => sum + (room?.activePresenceCount ?? 0),
        0
      );
      const inboxPendingCount = Number(inboxStats.byStatus?.pending || 0);
      const inboxAtRiskCount = Number(inboxStats.bySlaStatus?.at_risk || 0);
      const reviewSharedOutputCount = outputFlow.filter(
        (artifact) => artifact.visibilityScope === 'review_shared'
      ).length;
      const governedPendingDecisionChainCount = (pendingDecisionChains || []).length;
      const governedPendingDecisionStepCount = (pendingDecisionChains || []).reduce(
        (sum, chain) => {
          const pendingSteps = Array.isArray(chain?.decisions)
            ? chain.decisions.filter((decision) => decision?.status === 'pending').length
            : 0;
          return sum + pendingSteps;
        },
        0
      );

      const nextUpCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const todayKey = now.toISOString().slice(0, 10);
      const nextUp = [
        ...tasks
          .filter((t: any) => t?.due_date)
          .map((t: any) => ({
            source: 'task' as const,
            id: String(t.id),
            title: String(t.title || ''),
            date: String(t.due_date),
          })),
        ...decisions
          .filter((d: any) => d?.deadline)
          .map((d: any) => ({
            source: 'decision' as const,
            id: String(d.id),
            title: String(d.title || ''),
            date: String(d.deadline),
          })),
        ...(Array.isArray(initiatives) ? initiatives : [])
          .filter((i: any) => i?.target_date)
          .map((i: any) => ({
            source: 'initiative' as const,
            id: String(i.id),
            title: String(i.title || ''),
            date: String(i.target_date),
          })),
      ]
        .map((e) => {
          const dt = new Date(e.date);
          const key = Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : '';
          const urgency =
            Number.isFinite(dt.getTime()) && dt.getTime() < now.getTime()
              ? 'overdue'
              : key === todayKey
                ? 'today'
                : 'soon';
          return { ...e, urgency, _ts: dt.getTime() };
        })
        .filter((e) => Number.isFinite(e._ts) && e._ts <= nextUpCutoff.getTime())
        .sort((a, b) => a._ts - b._ts)
        .slice(0, 6)
        .map(({ _ts, ...e }) => e);

      const overdueTasks = tasks.filter(
        (task: any) => task.due_date && new Date(task.due_date) < now
      );
      const tasksDueSoon = tasks.slice(0, 3);
      const pendingDecisions = decisions;
      const blockedCount = overdueTasks.length + (pendingDecisions.length > 2 ? 1 : 0);
      const weekProgress = Math.round((((now.getDay() + 6) % 7) / 5) * 100);

      const focusItems = [
        tasksDueSoon[0]
          ? {
              id: String(tasksDueSoon[0].id),
              type: 'task',
              title: String(tasksDueSoon[0].title),
              meta:
                overdueTasks.length > 0
                  ? L(
                      'Execution needs a clean next move',
                      'Wykonanie potrzebuje czystego „next move”'
                    )
                  : L('Closest execution commitment', 'Najbliższe zobowiązanie wykonawcze'),
              priority: overdueTasks.length > 0 ? 'high' : 'medium',
            }
          : null,
        pendingDecisions[0]
          ? {
              id: String(pendingDecisions[0].id),
              type: 'decision',
              title: String(pendingDecisions[0].title),
              meta: isPolish
                ? `${pendingDecisions.length} aktywne decyzje`
                : `${pendingDecisions.length} active decision${pendingDecisions.length === 1 ? '' : 's'}`,
              priority: 'high',
            }
          : null,
        ideas[0]
          ? {
              id: String(ideas[0].id),
              type: 'idea',
              title: String(ideas[0].title),
              meta: L(
                'Strongest current transformation concept',
                'Najsilniejszy obecny koncept transformacyjny'
              ),
              priority: 'medium',
            }
          : null,
      ].filter(Boolean);

      const pulseScore = Math.max(
        55,
        Math.min(
          96,
          68 +
            Math.min(ideas.length * 4, 12) +
            Math.min(notes.length * 2, 6) +
            Math.min(tasksDueSoon.length * 3, 9) -
            Math.min(pendingDecisions.length * 2, 10)
        )
      );

      const pulseHeadline =
        timeMode === 'morning'
          ? L(
              'Start the day with one move that sharpens narrative and execution.',
              'Zacznij dzień od jednego ruchu, który ostrzy narrację i wykonanie.'
            )
          : timeMode === 'liveDay'
            ? L(
                'Protect momentum while clearing the single blocker shaping the week.',
                'Chroń momentum i zdejmij jeden blocker, który kształtuje tydzień.'
              )
            : L(
                'Close the loop on what moved and carry one strong storyline into tomorrow.',
                'Domknij pętlę tego, co ruszyło, i przenieś jedną silną narrację na jutro.'
              );

      const pulseSummary =
        pendingDecisions.length > 0
          ? L(
              `The program has movement, but decision flow is still shaping pace. ${pendingDecisions.length} active decisions and ${tasksDueSoon.length} near-term actions are competing for attention.`,
              `Program ma ruch, ale tempo nadal kształtuje przepływ decyzji. ${pendingDecisions.length} aktywnych decyzji i ${tasksDueSoon.length} działań na teraz konkuruje o uwagę.`
            )
          : L(
              `Execution is moving without major friction. This is the right moment to convert the strongest idea into a more formal transformation lane.`,
              `Wykonanie idzie bez większego tarcia. To dobry moment, żeby zamienić najsilniejszy pomysł w bardziej formalny „pas transformacji”.`
            );

      const isManufacturingPreset = preset.industryLabel === 'Manufacturing';
      const presetPl: HomeV2IndustryPreset = isManufacturingPreset
        ? {
            industryLabel: 'Produkcja',
            marketSignalTitle:
              'Presja kosztów energii zmienia priorytety transformacji w produkcji',
            marketSignalSummary:
              'Programy dostają finansowanie najszybciej, gdy łączą planowanie, jakość i efektywność zamiast izolowanych pomysłów automatyzacji.',
            technologySignalTitle:
              'Wizja komputerowa i copiloci planistyczni przechodzą z pilota do “pasa operacyjnego”',
            technologySignalSummary:
              'Zakłady przeprojektowują triage jakości, decyzje utrzymania i planowanie produkcji pod AI‑asystowane workflowy.',
            benchmarkLabel: 'Benchmark transformacji (produkcja)',
            benchmarkValue: '14-18%',
            benchmarkDelta: 'wzrost wartości w 12 miesięcy',
            benchmarkImplication:
              'Programy, które łączą jakość, planowanie i governance, wypadają lepiej niż pilotaże pojedynczych narzędzi.',
            peerCaseTitle: 'Dostawca Tier‑1 przeszedł od PoC AI do pasa transformacji',
            peerCaseSummary:
              'Zespół przestał traktować AI jak jednorazowy eksperyment i zbudował jeden cross‑functional lane z ownerami, KPI i tygodniowym steeringiem.',
            peerCaseImplication:
              'Twoja najsilniejsza szansa prawdopodobnie potrzebuje tego samego reframingu: inicjatywa, owner i “executive storyline”.',
          }
        : {
            industryLabel: 'Transformacja',
            marketSignalTitle:
              'Finansowanie transformacji przesuwa się w stronę cross‑functional “value pools”',
            marketSignalSummary:
              'Liderzy wspierają programy, które łączą strategię, wykonanie i budowanie kompetencji, zamiast izolowanych pilotów.',
            technologySignalTitle:
              'Copiloci AI są wbudowywani w model operacyjny, a nie uruchamiani jako narzędzia “obok”',
            technologySignalSummary:
              'Najmocniejsze programy przeprojektowują rytuały, decyzje i przepływy wokół AI‑asysty, zamiast dokładać kolejny odłączony interfejs.',
            benchmarkLabel: 'Benchmark transformacji',
            benchmarkValue: '10-15%',
            benchmarkDelta: 'pozyskanie wartości w 12 miesięcy',
            benchmarkImplication:
              'Programy, które spinają governance, redesign workflow i adopcję AI, szybciej materializują wartość.',
            peerCaseTitle: 'Biuro transformacji przeformułowało AI jako “pas portfelowy”',
            peerCaseSummary:
              'Zamiast rozproszonych pilotów organizacja pogrupowała inicjatywy w jedną narrację przywódczą z tygodniowym rytmem decyzji.',
            peerCaseImplication:
              'Użyj Home do ostrzenia jednej narracji, a nie do pokazywania odłączonych update’ów.',
          };

      const p = isPolish ? presetPl : preset;
      const industry = orgContext.profile.industry || p.industryLabel;
      const priorities = (orgContext.strategic.priorities || []).slice(0, 2).join(', ');
      const constraints = (orgContext.operations.constraints || []).slice(0, 2).join(', ');

      const momentumFreshness = ideas.length > 0 ? 76 : 58;
      const sparkFreshness = Math.min(95, 65 + ideas.length * 6 + notes.length * 4);
      const decisionFreshness = pendingDecisions.length > 0 ? 82 : 55;
      const industryFreshness = 74;

      const aiPulsePriority = computePriorityWeight(88, 84, pendingDecisions.length > 0 ? 4 : 0);
      const momentumPriority = computePriorityWeight(
        72,
        momentumFreshness,
        ideas.length > 1 ? 4 : 0
      );
      const sparkPriority = computePriorityWeight(78, sparkFreshness, ideas.length > 0 ? 4 : 0);
      const decisionPriority = computePriorityWeight(74, decisionFreshness, blockedCount * 2);
      const industryPriority = computePriorityWeight(70, industryFreshness, priorities ? 3 : 0);
      const executionPriority = computePriorityWeight(68, 62, tasksDueSoon.length > 0 ? 4 : 0);
      const teamPriority = computePriorityWeight(64, 58, blockedCount > 1 ? 4 : 0);

      const blocks = [
        {
          id: 'aiPulseCore',
          title: L('AI Pulse Core', 'AI Pulse Core'),
          subtitle: L(
            'Your highest-signal transformation readout',
            'Najbardziej “wysokosygnałowy” odczyt transformacji'
          ),
          accent: 'ai',
          size: 'hero',
          priorityWeight: aiPulsePriority,
          relevanceScore: 96,
          freshnessScore: 84,
          ctaIntents: [
            'prioritize_transformation',
            'challenge_storyline',
            'summarize_for_leadership',
          ],
          payload: {
            greeting: isPolish
              ? `Dzień dobry${req.user?.firstName ? `, ${req.user.firstName}` : ''}`
              : `Good ${timeMode === 'morning' ? 'morning' : timeMode === 'liveDay' ? 'day' : 'evening'}${req.user?.firstName ? `, ${req.user.firstName}` : ''}`,
            headline: pulseHeadline,
            summary: pulseSummary,
            insight: priorities
              ? L(
                  `The strongest storyline today sits at the intersection of ${priorities}. Use Home to keep the narrative transformational, not operational.`,
                  `Najsilniejsza narracja na dziś leży na styku: ${priorities}. Użyj Home, żeby trzymać narrację transformacyjną (nie operacyjną).`
                )
              : L(
                  `The strongest storyline today is to connect ideas, decisions, and execution into one transformation lane with clear ownership.`,
                  `Najsilniejsza narracja na dziś: połącz pomysły, decyzje i wykonanie w jeden „pas transformacji” z jasnym ownerem.`
                ),
            weekProgress,
            pulseScore,
            focusItems,
            appTipOfDay: appTip,
            aiPlaybookTip,
          },
        },
        {
          id: 'momentum',
          title: L('Momentum', 'Momentum'),
          subtitle: L(
            'Where the program is gaining or losing speed',
            'Gdzie program przyspiesza, a gdzie traci prędkość'
          ),
          accent: 'success',
          size: computeRecommendedSize(momentumPriority, 'md'),
          priorityWeight: momentumPriority,
          relevanceScore: 88,
          freshnessScore: momentumFreshness,
          ctaIntents: ['summarize_momentum', 'prioritize'],
          payload: {
            headline:
              governedPendingDecisionChainCount > 0
                ? L(
                    'Governed decision chains are setting the pace.',
                    'Governed decision chains nadają dziś tempo.'
                  )
                : executionSignalRollup.total > 0
                  ? L(
                      'Governed execution is carrying the week.',
                      'Governed execution niesie ten tydzień.'
                    )
                  : inboxPendingCount > 0
                    ? L(
                        'Follow-through is waiting in the inbox.',
                        'Follow-through czeka teraz w inboxie.'
                      )
                    : L(
                        'Governed momentum is stable but still light.',
                        'Governed momentum jest stabilny, ale wciąż lekkie.'
                      ),
            summary:
              governedPendingDecisionChainCount > 0
                ? isPolish
                  ? `${governedPendingDecisionChainCount} governed chainów i ${governedPendingDecisionStepCount} oczekujących kroków nadal spowalnia przejście od execution do decyzji.`
                  : `${governedPendingDecisionChainCount} governed chains and ${governedPendingDecisionStepCount} pending decision steps are still slowing the move from execution into closure.`
                : executionSignalRollup.total > 0
                  ? isPolish
                    ? `${executionSignalRollup.total} sygnałów execution z ostatnich 7 dni wskazuje, że program ma realny ruch operacyjny, a nie tylko deklaratywny status.`
                    : `${executionSignalRollup.total} execution signals from the last 7 days show that the program has real operational movement, not just narrative status.`
                  : inboxPendingCount > 0
                    ? isPolish
                      ? `${inboxPendingCount} pozycji pending w inboxie i ${inboxAtRiskCount} zagrożonych SLA pokazuje, gdzie follow-through może osłabić momentum bez kolejnych decyzji.`
                      : `${inboxPendingCount} pending inbox items and ${inboxAtRiskCount} at-risk SLA items show where follow-through can weaken momentum even without new decisions.`
                    : L(
                        'The governed rails are quiet right now, so the next lift should come from shaping a stronger lane rather than clearing operational drag.',
                        'Governed rails są teraz spokojne, więc kolejny lift powinien wynikać z lepszego ukształtowania lane, a nie z usuwania operacyjnego tarcia.'
                      ),
            stats: [
              {
                label: L('Execution signals', 'Sygnały execution'),
                value: String(executionSignalRollup.total),
                trend:
                  executionSignalRollup.total > 0
                    ? formatExecutionSignalType(topExecutionSignalType)
                    : L('quiet window', 'spokojne okno'),
              },
              {
                label: L('Decision chains', 'Decision chains'),
                value: String(governedPendingDecisionChainCount),
                trend:
                  governedPendingDecisionChainCount > 0
                    ? isPolish
                      ? `${governedPendingDecisionStepCount} kroków pending`
                      : `${governedPendingDecisionStepCount} pending steps`
                    : L('currently clear', 'obecnie czyste'),
              },
              {
                label: L('Inbox pending', 'Inbox pending'),
                value: String(inboxPendingCount),
                trend:
                  inboxAtRiskCount > 0
                    ? isPolish
                      ? `${inboxAtRiskCount} SLA zagrożone`
                      : `${inboxAtRiskCount} SLA at risk`
                    : L('under control', 'pod kontrolą'),
              },
            ],
            signals: [
              {
                id: 'momentum-1',
                title:
                  executionSignalRollup.total > 0
                    ? L(
                        'Governed execution is producing real movement',
                        'Governed execution generuje realny ruch'
                      )
                    : L(
                        'The execution lane is currently quiet',
                        'Lane wykonawczy jest teraz spokojny'
                      ),
                summary:
                  executionSignalRollup.total > 0
                    ? isPolish
                      ? `${executionSignalRollup.total} sygnałów execution z ostatnich 7 dni pokazuje, że program ma aktywny governed heartbeat; top pattern: ${formatExecutionSignalType(topExecutionSignalType)}.`
                      : `${executionSignalRollup.total} execution signals in the last 7 days show that the program has an active governed heartbeat; top pattern: ${formatExecutionSignalType(topExecutionSignalType)}.`
                    : L(
                        'The execution signal rail is quiet right now, so momentum depends more on shaping and commitment than on active delivery pull.',
                        'Rail execution signals jest teraz cichy, więc momentum zależy bardziej od kształtowania i commitmentu niż od aktywnego delivery pull.'
                      ),
                tag: 'Execution rail',
                tone: executionSignalRollup.total > 0 ? 'positive' : 'neutral',
              },
              {
                id: 'momentum-2',
                title:
                  governedPendingDecisionChainCount > 0
                    ? L(
                        'Decision chains are still constraining throughput',
                        'Decision chains nadal ograniczają throughput'
                      )
                    : L(
                        'Decision throughput is currently clean',
                        'Decision throughput jest obecnie czysty'
                      ),
                summary:
                  governedPendingDecisionChainCount > 0
                    ? isPolish
                      ? `${governedPendingDecisionChainCount} chainów i ${governedPendingDecisionStepCount} kroków pending nadal czeka na domknięcie w planning spine.`
                      : `${governedPendingDecisionChainCount} chains and ${governedPendingDecisionStepCount} pending steps are still waiting for closure in the planning spine.`
                    : L(
                        'The planning spine is not currently reporting governed pending chains, which creates space to convert movement into commitment.',
                        'Planning spine nie raportuje teraz governed pending chains, co daje przestrzeń, by zamienić ruch w commitment.'
                      ),
                tag: 'Planning spine',
                tone: governedPendingDecisionChainCount > 0 ? 'warning' : 'neutral',
              },
              {
                id: 'momentum-3',
                title:
                  inboxPendingCount > 0 || reviewSharedOutputCount > 0
                    ? L(
                        'Follow-through is accumulating in governed queues',
                        'Follow-through kumuluje się w governed queues'
                      )
                    : L(
                        'Follow-through pressure is currently light',
                        'Presja follow-through jest obecnie lekka'
                      ),
                summary:
                  inboxPendingCount > 0 || reviewSharedOutputCount > 0
                    ? isPolish
                      ? `${inboxPendingCount} pozycji inbox pending i ${reviewSharedOutputCount} outputów review_shared pokazuje, gdzie ruch wymaga domknięcia, a nie kolejnych nowych startów.`
                      : `${inboxPendingCount} pending inbox items and ${reviewSharedOutputCount} review-shared outputs show where movement needs closure rather than additional fresh starts.`
                    : L(
                        'There is little governed queue pressure right now, so momentum can be directed toward shaping the strongest next lane.',
                        'Presja na governed queues jest teraz mała, więc momentum można skierować na kształtowanie najmocniejszego kolejnego lane.'
                      ),
                tag: 'Follow-through',
                tone: inboxPendingCount > 0 || reviewSharedOutputCount > 0 ? 'warning' : 'neutral',
              },
            ],
          },
        },
        {
          id: 'sparkField',
          title: L('Spark Field', 'Spark Field'),
          subtitle: L(
            'Ideas and notes with transformation gravity',
            'Pomysły i notatki z “grawitacją transformacji”'
          ),
          accent: 'warm',
          size: computeRecommendedSize(sparkPriority, 'lg'),
          priorityWeight: sparkPriority,
          relevanceScore: 92,
          freshnessScore: sparkFreshness,
          ctaIntents: ['expand_idea', 'convert_to_initiative', 'challenge_assumptions'],
          payload: {
            ideas: ideas.map((idea: any) => ({
              id: String(idea.id),
              type: 'idea',
              title: String(idea.title),
              snippet: String(idea.description || '').slice(0, 220),
              stage: String(idea.stage || 'spark'),
              updatedAt: String(idea.updated_at || ''),
              nodeCount: null,
              taskCount: Number(idea.task_count || 0),
            })),
            notes: notes.map((note: any) => ({
              id: String(note.id),
              type: 'note',
              title: String(note.title),
              snippet: String(note.content || '')
                .replace(/<[^>]*>/g, '')
                .slice(0, 220),
              updatedAt: String(note.updated_at || ''),
            })),
            orgIdeas: orgIdeasPayload,
            runtimeSummary: {
              ideasWithTasks: ideas.filter((idea: any) => Number(idea.task_count || 0) > 0).length,
              recentNotes: notes.length,
              recentOutputs: outputFlow.length,
              orgSignals: orgIdeasPayload.length,
            },
            nudge:
              ideas[0] && Number(ideas[0].task_count || 0) === 0
                ? {
                    text: L(
                      `The idea "${ideas[0].title}" still has no formal execution lane. This is the cleanest available unlock.`,
                      `Pomysł "${ideas[0].title}" nadal nie ma formalnego pasa wykonania. To najczystszy możliwy unlock.`
                    ),
                    ideaId: String(ideas[0].id),
                  }
                : null,
          },
        },
        {
          id: 'decisionTemperature',
          title: L('Decision Temperature', 'Decision Temperature'),
          subtitle: L(
            'Where approvals and blockers are heating up',
            'Gdzie approvals i blockery się podgrzewają'
          ),
          accent: 'alert',
          size: computeRecommendedSize(decisionPriority, 'md'),
          priorityWeight: decisionPriority,
          relevanceScore: 87,
          freshnessScore: decisionFreshness,
          ctaIntents: ['unblock_decision', 'draft_decision', 'analyze_tradeoffs'],
          payload: {
            pendingCount: pendingDecisions.length,
            blockedCount,
            hottestDecision: pendingDecisions[0]
              ? {
                  id: String(pendingDecisions[0].id),
                  title: String(pendingDecisions[0].title),
                  ownerLabel: roleLens,
                  priority: String(pendingDecisions[0].priority || 'high'),
                  deadlineLabel: pendingDecisions[0].deadline
                    ? isPolish
                      ? `Docelowe domknięcie: ${String(pendingDecisions[0].deadline)}`
                      : `Target close: ${String(pendingDecisions[0].deadline)}`
                    : L('Needs closure this week', 'Wymaga domknięcia w tym tygodniu'),
                }
              : null,
            signals: [
              {
                id: 'decision-heat-governed-chain',
                title:
                  governedPendingDecisionChainCount > 0
                    ? L(
                        'Governed decision chains are still open in the planning spine',
                        'W planning spine nadal sa otwarte governed decision chains'
                      )
                    : L(
                        'Governed decision chains are currently clear',
                        'Governed decision chains sa obecnie czyste'
                      ),
                summary:
                  governedPendingDecisionChainCount > 0
                    ? isPolish
                      ? `${governedPendingDecisionChainCount} aktywnych chainow i ${governedPendingDecisionStepCount} oczekujacych krokow decyzyjnych nadal czeka na domkniecie.`
                      : `${governedPendingDecisionChainCount} active chains and ${governedPendingDecisionStepCount} pending decision steps are still waiting for closure.`
                    : L(
                        'The governed planning spine does not currently report any pending decision chains for this organization.',
                        'Governed planning spine nie raportuje obecnie zadnych oczekujacych decision chains dla tej organizacji.'
                      ),
                tag: 'Governed planning',
                tone: governedPendingDecisionChainCount > 0 ? 'warning' : 'neutral',
              },
              {
                id: 'decision-heat-1',
                title:
                  pendingDecisions.length > 0
                    ? L(
                        'Decision drag is now visible at Home level',
                        'Drag decyzyjny jest już widoczny na poziomie Home'
                      )
                    : L(
                        'No high-temperature decision detected',
                        'Brak decyzji “wysokotemperaturowej”'
                      ),
                summary:
                  pendingDecisions.length > 0
                    ? L(
                        'The right move is not another update. It is a tighter decision frame and a clearer owner path.',
                        'Właściwym ruchem nie jest kolejny update. To ciaśniejsza rama decyzji i jaśniejsza ścieżka ownera.'
                      )
                    : L(
                        'Decision flow is currently calm, which creates space for stronger shaping work.',
                        'Przepływ decyzji jest teraz spokojny, co tworzy przestrzeń na mocniejszy shaping.'
                      ),
                tag: 'Governance',
                tone: pendingDecisions.length > 0 ? 'warning' : 'neutral',
              },
              {
                id: 'decision-heat-2',
                title:
                  blockedCount > 1
                    ? L(
                        'Execution and approvals are colliding',
                        'Wykonanie i approvals się zderzają'
                      )
                    : L('Governance is manageable', 'Governance jest do udźwignięcia'),
                summary:
                  blockedCount > 1
                    ? L(
                        'A blocked work item is now amplifying decision pressure. This is a sequencing problem, not just a backlog problem.',
                        'Zablokowany element pracy wzmacnia presję decyzyjną. To problem sekwencjonowania, nie tylko backlogu.'
                      )
                    : L(
                        'The current level of governance pressure should be absorbable if one decision is framed clearly.',
                        'Aktualny poziom presji governance powinien być do wchłonięcia, jeśli jedna decyzja będzie jasno zramowana.'
                      ),
                tag: 'Sequencing',
                tone: blockedCount > 1 ? 'warning' : 'neutral',
              },
            ],
          },
        },
        {
          id: 'industryLens',
          title: L('Industry Lens', 'Industry Lens'),
          subtitle: L(
            'External signals translated into transformation relevance',
            'Sygnały z zewnątrz przetłumaczone na znaczenie dla transformacji'
          ),
          accent: 'cool',
          size: computeRecommendedSize(industryPriority, 'lg'),
          priorityWeight: industryPriority,
          relevanceScore: 85,
          freshnessScore: industryFreshness,
          ctaIntents: ['translate_signal', 'compare_peer_case', 'turn_signal_into_action'],
          payload: {
            industryLabel: industry || p.industryLabel,
            roleLens,
            marketSignal: {
              id: 'industry-market',
              title: p.marketSignalTitle,
              summary: p.marketSignalSummary,
              tag: L('Market signal', 'Sygnał rynkowy'),
              tone: 'warning',
            },
            technologySignal: {
              id: 'industry-tech',
              title: p.technologySignalTitle,
              summary: p.technologySignalSummary,
              tag: L('Technology signal', 'Sygnał technologiczny'),
              tone: 'positive',
            },
            aiNews: Array.isArray(aiNews) ? aiNews : [],
            benchmark: {
              label: p.benchmarkLabel,
              value: p.benchmarkValue,
              delta: p.benchmarkDelta,
              implication: constraints
                ? `${p.benchmarkImplication} ${L('Current constraints in context', 'Bieżące ograniczenia w kontekście')}: ${constraints}.`
                : p.benchmarkImplication,
            },
            peerCase: {
              title: p.peerCaseTitle,
              summary: p.peerCaseSummary,
              implication: p.peerCaseImplication,
            },
          },
        },
        {
          id: 'executionCurrent',
          title: L('Execution Current', 'Execution Current'),
          subtitle: L(
            'Transformation execution without drifting into operations control',
            'Wykonanie transformacji bez dryfu w “operational control”'
          ),
          accent: 'cool',
          size: computeRecommendedSize(executionPriority, 'md'),
          priorityWeight: executionPriority,
          relevanceScore: 82,
          freshnessScore: 63,
          ctaIntents: ['sequence_execution', 'review_dependencies'],
          payload: {
            headline:
              tasksDueSoon.length > 0
                ? L(
                    'Execution is visible. Use it to support narrative and decision clarity.',
                    'Wykonanie jest widoczne. Użyj go, żeby wspierać narrację i klarowność decyzji.'
                  )
                : L(
                    'Execution is relatively light. This is a shaping window.',
                    'Wykonanie jest relatywnie lekkie. To okno na shaping.'
                  ),
            streams: [
              executionSignalRollup.total > 0
                ? {
                    id: 'execution-signal-rollup',
                    label: L('Governed execution signals', 'Governed execution signals'),
                    progressLabel: isPolish
                      ? `${executionSignalRollup.total} sygnalow z ostatnich 7 dni · top: ${formatExecutionSignalType(topExecutionSignalType)}`
                      : `${executionSignalRollup.total} signals in the last 7 days · top: ${formatExecutionSignalType(topExecutionSignalType)}`,
                    status:
                      executionSignalRollup.total >= 5 || topExecutionSignalType?.includes('block')
                        ? 'blocked'
                        : 'steady',
                  }
                : null,
              tasksDueSoon[0]
                ? {
                    id: `task-${tasksDueSoon[0].id}`,
                    label: String(tasksDueSoon[0].title),
                    progressLabel:
                      overdueTasks.length > 0
                        ? L('Needs immediate attention', 'Wymaga natychmiastowej uwagi')
                        : L('Closest active move', 'Najbliższy aktywny ruch'),
                    status: overdueTasks.length > 0 ? 'blocked' : 'accelerating',
                    entityType: 'task',
                    entityId: String(tasksDueSoon[0].id),
                  }
                : null,
              tasksDueSoon[1]
                ? {
                    id: `task-${tasksDueSoon[1].id}`,
                    label: String(tasksDueSoon[1].title),
                    progressLabel: L('Execution lane in motion', 'Pas wykonania w ruchu'),
                    status: 'steady',
                    entityType: 'task',
                    entityId: String(tasksDueSoon[1].id),
                  }
                : null,
              pendingDecisions[0]
                ? {
                    id: `decision-${pendingDecisions[0].id}`,
                    label: String(pendingDecisions[0].title),
                    progressLabel: L('Waiting on decision closure', 'Czeka na domknięcie decyzji'),
                    status: 'blocked',
                    entityType: 'decision',
                    entityId: String(pendingDecisions[0].id),
                  }
                : null,
            ].filter(Boolean),
            nextUp,
            artifactOutputs: outputFlow,
          },
        },
        {
          id: 'teamSignal',
          title: L('Team Signal', 'Team Signal'),
          subtitle: L(
            'Organizational alignment around the transformation storyline',
            'Wyrównanie organizacji wokół narracji transformacji'
          ),
          accent: 'neutral',
          size: computeRecommendedSize(teamPriority, 'md'),
          priorityWeight: teamPriority,
          relevanceScore: 77,
          freshnessScore: 58,
          ctaIntents: ['prepare_alignment_message', 'summarize_team_signal'],
          payload: {
            headline:
              pendingDecisions.length > 1
                ? L(
                    'The team has energy, but alignment still needs a cleaner narrative.',
                    'Zespół ma energię, ale alignment nadal potrzebuje czystszej narracji.'
                  )
                : L(
                    'The system looks collaborative enough to push one strong storyline forward.',
                    'System wygląda wystarczająco współpracująco, żeby pchać jedną silną narrację do przodu.'
                  ),
            summary: priorities
              ? L(
                  `Current priorities in context: ${priorities}. Home should keep these visible without turning into an operational cockpit.`,
                  `Aktualne priorytety w kontekście: ${priorities}. Home ma je trzymać widoczne, ale bez zamiany w “operational cockpit”.`
                )
              : L(
                  'Home should help the team align around transformation direction, not just task status.',
                  'Home ma pomagać zespołowi alignować się na kierunku transformacji, nie tylko na statusie zadań.'
                ),
            signals: [
              {
                id: 'team-signal-collaboration',
                title:
                  activeRooms.length > 0
                    ? L(
                        'Live collaboration is visible in the workspace layer',
                        'W warstwie workspace widac zywa wspolprace'
                      )
                    : L(
                        'Collaboration substrate is quiet right now',
                        'Substrat wspolpracy jest teraz cichy'
                      ),
                detail:
                  activeRooms.length > 0
                    ? isPolish
                      ? `${activeRooms.length} aktywnych pokoi, ${activePresenceCount} aktywnych obecnosci i ${degradedRoomCount} pokojow zdegradowanych.`
                      : `${activeRooms.length} active rooms, ${activePresenceCount} active presences, and ${degradedRoomCount} degraded rooms.`
                    : L(
                        'No active collaboration rooms are currently bound to this organization, so alignment still depends mostly on narrative and decision rhythm.',
                        'Brak aktywnych pokoi wspolpracy dla tej organizacji, wiec alignment nadal opiera sie glownie na narracji i rytmie decyzji.'
                      ),
                tone:
                  degradedRoomCount > 0
                    ? 'warning'
                    : activeRooms.length > 0
                      ? 'positive'
                      : 'neutral',
              },
              {
                id: 'team-signal-1',
                title: L('There is enough movement in the system', 'W systemie jest dość ruchu'),
                detail: L(
                  'The risk is fragmentation, not inactivity. Use one storyline to align effort.',
                  'Ryzykiem jest fragmentacja, nie bezczynność. Użyj jednej narracji, żeby alignować wysiłek.'
                ),
                tone: 'positive',
              },
              {
                id: 'team-signal-2',
                title:
                  pendingDecisions.length > 0
                    ? L('Leadership attention is the lever', 'Uwaga liderów jest dźwignią')
                    : L('Leadership attention is available', 'Uwaga liderów jest dostępna'),
                detail:
                  pendingDecisions.length > 0
                    ? L(
                        'One cleaner approval path will likely unlock more than another status review.',
                        'Jedna czystsza ścieżka approval prawdopodobnie odblokuje więcej niż kolejny status review.'
                      )
                    : L(
                        'This is a good moment to package the strongest idea for leadership conversation.',
                        'To dobry moment, żeby spakować najsilniejszy pomysł do rozmowy z leadershipem.'
                      ),
                tone: pendingDecisions.length > 0 ? 'warning' : 'positive',
              },
              {
                id: 'team-signal-3',
                title: L(
                  'Narrative discipline matters more than more updates',
                  'Dyscyplina narracji jest ważniejsza niż kolejne update’y'
                ),
                detail: L(
                  'If Home keeps showing isolated signals, the team will see a dashboard. If it tells one story, they will see direction.',
                  'Jeśli Home pokazuje izolowane sygnały, zespół zobaczy dashboard. Jeśli opowiada jedną historię, zobaczy kierunek.'
                ),
                tone: 'neutral',
              },
            ],
            peerTips,
          },
        },
        {
          id: 'commandDock',
          title: L('Command Dock', 'Command Dock'),
          subtitle: L('Immediate moves', 'Natychmiastowe ruchy'),
          accent: 'neutral',
          size: 'hero',
          priorityWeight: 100,
          relevanceScore: 100,
          freshnessScore: 100,
          ctaIntents: ['create', 'navigate', 'chat'],
          payload: {
            actions: [
              { id: 'new-idea', label: L('+ Idea', '+ Pomysł'), kind: 'create', target: 'idea' },
              { id: 'new-note', label: L('+ Note', '+ Notatka'), kind: 'create', target: 'note' },
              { id: 'new-task', label: L('+ Task', '+ Zadanie'), kind: 'create', target: 'task' },
              {
                id: 'new-decision',
                label: L('+ Decision', '+ Decyzja'),
                kind: 'create',
                target: 'decision',
              },
              {
                id: 'open-calendar',
                label: L('Calendar', 'Kalendarz'),
                kind: 'navigate',
                target: 'calendar',
              },
              {
                id: 'ask-ai',
                label: L('Ask AI', 'Zapytaj AI'),
                kind: 'chat',
                starterPrompt: L(
                  'Turn the current Home signals into one clear transformation narrative, three priorities, and one next decision.',
                  'Zamień sygnały z Home w jedną klarowną narrację transformacji, trzy priorytety i jedną następną decyzję.'
                ),
              },
            ],
            runtimeSummary: {
              inboxPending: Number(inboxStats.byStatus?.pending || 0),
              inboxAtRisk: Number(inboxStats.bySlaStatus?.at_risk || 0),
              recentOutputs: outputFlow.length,
              reviewSharedOutputs: outputFlow.filter(
                (artifact) => artifact.visibilityScope === 'review_shared'
              ).length,
            },
          },
        },
      ];

      res.json({
        timeMode,
        updatedAt: now.toISOString(),
        pulseLabel:
          pendingDecisions.length > 0
            ? L(
                'Transformation pressure is rising in the right places',
                'Presja transformacji rośnie we właściwych miejscach'
              )
            : L('Transformation momentum is building', 'Momentum transformacji się buduje'),
        blocks,
      });
    } catch (err: any) {
      logger.error('[home-v2]', err);
      res.status(500).json({ error: 'Failed to build Home V2' });
    }
  })
);

router.get(
  '/home/brief',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    try {
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.getDay();
      const weekProgress = Math.round((dayOfWeek / 5) * 100);

      const overdueTasksResult = await db.query<{ id: string; title: string }>(
        `SELECT id, title FROM tasks WHERE assigned_to = ? AND organization_id = ? AND status NOT IN ('done','cancelled') AND due_date < ${nowSql()} ORDER BY due_date ASC LIMIT 3`,
        [userId, orgId]
      );

      const pendingDecisionsResult = await db.query<{ id: string; title: string }>(
        `SELECT id, title FROM decisions WHERE organization_id = ? AND status = 'pending' AND (created_by = ? OR assigned_to = ?) ORDER BY created_at DESC LIMIT 3`,
        [orgId, userId, userId]
      );

      const recentIdeasResult = await db.query<{ id: string; title: string }>(
        `SELECT id, title FROM ideas WHERE created_by = ? AND organization_id = ? ORDER BY updated_at DESC LIMIT 1`,
        [userId, orgId]
      );

      const overdueTasks = overdueTasksResult.rows;
      const pendingDecisions = pendingDecisionsResult.rows;
      const recentIdeas = recentIdeasResult.rows;

      const focusItems: Array<{
        id: string;
        type: string;
        title: string;
        meta: string;
        priority: string;
      }> = [];

      if (overdueTasks.length > 0) {
        focusItems.push({
          id: overdueTasks[0].id,
          type: 'task',
          title: overdueTasks[0].title,
          meta: 'Overdue',
          priority: 'high',
        });
      }

      if (pendingDecisions.length > 0) {
        focusItems.push({
          id: pendingDecisions[0].id,
          type: 'decision',
          title: pendingDecisions[0].title,
          meta: `${pendingDecisions.length} pending`,
          priority: 'high',
        });
      }

      if (recentIdeas.length > 0) {
        focusItems.push({
          id: recentIdeas[0].id,
          type: 'idea',
          title: recentIdeas[0].title,
          meta: 'Recently updated',
          priority: 'medium',
        });
      }

      res.json({
        greeting: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
        insight: null,
        focusItems,
        weekProgress,
      });
    } catch (err: any) {
      logger.error('[home-brief]', err);
      res.status(500).json({ error: 'Failed to load brief' });
    }
  })
);

router.get(
  '/home/spark',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    try {
      const ideasResult = await db.query<{
        id: string;
        title: string;
        description: string | null;
        stage: string | null;
        updated_at: string;
      }>(
        `SELECT id, title, description, stage, updated_at FROM ideas WHERE created_by = ? AND organization_id = ? ORDER BY updated_at DESC LIMIT 4`,
        [userId, orgId]
      );

      const notesResult = await db.query<{
        id: string;
        title: string;
        content: string | null;
        updated_at: string;
      }>(
        `SELECT id, title, content, updated_at FROM notebook_pages WHERE user_id = ? AND organization_id = ? ORDER BY updated_at DESC LIMIT 2`,
        [userId, orgId]
      );

      const ideasWithoutTasksResult = await db.query<{ id: string; title: string }>(
        `SELECT i.id, i.title FROM ideas i LEFT JOIN tasks t ON t.idea_id = i.id WHERE i.created_by = ? AND i.organization_id = ? AND t.id IS NULL ORDER BY i.updated_at DESC LIMIT 1`,
        [userId, orgId]
      );

      const ideas = ideasResult.rows;
      const notes = notesResult.rows;
      const ideasWithoutTasks = ideasWithoutTasksResult.rows;

      const aiNudge =
        ideasWithoutTasks.length > 0
          ? {
              text: `"${ideasWithoutTasks[0].title}" has no tasks yet. Want to break it into actionable steps?`,
              ideaId: ideasWithoutTasks[0].id,
              action: 'Expand idea',
            }
          : null;

      res.json({
        ideas: ideas.map((i: any) => ({
          id: i.id,
          type: 'idea',
          title: i.title,
          snippet: (i.description || '').substring(0, 200),
          stage: i.stage || 'spark',
          updatedAt: i.updated_at,
        })),
        notes: notes.map((n: any) => ({
          id: n.id,
          type: 'note',
          title: n.title,
          snippet: (n.content || '').replace(/<[^>]*>/g, '').substring(0, 200),
          updatedAt: n.updated_at,
        })),
        aiNudge,
      });
    } catch (err: any) {
      logger.error('[home-spark]', err);
      res.status(500).json({ error: 'Failed to load spark data' });
    }
  })
);

router.get(
  '/home/pulse',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // V1: static curated content. V2 will integrate AI-generated summaries + RSS feeds.
    res.json({
      articles: [],
      frameworkOfDay: {
        name: 'Jobs-to-be-Done',
        description:
          "People don't buy products — they hire them to do a job. Understand the underlying job your client's customers are trying to accomplish.",
      },
      benchmark: null,
    });
  })
);

router.get(
  '/home/nudge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    try {
      const pendingDecisionsResult = await db.query(
        `SELECT COUNT(*) as cnt FROM decisions WHERE organization_id = ? AND status = 'pending' AND (created_by = ? OR assigned_to = ?) AND created_at < ${daysAgoSql(1)}`,
        [orgId, userId, userId]
      );

      const overdueTasksResult = await db.query(
        `SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to = ? AND organization_id = ? AND status NOT IN ('done','cancelled') AND due_date < ${nowSql()}`,
        [userId, orgId]
      );

      const pendingDecisions = Number((pendingDecisionsResult.rows[0] as any)?.cnt || 0);
      const overdueTasks = Number((overdueTasksResult.rows[0] as any)?.cnt || 0);

      res.json({
        pendingDecisions,
        overdueTasks,
        message: null,
      });
    } catch (err: any) {
      logger.error('[home-nudge]', err);
      res.status(500).json({ error: 'Failed to load nudge data' });
    }
  })
);

router.get(
  '/outputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = String(req.userId || req.user?.id || '');
    const organizationId = String(req.organizationId || req.user?.organizationId || '');
    const roleKey = req.user?.role ? String(req.user.role) : null;

    const outputs = await artifactRegistryService.listMyWorkArtifacts({
      organizationId,
      userId,
      roleKey,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    });

    res.json(outputs);
  })
);

export default router;
