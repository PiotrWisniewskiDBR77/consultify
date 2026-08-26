/**
 * Webhooks Routes - API endpoints for incoming webhook handlers
 */
import { Request, Response, Router } from 'express';

import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import inboxWebhookRoutes from '../webhooks/inbox.routes.js';
import stripeWebhookRoutes from '../webhooks/stripe.routes.js';

const router = Router();

// V4-INBX-06: Inbox connectors (Slack/Teams → inbox)
router.use('/inbox', inboxWebhookRoutes);
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

let webhookEventsTableEnsured = false;
async function ensureWebhookEventsTable(): Promise<void> {
  if (webhookEventsTableEnsured) return;
  await dbRun(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload JSON,
      processed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider)`);
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at)`
  );
  webhookEventsTableEnsured = true;
}

// Canonical Stripe webhook handler (signature-verified + idempotent).
router.use(stripeWebhookRoutes);

// GitHub webhook
router.post(
  '/github',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureWebhookEventsTable();
    const event = req.headers['x-github-event'] as string;
    logger.info(`[Webhook] GitHub event: ${event}`);
    await dbRun(
      `INSERT INTO webhook_events (id, provider, event_type, payload, processed, created_at)
    VALUES (?, 'github', ?, ?, 0, datetime('now'))`,
      [req.headers['x-github-delivery'] || 'unknown', event || 'unknown', JSON.stringify(req.body)]
    );
    res.json({ received: true });
  })
);

// Jira webhook (integration-scoped)
// Configure Jira to send webhooks to: /api/webhooks/jira/<integrationId>
router.post(
  '/jira/:integrationId',
  asyncHandler(async (req: Request, res: Response) => {
    const integrationId = String(req.params.integrationId || '').trim();
    if (!integrationId) return res.status(400).json({ error: 'integrationId required' });

    const payload = req.body || {};
    const issue = (payload as any).issue || (payload as any).data?.issue || null;
    const issueId = String(issue?.id || '').trim();
    const issueKey = String(issue?.key || '').trim();
    const statusName =
      String(
        issue?.fields?.status?.name || issue?.fields?.status?.statusCategory?.name || ''
      ).trim() || null;

    // Store raw webhook event for audit/debugging (best-effort)
    try {
      await dbRun(
        `INSERT INTO webhook_events (id, provider, event_type, payload, processed, created_at)
         VALUES (?, 'jira', ?, ?, 0, datetime('now'))`,
        [
          `jira-${Date.now().toString()}`,
          String((payload as any).webhookEvent || 'jira'),
          JSON.stringify(payload),
        ]
      );
    } catch {
      // ignore if table doesn't exist
    }

    if (!issueId && !issueKey) {
      return res.status(200).json({ received: true, skipped: true, reason: 'no_issue' });
    }

    // Find mapping (external_id is Jira issue id; we also store key in metadata)
    const mapping = await dbAll<{
      local_id: string;
      external_id: string;
      metadata: string | null;
    }>(
      `SELECT local_id, external_id, metadata
       FROM integration_sync_mappings
       WHERE integration_id = ?
         AND external_type = 'issue'
         AND (external_id = ? OR metadata LIKE ?)
       LIMIT 1`,
      [integrationId, issueId || '—', issueKey ? `%"key":"${issueKey}"%` : '%']
    );

    const localTaskId = mapping?.[0]?.local_id;
    if (!localTaskId) {
      return res.status(200).json({ received: true, skipped: true, reason: 'no_mapping' });
    }

    // Minimal status mapping
    const normalize = (s: string) => String(s || '').toLowerCase();
    const jira = normalize(statusName || '');
    const mappedStatus =
      jira.includes('done') || jira.includes('closed')
        ? 'done'
        : jira.includes('progress') || jira.includes('in progress')
          ? 'in_progress'
          : jira.includes('review')
            ? 'review'
            : jira.includes('blocked')
              ? 'blocked'
              : 'todo';

    try {
      await dbRun(`UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`, [
        mappedStatus,
        localTaskId,
      ]);
      await dbRun(
        `UPDATE integration_sync_mappings SET last_external_update = datetime('now'), last_sync_at = datetime('now'), updated_at = datetime('now') WHERE integration_id = ? AND local_type = 'task' AND local_id = ?`,
        [integrationId, localTaskId]
      );
    } catch (e) {
      logger.warn('[Webhook] Jira webhook task update failed', { integrationId, localTaskId, e });
      return res.status(500).json({ received: false, error: 'Failed to update task' });
    }

    return res.json({ received: true, updated: true, localTaskId, status: mappedStatus });
  })
);

// Generic webhook receiver
router.post(
  '/:provider',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureWebhookEventsTable();
    const { provider } = req.params;
    logger.info(`[Webhook] ${provider} event received`);
    await dbRun(
      `INSERT INTO webhook_events (id, provider, event_type, payload, processed, created_at)
    VALUES (?, ?, 'generic', ?, 0, datetime('now'))`,
      [Date.now().toString(), provider, JSON.stringify(req.body)]
    );
    res.json({ received: true });
  })
);

// SECURITY (cross-tenant leak fix, 2026-08-28): `webhook_events` has no tenant
// column — GitHub/generic webhook senders arrive unauthenticated, so there is
// no organization to stamp on insert, and the rows cannot be sensibly
// backfilled after the fact. A per-org filter is therefore not possible today.
// Until a tenant column is added (tracked for a future integrations block),
// this endpoint is restricted to platform superadmins only — a tenant admin
// must NOT be able to see other organizations' webhook metadata (provider,
// event type, timing) via `verifyAdmin` (org-scoped admin check).
router.get(
  '/events',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureWebhookEventsTable();
    const events = await dbAll(`SELECT id, provider, event_type, processed, created_at
    FROM webhook_events ORDER BY created_at DESC LIMIT 100`);
    res.json(events || []);
  })
);

export default router;
