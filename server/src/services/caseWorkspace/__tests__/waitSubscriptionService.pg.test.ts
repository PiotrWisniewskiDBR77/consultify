/**
 * Case Workspace — Wait Subscription service, proved against a REAL
 * PostgreSQL (CW-P06, EPIC E5 "Durable waits and events"). Exercises
 * server/src/services/caseWorkspace/waitSubscriptionService.ts against the
 * schema in
 * server/migrations/20260809_case_workspace_wait_subscription.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as runBindingService.pg.test.ts (CW-P04) and every other
 * CW-P01-06 `*.pg.test.ts`: `NODE_ENV=test` ALONE is a trap —
 * `Database.ts`'s `getDatabase()`/`createDatabase()` hand back an in-memory
 * MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly
 * `'false'`), and every write silently becomes a no-op. This file follows the
 * `*.pg.test.ts` convention: gate on
 * `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe reachability AND that
 * the migrated schema is actually present before deciding, and SKIP LOUDLY
 * (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/waitSubscriptionService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own organization/project/case_core/
 * v8_execution_runs/action_proposal fixtures
 * ===========================================================================
 * `case_workspace_waits` requires (wait_target_required, service-level) at
 * least one of run_id/action_proposal_id. run_id on a wait must point at an
 * existing `case_workspace_run_bindings` row (createWait SELECTs that table,
 * not `v8_execution_runs` directly) — standing up a binding needs a full
 * draft -> propose -> publish plan-version cycle plus
 * runBindingService.bindRunToPlanVersion(), which this packet's own service
 * never touches. action_proposal_id only needs a `case_workspace_action_
 * proposals` row, which proposalApprovalService.createActionProposal() can
 * mint directly off a bare `v8_execution_runs` row (no binding required). So
 * every fixture below targets waits via `actionProposalId`, seeded through
 * `seedActionProposal()` (a thin wrapper over proposalApprovalService's own
 * production createActionProposal(), not a raw INSERT) — this is the
 * lightest legitimate path to a valid wait_target_required wait.
 *
 * `seedV8Run()` is a TEST-FIXTURE-ONLY direct INSERT into `v8_execution_runs`
 * via the out-of-band `pg.Pool` (`control`), exactly mirroring
 * runBindingService.pg.test.ts's own helper of the same name — neither
 * waitSubscriptionService.ts nor proposalApprovalService.ts ever writes to
 * that table themselves.
 *
 * Every test seeds its own fixture inside the test body (never a shared
 * beforeEach) and tears it down itself in a `finally`, so no test can
 * observe, reset, or race another test's rows. Teardown order matters:
 * `case_workspace_waits` rows must be deleted before the `case_workspace_
 * action_proposals`/`v8_execution_runs`/`case_core` rows they FK to, since
 * none of those FKs carry an ON DELETE clause (RESTRICT/NO ACTION — see the
 * migration file's header).
 *
 * All assertions read the actual `case_workspace_waits` rows back out of
 * Postgres through a dedicated, out-of-band `pg.Pool` (`control`) — never the
 * service function's return value alone — because the return value only
 * proves what the service THINKS it wrote, not what actually landed.
 *
 * ===========================================================================
 * AUTHORIZATION (CW-P12 retrofit) — every human-facing actor is a real,
 * membered user; system/scheduler paths stay deliberately unguarded
 * ===========================================================================
 * createWait/getWait/listWaitsForRun/listWaitsForCase/provideHumanInput/
 * cancelWait now gate through caseWorkspaceAuthContext.ts's
 * requireCaseAccess — every actor id used for those below is a real `users`
 * row with a matching ACTIVE `organization_members` row for the Case's org.
 * claimTimerWait/renewTimerWaitClaimLease/expireWait/
 * listDueTimerWaitsForClaim and resolveWait's own direct call remain
 * deliberately unguarded (INTERNAL-ONLY / NOT ROUTE-EXPOSED, system/
 * scheduler primitives) — those calls below intentionally use NO actor
 * fixture, proving the CW-P12 retrofit did not accidentally tighten them.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as proposalApprovalService from '../proposalApprovalService.js';
import * as waitSubscriptionService from '../waitSubscriptionService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Reachability AND schema presence are decided once, before the suite is declared. */
const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const waitsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_waits'
          AND column_name IN ('wait_id', 'case_id', 'run_id', 'action_proposal_id', 'wait_type',
                               'status', 'correlation_key', 'due_at', 'claim_owner_token',
                               'claim_fencing_token', 'claim_lease_expires_at', 'version')`
    );
    const waitsOk = Number(waitsResult.rows[0]?.present ?? 0) === 12;

    const proposalsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_action_proposals'
          AND column_name IN ('action_proposal_id', 'case_id', 'run_id')`
    );
    const proposalsOk = Number(proposalsResult.rows[0]?.present ?? 0) === 3;

    const runsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'v8_execution_runs'
          AND column_name IN ('run_id', 'organization_id', 'context_snapshot_id',
                               'initiator_user_id', 'state', 'goal')`
    );
    const runsOk = Number(runsResult.rows[0]?.present ?? 0) === 6;

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 4;

    return waitsOk && proposalsOk && runsOk && orgMembersOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[waitSubscriptionService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_wait_subscription.sql migration applied (on top of ` +
      `20260809_case_workspace_case_core.sql, 20260809_case_workspace_proposals_approvals.sql and ` +
      `20260323_v8_execution_spine_00base.sql). requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CaseWorkspaceWaitDbRow {
  wait_id: string;
  case_id: string;
  run_id: string | null;
  action_proposal_id: string | null;
  wait_type: string;
  status: string;
  correlation_key: string;
  due_at: string | null;
  satisfied_at: string | null;
  satisfied_by_event_id: string | null;
  claim_owner_token: string | null;
  claim_fencing_token: number;
  claim_lease_expires_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * The transactional outbox row (server/migrations/
 * 20260810_case_workspace_event_outbox.sql). Read ONLY through the out-of-band
 * `control` pool, after the service call returned and its transaction
 * committed — publishEvent's return value proves nothing about what survived
 * COMMIT, which is the entire property under test.
 */
interface CaseWorkspaceEventOutboxDbRow {
  event_id: string;
  event_type: string;
  organization_id: string;
  project_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number | null;
  case_id: string | null;
  run_id: string | null;
  node_run_id: string | null;
  actor_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  redacted_summary: Record<string, unknown>;
  payload_ref: string | null;
}

suite('waitSubscriptionService — Wait Subscription against a real PostgreSQL (CW-P06, E5)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixture helpers — every test calls these itself, never a shared hook.
  // -------------------------------------------------------------------------

  /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-wait-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  /** An organization_members row for an existing user, at the given role/status. */
  async function seedMember(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED' = 'ACTIVE'
  ): Promise<void> {
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)`,
      [`case-wait-member-${randomUUID()}`, orgId, userId, role, status]
    );
  }

  /** Convenience: seed a user AND an ACTIVE membership at MEMBER role in one call. */
  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = await seedUser(orgId, label);
    await seedMember(orgId, userId, 'MEMBER');
    return userId;
  }

  /**
   * A fresh organization + project + case_core row, all uniquely named, plus
   * a real membered actor to create the Case with. Same bundle as
   * runBindingService.pg.test.ts's/casePlanVersionService.pg.test.ts's own
   * seedOrgProjectCase().
   */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
    const suffix = randomUUID();
    const orgId = `case-wait-org-${label}-${suffix}`;
    const projectId = `case-wait-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Wait Subscription test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Wait Subscription test project (${label})`]
    );
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });
    return { orgId, projectId, caseId: created.caseId, actorId };
  }

  /**
   * TEST-FIXTURE-ONLY direct INSERT into v8_execution_runs via the
   * out-of-band control Pool — mirrors runBindingService.pg.test.ts's own
   * seedV8Run() exactly. Neither waitSubscriptionService.ts nor
   * proposalApprovalService.ts ever writes to this table themselves.
   */
  async function seedV8Run(params: { runId: string; organizationId: string }): Promise<void> {
    await control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (run_id) DO NOTHING`,
      [
        params.runId,
        params.organizationId,
        `ctx-snapshot-${params.runId}`,
        `initiator-${params.runId}`,
        `goal for ${params.runId}`,
      ]
    );
  }

  /**
   * Mints a valid case_workspace_action_proposals row through
   * proposalApprovalService's own production createActionProposal() — the
   * lightest legitimate way to satisfy waitSubscriptionService.createWait()'s
   * wait_target_required check (run_id on a wait needs a case_workspace_run_
   * bindings row, which this suite avoids standing up; action_proposal_id
   * only needs a bare v8_execution_runs row underneath it). `actorId` must be
   * a real membered user in the Case's org — createActionProposal is itself
   * now case-access-gated (CW-P12).
   */
  async function seedActionProposal(params: {
    caseId: string;
    runId: string;
    actorId: string;
    tag: string;
  }): Promise<string> {
    const proposal = await proposalApprovalService.createActionProposal({
      caseId: params.caseId,
      runId: params.runId,
      nodeRunId: `node-run-${params.tag}`,
      payloadDigest: `digest-${params.tag}`,
      policySnapshotRef: `policy-${params.tag}`,
      effectClass: 'SAFE_ADDITIVE',
      previewRef: `preview-${params.tag}`,
      proposerType: 'SYSTEM',
      createdByActorId: params.actorId,
      idempotencyKey: `idem-${params.tag}-${randomUUID()}`,
    });
    return proposal.actionProposalId;
  }

  async function readWaitRow(waitId: string): Promise<CaseWorkspaceWaitDbRow | null> {
    const result = await control.query<CaseWorkspaceWaitDbRow>(
      `SELECT * FROM case_workspace_waits WHERE wait_id = $1`,
      [waitId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Every outbox row this WAIT aggregate ever produced, oldest first, read out
   * of band. `event_id` breaks ties because `created_at` defaults to `now()` =
   * transaction start time.
   */
  async function readOutboxRowsForAggregate(
    aggregateId: string
  ): Promise<CaseWorkspaceEventOutboxDbRow[]> {
    const result = await control.query<CaseWorkspaceEventOutboxDbRow>(
      `SELECT * FROM case_workspace_event_outbox
         WHERE aggregate_id = $1
         ORDER BY created_at ASC, event_id ASC`,
      [aggregateId]
    );
    return result.rows;
  }

  /**
   * After ONE mutating command: EXACTLY ONE new row, of the expected type,
   * whose tenancy/correlation identity comes from the aggregate row rather than
   * from the caller's input. Returns the row for further, type-specific
   * assertions.
   */
  function expectOneEvent(
    rows: CaseWorkspaceEventOutboxDbRow[],
    index: number,
    expected: {
      eventType: string;
      aggregateId: string;
      organizationId: string;
      projectId: string;
      caseId: string;
      actorUserId: string;
      aggregateVersion: number;
    }
  ): CaseWorkspaceEventOutboxDbRow {
    const row = rows[index];
    if (!row) throw new Error(`expected an outbox row at index ${index}, got ${rows.length} rows`);
    expect(row.event_type).toBe(expected.eventType);
    expect(row.aggregate_type).toBe('WAIT');
    expect(row.aggregate_id).toBe(expected.aggregateId);
    expect(row.organization_id).toBe(expected.organizationId);
    expect(row.project_id).toBe(expected.projectId);
    expect(row.case_id).toBe(expected.caseId);
    expect(row.actor_user_id).toBe(expected.actorUserId);
    expect(Number(row.aggregate_version)).toBe(expected.aggregateVersion);
    expect(typeof row.correlation_id).toBe('string');
    expect(row.correlation_id.trim().length).toBeGreaterThan(0);
    return row;
  }

  /**
   * A DEFERRABLE INITIALLY DEFERRED constraint trigger fires at COMMIT — after
   * the command's aggregate UPDATE *and* its publishEvent INSERT have both run
   * on the transaction's client. That is the only honest way to force "mutation
   * and event both written, then the transaction failed"; an ordinary AFTER
   * trigger fires during the UPDATE statement, before any event exists, and
   * would prove nothing. The WHEN clause scopes it to a single wait_id so a
   * suite running concurrently against the same database is unaffected.
   */
  async function installCommitFailureTrigger(waitId: string): Promise<() => Promise<void>> {
    const suffix = randomUUID().replace(/-/g, '');
    const fnName = `cw_test_wait_rollback_${suffix}`;
    const triggerName = `cw_test_wait_rollback_trg_${suffix}`;
    await control.query(
      `CREATE FUNCTION ${fnName}() RETURNS trigger LANGUAGE plpgsql AS
       $fn$ BEGIN RAISE EXCEPTION 'cw_test_forced_commit_failure'; END; $fn$`
    );
    await control.query(
      `CREATE CONSTRAINT TRIGGER ${triggerName}
         AFTER UPDATE ON case_workspace_waits
         DEFERRABLE INITIALLY DEFERRED
         FOR EACH ROW WHEN (NEW.wait_id = '${waitId}')
         EXECUTE FUNCTION ${fnName}()`
    );
    return async () => {
      await control
        .query(`DROP TRIGGER IF EXISTS ${triggerName} ON case_workspace_waits`)
        .catch(() => undefined);
      await control.query(`DROP FUNCTION IF EXISTS ${fnName}()`).catch(() => undefined);
    };
  }

  /**
   * Teardown order matters: case_workspace_waits rows have no ON DELETE
   * clause on their case_core/case_workspace_action_proposals FKs (RESTRICT/
   * NO ACTION — see the migration file's header), so waits must be deleted
   * first, then the action_proposals, then the v8_execution_runs rows they
   * referenced, then users, then case_core (which cascades to
   * case_plan_versions), then projects, then organizations.
   */
  async function teardown(params: {
    waitIds: string[];
    runIds: string[];
    orgIds: string[];
    projectIds: string[];
    userIds?: string[];
  }): Promise<void> {
    // The outbox has ZERO foreign keys by design (see its migration header), so
    // its rows survive every delete below and must be cleared explicitly or they
    // leak into the next run's counts.
    if (params.orgIds.length > 0) {
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = ANY($1)`, [
          params.orgIds,
        ])
        .catch(() => undefined);
    }
    if (params.waitIds.length > 0) {
      await control
        .query(`DELETE FROM case_workspace_waits WHERE wait_id = ANY($1)`, [params.waitIds])
        .catch(() => undefined);
    }
    if (params.runIds.length > 0) {
      await control
        .query(`DELETE FROM case_workspace_action_proposals WHERE run_id = ANY($1)`, [
          params.runIds,
        ])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM v8_execution_runs WHERE run_id = ANY($1)`, [params.runIds])
        .catch(() => undefined);
    }
    for (const projectId of params.projectIds) {
      await control
        .query(`DELETE FROM case_core WHERE project_id = $1`, [projectId])
        .catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of params.userIds ?? []) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of params.orgIds) {
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  // -------------------------------------------------------------------------
  // 1. createWait + getWait round-trip; a second createWait with the SAME
  //    (case_id, correlation_key) is idempotent — returns the original row,
  //    no second row is created (CW-RT-060, the migration's UNIQUE
  //    constraint + ON CONFLICT DO NOTHING idiom).
  // -------------------------------------------------------------------------
  it('createWait + getWait round-trip, and a duplicate createWait for the same (case_id, correlation_key) returns the original row without creating a second one', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('idempotent-create');
    const runId = `run-t1-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'idempotent-create',
      });
      const correlationKey = `corr-idempotent-create-${randomUUID()}`;

      const first = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey,
        },
        actorId
      );
      waitIds.push(first.waitId);
      expect(first.status).toBe('ACTIVE');
      expect(first.correlationKey).toBe(correlationKey);
      expect(first.version).toBe(1);

      const fetched = await waitSubscriptionService.getWait(first.waitId, actorId);
      expect(fetched).not.toBeNull();
      expect(fetched?.waitId).toBe(first.waitId);
      expect(fetched?.actionProposalId).toBe(actionProposalId);

      const second = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey,
        },
        actorId
      );
      expect(second.waitId).toBe(first.waitId);

      const rows = await control.query<CaseWorkspaceWaitDbRow>(
        `SELECT * FROM case_workspace_waits WHERE case_id = $1 AND correlation_key = $2`,
        [caseId, correlationKey]
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]?.wait_id).toBe(first.waitId);
    } finally {
      await teardown({ waitIds, runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. claimTimerWait succeeds when the wait has no live claim, sets
  //    claim_owner_token/claim_lease_expires_at and bumps claim_fencing_token
  //    by exactly 1; a second attempt with a different owner token while the
  //    first claim's lease is still live is rejected and the DB row stays
  //    owned by the first claimer (CW-RT-021, CW-CANON-11). claimTimerWait
  //    is a deliberately unguarded system/scheduler primitive (CW-P12) — no
  //    actor fixture is used for it.
  // -------------------------------------------------------------------------
  it('claimTimerWait claims an unclaimed TIMER wait and bumps the fencing token by 1; a second concurrent attempt is rejected and leaves the row unchanged', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('claim-live-lease');
    const runId = `run-t2-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'claim-live-lease',
      });

      const wait = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'TIMER',
          correlationKey: `corr-claim-live-lease-${randomUUID()}`,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        },
        actorId
      );
      waitIds.push(wait.waitId);
      expect(wait.claimOwnerToken).toBeNull();
      expect(wait.claimFencingToken).toBe(0);

      const firstClaim = await waitSubscriptionService.claimTimerWait(wait.waitId, {
        leaseMs: 60_000,
      });
      expect(firstClaim.outcome).toBe('claimed');
      if (firstClaim.outcome !== 'claimed') throw new Error('expected claimed outcome');
      expect(firstClaim.fencingToken).toBe(1);

      const rowAfterFirstClaim = await readWaitRow(wait.waitId);
      expect(rowAfterFirstClaim?.claim_owner_token).toBe(firstClaim.ownerToken);
      expect(Number(rowAfterFirstClaim?.claim_fencing_token)).toBe(1);
      expect(rowAfterFirstClaim?.claim_lease_expires_at).not.toBeNull();

      // Second attempt: claimTimerWait mints its own fresh owner token
      // internally, so this is automatically "a different owner token"
      // racing the still-live lease held by the first claimer.
      const secondClaim = await waitSubscriptionService.claimTimerWait(wait.waitId, {
        leaseMs: 60_000,
      });
      expect(secondClaim.outcome).toBe('active_elsewhere');

      const rowAfterSecondAttempt = await readWaitRow(wait.waitId);
      expect(rowAfterSecondAttempt?.claim_owner_token).toBe(firstClaim.ownerToken);
      expect(Number(rowAfterSecondAttempt?.claim_fencing_token)).toBe(1);
      expect(rowAfterSecondAttempt?.claim_lease_expires_at).toBe(
        rowAfterFirstClaim?.claim_lease_expires_at
      );
    } finally {
      await teardown({ waitIds, runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. Reclaim-after-expiry: simulate an expired lease directly via the DB
  //    (out-of-band pool), then confirm a NEW claimTimerWait call from a
  //    different owner token now succeeds and the fencing token increments
  //    again (CW-RT-021, CW-CANON-11).
  // -------------------------------------------------------------------------
  it('claimTimerWait reclaims a wait whose lease has expired, minting a new owner token and incrementing the fencing token again', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('reclaim-after-expiry');
    const runId = `run-t3-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'reclaim-after-expiry',
      });

      const wait = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'TIMER',
          correlationKey: `corr-reclaim-after-expiry-${randomUUID()}`,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        },
        actorId
      );
      waitIds.push(wait.waitId);

      const firstClaim = await waitSubscriptionService.claimTimerWait(wait.waitId, {
        leaseMs: 60_000,
      });
      expect(firstClaim.outcome).toBe('claimed');
      if (firstClaim.outcome !== 'claimed') throw new Error('expected claimed outcome');
      expect(firstClaim.fencingToken).toBe(1);

      // Force the lease into the past directly via the out-of-band pool —
      // this is what "an expired lease" looks like on disk, independent of
      // any application-clock assumption.
      await control.query(
        `UPDATE case_workspace_waits SET claim_lease_expires_at = $1 WHERE wait_id = $2`,
        [new Date(Date.now() - 5_000).toISOString(), wait.waitId]
      );

      const reclaim = await waitSubscriptionService.claimTimerWait(wait.waitId, {
        leaseMs: 60_000,
      });
      expect(reclaim.outcome).toBe('claimed');
      if (reclaim.outcome !== 'claimed') throw new Error('expected claimed outcome on reclaim');
      expect(reclaim.ownerToken).not.toBe(firstClaim.ownerToken);
      expect(reclaim.fencingToken).toBe(2);

      const rowAfterReclaim = await readWaitRow(wait.waitId);
      expect(rowAfterReclaim?.claim_owner_token).toBe(reclaim.ownerToken);
      expect(Number(rowAfterReclaim?.claim_fencing_token)).toBe(2);
    } finally {
      await teardown({ waitIds, runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. resolveWait transitions ACTIVE -> SATISFIED and sets satisfied_at/
  //    satisfied_by_event_id; a second resolveWait (and an expireWait/
  //    cancelWait) attempt on the now-terminal row is rejected, DB row
  //    unchanged (CW-RT-020, CW-RT-021, CW-01-026-INV8). resolveWait/
  //    expireWait are deliberately unguarded system primitives (CW-P12) —
  //    only cancelWait's actor needs a real membership.
  // -------------------------------------------------------------------------
  it('resolveWait transitions ACTIVE to SATISFIED and stamps satisfied_at/satisfied_by_event_id; further transition attempts on the terminal row are rejected and leave it unchanged', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('resolve-terminal');
    const runId = `run-t4-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'resolve-terminal',
      });

      const wait = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey: `corr-resolve-terminal-${randomUUID()}`,
        },
        actorId
      );
      waitIds.push(wait.waitId);
      expect(wait.version).toBe(1);

      const resolved = await waitSubscriptionService.resolveWait(
        wait.waitId,
        { satisfiedByEventId: 'evt-resolve-terminal' },
        1
      );
      expect(resolved.status).toBe('SATISFIED');
      expect(resolved.satisfiedByEventId).toBe('evt-resolve-terminal');
      expect(resolved.satisfiedAt).not.toBeNull();
      expect(resolved.version).toBe(2);

      const rowAfterResolve = await readWaitRow(wait.waitId);
      expect(rowAfterResolve?.status).toBe('SATISFIED');
      expect(rowAfterResolve?.satisfied_by_event_id).toBe('evt-resolve-terminal');
      expect(rowAfterResolve?.satisfied_at).not.toBeNull();
      expect(Number(rowAfterResolve?.version)).toBe(2);

      // A second resolveWait against the now-terminal row is rejected
      // regardless of version passed — ALLOWED_TRANSITIONS[SATISFIED] = [].
      await expect(
        waitSubscriptionService.resolveWait(
          wait.waitId,
          { satisfiedByEventId: 'evt-resolve-terminal-again' },
          2
        )
      ).rejects.toThrow(/wait_status_transition_not_allowed/);

      // expireWait/cancelWait against the same terminal row are rejected too.
      await expect(waitSubscriptionService.expireWait(wait.waitId, 2)).rejects.toThrow(
        /wait_status_transition_not_allowed/
      );
      await expect(
        waitSubscriptionService.cancelWait(
          wait.waitId,
          { actorUserId: actorId },
          'no longer needed',
          2
        )
      ).rejects.toThrow(/wait_status_transition_not_allowed/);

      const rowAfterRejectedAttempts = await readWaitRow(wait.waitId);
      expect(rowAfterRejectedAttempts?.status).toBe('SATISFIED');
      expect(rowAfterRejectedAttempts?.satisfied_by_event_id).toBe('evt-resolve-terminal');
      expect(Number(rowAfterRejectedAttempts?.version)).toBe(2);
    } finally {
      await teardown({ waitIds, runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. expireWait and cancelWait each independently transition ACTIVE to
  //    their respective terminal state, tested on separate fresh waits
  //    (CW-RT-043, CW-RT-052, CW-RT-062, CW-DOD-C5, CW-02-029).
  // -------------------------------------------------------------------------
  it('expireWait and cancelWait each transition their own fresh ACTIVE wait to EXPIRED/CANCELLED respectively', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('expire-and-cancel');
    const runId = `run-t5-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'expire-and-cancel',
      });

      const waitToExpire = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey: `corr-to-expire-${randomUUID()}`,
        },
        actorId
      );
      waitIds.push(waitToExpire.waitId);

      const waitToCancel = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey: `corr-to-cancel-${randomUUID()}`,
        },
        actorId
      );
      waitIds.push(waitToCancel.waitId);

      const expired = await waitSubscriptionService.expireWait(waitToExpire.waitId, 1);
      expect(expired.status).toBe('EXPIRED');
      expect(expired.version).toBe(2);

      const cancelled = await waitSubscriptionService.cancelWait(
        waitToCancel.waitId,
        { actorUserId: actorId },
        'superseded by a newer wait',
        1
      );
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.version).toBe(2);

      const expiredRow = await readWaitRow(waitToExpire.waitId);
      expect(expiredRow?.status).toBe('EXPIRED');
      expect(Number(expiredRow?.version)).toBe(2);

      const cancelledRow = await readWaitRow(waitToCancel.waitId);
      expect(cancelledRow?.status).toBe('CANCELLED');
      expect(Number(cancelledRow?.version)).toBe(2);

      // The two waits are fully independent — expiring one must not have
      // touched the other, and vice versa.
      expect(expiredRow?.wait_id).not.toBe(cancelledRow?.wait_id);
    } finally {
      await teardown({ waitIds, runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. listDueTimerWaitsForClaim only returns TIMER-type, ACTIVE-status
  //    waits whose due_at has passed (CW-RT-021, CW-DOD-I6). Deliberately
  //    unguarded system/scheduler read (CW-P12) — no actor fixture is used.
  // -------------------------------------------------------------------------
  it('listDueTimerWaitsForClaim returns only the past-due, ACTIVE, TIMER wait — not the future-due TIMER wait nor the past-due HUMAN wait', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('list-due-timers');
    const runId = `run-t6-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'list-due-timers',
      });

      const pastDueTimer = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'TIMER',
          correlationKey: `corr-past-due-timer-${randomUUID()}`,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        },
        actorId
      );
      waitIds.push(pastDueTimer.waitId);

      const futureDueTimer = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'TIMER',
          correlationKey: `corr-future-due-timer-${randomUUID()}`,
          dueAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
        actorId
      );
      waitIds.push(futureDueTimer.waitId);

      const pastDueHuman = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey: `corr-past-due-human-${randomUUID()}`,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        },
        actorId
      );
      waitIds.push(pastDueHuman.waitId);

      const due = await waitSubscriptionService.listDueTimerWaitsForClaim(new Date(), 200);
      const dueForThisCase = due.filter((w) => w.caseId === caseId);

      expect(dueForThisCase.map((w) => w.waitId)).toEqual([pastDueTimer.waitId]);
      expect(dueForThisCase.some((w) => w.waitId === futureDueTimer.waitId)).toBe(false);
      expect(dueForThisCase.some((w) => w.waitId === pastDueHuman.waitId)).toBe(false);
      expect(dueForThisCase[0]?.waitType).toBe('TIMER');
      expect(dueForThisCase[0]?.status).toBe('ACTIVE');
    } finally {
      await teardown({ waitIds, runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. AUTHORIZATION (CW-P12) — createWait (create class): an actor with no
  //    organization_members row for the Case's org is rejected, creating no
  //    wait row.
  // -------------------------------------------------------------------------
  it('createWait rejects an actor with no organization_members row for the Case\'s org, creating no wait row', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('auth-create');
    const noMembershipActor = await seedUser(orgId, 'auth-create-outsider');
    const runId = `run-t7-${randomUUID()}`;
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({ caseId, runId, actorId, tag: 'auth-create' });

      await expect(
        waitSubscriptionService.createWait(
          {
            caseId,
            actionProposalId,
            waitType: 'HUMAN',
            correlationKey: `corr-auth-create-${randomUUID()}`,
          },
          noMembershipActor
        )
      ).rejects.toMatchObject({ code: 'case_access_denied' });

      const rows = await control.query<CaseWorkspaceWaitDbRow>(
        `SELECT * FROM case_workspace_waits WHERE case_id = $1`,
        [caseId]
      );
      expect(rows.rows).toHaveLength(0);
    } finally {
      await teardown({
        waitIds: [],
        runIds: [runId],
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId, noMembershipActor],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 8. AUTHORIZATION (CW-P12) — getWait (read class, SEC-009 hardening): a
  //    nonexistent wait_id and a real wait the actor cannot access both
  //    return null.
  // -------------------------------------------------------------------------
  it('getWait returns null for both a nonexistent wait_id and a real wait the actor cannot access', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('auth-read-null');
    const noMembershipActor = await seedUser(orgId, 'auth-read-null-outsider');
    const runId = `run-t8-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({ caseId, runId, actorId, tag: 'auth-read-null' });
      const wait = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey: `corr-auth-read-null-${randomUUID()}`,
        },
        actorId
      );
      waitIds.push(wait.waitId);

      const missing = await waitSubscriptionService.getWait(`cwwait-${randomUUID()}`, noMembershipActor);
      const denied = await waitSubscriptionService.getWait(wait.waitId, noMembershipActor);
      expect(missing).toBeNull();
      expect(denied).toBeNull();

      const allowed = await waitSubscriptionService.getWait(wait.waitId, actorId);
      expect(allowed?.waitId).toBe(wait.waitId);
    } finally {
      await teardown({
        waitIds,
        runIds: [runId],
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId, noMembershipActor],
      });
    }
  }, 30_000);

  // ===========================================================================
  // EVENT OUTBOX (docs/product/case-workspace/acceptance/EVENT_TAXONOMY.md,
  // section "waitSubscriptionService — aggregate WAIT")
  //
  // Every assertion reads `case_workspace_event_outbox` out of band AFTER the
  // command returned — never the value publishEvent handed back. What matters
  // is what survived COMMIT.
  // ===========================================================================

  // -------------------------------------------------------------------------
  // 9. The TIMER lifecycle: register -> claim -> renew -> satisfy. Four
  //    mutating commands, four events, in order, each with the taxonomy's
  //    literal event_type, the POST-mutation aggregate version, and the right
  //    actor — human for createWait, `system:<worker>` for the three scheduler
  //    primitives that have no human in their signature.
  // -------------------------------------------------------------------------
  it('emits exactly one correctly-identified outbox event per mutating command across register -> claim -> renew -> satisfy, with system actors on the scheduler paths', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-timer-lifecycle');
    const runId = `run-t9-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'outbox-timer-lifecycle',
      });
      const correlationKey = `corr-outbox-timer-${randomUUID()}`;

      const created = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'TIMER',
          correlationKey,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        },
        actorId
      );
      waitIds.push(created.waitId);
      const aggregateId = created.waitId;
      const identity = { aggregateId, organizationId: orgId, projectId, caseId };

      let rows = await readOutboxRowsForAggregate(aggregateId);
      expect(rows).toHaveLength(1);
      const registered = expectOneEvent(rows, 0, {
        ...identity,
        eventType: 'wait.registered',
        actorUserId: actorId,
        aggregateVersion: 1,
      });
      expect(registered.redacted_summary.waitType).toBe('TIMER');
      expect(registered.redacted_summary.correlationKey).toBe(correlationKey);
      expect(registered.redacted_summary.actionProposalId).toBe(actionProposalId);
      // A wait registered against a proposal (not a run binding) legitimately
      // has no run — the chain carries what exists and nothing invented.
      expect(registered.run_id).toBeNull();

      const claim = await waitSubscriptionService.claimTimerWait(aggregateId);
      expect(claim.outcome).toBe('claimed');
      if (claim.outcome !== 'claimed') throw new Error('unreachable');

      rows = await readOutboxRowsForAggregate(aggregateId);
      expect(rows).toHaveLength(2);
      const claimed = expectOneEvent(rows, 1, {
        ...identity,
        eventType: 'wait.claimed',
        actorUserId: 'system:case-workspace-timer-claimer',
        // Claiming does not bump the OCC counter — the event reports the row's
        // real version, not an assumed increment.
        aggregateVersion: claim.wait.version,
      });
      expect(claimed.redacted_summary.claimFencingCounter).toBe(claim.fencingToken);
      // The owner token is a capability secret: it must not be in the event.
      expect(JSON.stringify(claimed.redacted_summary)).not.toContain(claim.ownerToken);

      const renewOutcome = await waitSubscriptionService.renewTimerWaitClaimLease(
        aggregateId,
        claim.ownerToken,
        claim.fencingToken
      );
      expect(renewOutcome).toBe('renewed');

      rows = await readOutboxRowsForAggregate(aggregateId);
      expect(rows).toHaveLength(3);
      const renewed = expectOneEvent(rows, 2, {
        ...identity,
        eventType: 'wait.claim_lease_renewed',
        actorUserId: 'system:case-workspace-timer-claimer',
        aggregateVersion: claim.wait.version,
      });
      expect(renewed.redacted_summary.claimFencingCounter).toBe(claim.fencingToken);

      const satisfied = await waitSubscriptionService.resolveWait(
        aggregateId,
        {
          satisfiedByEventId: `evt-outbox-timer-${randomUUID()}`,
          timerClaim: { ownerToken: claim.ownerToken, fencingToken: claim.fencingToken },
        },
        claim.wait.version
      );
      expect(satisfied.status).toBe('SATISFIED');

      rows = await readOutboxRowsForAggregate(aggregateId);
      expect(rows).toHaveLength(4);
      const satisfiedEvent = expectOneEvent(rows, 3, {
        ...identity,
        eventType: 'wait.satisfied',
        actorUserId: 'system:case-workspace-wait-resolver',
        aggregateVersion: satisfied.version,
      });
      expect(satisfiedEvent.redacted_summary.from).toBe('ACTIVE');
      expect(satisfiedEvent.redacted_summary.to).toBe('SATISFIED');

      expect(rows.map((r) => r.event_type)).toEqual([
        'wait.registered',
        'wait.claimed',
        'wait.claim_lease_renewed',
        'wait.satisfied',
      ]);
      expect(new Set(rows.map((r) => r.event_id)).size).toBe(4);

      // Reads are not facts.
      await waitSubscriptionService.getWait(aggregateId, actorId);
      await waitSubscriptionService.listWaitsForCase(caseId, undefined, actorId);
      await waitSubscriptionService.listDueTimerWaitsForClaim();
      expect(await readOutboxRowsForAggregate(aggregateId)).toHaveLength(4);
    } finally {
      await teardown({
        waitIds,
        runIds: [runId],
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId],
      });
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 10. provideHumanInput is NOT resolveWait with a different caller: it emits
  //     its OWN single event (`wait.human_input_provided`, human actor), never
  //     `wait.satisfied` and never two rows — the double-count the taxonomy
  //     forbids in §5.3. The submitted input is referenced via payload_ref, not
  //     copied into the summary.
  // -------------------------------------------------------------------------
  it('provideHumanInput emits exactly one wait.human_input_provided under the human actor, referencing the input via payload_ref instead of copying it', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-human-input');
    const runId = `run-t10-${randomUUID()}`;
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'outbox-human-input',
      });

      const created = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey: `corr-outbox-human-${randomUUID()}`,
        },
        actorId
      );
      waitIds.push(created.waitId);
      const inputRef = `humaninput-${randomUUID()}`;

      const satisfied = await waitSubscriptionService.provideHumanInput(
        created.waitId,
        { inputRef, actorUserId: actorId },
        created.version
      );
      expect(satisfied.status).toBe('SATISFIED');

      const rows = await readOutboxRowsForAggregate(created.waitId);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.event_type)).toEqual([
        'wait.registered',
        'wait.human_input_provided',
      ]);
      expect(rows.map((r) => r.event_type)).not.toContain('wait.satisfied');

      const humanEvent = expectOneEvent(rows, 1, {
        aggregateId: created.waitId,
        organizationId: orgId,
        projectId,
        caseId,
        eventType: 'wait.human_input_provided',
        actorUserId: actorId,
        aggregateVersion: satisfied.version,
      });
      expect(humanEvent.payload_ref).toBe(inputRef);
      expect(humanEvent.redacted_summary.waitType).toBe('HUMAN');
      expect(humanEvent.redacted_summary.to).toBe('SATISFIED');
    } finally {
      await teardown({
        waitIds,
        runIds: [runId],
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId],
      });
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 11. expireWait (scheduler actor) and cancelWait (human actor) each emit
  //     their own terminal event, and cancelWait's free-text reason — which is
  //     not even persisted on the table — must not become durable via the event.
  //     Commands that change NOTHING (a failed claim, a fenced renew, a replayed
  //     create) emit nothing at all.
  // -------------------------------------------------------------------------
  it('emits wait.expired/wait.cancelled with the right actors and no reason text, and emits nothing for non-mutating outcomes', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-terminal');
    const runId = `run-t11-${randomUUID()}`;
    const waitIds: string[] = [];
    const cancelReason = 'client withdrew consent, contact anna.nowak@example.test';
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const proposalForExpire = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'outbox-terminal-expire',
      });
      const proposalForCancel = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'outbox-terminal-cancel',
      });

      const correlationKeyExpire = `corr-outbox-expire-${randomUUID()}`;
      const toExpire = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId: proposalForExpire,
          waitType: 'TIMER',
          correlationKey: correlationKeyExpire,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        },
        actorId
      );
      waitIds.push(toExpire.waitId);

      const toCancel = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId: proposalForCancel,
          waitType: 'HUMAN',
          correlationKey: `corr-outbox-cancel-${randomUUID()}`,
        },
        actorId
      );
      waitIds.push(toCancel.waitId);

      // -- Non-mutating outcomes emit nothing.
      const replay = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId: proposalForExpire,
          waitType: 'TIMER',
          correlationKey: correlationKeyExpire,
        },
        actorId
      );
      expect(replay.waitId).toBe(toExpire.waitId);
      expect(await readOutboxRowsForAggregate(toExpire.waitId)).toHaveLength(1);

      // A HUMAN wait is not claimable — no row changes, so no fact exists.
      expect((await waitSubscriptionService.claimTimerWait(toCancel.waitId)).outcome).toBe(
        'not_claimable'
      );
      expect(await readOutboxRowsForAggregate(toCancel.waitId)).toHaveLength(1);

      // A fenced renew (wrong owner token) changes nothing either.
      expect(
        await waitSubscriptionService.renewTimerWaitClaimLease(toExpire.waitId, 'not-the-owner', 0)
      ).toBe('fenced');
      expect(await readOutboxRowsForAggregate(toExpire.waitId)).toHaveLength(1);

      // -- expireWait: scheduler actor.
      const expired = await waitSubscriptionService.expireWait(toExpire.waitId, toExpire.version);
      expect(expired.status).toBe('EXPIRED');
      const expireRows = await readOutboxRowsForAggregate(toExpire.waitId);
      expect(expireRows).toHaveLength(2);
      const expiredEvent = expectOneEvent(expireRows, 1, {
        aggregateId: toExpire.waitId,
        organizationId: orgId,
        projectId,
        caseId,
        eventType: 'wait.expired',
        actorUserId: 'system:case-workspace-wait-scheduler',
        aggregateVersion: expired.version,
      });
      expect(expiredEvent.redacted_summary.from).toBe('ACTIVE');
      expect(expiredEvent.redacted_summary.to).toBe('EXPIRED');

      // -- cancelWait: human actor, no reason text.
      const cancelled = await waitSubscriptionService.cancelWait(
        toCancel.waitId,
        { actorUserId: actorId },
        cancelReason,
        toCancel.version
      );
      expect(cancelled.status).toBe('CANCELLED');
      const cancelRows = await readOutboxRowsForAggregate(toCancel.waitId);
      expect(cancelRows).toHaveLength(2);
      const cancelledEvent = expectOneEvent(cancelRows, 1, {
        aggregateId: toCancel.waitId,
        organizationId: orgId,
        projectId,
        caseId,
        eventType: 'wait.cancelled',
        actorUserId: actorId,
        aggregateVersion: cancelled.version,
      });
      const cancelSummary = JSON.stringify(cancelledEvent.redacted_summary);
      expect(cancelSummary).not.toContain('anna.nowak@example.test');
      expect(cancelSummary).not.toContain('withdrew consent');
      expect(cancelledEvent.redacted_summary.reasonClass).toBe('unclassified');
      expect(String(cancelledEvent.redacted_summary.reasonDigest)).toMatch(/^sha256:[0-9a-f]{32}$/);
    } finally {
      await teardown({
        waitIds,
        runIds: [runId],
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId],
      });
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 12. ATOMICITY — §8 "Wait satisfaction is atomic and unique". Force the
  //     transaction to fail AT COMMIT, after both the status flip and the
  //     publishEvent INSERT have run on its client, and prove NEITHER survived.
  //     A publishEvent that opened its own connection (or published after
  //     commit) would leave the event here with no satisfied wait behind it.
  // -------------------------------------------------------------------------
  it('rolls the outbox row back together with the wait mutation when the transaction fails after both were written', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-rollback');
    const runId = `run-t12-${randomUUID()}`;
    const waitIds: string[] = [];
    let dropTrigger: (() => Promise<void>) | null = null;
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'outbox-rollback',
      });

      const created = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey: `corr-outbox-rollback-${randomUUID()}`,
        },
        actorId
      );
      waitIds.push(created.waitId);
      expect(await readOutboxRowsForAggregate(created.waitId)).toHaveLength(1);

      dropTrigger = await installCommitFailureTrigger(created.waitId);

      const inputRef = `humaninput-rollback-${randomUUID()}`;
      await expect(
        waitSubscriptionService.provideHumanInput(
          created.waitId,
          { inputRef, actorUserId: actorId },
          created.version
        )
      ).rejects.toThrow(/cw_test_forced_commit_failure/);

      // The wait never moved...
      const row = await readWaitRow(created.waitId);
      expect(row?.status).toBe('ACTIVE');
      expect(Number(row?.version)).toBe(created.version);
      expect(row?.satisfied_at).toBeNull();

      // ...and no event was left behind.
      const after = await readOutboxRowsForAggregate(created.waitId);
      expect(after).toHaveLength(1);
      expect(after.map((r) => r.event_type)).not.toContain('wait.human_input_provided');

      // Control: with the trigger gone the identical call succeeds AND emits —
      // proving the rollback above was the forced commit failure, not a missing
      // event wiring.
      await dropTrigger();
      dropTrigger = null;

      const satisfied = await waitSubscriptionService.provideHumanInput(
        created.waitId,
        { inputRef, actorUserId: actorId },
        created.version
      );
      expect(satisfied.status).toBe('SATISFIED');

      const final = await readOutboxRowsForAggregate(created.waitId);
      expect(final).toHaveLength(2);
      expect(final[1]?.event_type).toBe('wait.human_input_provided');
      expect(final[1]?.payload_ref).toBe(inputRef);
    } finally {
      if (dropTrigger) await dropTrigger().catch(() => undefined);
      await teardown({
        waitIds,
        runIds: [runId],
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId],
      });
    }
  }, 60_000);

  // ==========================================================================
  // SCHEDULER COMPLETION (doc 06 §8): heartbeat, and expired-lease recovery
  // GUARDED BY A MANDATORY IDEMPOTENCY / RECONCILIATION CHECK.
  //
  // WHY THESE ARE SEPARATE FROM THE claimTimerWait TESTS ABOVE. Test 3 above
  // proves claimTimerWait WILL take an expired lease — with no check of any
  // kind. That is precisely what §8 forbids for abandoned work ("Expired leases
  // are reclaimed only after idempotency or reconciliation checks"), so the
  // recovery path is a DIFFERENT function with a mandatory callback, and these
  // tests exist to prove the callback is genuinely consulted and genuinely
  // decisive rather than decorative.
  // ==========================================================================

  /** Forces the lease into the past out of band — the only honest way to
   *  observe expiry without sleeping through a real lease. */
  async function expireClaimLease(waitId: string): Promise<void> {
    await control.query(
      `UPDATE case_workspace_waits
          SET claim_lease_expires_at = (NOW() - interval '1 minute')::text
        WHERE wait_id = $1`,
      [waitId]
    );
  }

  async function seedClaimedTimerWait(
    label: string
  ): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    actorId: string;
    runId: string;
    waitId: string;
    ownerToken: string;
    fencingToken: number;
  }> {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase(label);
    const runId = `run-${label}-${randomUUID()}`;
    await seedV8Run({ runId, organizationId: orgId });
    const actionProposalId = await seedActionProposal({ caseId, runId, actorId, tag: label });
    const wait = await waitSubscriptionService.createWait(
      {
        caseId,
        actionProposalId,
        waitType: 'TIMER',
        correlationKey: `corr-${label}-${randomUUID()}`,
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      },
      actorId
    );
    const claim = await waitSubscriptionService.claimTimerWait(wait.waitId, { leaseMs: 60_000 });
    if (claim.outcome !== 'claimed') throw new Error('fixture claim failed');
    return {
      orgId,
      projectId,
      caseId,
      actorId,
      runId,
      waitId: wait.waitId,
      ownerToken: claim.ownerToken,
      fencingToken: claim.fencingToken,
    };
  }

  it('reclaimExpiredTimerWaitClaim consults the reconciliation check, and an already-applied verdict SATISFIES the wait from the readback instead of handing it to a new worker', async () => {
    const fixture = await seedClaimedTimerWait('reclaim-applied');
    try {
      // A live lease must be refused outright — the check is not even reached,
      // because taking a live lease is never correct.
      let consulted = 0;
      const live = await waitSubscriptionService.reclaimExpiredTimerWaitClaim(
        fixture.waitId,
        () => {
          consulted += 1;
          return { alreadyApplied: false };
        }
      );
      expect(live.outcome).toBe('lease_active');
      expect(consulted).toBe(0);

      await expireClaimLease(fixture.waitId);

      const outcome = await waitSubscriptionService.reclaimExpiredTimerWaitClaim(
        fixture.waitId,
        () => {
          consulted += 1;
          // The readback proves the dead worker's effect DID land.
          return { alreadyApplied: true, satisfiedByEventId: 'vendor:readback-1' };
        }
      );
      // The check ran exactly once, and it decided the outcome.
      expect(consulted).toBe(1);
      expect(outcome.outcome).toBe('already_applied');

      const row = await readWaitRow(fixture.waitId);
      expect(row?.status).toBe('SATISFIED');
      expect(row?.satisfied_by_event_id).toBe('vendor:readback-1');
      // No new lease was granted — that is what "not retried" means concretely.
      expect(row?.claim_owner_token).toBeNull();
      // The fencing token did NOT advance: nobody took the work.
      expect(Number(row?.claim_fencing_token)).toBe(fixture.fencingToken);

      const events = await readOutboxRowsForAggregate(fixture.waitId);
      expect(events.map((e) => e.event_type)).toContain('wait.reconciled_already_applied');
      // Not a claim — the wait was closed, not handed over.
      expect(events.map((e) => e.event_type)).not.toContain('wait.claim_reclaimed');

      // The callback is mandatory; there is no permissive default.
      await expect(
        // @ts-expect-error deliberately omitting the mandatory reconciliation check
        waitSubscriptionService.reclaimExpiredTimerWaitClaim(fixture.waitId)
      ).rejects.toThrow('wait_reconciliation_required');
    } finally {
      await teardown({
        waitIds: [fixture.waitId],
        runIds: [fixture.runId],
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId],
      });
    }
  }, 60_000);

  it('lets exactly one of two concurrent workers reclaim the same expired timer-wait lease', async () => {
    const fixture = await seedClaimedTimerWait('reclaim-race');
    try {
      await expireClaimLease(fixture.waitId);

      const results = await Promise.all([
        waitSubscriptionService.reclaimExpiredTimerWaitClaim(fixture.waitId, () => ({
          alreadyApplied: false,
        })),
        waitSubscriptionService.reclaimExpiredTimerWaitClaim(fixture.waitId, () => ({
          alreadyApplied: false,
        })),
      ]);

      const winners = results.filter((r) => r.outcome === 'reclaimed');
      expect(winners).toHaveLength(1);
      // The loser must not report success under another name.
      expect(results.find((r) => r.outcome !== 'reclaimed')?.outcome).toBe('lease_active');

      const row = await readWaitRow(fixture.waitId);
      // Exactly ONE bump beyond the original claim — not two.
      expect(Number(row?.claim_fencing_token)).toBe(fixture.fencingToken + 1);
      const winner = winners[0];
      if (winner.outcome !== 'reclaimed') throw new Error('unreachable');
      expect(row?.claim_owner_token).toBe(winner.ownerToken);

      // The superseded worker is fenced out of both the heartbeat and the
      // satisfaction path.
      expect(
        await waitSubscriptionService.renewTimerWaitClaimLease(
          fixture.waitId,
          fixture.ownerToken,
          fixture.fencingToken
        )
      ).toBe('fenced');
      await expect(
        waitSubscriptionService.resolveWait(
          fixture.waitId,
          {
            satisfiedByEventId: 'zombie-effect',
            timerClaim: { ownerToken: fixture.ownerToken, fencingToken: fixture.fencingToken },
          },
          Number(row?.version)
        )
      ).rejects.toThrow('wait_claim_fenced');
      expect((await readWaitRow(fixture.waitId))?.status).toBe('ACTIVE');
    } finally {
      await teardown({
        waitIds: [fixture.waitId],
        runIds: [fixture.runId],
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId],
      });
    }
  }, 60_000);

  it('startTimerWaitClaimHeartbeat keeps a lease alive and reports loss of ownership exactly once when the claim is fenced', async () => {
    const fixture = await seedClaimedTimerWait('heartbeat');
    try {
      const before = await readWaitRow(fixture.waitId);

      // --- PHASE 1: the heartbeat genuinely keeps the lease alive. ---------
      const keptAliveLosses: string[] = [];
      const stopAlive = waitSubscriptionService.startTimerWaitClaimHeartbeat(
        fixture.waitId,
        fixture.ownerToken,
        fixture.fencingToken,
        { intervalMs: 250, leaseMs: 60_000, onLost: (outcome) => keptAliveLosses.push(outcome) }
      );
      try {
        // POLL rather than sleep a fixed interval: under a loaded parallel
        // suite a single heartbeat round-trip can take seconds, and a fixed
        // 200ms window would measure the machine, not the heartbeat.
        const baseline = Date.parse(String(before?.claim_lease_expires_at));
        let during = before;
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline) {
          during = await readWaitRow(fixture.waitId);
          if (Date.parse(String(during?.claim_lease_expires_at)) > baseline) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        // Pushed forward, not merely "not erroring".
        expect(Date.parse(String(during?.claim_lease_expires_at))).toBeGreaterThan(baseline);
        expect(keptAliveLosses).toHaveLength(0);
        // A heartbeat is liveness, not a domain transition: it must NOT bump the
        // OCC version, or it would invalidate its own worker's pending write.
        expect(Number(during?.version)).toBe(Number(before?.version));
      } finally {
        stopAlive();
      }

      // --- PHASE 2: ownership is lost, and the heartbeat notices. ----------
      // The heartbeat is stopped FIRST on purpose: while it runs it keeps
      // pushing the lease into the future, so a lease forced into the past
      // would simply be renewed away before any reclaim could see it. That the
      // takeover is only possible once the heartbeat stops is itself the proof
      // that phase 1 was real work and not a no-op.
      //
      // stop() prevents FUTURE ticks but cannot un-issue a renewal already in
      // flight, and under a loaded parallel suite that in-flight UPDATE can
      // land after expireClaimLease(). The retry below absorbs exactly that
      // scheduling artifact — it is bounded, and a genuine failure to reclaim
      // still fails the test on the final assertion rather than looping.
      const reclaim = await (async () => {
        const deadline = Date.now() + 20_000;
        let last = await waitSubscriptionService.reclaimExpiredTimerWaitClaim(
          fixture.waitId,
          () => ({ alreadyApplied: false })
        );
        while (last.outcome === 'lease_active' && Date.now() < deadline) {
          await expireClaimLease(fixture.waitId);
          last = await waitSubscriptionService.reclaimExpiredTimerWaitClaim(
            fixture.waitId,
            () => ({ alreadyApplied: false })
          );
        }
        return last;
      })();
      expect(reclaim.outcome).toBe('reclaimed');

      const lost: string[] = [];
      const stopFenced = waitSubscriptionService.startTimerWaitClaimHeartbeat(
        fixture.waitId,
        fixture.ownerToken,
        fixture.fencingToken,
        { intervalMs: 250, leaseMs: 60_000, onLost: (outcome) => lost.push(outcome) }
      );
      try {
        const deadline = Date.now() + 20_000;
        while (lost.length === 0 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        // Give at least two further intervals a chance to fire, so "exactly
        // once" is a real claim about the loop STOPPING and not just about timing.
        await new Promise((resolve) => setTimeout(resolve, 900));
        // Reported EXACTLY once, and the loop stopped: a heartbeat that kept
        // retrying after being fenced would be worse than no heartbeat at all.
        expect(lost).toEqual(['fenced']);
      } finally {
        stopFenced();
      }
    } finally {
      await teardown({
        waitIds: [fixture.waitId],
        runIds: [fixture.runId],
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId],
      });
    }
  }, 60_000);

  it('listExpiredTimerWaitClaimsForRecovery returns abandoned claims and excludes both live leases and never-claimed waits', async () => {
    const abandoned = await seedClaimedTimerWait('recovery-scan-abandoned');
    const live = await seedClaimedTimerWait('recovery-scan-live');
    const neverClaimed = await seedOrgProjectCase('recovery-scan-fresh');
    const freshRunId = `run-recovery-fresh-${randomUUID()}`;
    let freshWaitId = '';
    try {
      await seedV8Run({ runId: freshRunId, organizationId: neverClaimed.orgId });
      const freshProposalId = await seedActionProposal({
        caseId: neverClaimed.caseId,
        runId: freshRunId,
        actorId: neverClaimed.actorId,
        tag: 'recovery-scan-fresh',
      });
      const freshWait = await waitSubscriptionService.createWait(
        {
          caseId: neverClaimed.caseId,
          actionProposalId: freshProposalId,
          waitType: 'TIMER',
          correlationKey: `corr-recovery-fresh-${randomUUID()}`,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        },
        neverClaimed.actorId
      );
      freshWaitId = freshWait.waitId;

      await expireClaimLease(abandoned.waitId);

      const candidates = await waitSubscriptionService.listExpiredTimerWaitClaimsForRecovery(
        new Date(),
        500
      );
      const ids = candidates.map((c) => c.waitId);
      expect(ids).toContain(abandoned.waitId);
      // A live lease is not abandoned work.
      expect(ids).not.toContain(live.waitId);
      // A never-claimed wait belongs to listDueTimerWaitsForClaim, not here —
      // routing it through the recovery path would demand a pointless readback.
      expect(ids).not.toContain(freshWaitId);
      expect(await waitSubscriptionService.listDueTimerWaitsForClaim(new Date(), 500)).toEqual(
        expect.arrayContaining([expect.objectContaining({ waitId: freshWaitId })])
      );
    } finally {
      await teardown({
        waitIds: [freshWaitId].filter(Boolean),
        runIds: [freshRunId],
        orgIds: [neverClaimed.orgId],
        projectIds: [neverClaimed.projectId],
        userIds: [neverClaimed.actorId],
      });
      await teardown({
        waitIds: [abandoned.waitId],
        runIds: [abandoned.runId],
        orgIds: [abandoned.orgId],
        projectIds: [abandoned.projectId],
        userIds: [abandoned.actorId],
      });
      await teardown({
        waitIds: [live.waitId],
        runIds: [live.runId],
        orgIds: [live.orgId],
        projectIds: [live.projectId],
        userIds: [live.actorId],
      });
    }
  }, 90_000);

  // ==========================================================================
  // GAP-E-04 — THE ROUTE-EXPOSED SATISFACTION PATH (`input.actorUserId` set).
  //
  // `POST /waits/:waitId/resolve` used to accept ANY `satisfiedByEventId`, so a
  // member could declare an EXTERNAL_CALLBACK wait satisfied by an event that
  // existed nowhere, and the outbox then attributed the act to
  // `system:case-workspace-wait-resolver` rather than to the human who did it.
  // Two separate lies: about the world, and about who spoke.
  //
  // These tests drive the SERVICE on the same input shape the route now sends
  // (`{ satisfiedByEventId, actorUserId }`), and each asserts the DATABASE
  // afterwards — the wait row and the outbox — never the return value alone.
  // ==========================================================================

  /**
   * TEST-FIXTURE-ONLY direct INSERT into `case_workspace_event_inbox` via the
   * out-of-band control Pool. It stands in for eventInboxService.
   * receiveExternalEvent, which is the only production writer — deliberately
   * NOT called here, so this suite proves the wait service's own gate rather
   * than the inbox's.
   */
  async function seedInboxRecord(params: {
    source: string;
    eventId: string;
    organizationId: string;
    correlationKey: string;
    eventType: string;
    caseId?: string | null;
    waitId?: string | null;
  }): Promise<string> {
    const inboxRecordId = `cwinbox-${randomUUID()}`;
    await control.query(
      `INSERT INTO case_workspace_event_inbox
         (inbox_record_id, event_id, source, event_type, organization_id,
          case_id, correlation_key, wait_id, status, payload_digest)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'RECEIVED', $9)`,
      [
        inboxRecordId,
        params.eventId,
        params.source,
        params.eventType,
        params.organizationId,
        params.caseId ?? null,
        params.correlationKey,
        params.waitId ?? null,
        `sha256:${randomUUID().replace(/-/g, '')}`,
      ]
    );
    return inboxRecordId;
  }

  async function deleteInboxRecords(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await control
      .query(`DELETE FROM case_workspace_event_inbox WHERE inbox_record_id = ANY($1)`, [ids])
      .catch(() => undefined);
  }

  it('GAP-E-04: the authenticated resolve path REFUSES a satisfiedByEventId that exists in no inbox record, and leaves the wait ACTIVE with no event', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('gap-e04-fabricated');
    const runId = `run-gap-e04-fabricated-${randomUUID()}`;
    let waitId = '';
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'gap-e04-fabricated',
      });
      const wait = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'EXTERNAL_CALLBACK',
          correlationKey: `corr-gap-e04-fabricated-${randomUUID()}`,
          expectedEventType: 'vendor.invoice.delivered',
        },
        actorId
      );
      waitId = wait.waitId;

      // The exact payload the live stack accepted before this fix.
      await expect(
        waitSubscriptionService.resolveWait(
          waitId,
          { satisfiedByEventId: `vendor:evt-never-existed-${randomUUID()}`, actorUserId: actorId },
          wait.version
        )
      ).rejects.toThrow('wait_satisfying_event_not_found');

      // A ref that is not even shaped like an inbox key is refused on shape,
      // which leaks nothing about what does or does not exist.
      await expect(
        waitSubscriptionService.resolveWait(
          waitId,
          { satisfiedByEventId: 'evt-no-source-prefix', actorUserId: actorId },
          wait.version
        )
      ).rejects.toThrow('wait_satisfying_event_ref_invalid');

      // (b) THE DATABASE: nothing moved.
      const row = await control.query<{ status: string; version: number; satisfied_by_event_id: string | null }>(
        `SELECT status, version, satisfied_by_event_id FROM case_workspace_waits WHERE wait_id = $1`,
        [waitId]
      );
      expect(row.rows[0].status).toBe('ACTIVE');
      expect(Number(row.rows[0].version)).toBe(Number(wait.version));
      expect(row.rows[0].satisfied_by_event_id).toBeNull();

      // (c) THE TRAIL: a refusal is not a fact, so no satisfaction was recorded.
      const events = await control.query<{ event_type: string }>(
        `SELECT event_type FROM case_workspace_event_outbox WHERE aggregate_id = $1`,
        [waitId]
      );
      expect(events.rows.map((e) => e.event_type)).not.toContain('wait.satisfied');
    } finally {
      await teardown({
        waitIds: [waitId].filter(Boolean),
        runIds: [runId],
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId],
      });
    }
  }, 60_000);

  it('GAP-E-04: a REAL inbox record for this tenant and this wait satisfies it, and the outbox names the HUMAN actor — never the system resolver', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('gap-e04-real');
    const runId = `run-gap-e04-real-${randomUUID()}`;
    const inboxIds: string[] = [];
    let waitId = '';
    try {
      await seedV8Run({ runId, organizationId: orgId });
      const actionProposalId = await seedActionProposal({
        caseId,
        runId,
        actorId,
        tag: 'gap-e04-real',
      });
      const correlationKey = `corr-gap-e04-real-${randomUUID()}`;
      const wait = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId,
          waitType: 'EXTERNAL_CALLBACK',
          correlationKey,
          expectedEventType: 'vendor.invoice.delivered',
        },
        actorId
      );
      waitId = wait.waitId;

      // A real event that arrived — but correlated to a DIFFERENT wait. Real
      // existence alone must not be enough, or any member could borrow any
      // event in their own tenant to close any wait they can see.
      const foreignEventId = `evt-foreign-${randomUUID()}`;
      inboxIds.push(
        await seedInboxRecord({
          source: 'vendor',
          eventId: foreignEventId,
          organizationId: orgId,
          correlationKey: `corr-somebody-else-${randomUUID()}`,
          eventType: 'vendor.invoice.delivered',
        })
      );
      await expect(
        waitSubscriptionService.resolveWait(
          waitId,
          { satisfiedByEventId: `vendor:${foreignEventId}`, actorUserId: actorId },
          wait.version
        )
      ).rejects.toThrow('wait_satisfying_event_correlation_mismatch');

      // The genuine article: same tenant, same correlation key, the event type
      // the wait declared it was waiting for.
      const eventId = `evt-real-${randomUUID()}`;
      inboxIds.push(
        await seedInboxRecord({
          source: 'vendor',
          eventId,
          organizationId: orgId,
          correlationKey,
          eventType: 'vendor.invoice.delivered',
          caseId,
        })
      );

      const resolved = await waitSubscriptionService.resolveWait(
        waitId,
        { satisfiedByEventId: `vendor:${eventId}`, actorUserId: actorId },
        wait.version
      );
      expect(resolved.status).toBe('SATISFIED');

      // (b) THE DATABASE.
      const row = await control.query<{ status: string; satisfied_by_event_id: string }>(
        `SELECT status, satisfied_by_event_id FROM case_workspace_waits WHERE wait_id = $1`,
        [waitId]
      );
      expect(row.rows[0].status).toBe('SATISFIED');
      expect(row.rows[0].satisfied_by_event_id).toBe(`vendor:${eventId}`);

      // (c) THE TRAIL — the point of the whole fix.
      const events = await control.query<{ event_type: string; actor_user_id: string }>(
        `SELECT event_type, actor_user_id FROM case_workspace_event_outbox
          WHERE aggregate_id = $1 AND event_type = 'wait.satisfied'`,
        [waitId]
      );
      expect(events.rows).toHaveLength(1);
      expect(events.rows[0].actor_user_id).toBe(actorId);
      expect(events.rows[0].actor_user_id).not.toBe('system:case-workspace-wait-resolver');
    } finally {
      await deleteInboxRecords(inboxIds);
      await teardown({
        waitIds: [waitId].filter(Boolean),
        runIds: [runId],
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId],
      });
    }
  }, 60_000);

  it('GAP-E-04: a cross-tenant inbox record is indistinguishable from one that never arrived, and HUMAN/TIMER waits are refused on the authenticated path', async () => {
    const victim = await seedOrgProjectCase('gap-e04-victim');
    const intruderOrg = await seedOrgProjectCase('gap-e04-intruder');
    const runId = `run-gap-e04-types-${randomUUID()}`;
    const inboxIds: string[] = [];
    const waitIds: string[] = [];
    try {
      await seedV8Run({ runId, organizationId: victim.orgId });
      const actionProposalId = await seedActionProposal({
        caseId: victim.caseId,
        runId,
        actorId: victim.actorId,
        tag: 'gap-e04-types',
      });
      const correlationKey = `corr-gap-e04-types-${randomUUID()}`;
      const callbackWait = await waitSubscriptionService.createWait(
        {
          caseId: victim.caseId,
          actionProposalId,
          waitType: 'EXTERNAL_CALLBACK',
          correlationKey,
        },
        victim.actorId
      );
      waitIds.push(callbackWait.waitId);

      // An event that DID arrive — for another organization. Same source, same
      // correlation key; only the tenant differs.
      const eventId = `evt-other-tenant-${randomUUID()}`;
      inboxIds.push(
        await seedInboxRecord({
          source: 'vendor',
          eventId,
          organizationId: intruderOrg.orgId,
          correlationKey,
          eventType: 'vendor.invoice.delivered',
        })
      );
      // The SAME code a nonexistent event gets — no oracle (SEC-009 posture).
      await expect(
        waitSubscriptionService.resolveWait(
          callbackWait.waitId,
          { satisfiedByEventId: `vendor:${eventId}`, actorUserId: victim.actorId },
          callbackWait.version
        )
      ).rejects.toThrow('wait_satisfying_event_not_found');

      // HUMAN has its own command (`provideHumanInput`, a different event type)
      // and TIMER is CAS-gated on a scheduler-only claim token, so neither may
      // travel this path at all.
      const humanWait = await waitSubscriptionService.createWait(
        {
          caseId: victim.caseId,
          actionProposalId,
          waitType: 'HUMAN',
          correlationKey: `corr-gap-e04-human-${randomUUID()}`,
        },
        victim.actorId
      );
      waitIds.push(humanWait.waitId);
      await expect(
        waitSubscriptionService.resolveWait(
          humanWait.waitId,
          { satisfiedByEventId: 'vendor:whatever', actorUserId: victim.actorId },
          humanWait.version
        )
      ).rejects.toThrow('wait_wrong_type_for_event_resolution');

      const timerWait = await waitSubscriptionService.createWait(
        {
          caseId: victim.caseId,
          actionProposalId,
          waitType: 'TIMER',
          correlationKey: `corr-gap-e04-timer-${randomUUID()}`,
          dueAt: new Date(Date.now() + 60_000).toISOString(),
        },
        victim.actorId
      );
      waitIds.push(timerWait.waitId);
      await expect(
        waitSubscriptionService.resolveWait(
          timerWait.waitId,
          { satisfiedByEventId: 'vendor:whatever', actorUserId: victim.actorId },
          timerWait.version
        )
      ).rejects.toThrow('wait_wrong_type_for_event_resolution');

      // NEGATIVE CONTROL — the INTERNAL path (no actorUserId) is untouched by
      // any of this: the scheduler still satisfies its own TIMER wait, under
      // the system token, with no inbox evidence required.
      const claim = await waitSubscriptionService.claimTimerWait(timerWait.waitId);
      if (claim.outcome !== 'claimed') throw new Error('fixture claim failed');
      const internallyResolved = await waitSubscriptionService.resolveWait(
        timerWait.waitId,
        {
          satisfiedByEventId: `scheduler:timer-${randomUUID()}`,
          timerClaim: { ownerToken: claim.ownerToken, fencingToken: claim.fencingToken },
        },
        claim.wait.version
      );
      expect(internallyResolved.status).toBe('SATISFIED');
      const systemEvent = await control.query<{ actor_user_id: string }>(
        `SELECT actor_user_id FROM case_workspace_event_outbox
          WHERE aggregate_id = $1 AND event_type = 'wait.satisfied'`,
        [timerWait.waitId]
      );
      expect(systemEvent.rows[0].actor_user_id).toBe('system:case-workspace-wait-resolver');

      // And the victim's callback wait never moved.
      const untouched = await control.query<{ status: string }>(
        `SELECT status FROM case_workspace_waits WHERE wait_id = $1`,
        [callbackWait.waitId]
      );
      expect(untouched.rows[0].status).toBe('ACTIVE');
    } finally {
      await deleteInboxRecords(inboxIds);
      await teardown({
        waitIds,
        runIds: [runId],
        orgIds: [victim.orgId],
        projectIds: [victim.projectId],
        userIds: [victim.actorId],
      });
      await teardown({
        waitIds: [],
        runIds: [],
        orgIds: [intruderOrg.orgId],
        projectIds: [intruderOrg.projectId],
        userIds: [intruderOrg.actorId],
      });
    }
  }, 90_000);
});
