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
  status: 'draft' | 'review' | 'published' | 'archived' | string;
  action_payload: string;
  audience: 'all' | 'admins' | 'superadmins' | 'roles' | string;
  target_roles: string;
  surface: 'global' | 'module' | 'view' | string;
  module_id: string | null;
  target_view: string | null;
  change_type: 'new_feature' | 'improvement' | 'important_change' | 'risk_or_breaking' | string;
  effective_from: string | null;
  expires_at: string | null;
  requires_ack: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  published_by: string | null;
  opened_count?: number;
  clicked_count?: number;
  read_count?: number;
};

type UpdateStatus = 'draft' | 'review' | 'published' | 'archived';

const nowIso = () => new Date().toISOString();
const VALID_STATUSES = new Set(['draft', 'review', 'published', 'archived']);
const VALID_IMPORTANCE = new Set(['low', 'normal', 'high']);
const VALID_AUDIENCES = new Set(['all', 'admins', 'superadmins', 'roles']);
const VALID_SURFACES = new Set(['global', 'module', 'view']);
const VALID_CHANGE_TYPES = new Set([
  'new_feature',
  'improvement',
  'important_change',
  'risk_or_breaking',
]);

const safeJson = <T>(value: unknown, fallback: T): T => {
  try {
    if (typeof value === 'string') return JSON.parse(value) as T;
    return fallback;
  } catch {
    return fallback;
  }
};

async function ensureFeatureUpdatesSchema(): Promise<void> {
  // Fail-soft: this opportunistic DDL runs first in the "what's new" feed read
  // path (GET /feed), which loads on virtually every page. Use fallback:true so a
  // transient DDL failure (lock/timeout/brief read-only) can NEVER reject and
  // bubble up as a bare HTTP 500 / white screen — the feed degrades to empty
  // instead. The additive ALTERs and indexes below keep their own try/catch.
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
      audience TEXT DEFAULT 'all',
      target_roles TEXT DEFAULT '[]',
      surface TEXT DEFAULT 'global',
      module_id TEXT,
      target_view TEXT,
      change_type TEXT DEFAULT 'improvement',
      effective_from TIMESTAMP,
      expires_at TIMESTAMP,
      requires_ack INTEGER DEFAULT 0,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      published_by TEXT
    );
    `,
    [],
    { fallback: true }
  );

  const extraColumns = [
    "ALTER TABLE feature_updates ADD COLUMN audience TEXT DEFAULT 'all'",
    "ALTER TABLE feature_updates ADD COLUMN target_roles TEXT DEFAULT '[]'",
    "ALTER TABLE feature_updates ADD COLUMN surface TEXT DEFAULT 'global'",
    'ALTER TABLE feature_updates ADD COLUMN module_id TEXT',
    'ALTER TABLE feature_updates ADD COLUMN target_view TEXT',
    "ALTER TABLE feature_updates ADD COLUMN change_type TEXT DEFAULT 'improvement'",
    'ALTER TABLE feature_updates ADD COLUMN effective_from TIMESTAMP',
    'ALTER TABLE feature_updates ADD COLUMN expires_at TIMESTAMP',
    'ALTER TABLE feature_updates ADD COLUMN requires_ack INTEGER DEFAULT 0',
    'ALTER TABLE feature_updates ADD COLUMN published_by TEXT',
  ];
  for (const sql of extraColumns) {
    try {
      await dbRun(sql, [], { fallback: false });
    } catch {
      // Column already exists or DB does not support repeated alter; safe to ignore.
    }
  }

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
    { fallback: true }
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
    { fallback: true }
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
  if (!['ADMIN', 'ADMINISTRATOR', 'OWNER', 'SUPERADMIN', 'SUPER_ADMIN'].includes(role)) {
    const err: any = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

function isSuperAdmin(req: AuthRequest): boolean {
  const role = String(req.userRole || (req.user as any)?.role || '').toUpperCase();
  return Boolean(req.user?.isSuperAdmin || role === 'SUPERADMIN' || role === 'SUPER_ADMIN');
}

function normalizeRole(role: unknown, superadmin = false): string {
  if (superadmin) return 'SUPERADMIN';
  const raw = String(role || '')
    .trim()
    .toUpperCase();
  if (['SUPERADMIN', 'SUPER_ADMIN', 'OWNER'].includes(raw)) return 'SUPERADMIN';
  if (['ADMIN', 'ADMINISTRATOR'].includes(raw)) return 'ADMIN';
  if (['PROJECT_MANAGER', 'MANAGER'].includes(raw)) return 'PROJECT_MANAGER';
  if (['TEAM_MEMBER', 'MEMBER', 'USER'].includes(raw)) return 'TEAM_MEMBER';
  if (['VIEWER', 'GUEST', 'CLIENT'].includes(raw)) return 'VIEWER';
  return raw || 'VIEWER';
}

function sanitizeEnum<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();
  return (allowed.has(normalized) ? normalized : fallback) as T;
}

function sanitizeRoles(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      arr
        .map((entry) => normalizeRole(entry))
        .filter(Boolean)
        .slice(0, 20)
    )
  );
}

function parseBooleanFlag(value: unknown): number {
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  return 0;
}

function parseNullableIso(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function canManageUpdate(req: AuthRequest, row: UpdateRow): boolean {
  if (isSuperAdmin(req)) return true;
  const orgId = (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
  return Boolean(row.organization_id && orgId && row.organization_id === orgId);
}

function matchesAudience(update: UpdateRow, userRole: string, superadmin: boolean): boolean {
  const audience = sanitizeEnum(update.audience, VALID_AUDIENCES, 'all');
  if (audience === 'all') return true;
  if (audience === 'admins') return ['ADMIN', 'SUPERADMIN'].includes(userRole);
  if (audience === 'superadmins') return superadmin;
  const targetedRoles = safeJson<string[]>(update.target_roles, []).map((role) =>
    normalizeRole(role)
  );
  if (targetedRoles.length === 0) return true;
  return targetedRoles.includes(userRole);
}

function mapUpdateRow(row: UpdateRow) {
  const targetRoles = safeJson<string[]>(row.target_roles, []).map((role) => normalizeRole(role));
  const scope = row.organization_id ? 'organization' : 'global';
  return {
    id: row.id,
    organizationId: row.organization_id,
    scope,
    title: row.title,
    bodyMd: row.body_md,
    tags: safeJson<string[]>(row.tags, []),
    importance: sanitizeEnum(row.importance, VALID_IMPORTANCE, 'normal'),
    status: sanitizeEnum(row.status, VALID_STATUSES, 'draft'),
    actionPayload: safeJson<Record<string, unknown>>(row.action_payload, {}),
    audience: sanitizeEnum(row.audience, VALID_AUDIENCES, 'all'),
    targetRoles,
    surface: sanitizeEnum(row.surface, VALID_SURFACES, 'global'),
    moduleId: row.module_id || null,
    targetView: row.target_view || null,
    changeType: sanitizeEnum(row.change_type, VALID_CHANGE_TYPES, 'improvement'),
    effectiveFrom: row.effective_from,
    expiresAt: row.expires_at,
    requiresAck: Boolean(row.requires_ack),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    publishedBy: row.published_by,
    analytics: {
      opened: Number(row.opened_count || 0),
      clicked: Number(row.clicked_count || 0),
      read: Number(row.read_count || 0),
    },
  };
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
    const superadmin = isSuperAdmin(req);
    const userRole = normalizeRole(req.userRole || (req.user as any)?.role, superadmin);
    const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 20)));
    const currentView = String(req.query?.view || '').trim();
    const now = nowIso();

    const rows = await dbAll<UpdateRow>(
      `
        SELECT fu.*
        FROM feature_updates fu
        WHERE fu.status = 'published'
          AND (fu.organization_id = ? OR fu.organization_id IS NULL)
          AND (fu.effective_from IS NULL OR fu.effective_from <= ?)
          AND (fu.expires_at IS NULL OR fu.expires_at > ?)
        ORDER BY fu.published_at DESC, fu.created_at DESC
        LIMIT ?
      `,
      [orgId, now, now, limit],
      { fallback: true }
    );

    const reads = await dbAll<{ update_id: string; read_at: string }>(
      `SELECT update_id, read_at FROM feature_update_reads WHERE user_id = ?`,
      [userId],
      { fallback: true }
    );
    const readMap = new Map(reads.map((r) => [r.update_id, r.read_at]));

    const items = rows
      .filter((row) => matchesAudience(row, userRole, superadmin))
      .map((row) => {
        const mapped = mapUpdateRow(row);
        return {
          ...mapped,
          isRead: readMap.has(row.id),
          readAt: readMap.get(row.id) || null,
          isContextMatch: Boolean(
            currentView && mapped.targetView && mapped.targetView === currentView
          ),
        };
      })
      .sort((a, b) => Number(b.isContextMatch) - Number(a.isContextMatch));

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
    const superadmin = isSuperAdmin(req);
    const scope = String(req.query?.scope || 'relevant')
      .trim()
      .toLowerCase();
    const requestedOrgId = String(req.query?.organizationId || '').trim();
    const status = String(req.query?.status || 'all')
      .trim()
      .toLowerCase();

    const params: Array<string | number | null> = [];
    let whereSql = 'WHERE 1 = 1';

    if (superadmin) {
      if (scope === 'global') {
        whereSql += ' AND fu.organization_id IS NULL';
      } else if (scope === 'organization') {
        if (requestedOrgId) {
          whereSql += ' AND fu.organization_id = ?';
          params.push(requestedOrgId);
        } else {
          whereSql += ' AND fu.organization_id IS NOT NULL';
        }
      } else if (requestedOrgId) {
        whereSql += ' AND fu.organization_id = ?';
        params.push(requestedOrgId);
      }
    } else {
      whereSql += ' AND (fu.organization_id = ? OR fu.organization_id IS NULL)';
      params.push(orgId);
    }

    if (status !== 'all' && VALID_STATUSES.has(status)) {
      whereSql += ' AND fu.status = ?';
      params.push(status);
    }

    const rows = await dbAll<UpdateRow>(
      `SELECT fu.*,
              (SELECT COUNT(*) FROM feature_update_events e WHERE e.update_id = fu.id AND e.event_type = 'update_opened') AS opened_count,
              (SELECT COUNT(*) FROM feature_update_events e WHERE e.update_id = fu.id AND e.event_type = 'update_clicked') AS clicked_count,
              (SELECT COUNT(*) FROM feature_update_reads r WHERE r.update_id = fu.id) AS read_count
         FROM feature_updates fu
         ${whereSql}
        ORDER BY CASE fu.status
          WHEN 'review' THEN 0
          WHEN 'draft' THEN 1
          WHEN 'published' THEN 2
          ELSE 3
        END, COALESCE(fu.published_at, fu.updated_at, fu.created_at) DESC
        LIMIT 200`,
      params,
      { fallback: false }
    );

    const items = rows.filter(
      (row) => superadmin || canManageUpdate(req, row) || row.organization_id === null
    );
    const summary = {
      total: items.length,
      draft: items.filter((row) => row.status === 'draft').length,
      review: items.filter((row) => row.status === 'review').length,
      published: items.filter((row) => row.status === 'published').length,
      archived: items.filter((row) => row.status === 'archived').length,
      global: items.filter((row) => !row.organization_id).length,
      organization: items.filter((row) => Boolean(row.organization_id)).length,
    };

    return res.json({
      success: true,
      summary,
      items: items.map(mapUpdateRow),
    });
  })
);

router.post(
  '/admin/create',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();
    requireAdmin(req);

    const actorOrgId =
      (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
    const userId = req.user?.id || null;
    const superadmin = isSuperAdmin(req);
    const title = String(req.body?.title || '').trim();
    const bodyMd = String(req.body?.bodyMd || req.body?.body_md || '').trim();
    const importance = sanitizeEnum(req.body?.importance, VALID_IMPORTANCE, 'normal');
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const actionPayload = req.body?.actionPayload || {};
    const requestedOrgId = String(req.body?.organizationId || '').trim();
    const organizationId = superadmin ? requestedOrgId || null : actorOrgId;
    const audience = sanitizeEnum(req.body?.audience, VALID_AUDIENCES, 'all');
    const targetRoles = sanitizeRoles(req.body?.targetRoles);
    const surface = sanitizeEnum(req.body?.surface, VALID_SURFACES, 'global');
    const changeType = sanitizeEnum(req.body?.changeType, VALID_CHANGE_TYPES, 'improvement');
    const effectiveFrom = parseNullableIso(req.body?.effectiveFrom);
    const expiresAt = parseNullableIso(req.body?.expiresAt);
    const requiresAck = parseBooleanFlag(req.body?.requiresAck);
    const moduleId = String(req.body?.moduleId || '').trim() || null;
    const targetView = String(req.body?.targetView || '').trim() || null;
    const requestedStatus = sanitizeEnum(req.body?.status, VALID_STATUSES, 'draft') as UpdateStatus;
    const status: UpdateStatus = superadmin ? requestedStatus : 'draft';

    if (!title || !bodyMd) {
      return res.status(400).json({ error: 'title and bodyMd are required' });
    }
    if (effectiveFrom && expiresAt && effectiveFrom >= expiresAt) {
      return res.status(400).json({ error: 'effectiveFrom must be before expiresAt' });
    }

    const id = crypto.randomUUID();
    await dbRun(
      `INSERT INTO feature_updates (
         id, organization_id, title, body_md, tags, importance, status, action_payload,
         audience, target_roles, surface, module_id, target_view, change_type,
         effective_from, expires_at, requires_ack, created_at, updated_at, created_by
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        title,
        bodyMd,
        JSON.stringify(tags),
        importance,
        status,
        JSON.stringify(actionPayload || {}),
        audience,
        JSON.stringify(targetRoles),
        surface,
        moduleId,
        targetView,
        changeType,
        effectiveFrom,
        expiresAt,
        requiresAck,
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

    const superadmin = isSuperAdmin(req);
    const updateId = String(req.params.id || '').trim();
    const title = String(req.body?.title || '').trim();
    const bodyMd = String(req.body?.bodyMd || req.body?.body_md || '').trim();
    const importance = sanitizeEnum(req.body?.importance, VALID_IMPORTANCE, 'normal');
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const actionPayload = req.body?.actionPayload || {};
    const requestedOrgId = String(req.body?.organizationId || '').trim();
    const audience = sanitizeEnum(req.body?.audience, VALID_AUDIENCES, 'all');
    const targetRoles = sanitizeRoles(req.body?.targetRoles);
    const surface = sanitizeEnum(req.body?.surface, VALID_SURFACES, 'global');
    const changeType = sanitizeEnum(req.body?.changeType, VALID_CHANGE_TYPES, 'improvement');
    const effectiveFrom = parseNullableIso(req.body?.effectiveFrom);
    const expiresAt = parseNullableIso(req.body?.expiresAt);
    const requiresAck = parseBooleanFlag(req.body?.requiresAck);
    const moduleId = String(req.body?.moduleId || '').trim() || null;
    const targetView = String(req.body?.targetView || '').trim() || null;
    const requestedStatus = sanitizeEnum(req.body?.status, VALID_STATUSES, 'draft') as UpdateStatus;

    const row = await dbGet<UpdateRow>(`SELECT * FROM feature_updates WHERE id = ?`, [updateId], {
      fallback: false,
    });
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!canManageUpdate(req, row)) return res.status(403).json({ error: 'Forbidden' });
    if (row.status === 'published') {
      return res
        .status(400)
        .json({ error: 'Published updates cannot be edited; archive and republish instead' });
    }
    if (effectiveFrom && expiresAt && effectiveFrom >= expiresAt) {
      return res.status(400).json({ error: 'effectiveFrom must be before expiresAt' });
    }
    const organizationId = superadmin ? requestedOrgId || null : row.organization_id;
    const nextStatus: UpdateStatus =
      requestedStatus === 'published' ? (row.status as UpdateStatus) : requestedStatus;

    await dbRun(
      `UPDATE feature_updates
          SET organization_id = ?, title = ?, body_md = ?, tags = ?, importance = ?, status = ?,
              action_payload = ?, audience = ?, target_roles = ?, surface = ?, module_id = ?,
              target_view = ?, change_type = ?, effective_from = ?, expires_at = ?, requires_ack = ?,
              updated_at = ?
        WHERE id = ?`,
      [
        organizationId,
        title || row.title,
        bodyMd || row.body_md,
        JSON.stringify(tags),
        importance,
        nextStatus,
        JSON.stringify(actionPayload || {}),
        audience,
        JSON.stringify(targetRoles),
        surface,
        moduleId,
        targetView,
        changeType,
        effectiveFrom,
        expiresAt,
        requiresAck,
        nowIso(),
        updateId,
      ],
      { fallback: false }
    );

    return res.json({ success: true });
  })
);

router.post(
  '/admin/:id/archive',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureFeatureUpdatesSchema();
    requireAdmin(req);

    const updateId = String(req.params.id || '').trim();
    const row = await dbGet<UpdateRow>(`SELECT * FROM feature_updates WHERE id = ?`, [updateId], {
      fallback: false,
    });
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!canManageUpdate(req, row)) return res.status(403).json({ error: 'Forbidden' });

    await dbRun(
      `UPDATE feature_updates
          SET status = 'archived',
              expires_at = COALESCE(expires_at, ?),
              updated_at = ?
        WHERE id = ?`,
      [nowIso(), nowIso(), updateId],
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
    const actorId = req.user?.id || null;
    const actorOrgId =
      (req.user as any)?.organization_id || (req.user as any)?.organizationId || null;
    const actorIsSuperAdmin = isSuperAdmin(req);

    const update = await dbGet<UpdateRow>(
      `SELECT * FROM feature_updates WHERE id = ?`,
      [updateId],
      {
        fallback: false,
      }
    );
    if (!update) return res.status(404).json({ error: 'Not found' });
    if (!canManageUpdate(req, update)) return res.status(403).json({ error: 'Forbidden' });
    if (!['draft', 'review'].includes(update.status))
      return res.status(400).json({ error: 'Only draft or review updates can be published' });

    // Throttling (email only): max N per 7 days per org
    const MAX_EMAIL_PER_WEEK = 3;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentCountRows =
      update.organization_id === null
        ? await dbAll<{ count: number }>(
            `SELECT COUNT(*) as count FROM feature_updates WHERE organization_id IS NULL AND status = 'published' AND published_at >= ?`,
            [weekAgo],
            { fallback: true }
          )
        : await dbAll<{ count: number }>(
            `SELECT COUNT(*) as count FROM feature_updates WHERE organization_id = ? AND status = 'published' AND published_at >= ?`,
            [update.organization_id, weekAgo],
            { fallback: true }
          );
    const recentCount = Number((recentCountRows?.[0] as any)?.count || 0);

    await dbRun(
      `UPDATE feature_updates SET status = 'published', published_at = ?, published_by = ?, updated_at = ? WHERE id = ?`,
      [nowIso(), actorId, nowIso(), updateId],
      { fallback: false }
    );

    await logUpdateEvent({
      updateId,
      userId: actorId,
      organizationId: update.organization_id,
      eventType: 'update_published',
      data: {
        importance: update.importance,
        tags: safeJson(update.tags, []),
        audience: update.audience,
        changeType: update.change_type,
      },
    });

    // In-app notification distribution
    const users =
      update.organization_id === null && actorIsSuperAdmin
        ? await dbAll<{
            id: string;
            email?: string;
            organization_id?: string | null;
            role?: string;
          }>(`SELECT id, email, organization_id, role FROM users`, [], { fallback: true })
        : await dbAll<{
            id: string;
            email?: string;
            organization_id?: string | null;
            role?: string;
          }>(
            `SELECT id, email, organization_id, role FROM users WHERE organization_id = ?`,
            [update.organization_id || actorOrgId],
            { fallback: true }
          );

    const notifType = 'FEATURE_UPDATE';
    const actionPayload = safeJson<Record<string, unknown>>(update.action_payload, {});
    const actionHint =
      typeof (actionPayload as any)?.label === 'string'
        ? String((actionPayload as any).label)
        : null;
    const audience = sanitizeEnum(update.audience, VALID_AUDIENCES, 'all');
    const targetRoles = safeJson<string[]>(update.target_roles, []).map((role) =>
      normalizeRole(role)
    );

    for (const u of users) {
      const recipientRole = normalizeRole((u as any)?.role);
      const recipientIsSuperAdmin = recipientRole === 'SUPERADMIN';
      if (
        !matchesAudience(
          { ...update, audience, target_roles: JSON.stringify(targetRoles) },
          recipientRole,
          recipientIsSuperAdmin
        )
      ) {
        continue;
      }
      try {
        await notificationService.send({
          userId: u.id,
          organizationId: u.organization_id || update.organization_id || null,
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
        const recipientRole = normalizeRole((u as any)?.role);
        const recipientIsSuperAdmin = recipientRole === 'SUPERADMIN';
        if (
          !matchesAudience(
            { ...update, audience, target_roles: JSON.stringify(targetRoles) },
            recipientRole,
            recipientIsSuperAdmin
          )
        ) {
          continue;
        }
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
