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
    const { backupId } = req.body;
    // Restore execution is v2. Answer 501 (honest "not implemented") with the
    // read-only restore-info describing what a restore WOULD do — never a
    // 503 crash. See services/backupService.ts (BackupNotImplementedError).
    const info = await BackupService.getRestoreInfo(backupId);
    return res.status(501).json({
      success: false,
      code: 'RESTORE_NOT_IMPLEMENTED',
      message: info.message,
      backupId: info.backupId,
      found: info.found,
      manifest: info.manifest,
    });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for restore');
    return respondBackupUnavailable(
      req,
      res,
      'Backup restore is not available (service missing or not configured).'
    );
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
    const BackupService = (await import('../../services/backupService.js').then(
      (m) => m.default || m
    )) as typeof import('../../services/backupService.js')['default'];
    const { type = 'full', reason = 'manual' } = req.body;
    const backup = await BackupService.createBackup(type, reason);
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

export default router;
