import crypto from 'crypto';
import express from 'express';
const router = express.Router();
import db from '../database.js';


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

import auth from '../middleware/authMiddleware.js';
import * as NotificationOutboxServiceModule from '../services/notificationOutboxService.js';
const NotificationOutboxService = NotificationOutboxServiceModule.default || NotificationOutboxServiceModule;

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
    const { v4: uuidv4 } = await import('uuid');

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
// INTEGRATION ANALYTICS & MONITORING
// ==========================================

const IntegrationAnalyticsServiceModule = await import('../services/integrationAnalyticsService.js');

const IntegrationAnalyticsService = IntegrationAnalyticsServiceModule.default || IntegrationAnalyticsServiceModule;

// GET Integration Analytics - aggregated stats
router.get('/integrations/analytics', auth, async (req, res) => {
    try {
        const { integrationId, period = '7d' } = req.query;
        
        if (!integrationId) {
            return res.status(400).json({ error: 'Integration ID required' });
        }

        const stats = await IntegrationAnalyticsService.getUsageStats(integrationId, period);
        const metrics = await IntegrationAnalyticsService.getPerformanceMetrics(integrationId, period);
        const aggregated = await IntegrationAnalyticsService.getAggregatedAnalytics(integrationId, 'daily', parseInt(period) || 7);

        res.json({
            stats,
            metrics,
            aggregated
        });
    } catch (error) {
        console.error('[Settings] Analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET Integration Logs
router.get('/integrations/:id/logs', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, type = 'all' } = req.query;

        let logs = [];
        if (type === 'errors' || type === 'all') {
            const errorLogs = await IntegrationAnalyticsService.getErrorLogs(id, parseInt(limit));
            logs = logs.concat(errorLogs.map(log => ({ ...log, logType: 'error' })));
        }
        if (type === 'all') {
            // Also get recent successful logs
            const allLogs = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        id,
                        endpoint,
                        method,
                        status_code,
                        response_time_ms,
                        tokens_used,
                        cost,
                        created_at
                    FROM api_usage_logs
                    WHERE integration_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                `, [id, parseInt(limit)], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
            logs = allLogs.map(log => ({ ...log, logType: log.status_code >= 400 ? 'error' : 'success' }));
        }

        // Sort by created_at desc and limit
        logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        logs = logs.slice(0, parseInt(limit));

        res.json({ logs });
    } catch (error) {
        console.error('[Settings] Logs error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET Integration Health Status
router.get('/integrations/:id/health', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const healthStatus = await IntegrationAnalyticsService.getHealthStatus(id);
        const history = await IntegrationAnalyticsService.getHealthCheckHistory(id, 100);

        res.json({
            status: healthStatus,
            history
        });
    } catch (error) {
        console.error('[Settings] Health error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST Record Health Check (for scheduled health checks)
router.post('/integrations/:id/health-check', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, latencyMs, errorMessage, checkType } = req.body;

        const result = await IntegrationAnalyticsService.recordHealthCheck({
            integrationId: id,
            status: status || 'healthy',
            latencyMs,
            errorMessage,
            checkType: checkType || 'ping'
        });

        res.json({ success: true, id: result.id });
    } catch (error) {
        console.error('[Settings] Health check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET Webhook Deliveries (for settings view)
router.get('/webhooks/:id/deliveries', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;

        const deliveries = await IntegrationAnalyticsService.getWebhookDeliveries(id, parseInt(limit));
        res.json({ deliveries });
    } catch (error) {
        console.error('[Settings] Webhook deliveries error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// USER API KEYS MANAGEMENT
// ==========================================

// GET User API Keys Usage
router.get('/user/api-keys/:id/usage', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { period = '7d' } = req.query;

        // Verify key belongs to user
        const key = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM user_api_keys WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        // Get usage stats from analytics service
        const periodMap = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
        const days = periodMap[period] || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const usage = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM api_usage_logs
                WHERE api_key_id = ? AND created_at >= ?
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `, [id, startDate.toISOString()], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json({ requests: usage, period });
    } catch (error) {
        console.error('[Settings] API key usage error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT Rotate API Key
router.put('/user/api-keys/:id/rotate', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { v4: uuidv4 } = await import('uuid');
        const crypto = crypto;

        // Verify key belongs to user
        const key = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM user_api_keys WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        // Generate new key
        const newKey = 'ck_live_' + crypto.randomBytes(24).toString('hex');
        const keyHash = crypto.createHash('sha256').update(newKey).digest('hex');
        const keyPrefix = newKey.substring(0, 12) + '...';

        // Update key
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE user_api_keys 
                SET key_hash = ?, key_prefix = ?, created_at = datetime('now')
                WHERE id = ?
            `, [keyHash, keyPrefix, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            newKey: newKey,
            message: 'API key rotated. Save this key now - it won\'t be shown again!'
        });
    } catch (error) {
        console.error('[Settings] Rotate API key error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT Update API Key Quota
router.put('/user/api-keys/:id/quota', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { quotaLimit, quotaUsed, quotaResetAt } = req.body;

        // Verify key belongs to user
        const key = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM user_api_keys WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        const updates = [];
        const params = [];

        if (quotaLimit !== undefined) {
            updates.push('quota_limit = ?');
            params.push(quotaLimit);
        }
        if (quotaUsed !== undefined) {
            updates.push('quota_used = ?');
            params.push(quotaUsed);
        }
        if (quotaResetAt !== undefined) {
            updates.push('quota_reset_at = ?');
            params.push(quotaResetAt);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id);

        await new Promise((resolve, reject) => {
            db.run(`UPDATE user_api_keys SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Settings] Update quota error:', error);
        res.status(500).json({ error: error.message });
    }
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
        const validCategories = [
            'work', 'dashboard', 'accessibility', 'privacy', 'ai', 'regional', 'sound', 'advanced',
            'shortcuts', 'collaboration', 'performance', 'mobile', 'automation', 'aiLearning', 
            'quietHours', 'securityAlerts'
        ];
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
        const validCategories = [
            'work', 'dashboard', 'accessibility', 'privacy', 'ai', 'regional', 'sound', 'advanced',
            'shortcuts', 'collaboration', 'performance', 'mobile', 'automation', 'aiLearning', 
            'quietHours', 'securityAlerts'
        ];
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

const UserNotificationPreferencesServiceModule = await import('../services/userNotificationPreferencesService.js');

const UserNotificationPreferencesService = UserNotificationPreferencesServiceModule.default || UserNotificationPreferencesServiceModule;

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

const { v4 as uuidv4  } = await import('uuid');

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

/**
 * @route GET /api/settings/user/api-keys
 * @desc Get user API keys (for compatibility with frontend)
 * @access Private
 */
router.get('/user/api-keys', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const keys = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, name, key_prefix as prefix, permissions, 
                        rate_limit, quota_limit, quota_used, quota_reset_at,
                        expires_at, ip_whitelist, scopes,
                        created_at as createdAt, last_used_at as lastUsed
                 FROM user_api_keys 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        const formattedKeys = keys.map(k => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            createdAt: k.createdAt,
            lastUsed: k.lastUsed ? new Date(k.lastUsed).toLocaleString() : undefined,
            rateLimit: k.rate_limit,
            quotaLimit: k.quota_limit,
            quotaUsed: k.quota_used,
            quotaResetAt: k.quota_reset_at,
            expiresAt: k.expires_at,
            ipWhitelist: k.ip_whitelist ? JSON.parse(k.ip_whitelist) : undefined,
            scopes: k.scopes ? JSON.parse(k.scopes) : (k.permissions ? JSON.parse(k.permissions) : ['read'])
        }));

        res.json(formattedKeys);
    } catch (err) {
        console.error('[SettingsRoute] Error getting user API keys:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/user/api-keys/:id
 * @desc Update API key settings
 * @access Private
 */
router.put('/user/api-keys/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { rateLimit, quotaLimit, expiresAt, ipWhitelist, scopes } = req.body;

        // Verify key belongs to user
        const key = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM user_api_keys WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        const updates = [];
        const params = [];

        if (rateLimit !== undefined) {
            updates.push('rate_limit = ?');
            params.push(rateLimit);
        }
        if (quotaLimit !== undefined) {
            updates.push('quota_limit = ?');
            params.push(quotaLimit);
        }
        if (expiresAt !== undefined) {
            updates.push('expires_at = ?');
            params.push(expiresAt || null);
        }
        if (ipWhitelist !== undefined) {
            updates.push('ip_whitelist = ?');
            params.push(Array.isArray(ipWhitelist) ? JSON.stringify(ipWhitelist) : ipWhitelist);
        }
        if (scopes !== undefined) {
            updates.push('scopes = ?');
            params.push(JSON.stringify(scopes));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id);

        await new Promise((resolve, reject) => {
            db.run(`UPDATE user_api_keys SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Settings] Update API key error:', error);
        res.status(500).json({ error: error.message });
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

// ==========================================
// NOTIFICATION EXTENSIONS (Phase 2)
// ==========================================

/**
 * @route GET /api/settings/notifications/sounds
 * @desc Get sound notification preferences
 * @access Private
 */
router.get('/notifications/sounds', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT sound_enabled, sound_per_type, desktop_position, desktop_duration
            FROM user_notification_preferences_v3
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting sound preferences:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                return res.json({
                    soundEnabled: true,
                    soundPerType: {},
                    desktopPosition: 'top-right',
                    desktopDuration: 5000
                });
            }

            res.json({
                soundEnabled: !!row.sound_enabled,
                soundPerType: row.sound_per_type ? JSON.parse(row.sound_per_type) : {},
                desktopPosition: row.desktop_position || 'top-right',
                desktopDuration: row.desktop_duration || 5000
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting sound preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/notifications/sounds
 * @desc Update sound notification preferences
 * @access Private
 */
router.put('/notifications/sounds', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { soundEnabled, soundPerType, desktopPosition, desktopDuration } = req.body;

        db.run(`
            INSERT INTO user_notification_preferences_v3 
            (user_id, sound_enabled, sound_per_type, desktop_position, desktop_duration)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                sound_enabled = excluded.sound_enabled,
                sound_per_type = excluded.sound_per_type,
                desktop_position = excluded.desktop_position,
                desktop_duration = excluded.desktop_duration
        `, [
            userId,
            soundEnabled ? 1 : 0,
            JSON.stringify(soundPerType || {}),
            desktopPosition || 'top-right',
            desktopDuration || 5000
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating sound preferences:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating sound preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/notifications/quiet-hours
 * @desc Get quiet hours preferences
 * @access Private
 */
router.get('/notifications/quiet-hours', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_days
            FROM user_notification_preferences_v3
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting quiet hours:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                return res.json({
                    enabled: false,
                    startTime: '22:00',
                    endTime: '08:00',
                    days: [1, 2, 3, 4, 5]
                });
            }

            res.json({
                enabled: !!row.quiet_hours_enabled,
                startTime: row.quiet_hours_start || '22:00',
                endTime: row.quiet_hours_end || '08:00',
                days: row.quiet_hours_days ? JSON.parse(row.quiet_hours_days) : [1, 2, 3, 4, 5]
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting quiet hours:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/notifications/quiet-hours
 * @desc Update quiet hours preferences
 * @access Private
 */
router.put('/notifications/quiet-hours', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { enabled, startTime, endTime, days } = req.body;

        db.run(`
            INSERT INTO user_notification_preferences_v3 
            (user_id, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_days)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                quiet_hours_enabled = excluded.quiet_hours_enabled,
                quiet_hours_start = excluded.quiet_hours_start,
                quiet_hours_end = excluded.quiet_hours_end,
                quiet_hours_days = excluded.quiet_hours_days
        `, [
            userId,
            enabled ? 1 : 0,
            startTime || null,
            endTime || null,
            JSON.stringify(days || [])
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating quiet hours:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating quiet hours:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/notifications/dnd
 * @desc Get DND mode preferences
 * @access Private
 */
router.get('/notifications/dnd', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT dnd_enabled, dnd_until
            FROM user_notification_preferences_v3
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting DND preferences:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                return res.json({
                    enabled: false,
                    until: null
                });
            }

            res.json({
                enabled: !!row.dnd_enabled,
                until: row.dnd_until || null
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting DND preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/notifications/dnd
 * @desc Update DND mode preferences
 * @access Private
 */
router.put('/notifications/dnd', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { enabled, until } = req.body;

        db.run(`
            INSERT INTO user_notification_preferences_v3 
            (user_id, dnd_enabled, dnd_until)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                dnd_enabled = excluded.dnd_enabled,
                dnd_until = excluded.dnd_until
        `, [
            userId,
            enabled ? 1 : 0,
            until || null
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating DND preferences:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating DND preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/notifications/grouping
 * @desc Get notification grouping preferences
 * @access Private
 */
router.get('/notifications/grouping', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT grouping_enabled, grouping_by, batching_enabled, batch_window_minutes
            FROM user_notification_preferences_v3
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting grouping preferences:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                return res.json({
                    enabled: true,
                    groupingBy: 'project',
                    batchingEnabled: true,
                    batchWindow: 5
                });
            }

            res.json({
                enabled: row.grouping_enabled !== 0,
                groupingBy: row.grouping_by || 'project',
                batchingEnabled: row.batching_enabled !== 0,
                batchWindow: row.batch_window_minutes || 5
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting grouping preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/notifications/grouping
 * @desc Update notification grouping preferences
 * @access Private
 */
router.put('/notifications/grouping', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { enabled, groupingBy, batchingEnabled, batchWindow } = req.body;

        db.run(`
            INSERT INTO user_notification_preferences_v3 
            (user_id, grouping_enabled, grouping_by, batching_enabled, batch_window_minutes)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                grouping_enabled = excluded.grouping_enabled,
                grouping_by = excluded.grouping_by,
                batching_enabled = excluded.batching_enabled,
                batch_window_minutes = excluded.batch_window_minutes
        `, [
            userId,
            enabled ? 1 : 0,
            groupingBy || 'project',
            batchingEnabled ? 1 : 0,
            batchWindow || 5
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating grouping preferences:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating grouping preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/notifications/digest
 * @desc Get notification digest preferences
 * @access Private
 */
router.get('/notifications/digest', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT digest_frequency, digest_content, digest_format
            FROM user_notification_preferences_v3
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting digest preferences:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                return res.json({
                    frequency: 'instant',
                    content: 'summary',
                    format: 'html'
                });
            }

            res.json({
                frequency: row.digest_frequency || 'instant',
                content: row.digest_content || 'summary',
                format: row.digest_format || 'html'
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting digest preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/notifications/digest
 * @desc Update notification digest preferences
 * @access Private
 */
router.put('/notifications/digest', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { frequency, content, format } = req.body;

        db.run(`
            INSERT INTO user_notification_preferences_v3 
            (user_id, digest_frequency, digest_content, digest_format)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                digest_frequency = excluded.digest_frequency,
                digest_content = excluded.digest_content,
                digest_format = excluded.digest_format
        `, [
            userId,
            frequency || 'instant',
            content || 'summary',
            format || 'html'
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating digest preferences:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating digest preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// AI PREFERENCES EXTENSIONS (Phase 3)
// ==========================================

/**
 * @route GET /api/settings/ai/model-selection
 * @desc Get AI model selection preferences
 * @access Private
 */
router.get('/ai/model-selection', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT model_selection, preferred_model_id
            FROM ai_user_preferences
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting model selection:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                return res.json({
                    enabledModels: [],
                    preferredModel: null
                });
            }

            res.json({
                enabledModels: row.model_selection ? JSON.parse(row.model_selection) : [],
                preferredModel: row.preferred_model_id || null
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting model selection:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/ai/model-selection
 * @desc Update AI model selection preferences
 * @access Private
 */
router.put('/ai/model-selection', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { enabledModels, preferredModel } = req.body;

        db.run(`
            INSERT INTO ai_user_preferences (user_id, model_selection, preferred_model_id)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                model_selection = excluded.model_selection,
                preferred_model_id = excluded.preferred_model_id
        `, [
            userId,
            JSON.stringify(enabledModels || []),
            preferredModel || null
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating model selection:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating model selection:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/ai/parameters
 * @desc Get AI parameters preferences
 * @access Private
 */
router.get('/ai/parameters', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT temperature, max_tokens, context_window_size, response_speed
            FROM ai_user_preferences
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting AI parameters:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                return res.json({
                    temperature: 0.7,
                    maxTokens: 2000,
                    contextWindowSize: 4000,
                    responseSpeed: 'balanced'
                });
            }

            res.json({
                temperature: row.temperature ?? 0.7,
                maxTokens: row.max_tokens ?? 2000,
                contextWindowSize: row.context_window_size ?? 4000,
                responseSpeed: row.response_speed || 'balanced'
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting AI parameters:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/ai/parameters
 * @desc Update AI parameters preferences
 * @access Private
 */
router.put('/ai/parameters', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { temperature, maxTokens, contextWindowSize, responseSpeed } = req.body;

        db.run(`
            INSERT INTO ai_user_preferences (user_id, temperature, max_tokens, context_window_size, response_speed)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                temperature = excluded.temperature,
                max_tokens = excluded.max_tokens,
                context_window_size = excluded.context_window_size,
                response_speed = excluded.response_speed
        `, [
            userId,
            temperature ?? 0.7,
            maxTokens ?? 2000,
            contextWindowSize ?? 4000,
            responseSpeed || 'balanced'
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating AI parameters:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating AI parameters:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/ai/personality
 * @desc Get AI personality preferences
 * @access Private
 */
router.get('/ai/personality', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT personality_preset
            FROM ai_user_preferences
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting AI personality:', err);
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                personality: row?.personality_preset || 'professional'
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting AI personality:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/ai/personality
 * @desc Update AI personality preferences
 * @access Private
 */
router.put('/ai/personality', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { personality } = req.body;

        db.run(`
            INSERT INTO ai_user_preferences (user_id, personality_preset)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                personality_preset = excluded.personality_preset
        `, [
            userId,
            personality || 'professional'
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating AI personality:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating AI personality:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/settings/ai/autocomplete
 * @desc Get AI auto-complete preferences
 * @access Private
 */
router.get('/ai/autocomplete', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get(`
            SELECT auto_suggestions, auto_complete_sensitivity, suggestions_in_comments
            FROM ai_user_preferences
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) {
                console.error('[SettingsRoute] Error getting auto-complete preferences:', err);
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                enabled: row?.auto_suggestions !== 0,
                sensitivity: row?.auto_complete_sensitivity ?? 0.5,
                suggestionsInComments: row?.suggestions_in_comments !== 0
            });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting auto-complete preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/ai/autocomplete
 * @desc Update AI auto-complete preferences
 * @access Private
 */
router.put('/ai/autocomplete', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { enabled, sensitivity, suggestionsInComments } = req.body;

        db.run(`
            INSERT INTO ai_user_preferences (user_id, auto_suggestions, auto_complete_sensitivity, suggestions_in_comments)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                auto_suggestions = excluded.auto_suggestions,
                auto_complete_sensitivity = excluded.auto_complete_sensitivity,
                suggestions_in_comments = excluded.suggestions_in_comments
        `, [
            userId,
            enabled ? 1 : 0,
            sensitivity ?? 0.5,
            suggestionsInComments ? 1 : 0
        ], (err) => {
            if (err) {
                console.error('[SettingsRoute] Error updating auto-complete preferences:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json({ success: true });
        });
    } catch (err) {
        console.error('[SettingsRoute] Error updating auto-complete preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// WORKING HOURS
// ==========================================

/**
 * @route GET /api/settings/working-hours
 * @desc Get user working hours schedule
 * @access Private
 */
router.get('/working-hours', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get settings
        const settings = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM user_working_hours_settings WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Get schedule
        const hours = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM user_working_hours WHERE user_id = ? ORDER BY day_of_week', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Convert to frontend format
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const schedule = {};
        dayNames.forEach((day, idx) => {
            const hourEntry = hours.find(h => h.day_of_week === idx);
            schedule[day] = hourEntry ? {
                enabled: !!hourEntry.is_working_day,
                startTime: hourEntry.start_time || '09:00',
                endTime: hourEntry.end_time || '17:00'
            } : {
                enabled: idx !== 0 && idx !== 6, // Default: weekdays enabled
                startTime: '09:00',
                endTime: '17:00'
            };
        });
        
        res.json({
            timezone: settings?.timezone || req.user.timezone || 'UTC',
            schedule,
            syncWithCalendar: !!settings?.sync_with_calendar,
            blockOutsideHours: !!settings?.block_outside_hours
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting working hours:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/working-hours
 * @desc Update user working hours schedule
 * @access Private
 */
router.put('/working-hours', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { timezone, schedule, syncWithCalendar, blockOutsideHours } = req.body;
        
        // Update settings
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO user_working_hours_settings (user_id, timezone, sync_with_calendar, block_outside_hours)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    timezone = excluded.timezone,
                    sync_with_calendar = excluded.sync_with_calendar,
                    block_outside_hours = excluded.block_outside_hours,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, timezone, syncWithCalendar ? 1 : 0, blockOutsideHours ? 1 : 0], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Update schedule
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        for (let i = 0; i < dayNames.length; i++) {
            const day = dayNames[i];
            const daySchedule = schedule[day];
            if (daySchedule) {
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO user_working_hours (user_id, day_of_week, start_time, end_time, is_working_day)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(user_id, day_of_week) DO UPDATE SET
                            start_time = excluded.start_time,
                            end_time = excluded.end_time,
                            is_working_day = excluded.is_working_day,
                            updated_at = CURRENT_TIMESTAMP
                    `, [userId, i, daySchedule.startTime, daySchedule.endTime, daySchedule.enabled ? 1 : 0], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('[SettingsRoute] Error updating working hours:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// EMAIL SIGNATURES
// ==========================================

/**
 * @route GET /api/settings/signatures
 * @desc Get user email signatures
 * @access Private
 */
router.get('/signatures', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const signatures = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM user_email_signatures WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json({ signatures });
    } catch (err) {
        console.error('[SettingsRoute] Error getting signatures:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/settings/signatures
 * @desc Create new email signature
 * @access Private
 */
router.post('/signatures', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, content, isDefault } = req.body;
        
        // If setting as default, unset others first
        if (isDefault) {
            await new Promise((resolve, reject) => {
                db.run('UPDATE user_email_signatures SET is_default = 0 WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        
        const result = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO user_email_signatures (user_id, name, content, is_default)
                VALUES (?, ?, ?, ?)
            `, [userId, name, content, isDefault ? 1 : 0], function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            });
        });
        
        res.json({
            signature: {
                id: result.id.toString(),
                name,
                content,
                isDefault: !!isDefault,
                createdAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('[SettingsRoute] Error creating signature:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/signatures/:id
 * @desc Update email signature
 * @access Private
 */
router.put('/signatures/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const signatureId = req.params.id;
        const { name, content } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE user_email_signatures 
                SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            `, [name, content, signatureId, userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true });
    } catch (err) {
        console.error('[SettingsRoute] Error updating signature:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/signatures/:id/default
 * @desc Set signature as default
 * @access Private
 */
router.put('/signatures/:id/default', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const signatureId = req.params.id;
        
        // Unset all defaults first
        await new Promise((resolve, reject) => {
            db.run('UPDATE user_email_signatures SET is_default = 0 WHERE user_id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Set this one as default
        await new Promise((resolve, reject) => {
            db.run('UPDATE user_email_signatures SET is_default = 1 WHERE id = ? AND user_id = ?', [signatureId, userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true });
    } catch (err) {
        console.error('[SettingsRoute] Error setting default signature:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route DELETE /api/settings/signatures/:id
 * @desc Delete email signature
 * @access Private
 */
router.delete('/signatures/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const signatureId = req.params.id;
        
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM user_email_signatures WHERE id = ? AND user_id = ?', [signatureId, userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true });
    } catch (err) {
        console.error('[SettingsRoute] Error deleting signature:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// RECOVERY OPTIONS
// ==========================================

/**
 * @route GET /api/settings/recovery
 * @desc Get user recovery options
 * @access Private
 */
router.get('/recovery', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const options = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM user_recovery_options WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        res.json({
            recoveryEmail: options?.recovery_email || '',
            recoveryPhone: options?.recovery_phone || '',
            backupCodesCount: options?.backup_codes_remaining || 0,
            lastBackupCodesGenerated: options?.backup_codes_generated_at
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting recovery options:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/recovery
 * @desc Update user recovery options
 * @access Private
 */
router.put('/recovery', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { recoveryEmail, recoveryPhone } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO user_recovery_options (user_id, recovery_email, recovery_phone)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    recovery_email = excluded.recovery_email,
                    recovery_phone = excluded.recovery_phone,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, recoveryEmail, recoveryPhone], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true });
    } catch (err) {
        console.error('[SettingsRoute] Error updating recovery options:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// APPEARANCE PREFERENCES
// ==========================================

/**
 * @route GET /api/settings/preferences/appearance
 * @desc Get user appearance preferences
 * @access Private
 */
router.get('/preferences/appearance', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const prefs = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM user_appearance_preferences WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        res.json({
            preferences: {
                theme: prefs?.theme || 'system',
                uiDensity: prefs?.ui_density || 'comfortable',
                startPage: prefs?.start_page || 'dashboard',
                fontScale: prefs?.font_scale || 100,
                sidebarCollapsed: !!prefs?.sidebar_collapsed,
                showWelcomeTips: prefs?.show_welcome_tips !== 0,
                accentColor: prefs?.accent_color || 'purple'
            }
        });
    } catch (err) {
        console.error('[SettingsRoute] Error getting appearance preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/settings/preferences/appearance
 * @desc Update user appearance preferences
 * @access Private
 */
router.put('/preferences/appearance', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { preferences } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO user_appearance_preferences (
                    user_id, theme, ui_density, start_page, font_scale, 
                    sidebar_collapsed, show_welcome_tips, accent_color
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    theme = excluded.theme,
                    ui_density = excluded.ui_density,
                    start_page = excluded.start_page,
                    font_scale = excluded.font_scale,
                    sidebar_collapsed = excluded.sidebar_collapsed,
                    show_welcome_tips = excluded.show_welcome_tips,
                    accent_color = excluded.accent_color,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                userId,
                preferences.theme || 'system',
                preferences.uiDensity || 'comfortable',
                preferences.startPage || 'dashboard',
                preferences.fontScale || 100,
                preferences.sidebarCollapsed ? 1 : 0,
                preferences.showWelcomeTips !== false ? 1 : 0,
                preferences.accentColor || 'purple'
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Also update user table columns for quick access
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE users SET 
                    ui_density = ?,
                    start_page = ?,
                    font_scale = ?
                WHERE id = ?
            `, [
                preferences.uiDensity || 'comfortable',
                preferences.startPage || 'dashboard',
                preferences.fontScale || 100,
                userId
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true });
    } catch (err) {
        console.error('[SettingsRoute] Error updating appearance preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
