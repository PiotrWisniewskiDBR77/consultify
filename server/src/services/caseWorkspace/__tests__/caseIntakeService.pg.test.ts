/**
 * Case Workspace — CASE INTAKE service, proved against a REAL PostgreSQL
 * (Stream B / E8: Chat + Teresa -> Case).
 *
 * Exercises server/src/services/caseWorkspace/caseIntakeService.ts against
 * `case_core` (20260809_case_workspace_case_core.sql) and
 * `case_workspace_event_outbox` (20260810_case_workspace_event_outbox.sql).
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * `NODE_ENV=test` ALONE is a trap: `Database.ts`'s `getDatabase()` hands back
 * an in-memory MOCK unless `RUN_DB_TESTS === '1'` AND `MOCK_DB === 'false'`,
 * and every write silently becomes a no-op — a suite about "exactly one row
 * exists" would pass while touching nothing, which is the single most
 * dangerous false green available in this repo. Same gate as every sibling
 * `*.pg.test.ts` here: probe reachability AND schema presence, then SKIP
 * LOUDLY rather than pass quietly.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://…/case_workspace_test \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/caseIntakeService.pg.test.ts \
 *     --environment node
 *
 * ===========================================================================
 * WHAT MAKES THESE ASSERTIONS WORTH ANYTHING
 * ===========================================================================
 * Every "how many rows exist" claim is read back OUT OF BAND through a
 * separate `pg.Pool` (`control`), never from the service's return value and
 * never on the service's own connection. A service return value only proves
 * what the service BELIEVES it wrote; a row read inside the service's own
 * transaction would still be visible even if that transaction later rolled
 * back. Only a committed row, seen from another connection, proves anything.
 *
 * Every test owns its own organization/project/users and tears them down in a
 * `finally` — never a shared `beforeEach`. `case_core.project_id` is UNIQUE,
 * so a shared fixture would let the concurrency test poison every test after
 * it. Ids are namespaced with `randomUUID()`, so this file is safe to run
 * concurrently with itself and with the other pg suites.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as intake from '../caseIntakeService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const caseCore = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_core'
          AND column_name IN ('case_id', 'project_id', 'organization_id', 'version')`
    );
    const outbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'event_type', 'aggregate_type', 'aggregate_id',
                               'case_id', 'causation_id', 'redacted_summary')`
    );
    const members = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    // The UNIQUE (project_id) constraint is not decoration here — it IS the
    // "exactly one Case" mechanism the concurrency test proves. If it were
    // ever dropped, these tests must skip loudly rather than pass against a
    // schema that cannot hold the invariant.
    const unique = await probe.query(
      `SELECT count(*)::int AS present FROM pg_constraint
        WHERE conrelid = 'case_core'::regclass AND contype = 'u'
          AND pg_get_constraintdef(oid) = 'UNIQUE (project_id)'`
    );
    return (
      Number(caseCore.rows[0]?.present ?? 0) === 4 &&
      Number(outbox.rows[0]?.present ?? 0) === 7 &&
      Number(members.rows[0]?.present ?? 0) === 4 &&
      Number(unique.rows[0]?.present ?? 0) === 1
    );
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[caseIntakeService pg suite SKIPPED — clean skip, NOT a pass] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, the case_core + ` +
      `event_outbox migrations applied, and case_core's UNIQUE (project_id) constraint present. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface OutboxDbRow {
  event_id: string;
  event_type: string;
  organization_id: string;
  project_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number | null;
  case_id: string | null;
  actor_user_id: string;
  causation_id: string | null;
  redacted_summary: Record<string, unknown>;
}

suite('caseIntakeService — conversation -> exactly one Case, on a real PostgreSQL (E8)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixtures — called by each test itself, never by a shared hook.
  // -------------------------------------------------------------------------

  async function seedOrgAndProject(label: string): Promise<{ orgId: string; projectId: string }> {
    const suffix = randomUUID();
    const orgId = `intake-org-${label}-${suffix}`;
    const projectId = `intake-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Intake test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Intake test project (${label})`]
    );
    return { orgId, projectId };
  }

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = `intake-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`intake-member-${randomUUID()}`, orgId, userId]
    );
    return userId;
  }

  async function teardown(orgIds: string[], projectIds: string[], userIds: string[]): Promise<void> {
    for (const projectId of projectIds) {
      await control.query(`DELETE FROM case_core WHERE project_id = $1`, [projectId]).catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of userIds) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of orgIds) {
      // The outbox has zero foreign keys by design, so nothing cascades it
      // away — each test deletes its own org's events explicitly.
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  /** A realistic, ordered work order. Content is deliberately Polish — this is
   * what a consultant actually confirms — and contains no email/token shapes
   * that PiiRedactor would rewrite inside the stored summary. */
  function draft(orgId: string, projectId: string): intake.WorkOrderDraftInput {
    return {
      organizationId: orgId,
      projectId,
      goal: 'Przygotowac rekomendacje optymalizacji kosztow zakupu energii dla zakladu w Plocku.',
      scope: [
        'Zebrac dane o zuzyciu energii z ostatnich 24 miesiecy.',
        'Porownac trzy warianty kontraktu.',
        'Wskazac wariant rekomendowany wraz z ryzykami.',
      ],
      expectedOutcome: 'Dokument rekomendacji z trzema wariantami i jednym wskazaniem.',
      constraints: ['Bez zmiany dostawcy przed koncem roku.'],
      successCriteria: ['Zarzad akceptuje rekomendacje na posiedzeniu.'],
      contractedClosureType: 'DECISION_COMPLETED',
      sourceConversationId: 'conv-intake-test',
    };
  }

  // -------------------------------------------------------------------------
  // Out-of-band readers.
  // -------------------------------------------------------------------------

  async function countCasesForProject(projectId: string): Promise<number> {
    const r = await control.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM case_core WHERE project_id = $1`,
      [projectId]
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async function countCasesForOrg(orgId: string): Promise<number> {
    const r = await control.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM case_core WHERE organization_id = $1`,
      [orgId]
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async function readOutboxForOrg(orgId: string): Promise<OutboxDbRow[]> {
    const r = await control.query<OutboxDbRow>(
      `SELECT event_id, event_type, organization_id, project_id, aggregate_type, aggregate_id,
              aggregate_version, case_id, actor_user_id, causation_id, redacted_summary
         FROM case_workspace_event_outbox
        WHERE organization_id = $1
        ORDER BY created_at ASC`,
      [orgId]
    );
    return r.rows;
  }

  /**
   * The LIGHT-policy assertion, read from the two tables a Run would actually
   * land in. Fails loudly (rather than skipping) if either table is missing —
   * "the table wasn't there" must never read as "no Run was created".
   */
  async function countRunsForOrg(orgId: string): Promise<number> {
    const present = await control.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('case_workspace_run_bindings', 'v8_execution_runs')`
    );
    expect(Number(present.rows[0]?.n ?? 0)).toBe(2);

    const bindings = await control.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM case_workspace_run_bindings WHERE organization_id = $1`,
      [orgId]
    );
    const runs = await control.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM v8_execution_runs WHERE organization_id = $1`,
      [orgId]
    );
    return Number(bindings.rows[0]?.n ?? 0) + Number(runs.rows[0]?.n ?? 0);
  }

  // -------------------------------------------------------------------------
  // 1. CW-CANON-01 — informational chat creates ZERO Cases and ZERO Runs.
  // -------------------------------------------------------------------------
  it('proposeWorkOrder alone creates ZERO case_core rows and ZERO Runs; it records only that the order was SHOWN (CW-CANON-01)', async () => {
    const { orgId, projectId } = await seedOrgAndProject('canon01');
    const actorId = await seedMemberedUser(orgId, 'canon01');
    try {
      const proposal = await intake.proposeWorkOrder({
        workOrder: draft(orgId, projectId),
        proposedByActorId: actorId,
      });

      expect(proposal.workOrderDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(proposal.caseCreated).toBe(false);
      expect(proposal.runCreated).toBe(false);
      expect(proposal.alreadyProposed).toBe(false);

      // The claim that matters, read out of band.
      expect(await countCasesForProject(projectId)).toBe(0);
      expect(await countCasesForOrg(orgId)).toBe(0);
      expect(await countRunsForOrg(orgId)).toBe(0);

      const events = await readOutboxForOrg(orgId);
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('case.intake.work_order_proposed');
      expect(events[0].aggregate_type).toBe('CASE_INTAKE');
      expect(events[0].aggregate_id).toBe(proposal.workOrderId);
      // NULL case_id is the machine-readable form of "no Case was created".
      expect(events[0].case_id).toBeNull();
      expect(events[0].redacted_summary.workOrderDigest).toBe(proposal.workOrderDigest);

      // Re-proposing the identical order is idempotent, not a second proposal.
      const again = await intake.proposeWorkOrder({
        workOrder: draft(orgId, projectId),
        proposedByActorId: actorId,
      });
      expect(again.workOrderDigest).toBe(proposal.workOrderDigest);
      expect(again.alreadyProposed).toBe(true);
      expect(await readOutboxForOrg(orgId)).toHaveLength(1);
      expect(await countCasesForProject(projectId)).toBe(0);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 2. CW-CANON-03 — confirmation with the exact digest creates exactly one Case.
  // -------------------------------------------------------------------------
  it('confirmWorkOrder with the exact digest creates exactly ONE case_core row, ZERO Runs, and a proposal -> case.created -> confirmed causation chain', async () => {
    const { orgId, projectId } = await seedOrgAndProject('confirm-ok');
    const actorId = await seedMemberedUser(orgId, 'confirm-ok');
    try {
      const proposal = await intake.proposeWorkOrder({
        workOrder: draft(orgId, projectId),
        proposedByActorId: actorId,
      });

      const confirmed = await intake.confirmWorkOrder({
        workOrder: draft(orgId, projectId),
        confirmedDigest: proposal.workOrderDigest,
        confirmedByActorId: actorId,
      });

      expect(confirmed.caseCreated).toBe(true);
      expect(confirmed.reused).toBe(false);
      expect(confirmed.reuseReason).toBe('none');
      expect(confirmed.runCreated).toBe(false);
      expect(confirmed.workOrderDigest).toBe(proposal.workOrderDigest);

      const rows = await control.query<{
        case_id: string;
        organization_id: string;
        case_status: string;
        case_profile: string;
        governance_tier: string;
        autonomy_policy: string;
        contracted_closure_type: string;
        created_by_actor_id: string;
        version: number;
      }>(`SELECT * FROM case_core WHERE project_id = $1`, [projectId]);
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].case_id).toBe(confirmed.caseId);
      expect(rows.rows[0].organization_id).toBe(orgId);
      expect(rows.rows[0].case_status).toBe('DRAFT');
      expect(rows.rows[0].case_profile).toBe('LIGHT');
      expect(rows.rows[0].governance_tier).toBe('LIGHTWEIGHT');
      expect(rows.rows[0].autonomy_policy).toBe('ASK_MATERIAL_ACTIONS');
      expect(rows.rows[0].contracted_closure_type).toBe('DECISION_COMPLETED');
      expect(rows.rows[0].created_by_actor_id).toBe(actorId);
      expect(Number(rows.rows[0].version)).toBe(1);

      // LIGHT policy: still zero Runs after a confirmation.
      expect(await countRunsForOrg(orgId)).toBe(0);

      const events = await readOutboxForOrg(orgId);
      expect(events.map((e) => e.event_type)).toEqual([
        'case.intake.work_order_proposed',
        'case.created',
        'case.intake.work_order_confirmed',
      ]);
      const [proposed, created, confirmedEvent] = events;

      // The events committed in the SAME transaction as the row: no Case
      // without its events, no events without the Case.
      expect(created.case_id).toBe(confirmed.caseId);
      expect(confirmedEvent.case_id).toBe(confirmed.caseId);
      expect(created.aggregate_version).toBe(1);

      // §10 correlation chain: proposal -> case.created -> confirmation.
      expect(created.causation_id).toBe(proposed.event_id);
      expect(confirmedEvent.causation_id).toBe(created.event_id);
      expect(confirmedEvent.redacted_summary.workOrderDigest).toBe(proposal.workOrderDigest);
      expect(confirmedEvent.redacted_summary.confirmedByActorId).toBe(actorId);
      expect(confirmedEvent.redacted_summary.runCreated).toBe(false);
      // The human-readable facts survive redaction (no PII-shaped keys).
      expect(String(confirmedEvent.redacted_summary.goal)).toContain('Plocku');
      expect(confirmedEvent.redacted_summary.scope).toHaveLength(3);

      // Read-back through the gated public reader.
      const readBack = await intake.getConfirmedWorkOrders(confirmed.caseId, actorId);
      expect(readBack).toHaveLength(1);
      expect(readBack[0].workOrderDigest).toBe(proposal.workOrderDigest);
      expect(readBack[0].confirmedByActorId).toBe(actorId);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 3. Digest mismatch — the security refusal. ZERO Cases.
  // -------------------------------------------------------------------------
  it('confirmWorkOrder REFUSES when the confirmed digest is not the digest of the submitted work order, and leaves ZERO Cases (the human authorized something else)', async () => {
    const { orgId, projectId } = await seedOrgAndProject('mismatch');
    const actorId = await seedMemberedUser(orgId, 'mismatch');
    try {
      const shown = draft(orgId, projectId);
      const proposal = await intake.proposeWorkOrder({
        workOrder: shown,
        proposedByActorId: actorId,
      });

      // The realistic attack/drift: the order moved on between "shown" and
      // "confirmed" — one extra scope line — while the human's confirmation
      // still carries the digest of what they actually read.
      const drifted: intake.WorkOrderDraftInput = {
        ...shown,
        scope: [...shown.scope, 'Przygotowac takze wniosek o dotacje.'],
      };

      await expect(
        intake.confirmWorkOrder({
          workOrder: drifted,
          confirmedDigest: proposal.workOrderDigest,
          confirmedByActorId: actorId,
        })
      ).rejects.toThrow(/intake_work_order_digest_mismatch/);

      expect(await countCasesForProject(projectId)).toBe(0);
      expect(await countCasesForOrg(orgId)).toBe(0);
      expect(await countRunsForOrg(orgId)).toBe(0);

      // Reordering the scope list is ALSO a different work order: order is
      // part of what the human read.
      const reordered: intake.WorkOrderDraftInput = {
        ...shown,
        scope: [shown.scope[1], shown.scope[0], shown.scope[2]],
      };
      await expect(
        intake.confirmWorkOrder({
          workOrder: reordered,
          confirmedDigest: proposal.workOrderDigest,
          confirmedByActorId: actorId,
        })
      ).rejects.toThrow(/intake_work_order_digest_mismatch/);
      expect(await countCasesForProject(projectId)).toBe(0);

      // A self-consistent (order, digest) pair that was never SHOWN is also
      // refused — recomputation alone would have let this through.
      const neverShown: intake.WorkOrderDraftInput = { ...shown, goal: 'Cos zupelnie innego.' };
      const neverShownDigest = intake.computeWorkOrderDigest(intake.normalizeWorkOrder(neverShown));
      await expect(
        intake.confirmWorkOrder({
          workOrder: neverShown,
          confirmedDigest: neverShownDigest,
          confirmedByActorId: actorId,
        })
      ).rejects.toThrow(/intake_work_order_not_proposed/);
      expect(await countCasesForProject(projectId)).toBe(0);

      // Only the proposal event exists — no confirmation was ever recorded.
      const events = await readOutboxForOrg(orgId);
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('case.intake.work_order_proposed');
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 4. Concurrency — two simultaneous confirmations of one digest.
  // -------------------------------------------------------------------------
  it('two CONCURRENT confirmWorkOrder calls for the same digest produce EXACTLY ONE case_core row, one case.created and one confirmation event', async () => {
    const { orgId, projectId } = await seedOrgAndProject('race');
    const actorId = await seedMemberedUser(orgId, 'race');
    try {
      const proposal = await intake.proposeWorkOrder({
        workOrder: draft(orgId, projectId),
        proposedByActorId: actorId,
      });

      // withPgTransaction opens a NEW physical connection per transaction, so
      // these two really do race inside Postgres — this is not two awaits
      // pretending to be concurrent.
      const [a, b] = await Promise.all([
        intake.confirmWorkOrder({
          workOrder: draft(orgId, projectId),
          confirmedDigest: proposal.workOrderDigest,
          confirmedByActorId: actorId,
        }),
        intake.confirmWorkOrder({
          workOrder: draft(orgId, projectId),
          confirmedDigest: proposal.workOrderDigest,
          confirmedByActorId: actorId,
        }),
      ]);

      expect(a.caseId).toBe(b.caseId);
      // Exactly one of the two created it; the other reused it.
      expect([a.caseCreated, b.caseCreated].filter(Boolean)).toHaveLength(1);
      const loser = a.caseCreated ? b : a;
      expect(loser.reused).toBe(true);
      expect(loser.reuseReason).toBe('work_order_already_confirmed');
      expect(loser.confirmedEventDeduplicated).toBe(true);

      expect(await countCasesForProject(projectId)).toBe(1);
      expect(await countCasesForOrg(orgId)).toBe(1);
      expect(await countRunsForOrg(orgId)).toBe(0);

      const events = await readOutboxForOrg(orgId);
      expect(events.filter((e) => e.event_type === 'case.created')).toHaveLength(1);
      expect(
        events.filter((e) => e.event_type === 'case.intake.work_order_confirmed')
      ).toHaveLength(1);

      // A third, sequential confirmation is equally idempotent.
      const third = await intake.confirmWorkOrder({
        workOrder: draft(orgId, projectId),
        confirmedDigest: proposal.workOrderDigest,
        confirmedByActorId: actorId,
      });
      expect(third.caseId).toBe(a.caseId);
      expect(third.caseCreated).toBe(false);
      expect(third.reuseReason).toBe('work_order_already_confirmed');
      expect(await countCasesForProject(projectId)).toBe(1);
      expect(
        (await readOutboxForOrg(orgId)).filter(
          (e) => e.event_type === 'case.intake.work_order_confirmed'
        )
      ).toHaveLength(1);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 120_000);

  // -------------------------------------------------------------------------
  // 5. Cross-tenant — fail closed, disclose nothing.
  // -------------------------------------------------------------------------
  it('an actor outside the organization is refused by BOTH entry points, creates ZERO Cases, and cannot tell an existing foreign project from one that does not exist', async () => {
    const victim = await seedOrgAndProject('victim');
    const attackerOrg = await seedOrgAndProject('attacker');
    const victimActor = await seedMemberedUser(victim.orgId, 'victim');
    const attacker = await seedMemberedUser(attackerOrg.orgId, 'attacker');
    try {
      // The victim's own work order really exists and really was proposed.
      const proposal = await intake.proposeWorkOrder({
        workOrder: draft(victim.orgId, victim.projectId),
        proposedByActorId: victimActor,
      });

      // (a) Attacker names the victim's org directly — no membership there.
      await expect(
        intake.proposeWorkOrder({
          workOrder: draft(victim.orgId, victim.projectId),
          proposedByActorId: attacker,
        })
      ).rejects.toThrow(/not an active member/i);

      await expect(
        intake.confirmWorkOrder({
          workOrder: draft(victim.orgId, victim.projectId),
          confirmedDigest: proposal.workOrderDigest,
          confirmedByActorId: attacker,
        })
      ).rejects.toThrow(/not an active member/i);

      // (b) Attacker stays inside their OWN org but points at the victim's
      // project id. The refusal must be the SAME as for an id that does not
      // exist at all — otherwise the error is an existence oracle (SEC-009).
      const foreignProject = await captureError(() =>
        intake.proposeWorkOrder({
          workOrder: draft(attackerOrg.orgId, victim.projectId),
          proposedByActorId: attacker,
        })
      );
      const nonExistentProject = await captureError(() =>
        intake.proposeWorkOrder({
          workOrder: draft(attackerOrg.orgId, `intake-project-does-not-exist-${randomUUID()}`),
          proposedByActorId: attacker,
        })
      );
      expect(foreignProject).toBe('intake_project_not_found');
      expect(nonExistentProject).toBe('intake_project_not_found');
      expect(foreignProject).toBe(nonExistentProject);

      // Nothing was created anywhere by any of the above.
      expect(await countCasesForProject(victim.projectId)).toBe(0);
      expect(await countCasesForOrg(victim.orgId)).toBe(0);
      expect(await countCasesForOrg(attackerOrg.orgId)).toBe(0);
      expect(await countRunsForOrg(victim.orgId)).toBe(0);
      expect(await countRunsForOrg(attackerOrg.orgId)).toBe(0);

      // No event leaked into the attacker's tenant, and the victim's tenant
      // still holds exactly its one proposal.
      expect(await readOutboxForOrg(attackerOrg.orgId)).toHaveLength(0);
      expect(await readOutboxForOrg(victim.orgId)).toHaveLength(1);

      // (c) The victim's own Case, once created, is unreadable to the attacker
      // — and reads identically to a caseId that never existed.
      const created = await intake.confirmWorkOrder({
        workOrder: draft(victim.orgId, victim.projectId),
        confirmedDigest: proposal.workOrderDigest,
        confirmedByActorId: victimActor,
      });
      const realCaseDenial = await captureError(() =>
        intake.getConfirmedWorkOrders(created.caseId, attacker)
      );
      const fakeCaseDenial = await captureError(() =>
        intake.getConfirmedWorkOrders(`case-${randomUUID()}`, attacker)
      );
      expect(realCaseDenial).toBe(fakeCaseDenial);
      expect(realCaseDenial).toMatch(/denied/i);
    } finally {
      await teardown(
        [victim.orgId, attackerOrg.orgId],
        [victim.projectId, attackerOrg.projectId],
        [victimActor, attacker]
      );
    }
  }, 120_000);

  // -------------------------------------------------------------------------
  // 6. PROVENANCE — confirming work order B must never hand back work order
  //    A's Case (CW-CANON-03).
  //
  //    This is the digest guarantee's whole point. Case reuse is keyed on
  //    `project_id` (the only uniqueness the schema has), so a SECOND, genuinely
  //    DIFFERENT work order confirmed against a project that already had a Case
  //    used to answer 200 with `reuseReason: 'existing_case_for_project'` and
  //    return the OTHER order's Case: a human confirms "Zestawienie faktur" and
  //    receives "Analiza kosztow". The digest is then a signature on a document
  //    the system does not execute — worse than no digest, because it reassures.
  //
  //    The assertion below is the one the owner asked for literally: two
  //    different work orders on the same project must NOT be able to return the
  //    same Case.
  // -------------------------------------------------------------------------
  it('a SECOND, different work order on a project that already has a Case is refused — it never returns the first work order\'s Case, and writes nothing', async () => {
    const { orgId, projectId } = await seedOrgAndProject('provenance');
    const actorId = await seedMemberedUser(orgId, 'provenance');
    try {
      // Work order A — "Analiza kosztow". Confirmed; creates the Case.
      const orderA = draft(orgId, projectId);
      const proposalA = await intake.proposeWorkOrder({
        workOrder: orderA,
        proposedByActorId: actorId,
      });
      const confirmedA = await intake.confirmWorkOrder({
        workOrder: orderA,
        confirmedDigest: proposalA.workOrderDigest,
        confirmedByActorId: actorId,
      });
      expect(confirmedA.caseCreated).toBe(true);

      // Work order B — "Zestawienie faktur". A DIFFERENT order (different goal,
      // scope and outcome), properly proposed and self-consistently confirmed:
      // every pre-existing gate passes, which is exactly why this one is needed.
      const orderB: intake.WorkOrderDraftInput = {
        ...orderA,
        goal: 'Przygotowac zestawienie faktur zakupowych za IV kwartal dla dzialu finansow.',
        scope: ['Zebrac faktury zakupowe z IV kwartalu.', 'Uzgodnic sumy z ksiegami.'],
        expectedOutcome: 'Zestawienie faktur uzgodnione z ksiegami.',
      };
      const proposalB = await intake.proposeWorkOrder({
        workOrder: orderB,
        proposedByActorId: actorId,
      });
      expect(proposalB.workOrderDigest).not.toBe(proposalA.workOrderDigest);

      const refusal = await captureError(() =>
        intake.confirmWorkOrder({
          workOrder: orderB,
          confirmedDigest: proposalB.workOrderDigest,
          confirmedByActorId: actorId,
        })
      );
      // A stable, explicit code — not a silent hand-over.
      expect(refusal).toBe('intake_existing_case_work_order_conflict');

      // THE PROPERTY: B cannot have been given A's Case, because B was given
      // nothing at all, and no second Case appeared either.
      expect(await countCasesForProject(projectId)).toBe(1);
      const caseRows = await control.query<{ case_id: string }>(
        `SELECT case_id FROM case_core WHERE project_id = $1`,
        [projectId]
      );
      expect(caseRows.rows[0].case_id).toBe(confirmedA.caseId);

      // The refusal left ZERO trace of a confirmation for B — the whole
      // transaction rolled back before any publishEvent.
      const confirmations = (await readOutboxForOrg(orgId)).filter(
        (e) => e.event_type === 'case.intake.work_order_confirmed'
      );
      expect(confirmations).toHaveLength(1);
      expect(confirmations[0].redacted_summary.workOrderDigest).toBe(proposalA.workOrderDigest);

      // NEGATIVE CONTROL — the gate must reject only the DIFFERENT order, not
      // idempotency. Replaying A still reuses A's Case, exactly as before.
      const replayA = await intake.confirmWorkOrder({
        workOrder: orderA,
        confirmedDigest: proposalA.workOrderDigest,
        confirmedByActorId: actorId,
      });
      expect(replayA.caseId).toBe(confirmedA.caseId);
      expect(replayA.caseCreated).toBe(false);
      expect(replayA.reuseReason).toBe('work_order_already_confirmed');
      expect(await countCasesForProject(projectId)).toBe(1);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 120_000);
});

/** Returns the thrown error's message, or a marker if nothing was thrown —
 * never `undefined`, so a silently-succeeding call cannot pass an equality
 * assertion against another failure's message. */
async function captureError(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'NO_ERROR_THROWN';
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
