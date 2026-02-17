/**
 * Compliance Routes
 * GDPR, Cookie Settings, and Data Protection management
 */
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

// Apply rate limiting and auth
router.use(apiAuthRateLimiter);
router.use(verifyToken);

// Ensure compliance_settings table exists
const ensureTable = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS compliance_settings (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            setting_type TEXT NOT NULL,
            settings_data TEXT NOT NULL,
            enabled INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            updated_by TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            UNIQUE(organization_id, setting_type)
        )
    `);
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_compliance_org ON compliance_settings(organization_id)`
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_settings(setting_type)`
  );
};

// ===========================================
// GDPR COMPLIANCE
// ===========================================

/**
 * GET /api/compliance/gdpr
 * Get GDPR compliance settings for organization
 */
router.get(
  '/gdpr',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    try {
      await ensureTable();

      const settings = await dbGet<{
        settings_data: string;
        enabled: number;
        updated_at: string;
        updated_by: string;
      }>(
        `SELECT settings_data, enabled, updated_at, updated_by 
                 FROM compliance_settings 
                 WHERE organization_id = ? AND setting_type = 'gdpr'`,
        [orgId]
      );

      if (settings?.settings_data) {
        const data = JSON.parse(settings.settings_data);
        return res.json({
          enabled: !!settings.enabled,
          features: data.features || [],
          lastUpdated: settings.updated_at,
          updatedBy: settings.updated_by,
        });
      }

      // Return defaults
      return res.json({
        enabled: false,
        features: [],
        lastUpdated: null,
        updatedBy: null,
      });
    } catch (error: any) {
      logger.error('[compliance] Error fetching GDPR settings:', error);
      return res.status(500).json({ error: 'Failed to fetch GDPR settings' });
    }
  })
);

/**
 * PUT /api/compliance/gdpr
 * Update GDPR compliance settings
 */
router.put(
  '/gdpr',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { enabled, features } = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const normalizedRole = (userRole || '').toLowerCase();
    if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(normalizedRole)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    try {
      await ensureTable();

      const existing = await dbGet(
        `SELECT id FROM compliance_settings WHERE organization_id = ? AND setting_type = 'gdpr'`,
        [orgId]
      );

      const settingsData = JSON.stringify({ features: features || [] });

      if (existing) {
        await dbRun(
          `UPDATE compliance_settings SET 
                        settings_data = ?,
                        enabled = ?,
                        updated_at = datetime('now'),
                        updated_by = ?
                     WHERE organization_id = ? AND setting_type = 'gdpr'`,
          [settingsData, enabled ? 1 : 0, userId, orgId]
        );
      } else {
        await dbRun(
          `INSERT INTO compliance_settings (id, organization_id, setting_type, settings_data, enabled, updated_by)
                     VALUES (?, ?, 'gdpr', ?, ?, ?)`,
          [uuidv4(), orgId, settingsData, enabled ? 1 : 0, userId]
        );
      }

      logger.info(`[compliance] GDPR settings updated for org ${orgId} by user ${userId}`);

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[compliance] Error updating GDPR settings:', error);
      return res.status(500).json({ error: 'Failed to update GDPR settings' });
    }
  })
);

// ===========================================
// COOKIE SETTINGS
// ===========================================

/**
 * GET /api/compliance/cookies
 * Get cookie consent settings for organization
 */
router.get(
  '/cookies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    try {
      await ensureTable();

      const settings = await dbGet<{
        settings_data: string;
        enabled: number;
        updated_at: string;
      }>(
        `SELECT settings_data, enabled, updated_at 
                 FROM compliance_settings 
                 WHERE organization_id = ? AND setting_type = 'cookies'`,
        [orgId]
      );

      if (settings?.settings_data) {
        const data = JSON.parse(settings.settings_data);
        return res.json({
          ...data,
          enabled: !!settings.enabled,
        });
      }

      // Return defaults
      return res.json({
        enabled: false,
        bannerTitle: 'We use cookies',
        bannerDescription: 'We use cookies to improve your experience on our site.',
        acceptButtonText: 'Accept All',
        rejectButtonText: 'Reject All',
        customizeButtonText: 'Manage Preferences',
        privacyPolicyUrl: '/legal/privacy',
        categories: [],
        position: 'bottom',
        theme: 'auto',
      });
    } catch (error: any) {
      logger.error('[compliance] Error fetching cookie settings:', error);
      return res.status(500).json({ error: 'Failed to fetch cookie settings' });
    }
  })
);

/**
 * PUT /api/compliance/cookies
 * Update cookie consent settings
 */
router.put(
  '/cookies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const settings = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const normalizedRole = (userRole || '').toLowerCase();
    if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(normalizedRole)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    try {
      await ensureTable();

      const existing = await dbGet(
        `SELECT id FROM compliance_settings WHERE organization_id = ? AND setting_type = 'cookies'`,
        [orgId]
      );

      const { enabled, ...settingsWithoutEnabled } = settings;
      const settingsData = JSON.stringify(settingsWithoutEnabled);

      if (existing) {
        await dbRun(
          `UPDATE compliance_settings SET 
                        settings_data = ?,
                        enabled = ?,
                        updated_at = datetime('now'),
                        updated_by = ?
                     WHERE organization_id = ? AND setting_type = 'cookies'`,
          [settingsData, enabled ? 1 : 0, userId, orgId]
        );
      } else {
        await dbRun(
          `INSERT INTO compliance_settings (id, organization_id, setting_type, settings_data, enabled, updated_by)
                     VALUES (?, ?, 'cookies', ?, ?, ?)`,
          [uuidv4(), orgId, settingsData, enabled ? 1 : 0, userId]
        );
      }

      logger.info(`[compliance] Cookie settings updated for org ${orgId}`);

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[compliance] Error updating cookie settings:', error);
      return res.status(500).json({ error: 'Failed to update cookie settings' });
    }
  })
);

// ===========================================
// DATA RETENTION
// ===========================================

/**
 * GET /api/compliance/data-retention
 * Get data retention settings
 */
router.get(
  '/data-retention',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    try {
      await ensureTable();

      const settings = await dbGet<{ settings_data: string }>(
        `SELECT settings_data FROM compliance_settings 
                 WHERE organization_id = ? AND setting_type = 'data_retention'`,
        [orgId]
      );

      if (settings?.settings_data) {
        return res.json(JSON.parse(settings.settings_data));
      }

      // Return defaults
      return res.json({
        userDataRetentionDays: 365,
        auditLogRetentionDays: 730,
        backupRetentionDays: 90,
        anonymizeInactiveUsers: false,
        inactiveUserDays: 365,
      });
    } catch (error: any) {
      logger.error('[compliance] Error fetching data retention settings:', error);
      return res.status(500).json({ error: 'Failed to fetch data retention settings' });
    }
  })
);

/**
 * PUT /api/compliance/data-retention
 * Update data retention settings
 */
router.put(
  '/data-retention',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const settings = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const normalizedRole = (userRole || '').toLowerCase();
    if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(normalizedRole)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    try {
      await ensureTable();

      const existing = await dbGet(
        `SELECT id FROM compliance_settings WHERE organization_id = ? AND setting_type = 'data_retention'`,
        [orgId]
      );

      const settingsData = JSON.stringify(settings);

      if (existing) {
        await dbRun(
          `UPDATE compliance_settings SET 
                        settings_data = ?,
                        updated_at = datetime('now'),
                        updated_by = ?
                     WHERE organization_id = ? AND setting_type = 'data_retention'`,
          [settingsData, userId, orgId]
        );
      } else {
        await dbRun(
          `INSERT INTO compliance_settings (id, organization_id, setting_type, settings_data, enabled, updated_by)
                     VALUES (?, ?, 'data_retention', ?, 1, ?)`,
          [uuidv4(), orgId, settingsData, userId]
        );
      }

      logger.info(`[compliance] Data retention settings updated for org ${orgId}`);

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[compliance] Error updating data retention settings:', error);
      return res.status(500).json({ error: 'Failed to update data retention settings' });
    }
  })
);

export default router;
