/**
 * Email Verification Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles email verification for new users and email change requests.
 * 
 * Features:
 * - Verification token generation
 * - Token expiration (24 hours)
 * - Resend with rate limiting
 * - Email change verification (security flow)
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { config } from '../config/Config.js';
import logger from '../utils/Logger.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ==========================================
// TYPES
// ==========================================

export interface SendVerificationEmailResult {
    success: boolean;
    message?: string;
    error?: string;
    cooldown?: number;
}

export interface VerifyEmailResult {
    success: boolean;
    userId?: string;
    email?: string;
    error?: string;
}

export interface EmailChangeRequestResult {
    success: boolean;
    message?: string;
    error?: string;
}

export interface EmailChangeConfirmResult {
    success: boolean;
    newEmail?: string;
    oldEmail?: string;
    error?: string;
}

interface UserEmailVerification {
    id: string;
    email: string;
    email_verified: number | boolean;
    email_verification_token: string | null;
    email_verification_expires_at: string | null;
    email_verification_sent_at: string | null;
    pending_email: string | null;
    email_change_token: string | null;
    email_change_requested_at: string | null;
    password?: string;
}

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
    TOKEN_EXPIRY_HOURS: 24,
    RESEND_COOLDOWN_MINUTES: 5
};

// ==========================================
// EMAIL VERIFICATION SERVICE
// ==========================================

class EmailVerificationService {
    private db: IDatabase;
    private emailService: any; // Lazy loaded

    constructor(dbInstance?: IDatabase) {
        this.db = dbInstance || getDatabase();
    }

    /**
     * Get Email Service (lazy loaded)
     */
    private getEmailService(): any {
        if (!this.emailService) {
            try {
                this.emailService = require('../../services/emailService.js');
            } catch (error) {
                logger.warn('[EmailVerification] Email service not available:', error);
                return null;
            }
        }
        return this.emailService;
    }

    /**
     * Database helper: Get single row
     */
    private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
        return new Promise((resolve, reject) => {
            this.db.get<T>(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    /**
     * Database helper: Run query
     */
    private async dbRun(sql: string, params: unknown[] = []): Promise<RunResult> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (this: { lastID?: number; changes: number }, err: Error | null) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes || 0
                    });
                }
            });
        });
    }

    /**
     * Generate verification token and send email
     */
    async sendVerificationEmail(userId: string, email: string): Promise<SendVerificationEmailResult> {
        // Check cooldown
        const user = await this.dbGet<{ email_verification_sent_at: string | null }>(
            `SELECT email_verification_sent_at FROM users WHERE id = ?`,
            [userId]
        );

        if (user && user.email_verification_sent_at) {
            const sentAt = new Date(user.email_verification_sent_at);
            const cooldownEnd = new Date(sentAt.getTime() + CONFIG.RESEND_COOLDOWN_MINUTES * 60 * 1000);

            if (new Date() < cooldownEnd) {
                const remainingSeconds = Math.ceil((cooldownEnd.getTime() - new Date().getTime()) / 1000);
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
        await this.dbRun(
            `UPDATE users SET 
                email_verification_token = ?,
                email_verification_sent_at = datetime('now'),
                email_verification_expires_at = ?
            WHERE id = ?`,
            [token, expiresAt, userId]
        );

        // Build verification URL
        const verificationUrl = `${config.FRONTEND_URL}/verify-email?token=${token}`;

        // Send email
        const emailService = this.getEmailService();
        if (!emailService) {
            logger.error('[EmailVerification] Email service not available');
            return { success: false, error: 'Failed to send verification email' };
        }

        try {
            // EmailService.send expects an object with to, subject, template, data
            await emailService.send({
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
            logger.error('[EmailVerification] Failed to send email:', error);
            return { success: false, error: 'Failed to send verification email' };
        }
    }

    /**
     * Verify email with token
     */
    async verifyEmail(token: string): Promise<VerifyEmailResult> {
        if (!token) {
            return { success: false, error: 'Token is required' };
        }

        const user = await this.dbGet<UserEmailVerification>(
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
        await this.dbRun(
            `UPDATE users SET 
                email_verified = 1,
                email_verification_token = NULL,
                email_verification_expires_at = NULL
            WHERE id = ?`,
            [user.id]
        );

        return { success: true, userId: user.id, email: user.email };
    }

    /**
     * Check if email is verified
     */
    async isEmailVerified(userId: string): Promise<boolean> {
        const user = await this.dbGet<{ email_verified: number | boolean }>(
            `SELECT email_verified FROM users WHERE id = ?`,
            [userId]
        );

        return !!(user && user.email_verified);
    }

    /**
     * Request email change (sends verification to new email)
     */
    async requestEmailChange(userId: string, newEmail: string, currentPassword: string): Promise<EmailChangeRequestResult> {
        const bcrypt = require('bcryptjs');

        // Get current user
        const user = await this.dbGet<UserEmailVerification>(
            `SELECT password, email FROM users WHERE id = ?`,
            [userId]
        );

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        // Verify password
        if (!user.password) {
            return { success: false, error: 'Password verification failed' };
        }

        const passwordValid = bcrypt.compareSync(currentPassword, user.password);
        if (!passwordValid) {
            return { success: false, error: 'Invalid password' };
        }

        // Check if new email is already in use
        const existingUser = await this.dbGet<{ id: string }>(
            `SELECT id FROM users WHERE email = ? AND id != ?`,
            [newEmail, userId]
        );

        if (existingUser) {
            return { success: false, error: 'Email is already in use' };
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');

        // Store pending email change
        await this.dbRun(
            `UPDATE users SET 
                pending_email = ?,
                email_change_token = ?,
                email_change_requested_at = datetime('now')
            WHERE id = ?`,
            [newEmail, token, userId]
        );

        // Send verification to NEW email
        const verificationUrl = `${config.FRONTEND_URL}/confirm-email-change?token=${token}`;

        const emailService = this.getEmailService();
        if (!emailService) {
            logger.error('[EmailVerification] Email service not available');
            return { success: false, error: 'Failed to send verification email' };
        }

        try {
            await emailService.send({
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
            logger.error('[EmailVerification] Failed to send email change email:', error);
            return { success: false, error: 'Failed to send verification email' };
        }
    }

    /**
     * Confirm email change
     */
    async confirmEmailChange(token: string): Promise<EmailChangeConfirmResult> {
        if (!token) {
            return { success: false, error: 'Token is required' };
        }

        const user = await this.dbGet<UserEmailVerification>(
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
        await this.dbRun(
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
        const emailService = this.getEmailService();
        if (emailService) {
            try {
                await emailService.send({
                    to: oldEmail,
                    subject: 'Your email address has been changed - Consultify',
                    template: 'email_changed_notification',
                    data: {
                        newEmail: newEmail
                    }
                });
            } catch (error) {
                logger.error('[EmailVerification] Failed to send change notification:', error);
                // Don't fail the operation, notification is secondary
            }
        }

        return { success: true, newEmail, oldEmail };
    }

    /**
     * Cancel pending email change
     */
    async cancelEmailChange(userId: string): Promise<{ success: boolean }> {
        await this.dbRun(
            `UPDATE users SET 
                pending_email = NULL,
                email_change_token = NULL,
                email_change_requested_at = NULL
            WHERE id = ?`,
            [userId]
        );

        return { success: true };
    }
}

// Export singleton instance
const emailVerificationService = new EmailVerificationService();

// Export class for testing
export { EmailVerificationService };

// Export default instance (for backward compatibility)
export default emailVerificationService;

