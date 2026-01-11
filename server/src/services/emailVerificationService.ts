/**
 * Email Verification Service
 * GAP-AUTH-001: Email verification flow
 *
 * Handles email verification token generation, validation, and email sending.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface EmailVerification {
  id: string;
  user_id: string;
  email: string;
  token: string;
  expires_at: string;
  verified_at?: string | null;
  created_at: string;
}

interface VerificationResult {
  success: boolean;
  error?: string;
  userId?: string;
  email?: string;
}

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

class EmailVerificationService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Create a verification token for email
   */
  async createVerificationToken(userId: string, email: string): Promise<string> {
    const db = await this.getDb();
    const token = crypto.randomBytes(32).toString('hex');
    const id = `verify-${uuidv4()}`;

    // Token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.run(
      `INSERT INTO email_verifications (id, user_id, email, token, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
      [id, userId, email, token, expiresAt]
    );

    logger.info(`[EmailVerification] Created verification token for user ${userId}`);
    return token;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<VerificationResult> {
    const db = await this.getDb();

    // Find valid, non-expired token
    const verification = await db.get<EmailVerification>(
      `SELECT * FROM email_verifications 
             WHERE token = ? AND verified_at IS NULL AND expires_at > datetime('now')`,
      [token]
    );

    if (!verification) {
      return {
        success: false,
        error: 'Invalid or expired verification token',
      };
    }

    // Mark as verified
    await db.run(`UPDATE email_verifications SET verified_at = datetime('now') WHERE id = ?`, [
      verification.id,
    ]);

    // Update user's email_verified status
    await db.run(
      `UPDATE users SET email_verified = 1, email_verified_at = datetime('now') WHERE id = ?`,
      [verification.user_id]
    );

    logger.info(`[EmailVerification] Email verified for user ${verification.user_id}`);

    return {
      success: true,
      userId: verification.user_id,
      email: verification.email,
    };
  }

  /**
   * Check if email is verified for user
   */
  async isEmailVerified(userId: string): Promise<boolean> {
    const db = await this.getDb();
    const user = await db.get<{ email_verified: number }>(
      `SELECT email_verified FROM users WHERE id = ?`,
      [userId]
    );
    return user?.email_verified === 1;
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(userId: string): Promise<{ success: boolean; error?: string }> {
    const db = await this.getDb();

    // Get user info
    const user = await db.get<{ email: string; first_name: string; email_verified: number }>(
      `SELECT email, first_name, email_verified FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.email_verified === 1) {
      return { success: false, error: 'Email is already verified' };
    }

    // Check rate limit - only allow resend every 5 minutes
    const recentToken = await db.get<{ created_at: string }>(
      `SELECT created_at FROM email_verifications 
             WHERE user_id = ? AND created_at > datetime('now', '-5 minutes')
             ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (recentToken) {
      return {
        success: false,
        error: 'Please wait 5 minutes before requesting another verification email',
      };
    }

    // Create new token and send email
    const token = await this.createVerificationToken(userId, user.email);
    await this.sendVerificationEmail(user.email, user.first_name, token);

    return { success: true };
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, firstName: string, token: string): Promise<void> {
    try {
      const EmailService = (await import('./emailService.js')).default;
      const verificationUrl = `${process.env.FRONTEND_URL || 'https://app.consultinity.com'}/verify-email?token=${token}`;

      await EmailService.send({
        to: email,
        subject: 'Verify your email address - Consultinity',
        html: this.generateVerificationEmailHtml(firstName, verificationUrl),
      });

      logger.info(`[EmailVerification] Verification email sent to ${email}`);
    } catch (err) {
      logger.error('[EmailVerification] Failed to send verification email:', err);
      throw err;
    }
  }

  /**
   * Generate verification email HTML
   */
  private generateVerificationEmailHtml(firstName: string, verificationUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .container { padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white !important; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #5a67d8; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .link { color: #667eea; word-break: break-all; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 Verify Your Email</h1>
        </div>
        <div class="content">
            <p>Hi ${firstName || 'there'},</p>
            
            <p>Welcome to Consultinity! Please verify your email address by clicking the button below:</p>
            
            <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            
            <p>Or copy and paste this link into your browser:</p>
            <p class="link">${verificationUrl}</p>
            
            <p><strong>This link will expire in 24 hours.</strong></p>
            
            <p>If you didn't create an account with Consultinity, you can safely ignore this email.</p>
            
            <p>Best regards,<br>The Consultinity Team</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultinity. All rights reserved.</p>
            <p>DBR77 Consultinity Sp. z o.o. | Warsaw, Poland</p>
        </div>
    </div>
</body>
</html>
        `;
  }
}

// Export singleton instance
const emailVerificationService = new EmailVerificationService();
export default emailVerificationService;

// Named exports for convenience
export const createVerificationToken = (userId: string, email: string) =>
  emailVerificationService.createVerificationToken(userId, email);
export const verifyEmail = (token: string) => emailVerificationService.verifyEmail(token);
export const isEmailVerified = (userId: string) => emailVerificationService.isEmailVerified(userId);
export const resendVerificationEmail = (userId: string) =>
  emailVerificationService.resendVerificationEmail(userId);
export const sendVerificationEmail = (email: string, firstName: string, token: string) =>
  emailVerificationService.sendVerificationEmail(email, firstName, token);
