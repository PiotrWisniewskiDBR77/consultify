/**
 * Security Routes
 * 
 * API endpoints for security events, alerts, and reports.
 * 
 * Endpoints:
 * - GET  /api/security/events - Get security events log
 * - GET  /api/security/alert-settings - Get alert settings
 * - PUT  /api/security/alert-settings - Update alert settings
 * - POST /api/security/report - Generate security report
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// SECURITY EVENTS
// ==========================================

/**
 * GET /api/security/events
 * Get security events for current user
 */
router.get('/events', async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, offset = 0, type, severity } = req.query;

        let query = `
            SELECT 
                id, type, severity, title, description,
                ip_address as ip, location, device, metadata,
                created_at as timestamp
            FROM security_events
            WHERE user_id = ?
        `;
        const params = [userId];

        if (type && type !== 'all') {
            query += ' AND type = ?';
            params.push(type);
        }

        if (severity) {
            query += ' AND severity = ?';
            params.push(severity);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const events = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Parse metadata JSON
        const formattedEvents = events.map(e => ({
            ...e,
            metadata: e.metadata ? JSON.parse(e.metadata) : null
        }));

        res.json({ 
            success: true,
            events: formattedEvents
        });
    } catch (err) {
        console.error('[Security] Events error:', err);
        res.status(500).json({ error: 'Failed to fetch security events' });
    }
});

/**
 * POST /api/security/events
 * Log a security event (internal use)
 */
router.post('/events', async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, severity, title, description, metadata } = req.body;

        const ip = req.ip || req.connection?.remoteAddress;
        const userAgent = req.get('user-agent');

        const eventId = uuidv4();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO security_events (
                    id, user_id, type, severity, title, description,
                    ip_address, device, metadata, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    eventId,
                    userId,
                    type,
                    severity || 'info',
                    title,
                    description,
                    ip,
                    userAgent?.substring(0, 200),
                    metadata ? JSON.stringify(metadata) : null
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, eventId });
    } catch (err) {
        console.error('[Security] Log event error:', err);
        res.status(500).json({ error: 'Failed to log event' });
    }
});

// ==========================================
// ALERT SETTINGS
// ==========================================

/**
 * GET /api/security/alert-settings
 * Get security alert settings
 */
router.get('/alert-settings', async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    email_suspicious_login as emailOnSuspiciousLogin,
                    email_new_device as emailOnNewDevice,
                    email_password_change as emailOnPasswordChange,
                    email_mfa_change as emailOnMfaChange,
                    push_notifications as pushNotifications
                FROM user_security_alerts
                WHERE user_id = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (settings) {
            // Convert 0/1 to boolean
            res.json({
                success: true,
                settings: {
                    emailOnSuspiciousLogin: !!settings.emailOnSuspiciousLogin,
                    emailOnNewDevice: !!settings.emailOnNewDevice,
                    emailOnPasswordChange: !!settings.emailOnPasswordChange,
                    emailOnMfaChange: !!settings.emailOnMfaChange,
                    pushNotifications: !!settings.pushNotifications
                }
            });
        } else {
            // Return defaults
            res.json({
                success: true,
                settings: {
                    emailOnSuspiciousLogin: true,
                    emailOnNewDevice: true,
                    emailOnPasswordChange: true,
                    emailOnMfaChange: true,
                    pushNotifications: true
                }
            });
        }
    } catch (err) {
        console.error('[Security] Alert settings error:', err);
        res.status(500).json({ error: 'Failed to get alert settings' });
    }
});

/**
 * PUT /api/security/alert-settings
 * Update security alert settings
 */
router.put('/alert-settings', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            emailOnSuspiciousLogin = true,
            emailOnNewDevice = true,
            emailOnPasswordChange = true,
            emailOnMfaChange = true,
            pushNotifications = true
        } = req.body;

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_security_alerts (
                    user_id, email_suspicious_login, email_new_device,
                    email_password_change, email_mfa_change, push_notifications,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET
                    email_suspicious_login = excluded.email_suspicious_login,
                    email_new_device = excluded.email_new_device,
                    email_password_change = excluded.email_password_change,
                    email_mfa_change = excluded.email_mfa_change,
                    push_notifications = excluded.push_notifications,
                    updated_at = datetime('now')`,
                [
                    userId,
                    emailOnSuspiciousLogin ? 1 : 0,
                    emailOnNewDevice ? 1 : 0,
                    emailOnPasswordChange ? 1 : 0,
                    emailOnMfaChange ? 1 : 0,
                    pushNotifications ? 1 : 0
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, message: 'Alert settings updated' });
    } catch (err) {
        console.error('[Security] Update alert settings error:', err);
        res.status(500).json({ error: 'Failed to update alert settings' });
    }
});

// ==========================================
// SECURITY REPORTS
// ==========================================

/**
 * POST /api/security/report
 * Generate security report (CSV/PDF)
 */
router.post('/report', async (req, res) => {
    try {
        const userId = req.user.id;
        const { format = 'csv' } = req.body;

        // Get all events for user
        const events = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    type, severity, title, description,
                    ip_address as ip, location, device,
                    created_at as timestamp
                FROM security_events
                WHERE user_id = ?
                ORDER BY created_at DESC`,
                [userId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        if (format === 'csv') {
            // Generate CSV
            const headers = ['Date', 'Type', 'Severity', 'Title', 'Description', 'IP', 'Location', 'Device'];
            const rows = events.map(e => [
                new Date(e.timestamp).toISOString(),
                e.type,
                e.severity,
                e.title,
                e.description,
                e.ip || '',
                e.location || '',
                e.device || ''
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=security-report-${new Date().toISOString().split('T')[0]}.csv`);
            return res.send(csvContent);
        }

        // For PDF - return data and let frontend handle it
        res.json({
            success: true,
            data: events,
            format
        });
    } catch (err) {
        console.error('[Security] Report error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Helper function to log security events (exported for use by other modules)
async function logSecurityEvent(userId, type, severity, title, description, req, metadata = null) {
    try {
        const eventId = uuidv4();
        const ip = req?.ip || req?.connection?.remoteAddress || null;
        const userAgent = req?.get?.('user-agent')?.substring(0, 200) || null;

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO security_events (
                    id, user_id, type, severity, title, description,
                    ip_address, device, metadata, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [eventId, userId, type, severity, title, description, ip, userAgent, metadata ? JSON.stringify(metadata) : null],
                (err) => err ? reject(err) : resolve()
            );
        });

        return eventId;
    } catch (err) {
        console.error('[Security] Failed to log event:', err);
        return null;
    }
}

router.logSecurityEvent = logSecurityEvent;

module.exports = router;
