/**
 * Public inbound webhook receiver for V8 integrations.
 *
 * POST /api/webhooks/v8-sync/inbound/:registrationId
 *
 * This route is mounted outside the V8 auth middleware chain so that
 * external providers (Jira, Slack, GitHub, etc.) can deliver events
 * without a JWT. Authentication relies on HMAC-SHA256 signature
 * verification using the per-registration secret_key.
 */
import { createHash, createHmac } from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

router.post(
  '/inbound/:registrationId',
  asyncHandler(async (req: Request, res: Response) => {
    const registrationId =
      typeof req.params.registrationId === 'string' ? req.params.registrationId.trim() : '';

    const reg = await dbGet(
      `SELECT registration_id, integration_id, organization_id, secret_key, event_types, is_active, direction
       FROM v8_webhook_registrations
       WHERE registration_id = ?`,
      [registrationId]
    );

    if (!reg) {
      return res.status(404).json({ error: 'Webhook registration not found' });
    }

    const r = reg as Record<string, unknown>;

    if (!r.is_active) {
      return res.status(410).json({ error: 'Webhook registration is inactive' });
    }
    if (r.direction !== 'inbound') {
      return res.status(400).json({ error: 'Registration is not an inbound webhook' });
    }

    // HMAC verification — required for public inbound webhooks
    if (!r.secret_key) {
      return res
        .status(500)
        .json({ error: 'Webhook registration has no signing secret configured' });
    }

    const signature = req.headers['x-webhook-signature'] as string | undefined;
    if (!signature) {
      return res.status(401).json({ error: 'Missing x-webhook-signature header' });
    }

    const rawBody = JSON.stringify(req.body);
    const expected = createHmac('sha256', String(r.secret_key)).update(rawBody).digest('hex');
    if (signature !== expected) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { eventType, payload } = req.body as { eventType?: string; payload?: unknown };
    const resolvedEventType = eventType || 'generic';

    let allowedTypes: string[] = [];
    try {
      allowedTypes = JSON.parse(String(r.event_types || '[]'));
    } catch {
      /* */
    }
    if (allowedTypes.length > 0 && !allowedTypes.includes(resolvedEventType)) {
      return res.status(422).json({ error: `Event type '${resolvedEventType}' is not registered` });
    }

    // Idempotency — payload hash dedup
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload || {}))
      .digest('hex');

    const existingDelivery = await dbGet(
      `SELECT delivery_id FROM v8_webhook_deliveries
       WHERE registration_id = ? AND payload_hash = ? AND status = 'delivered'
       LIMIT 1`,
      [registrationId, payloadHash]
    );
    if (existingDelivery) {
      return res.json({ data: { accepted: true, deduplicated: true } });
    }

    await dbRun(
      `INSERT INTO v8_webhook_deliveries (delivery_id, registration_id, organization_id, event_type, payload_hash, status, attempt_count, completed_at)
       VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, 'delivered', 1, NOW())`,
      [registrationId, r.organization_id, resolvedEventType, payloadHash]
    );

    await dbRun(
      `UPDATE v8_webhook_registrations SET last_delivery_at = NOW(), consecutive_failures = 0 WHERE registration_id = ?`,
      [registrationId]
    );

    await dbRun(
      `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
       VALUES (gen_random_uuid()::TEXT, ?, ?, 'webhook_received', 'system', 'webhook-public', ?::JSONB)`,
      [
        r.organization_id,
        r.integration_id,
        JSON.stringify({ registrationId, eventType: resolvedEventType, source: 'public_inbound' }),
      ]
    );

    return res.json({
      data: { accepted: true, deduplicated: false, eventType: resolvedEventType },
    });
  })
);

export default router;
