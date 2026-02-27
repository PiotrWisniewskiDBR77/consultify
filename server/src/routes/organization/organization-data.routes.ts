// @ts-nocheck
/**
 * Organization Data Routes
 * Provides data export, stats, and retention settings for Data Management UI.
 */
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();
router.use(verifyToken);

const SAFE_IDENT_RE = /^[a-zA-Z0-9_]+$/;

const SENSITIVE_COL_RE =
  /(password|pass_hash|hash|salt|token|secret|api_key|apikey|refresh|access|private|encryption|otp|mfa)/i;

const isSafeIdentifier = (ident: string): boolean => SAFE_IDENT_RE.test(ident);

const getSqliteColumns = async (table: string): Promise<string[]> => {
  if (!isSafeIdentifier(table)) return [];
  const rows = await dbAll<{ name?: string }>(`PRAGMA table_info(${table})`, []);
  return (rows || []).map((r) => String(r?.name || '').trim()).filter(Boolean);
};

const detectOrgColumn = (cols: string[]): string | null => {
  const candidates = ['organization_id', 'organizationId', 'org_id', 'orgId'];
  return candidates.find((c) => cols.includes(c)) || null;
};

const buildOrgScopedSelect = async (
  table: string,
  orgId: string,
  options?: { baseAlias?: string }
): Promise<{ selectPrefix: string; orgWhere: string; orgParams: unknown[]; scoped: boolean }> => {
  const baseAlias = options?.baseAlias || 't';
  const cols = await getSqliteColumns(table);
  if (cols.length === 0) {
    return { selectPrefix: `${table} ${baseAlias}`, orgWhere: '1=0', orgParams: [], scoped: false };
  }

  const orgCol = detectOrgColumn(cols);
  if (orgCol) {
    return {
      selectPrefix: `${table} ${baseAlias}`,
      orgWhere: `${baseAlias}.${orgCol} = ?`,
      orgParams: [orgId],
      scoped: true,
    };
  }

  if (cols.includes('project_id') || cols.includes('projectId')) {
    const projectIdCol = cols.includes('project_id') ? 'project_id' : 'projectId';
    const projectCols = await getSqliteColumns('projects');
    const projectsOrgCol = detectOrgColumn(projectCols);
    if (projectsOrgCol) {
      return {
        selectPrefix: `${table} ${baseAlias} JOIN projects p ON p.id = ${baseAlias}.${projectIdCol}`,
        orgWhere: `p.${projectsOrgCol} = ?`,
        orgParams: [orgId],
        scoped: true,
      };
    }
  }

  if (cols.includes('user_id') || cols.includes('userId')) {
    const userIdCol = cols.includes('user_id') ? 'user_id' : 'userId';
    const userCols = await getSqliteColumns('users');
    const usersOrgCol = detectOrgColumn(userCols);
    if (usersOrgCol) {
      return {
        selectPrefix: `${table} ${baseAlias} JOIN users u ON u.id = ${baseAlias}.${userIdCol}`,
        orgWhere: `u.${usersOrgCol} = ?`,
        orgParams: [orgId],
        scoped: true,
      };
    }
  }

  return {
    selectPrefix: `${table} ${baseAlias}`,
    orgWhere: '1=0',
    orgParams: [],
    scoped: false,
  };
};

const safeSelectRows = async (
  table: string,
  orgId: string,
  opts?: { limit?: number; orderBy?: string }
): Promise<{ rows: unknown[]; scoped: boolean; selectedColumns: string[] }> => {
  const cols = await getSqliteColumns(table);
  if (cols.length === 0) return { rows: [], scoped: false, selectedColumns: [] };

  const allowedCols = cols.filter((c) => !SENSITIVE_COL_RE.test(c));
  if (allowedCols.length === 0) return { rows: [], scoped: false, selectedColumns: [] };

  const { selectPrefix, orgWhere, orgParams, scoped } = await buildOrgScopedSelect(table, orgId);
  const orderBy = opts?.orderBy && isSafeIdentifier(opts.orderBy) ? opts.orderBy : null;
  const limit = Number.isFinite(opts?.limit) ? Math.max(1, Math.min(5000, opts!.limit!)) : 5000;

  const sql = `
    SELECT ${allowedCols.map((c) => `t.${c}`).join(', ')}
    FROM ${selectPrefix}
    WHERE ${orgWhere}
    ${orderBy ? `ORDER BY t.${orderBy} DESC` : ''}
    LIMIT ${limit}
  `;
  const rows = await dbAll(sql, orgParams);
  return { rows: Array.isArray(rows) ? rows : [], scoped, selectedColumns: allowedCols };
};

const safeCountRows = async (
  table: string,
  orgId: string
): Promise<{ count: number; scoped: boolean }> => {
  const cols = await getSqliteColumns(table);
  if (cols.length === 0) return { count: 0, scoped: false };

  const { selectPrefix, orgWhere, orgParams, scoped } = await buildOrgScopedSelect(table, orgId);
  const row = await dbGet<{ count?: number }>(
    `SELECT COUNT(*) as count FROM ${selectPrefix} WHERE ${orgWhere}`,
    orgParams
  );
  return { count: Number(row?.count || 0), scoped };
};

// Retention table
const ensureRetentionTable = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS organization_data_retention (
            organization_id TEXT PRIMARY KEY,
            audit_log_retention TEXT DEFAULT 'forever',
            auto_delete_inactive INTEGER DEFAULT 0,
            inactive_days INTEGER DEFAULT 365,
            updated_at TEXT DEFAULT (datetime('now')),
            updated_by TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )
    `);
};

/**
 * GET /api/organization-data/stats
 * Returns counts for data categories.
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId)
        return res.status(400).json({ success: false, error: 'Organization ID required' });

      const users = await safeCountRows('users', orgId);
      const projects = await safeCountRows('projects', orgId);
      const tasks = await safeCountRows('tasks', orgId);

      const decisionsPrimary =
        (await safeCountRows('action_decisions', orgId)).count > 0
          ? await safeCountRows('action_decisions', orgId)
          : await safeCountRows('decisions', orgId);

      const documentsPrimary =
        (await safeCountRows('documents', orgId)).count > 0
          ? await safeCountRows('documents', orgId)
          : await safeCountRows('attachments', orgId);

      const auditPrimary =
        (await safeCountRows('audit_log', orgId)).count > 0
          ? await safeCountRows('audit_log', orgId)
          : await safeCountRows('activity_log', orgId);

      return res.json({
        success: true,
        stats: {
          users: users.count,
          projects: projects.count,
          tasks: tasks.count,
          decisions: decisionsPrimary.count,
          documents: documentsPrimary.count,
          audit: auditPrimary.count,
        },
        meta: {
          scoped: {
            users: users.scoped,
            projects: projects.scoped,
            tasks: tasks.scoped,
            decisions: decisionsPrimary.scoped,
            documents: documentsPrimary.scoped,
            audit: auditPrimary.scoped,
          },
        },
      });
    } catch (err) {
      logger.error('[organization-data] stats error', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
  })
);

/**
 * POST /api/organization-data/export/:category
 * Returns JSON blob for a single category.
 */
router.post(
  '/export/:category',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { category } = req.params;
    try {
      const orgId = req.user?.organizationId;
      if (!orgId)
        return res.status(400).json({ success: false, error: 'Organization ID required' });

      const nowIso = new Date().toISOString();
      const filename = `org-${orgId}-${category}-${nowIso.slice(0, 10)}.json`;

      const makeAttachment = (payload: unknown) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(JSON.stringify(payload, null, 2));
      };

      if (category === 'users') {
        const { rows, scoped, selectedColumns } = await safeSelectRows('users', orgId, {
          orderBy: 'created_at',
        });
        return makeAttachment({
          exportedAt: nowIso,
          organizationId: orgId,
          category,
          scoped,
          selectedColumns,
          rows,
        });
      }
      if (category === 'projects') {
        const { rows, scoped, selectedColumns } = await safeSelectRows('projects', orgId, {
          orderBy: 'created_at',
        });
        return makeAttachment({
          exportedAt: nowIso,
          organizationId: orgId,
          category,
          scoped,
          selectedColumns,
          rows,
        });
      }
      if (category === 'tasks') {
        const { rows, scoped, selectedColumns } = await safeSelectRows('tasks', orgId, {
          orderBy: 'updated_at',
        });
        return makeAttachment({
          exportedAt: nowIso,
          organizationId: orgId,
          category,
          scoped,
          selectedColumns,
          rows,
        });
      }
      if (category === 'decisions') {
        const primary =
          (await getSqliteColumns('action_decisions')).length > 0
            ? 'action_decisions'
            : 'decisions';
        const { rows, scoped, selectedColumns } = await safeSelectRows(primary, orgId, {
          orderBy: 'updated_at',
        });
        return makeAttachment({
          exportedAt: nowIso,
          organizationId: orgId,
          category,
          scoped,
          selectedColumns,
          rows,
          meta: { primaryTable: primary },
        });
      }
      if (category === 'documents') {
        const docs = await safeSelectRows('documents', orgId, { orderBy: 'updated_at' });
        const attachments = await safeSelectRows('attachments', orgId, { orderBy: 'updated_at' });
        return makeAttachment({
          exportedAt: nowIso,
          organizationId: orgId,
          category,
          scoped: docs.scoped || attachments.scoped,
          data: {
            documents: docs.rows,
            attachments: attachments.rows,
          },
          meta: {
            columns: {
              documents: docs.selectedColumns,
              attachments: attachments.selectedColumns,
            },
            scoped: {
              documents: docs.scoped,
              attachments: attachments.scoped,
            },
          },
        });
      }
      if (category === 'audit') {
        const auditLog = await safeSelectRows('audit_log', orgId, { orderBy: 'created_at' });
        const activityLog = await safeSelectRows('activity_log', orgId, { orderBy: 'created_at' });
        return makeAttachment({
          exportedAt: nowIso,
          organizationId: orgId,
          category,
          scoped: auditLog.scoped || activityLog.scoped,
          data: {
            audit_log: auditLog.rows,
            activity_log: activityLog.rows,
          },
          meta: {
            columns: {
              audit_log: auditLog.selectedColumns,
              activity_log: activityLog.selectedColumns,
            },
            scoped: {
              audit_log: auditLog.scoped,
              activity_log: activityLog.scoped,
            },
          },
        });
      }

      return res
        .status(400)
        .json({ success: false, error: `Unknown export category: ${category}` });
    } catch (err) {
      logger.error('[organization-data] export category error', err);
      return res.status(500).json({ success: false, error: 'Export failed' });
    }
  })
);

/**
 * POST /api/organization-data/export/all
 * Returns JSON blob for full export.
 */
router.post(
  '/export/all',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId)
        return res.status(400).json({ success: false, error: 'Organization ID required' });

      const nowIso = new Date().toISOString();
      const filename = `org-${orgId}-full-export-${nowIso.slice(0, 10)}.json`;

      const payload = {
        exportedAt: nowIso,
        organizationId: orgId,
        data: {
          users: (await safeSelectRows('users', orgId, { orderBy: 'created_at' })).rows,
          projects: (await safeSelectRows('projects', orgId, { orderBy: 'created_at' })).rows,
          tasks: (await safeSelectRows('tasks', orgId, { orderBy: 'updated_at' })).rows,
          decisions: (
            await safeSelectRows(
              (await getSqliteColumns('action_decisions')).length > 0
                ? 'action_decisions'
                : 'decisions',
              orgId,
              { orderBy: 'updated_at' }
            )
          ).rows,
          documents: (await safeSelectRows('documents', orgId, { orderBy: 'updated_at' })).rows,
          attachments: (await safeSelectRows('attachments', orgId, { orderBy: 'updated_at' })).rows,
          audit_log: (await safeSelectRows('audit_log', orgId, { orderBy: 'created_at' })).rows,
          activity_log: (await safeSelectRows('activity_log', orgId, { orderBy: 'created_at' }))
            .rows,
        },
      };

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (err) {
      logger.error('[organization-data] export all error', err);
      return res.status(500).json({ success: false, error: 'Export failed' });
    }
  })
);

/**
 * GET /api/organization-data/retention
 * Returns retention settings.
 */
router.get(
  '/retention',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    await ensureRetentionTable();
    const row = await dbGet(
      `SELECT audit_log_retention, auto_delete_inactive, inactive_days FROM organization_data_retention WHERE organization_id = ?`,
      [orgId]
    );
    const defaults = {
      auditLogRetention: 'forever',
      autoDeleteInactive: false,
      inactiveDays: 365,
    };
    if (!row) return res.json(defaults);
    return res.json({
      auditLogRetention: row.audit_log_retention || defaults.auditLogRetention,
      autoDeleteInactive: !!row.auto_delete_inactive,
      inactiveDays: row.inactive_days ?? defaults.inactiveDays,
    });
  })
);

/**
 * PUT /api/organization-data/retention
 * Updates retention settings.
 */
router.put(
  '/retention',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    const {
      auditLogRetention,
      autoDeleteInactive,
      inactiveDays,
      // Compatibility with different frontend payload versions
      auditLogRetentionDays,
      autoDeleteEnabled,
      activityRetentionDays,
    } = req.body || {};

    const normalizedAuditLogRetention = (() => {
      if (typeof auditLogRetention === 'string' && auditLogRetention.trim())
        return auditLogRetention.trim();
      const days = Number(auditLogRetentionDays);
      if (Number.isFinite(days)) return days <= 0 ? 'forever' : String(Math.round(days));
      return 'forever';
    })();

    const normalizedAutoDelete = Boolean(
      typeof autoDeleteInactive === 'boolean' ? autoDeleteInactive : autoDeleteEnabled
    );

    const normalizedInactiveDays = (() => {
      if (Number.isFinite(Number(inactiveDays))) return Number(inactiveDays);
      if (Number.isFinite(Number(activityRetentionDays))) return Number(activityRetentionDays);
      return 365;
    })();
    await ensureRetentionTable();
    await dbRun(
      `INSERT INTO organization_data_retention (organization_id, audit_log_retention, auto_delete_inactive, inactive_days, updated_at, updated_by)
             VALUES (?, ?, ?, ?, datetime('now'), ?)
             ON CONFLICT(organization_id) DO UPDATE SET
                audit_log_retention=excluded.audit_log_retention,
                auto_delete_inactive=excluded.auto_delete_inactive,
                inactive_days=excluded.inactive_days,
                updated_at=datetime('now'),
                updated_by=excluded.updated_by`,
      [
        orgId,
        normalizedAuditLogRetention,
        normalizedAutoDelete ? 1 : 0,
        normalizedInactiveDays,
        req.user?.id || null,
      ]
    );
    return res.json({ success: true });
  })
);

export default router;
