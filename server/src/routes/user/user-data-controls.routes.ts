/**
 * user-data-controls Routes
 * Data export and privacy controls (no stubs)
 */
import { Router, type Response } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { collectUserData } from '../../services/gdprService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

/**
 * GET /api/user/data-export
 * Direct JSON export fallback for clients.
 */
router.get(
  '/data-export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    const payload = await collectUserData(userId);
    return res.json(payload);
  })
);

export default router;

