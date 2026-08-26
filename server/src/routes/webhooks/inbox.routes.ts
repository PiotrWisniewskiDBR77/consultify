/**
 * V4-INBX-06: Inbox connector webhooks — Slack/Teams → inbox
 * POST /api/webhooks/inbox/slack — Slack events (url_verification + message)
 * POST /api/webhooks/inbox/teams — Microsoft Teams (future)
 *
 * Auth: ?orgId=xxx + X-Inbox-Secret header (or INBOX_WEBHOOK_SECRET env).
 *
 * SECURITY (fix/inbox-failopen-stagegates-20260828, commit 1): this router
 * used to FAIL OPEN when INBOX_WEBHOOK_SECRET was not set — any caller could
 * pass an arbitrary `?orgId=` and get it accepted with zero verification
 * (confirmed live against staging: `POST /api/webhooks/inbox/slack?orgId=org-b-victim`
 * with no token returned 200 and inserted a row into `inbox_connector_items`
 * for org B, attacker-controlled payload). The router now FAILS CLOSED: if
 * the secret is not configured, every route under `/inbox` refuses with 503
 * before touching the database or accepting any orgId — never "dev mode
 * accepts anything". This mirrors the stripe webhook route's
 * missing-configuration guard (see webhooks/stripe.routes.ts), except that
 * guard only fires in production; here it fires unconditionally, because an
 * unset secret must never be treated as "trust the caller" in ANY
 * environment for a route that writes cross-tenant data keyed off a
 * client-supplied orgId.
 *
 * When the secret IS configured, behavior is unchanged: missing/wrong
 * secret → 401.
 */

import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import NotificationService from '../../services/notificationService.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();

const INBOX_WEBHOOK_SECRET = process.env.INBOX_WEBHOOK_SECRET || '';

// Fail-closed gate: refuse ALL traffic under /inbox when no secret is
// configured. Must run before any handler below — none of them may accept
// a request while this is unset.
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!INBOX_WEBHOOK_SECRET) {
    logger.error(
      '[InboxWebhook] INBOX_WEBHOOK_SECRET is not configured — refusing all inbox webhook traffic (fail-closed).'
    );
    res.status(503).json({
      statusCode: 503,
      status: false,
      type: 'not_configured',
      message: 'Inbox webhook integration is not configured',
    });
    return;
  }
  next();
});

/**
 * Resolve org from request; verify secret (guaranteed non-empty — the
 * router-level gate above already refused the request otherwise).
 */
const getOrgFromRequest = async (req: Request): Promise<{ orgId: string } | null> => {
  const orgId = (req.query.orgId || req.headers['x-inbox-org-id']) as string;
  if (!orgId) return null;
  const secret = (req.headers['x-inbox-secret'] || req.query.secret) as string;
  if (secret !== INBOX_WEBHOOK_SECRET) return null;
  const row = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM organizations WHERE id = ?`,
    [orgId]
  );
  return row ? { orgId } : null;
};

/**
 * POST /api/webhooks/inbox/slack
 * Slack Events API: url_verification challenge + message events
 */
router.post('/slack', async (req: Request, res: Response) => {
  const body = req.body || {};
  if (body.type === 'url_verification' && body.challenge) {
    return res.json({ challenge: body.challenge });
  }
  if (body.type !== 'event_callback') {
    return res.status(200).json({ received: true });
  }

  const event = body.event || {};
  const org = await getOrgFromRequest(req);
  if (!org) {
    logger.warn('[InboxWebhook] Slack: missing or invalid org/secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const channel = event.channel || '';
  const text = event.text || '';
  const user = event.user || '';
  const ts = event.ts || '';

  const routingRules = await queryHelpers.queryAll<{
    id: string;
    target_user_id: string | null;
    target_project_id: string | null;
  }>(
    `SELECT id, target_user_id, target_project_id FROM inbox_routing_rules
       WHERE organization_id = ? AND channel = 'slack' AND is_active = 1 ORDER BY priority DESC LIMIT 1`,
    [org.orgId]
  );

  const targetUserId = routingRules?.[0]?.target_user_id || null;
  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO inbox_connector_items (id, organization_id, source_channel, source_id, payload_json, target_user_id, status)
       VALUES (?, ?, 'slack', ?, ?, ?, 'pending')`,
    [
      id,
      org.orgId,
      `slack:${channel}:${ts}`,
      JSON.stringify({ channel, text, user, ts }),
      targetUserId,
    ]
  );

  if (targetUserId && text) {
    try {
      await NotificationService.send({
        userId: targetUserId,
        organizationId: org.orgId,
        type: 'SLACK_INBOX',
        title: 'Slack message routed to inbox',
        body: text.slice(0, 500),
        entityType: 'inbox_connector',
        entityId: id,
        priority: 'normal',
      });
    } catch (e) {
      logger.error('[InboxWebhook] Slack notify failed:', e);
    }
  }

  res.status(200).json({ received: true, id });
});

export default router;
