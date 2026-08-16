/**
 * INT-BVP-001 (4) — Interview's notification path degrades gracefully when
 * `notification_preferences` is genuinely absent, proved against a REAL
 * PostgreSQL (table physically dropped, not mocked).
 *
 * The inventory claim under test: Interview calls `notificationService.send()`
 * (InterviewController.ts, e.g. the assignment-submitted notify at ~line
 * 4470) which internally calls `getPreferences(userId)`
 * (notificationService.ts ~908-964). That function already has a real
 * try/catch (~937-947) that returns hardcoded defaults on any query failure —
 * a deliberate, visible fallback, not the repo's "DbPromise swallows errors"
 * anti-pattern. This suite proves it empirically rather than trusting the
 * code comment: it temporarily RENAMES `notification_preferences` away (so
 * the underlying SELECT genuinely fails, not a mocked failure), calls the
 * REAL, unmocked `notificationService.send()` with the same input shape
 * Interview code uses, and asserts (a) no throw / no 500-shaped rejection,
 * (b) a notification id is still returned, (c) the "primary write" this
 * suite performs before calling send() (standing in for the interview
 * answer/state the real call site already persisted beforehand) is provably
 * intact afterwards. The table is restored in a `finally` even if an
 * assertion fails.
 *
 * NOTE — repo-wide global mock: `tests/setup.ts` runs a `vi.mock` for
 * `notificationService` on EVERY test file (a legacy-path specifier that
 * `vitest.config.ts`'s `server/services/*.js -> server/src/services/*.ts`
 * alias resolves to the very module this suite needs), with a fake shape
 * (`sendNotification`/`createNotification`/`create`) that doesn't even
 * include `send`/`getPreferences`. This suite uses `vi.importActual()` to
 * deliberately bypass that global mock and load the REAL module — required
 * because this test's whole point is exercising the real try/catch, not a
 * stand-in for it.
 *
 * NOT exercised here (OUT OF LEASE, reported separately): `updatePreferences`
 * (notificationService.ts ~969-1043) has NO try/catch — a write-side gap. No
 * Interview code calls it today (grep confirms), so it does not manifest as
 * an Interview defect, but it is a real latent gap in a file this task's
 * lease does not permit editing (server/src/services/notificationService.ts).
 */
import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

type RealNotificationService = {
  send: (input: Record<string, unknown>) => Promise<string>;
};

async function loadRealNotificationService(): Promise<RealNotificationService> {
  const mod = await vi.importActual<{ default: RealNotificationService }>(
    '../../../services/notificationService.js'
  );
  return mod.default;
}

describe.skipIf(!REAL_DB)(
  'Interview notification path degrades gracefully without notification_preferences — real PostgreSQL',
  () => {
    let pool: Pool;
    const tag = randomUUID();
    const orgId = `org-notifpref-${tag}`;
    const userId = `user-notifpref-${tag}`;
    const RENAMED_TABLE = `notification_preferences_test_hidden_${tag.replace(/-/g, '_')}`;
    let renamed = false;

    beforeAll(async () => {
      const { Pool: PgPool } = await import('pg');
      pool = new PgPool({ connectionString: CONNECTION_STRING });
      await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'notif fixture')`, [
        orgId,
      ]);
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, 'MEMBER')`,
        [userId, orgId, `${userId}@example.test`]
      );
    }, 60000);

    afterAll(async () => {
      if (!pool) return;
      if (renamed) {
        // Belt and suspenders in case a mid-test failure skipped the finally.
        await pool
          .query(`ALTER TABLE IF EXISTS ${RENAMED_TABLE} RENAME TO notification_preferences`)
          .catch(() => undefined);
      }
      await pool
        .query(`DELETE FROM notifications WHERE user_id = $1`, [userId])
        .catch(() => undefined);
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
      await pool.end();
    });

    it('control: the REAL send() works normally with the table present', async () => {
      const notificationService = await loadRealNotificationService();
      const id = await notificationService.send({
        userId,
        organizationId: orgId,
        type: 'interview_submitted',
        title: 'Interview submitted for review',
        body: 'control case, table present',
        entityType: 'interview_assignment',
        entityId: `assignment-${tag}-control`,
        priority: 'high',
        actorId: userId,
      });
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('HEADLINE: with notification_preferences genuinely dropped, the REAL send() still completes without throwing (no 500-shaped failure)', async () => {
      await pool.query(`ALTER TABLE notification_preferences RENAME TO ${RENAMED_TABLE}`);
      renamed = true;

      try {
        const notificationService = await loadRealNotificationService();

        // Stand-in for "the interview answer/assignment state already
        // persisted by the real call site before it best-effort notifies" —
        // proves the primary write survives this code path regardless of the
        // notification outcome.
        await pool.query(
          `INSERT INTO interview_sessions (id, organization_id, owner_id, status)
           VALUES ($1, $2, $3, 'completed')`,
          [`session-notifpref-${tag}`, orgId, userId]
        );

        let thrown: unknown = null;
        let id: string | null = null;
        try {
          id = await notificationService.send({
            userId,
            organizationId: orgId,
            type: 'interview_submitted',
            title: 'Interview submitted for review',
            body: 'table missing case',
            entityType: 'interview_assignment',
            entityId: `assignment-${tag}-missing`,
            priority: 'high',
            actorId: userId,
          });
        } catch (e) {
          thrown = e;
        }

        expect(
          thrown,
          'notificationService.send() must not throw when preferences are unreadable'
        ).toBeNull();
        expect(typeof id).toBe('string');

        // The stand-in primary write is intact.
        const row = await pool.query(`SELECT status FROM interview_sessions WHERE id = $1`, [
          `session-notifpref-${tag}`,
        ]);
        expect(row.rows[0]?.status).toBe('completed');

        await pool.query(`DELETE FROM interview_sessions WHERE id = $1`, [
          `session-notifpref-${tag}`,
        ]);
      } finally {
        await pool.query(`ALTER TABLE ${RENAMED_TABLE} RENAME TO notification_preferences`);
        renamed = false;
      }
    });

    it('restore control: the REAL send() works again once the table is back', async () => {
      const notificationService = await loadRealNotificationService();
      const id = await notificationService.send({
        userId,
        organizationId: orgId,
        type: 'interview_submitted',
        title: 'Interview submitted for review',
        body: 'post-restore control case',
        entityType: 'interview_assignment',
        entityId: `assignment-${tag}-restored`,
        priority: 'high',
        actorId: userId,
      });
      expect(typeof id).toBe('string');
    });
  }
);
