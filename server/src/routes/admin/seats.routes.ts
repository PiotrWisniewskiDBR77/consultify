import { type NextFunction, type Response, Router } from 'express';

import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { getSeatConfiguration, getSeatHistory, toggleAutoAddSeats } from '../../services/seatManagementService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet } from '../../utils/DbPromise.js';

const router = Router();
router.use(verifyToken);
router.use(asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const organizationId = String(req.user?.organizationId || '').trim();
  const userId = String(req.user?.id || '').trim();
  if (!organizationId || !userId) return res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
  const membership = await dbGet<{ role?: string; status?: string }>(`SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`, [organizationId, userId], { fallback: false });
  if (!membership || String(membership.status || '').trim().toUpperCase() !== 'ACTIVE') return res.status(403).json({ success: false, error: 'Active organization membership required', code: 'ADMIN_MEMBERSHIP_REQUIRED' });
  if (!['OWNER', 'ADMIN'].includes(String(membership.role || '').trim().toUpperCase())) return res.status(403).json({ success: false, error: 'Tenant admin role required', code: 'ADMIN_ACCESS_REQUIRED' });
  next();
}));
router.use(verifyAdmin);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = String(req.user?.organizationId || '').trim();
  return res.json({ success: true, config: await getSeatConfiguration(organizationId) });
}));
router.get('/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = String(req.user?.organizationId || '').trim();
  const raw = Number.parseInt(String(req.query.limit || '50'), 10);
  const limit = Math.min(200, Math.max(1, Number.isFinite(raw) ? raw : 50));
  return res.json({ success: true, transactions: await getSeatHistory(organizationId, limit), limit });
}));
router.put('/auto-add', asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = String(req.user?.organizationId || '').trim();
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ success: false, error: 'enabled must be boolean' });
  const threshold = req.body.threshold === undefined ? 80 : Number(req.body.threshold);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) return res.status(400).json({ success: false, error: 'threshold must be an integer from 1 to 100' });
  await toggleAutoAddSeats(organizationId, req.body.enabled, threshold);
  return res.json({ success: true, config: await getSeatConfiguration(organizationId) });
}));

export default router;
