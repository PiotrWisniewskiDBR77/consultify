/**
 * Backup Routes
 * 
 * API endpoints for backup management
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/index.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';
import BackupService from '../services/backupService.js';

const router = express.Router();
const db = getDatabase();

/**
 * GET /api/backups
 * Get all backups
 */
router.get('/', verifySuperAdmin, async (req, res) => {
    try {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM backup_records ORDER BY started_at DESC`,
                [],
                (err, rows) => {
                    if (err) {
                        console.error('[Backup] Error fetching backups:', err);
                        return reject(err);
                    }

                    const backups = rows.map(row => ({
                        ...row,
                        metadata: row.metadata ? JSON.parse(row.metadata) : {}
                    }));

                    resolve(backups);
                }
            );
        }).then(backups => res.json(backups));
    } catch (error) {
        console.error('[Backup] Error:', error);
        res.status(500).json({ error: 'Failed to fetch backups' });
    }
});

/**
 * POST /api/backups
 * Create a new backup
 */
router.post('/', verifySuperAdmin, async (req, res) => {
    try {
        const { type = 'full', reason = 'manual' } = req.body;

        const backup = await BackupService.createBackup(type, reason);

        // Record in database
        const backupId = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO backup_records (
                    id, backup_type, status, size_bytes, storage_location,
                    started_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    backupId, type, 'completed',
                    backup.size, backup.path,
                    now, JSON.stringify({ reason, ...backup })
                ],
                function (err) {
                    if (err) {
                        console.error('[Backup] Error recording backup:', err);
                        return reject(err);
                    }
                    resolve({ id: backupId, ...backup });
                }
            );
        }).then(result => res.status(201).json(result));
    } catch (error) {
        console.error('[Backup] Error creating backup:', error);
        res.status(500).json({ error: error.message || 'Failed to create backup' });
    }
});

/**
 * GET /api/backups/:id
 * Get backup details
 */
router.get('/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM backup_records WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('[Backup] Error fetching backup:', err);
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                resolve({
                    ...row,
                    metadata: row.metadata ? JSON.parse(row.metadata) : {}
                });
            });
        }).then(backup => {
            if (!backup) {
                return res.status(404).json({ error: 'Backup not found' });
            }
            res.json(backup);
        });
    } catch (error) {
        console.error('[Backup] Error:', error);
        res.status(500).json({ error: 'Failed to fetch backup' });
    }
});

/**
 * DELETE /api/backups/:id
 * Delete a backup
 */
router.delete('/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        return new Promise((resolve, reject) => {
            db.run('DELETE FROM backup_records WHERE id = ?', [id], function (err) {
                if (err) {
                    console.error('[Backup] Error deleting backup:', err);
                    return reject(err);
                }
                resolve({ deleted: this.changes > 0 });
            });
        }).then(result => res.json(result));
    } catch (error) {
        console.error('[Backup] Error:', error);
        res.status(500).json({ error: 'Failed to delete backup' });
    }
});

export default router;












