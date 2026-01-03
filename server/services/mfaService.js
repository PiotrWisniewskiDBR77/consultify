/**
 * MFA Service
 * 
 * Enterprise-grade Multi-Factor Authentication service.
 * 
 * Features:
 * - TOTP generation and verification (Google Authenticator, Authy compatible)
 * - Backup codes generation (10 single-use codes)
 * - Trusted device management
 * - Brute-force protection (max 5 attempts per 15 minutes)
 * - Organization-level MFA enforcement
 * 
 * Security:
 * - Secrets are encrypted at rest
 * - Backup codes are hashed (bcrypt)
 * - All attempts are logged for audit
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import SMSService from './smsService.js';

// Configuration
const CONFIG = {
    APP_NAME: 'Consultify',
    TOTP_WINDOW: 1, // Allow 1 step before/after current time
    BACKUP_CODE_COUNT: 10,
    BACKUP_CODE_LENGTH: 8,
    MAX_ATTEMPTS: 5,
    ATTEMPT_WINDOW_MINUTES: 15,
    TRUSTED_DEVICE_DAYS: 30,
    ENCRYPTION_ALGORITHM: 'aes-256-gcm'
};

// Encryption helpers
const ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(CONFIG.ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
    try {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(CONFIG.ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('[MFA] Decryption failed:', error.message);
        return null;
    }
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

// SMS Service for SMS MFA fallback
function getSMSService() {
    return SMSService;
}

const MFAService = {
    // ==========================================
    // SMS MFA METHODS
    // ==========================================

    /**
     * Setup SMS as MFA method
     * @param {string} userId 
     * @param {string} phoneNumber - E.164 format
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async setupSMSMFA(userId, phoneNumber) {
        const smsService = getSMSService();
        if (!smsService) {
            return { success: false, error: 'SMS service not available' };
        }

        // Initiate phone verification
        const result = await smsService.initiatePhoneVerification(userId, phoneNumber);
        if (!result.success) {
            return result;
        }

        return {
            success: true,
            message: 'Verification code sent to your phone',
            expiresAt: result.expiresAt
        };
    },

    /**
     * Verify phone and enable SMS MFA
     * @param {string} userId 
     * @param {string} code 
     * @returns {Promise<{success: boolean, backupCodes?: string[], error?: string}>}
     */
    async verifySMSSetup(userId, code) {
        const smsService = getSMSService();
        if (!smsService) {
            return { success: false, error: 'SMS service not available' };
        }

        // Verify phone
        const verifyResult = await smsService.completePhoneVerification(userId, code);
        if (!verifyResult.success) {
            return verifyResult;
        }

        // Generate backup codes
        const { codes, hashedCodes } = await this._generateBackupCodes();

        // Enable SMS MFA
        await dbRun(
            `UPDATE users SET 
                mfa_enabled = 1,
                mfa_sms_enabled = 1,
                mfa_primary_method = 'sms',
                mfa_verified_at = datetime('now'),
                mfa_backup_codes = ?
            WHERE id = ?`,
            [JSON.stringify(hashedCodes), userId]
        );

        return { success: true, backupCodes: codes };
    },

    /**
     * Send SMS code for MFA challenge during login
     * @param {string} userId 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async sendSMSChallenge(userId) {
        const smsService = getSMSService();
        if (!smsService) {
            return { success: false, error: 'SMS service not available' };
        }

        // Get user's verified phone
        const user = await dbGet(
            `SELECT phone_number, phone_verified, mfa_sms_enabled FROM users WHERE id = ?`,
            [userId]
        );

        if (!user || !user.phone_number || !user.phone_verified) {
            return { success: false, error: 'No verified phone number on file' };
        }

        if (!user.mfa_sms_enabled) {
            return { success: false, error: 'SMS MFA not enabled for this account' };
        }

        // Send OTP
        return smsService.sendOTP(userId, user.phone_number, 'mfa_login');
    },

    /**
     * Verify SMS code during login
     * @param {string} userId 
     * @param {string} code 
     * @param {string} ip 
     * @param {string} userAgent 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async verifySMSCode(userId, code, ip = null, userAgent = null) {
        const smsService = getSMSService();
        if (!smsService) {
            return { success: false, error: 'SMS service not available' };
        }

        // Check brute-force protection
        const isBlocked = await this._isBlocked(userId, ip);
        if (isBlocked) {
            return {
                success: false,
                error: 'Too many failed attempts. Please try again later.',
                blocked: true
            };
        }

        // Verify OTP
        const result = await smsService.verifyOTP(userId, code, 'mfa_login');

        await this._logAttempt(userId, 'SMS', result.success, ip, userAgent);

        return result;
    },

    /**
     * Get user's MFA methods and status
     * @param {string} userId 
     * @returns {Promise<Object>}
     */
    async getMFAMethods(userId) {
        const user = await dbGet(
            `SELECT 
                mfa_enabled, 
                mfa_secret,
                mfa_sms_enabled,
                mfa_primary_method,
                phone_number,
                phone_verified
            FROM users WHERE id = ?`,
            [userId]
        );

        if (!user) {
            return {
                enabled: false,
                methods: [],
                primary: null
            };
        }

        const methods = [];

        // TOTP (Authenticator app)
        if (user.mfa_secret) {
            methods.push({
                type: 'totp',
                name: 'Authenticator App',
                enabled: !!user.mfa_enabled && !user.mfa_sms_enabled,
                configured: true
            });
        }

        // SMS
        if (user.phone_number && user.phone_verified) {
            methods.push({
                type: 'sms',
                name: 'SMS',
                enabled: !!user.mfa_sms_enabled,
                configured: true,
                phoneNumber: this._maskPhoneNumber(user.phone_number)
            });
        }

        return {
            enabled: !!user.mfa_enabled,
            methods,
            primary: user.mfa_primary_method || 'totp',
            smsAvailable: !!getSMSService()
        };
    },

    /**
     * Set primary MFA method
     * @param {string} userId 
     * @param {string} method - 'totp' or 'sms'
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async setPrimaryMethod(userId, method) {
        if (!['totp', 'sms'].includes(method)) {
            return { success: false, error: 'Invalid MFA method' };
        }

        // Verify method is available
        const user = await dbGet(
            `SELECT mfa_secret, mfa_sms_enabled, phone_verified FROM users WHERE id = ?`,
            [userId]
        );

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        if (method === 'totp' && !user.mfa_secret) {
            return { success: false, error: 'TOTP not configured. Please set up authenticator app first.' };
        }

        if (method === 'sms' && (!user.mfa_sms_enabled || !user.phone_verified)) {
            return { success: false, error: 'SMS MFA not configured. Please verify your phone number first.' };
        }

        await dbRun(
            `UPDATE users SET mfa_primary_method = ? WHERE id = ?`,
            [method, userId]
        );

        return { success: true };
    },

    /**
     * Disable SMS MFA (keep TOTP if enabled)
     * @param {string} userId 
     * @param {string} token - TOTP or SMS code for verification
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async disableSMSMFA(userId, token) {
        // Verify with current method
        const user = await dbGet(
            `SELECT mfa_primary_method, mfa_secret FROM users WHERE id = ?`,
            [userId]
        );

        let verificationResult;
        if (user.mfa_primary_method === 'sms') {
            verificationResult = await this.verifySMSCode(userId, token);
        } else {
            verificationResult = await this.verifyTOTP(userId, token);
        }

        if (!verificationResult.success) {
            return verificationResult;
        }

        // If TOTP is still available, keep MFA enabled but switch to TOTP
        const hasTOTP = !!user.mfa_secret;

        await dbRun(
            `UPDATE users SET 
                mfa_sms_enabled = 0,
                mfa_primary_method = ?,
                mfa_enabled = ?
            WHERE id = ?`,
            [hasTOTP ? 'totp' : null, hasTOTP ? 1 : 0, userId]
        );

        return {
            success: true,
            mfaStillEnabled: hasTOTP,
            message: hasTOTP
                ? 'SMS MFA disabled. Authenticator app MFA is still active.'
                : 'SMS MFA disabled. Your account no longer has 2FA protection.'
        };
    },

    _maskPhoneNumber(phone) {
        if (!phone || phone.length < 8) return phone;
        return phone.slice(0, 3) + '***' + phone.slice(-4);
    },

    // ==========================================
    // TOTP METHODS (Original)
    // ==========================================

    /**
     * Generate a new TOTP secret and QR code for MFA setup
     * @param {string} userId 
     * @param {string} userEmail 
     * @returns {Promise<{secret: string, qrCode: string, manualEntry: string}>}
     */
    async setupMFA(userId, userEmail) {
        // Generate new secret
        const secret = speakeasy.generateSecret({
            name: `${CONFIG.APP_NAME}:${userEmail}`,
            issuer: CONFIG.APP_NAME,
            length: 32
        });

        // Encrypt and store secret (not yet verified)
        const encryptedSecret = encrypt(secret.base32);

        await dbRun(
            `UPDATE users SET mfa_secret = ?, mfa_enabled = 0, mfa_verified_at = NULL WHERE id = ?`,
            [encryptedSecret, userId]
        );

        // Generate QR code
        const qrCode = await QRCode.toDataURL(secret.otpauth_url);

        return {
            secret: secret.base32, // For manual entry
            qrCode: qrCode, // Data URL for display
            manualEntry: secret.base32
        };
    },

    /**
     * Verify TOTP token and complete MFA setup
     * @param {string} userId 
     * @param {string} token 
     * @returns {Promise<{success: boolean, backupCodes?: string[]}>}
     */
    async verifyAndEnableMFA(userId, token) {
        const user = await dbGet(`SELECT mfa_secret FROM users WHERE id = ?`, [userId]);

        if (!user || !user.mfa_secret) {
            return { success: false, error: 'MFA not initialized' };
        }

        const secret = decrypt(user.mfa_secret);
        if (!secret) {
            return { success: false, error: 'Failed to decrypt MFA secret' };
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: CONFIG.TOTP_WINDOW
        });

        if (!verified) {
            await this._logAttempt(userId, 'TOTP', false);
            return { success: false, error: 'Invalid verification code' };
        }

        // Generate backup codes
        const { codes, hashedCodes } = await this._generateBackupCodes();

        // Enable MFA
        await dbRun(
            `UPDATE users SET 
                mfa_enabled = 1, 
                mfa_verified_at = datetime('now'),
                mfa_backup_codes = ?
            WHERE id = ?`,
            [JSON.stringify(hashedCodes), userId]
        );

        await this._logAttempt(userId, 'TOTP', true);

        return {
            success: true,
            backupCodes: codes // Return plain codes for user to save
        };
    },

    /**
     * Verify TOTP during login
     * @param {string} userId 
     * @param {string} token 
     * @param {string} ip 
     * @param {string} userAgent 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async verifyTOTP(userId, token, ip = null, userAgent = null) {
        // Check brute-force protection
        const isBlocked = await this._isBlocked(userId, ip);
        if (isBlocked) {
            return {
                success: false,
                error: 'Too many failed attempts. Please try again later.',
                blocked: true
            };
        }

        const user = await dbGet(`SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?`, [userId]);

        if (!user || !user.mfa_enabled || !user.mfa_secret) {
            return { success: false, error: 'MFA not enabled for this user' };
        }

        const secret = decrypt(user.mfa_secret);
        if (!secret) {
            return { success: false, error: 'MFA configuration error' };
        }

        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: CONFIG.TOTP_WINDOW
        });

        await this._logAttempt(userId, 'TOTP', verified, ip, userAgent);

        if (!verified) {
            return { success: false, error: 'Invalid verification code' };
        }

        return { success: true };
    },

    /**
     * Use a backup code (single-use)
     * @param {string} userId 
     * @param {string} code 
     * @param {string} ip 
     * @param {string} userAgent 
     * @returns {Promise<{success: boolean, remainingCodes?: number}>}
     */
    async useBackupCode(userId, code, ip = null, userAgent = null) {
        // Check brute-force protection
        const isBlocked = await this._isBlocked(userId, ip);
        if (isBlocked) {
            return {
                success: false,
                error: 'Too many failed attempts. Please try again later.',
                blocked: true
            };
        }

        const user = await dbGet(`SELECT mfa_backup_codes FROM users WHERE id = ?`, [userId]);

        if (!user || !user.mfa_backup_codes) {
            return { success: false, error: 'No backup codes available' };
        }

        const hashedCodes = JSON.parse(user.mfa_backup_codes);

        // Find matching code
        let matchedIndex = -1;
        for (let i = 0; i < hashedCodes.length; i++) {
            if (hashedCodes[i] && bcrypt.compareSync(code.toUpperCase(), hashedCodes[i])) {
                matchedIndex = i;
                break;
            }
        }

        if (matchedIndex === -1) {
            await this._logAttempt(userId, 'BACKUP_CODE', false, ip, userAgent);
            return { success: false, error: 'Invalid backup code' };
        }

        // Invalidate used code
        hashedCodes[matchedIndex] = null;
        const remainingCodes = hashedCodes.filter(c => c !== null).length;

        await dbRun(
            `UPDATE users SET mfa_backup_codes = ? WHERE id = ?`,
            [JSON.stringify(hashedCodes), userId]
        );

        await this._logAttempt(userId, 'BACKUP_CODE', true, ip, userAgent);

        return {
            success: true,
            remainingCodes,
            warning: remainingCodes < 3 ? 'You have few backup codes remaining. Consider regenerating.' : null
        };
    },

    /**
     * Regenerate backup codes (requires TOTP verification)
     * @param {string} userId 
     * @param {string} totpToken 
     * @returns {Promise<{success: boolean, backupCodes?: string[]}>}
     */
    async regenerateBackupCodes(userId, totpToken) {
        // Verify TOTP first
        const verification = await this.verifyTOTP(userId, totpToken);
        if (!verification.success) {
            return verification;
        }

        const { codes, hashedCodes } = await this._generateBackupCodes();

        await dbRun(
            `UPDATE users SET mfa_backup_codes = ? WHERE id = ?`,
            [JSON.stringify(hashedCodes), userId]
        );

        return { success: true, backupCodes: codes };
    },

    /**
     * Disable MFA (requires TOTP verification)
     * @param {string} userId 
     * @param {string} token 
     * @returns {Promise<{success: boolean}>}
     */
    async disableMFA(userId, token) {
        const verification = await this.verifyTOTP(userId, token);
        if (!verification.success) {
            return verification;
        }

        await dbRun(
            `UPDATE users SET 
                mfa_enabled = 0, 
                mfa_secret = NULL, 
                mfa_backup_codes = NULL,
                mfa_verified_at = NULL
            WHERE id = ?`,
            [userId]
        );

        return { success: true };
    },

    /**
     * Check if MFA is required for user
     * @param {string} userId 
     * @returns {Promise<{required: boolean, enabled: boolean, gracePeriodRemaining?: number}>}
     */
    async getMFAStatus(userId) {
        const user = await dbGet(
            `SELECT u.mfa_enabled, u.created_at, o.mfa_required, o.mfa_grace_period_days
             FROM users u
             LEFT JOIN organizations o ON u.organization_id = o.id
             WHERE u.id = ?`,
            [userId]
        );

        if (!user) {
            return { required: false, enabled: false };
        }

        const enabled = !!user.mfa_enabled;
        const orgRequires = !!user.mfa_required;

        if (!orgRequires) {
            return { required: false, enabled };
        }

        // Check grace period
        if (!enabled && user.mfa_grace_period_days) {
            const createdAt = new Date(user.created_at);
            const gracePeriodEnd = new Date(createdAt.getTime() + user.mfa_grace_period_days * 24 * 60 * 60 * 1000);
            const now = new Date();

            if (now < gracePeriodEnd) {
                const remaining = Math.ceil((gracePeriodEnd - now) / (24 * 60 * 60 * 1000));
                return { required: true, enabled, gracePeriodRemaining: remaining, enforced: false };
            }
        }

        return { required: orgRequires, enabled, enforced: orgRequires && !enabled };
    },

    // ==========================================
    // TRUSTED DEVICES
    // ==========================================

    /**
     * Register a trusted device
     * @param {string} userId 
     * @param {string} deviceFingerprint 
     * @param {string} deviceName 
     * @returns {Promise<{success: boolean, deviceId: string}>}
     */
    async trustDevice(userId, deviceFingerprint, deviceName = 'Unknown Device') {
        const id = uuidv4();
        const hashedFingerprint = crypto.createHash('sha256').update(deviceFingerprint).digest('hex');
        const expiresAt = new Date(Date.now() + CONFIG.TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000).toISOString();

        await dbRun(
            `INSERT OR REPLACE INTO trusted_devices (id, user_id, device_fingerprint, device_name, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [id, userId, hashedFingerprint, deviceName, expiresAt]
        );

        return { success: true, deviceId: id };
    },

    /**
     * Check if device is trusted
     * @param {string} userId 
     * @param {string} deviceFingerprint 
     * @returns {Promise<boolean>}
     */
    async isDeviceTrusted(userId, deviceFingerprint) {
        const hashedFingerprint = crypto.createHash('sha256').update(deviceFingerprint).digest('hex');

        const device = await dbGet(
            `SELECT id FROM trusted_devices 
             WHERE user_id = ? AND device_fingerprint = ? AND expires_at > datetime('now')`,
            [userId, hashedFingerprint]
        );

        if (device) {
            // Update last used
            await dbRun(
                `UPDATE trusted_devices SET last_used_at = datetime('now') WHERE id = ?`,
                [device.id]
            );
            return true;
        }

        return false;
    },

    /**
     * Get user's trusted devices
     * @param {string} userId 
     * @returns {Promise<Array>}
     */
    async getTrustedDevices(userId) {
        return dbAll(
            `SELECT id, device_name, last_used_at, expires_at, created_at
             FROM trusted_devices
             WHERE user_id = ? AND expires_at > datetime('now')
             ORDER BY last_used_at DESC`,
            [userId]
        );
    },

    /**
     * Revoke a trusted device
     * @param {string} userId 
     * @param {string} deviceId 
     * @returns {Promise<{success: boolean}>}
     */
    async revokeTrustedDevice(userId, deviceId) {
        const result = await dbRun(
            `DELETE FROM trusted_devices WHERE id = ? AND user_id = ?`,
            [deviceId, userId]
        );

        return { success: result.changes > 0 };
    },

    /**
     * Revoke all trusted devices (security action)
     * @param {string} userId 
     * @returns {Promise<{success: boolean, count: number}>}
     */
    async revokeAllTrustedDevices(userId) {
        const result = await dbRun(
            `DELETE FROM trusted_devices WHERE user_id = ?`,
            [userId]
        );

        return { success: true, count: result.changes };
    },

    // ==========================================
    // PRIVATE HELPERS
    // ==========================================

    async _generateBackupCodes() {
        const codes = [];
        const hashedCodes = [];

        for (let i = 0; i < CONFIG.BACKUP_CODE_COUNT; i++) {
            // Generate random code (e.g., "ABCD-1234")
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;

            codes.push(formattedCode);
            hashedCodes.push(bcrypt.hashSync(formattedCode, 8));
        }

        return { codes, hashedCodes };
    },

    async _logAttempt(userId, attemptType, success, ip = null, userAgent = null) {
        await dbRun(
            `INSERT INTO mfa_attempts (id, user_id, attempt_type, success, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), userId, attemptType, success ? 1 : 0, ip, userAgent]
        );
    },

    async _isBlocked(userId, ip) {
        const windowStart = new Date(Date.now() - CONFIG.ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();

        // Check by user
        const userAttempts = await dbGet(
            `SELECT COUNT(*) as count FROM mfa_attempts 
             WHERE user_id = ? AND success = 0 AND created_at > ?`,
            [userId, windowStart]
        );

        if (userAttempts && userAttempts.count >= CONFIG.MAX_ATTEMPTS) {
            return true;
        }

        // Check by IP (if provided)
        if (ip) {
            const ipAttempts = await dbGet(
                `SELECT COUNT(*) as count FROM mfa_attempts 
                 WHERE ip_address = ? AND success = 0 AND created_at > ?`,
                [ip, windowStart]
            );

            if (ipAttempts && ipAttempts.count >= CONFIG.MAX_ATTEMPTS * 2) {
                return true;
            }
        }

        return false;
    }
};

export default MFAService;
