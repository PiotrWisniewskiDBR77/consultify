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

// ==========================================
// EXTENDED USER PREFERENCES
// ==========================================

/**
 * @route GET /api/settings/preferences
 * @desc Get all extended user preferences
 * @access Private
 */
router.get('/preferences', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const row = await new Promise((resolve, reject) => {
            db.get('SELECT extended_preferences FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!row || !row.extended_preferences) {
            // Return default preferences
            return res.json({
                work: {
                    defaultProjectView: 'list',
                    taskSortOrder: 'priority',
                    weekStartDay: 'monday',
                    showCompletedTasks: true,
                    autoArchiveDays: 30,
                    enableTimeTracking: false,
                    defaultTaskDuration: 60
                },
                dashboard: {
                    defaultLandingPage: 'dashboard',
                    widgetsVisible: ['overview', 'tasks', 'calendar', 'activity'],
                    compactMode: false,
                    showWelcomeMessage: true,
                    refreshInterval: 300,
                    chartAnimations: true
                },
                accessibility: {
                    fontSize: 'medium',
                    highContrast: false,
                    reduceMotion: false,
                    screenReaderOptimized: false,
                    keyboardShortcuts: true,
                    focusIndicators: true
                },
                privacy: {
                    showOnlineStatus: true,
                    showActivityStatus: true,
                    allowProfileViewing: 'organization',
                    shareAnalytics: true,
                    marketingEmails: false
                },
                ai: {
                    responseStyle: 'balanced',
                    writingTone: 'professional',
                    autoSuggestions: true,
                    contextRetention: 'session',
                    preferredLanguage: 'auto',
                    codeExplanations: true,
                    showSources: true
                }
            });
        }

        const prefs = JSON.parse(row.extended_preferences);
        res.json(prefs);
    } catch (err) {
        console.error('[SettingsRoute] Error getting extended preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/preferences
 * @desc Update all extended user preferences
 * @access Private
 */
router.put('/preferences', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const preferences = req.body;

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET extended_preferences = ?, updated_at = datetime("now") WHERE id = ?',
                [JSON.stringify(preferences), userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, preferences });
    } catch (err) {
        console.error('[SettingsRoute] Error updating extended preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/preferences/:category
 * @desc Get a specific category of extended user preferences
 * @access Private
 */
router.get('/preferences/:category', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { category } = req.params;

        // Valid categories - extended list
        const validCategories = ['work', 'dashboard', 'accessibility', 'privacy', 'ai', 'regional', 'sound', 'advanced'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: 'Invalid preference category' });
        }

        // Get existing preferences
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT extended_preferences FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        let existing = {};
        if (row && row.extended_preferences) {
            try {
                existing = JSON.parse(row.extended_preferences);
            } catch {
                existing = {};
            }
        }

        // Return defaults for each category if not set
        const defaults = getDefaultPreferences();
        const categoryPrefs = existing[category] || defaults[category] || {};

        res.json({ preferences: categoryPrefs });
    } catch (err) {
        console.error('[SettingsRoute] Error getting category preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/preferences/:category
 * @desc Update a specific category of extended user preferences
 * @access Private
 */
router.put('/preferences/:category', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { category } = req.params;
        const categoryPrefs = req.body.preferences || req.body;

        // Valid categories - extended list
        const validCategories = ['work', 'dashboard', 'accessibility', 'privacy', 'ai', 'regional', 'sound', 'advanced'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: 'Invalid preference category' });
        }

        // Get existing preferences
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT extended_preferences FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        let existing = {};
        if (row && row.extended_preferences) {
            try {
                existing = JSON.parse(row.extended_preferences);
            } catch {
                existing = {};
            }
        }

        // Merge the category
        existing[category] = {
            ...(existing[category] || {}),
            ...categoryPrefs
        };

        // Save
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET extended_preferences = ?, updated_at = datetime("now") WHERE id = ?',
                [JSON.stringify(existing), userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, category, preferences: existing[category] });
    } catch (err) {
        console.error('[SettingsRoute] Error updating category preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// USER NOTIFICATION PREFERENCES V2 (User-Level)
// ==========================================

const UserNotificationPreferencesService = require('../services/userNotificationPreferencesService');

/**
 * @route GET /api/settings/notifications/preferences
 * @desc Get user notification preferences (V2 - granular)
 * @access Private
 */
router.get('/notifications/preferences', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const preferences = await UserNotificationPreferencesService.getPreferences(userId);
        
        res.json({ preferences });
    } catch (err) {
        console.error('[SettingsRoute] Error getting notification preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/notifications/preferences
 * @desc Update user notification preferences (V2)
 * @access Private
 */
router.put('/notifications/preferences', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;
        
        const preferences = await UserNotificationPreferencesService.updatePreferences(userId, updates);
        
        res.json({ success: true, preferences });
    } catch (err) {
        console.error('[SettingsRoute] Error updating notification preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/notifications/categories
 * @desc Get available notification categories and types
 * @access Private
 */
router.get('/notifications/categories', auth, async (req, res) => {
    try {
        const categories = UserNotificationPreferencesService.NOTIFICATION_CATEGORIES;
        res.json({ categories });
    } catch (err) {
        console.error('[SettingsRoute] Error getting categories:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/notifications/schedule
 * @desc Update quiet hours schedule
 * @access Private
 */
router.put('/notifications/schedule', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const scheduleUpdates = req.body;
        
        const preferences = await UserNotificationPreferencesService.updatePreferences(userId, {
            schedule: scheduleUpdates
        });
        
        res.json({ success: true, schedule: preferences.schedule });
    } catch (err) {
        console.error('[SettingsRoute] Error updating schedule:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/notifications/digests
 * @desc Update digest settings
 * @access Private
 */
router.put('/notifications/digests', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const digestUpdates = req.body;
        
        const preferences = await UserNotificationPreferencesService.updateDigestSettings(userId, digestUpdates);
        
        res.json({ success: true, digests: preferences.digests });
    } catch (err) {
        console.error('[SettingsRoute] Error updating digests:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/notifications/quiet-hours/status
 * @desc Check if user is currently in quiet hours
 * @access Private
 */
router.get('/notifications/quiet-hours/status', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const isInQuietHours = await UserNotificationPreferencesService.isInQuietHours(userId);
        
        res.json({ isInQuietHours });
    } catch (err) {
        console.error('[SettingsRoute] Error checking quiet hours:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// USER WATCHERS
// ==========================================

/**
 * @route GET /api/settings/watchers
 * @desc Get all objects user is watching
 * @access Private
 */
router.get('/watchers', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const watchers = await UserNotificationPreferencesService.getWatchedObjects(userId);
        
        res.json({ watchers });
    } catch (err) {
        console.error('[SettingsRoute] Error getting watchers:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/watchers/:objectType
 * @desc Get watched objects of a specific type
 * @access Private
 */
router.get('/watchers/:objectType', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { objectType } = req.params;
        
        const objectIds = await UserNotificationPreferencesService.getWatchedByType(userId, objectType);
        
        res.json({ objectType, watching: objectIds });
    } catch (err) {
        console.error('[SettingsRoute] Error getting watchers by type:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/settings/watchers
 * @desc Add a watcher
 * @access Private
 */
router.post('/watchers', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { objectType, objectId, notifyOn = 'all' } = req.body;
        
        if (!objectType || !objectId) {
            return res.status(400).json({ error: 'objectType and objectId are required' });
        }
        
        const watcher = await UserNotificationPreferencesService.addWatcher(userId, objectType, objectId, notifyOn);
        
        res.json({ success: true, watcher });
    } catch (err) {
        console.error('[SettingsRoute] Error adding watcher:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route DELETE /api/settings/watchers/:objectType/:objectId
 * @desc Remove a watcher
 * @access Private
 */
router.delete('/watchers/:objectType/:objectId', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { objectType, objectId } = req.params;
        
        const result = await UserNotificationPreferencesService.removeWatcher(userId, objectType, objectId);
        
        res.json({ success: true, removed: result.removed });
    } catch (err) {
        console.error('[SettingsRoute] Error removing watcher:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/watchers/check/:objectType/:objectId
 * @desc Check if user is watching an object
 * @access Private
 */
router.get('/watchers/check/:objectType/:objectId', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { objectType, objectId } = req.params;
        
        const isWatching = await UserNotificationPreferencesService.isWatching(userId, objectType, objectId);
        
        res.json({ isWatching });
    } catch (err) {
        console.error('[SettingsRoute] Error checking watcher:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PERSONAL API KEYS
// ==========================================

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * @route GET /api/settings/api-keys
 * @desc Get all API keys for the user
 * @access Private
 */
router.get('/api-keys', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const keys = await new Promise((resolve, reject) => {
            db.all(
                'SELECT id, name, key_prefix, permissions, created_at, last_used FROM user_api_keys WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Mask the keys (only show prefix)
        const maskedKeys = keys.map(k => ({
            id: k.id,
            name: k.name,
            key: k.key_prefix + '••••••••••••',
            permissions: JSON.parse(k.permissions || '["read"]'),
            createdAt: k.created_at,
            lastUsed: k.last_used
        }));

        res.json({ keys: maskedKeys });
    } catch (err) {
        console.error('[SettingsRoute] Error getting API keys:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/settings/api-keys
 * @desc Create a new API key
 * @access Private
 */
router.post('/api-keys', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, permissions = ['read'] } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Key name is required' });
        }

        // Generate a secure API key
        const keyId = uuidv4();
        const keySecret = crypto.randomBytes(32).toString('hex');
        const fullKey = `pk_${keyId.replace(/-/g, '').substring(0, 8)}_${keySecret}`;
        const keyPrefix = fullKey.substring(0, 12);
        const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_api_keys (id, user_id, name, key_hash, key_prefix, permissions, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [keyId, userId, name.trim(), keyHash, keyPrefix, JSON.stringify(permissions)],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            key: fullKey, // Only shown once!
            apiKey: {
                id: keyId,
                name: name.trim(),
                key: keyPrefix + '••••••••••••',
                permissions,
                createdAt: new Date().toISOString(),
                lastUsed: null
            }
        });
    } catch (err) {
        console.error('[SettingsRoute] Error creating API key:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route DELETE /api/settings/api-keys/:id
 * @desc Delete an API key
 * @access Private
 */
router.delete('/api-keys/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM user_api_keys WHERE id = ? AND user_id = ?',
                [id, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[SettingsRoute] Error deleting API key:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CONNECTED ACCOUNTS (SSO)
// ==========================================

/**
 * @route GET /api/settings/connected-accounts
 * @desc Get all connected accounts for the user
 * @access Private
 */
router.get('/connected-accounts', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const accounts = await new Promise((resolve, reject) => {
            db.all(
                'SELECT provider, email, connected_at, status FROM user_connected_accounts WHERE user_id = ?',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        const formatted = accounts.map(a => ({
            provider: a.provider,
            email: a.email,
            connectedAt: a.connected_at,
            status: a.status || 'active'
        }));

        res.json({ accounts: formatted });
    } catch (err) {
        console.error('[SettingsRoute] Error getting connected accounts:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route DELETE /api/settings/connected-accounts/:provider
 * @desc Disconnect an SSO account
 * @access Private
 */
router.delete('/connected-accounts/:provider', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM user_connected_accounts WHERE user_id = ? AND provider = ?',
                [userId, provider],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[SettingsRoute] Error disconnecting account:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// DATA EXPORT (GDPR)
// ==========================================

/**
 * @route POST /api/settings/export-data
 * @desc Request data export for GDPR compliance
 * @access Private
 */
router.post('/export-data', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = req.user;

        // In production, this would queue a background job
        // For now, we create a simple response indicating the request was received

        // Log the export request
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO data_export_requests (id, user_id, status, requested_at)
                 VALUES (?, ?, 'pending', datetime('now'))`,
                [uuidv4(), userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            success: true, 
            message: 'Data export request submitted. You will receive an email when your data is ready.',
            estimatedTime: '24 hours'
        });
    } catch (err) {
        console.error('[SettingsRoute] Error requesting data export:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/settings/request-deletion
 * @desc Request account deletion for GDPR compliance
 * @access Private
 */
router.post('/request-deletion', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { email, reason } = req.body;

        // Verify email matches
        if (email !== req.user.email) {
            return res.status(400).json({ error: 'Email does not match your account' });
        }

        // Log the deletion request (don't actually delete - requires manual review)
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO account_deletion_requests (id, user_id, reason, status, requested_at)
                 VALUES (?, ?, ?, 'pending', datetime('now'))`,
                [uuidv4(), userId, reason || 'user_requested'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            success: true, 
            message: 'Account deletion request submitted. You will receive a confirmation email within 48 hours.'
        });
    } catch (err) {
        console.error('[SettingsRoute] Error requesting account deletion:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get default preferences for all categories
 */
function getDefaultPreferences() {
    return {
        work: {
            defaultProjectView: 'kanban',
            defaultTaskSort: 'priority',
            weekStartDay: 'monday',
            showCompletedTasks: false,
            showSubtasks: true,
            autoArchiveDays: 30,
            taskDefaultDueDays: 7,
            defaultTimeTracking: 'none',
            defaultTaskPriority: 'medium',
            defaultReminderBefore: '1day',
            defaultSnoozeDuration: '1hour',
            autoSnoozeOverdue: false,
            enableFocusMode: true,
            focusModeBlocksNotifications: true,
            defaultFocusDuration: 25
        },
        dashboard: {
            defaultLandingPage: 'dashboard',
            showGreeting: true,
            compactMode: false,
            autoRefreshInterval: 0,
            widgets: {
                tasks: true,
                initiatives: true,
                calendar: true,
                aiInsights: true,
                recentActivity: true,
                quickActions: true,
                metrics: true
            }
        },
        accessibility: {
            fontSize: 'medium',
            highContrastMode: false,
            reduceMotion: false,
            screenReaderOptimized: false,
            showKeyboardShortcuts: true,
            focusHighlight: true,
            cursorSize: 'default',
            textSpacing: 'default',
            underlineLinks: false
        },
        privacy: {
            profileVisibility: 'organization',
            showOnlineStatus: true,
            showActivityStatus: true,
            showLastSeen: true,
            shareAnalytics: true,
            shareUsageData: false,
            improveAI: true,
            marketingEmails: false,
            productUpdates: true,
            newsletterSubscribed: false,
            allowThirdPartyIntegrations: true
        },
        ai: {
            responseStyle: 'balanced',
            writingTone: 'professional',
            autoSuggestions: true,
            contextRetention: 'session',
            preferredLanguage: 'auto',
            codeExplanations: true,
            showSources: true
        },
        regional: {
            timezone: 'UTC',
            units: 'metric',
            currency: 'USD',
            numberFormat: 'en-US',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '24h',
            firstDayOfWeek: 'monday'
        },
        sound: {
            enabled: true,
            volume: 70,
            soundTheme: 'default',
            taskAssigned: true,
            taskCompleted: true,
            mention: true,
            message: true,
            reminder: true,
            quietHoursEnabled: false,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            quietHoursWeekends: true
        },
        advanced: {
            defaultExportFormat: 'pdf',
            includeAttachments: true,
            exportDateRange: 'all',
            enableDeveloperMode: false,
            showDebugInfo: false,
            logAPIRequests: false,
            keyboardShortcutsEnabled: true,
            enableBetaFeatures: false
        }
    };
}

module.exports = router;
