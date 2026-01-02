/**
 * Sessions Routes
 * 
 * Manages active user sessions across devices.
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/sessions
 * Get all active sessions for current user
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const currentSessionId = req.sessionId; // From auth middleware

        const sessions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, device, ip_address, last_active, created_at
                 FROM active_sessions 
                 WHERE user_id = ?
                 ORDER BY last_active DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Mark current session
        const sessionsWithCurrent = sessions.map(s => ({
            ...s,
            isCurrent: s.id === currentSessionId
        }));

        res.json({
            success: true,
            data: sessionsWithCurrent
        });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
    }
});

/**
 * POST /api/sessions
 * Create a new session (called on login)
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { device, ipAddress } = req.body;

        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO active_sessions (id, user_id, device, ip_address, last_active, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [id, userId, device || 'Unknown Device', ipAddress || req.ip],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        res.json({
            success: true,
            data: { sessionId: id }
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ success: false, error: 'Failed to create session' });
    }
});

/**
 * PUT /api/sessions/:id/activity
 * Update session last_active timestamp
 */
router.put('/:id/activity', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE active_sessions 
                 SET last_active = datetime('now')
                 WHERE id = ? AND user_id = ?`,
                [id, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating session activity:', error);
        res.status(500).json({ success: false, error: 'Failed to update session' });
    }
});

/**
 * DELETE /api/sessions/:id
 * Terminate a specific session
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM active_sessions WHERE id = ? AND user_id = ?`,
                [id, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        res.json({
            success: true,
            message: 'Session terminated'
        });
    } catch (error) {
        console.error('Error terminating session:', error);
        res.status(500).json({ success: false, error: 'Failed to terminate session' });
    }
});

/**
 * DELETE /api/sessions
 * Terminate all sessions except current
 */
router.delete('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const currentSessionId = req.sessionId;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM active_sessions WHERE user_id = ? AND id != ?`,
                [userId, currentSessionId || ''],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        res.json({
            success: true,
            message: 'All other sessions terminated'
        });
    } catch (error) {
        console.error('Error terminating sessions:', error);
        res.status(500).json({ success: false, error: 'Failed to terminate sessions' });
    }
});

module.exports = router;
