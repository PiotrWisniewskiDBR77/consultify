/**
 * Feature Updates (What's new) Routes — T069
 *
 * - Publish updates (draft → published)
 * - In-app feed + seen tracking
 * - Optional email (if SMTP configured)
 */

import crypto from 'crypto';
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import EmailService from '../services/emailService.js';
import notificationService from '../services/notificationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

type UpdateRow = {
  id: string;
  organization_id: string | null;
  title: string;
  body_md: string;
  tags: string;
  importance: 'low' | 'normal' | 'high' | string;
  status: 'draft' | 'published' | 'archived' | string;
  action_payload: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const nowIso = () => new Date().toISOString();

const safeJson = <T>(value: unknown, fallback: T): T => {
  try {
    if (typeof value === 'string') return JSON.parse(value) as T;
    return fallback;
  } catch {
    return fallback;
  }
};

async function ensureFeatureUpdatesSchema(): Promise<void> {
  await dbRun(
    `
    CREATE TABLE IF NOT EXISTS feature_updates (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      title TEXT NOT NULL,
      body_md TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      importance TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'draft',
      action_payload TEXT DEFAULT '{}',
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    );
    `,
    [],
    { fallback: false }
  );

  await dbRun(
    `
    CREATE TABLE IF NOT EXISTS feature_update_reads (
      id TEXT PRIMARY KEY,
      update_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(update_id, user_id)
    );
    `,
    [],
    { fallback: false }
  );

  await dbRun(
    `
    CREATE TABLE IF NOT EXISTS feature_update_events (
      id TEXT PRIMARY KEY,
      update_id TEXT NOT NULL,
      user_id TEXT,
      organization_id TEXT,
      event_type TEXT NOT NULL,
      event_data TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    [],
    { fallback: false }
  );

  // Indexes (best-effort)
  try {
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feature_updates_org_status_published ON feature_updates(organization_id, status, published_at);`,
      [],
      { fallback: false }
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feature_update_reads_user ON feature_update_reads(user_id, read_at);`,
      [],
      { fallback: false }
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_feature_update_events_update ON feature_update_events(update_id, created_at);`,
      [],
      { fallback: false }
    );
  } catch {
    // ignore
  }
}

function requireAdmin(req: AuthRequest): void {
  const role = String((req.user as any)?.role || '').toUpperCase();
  if (!['ADMIN', 'OWNER', 'SUPERADMIN', 'SUPER_ADMIN'].includes(role)) {
    const err: any = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

async function isSmtpConfigured(): Promise<boolean> {
  try {
    const rows = await dbAll<{ key: string; value: string }>(
      "SELECT key, value FROM settings WHERE key IN ('smtp_host', 'smtp_user')",
      [],
      { fallback: true }
    );
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const host = map.get('smtp_host') || process.env.SMTP_HOST || '';
    const user = map.get('smtp_user') || process.env.SMTP_USER || '';
    return Boolean(host && user);
  } catch {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function logUpdateEvent(params: {
  updateId: string;
  userId?: string | null;
  organizationId?: string | null;
  eventType: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO feature_update_events (id, update_id, user_id, organization_id, event_type, event_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        params.updateId,
        params.userId || null,
        params.organizationId || null,
        params.eventType,
        JSON.stringify(params.data || {}),
        nowIso(),
      ],
      { fallback: true }
    );
  } catch {
    // ignore
  }
}

/**
 * GET /api/updates/feed
 * List published updates for the user's organization (plus global ones).
 */
router.get(
  '/feed',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();

    const userId = req.user?.id;
    const orgId = (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
    const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 20)));

    const rows = await dbAll<UpdateRow>(
      `
        SELECT fu.*
        FROM feature_updates fu
        WHERE fu.status = 'published'
          AND (fu.organization_id = ? OR fu.organization_id IS NULL)
        ORDER BY fu.published_at DESC, fu.created_at DESC
        LIMIT ?
      `,
      [orgId, limit],
      { fallback: false }
    );

    const reads = await dbAll<{ update_id: string; read_at: string }>(
      `SELECT update_id, read_at FROM feature_update_reads WHERE user_id = ?`,
      [userId],
      { fallback: false }
    );
    const readMap = new Map(reads.map((r) => [r.update_id, r.read_at]));

    const items = rows.map((u) => ({
      id: u.id,
      title: u.title,
      bodyMd: u.body_md,
      tags: safeJson<string[]>(u.tags, []),
      importance: (u.importance as any) || 'normal',
      publishedAt: u.published_at,
      actionPayload: safeJson<Record<string, unknown>>(u.action_payload, {}),
      isRead: readMap.has(u.id),
      readAt: readMap.get(u.id) || null,
    }));

    return res.json({ success: true, items });
  })
);

/**
 * POST /api/updates/:id/read
 * Mark update as read for the current user.
 */
router.post(
  '/:id/read',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();

    const userId = req.user?.id;
    const orgId = (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
    const updateId = String(req.params.id || '').trim();
    if (!updateId) return res.status(400).json({ error: 'Invalid update id' });

    // Upsert (SQLite: try insert, then update)
    try {
      await dbRun(
        `INSERT INTO feature_update_reads (id, update_id, user_id, read_at) VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), updateId, userId, nowIso()],
        { fallback: false }
      );
    } catch {
      await dbRun(
        `UPDATE feature_update_reads SET read_at = ? WHERE update_id = ? AND user_id = ?`,
        [nowIso(), updateId, userId],
        { fallback: true }
      );
    }

    await logUpdateEvent({
      updateId,
      userId,
      organizationId: orgId,
      eventType: 'marked_read',
    });

    return res.json({ success: true });
  })
);

/**
 * POST /api/updates/:id/opened
 */
router.post(
  '/:id/opened',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();
    const updateId = String(req.params.id || '').trim();
    const userId = req.user?.id || null;
    const orgId = (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;

    await logUpdateEvent({ updateId, userId, organizationId: orgId, eventType: 'update_opened' });
    return res.json({ success: true });
  })
);

/**
 * POST /api/updates/:id/clicked
 */
router.post(
  '/:id/clicked',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();
    const updateId = String(req.params.id || '').trim();
    const userId = req.user?.id || null;
    const orgId = (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
    const url = String(req.body?.url || '').slice(0, 1000);

    await logUpdateEvent({
      updateId,
      userId,
      organizationId: orgId,
      eventType: 'update_clicked',
      data: { url },
    });
    return res.json({ success: true });
  })
);

// -----------------------------
// Admin publishing endpoints
// -----------------------------

router.get(
  '/admin/list',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();
    requireAdmin(req);

    const orgId = (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
    const rows = await dbAll<UpdateRow>(
      `SELECT * FROM feature_updates WHERE organization_id = ? OR organization_id IS NULL ORDER BY created_at DESC LIMIT 100`,
      [orgId],
      { fallback: false }
    );

    return res.json({
      success: true,
      items: rows.map((u) => ({
        id: u.id,
        title: u.title,
        bodyMd: u.body_md,
        tags: safeJson<string[]>(u.tags, []),
        importance: u.importance,
        status: u.status,
        publishedAt: u.published_at,
        actionPayload: safeJson<Record<string, unknown>>(u.action_payload, {}),
        createdAt: u.created_at,
      })),
    });
  })
);

router.post(
  '/admin/create',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();
    requireAdmin(req);

    const orgId = (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
    const userId = req.user?.id || null;
    const title = String(req.body?.title || '').trim();
    const bodyMd = String(req.body?.bodyMd || req.body?.body_md || '').trim();
    const importance = String(req.body?.importance || 'normal');
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const actionPayload = req.body?.actionPayload || {};

    if (!title || !bodyMd) {
      return res.status(400).json({ error: 'title and bodyMd are required' });
    }

    const id = crypto.randomUUID();
    await dbRun(
      `INSERT INTO feature_updates (id, organization_id, title, body_md, tags, importance, status, action_payload, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [
        id,
        orgId,
        title,
        bodyMd,
        JSON.stringify(tags),
        importance,
        JSON.stringify(actionPayload || {}),
        nowIso(),
        nowIso(),
        userId,
      ],
      { fallback: false }
    );

    return res.json({ success: true, id });
  })
);

router.put(
  '/admin/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();
    requireAdmin(req);

    const updateId = String(req.params.id || '').trim();
    const title = String(req.body?.title || '').trim();
    const bodyMd = String(req.body?.bodyMd || req.body?.body_md || '').trim();
    const importance = String(req.body?.importance || 'normal');
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const actionPayload = req.body?.actionPayload || {};

    const row = await dbGet<UpdateRow>(`SELECT * FROM feature_updates WHERE id = ?`, [updateId], {
      fallback: false,
    });
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.status !== 'draft')
      return res.status(400).json({ error: 'Only draft updates can be edited' });

    await dbRun(
      `UPDATE feature_updates SET title = ?, body_md = ?, tags = ?, importance = ?, action_payload = ?, updated_at = ? WHERE id = ?`,
      [
        title || row.title,
        bodyMd || row.body_md,
        JSON.stringify(tags),
        importance,
        JSON.stringify(actionPayload || {}),
        nowIso(),
        updateId,
      ],
      { fallback: false }
    );

    return res.json({ success: true });
  })
);

router.post(
  '/admin/:id/publish',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();
    requireAdmin(req);

    const updateId = String(req.params.id || '').trim();
    const orgId = (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
    const actorId = req.user?.id || null;

    const update = await dbGet<UpdateRow>(
      `SELECT * FROM feature_updates WHERE id = ?`,
      [updateId],
      {
        fallback: false,
      }
    );
    if (!update) return res.status(404).json({ error: 'Not found' });
    if (update.status !== 'draft')
      return res.status(400).json({ error: 'Only draft updates can be published' });

    // Throttling (email only): max N per 7 days per org
    const MAX_EMAIL_PER_WEEK = 3;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentCountRows = await dbAll<{ count: number }>(
      `SELECT COUNT(*) as count FROM feature_updates WHERE organization_id = ? AND status = 'published' AND published_at >= ?`,
      [orgId, weekAgo],
      { fallback: true }
    );
    const recentCount = Number((recentCountRows?.[0] as any)?.count || 0);

    await dbRun(
      `UPDATE feature_updates SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`,
      [nowIso(), nowIso(), updateId],
      { fallback: false }
    );

    await logUpdateEvent({
      updateId,
      userId: actorId,
      organizationId: orgId,
      eventType: 'update_published',
      data: { importance: update.importance, tags: safeJson(update.tags, []) },
    });

    // In-app notification distribution (org users)
    const users = await dbAll<{ id: string; email?: string }>(
      `SELECT id, email FROM users WHERE organization_id = ?`,
      [orgId],
      { fallback: true }
    );

    const notifType = 'FEATURE_UPDATE';
    const actionPayload = safeJson<Record<string, unknown>>(update.action_payload, {});
    const actionHint =
      typeof (actionPayload as any)?.label === 'string'
        ? String((actionPayload as any).label)
        : null;

    for (const u of users) {
      try {
        await notificationService.send({
          userId: u.id,
          organizationId: orgId,
          type: notifType,
          title: update.title,
          message: actionHint ? `${update.title} — ${actionHint}` : update.title,
          severity: update.importance === 'high' ? 'WARNING' : 'INFO',
          priority: update.importance === 'high' ? 'high' : 'normal',
          metadata: {
            featureUpdateId: updateId,
            tags: safeJson(update.tags, []),
            importance: update.importance,
          },
          data: {
            kind: 'feature_update',
            featureUpdateId: updateId,
          },
        } as any);
      } catch (e: any) {
        logger.warn('[FeatureUpdates] Notification send failed', { message: e?.message || e });
      }
    }

    // Email distribution (optional): only if SMTP configured + not too noisy + non-low importance
    const emailConfigured = await isSmtpConfigured();
    const shouldEmail =
      emailConfigured && recentCount < MAX_EMAIL_PER_WEEK && update.importance !== 'low';
    if (shouldEmail) {
      const subject = `[Consultify] ${update.title}`;
      const html =
        `<h2 style="margin:0 0 8px 0;">${escapeHtml(update.title)}</h2>` +
        `<div style="color:#475569; font-size:14px; line-height:1.5; white-space:pre-wrap;">${escapeHtml(update.body_md)}</div>` +
        `<p style="color:#64748b; font-size:12px; margin-top:16px;">Open Consultify to try it now.</p>`;

      for (const u of users) {
        if (!u.email) continue;
        try {
          await EmailService.sendEmail(String(u.email), subject, html);
        } catch {
          // ignore
        }
      }
    }

    return res.json({ success: true, emailed: shouldEmail });
  })
);

export default router;
