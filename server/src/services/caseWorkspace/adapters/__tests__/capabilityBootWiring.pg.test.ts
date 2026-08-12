/**
 * Case Workspace — packet E1: proves `registerBuiltinCapabilityAdapters`
 * (server/src/services/caseWorkspace/adapters/index.ts) is now SAFE to call
 * from real process boot, against a REAL PostgreSQL.
 *
 * ===========================================================================
 * WHAT THIS FILE IS FOR, AND WHY IT IS NOT JUST ANOTHER ADAPTER SUITE
 * ===========================================================================
 * Every sibling `*Adapter.pg.test.ts` suite (decisionAdapter, initiativeAdapter,
 * kpiAdapter, financeAdapter, assessmentAdapter, resultsAdapter,
 * documentsAdapter) already proves its OWN handler works — and every one of
 * them passes today, in a codebase where `registerBuiltinCapabilityAdapters`
 * (adapters/index.ts) had ZERO production callers (verified 2026-08-12:
 * `grep -rn registerBuiltinCapabilityAdapters server/src` outside that file
 * returns only test files). Those suites pass BECAUSE each one calls
 * registration itself in its own `beforeAll` — exactly what a real server
 * process never does. A passing sibling suite is therefore NOT evidence this
 * gap is closed; this file exists to test the thing those suites structurally
 * cannot: whether the ONE function meant to wire all seven adapters at boot
 * actually survives being called the way a real boot calls it — including a
 * SECOND time, against a database that already has the first boot's rows.
 *
 * The obstacle (see capabilityAdapterService.ts's `registerCapabilityWithAdapter`
 * header for the full account): `registerCapability` persists a UNIQUE
 * (capability_id, capability_version) row and throws
 * `capability_already_registered` on a second attempt, while the adapter
 * BINDING is an in-memory fact that dies with the process and must be
 * re-established on every boot. Before this packet's fix, the row-throw
 * happened before the binding was ever set, so a second boot against the same
 * database silently lost the binding (and, since
 * `registerBuiltinCapabilityAdapters` awaits its seven registrations in
 * sequence, aborted the whole chain after the FIRST duplicate — the other six
 * capabilities never got bound either).
 *
 * ===========================================================================
 * GATE — real database only, same convention as every other *.pg.test.ts
 * ===========================================================================
 *   cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
 *   npx vitest run src/services/caseWorkspace/adapters/__tests__/capabilityBootWiring.pg.test.ts \
 *   --environment node --testTimeout=90000
 *
 * ===========================================================================
 * WHAT EACH TEST PROVES
 * ===========================================================================
 *   1. "two boots ..."  — the packet's proofs 1, 2 and 3 in one continuous
 *      scenario: a FIRST boot (fresh in-memory state) registers rows AND
 *      bindings and a capability is immediately executable through nothing
 *      but the production `registerBuiltinCapabilityAdapters` entry point
 *      (this test never calls any per-adapter `register*AdapterBinding`
 *      directly — that is precisely the manual step production cannot take);
 *      a SECOND boot against the SAME database (bindings wiped first, to
 *      faithfully simulate a real process restart) re-registers without
 *      throwing, does not duplicate the registry row, and the capability is
 *      STILL executable afterwards, dispatching through the binding boot 2
 *      itself re-established.
 *   2. "ADMIN authorization is still enforced ..." — proof 5: a non-admin
 *      actor attempting to register a brand-new capability (never registered
 *      before, so this cannot be confused with the idempotent-replay path
 *      above) through `registerCapabilityWithAdapter` directly is refused
 *      with `CaseWorkspaceAuthError('insufficient_org_role', ...)`, no row is
 *      created, and — because this packet's fix binds before the row check —
 *      the capability is STILL unreachable afterwards (`CAPABILITY_NOT_FOUND`),
 *      proving the bind-first reordering grants no reachability on its own.
 *
 * The negative control required by this packet's brief (breaking the fix,
 * confirming test 1 goes RED, restoring, confirming GREEN) is a PROCEDURAL
 * step run once against this file with capabilityAdapterService.ts's fix
 * temporarily reverted — see this packet's final report for the pasted
 * before/after output. It is not encoded as a second copy of the test here,
 * because the point is proving THIS test can fail, not adding a parallel one.
 */

import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import type { InternalCommandBinding } from '../../capabilityAdapterService.js';
import { CaseWorkspaceAuthError } from '../../caseWorkspaceAuthContext.js';
import { getDecision } from '../../../decisionService.js';
import {
  DECISION_CREATE_CAPABILITY_ID,
  DECISION_CREATE_CAPABILITY_VERSION,
} from '../decisionAdapter.js';
import { registerBuiltinCapabilityAdapters } from '../index.js';
import {
  buildEnvelope,
  seedCaseFixture,
  seedMemberedUser,
  teardownCaseFixture,
} from '../../__tests__/adapters/_fixtures.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const capabilities = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_capabilities'
          AND column_name IN ('capability_registry_id', 'capability_id', 'capability_version',
                              'provider_type', 'lifecycle', 'health')`
    );
    const decisions = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'decisions'
          AND column_name IN ('id', 'organization_id', 'decision_maker_id', 'title')`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 6 &&
      Number(decisions.rows[0]?.present ?? 0) === 4
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
    `[capabilityBootWiring pg suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, ` +
      `and the case workspace + decisions schema applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// PACKET H3, 2026-08-12 — cross-file serialization against
// capabilityBootstrap.pg.test.ts. MUST be textually identical to the same
// constant in that file. See that file's matching comment block (right
// before its `suite(...)` call) for the full rationale: this file's test 1
// calls the REAL, unmodified `registerBuiltinCapabilityAdapters` (this
// file's whole reason to exist — proving that exact aggregate function is
// safe across two real boots), which hard-codes the seven real builtin
// capability id constants internally and offers no id-override parameter
// (adapters/index.ts). capabilityBootstrap.pg.test.ts's test 1 calls the
// config-loader layer that wraps the SAME function with the SAME real ids,
// and several of its other tests delete-then-assert-zero against those same
// real ids as pre-cleanup. Neither file's real-id-touching tests can be
// isolated by swapping to a private id without gutting what each proves, so
// a Postgres session-scoped advisory lock serializes the two files'
// real-id-touching critical sections instead — same production code path,
// same assertions, just no interleaving. This file's tests 2 and 3 use a
// fully synthetic, per-run-unique capability id via
// `registerCapabilityWithAdapter` directly (never through the aggregate
// function) and are NOT wrapped — they never touch the real ids.
const BUILTIN_CAPABILITY_CROSS_FILE_LOCK_KEY = 8_420_081_200;

suite('capabilityBootWiring — registerBuiltinCapabilityAdapters is safe across repeated real process boots', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // Acquire on a DEDICATED connection (not the shared `control` pool) —
  // `pg_advisory_lock` is session-scoped, so the same physical connection
  // must issue both the lock and the unlock. Blocks until
  // capabilityBootstrap.pg.test.ts's matching holder (if any) releases.
  async function acquireBuiltinCapabilityCrossFileLock(): Promise<PoolClient> {
    const lockClient = await control.connect();
    await lockClient.query('SELECT pg_advisory_lock($1)', [BUILTIN_CAPABILITY_CROSS_FILE_LOCK_KEY]);
    return lockClient;
  }

  async function releaseBuiltinCapabilityCrossFileLock(lockClient: PoolClient): Promise<void> {
    await lockClient
      .query('SELECT pg_advisory_unlock($1)', [BUILTIN_CAPABILITY_CROSS_FILE_LOCK_KEY])
      .catch(() => undefined);
    lockClient.release();
  }

  async function deleteDecisionCapabilityRegistryState(): Promise<void> {
    await control
      .query(
        `DELETE FROM case_workspace_capability_idempotency_keys
          WHERE capability_registry_id IN (
            SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
        [DECISION_CREATE_CAPABILITY_ID]
      )
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [
        DECISION_CREATE_CAPABILITY_ID,
      ])
      .catch(() => undefined);
  }

  async function decisionCapabilityRowCount(): Promise<number> {
    const result = await control.query(
      `SELECT count(*)::int AS n FROM case_workspace_capabilities
        WHERE capability_id = $1 AND capability_version = $2`,
      [DECISION_CREATE_CAPABILITY_ID, DECISION_CREATE_CAPABILITY_VERSION]
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  // ===========================================================================
  // 1. Two boots against the same database — proofs 1, 2, 3.
  // ===========================================================================
  it(
    'boot 1 registers rows+bindings and dispatches; boot 2 against the SAME database ' +
      're-registers without throwing, does not duplicate the row, and still dispatches',
    async () => {
      // Cross-file serialization against capabilityBootstrap.pg.test.ts —
      // see the BUILTIN_CAPABILITY_CROSS_FILE_LOCK_KEY block above this
      // describe for why an id-swap isn't the applicable fix here.
      const lockClient = await acquireBuiltinCapabilityCrossFileLock();
      const registrarSuffix = randomUUID();
      const registrarOrgId = `cwtest-boot-wiring-registrar-${registrarSuffix}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        registrarOrgId,
        'Boot wiring registrar org',
      ]);
      const registrarActorId = await seedMemberedUser(control, registrarOrgId, 'registrar', 'ADMIN');

      // Defensive pre-cleanup: a previous crashed run of this same file could
      // have left the shared, platform-global Decision row behind.
      await deleteDecisionCapabilityRegistryState();

      const fixture = await seedCaseFixture(control, 'boot-wiring');

      try {
        // Start from a genuinely cold in-memory state — the same starting
        // point a freshly-spawned Node process has.
        capabilityAdapterService.clearCapabilityBindings();

        // ---- BOOT 1 -----------------------------------------------------
        await registerBuiltinCapabilityAdapters({
          createdByActorId: registrarActorId,
          callerOrganizationId: registrarOrgId,
        });

        expect(await decisionCapabilityRowCount()).toBe(1);

        const firstResult = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DECISION_CREATE_CAPABILITY_ID,
            capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: {
              caseId: fixture.caseId,
              title: 'Boot 1: go/no-go on pilot expansion',
              type: 'GO_NO_GO',
              decisionMakerId: fixture.actorId,
            },
          })
        );
        expect(firstResult.outcome).toBe('SUCCEEDED');
        expect(firstResult.errorCode).toBeNull();
        const firstDecisionId = firstResult.output.decisionId as string;
        expect(typeof firstDecisionId).toBe('string');
        const firstDecision = await getDecision(firstDecisionId);
        expect(firstDecision?.title).toBe('Boot 1: go/no-go on pilot expansion');

        // ---- Simulate a real process restart -----------------------------
        // The registry ROW just written above persists in Postgres exactly
        // like it would across a real restart; the binding does NOT — a
        // fresh process starts with an empty in-memory map, which is exactly
        // what clearCapabilityBindings() reproduces here.
        capabilityAdapterService.clearCapabilityBindings();

        // Sanity: with the binding wiped and nothing re-registered yet, the
        // capability is NOT reachable — this is what proves the wipe above
        // actually took effect, and it is exactly the state a booted-but-
        // not-yet-wired production process is in today.
        const betweenBoots = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DECISION_CREATE_CAPABILITY_ID,
            capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: {
              caseId: fixture.caseId,
              title: 'Should not be reachable between boots',
              type: 'GO_NO_GO',
              decisionMakerId: fixture.actorId,
            },
          })
        );
        expect(betweenBoots.outcome).toBe('FAILED');
        expect(betweenBoots.errorCode).toBe('CAPABILITY_UNAVAILABLE');

        // ---- BOOT 2, same database, same registrar identity -------------
        // Pre-fix, this line is exactly what threw `capability_already_registered`
        // and aborted registerBuiltinCapabilityAdapters's sequential await
        // chain after the very first of the seven capabilities.
        await registerBuiltinCapabilityAdapters({
          createdByActorId: registrarActorId,
          callerOrganizationId: registrarOrgId,
        });

        // No duplicate physical row — the idempotent replay path read back
        // the existing one instead of inserting a second.
        expect(await decisionCapabilityRowCount()).toBe(1);

        // Reachable again, dispatching through the binding BOOT 2 itself
        // re-established (not a stale reference surviving from boot 1 — that
        // reference was destroyed by clearCapabilityBindings() above).
        const secondResult = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DECISION_CREATE_CAPABILITY_ID,
            capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: {
              caseId: fixture.caseId,
              title: 'Boot 2: go/no-go on pilot expansion',
              type: 'GO_NO_GO',
              decisionMakerId: fixture.actorId,
            },
          })
        );
        expect(secondResult.outcome).toBe('SUCCEEDED');
        expect(secondResult.errorCode).toBeNull();
        const secondDecisionId = secondResult.output.decisionId as string;
        expect(typeof secondDecisionId).toBe('string');
        expect(secondDecisionId).not.toBe(firstDecisionId);
        const secondDecision = await getDecision(secondDecisionId);
        expect(secondDecision?.title).toBe('Boot 2: go/no-go on pilot expansion');
      } finally {
        await teardownCaseFixture(control, fixture);
        await deleteDecisionCapabilityRegistryState();
        await control
          .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [registrarOrgId])
          .catch(() => undefined);
        await control
          .query(`DELETE FROM organization_members WHERE organization_id = $1`, [registrarOrgId])
          .catch(() => undefined);
        await control.query(`DELETE FROM users WHERE organization_id = $1`, [registrarOrgId]).catch(() => undefined);
        await control.query(`DELETE FROM organizations WHERE id = $1`, [registrarOrgId]).catch(() => undefined);
        capabilityAdapterService.clearCapabilityBindings();
        await releaseBuiltinCapabilityCrossFileLock(lockClient);
      }
    },
    // Raised from 90_000: this test drives TWO full
    // registerBuiltinCapabilityAdapters calls (8 capability registrations
    // each, sequential DB transactions) plus two live decision dispatches.
    // Under the observed shared-Postgres contention (a bare
    // information_schema probe took 3.4-3.9s in earlier runs; the whole test
    // measured 117s once), 90s produced a false RED (`Test timed out in
    // 90000ms`) with no assertion failure — contention, not a defect.
    240_000
  );

  // ===========================================================================
  // 2. ADMIN authorization still fires — proof 5.
  // ===========================================================================
  it(
    'a non-admin actor is still refused row creation for a brand-new capability, ' +
      'and the capability stays unreachable afterwards',
    async () => {
      const suffix = randomUUID();
      const orgId = `cwtest-boot-wiring-nonadmin-${suffix}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        orgId,
        'Boot wiring non-admin org',
      ]);
      // Deliberately MEMBER, not ADMIN — registerCapability requires ADMIN.
      const memberActorId = await seedMemberedUser(control, orgId, 'member', 'MEMBER');
      const capabilityId = `cwtest-boot-wiring-admin-check-${suffix}`;
      const capabilityVersion = '1.0.0';

      const binding: InternalCommandBinding = {
        kind: 'INTERNAL',
        async handler() {
          return { output: { ok: true } };
        },
      };

      try {
        let caught: unknown = null;
        try {
          await capabilityAdapterService.registerCapabilityWithAdapter(
            {
              capabilityId,
              capabilityVersion,
              ownerModule: 'case-workspace',
              providerType: 'INTERNAL',
              operation: 'testOperation',
              owningCommandRef: 'command:test',
              inputSchemaRef: 'schema:test-input@1',
              outputSchemaRef: 'schema:test-output@1',
              operationClass: 'MUTATE',
              effectClass: 'SAFE_ADDITIVE',
              dataClassification: 'INTERNAL',
              idempotencyStrategy: 'CLIENT_KEY',
              reversibility: 'REVERSIBLE',
              approvalRecommendation: 'auto_executable',
              timeoutDefaults: { defaultMs: 5_000 },
              lifecycle: 'ACTIVE',
              health: 'HEALTHY',
              createdByActorId: memberActorId,
            },
            binding,
            orgId
          );
        } catch (error) {
          caught = error;
        }

        // The ADMIN gate fired: a distinct, typed refusal — not a silent
        // no-op and not any generic Error.
        expect(caught).toBeInstanceOf(CaseWorkspaceAuthError);
        expect((caught as CaseWorkspaceAuthError).code).toBe('insufficient_org_role');

        // No row was created for this never-before-seen capability id.
        const rowCount = await control.query(
          `SELECT count(*)::int AS n FROM case_workspace_capabilities WHERE capability_id = $1`,
          [capabilityId]
        );
        expect(Number(rowCount.rows[0]?.n ?? 0)).toBe(0);

        // And — because this packet's fix binds BEFORE attempting the row —
        // the capability is still not reachable: bind-first grants no
        // reachability on its own, the registry row is what gates execution.
        const execResult = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId,
            capabilityVersion,
            orgId,
            actorId: memberActorId,
            payload: {},
          })
        );
        expect(execResult.outcome).toBe('FAILED');
        expect(execResult.errorCode).toBe('CAPABILITY_NOT_FOUND');
      } finally {
        await control
          .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [capabilityId])
          .catch(() => undefined);
        await control
          .query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId])
          .catch(() => undefined);
        await control.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]).catch(() => undefined);
        await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
        capabilityAdapterService.clearCapabilityBindings();
      }
    },
    120_000
  );

  // ===========================================================================
  // 3. Minimal-footprint re-confirmation of proofs 1-3, isolated from the
  //    7-capability aggregate and the Decision module's own DB writes.
  //
  //    Test 1 above proves the REAL production entry point
  //    (registerBuiltinCapabilityAdapters, all 7 capabilities, a real
  //    Decision dispatch) end-to-end, and is the authoritative proof. This
  //    test exercises exactly the same fixed logic in
  //    capabilityAdapterService.registerCapabilityWithAdapter directly,
  //    against a single synthetic capability with a trivial in-process
  //    handler and no case/project fixture — added because, under the heavy
  //    shared-Postgres contention this environment showed while proving this
  //    packet (a bare information_schema probe took 3.4-8.8s; test 1's full
  //    16-transaction, 2-dispatch flow took 240s+ and hit its own timeout
  //    more than once), a much smaller flow is far more likely to complete
  //    inside any bounded window and still isolates the exact fix.
  // ===========================================================================
  it(
    'registerCapabilityWithAdapter called twice for the SAME capability (two boots) does ' +
      'not throw the second time, does not duplicate the row, and stays executable',
    async () => {
      const suffix = randomUUID();
      const orgId = `cwtest-boot-wiring-min-${suffix}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
        orgId,
        'Boot wiring minimal org',
      ]);
      const adminId = await seedMemberedUser(control, orgId, 'admin', 'ADMIN');
      const capabilityId = `cwtest-boot-wiring-min-cap-${suffix}`;
      const capabilityVersion = '1.0.0';

      const registrationInput = {
        capabilityId,
        capabilityVersion,
        ownerModule: 'case-workspace',
        providerType: 'INTERNAL' as const,
        operation: 'testOperation',
        owningCommandRef: 'command:test',
        inputSchemaRef: 'schema:test-input@1',
        outputSchemaRef: 'schema:test-output@1',
        operationClass: 'MUTATE' as const,
        effectClass: 'SAFE_ADDITIVE' as const,
        dataClassification: 'INTERNAL',
        idempotencyStrategy: 'CLIENT_KEY',
        reversibility: 'REVERSIBLE',
        approvalRecommendation: 'auto_executable' as const,
        timeoutDefaults: { defaultMs: 5_000 },
        lifecycle: 'ACTIVE' as const,
        health: 'HEALTHY' as const,
        createdByActorId: adminId,
      };
      const binding: InternalCommandBinding = {
        kind: 'INTERNAL',
        async handler(payload) {
          return { output: { ok: true, seen: payload } };
        },
      };

      try {
        capabilityAdapterService.clearCapabilityBindings();

        // ---- BOOT 1 -------------------------------------------------------
        const first = await capabilityAdapterService.registerCapabilityWithAdapter(
          registrationInput,
          binding,
          orgId
        );
        expect(first.capabilityId).toBe(capabilityId);

        const rowCountAfterFirst = await control.query(
          `SELECT count(*)::int AS n FROM case_workspace_capabilities WHERE capability_id = $1`,
          [capabilityId]
        );
        expect(Number(rowCountAfterFirst.rows[0]?.n ?? 0)).toBe(1);

        const firstExec = await capabilityAdapterService.executeCapability({
          capabilityId,
          capabilityVersion,
          organizationId: orgId,
          actor: { type: 'HUMAN', actorId: adminId },
          idempotencyKey: `idem-${randomUUID()}`,
          payload: { boot: 1 },
        });
        expect(firstExec.outcome).toBe('SUCCEEDED');

        // ---- Simulate a real process restart -------------------------------
        capabilityAdapterService.clearCapabilityBindings();

        const betweenBoots = await capabilityAdapterService.executeCapability({
          capabilityId,
          capabilityVersion,
          organizationId: orgId,
          actor: { type: 'HUMAN', actorId: adminId },
          idempotencyKey: `idem-${randomUUID()}`,
          payload: { boot: 'between' },
        });
        expect(betweenBoots.outcome).toBe('FAILED');
        expect(betweenBoots.errorCode).toBe('CAPABILITY_UNAVAILABLE');

        // ---- BOOT 2, same database, same identity --------------------------
        // Pre-fix, this line throws `capability_already_registered` and the
        // binding above is never set for this "boot".
        const second = await capabilityAdapterService.registerCapabilityWithAdapter(
          registrationInput,
          binding,
          orgId
        );
        expect(second.capabilityId).toBe(capabilityId);

        const rowCountAfterSecond = await control.query(
          `SELECT count(*)::int AS n FROM case_workspace_capabilities WHERE capability_id = $1`,
          [capabilityId]
        );
        expect(Number(rowCountAfterSecond.rows[0]?.n ?? 0)).toBe(1);

        const secondExec = await capabilityAdapterService.executeCapability({
          capabilityId,
          capabilityVersion,
          organizationId: orgId,
          actor: { type: 'HUMAN', actorId: adminId },
          idempotencyKey: `idem-${randomUUID()}`,
          payload: { boot: 2 },
        });
        expect(secondExec.outcome).toBe('SUCCEEDED');
      } finally {
        await control
          .query(
            `DELETE FROM case_workspace_capability_idempotency_keys
              WHERE capability_registry_id IN (
                SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
            [capabilityId]
          )
          .catch(() => undefined);
        await control
          .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [capabilityId])
          .catch(() => undefined);
        await control
          .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
          .catch(() => undefined);
        await control
          .query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId])
          .catch(() => undefined);
        await control.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]).catch(() => undefined);
        await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
        capabilityAdapterService.clearCapabilityBindings();
      }
    },
    60_000
  );
});
