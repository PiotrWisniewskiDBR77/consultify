/**
 * Feedback Routes - Enterprise SaaS
 * API endpoints for system feedback, pulse, and feature requests
 *
 * Endpoints:
 * - POST /api/feedback - Submit bug/idea feedback
 * - GET /api/feedback - List all feedback (admin)
 * - PATCH /api/feedback/:id/status - Update status
 * - POST /api/feedback/:id/respond - Admin response
 * - GET /api/feedback/:id - Get single feedback
 * - GET /api/feedback/stats/summary - Statistics
 * - POST /api/feedback/pulse - Quick pulse feedback
 * - POST /api/feedback/feature - Feature request
 * - POST /api/feedback/ai-insights - Get AI insights
 * - GET /api/feedback/ai-analysis/:id - Get AI analysis
 * - GET /api/feedback/trending - Trending topics
 * - GET /api/feedback/pulse-summary - Pulse analytics
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter, feedbackRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import { getAlertEmailService } from '../services/AlertEmailService.js';
import feedbackAIService from '../services/feedbackAIService.js';
import {
  decodeDataUrl,
  readScreenshot as readFeedbackScreenshot,
  saveScreenshotFromDataUrl,
} from '../services/feedbackArtifacts.js';
import {
  compactObject,
  type FeedbackResolutionRecord,
  type FeedbackWorkflowRecord,
  type FeedbackWorkflowTimelineEntry,
  normalizeResolutionMeta,
  normalizeStringArray,
  normalizeWorkflowMeta,
  normalizeWorkflowTimeline,
  shapeFeedbackRow,
} from '../services/feedbackShape.js';
import {
  findDuplicateCandidates as findFeedbackDuplicates,
  inferCluster as inferFeedbackCluster,
  inferPriorityForPipeline as inferFeedbackPriority,
} from '../services/feedbackTriage.js';
import NotificationService from '../services/notificationService.js';
import { computeSlaDueAtIso } from '../services/feedbackSla.js';
import { anchorSlackThread } from '../services/slack/feedbackThreadAnchor.js';
import { routeToSlack } from '../services/slack/slackRouter.js';
import WhatsAppService from '../services/WhatsAppService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLike(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Slack Command Center (Filar 3 / F3): reply the lifecycle of a feedback ticket
 * into its originating Slack thread. A ticket carries `slack_thread_ts` (and
 * `slack_channel_id`) in metadata_json only when it was reported from Slack
 * (see slackInbound.routes.ts `anchorSlackThread`). For app-reported tickets
 * there is no thread → this is a silent no-op.
 *
 * Fire-and-forget + fail-soft: it re-reads metadata_json from a row snapshot or
 * fetches it, and NEVER throws to the HTTP handler.
 *
 * `feedbackRowOrMeta` may be a row with `metadata_json`, an already-parsed
 * metadata object, or a feedback id string (in which case we fetch the row).
 */
export async function notifySlackThread(
  feedbackRowOrMeta:
    | { metadata_json?: string | Record<string, unknown> | null }
    | Record<string, unknown>
    | string
    | null
    | undefined,
  text: string
): Promise<void> {
  try {
    if (!text || !text.trim()) return;

    let meta: Record<string, unknown> | null = null;

    if (typeof feedbackRowOrMeta === 'string') {
      const row = await dbGet<{ metadata_json?: string | null }>(
        `SELECT metadata_json FROM feedback_items WHERE id = ?`,
        [feedbackRowOrMeta]
      );
      meta = safeJsonParse<Record<string, unknown>>(row?.metadata_json ?? null, {});
    } else if (feedbackRowOrMeta && typeof feedbackRowOrMeta === 'object') {
      const rawMeta = (feedbackRowOrMeta as { metadata_json?: unknown }).metadata_json;
      if (rawMeta !== undefined) {
        meta =
          typeof rawMeta === 'string'
            ? safeJsonParse<Record<string, unknown>>(rawMeta, {})
            : ((rawMeta as Record<string, unknown>) ?? {});
      } else {
        // Assume the object itself is the parsed metadata.
        meta = feedbackRowOrMeta as Record<string, unknown>;
      }
    }

    const threadTs =
      meta && typeof meta.slack_thread_ts === 'string' ? meta.slack_thread_ts : null;
    if (!threadTs) return; // not a Slack-sourced ticket → nothing to do

    await routeToSlack({
      channel: 'feedback',
      severity: 'INFO',
      title: 'Aktualizacja zgłoszenia',
      text,
      threadTs,
    });
  } catch (err) {
    logger.warn('[Feedback] notifySlackThread failed (non-fatal):', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Human-friendly label for the actor behind a triage action, for Slack thread
 * replies. Prefers the JWT's name/email; if only an id is present (e.g. a token
 * without profile claims), resolves name/email from the users table so the
 * thread never shows a raw UUID. Fail-soft → 'zespół'.
 */
async function resolveActorLabel(reqUser: unknown): Promise<string> {
  const u = (reqUser || {}) as { email?: string; name?: string; id?: string };
  if (u.name && u.name.trim()) return u.name.trim();
  if (u.email && u.email.trim()) return u.email.trim();
  if (u.id) {
    try {
      // users has display_name / first_name / last_name / email (NO `name` column).
      const row = await dbGet<{
        display_name?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
      }>(`SELECT display_name, first_name, last_name, email FROM users WHERE id = ?`, [u.id]);
      const dn = String(row?.display_name || '').trim();
      if (dn) return dn;
      const full = [row?.first_name, row?.last_name]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
      if (full) return full;
      if (row?.email && String(row.email).trim()) return String(row.email).trim();
    } catch {
      /* fall through */
    }
  }
  return 'zespół';
}

type TicketStatus = 'NEW' | 'PENDING' | 'IN_PROGRESS' | 'REVIEWED' | 'RESOLVED' | 'ARCHIVED';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
type FeedbackAlertChannel = 'in_app' | 'slack' | 'email' | 'whatsapp';
type FeedbackEscalationKind = 'feedback' | 'pulse' | 'feature';
type FeedbackAlertDispatchStatus = 'sent' | 'failed' | 'skipped';

interface FeedbackAlertChannelResult {
  status: FeedbackAlertDispatchStatus;
  attemptedAt: string;
  detail?: string;
  recipientCount?: number;
}

interface FeedbackAlertDispatchSummary {
  attemptedAt: string;
  appEnv: string;
  requestedChannels: FeedbackAlertChannel[];
  results: Partial<Record<FeedbackAlertChannel, FeedbackAlertChannelResult>>;
}

let _feedbackSchemaEnsured = false;
async function ensureFeedbackSchema(): Promise<void> {
  if (_feedbackSchemaEnsured) return;
  try {
    // Minimal canonical tables for environments without migrations applied.
    await dbRun(
      `
      CREATE TABLE IF NOT EXISTS feedback_items (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        user_id TEXT,
        feedback_type TEXT,
        title TEXT,
        description TEXT,
        status TEXT,
        priority TEXT,
        severity TEXT,
        source_env TEXT,
        linked_task_id TEXT,
        admin_response TEXT,
        responded_at TIMESTAMP,
        responded_by TEXT,
        metadata_json TEXT,
        owner TEXT,
        cluster TEXT,
        deploy_status TEXT,
        workflow_updated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    );
    await dbRun(
      `
      CREATE TABLE IF NOT EXISTS feedback_items_status_history (
        id TEXT PRIMARY KEY,
        feedback_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        changed_by TEXT,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feedback_items_status_history_feedback ON feedback_items_status_history(feedback_id)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feedback_items_status_history_created ON feedback_items_status_history(created_at)`
    );

    // Additive workflow columns (V2.1) — safe on both SQLite and Postgres.
    // We attempt each ADD COLUMN independently so a legacy SQLite that
    // already has the column still succeeds for the remaining ones.
    const additive: Array<[string, string]> = [
      ['owner', 'TEXT'],
      ['cluster', 'TEXT'],
      ['deploy_status', 'TEXT'],
      ['workflow_updated_at', 'TIMESTAMP'],
      // F5 (SLA): response deadline computed from severity at intake, and the
      // timestamp we last escalated an overdue ticket (so the sweep alerts once).
      ['due_at', 'TIMESTAMP'],
      ['sla_escalated_at', 'TIMESTAMP'],
    ];
    for (const [col, type] of additive) {
      try {
        await dbRun(`ALTER TABLE feedback_items ADD COLUMN ${col} ${type}`);
      } catch {
        // Column already exists or engine doesn't support it — non-fatal.
      }
    }

    // A1: ensure feedback_pulse and feature_requests exist (migration 200 often not applied)
    await dbRun(
      `CREATE TABLE IF NOT EXISTS feedback_pulse (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        organization_id TEXT,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        context TEXT DEFAULT '/',
        comment TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feedback_pulse_user ON feedback_pulse(user_id)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feedback_pulse_rating ON feedback_pulse(rating)`
    );

    await dbRun(
      `CREATE TABLE IF NOT EXISTS feature_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        organization_id TEXT,
        category TEXT DEFAULT 'other',
        feature_name TEXT NOT NULL,
        description TEXT NOT NULL,
        impact TEXT DEFAULT 'medium',
        context TEXT,
        status TEXT DEFAULT 'NEW',
        priority INTEGER DEFAULT 0,
        votes_count INTEGER DEFAULT 0,
        admin_notes TEXT,
        target_release TEXT,
        related_ticket_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feature_requests_created ON feature_requests(created_at)`
    );

    _feedbackSchemaEnsured = true;
  } catch (err) {
    logger.warn('[Feedback] Failed to ensure feedback schema (will rely on migrations):', err);
  }
}

// Use auth context when token exists, but do not hard-require it
const optionalVerifyToken = (req: any, res: any, next: any) => {
  const auth = req?.headers?.authorization;
  if (!auth) return next();
  try {
    return verifyToken(req, res, (err: any) => {
      if (err) {
        logger.warn('[Feedback] optional auth failed, continuing as anonymous');
        return next();
      }
      return next();
    });
  } catch {
    return next();
  }
};

function getAppEnv(): string {
  return String(process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
}

function priorityFromEnvAndSeverity(input: {
  appEnv: string;
  severity?: string | null;
  type?: string | null;
}): TicketPriority {
  const sev = String(input.severity || '').toUpperCase();
  const t = String(input.type || '').toUpperCase();
  const isProd = input.appEnv === 'production';

  if (sev === 'CRITICAL') return 'critical';
  if (sev === 'HIGH') return isProd ? 'high' : 'medium';
  if (sev === 'MEDIUM') return isProd ? 'high' : 'medium';
  if (sev === 'LOW') return isProd ? 'medium' : 'low';

  // Default fallback
  if (t === 'BUG') return isProd ? 'high' : 'medium';
  return isProd ? 'medium' : 'low';
}

function safeJsonParse<T = any>(raw: unknown, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function resolveFeedbackActor(input: {
  reqUser?: AuthRequest['user'];
  userId?: string;
  userEmail?: string;
  userName?: string;
}): {
  actualUserId: string | null;
  actualUserEmail: string | null;
  actualUserName: string | null;
} {
  const reqUser = input.reqUser;
  const actualUserId = reqUser?.id || input.userId || null;
  const actualUserEmail = reqUser?.email || input.userEmail || null;
  const actualUserName =
    reqUser?.name ||
    [reqUser?.firstName, reqUser?.lastName].filter(Boolean).join(' ').trim() ||
    input.userName ||
    null;

  return {
    actualUserId: actualUserId ? String(actualUserId) : null,
    actualUserEmail: actualUserEmail ? String(actualUserEmail) : null,
    actualUserName: actualUserName ? String(actualUserName) : null,
  };
}

async function updateFeedbackMetadata(
  feedbackId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const feedbackCols = await getTableColumns('feedback_items');
  if (!feedbackCols.has('metadata_json')) return;

  const updateCols = ['metadata_json = ?'];
  const updateVals: unknown[] = [JSON.stringify(metadata)];
  if (feedbackCols.has('updated_at')) {
    updateCols.push('updated_at = CURRENT_TIMESTAMP');
  }

  await dbRun(`UPDATE feedback_items SET ${updateCols.join(', ')} WHERE id = ?`, [
    ...updateVals,
    feedbackId,
  ]);
}

/**
 * Atomically set ONE key inside metadata_json (Postgres jsonb_set) without a
 * read-modify-write of the whole object. Critical for concurrency: the async
 * escalation persist ('alertDispatch') and the Slack thread anchor
 * ('slack_thread_ts', written later by the inbound handler for source=slack)
 * would otherwise clobber each other — a whole-object writer using a stale
 * snapshot erases the other's key. Per-key jsonb_set makes both writes commute.
 * Falls back to read-modify-write on engines without jsonb (mock-DB/sqlite).
 */
async function updateFeedbackMetadataKey(
  feedbackId: string,
  key: string,
  value: unknown
): Promise<void> {
  const feedbackCols = await getTableColumns('feedback_items');
  if (!feedbackCols.has('metadata_json')) return;
  const touchUpdated = feedbackCols.has('updated_at') ? ', updated_at = CURRENT_TIMESTAMP' : '';
  try {
    await dbRun(
      `UPDATE feedback_items
       SET metadata_json = jsonb_set(COALESCE(metadata_json, '{}')::jsonb, ARRAY[?]::text[], ?::jsonb, true)::text${touchUpdated}
       WHERE id = ?`,
      [key, JSON.stringify(value ?? null), feedbackId]
    );
    return;
  } catch {
    // Non-jsonb engine (mock-DB / sqlite): fall back to read-modify-write.
    try {
      const row = await dbGet<{ metadata_json?: string | null }>(
        `SELECT metadata_json FROM feedback_items WHERE id = ?`,
        [feedbackId]
      );
      const meta = safeJsonParse<Record<string, unknown>>(row?.metadata_json ?? null, {});
      meta[key] = value;
      await updateFeedbackMetadata(feedbackId, meta);
    } catch (err) {
      logger.warn('[Feedback] updateFeedbackMetadataKey fallback failed', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function stripJsonFences(raw: string): string {
  return String(raw || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function safeJsonParseLoose<T = any>(raw: string, fallback: T): T {
  const cleaned = stripJsonFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m?.[0]) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

function resolveRequestCorrelationId(req: AuthRequest): string | null {
  return (
    (req as AuthRequest & { correlationId?: string }).correlationId ||
    req.get('X-Correlation-ID') ||
    null
  );
}

function buildFailClosedFeedbackError(
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
    correlationId: resolveRequestCorrelationId(req),
  };
}

const reportFeedbackSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  userEmail: z.string().trim().optional(),
  userName: z.string().trim().optional(),
  type: z.enum(['BUG', 'IDEA']),
  title: z.string().trim().max(120).optional(),
  message: z.string().trim().min(1).max(5000),
  description: z.string().trim().max(15000).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  routePath: z.string().trim().max(500).optional(),
  deviceType: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  screenSize: z.string().trim().max(100).optional(),
  uiLanguage: z.string().trim().max(50).optional(),
  uiTheme: z.string().trim().max(30).optional(),
  workspaceContext: z.string().trim().max(1000).optional(),
  clientEnv: z.string().trim().max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // V2 Cursor-ready dossier (all optional, validated loosely to stay
  // backwards compatible with older clients).
  signatureHash: z.string().trim().max(64).optional(),
  appContext: z.record(z.string(), z.unknown()).optional(),
  consoleLogs: z.array(z.record(z.string(), z.unknown())).max(120).optional(),
  networkErrors: z.array(z.record(z.string(), z.unknown())).max(60).optional(),
  breadcrumbs: z.array(z.record(z.string(), z.unknown())).max(80).optional(),
  lastUncaughtError: z.record(z.string(), z.unknown()).nullable().optional(),
  screenshot: z
    .object({
      dataUrl: z.string().min(30).max(2_000_000),
      approxBytes: z.number().int().nonnegative().max(5_000_000).optional(),
      width: z.number().int().positive().max(10_000).optional(),
      height: z.number().int().positive().max(10_000).optional(),
    })
    .nullable()
    .optional(),
});

const pulseFeedbackSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  context: z.string().trim().max(500).optional(),
  comment: z.string().trim().max(5000).optional(),
  timestamp: z.string().trim().optional(),
});

const featureFeedbackSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  userEmail: z.string().trim().optional(),
  category: z.enum(['usability', 'performance', 'missing', 'improvement', 'other']).optional(),
  featureName: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(8000),
  impact: z.enum(['low', 'medium', 'high']).optional(),
  context: z.string().trim().max(500).optional(),
  requestAIAnalysis: z.boolean().optional(),
});

function buildNotificationBody(message: string, extras: string[] = []): string {
  return [String(message || '').trim(), ...extras.filter(Boolean)].filter(Boolean).join('\n\n');
}

function isBlockingPulseComment(comment?: string | null): boolean {
  return /blocked|cannot|can't|unable|stuck|unusable|down|outage|incident|error|broken|nie mogę|nie moge|zablok|blokuje|nie działa|nie dziala|awaria/i.test(
    String(comment || '')
  );
}

function resolveEscalationChannels(input: {
  kind: FeedbackEscalationKind;
  feedbackType?: string | null;
  severity?: string | null;
  rating?: number | null;
  comment?: string | null;
}): FeedbackAlertChannel[] {
  if (input.kind === 'feature') {
    return ['in_app', 'slack'];
  }

  if (input.kind === 'pulse') {
    const channels: FeedbackAlertChannel[] = ['in_app', 'slack'];
    if ((input.rating || 0) <= 2) {
      channels.push('email');
      if (isBlockingPulseComment(input.comment)) {
        channels.push('whatsapp');
      }
    }
    return Array.from(new Set(channels));
  }

  const type = String(input.feedbackType || '').toUpperCase();
  if (type === 'IDEA') {
    return ['in_app', 'slack'];
  }

  const severity = String(input.severity || 'MEDIUM').toUpperCase();
  if (severity === 'CRITICAL') {
    return ['in_app', 'slack', 'email', 'whatsapp'];
  }
  if (severity === 'HIGH') {
    return ['in_app', 'slack', 'email'];
  }
  return ['in_app', 'slack'];
}

async function getSuperAdminRecipients(): Promise<
  Array<{ id: string; email: string | null; organizationId: string | null }>
> {
  const userCols = await getTableColumns('users');
  const selectName = userCols.has('email') ? 'email' : 'NULL as email';
  const selectOrg = userCols.has('organization_id')
    ? 'organization_id'
    : userCols.has('organizationId')
      ? 'organizationId as organization_id'
      : 'NULL as organization_id';
  const activeClause = userCols.has('is_active')
    ? ` AND (CAST(is_active AS TEXT) NOT IN ('0', 'false', 'f') OR is_active IS NULL)`
    : '';

  const rows = await dbAll<{ id: string; email: string | null; organization_id: string | null }>(
    `
      SELECT id, ${selectName}, ${selectOrg}
      FROM users
      WHERE lower(coalesce(role, '')) IN ('superadmin', 'super_admin')
      ${activeClause}
    `,
    []
  );

  return (rows || []).map((row) => ({
    id: String(row.id),
    email: row.email ? String(row.email) : null,
    organizationId: row.organization_id ? String(row.organization_id) : null,
  }));
}

async function notifySuperAdminsInApp(input: {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  relatedObjectType: 'FEEDBACK' | 'PULSE' | 'FEATURE';
  relatedObjectId: string;
  organizationId?: string | null;
  actionUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<FeedbackAlertChannelResult> {
  const attemptedAt = new Date().toISOString();
  const recipients = await getSuperAdminRecipients();
  if (recipients.length === 0) {
    logger.warn('[Feedback] No superadmin recipients found for in-app escalation');
    return {
      status: 'skipped',
      attemptedAt,
      detail: 'No superadmin recipients found',
      recipientCount: 0,
    };
  }

  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      NotificationService.send({
        userId: recipient.id,
        organizationId: recipient.organizationId || input.organizationId || 'system',
        type: input.type,
        severity: input.severity,
        title: input.title,
        body: input.body,
        message: input.body,
        relatedObjectType: input.relatedObjectType,
        relatedObjectId: input.relatedObjectId,
        isActionable: true,
        actionUrl: input.actionUrl,
        metadata: {
          ...(input.metadata || {}),
          recipientEmail: recipient.email || undefined,
        },
        channels: ['in_app'],
        bypassPreferences: true,
        bypassQuietHours: true,
      })
    )
  );
  const successCount = results.filter((result) => result.status === 'fulfilled').length;
  results.forEach((result) => {
    if (result.status === 'rejected') {
      logger.warn('[Feedback] Failed to send in-app escalation to superadmin:', result.reason);
    }
  });
  if (successCount === 0) {
    return {
      status: 'failed',
      attemptedAt,
      detail: 'Failed to send in-app escalation to all superadmin recipients',
      recipientCount: recipients.length,
    };
  }
  return {
    status: 'sent',
    attemptedAt,
    detail:
      successCount === recipients.length
        ? 'Delivered to all superadmin recipients'
        : `Delivered to ${successCount}/${recipients.length} superadmin recipients`,
    recipientCount: successCount,
  };
}

async function dispatchFeedbackEscalation(input: {
  kind: FeedbackEscalationKind;
  id: string;
  organizationId?: string | null;
  appEnv: string;
  channels: FeedbackAlertChannel[];
  feedbackType: 'BUG' | 'IDEA' | 'FEATURE' | 'PULSE';
  severity?: string | null;
  priority?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  routePath?: string | null;
  deviceType?: string | null;
  screenSize?: string | null;
  uiLanguage?: string | null;
  uiTheme?: string | null;
  title: string;
  message: string;
  taskId?: string | null;
  rating?: number | null;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<FeedbackAlertDispatchSummary> {
  const uniqueChannels = Array.from(new Set(input.channels));
  const attemptedAt = new Date().toISOString();
  const dispatchSummary: FeedbackAlertDispatchSummary = {
    attemptedAt,
    appEnv: input.appEnv,
    requestedChannels: uniqueChannels,
    results: {},
  };
  const notificationSeverity: 'INFO' | 'WARNING' | 'CRITICAL' =
    input.kind === 'feature'
      ? 'INFO'
      : input.kind === 'pulse'
        ? (input.rating || 0) <= 2
          ? 'WARNING'
          : 'INFO'
        : input.severity === 'CRITICAL'
          ? 'CRITICAL'
          : input.severity === 'HIGH'
            ? 'WARNING'
            : 'INFO';
  // Deep-link Superadmin signals straight to the feedback/feature module
  // with the item id as a query param. The feedback view reads `feedbackId`
  // on mount and auto-opens the detail drawer.
  const actionUrl =
    input.kind === 'feature'
      ? `/superadmin/customers/feedback?feedbackId=${encodeURIComponent(input.id)}&tab=features`
      : `/superadmin/customers/feedback?feedbackId=${encodeURIComponent(input.id)}`;
  const body = buildNotificationBody(input.message, [
    input.routePath ? `Route: ${input.routePath}` : '',
    input.taskId ? `Task: ${input.taskId}` : '',
    input.rating ? `Pulse: ${input.rating}/5` : '',
  ]);

  if (uniqueChannels.includes('in_app')) {
    try {
      dispatchSummary.results.in_app = await notifySuperAdminsInApp({
        type:
          input.kind === 'feature'
            ? 'FEATURE_REQUEST'
            : input.kind === 'pulse'
              ? 'LOW_PULSE_ALERT'
              : input.feedbackType === 'BUG' && input.severity === 'CRITICAL'
                ? 'CLIENT_TICKET'
                : 'USER_FEEDBACK',
        severity: notificationSeverity,
        title:
          input.kind === 'feature'
            ? `New Feature Request: ${input.title}`
            : input.kind === 'pulse'
              ? `Low Pulse Rating: ${input.rating || 0}/5`
              : `${input.feedbackType}${input.severity ? ` [${input.severity}]` : ''}: ${input.title}`,
        body,
        relatedObjectType:
          input.kind === 'feature' ? 'FEATURE' : input.kind === 'pulse' ? 'PULSE' : 'FEEDBACK',
        relatedObjectId: input.id,
        organizationId: input.organizationId || 'system',
        actionUrl,
        metadata: {
          ...(input.metadata || {}),
          appEnv: input.appEnv,
          feedbackType: input.feedbackType,
          severity: input.severity || undefined,
          linkedTaskId: input.taskId || undefined,
        },
      });
    } catch (error) {
      logger.error('[Feedback] Failed in-app escalation:', error);
      dispatchSummary.results.in_app = {
        status: 'failed',
        attemptedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Unified Slack posting — SAME pipeline regardless of where the report
  // originated (Piotr: "całą tę historię zgłoszeń [chcę] dostawać bezpośrednio
  // na Slacka", not just the ones reported FROM Slack). Slack-sourced tickets
  // are already posted + anchored by the inbound handler (slackInbound.routes.ts,
  // before escalation runs) → skip here to avoid a duplicate post. Every OTHER
  // origin (in-app FeedbackSidePanel widget, API) posts through the same
  // router+headline+blocks format used for Slack-sourced tickets, and gets the
  // SAME thread anchor — so later status/workflow/response updates
  // (notifySlackThread) reply into that thread exactly like a Slack-origin ticket.
  const isSlackSourced =
    (input.metadata as { source?: unknown } | undefined)?.source === 'slack';
  if (uniqueChannels.includes('slack') && isSlackSourced) {
    dispatchSummary.results.slack = {
      status: 'skipped',
      attemptedAt: new Date().toISOString(),
      detail: 'source=slack — posted via slackRouter (inbound), avoiding duplicate',
    };
  } else if (uniqueChannels.includes('slack')) {
    try {
      const categoryLabel =
        input.feedbackType === 'BUG'
          ? 'Błąd'
          : input.feedbackType === 'FEATURE'
            ? 'Funkcja'
            : input.feedbackType === 'PULSE'
              ? 'Ocena'
              : 'Pomysł';
      const priorityLabel =
        input.severity && input.severity.toUpperCase() !== 'MEDIUM'
          ? input.severity.toUpperCase()
          : undefined;
      const appUrl =
        process.env.APP_URL ||
        process.env.FRONTEND_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
        'http://localhost:5173';
      const contextParts: string[] = [];
      if (input.userName || input.userEmail) {
        contextParts.push(`zgłosił(a): ${input.userName || input.userEmail}`);
      }
      if (input.routePath) contextParts.push(`strona: ${input.routePath}`);
      const detailLines = [
        body,
        contextParts.length > 0 ? contextParts.join(' · ') : undefined,
        `<${appUrl}/superadmin/customers/feedback?feedbackId=${encodeURIComponent(input.id)}|Otwórz w Super Adminie>`,
      ].filter(Boolean);

      const routed = await routeToSlack({
        channel: 'feedback',
        severity: notificationSeverity,
        category: categoryLabel,
        priorityLabel,
        title: input.title,
        text: detailLines.join('\n'),
      });

      if (routed.ok && routed.ts) {
        await anchorSlackThread(input.id, routed.channelId, routed.ts);
      }

      dispatchSummary.results.slack = {
        status: routed.ok ? 'sent' : 'failed',
        attemptedAt: new Date().toISOString(),
        detail: routed.ok ? undefined : `transport=${routed.transport}`,
      };
    } catch (error) {
      logger.error('[Feedback] Failed Slack escalation:', error);
      dispatchSummary.results.slack = {
        status: 'failed',
        attemptedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (uniqueChannels.includes('email')) {
    try {
      const alertEmailService = getAlertEmailService();
      const emailSeverity: 'critical' | 'warning' | 'info' =
        notificationSeverity === 'CRITICAL'
          ? 'critical'
          : notificationSeverity === 'WARNING'
            ? 'warning'
            : 'info';
      const emailPayload = {
        alertType: `feedback_${input.kind}`,
        severity: emailSeverity,
        title:
          input.kind === 'pulse'
            ? `Low Pulse Rating ${input.rating || 0}/5`
            : `${input.feedbackType}${input.severity ? ` ${input.severity}` : ''}: ${input.title}`,
        message: body,
        timestamp: new Date().toISOString(),
        environment: input.appEnv,
        data: {
          routePath: input.routePath || undefined,
          organizationId: input.organizationId || undefined,
          feedbackId: input.id,
          taskId: input.taskId || undefined,
          userEmail: input.userEmail || undefined,
        },
      };
      if (notificationSeverity === 'CRITICAL') {
        await alertEmailService.sendCriticalAlert(emailPayload);
      } else {
        await alertEmailService.sendAlert(emailPayload);
      }
      dispatchSummary.results.email = {
        status: 'sent',
        attemptedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[Feedback] Failed email escalation:', error);
      dispatchSummary.results.email = {
        status: 'failed',
        attemptedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (uniqueChannels.includes('whatsapp')) {
    try {
      await WhatsAppService.sendNewFeedbackAlert({
        userId: input.userId || null,
        userEmail: input.userEmail || null,
        type: input.feedbackType,
        message: body,
      });
      dispatchSummary.results.whatsapp = {
        status: 'sent',
        attemptedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[Feedback] Failed WhatsApp escalation:', error);
      dispatchSummary.results.whatsapp = {
        status: 'failed',
        attemptedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return dispatchSummary;
}

/**
 * POST /api/feedback/compose
 * LLM-assisted, task-grade report composition.
 */
router.post(
  '/compose',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { type, title, message, severity, appEnv, context } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_COMPOSE_MESSAGE_REQUIRED',
            'Message is required.'
          )
        );
    }

    // Provider check (same approach as /api/ai/refine-text)
    const hasEnvProvider = !!String(process.env.OPENROUTER_API_KEY || '').trim();
    const hasDbProvider = !!(await dbGet(
      `SELECT 1 AS ok
       FROM llm_providers
       WHERE is_active = 1 AND provider = 'openrouter' AND api_key IS NOT NULL AND api_key != ''
       LIMIT 1`
    ));
    if (!hasEnvProvider && !hasDbProvider) {
      return res.status(500).json({
        ...buildFailClosedFeedbackError(
          req,
          500,
          'FEEDBACK_COMPOSE_NO_LLM_PROVIDER',
          'Compose service is temporarily unavailable.'
        ),
      });
    }

    const orgId = (req as any).organizationId || (req as any).user?.organizationId;

    // Access policy
    const AccessPolicyService = (await import('../services/accessPolicyService.js')).default as any;
    const aiAccessCheck = await AccessPolicyService.checkAccess(orgId, 'ai_call');
    if (!aiAccessCheck.allowed) {
      return res
        .status(403)
        .json(
          buildFailClosedFeedbackError(
            req,
            403,
            'FEEDBACK_COMPOSE_ACCESS_DENIED',
            'Compose access is denied.'
          )
        );
    }

    AccessPolicyService.incrementUsage(orgId, 'ai_calls', 1).catch((err: any) => {
      logger.warn('[FeedbackCompose] Failed to increment ai_calls usage:', err?.message || err);
    });

    const env = String(appEnv || process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
    const ctx = context && typeof context === 'object' ? context : {};

    const systemInstruction = `You are a senior product engineer writing actionable internal tickets.
Return ONLY JSON matching the schema. No markdown.

Rules:
- Keep language consistent with input.
- If information is missing, ask questions in questionsToClarify.
- For IDEAs, focus on user need + outcome instead of steps.
- Title must be short and specific.
`;

    const userPrompt = [
      `Type: ${String(type || 'BUG').toUpperCase()}`,
      severity ? `Severity: ${String(severity)}` : '',
      env ? `Env: ${env}` : '',
      (ctx as any)?.routePath ? `Route: ${(ctx as any).routePath}` : '',
      (ctx as any)?.moduleName ? `Module: ${(ctx as any).moduleName}` : '',
      title ? `User-provided title: ${title}` : '',
      '',
      'User message:',
      message,
    ]
      .filter(Boolean)
      .join('\n');

    const { llmService } = await import('../services/ai/llmService.js');

    const ComposeSchema = z.object({
      // NOTE: OpenAI's strict response_format schema requires `required` to include every key
      // in `properties`. Zod optional fields can produce an invalid schema.
      // We keep fields required but allow empty values; the handler normalizes empties to undefined.
      title: z.string(),
      summary: z.string(),
      steps: z.array(z.string()),
      expected: z.string(),
      actual: z.string(),
      impact: z.string(),
      isLikelyBug: z.boolean(),
      questionsToClarify: z.array(z.string()),
    });

    let result: unknown = null;
    try {
      result = await llmService.call({
        type: 'structured',
        modelConfig: { id: 'budget' },
        systemPrompt: systemInstruction,
        messages: [{ role: 'user', content: userPrompt }],
        schema: ComposeSchema,
        maxTokens: 700,
        temperature: 0.2,
        cache: false,
      });
    } catch (error) {
      logger.error('[FeedbackCompose] LLM call failed:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_COMPOSE_FAILED',
            'Failed to compose feedback draft.'
          )
        );
    }

    const parsed = (result as any)?.object || null;
    if (!parsed) {
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_COMPOSE_LLM_EMPTY',
            'Failed to compose feedback draft.'
          )
        );
    }

    return res.json({
      success: true,
      data: {
        title: String(parsed.title || '').trim() || undefined,
        summary: String(parsed.summary || '').trim() || undefined,
        steps:
          Array.isArray(parsed.steps) && parsed.steps.length > 0
            ? parsed.steps.map(String)
            : undefined,
        expected: String(parsed.expected || '').trim() || undefined,
        actual: String(parsed.actual || '').trim() || undefined,
        impact: String(parsed.impact || '').trim() || undefined,
        isLikelyBug: typeof parsed.isLikelyBug === 'boolean' ? parsed.isLikelyBug : undefined,
        questionsToClarify:
          Array.isArray(parsed.questionsToClarify) && parsed.questionsToClarify.length > 0
            ? parsed.questionsToClarify.map(String)
            : [],
      },
    });
  })
);

async function createTaskForFeedback(params: {
  organizationId: string;
  userId?: string | null;
  title: string;
  description: string;
  priority: TicketPriority;
  feedbackId: string;
  appEnv: string;
}): Promise<string> {
  const cols = await getTableColumns('tasks');
  const id = uuidv4();
  const now = new Date().toISOString();

  // Owner: prefer org owner, fallback to reporter/user.
  let ownerId: string | null = params.userId || null;
  try {
    if (cols.has('owner_id')) {
      const org = await dbGet<{ owner_id?: string }>(
        `SELECT owner_id FROM organizations WHERE id = ?`,
        [params.organizationId]
      );
      ownerId = (org?.owner_id as string) || ownerId;
    }
  } catch {
    // ignore
  }

  const tags = [`feedback:${params.feedbackId}`, `env:${params.appEnv}`];

  const insertCols: string[] = ['id', 'organization_id', 'title', 'description'];
  const values: unknown[] = [id, params.organizationId, params.title, params.description];

  const optional: Array<[string, unknown]> = [
    ['status', 'todo'],
    ['priority', params.priority],
    ['reporter_id', params.userId || null],
    ['owner_id', ownerId],
    ['source', 'feedback'],
    ['tags', JSON.stringify(tags)],
    ['created_at', now],
    ['updated_at', now],
  ];

  for (const [col, val] of optional) {
    if (cols.has(col)) {
      insertCols.push(col);
      values.push(val);
    }
  }

  const placeholders = insertCols.map(() => '?').join(', ');
  const sql = `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${placeholders})`;
  const runResult = await dbRun(sql, values);
  if (!runResult.success) {
    throw new Error(runResult.error || 'Failed to create task from feedback');
  }
  return id;
}

/** Validated feedback payload (mirror of `reportFeedbackSchema` output). */
export type FeedbackIntakeInput = z.infer<typeof reportFeedbackSchema>;

/**
 * Actor / request context for a feedback intake. When the caller has a JWT
 * (in-app widget), `reqUser` carries the resolved actor. Slack (F2) has no JWT,
 * so it passes an already-resolved actor via `userId`/`userEmail`/`userName`
 * inside the payload and leaves `reqUser` undefined.
 */
export interface FeedbackIntakeContext {
  reqUser?: AuthRequest['user'];
}

export interface FeedbackIntakeResult {
  feedbackId: string;
  taskId: string | null;
  priority: TicketPriority;
  metadataJson: Record<string, unknown>;
  appEnv: string;
  organizationId: string | null;
  /**
   * Best-effort notification fan-out (Slack/email/WhatsApp) runs detached so
   * the HTTP response is not blocked. Awaitable for tests / callers that need
   * to be sure the dispatch metadata was persisted before continuing.
   */
  escalationPromise: Promise<void>;
}

/**
 * Core feedback intake — the SINGLE source of truth for turning a validated
 * feedback payload into a `feedback_items` row + auto-task + escalation.
 *
 * Extracted from the `POST /api/feedback` handler so that the Slack Command
 * Center inbound (F2, `slackInbound.routes.ts`) reuses EXACTLY the same
 * pipeline (feedback_items -> createTaskForFeedback -> dispatchFeedbackEscalation)
 * instead of copy-pasting ~300 lines or calling the HTTP endpoint on itself.
 * The HTTP route below is now a thin wrapper: validate -> call -> respond, so
 * its externally observable behaviour is unchanged.
 */
export async function createFeedbackInternal(
  data: FeedbackIntakeInput,
  ctx: FeedbackIntakeContext = {}
): Promise<FeedbackIntakeResult> {
  await ensureFeedbackSchema();
  const {
    userId,
    userEmail,
    userName,
    type,
    message,
    severity,
    metadata,
    title: parsedTitle,
    description: parsedDescription,
    routePath,
    deviceType,
    screenSize,
    uiLanguage,
    uiTheme,
    workspaceContext,
    clientEnv,
    signatureHash,
    appContext,
    consoleLogs,
    networkErrors,
    breadcrumbs,
    lastUncaughtError,
    screenshot,
  } = data;
  const reqUser = ctx.reqUser;
  // Fix (F2 extraction): appEnv was resolved in the old route handler scope and
  // the reference survived the createFeedbackInternal extraction without its
  // definition → ReferenceError "appEnv is not defined" on every intake.
  const appEnv = getAppEnv();

  const { actualUserId, actualUserEmail, actualUserName } = resolveFeedbackActor({
      reqUser,
      userId,
      userEmail,
      userName,
    });

    // Resolve organizationId when possible
    let organizationId: string | null = null;
    try {
      if ((reqUser as any)?.organizationId) {
        organizationId = String((reqUser as any).organizationId);
      } else if (actualUserId) {
        const userRow = await dbGet<{ organization_id?: string }>(
          `SELECT organization_id FROM users WHERE id = ?`,
          [actualUserId]
        );
        if (userRow?.organization_id) organizationId = String(userRow.organization_id);
      }
    } catch {
      // ignore
    }

    const orgIdForNotifications = String(organizationId || 'system');
    const ticketOrgId: string | null = organizationId ? String(organizationId) : null;

    // Canonical: create ticket in feedback_items
    const feedbackCols = await getTableColumns('feedback_items');
    const feedbackId = uuidv4();

    const rawTitle = String(parsedTitle || '').trim();
    const inferredTitle =
      rawTitle ||
      String(message)
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean)[0] ||
      String(message).slice(0, 80);
    const title = inferredTitle.length > 120 ? inferredTitle.slice(0, 120) + '…' : inferredTitle;
    const description = String(parsedDescription || message || '').trim();

    const contextFields = [
      'routePath',
      'deviceType',
      'screenSize',
      'uiLanguage',
      'uiTheme',
      'workspaceContext',
    ];
    const contextMeta: Record<string, unknown> = {};
    const contextSources: Record<string, unknown> = {
      routePath,
      deviceType,
      screenSize,
      uiLanguage,
      uiTheme,
      workspaceContext,
    };
    for (const field of contextFields) {
      if (contextSources[field] !== undefined) contextMeta[field] = contextSources[field];
    }

    const dossier: Record<string, unknown> = {};
    if (signatureHash) dossier.signatureHash = signatureHash;
    if (appContext && typeof appContext === 'object') dossier.appContext = appContext;
    if (Array.isArray(consoleLogs) && consoleLogs.length > 0) dossier.consoleLogs = consoleLogs;
    if (Array.isArray(networkErrors) && networkErrors.length > 0) {
      dossier.networkErrors = networkErrors;
    }
    if (Array.isArray(breadcrumbs) && breadcrumbs.length > 0) dossier.breadcrumbs = breadcrumbs;
    if (lastUncaughtError && typeof lastUncaughtError === 'object') {
      dossier.lastUncaughtError = lastUncaughtError;
    }

    let workflowSeed: Record<string, unknown> | undefined;
    try {
      const cluster = inferFeedbackCluster(routePath || null);
      if (cluster) workflowSeed = { cluster };
    } catch (err) {
      logger.warn('[Feedback] inferCluster failed:', err);
    }

    let duplicateOf: string | null = null;
    let duplicateCandidates: Array<{ id: string; title: string | null }> = [];
    if (signatureHash) {
      try {
        duplicateCandidates = await findFeedbackDuplicates(signatureHash, 5);
        if (duplicateCandidates.length > 0) {
          duplicateOf = duplicateCandidates[0].id;
        }
      } catch (err) {
        logger.warn('[Feedback] findDuplicateCandidates failed:', err);
      }
    }

    const basePriority = priorityFromEnvAndSeverity({ appEnv, severity, type });
    let priority: TicketPriority = basePriority;
    try {
      priority = inferFeedbackPriority({
        basePriority,
        appEnv,
        type,
        severity: severity || null,
        hasUncaughtError: Boolean(lastUncaughtError),
        duplicateCount: duplicateCandidates.length,
      });
    } catch (err) {
      logger.warn('[Feedback] inferPriority failed:', err);
    }
    const status: TicketStatus = 'NEW';

    // F5 (SLA): response deadline from severity (fallback priority), stamped at
    // intake. Persisted to the due_at column when present AND mirrored into
    // metadata so engines/rows without the column still carry the deadline.
    const slaDueAt = computeSlaDueAtIso(severity || null, priority, Date.now());

    let metadataJson: Record<string, unknown> = {
      ...(metadata || {}),
      sla_due_at: slaDueAt,
      ...contextMeta,
      appEnv,
      clientEnv: clientEnv || undefined,
      userEmail: actualUserEmail || undefined,
      userName: actualUserName || undefined,
      feedbackType: type,
      severity: severity || undefined,
      title,
      ...(Object.keys(dossier).length > 0 ? { dossier } : {}),
      ...(signatureHash ? { signatureHash } : {}),
      ...(duplicateOf ? { duplicateOf } : {}),
      ...(duplicateCandidates.length > 0 ? { duplicateCandidates } : {}),
      ...(workflowSeed ? { workflow: workflowSeed } : {}),
    };

    const insertCols: string[] = [
      'id',
      'organization_id',
      'user_id',
      'feedback_type',
      'title',
      'description',
    ];
    const values: unknown[] = [
      feedbackId,
      ticketOrgId,
      actualUserId,
      String(type).toUpperCase(),
      title,
      description,
    ];

    const optional: Array<[string, unknown]> = [
      ['priority', priority],
      ['status', status],
      ['metadata_json', JSON.stringify(metadataJson)],
      ['severity', severity || null],
      ['source_env', appEnv],
      // V2.1 additive columns. Only the cluster seed is known at creation
      // time; owner / deploy_status land once a human (or Cursor) PATCHes
      // the workflow.
      ['cluster', (workflowSeed?.cluster as string | undefined) || null],
      // F5 (SLA): response deadline, so the overdue sweep can query it directly.
      ['due_at', slaDueAt],
    ];

    for (const [col, val] of optional) {
      if (feedbackCols.has(col)) {
        insertCols.push(col);
        values.push(val);
      }
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    const sql = `INSERT INTO feedback_items (${insertCols.join(', ')}) VALUES (${placeholders})`;
    const insertResult = await dbRun(sql, values);
    if (!insertResult.success) {
      throw new Error(insertResult.error || 'Failed to insert feedback ticket');
    }

    // Persist screenshot as a filesystem artefact (Railway volume / local /tmp).
    if (screenshot && typeof screenshot.dataUrl === 'string') {
      try {
        const saved = await saveScreenshotFromDataUrl(feedbackId, screenshot.dataUrl, {
          width: screenshot.width,
          height: screenshot.height,
        });
        if (saved) {
          const artifacts = Array.isArray((metadataJson as any).artifacts)
            ? ((metadataJson as any).artifacts as unknown[])
            : [];
          metadataJson = {
            ...metadataJson,
            artifacts: [...artifacts, saved],
          };
          if (feedbackCols.has('metadata_json')) {
            await dbRun(`UPDATE feedback_items SET metadata_json = ? WHERE id = ?`, [
              JSON.stringify(metadataJson),
              feedbackId,
            ]);
          }
        }
      } catch (err) {
        logger.warn('[Feedback] Failed to store screenshot artifact:', err);
      }
    }

    // Auto-create backlog task for every ticket
    let linkedTaskId: string | null = null;
    try {
      if (!ticketOrgId) {
        throw new Error('No organizationId resolved for ticket; skipping auto-task');
      }
      const taskTitle = `[${appEnv.toUpperCase()}] ${String(type).toUpperCase()}: ${title}`;
      const taskDescription =
        `${description}\n\n` +
        `---\n` +
        `Ticket: ${feedbackId}\n` +
        `Env: ${appEnv}\n` +
        `Route: ${String((metadataJson as any)?.routePath || '')}\n` +
        `User: ${userEmail || userName || userId || 'anonymous'}\n`;

      linkedTaskId = await createTaskForFeedback({
        organizationId: ticketOrgId,
        userId: actualUserId,
        title: taskTitle,
        description: taskDescription,
        priority,
        feedbackId,
        appEnv,
      });

      if (feedbackCols.has('linked_task_id') || feedbackCols.has('metadata_json')) {
        const updateCols: string[] = [];
        const updateVals: unknown[] = [];
        const nextMeta = { ...metadataJson, linkedTaskId };

        if (feedbackCols.has('linked_task_id')) {
          updateCols.push('linked_task_id = ?');
          updateVals.push(linkedTaskId);
        }
        if (feedbackCols.has('metadata_json')) {
          updateCols.push('metadata_json = ?');
          updateVals.push(JSON.stringify(nextMeta));
        }
        if (feedbackCols.has('updated_at')) {
          updateCols.push('updated_at = CURRENT_TIMESTAMP');
        }

        if (updateCols.length > 0) {
          await dbRun(`UPDATE feedback_items SET ${updateCols.join(', ')} WHERE id = ?`, [
            ...updateVals,
            feedbackId,
          ]);
        }
        metadataJson = nextMeta;
      }
    } catch (e) {
      logger.warn('[Feedback] Failed to auto-create task from feedback:', e);
    }

    // Feedback #0e1e7dec — escalation previously ran inline and awaited
    // Slack / email / WhatsApp network calls before sending the HTTP
    // response. HIGH/CRITICAL severities add email + WhatsApp channels on
    // top of in-app + Slack, which turned the user-visible "Submit feedback"
    // latency from ~200ms to multi-seconds compared to MEDIUM/LOW tickets.
    // The ticket is already persisted at this point and the task is linked —
    // the only thing remaining is best-effort notification fan-out, which is
    // safe to run in the background. We fire-and-forget and keep persisting
    // the dispatch status asynchronously so the audit trail survives.
    const escalationSnapshot = {
      metadata: { ...metadataJson },
      priority,
      linkedTaskId,
    };
    const escalationPromise = (async () => {
      try {
        const alertDispatch = await dispatchFeedbackEscalation({
          kind: 'feedback',
          id: feedbackId,
          organizationId: orgIdForNotifications,
          appEnv,
          channels: resolveEscalationChannels({
            kind: 'feedback',
            feedbackType: type,
            severity,
          }),
          feedbackType: type,
          severity: severity || 'MEDIUM',
          priority: escalationSnapshot.priority,
          userId: actualUserId,
          userEmail: actualUserEmail,
          userName: actualUserName,
          routePath: routePath || null,
          deviceType: deviceType || null,
          screenSize: screenSize || null,
          uiLanguage: uiLanguage || null,
          uiTheme: uiTheme || null,
          title,
          message: description,
          taskId: escalationSnapshot.linkedTaskId,
          metadata: escalationSnapshot.metadata,
        });
        // Atomic per-key write — must NOT clobber slack_thread_ts/source that a
        // concurrent Slack anchor may have written after this snapshot was taken.
        await updateFeedbackMetadataKey(feedbackId, 'alertDispatch', alertDispatch);
      } catch (dispatchErr) {
        logger.error('[Feedback] Failed to dispatch escalation:', dispatchErr);
      }
    })();
    // Attach a swallow-only handler so Node never logs "unhandledRejection"
    // for the detached promise — the inner try/catch already reports via
    // `logger.error`.
    escalationPromise.catch(() => {});

    return {
      feedbackId,
      taskId: linkedTaskId,
      priority,
      metadataJson,
      appEnv,
      organizationId,
      escalationPromise,
    };
}

/**
 * POST /api/feedback
 * Submit new feedback
 */
router.post(
  '/',
  optionalVerifyToken,
  apiAuthRateLimiter,
  feedbackRateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = reportFeedbackSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid feedback payload',
        details: parsed.error.flatten(),
      });
    }

    const result = await createFeedbackInternal(parsed.data, { reqUser: req.user });

    return res.json({ success: true, id: result.feedbackId, taskId: result.taskId });
  })
);

// Types + pure helpers (normalize/shape) now live in
// `../services/feedbackShape.ts` — imported at the top of the file. This keeps
// the route module lean and makes the shaping logic unit-testable without
// touching Express.

/**
 * GET /api/feedback
 * List all feedback (Admin only)
 */
router.get(
  '/',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeedbackSchema();

    // Historically this endpoint hard-capped at LIMIT 200 with no paging,
    // which silently hid older tickets once the queue grew past that mark
    // (reported as "where did all my feedback go?" in V2.1 smoke tests).
    // We now accept explicit ?limit / ?offset, default to 1000 so most
    // installations see everything in one shot, and always report the
    // real backing count via X-Total-Count so the UI can surface it.
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 1000, 1),
      5000
    );
    const offset = Math.max(Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0, 0);

    try {
      const totalRow = await dbGet<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM feedback_items`,
        []
      ).catch(async () =>
        // SQLite doesn't like `::int` — fall back to the untyped variant.
        dbGet<{ count: number }>(`SELECT COUNT(*) as count FROM feedback_items`, [])
      );
      const total = Number(totalRow?.count || 0);

      const rows = await dbAll<any>(
        `
        SELECT
          f.id,
          f.organization_id,
          f.user_id,
          u.email as user_email,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), f.user_id) as user_name,
          f.feedback_type as type,
          f.title,
          f.description as message,
          UPPER(COALESCE(NULLIF(f.status,''), 'NEW')) as status,
          f.priority,
          f.severity,
          f.source_env,
          f.linked_task_id,
          f.admin_response,
          f.responded_at,
          f.created_at,
          f.updated_at,
          f.metadata_json as metadata
        FROM feedback_items f
        LEFT JOIN users u ON u.id = f.user_id
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
        `,
        [limit, offset]
      );

      const shaped = (rows || []).map((r: any) => shapeFeedbackRow(r));

      res.setHeader('X-Total-Count', String(total));
      res.setHeader('X-Page-Limit', String(limit));
      res.setHeader('X-Page-Offset', String(offset));
      return res.json(shaped);
    } catch (error) {
      logger.error('[Feedback] Failed to read feedback list:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_LIST_READ_FAILED',
            'Failed to read feedback list.'
          )
        );
    }
  })
);

/**
 * PATCH /api/feedback/:id/status
 * Update feedback status
 */
router.patch(
  '/:id/status',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, note } = req.body;
    const { id } = req.params;
    const changedBy = (req as any).user?.id || req.body.userId || null;

    if (!isUuidLike(id)) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_STATUS_FEEDBACK_ID_INVALID',
            'Feedback id must be a valid UUID.'
          )
        );
    }

    const validStatuses = ['NEW', 'PENDING', 'IN_PROGRESS', 'REVIEWED', 'RESOLVED', 'ARCHIVED'];
    if (typeof status !== 'string' || !validStatuses.includes(status.toUpperCase())) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_STATUS_VALUE_INVALID',
            'Status value is invalid.'
          )
        );
    }

    const current = await dbGet<{
      status: string;
      metadata_json?: string | null;
      user_id?: string | null;
      title?: string | null;
    }>(`SELECT status, metadata_json, user_id, title FROM feedback_items WHERE id = ?`, [id]);
    const fromStatus = current?.status || null;

    const sql = `UPDATE feedback_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const runResult = await dbRun(sql, [status.toUpperCase(), id]);

    if (!runResult.success) {
      logger.error('[Feedback] Failed to update feedback status:', runResult.error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_STATUS_UPDATE_FAILED',
            'Failed to update feedback status.'
          )
        );
    }

    // Record status change in feedback_items history (if table exists)
    try {
      const { v4: histUuid } = await import('uuid');
      await dbRun(
        `INSERT INTO feedback_items_status_history (id, feedback_id, from_status, to_status, changed_by, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [histUuid(), id, fromStatus, status.toUpperCase(), changedBy, note || null]
      );
    } catch {
      /* History table may not exist yet */
    }

    // F3: reply the status change into the ticket's Slack thread (Slack-sourced
    // tickets only). Fire-and-forget, fail-soft.
    {
      const from = (fromStatus || 'NEW').toUpperCase();
      const to = status.toUpperCase();
      const metaSnapshot = current?.metadata_json ?? null;
      void (async () => {
        const actor = await resolveActorLabel((req as any).user);
        await notifySlackThread(
          { metadata_json: metaSnapshot },
          `🔧 Status: ${from} → ${to} · zmienił(a): ${actor}${note ? `\n_${String(note).slice(0, 200)}_` : ''}`
        );
      })();
    }

    // Close the loop with the REPORTER in-app: a status move (esp. → RESOLVED)
    // is the user-facing signal that their report was acted on. Skip trivial
    // no-ops, self-changes, and internal-only states (NEW/ARCHIVED) to avoid noise.
    {
      const to = status.toUpperCase();
      const from = (fromStatus || 'NEW').toUpperCase();
      const reporterId = current?.user_id || null;
      const userFacingStatuses = new Set(['PENDING', 'IN_PROGRESS', 'REVIEWED', 'RESOLVED']);
      if (reporterId && reporterId !== changedBy && to !== from && userFacingStatuses.has(to)) {
        const statusPl: Record<string, string> = {
          PENDING: 'Oczekuje',
          IN_PROGRESS: 'W realizacji',
          REVIEWED: 'Przejrzane',
          RESOLVED: 'Rozwiązane',
        };
        const label = statusPl[to] || to;
        const ticketTitle = String(current?.title || 'Twoje zgłoszenie').slice(0, 120);
        void NotificationService.send({
          userId: reporterId,
          organizationId: 'system',
          type: 'FEEDBACK_STATUS',
          severity: 'INFO',
          title:
            to === 'RESOLVED'
              ? `Rozwiązano Twoje zgłoszenie: ${ticketTitle}`
              : `Status Twojego zgłoszenia: ${label}`,
          body: `„${ticketTitle}" — ${label}${note ? `: ${String(note).slice(0, 160)}` : ''}`,
          message: `„${ticketTitle}" — ${label}`,
          relatedObjectType: 'FEEDBACK',
          relatedObjectId: id,
          isActionable: false,
        }).catch((noteErr) => {
          logger.warn('[Feedback] status notification failed (non-fatal):', {
            error: noteErr instanceof Error ? noteErr.message : String(noteErr),
          });
        });
      }
    }

    return res.json({ success: true });
  })
);

/**
 * PATCH /api/feedback/:id/workflow
 * Update pipeline metadata (owner, cluster, delivery, resolution) for a feedback ticket.
 */
router.patch(
  '/:id/workflow',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const {
      owner,
      cluster,
      source,
      branch,
      prUrl,
      taskUrl,
      linkedTaskId,
      deployStatus,
      deployTargets,
      deployedAt,
      verifiedBy,
      verifiedAt,
      waitingOn,
      resolution,
      note,
    } = req.body || {};

    if (!isUuidLike(id)) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_WORKFLOW_FEEDBACK_ID_INVALID',
            'Feedback id must be a valid UUID.'
          )
        );
    }

    const row = await dbGet<{ metadata_json: string | null; linked_task_id?: string | null }>(
      `SELECT metadata_json, linked_task_id FROM feedback_items WHERE id = ?`,
      [id]
    );

    if (!row) {
      return res
        .status(404)
        .json(
          buildFailClosedFeedbackError(
            req,
            404,
            'FEEDBACK_WORKFLOW_NOT_FOUND',
            'Feedback was not found.'
          )
        );
    }

    const meta = safeJsonParse<Record<string, unknown>>(row.metadata_json, {});
    const currentWorkflow = normalizeWorkflowMeta(meta);
    const currentResolution = normalizeResolutionMeta(meta);
    const currentTimeline = normalizeWorkflowTimeline(meta);

    const nextWorkflow = compactObject({
      ...currentWorkflow,
      owner: owner !== undefined ? owner : currentWorkflow.owner,
      cluster: cluster !== undefined ? cluster : currentWorkflow.cluster,
      source: source !== undefined ? source : currentWorkflow.source,
      branch: branch !== undefined ? branch : currentWorkflow.branch,
      prUrl: prUrl !== undefined ? prUrl : currentWorkflow.prUrl,
      taskUrl: taskUrl !== undefined ? taskUrl : currentWorkflow.taskUrl,
      linkedTaskId:
        linkedTaskId !== undefined
          ? linkedTaskId
          : currentWorkflow.linkedTaskId || row.linked_task_id,
      deployStatus: deployStatus !== undefined ? deployStatus : currentWorkflow.deployStatus,
      deployTargets:
        deployTargets !== undefined
          ? normalizeStringArray(deployTargets)
          : currentWorkflow.deployTargets || [],
      deployedAt: deployedAt !== undefined ? deployedAt : currentWorkflow.deployedAt,
      verifiedBy: verifiedBy !== undefined ? verifiedBy : currentWorkflow.verifiedBy,
      verifiedAt: verifiedAt !== undefined ? verifiedAt : currentWorkflow.verifiedAt,
      waitingOn: waitingOn !== undefined ? waitingOn : currentWorkflow.waitingOn,
      lastUpdatedAt: new Date().toISOString(),
    }) as FeedbackWorkflowRecord;

    const nextResolution = compactObject({
      ...currentResolution,
      ...(resolution && typeof resolution === 'object' && !Array.isArray(resolution)
        ? {
            type: (resolution as any).type,
            summary: (resolution as any).summary,
            rootCause: (resolution as any).rootCause,
            verificationNotes: (resolution as any).verificationNotes,
            testPlan: normalizeStringArray((resolution as any).testPlan),
          }
        : {}),
    }) as FeedbackResolutionRecord;

    const changedFields = [
      owner !== undefined ? 'owner' : null,
      cluster !== undefined ? 'cluster' : null,
      source !== undefined ? 'source' : null,
      branch !== undefined ? 'branch' : null,
      prUrl !== undefined ? 'prUrl' : null,
      taskUrl !== undefined ? 'taskUrl' : null,
      linkedTaskId !== undefined ? 'linkedTaskId' : null,
      deployStatus !== undefined ? 'deployStatus' : null,
      deployTargets !== undefined ? 'deployTargets' : null,
      deployedAt !== undefined ? 'deployedAt' : null,
      verifiedBy !== undefined ? 'verifiedBy' : null,
      verifiedAt !== undefined ? 'verifiedAt' : null,
      waitingOn !== undefined ? 'waitingOn' : null,
      resolution !== undefined ? 'resolution' : null,
    ].filter(Boolean) as string[];

    const nextTimeline =
      changedFields.length > 0
        ? [
            ...currentTimeline,
            {
              id: uuidv4(),
              at: new Date().toISOString(),
              actor: (req as any).user?.email || (req as any).user?.id || null,
              action: 'workflow_updated',
              note: typeof note === 'string' ? note : null,
              changes: changedFields,
            } satisfies FeedbackWorkflowTimelineEntry,
          ].slice(-50)
        : currentTimeline;

    const nextMeta = {
      ...meta,
      workflow: nextWorkflow,
      resolution: nextResolution,
      workflowTimeline: nextTimeline,
      linkedTaskId: nextWorkflow.linkedTaskId || undefined,
    };

    const feedbackCols = await getTableColumns('feedback_items');
    const updateCols: string[] = [];
    const updateVals: unknown[] = [];
    if (feedbackCols.has('metadata_json')) {
      updateCols.push('metadata_json = ?');
      updateVals.push(JSON.stringify(nextMeta));
    }
    if (feedbackCols.has('linked_task_id') && linkedTaskId !== undefined) {
      updateCols.push('linked_task_id = ?');
      updateVals.push(nextWorkflow.linkedTaskId || null);
    }
    // Write-through for the V2.1 additive workflow columns. We only write
    // when the field is actually being touched in this PATCH so we don't
    // clobber values set by another actor through the JSON blob.
    if (feedbackCols.has('owner') && owner !== undefined) {
      updateCols.push('owner = ?');
      updateVals.push(nextWorkflow.owner || null);
    }
    if (feedbackCols.has('cluster') && cluster !== undefined) {
      updateCols.push('cluster = ?');
      updateVals.push(nextWorkflow.cluster || null);
    }
    if (feedbackCols.has('deploy_status') && deployStatus !== undefined) {
      updateCols.push('deploy_status = ?');
      updateVals.push(nextWorkflow.deployStatus || null);
    }
    if (feedbackCols.has('workflow_updated_at') && changedFields.length > 0) {
      updateCols.push('workflow_updated_at = CURRENT_TIMESTAMP');
    }
    if (feedbackCols.has('updated_at')) {
      updateCols.push('updated_at = CURRENT_TIMESTAMP');
    }

    if (updateCols.length === 0) {
      return res.json({
        success: true,
        workflow: nextWorkflow,
        resolution: nextResolution,
        workflowTimeline: nextTimeline,
      });
    }

    const runResult = await dbRun(
      `UPDATE feedback_items SET ${updateCols.join(', ')} WHERE id = ?`,
      [...updateVals, id]
    );

    if (!runResult.success) {
      logger.error('[Feedback] Failed to update feedback workflow:', runResult.error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_WORKFLOW_UPDATE_FAILED',
            'Failed to update feedback workflow.'
          )
        );
    }

    // F3: reply the meaningful workflow changes into the Slack thread. Only the
    // fields Piotr tracks in the command center, and only when they changed.
    {
      const parts: string[] = [];
      if (owner !== undefined && nextWorkflow.owner) parts.push(`owner: ${nextWorkflow.owner}`);
      if (branch !== undefined && nextWorkflow.branch) parts.push(`branch: ${nextWorkflow.branch}`);
      if (prUrl !== undefined && nextWorkflow.prUrl) parts.push(`PR: ${nextWorkflow.prUrl}`);
      if (deployStatus !== undefined && nextWorkflow.deployStatus)
        parts.push(`deploy: ${nextWorkflow.deployStatus}`);
      if (resolution !== undefined && nextResolution.summary)
        parts.push(`rozwiązanie: ${String(nextResolution.summary).slice(0, 200)}`);
      if (parts.length > 0) {
        void notifySlackThread(
          { metadata_json: row.metadata_json },
          `⚙️ Workflow: ${parts.join(' · ')}`
        );
      }
    }

    return res.json({
      success: true,
      workflow: nextWorkflow,
      resolution: nextResolution,
      workflowTimeline: nextTimeline,
    });
  })
);

/**
 * POST /api/feedback/:id/respond
 * Admin response to feedback
 */
router.post(
  '/:id/respond',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { response } = req.body;
    const { id } = req.params;

    if (!isUuidLike(id)) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_RESPOND_FEEDBACK_ID_INVALID',
            'Feedback id must be a valid UUID.'
          )
        );
    }

    if (!response || !response.trim()) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_RESPOND_BODY_INVALID',
            'Response is required.'
          )
        );
    }

    const cols = await getTableColumns('feedback_items');
    const updateCols: string[] = [];
    const params: unknown[] = [];
    if (cols.has('admin_response')) {
      updateCols.push('admin_response = ?');
      params.push(response.trim());
    }
    if (cols.has('responded_at')) {
      updateCols.push('responded_at = CURRENT_TIMESTAMP');
    }
    if (cols.has('responded_by')) {
      updateCols.push('responded_by = ?');
      params.push((req as any).user?.id || null);
    }
    if (cols.has('status')) {
      updateCols.push(`status = 'REVIEWED'`);
    }
    if (cols.has('updated_at')) {
      updateCols.push('updated_at = CURRENT_TIMESTAMP');
    }

    const sql = `UPDATE feedback_items SET ${updateCols.join(', ')} WHERE id = ?`;
    const runResult = await dbRun(sql, [...params, id]);

    if (!runResult.success) {
      logger.error('[Feedback] Failed to save admin response:', runResult.error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_RESPOND_UPDATE_FAILED',
            'Failed to save feedback response.'
          )
        );
    }

    // Get the feedback to notify the user
    const feedback = await dbGet<{
      id: string;
      user_id: string | null;
      feedback_type: string;
      title: string;
      description: string;
      metadata_json: string | null;
      admin_response: string | null;
      responded_at: string | null;
      created_at: string;
      updated_at: string | null;
    }>('SELECT * FROM feedback_items WHERE id = ?', [id]);

    if (feedback && feedback.user_id) {
      try {
        await NotificationService.send({
          userId: feedback.user_id,
          organizationId: 'system',
          type: 'FEEDBACK_RESPONSE',
          severity: 'INFO',
          title: 'Odpowiedź na Twój feedback',
          body: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
          message: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
          relatedObjectType: 'FEEDBACK',
          relatedObjectId: id,
          isActionable: false,
        });
      } catch (noteErr) {
        logger.error('Failed to create response notification:', noteErr);
      }
    }

    // F3: mirror the team's reply into the Slack thread (Slack-sourced tickets).
    if (feedback) {
      const summary = String(response).slice(0, 200);
      void notifySlackThread(
        { metadata_json: feedback.metadata_json },
        `💬 Odpowiedź zespołu: ${summary}${String(response).length > 200 ? '…' : ''}`
      );
    }

    return res.json({ success: true });
  })
);

/**
 * GET /api/feedback/pulse-summary
 * Get pulse feedback analytics
 */
router.get(
  '/pulse-summary',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { period = '30d' } = req.query;

    try {
      const summary = await feedbackAIService.getPulseSummary(period as '7d' | '30d' | '90d');
      return res.json({ success: true, summary });
    } catch (error) {
      logger.error('[Pulse] Summary error:', error);
      return res.status(500).json({
        status: 'error',
        error: {
          code: 'FEEDBACK_PULSE_SUMMARY_READ_FAILED',
          message: 'Failed to read pulse summary.',
          timestamp: new Date().toISOString(),
        },
        correlationId:
          (req as AuthRequest & { correlationId?: string }).correlationId ||
          req.get('X-Correlation-ID') ||
          null,
      });
    }
  })
);

/**
 * GET /api/feedback/:id
 * Get single feedback item
 */
router.get(
  '/trending',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const trending = await feedbackAIService.getTrendingTopics();
      return res.json({ success: true, trending });
    } catch (error) {
      logger.error('[Trending] Error:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_TRENDING_READ_FAILED',
            'Failed to read trending feedback topics.'
          )
        );
    }
  })
);

router.get(
  '/:id',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (!isUuidLike(id)) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_ITEM_ID_INVALID',
            'Feedback id must be a valid UUID.'
          )
        );
    }

    let row: {
      id: string;
      user_id: string | null;
      user_email: string | null;
      user_name: string | null;
      feedback_type: string;
      title: string;
      description: string;
      status: string;
      priority?: string | null;
      severity?: string | null;
      source_env?: string | null;
      linked_task_id?: string | null;
      metadata_json: string | null;
      admin_response: string | null;
      responded_at: string | null;
      created_at: string;
      updated_at: string | null;
    } | null = null;

    try {
      row = await dbGet<{
        id: string;
        user_id: string | null;
        user_email: string | null;
        user_name: string | null;
        feedback_type: string;
        title: string;
        description: string;
        status: string;
        priority?: string | null;
        severity?: string | null;
        source_env?: string | null;
        linked_task_id?: string | null;
        metadata_json: string | null;
        admin_response: string | null;
        responded_at: string | null;
        created_at: string;
        updated_at: string | null;
      }>(
        `
        SELECT
          f.*,
          u.email as user_email,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), f.user_id) as user_name
        FROM feedback_items f
        LEFT JOIN users u ON u.id = f.user_id
        WHERE f.id = ?
      `,
        [id]
      );
    } catch (error) {
      logger.error('[Feedback] Failed to read feedback by id:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_ITEM_READ_FAILED',
            'Failed to read feedback item.'
          )
        );
    }

    if (!row) {
      return res
        .status(404)
        .json(
          buildFailClosedFeedbackError(
            req,
            404,
            'FEEDBACK_ITEM_NOT_FOUND',
            'Feedback item was not found.'
          )
        );
    }

    let statusHistory: unknown[] = [];
    try {
      statusHistory = await dbAll(
        `SELECT * FROM feedback_items_status_history WHERE feedback_id = ? ORDER BY created_at ASC`,
        [id]
      );
    } catch {
      /* Table may not exist */
    }

    const shaped = shapeFeedbackRow({
      ...row,
      metadata: (row as any).metadata_json,
    });
    return res.json({
      ...shaped,
      type: (row as any).feedback_type,
      message: (row as any).description,
      statusHistory,
    });
  })
);

/**
 * GET /api/feedback/stats/summary
 * Get feedback statistics
 */
router.get(
  '/stats/summary',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM feedback_items',
      new: "SELECT COUNT(*) as count FROM feedback_items WHERE UPPER(status) = 'NEW'",
      pending:
        "SELECT COUNT(*) as count FROM feedback_items WHERE UPPER(status) IN ('PENDING', 'IN_PROGRESS')",
      bugs: "SELECT COUNT(*) as count FROM feedback_items WHERE UPPER(feedback_type) = 'BUG' AND UPPER(status) != 'RESOLVED'",
    };

    const results: Record<string, number> = {};
    const promises = Object.entries(queries).map(async ([key, sql]) => {
      const row = await dbGet<{ avg?: number; count?: number }>(sql, []);
      results[key] = row?.count || 0;
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      logger.error('[Feedback] Failed to read stats summary:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_STATS_SUMMARY_READ_FAILED',
            'Failed to read feedback statistics.'
          )
        );
    }
    return res.json(results);
  })
);

/**
 * GET /api/feedback/analytics/overview
 * Aggregated KPIs for the feedback triage dashboard:
 *   - totals by status
 *   - open volume per env + per type + per severity
 *   - aging buckets (24h / 48h / 7d / >7d) for NEW
 *   - MTTR (median hours between created_at and resolved_at) over last 30d
 *   - re-open rate (tickets whose timeline contains status_reverted) last 30d
 * SuperAdmin only.
 */
router.get(
  '/analytics/overview',
  verifySuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureFeedbackSchema();
    const rows = await dbAll<any>(
      `
        SELECT id, feedback_type, status, severity, priority, source_env,
               created_at, updated_at, metadata_json
        FROM feedback_items
        ORDER BY created_at DESC
        LIMIT 5000
      `,
      []
    );

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const cutoff30d = now - 30 * day;

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byEnv: Record<string, number> = {};
    const agingBuckets = { under24h: 0, h24_48: 0, d2_7: 0, over7d: 0 };
    const resolutionDurationsHours: number[] = [];
    let reopenCount = 0;
    let totalLast30d = 0;

    for (const r of rows || []) {
      const status = String(r.status || '').toUpperCase() || 'NEW';
      byStatus[status] = (byStatus[status] || 0) + 1;

      const type = String(r.feedback_type || 'UNKNOWN').toUpperCase();
      byType[type] = (byType[type] || 0) + 1;

      const severity = String(r.severity || '').toUpperCase() || 'UNSPECIFIED';
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;

      const env = String(r.source_env || 'unknown').toLowerCase();
      byEnv[env] = (byEnv[env] || 0) + 1;

      const createdMs = r.created_at ? new Date(r.created_at).getTime() : NaN;
      if (Number.isFinite(createdMs) && createdMs >= cutoff30d) {
        totalLast30d++;
      }

      if (status === 'NEW' && Number.isFinite(createdMs)) {
        const age = now - createdMs;
        if (age < 24 * 60 * 60 * 1000) agingBuckets.under24h++;
        else if (age < 48 * 60 * 60 * 1000) agingBuckets.h24_48++;
        else if (age < 7 * 24 * 60 * 60 * 1000) agingBuckets.d2_7++;
        else agingBuckets.over7d++;
      }

      // Resolution time: derive from timeline (status changes → RESOLVED)
      const meta = safeJsonParse<Record<string, unknown>>(r.metadata_json, {});
      const timeline = Array.isArray((meta as any).workflowTimeline)
        ? ((meta as any).workflowTimeline as Array<{
            at?: string;
            action?: string;
            note?: string;
            changes?: string[];
          }>)
        : [];

      if (status === 'RESOLVED' && Number.isFinite(createdMs) && r.updated_at) {
        const resolvedMs = new Date(r.updated_at).getTime();
        if (Number.isFinite(resolvedMs) && resolvedMs >= cutoff30d) {
          const hours = (resolvedMs - createdMs) / (60 * 60 * 1000);
          if (hours >= 0 && hours < 24 * 365) resolutionDurationsHours.push(hours);
        }
      }

      const hasReopenEvent = timeline.some((entry) => {
        if (!entry) return false;
        const action = String(entry.action || '').toLowerCase();
        if (action.includes('reopen')) return true;
        const note = String(entry.note || '').toLowerCase();
        return note.includes('reopen');
      });
      if (hasReopenEvent && Number.isFinite(createdMs) && createdMs >= cutoff30d) {
        reopenCount++;
      }
    }

    const sortedDurations = resolutionDurationsHours.slice().sort((a, b) => a - b);
    const median =
      sortedDurations.length === 0
        ? null
        : sortedDurations.length % 2 === 1
          ? sortedDurations[(sortedDurations.length - 1) / 2]
          : (sortedDurations[sortedDurations.length / 2 - 1] +
              sortedDurations[sortedDurations.length / 2]) /
            2;
    const p90 =
      sortedDurations.length === 0
        ? null
        : sortedDurations[
            Math.min(sortedDurations.length - 1, Math.floor(sortedDurations.length * 0.9))
          ];

    const openCount = Object.entries(byStatus)
      .filter(([k]) => k !== 'RESOLVED' && k !== 'ARCHIVED')
      .reduce((sum, [, v]) => sum + v, 0);

    return res.json({
      sampleSize: rows?.length || 0,
      openCount,
      totals: {
        byStatus,
        byType,
        bySeverity,
        byEnv,
      },
      aging: agingBuckets,
      mttrLast30d: {
        medianHours: median,
        p90Hours: p90,
        sampleSize: resolutionDurationsHours.length,
      },
      last30d: {
        created: totalLast30d,
        reopened: reopenCount,
        reopenRatePct: totalLast30d > 0 ? Math.round((reopenCount / totalLast30d) * 1000) / 10 : 0,
      },
      generatedAt: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/feedback/backlog/tasks
 * List tasks created from feedback tickets (for SuperAdmin backlog).
 */
router.get(
  '/backlog/tasks',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);
    const taskCols = await getTableColumns('tasks');
    const selectCols = [
      'id',
      'organization_id',
      'title',
      'description',
      'status',
      'priority',
      'tags',
      taskCols.has('reporter_id') ? 'reporter_id' : 'NULL as reporter_id',
      taskCols.has('owner_id') ? 'owner_id' : 'NULL as owner_id',
      taskCols.has('assignee_id') ? 'assignee_id' : 'NULL as assignee_id',
      taskCols.has('assigned_to') ? 'assigned_to' : 'NULL as assigned_to',
      'created_at',
      taskCols.has('updated_at') ? 'updated_at' : 'NULL as updated_at',
    ];
    const rows = await dbAll<any>(
      `
        SELECT
          ${selectCols.join(', ')}
        FROM tasks
        WHERE CAST(tags AS TEXT) LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      ['%feedback:%', limit]
    );

    const shaped = (rows || []).map((r: any) => {
      const tags = safeJsonParse<string[]>(r.tags, []);
      const feedbackTag =
        tags.find((t) => typeof t === 'string' && t.startsWith('feedback:')) || null;
      return {
        ...r,
        tags,
        assigneeId: r.owner_id || r.assignee_id || r.assigned_to || null,
        feedbackId: feedbackTag ? String(feedbackTag).slice('feedback:'.length) : null,
      };
    });

    return res.json(shaped);
  })
);

/**
 * PATCH /api/feedback/backlog/tasks/:id
 * Update a feedback-created backlog task status/assignee and optionally add a note.
 */
router.patch(
  '/backlog/tasks/:id',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const status = req.body?.status !== undefined ? String(req.body.status).trim() : undefined;
    const assigneeId =
      req.body?.assigneeId !== undefined ? String(req.body.assigneeId || '').trim() : undefined;
    const comment = req.body?.comment !== undefined ? String(req.body.comment || '').trim() : '';

    if (!isUuidLike(id)) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    const allowedStatuses = new Set([
      'todo',
      'open',
      'in_progress',
      'review',
      'blocked',
      'done',
      'cancelled',
      'archived',
    ]);
    const normalizedStatus = status ? status.toLowerCase() : undefined;
    if (normalizedStatus && !allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid backlog task status' });
    }

    const taskCols = await getTableColumns('tasks');
    const task = await dbGet<any>(`SELECT id, tags FROM tasks WHERE id = ?`, [id]);
    if (!task) return res.status(404).json({ error: 'Backlog task not found' });

    const tags = safeJsonParse<string[]>(task.tags, []);
    if (!tags.some((tag) => typeof tag === 'string' && tag.startsWith('feedback:'))) {
      return res.status(400).json({ error: 'Task is not linked to feedback' });
    }

    const updateCols: string[] = [];
    const updateVals: unknown[] = [];
    if (normalizedStatus && taskCols.has('status')) {
      updateCols.push('status = ?');
      updateVals.push(normalizedStatus);
    }
    const assigneeColumn = ['owner_id', 'assignee_id', 'assigned_to'].find((col) =>
      taskCols.has(col)
    );
    if (assigneeId !== undefined && assigneeColumn) {
      updateCols.push(`${assigneeColumn} = ?`);
      updateVals.push(assigneeId || null);
    }
    if (taskCols.has('updated_at') && updateCols.length > 0) {
      updateCols.push('updated_at = CURRENT_TIMESTAMP');
    }

    if (updateCols.length === 0 && !comment) {
      return res.status(400).json({ error: 'No backlog task changes provided' });
    }

    if (updateCols.length > 0) {
      const result = await dbRun(`UPDATE tasks SET ${updateCols.join(', ')} WHERE id = ?`, [
        ...updateVals,
        id,
      ]);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update backlog task');
      }
    }

    let commentSaved = false;
    if (comment) {
      try {
        const commentCols = await getTableColumns('task_comments');
        if (commentCols.size > 0) {
          const insertCols = ['id', 'task_id', 'content'];
          const values: unknown[] = [uuidv4(), id, comment];
          if (commentCols.has('user_id')) {
            insertCols.push('user_id');
            values.push((req as any).user?.id || 'superadmin');
          }
          if (commentCols.has('created_at')) {
            insertCols.push('created_at');
            values.push(new Date().toISOString());
          }
          if (commentCols.has('updated_at')) {
            insertCols.push('updated_at');
            values.push(new Date().toISOString());
          }
          const placeholders = insertCols.map(() => '?').join(', ');
          const result = await dbRun(
            `INSERT INTO task_comments (${insertCols.join(', ')}) VALUES (${placeholders})`,
            values
          );
          commentSaved = Boolean(result.success);
        }
      } catch (err) {
        logger.warn('[Feedback] Failed to save backlog task comment', err);
      }
    }

    const updated = await dbGet<any>(
      `
        SELECT
          id, organization_id, title, description, status, priority, tags,
          ${taskCols.has('reporter_id') ? 'reporter_id' : 'NULL as reporter_id'},
          ${taskCols.has('owner_id') ? 'owner_id' : 'NULL as owner_id'},
          ${taskCols.has('assignee_id') ? 'assignee_id' : 'NULL as assignee_id'},
          ${taskCols.has('assigned_to') ? 'assigned_to' : 'NULL as assigned_to'},
          created_at,
          ${taskCols.has('updated_at') ? 'updated_at' : 'NULL as updated_at'}
        FROM tasks
        WHERE id = ?
      `,
      [id]
    );
    const updatedTags = safeJsonParse<string[]>(updated?.tags, []);
    const feedbackTag =
      updatedTags.find((tag) => typeof tag === 'string' && tag.startsWith('feedback:')) || null;

    return res.json({
      ...updated,
      tags: updatedTags,
      assigneeId: updated?.owner_id || updated?.assignee_id || updated?.assigned_to || null,
      feedbackId: feedbackTag ? String(feedbackTag).slice('feedback:'.length) : null,
      commentSaved,
    });
  })
);

// =====================================================
// QUICK PULSE FEEDBACK
// =====================================================

/**
 * POST /api/feedback/pulse
 * Submit quick pulse feedback (rating 1-5)
 */
router.post(
  '/pulse',
  optionalVerifyToken,
  apiAuthRateLimiter,
  feedbackRateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = pulseFeedbackSchema.safeParse({
      ...(req.body || {}),
      rating: Number(req.body?.rating),
    });
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid pulse payload',
        details: parsed.error.flatten(),
      });
    }
    const { userId, rating, context, comment, timestamp } = parsed.data;

    // Guarantee the feedback tables exist before inserting: /pulse and /feature
    // are often the FIRST feedback endpoints a fresh process serves, and unlike
    // createFeedbackInternal they previously skipped this — a missing table (no
    // migration yet applied) surfaced as a bare 500 instead of self-healing.
    await ensureFeedbackSchema();

    const id = uuidv4();
    const actualUserId = userId || req.user?.id;

    const runResult = await dbRun(
      `INSERT INTO feedback_pulse (id, user_id, rating, context, comment, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        actualUserId,
        rating,
        context || '/',
        comment || null,
        timestamp || new Date().toISOString(),
      ]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to insert pulse feedback');
    }

    // Log for analytics
    logger.info(`[Pulse] User ${actualUserId} rated ${rating}/5 on ${context}`);

    try {
      await dispatchFeedbackEscalation({
        kind: 'pulse',
        id,
        organizationId: req.organizationId || 'system',
        appEnv: getAppEnv(),
        channels: resolveEscalationChannels({
          kind: 'pulse',
          rating,
          comment,
        }),
        feedbackType: 'PULSE',
        userId: actualUserId || null,
        title: `Pulse ${rating}/5`,
        message: comment || `User rated the experience ${rating}/5 on ${context || '/'}.`,
        rating,
        comment: comment || null,
        routePath: context || '/',
        metadata: {
          rating,
          context: context || '/',
          timestamp: timestamp || new Date().toISOString(),
        },
      });
    } catch (dispatchErr) {
      logger.error('[Pulse] Failed to dispatch escalation:', dispatchErr);
    }

    return res.json({ success: true, id });
  })
);

// =====================================================
// FEATURE REQUESTS
// =====================================================

/**
 * POST /api/feedback/feature
 * Submit feature request with AI analysis
 */
router.post(
  '/feature',
  optionalVerifyToken,
  apiAuthRateLimiter,
  feedbackRateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = featureFeedbackSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid feature payload',
        details: parsed.error.flatten(),
      });
    }
    const {
      userId,
      userEmail,
      category,
      featureName,
      description,
      impact,
      context,
      requestAIAnalysis,
    } = parsed.data;

    // Self-heal the schema before insert (see /pulse note above): /feature may
    // be the first feedback endpoint hit in a fresh process.
    await ensureFeedbackSchema();

    const id = uuidv4();
    const actualUserId = userId || req.user?.id;
    const actualEmail = userEmail || req.user?.email;

    // Store feature request
    const runResult = await dbRun(
      `INSERT INTO feature_requests 
             (id, user_id, user_email, category, feature_name, description, impact, context, status, votes_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 1, CURRENT_TIMESTAMP)`,
      [
        id,
        actualUserId,
        actualEmail,
        category || 'other',
        featureName,
        description,
        impact || 'medium',
        context || '/',
      ]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to insert feature request');
    }

    let aiSuggestion = null;

    // Optionally run AI analysis
    if (requestAIAnalysis) {
      try {
        const analysis = await feedbackAIService.analyzeFeatureRequest(
          featureName,
          description,
          category || 'other'
        );
        aiSuggestion = analysis;

        // If similar features exist, notify user
        if (analysis.existingSimilar.length > 0) {
          logger.info(
            `[Feature] Found ${analysis.existingSimilar.length} similar requests for: ${featureName}`
          );
        }
      } catch (e) {
        logger.warn('[Feature] AI analysis failed:', e);
      }
    }

    try {
      await dispatchFeedbackEscalation({
        kind: 'feature',
        id,
        organizationId: req.organizationId || 'system',
        appEnv: getAppEnv(),
        channels: resolveEscalationChannels({
          kind: 'feature',
        }),
        feedbackType: 'FEATURE',
        severity: impact === 'high' ? 'HIGH' : 'MEDIUM',
        priority: impact || 'medium',
        userId: actualUserId || null,
        userEmail: actualEmail || null,
        title: featureName,
        message: description,
        routePath: context || '/',
        metadata: {
          category: category || 'other',
          impact: impact || 'medium',
          aiSuggestion: aiSuggestion || undefined,
        },
      });
    } catch (dispatchErr) {
      logger.error('[Feature] Failed to dispatch escalation:', dispatchErr);
    }

    return res.json({
      success: true,
      id,
      aiSuggestion,
      message: aiSuggestion?.existingSimilar?.length
        ? 'Feature request submitted! We found similar requests.'
        : 'Feature request submitted!',
    });
  })
);

/**
 * GET /api/feedback/features
 * List feature requests (admin)
 */
router.get(
  '/features',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, category, limit = 50 } = req.query;

    let sql = `SELECT * FROM feature_requests WHERE 1=1`;
    const params: unknown[] = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY votes_count DESC, created_at DESC LIMIT ?`;
    params.push(Number(limit));

    const features = await dbAll(sql, params);
    return res.json(features);
  })
);

/**
 * POST /api/feedback/features/:id/vote
 * Vote on a feature request
 */
router.post(
  '/features/:id/vote',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json(
          buildFailClosedFeedbackError(
            req,
            401,
            'FEEDBACK_FEATURE_VOTE_UNAUTHORIZED',
            'Authentication is required to vote for features.'
          )
        );
    }

    // Check if already voted
    const existing = await dbGet(
      `SELECT id FROM feature_votes WHERE feature_id = ? AND user_id = ?`,
      [id, userId]
    );

    if (existing) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_FEATURE_VOTE_DUPLICATE',
            'Feature vote already exists for this user.'
          )
        );
    }

    // Add vote
    await dbRun(
      `INSERT INTO feature_votes (id, feature_id, user_id, created_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [uuidv4(), id, userId]
    );

    // Update vote count
    await dbRun(`UPDATE feature_requests SET votes_count = votes_count + 1 WHERE id = ?`, [id]);

    return res.json({ success: true });
  })
);

// =====================================================
// AI INSIGHTS & ANALYSIS
// =====================================================

/**
 * POST /api/feedback/ai-insights
 * Get AI-generated insights for the current context
 */
router.post(
  '/ai-insights',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { context, userId } = req.body;
    const actualUserId = userId || req.user?.id;

    try {
      const insights = await feedbackAIService.generateInsights(actualUserId, context || '/');
      return res.json({ success: true, insights });
    } catch (error) {
      logger.error('[AI Insights] Error:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_AI_INSIGHTS_FAILED',
            'Failed to generate AI insights.'
          )
        );
    }
  })
);

/**
 * GET /api/feedback/ai-analysis/:id
 * Get AI analysis for a specific feedback
 */
router.get(
  '/ai-analysis/:id',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (!isUuidLike(id)) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_AI_ANALYSIS_FEEDBACK_ID_INVALID',
            'Feedback id must be a valid UUID.'
          )
        );
    }

    let analysis: Record<string, unknown> | null = null;
    try {
      analysis = await dbGet<Record<string, unknown>>(
        `SELECT * FROM feedback_analysis WHERE feedback_id = ?`,
        [id]
      );
    } catch (error) {
      logger.error('[Feedback] Failed to read feedback AI analysis:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_AI_ANALYSIS_READ_FAILED',
            'Failed to read feedback analysis.'
          )
        );
    }

    if (!analysis) {
      return res
        .status(404)
        .json(
          buildFailClosedFeedbackError(
            req,
            404,
            'FEEDBACK_AI_ANALYSIS_NOT_FOUND',
            'Feedback analysis was not found.'
          )
        );
    }

    try {
      const result = {
        ...analysis,
        categories: JSON.parse((analysis.categories_json as string) || '[]'),
        keywords: JSON.parse((analysis.keywords_json as string) || '[]'),
        similarFeedbackIds: JSON.parse((analysis.similar_feedback_ids_json as string) || '[]'),
        suggestedActions: JSON.parse((analysis.suggested_actions_json as string) || '[]'),
      };
      return res.json(result);
    } catch (error) {
      logger.error('[Feedback] Failed to parse feedback AI analysis payload:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_AI_ANALYSIS_READ_FAILED',
            'Failed to read feedback analysis.'
          )
        );
    }
  })
);

/**
 * POST /api/feedback/:id/analyze
 * Trigger AI analysis for a feedback (admin)
 */
router.post(
  '/:id/analyze',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (!isUuidLike(id)) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_ANALYZE_FEEDBACK_ID_INVALID',
            'Feedback id must be a valid UUID.'
          )
        );
    }

    // Get the feedback
    const feedback = await dbGet<{ id: string; message: string; type: string }>(
      `SELECT id, description as message, feedback_type as type FROM feedback_items WHERE id = ?`,
      [id]
    );

    if (!feedback) {
      return res
        .status(404)
        .json(
          buildFailClosedFeedbackError(
            req,
            404,
            'FEEDBACK_ANALYZE_NOT_FOUND',
            'Feedback was not found.'
          )
        );
    }

    try {
      const analysis = await feedbackAIService.analyzeFeedback(
        feedback.id,
        feedback.message,
        feedback.type
      );
      return res.json({ success: true, analysis });
    } catch (error) {
      logger.error('[AI Analysis] Error:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_ANALYZE_FAILED',
            'Failed to analyze feedback.'
          )
        );
    }
  })
);

/**
 * GET /api/feedback/trending
 * Get trending topics from feedback
 */
/**
 * POST /api/feedback/seed-demo
 * Seed demo data for testing (admin only)
 */
router.post(
  '/seed-demo',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    logger.info('[Feedback] Seeding demo data...');

    const DEMO_USERS = [
      { id: 'demo-user-1', email: 'jan.kowalski@acme.pl', name: 'Jan Kowalski' },
      { id: 'demo-user-2', email: 'anna.nowak@techcorp.com', name: 'Anna Nowak' },
      { id: 'demo-user-3', email: 'piotr.wisniewski@enterprise.io', name: 'Piotr Wiśniewski' },
      { id: 'demo-user-4', email: 'maria.zielinska@startup.pl', name: 'Maria Zielińska' },
      { id: 'demo-user-5', email: 'tomasz.kaczmarek@consulting.com', name: 'Tomasz Kaczmarek' },
    ];

    const FEEDBACK_DATA = [
      {
        type: 'BUG',
        message: 'PDF export crashes on large reports (>50 pages). Browser becomes unresponsive.',
        severity: 'CRITICAL',
        status: 'IN_PROGRESS',
        context: '/reports/export',
      },
      {
        type: 'BUG',
        message: 'SSO login fails intermittently - about 20% of attempts show session expired.',
        severity: 'HIGH',
        status: 'NEW',
        context: '/login',
      },
      {
        type: 'BUG',
        message: 'Dashboard charts not loading on Safari 17. Works on Chrome.',
        severity: 'MEDIUM',
        status: 'PENDING',
        context: '/dashboard',
      },
      {
        type: 'BUG',
        message: 'Notification count shows wrong number of unread items.',
        severity: 'LOW',
        status: 'NEW',
        context: '/notifications',
      },
      {
        type: 'IDEA',
        message: 'Would love a mobile app! Need to check status when away from desk.',
        severity: 'NORMAL',
        status: 'REVIEWED',
        context: '/dashboard',
        rating: 5,
      },
      {
        type: 'IDEA',
        message: 'Microsoft Teams integration would be amazing for notifications.',
        severity: 'NORMAL',
        status: 'IN_PROGRESS',
        context: '/settings',
        rating: 5,
      },
      {
        type: 'IDEA',
        message: 'Keyboard shortcuts for power users - Ctrl+N, Ctrl+S, etc.',
        severity: 'NORMAL',
        status: 'NEW',
        context: '/',
        rating: 4,
      },
      {
        type: 'IDEA',
        message: 'Dark mode please! Working late and bright interface is harsh.',
        severity: 'NORMAL',
        status: 'IN_PROGRESS',
        context: '/settings',
        rating: 5,
      },
      {
        type: 'IDEA',
        message: 'Custom dashboard widgets with drag-and-drop would be great.',
        severity: 'NORMAL',
        status: 'PENDING',
        context: '/dashboard',
        rating: 4,
      },
      {
        type: 'IDEA',
        message: 'Bulk actions for initiatives - select multiple and change status.',
        severity: 'NORMAL',
        status: 'NEW',
        context: '/initiatives',
        rating: 4,
      },
    ];

    const PULSE_DATA = [
      { rating: 5, context: '/dashboard', comment: null },
      { rating: 4, context: '/assessment', comment: null },
      { rating: 5, context: '/ai-chat', comment: 'AI is really helpful!' },
      { rating: 2, context: '/reports/export', comment: 'PDF export is slow' },
      { rating: 3, context: '/roadmap', comment: 'Charts could be more responsive' },
      { rating: 5, context: '/economics', comment: 'Great ROI calculator!' },
      { rating: 1, context: '/login', comment: 'SSO keeps failing' },
      { rating: 4, context: '/initiatives', comment: null },
      { rating: 5, context: '/dashboard', comment: null },
      { rating: 4, context: '/assessment', comment: null },
    ];

    const FEATURE_DATA = [
      {
        category: 'missing',
        featureName: 'Mobile Application',
        description: 'Native mobile apps for iOS and Android',
        impact: 'high',
        status: 'PLANNED',
        votes: 47,
      },
      {
        category: 'integration',
        featureName: 'Microsoft Teams Integration',
        description: 'Notifications and embedded widgets in Teams',
        impact: 'high',
        status: 'IN_PROGRESS',
        votes: 38,
      },
      {
        category: 'improvement',
        featureName: 'Dark Mode',
        description: 'System-wide dark theme option',
        impact: 'medium',
        status: 'IN_PROGRESS',
        votes: 52,
      },
      {
        category: 'missing',
        featureName: 'Keyboard Shortcuts',
        description: 'Global shortcuts for common actions',
        impact: 'medium',
        status: 'PLANNED',
        votes: 29,
      },
      {
        category: 'improvement',
        featureName: 'Customizable Dashboard',
        description: 'Drag-and-drop dashboard builder',
        impact: 'high',
        status: 'REVIEWING',
        votes: 41,
      },
      {
        category: 'missing',
        featureName: 'PowerPoint Export',
        description: 'Export reports to .pptx format',
        impact: 'medium',
        status: 'NEW',
        votes: 31,
      },
    ];

    let feedbackCount = 0;
    let pulseCount = 0;
    let featureCount = 0;

    try {
      // Insert feedback
      for (let i = 0; i < FEEDBACK_DATA.length; i++) {
        const fb = FEEDBACK_DATA[i];
        const user = DEMO_USERS[i % DEMO_USERS.length];
        const id = uuidv4();

        await dbRun(
          `
                    INSERT INTO system_feedback 
                    (id, user_id, user_email, user_name, type, message, rating, severity, status, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
                `,
          [
            id,
            user.id,
            user.email,
            user.name,
            fb.type,
            fb.message,
            fb.rating || null,
            fb.severity,
            fb.status,
            JSON.stringify({ context: fb.context }),
            Math.floor(Math.random() * 30),
          ]
        );
        feedbackCount++;
      }

      // Insert pulse
      for (const pulse of PULSE_DATA) {
        const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];

        await dbRun(
          `
                    INSERT INTO feedback_pulse (id, user_id, rating, context, comment, created_at)
                    VALUES (?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
                `,
          [
            uuidv4(),
            user.id,
            pulse.rating,
            pulse.context,
            pulse.comment,
            Math.floor(Math.random() * 7),
          ]
        );
        pulseCount++;
      }

      // Insert features
      for (let i = 0; i < FEATURE_DATA.length; i++) {
        const fr = FEATURE_DATA[i];
        const user = DEMO_USERS[i % DEMO_USERS.length];

        await dbRun(
          `
                    INSERT INTO feature_requests 
                    (id, user_id, user_email, category, feature_name, description, impact, status, votes_count, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
                `,
          [
            uuidv4(),
            user.id,
            user.email,
            fr.category,
            fr.featureName,
            fr.description,
            fr.impact,
            fr.status,
            fr.votes,
            Math.floor(Math.random() * 60),
          ]
        );
        featureCount++;
      }

      // Insert trending topics
      const topics = ['mobile', 'integration', 'performance', 'dark mode', 'export'];
      for (const topic of topics) {
        await dbRun(
          `
                    INSERT OR REPLACE INTO feedback_trending_topics 
                    (id, topic, topic_count, sentiment, trend, period, calculated_at)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `,
          [uuidv4(), topic, Math.floor(Math.random() * 15) + 3, 'positive', 'rising', '7d']
        );
      }

      logger.info(
        `[Feedback] Demo data seeded: ${feedbackCount} feedback, ${pulseCount} pulse, ${featureCount} features`
      );

      return res.json({
        success: true,
        message: 'Demo data seeded successfully',
        counts: {
          feedback: feedbackCount,
          pulse: pulseCount,
          features: featureCount,
          trending: topics.length,
        },
      });
    } catch (error: any) {
      logger.error('[Feedback] Seed error:', error);
      return res.status(500).json({ error: 'Failed to seed demo data', details: error.message });
    }
  })
);

/**
 * GET /api/feedback/:id/artifacts/screenshot
 * SuperAdmin only — returns the stored screenshot bytes (jpeg/png/webp).
 */
router.get(
  '/:id/artifacts/screenshot',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isUuidLike(id)) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_SCREENSHOT_FEEDBACK_ID_INVALID',
            'Feedback id must be a valid UUID.'
          )
        );
    }
    let file: Awaited<ReturnType<typeof readFeedbackScreenshot>> = null;
    try {
      file = await readFeedbackScreenshot(id);
    } catch (error) {
      logger.error('[Feedback] Screenshot read failed:', error);
      return res
        .status(500)
        .json(
          buildFailClosedFeedbackError(
            req,
            500,
            'FEEDBACK_SCREENSHOT_READ_FAILED',
            'Failed to read feedback screenshot.'
          )
        );
    }
    if (!file) {
      const row = await dbGet<{ metadata_json?: string }>(
        `SELECT metadata_json FROM feedback_items WHERE id = ? LIMIT 1`,
        [id]
      );
      if (row?.metadata_json) {
        try {
          const meta = JSON.parse(row.metadata_json) as Record<string, any>;
          const screenshotDataUrl =
            meta?.dossier?.screenshot?.dataUrl ||
            meta?.screenshot?.dataUrl ||
            meta?.artifacts?.find?.((artifact: any) => artifact?.dataUrl)?.dataUrl;
          const decoded =
            typeof screenshotDataUrl === 'string' ? decodeDataUrl(screenshotDataUrl) : null;
          if (decoded) {
            file = decoded;
          }
        } catch {
          // fall through to 404
        }
      }
    }
    if (!file) {
      return res
        .status(404)
        .json(
          buildFailClosedFeedbackError(
            req,
            404,
            'FEEDBACK_SCREENSHOT_NOT_FOUND',
            'Feedback screenshot was not found.'
          )
        );
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="feedback-${id.slice(0, 8)}-screenshot"`
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.end(file.buffer);
  })
);

/**
 * GET /api/feedback/:id/cursor-brief
 * SuperAdmin only — returns a markdown brief ready to paste into Cursor,
 * with all captured context (logs, breadcrumbs, network, appContext, repro).
 */
router.get(
  '/:id/cursor-brief',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isUuidLike(id)) {
      return res
        .status(400)
        .json(
          buildFailClosedFeedbackError(
            req,
            400,
            'FEEDBACK_CURSOR_BRIEF_ID_INVALID',
            'Feedback id must be a valid UUID.'
          )
        );
    }
    const row = await dbGet<any>(
      `SELECT id, title, description, feedback_type, severity, priority, status,
              source_env, created_at, metadata_json, linked_task_id
       FROM feedback_items WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!row)
      return res
        .status(404)
        .json(
          buildFailClosedFeedbackError(
            req,
            404,
            'FEEDBACK_CURSOR_BRIEF_NOT_FOUND',
            'Feedback item was not found.'
          )
        );

    const meta: Record<string, unknown> = (() => {
      try {
        return row.metadata_json ? JSON.parse(String(row.metadata_json)) : {};
      } catch {
        return {};
      }
    })();

    const dossier = (
      meta.dossier && typeof meta.dossier === 'object'
        ? (meta.dossier as Record<string, unknown>)
        : {}
    ) as Record<string, unknown>;
    const appCtx = (dossier.appContext || {}) as Record<string, unknown>;
    const workflow = (meta.workflow || {}) as Record<string, unknown>;
    const signatureHash = (meta.signatureHash as string | undefined) || '—';

    const lines: string[] = [];
    lines.push(`# Cursor brief — ${row.feedback_type} ${row.id.slice(0, 8)}`);
    lines.push('');
    lines.push(`- **Title:** ${row.title || '(no title)'}`);
    lines.push(`- **Severity:** ${row.severity || '—'}`);
    lines.push(`- **Priority:** ${row.priority || '—'}`);
    lines.push(`- **Status:** ${row.status || '—'}`);
    lines.push(`- **Env:** ${row.source_env || (appCtx.appEnv as string) || '—'}`);
    lines.push(`- **Cluster:** ${(workflow.cluster as string) || '—'}`);
    lines.push(
      `- **Route:** ${(meta.routePath as string) || (appCtx.route as any)?.pathname || '—'}`
    );
    lines.push(`- **Reporter:** ${(meta.userEmail as string) || (meta.userName as string) || '—'}`);
    lines.push(`- **Created:** ${row.created_at || '—'}`);
    lines.push(
      `- **Build:** ${(appCtx.buildSha as string) || '—'} @ ${(appCtx.buildAt as string) || '—'}`
    );
    lines.push(`- **Signature:** \`${signatureHash}\``);
    if (row.linked_task_id) lines.push(`- **Linked task:** ${row.linked_task_id}`);
    if (Array.isArray(meta.duplicateCandidates) && (meta.duplicateCandidates as any[]).length > 0) {
      lines.push(`- **Duplicates:** ${(meta.duplicateCandidates as any[]).length} candidate(s)`);
    }
    lines.push('');
    lines.push('## Description');
    lines.push(row.description || '(no description)');
    lines.push('');

    const breadcrumbs = Array.isArray(dossier.breadcrumbs)
      ? (dossier.breadcrumbs as any[]).slice(-15)
      : [];
    if (breadcrumbs.length > 0) {
      lines.push('## Breadcrumbs (last 15)');
      for (const b of breadcrumbs) {
        lines.push(
          `- \`${b.at || ''}\` [${b.kind || 'custom'}] ${b.label || ''}${
            b.target ? ` — \`${b.target}\`` : ''
          }`
        );
      }
      lines.push('');
    }

    const networkErrors = Array.isArray(dossier.networkErrors)
      ? (dossier.networkErrors as any[]).slice(-10)
      : [];
    if (networkErrors.length > 0) {
      lines.push('## Network errors');
      for (const n of networkErrors) {
        lines.push(
          `- \`${n.at || ''}\` ${n.method || ''} ${n.status ?? 'ERR'} (${n.durationMs ?? '?'}ms) ${n.url || ''}${
            n.error ? ` — ${n.error}` : ''
          }`
        );
      }
      lines.push('');
    }

    const consoleLogs = Array.isArray(dossier.consoleLogs)
      ? (dossier.consoleLogs as any[]).slice(-15)
      : [];
    if (consoleLogs.length > 0) {
      lines.push('## Console logs (last 15)');
      lines.push('```');
      for (const c of consoleLogs) {
        lines.push(`[${c.level || 'log'}] ${c.at || ''} ${c.message || ''}`);
      }
      lines.push('```');
      lines.push('');
    }

    const uncaught = dossier.lastUncaughtError as any;
    if (uncaught && typeof uncaught === 'object' && uncaught.message) {
      lines.push('## Last uncaught error');
      lines.push('```');
      lines.push(String(uncaught.message));
      if (uncaught.stack) lines.push(String(uncaught.stack));
      lines.push('```');
      lines.push('');
    }

    if (appCtx.viewport) {
      const vp = appCtx.viewport as any;
      lines.push('## Environment');
      lines.push(
        `- viewport: ${vp.width || '?'}×${vp.height || '?'} @${vp.dpr || 1}x · ua: ${
          (appCtx.userAgent as string) || '?'
        }`
      );
      lines.push(
        `- locale: ${(appCtx.locale as string) || '?'} · tz: ${
          (appCtx.timezone as string) || '?'
        } · online: ${appCtx.online ?? '?'}`
      );
      if (appCtx.memoryMb) lines.push(`- heap: ~${appCtx.memoryMb} MB`);
      lines.push('');
    }

    lines.push('## Your job (Cursor)');
    lines.push(
      [
        '1. Reproduce using the route and breadcrumbs above. Ask ONE clarifying question only if repro is ambiguous.',
        `2. Create branch \`feedback/${row.id.slice(0, 8)}\` and take ownership:`,
        '   ```',
        `   PATCH /api/feedback/${row.id}/workflow`,
        '   { "owner": "cursor", "source": "cursor", "branch": "feedback/' +
          row.id.slice(0, 8) +
          '", "note": "Picked up" }',
        '   ```',
        '3. Implement the fix, keep diff minimal, cover the regression with a test.',
        `4. Open PR titled \`fix(feedback:${row.id.slice(0, 8)}): <summary>\`, then PATCH workflow with \`prUrl\`.`,
        '5. After deploy, PATCH workflow with `deployStatus` and set `resolution.summary` before flipping status to `RESOLVED`.',
      ].join('\n')
    );
    lines.push('');

    const markdown = lines.join('\n');

    // Side-effect: the moment someone pulls the Cursor brief, mark the ticket
    // as picked up by Cursor. Keeps the Superadmin timeline honest — otherwise
    // operators had to manually flip `workflow.source` and inevitably forgot.
    // We only write when nothing was set yet, so we don't spam the audit log.
    try {
      const existingWorkflow = (meta.workflow || {}) as Record<string, unknown>;
      const alreadyCursor = String(existingWorkflow.source || '').toLowerCase() === 'cursor';
      if (!alreadyCursor) {
        const feedbackCols = await getTableColumns('feedback_items');
        if (feedbackCols.has('metadata_json')) {
          const currentWorkflow = normalizeWorkflowMeta(meta);
          const currentTimeline = normalizeWorkflowTimeline(meta);
          const shortId = String(row.id).slice(0, 8);
          const nextWorkflow = compactObject({
            ...currentWorkflow,
            source: 'cursor',
            branch: currentWorkflow.branch || `feedback/${shortId}`,
            lastUpdatedAt: new Date().toISOString(),
          }) as FeedbackWorkflowRecord;
          const nextTimeline = [
            ...currentTimeline,
            {
              id: uuidv4(),
              at: new Date().toISOString(),
              actor: (req as any).user?.email || (req as any).user?.id || 'cursor',
              action: 'workflow_updated',
              note: 'Cursor brief pulled',
              changes: ['source', ...(currentWorkflow.branch ? [] : ['branch'])],
            } satisfies FeedbackWorkflowTimelineEntry,
          ].slice(-50);
          const nextMeta = {
            ...meta,
            workflow: nextWorkflow,
            workflowTimeline: nextTimeline,
          };
          await dbRun(`UPDATE feedback_items SET metadata_json = ? WHERE id = ?`, [
            JSON.stringify(nextMeta),
            row.id,
          ]);
        }
      }
    } catch (err) {
      logger.warn(
        '[Feedback] cursor-brief auto-source PATCH failed (non-fatal):',
        err instanceof Error ? err.message : err
      );
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.send(markdown);
  })
);

export default router;
