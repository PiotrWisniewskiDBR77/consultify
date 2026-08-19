/**
 * Backup Admin Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Admin endpoints for backup management and monitoring
 * Requires ADMIN or SUPERADMIN role
 */

import { Router } from 'express';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import logger from '../../utils/Logger.js';

const router = Router();

function respondBackupUnavailable(_req: any, res: any, _message?: string) {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
}

// Apply auth and admin middleware to all routes
router.use(verifyToken);
router.use(verifyAdmin);

// ==========================================
// BACKUP MONITORING
// ==========================================

/**
 * GET /api/admin/backups
 * List all backups with status
 * Access: ADMIN
 */
router.get('/', async (req, res) => {
  // T7b-2 (2026-07-19): BackupService is now a REAL implementation
  // (finding_42_self_import_wrappers_services_2026-07-15). The 503 fallback below is genuine
  // fail-soft (e.g. missing backup schema), no longer a guaranteed-dead self-import wrapper.
  try {
    const BackupService = (await import('../../services/backupService.js').then(
      (m) => m.default || m
    )) as typeof import('../../services/backupService.js')['default'];
    const backups = await BackupService.listBackups({
      includeExpired: req.query.includeExpired === 'true',
    });
    return res.json({ backups, total: backups.length });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for list');
    return respondBackupUnavailable(req, res);
  }
});

/**
 * GET /api/admin/backups/status
 * Get backup system status and metrics
 * Access: ADMIN
 */
router.get('/status', async (req, res) => {
  try {
    const BackupService = (await import('../../services/backupService.js').then(
      (m) => m.default || m
    )) as typeof import('../../services/backupService.js')['default'];
    const status = await BackupService.getBackupStatus();
    return res.json(status);
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for status');
    return respondBackupUnavailable(req, res);
  }
});

/**
 * GET /api/admin/backups/:id/status
 * Get status of a specific backup
 * Access: ADMIN
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const BackupService = (await import('../../services/backupService.js').then(
      (m) => m.default || m
    )) as typeof import('../../services/backupService.js')['default'];
    const backups = await BackupService.listBackups({ includeExpired: true });
    const backup = backups.find((b: any) => b.id === id);

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    return res.json({
      ...backup,
      existsLocally: true,
      existsInCloud: backup.hasS3 || backup.hasGCS || false,
    });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for backup status lookup');
    return respondBackupUnavailable(req, res);
  }
});

// ==========================================
// BACKUP OPERATIONS (SUPERADMIN ONLY)
// ==========================================

/**
 * POST /api/admin/backups/restore
 * Restore from a backup
 * Access: SUPERADMIN only
 */
router.post('/restore', verifySuperAdmin, async (req, res) => {
  try {
    const BackupService = (await import('../../services/backupService.js').then(
      (m) => m.default || m
    )) as typeof import('../../services/backupService.js')['default'];
    const { backupId, targetDatabaseUrl, expectedOrganizationId } = req.body;
    const result = await BackupService.restoreBackup(backupId, {
      targetDatabaseUrl,
      expectedOrganizationId,
      actorId: String((req as any).user?.id || ''),
    });
    return res.json({ success: true, restore: result });
  } catch (error: any) {
    const code = String(error?.message || 'RESTORE_FAILED');
    logger.warn(`[BackupRoutes] restore rejected: ${code}`);
    if (code === 'BACKUP_NOT_FOUND') return res.status(404).json({ success: false, code });
    if (code === 'RESTORE_TARGET_NOT_ISOLATED') return res.status(403).json({ success: false, code });
    if (/REQUIRED|MISMATCH|UNSAFE|UNENCRYPTED|CHECKSUM|HASH|FORMAT|PAYLOAD|ROW_COUNT|INTEGRITY/.test(code)) {
      return res.status(400).json({ success: false, code });
    }
    return res.status(500).json({ success: false, code: 'RESTORE_FAILED' });
  }
});

/**
 * DELETE /api/admin/backups/:id
 * Delete a backup
 * Access: SUPERADMIN only
 */
router.delete('/:id', verifySuperAdmin, async (req, res) => {
  try {
    const BackupService = (await import('../../services/backupService.js').then(
      (m) => m.default || m
    )) as typeof import('../../services/backupService.js')['default'];
    const { id } = req.params;
    await BackupService.deleteBackup(id);
    return res.json({ success: true });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for delete');
    return respondBackupUnavailable(
      req,
      res,
      'Backup delete is not available (service missing or not configured).'
    );
  }
});

/**
 * POST /api/admin/backups/manual
 * Trigger manual backup
 * Access: SUPERADMIN only
 */
router.post('/manual', verifySuperAdmin, async (req, res) => {
  try {
    const { type = 'full', reason = 'manual' } = req.body;
    if (type !== 'full') {
      return res.status(400).json({ success: false, code: 'BACKUP_TYPE_INVALID' });
    }
    const { triggerManualBackup } = await import('../../cron/BackupCron.js');
    const backup = await triggerManualBackup(reason, {
      type,
      actorId: String((req as any).user?.id || 'system'),
    });
    return res.json({ success: true, backup });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for manual backup');
    return respondBackupUnavailable(
      req,
      res,
      'Manual backup is not available (service missing or not configured).'
    );
  }
});

/** Create an encrypted export limited to the authenticated admin's tenant. */
router.post('/organization/manual', requireActiveMembership, async (req, res) => {
  try {
    const organizationId = String((req as any).user?.organizationId || '');
    const actorId = String((req as any).user?.id || '');
    if (!organizationId || !actorId) return res.status(403).json({ success: false, code: 'TENANT_CONTEXT_REQUIRED' });
    const type = req.body?.type || 'full';
    if (type !== 'full') {
      return res.status(400).json({ success: false, code: 'BACKUP_TYPE_INVALID' });
    }
    const { triggerManualBackup } = await import('../../cron/BackupCron.js');
    const backup = await triggerManualBackup(req.body?.reason || 'tenant-manual', {
      type,
      organizationId,
      actorId,
    });
    return res.json({ success: true, backup });
  } catch (error: any) {
    logger.warn('[BackupRoutes] tenant backup failed');
    return res.status(500).json({ success: false, code: 'TENANT_BACKUP_FAILED' });
  }
});

export default router;
