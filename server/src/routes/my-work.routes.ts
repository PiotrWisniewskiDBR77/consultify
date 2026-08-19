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
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { featureFlags } from '../config/FeatureFlags.js';
import {
  type AuthRequest,
  requireRole,
  validateOrgMembership,
  verifyToken,
} from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import {
  assertIdeaMembership,
  selectCanonicalMapRow,
  selectReadableMapRow,
} from '../realtime/ideaMapAccess.js';
import auditEventsService from '../services/AuditEventsService.js';
import { canonicalSourceHash } from '../services/artifactHandoff/handoffSpineService.js';
import {
  getIdeaConfidentiality,
  IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE,
  IDEA_CONFIDENTIALITY_LEVELS,
  isIdeaRestricted,
} from '../services/ideaConfidentiality.js';
import { createIdeaMapSnapshot } from '../services/ideaMapSnapshotService.js';
import { InboxAiAssistItemSchema, runInboxAiAssist } from '../services/inboxAiAssistService.js';
import inboxService from '../services/inboxService.js';
import { createInitiative as funnelCreateInitiative } from '../services/initiative/createInitiativeService.js';
import NotificationService from '../services/notificationService.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import { createNativeDeck } from '../services/presentationGeneratorService.js';
import projectionService from '../services/tablePlatform/ProjectionService.js';
import TaskAssignmentService from '../services/taskAssignmentService.js';
import {
  normalizeTaskStatus as normalizeWorkflowTaskStatus,
  validateTaskStatusTransition,
} from '../services/taskWorkflowService.js';
import { getCapacityOverview, getOverloadAlerts } from '../services/workloadCapacityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getTableColumns } from '../utils/dbSchema.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import { resolveMentionsFromComment } from '../utils/mentionResolver.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import {
  ensureLatestSchema,
  GovernedIdeaStageEnum,
  IdeaMaturityAttestationSchema,
  normalizeGraphForStorage,
  validateAndNormalizeGraph,
} from '../validators/ideaWorkspaceGraph.validators.js';
import calendarRouter from './my-work/calendar.routes.js';
import agentMaterializationRouter from './my-work/agent-materialization.routes.js';
import decisionsRouter from './my-work/decisions.routes.js';
import focusRouter from './my-work/focus.routes.js';
import homeRouter from './my-work/home.routes.js';
import managerRouter from './my-work/manager.routes.js';
import notebookRouter from './my-work/notebook.routes.js';
import radarRouter from './my-work/radar.routes.js';
import signalsRouter from './my-work/signals.routes.js';
import statsRouter from './my-work/stats.routes.js';
import whiteboardUploadsRouter from './my-work/whiteboard-uploads.routes.js';

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
router.use(validateOrgMembership);
router.use(demoContextMiddleware);
router.use(agentMaterializationRouter);

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
      // H6.5 (org-scope, fail-closed): the triage itemKey is caller-supplied, and
      // TaskAssignmentService.assignTask resolves/updates the task by id WITHOUT an
      // org filter. Verify the task belongs to the caller's org before delegating,
      // otherwise a crafted itemKey (task:<foreignId>) could reassign a task in
      // another tenant. Foreign/absent tasks are silently skipped.
      const owned = await queryHelpers.queryOne<{ ok: number }>(
        `SELECT 1 as ok FROM tasks WHERE id = ? AND organization_id = ? LIMIT 1`,
        [rawId, orgId]
      );
      if (!owned) return;
      await TaskAssignmentService.assignTask(rawId, delegateUserId, { assignedById: userId });
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
    const task = await queryHelpers.queryOne<{ status?: string }>(
      `SELECT status FROM tasks WHERE id = ? AND organization_id = ?`,
      [rawId, orgId]
    );
    const transition = validateTaskStatusTransition(task?.status, 'done');
    if (!transition.allowed) {
      throw new Error(
        'message' in transition ? transition.message : 'Invalid task status transition'
      );
    }
    await queryHelpers.queryRun(
      `UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [normalizeWorkflowTaskStatus('done'), rawId, orgId]
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

/**
 * Decode HTML entities back to plain text before persisting idea fields.
 *
 * The global inputSanitizationMiddleware HTML-encodes every request body
 * (e.g. `"` -> `&quot;`). Persisting that encoded value is wrong for a React
 * frontend (React escapes on render), and content that was already encoded
 * once (e.g. an idea seeded from a sanitized chat message) gets encoded again
 * (`&quot;` -> `&amp;quot;`). Decoding here stores PLAIN text, which React
 * re-escapes safely at render time — no XSS hole is introduced.
 */
const IDEA_NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#x27': "'",
  '#39': "'",
  '#96': '`',
  '#x60': '`',
  nbsp: ' ',
};
const decodeIdeaText = (input: string): string => {
  let current = input;
  for (let i = 0; i < 5; i += 1) {
    const next = current.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
      const key = body.toLowerCase();
      if (IDEA_NAMED_ENTITIES[key] !== undefined) return IDEA_NAMED_ENTITIES[key];
      if (body[0] === '#') {
        const isHex = body[1] === 'x' || body[1] === 'X';
        const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
        if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
          try {
            return String.fromCodePoint(code);
          } catch {
            return match;
          }
        }
      }
      return match;
    });
    if (next === current) break;
    current = next;
  }
  return current;
};

const parseJsonField = <T>(input: unknown, fallback: T): T => {
  if (input == null) return fallback;
  if (typeof input !== 'string') return input as T;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
};

const decorateIdeaLineage = (row: any) => ({
  ...row,
  actionContract: parseJsonField(row?.action_contract_json, {}),
  sourcePack: parseJsonField(row?.source_pack_json, {}),
  evidenceRefs: parseJsonField(row?.evidence_refs_json, []),
  researchData: row?.researchData != null ? parseJsonField(row.researchData, []) : undefined,
  creativeProposals:
    row?.creativeProposals != null ? parseJsonField(row.creativeProposals, []) : undefined,
  summaryData: row?.summaryData != null ? parseJsonField(row.summaryData, null) : undefined,
  // E08 (idea maturity model, docs/qa/ideas-manual-audit-2026-08-09/09_...md §6.1):
  // user attestations for the handful of stage-gate criteria that have no
  // backing field anywhere else (recommendation / financial scenario /
  // dependencies / unresolved assumptions / initial economics — see
  // src/components/MyWork/ideaMaturityModel.ts). `undefined` when the
  // additive column (server/migrations/20260810_idea_maturity_gates.sql,
  // NOT applied yet) doesn't exist on this database — the row simply won't
  // carry the raw key in that case (see `lineageSelect` guards below).
  maturityGates:
    row?.maturity_gates_json !== undefined ? parseJsonField(row.maturity_gates_json, {}) : {},
  action_contract_json: undefined,
  source_pack_json: undefined,
  evidence_refs_json: undefined,
  maturity_gates_json: undefined,
});

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
    res
      .status(401)
      .json(
        buildMyWorkFailClosedError(
          req,
          401,
          'MY_WORK_UNAUTHORIZED',
          'Authentication is required to access My Work.'
        )
      );
    return null;
  }
  return { userId, orgId };
};

function resolveMyWorkCorrelationId(req: AuthRequest): string | null {
  return (
    (req as AuthRequest & { correlationId?: string }).correlationId ||
    req.get('X-Correlation-ID') ||
    null
  );
}

function buildMyWorkFailClosedError(
  req: AuthRequest,
  statusCode: number,
  code: string,
  message: string
) {
  return {
    status: statusCode >= 500 ? 'error' : 'fail',
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveMyWorkCorrelationId(req),
  };
}

const resolveCanonicalPersonalTaskIdentity = async (
  req: AuthRequest,
  identity: { userId: string; orgId: string }
): Promise<{ userId: string; orgId: string }> => {
  let email = typeof req.user?.email === 'string' ? req.user.email.trim().toLowerCase() : '';
  if (!email && identity.userId) {
    try {
      const row = await queryHelpers.queryOne<{ email: string | null }>(
        `SELECT email FROM users WHERE id = ? LIMIT 1`,
        [identity.userId]
      );
      const e = row?.email ? String(row.email).trim().toLowerCase() : '';
      if (e) email = e;
    } catch {
      /* best-effort */
    }
  }
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

    if (matches.length === 0) {
      try {
        const row = await queryHelpers.queryOne<{ organization_id: string | null }>(
          `SELECT organization_id FROM users WHERE id = ? LIMIT 1`,
          [identity.userId]
        );
        const oid = row?.organization_id ? String(row.organization_id).trim() : '';
        if (oid && oid !== identity.orgId) {
          return { userId: identity.userId, orgId: oid };
        }
      } catch {
        /* ignore */
      }
      return identity;
    }

    const exact = matches.find(
      (row) => row.id === identity.userId && row.organization_id === identity.orgId
    );
    if (exact) return identity;

    // Same account (id matches), just a different org than the `users.organization_id`
    // "home" column — e.g. an active org-switch to a multi-org membership. Trust the
    // session's org, don't silently reroute personal-tasks to the home org (2026-07-20:
    // this returned matches[0].organization_id unconditionally, so any multi-org user
    // switched into a non-home org saw an empty Tasks list — data existed, just under
    // the org the session actually pointed at).
    const sameAccount = matches.find((row) => row.id === identity.userId);
    if (sameAccount) return identity;

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
  const demoHeader = String(req.get('X-Demo-Mode') || '').toLowerCase() === 'true';
  const allowLegacyEmailOwnerMatch =
    String(process.env.ENABLE_PERSONAL_TASK_EMAIL_MATCH || '').trim() === '1' ||
    demoHeader ||
    Boolean((req.user as { isDemo?: boolean } | undefined)?.isDemo);
  const userId = overrides?.userId || (req as any).userId || req.user?.id;
  const rawOverride =
    overrides?.email !== undefined && overrides?.email !== null ? String(overrides.email) : '';
  const fromReq = typeof req.user?.email === 'string' ? req.user.email.trim().toLowerCase() : '';
  const email = (rawOverride.trim().toLowerCase() || fromReq).trim();
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

/** Email for assignee scope: JWT first, then DB by resolved user id (tokens sometimes omit email). */
const resolveEmailForPersonalTaskScope = async (
  req: AuthRequest,
  identity: { userId: string }
): Promise<string> => {
  const fromJwt = typeof req.user?.email === 'string' ? req.user.email.trim().toLowerCase() : '';
  if (fromJwt) return fromJwt;
  if (!identity.userId) return '';
  try {
    const row = await queryHelpers.queryOne<{ email: string | null }>(
      `SELECT email FROM users WHERE id = ? LIMIT 1`,
      [identity.userId]
    );
    return row?.email ? String(row.email).trim().toLowerCase() : '';
  } catch {
    return '';
  }
};

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
    const isMockGateway =
      (process.env.NODE_ENV === 'test' || process.env.E2E_MODE === 'true') &&
      (process.env.MOCK_DB === 'true' || process.env.ENABLE_TEST_GATEWAY === 'true');
    if (isMockGateway) {
      return `mock-tool-session-${sourceType}-${sourceId}`;
    }
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
  // Z139 (data-integrity): safeTitle may already carry entities escaped by the
  // global sanitizer on a prior save of the source idea/notebook. Decode before
  // composing tool_sessions.name (mirrors the notebook/canvas decode-before-store fix).
  add('name', decodeHtmlEntities(`MyWork ${sourceType}: ${safeTitle}`.slice(0, 255)));
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
      res
        .status(400)
        .json(
          buildMyWorkFailClosedError(
            req,
            400,
            'MY_WORK_LINK_GRAPH_QUERY_INCOMPLETE',
            'Both type and id query parameters are required.'
          )
        );
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
      res
        .status(400)
        .json(
          buildMyWorkFailClosedError(
            req,
            400,
            'MY_WORK_LINK_GRAPH_PAYLOAD_INVALID',
            'Link graph edge payload is invalid.'
          )
        );
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
 * DELETE /api/my-work/link-graph/edges/:edgeId
 * Remove a single Link Graph v3 edge (org-scoped). Used e.g. when a user
 * unlinks a related decision from a task. Idempotent: 200 even if already gone.
 */
router.delete(
  '/link-graph/edges/:edgeId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    if (!(await requireTables(res, ['link_graph_edges']))) return;

    const edgeId = String(req.params.edgeId || '').trim();
    if (!edgeId) {
      res
        .status(400)
        .json(
          buildMyWorkFailClosedError(
            req,
            400,
            'MY_WORK_LINK_GRAPH_EDGE_ID_REQUIRED',
            'edgeId path parameter is required.'
          )
        );
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM link_graph_edges WHERE id = ? AND organization_id = ?`,
      [edgeId, orgId]
    );

    await req.emitAuditEvent?.({
      action: 'LINK_GRAPH_EDGE_DELETE',
      resourceType: 'LINK_GRAPH_EDGE',
      resourceId: edgeId,
    });

    res.json({ ok: true });
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
      ? 't.custom_fields_json as "customFields"'
      : 'NULL as "customFields"';
    // Mirror the Initiatives/Decisions `?source` lineage filter (e.g.
    // ?source=interview_insight). No-ops when the source_type column is absent.
    const tSourceTypeSelect = taskCols.has('source_type') ? 't.source_type' : 'NULL as source_type';
    const tSourceIdSelect = taskCols.has('source_id') ? 't.source_id' : 'NULL as source_id';
    const normalizedTaskSource = req.query.source
      ? String(req.query.source).trim().toLowerCase()
      : '';
    const applyTaskSourceFilter = !!(normalizedTaskSource && taskCols.has('source_type'));
    const taskSourceWhere = applyTaskSourceFilter
      ? `AND LOWER(COALESCE(t.source_type, '')) = ?`
      : '';

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
          t.initiative_id as "initiativeId",
          i.name as "initiativeName",
          p.name as "projectName",
          t.assignee_id as "assigneeId",
          a.first_name as "assigneeFirstName",
          a.last_name as "assigneeLastName",
          a.avatar_url as "assigneeAvatarUrl",
          t.estimated_hours as "estimatedHours",
          t.checklist,
          ${tSourceTypeSelect} as "sourceType",
          ${tSourceIdSelect} as "sourceId",
          ${customFieldsSelect}
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users a ON t.assignee_id = a.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          ${onlyOpen ? "AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')" : ''}
          ${taskSourceWhere}
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.due_date, '9999-12-31') ASC,
          t.updated_at DESC
        LIMIT ?
      `,
        [orgId, userId, ...(applyTaskSourceFilter ? [normalizedTaskSource] : []), limit]
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
 * NOTE: stored in `tasks` and filtered by assignee + org. The GET list returns
 * all owner-scoped tasks regardless of task_type (real tasks default to
 * 'execution'); personal tasks are sorted first. Org + owner scoping is always
 * enforced — no cross-tenant leak.
 */
router.get(
  '/personal-tasks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const baseIdentity = requireUser(req, res);
    if (!baseIdentity) return;
    const identity = await resolveCanonicalPersonalTaskIdentity(req, baseIdentity);
    const { userId, orgId } = identity;
    const scopeEmail = await resolveEmailForPersonalTaskScope(req, identity);
    const ownerScope = buildPersonalTaskOwnerScope(req, 't', {
      userId,
      email: scopeEmail,
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
          CAST(t.updated_at AS TEXT) as "versionToken",
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
          ${whereExtra}
        ORDER BY
          CASE WHEN lower(coalesce(t.task_type,'')) = 'personal' THEN 0 ELSE 1 END,
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
      hasScopeEmail: Boolean(scopeEmail),
      demoHeader: String(req.get('X-Demo-Mode') || '').toLowerCase() === 'true',
      tokenIsDemo: Boolean((req.user as { isDemo?: boolean } | undefined)?.isDemo),
      count: rows.length,
    });

    res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
    res.setHeader('Vary', 'Authorization');

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

    // F15 (data-integrity, continuation of Z139): decode HTML entities the global
    // input-sanitization middleware escaped on this request body string, before
    // storing tasks.title — mirrors the tool_sessions.name fix.
    const title = decodeHtmlEntities(String(req.body?.title || '').trim());
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

    // M02-003/M02-P04: idempotent create for personal tasks. This is the ACTUAL
    // My Work Tasks create path (TaskDetailView.tsx -> Api.createPersonalTask),
    // distinct from the pmo/TaskController stack that the original M02-003
    // candidate patched — that fix does not reach this route at all. Personal
    // tasks never carry an initiative_id, so the relevant unique index is the
    // org-scoped one added by 20260804_m02a_tasks_tenant_idempotency.sql
    // (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL.
    const idempotencyKeyRaw = req.body?.idempotencyKey;
    const idempotencyKey =
      typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim()
        ? idempotencyKeyRaw.trim()
        : null;

    if (idempotencyKey) {
      const existing = await queryHelpers.queryOne<any>(
        `
        SELECT
          t.id, t.title, t.description, t.status, t.priority,
          t.due_date as "dueDate", t.tags,
          t.created_at as "createdAt", t.updated_at as "updatedAt",
          t.completed_at as "completedAt"
        FROM tasks t
        WHERE t.organization_id = ? AND t.idempotency_key = ?
        LIMIT 1
        `,
        [orgId, idempotencyKey]
      );
      if (existing) {
        res
          .status(200)
          .json({ ...existing, tags: parseTagsArray(existing?.tags), idempotent: true });
        return;
      }
    }

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
    if (idempotencyKey) add('idempotency_key', idempotencyKey);

    try {
      await queryHelpers.queryRun(
        `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
    } catch (insertErr: any) {
      // Race guard: two concurrent retries can both pass the pre-insert SELECT
      // above. A unique-violation on (organization_id, idempotency_key) means the
      // other request won; re-read and return its row instead of a 500.
      if (idempotencyKey && insertErr?.code === '23505') {
        const winning = await queryHelpers.queryOne<any>(
          `
          SELECT
            t.id, t.title, t.description, t.status, t.priority,
            t.due_date as "dueDate", t.tags,
            t.created_at as "createdAt", t.updated_at as "updatedAt",
            t.completed_at as "completedAt"
          FROM tasks t
          WHERE t.organization_id = ? AND t.idempotency_key = ?
          LIMIT 1
          `,
          [orgId, idempotencyKey]
        );
        if (winning) {
          res
            .status(200)
            .json({ ...winning, tags: parseTagsArray(winning?.tags), idempotent: true });
          return;
        }
      }
      throw insertErr;
    }

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
    const scopeEmail = await resolveEmailForPersonalTaskScope(req, identity);
    const ownerScope = buildPersonalTaskOwnerScope(req, 't', {
      userId,
      email: scopeEmail,
    });

    const id = String(req.params.id || '').trim();
    // R2/defekt #1 (2026-07-23): `expected_outcome` istnieje w tabeli `tasks`
    // (DatabaseInitializer — kolumna gwarantowana) i jest zapisywane przez
    // generator AI, ale detal personal-task go NIE ZWRACAŁ, a PUT go nie
    // przyjmował. Karta zawsze renderowała pusty „Oczekiwany rezultat".
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
        t.expected_outcome as "expectedOutcome",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        CAST(t.updated_at AS TEXT) as "versionToken",
        t.completed_at as "completedAt"
      FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND ${ownerScope.whereSql}
      LIMIT 1
    `,
      [id, orgId, ...ownerScope.params]
    );

    if (!row) {
      // The personal-tasks LIST endpoint returns every owner-scoped task in the
      // org (personal-sorted first), but historically this detail lookup added a
      // hard `task_type='personal'` filter. Any non-personal owned task (e.g. an
      // initiative/project task, or one with a null/other task_type) therefore
      // appeared in the list yet 404'd on open → the "Failed to load task" toast
      // over a blank form. Scope now matches the list (org + owner) so those
      // rows load. A 404 here now means a genuinely missing/foreign task, which
      // the client renders as an explicit "not found" state.
      res.status(404).json({ error: 'Not found', code: 'TASK_NOT_FOUND' });
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
    const scopeEmail = await resolveEmailForPersonalTaskScope(req, identity);
    const ownerScope = buildPersonalTaskOwnerScope(req, 't', {
      userId,
      email: scopeEmail,
    });
    const ownerScopeNoAlias = buildPersonalTaskOwnerScope(req, '', {
      userId,
      email: scopeEmail,
    });

    const id = String(req.params.id || '').trim();
    // PILNE-3 (2026-07-27): ten UPDATE miał twardy filtr `task_type='personal'`,
    // podczas gdy LISTA (GET /personal-tasks) zwraca KAŻDE zadanie właściciela w
    // organizacji, niezależnie od task_type (na demo 60 ze 151 zadań Piotra to
    // 'execution'/'interview'/'research'/…). Efekt: kanban My Work → Tasks
    // pokazywał kartę, drag działał, a PUT zwracał 404 → toast „Failed to update
    // status". To NIE był problem uprawnień. Zakres zawężają org + owner-scope,
    // dokładnie tak jak w GET /personal-tasks/:id, gdzie ten sam filtr zdjęto
    // wcześniej (patrz komentarz przy 404 w detalu).
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, status, CAST(updated_at AS TEXT) as "versionToken"
       FROM tasks t
       WHERE id = ? AND organization_id = ? AND ${ownerScope.whereSql}
       LIMIT 1`,
      [id, orgId, ...ownerScope.params]
    );
    if (!existing) {
      res.status(404).json({ error: 'Not found', code: 'TASK_NOT_FOUND' });
      return;
    }

    const expectedVersionToken =
      typeof req.body?.expectedVersionToken === 'string'
        ? req.body.expectedVersionToken.trim()
        : '';
    if (!expectedVersionToken) {
      res.status(428).json({
        error: 'expectedVersionToken is required',
        code: 'TASK_VERSION_REQUIRED',
      });
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

    // F15 (data-integrity): decode HTML entities escaped by the global sanitizer
    // before storing the update — same pattern as the create path above.
    if (typeof req.body?.title === 'string')
      setIf('title', decodeHtmlEntities(String(req.body.title).trim()));
    if (typeof req.body?.description === 'string') setIf('description', req.body.description);
    // R2/defekt #1: bez tego pole wczytywało się, ale każda edycja ginęła.
    // `setIf` sam pomija kolumnę, jeśli schemat jej nie ma — zmiana addytywna.
    if (typeof req.body?.expectedOutcome === 'string')
      setIf('expected_outcome', req.body.expectedOutcome);
    if (typeof req.body?.priority === 'string') setIf('priority', String(req.body.priority).trim());
    if (req.body?.dueDate !== undefined) {
      const d = req.body.dueDate ? String(req.body.dueDate).trim() : null;
      setIf('due_date', d);
    }
    if (req.body?.tags !== undefined) setIf('tags', JSON.stringify(parseTagsArray(req.body.tags)));

    // P8 (tor MVP, 2026-07-28): TaskDetailView pokazywał „Task updated" także dla
    // checklisty i przypisania osoby, ale ten handler czytał z body tylko 7 pól —
    // te trzy nie miały jak dojść do bazy. Kolumny w schemacie ISTNIEJĄ
    // (`checklist`, `assignee_id`, `owner_id`; w demo 369/417 zadań ma przypisanie),
    // więc brakowało wyłącznie odczytu żądania. `setIf` pomija kolumnę nieobecną
    // w schemacie, więc zmiana jest addytywna.
    // ⚠ Naprawa ma DWIE warstwy — front (`TaskDetailView.tsx:1091` `personalPayload`)
    // też pomijał te pola. Sama zmiana serwera nic nie da.
    if (req.body?.checklist !== undefined) {
      const raw = req.body.checklist;
      setIf('checklist', raw === null ? null : typeof raw === 'string' ? raw : JSON.stringify(raw));
    }
    if (req.body?.assigneeId !== undefined) {
      const a = req.body.assigneeId ? String(req.body.assigneeId).trim() : null;
      setIf('assignee_id', a);
    }
    if (req.body?.ownerId !== undefined) {
      const o = req.body.ownerId ? String(req.body.ownerId).trim() : null;
      setIf('owner_id', o);
    }

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
      // The token must advance even when two writes land within the database
      // clock's visible precision. Resolve dialect at request time because ESM
      // imports can execute before test bootstraps set DB_TYPE.
      setParts.push(
        process.env.DB_TYPE === 'postgres'
          ? "updated_at = GREATEST(clock_timestamp(), updated_at + INTERVAL '1 microsecond')"
          : "updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', '+0.001 seconds')"
      );
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
          t.expected_outcome as "expectedOutcome",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
          CAST(t.updated_at AS TEXT) as "versionToken",
          t.completed_at as "completedAt"
        FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND ${ownerScope.whereSql}
        LIMIT 1
      `,
        [id, orgId, ...ownerScope.params]
      );
      res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
      return;
    }

    params.push(id, orgId, ...ownerScopeNoAlias.params);
    params.push(expectedVersionToken);
    const updateResult = await queryHelpers.queryRun(
      `UPDATE tasks SET ${setParts.join(', ')} WHERE id = ? AND organization_id = ? AND ${ownerScopeNoAlias.whereSql} AND CAST(updated_at AS TEXT) = ?`,
      params
    );
    if (Number(updateResult?.changes || 0) === 0) {
      const current = await queryHelpers.queryOne<{ versionToken: string }>(
        `SELECT CAST(updated_at AS TEXT) as "versionToken"
         FROM tasks t
         WHERE id = ? AND organization_id = ? AND ${ownerScope.whereSql}
         LIMIT 1`,
        [id, orgId, ...ownerScope.params]
      );
      res.status(409).json({
        error: 'Task changed since it was opened',
        code: 'TASK_VERSION_CONFLICT',
        currentVersionToken: current?.versionToken || null,
      });
      return;
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
        t.expected_outcome as "expectedOutcome",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        CAST(t.updated_at AS TEXT) as "versionToken",
        t.completed_at as "completedAt"
      FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND ${ownerScope.whereSql}
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
    const scopeEmail = await resolveEmailForPersonalTaskScope(req, identity);
    const ownerScope = buildPersonalTaskOwnerScope(req, '', {
      userId,
      email: scopeEmail,
    });

    const id = String(req.params.id || '').trim();
    await queryHelpers.queryRun(
      `DELETE FROM tasks WHERE id = ? AND organization_id = ? AND ${ownerScope.whereSql} AND lower(coalesce(task_type,''))='personal'`,
      [id, orgId, ...ownerScope.params]
    );
    res.status(204).send();
  })
);

router.use(calendarRouter);

router.use(decisionsRouter);

router.use(whiteboardUploadsRouter);

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

    // PERF (FIX-1 inbox N+1): these sources are independent — run them in
    // parallel with Promise.all instead of ~8 sequential awaits so a single
    // /inbox request issues one fan-out round-trip set, not a serial chain.
    const triagedRowsPromise = queryHelpers
      .queryAll<{
        item_key: string;
        action: string;
        params_json?: string;
        triaged_at: string;
      }>(
        `SELECT item_key, action, params_json, triaged_at FROM my_work_inbox_triage WHERE user_id = ?`,
        [userId]
      )
      .then((rows) => rows || []);
    // 1) Overdue tasks (assigned)
    const overdueTasksPromise = queryHelpers
      .queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as "dueDate",
               t.initiative_id as "initiativeId", i.name as "initiativeName",
               t.blocked_reason as "blockedReason",
               t.blocked_by_decision_id as "blockedByDecisionId",
               t.blocked_at as "blockedAt",
               t.created_at as "createdAt"
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
      )
      .then((rows) => rows || []);

    // 1b) Blocked tasks (assigned)
    const blockedTasksPromise = queryHelpers
      .queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as "dueDate",
               t.initiative_id as "initiativeId", i.name as "initiativeName",
               t.blocked_reason as "blockedReason",
               t.blocked_by_decision_id as "blockedByDecisionId",
               t.blocked_at as "blockedAt",
               t.updated_at as "updatedAt",
               t.created_at as "createdAt"
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
      )
      .then((rows) => rows || []);

    // 1c) Assigned open tasks (non-overdue, non-blocked)
    const assignedOpenTasksPromise = queryHelpers
      .queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as "dueDate",
               t.initiative_id as "initiativeId", i.name as "initiativeName",
               t.updated_at as "updatedAt",
               t.created_at as "createdAt"
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
      )
      .then((rows) => rows || []);

    // 2) Pending decisions (owned) — self-contained: schema probe + query
    const pendingDecisionsPromise = (async () => {
      const decisionCols = await getTableColumns('decisions');
      const decisionPrioritySelect = decisionCols.has('priority')
        ? 'd.priority'
        : `'MEDIUM' as priority`;
      return (
        (await queryHelpers.queryAll<any>(
          `
        SELECT d.id, d.title, d.description, d.type as "decisionType", d.status, ${decisionPrioritySelect}, d.deadline as "dueDate", d.created_at as "createdAt",
               p.name as "projectName"
        FROM decisions d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.organization_id = ?
          AND d.decision_maker_id = ?
          AND lower(coalesce(d.status,'')) IN ('pending','escalated')
        ORDER BY d.created_at DESC
        LIMIT ?
      `,
          [orgId, userId, Math.min(25, limit)]
        )) || []
      );
    })();

    // 3) Unread notifications (owned) — self-contained: schema probe + query
    const unreadNotificationsPromise = (async () => {
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
        ? 'entity_type as "entityType"'
        : notifCols.has('entityType')
          ? 'entityType as "entityType"'
          : 'NULL as "entityType"';
      const notifEntityIdSelect = notifCols.has('entity_id')
        ? 'entity_id as "entityId"'
        : notifCols.has('entityId')
          ? 'entityId as "entityId"'
          : 'NULL as "entityId"';

      return (
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
          created_at as "createdAt"
        FROM notifications
        WHERE user_id = ?
          AND ${notifReadExpr} = 0
        ORDER BY created_at DESC
        LIMIT ?
      `,
          [userId, Math.min(25, limit)]
        )) || []
      );
    })();

    // Resolve all independent inbox sources in parallel (FIX-1 inbox N+1).
    const [
      triagedRows,
      overdueTasks,
      blockedTasks,
      assignedOpenTasks,
      pendingDecisions,
      unreadNotifications,
    ] = await Promise.all([
      triagedRowsPromise,
      overdueTasksPromise,
      blockedTasksPromise,
      assignedOpenTasksPromise,
      pendingDecisionsPromise,
      unreadNotificationsPromise,
    ]);

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
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const { id } = req.params;
    const { toUserId, notes } = req.body || {};
    if (!toUserId || typeof toUserId !== 'string') {
      return res.status(400).json({ error: 'toUserId is required' });
    }

    const ownerRow = await queryHelpers.queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM canonical_inbox_items WHERE id = ?`,
      [id]
    );
    if (!ownerRow) return res.status(404).json({ error: 'Inbox item not found' });
    if (String(ownerRow.organization_id) !== String(orgId)) {
      return res.status(403).json({ error: 'Forbidden' });
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
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const { id } = req.params;
    const { until } = req.body || {};
    if (!until || typeof until !== 'string') {
      return res.status(400).json({ error: 'until (ISO date) is required' });
    }

    // SECURITY: scoped by user_id AND organization_id — previously this only
    // checked organization_id, so any org member could snooze another user's
    // inbox item. A missing row and a wrong-owner row both resolve to the
    // same "not found" response below (no enumeration leak).
    const ownerRow = await queryHelpers.queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM canonical_inbox_items WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [id, userId, orgId]
    );
    if (!ownerRow) return res.status(404).json({ error: 'Inbox item not found' });

    const item = await inboxService.triageItem(
      id,
      'snooze',
      { snoozedUntil: until },
      { userId, organizationId: orgId }
    );
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
    const { orgId } = identity;
    if (!(await requireTables(res, ['canonical_inbox_items']))) return;

    const { id } = req.params;
    const { slaDeadline } = req.body || {};
    if (!slaDeadline || typeof slaDeadline !== 'string') {
      return res.status(400).json({ error: 'slaDeadline (ISO datetime) is required' });
    }

    const ownerRow = await queryHelpers.queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM canonical_inbox_items WHERE id = ?`,
      [id]
    );
    if (!ownerRow) return res.status(404).json({ error: 'Inbox item not found' });
    if (String(ownerRow.organization_id) !== String(orgId)) {
      return res.status(403).json({ error: 'Forbidden' });
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

// ============================================================================
// Focus board persistence → ./my-work/focus.routes.ts (lines 2668–2906)
// ============================================================================
router.use(focusRouter);

// Stats, team workload, context summary → ./my-work/stats.routes.ts
router.use(statsRouter);

// M02-008: one coherent Manager snapshot → ./my-work/manager.routes.ts
router.use(managerRouter);

router.use(signalsRouter);

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
    const ideaColumns = await getTableColumns('my_ideas');
    const lineageSelect = [
      ideaColumns.has('action_contract_json')
        ? 'action_contract_json'
        : "'{}' as action_contract_json",
      ideaColumns.has('source_pack_json') ? 'source_pack_json' : "'{}' as source_pack_json",
      ideaColumns.has('evidence_refs_json') ? 'evidence_refs_json' : "'[]' as evidence_refs_json",
      // E12: same feature-detect pattern as the JSON columns above — degrade
      // honestly to the implicit default on a database where the additive
      // 20260810_idea_confidentiality.sql migration hasn't run yet.
      ideaColumns.has('confidentiality') ? 'confidentiality' : "'standard' as confidentiality",
    ].join(',\n          ');

    // Home-shell columns (folders / favorites / recents). Guarded so the list
    // works whether or not the M2 migration has been applied yet.
    const homeSelect = [
      ideaColumns.has('folder_id') ? 'folder_id as "folderId"' : 'NULL as "folderId"',
      ideaColumns.has('is_favorite') ? 'is_favorite as "isFavorite"' : '0 as "isFavorite"',
      ideaColumns.has('last_opened_at')
        ? 'last_opened_at as "lastOpenedAt"'
        : 'NULL as "lastOpenedAt"',
    ].join(',\n          ');

    // RV-008: `preferredTool` is resolved AFTER the base query below, one
    // idea at a time, through `selectReadableMapRow` — the exact same
    // tenant/user-scoped resolver `GET /my-ideas/:id/map` uses to decide what
    // Open actually shows. This list previously used a tolerant
    // `is_canonical DESC NULLS LAST` fallback while `GET /map` required a
    // strict canonical match with no fallback, so a Table-labelled idea whose
    // map was never flagged canonical opened as Mind Map instead. Sharing one
    // resolver makes that divergence structurally impossible.
    const listMapCols = await getTableColumns('my_idea_maps');
    const canResolvePreferredTool = listMapCols.has('preferred_tool');

    const folder = req.query.folder ? String(req.query.folder).trim() : '';
    const favoriteOnly =
      String(req.query.favoriteOnly || '') === 'true' || req.query.favoriteOnly === '1';

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
    if (folder && ideaColumns.has('folder_id')) {
      whereExtra += ' AND folder_id = ?';
      params.push(folder);
    }
    if (favoriteOnly && ideaColumns.has('is_favorite')) {
      whereExtra += ' AND is_favorite = 1';
    }
    if (req.query.stage && ideaColumns.has('stage')) {
      whereExtra += ' AND stage = ?';
      params.push(String(req.query.stage).trim());
    }
    if (req.query.area && ideaColumns.has('area')) {
      whereExtra += ' AND area = ?';
      params.push(String(req.query.area).trim());
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
          ${lineageSelect},
          ${homeSelect},
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

    // RV-008: every row here already belongs to `userId` (the WHERE clause
    // above), so `userId` IS each row's owner for the legacy-mode resolver
    // branch — no extra `user_id` column needed in the SELECT.
    const preferredTools = canResolvePreferredTool
      ? await Promise.all(
          rows.map((r: any) =>
            selectReadableMapRow<{ preferredTool: string | null }>(
              ideaMapAccessDb,
              String(r.id),
              userId,
              orgId,
              'preferred_tool as "preferredTool"'
            )
          )
        )
      : rows.map(() => null);

    res.json(
      rows.map((r: any, i: number) =>
        decorateIdeaLineage({
          ...r,
          tags: parseTagsArray(r?.tags),
          isFavorite: !!r?.isFavorite,
          preferredTool: preferredTools[i]?.preferredTool ?? null,
        })
      )
    );
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

    const title = decodeIdeaText(String(req.body?.title || '').trim());
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const body = typeof req.body?.body === 'string' ? decodeIdeaText(req.body.body) : null;
    const tags = parseTagsArray(req.body?.tags);
    const sourceType = req.body?.sourceType ? String(req.body.sourceType) : null;
    const sourceConversationId = req.body?.sourceConversationId
      ? String(req.body.sourceConversationId)
      : null;
    const sourceMessageId = req.body?.sourceMessageId ? String(req.body.sourceMessageId) : null;
    const sourcePack =
      req.body?.sourcePack &&
      typeof req.body.sourcePack === 'object' &&
      !Array.isArray(req.body.sourcePack)
        ? req.body.sourcePack
        : {};
    const actionContract =
      req.body?.actionContract &&
      typeof req.body.actionContract === 'object' &&
      !Array.isArray(req.body.actionContract)
        ? req.body.actionContract
        : {};
    const evidenceRefs = Array.isArray(req.body?.evidenceRefs)
      ? req.body.evidenceRefs.map((ref: unknown) => String(ref || '').trim()).filter(Boolean)
      : [];

    const id = uuidv4();
    const ideaColumns = await getTableColumns('my_ideas');
    const hasIdeaColumn = (column: string) => ideaColumns.has(column);
    const insertColumns = [
      'id',
      'user_id',
      'organization_id',
      'title',
      'body',
      'tags',
      'source_type',
      'source_conversation_id',
      'source_message_id',
    ];
    const insertValues: unknown[] = [
      id,
      userId,
      orgId,
      title,
      body,
      JSON.stringify(tags),
      sourceType,
      sourceConversationId,
      sourceMessageId,
    ];
    if (hasIdeaColumn('action_contract_json')) {
      insertColumns.push('action_contract_json');
      insertValues.push(JSON.stringify(actionContract));
    }
    if (hasIdeaColumn('source_pack_json')) {
      insertColumns.push('source_pack_json');
      insertValues.push(JSON.stringify(sourcePack));
    }
    if (hasIdeaColumn('evidence_refs_json')) {
      insertColumns.push('evidence_refs_json');
      insertValues.push(JSON.stringify(evidenceRefs));
    }
    if (hasIdeaColumn('folder_id') && req.body?.folderId) {
      insertColumns.push('folder_id');
      insertValues.push(String(req.body.folderId));
    }

    await queryHelpers.queryRun(
      `
      INSERT INTO my_ideas (${insertColumns.join(', ')})
      VALUES (${insertColumns.map(() => '?').join(', ')})
    `,
      insertValues
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
        stage,
        potential,
        complexity,
        area,
        priority,
        branch,
        promoted_to as "promotedTo",
        ${hasIdeaColumn('action_contract_json') ? 'action_contract_json' : "'{}' as action_contract_json"},
        ${hasIdeaColumn('source_pack_json') ? 'source_pack_json' : "'{}' as source_pack_json"},
        ${hasIdeaColumn('evidence_refs_json') ? 'evidence_refs_json' : "'[]' as evidence_refs_json"},
        ${hasIdeaColumn('folder_id') ? 'folder_id as "folderId"' : 'NULL as "folderId"'},
        ${hasIdeaColumn('is_favorite') ? 'is_favorite as "isFavorite"' : '0 as "isFavorite"'},
        ${hasIdeaColumn('last_opened_at') ? 'last_opened_at as "lastOpenedAt"' : 'NULL as "lastOpenedAt"'},
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
        metadata: { fromAI: Boolean(req.body?.fromAI), actionContract, evidenceRefs },
      })
      .catch((err: any) => logger.warn('[MyIdeas] Audit log failed:', err?.message));

    // Org-context capture rebuilds organization_context_snapshots, which on
    // data-heavy orgs runs a ~20s claims aggregation. The snapshot does NOT need
    // to be fresh before we ack the create — defer it (fire-and-forget, like the
    // audit-log call above) so idea creation returns immediately.
    void organizationContextService
      .recordMyWorkIdea({
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
          sourcePack,
          actionContract,
          evidenceRefs,
        },
      })
      .catch((err: any) =>
        logger.warn('[MyIdeas] org-context capture failed (create):', err?.message)
      );

    res.status(201).json(
      decorateIdeaLineage({
        ...row,
        tags: parseTagsArray((row as any)?.tags),
        isFavorite: !!(row as any)?.isFavorite,
      })
    );
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
    const ideaColumns = await getTableColumns('my_ideas');
    const hasMaturityGatesColumn = ideaColumns.has('maturity_gates_json');
    const hasConfidentialityColumn = ideaColumns.has('confidentiality');
    const lineageSelect = [
      ideaColumns.has('action_contract_json')
        ? 'action_contract_json'
        : "'{}' as action_contract_json",
      ideaColumns.has('source_pack_json') ? 'source_pack_json' : "'{}' as source_pack_json",
      ideaColumns.has('evidence_refs_json') ? 'evidence_refs_json' : "'[]' as evidence_refs_json",
      // E08: only select the real column when the additive migration has run —
      // never fabricate a fake "supported" value here (see maturityGatesSupported below).
      hasMaturityGatesColumn ? 'maturity_gates_json' : 'NULL as maturity_gates_json',
      // E12: same honest-degrade pattern — a database without the
      // 20260810_idea_confidentiality.sql migration reports the implicit
      // default rather than 500ing or fabricating a "gate applied" signal.
      hasConfidentialityColumn ? 'confidentiality' : "'standard' as confidentiality",
    ].join(',\n        ');
    const homeSelectDetail = [
      ideaColumns.has('folder_id') ? 'folder_id as "folderId"' : 'NULL as "folderId"',
      ideaColumns.has('is_favorite') ? 'is_favorite as "isFavorite"' : '0 as "isFavorite"',
      ideaColumns.has('last_opened_at')
        ? 'last_opened_at as "lastOpenedAt"'
        : 'NULL as "lastOpenedAt"',
    ].join(',\n        ');
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
        ${lineageSelect},
        ${homeSelectDetail},
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

    res.json(
      decorateIdeaLineage({
        ...row,
        tags: parseTagsArray((row as any)?.tags),
        isFavorite: !!(row as any)?.isFavorite,
        // E08: explicit capability flag — never let the client infer "supported"
        // from data shape alone (empty {} is ambiguous between "not run yet"
        // and "run but nothing attested"). See ideaMaturityModel.ts header.
        maturityGatesSupported: hasMaturityGatesColumn,
        // E12: same explicit capability flag for the confidentiality gate —
        // lets a future UI distinguish "this idea is 'standard'" from "this
        // database can't persist a level at all yet".
        confidentialitySupported: hasConfidentialityColumn,
      })
    );
  })
);

/**
 * PATCH /api/my-work/my-ideas/:id/maturity-gates
 *
 * E08 (idea maturity model) — sets ONE user attestation for an `attested`
 * stage-gate criterion (see src/components/MyWork/ideaMaturityModel.ts —
 * initial economics / recommendation / financial scenario / dependencies /
 * unresolved assumptions have no other backing field in the product).
 *
 * Honest degrade: if the additive `maturity_gates_json` column
 * (server/migrations/20260810_idea_maturity_gates.sql) has not been applied
 * on this database, responds `{ success: true, applied: false }` — NEVER a
 * fake `applied: true` — so the client can show "not saved" instead of a
 * false success toast (house rule: no silent no-op behind a success state).
 */
router.patch(
  '/my-ideas/:id/maturity-gates',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const id = String(req.params.id || '').trim();
    const attestation = IdeaMaturityAttestationSchema.safeParse(req.body || {});
    if (!attestation.success) {
      return res.status(400).json({
        error: 'Invalid maturity attestation',
        code: 'IDEA_MATURITY_ATTESTATION_INVALID',
      });
    }
    const { criterionId, met, note } = attestation.data;

    const ideaColumns = await getTableColumns('my_ideas');
    if (!ideaColumns.has('maturity_gates_json')) {
      return res.json({ success: true, applied: false, maturityGates: {} });
    }

    const existing = await queryHelpers.queryOne<{ maturity_gates_json: string | null }>(
      `SELECT maturity_gates_json FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [id, userId, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Idea not found' });

    const current = parseJsonField<Record<string, unknown>>(existing.maturity_gates_json, {});
    const next = {
      ...current,
      [criterionId]: { met, note, byUserId: userId, at: new Date().toISOString() },
    };

    await queryHelpers.queryRun(
      `UPDATE my_ideas SET maturity_gates_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [JSON.stringify(next), id, userId, orgId]
    );

    res.json({ success: true, applied: true, maturityGates: next });
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
    // `confidentiality` is feature-detected like every other additive column on this
    // table: without it the audit event below would silently record `undefined ->
    // undefined` for the one field on this route that is a security classification.
    const ideaColumnsForExisting = await getTableColumns('my_ideas');
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, title, body, tags, stage, branch, area, priority, ${
        ideaColumnsForExisting.has('confidentiality')
          ? 'confidentiality'
          : "'standard' as confidentiality"
      } FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
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

    if (typeof req.body?.title === 'string')
      set('title', decodeIdeaText(String(req.body.title).trim()));
    if (typeof req.body?.body === 'string') set('body', decodeIdeaText(req.body.body));
    if (req.body?.tags !== undefined) set('tags', JSON.stringify(parseTagsArray(req.body.tags)));
    if (typeof req.body?.branch === 'string') set('branch', req.body.branch);
    if (typeof req.body?.area === 'string') set('area', req.body.area);
    if (typeof req.body?.priority === 'number')
      set('priority', Math.max(0, Math.min(100, req.body.priority)));
    if (req.body?.stage !== undefined) {
      const stage = GovernedIdeaStageEnum.safeParse(req.body.stage);
      if (!stage.success) {
        return res.status(400).json({
          error: 'Invalid idea stage',
          code: 'IDEA_STAGE_INVALID',
        });
      }
      set('stage', stage.data);
    }

    // Home-shell fields (guarded so they no-op until the M2 migration lands).
    const ideaColumns = await getTableColumns('my_ideas');
    if (typeof req.body?.isFavorite === 'boolean' && ideaColumns.has('is_favorite')) {
      set('is_favorite', req.body.isFavorite ? 1 : 0);
    }
    if (req.body?.folderId !== undefined && ideaColumns.has('folder_id')) {
      set('folder_id', req.body.folderId ? String(req.body.folderId) : null);
    }

    // E12: confidentiality gate (server/src/services/ideaConfidentiality.ts).
    // Validated against the closed value set BEFORE it ever reaches the
    // query — the column has a CHECK constraint, and letting a bad value
    // through would surface as an opaque 500 instead of a clear 400.
    // Feature-detected the same way as the home-shell fields above so a
    // database without the additive 20260810_idea_confidentiality.sql
    // migration silently no-ops the persist instead of erroring.
    if (req.body?.confidentiality !== undefined) {
      const requestedConfidentiality = String(req.body.confidentiality).trim().toLowerCase();
      if (!(IDEA_CONFIDENTIALITY_LEVELS as readonly string[]).includes(requestedConfidentiality)) {
        res.status(400).json({
          error: `confidentiality must be one of: ${IDEA_CONFIDENTIALITY_LEVELS.join(', ')}`,
        });
        return;
      }
      if (ideaColumns.has('confidentiality')) {
        set('confidentiality', requestedConfidentiality);
      }
    }

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
        stage,
        potential,
        complexity,
        area,
        priority,
        branch,
        promoted_to as "promotedTo",
        ${ideaColumns.has('action_contract_json') ? 'action_contract_json' : "'{}' as action_contract_json"},
        ${ideaColumns.has('source_pack_json') ? 'source_pack_json' : "'{}' as source_pack_json"},
        ${ideaColumns.has('evidence_refs_json') ? 'evidence_refs_json' : "'[]' as evidence_refs_json"},
        ${ideaColumns.has('folder_id') ? 'folder_id as "folderId"' : 'NULL as "folderId"'},
        ${ideaColumns.has('is_favorite') ? 'is_favorite as "isFavorite"' : '0 as "isFavorite"'},
        ${ideaColumns.has('last_opened_at') ? 'last_opened_at as "lastOpenedAt"' : 'NULL as "lastOpenedAt"'},
        ${ideaColumns.has('confidentiality') ? 'confidentiality' : "'standard' as confidentiality"},
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
          // Security classification — the ONE field on this route whose change is a
          // security event rather than an edit. Downgrading `restricted` -> `standard`
          // re-opens all eight AI/export endpoints on the very next request (the gate
          // re-reads the column per call, by design — it is a live classification, not
          // a one-way lock). Without this pair, a downgrade-then-exfiltrate sequence is
          // indistinguishable from someone fixing a typo in the title.
          confidentiality: existing.confidentiality,
        },
        after: {
          title: (row as any)?.title,
          body: (row as any)?.body,
          tags: (row as any)?.tags,
          stage: (row as any)?.stage,
          confidentiality: (row as any)?.confidentiality,
        },
        metadata: { fromAI: Boolean(req.body?.fromAI) },
      })
      .catch((err: any) => logger.warn('[MyIdeas] Audit log failed:', err?.message));

    // Fire-and-forget org-context capture (see create handler) — avoids blocking
    // the update ack on the ~20s snapshot rebuild.
    void organizationContextService
      .recordMyWorkIdea({
        organizationId: orgId,
        userId,
        payload: {
          ideaId: id,
          title: (row as any)?.title,
          body: (row as any)?.body,
          tags: parseTagsArray((row as any)?.tags),
          stage: (row as any)?.stage,
        },
      })
      .catch((err: any) =>
        logger.warn('[MyIdeas] org-context capture failed (update):', err?.message)
      );

    res.json(
      decorateIdeaLineage({
        ...row,
        tags: parseTagsArray((row as any)?.tags),
        isFavorite: !!(row as any)?.isFavorite,
      })
    );
  })
);

// Record that an idea was opened (server-backed "recents"). Lightweight, no audit.
router.post(
  '/my-ideas/:id/opened',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const ideaColumns = await getTableColumns('my_ideas');
    if (!ideaColumns.has('last_opened_at')) {
      res.json({ ok: true, skipped: true });
      return;
    }
    const id = String(req.params.id || '').trim();
    await queryHelpers.queryRun(
      `UPDATE my_ideas SET last_opened_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [id, userId, orgId]
    );
    res.json({ ok: true });
  })
);

// ── Idea folders (per-user organization) ─────────────────────────────────────
router.get(
  '/my-idea-folders',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_idea_folders']))) return;
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT id, name, description, color,
                parent_folder_id as "parentFolderId",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM my_idea_folders
         WHERE user_id = ? AND organization_id = ?
         ORDER BY lower(name) ASC`,
        [userId, orgId]
      )) || [];
    res.json(rows);
  })
);

router.post(
  '/my-idea-folders',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_idea_folders']))) return;
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const description = typeof req.body?.description === 'string' ? req.body.description : null;
    const color = req.body?.color ? String(req.body.color) : null;
    const parentFolderId = req.body?.parentFolderId ? String(req.body.parentFolderId) : null;
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO my_idea_folders
         (id, user_id, organization_id, name, description, color, parent_folder_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, orgId, name, description, color, parentFolderId]
    );
    res.status(201).json({ id, name, description, color, parentFolderId });
  })
);

router.put(
  '/my-idea-folders/:folderId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_idea_folders']))) return;
    const folderId = String(req.params.folderId || '').trim();
    const setParts: string[] = [];
    const params: any[] = [];
    const set = (col: string, val: any) => {
      setParts.push(`${col} = ?`);
      params.push(val);
    };
    if (typeof req.body?.name === 'string') set('name', req.body.name.trim());
    if (typeof req.body?.description === 'string') set('description', req.body.description);
    if (typeof req.body?.color === 'string') set('color', req.body.color);
    if (req.body?.parentFolderId !== undefined)
      set('parent_folder_id', req.body.parentFolderId ? String(req.body.parentFolderId) : null);
    if (setParts.length === 0) {
      res.json({ ok: true });
      return;
    }
    setParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(folderId, userId, orgId);
    await queryHelpers.queryRun(
      `UPDATE my_idea_folders SET ${setParts.join(', ')}
       WHERE id = ? AND user_id = ? AND organization_id = ?`,
      params
    );
    res.json({ ok: true });
  })
);

router.delete(
  '/my-idea-folders/:folderId',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_idea_folders']))) return;
    const folderId = String(req.params.folderId || '').trim();
    // Keep the ideas — just unfile them — then drop the folder.
    const ideaColumns = await getTableColumns('my_ideas');
    if (ideaColumns.has('folder_id')) {
      await queryHelpers.queryRun(
        `UPDATE my_ideas SET folder_id = NULL
         WHERE folder_id = ? AND user_id = ? AND organization_id = ?`,
        [folderId, userId, orgId]
      );
    }
    await queryHelpers.queryRun(
      `DELETE FROM my_idea_folders WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [folderId, userId, orgId]
    );
    res.json({ ok: true });
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

    // M02-P08: mirror GET/PUT's existing 404-on-not-found contract. Without
    // this check the handler always answered 204 even when the WHERE clause
    // (user_id + organization_id) matched zero rows -- e.g. a cross-tenant
    // caller, a forged id, or an id already deleted. The DELETE was always
    // correctly SCOPED (no data was ever touched cross-tenant -- verified
    // against a real Postgres in tests/integration/
    // m02-p08-ideas-hub-golden-flow.realdb.test.ts), but the response lied
    // about success, which can make a client believe a no-op delete worked.
    if (!before) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [id, userId, orgId]
    );

    req
      .emitAuditEvent?.({
        actorType: 'USER',
        action: 'IDEA_DELETE',
        resourceType: 'idea',
        resourceId: id,
        before: { title: before.title, tags: before.tags, stage: before.stage },
      })
      .catch((err: any) => logger.warn('[MyIdeas] Audit log failed:', err?.message));

    res.status(204).send();
  })
);

/**
 * POST /api/my-work/my-ideas/:id/duplicate
 * Clone an idea + its canonical mind-map into a brand-new record owned by the
 * caller. Guarded to the OWNER (user_id + organization_id) → a foreign / cross-org
 * id resolves to no row and returns 404, so nobody can duplicate someone else's idea.
 *
 * The copy is a FRESH idea: new uuid, `title` gets a " (kopia)"/" (copy)" suffix,
 * content columns are copied verbatim, but promotion state (promoted_to /
 * promoted_entity_id) is deliberately dropped and a 'promoted' stage is reset to
 * 'seed' — a duplicate has never been promoted.
 *
 * Transactionality: there is no dedicated-connection transaction API here, and a
 * pool-level BEGIN/COMMIT is the known write-loss antipattern in this repo. So the
 * two writes run sequentially with COMPENSATION — if the map copy throws, the
 * just-created idea row is deleted so we never leave a half-clone behind.
 */
router.post(
  '/my-ideas/:id/duplicate',
  requireAudit,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const sourceId = String(req.params.id || '').trim();
    if (!sourceId || sourceId === 'all') {
      return res.status(400).json({ error: 'Invalid idea id' });
    }

    const language = String(req.query.language || req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    // OWNER guard: user_id + organization_id. A cross-user / cross-org id → no row → 404.
    const source = await queryHelpers.queryOne<any>(
      `SELECT * FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [sourceId, userId, orgId]
    );
    if (!source) return res.status(404).json({ error: 'Idea not found' });

    const ideaColumns = await getTableColumns('my_ideas');
    const hasIdeaColumn = (column: string) => ideaColumns.has(column);

    const newId = uuidv4();
    const suffix = isPl ? ' (kopia)' : ' (copy)';
    const newTitle = `${String(source.title || '').trim()}${suffix}`;

    // Content columns copied verbatim. Identity (id/user/org/timestamps) is fresh;
    // promotion state (promoted_to / promoted_entity_id) is intentionally omitted.
    const copyableColumns = [
      'body',
      'tags',
      'source_type',
      'source_conversation_id',
      'source_message_id',
      'seed_text',
      'ai_expansion',
      'research_data',
      'creative_proposals',
      'summary_data',
      'potential',
      'complexity',
      'area',
      'priority',
      'branch',
      'action_contract_json',
      'source_pack_json',
      'evidence_refs_json',
      'folder_id',
    ];

    const insertColumns = ['id', 'user_id', 'organization_id', 'title'];
    const insertValues: unknown[] = [newId, userId, orgId, newTitle];
    for (const col of copyableColumns) {
      if (hasIdeaColumn(col) && source[col] !== undefined) {
        insertColumns.push(col);
        insertValues.push(source[col] ?? null);
      }
    }
    // stage: copy through, but a 'promoted' source resets to 'seed' so it stays
    // consistent with the dropped promotion state.
    if (hasIdeaColumn('stage')) {
      const srcStage = source.stage ? String(source.stage) : null;
      insertColumns.push('stage');
      insertValues.push(srcStage === 'promoted' ? 'seed' : srcStage);
    }

    await queryHelpers.queryRun(
      `INSERT INTO my_ideas (${insertColumns.join(', ')}) VALUES (${insertColumns
        .map(() => '?')
        .join(', ')})`,
      insertValues
    );

    // Copy the canonical map (nodes / edges / extensions / preferred_tool) if one
    // exists. Mirrors the same shared-vs-legacy row resolution as GET /:id/map.
    const mapCols = await getTableColumns('my_idea_maps');
    if (mapCols.size > 0) {
      const sharedMode = sharedIdeaMapsActive(mapCols);
      const extColSelect = mapCols.has('extensions_json')
        ? ', extensions_json as "extensionsJson"'
        : '';
      const preferredToolSelect = mapCols.has('preferred_tool')
        ? ', preferred_tool as "preferredTool"'
        : '';
      const schemaVersionSelect = mapCols.has('schema_version')
        ? ', schema_version as "schemaVersion"'
        : '';
      const sourceMap = sharedMode
        ? await queryHelpers.queryOne<any>(
            `SELECT nodes_json as "nodesJson", edges_json as "edgesJson"${extColSelect}${preferredToolSelect}${schemaVersionSelect} FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
            [sourceId, orgId]
          )
        : await queryHelpers.queryOne<any>(
            `SELECT nodes_json as "nodesJson", edges_json as "edgesJson"${extColSelect}${preferredToolSelect}${schemaVersionSelect} FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
            [sourceId, userId, orgId]
          );

      if (sourceMap && (sourceMap.nodesJson || sourceMap.edgesJson)) {
        try {
          const mapId = uuidv4();
          const nowMap = new Date().toISOString();
          const mapInsertCols: string[] = ['id'];
          const mapInsertVals: string[] = ['?'];
          const mapInsertParams: unknown[] = [mapId];
          const addMap = (col: string, val: unknown) => {
            if (!mapCols.has(col)) return;
            mapInsertCols.push(col);
            mapInsertVals.push('?');
            mapInsertParams.push(val);
          };
          addMap('idea_id', newId);
          addMap('user_id', userId);
          addMap('organization_id', orgId);
          addMap('nodes_json', sourceMap.nodesJson ?? '[]');
          addMap('edges_json', sourceMap.edgesJson ?? '[]');
          addMap('version', 1);
          addMap('schema_version', Number(sourceMap.schemaVersion) || 3);
          if (sourceMap.preferredTool) addMap('preferred_tool', sourceMap.preferredTool);
          if (sourceMap.extensionsJson) addMap('extensions_json', sourceMap.extensionsJson);
          // In shared mode the fresh copy is the canonical row from birth.
          if (sharedMode) {
            addMap('is_canonical', true);
            addMap('last_editor_user_id', userId);
          }
          addMap('created_at', nowMap);
          addMap('updated_at', nowMap);
          await queryHelpers.queryRun(
            `INSERT INTO my_idea_maps (${mapInsertCols.join(', ')}) VALUES (${mapInsertVals.join(
              ', '
            )})`,
            mapInsertParams
          );
        } catch (mapErr: any) {
          // Compensation: drop the orphaned idea so we never leave a half-clone.
          await queryHelpers
            .queryRun(`DELETE FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ?`, [
              newId,
              userId,
              orgId,
            ])
            .catch((delErr: any) =>
              logger.error('[MyIdeas] Duplicate compensation delete failed:', delErr?.message)
            );
          logger.error('[MyIdeas] Duplicate map copy failed, compensated:', mapErr?.message);
          return res.status(500).json({ error: 'Failed to duplicate idea map' });
        }
      }
    }

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
        potential,
        complexity,
        area,
        priority,
        branch,
        promoted_to as "promotedTo",
        ${hasIdeaColumn('action_contract_json') ? 'action_contract_json' : "'{}' as action_contract_json"},
        ${hasIdeaColumn('source_pack_json') ? 'source_pack_json' : "'{}' as source_pack_json"},
        ${hasIdeaColumn('evidence_refs_json') ? 'evidence_refs_json' : "'[]' as evidence_refs_json"},
        ${hasIdeaColumn('folder_id') ? 'folder_id as "folderId"' : 'NULL as "folderId"'},
        ${hasIdeaColumn('is_favorite') ? 'is_favorite as "isFavorite"' : '0 as "isFavorite"'},
        ${hasIdeaColumn('last_opened_at') ? 'last_opened_at as "lastOpenedAt"' : 'NULL as "lastOpenedAt"'},
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [newId, userId, orgId]
    );

    req
      .emitAuditEvent?.({
        actorType: 'USER',
        action: 'IDEA_CREATE',
        resourceType: 'idea',
        resourceId: newId,
        after: { title: newTitle, duplicatedFrom: sourceId },
        metadata: { duplicatedFrom: sourceId },
      })
      .catch((err: any) => logger.warn('[MyIdeas] Audit log failed (duplicate):', err?.message));

    res.status(201).json(
      decorateIdeaLineage({
        ...row,
        tags: parseTagsArray((row as any)?.tags),
        isFavorite: !!(row as any)?.isFavorite,
      })
    );
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

/**
 * DP-3 (T4) — shared/canonical idea-map access.
 *
 * `ideaMapAccess.ts` (T3) exposes `assertIdeaMembership` / `selectCanonicalMapRow`
 * over an `IDatabase`-shaped handle (its queries call `db.get(sql, params)`).
 * The my-work routes read/write through `queryHelpers.queryOne`, which wraps the
 * same underlying `getDatabase()`; this thin adapter lets the routes call the
 * shared helper without bypassing the `queryHelpers` seam (kept so the contract
 * tests can mock a single module). `queryHelpers.queryOne` returns `T | null`,
 * exactly the promise overload `IDatabase.get` provides.
 */
const ideaMapAccessDb = {
  get: <T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> =>
    queryHelpers.queryOne<T>(sql, params),
} as unknown as import('../database/IDatabase.js').IDatabase;

/**
 * True when shared/canonical idea maps are BOTH enabled by flag AND physically
 * available in this environment (the `is_canonical` column exists). When either
 * is false the routes fall back to the exact per-user behavior shipped today.
 * The column guard mirrors `selectCanonicalMapRow`, so an env with the flag on
 * but schema not yet migrated degrades safely to the legacy path.
 */
function sharedIdeaMapsActive(mapCols: { has(col: string): boolean }): boolean {
  return featureFlags.ENABLE_SHARED_IDEA_MAPS === true && mapCols.has('is_canonical');
}

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

function parseOptionalVersion(value: unknown): number | null | 'invalid' {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'invalid';
  return parsed;
}

/**
 * A1 (D-WB-2): shared canonical board write for idea maps (multiplayer persistence).
 *
 * The canonical idea-map document is the ROW OWNED BY THE IDEA'S OWNER. Any member of
 * the same organization write-throughs to that owner's row (mirrors the GET read-fallback
 * at "M09 L-01"). This keeps optimistic locking (version + baseVersion 409) meaningful:
 * two different users writing the same idea contend on ONE row, not two per-user rows.
 *
 * Returns the owner user_id (org-scoped). Returns null when the idea does not exist in the
 * org — callers must respond 404, exactly as the previous ownership-gated SELECT did.
 *
 * Note: node-pg returns text/uuid columns as strings, so ownerUserId is always a string.
 * We intentionally do NOT delete any historical per-requester ("orphan") rows; the owner's
 * row is authoritative and orphans are simply ignored (consistent with the read-fallback).
 */
async function resolveCanonicalMapOwner(ideaId: string, orgId: string): Promise<string | null> {
  const idea = await queryHelpers.queryOne<{ ownerUserId?: string | null }>(
    `SELECT user_id as "ownerUserId" FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
    [ideaId, orgId]
  );
  if (!idea) return null;
  const ownerUserId = idea.ownerUserId != null ? String(idea.ownerUserId) : '';
  return ownerUserId || null;
}

/**
 * A1/DP-3 read-side unification (finding: metrics/export-csv/artifacts read
 * strategy diverged from `GET /my-ideas/:id/map`).
 *
 * `GET /map` picks the row it serves via TWO different strategies depending on
 * environment:
 *   - shared mode (ENABLE_SHARED_IDEA_MAPS + `is_canonical` column present):
 *     the row flagged `is_canonical = TRUE` — the single board every org member
 *     reads/writes, independent of who currently "owns" the idea.
 *   - legacy/fallback mode (flag off, or column not migrated yet): the idea
 *     OWNER's row (`resolveCanonicalMapOwner`) — same as the A1 write-through.
 *
 * `metrics/map`, `export-csv` and `objects/:objectId/artifacts` GET handlers
 * used ONLY the second (owner) strategy, unconditionally — so once migration T2
 * lets `is_canonical` point at a row different from the owner's, those three
 * endpoints would read a stale/different row than the main map view. This
 * helper is the single place that picks the strategy so all read call sites
 * agree with `GET /map`.
 *
 * Returns the resolved row's identifying key so callers can plug it into their
 * existing single-idea SELECT ... WHERE clause:
 *   - `{ mode: 'canonical' }` → filter by `idea_id = ? AND organization_id = ? AND is_canonical = TRUE`
 *   - `{ mode: 'owner', userId }` → filter by `idea_id = ? AND user_id = ? AND organization_id = ?`
 *   - `null` → no idea found in this org (caller should 404), OR shared mode is
 *     active but no canonical row exists yet for this idea (migration T2 not
 *     run) — caller should treat this the same as "not found" rather than
 *     silently falling back to a different row.
 */
type MapReadStrategy = { mode: 'canonical' } | { mode: 'owner'; userId: string };

async function resolveMapReadRow(ideaId: string, orgId: string): Promise<MapReadStrategy | null> {
  const mapCols = await getTableColumns('my_idea_maps');

  if (sharedIdeaMapsActive(mapCols)) {
    // Mirrors `GET /map`'s shared-mode branch: existence is keyed off the
    // canonical row itself, not the idea's current owner.
    const canonical = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
      [ideaId, orgId]
    );
    if (!canonical) return null;
    return { mode: 'canonical' };
  }

  const ownerUserId = await resolveCanonicalMapOwner(ideaId, orgId);
  if (!ownerUserId) return null;
  return { mode: 'owner', userId: ownerUserId };
}

type IdeaMapMetric = { nodes: number; edges: number; items: number; updatedAt: string | null };

function countMetricArrays(nodesJson: unknown, edgesJson: unknown): IdeaMapMetric {
  let n = 0;
  let e = 0;
  try {
    const arr = JSON.parse(String(nodesJson ?? '[]'));
    n = Array.isArray(arr) ? arr.length : 0;
  } catch {
    n = 0;
  }
  try {
    const arr = JSON.parse(String(edgesJson ?? '[]'));
    e = Array.isArray(arr) ? arr.length : 0;
  } catch {
    e = 0;
  }
  return { nodes: n, edges: e, items: n + e, updatedAt: null };
}

/**
 * Bulk read for `metrics/map` (shared by the inline `ideaId === 'metrics'`
 * branch on `GET /my-ideas/:id/map` and the standalone `GET
 * /my-ideas/metrics/map` route), unified onto the SAME read strategy as
 * `GET /map` (see `resolveMapReadRow`):
 *   - shared mode (flag + `is_canonical` column present): one row per idea,
 *     selected by `is_canonical = TRUE` — the exact row every member's single-
 *     idea `GET /map` call resolves to.
 *   - legacy/fallback mode: the idea owner's row via the `my_ideas` join
 *     (unchanged from the prior owner-only behavior).
 * A given environment is uniformly in one mode or the other (mode depends only
 * on schema/flag, not on any one idea's data), so ids are never split across
 * both queries.
 */
async function queryIdeaMapMetrics(
  ideaIds: string[],
  orgId: string
): Promise<Record<string, IdeaMapMetric>> {
  const metrics: Record<string, IdeaMapMetric> = {};
  if (!ideaIds.length) return metrics;

  const mapCols = await getTableColumns('my_idea_maps');
  const placeholders = queryHelpers.buildInPlaceholders(ideaIds);

  const rows = sharedIdeaMapsActive(mapCols)
    ? (await queryHelpers.queryAll<any>(
        `
        SELECT
          m.idea_id as "ideaId",
          m.nodes_json as "nodesJson",
          m.edges_json as "edgesJson",
          m.updated_at as "updatedAt"
        FROM my_idea_maps m
        WHERE m.organization_id = ?
          AND m.is_canonical = TRUE
          AND m.idea_id IN (${placeholders})
      `,
        [orgId, ...ideaIds]
      )) || []
    : // A1 (D-WB-2) read-side parity: join through my_ideas so each idea's row is
      // read via its OWNER's user_id (the canonical row PUT/sync now write to — see
      // resolveCanonicalMapOwner) instead of the caller's own user_id. A single-owner
      // caller is unaffected (own ideas: ownerUserId === userId); a non-owner org
      // member now sees the real shared counts instead of 0.
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          m.idea_id as "ideaId",
          m.nodes_json as "nodesJson",
          m.edges_json as "edgesJson",
          m.updated_at as "updatedAt"
        FROM my_idea_maps m
        JOIN my_ideas i ON i.id = m.idea_id AND i.user_id = m.user_id
        WHERE m.organization_id = ? AND i.organization_id = ?
          AND m.idea_id IN (${placeholders})
      `,
        [orgId, orgId, ...ideaIds]
      )) || [];

  const byId = new Map<string, any>();
  for (const row of rows) {
    const rowIdeaId = String(row?.ideaId || '').trim();
    if (rowIdeaId) byId.set(rowIdeaId, row);
  }

  for (const id of ideaIds) {
    const row = byId.get(id);
    const metric = countMetricArrays(row?.nodesJson, row?.edgesJson);
    metric.updatedAt = row?.updatedAt || null;
    metrics[id] = metric;
  }

  return metrics;
}

/**
 * B1 (M09 facilitation enforcement) — is the CALLING user gated to read-only because
 * they hold the 'observer' role in an ACTIVE facilitation session for this whiteboard?
 *
 * The whiteboard's facilitation session is keyed on tool_session_id = `whiteboard:<ideaId>`
 * (see IdeaWhiteboardTool.tsx `toolSessionId`). Role rows live in tool_facilitation_roles,
 * scoped to the session and org. We only enforce the 'observer' role — facilitator /
 * participant / no-role / no-active-session are ALL unchanged (returns false), so single-
 * player editing and the A1 canonical-owner write path are untouched.
 *
 * Fail-open by design: any DB error (e.g. facilitation tables absent on an older schema)
 * must NOT block a legitimate write — we log-and-allow rather than 500 the editor.
 * Uses a single queryAll so the mocked call-sequences in existing PUT/sync contract
 * tests (which return [] for queryAll) keep their behavior unchanged.
 */
async function isWhiteboardObserver(
  ideaId: string,
  orgId: string,
  userId: string
): Promise<boolean> {
  const toolSessionId = `whiteboard:${ideaId}`;
  try {
    const rows = await queryHelpers.queryAll<{ role_name?: string | null }>(
      `SELECT r.role_name AS role_name
         FROM tool_facilitation_roles r
         JOIN tool_facilitation_sessions s ON s.id = r.facilitation_session_id
        WHERE s.organization_id = ?
          AND s.tool_session_id = ?
          AND s.status <> 'ended'
          AND r.user_id = ?
        LIMIT 1`,
      [orgId, toolSessionId, userId]
    );
    const roleName = rows?.[0]?.role_name;
    return String(roleName || '').toLowerCase() === 'observer';
  } catch (err) {
    // Older orgs / schemas without the facilitation tables must not be blocked.
    logger.warn('[my-work] isWhiteboardObserver check failed (allowing write):', err as Error);
    return false;
  }
}

const WHITEBOARD_OBSERVER_READONLY = {
  status: 403,
  body: {
    error:
      'You are an observer in this facilitation session and cannot edit the shared whiteboard.',
    code: 'WHITEBOARD_OBSERVER_READONLY',
  },
} as const;

function buildMapConflictPayload(
  existing:
    | {
        version?: number | string | null;
        nodesJson?: unknown;
        edgesJson?: unknown;
        extensionsJson?: unknown;
        preferredTool?: unknown;
        schemaVersion?: unknown;
      }
    | null
    | undefined,
  fallback: { id: string; title: string; isPl: boolean }
) {
  const currentVersion = existing ? Number(existing.version || 1) : 1;
  const currentGraph = existing
    ? ensureLatestSchema({
        nodes: parseIdeaMapArray(existing.nodesJson),
        edges: parseIdeaMapArray(existing.edgesJson),
        extensions: parseIdeaMapObject(existing.extensionsJson),
        preferredTool: existing?.preferredTool ? String(existing.preferredTool) : null,
        schemaVersion: Number(existing?.schemaVersion || 1),
      } as any)
    : buildDefaultIdeaMap({ id: fallback.id, title: fallback.title }, fallback.isPl);

  return {
    error: 'Idea map conflict',
    code: 'IDEA_MAP_CONFLICT',
    currentVersion,
    map: {
      ...currentGraph,
      version: currentVersion,
    },
  };
}

function isSuspiciousEmptyReset(params: {
  preferredTool?: string | null;
  existingPreferredTool?: string | null;
  normalizedNodes: any[];
  mergedExtensions: Record<string, unknown> | null | undefined;
  existingNodes: any[];
  existingExtensions: Record<string, unknown> | null | undefined;
}): boolean {
  const preferredTool = String(params.preferredTool || '').toLowerCase();
  const existingPreferredTool = String(params.existingPreferredTool || '').toLowerCase();
  const nextHasNodes = Array.isArray(params.normalizedNodes) && params.normalizedNodes.length > 0;
  const existingHasNodes = Array.isArray(params.existingNodes) && params.existingNodes.length > 0;

  // CROSS-TOOL guard: the Ideas tools (mindmap / whiteboard / process_flow / table) share ONE
  // my_idea_maps document. When a user opens, say, the whiteboard, the OTHER tool runtimes can
  // still be mounted and autosave their (empty) graph — silently blanking the board the user
  // actually has content on. So: a save from a DIFFERENT tool than the one that owns the
  // populated board, carrying NO nodes, must not overwrite it. A SAME-tool empty save is a
  // legitimate "delete all" and is allowed through.
  if (
    !nextHasNodes &&
    existingHasNodes &&
    preferredTool &&
    existingPreferredTool &&
    preferredTool !== existingPreferredTool
  ) {
    return true;
  }

  // TABLE guard (original): never let the table tool blank a populated board, even within the
  // same tool (table content also lives in extensions, so check both nodes + extensions).
  if (preferredTool.includes('table')) {
    const nextHasContent = nextHasNodes || Object.keys(params.mergedExtensions || {}).length > 0;
    if (nextHasContent) return false;
    const existingHasContent =
      existingHasNodes || Object.keys(params.existingExtensions || {}).length > 0;
    return existingHasContent;
  }

  return false;
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

      const metrics = await queryIdeaMapMetrics(ids, orgId);
      return res.json({ metrics });
    }
    if (!ideaId || ideaId === 'all') return res.status(400).json({ error: 'Invalid idea id' });

    const language = String(req.query.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    // M09 L-01 (DP-3 multiplayer): idea existence is ORG-scoped for READ so a 2nd
    // org member opening a colleague's board gets 200 (not 404). Org-scoped SELECT
    // (id, title, ownerUserId) doubles as the resolveCanonicalMapOwner lookup here —
    // we keep the extra "title" column for the default-map fallback below.
    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title, user_id as "ownerUserId" FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, orgId]
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

    // RV-008: membership must still gate shared-mode reads before touching
    // the row at all (a non-member gets the same 404 the legacy path returns
    // for an unknown idea).
    if (sharedIdeaMapsActive(mapCols)) {
      const membership = await assertIdeaMembership(ideaMapAccessDb, orgId, userId, ideaId);
      if (!membership.canRead) return res.status(404).json({ error: 'Idea not found' });
    }

    // RV-008: resolved through the SAME tenant/user-scoped resolver the
    // Ideas list uses for its "Tool" badge (`selectReadableMapRow` in
    // ideaMapAccess.ts) — so list and Open can never disagree about which
    // row (or "no row yet") is truthful for this idea. A1 (D-WB-2): the
    // legacy/flag-OFF branch reads the idea OWNER's row — the same row
    // PUT/sync writes to — never a non-owner's stale copy.
    const row = await selectReadableMapRow<any>(
      ideaMapAccessDb,
      ideaId,
      idea.ownerUserId ? String(idea.ownerUserId) : null,
      orgId,
      `id, nodes_json as "nodesJson", edges_json as "edgesJson", version, updated_at as "updatedAt"${preferredToolSelect}${extensionsSelect}${schemaVersionSelect}`
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
 * POST /api/my-work/my-ideas/:ideaId/map/export/pptx
 *
 * M06 FALA3 3.4 — real .pptx export for the mind map, reusing the same
 * BCG-grade `PptxPipelineService` the Report Builder uses (see
 * report-builder.routes.ts `GET /:id/export/pptx` for the reference
 * buffer → Content-Disposition → pptx MIME pattern). Replaces the legacy
 * client-side HTML blob in `ExportPowerPoint.tsx` when the FE flag
 * `mindmapPptxNative` is ON.
 *
 * Body:
 *   - ideaTitle: string (required)
 *   - branches: Array<{ branchKey, label, nodes: Array<{ id, label, status? }> }>
 *   - language?: 'en' | 'pl'
 *   - template?: 'corporate' | 'minimal' | 'modern'
 */
router.post(
  '/my-ideas/:ideaId/map/export/pptx',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const ideaId = String(req.params.ideaId || '').trim();
    if (!ideaId || ideaId === 'all') return res.status(400).json({ error: 'Invalid idea id' });

    if (!(await requireTables(res, ['my_ideas']))) return;

    // E12 (10.4): a restricted Idea's content must never leave as an export file.
    const exportConfidentiality = await getIdeaConfidentiality(ideaId, orgId);
    if (exportConfidentiality === 'restricted') {
      return res.status(403).json({
        error: 'This Idea is marked restricted and cannot be exported.',
        code: 'IDEA_CONFIDENTIALITY_BLOCKED',
      });
    }

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const body = (req.body || {}) as {
      ideaTitle?: unknown;
      branches?: unknown;
      language?: unknown;
      template?: unknown;
    };

    const ideaTitle = String(body.ideaTitle || idea.title || 'Mind Map').trim();
    const rawBranches = Array.isArray(body.branches) ? body.branches : [];
    const branches = rawBranches
      .filter((b: any) => b && typeof b === 'object')
      .map((b: any) => ({
        branchKey: String(b.branchKey || '').trim(),
        label: String(b.label || b.branchKey || '').trim(),
        nodes: Array.isArray(b.nodes)
          ? b.nodes
              .filter((n: any) => n && typeof n === 'object')
              .map((n: any) => ({
                id: String(n.id || ''),
                label: String(n.label || ''),
                status: n.status ? String(n.status) : undefined,
              }))
          : [],
      }));

    const language = body.language === 'en' ? 'en' : 'pl';
    const template =
      body.template === 'minimal' || body.template === 'modern' ? body.template : 'corporate';

    try {
      const { mapMindMapToUnifiedReport } =
        await import('../services/mindmap/mindMapToUnifiedReport.js');
      const { PptxPipelineService } =
        await import('../services/report/pptx/PptxPipelineService.js');

      const report = mapMindMapToUnifiedReport(ideaTitle, branches, {
        language,
        template,
        // E12 (10.4): propagate the Idea's real classification instead of the
        // previous hardcoded 'internal' — 'confidential' ideas now actually
        // reach PptxPipelineService's confidentiality handling (watermark /
        // access banner) instead of silently exporting as unclassified.
        confidentiality: exportConfidentiality === 'confidential' ? 'confidential' : 'internal',
      });

      const pipeline = new PptxPipelineService();
      const result = await pipeline.generateFromUnifiedJson(report, {
        template,
        language,
      });

      logger.info('[MyWork] Mind map PPTX exported', {
        ideaId,
        userId,
        slideCount: result.slideCount,
        warnings: result.warnings.length,
      });

      const safeFileName = ideaTitle.replace(/[<>:"/\\|?*]/g, '').trim() || 'mindmap';

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.pptx"`);
      return res.send(result.buffer);
    } catch (err: any) {
      logger.error('[MyWork] Error exporting mind map PPTX:', err);
      return res
        .status(500)
        .json({ error: 'Failed to export mind map PPTX', code: 'MINDMAP_EXPORT_PPTX_FAILED' });
    }
  })
);

/**
 * GET /api/my-work/my-ideas/metrics/map?ids=comma,separated,ideaIds
 * Returns nodes/edges/items counts for many ideas (for list/table rendering).
 *
 * Notes:
 * - Keeps list fast by avoiding N calls to /:id/map
 * - JSON is parsed in JS for cross-DB compatibility.
 * - NOTE: this route is currently shadowed by the `ideaId === 'metrics'` special case
 *   in `/my-ideas/:id/map` above (Express matches that route first), but is kept in
 *   sync with the same canonical-owner read for when/if that special-casing is removed.
 */
router.get(
  '/my-ideas/metrics/map',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
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

    const metrics = await queryIdeaMapMetrics(ids, orgId);
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

    const mapCols = await getTableColumns('my_idea_maps');
    const sharedMode = sharedIdeaMapsActive(mapCols);

    // P13 Hard cap: reject if nodes > 500 (hard safety limit for whiteboard storage)
    if (normalizedNodes.length > 500) {
      return res.status(422).json({
        error: 'Object limit exceeded',
        code: 'WHITEBOARD_OBJECT_LIMIT_EXCEEDED',
        details: `Whiteboard cannot exceed 500 objects; requested: ${normalizedNodes.length}`,
        limit: 500,
        current: normalizedNodes.length,
      });
    }

    // DP-3 (T4): shared mode gates WRITE by ACTIVE org membership (any member may
    // edit the shared board). Legacy (flag-OFF) mode adopts A1 (D-WB-2): write-through
    // to the canonical (idea-owner's) row so org members' edits persist even when the
    // owner is offline. Org-scoped existence check → 404 if absent.
    let canonicalUserId: string | null = null;
    if (sharedMode) {
      const membership = await assertIdeaMembership(ideaMapAccessDb, orgId, userId, ideaId);
      if (!membership.canWrite) return res.status(404).json({ error: 'Idea not found' });
    } else {
      canonicalUserId = await resolveCanonicalMapOwner(ideaId, orgId);
      if (!canonicalUserId) return res.status(404).json({ error: 'Idea not found' });
    }

    // B1 (M09): observers in an active facilitation session are read-only on the shared board.
    if (await isWhiteboardObserver(ideaId, orgId, userId)) {
      return res
        .status(WHITEBOARD_OBSERVER_READONLY.status)
        .json(WHITEBOARD_OBSERVER_READONLY.body);
    }

    const baseVersionRaw = req.body?.baseVersion ?? req.body?.version ?? null;
    const baseVersionParsed = parseOptionalVersion(baseVersionRaw);
    if (baseVersionParsed === 'invalid') {
      return res.status(400).json({
        error: 'Invalid baseVersion',
        details: 'baseVersion must be a number when provided',
      });
    }
    const baseVersion = baseVersionParsed;

    const extColSelect = mapCols.has('extensions_json') ? ', extensions_json' : '';
    const preferredToolSelect = mapCols.has('preferred_tool') ? ', preferred_tool' : '';
    const schemaVersionSelect = mapCols.has('schema_version') ? ', schema_version' : '';
    // DP-3 (T4): shared mode selects the single canonical row (by is_canonical);
    // legacy (flag-OFF) mode selects the A1 canonical-owner row (canonicalUserId).
    // Both keep the same SELECT columns so all downstream OCC / empty-reset logic
    // is unchanged.
    const existing = sharedMode
      ? await queryHelpers.queryOne<any>(
          `SELECT id, version, nodes_json, edges_json${extColSelect}${preferredToolSelect}${schemaVersionSelect} FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
          [ideaId, orgId]
        )
      : await queryHelpers.queryOne<any>(
          `SELECT id, version, nodes_json, edges_json${extColSelect}${preferredToolSelect}${schemaVersionSelect} FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
          [ideaId, canonicalUserId, orgId]
        );

    const currentVersion = existing ? Number(existing.version || 1) : 1;
    if (existing && baseVersion === null) {
      return res.status(400).json({
        error: 'baseVersion is required for map updates',
        code: 'IDEA_MAP_BASE_VERSION_REQUIRED',
        currentVersion,
      });
    }
    if (
      baseVersion !== null &&
      ((existing && baseVersion !== currentVersion) || (!existing && baseVersion > 1))
    ) {
      return res.status(409).json(
        buildMapConflictPayload(
          {
            version: currentVersion,
            nodesJson: existing?.nodes_json,
            edgesJson: existing?.edges_json,
            extensionsJson: existing?.extensions_json,
            preferredTool: existing?.preferred_tool,
            schemaVersion: existing?.schema_version ?? 1,
          },
          {
            id: ideaId,
            // DP-3 (T4) + A1: neither shared (membership) nor legacy (canonical-owner
            // resolve) path selects a title into scope here — matches prior behavior
            // where title was always ''.
            title: '',
            isPl: false,
          }
        )
      );
    }

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
      isSuspiciousEmptyReset({
        preferredTool,
        existingPreferredTool: existing?.preferred_tool ? String(existing.preferred_tool) : null,
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
      // Shared (flag-ON) mode has no canonicalUserId; the creating member owns the
      // canonical row. Legacy (A1) mode writes to the resolved canonical-owner row.
      add('user_id', sharedMode ? userId : canonicalUserId);
      add('organization_id', orgId);
      add('nodes_json', JSON.stringify(normalizedNodes));
      add('edges_json', JSON.stringify(normalizedEdges));
      add('version', nextVersion);
      add('schema_version', 3);
      if (preferredTool) add('preferred_tool', preferredTool);
      if (mergedExtensions) add('extensions_json', JSON.stringify(mergedExtensions));
      // DP-3 (T4): a brand-new map in shared mode is the canonical row from birth
      // and records its creator as the last editor.
      if (sharedMode) {
        add('is_canonical', true);
        add('last_editor_user_id', userId);
      }
      add('created_at', now);
      add('updated_at', now);
      try {
        await queryHelpers.queryRun(
          `INSERT INTO my_idea_maps (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );
      } catch (insertErr: any) {
        // DP-3 (T4): partial unique uq_idea_maps_canonical (idea_id WHERE
        // is_canonical=TRUE) means a concurrent request may have inserted the
        // canonical row first. Recover by re-selecting it and returning a 409 so
        // the client rehydrates — same OCC contract as a version mismatch.
        if (sharedMode) {
          const raced = await queryHelpers.queryOne<any>(
            `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson"${
              mapCols.has('preferred_tool') ? ', preferred_tool as "preferredTool"' : ''
            }${mapCols.has('extensions_json') ? ', extensions_json as "extensionsJson"' : ''}${
              mapCols.has('schema_version') ? ', schema_version as "schemaVersion"' : ''
            } FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
            [ideaId, orgId]
          );
          if (raced) {
            return res
              .status(409)
              .json(buildMapConflictPayload(raced, { id: ideaId, title: '', isPl: false }));
          }
        }
        throw insertErr;
      }
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
      // DP-3 (T4): stamp the current editor on every shared-mode write.
      if (sharedMode) set('last_editor_user_id', userId);
      set('updated_at', now);
      // DP-3 (T4): target the canonical row by is_canonical (shared) or by
      // A1 canonical-owner user_id (legacy). OCC `version` guard is preserved in both modes.
      const whereSql = sharedMode
        ? 'idea_id = ? AND organization_id = ? AND is_canonical = TRUE'
        : 'idea_id = ? AND user_id = ? AND organization_id = ?';
      if (sharedMode) {
        params.push(ideaId, orgId);
      } else {
        params.push(ideaId, canonicalUserId, orgId);
      }
      if (baseVersion !== null) {
        params.push(baseVersion);
      }
      const updateResult = await queryHelpers.queryRun(
        `UPDATE my_idea_maps
         SET ${setParts.join(', ')}
         WHERE ${whereSql}${baseVersion !== null ? ' AND version = ?' : ''}`,
        params
      );
      if (baseVersion !== null && Number(updateResult?.changes || 0) === 0) {
        const latestSelectCols = `id, version, nodes_json as "nodesJson", edges_json as "edgesJson"${
          mapCols.has('preferred_tool') ? ', preferred_tool as "preferredTool"' : ''
        }${mapCols.has('extensions_json') ? ', extensions_json as "extensionsJson"' : ''}${
          mapCols.has('schema_version') ? ', schema_version as "schemaVersion"' : ''
        }`;
        const latest = sharedMode
          ? await queryHelpers.queryOne<any>(
              `SELECT ${latestSelectCols} FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
              [ideaId, orgId]
            )
          : await queryHelpers.queryOne<any>(
              `SELECT ${latestSelectCols} FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
              [ideaId, canonicalUserId, orgId]
            );
        return res.status(409).json(
          buildMapConflictPayload(latest, {
            id: ideaId,
            title: '',
            isPl: false,
          })
        );
      }
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
    const baseVersionParsed = parseOptionalVersion(baseVersionRaw);
    if (baseVersionParsed === 'invalid') {
      return res.status(400).json({
        error: 'Invalid baseVersion',
        details: 'baseVersion must be a number when provided',
      });
    }
    const baseVersion = baseVersionParsed;

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

    // P13 Hard cap: reject if nodes > 500 (hard safety limit for whiteboard storage)
    if (validation.normalized.nodes.length > 500) {
      return res.status(422).json({
        error: 'Object limit exceeded',
        code: 'WHITEBOARD_OBJECT_LIMIT_EXCEEDED',
        details: `Whiteboard cannot exceed 500 objects; requested: ${validation.normalized.nodes.length}`,
        limit: 500,
        current: validation.normalized.nodes.length,
      });
    }

    const mapCols = await getTableColumns('my_idea_maps');
    const sharedMode = sharedIdeaMapsActive(mapCols);

    // DP-3 (T4): membership gate (shared). Legacy (flag-OFF) mode adopts A1 (D-WB-2):
    // canonical (owner) row write-through — see resolveCanonicalMapOwner. Same 404 shape.
    let canonicalUserId: string | null = null;
    if (sharedMode) {
      const membership = await assertIdeaMembership(ideaMapAccessDb, orgId, userId, ideaId);
      if (!membership.canWrite) return res.status(404).json({ error: 'Idea not found' });
    } else {
      canonicalUserId = await resolveCanonicalMapOwner(ideaId, orgId);
      if (!canonicalUserId) return res.status(404).json({ error: 'Idea not found' });
    }

    // B1 (M09): observers in an active facilitation session are read-only on the shared board.
    if (await isWhiteboardObserver(ideaId, orgId, userId)) {
      return res
        .status(WHITEBOARD_OBSERVER_READONLY.status)
        .json(WHITEBOARD_OBSERVER_READONLY.body);
    }

    const preferredToolSelect = mapCols.has('preferred_tool')
      ? `, preferred_tool as "preferredTool"`
      : `, NULL as "preferredTool"`;
    const extColSelect = mapCols.has('extensions_json')
      ? `, extensions_json as "extensionsJson"`
      : `, '{}' as "extensionsJson"`;
    const schemaVersionSelect = mapCols.has('schema_version')
      ? `, schema_version as "schemaVersion"`
      : `, 1 as "schemaVersion"`;
    // DP-3 (T4): canonical (shared) vs per-user (legacy) row selection.
    const existing = sharedMode
      ? await queryHelpers.queryOne<any>(
          `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson"${preferredToolSelect}${extColSelect}${schemaVersionSelect}
       FROM my_idea_maps
       WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE
       LIMIT 1`,
          [ideaId, orgId]
        )
      : await queryHelpers.queryOne<any>(
          `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson"${preferredToolSelect}${extColSelect}${schemaVersionSelect}
       FROM my_idea_maps
       WHERE idea_id = ? AND user_id = ? AND organization_id = ?
       LIMIT 1`,
          [ideaId, canonicalUserId, orgId]
        );

    const currentVersion = existing ? Number(existing.version || 1) : 1;
    if (existing && baseVersion === null) {
      return res.status(400).json({
        error: 'baseVersion is required for sync updates',
        code: 'IDEA_MAP_BASE_VERSION_REQUIRED',
        currentVersion,
      });
    }
    const hasVersionConflict =
      baseVersion !== null &&
      ((existing && baseVersion !== currentVersion) || (!existing && baseVersion > 1));
    if (hasVersionConflict) {
      return res.status(409).json(
        buildMapConflictPayload(existing, {
          id: ideaId,
          title: '',
          isPl: false,
        })
      );
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
      isSuspiciousEmptyReset({
        preferredTool,
        existingPreferredTool: existing?.preferredTool ? String(existing.preferredTool) : null,
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
      // Shared (flag-ON) mode has no canonicalUserId; the creating member owns the
      // canonical row. Legacy (A1) mode writes to the resolved canonical-owner row.
      add('user_id', sharedMode ? userId : canonicalUserId);
      add('organization_id', orgId);
      add('nodes_json', JSON.stringify(normalizedNodes));
      add('edges_json', JSON.stringify(normalizedEdges));
      add('version', nextVersion);
      add('schema_version', 3);
      if (preferredTool) add('preferred_tool', preferredTool);
      if (mergedExtensions) add('extensions_json', JSON.stringify(mergedExtensions));
      // DP-3 (T4): new shared map is canonical from birth + records its creator.
      if (sharedMode) {
        add('is_canonical', true);
        add('last_editor_user_id', userId);
      }
      add('created_at', now);
      add('updated_at', now);
      try {
        await queryHelpers.queryRun(
          `INSERT INTO my_idea_maps (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );
      } catch (insertErr: any) {
        // DP-3 (T4): partial-unique race on uq_idea_maps_canonical — another
        // request created the canonical row first. Surface a 409 so the client
        // rehydrates (same OCC contract as a stale baseVersion).
        if (sharedMode) {
          const raced = await queryHelpers.queryOne<any>(
            `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson"${preferredToolSelect}${extColSelect}${schemaVersionSelect}
             FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
            [ideaId, orgId]
          );
          if (raced) {
            return res
              .status(409)
              .json(buildMapConflictPayload(raced, { id: ideaId, title: '', isPl: false }));
          }
        }
        throw insertErr;
      }
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
      // DP-3 (T4): stamp editor on every shared-mode write.
      if (sharedMode) set('last_editor_user_id', userId);
      set('updated_at', now);
      // Z18 (Fala 4): the pre-check above (hasVersionConflict) is read-then-act —
      // two concurrent /map/sync requests can both read the same currentVersion,
      // both pass the pre-check, and both reach this UPDATE. Without a version
      // guard IN the WHERE clause, the second write silently clobbers the first
      // (classic read-modify-write data loss under concurrent collaboration).
      // Mirrors the already-fixed PUT /my-ideas/:id/map handler above (see its
      // "mid-air UPDATE race" contract test): the WHERE re-checks
      // `version = baseVersion` atomically in the SAME statement as the write
      // (single round-trip — no BEGIN/COMMIT; pool.query cannot span a
      // transaction across statements, see RecordsService.batchRecords bug,
      // 2026-07-22). rowCount 0 means we lost the race — someone else's write
      // landed between our SELECT and this UPDATE — so we refetch and return the
      // SAME 409 shape as the pre-check (buildMapConflictPayload) instead of
      // silently overwriting. baseVersion is non-null here whenever `existing`
      // is set (enforced by the IDEA_MAP_BASE_VERSION_REQUIRED 400 above), so the
      // guard is always active on updates; kept conditional for parity with the
      // PUT /map handler's style.
      const whereSql = sharedMode
        ? 'idea_id = ? AND organization_id = ? AND is_canonical = TRUE'
        : 'idea_id = ? AND user_id = ? AND organization_id = ?';
      if (sharedMode) {
        params.push(ideaId, orgId);
      } else {
        params.push(ideaId, canonicalUserId, orgId);
      }
      if (baseVersion !== null) {
        params.push(baseVersion);
      }
      const updateResult = await queryHelpers.queryRun(
        `UPDATE my_idea_maps
         SET ${setParts.join(', ')}
         WHERE ${whereSql}${baseVersion !== null ? ' AND version = ?' : ''}`,
        params
      );
      if (baseVersion !== null && Number(updateResult?.changes || 0) === 0) {
        logger.warn(
          `[IdeaMap] map/sync lost optimistic-lock race (ideaId=${ideaId}, expectedVersion=${baseVersion}) — refetching current row for 409`
        );
        const fresh = sharedMode
          ? await queryHelpers.queryOne<any>(
              `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson"${preferredToolSelect}${extColSelect}${schemaVersionSelect}
             FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
              [ideaId, orgId]
            )
          : await queryHelpers.queryOne<any>(
              `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson"${preferredToolSelect}${extColSelect}${schemaVersionSelect}
             FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
              [ideaId, canonicalUserId, orgId]
            );
        return res
          .status(409)
          .json(buildMapConflictPayload(fresh, { id: ideaId, title: '', isPl: false }));
      }
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

    // E12 (10.4): a restricted Idea's content must never reach an LLM prompt.
    if (await isIdeaRestricted(ideaId, orgId)) {
      return res
        .status(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.status)
        .json(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.body);
    }

    const countRaw = Number(req.body?.count);
    const count =
      Number.isFinite(countRaw) && countRaw > 0 ? Math.min(10, Math.max(1, countRaw)) : 5;
    const branchKey = String(req.body?.branchKey || 'options').trim() || 'options';
    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    const expandMapCols = await getTableColumns('my_idea_maps');
    const expandSharedMode = sharedIdeaMapsActive(expandMapCols);

    // DP-3 (T4): shared mode reads the idea ORG-scoped behind a membership gate
    // (any ACTIVE member may expand the shared board); legacy mode keeps the
    // owner-only read. This endpoint is read-only — it returns nodes/edges for
    // the client to append; no persistence happens here.
    const idea = expandSharedMode
      ? await queryHelpers.queryOne<any>(
          `SELECT id, title, body, seed_text as "seedText", ai_expansion as "aiExpansion" FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
          [ideaId, orgId]
        )
      : await queryHelpers.queryOne<any>(
          `SELECT id, title, body, seed_text as "seedText", ai_expansion as "aiExpansion" FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
          [ideaId, userId, orgId]
        );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    if (expandSharedMode) {
      const membership = await assertIdeaMembership(ideaMapAccessDb, orgId, userId, ideaId);
      if (!membership.canRead) return res.status(404).json({ error: 'Idea not found' });
    }

    // Load current map (or default skeleton)
    const mapRow = expandSharedMode
      ? await queryHelpers.queryOne<any>(
          `SELECT nodes_json as "nodesJson", edges_json as "edgesJson" FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
          [ideaId, orgId]
        )
      : await queryHelpers.queryOne<any>(
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

    // Język odpowiedzi z TREŚCI mapy (isPl wyżej steruje SZKIELETEM domyślnej mapy —
    // to osobna decyzja, zostaje na fladze UI; tu chodzi tylko o język od modelu).
    const { resolveResponseLanguage, languageInstruction } =
      await import('../services/ai/responseLanguage.js');
    const respLang = resolveResponseLanguage({
      requested: language,
      // `expansion` (ai_expansion) pomijamy — to WYNIK AI, więc mógł już powstać w złym
      // języku; próbkujemy tylko materiał wpisany przez użytkownika.
      samples: [idea?.title, seed, ...existingLabels.slice(0, 40)],
    });
    const isPlResponse = respLang === 'pl';

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

      const prompt = isPlResponse
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
        systemPrompt: `${
          isPlResponse
            ? 'Jesteś konsultantem biznesowym. Odpowiadasz wyłącznie poprawnym JSON.'
            : 'You are a business consultant. You respond only with valid JSON.'
        }\n\n${languageInstruction(respLang)}`,
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

    // E12 (10.4): a restricted Idea's content must never reach an LLM prompt.
    if (await isIdeaRestricted(ideaId, orgId)) {
      return res
        .status(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.status)
        .json(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.body);
    }

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title, seed_text as "seedText" FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const seedText = String(req.body?.seedText || idea?.seedText || '').trim();
    const mapNodes = Array.isArray(req.body?.mapNodes) ? req.body.mapNodes : [];
    const language = String(req.body?.language || 'en').toLowerCase();

    const existingLabels = mapNodes
      .map((n: any) => String(n?.data?.label || '').trim())
      .filter(Boolean)
      .slice(0, 100);

    // Język odpowiedzi z TREŚCI mapy (nakładki AIAutoClustering / AIDependencyDetector /
    // AIPriorityRecommender / AISentimentOverlay / AIWhatIfScenarios / AICompetitiveLandscape
    // wysyłają tu `i18n.language`, który przy polskiej mapie bywa `en`).
    const { resolveResponseLanguage, languageInstruction } =
      await import('../services/ai/responseLanguage.js');
    const respLang = resolveResponseLanguage({
      requested: language,
      // Bez `req.body.seedText`: nakładki (AIAutoClustering, AIWhatIfScenarios, …) wpisują
      // tam angielskie polecenie („Group these ideas into…"), a nie treść użytkownika.
      samples: [idea?.title, idea?.seedText, ...existingLabels],
    });
    const isPl = respLang === 'pl';

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
        systemPrompt: `${
          isPl
            ? 'Jesteś konsultantem biznesowym. Odpowiadasz wyłącznie poprawnym JSON.'
            : 'You are a business consultant. You respond only with valid JSON.'
        }\n\n${languageInstruction(respLang)}`,
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

    // E12 (10.4): a restricted Idea's content must never reach an LLM prompt.
    if (await isIdeaRestricted(ideaId, orgId)) {
      return res
        .status(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.status)
        .json(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.body);
    }

    const idea = await queryHelpers.queryOne<any>(
      `SELECT id, title, seed_text as "seedText" FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const seedText = String(req.body?.seedText || idea?.seedText || '').trim();
    const mapNodes = Array.isArray(req.body?.mapNodes) ? req.body.mapNodes : [];
    const branchKeys = Array.isArray(req.body?.branchKeys) ? req.body.branchKeys : [];
    const language = String(req.body?.language || 'en').toLowerCase();

    const existingLabels = mapNodes
      .map((n: any) => String(n?.data?.label || '').trim())
      .filter(Boolean)
      .slice(0, 100);

    // Język odpowiedzi: TREŚĆ MAPY wygrywa z flagą UI (mapa po polsku + i18n=en
    // dawała angielskie „AI Blind Spots" nad polską mapą). Patrz responseLanguage.ts.
    // Próbkujemy WYŁĄCZNIE materiał użytkownika (tytuł/seed z bazy + etykiety węzłów).
    // `req.body.seedText` celowo pomijamy — nakładki AI potrafią wstawić tam angielski
    // szablon polecenia, który przechyliłby detekcję na EN przy polskiej mapie.
    const { resolveResponseLanguage, languageInstruction } =
      await import('../services/ai/responseLanguage.js');
    const respLang = resolveResponseLanguage({
      requested: language,
      samples: [idea?.title, idea?.seedText, ...existingLabels],
    });
    const isPl = respLang === 'pl';

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
        systemPrompt: `${
          isPl
            ? 'Jesteś konsultantem biznesowym. Odpowiadasz wyłącznie poprawnym JSON.'
            : 'You are a business consultant. You respond only with valid JSON.'
        }\n\n${languageInstruction(respLang)}`,
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
        // Tool-specific state captured at snapshot time (may be absent on
        // snapshots taken before extension-capture landed → restore falls back
        // to preserving the live extensions).
        extensions:
          data.extensions && typeof data.extensions === 'object' ? data.extensions : undefined,
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

    // E12 (10.4): every other map write endpoint in this file verifies the
    // idea belongs to the caller's org before writing — this one didn't, so
    // a client could silently attach a snapshot row to any ideaId string
    // regardless of org ownership. GET/DELETE are already user+org scoped so
    // this was never a cross-tenant READ leak, but it let a caller write
    // garbage history under an id it has no real relationship to. Mirrors
    // the org-scope check ideaCollabWs.gateway.ts uses for its legacy
    // (ENABLE_SHARED_IDEA_MAPS off) branch rather than the stricter
    // assertIdeaMembership, so this doesn't newly require an
    // organization_members row beyond what every other write path assumes.
    const ideaOrgCheck = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM my_ideas WHERE id = ? AND organization_id = ?`,
      [ideaId, orgId]
    );
    if (!ideaOrgCheck) return res.status(404).json({ error: 'Idea not found' });

    const schema = z.object({
      label: z.string().min(1).max(200),
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
      // Optional tool-specific state so restore rolls back the whole tool
      // (whiteboard drawings/scenes, process-flow lanes, table config).
      extensions: z.record(z.string(), z.any()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    // Shared write-path with the auto-snapshot cron (ideaMapAutoSnapshotJob).
    const snapshot = await createIdeaMapSnapshot({
      ideaId,
      userId,
      organizationId: orgId,
      label: parsed.data.label,
      nodes: parsed.data.nodes,
      edges: parsed.data.edges,
      extensions: parsed.data.extensions ?? null,
    });

    await req.emitAuditEvent?.({
      action: 'IDEA_MAP_SNAPSHOT_CREATE',
      resourceType: 'IDEA_MAP_SNAPSHOT',
      resourceId: snapshot.id,
    });

    res.status(201).json({
      ok: true,
      snapshot,
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

    // @mention → notification. Resolve tokens against the caller's org roster
    // (org-scoped: tokens matching no org member are dropped, so a comment can
    // never notify a user outside the organization). Best-effort — a notify
    // failure must never fail the comment write.
    try {
      const { getMembers } = await import('../services/organizationService.js');
      const members = await getMembers(orgId);
      const mentionedUserIds = resolveMentionsFromComment(
        parsed.data.text,
        parsed.data.mentions,
        members,
        userId // don't notify the author for self-mentions
      );
      if (mentionedUserIds.length > 0) {
        const snippet =
          parsed.data.text.length > 140 ? `${parsed.data.text.slice(0, 140)}…` : parsed.data.text;
        await Promise.allSettled(
          mentionedUserIds.map((uid) =>
            NotificationService.send({
              userId: uid,
              organizationId: orgId,
              type: 'whiteboard.mention',
              title: `${userName} mentioned you in a whiteboard comment`,
              body: snippet,
              entityType: 'idea',
              entityId: ideaId,
              relatedObjectType: 'idea_node',
              relatedObjectId: nodeId,
              actionUrl: `/my-work/ideas/${ideaId}`,
              actorId: userId,
              actorName: userName,
              priority: 'normal',
              metadata: { ideaId, nodeId, commentId: id },
            })
          )
        );
      }
    } catch (notifyErr) {
      logger.warn('[my-work] whiteboard mention notification failed (non-fatal):', notifyErr);
    }

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

/**
 * GET /api/my-work/my-ideas/:id/map/comments
 *
 * WSZYSTKIE komentarze Idei jednym zapytaniem — wątek całej Idei (node_id
 * `__idea__`, sentinel z panelu „Komentarze") ORAZ wątki wszystkich węzłów.
 *
 * PO CO: prawy panel w zakresie „Cała Idea" musi pokazać komplet. Bez tego
 * komentarz dopisany do węzła znikał po przełączeniu na „Całą Ideę" (wyglądał
 * na zgubiony), a licznik przy zakładce kłamał. Wariant „N zapytań, po jednym
 * na węzeł" odpada — mapy mają po kilkadziesiąt węzłów.
 *
 * Dopisywanie/usuwanie zostaje na trasach per-node (`…/nodes/:nodeId/comments`)
 * — ta trasa jest wyłącznie do odczytu zbiorczego.
 */
router.get(
  '/my-ideas/:id/map/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const hasTables = await requireTables(res, ['idea_node_comments']);
    if (!hasTables) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId' });

    const rows = await queryHelpers.query<any>(
      `SELECT id, node_id, user_id, user_name, text, mentions, created_at
       FROM idea_node_comments
       WHERE idea_id = ? AND organization_id = ?
       ORDER BY created_at ASC`,
      [ideaId, orgId]
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
    // J26 (Kanał 2): rewrite an existing process step in place
    'edit_step',
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

    // M08 L-03 (sibling): verify the idea is owned by this user+org before spending
    // LLM budget. ai-generate takes :id from the path and calls an LLM; without this
    // guard an authenticated user can burn the org's budget on arbitrary idea UUIDs
    // (cost vector — context comes from the body, so it is not a data leak). Mirrors
    // the ai-suggestions / ai-table-action / ai-fill guards.
    const ownsGenerate = await queryHelpers.queryOne<any>(
      `SELECT 1 AS ok FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!ownsGenerate) return res.status(404).json({ error: 'Idea not found' });

    // E12 (10.4): a restricted Idea's content must never reach an LLM prompt.
    // Body carries title/seedText/nodes/edges straight to generateIdeaAI() below —
    // the same leak class as map/expand, map/ai-suggestions and map/gap-analysis,
    // which this endpoint had not yet been gated the same way as.
    if (await isIdeaRestricted(ideaId, orgId)) {
      return res
        .status(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.status)
        .json(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.body);
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
      // Enrichment (AI generation panel) — degraded 200 zamiast wywracania panelu.
      logger.warn('[IdeaAIGenerate] degraded', { err, correlationId: (req as any).correlationId });
      res.json({ degraded: true, nodes: [], edges: [] });
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
  baseVersion: z.number().int().positive().optional(),
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

    const { artifactRef, artifactIndex, label, linkRole, baseVersion } = parsed.data;

    if (!(await requireTables(res, ['my_idea_maps']))) return;

    // A1 (D-WB-2): resolve canonical (owner) row so org members can attach artifacts.
    const canonicalUserId = await resolveCanonicalMapOwner(ideaId, orgId);
    if (!canonicalUserId) return res.status(404).json({ error: 'Idea map not found' });

    const map = await queryHelpers.queryOne<any>(
      `SELECT id, version, nodes_json, edges_json, preferred_tool as "preferredTool", extensions_json as "extensionsJson", schema_version as "schemaVersion"
       FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, canonicalUserId, orgId]
    );
    if (!map) return res.status(404).json({ error: 'Idea map not found' });
    const currentVersion = Number(map.version || 1);
    if (baseVersion == null) {
      return res.status(400).json({
        error: 'baseVersion is required for artifact attach',
        code: 'IDEA_MAP_BASE_VERSION_REQUIRED',
        currentVersion,
      });
    }
    if (baseVersion !== currentVersion) {
      return res.status(409).json(
        buildMapConflictPayload(map, {
          id: ideaId,
          title: '',
          isPl: false,
        })
      );
    }

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

    const validation = validateAndNormalizeGraph({
      nodes,
      edges: parseIdeaMapArray(map.edges_json),
      extensions: parseIdeaMapObject(map.extensionsJson),
      preferredTool: map.preferredTool ? String(map.preferredTool) : null,
    });
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid graph schema after artifact attach',
        details: validation.errors,
      });
    }
    const updateResult = await queryHelpers.queryRun(
      `UPDATE my_idea_maps
       SET nodes_json = ?, edges_json = ?, version = COALESCE(version, 1) + 1, updated_at = ${nowSql()}
       WHERE id = ? AND version = ?`,
      [
        JSON.stringify(validation.normalized.nodes),
        JSON.stringify(validation.normalized.edges),
        map.id,
        baseVersion,
      ]
    );
    if (Number(updateResult?.changes || 0) === 0) {
      const latest = await queryHelpers.queryOne<any>(
        `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson", preferred_tool as "preferredTool", extensions_json as "extensionsJson", schema_version as "schemaVersion"
         FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
        [ideaId, canonicalUserId, orgId]
      );
      return res.status(409).json(
        buildMapConflictPayload(latest, {
          id: ideaId,
          title: '',
          isPl: false,
        })
      );
    }

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

    res.status(201).json({ ok: true, artifactLink: newLink, version: currentVersion + 1 });
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
    const baseVersionParsed = parseOptionalVersion(req.query.baseVersion);
    if (baseVersionParsed === 'invalid') {
      return res.status(400).json({
        error: 'Invalid baseVersion',
        details: 'baseVersion must be a number when provided',
      });
    }
    const baseVersion = baseVersionParsed;
    if (!ideaId || !objectId || !artifactType || !artifactId) {
      return res.status(400).json({ error: 'Missing required params' });
    }

    if (!(await requireTables(res, ['my_idea_maps']))) return;

    // A1 (D-WB-2): resolve canonical (owner) row so org members can detach artifacts.
    const canonicalUserId = await resolveCanonicalMapOwner(ideaId, orgId);
    if (!canonicalUserId) return res.status(404).json({ error: 'Idea map not found' });

    const map = await queryHelpers.queryOne<any>(
      `SELECT id, version, nodes_json, edges_json, preferred_tool as "preferredTool", extensions_json as "extensionsJson", schema_version as "schemaVersion"
       FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, canonicalUserId, orgId]
    );
    if (!map) return res.status(404).json({ error: 'Idea map not found' });
    const currentVersion = Number(map.version || 1);
    if (baseVersion == null) {
      return res.status(400).json({
        error: 'baseVersion is required for artifact detach',
        code: 'IDEA_MAP_BASE_VERSION_REQUIRED',
        currentVersion,
      });
    }
    if (baseVersion !== currentVersion) {
      return res.status(409).json(
        buildMapConflictPayload(map, {
          id: ideaId,
          title: '',
          isPl: false,
        })
      );
    }

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

    const validation = validateAndNormalizeGraph({
      nodes,
      edges: parseIdeaMapArray(map.edges_json),
      extensions: parseIdeaMapObject(map.extensionsJson),
      preferredTool: map.preferredTool ? String(map.preferredTool) : null,
    });
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid graph schema after artifact detach',
        details: validation.errors,
      });
    }
    const updateResult = await queryHelpers.queryRun(
      `UPDATE my_idea_maps
       SET nodes_json = ?, edges_json = ?, version = COALESCE(version, 1) + 1, updated_at = ${nowSql()}
       WHERE id = ? AND version = ?`,
      [
        JSON.stringify(validation.normalized.nodes),
        JSON.stringify(validation.normalized.edges),
        map.id,
        baseVersion,
      ]
    );
    if (Number(updateResult?.changes || 0) === 0) {
      const latest = await queryHelpers.queryOne<any>(
        `SELECT id, version, nodes_json as "nodesJson", edges_json as "edgesJson", preferred_tool as "preferredTool", extensions_json as "extensionsJson", schema_version as "schemaVersion"
         FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
        [ideaId, canonicalUserId, orgId]
      );
      return res.status(409).json(
        buildMapConflictPayload(latest, {
          id: ideaId,
          title: '',
          isPl: false,
        })
      );
    }

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

    res.json({ ok: true, version: currentVersion + 1 });
  })
);

router.get(
  '/my-ideas/:id/objects/:objectId/artifacts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const { id: ideaId, objectId } = req.params;
    if (!ideaId || !objectId) return res.status(400).json({ error: 'Missing params' });

    if (!(await requireTables(res, ['my_idea_maps']))) return;

    // Read-side parity with GET /map (see resolveMapReadRow): shared mode reads
    // the is_canonical row; legacy/fallback mode reads the idea-owner's row so a
    // non-owner org member sees the artifact links they (or a teammate) just
    // attached via the shared write path above.
    const strategy = await resolveMapReadRow(ideaId, orgId);
    if (!strategy) return res.status(404).json({ error: 'Idea map not found' });

    const map =
      strategy.mode === 'canonical'
        ? await queryHelpers.queryOne<any>(
            `SELECT nodes_json FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
            [ideaId, orgId]
          )
        : await queryHelpers.queryOne<any>(
            `SELECT nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
            [ideaId, strategy.userId, orgId]
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
// T009 Enhancement — My Ideas Convert/Promote
// ============================================================================

/**
 * Idea → output convert targets that have a real handler below.
 * SSOT (FE mirror + roadmap): src/components/MyWork/ideaConvertTargets.ts (`status: 'live'`).
 * Keep this in lock-step with the `live` entries there; a vitest contract test asserts
 * FE-live ⊆ this allowlist. `soon` targets are never sent by the FE.
 */
const LIVE_CONVERT_TARGETS = [
  'initiative',
  'task_set',
  'decision',
  'team_chat',
  'report',
  'presentation',
] as const;

/**
 * E11 (2026-08-10) — version tag for the field-mapping logic below (title →
 * target name, aiExpansion/body → description, summaryData.nextSteps →
 * tasks, …). Bump this string whenever that mapping logic changes materially
 * so lineage rows can be told apart by which mapping produced them
 * (docs/qa/ideas-manual-audit-2026-08-09/09_*, §9 `mappingVersion`).
 */
const CONVERSION_MAPPING_VERSION = 'v1';

/**
 * POST /api/my-work/my-ideas/:id/convert
 * Body: { target: 'initiative'|'task_set'|'decision'|'team_chat'|'report'|'presentation', options?: {...} }
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
    if (!(LIVE_CONVERT_TARGETS as readonly string[]).includes(target)) {
      return res.status(400).json({ error: 'Invalid target' });
    }

    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
    if (!idempotencyKey) {
      return res.status(428).json({ error: 'Idempotency-Key is required', code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }

    return queryHelpers.withPgTransaction(async () => {
    await queryHelpers.queryRun(`SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))`, [orgId, idempotencyKey]);

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

    const conversionSourceHash = canonicalSourceHash({
      source: {
        id: idea.id,
        title: idea.title,
        body: idea.body,
        tags: idea.tags,
        seedText: idea.seedText,
        aiExpansion: idea.aiExpansion,
        summaryData: idea.summaryData,
        potential: idea.potential,
        complexity: idea.complexity,
        area: idea.area,
        priority: idea.priority,
      },
      target,
      options,
      nodeIds,
    });
    const existingConversion = await queryHelpers.queryOne<{
      source_content_hash: string | null;
      response_json: string | null;
    }>(
      `SELECT source_content_hash, response_json FROM my_idea_conversions
        WHERE organization_id = ? AND idempotency_key = ? LIMIT 1`,
      [orgId, idempotencyKey]
    );
    if (existingConversion) {
      if (existingConversion.source_content_hash !== conversionSourceHash) {
        return res.status(409).json({ error: 'Idempotency key collision', code: 'IDEMPOTENCY_COLLISION' });
      }
      return res.json({ ...(JSON.parse(existingConversion.response_json || '{}')), replayed: true });
    }

    const tags = parseTagsArray(idea?.tags);
    // F15 (data-integrity): idea.title may already carry entities escaped by the
    // global sanitizer on a prior save. Decode once here — this value feeds
    // initiatives.name/decisions.title/tasks.title/reports.title below.
    const safeTitle = decodeHtmlEntities(String(idea?.title || 'Idea').trim()) || 'Idea';
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

    const activeTool = typeof options?.activeTool === 'string' ? options.activeTool : null;
    let processFlowReadback = '';
    if (activeTool === 'process_flow') {
      try {
        const mapRow = await queryHelpers.queryOne<{ nodes_json: string | null }>(
          `SELECT nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
          [ideaId, userId, orgId]
        );
        if (mapRow?.nodes_json) {
          const nodes: Array<{ data?: { label?: string } }> = JSON.parse(String(mapRow.nodes_json));
          const labels = nodes.map((n) => (n.data?.label ?? '').trim()).filter(Boolean);
          if (labels.length > 0) processFlowReadback = labels.join(' → ');
        }
      } catch {
        /* best-effort: blob unavailable */
      }
    }

    // P0-1 (docs/standards/idea-workspace/12_BACKLOG_I_ODBIOR.md, model docelowy:
    // 10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md §2.3): backend dziś NIE dostaje jawnego
    // zakresu konwersji z FE (żadne z trzech wejść — Menu 1 / prawy panel / menu
    // kontekstowe — nie wysyła `options.scope`, patrz IdeaMapWorkspace.tsx:2045-2052).
    // Naprawa: akceptujemy `options.scope` jeśli kiedyś zacznie być wysyłany
    // ('workspace' = cała Idea), a przy jego braku wnioskujemy best-effort z obecności
    // `nodeIds` — dokładnie ten sam sygnał, którego dziś używa FE do rozróżnienia
    // "konwertuj całość" (Menu 1 bez zaznaczenia, nodeIds puste) od "konwertuj
    // zaznaczenie/węzeł/gałąź" (nodeIds niepuste). To NIE jest doskonałe (np. Table
    // bulk-convert bywa niespójny ze `selection.ids` — patrz audyt §4.5), ale jest
    // ścisłym nadzbiorem informacji, którą backend miał do tej pory (żadnej).
    const explicitScope = typeof options?.scope === 'string' ? options.scope.trim() : '';
    const isWholeIdeaScope = explicitScope ? explicitScope === 'workspace' : nodeIds.length === 0;
    // E11 (2026-08-10): when the caller sends a real `options.scope` (now wired
    // from IdeaMapWorkspace.handleConvert's preview gate + convertSingleNode/
    // convertBranch), record it verbatim (single_item / single_item_cascade /
    // selected_items / …) instead of collapsing every non-workspace conversion
    // into the single bucket 'selection' — the column is an open TEXT list
    // (no CHECK, see 20260723_idea_conversion_history.sql), so finer values
    // need no migration. Legacy callers that still omit `scope` keep the old
    // 'selection' fallback — behavior for them is unchanged.
    const conversionScope = isWholeIdeaScope ? 'workspace' : explicitScope || 'selection';

    const promote = async (
      promotedTo: string,
      promotedEntityId: string | null,
      response: Record<string, unknown>
    ) => {
      response.replayed = false;
      // Historia KAŻDEJ konwersji — insert, NIGDY update. Zastępuje pojedyncze pole
      // `promoted_to`, które nadpisywało się bezwarunkowo niezależnie od zakresu
      // (defekt P0-1). Best-effort: brak tabeli (migracja 20260723_idea_conversion_history
      // jeszcze nie uruchomiona) nie może zablokować samej konwersji.
      try {
        // E11 (2026-08-10): fill in the two fields the §9 lineage shape
        // ({conversionId,targetType,targetId,scope,sourceElementIds,createdAt,
        // createdBy,mappingVersion,sourceLink}) was still missing —
        // `source_link_json` (column existed, unused since the P0-1 migration)
        // and `mapping_version` (new additive column, feature-detected exactly
        // like `maturity_gates_json` above — see 20260810_idea_conversion_
        // mapping_version.sql, NOT applied by this task, DB SAFETY).
        const conversionCols = await getTableColumns('my_idea_conversions');
        const hasMappingVersion = conversionCols.has('mapping_version');
        const sourceLink = JSON.stringify({
          type: 'idea',
          id: ideaId,
          containerType: 'idea_workspace',
          containerId: ideaId,
        });
        const insertCols = [
          'id',
          'idea_id',
          'organization_id',
          'target',
          'entity_id',
          'scope',
          'node_ids_json',
          'source_link_json',
          'created_by',
          'idempotency_key',
          'source_content_hash',
          'response_json',
        ];
        const insertVals: any[] = [
          uuidv4(),
          ideaId,
          orgId,
          promotedTo,
          promotedEntityId,
          conversionScope,
          JSON.stringify(nodeIds),
          sourceLink,
          userId,
          idempotencyKey,
          conversionSourceHash,
          JSON.stringify(response),
        ];
        if (hasMappingVersion) {
          insertCols.push('mapping_version');
          insertVals.push(CONVERSION_MAPPING_VERSION);
        }
        await queryHelpers.queryRun(
          `INSERT INTO my_idea_conversions (${insertCols.join(', ')})
           VALUES (${insertCols.map(() => '?').join(', ')})`,
          insertVals
        );
      } catch (err: any) {
        throw new Error(`idea_conversion_receipt_failed: ${err?.message || String(err)}`);
      }

      // `promoted_to`/`promoted_entity_id`/`stage` Idei zostają dla zgodności wstecznej,
      // ale zmieniają się TYLKO przy konwersji CAŁEJ Idei (scope='workspace'). Konwersja
      // fragmentu (zaznaczenie/węzeł/gałąź) dostaje wyłącznie wpis w historii powyżej —
      // status i etap całej Idei zostają nietknięte.
      if (isWholeIdeaScope) {
        await queryHelpers.queryRun(
          `UPDATE my_ideas
           SET promoted_to = ?, promoted_entity_id = ?, stage = 'promoted', updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ? AND organization_id = ?`,
          [promotedTo, promotedEntityId, ideaId, userId, orgId]
        );
      }
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

      // V51-15: When nodeIds provided, enrich summary with selected node labels
      // P14 integration: prepend process flow readback when converting from PF
      let initSummary = (safeExpansion || safeBody).slice(0, 5000) || null;
      if (processFlowReadback) {
        initSummary = `## Process Flow\n${processFlowReadback}\n\n${initSummary || ''}`.slice(
          0,
          5000
        );
      }
      if (nodeIds.length > 0) {
        try {
          const mapRow = await queryHelpers.queryOne<any>(
            `SELECT nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
            [ideaId, userId, orgId]
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
      const initArea = idea?.area ? String(idea.area).slice(0, 120) : null;

      // Uspójnienie F1.5 — przez kanoniczny lejek (DRAFT + name/title + lineage).
      let initiativeId: string;
      if (process.env.INITIATIVE_FUNNEL_ENABLED !== 'false') {
        const __r = await funnelCreateInitiative(
          orgId,
          {
            title: safeTitle.slice(0, 255),
            summary: initSummary,
            area: initArea,
            ownerExecutionId: userId,
            ownerBusinessId: userId,
            sourceType: 'tool',
            sourceId: toolSessionId,
          },
          { validate: false, actor: { id: userId } }
        );
        initiativeId = __r.id;
        // Funnel does not set `sponsor_id` — post-create UPDATE for the extra column.
        if (cols.has('sponsor_id')) {
          try {
            await queryHelpers.queryRun(
              `UPDATE initiatives SET sponsor_id = ? WHERE id = ? AND organization_id = ?`,
              [userId, initiativeId, orgId]
            );
          } catch {
            /* sponsor_id column may be absent on some schemas */
          }
        }
        // H1.5 — idea provenance back-reference. source_type/source_id carry the
        // tool-session lineage (V3-A01 traceability), so the direct "where from"
        // label lives in `created_from` — the same origin idiom the assessment
        // path uses (created_from='assessment') and InitiativeController's source
        // filter already recognises. The idea id itself stays reachable via the
        // link-graph edge (below) + my_ideas.promoted_entity_id.
        if (cols.has('created_from')) {
          try {
            await queryHelpers.queryRun(
              `UPDATE initiatives SET created_from = 'idea' WHERE id = ? AND organization_id = ?`,
              [initiativeId, orgId]
            );
          } catch {
            /* created_from column may be absent on some schemas */
          }
        }
      } else {
        initiativeId = uuidv4();
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
        add('summary', initSummary);
        add('area', initArea);
        add('owner_execution_id', userId);
        add('owner_business_id', userId);
        add('sponsor_id', userId);
        add('source_type', 'tool');
        add('source_id', toolSessionId);
        // H1.5 — idea provenance back-reference (see funnel branch above).
        add('created_from', 'idea');

        await queryHelpers.queryRun(
          `INSERT INTO initiatives (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );
      }

      await promote('initiative', initiativeId, {
        promotedTo: 'initiative', promotedEntityId: initiativeId,
        created: { initiativeId }, sourceSessionId: toolSessionId, sourceNodeIds: nodeIds,
      });

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
        replayed: false,
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
            `SELECT nodes_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
            [ideaId, userId, orgId]
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

      await promote('task_set', JSON.stringify(taskIds), {
        promotedTo: 'task_set', promotedEntityId: JSON.stringify(taskIds),
        created: { taskIds }, sourceSessionId: toolSessionId,
      });

      return res.json({
        replayed: false,
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

      await promote('decision', decisionId, {
        promotedTo: 'decision', promotedEntityId: decisionId,
        created: { decisionId }, sourceSessionId: toolSessionId,
      });

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
        replayed: false,
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
          processFlowReadback ? `## Process Flow\n${processFlowReadback}` : null,
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

      await promote('report', reportId, {
        promotedTo: 'report', promotedEntityId: reportId, outputId: reportId,
        created: { reportId }, sourceSessionId: toolSessionId,
      });

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
        replayed: false,
        promotedTo: 'report',
        promotedEntityId: reportId,
        outputId: reportId,
        created: { reportId },
        sourceSessionId: toolSessionId,
      });
    }

    // ----- Convert: Presentation -----
    if (target === 'presentation') {
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
      await createNativeDeck({
        organizationId: orgId,
        deckId: presId,
        title: safeTitle.slice(0, 255),
        unifiedJson: {
          meta: {
            client: orgId,
            project: safeTitle,
            date: now.slice(0, 10),
            author: userId,
            confidentiality: 'internal',
            language: typeof options?.language === 'string' && options.language.startsWith('en') ? 'en' : 'pl',
          },
          slides: [{
            intent: 'cover',
            key_message: safeTitle,
            content: {
              type: 'cover', title: safeTitle,
              subtitle: safeBody || safeExpansion || undefined,
              organization: orgId, date: now.slice(0, 10), confidentiality: 'internal',
            },
          }],
        },
        sourceType: 'idea',
        sourceId: ideaId,
        createdBy: userId,
        createdAt: now,
        status: 'draft',
        registerArtifact: false,
      });

      await promote('presentation', presId, {
        promotedTo: 'presentation', promotedEntityId: presId, outputId: presId,
        created: { presentationId: presId }, sourceSessionId: toolSessionId,
      });

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
        replayed: false,
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

      await promote('team_chat', conversationId, {
        promotedTo: 'team_chat', promotedEntityId: conversationId,
        created: { conversationId, chatProjectId },
      });

      return res.json({
        replayed: false,
        promotedTo: 'team_chat',
        promotedEntityId: conversationId,
        created: { conversationId, chatProjectId },
      });
    }
    });
  })
);

/**
 * GET /api/my-work/my-ideas/:id/conversions
 *
 * E11 (2026-08-10) — read-only lineage list for the §9 append-only
 * `conversions[]` contract (docs/qa/ideas-manual-audit-2026-08-09/09_*, §9;
 * docs/standards/idea-workspace/10_*, §2.3). Backs the FE conversion preview
 * (prior-conversion count/warnings) and any future "Powiązania" backlink
 * list. Read-only — creates nothing, mutates nothing.
 */
router.get(
  '/my-ideas/:id/conversions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing idea id' });

    // Ownership check — same guard as the convert route above.
    const idea = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    if (!(await requireTables(res, ['my_idea_conversions']))) {
      // Additive table from 20260723_idea_conversion_history.sql — if a
      // database somehow lacks it, degrade honestly to an empty list rather
      // than a 500; the FE preview treats this as "no known prior conversions".
      return res.json({ conversions: [] });
    }

    const conversionCols = await getTableColumns('my_idea_conversions');
    const mappingVersionSelect = conversionCols.has('mapping_version')
      ? 'mapping_version as "mappingVersion"'
      : 'NULL as "mappingVersion"';

    const rows = await queryHelpers.queryAll<any>(
      `
      SELECT
        id as "conversionId",
        target as "targetType",
        entity_id as "targetId",
        scope,
        node_ids_json as "sourceElementIdsJson",
        source_link_json as "sourceLinkJson",
        created_by as "createdBy",
        created_at as "createdAt",
        ${mappingVersionSelect}
      FROM my_idea_conversions
      WHERE idea_id = ? AND organization_id = ?
      ORDER BY created_at DESC
      `,
      [ideaId, orgId]
    );

    const conversions = (rows || []).map((r: any) => {
      let sourceElementIds: string[] = [];
      try {
        sourceElementIds = r.sourceElementIdsJson ? JSON.parse(r.sourceElementIdsJson) : [];
      } catch {
        sourceElementIds = [];
      }
      let sourceLink: unknown = null;
      try {
        sourceLink = r.sourceLinkJson ? JSON.parse(r.sourceLinkJson) : null;
      } catch {
        sourceLink = null;
      }
      return {
        conversionId: r.conversionId,
        targetType: r.targetType,
        targetId: r.targetId,
        scope: r.scope,
        sourceElementIds,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
        mappingVersion: r.mappingVersion,
        sourceLink,
      };
    });

    res.json({ conversions });
  })
);

// ============================================================================
// T011 — Notebook → EXTRACTED to ./my-work/notebook.routes.ts
// ============================================================================
router.use(notebookRouter);
router.use(radarRouter);

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
      logger.error('[morning-brief]', err);
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
          // F15 (data-integrity): decode entities the global sanitizer escaped
          // on payload.title before storing tasks.title.
          add('title', decodeHtmlEntities(String(payload.title || 'New Task').slice(0, 500)));
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
          // F15 (data-integrity): decode entities the global sanitizer escaped
          // on payload.title before storing decisions.title.
          add('title', decodeHtmlEntities(String(payload.title || 'New Decision').slice(0, 500)));
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
      logger.error('[my-work] chat-actions failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({ error: 'Action failed', code: 'MY_WORK_CHAT_ACTION_FAILED' });
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

    const decisionCols = await getTableColumns('decisions');
    const select = [
      'id',
      'title',
      'description',
      'status',
      'priority',
      decisionCols.has('category') ? 'category' : 'NULL as category',
      decisionCols.has('created_at') ? 'created_at' : 'createdAt as created_at',
      decisionCols.has('deadline')
        ? 'deadline'
        : decisionCols.has('due_date')
          ? 'due_date as deadline'
          : 'NULL as deadline',
    ].join(', ');

    const decision = await queryHelpers.queryOne<any>(
      `SELECT ${select}
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
             WHERE owner_user_id = ? AND organization_id = ? AND title LIKE ?
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
      logger.error('[related-context]', err);
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
      logger.error('[weekly-review]', err);
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

      const insights: { key: string; params?: Record<string, unknown> }[] = [];
      if (patterns.avgVelocity && patterns.currentOpenTasks > patterns.avgVelocity * 2) {
        insights.push({
          key: 'overloaded',
          params: { openTasks: patterns.currentOpenTasks, velocity: patterns.avgVelocity },
        });
      }
      if (patterns.overdueRate && patterns.overdueRate > 30) {
        insights.push({
          key: 'highOverdue',
          params: { rate: patterns.overdueRate },
        });
      }
      if (patterns.avgDecisionDays && patterns.avgDecisionDays > 5) {
        insights.push({
          key: 'slowDecisions',
          params: { days: patterns.avgDecisionDays },
        });
      }
      patterns.insights = insights;
    } catch (err) {
      logger.error('[work-patterns]', err);
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
    // RED-DELIV: `datetime('now', ?)` with a *parameterized* modifier is never
    // rewritten by PostgresDatabase.adaptQuery (it only matches literal-string
    // modifiers), so this always threw 42883 `function datetime(...) does not
    // exist` on Postgres. Use the existing daysAgoSql() helper — `days` is an
    // already-sanitized integer (Math.min/parseInt), so inlining is injection-safe.
    const row = await queryHelpers.queryOne<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) as total, COUNT(*) as count FROM ai_usage_logs
       WHERE organization_id = ? AND (action = 'inbox_ai_triage' OR purpose = 'inbox_triage')
       AND created_at >= ${daysAgoSql(days)}`,
      [orgId]
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
  requireRole('ADMIN', 'MANAGER', 'OWNER', 'SUPERADMIN'),
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
          totalBacklogHours: Number(capacityOverview.summary.totalBacklog || 0),
          shortfallHours: Math.max(0, Math.round((totalRequired - totalCapacity) * 10) / 10),
          avgUtilization: capacityOverview.summary.avgUtilization,
          windowStart: capacityOverview.windowStart,
          windowEnd: capacityOverview.windowEnd,
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
          backlogHours: row.backlogHours,
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
        // RED-DELIV: `users` has NO `name` column (only first_name/last_name),
        // so `u.name` threw 42703 and the whole handler was silently swallowed
        // (returns empty suggestions = data loss). Also `is_active` is a TEXT
        // column in the live schema, so `u.is_active = 1` (text = integer) would
        // throw 42883 once the name error was gone — use a tolerant text check.
        `SELECT u.id,
                COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), u.email) AS name,
                u.email,
          (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.organization_id = ? AND t.status NOT IN ('done', 'completed')) as open_tasks
         FROM users u
         WHERE u.organization_id = ? AND u.id != ? AND LOWER(COALESCE(u.is_active, '')) IN ('1', 'true', 't', 'yes')
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

    // M08 L-03: verify the idea is owned by this user+org before spending LLM budget.
    const ownsSuggest = await queryHelpers.queryOne<any>(
      `SELECT 1 AS ok FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!ownsSuggest) return res.status(404).json({ error: 'Idea not found' });

    // E12 (10.4): a restricted Idea's content must never reach an LLM prompt.
    if (await isIdeaRestricted(ideaId, orgId)) {
      return res
        .status(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.status)
        .json(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.body);
    }

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
      // Enrichment (AI podpowiedzi) — degraded 200 zamiast wywracania panelu.
      logger.warn('[ai-suggestions] degraded', { err, correlationId: (req as any).correlationId });
      res.json({ suggestions: [], companyContextUsed: false, degraded: true });
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

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    const command = String(req.body?.command || '').trim();
    if (!command) return res.status(400).json({ error: 'Command required' });

    // M08 L-03: verify ownership before spending LLM budget.
    const ownsAction = await queryHelpers.queryOne<any>(
      `SELECT 1 AS ok FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!ownsAction) return res.status(404).json({ error: 'Idea not found' });

    // E12 (10.4): a restricted Idea's content must never reach an LLM prompt.
    if (await isIdeaRestricted(ideaId, orgId)) {
      return res
        .status(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.status)
        .json(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.body);
    }

    const tableSchema = Array.isArray(req.body?.schema) ? req.body.schema : [];
    const language = String(req.body?.language || 'en');

    try {
      const { generateTableAction } = await import('../services/ideaAISuggestionsService.js');
      const action = await generateTableAction(
        ideaId,
        command,
        tableSchema,
        userId,
        orgId,
        language
      );
      res.json({ action });
    } catch (err: any) {
      // Enrichment (AI podpowiedź komendy) — degraded 200 zamiast wywracania panelu.
      logger.warn('[ai-table-action] degraded', { err, correlationId: (req as any).correlationId });
      res.json({ action: null, degraded: true });
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

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    const columnPrompt = String(req.body?.prompt || '').trim();
    if (!columnPrompt) return res.status(400).json({ error: 'Prompt required' });

    // M08 L-03: verify ownership before spending LLM budget.
    const ownsFill = await queryHelpers.queryOne<any>(
      `SELECT 1 AS ok FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, userId, orgId]
    );
    if (!ownsFill) return res.status(404).json({ error: 'Idea not found' });

    // E12 (10.4): a restricted Idea's content must never reach an LLM prompt.
    if (await isIdeaRestricted(ideaId, orgId)) {
      return res
        .status(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.status)
        .json(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.body);
    }

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
      // Enrichment (AI auto-fill kolumny) — degraded 200 zamiast wywracania panelu.
      logger.warn('[ai-fill] degraded', { err, correlationId: (req as any).correlationId });
      res.json({ results: [], degraded: true });
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
    const { orgId } = identity;

    const ideaId = String(req.params.id || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Invalid idea id' });

    // E12 (10.4): a restricted Idea's content must never leave as an export file
    // (same rule as the mind-map PPTX export). CSV export had no gate at all.
    if (await isIdeaRestricted(ideaId, orgId)) {
      return res
        .status(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.status)
        .json(IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE.body);
    }

    try {
      // Read-side parity with GET /map (see resolveMapReadRow): shared mode reads
      // the is_canonical row; legacy/fallback mode reads the idea-owner's row so a
      // non-owner org member can still export the shared table/whiteboard data.
      const strategy = await resolveMapReadRow(ideaId, orgId);
      if (!strategy) return res.status(404).json({ error: 'Idea map not found' });

      const mapRow =
        strategy.mode === 'canonical'
          ? await queryHelpers.queryOne<any>(
              `SELECT nodes_json, extensions_json FROM my_idea_maps WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE LIMIT 1`,
              [ideaId, orgId]
            )
          : await queryHelpers.queryOne<any>(
              `SELECT nodes_json, extensions_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
              [ideaId, strategy.userId, orgId]
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
      logger.error('[export-csv] failed', { err, correlationId: (req as any).correlationId });
      res.status(500).json({ error: 'Failed to export CSV', code: 'MY_WORK_EXPORT_CSV_FAILED' });
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
    const { get: dbGet } = await import('../utils/DbPromise.js');
    const ideaRow = await dbGet<{ id: string }>(
      'SELECT id FROM my_ideas WHERE id = ? AND organization_id = ?',
      [ideaId, identity.orgId]
    );
    if (!ideaRow) return res.status(404).json({ error: 'Idea not found' });

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
      // Enrichment (cursor/presence realtime) — degraded 200, nie wywraca współpracy.
      logger.warn('[idea-presence-broadcast] degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      res.json({ ok: false, degraded: true });
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
    const { get: dbGet } = await import('../utils/DbPromise.js');
    const ideaRow = await dbGet<{ id: string }>(
      'SELECT id FROM my_ideas WHERE id = ? AND organization_id = ?',
      [ideaId, identity.orgId]
    );
    if (!ideaRow) return res.status(404).json({ users: [] });

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

// Home domain — extracted to my-work/home.routes.ts
router.use(homeRouter);

export default router;
