/**
 * Webhook Subscriptions Routes
 * API endpoints for managing outgoing webhook subscriptions
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

async function getColumns(table: string): Promise<Set<string>> {
  try {
    const rows = await dbAll<{ name: string }>(`PRAGMA table_info(${table})`, []);
    return new Set((rows || []).map((r) => String(r.name || '')).filter(Boolean));
  } catch {
    return new Set();
  }
}

function signPayload(secret: string, payload: string): string {
  const h = crypto.createHmac('sha256', secret);
  h.update(payload);
  return `sha256=${h.digest('hex')}`;
}

// Minimal event catalog for external automation (Zapier/Make/webhooks).
router.get(
  '/catalog',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({
      version: 1,
      events: [
        { id: 'tasks.created', description: 'Task created', payloadShape: { taskId: 'string', projectId: 'string?' } },
        { id: 'tasks.updated', description: 'Task updated', payloadShape: { taskId: 'string', changes: 'object' } },
        {
          id: 'initiatives.updated',
          description: 'Initiative updated',
          payloadShape: { initiativeId: 'string', changes: 'object' },
        },
        {
          id: 'notifications.sent',
          description: 'Notification dispatched',
          payloadShape: { notificationId: 'string', channels: 'string[]' },
        },
        { id: 'webhook.test', description: 'Test delivery event', payloadShape: { at: 'isoDate', subscriptionId: 'string' } },
      ],
    });
  })
);

router.get(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const cols = await getColumns('webhook_subscriptions');
    const eventsCol = cols.has('events_json') ? 'events_json' : cols.has('events') ? 'events' : 'events_json';
    const secretCol = cols.has('secret') ? 'secret' : cols.has('secret_hash') ? 'secret_hash' : null;
    const subs = await dbAll(
      `
      SELECT id, name, url, ${eventsCol} as events, is_active,
             ${secretCol ? `${secretCol} as secret,` : ''} failure_count, created_at
      FROM webhook_subscriptions
      WHERE organization_id = ?
      ORDER BY created_at DESC
    `,
      [orgId]
    );
    res.json(subs || []);
  })
);

router.get(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const sub = await dbGet(
      `
    SELECT * FROM webhook_subscriptions WHERE id = ? AND organization_id = ?
  `,
      [id, orgId]
    );
    if (!sub) return res.status(404).json({ error: 'Webhook subscription not found' });
    res.json(sub);
  })
);

router.post(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { name, url, events, secret } = req.body;

    if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });

    const cols = await getColumns('webhook_subscriptions');
    const eventsCol = cols.has('events_json') ? 'events_json' : cols.has('events') ? 'events' : 'events_json';
    const secretCol = cols.has('secret') ? 'secret' : cols.has('secret_hash') ? 'secret_hash' : null;

    const id = uuidv4();
    const normalizedEvents = Array.isArray(events) && events.length ? events : ['*'];

    const columns: string[] = ['id', 'organization_id', 'name', 'url', eventsCol, 'is_active', 'failure_count'];
    const placeholders: string[] = ['?', '?', '?', '?', '?', '1', '0'];
    const params: any[] = [id, orgId, name, url, JSON.stringify(normalizedEvents)];
    if (secretCol) {
      columns.push(secretCol);
      placeholders.push('?');
      params.push(String(secret || '').trim() || null);
    }

    const result = await dbRun(
      `INSERT INTO webhook_subscriptions (${columns.join(', ')}, created_at)
       VALUES (${placeholders.join(', ')}, datetime('now'))`,
      params
    );

    if (!result.success) throw new Error(result.error || 'Failed to create webhook');
    logger.info(`[Webhooks] Created subscription: ${name}`);
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const { name, url, events, isActive } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (url !== undefined) {
      updates.push('url = ?');
      params.push(url);
    }
    if (events !== undefined) {
      updates.push('events = ?');
      params.push(JSON.stringify(events));
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    updates.push("updated_at = datetime('now')");
    params.push(id, orgId);

    await dbRun(
      `UPDATE webhook_subscriptions SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    await dbRun('DELETE FROM webhook_subscriptions WHERE id = ? AND organization_id = ?', [
      id,
      orgId,
    ]);
    res.json({ success: true });
  })
);

router.post(
  '/test',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const targetUrl = String(req.body?.targetUrl || req.body?.url || '').trim();
    const secret = String(req.body?.secret || '').trim();
    if (!targetUrl) return res.status(400).json({ success: false, error: 'targetUrl is required' });

    const eventType = 'webhook.test';
    const payloadObj = {
      event: eventType,
      at: new Date().toISOString(),
      organizationId: orgId,
      subscriptionId: null,
    };
    const payload = JSON.stringify(payloadObj);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-consultify-event': eventType,
      'x-consultify-delivery': `test-${Date.now()}`,
    };
    if (secret) headers['x-consultify-signature'] = signPayload(secret, payload);

    const started = Date.now();
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let ok = false;
    let errorMessage: string | null = null;

    try {
      const r = await fetch(targetUrl, { method: 'POST', headers, body: payload });
      statusCode = r.status;
      responseBody = await r.text().catch(() => null);
      ok = r.ok;
    } catch (e: any) {
      errorMessage = e?.message || 'delivery_failed';
    }
    const durationMs = Math.max(0, Date.now() - started);

    logger.info(`[Webhooks] Ad-hoc test delivery`, { orgId, ok, statusCode, durationMs });
    return res.json({
      success: ok,
      statusCode,
      durationMs,
      responseBody: responseBody ? responseBody.slice(0, 2000) : null,
      error: errorMessage,
    });
  })
);

router.post(
  '/:id/test',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const cols = await getColumns('webhook_subscriptions');
    const eventsCol = cols.has('events_json') ? 'events_json' : cols.has('events') ? 'events' : 'events_json';
    const secretCol = cols.has('secret') ? 'secret' : cols.has('secret_hash') ? 'secret_hash' : null;

    const sub = await dbGet<any>(
      `SELECT id, name, url, ${eventsCol} as events, is_active ${secretCol ? `, ${secretCol} as secret` : ''}
       FROM webhook_subscriptions WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!sub) return res.status(404).json({ error: 'Webhook subscription not found' });
    if (!sub.is_active) return res.status(400).json({ error: 'Webhook subscription is disabled' });

    const eventType = 'webhook.test';
    const payloadObj = {
      event: eventType,
      at: new Date().toISOString(),
      organizationId: orgId,
      subscriptionId: id,
    };
    const payload = JSON.stringify(payloadObj);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-consultify-event': eventType,
      'x-consultify-delivery': `test-${Date.now()}`,
    };

    const secret = typeof sub.secret === 'string' ? sub.secret.trim() : '';
    if (secret) {
      headers['x-consultify-signature'] = signPayload(secret, payload);
    }

    const started = Date.now();
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let ok = false;
    let errorMessage: string | null = null;

    try {
      const r = await fetch(String(sub.url), { method: 'POST', headers, body: payload });
      statusCode = r.status;
      responseBody = await r.text().catch(() => null);
      ok = r.ok;
    } catch (e: any) {
      errorMessage = e?.message || 'delivery_failed';
    }
    const durationMs = Math.max(0, Date.now() - started);

    // Best-effort delivery log (schema varies across migrations).
    const dcols = await getColumns('webhook_deliveries');
    if (dcols.size) {
      const deliveryId = uuidv4();
      if (dcols.has('event_type') && dcols.has('response_status')) {
        await dbRun(
          `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, request_headers, response_status, response_body, duration_ms, success, error_message, delivered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            deliveryId,
            id,
            eventType,
            payload,
            JSON.stringify(headers),
            statusCode,
            responseBody,
            durationMs,
            ok ? 1 : 0,
            errorMessage,
          ]
        ).catch(() => null);
      } else {
        await dbRun(
          `INSERT INTO webhook_deliveries (id, webhook_id, url, payload, status, response_code, attempted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            deliveryId,
            id,
            String(sub.url),
            payload,
            ok ? 'success' : 'failed',
            statusCode,
          ]
        ).catch(() => null);
      }
    }

    logger.info(`[Webhooks] Test delivery`, { id, ok, statusCode, durationMs });
    return res.json({
      success: ok,
      statusCode,
      durationMs,
      responseBody: responseBody ? responseBody.slice(0, 2000) : null,
      error: errorMessage,
    });
  })
);

router.get(
  '/:id/deliveries',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const deliveries = await dbAll(
      `
    SELECT id, event, status_code, response_time_ms, created_at
    FROM webhook_deliveries WHERE subscription_id = ? 
    ORDER BY created_at DESC LIMIT 50
  `,
      [id]
    );
    res.json(deliveries || []);
  })
);

export default router;
