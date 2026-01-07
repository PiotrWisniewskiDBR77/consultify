/**
 * Settings Routes
 * API endpoints for settings
 */

import { Response, Router } from 'express';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

/**
 * GET /api/settings
 * Get system/user settings
 */
router.get(
    '/',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const sql = `SELECT * FROM settings`;
            const rows = await dbAll(sql, []);
            
            // Convert to key-value object
            const settings: Record<string, any> = {};
            rows.forEach((row: any) => {
                settings[row.key] = row.value;
            });
            
            return res.json(settings);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }),
);

/**
 * POST /api/settings
 * Update system/user settings
 */
router.post(
    '/',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Key is required' });
        }

        try {
            const sql = `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`;
            const result = await dbRun(sql, [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to save setting');
            }
            
            return res.json({ success: true });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }),
);

export default router;
