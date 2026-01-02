/**
 * Login History Routes
 * 
 * Tracks and retrieves user login history for security monitoring.
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/auth/login-history
 * Get login history for current user
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;

        const history = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, ip_address, user_agent, location, status, created_at
                 FROM login_history 
                 WHERE user_id = ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Parse user_agent to get device info
        const formattedHistory = history.map(entry => ({
            ...entry,
            device: parseUserAgent(entry.user_agent),
            time: entry.created_at
        }));

        res.json({
            success: true,
            data: formattedHistory
        });
    } catch (error) {
        console.error('Error fetching login history:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch login history' });
    }
});

/**
 * POST /api/auth/login-history
 * Record a login attempt (called by auth middleware)
 */
router.post('/', async (req, res) => {
    try {
        const { userId, ipAddress, userAgent, location, status } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID is required' });
        }

        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [id, userId, ipAddress, userAgent, location, status || 'success'],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        res.json({
            success: true,
            data: { id }
        });
    } catch (error) {
        console.error('Error recording login history:', error);
        res.status(500).json({ success: false, error: 'Failed to record login' });
    }
});

/**
 * GET /api/auth/login-history/suspicious
 * Get suspicious login attempts
 */
router.get('/suspicious', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const suspicious = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, ip_address, user_agent, location, status, created_at
                 FROM login_history 
                 WHERE user_id = ? AND status = 'failed'
                 ORDER BY created_at DESC
                 LIMIT 10`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({
            success: true,
            data: suspicious
        });
    } catch (error) {
        console.error('Error fetching suspicious logins:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch suspicious logins' });
    }
});

/**
 * Helper function to parse user agent string
 */
function parseUserAgent(userAgent) {
    if (!userAgent) return 'Unknown Device';

    // Simple parsing - in production use a proper library like ua-parser-js
    if (userAgent.includes('Chrome')) {
        if (userAgent.includes('Mac')) return 'Chrome on MacOS';
        if (userAgent.includes('Windows')) return 'Chrome on Windows';
        if (userAgent.includes('Linux')) return 'Chrome on Linux';
        return 'Chrome';
    }
    if (userAgent.includes('Firefox')) {
        if (userAgent.includes('Mac')) return 'Firefox on MacOS';
        if (userAgent.includes('Windows')) return 'Firefox on Windows';
        return 'Firefox';
    }
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        if (userAgent.includes('iPhone')) return 'Safari on iPhone';
        if (userAgent.includes('iPad')) return 'Safari on iPad';
        return 'Safari on MacOS';
    }
    if (userAgent.includes('Edge')) return 'Edge';
    
    return 'Unknown Browser';
}

module.exports = router;

