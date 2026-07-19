/**
 * Acceptance E2E — E-OUTBOX-01: `notification_outbox` drain worker.
 *
 * The gap this closes: `notificationOutboxService.ts` had an `enqueue()` that
 * wrote rows to `notification_outbox` (status PENDING, dedupe_key column) but
 * NOTHING ever read/drained that table — confirmed by grep before this task:
 * zero references to `notification_outbox` outside `enqueue()`'s own
 * CREATE/INSERT, and no cron in `server/src/cron/` or `server/src/index.ts`
 * touching it. slaService.ts's ESCALATION/APPROVAL_DUE rows (proven E2E by
 * tests/acceptance/t2-sla-flow.e2e.test.ts, which documents the gap in its own
 * header) were enqueued but silently rotted forever.
 *
 * This suite drives the REAL `drainOnce()` added to notificationOutboxService.ts
 * directly against the LOCAL parity Postgres (no mocks):
 *   1. enqueue() the SAME dedupe_key twice (2 PENDING rows).
 *   2. call the real drainOnce().
 *   3. assert (a) both rows end up SENT (queue drained, 0 PENDING left), and
 *      (b) exactly ONE real notification was delivered for that dedupe_key —
 *      the duplicate is marked SENT via the dedupe path WITHOUT a second
 *      delivery (hard proof: `notifications` table has exactly 1 row for our
 *      marker, not 2).
 *
 * Fixture hygiene: every row carries the `odbior--outboxdrain--` prefix;
 * afterAll deletes notification_outbox + notifications + notification_dedup
 * rows this suite created. Nothing is written to demo/prod — harness asserts
 * DATABASE_URL is local.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

requireLocalDbUrl();

describe('E-OUTBOX-01 · notificationOutboxService.drainOnce — dedupe + queue drain', () => {
  const MARKER = `odbior--outboxdrain--${randomUUID().slice(0, 8)}`;
  const DEDUPE_KEY = `${MARKER}--key`;
  const TYPE = 'ODBIOR_OUTBOX_DRAIN_TEST';

  let NotificationOutboxService: typeof import('../../server/src/services/notificationOutboxService.js')['default'];

  beforeAll(async () => {
    await seed();
    const mod = await import('../../server/src/services/notificationOutboxService.js');
    NotificationOutboxService = mod.default;
  }, 60_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM notification_outbox WHERE dedupe_key = $1`, [DEDUPE_KEY]);
      await client.query(`DELETE FROM notifications WHERE type = $1 AND user_id = $2`, [
        TYPE,
        SEED.USER_ID,
      ]);
      await client.query(`DELETE FROM notification_dedup WHERE type = $1`, [TYPE]).catch(() => {
        // table may not exist on some envs — non-fatal cleanup, same as
        // notificationService.ts's own fail-open dedup contract.
      });
    } finally {
      await client.end();
    }
  });

  it('enqueue() twice with the same dedupe_key -> drainOnce() delivers exactly once and empties the queue', async () => {
    // --- 1) Enqueue the SAME dedupe_key twice.
    const first = await NotificationOutboxService.enqueue(
      SEED.USER_ID,
      SEED.ORG_ID,
      TYPE,
      { message: `${MARKER} first`, marker: MARKER },
      { dedupeKey: DEDUPE_KEY }
    );
    const second = await NotificationOutboxService.enqueue(
      SEED.USER_ID,
      SEED.ORG_ID,
      TYPE,
      { message: `${MARKER} second`, marker: MARKER },
      { dedupeKey: DEDUPE_KEY }
    );
    expect(first.id).not.toBe(second.id);

    const client = pgClient();
    await client.connect();
    try {
      const { rows: pendingBefore } = await client.query(
        `SELECT id, status FROM notification_outbox WHERE dedupe_key = $1 ORDER BY created_at ASC`,
        [DEDUPE_KEY]
      );
      expect(pendingBefore).toHaveLength(2);
      expect(pendingBefore.every((r: { status: string }) => r.status === 'PENDING')).toBe(true);
    } finally {
      await client.end();
    }

    // --- 2) Drain. Real drainOnce(), no mocks — hits the parity Postgres and
    // (best-effort) NotificationService.send().
    const result = await NotificationOutboxService.drainOnce({ limit: 500 });
    expect(result.processed).toBeGreaterThanOrEqual(2);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(result.deduped).toBeGreaterThanOrEqual(1);

    // --- 3a) Hard DB proof: the queue is drained — both our rows are SENT,
    // zero PENDING remain for this dedupe_key.
    const client2 = pgClient();
    await client2.connect();
    try {
      const { rows: afterRows } = await client2.query(
        `SELECT id, status FROM notification_outbox WHERE dedupe_key = $1 ORDER BY created_at ASC`,
        [DEDUPE_KEY]
      );
      expect(afterRows).toHaveLength(2);
      expect(afterRows.every((r: { status: string }) => r.status === 'SENT')).toBe(true);

      const { rows: pendingLeft } = await client2.query(
        `SELECT COUNT(*)::int AS n FROM notification_outbox WHERE dedupe_key = $1 AND status = 'PENDING'`,
        [DEDUPE_KEY]
      );
      expect(pendingLeft[0].n).toBe(0);

      // --- 3b) Hard DB proof: exactly ONE real notification was delivered
      // for our marker, even though TWO rows shared the dedupe_key — the
      // second collapsed into the dedupe path instead of a second send.
      const { rows: notifRows } = await client2.query(
        `SELECT id FROM notifications WHERE type = $1 AND user_id = $2`,
        [TYPE, SEED.USER_ID]
      );
      expect(notifRows).toHaveLength(1);
    } finally {
      await client2.end();
    }

    // --- 4) Re-draining (nothing PENDING left) must be a safe no-op.
    const result2 = await NotificationOutboxService.drainOnce({ limit: 500 });
    const { rows: stillTwo } = await (async () => {
      const c = pgClient();
      await c.connect();
      try {
        return await c.query(
          `SELECT id FROM notification_outbox WHERE dedupe_key = $1 AND status = 'SENT'`,
          [DEDUPE_KEY]
        );
      } finally {
        await c.end();
      }
    })();
    expect(stillTwo).toHaveLength(2); // unchanged — drain didn't touch already-SENT rows
    void result2;
  }, 60_000);
});
