/**
 * Acceptance E2E — H6.3: notification consistency (duplicate history).
 *
 * REJESTR H6.3: audit every path that INSERTs into `notifications` and close
 * the dedup gaps found (retry / concurrent double-caller). Two real gaps were
 * found and fixed:
 *
 *  1. server/src/services/TaskService.ts `notifyAssignee()` did a raw
 *     `INSERT INTO notifications` with NO idempotency at all. `updateTask()`
 *     reads `existingTask.assigneeId` and only notifies if it "changed" —
 *     but that read-then-write is a TOCTOU race: two concurrent updateTask
 *     calls that both change the assignee (double-click "Save", or a client
 *     retry racing the original request) can both read the SAME stale
 *     assignee before either UPDATE lands, so both conclude "changed" and
 *     both fire a notification. Fixed by routing through the existing
 *     `notificationService.send()` idempotency mechanism (dedupe_key = type +
 *     entity ref, scoped per recipient, 60s window —
 *     NotificationService.claimDedupSlot / notification_dedup table), the
 *     SAME pattern already used by server/src/services/initiative/
 *     initiativeNotificationService.ts. This suite proves it end-to-end
 *     against the real `notifications` table.
 *
 *  2. server/src/routes/webhooks/stripe.routes.ts `tryBeginStripeEvent()`
 *     used SELECT-then-INSERT (not atomic) to gate the whole handler
 *     dispatch (incl. `createNotification`) by Stripe `event.id`. Worse: the
 *     INSERT went through `dbRun()`, which fails OPEN by default (resolves
 *     `{success:false}` instead of rejecting on a DB error) — so a genuine
 *     UNIQUE-constraint race on `event_id` was silently swallowed and the
 *     function still told the caller "new event", double-firing every
 *     handler (including createNotification) for a concurrently-delivered
 *     duplicate. Stripe explicitly documents webhooks can be delivered more
 *     than once. Fixed by checking the INSERT result and treating a
 *     unique-violation as "already claimed" (dedup hit) instead of "new".
 *     This suite proves the fixed function is safe against two truly
 *     concurrent deliveries of the identical `event.id`, using the exact
 *     dispatch pattern the router uses (gate → createNotification →
 *     markProcessed), all real functions from the file, no mocks.
 *
 * Fixture hygiene: every row this suite creates (project, task, notification,
 * notification_dedup, stripe_events) carries id `odbior--h63--...` or the
 * seeded `odbior--` user/org, and is deleted in afterAll. Nothing is written
 * to demo/prod — DATABASE_URL is asserted local by harness.requireLocalDbUrl().
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

requireLocalDbUrl();

// ==========================================================================
// 1) TaskService.notifyAssignee — concurrent double-caller → 1 notification
// ==========================================================================

describe('H6.3-1 · TaskService.updateTask assignee-change race → exactly 1 TASK_ASSIGNED notification', () => {
  const PROJECT_ID = `odbior--h63--project-${randomUUID().slice(0, 8)}`;
  const TASK_ID = `odbior--h63--task-${randomUUID().slice(0, 8)}`;
  // assigneeId must satisfy CreateTaskSchema/UpdateTaskSchema's z.string().uuid()
  // — the seeded harness user id (`odbior--user-0001`) is not UUID-shaped, so
  // this probe needs its own UUID-id user.
  const ASSIGNEE_ID = randomUUID();
  let pool: pg.Pool;
  let TaskServiceCtor: typeof import('../../server/src/services/TaskService.js').TaskService;

  beforeAll(async () => {
    await seed();
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

    const setupClient = await pool.connect();
    try {
      await setupClient.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Odbior', 'H63Assignee')
         ON CONFLICT (id) DO NOTHING`,
        [ASSIGNEE_ID, SEED.ORG_ID, `odbior--h63--assignee-${ASSIGNEE_ID}@acceptance.local`]
      );
      await setupClient.query(
        `INSERT INTO projects (id, organization_id, name, owner_id, status, created_at)
         VALUES ($1, $2, 'Odbior H6.3 probe project', $3, 'active', NOW())
         ON CONFLICT (id) DO NOTHING`,
        [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID]
      );
      await setupClient.query(
        `INSERT INTO tasks (id, project_id, organization_id, title, status, priority, assignee_id, created_by, created_at)
         VALUES ($1, $2, $3, 'Odbior H6.3 probe task', 'todo', 'medium', NULL, $4, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [TASK_ID, PROJECT_ID, SEED.ORG_ID, SEED.USER_ID]
      );
    } finally {
      setupClient.release();
    }

    const mod = await import('../../server/src/services/TaskService.js');
    TaskServiceCtor = mod.TaskService;
  }, 60_000);

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query(
        `DELETE FROM notification_dedup WHERE notification_id IN (
        SELECT id FROM notifications WHERE entity_type = 'task' AND entity_id = $1
      )`,
        [TASK_ID]
      );
      await client.query(`DELETE FROM notifications WHERE entity_type = 'task' AND entity_id = $1`, [
        TASK_ID,
      ]);
      await client.query(`DELETE FROM tasks WHERE id = $1`, [TASK_ID]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
      await client.query(`DELETE FROM users WHERE id = $1`, [ASSIGNEE_ID]);
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('two concurrent updateTask() calls that both change the assignee produce exactly 1 notification row', async () => {
    // DatabaseClient adapter over a real Pool (>1 connection) so the two
    // updateTask() calls below can genuinely interleave at the DB level —
    // a single pg.Client would serialize them and hide the race.
    const db = {
      query: async <T>(sql: string, params?: unknown[]) => {
        const res = await pool.query(sql, params as unknown[]);
        return { rows: res.rows as T[] };
      },
    };
    const taskService = new TaskServiceCtor(db as any);

    // Both calls read the SAME pre-update state (assignee_id NULL) and both
    // decide "assignee changed" — the exact double-caller race notifyAssignee
    // used to be defenseless against.
    const [r1, r2] = await Promise.all([
      taskService.updateTask(TASK_ID, { assigneeId: ASSIGNEE_ID } as any, SEED.USER_ID),
      taskService.updateTask(TASK_ID, { assigneeId: ASSIGNEE_ID } as any, SEED.USER_ID),
    ]);
    expect(r1.assigneeId).toBe(ASSIGNEE_ID);
    expect(r2.assigneeId).toBe(ASSIGNEE_ID);

    // notifyAssignee is fire-and-forget-safe (fail-swallowed) but awaited
    // inline in updateTask, so by the time Promise.all resolves both sends
    // (or the one dedup skip) have already landed.
    const rows = await pool.query(
      `SELECT id, user_id, type FROM notifications WHERE entity_type = 'task' AND entity_id = $1 AND type = 'TASK_ASSIGNED'`,
      [TASK_ID]
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].user_id).toBe(ASSIGNEE_ID);
  }, 30_000);
});

// ==========================================================================
// 2) Stripe webhook tryBeginStripeEvent — concurrent duplicate delivery of
//    the SAME event.id → exactly 1 notification.
// ==========================================================================

describe('H6.3-2 · Stripe webhook concurrent duplicate delivery → exactly 1 notification', () => {
  const EVENT_ID = `odbior--h63--evt-${randomUUID().slice(0, 8)}`;
  // `createNotification` fans out to every ADMIN/SUPERADMIN of the org. The
  // shared seeded harness user's role is whatever an earlier session left it
  // as (observed: 'OWNER', not 'ADMIN' — seed() is `ON CONFLICT DO NOTHING`
  // so it never gets corrected), so this probe seeds its OWN dedicated ADMIN
  // user rather than assume the shared fixture's role.
  const ADMIN_ID = randomUUID();
  let tryBeginStripeEvent: typeof import(
    '../../server/src/routes/webhooks/stripe.routes.js'
  ).tryBeginStripeEvent;
  let markStripeEventProcessed: typeof import(
    '../../server/src/routes/webhooks/stripe.routes.js'
  ).markStripeEventProcessed;
  let createNotification: typeof import(
    '../../server/src/routes/webhooks/stripe.routes.js'
  ).createNotification;

  beforeAll(async () => {
    await seed();
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Odbior', 'H63Admin')
         ON CONFLICT (id) DO NOTHING`,
        [ADMIN_ID, SEED.ORG_ID, `odbior--h63--admin-${ADMIN_ID}@acceptance.local`]
      );
    } finally {
      await client.end();
    }

    const mod = await import('../../server/src/routes/webhooks/stripe.routes.js');
    tryBeginStripeEvent = mod.tryBeginStripeEvent;
    markStripeEventProcessed = mod.markStripeEventProcessed;
    createNotification = mod.createNotification;
  }, 60_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM notifications WHERE type = 'odbior_h63_payment_failed' AND user_id = $1`, [
        ADMIN_ID,
      ]);
      await client.query(`DELETE FROM stripe_events WHERE event_id = $1`, [EVENT_ID]);
      await client.query(`DELETE FROM users WHERE id = $1`, [ADMIN_ID]);
    } finally {
      await client.end();
    }
  });

  it('two truly concurrent deliveries of the same event.id: only one claims the event and only 1 notification is written', async () => {
    const fakeEvent = {
      id: EVENT_ID,
      type: 'invoice.payment_failed',
      data: { object: {} },
    } as any;

    // Mirrors the exact dispatch shape in the router (lines ~184-232):
    // gate on tryBeginStripeEvent, run the handler-equivalent side effect
    // (createNotification — the real, unmodified helper), mark processed.
    const deliver = async () => {
      const isNew = await tryBeginStripeEvent(fakeEvent);
      if (!isNew) return { deduped: true };
      await createNotification(
        SEED.ORG_ID,
        'odbior_h63_payment_failed',
        'Odbior H6.3 Payment Failed Probe',
        'Concurrent-delivery dedup probe.',
        'high'
      );
      await markStripeEventProcessed(fakeEvent, { organizationId: SEED.ORG_ID });
      return { deduped: false };
    };

    const [d1, d2] = await Promise.all([deliver(), deliver()]);
    const deliveries = [d1, d2];
    expect(deliveries.filter((d) => !d.deduped).length).toBe(1);
    expect(deliveries.filter((d) => d.deduped).length).toBe(1);

    const client = pgClient();
    await client.connect();
    try {
      const eventRows = await client.query(
        `SELECT event_id, status FROM stripe_events WHERE event_id = $1`,
        [EVENT_ID]
      );
      expect(eventRows.rows.length).toBe(1);
      expect(eventRows.rows[0].status).toBe('processed');

      const notifRows = await client.query(
        `SELECT id, user_id FROM notifications WHERE type = 'odbior_h63_payment_failed' AND user_id = $1`,
        [ADMIN_ID]
      );
      // Exactly 1 row proves the handler (and thus createNotification) ran
      // exactly once across the two concurrent deliveries, not twice.
      expect(notifRows.rows.length).toBe(1);
    } finally {
      await client.end();
    }
  }, 30_000);
});
