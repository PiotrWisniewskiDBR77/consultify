import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Teresa realtime voice configuration for authenticated app surfaces.
 *
 * Security: the API key must NOT be embedded in the frontend bundle.
 * We expose it only to authenticated users and rely on standard cookie/session auth.
 */
const router = Router();

router.use(verifyToken);
router.use(requireOrganization);

router.get(
  '/voice-config',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    const voiceName = String(process.env.TERESA_VOICE_NAME || '').trim() || null;
    const enabled = Boolean(apiKey);

    return res.status(200).json({
      enabled,
      apiKey: enabled ? apiKey : null,
      voiceName,
    });
  })
);

export default router;
