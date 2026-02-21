/**
 * SMS Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enterprise-grade SMS delivery service using Twilio.
 * Fully migrated from server/services/smsService.js
 *
 * Features:
 * - SMS delivery via Twilio
 * - Rate limiting (5 SMS per phone per hour)
 * - Delivery status tracking
 * - OTP code generation and verification
 *
 * Environment Variables Required:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (sender number in E.164 format)
 * - SMS_MOCK_MODE (optional, for local development flags; still returns unavailable)
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import twilio, { type Twilio } from 'twilio';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface SendSMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  mock?: boolean;
}

interface SendOTPResult {
  success: boolean;
  error?: string;
  expiresAt?: string;
}

interface VerifyOTPResult {
  success: boolean;
  error?: string;
}

interface PhoneStatusResult {
  hasPhone: boolean;
  verified: boolean;
  phoneNumber?: string;
}

interface TwilioStatusCallback {
  MessageSid: string;
  MessageStatus: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

interface _SMSDeliveryLog {
  id: string;
  user_id: string | null;
  phone_number: string;
  message_type: string;
  message_sid: string | null;
  status: string;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface SMSVerificationCode {
  id: string;
  user_id: string;
  phone_number: string;
  code: string;
  purpose: string;
  expires_at: string;
  used_at: string | null;
  attempts: number;
  created_at: string;
}

interface _SMSRateLimit {
  phone_number: string;
  user_id: string | null;
  window_start: string;
  count: number;
}

interface SMSServiceDependencies {
  db?: IDatabase;
  twilioClient?: Twilio;
}

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 10,
  MAX_OTP_ATTEMPTS: 3,
  RATE_LIMIT_PER_HOUR: 5,
  RATE_LIMIT_PER_DAY: 20,
  MOCK_MODE: process.env.SMS_MOCK_MODE === 'true' || !process.env.TWILIO_ACCOUNT_SID,
};

// ==========================================
// SMS SERVICE CLASS
// ==========================================

class SMSServiceClass {
  private db: IDatabase;
  private twilioClient: Twilio | null = null;

  constructor(deps?: SMSServiceDependencies) {
    this.db = deps?.db || getDatabase();
    this.twilioClient = deps?.twilioClient || null;
  }

  /**
   * Get or initialize Twilio client
   */
  private getTwilioClient(): Twilio | null {
    if (!this.twilioClient && !CONFIG.MOCK_MODE) {
      try {
        this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      } catch (error: unknown) {
        logger.warn(
          '[SMS] Twilio not configured:',
          error instanceof Error ? error.message : String(error)
        );
        return null;
      }
    }
    return this.twilioClient;
  }

  /**
   * Database helper: Get single row
   */
  private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return await DbPromise.get<T>(sql, params);
  }

  /**
   * Database helper: Run query
   */
  private async dbRun(
    sql: string,
    params: unknown[] = []
  ): Promise<{ lastID?: number; changes: number }> {
    const result = await DbPromise.run(sql, params);
    return {
      lastID: result.lastID,
      changes: result.changes || 0,
    };
  }

  /**
   * Database helper: Get all rows
   */
  private async _dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await DbPromise.all<T>(sql, params);
  }

  /**
   * Send an SMS message
   */
  async sendSMS(
    phoneNumber: string,
    message: string,
    userId: string | null = null,
    messageType: string = 'verification'
  ): Promise<SendSMSResult> {
    const logId = uuidv4();

    try {
      // Validate phone number
      if (!this._isValidPhoneNumber(phoneNumber)) {
        return {
          success: false,
          error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)',
        };
      }

      // Check rate limit
      const rateLimited = await this._checkRateLimit(phoneNumber);
      if (rateLimited) {
        return { success: false, error: 'Too many SMS requests. Please try again later.' };
      }

      // Log attempt
      await this._logDelivery(logId, userId, phoneNumber, messageType, 'pending');

      if (CONFIG.MOCK_MODE) {
        await this._logDelivery(logId, userId, phoneNumber, messageType, 'failed');
        return { success: false, error: 'SMS delivery is not available', mock: true };
      }

      // Send via Twilio
      const client = this.getTwilioClient();
      if (!client) {
        throw new Error('Twilio client not available');
      }

      const result = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: phoneNumber,
      });

      // Update log with success
      await this._logDelivery(logId, userId, phoneNumber, messageType, 'sent', result.sid);

      // Increment rate limit counter
      await this._incrementRateLimit(phoneNumber, userId);

      return { success: true, messageSid: result.sid };
    } catch (error: unknown) {
      logger.error('[SMS] Send failed:', error);

      // Update log with error
      await this.dbRun(
        `UPDATE sms_delivery_log SET 
                    status = 'failed', 
                    error_code = ?, 
                    error_message = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [
          (error as { code?: string }).code || 'UNKNOWN',
          error instanceof Error ? error.message : String(error),
          logId,
        ]
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  }

  /**
   * Generate and send OTP code
   */
  async sendOTP(
    userId: string,
    phoneNumber: string,
    purpose: 'phone_verify' | 'mfa_login' | 'mfa_setup' | 'password_reset' = 'mfa_login'
  ): Promise<SendOTPResult> {
    try {
      // Invalidate existing codes for this user/purpose
      await this.dbRun(
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
      await this.dbRun(
        `INSERT INTO sms_verification_codes (id, user_id, phone_number, code, purpose, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), userId, phoneNumber, hashedCode, purpose, expiresAt]
      );

      // Send SMS
      const messages: Record<string, string> = {
        phone_verify: `Your Consultinity verification code is: ${code}. Valid for ${CONFIG.OTP_EXPIRY_MINUTES} minutes.`,
        mfa_login: `Your Consultinity login code is: ${code}. Do not share this code with anyone.`,
        mfa_setup: `Your Consultinity MFA setup code is: ${code}. Valid for ${CONFIG.OTP_EXPIRY_MINUTES} minutes.`,
        password_reset: `Your Consultinity password reset code is: ${code}. If you didn't request this, ignore this message.`,
      };

      const message = messages[purpose] || messages.mfa_login;
      const result = await this.sendSMS(
        phoneNumber,
        message,
        userId,
        purpose === 'mfa_login' ? 'mfa' : 'verification'
      );

      if (!result.success) {
        return result;
      }

      return { success: true, expiresAt };
    } catch (error: unknown) {
      logger.error('[SMS] Send OTP failed:', error);
      return { success: false, error: 'Failed to send verification code' };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(
    userId: string,
    code: string,
    purpose: 'phone_verify' | 'mfa_login' | 'mfa_setup' | 'password_reset' = 'mfa_login'
  ): Promise<VerifyOTPResult> {
    try {
      // Get latest valid code
      const record = await this.dbGet<SMSVerificationCode>(
        `SELECT * FROM sms_verification_codes 
                 WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > datetime('now')
                 ORDER BY created_at DESC LIMIT 1`,
        [userId, purpose]
      );

      if (!record) {
        return {
          success: false,
          error: 'No valid verification code found. Please request a new one.',
        };
      }

      // Check max attempts
      if (record.attempts >= CONFIG.MAX_OTP_ATTEMPTS) {
        await this.dbRun(
          `UPDATE sms_verification_codes SET used_at = datetime('now') WHERE id = ?`,
          [record.id]
        );
        return { success: false, error: 'Too many attempts. Please request a new code.' };
      }

      // Increment attempt counter
      await this.dbRun(`UPDATE sms_verification_codes SET attempts = attempts + 1 WHERE id = ?`, [
        record.id,
      ]);

      // Verify code
      const isValid = bcrypt.compareSync(code, record.code);

      if (!isValid) {
        const remainingAttempts = CONFIG.MAX_OTP_ATTEMPTS - record.attempts - 1;
        return {
          success: false,
          error: `Invalid code. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : 'Please request a new code.'}`,
        };
      }

      // Mark code as used
      await this.dbRun(`UPDATE sms_verification_codes SET used_at = datetime('now') WHERE id = ?`, [
        record.id,
      ]);

      return { success: true };
    } catch (error: unknown) {
      logger.error('[SMS] Verify OTP failed:', error);
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
   * Verify phone number ownership
   */
  async initiatePhoneVerification(userId: string, phoneNumber: string): Promise<SendOTPResult> {
    // Update user's phone number (unverified)
    await this.dbRun(`UPDATE users SET phone_number = ?, phone_verified = 0 WHERE id = ?`, [
      phoneNumber,
      userId,
    ]);

    // Send verification OTP
    return this.sendOTP(userId, phoneNumber, 'phone_verify');
  }

  /**
   * Complete phone verification
   */
  async completePhoneVerification(userId: string, code: string): Promise<VerifyOTPResult> {
    const result = await this.verifyOTP(userId, code, 'phone_verify');

    if (!result.success) {
      return result;
    }

    // Mark phone as verified
    await this.dbRun(
      `UPDATE users SET 
                phone_verified = 1, 
                phone_verified_at = datetime('now')
             WHERE id = ?`,
      [userId]
    );

    return { success: true };
  }

  /**
   * Get phone verification status
   */
  async getPhoneStatus(userId: string): Promise<PhoneStatusResult> {
    const user = await this.dbGet<{ phone_number: string | null; phone_verified: number }>(
      `SELECT phone_number, phone_verified FROM users WHERE id = ?`,
      [userId]
    );

    if (!user || !user.phone_number) {
      return { hasPhone: false, verified: false };
    }

    return {
      hasPhone: true,
      verified: !!user.phone_verified,
      phoneNumber: this._maskPhoneNumber(user.phone_number),
    };
  }

  /**
   * Handle Twilio delivery status webhook
   */
  async handleStatusCallback(data: TwilioStatusCallback): Promise<void> {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = data;

    try {
      await this.dbRun(
        `UPDATE sms_delivery_log SET 
                    status = ?,
                    error_code = ?,
                    error_message = ?,
                    updated_at = datetime('now')
                 WHERE message_sid = ?`,
        [MessageStatus, ErrorCode || null, ErrorMessage || null, MessageSid]
      );
    } catch (error: unknown) {
      logger.error('[SMS] Status callback update failed:', error);
    }
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private _generateOTP(): string {
    // Generate cryptographically secure 6-digit code
    return crypto.randomInt(100000, 999999).toString();
  }

  private _isValidPhoneNumber(phone: string): boolean {
    // E.164 format: + followed by country code and number (7-15 digits total)
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    return e164Regex.test(phone);
  }

  private _maskPhoneNumber(phone: string): string {
    // Show only last 4 digits: +1***1234
    if (!phone || phone.length < 8) return phone;
    return phone.slice(0, 3) + '***' + phone.slice(-4);
  }

  private async _checkRateLimit(phoneNumber: string): Promise<boolean> {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Check hourly limit
    const hourlyCount = await this.dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM sms_delivery_log 
             WHERE phone_number = ? AND created_at > ? AND status != 'failed'`,
      [phoneNumber, hourAgo]
    );

    if (hourlyCount && hourlyCount.count >= CONFIG.RATE_LIMIT_PER_HOUR) {
      return true;
    }

    // Check daily limit
    const dailyCount = await this.dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM sms_delivery_log 
             WHERE phone_number = ? AND created_at > ? AND status != 'failed'`,
      [phoneNumber, dayAgo]
    );

    if (dailyCount && dailyCount.count >= CONFIG.RATE_LIMIT_PER_DAY) {
      return true;
    }

    return false;
  }

  private async _incrementRateLimit(phoneNumber: string, userId: string | null): Promise<void> {
    const windowStart = new Date().toISOString().slice(0, 13) + ':00:00'; // Hourly window

    try {
      await this.dbRun(
        `INSERT INTO sms_rate_limits (phone_number, user_id, window_start, count)
                 VALUES (?, ?, ?, 1)
                 ON CONFLICT(phone_number, window_start) DO UPDATE SET count = count + 1`,
        [phoneNumber, userId, windowStart]
      );
    } catch (error: unknown) {
      // Ignore duplicate key errors
      if (error instanceof Error && !error.message.includes('UNIQUE constraint')) {
        throw error;
      }
    }
  }

  private async _logDelivery(
    id: string,
    userId: string | null,
    phoneNumber: string,
    messageType: string,
    status: string,
    messageSid: string | null = null
  ): Promise<void> {
    await this.dbRun(
      `INSERT INTO sms_delivery_log (id, user_id, phone_number, message_type, message_sid, status)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                message_sid = COALESCE(excluded.message_sid, sms_delivery_log.message_sid),
                updated_at = datetime('now')`,
      [id, userId, phoneNumber, messageType, messageSid, status]
    );
  }
}

// ==========================================
// EXPORTS
// ==========================================

// Export singleton instance (for backward compatibility)
const smsService = new SMSServiceClass();

// Export class for testing
export { SMSServiceClass };

// Export default instance
export default smsService;

// Export individual methods for backward compatibility
export const sendSMS = (
  phoneNumber: string,
  message: string,
  userId: string | null = null,
  messageType: string = 'verification'
) => smsService.sendSMS(phoneNumber, message, userId, messageType);
export const sendOTP = (
  userId: string,
  phoneNumber: string,
  purpose: 'phone_verify' | 'mfa_login' | 'mfa_setup' | 'password_reset' = 'mfa_login'
) => smsService.sendOTP(userId, phoneNumber, purpose);
export const verifyOTP = (
  userId: string,
  code: string,
  purpose: 'phone_verify' | 'mfa_login' | 'mfa_setup' | 'password_reset' = 'mfa_login'
) => smsService.verifyOTP(userId, code, purpose);
export const initiatePhoneVerification = (userId: string, phoneNumber: string) =>
  smsService.initiatePhoneVerification(userId, phoneNumber);
export const completePhoneVerification = (userId: string, code: string) =>
  smsService.completePhoneVerification(userId, code);
export const getPhoneStatus = (userId: string) => smsService.getPhoneStatus(userId);
export const handleStatusCallback = (data: TwilioStatusCallback) =>
  smsService.handleStatusCallback(data);
