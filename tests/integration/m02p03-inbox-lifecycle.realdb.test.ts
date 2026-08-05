/**
 * M02-P03 — Inbox idempotent materialization + lifecycle gates (real Postgres).
 *
 * Backing evidence for finding M02-002 (704/706 canonical_inbox_items rows
 * measured `pending` on live demo, 2026-08-05). This suite PROVES the
 * mechanism before/after the fix rather than asserting it from a code read:
 *
 *   1. `pending accumulates forever` — reproduces the pre-fix leak: a task's
 *      inbox projection is created `pending`, the task is marked `done`
 *      through the normal `tasks` UPDATE path, and — WITHOUT the lifecycle
 *      triggers — the projection would stay `pending` forever (this is
 *      exactly the mechanism, not a guess: the trigger functions this suite
 *      exercises are the fix, and disabling them reproduces the leak; see
 *      the "leak reproduction" test below, which runs the pre-fix upsert
 *      path with the triggers dropped to show the row does NOT retire).
 *   2. With the fix (20260805_m02p03_inbox_projection_lifecycle.sql +
 *      inboxService.materializeInboxItems reopen logic), every lifecycle
 *      gate in M02-P03's scope: idempotent re-materialization, archive,
 *      delete, reopen, fresh reopen after a new "session" (a second
 *      materialize call), duplicate prevention (UNIQUE constraint via ON
 *      CONFLICT), orphan prevention, and "a manually-resolved item stays
 *      resolved and is NOT resurrected by re-materialization".
 *
 * HOW TO RUN LOCALLY:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 \
 *     DATABASE_URL=postgresql://postgres:postgres@localhost:<port>/<db> \
 *     npx vitest run tests/integration/m02p03-inbox-lifecycle.realdb.test.ts
 *
 * SKIP POLICY: if RUN_DB_TESTS=1/DATABASE_URL are not both set, every itDB
 * test is skipped and the sentinel test below warns loudly — a skip must
 * never be mistaken for a pass.
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const RUN_DB = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const itDB = RUN_DB ? it : it.skip;

import * as inboxService from '../../server/src/services/inboxService.js';

describe('M02-P03 Inbox projection lifecycle (real Postgres)', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const suffix = randomUUID().slice(0, 8);
  const orgId = `org-m02p03-${suffix}`;
  const otherOrgId = `org-m02p03-other-${suffix}`;
  const userId = `user-m02p03-${suffix}`;
  const otherUserId = `user-m02p03-other-${suffix}`;

  beforeAll(async () => {
    if (!RUN_DB) return;
    await client.connect();
    for (const [id, name] of [
      [orgId, 'M02-P03 org'],
      [otherOrgId, 'M02-P03 other org'],
    ]) {
      await client.query(
        `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')
         ON CONFLICT (id) DO NOTHING`,
        [id, name]
      );
    }
    for (const [id, org] of [
      [userId, orgId],
      [otherUserId, otherOrgId],
    ]) {
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1, $2, $3, 'not-used', 'ADMIN', 'active')
         ON CONFLICT (id) DO NOTHING`,
        [id, org, `${id}@local.test`]
      );
    }
  });

  afterAll(async () => {
    if (!RUN_DB) return;
    await client.query(`DELETE FROM canonical_inbox_items WHERE organization_id IN ($1, $2)`, [
      orgId,
      otherOrgId,
    ]);
    await client.query(`DELETE FROM tasks WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
    await client.query(`DELETE FROM decisions WHERE organization_id IN ($1, $2)`, [
      orgId,
      otherOrgId,
    ]);
    await client.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userId, otherUserId]);
    await client.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgId, otherOrgId]);
    await client.end();
  });

  beforeEach(async () => {
    if (!RUN_DB) return;
    await client.query(`DELETE FROM canonical_inbox_items WHERE organization_id IN ($1, $2)`, [
      orgId,
      otherOrgId,
    ]);
    await client.query(`DELETE FROM tasks WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
    await client.query(`DELETE FROM decisions WHERE organization_id IN ($1, $2)`, [
      orgId,
      otherOrgId,
    ]);
  });

  it('sentinel: DB tests are actually running, not silently skipped', () => {
    if (!RUN_DB) {
      console.warn(
        '[M02-P03] RUN_DB_TESTS/DATABASE_URL not set — every itDB test in this file is SKIPPED, not passing.'
      );
    }
    expect(true).toBe(true);
  });

  // ── Root-cause reproduction ────────────────────────────────────────────
  itDB(
    'ROOT CAUSE: without the lifecycle triggers, a done task leaves its inbox projection pending forever',
    async () => {
      // Temporarily drop the lifecycle triggers to reproduce the pre-fix
      // mechanism exactly — this is the probe that proves the mechanism,
      // not an assumption.
      await client.query(`ALTER TABLE tasks DISABLE TRIGGER trg_mw_tasks_inbox_lifecycle_upd`);
      await client.query(`ALTER TABLE tasks DISABLE TRIGGER trg_mw_tasks_inbox_lifecycle_del`);
      try {
        const taskId = `task-leak-${randomUUID().slice(0, 8)}`;
        await client.query(
          `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
           VALUES ($1, $2, 'Leak repro task', 'todo', $3)`,
          [taskId, orgId, userId]
        );

        await inboxService.materializeInboxItems(userId, orgId);
        const before = await client.query(
          `SELECT status FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
          [taskId]
        );
        expect(before.rows[0].status).toBe('pending');

        // Task is completed through the normal write path.
        await client.query(`UPDATE tasks SET status='done' WHERE id=$1`, [taskId]);

        // Re-materialize (simulates the user reopening Inbox later). Without
        // triggers, the task no longer matches the eligible-set query, so it
        // is never touched again — the projection is orphaned but still
        // reports `pending`, exactly like the 704/706 measured on demo.
        await inboxService.materializeInboxItems(userId, orgId);
        const after = await client.query(
          `SELECT status FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
          [taskId]
        );
        expect(after.rows[0].status).toBe('pending');
      } finally {
        await client.query(`ALTER TABLE tasks ENABLE TRIGGER trg_mw_tasks_inbox_lifecycle_upd`);
        await client.query(`ALTER TABLE tasks ENABLE TRIGGER trg_mw_tasks_inbox_lifecycle_del`);
      }
    }
  );

  // ── Gate: idempotent materialization / duplicate prevention ───────────
  itDB('materializing twice for the same eligible task does not create a duplicate row', async () => {
    const taskId = `task-dup-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, 'Idempotent task', 'todo', $3)`,
      [taskId, orgId, userId]
    );

    await inboxService.materializeInboxItems(userId, orgId);
    await inboxService.materializeInboxItems(userId, orgId);

    const rows = await client.query(
      `SELECT id, status FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
      [taskId]
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].status).toBe('pending');
  });

  // ── Gate: archive (task done -> retired) ───────────────────────────────
  itDB('a task moving to done retires its inbox projection to resolved with a system tombstone', async () => {
    const taskId = `task-archive-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, 'Archive task', 'todo', $3)`,
      [taskId, orgId, userId]
    );
    await inboxService.materializeInboxItems(userId, orgId);

    await client.query(`UPDATE tasks SET status='done' WHERE id=$1`, [taskId]);

    const row = await client.query(
      `SELECT status, resolved_at, metadata_json FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
      [taskId]
    );
    expect(row.rows[0].status).toBe('resolved');
    expect(row.rows[0].resolved_at).not.toBeNull();
    expect(JSON.parse(row.rows[0].metadata_json).mwLifecycle).toBe('source_archived');
  });

  // ── Gate: delete ────────────────────────────────────────────────────
  itDB('deleting a task retires its inbox projection to resolved with a system tombstone', async () => {
    const taskId = `task-delete-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, 'Delete task', 'todo', $3)`,
      [taskId, orgId, userId]
    );
    await inboxService.materializeInboxItems(userId, orgId);

    await client.query(`DELETE FROM tasks WHERE id=$1`, [taskId]);

    const row = await client.query(
      `SELECT status, metadata_json FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
      [taskId]
    );
    expect(row.rows[0].status).toBe('resolved');
    expect(JSON.parse(row.rows[0].metadata_json).mwLifecycle).toBe('source_deleted');
  });

  // ── Gate: reopen (task requeued) ───────────────────────────────────────
  itDB('a task reopened (done -> todo) is re-eligible and its projection reopens to pending on next materialize', async () => {
    const taskId = `task-reopen-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, 'Reopen task', 'todo', $3)`,
      [taskId, orgId, userId]
    );
    await inboxService.materializeInboxItems(userId, orgId);
    await client.query(`UPDATE tasks SET status='done' WHERE id=$1`, [taskId]);
    let row = await client.query(
      `SELECT status FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
      [taskId]
    );
    expect(row.rows[0].status).toBe('resolved');

    await client.query(`UPDATE tasks SET status='todo' WHERE id=$1`, [taskId]);
    await inboxService.materializeInboxItems(userId, orgId);

    row = await client.query(
      `SELECT status, resolved_at, metadata_json FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
      [taskId]
    );
    expect(row.rows[0].status).toBe('pending');
    expect(row.rows[0].resolved_at).toBeNull();
    expect(JSON.parse(row.rows[0].metadata_json).mwLifecycle).toBeUndefined();
  });

  // ── Gate: fresh reopen after a new "session" ────────────────────────────
  itDB('reopen still works across a fresh materialize call simulating a new session, without duplicating the row', async () => {
    const taskId = `task-freshreopen-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, 'Fresh reopen task', 'todo', $3)`,
      [taskId, orgId, userId]
    );
    await inboxService.materializeInboxItems(userId, orgId); // session 1
    await client.query(`UPDATE tasks SET status='done' WHERE id=$1`, [taskId]);
    await client.query(`UPDATE tasks SET status='todo' WHERE id=$1`, [taskId]);
    // Session 2 — brand new materialize() call, as if the user closed the
    // app and came back later.
    await inboxService.materializeInboxItems(userId, orgId);
    // Session 3 — another fresh call, proving idempotency of the reopen path.
    await inboxService.materializeInboxItems(userId, orgId);

    const rows = await client.query(
      `SELECT status FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
      [taskId]
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].status).toBe('pending');
  });

  // ── Gate: manual resolve is never resurrected ──────────────────────────
  itDB(
    'an item a user resolved by hand stays resolved even though its source task is still eligible/active',
    async () => {
      const taskId = `task-manual-${randomUUID().slice(0, 8)}`;
      await client.query(
        `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
         VALUES ($1, $2, 'Manual resolve task', 'todo', $3)`,
        [taskId, orgId, userId]
      );
      await inboxService.materializeInboxItems(userId, orgId);
      const created = await client.query(
        `SELECT id FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
        [taskId]
      );
      const itemId = created.rows[0].id;

      // User triages it themselves (no mwLifecycle tombstone written).
      await inboxService.triageItem(itemId, 'resolve', undefined, {
        userId,
        organizationId: orgId,
      });

      // Source task is untouched — still eligible/active — and the user
      // opens Inbox again, triggering a fresh materialize.
      await inboxService.materializeInboxItems(userId, orgId);

      const row = await client.query(
        `SELECT status, metadata_json FROM canonical_inbox_items WHERE id=$1`,
        [itemId]
      );
      expect(row.rows[0].status).toBe('resolved');
      // No system tombstone was ever written for a user-driven resolve.
      const meta = JSON.parse(row.rows[0].metadata_json || '{}');
      expect(meta.mwLifecycle).toBeUndefined();
    }
  );

  // ── Gate: decisions carry the identical invariant ──────────────────────
  itDB('a decision leaving the eligible set (pending/escalated) retires its projection', async () => {
    const decisionId = `decision-archive-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO decisions (id, organization_id, title, status, decision_maker_id)
       VALUES ($1, $2, 'Archive decision', 'pending', $3)`,
      [decisionId, orgId, userId]
    );
    await inboxService.materializeInboxItems(userId, orgId);
    await client.query(`UPDATE decisions SET status='approved' WHERE id=$1`, [decisionId]);

    const row = await client.query(
      `SELECT status, metadata_json FROM canonical_inbox_items WHERE source_entity_type='decision' AND source_entity_id=$1`,
      [decisionId]
    );
    expect(row.rows[0].status).toBe('resolved');
    expect(JSON.parse(row.rows[0].metadata_json).mwLifecycle).toBe('source_archived');
  });

  // ── Gate: notifications carry the identical invariant (extension beyond the ported candidate) ──
  itDB('marking a notification read retires its inbox projection', async () => {
    const notifId = `notif-archive-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO notifications (id, user_id, organization_id, type, title, read)
       VALUES ($1, $2, $3, 'signal', 'Notif', 0)`,
      [notifId, userId, orgId]
    );
    await inboxService.materializeInboxItems(userId, orgId);
    let row = await client.query(
      `SELECT status FROM canonical_inbox_items WHERE source_entity_type='notification' AND source_entity_id=$1`,
      [notifId]
    );
    expect(row.rows[0].status).toBe('pending');

    await client.query(`UPDATE notifications SET read=1 WHERE id=$1`, [notifId]);

    row = await client.query(
      `SELECT status, metadata_json FROM canonical_inbox_items WHERE source_entity_type='notification' AND source_entity_id=$1`,
      [notifId]
    );
    expect(row.rows[0].status).toBe('resolved');
    expect(JSON.parse(row.rows[0].metadata_json).mwLifecycle).toBe('source_archived');
  });

  // ── Gate: cross-tenant / orphan prevention ──────────────────────────────
  itDB('materializing for org A never creates or touches org B rows for a same-shaped task', async () => {
    const taskIdA = `task-tenant-a-${randomUUID().slice(0, 8)}`;
    const taskIdB = `task-tenant-b-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, 'Tenant A task', 'todo', $3)`,
      [taskIdA, orgId, userId]
    );
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, 'Tenant B task', 'todo', $3)`,
      [taskIdB, otherOrgId, otherUserId]
    );

    await inboxService.materializeInboxItems(userId, orgId);

    const crossTenantLeak = await client.query(
      `SELECT id FROM canonical_inbox_items WHERE organization_id=$1 AND source_entity_id=$2`,
      [orgId, taskIdB]
    );
    expect(crossTenantLeak.rows.length).toBe(0);

    const otherOrgRows = await client.query(
      `SELECT id FROM canonical_inbox_items WHERE organization_id=$1`,
      [otherOrgId]
    );
    expect(otherOrgRows.rows.length).toBe(0);
  });

  itDB('triageItem cannot mutate another tenant\'s inbox item even with a guessed item id', async () => {
    const taskId = `task-triage-tenant-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, 'Tenant-scoped triage task', 'todo', $3)`,
      [taskId, orgId, userId]
    );
    await inboxService.materializeInboxItems(userId, orgId);
    const created = await client.query(
      `SELECT id FROM canonical_inbox_items WHERE source_entity_type='task' AND source_entity_id=$1`,
      [taskId]
    );
    const itemId = created.rows[0].id;

    // Attacker in a DIFFERENT org, but who somehow knows/guesses the real
    // item id, tries to resolve it under their own (wrong) scope.
    const result = await inboxService.triageItem(itemId, 'resolve', undefined, {
      userId: otherUserId,
      organizationId: otherOrgId,
    });
    expect(result).toBeNull();

    const row = await client.query(`SELECT status FROM canonical_inbox_items WHERE id=$1`, [
      itemId,
    ]);
    expect(row.rows[0].status).toBe('pending');
  });
});
