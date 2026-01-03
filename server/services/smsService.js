/**
 * SMS Service
 * 
 * Enterprise-grade SMS delivery service using Twilio.
 * 
 * Features:
 * - SMS delivery via Twilio
 * - Rate limiting (5 SMS per phone per hour)
 * - Delivery status tracking
 * - Fallback to mock mode for development
 * - OTP code generation and verification
 * 
 * Environment Variables Required:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (sender number in E.164 format)
 * - SMS_MOCK_MODE (optional, for development)
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import twilio from 'twilio';

// Configuration
const CONFIG = {
    OTP_LENGTH: 6,
    OTP_EXPIRY_MINUTES: 10,
    MAX_OTP_ATTEMPTS: 3,
    RATE_LIMIT_PER_HOUR: 5,
    RATE_LIMIT_PER_DAY: 20,
    MOCK_MODE: process.env.SMS_MOCK_MODE === 'true' || !process.env.TWILIO_ACCOUNT_SID
};

// Twilio client (lazy initialization)
let twilioClient = null;

function getTwilioClient() {
    if (!twilioClient && !CONFIG.MOCK_MODE) {
        try {
            // Twilio is imported at top level now, but we can still lazy init client
            twilioClient = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );
        } catch (error) {
            console.warn('[SMS] Twilio not configured, using mock mode:', error.message);
            CONFIG.MOCK_MODE = true;
        }
    }
    return twilioClient;
}

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

const SMSService = {
    /**
     * Send an SMS message
     * @param {string} phoneNumber - E.164 format (+1234567890)
     * @param {string} message - Message content
     * @param {string} userId - Optional user ID for logging
     * @param {string} messageType - Type of message (verification, mfa, alert)
     * @returns {Promise<{success: boolean, messageSid?: string, error?: string}>}
     */
    async sendSMS(phoneNumber, message, userId = null, messageType = 'verification') {
        const logId = uuidv4();

        try {
            // Validate phone number
            if (!this._isValidPhoneNumber(phoneNumber)) {
                return { success: false, error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)' };
            }

            // Check rate limit
            const rateLimited = await this._checkRateLimit(phoneNumber);
            if (rateLimited) {
                return { success: false, error: 'Too many SMS requests. Please try again later.' };
            }

            // Log attempt
            await this._logDelivery(logId, userId, phoneNumber, messageType, 'pending');

            if (CONFIG.MOCK_MODE) {
                // Mock mode for development
                console.log(`[SMS MOCK] To: ${phoneNumber}, Message: ${message}`);
                await this._logDelivery(logId, userId, phoneNumber, messageType, 'sent', 'MOCK_SID');
                return { success: true, messageSid: 'MOCK_SID', mock: true };
            }

            // Send via Twilio
            const client = getTwilioClient();
            const result = await client.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber
            });

            // Update log with success
            await this._logDelivery(logId, userId, phoneNumber, messageType, 'sent', result.sid);

            // Increment rate limit counter
            await this._incrementRateLimit(phoneNumber, userId);

            return { success: true, messageSid: result.sid };

        } catch (error) {
            console.error('[SMS] Send failed:', error);

            // Update log with error
            await dbRun(
                `UPDATE sms_delivery_log SET 
                    status = 'failed', 
                    error_code = ?, 
                    error_message = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
                [error.code || 'UNKNOWN', error.message, logId]
            );

            return { success: false, error: error.message || 'Failed to send SMS' };
        }
    },

    /**
     * Generate and send OTP code
     * @param {string} userId 
     * @param {string} phoneNumber 
     * @param {string} purpose - 'phone_verify', 'mfa_login', 'mfa_setup', 'password_reset'
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async sendOTP(userId, phoneNumber, purpose = 'mfa_login') {
        try {
            // Invalidate existing codes for this user/purpose
            await dbRun(
                `UPDATE sms_verification_codes 
                 SET used_at = datetime('now') 
                 WHERE user_id = ? AND purpose = ? AND used_at IS NULL`,
                [userId, purpose]
            );

            // Generate 6-digit OTP
            const code = this._generateOTP();
            const hashedCode = bcrypt.hashSync(code, 8);
            const expiresAt = new Date(Date.now() + CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

            // Store OTP
            await dbRun(
                `INSERT INTO sms_verification_codes (id, user_id, phone_number, code, purpose, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [uuidv4(), userId, phoneNumber, hashedCode, purpose, expiresAt]
            );

            // Send SMS
            const messages = {
                phone_verify: `Your Consultify verification code is: ${code}. Valid for ${CONFIG.OTP_EXPIRY_MINUTES} minutes.`,
                mfa_login: `Your Consultify login code is: ${code}. Do not share this code with anyone.`,
                mfa_setup: `Your Consultify MFA setup code is: ${code}. Valid for ${CONFIG.OTP_EXPIRY_MINUTES} minutes.`,
                password_reset: `Your Consultify password reset code is: ${code}. If you didn't request this, ignore this message.`
            };

            const message = messages[purpose] || messages.mfa_login;
            const result = await this.sendSMS(phoneNumber, message, userId, purpose === 'mfa_login' ? 'mfa' : 'verification');

            if (!result.success) {
                return result;
            }

            // In mock mode, log the code for testing
            if (CONFIG.MOCK_MODE) {
                console.log(`[SMS MOCK] OTP Code: ${code}`);
            }

            return { success: true, expiresAt };

        } catch (error) {
            console.error('[SMS] Send OTP failed:', error);
            return { success: false, error: 'Failed to send verification code' };
        }
    },

    /**
     * Verify OTP code
     * @param {string} userId 
     * @param {string} code 
     * @param {string} purpose 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async verifyOTP(userId, code, purpose = 'mfa_login') {
        try {
            // Get latest valid code
            const record = await dbGet(
                `SELECT * FROM sms_verification_codes 
                 WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > datetime('now')
                 ORDER BY created_at DESC LIMIT 1`,
                [userId, purpose]
            );

            if (!record) {
                return { success: false, error: 'No valid verification code found. Please request a new one.' };
            }

            // Check max attempts
            if (record.attempts >= CONFIG.MAX_OTP_ATTEMPTS) {
                await dbRun(
                    `UPDATE sms_verification_codes SET used_at = datetime('now') WHERE id = ?`,
                    [record.id]
                );
                return { success: false, error: 'Too many attempts. Please request a new code.' };
            }

            // Increment attempt counter
            await dbRun(
                `UPDATE sms_verification_codes SET attempts = attempts + 1 WHERE id = ?`,
                [record.id]
            );

            // Verify code
            const isValid = bcrypt.compareSync(code, record.code);

            if (!isValid) {
                const remainingAttempts = CONFIG.MAX_OTP_ATTEMPTS - record.attempts - 1;
                return {
                    success: false,
                    error: `Invalid code. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : 'Please request a new code.'}`
                };
            }

            // Mark code as used
            await dbRun(
                `UPDATE sms_verification_codes SET used_at = datetime('now') WHERE id = ?`,
                [record.id]
            );

            return { success: true };

        } catch (error) {
            console.error('[SMS] Verify OTP failed:', error);
            return { success: false, error: 'Verification failed' };
        }
    },

    /**
     * Verify phone number ownership
     * @param {string} userId 
     * @param {string} phoneNumber 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initiatePhoneVerification(userId, phoneNumber) {
        // Update user's phone number (unverified)
        await dbRun(
            `UPDATE users SET phone_number = ?, phone_verified = 0 WHERE id = ?`,
            [phoneNumber, userId]
        );

        // Send verification OTP
        return this.sendOTP(userId, phoneNumber, 'phone_verify');
    },

    /**
     * Complete phone verification
     * @param {string} userId 
     * @param {string} code 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async completePhoneVerification(userId, code) {
        const result = await this.verifyOTP(userId, code, 'phone_verify');

        if (!result.success) {
            return result;
        }

        // Mark phone as verified
        await dbRun(
            `UPDATE users SET 
                phone_verified = 1, 
                phone_verified_at = datetime('now')
             WHERE id = ?`,
            [userId]
        );

        return { success: true };
    },

    /**
     * Get phone verification status
     * @param {string} userId 
     * @returns {Promise<{hasPhone: boolean, verified: boolean, phoneNumber?: string}>}
     */
    async getPhoneStatus(userId) {
        const user = await dbGet(
            `SELECT phone_number, phone_verified FROM users WHERE id = ?`,
            [userId]
        );

        if (!user || !user.phone_number) {
            return { hasPhone: false, verified: false };
        }

        return {
            hasPhone: true,
            verified: !!user.phone_verified,
            phoneNumber: this._maskPhoneNumber(user.phone_number)
        };
    },

    // ==========================================
    // TWILIO WEBHOOK HANDLERS
    // ==========================================

    /**
     * Handle Twilio delivery status webhook
     * @param {Object} data - Twilio webhook payload
     */
    async handleStatusCallback(data) {
        const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = data;

        try {
            await dbRun(
                `UPDATE sms_delivery_log SET 
                    status = ?,
                    error_code = ?,
                    error_message = ?,
                    updated_at = datetime('now')
                 WHERE message_sid = ?`,
                [MessageStatus, ErrorCode || null, ErrorMessage || null, MessageSid]
            );
        } catch (error) {
            console.error('[SMS] Status callback update failed:', error);
        }
    },

    // ==========================================
    // PRIVATE HELPERS
    // ==========================================

    _generateOTP() {
        // Generate cryptographically secure 6-digit code
        return crypto.randomInt(100000, 999999).toString();
    },

    _isValidPhoneNumber(phone) {
        // E.164 format: + followed by country code and number (7-15 digits total)
        const e164Regex = /^\+[1-9]\d{6,14}$/;
        return e164Regex.test(phone);
    },

    _maskPhoneNumber(phone) {
        // Show only last 4 digits: +1***1234
        if (!phone || phone.length < 8) return phone;
        return phone.slice(0, 3) + '***' + phone.slice(-4);
    },

    async _checkRateLimit(phoneNumber) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Check hourly limit
        const hourlyCount = await dbGet(
            `SELECT COUNT(*) as count FROM sms_delivery_log 
             WHERE phone_number = ? AND created_at > ? AND status != 'failed'`,
            [phoneNumber, hourAgo]
        );

        if (hourlyCount && hourlyCount.count >= CONFIG.RATE_LIMIT_PER_HOUR) {
            return true;
        }

        // Check daily limit
        const dailyCount = await dbGet(
            `SELECT COUNT(*) as count FROM sms_delivery_log 
             WHERE phone_number = ? AND created_at > ? AND status != 'failed'`,
            [phoneNumber, dayAgo]
        );

        if (dailyCount && dailyCount.count >= CONFIG.RATE_LIMIT_PER_DAY) {
            return true;
        }

        return false;
    },

    async _incrementRateLimit(phoneNumber, userId) {
        const windowStart = new Date().toISOString().slice(0, 13) + ':00:00'; // Hourly window

        try {
            await dbRun(
                `INSERT INTO sms_rate_limits (phone_number, user_id, window_start, count)
                 VALUES (?, ?, ?, 1)
                 ON CONFLICT(phone_number, window_start) DO UPDATE SET count = count + 1`,
                [phoneNumber, userId, windowStart]
            );
        } catch (error) {
            // Ignore duplicate key errors
            if (!error.message.includes('UNIQUE constraint')) {
                throw error;
            }
        }
    },

    async _logDelivery(id, userId, phoneNumber, messageType, status, messageSid = null) {
        await dbRun(
            `INSERT INTO sms_delivery_log (id, user_id, phone_number, message_type, message_sid, status)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                message_sid = COALESCE(excluded.message_sid, sms_delivery_log.message_sid),
                updated_at = datetime('now')`,
            [id, userId, phoneNumber, messageType, messageSid, status]
        );
    }
};

export default SMSService;





