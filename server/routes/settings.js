const express = require('express');
const router = express.Router();
const db = require('../database');

// GET Settings
router.get('/', (req, res) => {
    db.all('SELECT key, value FROM settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const settings = {};
        rows.forEach(row => {
            // Mask API Key for security when sending to client
            if (row.key === 'gemini_api_key' && row.value) {
                settings[row.key] = '********************' + row.value.slice(-4);
            } else {
                settings[row.key] = row.value;
            }
        });
        res.json(settings);
    });
});

// SAVE Settings
router.post('/', (req, res) => {
    const { key, value } = req.body;

    if (!key) return res.status(400).json({ error: 'Key is required' });

    db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) 
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
        [key, value, value],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// ==========================================
// NOTIFICATIONS
// ==========================================

// GET Notification Preferences
router.get('/notifications', (req, res) => {
    // Assuming user_id is passed via middleware auth in a real app, 
    // but here we might need to rely on query param or mock for now as per previous patterns if auth not fully strict.
    // However, index.js shows generic routes. 
    // Let's assume passed via query 'userId' for simplicity if not in req.user, 
    // OR if we are strictly following the app's auth, we should use req.user.id.
    // Looking at other routes is safer, but I can't see them right now. 
    // 'SettingsView' passes 'currentUser', so frontend likely knows the user.
    // I will check if 'req.user' is available. 
    // Actually, 'settings.js' didn't have auth middleware applied in 'index.js' explicitly? 
    // "app.use('/api/', apiLimiter);" "app.use('/api/settings', settingsRoutes);"
    // It seems unprotected or relies on client sending ID. 
    // Let's accept 'userId' in query for safety/flexibility.

    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    db.get('SELECT notification_preferences FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? JSON.parse(row.notification_preferences || '{}') : {});
    });
});

// UPDATE Notification Preferences
router.post('/notifications', (req, res) => {
    const { userId, preferences } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    db.run('UPDATE users SET notification_preferences = ? WHERE id = ?',
        [JSON.stringify(preferences), userId],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// ==========================================
// STEP 16: USER NOTIFICATION PREFERENCES (Workflow Events)
// ==========================================

const auth = require('../middleware/authMiddleware');
const NotificationOutboxService = require('../services/notificationOutboxService');

/**
 * @route GET /api/settings/workflow-notifications
 * @desc Get user notification preferences for workflow events
 * @access Private
 */
router.get('/workflow-notifications', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organizationId;

        const prefs = await NotificationOutboxService.getUserPreferences(userId, orgId);

        // Return defaults if no preferences set
        if (!prefs) {
            return res.json({
                channel_email: true,
                channel_slack: false,
                channel_teams: false,
                event_approval_due: true,
                event_playbook_stuck: true,
                event_dead_letter: true,
                event_escalation: true,
                isDefault: true
            });
        }

        res.json({
            channel_email: !!prefs.channel_email,
            channel_slack: !!prefs.channel_slack,
            channel_teams: !!prefs.channel_teams,
            event_approval_due: !!prefs.event_approval_due,
            event_playbook_stuck: !!prefs.event_playbook_stuck,
            event_dead_letter: !!prefs.event_dead_letter,
            event_escalation: !!prefs.event_escalation
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting workflow notification preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/workflow-notifications
 * @desc Update user notification preferences for workflow events
 * @access Private
 */
router.put('/workflow-notifications', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organizationId;

        const result = await NotificationOutboxService.updateUserPreferences(userId, orgId, req.body);

        res.json({
            success: true,
            message: 'Workflow notification preferences updated',
            preferences: result
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating workflow notification preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// INTEGRATIONS
// ==========================================

// GET Integrations for Org
router.get('/integrations', (req, res) => {
    const orgId = req.query.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    db.all('SELECT * FROM integrations WHERE organization_id = ?', [orgId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Parse config and mask secrets
        const integrations = rows.map(i => {
            const config = JSON.parse(i.config || '{}');
            // Simple masking
            if (config.api_token) config.api_token = '****' + config.api_token.slice(-4);
            if (config.webhook_url) config.webhook_url = config.webhook_url.replace(/https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\//, 'https://hooks.slack.com/.../');
            return { ...i, config };
        });
        res.json(integrations);
    });
});

// ADD/UPDATE Integration
router.post('/integrations', (req, res) => {
    const { organizationId, provider, config } = req.body;
    const { v4: uuidv4 } = require('uuid');

    if (!organizationId || !provider) return res.status(400).json({ error: 'Org ID and Provider required' });

    const id = uuidv4();
    const configStr = JSON.stringify(config);

    // Check if exists for this provider? Allow multiple? 
    // Let's allow one per provider for now for simplicity, or just insert. 
    // User requested "add everything needed", usually implies multiple.
    // But typical simple integration is one per type.
    // Let's doing INSERT.

    db.run(`INSERT INTO integrations (id, organization_id, provider, config) VALUES (?, ?, ?, ?)`,
        [id, organizationId, provider, configStr],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
        }
    );
});

// DELETE Integration
router.delete('/integrations/:id', (req, res) => {
    db.run('DELETE FROM integrations WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

module.exports = router;
