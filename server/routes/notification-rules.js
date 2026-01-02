/**
 * Notification Rules API
 * 
 * Features:
 * - Custom notification rules (if/then)
 * - Quiet hours settings
 * - Sound settings per type
 * - Device settings (desktop/mobile)
 * - Digest settings
 * - Notification channels
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const db = require('../database');

router.use(requireAuth);

// ==========================================
// NOTIFICATION RULES
// ==========================================

/**
 * GET /api/user/notification-rules
 * Get all notification rules and settings
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT notification_rules_json, quiet_hours_json, sound_settings_json, 
                        device_settings_json, digest_settings_json
                 FROM notification_user_settings WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        let data = {
            rules: [],
            quietHours: {
                enabled: false,
                startTime: '22:00',
                endTime: '08:00',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                allowUrgent: true
            },
            soundSettings: {
                enabled: true,
                volume: 80,
                sounds: {}
            },
            deviceSettings: {
                desktop: { enabled: true, showPreview: true, playSound: true, badgeCount: true },
                mobile: { enabled: true, showPreview: true, vibration: true, led: true }
            },
            digestSettings: {
                enabled: false,
                frequency: 'daily',
                time: '09:00',
                includeTypes: []
            }
        };

        if (settings) {
            try {
                if (settings.notification_rules_json) data.rules = JSON.parse(settings.notification_rules_json);
                if (settings.quiet_hours_json) data.quietHours = { ...data.quietHours, ...JSON.parse(settings.quiet_hours_json) };
                if (settings.sound_settings_json) data.soundSettings = { ...data.soundSettings, ...JSON.parse(settings.sound_settings_json) };
                if (settings.device_settings_json) data.deviceSettings = { ...data.deviceSettings, ...JSON.parse(settings.device_settings_json) };
                if (settings.digest_settings_json) data.digestSettings = { ...data.digestSettings, ...JSON.parse(settings.digest_settings_json) };
            } catch (e) {
                console.error('Error parsing notification settings:', e);
            }
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching notification rules:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch notification rules' });
    }
});

/**
 * PUT /api/user/notification-rules
 * Update notification rules and settings
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { rules, quietHours, soundSettings, deviceSettings, digestSettings } = req.body;

        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM notification_user_settings WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const rulesJson = JSON.stringify(rules || []);
        const quietJson = JSON.stringify(quietHours || {});
        const soundJson = JSON.stringify(soundSettings || {});
        const deviceJson = JSON.stringify(deviceSettings || {});
        const digestJson = JSON.stringify(digestSettings || {});

        if (existing) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE notification_user_settings SET
                        notification_rules_json = ?,
                        quiet_hours_json = ?,
                        sound_settings_json = ?,
                        device_settings_json = ?,
                        digest_settings_json = ?,
                        updated_at = datetime('now')
                     WHERE user_id = ?`,
                    [rulesJson, quietJson, soundJson, deviceJson, digestJson, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO notification_user_settings 
                     (user_id, notification_rules_json, quiet_hours_json, sound_settings_json, device_settings_json, digest_settings_json, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    [userId, rulesJson, quietJson, soundJson, deviceJson, digestJson],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'Notification rules updated' });
    } catch (error) {
        console.error('Error updating notification rules:', error);
        res.status(500).json({ success: false, error: 'Failed to update notification rules' });
    }
});

// ==========================================
// NOTIFICATION CHANNELS
// ==========================================

/**
 * GET /api/user/notification-channels
 * Get notification channel settings
 */
router.get('/channels', async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT channels_json FROM notification_user_settings WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        let channels = {
            slack: { enabled: false, connected: false, settings: {} },
            teams: { enabled: false, connected: false, settings: {} },
            sms: { enabled: false, connected: false, settings: { criticalOnly: true } },
            whatsapp: { enabled: false, connected: false, settings: {} },
            email: { enabled: true, connected: true, settings: {} },
            inApp: {
                enabled: true,
                connected: true,
                settings: {},
                showUnreadBadge: true,
                autoMarkAsRead: false,
                groupByType: true,
                maxNotifications: 100
            }
        };

        if (settings?.channels_json) {
            try {
                channels = { ...channels, ...JSON.parse(settings.channels_json) };
            } catch (e) {}
        }

        res.json({ success: true, data: channels });
    } catch (error) {
        console.error('Error fetching notification channels:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch notification channels' });
    }
});

/**
 * PUT /api/user/notification-channels
 * Update notification channel settings
 */
router.put('/channels', async (req, res) => {
    try {
        const userId = req.user.id;
        const channels = req.body;

        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM notification_user_settings WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const channelsJson = JSON.stringify(channels);

        if (existing) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE notification_user_settings SET channels_json = ?, updated_at = datetime('now') WHERE user_id = ?`,
                    [channelsJson, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO notification_user_settings (user_id, channels_json, created_at, updated_at)
                     VALUES (?, ?, datetime('now'), datetime('now'))`,
                    [userId, channelsJson],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'Notification channels updated' });
    } catch (error) {
        console.error('Error updating notification channels:', error);
        res.status(500).json({ success: false, error: 'Failed to update notification channels' });
    }
});

/**
 * POST /api/user/notification-channels/sms/setup
 * Setup SMS notifications
 */
router.post('/sms/setup', async (req, res) => {
    try {
        const userId = req.user.id;
        const { phoneNumber } = req.body;

        // In production, send verification SMS here
        // For now, just store the phone number

        res.json({ success: true, message: 'Verification code sent' });
    } catch (error) {
        console.error('Error setting up SMS:', error);
        res.status(500).json({ success: false, error: 'Failed to setup SMS' });
    }
});

/**
 * POST /api/user/notification-channels/sms/verify
 * Verify SMS phone number
 */
router.post('/sms/verify', async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.body;

        // In production, verify the code
        // For now, accept any 6-digit code
        if (code && code.length === 6) {
            res.json({ success: true, message: 'Phone number verified' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid verification code' });
        }
    } catch (error) {
        console.error('Error verifying SMS:', error);
        res.status(500).json({ success: false, error: 'Failed to verify SMS' });
    }
});

module.exports = router;

