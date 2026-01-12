import crypto from 'crypto';
/**
 * Advanced User Security Routes
 * 
 * Features:
 * - Password history (prevent reuse)
 * - Password expiration policy
 * - IP whitelist/blacklist
 * - Geolocation-based security alerts
 * - Suspicious activity detection
 * - Security questions backup
 * - Recovery email/phone
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

router.use(requireAuth);

// ==========================================
// PASSWORD POLICY
// ==========================================

/**
 * GET /api/user/security/password-policy
 * Get password policy settings
 */
router.get('/password-policy', async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        // Get user-specific policy, then org policy, then defaults
        const policy = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM password_policy 
                 WHERE user_id = ? OR organization_id = ? OR (user_id IS NULL AND organization_id IS NULL)
                 ORDER BY user_id DESC, organization_id DESC
                 LIMIT 1`,
                [userId, organizationId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // Get password last changed
        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT password_last_changed, password_expires_at, force_password_change 
                 FROM user_security_settings WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.json({
            success: true,
            data: {
                policy: policy || {
                    min_length: 8,
                    require_uppercase: 1,
                    require_lowercase: 1,
                    require_numbers: 1,
                    require_special_chars: 1,
                    max_age_days: 90,
                    history_count: 5,
                    lockout_threshold: 5,
                    lockout_duration_minutes: 30
                },
                passwordLastChanged: settings?.password_last_changed,
                passwordExpiresAt: settings?.password_expires_at,
                forcePasswordChange: !!settings?.force_password_change
            }
        });
    } catch (error) {
        console.error('Error fetching password policy:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch password policy' });
    }
});

/**
 * GET /api/user/security/password-history
 * Check if password was used before
 */
router.post('/check-password-history', async (req, res) => {
    try {
        const userId = req.user.id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, error: 'Password is required' });
        }

        // Get policy for history count
        const policy = await new Promise((resolve, reject) => {
            db.get(
                `SELECT history_count FROM password_policy 
                 WHERE user_id = ? OR organization_id = ? OR (user_id IS NULL AND organization_id IS NULL)
                 ORDER BY user_id DESC, organization_id DESC
                 LIMIT 1`,
                [userId, req.user.organizationId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        const historyCount = policy?.history_count || 5;

        // Get recent password hashes
        const history = await new Promise((resolve, reject) => {
            db.all(
                `SELECT password_hash FROM password_history 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [userId, historyCount],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Check against each historical password
        let wasUsed = false;
        for (const record of history) {
            if (await bcrypt.compare(password, record.password_hash)) {
                wasUsed = true;
                break;
            }
        }

        res.json({
            success: true,
            data: {
                wasUsedBefore: wasUsed,
                historyCount
            }
        });
    } catch (error) {
        console.error('Error checking password history:', error);
        res.status(500).json({ success: false, error: 'Failed to check password history' });
    }
});

// ==========================================
// IP ALLOWLIST/BLOCKLIST
// ==========================================

/**
 * GET /api/user/security/ip-rules
 * Get IP allowlist/blocklist rules
 */
router.get('/ip-rules', async (req, res) => {
    try {
        const userId = req.user.id;

        const rules = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, ip_address, rule_type, description, is_active, created_at, expires_at
                 FROM ip_access_rules 
                 WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
                 ORDER BY created_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({ success: true, data: rules });
    } catch (error) {
        console.error('Error fetching IP rules:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch IP rules' });
    }
});

/**
 * POST /api/user/security/ip-rules
 * Add IP rule (allow or block)
 */
router.post('/ip-rules', async (req, res) => {
    try {
        const userId = req.user.id;
        const { ipAddress, ruleType, description, expiresAt } = req.body;

        if (!ipAddress || !ruleType) {
            return res.status(400).json({ success: false, error: 'IP address and rule type are required' });
        }

        if (!['allow', 'block'].includes(ruleType)) {
            return res.status(400).json({ success: false, error: 'Rule type must be "allow" or "block"' });
        }

        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ip_access_rules 
                 (id, user_id, ip_address, rule_type, description, is_active, created_by, expires_at)
                 VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
                [id, userId, ipAddress, ruleType, description || null, userId, expiresAt || null],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'IP rule created', data: { id } });
    } catch (error) {
        console.error('Error creating IP rule:', error);
        res.status(500).json({ success: false, error: 'Failed to create IP rule' });
    }
});

/**
 * DELETE /api/user/security/ip-rules/:id
 * Delete IP rule
 */
router.delete('/ip-rules/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM ip_access_rules WHERE id = ? AND user_id = ?`,
                [id, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'IP rule deleted' });
    } catch (error) {
        console.error('Error deleting IP rule:', error);
        res.status(500).json({ success: false, error: 'Failed to delete IP rule' });
    }
});

// ==========================================
// SECURITY QUESTIONS
// ==========================================

/**
 * GET /api/user/security/questions/predefined
 * Get list of predefined security questions
 */
router.get('/questions/predefined', async (req, res) => {
    try {
        const questions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, question_text, category FROM predefined_security_questions WHERE is_active = 1`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({ success: true, data: questions });
    } catch (error) {
        console.error('Error fetching predefined questions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch predefined questions' });
    }
});

/**
 * GET /api/user/security/questions
 * Get user's security questions (without answers)
 */
router.get('/questions', async (req, res) => {
    try {
        const userId = req.user.id;

        const questions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT sq.id, sq.question_id, sq.custom_question, 
                        COALESCE(sq.custom_question, psq.question_text) as question_text,
                        sq.created_at
                 FROM security_questions sq
                 LEFT JOIN predefined_security_questions psq ON sq.question_id = psq.id
                 WHERE sq.user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({ success: true, data: questions });
    } catch (error) {
        console.error('Error fetching security questions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch security questions' });
    }
});

/**
 * POST /api/user/security/questions
 * Set security question
 */
router.post('/questions', async (req, res) => {
    try {
        const userId = req.user.id;
        const { questionId, customQuestion, answer } = req.body;

        if ((!questionId && !customQuestion) || !answer) {
            return res.status(400).json({ success: false, error: 'Question and answer are required' });
        }

        const id = uuidv4();
        const answerHash = await bcrypt.hash(answer.toLowerCase().trim(), 10);

        // Upsert question
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO security_questions (id, user_id, question_id, custom_question, answer_hash)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, question_id) DO UPDATE SET
                    custom_question = excluded.custom_question,
                    answer_hash = excluded.answer_hash,
                    updated_at = datetime('now')`,
                [id, userId, questionId || 0, customQuestion || null, answerHash],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Security question saved' });
    } catch (error) {
        console.error('Error saving security question:', error);
        res.status(500).json({ success: false, error: 'Failed to save security question' });
    }
});

/**
 * DELETE /api/user/security/questions/:id
 * Delete security question
 */
router.delete('/questions/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM security_questions WHERE id = ? AND user_id = ?`,
                [id, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Security question deleted' });
    } catch (error) {
        console.error('Error deleting security question:', error);
        res.status(500).json({ success: false, error: 'Failed to delete security question' });
    }
});

// ==========================================
// RECOVERY CONTACTS
// ==========================================

/**
 * GET /api/user/security/recovery
 * Get recovery contacts
 */
router.get('/recovery', async (req, res) => {
    try {
        const userId = req.user.id;

        const contacts = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, contact_type, contact_value, is_verified, is_primary, created_at
                 FROM recovery_contacts 
                 WHERE user_id = ?
                 ORDER BY is_primary DESC, created_at ASC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({ success: true, data: contacts });
    } catch (error) {
        console.error('Error fetching recovery contacts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch recovery contacts' });
    }
});

/**
 * POST /api/user/security/recovery
 * Add recovery contact
 */
router.post('/recovery', async (req, res) => {
    try {
        const userId = req.user.id;
        const { contactType, contactValue, isPrimary } = req.body;

        if (!contactType || !contactValue) {
            return res.status(400).json({ success: false, error: 'Contact type and value are required' });
        }

        if (!['email', 'phone', 'trusted_person'].includes(contactType)) {
            return res.status(400).json({ success: false, error: 'Invalid contact type' });
        }

        const id = uuidv4();
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // If setting as primary, unset other primaries
        if (isPrimary) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE recovery_contacts SET is_primary = 0 WHERE user_id = ?`,
                    [userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO recovery_contacts 
                 (id, user_id, contact_type, contact_value, is_primary, verification_token, verification_sent_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [id, userId, contactType, contactValue, isPrimary ? 1 : 0, verificationToken],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // In production, send verification email/SMS here

        res.json({
            success: true,
            message: 'Recovery contact added. Verification sent.',
            data: { id, verificationToken } // Don't return token in production
        });
    } catch (error) {
        console.error('Error adding recovery contact:', error);
        res.status(500).json({ success: false, error: 'Failed to add recovery contact' });
    }
});

/**
 * PUT /api/user/security/recovery/:id/verify
 * Verify recovery contact
 */
router.put('/recovery/:id/verify', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { token } = req.body;

        const contact = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM recovery_contacts WHERE id = ? AND user_id = ?`,
                [id, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!contact) {
            return res.status(404).json({ success: false, error: 'Recovery contact not found' });
        }

        if (contact.verification_token !== token) {
            return res.status(400).json({ success: false, error: 'Invalid verification token' });
        }

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE recovery_contacts 
                 SET is_verified = 1, verified_at = datetime('now'), verification_token = NULL
                 WHERE id = ?`,
                [id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Recovery contact verified' });
    } catch (error) {
        console.error('Error verifying recovery contact:', error);
        res.status(500).json({ success: false, error: 'Failed to verify recovery contact' });
    }
});

/**
 * DELETE /api/user/security/recovery/:id
 * Delete recovery contact
 */
router.delete('/recovery/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM recovery_contacts WHERE id = ? AND user_id = ?`,
                [id, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Recovery contact deleted' });
    } catch (error) {
        console.error('Error deleting recovery contact:', error);
        res.status(500).json({ success: false, error: 'Failed to delete recovery contact' });
    }
});

// ==========================================
// GEOLOCATION & SUSPICIOUS ACTIVITY
// ==========================================

/**
 * GET /api/user/security/login-locations
 * Get recent login locations
 */
router.get('/login-locations', async (req, res) => {
    try {
        const userId = req.user.id;

        const locations = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, ip_address, country, region, city, is_vpn, is_proxy, is_tor, 
                        risk_score, is_trusted, created_at
                 FROM login_geolocations 
                 WHERE user_id = ?
                 ORDER BY created_at DESC
                 LIMIT 50`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({ success: true, data: locations });
    } catch (error) {
        console.error('Error fetching login locations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch login locations' });
    }
});

/**
 * PUT /api/user/security/login-locations/:id/trust
 * Mark location as trusted
 */
router.put('/login-locations/:id/trust', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { trusted } = req.body;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE login_geolocations SET is_trusted = ? WHERE id = ? AND user_id = ?`,
                [trusted ? 1 : 0, id, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: trusted ? 'Location marked as trusted' : 'Location unmarked as trusted' });
    } catch (error) {
        console.error('Error updating location trust:', error);
        res.status(500).json({ success: false, error: 'Failed to update location trust' });
    }
});

/**
 * GET /api/user/security/suspicious-activities
 * Get suspicious activities
 */
router.get('/suspicious-activities', async (req, res) => {
    try {
        const userId = req.user.id;

        const activities = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, activity_type, severity, description, metadata, ip_address, 
                        is_acknowledged, acknowledged_at, created_at
                 FROM suspicious_activities 
                 WHERE user_id = ?
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Parse metadata JSON
        const parsed = activities.map(a => ({
            ...a,
            metadata: a.metadata ? JSON.parse(a.metadata) : null
        }));

        res.json({ success: true, data: parsed });
    } catch (error) {
        console.error('Error fetching suspicious activities:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch suspicious activities' });
    }
});

/**
 * PUT /api/user/security/suspicious-activities/:id/acknowledge
 * Acknowledge suspicious activity
 */
router.put('/suspicious-activities/:id/acknowledge', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE suspicious_activities 
                 SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = datetime('now')
                 WHERE id = ? AND user_id = ?`,
                [userId, id, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Activity acknowledged' });
    } catch (error) {
        console.error('Error acknowledging activity:', error);
        res.status(500).json({ success: false, error: 'Failed to acknowledge activity' });
    }
});

// ==========================================
// SECURITY SETTINGS
// ==========================================

/**
 * GET /api/user/security/settings
 * Get security settings
 */
router.get('/settings', async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM user_security_settings WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.json({
            success: true,
            data: settings || {
                enable_geolocation_alerts: 1,
                trusted_countries: '[]',
                require_reauth_minutes: 60,
                single_session_only: 0,
                notify_new_login: 1,
                notify_password_change: 1,
                notify_suspicious_activity: 1,
                notify_recovery_change: 1
            }
        });
    } catch (error) {
        console.error('Error fetching security settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch security settings' });
    }
});

/**
 * PUT /api/user/security/settings
 * Update security settings
 */
router.put('/settings', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            enableGeolocationAlerts,
            trustedCountries,
            requireReauthMinutes,
            singleSessionOnly,
            notifyNewLogin,
            notifyPasswordChange,
            notifySuspiciousActivity,
            notifyRecoveryChange
        } = req.body;

        // Upsert settings
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_security_settings 
                 (user_id, enable_geolocation_alerts, trusted_countries, require_reauth_minutes,
                  single_session_only, notify_new_login, notify_password_change, 
                  notify_suspicious_activity, notify_recovery_change)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET
                    enable_geolocation_alerts = excluded.enable_geolocation_alerts,
                    trusted_countries = excluded.trusted_countries,
                    require_reauth_minutes = excluded.require_reauth_minutes,
                    single_session_only = excluded.single_session_only,
                    notify_new_login = excluded.notify_new_login,
                    notify_password_change = excluded.notify_password_change,
                    notify_suspicious_activity = excluded.notify_suspicious_activity,
                    notify_recovery_change = excluded.notify_recovery_change,
                    updated_at = datetime('now')`,
                [
                    userId,
                    enableGeolocationAlerts ? 1 : 0,
                    JSON.stringify(trustedCountries || []),
                    requireReauthMinutes || 60,
                    singleSessionOnly ? 1 : 0,
                    notifyNewLogin ? 1 : 0,
                    notifyPasswordChange ? 1 : 0,
                    notifySuspiciousActivity ? 1 : 0,
                    notifyRecoveryChange ? 1 : 0
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Security settings updated' });
    } catch (error) {
        console.error('Error updating security settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update security settings' });
    }
});

export default router;








