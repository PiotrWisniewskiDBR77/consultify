/** @vitest-environment node */

/**
 * H1 [ODMROZENIE 07_MY_WORK_AGENT DEC-397] — SKRZYNKA-DUPLIKATY, kanał
 * eskalacji wywiadów — dowód na realnej bazie PG (54400).
 *
 * ZNALEZISKO: `InterviewAssignmentService.checkAndEscalate()` re-admits an
 * overdue assignment for escalation once every 24h for as long as it stays
 * unresolved (`WHERE ... escalated_at IS NULL OR escalated_at < now()-24h`).
 * Each admitted cycle used to call `notificationService.send()`
 * unconditionally, INSERTing a brand-new `notifications` row with the same
 * unparametrized title "Interview Assignment Overdue" for the SAME
 * assignment. Left unresolved for weeks, one assignment accumulated one row
 * per escalation cycle — the inbox duplicate heuristic
 * (`InboxContent.tsx` `buildDuplicateIdentityKey`, title-only match) then
 * surfaced a large "Możliwy duplikat (N)" badge.
 *
 * ZABEZPIECZENIE: before inserting, `checkAndEscalate()` now looks for an
 * existing OPEN (unread) `notifications` row for the same
 * (organization_id, user_id, type='interview_escalation',
 * entity_type='interview_assignment', entity_id) and UPDATEs it in place
 * (fresh body + created_at) instead of inserting a second row — one open
 * assignment → one open inbox card, updated in place across escalation
 * cycles.
 *
 * DOWÓD MUTACYJNY: this test seeds ONE assignment already past both the 1h
 * overdue gate and the 24h re-escalation gate, then calls
 * `checkAndEscalate()` TWICE in a row (simulating two escalation cycles for
 * the same still-unresolved assignment, forcing `escalated_at` back before
 * the 24h boundary between calls — exactly what production sees after 24h
 * of real wall-clock time). With the guard in place, `notifications` holds
 * exactly ONE row for this assignment after both calls (the second call
 * updates the first row's body/created_at). Commenting out the guard (using
 * the always-insert code path) makes the count come back as 2 — RED.
 * Verified manually 2026-09-06 (RED with guard removed, GREEN restored).
 *
 * Uruchomienie: RUN_DB_TESTS=1 DB_TYPE=postgres DATABASE_URL=… (baza 54400).
 * Bez tych zmiennych zestaw jest POMIJANY, nie „zielony" — atrapa bazy
 * (`NODE_ENV=test` bez `RUN_DB_TESTS`) odpowiada `changes:1` na każdy zapis
 * niezależnie od WHERE i udowodniłaby dowolną tezę.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The root vitest setup (tests/setup.ts) globally mocks notificationService.js
// with a stub that only exposes sendNotification/createNotification/create
// (no `send`), for unit tests that never touch a real DB. This PG test wants
// the REAL notificationService.send() (the actual insert path exercised by
// production) so the `notifications` row count it asserts on is genuine.
vi.unmock('../notificationService.js');

const enabled = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)(
  'H1 SKRZYNKA-DUPLIKATY — interview_escalation nie dubluje karty w Skrzynce (realny PG)',
  () => {
    const tag = randomUUID().slice(0, 8);
    const org = `org-h1-esc-${tag}`;
    const assignee = randomUUID();
    const manager = randomUUID();
    const assignmentId = randomUUID();

    let pool: Pool;

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

      await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        org,
        `H1 escalation dedup ${tag}`,
      ]);
      await pool.query(
        `INSERT INTO users (id, organization_id, email, first_name, last_name)
         VALUES ($1, $2, $3, 'Jamie', 'Assignee'), ($4, $2, $5, 'Morgan', 'Manager')`,
        [assignee, org, `assignee-${tag}@test.local`, manager, `manager-${tag}@test.local`]
      );

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      await pool.query(
        `INSERT INTO interview_assignments
           (id, organization_id, assignee_user_id, template_id, template_version, status,
            due_at, created_by, escalate_to, escalation_count)
         VALUES ($1, $2, $3, 'tmpl-h1-esc', 1, 'assigned', $4, $5, $5, 0)`,
        [assignmentId, org, assignee, threeDaysAgo, manager]
      );
    });

    afterAll(async () => {
      await pool.query(`DELETE FROM notifications WHERE organization_id = $1`, [org]);
      await pool.query(`DELETE FROM interview_assignments WHERE organization_id = $1`, [org]);
      await pool.query(`DELETE FROM users WHERE organization_id = $1`, [org]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [org]);
      await pool.end();
    });

    it('two escalation cycles for the same unresolved assignment leave exactly one open notification row', async () => {
      process.env.DB_TYPE = 'postgres';
      const { checkAndEscalate } = await import('../InterviewAssignmentService.js');

      const first = await checkAndEscalate();
      expect(first.errors).toBe(0);

      // Simulate 24h of wall-clock time passing without the assignment
      // being resolved: push escalated_at back past the re-escalation gate
      // so the SAME assignment is admitted again on the next cycle — this
      // is exactly what the hourly cron sees a day later in production.
      await pool.query(
        `UPDATE interview_assignments SET escalated_at = $2 WHERE id = $1`,
        [assignmentId, new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()]
      );

      // notificationService.send() also carries its OWN generic idempotency
      // (a 60s dedup slot keyed by real wall-clock time — see
      // DEFAULT_DEDUPE_WINDOW_SECONDS in notificationService.ts). Real
      // production cycles are 24h apart, so that slot is long expired by the
      // second cycle and cannot be what prevents the duplicate — but this
      // test's two cycles run milliseconds apart, so without clearing it the
      // generic dedup would mask whether checkAndEscalate()'s OWN guard (the
      // one under test) is doing anything. Clearing it here reproduces the
      // "slot already expired" state the 24h gap guarantees in production.
      await pool.query(`DELETE FROM notification_dedup WHERE user_id = $1`, [manager]);

      const second = await checkAndEscalate();
      expect(second.errors).toBe(0);

      const rows = (
        await pool.query(
          `SELECT id, body FROM notifications
            WHERE organization_id = $1 AND type = 'interview_escalation'
              AND entity_type = 'interview_assignment' AND entity_id = $2`,
          [org, assignmentId]
        )
      ).rows;

      expect(rows).toHaveLength(1);
      expect(rows[0].body).toMatch(/overdue by \d+ day/);
    });
  }
);
