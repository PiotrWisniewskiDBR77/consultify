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
import logger from '../../utils/Logger.ts';

const router = Router();

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
    try {
        const BackupService = await import('../../../services/backupService.js').then((m) => m.default || m);
        const backups = await BackupService.listBackups({
            includeExpired: req.query.includeExpired === 'true',
        });

        res.json({
            backups,
            total: backups.length,
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[BackupRoutes] Error listing backups:', err);
        res.status(500).json({
            error: 'Failed to list backups',
            message: err.message,
        });
    }
});

/**
 * GET /api/admin/backups/status
 * Get backup system status and metrics
 * Access: ADMIN
 */
router.get('/status', async (req, res) => {
    try {
        const BackupService = await import('../../../services/backupService.js').then((m) => m.default || m);
        const BackupCron = await import('../../cron/BackupCron.js').then((m) => m.default || m);

        const status = await BackupService.getBackupStatus();
        const cron = BackupCron.getBackupCron();
        const metrics = cron.getMetrics();

        res.json({
            ...status,
            metrics: {
                successCount: metrics.successCount,
                failureCount: metrics.failureCount,
                lastBackupTime: metrics.lastBackupTime?.toISOString() || null,
                lastError: metrics.lastError,
            },
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[BackupRoutes] Error getting backup status:', err);
        res.status(500).json({
            error: 'Failed to get backup status',
            message: err.message,
        });
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
        const BackupService = await import('../../../services/backupService.js').then((m) => m.default || m);
        const backups = await BackupService.listBackups({ includeExpired: true });
        const backup = backups.find((b) => b.id === id);

        if (!backup) {
            return res.status(404).json({
                error: 'Backup not found',
            });
        }

        // Check if file exists locally
        const fs = await import('fs');
        const path = await import('path');
        const BackupServiceModule = await import('../../../services/backupService.js');
        const CONFIG = (BackupServiceModule as any).CONFIG || {
            BACKUP_DIR: process.env.BACKUP_DIR || './backups',
        };

        const filePath = path.resolve(CONFIG.BACKUP_DIR, backup.filename);
        const existsLocally = fs.existsSync(filePath);

        res.json({
            ...backup,
            existsLocally,
            existsInCloud: backup.hasS3 || backup.hasGCS,
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[BackupRoutes] Error getting backup status:', err);
        res.status(500).json({
            error: 'Failed to get backup status',
            message: err.message,
        });
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
        const { backupId, createPreRestoreBackup = true } = req.body;

        if (!backupId) {
            return res.status(400).json({
                error: 'backupId is required',
            });
        }

        const BackupService = await import('../../../services/backupService.js').then((m) => m.default || m);
        const result = await BackupService.restoreBackup(backupId, {
            createPreRestoreBackup,
        });

        res.json({
            success: true,
            message: 'Backup restored successfully',
            ...result,
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[BackupRoutes] Error restoring backup:', err);
        res.status(500).json({
            error: 'Failed to restore backup',
            message: err.message,
        });
    }
});

/**
 * POST /api/admin/backups/:id/delete
 * Delete a backup
 * Access: SUPERADMIN only
 */
router.delete('/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const BackupService = await import('../../../services/backupService.js').then((m) => m.default || m);
        await BackupService.deleteBackup(id);

        res.json({
            success: true,
            message: 'Backup deleted successfully',
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[BackupRoutes] Error deleting backup:', err);
        res.status(500).json({
            error: 'Failed to delete backup',
            message: err.message,
        });
    }
});

/**
 * POST /api/admin/backups/manual
 * Trigger manual backup
 * Access: SUPERADMIN only
 */
router.post('/manual', verifySuperAdmin, async (req, res) => {
    try {
        const { reason = 'manual' } = req.body;
        const BackupCron = await import('../../cron/BackupCron.js').then((m) => m.default || m);
        const cron = BackupCron.getBackupCron();
        const result = await cron.triggerManualBackup(reason);

        res.json({
            success: true,
            message: 'Manual backup triggered',
            backupId: result.id,
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[BackupRoutes] Error triggering manual backup:', err);
        res.status(500).json({
            error: 'Failed to trigger manual backup',
            message: err.message,
        });
    }
});

export default router;
