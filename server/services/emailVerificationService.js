/**
 * Email Verification Service
 * 
 * Handles email verification for new users and email change requests.
 * 
 * Features:
 * - Verification token generation
 * - Token expiration (24 hours)
 * - Resend with rate limiting
 * - Email change verification (security flow)
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const EmailService = require('./emailService');

// Configuration
const CONFIG = {
    TOKEN_EXPIRY_HOURS: 24,
    RESEND_COOLDOWN_MINUTES: 5,
    BASE_URL: process.env.FRONTEND_URL || 'http://localhost:3000'
};

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

const EmailVerificationService = {
    /**
     * Generate verification token and send email
     * @param {string} userId 
     * @param {string} email 
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async sendVerificationEmail(userId, email) {
        // Check cooldown
        const user = await dbGet(
            `SELECT email_verification_sent_at FROM users WHERE id = ?`,
            [userId]
        );

        if (user && user.email_verification_sent_at) {
            const sentAt = new Date(user.email_verification_sent_at);
            const cooldownEnd = new Date(sentAt.getTime() + CONFIG.RESEND_COOLDOWN_MINUTES * 60 * 1000);

            if (new Date() < cooldownEnd) {
                const remainingSeconds = Math.ceil((cooldownEnd - new Date()) / 1000);
                return {
                    success: false,
                    error: `Please wait ${remainingSeconds} seconds before requesting another email`,
                    cooldown: remainingSeconds
                };
            }
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + CONFIG.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

        // Store token
        await dbRun(
            `UPDATE users SET 
                email_verification_token = ?,
                email_verification_sent_at = datetime('now'),
                email_verification_expires_at = ?
            WHERE id = ?`,
            [token, expiresAt, userId]
        );

        // Build verification URL
        const verificationUrl = `${CONFIG.BASE_URL}/verify-email?token=${token}`;

        // Send email
        try {
            await EmailService.send({
                to: email,
                subject: 'Verify your email address - Consultify',
                template: 'email_verification',
                data: {
                    verificationUrl,
                    expiresIn: `${CONFIG.TOKEN_EXPIRY_HOURS} hours`
                }
            });

            return { success: true, message: 'Verification email sent' };
        } catch (error) {
            console.error('[EmailVerification] Failed to send email:', error);
            return { success: false, error: 'Failed to send verification email' };
        }
    },

    /**
     * Verify email with token
     * @param {string} token 
     * @returns {Promise<{success: boolean, userId?: string}>}
     */
    async verifyEmail(token) {
        if (!token) {
            return { success: false, error: 'Token is required' };
        }

        const user = await dbGet(
            `SELECT id, email, email_verification_expires_at 
             FROM users 
             WHERE email_verification_token = ?`,
            [token]
        );

        if (!user) {
            return { success: false, error: 'Invalid or expired verification token' };
        }

        // Check expiration
        if (user.email_verification_expires_at && new Date(user.email_verification_expires_at) < new Date()) {
            return { success: false, error: 'Verification token has expired. Please request a new one.' };
        }

        // Mark as verified
        await dbRun(
            `UPDATE users SET 
                email_verified = 1,
                email_verification_token = NULL,
                email_verification_expires_at = NULL
            WHERE id = ?`,
            [user.id]
        );

        return { success: true, userId: user.id, email: user.email };
    },

    /**
     * Check if email is verified
     * @param {string} userId 
     * @returns {Promise<boolean>}
     */
    async isEmailVerified(userId) {
        const user = await dbGet(
            `SELECT email_verified FROM users WHERE id = ?`,
            [userId]
        );

        return user && user.email_verified === 1;
    },

    /**
     * Request email change (sends verification to new email)
     * @param {string} userId 
     * @param {string} newEmail 
     * @param {string} currentPassword - For security verification
     * @returns {Promise<{success: boolean}>}
     */
    async requestEmailChange(userId, newEmail, currentPassword) {
        const bcrypt = require('bcryptjs');

        // Get current user
        const user = await dbGet(
            `SELECT password, email FROM users WHERE id = ?`,
            [userId]
        );

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        // Verify password
        const passwordValid = bcrypt.compareSync(currentPassword, user.password);
        if (!passwordValid) {
            return { success: false, error: 'Invalid password' };
        }

        // Check if new email is already in use
        const existingUser = await dbGet(
            `SELECT id FROM users WHERE email = ? AND id != ?`,
            [newEmail, userId]
        );

        if (existingUser) {
            return { success: false, error: 'Email is already in use' };
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');

        // Store pending email change
        await dbRun(
            `UPDATE users SET 
                pending_email = ?,
                email_change_token = ?,
                email_change_requested_at = datetime('now')
            WHERE id = ?`,
            [newEmail, token, userId]
        );

        // Send verification to NEW email
        const verificationUrl = `${CONFIG.BASE_URL}/confirm-email-change?token=${token}`;

        try {
            await EmailService.send({
                to: newEmail,
                subject: 'Confirm your new email address - Consultify',
                template: 'email_change',
                data: {
                    verificationUrl,
                    oldEmail: user.email,
                    newEmail: newEmail
                }
            });

            return { success: true, message: 'Verification email sent to new address' };
        } catch (error) {
            console.error('[EmailVerification] Failed to send email change email:', error);
            return { success: false, error: 'Failed to send verification email' };
        }
    },

    /**
     * Confirm email change
     * @param {string} token 
     * @returns {Promise<{success: boolean, newEmail?: string}>}
     */
    async confirmEmailChange(token) {
        if (!token) {
            return { success: false, error: 'Token is required' };
        }

        const user = await dbGet(
            `SELECT id, email, pending_email, email_change_requested_at 
             FROM users 
             WHERE email_change_token = ?`,
            [token]
        );

        if (!user || !user.pending_email) {
            return { success: false, error: 'Invalid token or no pending email change' };
        }

        // Check expiration (24 hours)
        if (user.email_change_requested_at) {
            const requestedAt = new Date(user.email_change_requested_at);
            const expiresAt = new Date(requestedAt.getTime() + CONFIG.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

            if (new Date() > expiresAt) {
                return { success: false, error: 'Email change request has expired. Please request again.' };
            }
        }

        const newEmail = user.pending_email;
        const oldEmail = user.email;

        // Update email
        await dbRun(
            `UPDATE users SET 
                email = ?,
                pending_email = NULL,
                email_change_token = NULL,
                email_change_requested_at = NULL,
                email_verified = 1
            WHERE id = ?`,
            [newEmail, user.id]
        );

        // Send notification to OLD email (security)
        try {
            await EmailService.send({
                to: oldEmail,
                subject: 'Your email address has been changed - Consultify',
                template: 'email_changed_notification',
                data: {
                    newEmail: newEmail
                }
            });
        } catch (error) {
            console.error('[EmailVerification] Failed to send change notification:', error);
            // Don't fail the operation, notification is secondary
        }

        return { success: true, newEmail, oldEmail };
    },

    /**
     * Cancel pending email change
     * @param {string} userId 
     * @returns {Promise<{success: boolean}>}
     */
    async cancelEmailChange(userId) {
        await dbRun(
            `UPDATE users SET 
                pending_email = NULL,
                email_change_token = NULL,
                email_change_requested_at = NULL
            WHERE id = ?`,
            [userId]
        );

        return { success: true };
    }
};

module.exports = EmailVerificationService;
