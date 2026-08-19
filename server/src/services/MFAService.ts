/**
 * MFA Service
 *
 * Login challenge and trusted-device persistence share the canonical user_mfa
 * and trusted_devices stores. Setup/disable remain owned by the mounted MFA
 * routes; the legacy auth-scoped setup methods below stay fail-closed.
 */

import crypto from 'node:crypto';

import { getPoolClientForPinnedTransaction } from '../database/PostgresDatabase.js';
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

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const clientDigest = (ipAddress?: string, userAgent?: string): string =>
  sha256(`${ipAddress || ''}\u0000${userAgent || ''}`);

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
  isDeviceTrusted: async (
    organizationId: string,
    userId: string,
    deviceCredential: string
  ) => {
    if (!deviceCredential) return false;
    const row = await dbGet<{ id: string }>(
      `SELECT td.id
         FROM trusted_devices td
         JOIN user_mfa m ON m.user_id = td.user_id
        WHERE td.organization_id = ?
          AND td.user_id = ?
          AND td.credential_hash = ?
          AND td.factor_generation = m.factor_generation
          AND expires_at > NOW()
        LIMIT 1`,
      [organizationId, userId, sha256(deviceCredential)],
      { fallback: false }
    );
    if (!row?.id) return false;
    const touched = await dbRun(
      `UPDATE trusted_devices
          SET last_used_at = NOW()
        WHERE id = ? AND organization_id = ? AND user_id = ?`,
      [row.id, organizationId, userId],
      { fallback: false }
    );
    if (!touched?.success || touched.changes !== 1) {
      throw new AppError(
        'Trusted device state could not be refreshed',
        503,
        'MFA_TRUST_READ_FAILED'
      );
    }
    return true;
  },

  /**
   * Trust a device
   */
  trustDevice: async (
    organizationId: string,
    userId: string,
    deviceCredential: string,
    deviceName: string
  ) => {
    if (!deviceCredential) {
      return { success: false, error: 'Device credential is required' };
    }
    const persisted = await dbRun(
      `INSERT INTO trusted_devices
         (id, organization_id, user_id, credential_hash, factor_generation,
          device_name, last_used_at, expires_at, created_at)
       SELECT gen_random_uuid()::text, ?, ?, ?, factor_generation,
              ?, NOW(), NOW() + INTERVAL '30 days', NOW()
         FROM user_mfa WHERE user_id = ? AND enabled = true
       ON CONFLICT (organization_id, user_id, credential_hash)
       DO UPDATE SET
         factor_generation = EXCLUDED.factor_generation,
         device_name = EXCLUDED.device_name,
         last_used_at = NOW(),
         expires_at = NOW() + INTERVAL '30 days'`,
      [organizationId, userId, sha256(deviceCredential), deviceName || 'Unknown Device', userId],
      { fallback: false }
    );
    if (!persisted?.success || persisted.changes !== 1) {
      throw new AppError('Trusted device could not be persisted', 503, 'MFA_TRUST_WRITE_FAILED');
    }
    return { success: true };
  },

  createLoginChallenge: async (
    organizationId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ) => {
    const raw = crypto.randomBytes(32).toString('base64url');
    const persisted = await dbRun(
      `INSERT INTO mfa_login_challenges
         (challenge_hash, organization_id, user_id, factor_generation,
          client_digest, attempts_remaining, expires_at)
       SELECT ?, ?, ?, factor_generation, ?, 5, NOW() + INTERVAL '5 minutes'
         FROM user_mfa
        WHERE user_id = ? AND enabled = true`,
      [sha256(raw), organizationId, userId, clientDigest(ipAddress, userAgent), userId],
      { fallback: false }
    );
    if (!persisted?.success || persisted.changes !== 1) {
      throw new AppError('MFA challenge could not be created', 503, 'MFA_CHALLENGE_FAILED');
    }
    return raw;
  },

  verifyLoginChallenge: async (
    challenge: string,
    code: string,
    deviceCredential: string | undefined,
    trustDevice: boolean,
    ipAddress?: string,
    userAgent?: string
  ) => {
    if (!challenge || !/^\d{6}$/.test(code || '')) {
      return { success: false, status: 401, code: 'MFA_INVALID_CODE' };
    }
    const client = await getPoolClientForPinnedTransaction();
    try {
      await client.query('BEGIN');
      const selected = await client.query<{
        id: string;
        organization_id: string;
        user_id: string;
        factor_generation: number;
        attempts_remaining: number;
        secret: string | null;
        enabled: boolean;
        current_generation: number | null;
        membership_status: string | null;
        expires_at: Date;
        consumed_at: Date | null;
      }>(
        `SELECT c.id, c.organization_id, c.user_id, c.factor_generation,
                c.attempts_remaining, c.expires_at, c.consumed_at,
                m.secret, m.enabled, m.factor_generation AS current_generation,
                om.status AS membership_status
           FROM mfa_login_challenges c
           LEFT JOIN user_mfa m ON m.user_id = c.user_id
           LEFT JOIN organization_members om
             ON om.organization_id = c.organization_id AND om.user_id = c.user_id
          WHERE c.challenge_hash = $1
            AND c.client_digest = $2
          FOR UPDATE OF c`,
        [sha256(challenge), clientDigest(ipAddress, userAgent)]
      );
      const row = selected.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return { success: false, status: 401, code: 'MFA_CHALLENGE_INVALID' };
      }
      const audit = async (success: boolean, reason: string) => {
        await client.query(
          `INSERT INTO audit_logs
             (id, timestamp, user_id, action_type, resource_type, resource_id,
              organization_id, details, ip_address, user_agent, created_at)
           VALUES (gen_random_uuid()::text, NOW(), $1, 'security.mfa.challenge',
                   'user_mfa', $1, $2, $3, $4, $5, NOW())`,
          [
            row.user_id,
            row.organization_id,
            JSON.stringify({ success, reason }),
            ipAddress ?? null,
            userAgent ?? null,
          ]
        );
      };
      const invalidState =
        row.consumed_at != null ||
        row.expires_at.getTime() <= Date.now() ||
        row.attempts_remaining <= 0 ||
        !row.enabled ||
        row.current_generation !== row.factor_generation ||
        String(row.membership_status || '').toUpperCase() !== 'ACTIVE';
      if (invalidState) {
        const membershipRevoked = String(row.membership_status || '').toUpperCase() !== 'ACTIVE';
        const reason =
          row.attempts_remaining <= 0
            ? 'locked'
            : row.expires_at.getTime() <= Date.now()
              ? 'expired'
              : 'stale_or_revoked';
        await audit(false, reason);
        await client.query('COMMIT');
        return membershipRevoked
          ? { success: false, status: 403, code: 'ORG_MEMBERSHIP_REVOKED' }
          : { success: false, status: 401, code: 'MFA_CHALLENGE_INVALID' };
      }
      if (!row.secret || !isValidTOTP(row.secret, code)) {
        await client.query(
          `UPDATE mfa_login_challenges
              SET attempts_remaining = GREATEST(attempts_remaining - 1, 0)
            WHERE id = $1`,
          [row.id]
        );
        await audit(false, 'invalid_totp');
        await client.query('COMMIT');
        return { success: false, status: 401, code: 'MFA_INVALID_CODE' };
      }
      const consumed = await client.query(
        `UPDATE mfa_login_challenges SET consumed_at = NOW()
          WHERE id = $1 AND consumed_at IS NULL RETURNING id`,
        [row.id]
      );
      if (consumed.rowCount !== 1) throw new Error('MFA challenge was already consumed');
      await client.query(
        `UPDATE user_mfa SET last_verified_at = NOW(), updated_at = NOW()
          WHERE user_id = $1 AND factor_generation = $2`,
        [row.user_id, row.factor_generation]
      );
      await audit(true, 'verified');
      await client.query('COMMIT');
      return {
        success: true,
        userId: row.user_id,
        organizationId: row.organization_id,
        trustRequested: trustDevice && Boolean(deviceCredential),
        deviceCredential,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
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
