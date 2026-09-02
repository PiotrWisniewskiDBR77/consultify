import crypto from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import EmailService from './emailService.js';

type VerifyResult =
  | { success: true; userId: string; email: string }
  | { success: false; error: string };

let ensured = false;

function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

async function ensureSchema(): Promise<void> {
  if (ensured) return;

  try {
    const tableResult = await DbPromise.exec(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    if (!tableResult.success) throw new Error(tableResult.error || 'table creation failed');

    const userIndexResult = await DbPromise.exec(
      `CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);`
    );
    if (!userIndexResult.success)
      throw new Error(userIndexResult.error || 'user index creation failed');

    const hashIndexResult = await DbPromise.exec(
      `CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);`
    );
    if (!hashIndexResult.success)
      throw new Error(hashIndexResult.error || 'hash index creation failed');

    ensured = true;
  } catch (e) {
    logger.error('[EmailVerification] ensureSchema failed', {
      error: (e as Error)?.message || e,
    });
    throw e;
  }
}

async function markUserVerified(userId: string): Promise<void> {
  try {
    const cols = await getTableColumns('users');
    const updates: string[] = [];
    const params: unknown[] = [];

    if (cols.has('email_verified')) {
      updates.push('email_verified = 1');
    }
    if (cols.has('email_verified_at')) {
      updates.push('email_verified_at = CURRENT_TIMESTAMP');
    }
    if (cols.has('updated_at')) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
    }

    if (updates.length === 0) return;

    params.push(userId);
    await DbPromise.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, {
      fallback: false,
    });
  } catch (e) {
    logger.warn('[EmailVerification] markUserVerified failed (continuing)', {
      error: (e as Error)?.message || e,
    });
  }
}

async function getUserEmail(userId: string): Promise<{ email: string; firstName: string } | null> {
  try {
    const row = await DbPromise.get<{ email: string; first_name?: string | null }>(
      `SELECT email, first_name FROM users WHERE id = ?`,
      [userId],
      { fallback: false }
    );
    if (!row?.email) return null;
    return { email: String(row.email), firstName: String(row.first_name || '') };
  } catch {
    return null;
  }
}

async function createVerificationToken(userId: string, email: string): Promise<string> {
  await ensureSchema();

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256Base64Url(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await DbPromise.run(
    `INSERT INTO email_verification_tokens (id, user_id, email, token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), userId, email, tokenHash, expiresAt],
    { fallback: false }
  );

  return token;
}

async function sendVerificationEmail(
  email: string,
  firstName: string,
  token: string
): Promise<void> {
  const baseUrl = String(
    process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000'
  ).replace(/\/$/, '');
  const verifyLink = `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

  await EmailService.send({
    to: email,
    subject: 'Verify your email',
    html: `
      <p>Hi ${firstName || 'there'},</p>
      <p>Please verify your email by clicking this link:</p>
      <p><a href="${verifyLink}">${verifyLink}</a></p>
    `,
  });
}

async function verifyEmail(token: string): Promise<VerifyResult> {
  await ensureSchema();

  const tokenHash = sha256Base64Url(token);
  const row = await DbPromise.get<{
    user_id: string;
    email: string;
    expires_at: string;
    used_at: string | null;
  }>(
    `SELECT user_id, email, expires_at, used_at
     FROM email_verification_tokens
     WHERE token_hash = ?`,
    [tokenHash],
    { fallback: false }
  );

  if (!row) return { success: false, error: 'Invalid token' };
  if (row.used_at) return { success: false, error: 'Token already used' };
  if (row.expires_at && new Date(row.expires_at) < new Date())
    return { success: false, error: 'Token expired' };

  await DbPromise.run(
    `UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ?`,
    [tokenHash],
    { fallback: false }
  );
  await markUserVerified(String(row.user_id));

  return { success: true, userId: String(row.user_id), email: String(row.email) };
}

async function resendVerificationEmail(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUserEmail(userId);
  if (!user) return { success: false, error: 'User not found' };

  const token = await createVerificationToken(userId, user.email);
  await sendVerificationEmail(user.email, user.firstName, token);
  return { success: true };
}

async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ email_verified?: number | null }>(
      `SELECT email_verified FROM users WHERE id = ?`,
      [userId],
      { fallback: false }
    );
    return Number(row?.email_verified || 0) === 1;
  } catch {
    return false;
  }
}

export default {
  createVerificationToken,
  sendVerificationEmail,
  verifyEmail,
  resendVerificationEmail,
  isEmailVerified,
};
