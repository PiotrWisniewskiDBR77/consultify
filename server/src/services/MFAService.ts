/**
 * MFA Service
 *
 * This codebase does not currently ship a complete MFA implementation in the service layer.
 * Do not return fake-success responses; expose honest contracts so callers can handle
 * unavailability explicitly.
 */

import crypto from 'node:crypto';

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';

function generateTOTP(secret: string, window = 0): string {
  const time = Math.floor(Date.now() / 1000 / 30) + window;
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(time));
  hmac.update(timeBuffer);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code =
    (((hash[offset] & 0x7f) << 24) |
      (hash[offset + 1] << 16) |
      (hash[offset + 2] << 8) |
      hash[offset + 3]) %
    1000000;
  return code.toString().padStart(6, '0');
}

function isValidTOTP(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  return [-1, 0, 1].some((window) => generateTOTP(secret, window) === token);
}

const mfaService = {
  /**
   * Get MFA status for a user - returns disabled by default
   */
  getMFAStatus: async (userId: string) => {
    const row = await dbGet<{
      enabled: boolean;
      method: string | null;
      mfa_required: boolean;
      mfa_grace_period_days: number | null;
    }>(
      `SELECT COALESCE(m.enabled, false) AS enabled, m.method,
              COALESCE(o.mfa_required, 0) AS mfa_required, o.mfa_grace_period_days
         FROM users u
         JOIN organizations o ON o.id = u.organization_id
         LEFT JOIN user_mfa m ON m.user_id = u.id
        WHERE u.id = ?`,
      [userId],
      { fallback: false }
    );
    return {
      enabled: Boolean(row?.enabled),
      methods: row?.method ? [row.method] : [],
      enforced: Boolean(row?.mfa_required),
      gracePeriodRemaining: Number(row?.mfa_grace_period_days ?? 0),
    };
  },

  /**
   * Check if a device is trusted
   */
  isDeviceTrusted: async (userId: string, deviceFingerprint: string) => {
    logger.info(`[MFAService] isDeviceTrusted called for user: ${userId}`);
    return false;
  },

  /**
   * Trust a device
   */
  trustDevice: async (userId: string, deviceFingerprint: string, deviceName: string) => {
    logger.info(`[MFAService] trustDevice called for user: ${userId}`);
    return { success: false, error: 'Device trust is not available' };
  },

  /**
   * Verify TOTP code
   */
  verifyTOTP: async (userId: string, code: string, ipAddress?: string, userAgent?: string) => {
    const row = await dbGet<{ secret: string | null; enabled: boolean; organization_id: string }>(
      `SELECT m.secret, m.enabled, u.organization_id
         FROM users u JOIN user_mfa m ON m.user_id = u.id
        WHERE u.id = ?`,
      [userId],
      { fallback: false }
    );
    const success = Boolean(row?.enabled && row.secret && isValidTOTP(row.secret, code));
    await dbRun(
      `INSERT INTO audit_logs
         (id, timestamp, user_id, action_type, resource_type, resource_id,
          organization_id, details, ip_address, user_agent, created_at)
       VALUES (gen_random_uuid()::text, NOW(), ?, 'security.mfa.challenge', 'user_mfa', ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        userId,
        row?.organization_id ?? null,
        JSON.stringify({ success }),
        ipAddress ?? null,
        userAgent ?? null,
      ],
      { fallback: false }
    );
    if (success) {
      await dbRun(
        `UPDATE user_mfa SET last_verified_at = NOW(), updated_at = NOW() WHERE user_id = ?`,
        [userId],
        { fallback: false }
      );
      return { success: true };
    }
    return { success: false, error: 'Invalid verification code', code: 'MFA_INVALID_CODE' };
  },

  /**
   * Setup MFA for a user
   */
  setupMFA: async (userId: string, email: string) => {
    logger.info(`[MFAService] setupMFA called for user: ${userId}`);
    throw new AppError('MFA setup is not available', 503, 'FEATURE_UNAVAILABLE');
  },

  /**
   * Verify and enable MFA
   */
  verifyAndEnableMFA: async (userId: string, token: string) => {
    logger.info(`[MFAService] verifyAndEnableMFA called for user: ${userId}`);
    throw new AppError('MFA enable is not available', 503, 'FEATURE_UNAVAILABLE');
  },

  /**
   * Disable MFA for a user
   */
  disableMFA: async (userId: string, token: string) => {
    logger.info(`[MFAService] disableMFA called for user: ${userId}`);
    throw new AppError('MFA disable is not available', 503, 'FEATURE_UNAVAILABLE');
  },

  /**
   * Set dependencies (for testing)
   */
  setDependencies: (deps: any) => {
    logger.info('[MFAService] setDependencies called');
  },
};

export default mfaService;
