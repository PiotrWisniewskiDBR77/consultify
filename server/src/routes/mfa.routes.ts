/**
 * MFA Routes (Multi-Factor Authentication)
 * Implements TOTP-based MFA for enhanced security
 */
import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
const isAuthenticated = verifyToken; // alias for compatibility
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
const db = {
  get: (sql: string, params: any[]) => dbGet(sql, params),
  all: (sql: string, params: any[]) => dbAll(sql, params),
  run: (sql: string, params: any[]) => dbRun(sql, params),
};

// Simple TOTP implementation for demonstration
// In production, use a library like speakeasy or otplib
function generateSecret(): string {
  return crypto
    .randomBytes(20)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 32);
}

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

function verifyTOTP(secret: string, token: string): boolean {
  // Check current and adjacent windows for clock skew tolerance
  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secret, i) === token) return true;
  }
  return false;
}

/**
 * GET /api/mfa/status
 * Get MFA status for current user
 */
router.get('/status', verifyToken, isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const mfaConfig = (await db.get(
      `
      SELECT enabled, method, backup_codes_count, last_verified_at
      FROM user_mfa WHERE user_id = ?
    `,
      [userId]
    )) as {
      enabled: boolean;
      method: string;
      backup_codes_count: number;
      last_verified_at: string;
    } | null;

    res.json({
      enabled: mfaConfig?.enabled || false,
      method: mfaConfig?.method || null,
      backupCodesRemaining: mfaConfig?.backup_codes_count || 0,
      lastVerified: mfaConfig?.last_verified_at || null,
    });
  } catch (error: any) {
    logger.error('[MFA] Failed to get MFA status:', {
      err: error,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({ error: 'Nie udało się pobrać statusu MFA', code: 'MFA_STATUS_FAILED' });
  }
});

/**
 * POST /api/mfa/setup
 * Initialize MFA setup - generates secret and QR code data
 */
router.post('/setup', verifyToken, isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const user = (await db.get('SELECT email FROM users WHERE id = ?', [userId])) as {
      email: string;
    } | null;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const secret = generateSecret();
    const issuer = 'Consultify';
    const otpauthUrl = `otpauth://totp/${issuer}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    // Do not return a QR secret unless the pending configuration was durably
    // stored. DbPromise.run can fail closed through its result instead of throw.
    const storeResult = await db.run(
      `
      INSERT INTO user_mfa (user_id, secret, enabled, method, created_at)
      VALUES (?, ?, false, 'totp', datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET secret = ?, enabled = false, updated_at = datetime('now')
    `,
      [userId, secret, secret]
    );

    if (!storeResult?.success) {
      logger.error('[MFA] Failed to persist pending MFA secret', {
        userId,
        error: storeResult?.error,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się skonfigurować MFA', code: 'MFA_SETUP_NOT_PERSISTED' });
    }

    logger.info(`[MFA] Setup initiated for user ${userId}`);

    res.json({
      secret,
      otpauthUrl,
      qrCodeData: otpauthUrl, // Client can use this to generate QR code
      message: 'Scan the QR code with your authenticator app, then verify with a code',
    });
  } catch (error: any) {
    logger.error('[MFA] Failed to setup MFA:', {
      err: error,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({ error: 'Nie udało się skonfigurować MFA', code: 'MFA_SETUP_FAILED' });
  }
});

/**
 * POST /api/mfa/verify-setup
 * Verify setup by checking first TOTP code
 */
router.post('/verify-setup', verifyToken, isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { token } = req.body;

    if (!token || token.length !== 6) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    const mfaConfig = (await db.get('SELECT secret FROM user_mfa WHERE user_id = ?', [userId])) as {
      secret: string;
    } | null;

    if (!mfaConfig?.secret) {
      return res.status(400).json({ error: 'MFA not initialized. Please start setup first.' });
    }

    if (!verifyTOTP(mfaConfig.secret, token)) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex')
    );

    // Same fail-closed contract as the setup route above: DbPromise.run
    // resolves `{ success: false }` instead of throwing, so an unchecked
    // result would report "MFA enabled" to a user whose factor was never
    // stored.
    const enableResult = await db.run(
      `
      UPDATE user_mfa
      SET enabled = true,
          backup_codes = ?,
          backup_codes_count = 10,
          last_verified_at = datetime('now'),
          updated_at = datetime('now')
      WHERE user_id = ?
    `,
      [JSON.stringify(hashedBackupCodes), userId]
    );

    if (!enableResult?.success) {
      logger.error('[MFA] Failed to persist MFA enablement', {
        userId,
        error: enableResult?.error,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się włączyć MFA', code: 'MFA_ENABLE_NOT_PERSISTED' });
    }

    logger.info(`[MFA] Successfully enabled for user ${userId}`);

    res.json({
      success: true,
      message: 'MFA enabled successfully',
      backupCodes,
      warning: 'Save these backup codes securely. They can only be shown once.',
    });
  } catch (error: any) {
    logger.error('[MFA] Failed to verify MFA setup:', {
      err: error,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zweryfikować konfiguracji MFA',
      code: 'MFA_VERIFY_SETUP_FAILED',
    });
  }
});

/**
 * POST /api/mfa/verify
 * Verify MFA code during login
 */
router.post('/verify', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { token, isBackupCode } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const mfaConfig = (await db.get(
      'SELECT secret, backup_codes, enabled FROM user_mfa WHERE user_id = ?',
      [userId]
    )) as { secret: string; backup_codes: string; enabled: boolean } | null;

    if (!mfaConfig?.enabled) {
      return res.status(400).json({ error: 'MFA not enabled for this account' });
    }

    let verified = false;

    if (isBackupCode) {
      // Verify backup code
      const hashedInput = crypto.createHash('sha256').update(token.toUpperCase()).digest('hex');
      const backupCodes = JSON.parse(mfaConfig.backup_codes || '[]');
      const codeIndex = backupCodes.indexOf(hashedInput);

      if (codeIndex >= 0) {
        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        const consumeResult = await db.run(
          `
          UPDATE user_mfa
          SET backup_codes = ?, backup_codes_count = backup_codes_count - 1
          WHERE user_id = ?
        `,
          [JSON.stringify(backupCodes), userId]
        );
        // A recovery code that is accepted but not consumed stays valid
        // forever — the opposite of single-use. Refuse rather than admit on an
        // unpersisted consumption.
        if (!consumeResult?.success) {
          logger.error('[MFA] Failed to consume backup code', {
            userId,
            error: consumeResult?.error,
            correlationId: (req as any).correlationId,
          });
          return res.status(500).json({
            error: 'Weryfikacja nie powiodła się',
            code: 'MFA_BACKUP_CODE_NOT_CONSUMED',
          });
        }
        verified = true;
      }
    } else {
      // Verify TOTP
      verified = verifyTOTP(mfaConfig.secret, token);
    }

    if (!verified) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    const stampResult = await db.run(
      `
      UPDATE user_mfa SET last_verified_at = datetime('now') WHERE user_id = ?
    `,
      [userId]
    );

    // The factor itself was verified above; only the "last used" stamp may be
    // missing. That is an audit-quality problem, not an authentication one, so
    // it is logged rather than turned into a failed login.
    if (!stampResult?.success) {
      logger.warn('[MFA] Verified, but last_verified_at was not persisted', {
        userId,
        error: stampResult?.error,
        correlationId: (req as any).correlationId,
      });
    }

    res.json({ success: true, verified: true });
  } catch (error: any) {
    logger.error('[MFA] Verification failed:', {
      err: error,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({ error: 'Weryfikacja nie powiodła się', code: 'MFA_VERIFY_FAILED' });
  }
});

/**
 * POST /api/mfa/disable
 * Disable MFA (requires current password confirmation)
 */
router.post('/disable', verifyToken, isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { token, password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required' });
    }

    const user = (await db.get('SELECT password FROM users WHERE id = ?', [userId])) as {
      password: string;
    } | null;
    if (!user?.password || !bcrypt.compareSync(password, user.password)) {
      return res
        .status(401)
        .json({ error: 'Current password is incorrect', code: 'REAUTH_FAILED' });
    }

    const mfaConfig = (await db.get('SELECT secret, enabled FROM user_mfa WHERE user_id = ?', [
      userId,
    ])) as { secret: string; enabled: boolean } | null;

    if (!mfaConfig?.enabled) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    // Verify TOTP before disabling
    if (!verifyTOTP(mfaConfig.secret, token)) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    const disableResult = await db.run(
      `
      UPDATE user_mfa
      SET enabled = false, secret = null, backup_codes = null, backup_codes_count = 0
      WHERE user_id = ?
    `,
      [userId]
    );

    // Telling a user their second factor is off while the secret is still
    // stored is the most dangerous false success in this file — they would
    // stop expecting a prompt that still fires.
    if (!disableResult?.success) {
      logger.error('[MFA] Failed to persist MFA disablement', {
        userId,
        error: disableResult?.error,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się wyłączyć MFA', code: 'MFA_DISABLE_NOT_PERSISTED' });
    }

    logger.info(`[MFA] Disabled for user ${userId}`);

    res.json({ success: true, message: 'MFA has been disabled' });
  } catch (error: any) {
    logger.error('[MFA] Failed to disable MFA:', {
      err: error,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({ error: 'Nie udało się wyłączyć MFA', code: 'MFA_DISABLE_FAILED' });
  }
});

/**
 * POST /api/mfa/regenerate-backup-codes
 * Generate new backup codes (invalidates old ones)
 */
router.post(
  '/regenerate-backup-codes',
  verifyToken,
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { token } = req.body;

      const mfaConfig = (await db.get('SELECT secret, enabled FROM user_mfa WHERE user_id = ?', [
        userId,
      ])) as { secret: string; enabled: boolean } | null;

      if (!mfaConfig?.enabled) {
        return res.status(400).json({ error: 'MFA is not enabled' });
      }

      if (!verifyTOTP(mfaConfig.secret, token)) {
        return res.status(401).json({ error: 'Invalid verification code' });
      }

      const backupCodes = Array.from({ length: 10 }, () =>
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );
      const hashedBackupCodes = backupCodes.map((code) =>
        crypto.createHash('sha256').update(code).digest('hex')
      );

      const regenerateResult = await db.run(
        `
      UPDATE user_mfa
      SET backup_codes = ?, backup_codes_count = 10, updated_at = datetime('now')
      WHERE user_id = ?
    `,
        [JSON.stringify(hashedBackupCodes), userId]
      );

      // Handing back codes the response calls valid, while the old set is
      // still the one stored, would lock the user out of their own recovery
      // path. Refuse instead of printing codes that do not work.
      if (!regenerateResult?.success) {
        logger.error('[MFA] Failed to persist regenerated backup codes', {
          userId,
          error: regenerateResult?.error,
          correlationId: (req as any).correlationId,
        });
        return res.status(500).json({
          error: 'Nie udało się wygenerować nowych kodów zapasowych',
          code: 'MFA_BACKUP_CODES_NOT_PERSISTED',
        });
      }

      res.json({
        success: true,
        backupCodes,
        warning: 'Previous backup codes have been invalidated. Save these new codes securely.',
      });
    } catch (error: any) {
      logger.error('[MFA] Failed to regenerate backup codes:', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Nie udało się wygenerować nowych kodów zapasowych',
        code: 'MFA_REGENERATE_CODES_FAILED',
      });
    }
  }
);

export default router;
