import crypto from 'crypto';

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { recordOperationalAlertSignal } from './operationalAlertSignalDeliveryService.js';

type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED';

interface OutboxRow {
  id: string;
  user_id: string;
  organization_id: string;
  type: string;
  payload_json: string;
  status: OutboxStatus;
  dedupe_key: string | null;
  created_at: string;
}

const ensureTable = async () => {
  await dbRun(
    `
    CREATE TABLE IF NOT EXISTS notification_outbox (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      dedupe_key TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL
    )
  `,
    []
  );
};

/** Human-friendly title per outbox notification type (fallback for unknown types). */
function titleForOutboxType(type: string): string {
  switch (String(type || '').toUpperCase()) {
    case 'ESCALATION':
      return 'Eskalacja zatwierdzenia';
    case 'APPROVAL_DUE':
      return 'Zatwierdzenie wymaga uwagi';
    default:
      return `Powiadomienie: ${type}`;
  }
}

/** Best-effort human body derived from the generic payload envelope. */
function bodyForOutboxPayload(payload: Record<string, unknown>): string {
  if (payload && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  const parts: string[] = [];
  if (payload?.status) parts.push(String(payload.status));
  if (payload?.escalationReason) parts.push(String(payload.escalationReason));
  if (payload?.slaDueAt) parts.push(`termin: ${payload.slaDueAt}`);
  if (parts.length) return parts.join(' — ');
  try {
    return JSON.stringify(payload ?? {});
  } catch {
    return '';
  }
}

export interface DrainResult {
  processed: number;
  sent: number;
  deduped: number;
  failed: number;
}

/**
 * Drain PENDING rows from `notification_outbox`: deliver each via
 * NotificationService.send() (in-app/email dispatch + its own dedup window),
 * then mark the row SENT.
 *
 * Dedupe contract: a row whose `dedupe_key` is non-null and already has a
 * SENT sibling (same dedupe_key, different id) is marked SENT WITHOUT being
 * re-delivered — this is what makes "enqueue the same dedupe_key twice"
 * collapse into exactly one outgoing notification. Rows are processed
 * sequentially (not in parallel) so this holds even when two duplicates land
 * in the very same drain batch.
 *
 * Fail-soft: a delivery error marks that single row FAILED (FAILED rows are
 * terminal today — no automatic retry — matching the outbox's original
 * best-effort contract) and processing continues with the rest of the batch.
 * drainOnce() itself never throws.
 */
async function drainOnce(opts: { limit?: number } = {}): Promise<DrainResult> {
  const result: DrainResult = { processed: 0, sent: 0, deduped: 0, failed: 0 };

  try {
    await ensureTable();
  } catch (err) {
    logger.warn('[NotificationOutbox] drain: ensureTable failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return result;
  }

  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));

  let rows: OutboxRow[] = [];
  try {
    rows = await dbAll<OutboxRow>(
      `SELECT id, user_id, organization_id, type, payload_json, status, dedupe_key, created_at
         FROM notification_outbox
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT ${limit}`,
      []
    );
  } catch (err) {
    logger.warn('[NotificationOutbox] drain: query failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return result;
  }

  if (!rows || rows.length === 0) return result;

  // Lazy import to avoid any load-order coupling with notificationService.ts
  // (mirrors the existing lazy-load pattern slaService.ts uses for this same
  // module). Delivery degrades to a log line if the module is missing.
  let NotificationService: any = null;
  try {
    const mod = await import('./notificationService.js');
    NotificationService = (mod as any).default || mod;
  } catch (err) {
    logger.warn('[NotificationOutbox] drain: NotificationService unavailable, logging only', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  for (const row of rows) {
    result.processed++;
    try {
      if (row.dedupe_key) {
        const existing = await dbAll<{ id: string }>(
          `SELECT id FROM notification_outbox
            WHERE dedupe_key = ? AND status = 'SENT' AND id != ?
            LIMIT 1`,
          [row.dedupe_key, row.id]
        );
        if (existing && existing.length > 0) {
          await dbRun(
            `UPDATE notification_outbox SET status = 'SENT', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [row.id]
          );
          result.deduped++;
          continue;
        }
      }

      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(row.payload_json || '{}');
      } catch {
        payload = {};
      }

      if (NotificationService && typeof NotificationService.send === 'function') {
        await NotificationService.send({
          userId: row.user_id,
          organizationId: row.organization_id,
          type: row.type,
          title: titleForOutboxType(row.type),
          body: bodyForOutboxPayload(payload),
          data: payload,
          dedupeKey: row.dedupe_key || undefined,
        });
      } else {
        logger.info(
          `[NotificationOutbox] Drained ${row.type} for user ${row.user_id} (no delivery channel wired; logged only).`
        );
      }

      await dbRun(
        `UPDATE notification_outbox SET status = 'SENT', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [row.id]
      );
      void recordOperationalAlertSignal({ organizationId: row.organization_id, actorId: `system:notification-outbox`, correlationId: row.id, sourceType: 'notification_outbox', sourceId: row.id, kind: 'WRITE_FAILURE_RATE', outcome: 'SUCCESS', idempotencyKey: `notification:${row.id}:SUCCESS` }).catch(() => undefined);
      result.sent++;
    } catch (err) {
      result.failed++;
      logger.warn('[NotificationOutbox] drain: delivery failed for row (non-fatal)', {
        id: row.id,
        type: row.type,
        error: err instanceof Error ? err.message : String(err),
      });
      await dbRun(
        `UPDATE notification_outbox SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [row.id]
      ).catch(() => undefined);
      void recordOperationalAlertSignal({ organizationId: row.organization_id, actorId: `system:notification-outbox`, correlationId: row.id, sourceType: 'notification_outbox', sourceId: row.id, kind: 'WRITE_FAILURE_RATE', outcome: 'FAILURE', idempotencyKey: `notification:${row.id}:FAILURE` }).catch(() => undefined);
    }
  }

  return result;
}

let drainTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the outbox drain loop. Skipped under test (call `drainOnce()`
 * directly in tests instead). Runs every
 * `NOTIFICATION_OUTBOX_DRAIN_INTERVAL_MS` (default 60_000ms / 60s);
 * `NOTIFICATION_OUTBOX_DRAIN_ENABLED='false'` disables it. Default is ON —
 * this closes the gap where notifications (e.g. SLA escalations) were
 * enqueued into `notification_outbox` but nothing ever drained the table.
 */
export function startNotificationOutboxDrainCron(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (String(process.env.NOTIFICATION_OUTBOX_DRAIN_ENABLED ?? 'true').toLowerCase() === 'false') {
    logger.info(
      '[NotificationOutbox] NOTIFICATION_OUTBOX_DRAIN_ENABLED=false — drain not started.'
    );
    return;
  }
  if (drainTimer) return;

  const intervalMs = Math.max(
    5_000,
    Number(process.env.NOTIFICATION_OUTBOX_DRAIN_INTERVAL_MS) || 60_000
  );
  const tick = () => {
    void drainOnce().catch((err) => {
      logger.warn('[NotificationOutbox] drain tick failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  };
  // First run shortly after boot, then on the configured interval.
  setTimeout(tick, 10_000);
  drainTimer = setInterval(tick, intervalMs);
  logger.info(`[NotificationOutbox] Drain cron started (every ${Math.round(intervalMs / 1000)}s).`);
}

/** Test-only: reset the timer handle so a fresh startNotificationOutboxDrainCron() can be observed. */
export function _resetDrainTimerForTests(): void {
  if (drainTimer) {
    clearInterval(drainTimer);
    drainTimer = null;
  }
}

const NotificationOutboxService = {
  async enqueue(
    userId: string,
    organizationId: string,
    type: string,
    payload: Record<string, unknown>,
    opts: { dedupeKey?: string | null; status?: OutboxStatus } = {}
  ): Promise<{ id: string; success: true }> {
    await ensureTable();

    const seed = `${userId}:${organizationId}:${type}:${opts.dedupeKey || ''}:${Date.now()}:${
      Math.random() * 1e9
    }`;
    const id = `outbox-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;

    await dbRun(
      `INSERT INTO notification_outbox
        (id, user_id, organization_id, type, payload_json, status, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        userId,
        organizationId,
        type,
        JSON.stringify(payload ?? {}),
        opts.status || 'PENDING',
        opts.dedupeKey || null,
      ]
    );

    return { id, success: true };
  },

  drainOnce,
  startNotificationOutboxDrainCron,
};

export default NotificationOutboxService;
