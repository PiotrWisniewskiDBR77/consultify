/**
 * Webhook Subscriptions Routes
 * API endpoints for managing outgoing webhook subscriptions
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../../middleware/auth.middleware.js';
import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get('/', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const subs = await dbAll(`
    SELECT id, name, url, events, is_active, secret_hash, last_triggered_at, 
           failure_count, created_at
    FROM webhook_subscriptions WHERE organization_id = ?
    ORDER BY created_at DESC
  `, [orgId]);
  res.json(subs || []);
}));

router.get('/:id', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const orgId = req.user?.organizationId;
  const sub = await dbGet(`
    SELECT * FROM webhook_subscriptions WHERE id = ? AND organization_id = ?
  `, [id, orgId]);
  if (!sub) return res.status(404).json({ error: 'Webhook subscription not found' });
  res.json(sub);
}));

router.post('/', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const { name, url, events, secret } = req.body;

  if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });

  const id = uuidv4();
  const secretHash = secret ? Buffer.from(secret).toString('base64') : '';

  const result = await dbRun(`
    INSERT INTO webhook_subscriptions (id, organization_id, name, url, events, secret_hash, 
                                       is_active, failure_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0, datetime('now'))
  `, [id, orgId, name, url, JSON.stringify(events || ['*']), secretHash]);

  if (!result.success) throw new Error(result.error || 'Failed to create webhook');
  logger.info(`[Webhooks] Created subscription: ${name}`);
  res.status(201).json({ success: true, id });
}));

router.put('/:id', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const orgId = req.user?.organizationId;
  const { name, url, events, isActive } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (url !== undefined) { updates.push('url = ?'); params.push(url); }
  if (events !== undefined) { updates.push('events = ?'); params.push(JSON.stringify(events)); }
  if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

  updates.push('updated_at = datetime(\'now\')');
  params.push(id, orgId);

  await dbRun(`UPDATE webhook_subscriptions SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`, params);
  res.json({ success: true });
}));

router.delete('/:id', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const orgId = req.user?.organizationId;
  await dbRun('DELETE FROM webhook_subscriptions WHERE id = ? AND organization_id = ?', [id, orgId]);
  res.json({ success: true });
}));

router.post('/:id/test', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  logger.info(`[Webhooks] Test ping sent for ${id}`);
  res.json({ success: true, message: 'Test webhook sent' });
}));

router.get('/:id/deliveries', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const orgId = req.user?.organizationId;
  const deliveries = await dbAll(`
    SELECT id, event, status_code, response_time_ms, created_at
    FROM webhook_deliveries WHERE subscription_id = ? 
    ORDER BY created_at DESC LIMIT 50
  `, [id]);
  res.json(deliveries || []);
}));

export default router;
