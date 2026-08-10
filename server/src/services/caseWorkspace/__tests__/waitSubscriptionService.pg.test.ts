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
      ).rejects.toThrow(/case_access_denied/);

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
});
