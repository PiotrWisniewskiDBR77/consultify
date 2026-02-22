/**
 * Sellix inbound webhook (T115)
 *
 * POST /api/webhooks/sellix
 * Headers:
 * - X-Sellix-Signature
 * - X-Sellix-Event
 * - X-Sellix-Timestamp
 *
 * Body must include an eventId (string) and may include organizationId/userId.
 */
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import {
  getConfig,
  processInboundEvent,
  verifySignature,
} from '../../services/sellixIntegrationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

function getRawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (typeof req.body === 'object' && req.body) return JSON.stringify(req.body);
  return '';
}

router.post(
  '/sellix',
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const signature = String(req.header('x-sellix-signature') || '');
    const timestamp = String(req.header('x-sellix-timestamp') || '');
    const eventHeader = String(req.header('x-sellix-event') || '');

    const raw = getRawBody(req);
    if (!signature || !timestamp) {
      return res.status(400).json({ error: 'Missing signature headers' });
    }

    const age = Date.now() - new Date(timestamp).getTime();
    if (Number.isFinite(age) && (age > 300000 || age < -60000)) {
      return res.status(401).json({ error: 'Timestamp out of range' });
    }

    let body: any;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const eventId = String(body.eventId || body.id || body.event_id || '');
    const eventType = String(body.eventType || body.type || eventHeader || 'sellix.unknown');
    const organizationId = body.organizationId ? String(body.organizationId) : null;

    if (!eventId) return res.status(400).json({ error: 'Missing eventId' });

    const config = await getConfig();
    if (config?.webhookSecret) {
      const ok = verifySignature(raw, signature, config.webhookSecret);
      if (!ok) return res.status(401).json({ error: 'Invalid signature' });
    }

    const result = await processInboundEvent({
      eventId,
      eventType,
      organizationId: organizationId || undefined,
      data: body?.data || body,
    });
    if (result.duplicate) return res.json({ received: true, deduped: true });

    logger.info(`[Sellix] inbound processed: ${eventType} (${eventId})`);
    return res.json({ received: true });
  })
);

export default router;
