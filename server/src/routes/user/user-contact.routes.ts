/**
 * User Contact Routes
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
router.use(verifyToken, requireActiveMembership);
interface AuthRequest extends Request {
  user?: { id: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const contact = await dbGet(
      'SELECT phone, address, city, country, postal_code, linkedin, website FROM user_contact WHERE user_id = ?',
      [req.user?.id]
    );
    res.json(contact || {});
  })
);

router.put(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { phone, address, city, country, postalCode, linkedin, website } = req.body;
    await dbRun(
      `INSERT INTO user_contact (user_id, phone, address, city, country, postal_code, linkedin, website, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET phone=?, address=?, city=?, country=?, postal_code=?, linkedin=?, website=?, updated_at=datetime('now')`,
      [
        req.user?.id,
        phone,
        address,
        city,
        country,
        postalCode,
        linkedin,
        website,
        phone,
        address,
        city,
        country,
        postalCode,
        linkedin,
        website,
      ]
    );
    res.json({ success: true });
  })
);

export default router;
