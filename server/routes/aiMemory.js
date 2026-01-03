/**
 * AI Memory Routes
 * 
 * Manages user AI memory settings and stored preferences.
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/ai/memory
 * Get user's AI memory data
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const memories = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM user_ai_memory WHERE user_id = ? ORDER BY created_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({
            success: true,
            data: memories
        });
    } catch (error) {
        console.error('Error fetching AI memory:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch AI memory' });
    }
});

/**
 * PUT /api/ai/memory/settings
 * Update AI memory settings
 */
router.put('/settings', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { memoryEnabled, contextRetention } = req.body;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET 
                    extended_preferences = json_set(
                        COALESCE(extended_preferences, '{}'),
                        '$.aiMemoryEnabled', ?,
                        '$.contextRetention', ?
                    )
                 WHERE id = ?`,
                [memoryEnabled ? 1 : 0, contextRetention || 'session', userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        res.json({
            success: true,
            message: 'AI memory settings updated'
        });
    } catch (error) {
        console.error('Error updating AI memory settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});

/**
 * POST /api/ai/memory
 * Store a new memory item
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { memoryKey, memoryValue } = req.body;

        if (!memoryKey) {
            return res.status(400).json({ success: false, error: 'Memory key is required' });
        }

        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_ai_memory (id, user_id, memory_key, memory_value, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [id, userId, memoryKey, memoryValue],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        res.json({
            success: true,
            data: { id, memoryKey, memoryValue }
        });
    } catch (error) {
        console.error('Error storing AI memory:', error);
        res.status(500).json({ success: false, error: 'Failed to store memory' });
    }
});

/**
 * DELETE /api/ai/memory
 * Clear all AI memory for user
 */
router.delete('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM user_ai_memory WHERE user_id = ?`,
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        res.json({
            success: true,
            message: 'All AI memory cleared'
        });
    } catch (error) {
        console.error('Error clearing AI memory:', error);
        res.status(500).json({ success: false, error: 'Failed to clear memory' });
    }
});

/**
 * DELETE /api/ai/memory/:id
 * Delete specific memory item
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM user_ai_memory WHERE id = ? AND user_id = ?`,
                [id, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        res.json({
            success: true,
            message: 'Memory item deleted'
        });
    } catch (error) {
        console.error('Error deleting memory item:', error);
        res.status(500).json({ success: false, error: 'Failed to delete memory' });
    }
});

export default router;

