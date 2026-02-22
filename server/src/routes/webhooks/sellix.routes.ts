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
  markSellixInboundProcessed,
  recordSellixInboundEvent,
  verifySellixInboundSignature,
} from '../../services/sellixIntegrationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
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

    const ok = await verifySellixInboundSignature({ timestamp, rawBody: raw, signature });
    if (!ok) return res.status(401).json({ error: 'Invalid signature' });

    let body: any;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const eventId = String(body.eventId || body.id || body.event_id || '');
    const eventType = String(body.eventType || body.type || eventHeader || 'sellix.unknown');
    const organizationId = body.organizationId ? String(body.organizationId) : null;
    const userId = body.userId ? String(body.userId) : 'system';

    if (!eventId) return res.status(400).json({ error: 'Missing eventId' });

    const rec = await recordSellixInboundEvent({
      eventId,
      eventType,
      organizationId,
      payload: body,
    });
    if (rec.deduped) return res.json({ received: true, deduped: true });

    // Best-effort analytics integration: journey_events + conversion_events when available.
    try {
      const journeyCols = await getTableColumns('journey_events');
      if (journeyCols.size > 0) {
        const id = `${eventId}`; // stable id for dedupe across retries
        const insertCols: string[] = [
          'id',
          'organization_id',
          'user_id',
          'event_type',
          'event_name',
        ];
        const insertVals: unknown[] = [
          id,
          organizationId || 'system',
          userId,
          'milestone',
          eventType,
        ];
        if (journeyCols.has('phase')) {
          insertCols.push('phase');
          insertVals.push('sellix');
        }
        const meta = { source: 'sellix' };
        if (journeyCols.has('metadata_json')) {
          insertCols.push('metadata_json');
          insertVals.push(JSON.stringify(meta));
        } else if (journeyCols.has('metadata')) {
          insertCols.push('metadata');
          insertVals.push(JSON.stringify(meta));
        }
        if (journeyCols.has('created_at')) {
          insertCols.push('created_at');
          insertVals.push(new Date().toISOString());
        }
        const placeholders = insertCols.map(() => '?').join(', ');
        await dbRun(
          `INSERT INTO journey_events (${insertCols.join(', ')}) VALUES (${placeholders})
           ON CONFLICT(id) DO NOTHING`,
          insertVals
        );
      }
    } catch (err) {
      // ignore
    }

    try {
      await markSellixInboundProcessed({ eventId });
    } catch {
      // ignore
    }

    logger.info(`[Sellix] inbound processed: ${eventType} (${eventId})`);
    return res.json({ received: true });
  })
);

export default router;
