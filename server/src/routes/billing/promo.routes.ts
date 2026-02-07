/**
 * Promo Routes
 * API endpoints for promotional codes / discount management
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.get('/', verifyToken, verifySuperAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  const promos = await dbAll(`
    SELECT id, code, discount_type, discount_value, max_uses, current_uses,
           is_active, valid_from, valid_until, created_at
    FROM promo_codes ORDER BY created_at DESC
  `);
  res.json(promos || []);
}));

router.post('/', verifyToken, verifySuperAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code, discountType, discountValue, maxUses, validFrom, validUntil } = req.body;
  if (!code || !discountType || discountValue === undefined) {
    return res.status(400).json({ error: 'Code, discount type and value required' });
  }
  const id = uuidv4();
  await dbRun(`
    INSERT INTO promo_codes (id, code, discount_type, discount_value, max_uses, current_uses,
                             is_active, valid_from, valid_until, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, datetime('now'))
  `, [id, code.toUpperCase(), discountType, discountValue, maxUses || -1, validFrom, validUntil]);
  logger.info(`[Promo] Created code: ${code}`);
  res.status(201).json({ success: true, id, code: code.toUpperCase() });
}));

router.get('/validate/:code', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code } = req.params;
  const promo = await dbGet<any>(`
    SELECT id, discount_type, discount_value, max_uses, current_uses, valid_until, is_active
    FROM promo_codes WHERE code = ?
  `, [code.toUpperCase()]);
  if (!promo || !promo.is_active) return res.json({ valid: false, reason: 'Invalid code' });
  if (promo.valid_until && new Date(promo.valid_until) < new Date()) return res.json({ valid: false, reason: 'Expired' });
  if (promo.max_uses > 0 && promo.current_uses >= promo.max_uses) return res.json({ valid: false, reason: 'Limit reached' });
  res.json({ valid: true, discountType: promo.discount_type, discountValue: promo.discount_value });
}));

router.put('/:id', verifyToken, verifySuperAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { isActive, maxUses, validUntil } = req.body;
  const updates: string[] = []; const params: any[] = [];
  if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (maxUses !== undefined) { updates.push('max_uses = ?'); params.push(maxUses); }
  if (validUntil !== undefined) { updates.push('valid_until = ?'); params.push(validUntil); }
  if (!updates.length) return res.status(400).json({ error: 'No updates' });
  params.push(id);
  await dbRun(`UPDATE promo_codes SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ success: true });
}));

router.delete('/:id', verifyToken, verifySuperAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  await dbRun('UPDATE promo_codes SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

export default router;
