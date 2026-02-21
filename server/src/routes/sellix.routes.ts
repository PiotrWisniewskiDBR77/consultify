import { Router, type Request, type Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { requireConfirmation } from '../middleware/confirmAction.middleware.js';
import adminAuditService from '../services/adminAuditService.js';
import { getConfig, getDeliveryStatus, getRecentInboundEvents, processInboundEvent, sendReadinessSignal, upsertConfig, verifySignature } from '../services/sellixIntegrationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

router.get('/config', asyncHandler(async (req: AuthRequest, res: Response) => {
  const config = await getConfig();
  res.json(config || { enabled: false });
}));

router.put('/config', asyncHandler(async (req: AuthRequest, res: Response) => {
  const adminId = req.userId || 'unknown';
  const config = await upsertConfig(req.body, adminId);
  try { await adminAuditService.logAction({ adminId, actionType: 'sellix_config_updated', details: { changes: Object.keys(req.body) } }); } catch { /* best-effort */ }
  res.json(config);
}));

router.post('/test-event', requireConfirmation('sellix_test_event', 'high'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { organizationId, score, tier } = req.body;
  if (!organizationId) { res.status(422).json({ error: 'organizationId required' }); return; }
  const result = await sendReadinessSignal(organizationId, score ?? 85, tier ?? 'READY', [], 'v1-test');
  try { await adminAuditService.logAction({ adminId: req.userId || 'unknown', actionType: 'sellix_test_event_sent', details: { organizationId, result } }); } catch { /* best-effort */ }
  res.json(result);
}));

router.get('/status', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [deliveries, events] = await Promise.all([getDeliveryStatus(20), getRecentInboundEvents(20)]);
  res.json({ deliveries, events });
}));

export const sellixWebhookRouter = Router();

sellixWebhookRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-sellix-signature'] as string;
  const eventType = req.headers['x-sellix-event'] as string;
  const timestamp = req.headers['x-sellix-timestamp'] as string;
  if (!signature || !eventType) { res.status(400).json({ error: 'Missing signature or event header' }); return; }
  if (timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    if (age > 300000 || age < -60000) { res.status(401).json({ error: 'Timestamp out of range' }); return; }
  }
  const config = await getConfig();
  if (config?.webhookSecret) {
    const rawBody = JSON.stringify(req.body);
    const valid = verifySignature(rawBody, signature, config.webhookSecret);
    if (!valid) { logger.warn('[Sellix] Invalid webhook signature'); res.status(401).json({ error: 'Invalid signature' }); return; }
  }
  const { eventId, data, organizationId } = req.body || {};
  if (!eventId) { res.status(400).json({ error: 'eventId required' }); return; }
  const result = await processInboundEvent({ eventId, eventType, organizationId, data });
  if (result.duplicate) { res.status(200).json({ ok: true, duplicate: true }); return; }
  logger.info('[Sellix] Inbound event processed', { eventType, eventId, organizationId });
  res.status(200).json({ ok: true });
}));

export default router;
