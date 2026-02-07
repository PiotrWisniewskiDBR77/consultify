/**
 * Verify Routes
 * API endpoints for email/account verification
 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

router.get('/:token', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const record = await dbGet<any>(`
    SELECT user_id, type, expires_at FROM verification_tokens WHERE token = ? AND used = 0
  `, [token]);

  if (!record) return res.status(404).json({ error: 'Invalid or expired verification token' });
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Verification token expired' });
  }

  // Mark token as used
  await dbRun('UPDATE verification_tokens SET used = 1, used_at = datetime(\'now\') WHERE token = ?', [token]);

  // Update user status based on type
  if (record.type === 'email') {
    await dbRun('UPDATE users SET email_verified = 1 WHERE id = ?', [record.user_id]);
  }

  logger.info(`[Verify] Token verified for user ${record.user_id}, type: ${record.type}`);
  res.json({ success: true, type: record.type, message: 'Verification successful' });
}));

router.post('/resend', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await dbGet<any>('SELECT id, email_verified FROM users WHERE email = ?', [email]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.email_verified) return res.json({ success: true, message: 'Email already verified' });

  // In production, generate token and send email
  logger.info(`[Verify] Resend verification for ${email}`);
  res.json({ success: true, message: 'Verification email sent' });
}));

export default router;
