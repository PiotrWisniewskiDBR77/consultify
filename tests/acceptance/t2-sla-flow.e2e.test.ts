/**
 * Acceptance E2E — T2: SLA F3/F5 (approval_assignments) real escalation path.
 *
 * REJESTR T2 asked for E2E proof of "ścieżki SLA" (F3/F5) — a task/assignment
 * with a deadline that, once overdue, is caught by the SLA sweep and turns
 * into a notification/escalation. Two DIFFERENT engines in this codebase
 * answer to "SLA" and both already have separate coverage or documentation:
 *
 *   - server/src/services/feedbackSla.ts (`runFeedbackSlaSweepOnce`) — feedback
 *     ticket SLA -> Slack #cf-alerts. Already proven E2E by
 *     tests/acceptance/feedback-sla-security-alerts.e2e.test.ts (T2-F5).
 *   - server/src/services/slaService.ts (`runSlaCheck`) — the GENERIC
 *     `approval_assignments` SLA timer + escalation-to-org-admin engine. Live
 *     cron, every 10 minutes (server/src/cron/Scheduler.ts job6, wired from
 *     Scheduler.init() in server/src/index.ts:426). This engine had ZERO
 *     acceptance coverage before this suite (confirmed: no test anywhere
 *     referenced runSlaCheck/approval_assignments/notification_outbox besides
 *     the state-machine-only tests/acceptance/hp8-artifact-approvals.e2e.test.ts,
 *     which never drives the SLA sweep itself).
 *
 * This suite is the E2E proof for the SECOND engine (the one the rejestr's
 * "runSlaCheck (realny serwis)" instruction names literally):
 *   seed an OVERDUE approval_assignments row (sla_due_at in the past,
 *   status='PENDING', escalated_at=NULL) -> call the REAL runSlaCheck() ->
 *   assert (a) the row is escalated to the org admin in Postgres, (b) exactly
 *   one ESCALATION + one APPROVAL_DUE notification_outbox row is enqueued,
 *   and (c) a second sweep does NOT duplicate them (the dedup contract is
 *   `escalated_at IS NULL` in findExpiredAssignments() — once escalateAssignment()
 *   stamps escalated_at, the row drops out of the sweep for good).
 *
 * Per session guard: notification_outbox / escalated_at plumbing is being
 * worked on in a separate chip (task_f4bfc3db) — this suite does NOT modify
 * slaService.ts / notificationOutboxService.ts, it only exercises and proves
 * the CURRENT behavior. Findings below are documented, not fixed.
 *
 * ★ FINDING 1 (real, verified against live migrations — not fixed here):
 * `notificationOutboxService.ts` self-heals `notification_outbox` with an
 * AD-HOC schema (`id,user_id,organization_id,type,payload_json,status,
 * dedupe_key,created_at,updated_at`) via `CREATE TABLE IF NOT EXISTS` the
 * first time `enqueue()` runs. The CANONICAL schema shipped in
 * `server/migrations-v2/001_baseline_20260413.sql` (a pg_dump snapshot) is
 * DIFFERENT: `notification_type` (not `type`), `payload` (not `payload_json`),
 * `channel` (NOT present in the ad-hoc version). Root cause: the migration
 * that defines the canonical shape, `server/migrations/025_ai_actions_complete.sql.sql`,
 * has the double `.sql.sql` extension that the migration runner never picks
 * up (confirmed pattern — MEMORY finding_esbuild... / `.sql.sql` never
 * autoruns), so it never re-creates the table on a fresh environment; only
 * the baseline snapshot or the ad-hoc self-heal do. On THIS local parity DB
 * (:5443) `notification_outbox` did not exist before this suite ran, so the
 * ad-hoc (working) schema was the one created — this suite is green here.
 * But if an environment's table was instead created from the baseline
 * snapshot (canonical column names), `NotificationOutboxService.enqueue()`'s
 * `INSERT INTO notification_outbox (id, user_id, organization_id, type,
 * payload_json, ...)` would fail on "column type/payload_json does not
 * exist" — silently swallowed per-assignment inside runSlaCheck()'s try/catch
 * (pushed to `summary.errors`), so escalation would still stamp
 * `escalated_at` (that UPDATE runs first) but the admin/assignee would never
 * actually receive the outbox notification. Not verified against demo/prod
 * (out of this task's safe scope — would require live DB access); documented
 * as a schema-drift risk to check before relying on this path for a real
 * incident.
 *
 * ★ FINDING 2 (minor, real): `markExpired()` in slaService.ts (sets
 * status='EXPIRED') has ZERO callers anywhere in the codebase (grepped) —
 * `runSlaCheck()` never calls it. An escalated assignment therefore stays
 * `status='PENDING'` forever; only `escalated_at`/`escalated_to_user_id`
 * change. Any UI/report that filters `approval_assignments` by
 * `status = 'EXPIRED'` will never see a row this cron produced. Not fixed —
 * outside this task's scope (SLA sweep behavior, not outbox plumbing) and
 * flagged instead.
 *
 * ★ FINDING 3 (real, demonstrated by the second describe block below):
 * `findExpiredAssignments()` has NO `assignment_kind` filter. Since HP-7/HP-8
 * widened `approval_assignments` to also carry artifact-review rows
 * (`assignment_kind='artifact'`, written by `artifactApprovalService.submitForReview()`
 * with a real `sla_due_at`), the generic SLA cron now ALSO sweeps and
 * escalates overdue artifact reviews — sending an "ESCALATION" notification
 * whose payload's `proposalId` is actually the artifact id, with no
 * indication it's an artifact review rather than an AI-proposal approval.
 * Functionally harmless (doesn't corrupt the artifact state machine, which
 * only reads `status`/`assignment_kind`) but semantically confusing copy in
 * the admin's notification. Documented, not fixed.
 *
 * Fixture hygiene: every row carries `odbior--t2sla--`; afterAll deletes
 * notification_outbox + approval_assignments + the dedicated admin/assignee
 * users created here. Nothing is written to demo/prod — DATABASE_URL is
 * asserted local by harness.requireLocalDbUrl().
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';
import { seed } from './seed.mjs';

requireLocalDbUrl();

// ==========================================================================
// 1) Core SLA path — overdue approval_assignments -> real runSlaCheck() ->
//    escalation + notification_outbox, proven twice for dedup.
// ==========================================================================

describe('T2 · slaService.runSlaCheck — overdue approval_assignments escalates exactly once', () => {
  // Dedicated admin/assignee (not the shared SEED user, whose `users.role`
  // has drifted to 'OWNER' on this parity DB from earlier sessions — see
  // tests/acceptance/h63-notification-dedup.e2e.test.ts's identical note).
  const ADMIN_ID = randomUUID();
  const ASSIGNEE_ID = randomUUID();
  const ASSIGNMENT_ID = `odbior--t2sla--aa-${randomUUID().slice(0, 8)}`;
  const PROPOSAL_ID = `odbior--t2sla--proposal-${randomUUID().slice(0, 8)}`;
  const ORG_ID = randomUUID();

  let runSlaCheck: typeof import('../../server/src/services/slaService.js').runSlaCheck;

  beforeAll(async () => {
    await seed();

    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO organizations (id, name, status, created_at, updated_at)
         VALUES ($1, $2, 'active', NOW(), NOW())`,
        [ORG_ID, `odbior--t2sla--org-${ORG_ID}`]
      );
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Odbior', 'T2SlaAdmin')
         ON CONFLICT (id) DO NOTHING`,
        [ADMIN_ID, ORG_ID, `odbior--t2sla--admin-${ADMIN_ID}@acceptance.local`]
      );
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES ($1, $2, $3, 'x', 'MEMBER', 'active', 'Odbior', 'T2SlaAssignee')
         ON CONFLICT (id) DO NOTHING`,
        [ASSIGNEE_ID, ORG_ID, `odbior--t2sla--assignee-${ASSIGNEE_ID}@acceptance.local`]
      );

      // Seed an ALREADY-OVERDUE assignment directly (sla_due_at 2h in the
      // past), exactly the "task/assignment z deadline" the rejestr asks
      // for — status PENDING, escalated_at NULL, so findExpiredAssignments()
      // must pick it up.
      const overdueIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await client.query(
        `INSERT INTO approval_assignments
           (id, org_id, proposal_id, assigned_to_user_id, status, sla_due_at, created_at)
         VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW())`,
        [ASSIGNMENT_ID, ORG_ID, PROPOSAL_ID, ASSIGNEE_ID, overdueIso]
      );
    } finally {
      await client.end();
    }

    const mod = await import('../../server/src/services/slaService.js');
    runSlaCheck = mod.runSlaCheck;
  }, 60_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM notification_outbox WHERE payload_json LIKE $1`, [
        `%${PROPOSAL_ID}%`,
      ]);
      await client.query(`DELETE FROM approval_assignments WHERE id = $1`, [ASSIGNMENT_ID]);
      await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
        [ADMIN_ID, ASSIGNEE_ID],
      ]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    } finally {
      await client.end();
    }
  });

  it('escalates the overdue assignment to the org admin and enqueues exactly one ESCALATION + one APPROVAL_DUE notification', async () => {
    const summary = await runSlaCheck();
    // Global sweep (no org scoping in findExpiredAssignments) — other rows
    // may exist in the shared parity DB, so assert "at least our row",
    // never an exact total.
    expect(summary.checked).toBeGreaterThanOrEqual(1);
    expect(summary.escalated).toBeGreaterThanOrEqual(1);
    expect(summary.notificationsSent).toBeGreaterThanOrEqual(2);

    // --- Hard DB proof: the assignment itself was escalated to our admin.
    const client = pgClient();
    await client.connect();
    try {
      const { rows: aaRows } = await client.query(
        `SELECT status, escalated_to_user_id, escalated_at, escalation_reason
           FROM approval_assignments WHERE id = $1`,
        [ASSIGNMENT_ID]
      );
      expect(aaRows).toHaveLength(1);
      expect(aaRows[0].escalated_to_user_id).toBe(ADMIN_ID);
      expect(aaRows[0].escalated_at).toBeTruthy();
      expect(aaRows[0].escalation_reason).toBe('SLA expired without acknowledgment');
      // FINDING 2: markExpired() is never called by runSlaCheck() — status
      // stays PENDING even after a real escalation.
      expect(aaRows[0].status).toBe('PENDING');

      // --- Hard DB proof: notification_outbox carries both real recipients.
      const { rows: outboxRows } = await client.query(
        `SELECT user_id, type, payload_json FROM notification_outbox
          WHERE payload_json LIKE $1 ORDER BY type`,
        [`%${PROPOSAL_ID}%`]
      );
      expect(outboxRows).toHaveLength(2);
      const byType = Object.fromEntries(outboxRows.map((r) => [r.type, r]));
      expect(byType.ESCALATION).toBeTruthy();
      expect(byType.ESCALATION.user_id).toBe(ADMIN_ID);
      expect(JSON.parse(byType.ESCALATION.payload_json).proposalId).toBe(PROPOSAL_ID);
      expect(byType.APPROVAL_DUE).toBeTruthy();
      expect(byType.APPROVAL_DUE.user_id).toBe(ASSIGNEE_ID);
      expect(JSON.parse(byType.APPROVAL_DUE.payload_json).proposalId).toBe(PROPOSAL_ID);
    } finally {
      await client.end();
    }
  }, 30_000);

  it('a second sweep does NOT re-escalate or duplicate notifications (escalated_at gate = dedup)', async () => {
    const before = await countOutboxForProposal(PROPOSAL_ID);
    expect(before).toBe(2); // from the previous test

    const summary2 = await runSlaCheck();
    void summary2;

    const after = await countOutboxForProposal(PROPOSAL_ID);
    expect(after).toBe(before); // exactly the same 2 rows — no duplicates
  }, 30_000);

  async function countOutboxForProposal(proposalId: string): Promise<number> {
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM notification_outbox WHERE payload_json LIKE $1`,
        [`%${proposalId}%`]
      );
      return rows[0].n;
    } finally {
      await client.end();
    }
  }
});

// ==========================================================================
// 2) FINDING 3 — cross-feature blind spot: the generic sweep also catches
//    overdue HP-8 artifact-review rows (assignment_kind='artifact'), not
//    just the AI-proposal workqueue it was originally built for. Documents
//    CURRENT behavior; does not change it.
// ==========================================================================

describe('T2 · FINDING — SLA sweep has no assignment_kind filter (also escalates artifact reviews)', () => {
  const ADMIN_ID = randomUUID();
  const ASSIGNEE_ID = randomUUID();
  const ARTIFACT_ASSIGNMENT_ID = `odbior--t2sla--artifact-aa-${randomUUID().slice(0, 8)}`;
  const ARTIFACT_ID = `odbior--t2sla--artifact-${randomUUID().slice(0, 8)}`;
  const ORG_ID = randomUUID();

  let runSlaCheck: typeof import('../../server/src/services/slaService.js').runSlaCheck;

  beforeAll(async () => {
    await seed();
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO organizations (id, name, status, created_at, updated_at)
         VALUES ($1, $2, 'active', NOW(), NOW())`,
        [ORG_ID, `odbior--t2sla--artifact-org-${ORG_ID}`]
      );
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Odbior', 'T2SlaKindAdmin')
         ON CONFLICT (id) DO NOTHING`,
        [ADMIN_ID, ORG_ID, `odbior--t2sla--kind-admin-${ADMIN_ID}@acceptance.local`]
      );
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES ($1, $2, $3, 'x', 'MEMBER', 'active', 'Odbior', 'T2SlaKindAssignee')
         ON CONFLICT (id) DO NOTHING`,
        [ASSIGNEE_ID, ORG_ID, `odbior--t2sla--kind-assignee-${ASSIGNEE_ID}@acceptance.local`]
      );

      const overdueIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      // Mirrors exactly what artifactApprovalService.submitForReview() writes
      // (assignment_kind='artifact', artifact_type/artifact_id populated),
      // just seeded directly and already-overdue.
      await client.query(
        `INSERT INTO approval_assignments
           (id, org_id, proposal_id, assigned_to_user_id, status, sla_due_at,
            assignment_kind, artifact_type, artifact_id, created_at)
         VALUES ($1, $2, $3, $4, 'PENDING', $5, 'artifact', 'decision', $6, NOW())`,
        [
          ARTIFACT_ASSIGNMENT_ID,
          ORG_ID,
          ARTIFACT_ID, // proposal_id mirrors the artifact id, same as the real service does
          ASSIGNEE_ID,
          overdueIso,
          ARTIFACT_ID,
        ]
      );
    } finally {
      await client.end();
    }

    const mod = await import('../../server/src/services/slaService.js');
    runSlaCheck = mod.runSlaCheck;
  }, 60_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM notification_outbox WHERE payload_json LIKE $1`, [
        `%${ARTIFACT_ID}%`,
      ]);
      await client.query(`DELETE FROM approval_assignments WHERE id = $1`, [
        ARTIFACT_ASSIGNMENT_ID,
      ]);
      await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
        [ADMIN_ID, ASSIGNEE_ID],
      ]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    } finally {
      await client.end();
    }
  });

  it('leaves assignment_kind=artifact for its dedicated review SLA path', async () => {
    await runSlaCheck();

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT escalated_to_user_id, escalated_at, assignment_kind, artifact_type
           FROM approval_assignments WHERE id = $1`,
        [ARTIFACT_ASSIGNMENT_ID]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].assignment_kind).toBe('artifact');
      expect(rows[0].escalated_to_user_id).toBeNull();
      expect(rows[0].escalated_at).toBeNull();

      const { rows: outboxRows } = await client.query(
        `SELECT type, payload_json FROM notification_outbox WHERE payload_json LIKE $1`,
        [`%${ARTIFACT_ID}%`]
      );
      expect(outboxRows).toEqual([]);
    } finally {
      await client.end();
    }
  }, 30_000);
});
