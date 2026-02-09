/**
 * WebAuthn Routes - API endpoints for passwordless authentication
 */
import crypto from 'crypto';
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string };
}

router.post(
  '/register/begin',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const user = await dbGet<any>('SELECT email, first_name, last_name FROM users WHERE id = ?', [
      userId,
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const challenge = crypto.randomBytes(32).toString('base64url');

    // Store challenge for verification
    await dbRun(
      `
    INSERT INTO webauthn_challenges (user_id, challenge, created_at, expires_at)
    VALUES (?, ?, datetime('now'), datetime('now', '+5 minutes'))
  `,
      [userId, challenge]
    );

    res.json({
      challenge,
      rp: { name: 'Consultinity', id: 'consultinity.io' },
      user: { id: userId, name: user.email, displayName: `${user.first_name} ${user.last_name}` },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      timeout: 60000,
      attestation: 'none',
    });
  })
);

router.post(
  '/register/finish',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { credential } = req.body;

    if (!credential) return res.status(400).json({ error: 'Credential data required' });

    // In production, verify the attestation
    await dbRun(
      `
    INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, created_at)
    VALUES (?, ?, ?, 0, datetime('now'))
  `,
      [userId, credential.id, JSON.stringify(credential)]
    );

    logger.info(`[WebAuthn] Registered passkey for user ${userId}`);
    res.json({ success: true, message: 'Passkey registered successfully' });
  })
);

router.get(
  '/credentials',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const credentials = await dbGet<any>(
      `
    SELECT credential_id, created_at, last_used_at FROM webauthn_credentials WHERE user_id = ?
  `,
      [req.user?.id]
    );
    res.json(credentials ? [credentials] : []);
  })
);

router.delete(
  '/credentials/:credentialId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM webauthn_credentials WHERE credential_id = ? AND user_id = ?', [
      req.params.credentialId,
      req.user?.id,
    ]);
    res.json({ success: true });
  })
);

export default router;
