/**
 * INTEGRATION — CW-T-A "Case Identity: Cardinality and Name", proved against
 * a REAL PostgreSQL.
 *
 * ===========================================================================
 * WHAT THIS SUITE IS INTEGRATING
 * ===========================================================================
 * The owner's binding ruling (2026-08-10): a Case is a WORK ORDER, and one
 * project MAY and MUST be able to hold MANY independent Cases. This suite
 * proves that end to end across the two services this packet changed
 * together — `caseIntakeService.ts` (propose/confirm a work order) and
 * `caseCoreService.ts` (the Case aggregate those confirmations create) — on
 * top of the real schema retrofit in
 * `server/migrations/20260810d_case_workspace_case_identity.sql`:
 *   - `case_core.project_id` is no longer UNIQUE;
 *   - `case_core.case_name` is a real, NOT NULL, distinct-from-goal column;
 *   - `case_core.intake_confirmation_key` (tenant + actor/conversation scope
 *     + confirmation idempotency key + work-order digest, partial-unique)
 *     is what now enforces "exactly one Case PER CONFIRMATION".
 *
 * SCOPE DECISION, stated plainly: this suite drives the SERVICE layer
 * (`caseIntakeService` + `caseCoreService`) directly, not HTTP. The sibling
 * `integration/chatIntake.pg.test.ts` and `integration/lightOneClick.pg.test.ts`
 * mount real Express routers (`routes/caseWorkspace/index.ts`,
 * `routes/v8/chat.routes.ts`) to prove the HTTP surface is wired — but
 * `routes/caseWorkspace/index.ts` (route mounting) is explicitly
 * koordynator-owned and outside this packet's allowlist, and this packet's
 * own `intake.routes.ts`/`cases.routes.ts` are already exercised by the
 * existing route-level contract suites. What THIS suite adds that no
 * existing file proves is the CARDINALITY property itself — two independent
 * Cases in one project — end to end across both services and the real
 * migrated schema, which is exactly the packet's own DoD list (see this
 * file's test titles below, one per required scenario).
 *
 * ===========================================================================
 * GATE — `NODE_ENV=test` alone is a trap
 * ===========================================================================
 * `getDatabase()` returns an in-memory MOCK unless `RUN_DB_TESTS === '1'`
 * AND `MOCK_DB === 'false'`; every write then silently becomes a no-op and a
 * suite about "exactly N rows exist" passes while touching nothing. Gate on
 * reachability AND the CW-T-A schema specifically (old UNIQUE gone, new
 * partial unique index present, case_name/intake_confirmation_key columns
 * present) — SKIP LOUDLY, never silently pass, when either is missing.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run \
 *     server/src/services/caseWorkspace/__tests__/integration/caseCardinality.pg.test.ts \
 *     --environment node
 *
 * ===========================================================================
 * WHAT MAKES THESE ASSERTIONS WORTH ANYTHING
 * ===========================================================================
 * Every "how many rows / what state" claim is read back OUT OF BAND through
 * a dedicated `pg.Pool` (`control`), never from a service return value
 * alone. The RESTART/READBACK test goes one step further and opens a BRAND
 * NEW pool (a fresh physical connection, simulating a process restart) to
 * read the committed row, so the assertion cannot be explained by anything
 * cached on the connection that wrote it.
 *
 * Every test owns its own organization/project/users and tears them down in
 * a `finally` — never a shared `beforeEach`. Ids are namespaced with
 * `randomUUID()`, so this file is safe to run concurrently with itself and
 * with the other pg suites.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import * as intake from '../../caseIntakeService.js';

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
          AND column_name IN ('case_id', 'project_id', 'organization_id', 'version',
                               'case_name', 'intake_confirmation_key')`
    );
    const outbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'event_type', 'aggregate_type', 'aggregate_id',
                               'case_id', 'redacted_summary')`
    );
    const members = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const newUnique = await probe.query(
      `SELECT count(*)::int AS present FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'case_core'
          AND indexname = 'case_core_intake_confirmation_key_key'`
    );
    const oldUniqueGone = await probe.query(
      `SELECT count(*)::int AS present FROM pg_constraint
        WHERE conrelid = 'case_core'::regclass AND contype = 'u'
          AND pg_get_constraintdef(oid) = 'UNIQUE (project_id)'`
    );
    const caseNameNotNull = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_core'
          AND column_name = 'case_name' AND is_nullable = 'NO'`
    );
    return (
      Number(caseCore.rows[0]?.present ?? 0) === 6 &&
      Number(outbox.rows[0]?.present ?? 0) === 6 &&
      Number(members.rows[0]?.present ?? 0) === 4 &&
      Number(newUnique.rows[0]?.present ?? 0) === 1 &&
      Number(oldUniqueGone.rows[0]?.present ?? 0) === 0 &&
      Number(caseNameNotNull.rows[0]?.present ?? 0) === 1
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
    `[caseCardinality integration suite SKIPPED — clean skip, NOT a pass] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and ` +
      `20260810d_case_workspace_case_identity.sql (CW-T-A) applied: case_core's OLD UNIQUE ` +
      `(project_id) ABSENT, case_name NOT NULL present, and the NEW partial unique index on ` +
      `intake_confirmation_key present. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CaseCoreDbRow {
  case_id: string;
  project_id: string;
  organization_id: string;
  case_name: string;
  case_status: string;
  intake_confirmation_key: string | null;
  version: number;
}

suite('CW-T-A — Case Identity: Cardinality and Name (integration, real PostgreSQL)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixtures — every test seeds and tears down its own org/project/users.
  // -------------------------------------------------------------------------

  async function seedOrgAndProject(label: string): Promise<{ orgId: string; projectId: string }> {
    const suffix = randomUUID();
    const orgId = `cwta-org-${label}-${suffix}`;
    const projectId = `cwta-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `CW-T-A test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `CW-T-A test project (${label})`]
    );
    return { orgId, projectId };
  }

  async function seedMemberedUser(
    orgId: string,
    label: string,
    status: 'ACTIVE' | 'REVOKED' = 'ACTIVE'
  ): Promise<string> {
    const userId = `cwta-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', $4)`,
      [`cwta-member-${randomUUID()}`, orgId, userId, status]
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
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  /** Two REAL, DISTINCT work orders — different names, goals, scope, outcome. */
  function orderOne(orgId: string, projectId: string): intake.WorkOrderDraftInput {
    return {
      organizationId: orgId,
      projectId,
      caseName: 'Analiza kosztow operacyjnych',
      goal: 'Przygotowac rekomendacje optymalizacji kosztow zakupu energii dla zakladu w Plocku.',
      scope: [
        'Zebrac dane o zuzyciu energii z ostatnich 24 miesiecy.',
        'Porownac trzy warianty kontraktu.',
      ],
      expectedOutcome: 'Dokument rekomendacji z trzema wariantami i jednym wskazaniem.',
      contractedClosureType: 'DECISION_COMPLETED',
      sourceConversationId: 'conv-cardinality-order-one',
    };
  }

  function orderTwo(orgId: string, projectId: string): intake.WorkOrderDraftInput {
    return {
      organizationId: orgId,
      projectId,
      caseName: 'Zestawienie faktur zakupowych',
      goal: 'Przygotowac zestawienie faktur zakupowych za IV kwartal dla dzialu finansow.',
      scope: ['Zebrac faktury zakupowe z IV kwartalu.', 'Uzgodnic sumy z ksiegami.'],
      expectedOutcome: 'Zestawienie faktur uzgodnione z ksiegami.',
      contractedClosureType: 'DELIVERY_COMPLETED',
      sourceConversationId: 'conv-cardinality-order-two',
    };
  }

  async function proposeAndConfirm(
    order: intake.WorkOrderDraftInput,
    actorId: string
  ): Promise<intake.ConfirmWorkOrderResult> {
    const proposal = await intake.proposeWorkOrder({ workOrder: order, proposedByActorId: actorId });
    return intake.confirmWorkOrder({
      workOrder: order,
      confirmedDigest: proposal.workOrderDigest,
      confirmedByActorId: actorId,
    });
  }

  async function readCasesForProject(projectId: string): Promise<CaseCoreDbRow[]> {
    const result = await control.query<CaseCoreDbRow>(
      `SELECT case_id, project_id, organization_id, case_name, case_status,
              intake_confirmation_key, version
         FROM case_core WHERE project_id = $1 ORDER BY created_at ASC`,
      [projectId]
    );
    return result.rows;
  }

  // ===========================================================================
  // 1. Two DIFFERENT confirmed work orders in ONE project => TWO Cases.
  //    "to jest sedno tego pakietu" — the packet's own words.
  // ===========================================================================
  it('dwa ROZNE zlecenia w JEDNYM projekcie => DWA rozne Case, z dwiema roznymi nazwami', async () => {
    const { orgId, projectId } = await seedOrgAndProject('two-orders');
    const actorId = await seedMemberedUser(orgId, 'two-orders');
    try {
      const first = await proposeAndConfirm(orderOne(orgId, projectId), actorId);
      const second = await proposeAndConfirm(orderTwo(orgId, projectId), actorId);

      expect(first.caseCreated).toBe(true);
      expect(second.caseCreated).toBe(true);
      expect(first.caseId).not.toBe(second.caseId);

      const rows = await readCasesForProject(projectId);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.case_id).sort()).toEqual([first.caseId, second.caseId].sort());
      expect(rows.map((r) => r.case_name).sort()).toEqual(
        ['Analiza kosztow operacyjnych', 'Zestawienie faktur zakupowych'].sort()
      );
      // Same project, DIFFERENT intake_confirmation_key each (digest differs).
      expect(rows[0].intake_confirmation_key).not.toBe(rows[1].intake_confirmation_key);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // ===========================================================================
  // 2. Retry of the SAME confirmation (sequential) => SAME Case, not a second.
  // ===========================================================================
  it('retry TEGO SAMEGO potwierdzenia => TEN SAM Case (nie drugi)', async () => {
    const { orgId, projectId } = await seedOrgAndProject('retry');
    const actorId = await seedMemberedUser(orgId, 'retry');
    try {
      const order = orderOne(orgId, projectId);
      const proposal = await intake.proposeWorkOrder({ workOrder: order, proposedByActorId: actorId });

      const first = await intake.confirmWorkOrder({
        workOrder: order,
        confirmedDigest: proposal.workOrderDigest,
        confirmedByActorId: actorId,
      });
      expect(first.caseCreated).toBe(true);

      // A retry — same order, same digest, same actor. No idempotency key
      // supplied, so it defaults to the digest itself.
      const retry1 = await intake.confirmWorkOrder({
        workOrder: order,
        confirmedDigest: proposal.workOrderDigest,
        confirmedByActorId: actorId,
      });
      const retry2 = await intake.confirmWorkOrder({
        workOrder: order,
        confirmedDigest: proposal.workOrderDigest,
        confirmedByActorId: actorId,
      });

      expect(retry1.caseId).toBe(first.caseId);
      expect(retry1.caseCreated).toBe(false);
      expect(retry1.reuseReason).toBe('work_order_already_confirmed');
      expect(retry2.caseId).toBe(first.caseId);
      expect(retry2.caseCreated).toBe(false);

      const rows = await readCasesForProject(projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0].case_id).toBe(first.caseId);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // ===========================================================================
  // 3. Two CONCURRENT confirmations of the SAME work order (Promise.all) =>
  //    EXACTLY ONE Case. Real concurrency: withPgTransaction opens a fresh
  //    physical connection per call, so these race inside Postgres itself.
  // ===========================================================================
  it('dwa ROWNOLEGLE potwierdzenia TEGO SAMEGO zlecenia (Promise.all) => DOKLADNIE JEDEN Case', async () => {
    const { orgId, projectId } = await seedOrgAndProject('race-same');
    const actorId = await seedMemberedUser(orgId, 'race-same');
    try {
      const order = orderOne(orgId, projectId);
      const proposal = await intake.proposeWorkOrder({ workOrder: order, proposedByActorId: actorId });

      const [a, b] = await Promise.all([
        intake.confirmWorkOrder({
          workOrder: order,
          confirmedDigest: proposal.workOrderDigest,
          confirmedByActorId: actorId,
        }),
        intake.confirmWorkOrder({
          workOrder: order,
          confirmedDigest: proposal.workOrderDigest,
          confirmedByActorId: actorId,
        }),
      ]);

      expect(a.caseId).toBe(b.caseId);
      expect([a.caseCreated, b.caseCreated].filter(Boolean)).toHaveLength(1);

      const rows = await readCasesForProject(projectId);
      expect(rows).toHaveLength(1);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // ===========================================================================
  // 4. Two CONCURRENT DIFFERENT confirmations in the SAME project
  //    (Promise.all) => TWO Cases. The cardinality property under real
  //    concurrency, not just sequentially.
  // ===========================================================================
  it('dwa ROWNOLEGLE ROZNE potwierdzenia w tym samym projekcie => DWA Case', async () => {
    const { orgId, projectId } = await seedOrgAndProject('race-different');
    const actorId = await seedMemberedUser(orgId, 'race-different');
    try {
      const order1 = orderOne(orgId, projectId);
      const order2 = orderTwo(orgId, projectId);
      const [proposal1, proposal2] = await Promise.all([
        intake.proposeWorkOrder({ workOrder: order1, proposedByActorId: actorId }),
        intake.proposeWorkOrder({ workOrder: order2, proposedByActorId: actorId }),
      ]);

      const [a, b] = await Promise.all([
        intake.confirmWorkOrder({
          workOrder: order1,
          confirmedDigest: proposal1.workOrderDigest,
          confirmedByActorId: actorId,
        }),
        intake.confirmWorkOrder({
          workOrder: order2,
          confirmedDigest: proposal2.workOrderDigest,
          confirmedByActorId: actorId,
        }),
      ]);

      expect(a.caseId).not.toBe(b.caseId);
      expect(a.caseCreated).toBe(true);
      expect(b.caseCreated).toBe(true);

      const rows = await readCasesForProject(projectId);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.case_name).sort()).toEqual(
        ['Analiza kosztow operacyjnych', 'Zestawienie faktur zakupowych'].sort()
      );
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // ===========================================================================
  // 5. Stale digest — the summary changed after it was shown => CONFLICT,
  //    ZERO Cases. Exercised through the conversation-bound entry point,
  //    whose whole design is "client sends only a digest, server supplies
  //    the order" (see caseIntakeService.ts's own header, section 4) —
  //    `intake_work_order_digest_stale`, deliberately a DIFFERENT code from
  //    `intake_work_order_digest_mismatch` (self-inconsistent pair).
  // ===========================================================================
  it('stale digest (podsumowanie zmienilo sie po pokazaniu) => KONFLIKT, zero Case', async () => {
    const { orgId, projectId } = await seedOrgAndProject('stale-digest');
    const actorId = await seedMemberedUser(orgId, 'stale-digest');
    const conversationId = `conv-stale-${randomUUID()}`;
    try {
      const shown = await intake.proposeConversationWorkOrder({
        conversationId,
        workOrder: { ...orderOne(orgId, projectId), sourceConversationId: null },
        proposedByActorId: actorId,
      });
      const staleDigest = shown.workOrderDigest;

      // The conversation moves on: a NEW proposal supersedes the shown one.
      await intake.proposeConversationWorkOrder({
        conversationId,
        workOrder: {
          ...orderOne(orgId, projectId),
          goal: `${orderOne(orgId, projectId).goal} Dodatkowo: wniosek o dotacje.`,
          sourceConversationId: null,
        },
        proposedByActorId: actorId,
      });

      // The human's client still holds the OLD (now stale) digest.
      await expect(
        intake.confirmConversationWorkOrder({
          conversationId,
          organizationId: orgId,
          confirmedDigest: staleDigest,
          confirmedByActorId: actorId,
        })
      ).rejects.toThrow(/intake_work_order_digest_stale/);

      const rows = await readCasesForProject(projectId);
      expect(rows).toHaveLength(0);

      const confirmedEvents = await control.query(
        `SELECT count(*)::int AS n FROM case_workspace_event_outbox
          WHERE organization_id = $1 AND event_type = $2`,
        [orgId, 'case.intake.work_order_confirmed']
      );
      expect(Number(confirmedEvents.rows[0]?.n ?? -1)).toBe(0);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // ===========================================================================
  // 6. Cross-tenant => refusal without disclosing existence (SEC-009,
  //    CW-DOD-D6). An attacker who is a real, active member of THEIR OWN org
  //    cannot tell "this project belongs to another tenant" from
  //    "this project does not exist" by the error alone.
  // ===========================================================================
  it('cross-tenant => odmowa bez ujawnienia istnienia (ten sam blad dla cudzego projektu i nieistniejacego)', async () => {
    const victim = await seedOrgAndProject('victim');
    const attackerOrg = await seedOrgAndProject('attacker');
    const attacker = await seedMemberedUser(attackerOrg.orgId, 'attacker');
    try {
      const foreignAttempt = await captureErrorMessage(() =>
        intake.proposeWorkOrder({
          workOrder: orderOne(attackerOrg.orgId, victim.projectId),
          proposedByActorId: attacker,
        })
      );
      const nonexistentAttempt = await captureErrorMessage(() =>
        intake.proposeWorkOrder({
          workOrder: orderOne(attackerOrg.orgId, `cwta-project-absent-${randomUUID()}`),
          proposedByActorId: attacker,
        })
      );

      expect(foreignAttempt).toBe('intake_project_not_found');
      expect(nonexistentAttempt).toBe('intake_project_not_found');
      expect(foreignAttempt).toBe(nonexistentAttempt);

      expect(await readCasesForProject(victim.projectId)).toHaveLength(0);
      const attackerOrgEvents = await control.query(
        `SELECT count(*)::int AS n FROM case_workspace_event_outbox WHERE organization_id = $1`,
        [attackerOrg.orgId]
      );
      expect(Number(attackerOrgEvents.rows[0]?.n ?? -1)).toBe(0);
    } finally {
      await teardown([victim.orgId, attackerOrg.orgId], [victim.projectId, attackerOrg.projectId], [attacker]);
    }
  }, 60_000);

  // ===========================================================================
  // 7. Revoked membership => refusal, zero Case.
  // ===========================================================================
  it('revoked membership => odmowa, zero Case', async () => {
    const { orgId, projectId } = await seedOrgAndProject('revoked');
    const revokedActor = await seedMemberedUser(orgId, 'revoked-actor', 'REVOKED');
    try {
      await expect(
        intake.proposeWorkOrder({
          workOrder: orderOne(orgId, projectId),
          proposedByActorId: revokedActor,
        })
      ).rejects.toMatchObject({ code: 'not_org_member' });

      await expect(
        intake.confirmWorkOrder({
          workOrder: orderOne(orgId, projectId),
          confirmedDigest: intake.computeWorkOrderDigest(intake.normalizeWorkOrder(orderOne(orgId, projectId))),
          confirmedByActorId: revokedActor,
        })
      ).rejects.toMatchObject({ code: 'not_org_member' });

      expect(await readCasesForProject(projectId)).toHaveLength(0);
    } finally {
      await teardown([orgId], [projectId], [revokedActor]);
    }
  }, 60_000);

  // ===========================================================================
  // 8. BACKFILL SAFETY — re-running the identity migration's own backfill
  //    UPDATE statements (verbatim, from
  //    server/migrations/20260810d_case_workspace_case_identity.sql) must be
  //    a no-op: it never deletes, never merges, and never renames an
  //    already-named row. Proves the "additive, safe to rerun" property the
  //    packet brief requires, by counting rows and hashing every
  //    (case_id, case_name) pair BEFORE and AFTER.
  // ===========================================================================
  it('backfill (rerun) => zaden rekord nie zniknal ani nie zostal scalony — liczba wierszy i nazwy identyczne przed/po', async () => {
    const { orgId, projectId } = await seedOrgAndProject('backfill-safety');
    const actorId = await seedMemberedUser(orgId, 'backfill-safety');
    try {
      // Two Cases already carrying real names — exactly the state a
      // freshly-backfilled table is in.
      await proposeAndConfirm(orderOne(orgId, projectId), actorId);
      await proposeAndConfirm(orderTwo(orgId, projectId), actorId);

      // ISOLATION: this suite runs against a SHARED case_workspace_test
      // database alongside other concurrent agents/suites (see this file's
      // header) that are themselves inserting/deleting unrelated case_core
      // rows throughout the run. An earlier version of this test counted/
      // read the WHOLE `case_core` table (`SELECT ... FROM case_core`, no
      // WHERE at all) before and after the re-run below — a global count
      // that a concurrent writer elsewhere in the database can (and, in
      // practice, did) change between the two SELECTs, failing this test for
      // a reason that has nothing to do with the backfill's own safety.
      // Scoped to `project_id = $1`, exactly like every other assertion in
      // this file (`readCasesForProject`), it is immune to that: only THIS
      // test's own two rows can ever match.
      const before = await control.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM case_core WHERE project_id = $1`,
        [projectId]
      );
      const beforeRows = await control.query<{ case_id: string; case_name: string }>(
        `SELECT case_id, case_name FROM case_core WHERE project_id = $1 ORDER BY case_id`,
        [projectId]
      );

      // Verbatim re-run of the migration's own two backfill UPDATEs (see
      // 20260810d_case_workspace_case_identity.sql) — both are written to be
      // idempotent (`WHERE coalesce(case_name, '') = ''`), so on an
      // already-backfilled table this must change ZERO rows. Deliberately
      // NOT scoped to this test's project (the real migration runs over the
      // whole table, and that is exactly the behaviour under test) — safe to
      // run concurrently regardless, because `case_name` is NOT NULL with a
      // non-blank CHECK constraint (this same migration), so no row from any
      // concurrent writer can ever match `coalesce(case_name, '') = ''`
      // either; only a row that predates the migration entirely could, and
      // none does once `db:migrate:strict` has run.
      const wo = await control.query<{ n: string }>(
        `UPDATE case_core c
            SET case_name = wo.goal
           FROM (
             SELECT DISTINCT ON (case_id) case_id, redacted_summary->>'goal' AS goal
               FROM case_workspace_event_outbox
              WHERE event_type = 'case.intake.work_order_confirmed'
                AND case_id IS NOT NULL
                AND coalesce(redacted_summary->>'goal', '') <> ''
              ORDER BY case_id, occurred_at ASC, created_at ASC
           ) wo
          WHERE c.case_id = wo.case_id
            AND coalesce(c.case_name, '') = ''
          RETURNING c.case_id`
      );
      const fallback = await control.query<{ n: string }>(
        `UPDATE case_core
            SET case_name = 'Zlecenie ' || upper(substring(replace(case_id, 'case-', '') from 1 for 8))
          WHERE coalesce(case_name, '') = ''
          RETURNING case_id`
      );

      expect(wo.rowCount ?? 0).toBe(0);
      expect(fallback.rowCount ?? 0).toBe(0);

      const after = await control.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM case_core WHERE project_id = $1`,
        [projectId]
      );
      const afterRows = await control.query<{ case_id: string; case_name: string }>(
        `SELECT case_id, case_name FROM case_core WHERE project_id = $1 ORDER BY case_id`,
        [projectId]
      );

      expect(Number(after.rows[0]?.n)).toBe(Number(before.rows[0]?.n));
      expect(afterRows.rows).toEqual(beforeRows.rows);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);

  // ===========================================================================
  // 9. RESTART/READBACK — the committed Case survives being read from a
  //    BRAND NEW connection (simulating a process restart), with its name,
  //    confirmation key and status intact.
  // ===========================================================================
  it('restart/readback: a fresh connection (nowy pool) czyta ten sam Case, z ta sama nazwa i kluczem idempotencji', async () => {
    const { orgId, projectId } = await seedOrgAndProject('restart-readback');
    const actorId = await seedMemberedUser(orgId, 'restart-readback');
    let freshPool: Pool | null = null;
    try {
      const confirmed = await proposeAndConfirm(orderOne(orgId, projectId), actorId);

      // A brand-new physical connection — not `control`, not anything the
      // service used to write this row.
      freshPool = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
      const readback = await freshPool.query<CaseCoreDbRow>(
        `SELECT case_id, project_id, organization_id, case_name, case_status,
                intake_confirmation_key, version
           FROM case_core WHERE case_id = $1`,
        [confirmed.caseId]
      );
      expect(readback.rows).toHaveLength(1);
      expect(readback.rows[0].case_name).toBe('Analiza kosztow operacyjnych');
      expect(readback.rows[0].case_status).toBe('DRAFT');
      expect(readback.rows[0].project_id).toBe(projectId);
      expect(readback.rows[0].organization_id).toBe(orgId);
      expect(readback.rows[0].intake_confirmation_key).toBeTruthy();
      expect(Number(readback.rows[0].version)).toBe(1);

      // The service layer also reads it back correctly through a fresh call
      // (not the same in-process object returned by confirmWorkOrder).
      const viaService = await caseCoreService.getCase({ caseId: confirmed.caseId }, actorId);
      expect(viaService?.caseName).toBe('Analiza kosztow operacyjnych');
      expect(viaService?.projectId).toBe(projectId);
    } finally {
      await freshPool?.end().catch(() => undefined);
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 60_000);
});

/** Returns the thrown error's message, or a marker if nothing was thrown. */
async function captureErrorMessage(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'NO_ERROR_THROWN';
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
