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
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import feedbackAIService from '../services/feedbackAIService.js';
import NotificationService from '../services/notificationService.js';
import slackService from '../services/slackService.js';
import WhatsAppService from '../services/WhatsAppService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

type TicketStatus = 'NEW' | 'PENDING' | 'IN_PROGRESS' | 'REVIEWED' | 'RESOLVED' | 'ARCHIVED';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

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
      return res.status(400).json({ error: 'message is required' });
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
        error: 'No LLM provider configured. Set OPENROUTER_API_KEY or configure OpenRouter.',
        code: 'NO_LLM_PROVIDER',
      });
    }

    const orgId = (req as any).organizationId || (req as any).user?.organizationId;

    // Access policy
    const AccessPolicyService = (await import('../services/accessPolicyService.js')).default as any;
    const aiAccessCheck = await AccessPolicyService.checkAccess(orgId, 'ai_call');
    if (!aiAccessCheck.allowed) {
      return res.status(403).json({
        error: aiAccessCheck.reason || 'Access blocked',
        code: aiAccessCheck.errorCode || 'ACCESS_BLOCKED',
      });
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

    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'budget' },
      systemPrompt: systemInstruction,
      messages: [{ role: 'user', content: userPrompt }],
      schema: ComposeSchema,
      maxTokens: 700,
      temperature: 0.2,
      cache: false,
    });

    const parsed = (result as any)?.object || null;
    if (!parsed) {
      return res.status(500).json({ error: 'AI returned no object', code: 'AI_EMPTY' });
    }

    return res.json({
      success: true,
      data: {
        title: String(parsed.title || '').trim() || undefined,
        summary: String(parsed.summary || '').trim() || undefined,
        steps:
          Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps.map(String) : undefined,
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

/**
 * POST /api/feedback
 * Submit new feedback
 */
router.post(
  '/',
  optionalVerifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeedbackSchema();
    const { userId, userEmail, userName, type, message, severity, metadata } = req.body;

    if (!message || !type) {
      return res.status(400).json({ error: 'Message and type are required' });
    }

    const appEnv = getAppEnv();

    // Resolve organizationId when possible
    let organizationId: string | null = null;
    try {
      if ((req as any).user?.organizationId) {
        organizationId = String((req as any).user.organizationId);
      } else if (userId) {
        const userRow = await dbGet<{ organization_id?: string }>(
          `SELECT organization_id FROM users WHERE id = ?`,
          [userId]
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

    const rawTitle = String(req.body.title || '').trim();
    const inferredTitle =
      rawTitle ||
      String(message).split('\n').map((s: string) => s.trim()).filter(Boolean)[0] ||
      String(message).slice(0, 80);
    const title = inferredTitle.length > 120 ? inferredTitle.slice(0, 120) + '…' : inferredTitle;
    const description = String(req.body.description || message || '').trim();

    const priority = priorityFromEnvAndSeverity({ appEnv, severity, type });
    const status: TicketStatus = 'NEW';

    const contextFields = [
      'routePath',
      'deviceType',
      'screenSize',
      'uiLanguage',
      'uiTheme',
      'workspaceContext',
    ];
    const contextMeta: Record<string, unknown> = {};
    for (const field of contextFields) {
      if (req.body[field] !== undefined) contextMeta[field] = req.body[field];
    }

    const metadataJson = {
      ...(metadata || {}),
      ...contextMeta,
      appEnv,
      clientEnv: req.body.clientEnv || undefined,
      userEmail: userEmail || undefined,
      userName: userName || undefined,
      feedbackType: type,
      severity: severity || undefined,
      title,
    };

    const insertCols: string[] = ['id', 'organization_id', 'user_id', 'feedback_type', 'title', 'description'];
    const values: unknown[] = [
      feedbackId,
      ticketOrgId,
      userId || (req.user?.id as any) || null,
      String(type).toUpperCase(),
      title,
      description,
    ];

    const optional: Array<[string, unknown]> = [
      ['category', req.body.category || null],
      ['priority', priority],
      ['status', status],
      ['metadata_json', JSON.stringify(metadataJson)],
      ['severity', severity || null],
      ['source_env', appEnv],
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
        userId: userId || (req.user?.id as any) || null,
        title: taskTitle,
        description: taskDescription,
        priority,
        feedbackId,
        appEnv,
      });

      if (feedbackCols.has('linked_task_id') || feedbackCols.has('metadata_json')) {
        const updateCols: string[] = [];
        const updateVals: unknown[] = [];
        const nextMeta = { ...(metadataJson as any), linkedTaskId };

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
          await dbRun(
            `UPDATE feedback_items SET ${updateCols.join(', ')} WHERE id = ?`,
            [...updateVals, feedbackId]
          );
        }
      }
    } catch (e) {
      logger.warn('[Feedback] Failed to auto-create task from feedback:', e);
    }

    // Send external notifications (Slack + WhatsApp)
    try {
      await slackService.sendNewFeedbackAlert({
        type,
        userEmail,
        userName,
        message: `${title}\n\n${description}`,
        severity,
        priority,
        routePath: req.body.routePath,
        deviceType: req.body.deviceType,
        screenSize: req.body.screenSize,
        uiLanguage: req.body.uiLanguage,
        uiTheme: req.body.uiTheme,
        organizationId: orgIdForNotifications,
        feedbackId,
        taskId: linkedTaskId || undefined,
        appEnv,
      });
    } catch (e: unknown) {
      logger.warn('Slack feedback notification failed:', e);
    }

    try {
      await WhatsAppService.sendNewFeedbackAlert({ userId, userEmail, type, message });
    } catch (e: unknown) {
      logger.warn('WhatsApp notification failed:', e);
    }

    // Create Internal Notification for SuperAdmin
    try {
      const isCritical = severity === 'CRITICAL';
      const notificationType = isCritical ? 'CLIENT_TICKET' : 'USER_FEEDBACK';
      const notificationSeverity = isCritical ? 'WARNING' : 'INFO';

      await NotificationService.send({
        userId: userId,
        organizationId: orgIdForNotifications,
        type: notificationType,
        severity: notificationSeverity as 'INFO' | 'WARNING' | 'CRITICAL',
        title: isCritical ? `Critical Feedback: ${type}` : `New Feedback: ${type}`,
        body: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
        message: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
        relatedObjectType: 'FEEDBACK',
        relatedObjectId: feedbackId,
        isActionable: true,
        actionUrl: '/admin?section=feedback',
        metadata: {
          ...(metadata || {}),
          userEmail,
          feedbackType: type,
          appEnv,
          linkedTaskId,
        },
      });
    } catch (noteErr) {
      logger.error('Failed to create notification for feedback:', noteErr);
    }

    return res.json({ success: true, id: feedbackId, taskId: linkedTaskId });
  })
);

/**
 * GET /api/feedback
 * List all feedback (Admin only)
 */
router.get(
  '/',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureFeedbackSchema();
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
        LIMIT 200
      `,
      []
    );

    const shaped = (rows || []).map((r: any) => {
      const meta = safeJsonParse<Record<string, any>>(r.metadata, {});
      return {
        ...r,
        // Provide legacy context fields used by SuperAdmin view (computed from metadata_json)
        route_path: meta.routePath || meta.context || null,
        device_type: meta.deviceType || null,
        screen_size: meta.screenSize || null,
        ui_language: meta.uiLanguage || null,
        ui_theme: meta.uiTheme || null,
        // Keep metadata as string to match existing UI expectations
        metadata: r.metadata ? String(r.metadata) : null,
      };
    });

    return res.json(shaped);
  })
);

/**
 * PATCH /api/feedback/:id/status
 * Update feedback status
 */
router.patch(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, note } = req.body;
    const { id } = req.params;
    const changedBy = (req as any).user?.id || req.body.userId || null;

    const validStatuses = ['NEW', 'PENDING', 'IN_PROGRESS', 'REVIEWED', 'RESOLVED', 'ARCHIVED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const current = await dbGet<{ status: string }>(`SELECT status FROM feedback_items WHERE id = ?`, [id]);
    const fromStatus = current?.status || null;

    const sql = `UPDATE feedback_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const runResult = await dbRun(sql, [status.toUpperCase(), id]);

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to update feedback status');
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

    return res.json({ success: true });
  })
);

/**
 * POST /api/feedback/:id/respond
 * Admin response to feedback
 */
router.post(
  '/:id/respond',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { response } = req.body;
    const { id } = req.params;

    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'Response is required' });
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
      throw new Error(runResult.error || 'Failed to update feedback');
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

    return res.json({ success: true });
  })
);

/**
 * GET /api/feedback/:id
 * Get single feedback item
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const row = await dbGet<{
      id: string;
      user_id: string | null;
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
    }>('SELECT * FROM feedback_items WHERE id = ?', [id]);

    if (!row) {
      return res.status(404).json({ error: 'Feedback not found' });
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

    const meta = safeJsonParse<Record<string, any>>((row as any).metadata_json, {});
    return res.json({
      ...row,
      type: (row as any).feedback_type,
      message: (row as any).description,
      metadata: (row as any).metadata_json,
      route_path: meta.routePath || meta.context || null,
      device_type: meta.deviceType || null,
      screen_size: meta.screenSize || null,
      ui_language: meta.uiLanguage || null,
      ui_theme: meta.uiTheme || null,
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
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM feedback_items',
      new: "SELECT COUNT(*) as count FROM feedback_items WHERE UPPER(status) = 'NEW'",
      pending:
        "SELECT COUNT(*) as count FROM feedback_items WHERE UPPER(status) IN ('PENDING', 'IN_PROGRESS')",
      bugs:
        "SELECT COUNT(*) as count FROM feedback_items WHERE UPPER(feedback_type) = 'BUG' AND UPPER(status) != 'RESOLVED'",
    };

    const results: Record<string, number> = {};
    const promises = Object.entries(queries).map(async ([key, sql]) => {
      const row = await dbGet<{ avg?: number; count?: number }>(sql, []);
      results[key] = row?.count || 0;
    });

    await Promise.all(promises);
    return res.json(results);
  })
);

/**
 * GET /api/feedback/backlog/tasks
 * List tasks created from feedback tickets (for SuperAdmin backlog).
 */
router.get(
  '/backlog/tasks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);
    const rows = await dbAll<any>(
      `
        SELECT
          id, organization_id, title, description, status, priority,
          tags, reporter_id, owner_id, created_at, updated_at
        FROM tasks
        WHERE CAST(tags AS TEXT) LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      ['%feedback:%', limit]
    );

    const shaped = (rows || []).map((r: any) => {
      const tags = safeJsonParse<string[]>(r.tags, []);
      const feedbackTag = tags.find((t) => typeof t === 'string' && t.startsWith('feedback:')) || null;
      return {
        ...r,
        tags,
        feedbackId: feedbackTag ? String(feedbackTag).slice('feedback:'.length) : null,
      };
    });

    return res.json(shaped);
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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, rating, context, comment, timestamp } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

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

    // If low rating, create notification for admins
    if (rating <= 2 && comment) {
      try {
        await NotificationService.send({
          userId: 'admin',
          organizationId: 'system',
          type: 'LOW_PULSE_ALERT',
          severity: 'WARNING',
          title: `Low Pulse Rating: ${rating}/5`,
          body: comment.substring(0, 200),
          message: comment.substring(0, 200),
          relatedObjectType: 'PULSE',
          relatedObjectId: id,
          isActionable: true,
        });
      } catch (e) {
        logger.warn('[Pulse] Failed to create notification:', e);
      }
    }

    return res.json({ success: true, id });
  })
);

/**
 * GET /api/feedback/pulse-summary
 * Get pulse feedback analytics
 */
router.get(
  '/pulse-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { period = '30d' } = req.query;

    try {
      const summary = await feedbackAIService.getPulseSummary(period as '7d' | '30d' | '90d');
      return res.json({ success: true, summary });
    } catch (error) {
      logger.error('[Pulse] Summary error:', error);
      return res.status(500).json({ error: 'Failed to get pulse summary' });
    }
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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      userId,
      userEmail,
      category,
      featureName,
      description,
      impact,
      context,
      requestAIAnalysis,
    } = req.body;

    if (!featureName || !description) {
      return res.status(400).json({ error: 'Feature name and description are required' });
    }

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
          category
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

    // Create notification for product team
    try {
      await NotificationService.send({
        userId: 'product',
        organizationId: 'system',
        type: 'FEATURE_REQUEST',
        severity: impact === 'high' ? 'WARNING' : 'INFO',
        title: `New Feature Request: ${featureName}`,
        body: description.substring(0, 200),
        message: description.substring(0, 200),
        relatedObjectType: 'FEATURE',
        relatedObjectId: id,
        isActionable: true,
        actionUrl: '/admin?section=features',
      });
    } catch (e) {
      logger.warn('[Feature] Failed to create notification:', e);
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if already voted
    const existing = await dbGet(
      `SELECT id FROM feature_votes WHERE feature_id = ? AND user_id = ?`,
      [id, userId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Already voted' });
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
      return res.json({ success: true, insights: [] }); // Return empty on error
    }
  })
);

/**
 * GET /api/feedback/ai-analysis/:id
 * Get AI analysis for a specific feedback
 */
router.get(
  '/ai-analysis/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const analysis = await dbGet(`SELECT * FROM feedback_analysis WHERE feedback_id = ?`, [id]);

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Parse JSON fields
    const analysisObj = analysis as Record<string, unknown>;
    const result = {
      ...analysisObj,
      categories: JSON.parse((analysisObj.categories_json as string) || '[]'),
      keywords: JSON.parse((analysisObj.keywords_json as string) || '[]'),
      similarFeedbackIds: JSON.parse((analysisObj.similar_feedback_ids_json as string) || '[]'),
      suggestedActions: JSON.parse((analysisObj.suggested_actions_json as string) || '[]'),
    };

    return res.json(result);
  })
);

/**
 * POST /api/feedback/:id/analyze
 * Trigger AI analysis for a feedback (admin)
 */
router.post(
  '/:id/analyze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Get the feedback
    const feedback = await dbGet<{ id: string; message: string; type: string }>(
      `SELECT id, message, type FROM system_feedback WHERE id = ?`,
      [id]
    );

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
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
      return res.status(500).json({ error: 'Failed to analyze feedback' });
    }
  })
);

/**
 * GET /api/feedback/trending
 * Get trending topics from feedback
 */
router.get(
  '/trending',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const trending = await feedbackAIService.getTrendingTopics();
      return res.json({ success: true, trending });
    } catch (error) {
      logger.error('[Trending] Error:', error);
      return res.json({ success: true, trending: [] });
    }
  })
);

/**
 * POST /api/feedback/seed-demo
 * Seed demo data for testing (admin only)
 */
router.post(
  '/seed-demo',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if admin/superadmin
    const userRole = (req.user?.role || '').toLowerCase();
    if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(userRole)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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

export default router;
