// @ts-nocheck
/**
 * Organization Data Routes
 * Provides data export, stats, and retention settings for Data Management UI.
 */
import { Response, Router } from 'express';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();
router.use(verifyToken);

const FEATURE_UNAVAILABLE_CODE = 'FEATURE_UNAVAILABLE';
const featureUnavailable = (res: Response, message: string) =>
  res.status(503).json({ success: false, error: message, code: FEATURE_UNAVAILABLE_CODE });

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
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      return featureUnavailable(res, 'Organization data stats unavailable (no real implementation)');
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
      return featureUnavailable(
        res,
        'Organization data export unavailable (no real implementation)'
      );
    } catch (err) {
      logger.error('[organization-data] export category error', err);
      return res.status(500).json({ error: 'Export failed' });
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
      return featureUnavailable(
        res,
        'Organization data export unavailable (no real implementation)'
      );
    } catch (err) {
      logger.error('[organization-data] export all error', err);
      return res.status(500).json({ error: 'Export failed' });
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
    const { auditLogRetention, autoDeleteInactive, inactiveDays } = req.body || {};
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
        auditLogRetention || 'forever',
        autoDeleteInactive ? 1 : 0,
        inactiveDays ?? 365,
        req.user?.id || null,
      ]
    );
    return res.json({ success: true });
  })
);

export default router;
