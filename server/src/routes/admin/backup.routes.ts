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

function respondBackupUnavailable(res: any, message?: string) {
  return res.status(503).json({
    success: false,
    error:
      message ||
      'Backup system is not available (service missing or not configured). Configure backups before enabling this endpoint.',
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
  // Try to use BackupService if available, otherwise return 503 (no demo/stub data)
  try {
    const BackupService = await import('../../services/backupService.js').then(
      (m) => m.default || m
    );
    const backups = await BackupService.listBackups({
      includeExpired: req.query.includeExpired === 'true',
    });
    return res.json({ backups, total: backups.length });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for list');
    return respondBackupUnavailable(res);
  }
});

/**
 * GET /api/admin/backups/status
 * Get backup system status and metrics
 * Access: ADMIN
 */
router.get('/status', async (req, res) => {
  try {
    const BackupService = await import('../../services/backupService.js').then(
      (m) => m.default || m
    );
    const status = await BackupService.getBackupStatus();
    return res.json(status);
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for status');
    return respondBackupUnavailable(res);
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
    const BackupService = await import('../../services/backupService.js').then(
      (m) => m.default || m
    );
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
    return respondBackupUnavailable(res);
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
    const BackupService = await import('../../services/backupService.js').then(
      (m) => m.default || m
    );
    const { backupId } = req.body;
    await BackupService.restoreBackup(backupId);
    return res.json({ success: true, message: 'Restore completed' });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for restore');
    return respondBackupUnavailable(
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
    const BackupService = await import('../../services/backupService.js').then(
      (m) => m.default || m
    );
    const { id } = req.params;
    await BackupService.deleteBackup(id);
    return res.json({ success: true });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for delete');
    return respondBackupUnavailable(
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
    const BackupService = await import('../../services/backupService.js').then(
      (m) => m.default || m
    );
    const { type = 'full', reason = 'manual' } = req.body;
    const backup = await BackupService.createBackup(type, reason);
    return res.json({ success: true, backup });
  } catch (error: any) {
    logger.warn('[BackupRoutes] BackupService not available for manual backup');
    return respondBackupUnavailable(
      res,
      'Manual backup is not available (service missing or not configured).'
    );
  }
});

export default router;
