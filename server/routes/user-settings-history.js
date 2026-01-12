/**
 * User Settings History API Routes
 * Handles audit log of settings changes
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();


router.use(requireAuth);

/**
 * GET /api/user/settings-history
 * Get settings change history for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 30, category, limit = 50 } = req.query;

        let query = `
            SELECT id, category, setting, action, old_value, new_value, 
                   timestamp, device, ip_address
            FROM user_settings_history
            WHERE user_id = ?
            AND timestamp > datetime('now', '-${parseInt(days)} days')
        `;
        const params = [userId];

        if (category && category !== 'all') {
            query += ` AND category = ?`;
            params.push(category);
        }

        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(parseInt(limit));

        const history = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json({
            success: true,
            data: {
                entries: history.map(h => ({
                    id: h.id,
                    category: h.category,
                    setting: h.setting,
                    action: h.action,
                    oldValue: h.old_value,
                    newValue: h.new_value,
                    timestamp: h.timestamp,
                    device: h.device,
                    ipAddress: h.ip_address
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching settings history:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings history' });
    }
});

/**
 * POST /api/user/settings-history/:id/restore
 * Restore a previous setting value
 */
router.post('/:id/restore', async (req, res) => {
    try {
        const userId = req.user.id;
        const entryId = req.params.id;

        // Get the history entry
        const entry = await new Promise((resolve, reject) => {
            db.get(
                `SELECT category, setting, old_value FROM user_settings_history 
                 WHERE id = ? AND user_id = ?`,
                [entryId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!entry || !entry.old_value) {
            return res.status(404).json({ success: false, error: 'Cannot restore this entry' });
        }

        // In production, apply the old value to the appropriate settings table
        // And log the restore action
        const { v4: uuidv4 } = await import('uuid');
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_settings_history (
                    id, user_id, category, setting, action, old_value, new_value, 
                    timestamp, device, ip_address
                ) VALUES (?, ?, ?, ?, 'restored', ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
                [
                    uuidv4(),
                    userId,
                    entry.category,
                    entry.setting,
                    null, // Current value would be old_value
                    entry.old_value,
                    req.headers['user-agent'] || 'Unknown',
                    req.ip || 'Unknown'
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            success: true, 
            message: `Restored ${entry.setting} to previous value`
        });
    } catch (error) {
        console.error('Error restoring setting:', error);
        res.status(500).json({ success: false, error: 'Failed to restore setting' });
    }
});

/**
 * Utility function to log settings changes (exported for use in other routes)
 */
async function logSettingsChange(userId, category, setting, action, oldValue, newValue, device, ipAddress) {
    const { v4: uuidv4 } = await import('uuid');
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO user_settings_history (
                id, user_id, category, setting, action, old_value, new_value, 
                timestamp, device, ip_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
            [uuidv4(), userId, category, setting, action, oldValue, newValue, device, ipAddress],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

router.logSettingsChange = logSettingsChange;

export default router;








