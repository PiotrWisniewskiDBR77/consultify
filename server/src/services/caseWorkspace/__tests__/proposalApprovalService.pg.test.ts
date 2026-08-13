/**
 * Case Workspace — Action Proposal + Approval service, proved against a REAL
 * PostgreSQL (CW-P05, EPIC E6 "Proposals, autonomy and approvals"). Exercises
 * server/src/services/caseWorkspace/proposalApprovalService.ts against the
 * schema in
 * server/migrations/20260809_case_workspace_proposals_approvals.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as caseCoreService.pg.test.ts (CW-P01),
 * casePlanVersionService.pg.test.ts (CW-P02),
 * capabilityRegistryService.pg.test.ts (CW-P03) and
 * runBindingService.pg.test.ts (CW-P04): `NODE_ENV=test` ALONE is a trap —
 * `Database.ts`'s `getDatabase()`/`createDatabase()` hand back an in-memory
 * MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly
 * `'false'`), and every write silently becomes a no-op. This file follows the
 * `*.pg.test.ts` convention: gate on `RUN_DB_TESTS === '1' && MOCK_DB ===
 * 'false'`, probe reachability AND that the migrated schema is actually
 * present before deciding, and SKIP LOUDLY (never silently pass) when either
 * is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/proposalApprovalService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own organization/project/case_core/
 * v8_execution_runs/action-proposal fixtures
 * ===========================================================================
 * `case_workspace_action_proposals` FKs to `case_core(case_id)` and
 * `v8_execution_runs(run_id)` (both required), and optionally to
 * `case_plan_versions(case_plan_version_id)` and
 * `case_workspace_capabilities(capability_registry_id)`. This packet's own
 * service (proposalApprovalService.ts) only ever SELECTs those four tables —
 * it has no create-helper for case_core or v8_execution_runs, so tests need
 * their own fixture helpers. `seedV8Run()` below is copied verbatim from
 * runBindingService.pg.test.ts (same TEST-FIXTURE-ONLY direct INSERT against
 * v8_execution_runs via the out-of-band `pg.Pool`, never added to production
 * code) — its column list matches the NOT NULL columns of
 * server/migrations/20260323_v8_execution_spine_00base.sql exactly: run_id,
 * organization_id, context_snapshot_id, initiator_user_id, goal.
 *
 * Every test seeds its own case_core + v8_execution_runs fixture inside the
 * test body (never a shared beforeEach) and tears it down itself in a
 * `finally`, so no test can observe, reset, or race another test's rows.
 * Teardown order matters: `case_workspace_action_proposal_decisions` cascades
 * off `case_workspace_action_proposals` (ON DELETE CASCADE), but proposals
 * themselves have no ON DELETE clause on either their case_core or
 * v8_execution_runs FK (RESTRICT/NO ACTION), so proposals must be deleted
 * BEFORE their referenced v8_execution_runs/case_core rows.
 *
 * All assertions read the actual `case_workspace_action_proposals`/
 * `case_workspace_action_proposal_decisions` rows back out of Postgres
 * through a dedicated, out-of-band `pg.Pool` (`control`) — never the service
 * function's return value alone — because the return value only proves what
 * the service THINKS it wrote, not what actually landed. This is
 * security-governance-critical code (self-approval, expiry, staleness,
 * target-invalidation), so every negative case below also asserts the DB was
 * left untouched, not merely that the promise rejected.
 *
 * ===========================================================================
 * AUTHORIZATION (CW-P12 retrofit) — every actor is a real, membered user
 * ===========================================================================
 * proposalApprovalService.ts now gates every method through
 * caseWorkspaceAuthContext.ts's requireCaseAccess. Every actor id used below
 * (actor-A the proposer, actor-B the decider, actor-executor, etc.) is
 * therefore a real `users` row with a matching ACTIVE `organization_members`
 * row for the Case's org — seeded here via direct INSERTs on the
 * out-of-band pool (seedUser/seedMember), a test-fixture-only direct insert.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as casePlanVersionService from '../casePlanVersionService.js';
import type { CanonicalGraph, CasePlanVersion } from '../casePlanVersionService.js';
import * as proposalApprovalService from '../proposalApprovalService.js';
import type {
  CreateActionProposalInput,
  RecordApprovalDecisionInput,
} from '../proposalApprovalService.js';

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
    const proposalsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_action_proposals'
          AND column_name IN ('action_proposal_id', 'case_id', 'run_id', 'node_run_id',
                               'proposal_version', 'payload_digest', 'status', 'expires_at',
                               'idempotency_key', 'created_by_actor_id', 'version')`
    );
    const proposalsOk = Number(proposalsResult.rows[0]?.present ?? 0) === 11;

    const decisionsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_action_proposal_decisions'
          AND column_name IN ('decision_id', 'action_proposal_id', 'proposal_version',
                               'payload_digest', 'decision', 'decided_by_actor_id',
                               'idempotency_key')`
    );
    const decisionsOk = Number(decisionsResult.rows[0]?.present ?? 0) === 7;

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

    return proposalsOk && decisionsOk && runsOk && orgMembersOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[proposalApprovalService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_proposals_approvals.sql migration applied (on top of ` +
      `20260809_case_workspace_case_core.sql, 20260809_case_workspace_case_plan_version.sql and ` +
      `20260323_v8_execution_spine_00base.sql). requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CaseWorkspaceActionProposalDbRow {
  action_proposal_id: string;
  case_id: string;
  run_id: string;
  node_run_id: string;
  proposal_version: number;
  payload_digest: string;
  case_plan_version_id: string | null;
  status: string;
  expires_at: string | null;
  idempotency_key: string;
  created_by_actor_id: string;
  version: number;
}

interface CaseWorkspaceActionProposalDecisionDbRow {
  decision_id: string;
  action_proposal_id: string;
  proposal_version: number;
  payload_digest: string;
  decision: string;
  decided_by_actor_id: string;
  idempotency_key: string;
}

/**
 * The transactional outbox row (server/migrations/
 * 20260810_case_workspace_event_outbox.sql). Read ONLY through the out-of-band
 * `control` pool, after the service call has returned and its transaction has
 * committed — a value returned by publishEvent proves nothing about what
 * survived COMMIT, which is the entire property under test.
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

suite(
  'proposalApprovalService — Action Proposal + Approval against a real PostgreSQL (CW-P05, E6)',
  () => {
    let control: Pool;

    beforeAll(async () => {
      control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    }, 60_000);

    afterAll(async () => {
      await control?.end().catch(() => undefined);
    }, 60_000);

    // -----------------------------------------------------------------------
    // Fixture helpers — every test calls these itself, never a shared hook.
    // -----------------------------------------------------------------------

    /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
    async function seedUser(orgId: string, label: string): Promise<string> {
      const userId = `case-propapp-user-${label}-${randomUUID()}`;
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
        [`case-propapp-member-${randomUUID()}`, orgId, userId, role, status]
      );
    }

    /** Convenience: seed a user AND an ACTIVE membership at MEMBER role in one call. */
    async function seedMemberedUser(orgId: string, label: string): Promise<string> {
      const userId = await seedUser(orgId, label);
      await seedMember(orgId, userId, 'MEMBER');
      return userId;
    }

    /**
     * A fresh organization + project + case_core row, all uniquely named,
     * plus a real membered actor to create the Case with. Same bundle as
     * runBindingService.pg.test.ts's seedOrgProjectCase().
     */
    async function seedOrgProjectCase(
      label: string
    ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
      const suffix = randomUUID();
      const orgId = `case-propapp-org-${label}-${suffix}`;
      const projectId = `case-propapp-project-${label}-${suffix}`;
      await control.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [orgId, `Proposal Approval test org (${label})`]
      );
      await control.query(
        `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
        [projectId, orgId, `Proposal Approval test project (${label})`]
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
     * out-of-band control Pool, copied verbatim from
     * runBindingService.pg.test.ts's own seedV8Run(). proposalApprovalService.ts
     * never does this itself — it only ever SELECTs this table — so tests need
     * their own minimal-valid-row helper. Column list matches exactly the NOT
     * NULL columns in server/migrations/20260323_v8_execution_spine_00base.sql:
     * run_id, organization_id, context_snapshot_id, initiator_user_id, goal
     * (state defaults to 'drafting', plan_version/created_at/updated_at/metadata
     * all carry their own DEFAULTs).
     */
    async function seedV8Run(params: {
      runId: string;
      organizationId: string;
      goal?: string;
    }): Promise<void> {
      await control.query(
        `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (run_id) DO NOTHING`,
        [
          params.runId,
          params.organizationId,
          `ctx-snapshot-${params.runId}`,
          `initiator-${params.runId}`,
          params.goal ?? `goal for ${params.runId}`,
        ]
      );
    }

    /**
     * Full draft -> propose -> publish cycle via casePlanVersionService,
     * returning the PUBLISHED CasePlanVersion. Optionally supersedes a prior
     * published version of the same case (replan) — copied from
     * runBindingService.pg.test.ts's own publishedPlanVersion(), needed only by
     * test 7 (proposal_target_stale).
     */
    async function publishedPlanVersion(params: {
      caseId: string;
      tag: string;
      actorId: string;
      supersedesPlanVersionId?: string;
    }): Promise<CasePlanVersion> {
      const graph: CanonicalGraph = {
        schemaVersion: '1',
        graphId: `graph-${params.tag}`,
        entryNodeIds: ['n1'],
        terminalNodeIds: ['n2'],
        nodes: [
          { nodeId: 'n1', type: 'TASK', metadata: { tag: params.tag } },
          { nodeId: 'n2', type: 'TASK' },
        ],
        edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
      };
      const draft = await casePlanVersionService.createPlanDraft({
        caseId: params.caseId,
        semanticGraph: graph,
        supersedesPlanVersionId: params.supersedesPlanVersionId,
        createdByActorId: params.actorId,
      });
      const proposed = await casePlanVersionService.proposePlanVersion(
        draft.casePlanVersionId,
        { actorUserId: params.actorId },
        draft.version
      );
      return casePlanVersionService.publishPlanVersion(
        draft.casePlanVersionId,
        { actorUserId: params.actorId },
        proposed.version
      );
    }

    /**
     * A minimal, valid CreateActionProposalInput namespaced by `tag`, against
     * an already-seeded caseId/runId. Every field required by the service (and
     * by the migration's NOT NULL/CHECK constraints) is filled in; callers
     * override only what a given test needs to vary.
     */
    function minimalProposalInput(params: {
      caseId: string;
      runId: string;
      tag: string;
      createdByActorId: string;
      idempotencyKey?: string;
      payloadDigest?: string;
      expiresAt?: string | null;
      casePlanVersionId?: string | null;
    }): CreateActionProposalInput {
      return {
        caseId: params.caseId,
        runId: params.runId,
        nodeRunId: `noderun-${params.tag}`,
        casePlanVersionId: params.casePlanVersionId ?? null,
        payloadDigest: params.payloadDigest ?? `sha256:${params.tag}-payload`,
        policySnapshotRef: `policy-snapshot-${params.tag}`,
        effectClass: 'SENSITIVE_UPDATE',
        previewRef: `preview-${params.tag}`,
        expiresAt: params.expiresAt ?? null,
        proposerType: 'AGENT',
        createdByActorId: params.createdByActorId,
        idempotencyKey: params.idempotencyKey ?? `idem-${params.tag}-${randomUUID()}`,
      };
    }

    /**
     * A minimal, valid RecordApprovalDecisionInput against an already-loaded
     * proposal. Callers override proposalVersion/payloadDigest/decision/
     * decidedByActorId/idempotencyKey as the test requires.
     */
    function minimalDecisionInput(params: {
      tag: string;
      proposalVersion: number;
      payloadDigest: string;
      decision: RecordApprovalDecisionInput['decision'];
      decidedByActorId: string;
      idempotencyKey?: string;
    }): RecordApprovalDecisionInput {
      return {
        proposalVersion: params.proposalVersion,
        payloadDigest: params.payloadDigest,
        decision: params.decision,
        decidedByActorId: params.decidedByActorId,
        source: 'BUTTON',
        authenticationAssurance: 'MFA',
        approvalChannelPolicy: 'standard',
        policyVersion: 'policy-v1',
        idempotencyKey: params.idempotencyKey ?? `idem-decision-${params.tag}-${randomUUID()}`,
      };
    }

    async function readProposalRow(
      actionProposalId: string
    ): Promise<CaseWorkspaceActionProposalDbRow | null> {
      const result = await control.query<CaseWorkspaceActionProposalDbRow>(
        `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      return result.rows[0] ?? null;
    }

    async function readProposalRowsForCase(
      caseId: string
    ): Promise<CaseWorkspaceActionProposalDbRow[]> {
      const result = await control.query<CaseWorkspaceActionProposalDbRow>(
        `SELECT * FROM case_workspace_action_proposals WHERE case_id = $1 ORDER BY created_at ASC`,
        [caseId]
      );
      return result.rows;
    }

    async function readDecisionRows(
      actionProposalId: string
    ): Promise<CaseWorkspaceActionProposalDecisionDbRow[]> {
      const result = await control.query<CaseWorkspaceActionProposalDecisionDbRow>(
        `SELECT * FROM case_workspace_action_proposal_decisions
           WHERE action_proposal_id = $1 ORDER BY created_at ASC`,
        [actionProposalId]
      );
      return result.rows;
    }

    /**
     * Every outbox row this aggregate ever produced, oldest first, read out of
     * band. `event_id` breaks ties because `created_at` defaults to `now()` =
     * transaction start time, so two events from the same command would share it.
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
     * The assertion this whole packet exists for: after ONE mutating command
     * there is EXACTLY ONE new row, of the expected type, whose tenancy and
     * correlation identity is filled in from the aggregate — not from the
     * caller's hopes. Returns the row so a caller can assert type-specific
     * summary facts on top.
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
        runId: string;
        nodeRunId: string;
        actorUserId: string;
        aggregateVersion: number;
      }
    ): CaseWorkspaceEventOutboxDbRow {
      const row = rows[index];
      if (!row) throw new Error(`expected an outbox row at index ${index}, got ${rows.length} rows`);
      expect(row.event_type).toBe(expected.eventType);
      expect(row.aggregate_type).toBe('ACTION_PROPOSAL');
      expect(row.aggregate_id).toBe(expected.aggregateId);
      expect(row.organization_id).toBe(expected.organizationId);
      expect(row.project_id).toBe(expected.projectId);
      expect(row.case_id).toBe(expected.caseId);
      expect(row.run_id).toBe(expected.runId);
      expect(row.node_run_id).toBe(expected.nodeRunId);
      expect(row.actor_user_id).toBe(expected.actorUserId);
      expect(Number(row.aggregate_version)).toBe(expected.aggregateVersion);
      // NOT NULL in the schema, defaulted by the service — a hole here breaks
      // the §10 operator trace, so assert it is a real value, not just present.
      expect(typeof row.correlation_id).toBe('string');
      expect(row.correlation_id.trim().length).toBeGreaterThan(0);
      return row;
    }

    /**
     * A DEFERRABLE INITIALLY DEFERRED constraint trigger fires at COMMIT, i.e.
     * AFTER the command's aggregate UPDATE *and* after its publishEvent INSERT
     * have both run on the transaction's client. It is therefore the only honest
     * way to force "the mutation and the event both happened, then the
     * transaction failed" — an ordinary AFTER trigger fires during the UPDATE
     * statement, before the event is ever written, and would prove nothing.
     * Scoped by a WHEN clause to one action_proposal_id so a concurrently
     * running suite on the same database is untouched.
     */
    async function installCommitFailureTrigger(actionProposalId: string): Promise<() => Promise<void>> {
      const suffix = randomUUID().replace(/-/g, '');
      const fnName = `cw_test_prop_rollback_${suffix}`;
      const triggerName = `cw_test_prop_rollback_trg_${suffix}`;
      await control.query(
        `CREATE FUNCTION ${fnName}() RETURNS trigger LANGUAGE plpgsql AS
         $fn$ BEGIN RAISE EXCEPTION 'cw_test_forced_commit_failure'; END; $fn$`
      );
      await control.query(
        `CREATE CONSTRAINT TRIGGER ${triggerName}
           AFTER UPDATE ON case_workspace_action_proposals
           DEFERRABLE INITIALLY DEFERRED
           FOR EACH ROW WHEN (NEW.action_proposal_id = '${actionProposalId}')
           EXECUTE FUNCTION ${fnName}()`
      );
      return async () => {
        await control
          .query(`DROP TRIGGER IF EXISTS ${triggerName} ON case_workspace_action_proposals`)
          .catch(() => undefined);
        await control.query(`DROP FUNCTION IF EXISTS ${fnName}()`).catch(() => undefined);
      };
    }

    /**
     * Teardown order matters: decisions cascade off proposals (ON DELETE
     * CASCADE), but proposals themselves have no ON DELETE clause on either
     * their case_core or v8_execution_runs FK (RESTRICT/NO ACTION), so
     * proposals must be deleted first, then v8_execution_runs, then users,
     * then case_core (deleted via project cascade — see caseCoreService's own
     * migration), then projects, then organizations.
     */
    async function teardown(params: {
      runIds: string[];
      orgIds: string[];
      projectIds: string[];
      userIds?: string[];
    }): Promise<void> {
      // The outbox has ZERO foreign keys by design (see its migration header),
      // so its rows survive every delete below and must be cleared explicitly
      // or they leak into the next run's counts.
      if (params.orgIds.length > 0) {
        await control
          .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = ANY($1)`, [
            params.orgIds,
          ])
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
    // 1. createActionProposal + getActionProposal round-trip; same
    //    idempotency_key + same payload_digest replays safely (no new row);
    //    same idempotency_key + different payload_digest is rejected with
    //    idempotency_key_conflict (CW-RT-060, CW-GR-021).
    // -------------------------------------------------------------------------
    it('createActionProposal + getActionProposal round-trip; replays safely on matching digest; rejects idempotency_key_conflict on mismatched digest', async () => {
      const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('round-trip');
      const runId = `run-t1-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const idempotencyKey = `idem-round-trip-${randomUUID()}`;
        const input = minimalProposalInput({
          caseId,
          runId,
          tag: 'round-trip',
          createdByActorId: actorId,
          idempotencyKey,
          payloadDigest: 'sha256:round-trip-payload',
        });

        const created = await proposalApprovalService.createActionProposal(input);
        expect(created.caseId).toBe(caseId);
        expect(created.runId).toBe(runId);
        expect(created.status).toBe('DRAFT');
        expect(created.version).toBe(1);

        const fetched = await proposalApprovalService.getActionProposal(created.actionProposalId, actorId);
        expect(fetched).not.toBeNull();
        expect(fetched?.actionProposalId).toBe(created.actionProposalId);
        expect(fetched?.payloadDigest).toBe('sha256:round-trip-payload');

        // Safe replay: same idempotency_key, same payload_digest -> the
        // ORIGINAL row, no new row inserted.
        const replay = await proposalApprovalService.createActionProposal(input);
        expect(replay.actionProposalId).toBe(created.actionProposalId);

        const rowsAfterReplay = await readProposalRowsForCase(caseId);
        expect(rowsAfterReplay).toHaveLength(1);
        expect(rowsAfterReplay[0]?.action_proposal_id).toBe(created.actionProposalId);

        // Same idempotency_key, DIFFERENT payload_digest -> fails closed.
        const conflicting = minimalProposalInput({
          caseId,
          runId,
          tag: 'round-trip',
          createdByActorId: actorId,
          idempotencyKey,
          payloadDigest: 'sha256:a-different-payload',
        });
        await expect(proposalApprovalService.createActionProposal(conflicting)).rejects.toThrow(
          /idempotency_key_conflict/
        );

        // Still exactly one row, unchanged.
        const rowsAfterConflict = await readProposalRowsForCase(caseId);
        expect(rowsAfterConflict).toHaveLength(1);
        expect(rowsAfterConflict[0]?.payload_digest).toBe('sha256:round-trip-payload');
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 2. Self-approval is the security-critical case (GOV-022): APPROVE by the
    //    proposal's own creator is rejected with self_approval_forbidden and no
    //    decision row is inserted; REJECT by that same creator on the same
    //    proposal IS allowed (deliberate scope boundary — self-reject is not a
    //    governance bypass).
    // -------------------------------------------------------------------------
    it('rejects self-approval (APPROVE) with no DB decision row and unchanged status, but allows self-reject (REJECT) by the same actor', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('self-approval');
      const runId = `run-t2-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'self-approval',
            createdByActorId: actorA,
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: actorA },
          created.version
        );
        expect(submitted.status).toBe('PENDING_REVIEW');

        // -- Self-APPROVE: must be rejected, no decision row, status unchanged.
        await expect(
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'self-approval-approve',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: submitted.payloadDigest,
              decision: 'APPROVE',
              decidedByActorId: actorA,
            }),
            submitted.version
          )
        ).rejects.toThrow(/self_approval_forbidden/);

        const decisionsAfterSelfApprove = await readDecisionRows(created.actionProposalId);
        expect(decisionsAfterSelfApprove).toHaveLength(0);

        const rowAfterSelfApprove = await readProposalRow(created.actionProposalId);
        expect(rowAfterSelfApprove?.status).toBe('PENDING_REVIEW');
        expect(rowAfterSelfApprove?.version).toBe(submitted.version);

        // -- Self-REJECT: deliberately allowed, on the SAME proposal/actor.
        const rejectResult = await proposalApprovalService.recordApprovalDecision(
          created.actionProposalId,
          minimalDecisionInput({
            tag: 'self-approval-reject',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'REJECT',
            decidedByActorId: actorA,
          }),
          submitted.version
        );
        expect(rejectResult.proposal.status).toBe('REJECTED');
        expect(rejectResult.decision.decidedByActorId).toBe(actorA);
        expect(rejectResult.decision.decision).toBe('REJECT');

        const rowAfterSelfReject = await readProposalRow(created.actionProposalId);
        expect(rowAfterSelfReject?.status).toBe('REJECTED');

        const decisionsAfterSelfReject = await readDecisionRows(created.actionProposalId);
        expect(decisionsAfterSelfReject).toHaveLength(1);
        expect(decisionsAfterSelfReject[0]?.decided_by_actor_id).toBe(actorA);
        expect(decisionsAfterSelfReject[0]?.decision).toBe('REJECT');
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [actorA] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 3. A DIFFERENT actor approving actor-A's proposal succeeds normally,
    //    transitions PENDING_REVIEW -> APPROVED, and the decision row records
    //    actor-B as the decider.
    // -------------------------------------------------------------------------
    it('a different actor (actor-B) approving actor-A proposal succeeds, transitions to APPROVED, and records actor-B on the decision row', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('cross-actor-approve');
      const actorB = await seedMemberedUser(orgId, 'cross-actor-approve-B');
      const runId = `run-t3-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'cross-actor-approve',
            createdByActorId: actorA,
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: actorA },
          created.version
        );

        const result = await proposalApprovalService.recordApprovalDecision(
          created.actionProposalId,
          minimalDecisionInput({
            tag: 'cross-actor-approve',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'APPROVE',
            decidedByActorId: actorB,
          }),
          submitted.version
        );

        expect(result.proposal.status).toBe('APPROVED');
        expect(result.proposal.version).toBe(submitted.version + 1);
        expect(result.decision.decidedByActorId).toBe(actorB);
        expect(result.decision.decision).toBe('APPROVE');

        const row = await readProposalRow(created.actionProposalId);
        expect(row?.status).toBe('APPROVED');

        const decisions = await readDecisionRows(created.actionProposalId);
        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.decided_by_actor_id).toBe(actorB);
        expect(decisions[0]?.decision).toBe('APPROVE');
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 4. proposal_stale (CW-GR-028): a decision whose caller-supplied
    //    proposalVersion/payloadDigest no longer match the live row is rejected
    //    with no DB change.
    // -------------------------------------------------------------------------
    it('rejects a decision whose proposalVersion/payloadDigest do not match the live row with proposal_stale and leaves the DB unchanged', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('stale');
      const actorB = await seedMemberedUser(orgId, 'stale-B');
      const runId = `run-t4-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'stale',
            createdByActorId: actorA,
            payloadDigest: 'sha256:stale-live-digest',
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: actorA },
          created.version
        );

        // Wrong payloadDigest, correct proposalVersion.
        await expect(
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'stale-wrong-digest',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: 'sha256:not-the-live-digest',
              decision: 'APPROVE',
              decidedByActorId: actorB,
            }),
            submitted.version
          )
        ).rejects.toThrow(/proposal_stale/);

        // Wrong proposalVersion, correct payloadDigest.
        await expect(
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'stale-wrong-version',
              proposalVersion: submitted.proposalVersion + 99,
              payloadDigest: submitted.payloadDigest,
              decision: 'APPROVE',
              decidedByActorId: actorB,
            }),
            submitted.version
          )
        ).rejects.toThrow(/proposal_stale/);

        const row = await readProposalRow(created.actionProposalId);
        expect(row?.status).toBe('PENDING_REVIEW');
        expect(row?.version).toBe(submitted.version);

        const decisions = await readDecisionRows(created.actionProposalId);
        expect(decisions).toHaveLength(0);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 5. Illegal state transition: recordApprovalDecision against a proposal
    //    still in DRAFT (never submitted for review) is rejected, DB status
    //    unchanged.
    // -------------------------------------------------------------------------
    it('rejects recordApprovalDecision against a DRAFT proposal (never submitted for review) and leaves status unchanged', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('illegal-transition');
      const actorB = await seedMemberedUser(orgId, 'illegal-transition-B');
      const runId = `run-t5-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'illegal-transition',
            createdByActorId: actorA,
          })
        );
        expect(created.status).toBe('DRAFT');

        await expect(
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'illegal-transition',
              proposalVersion: created.proposalVersion,
              payloadDigest: created.payloadDigest,
              decision: 'APPROVE',
              decidedByActorId: actorB,
            }),
            created.version
          )
        ).rejects.toThrow(/proposal_status_transition_not_allowed/);

        const row = await readProposalRow(created.actionProposalId);
        expect(row?.status).toBe('DRAFT');
        expect(row?.version).toBe(created.version);

        const decisions = await readDecisionRows(created.actionProposalId);
        expect(decisions).toHaveLength(0);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 6. Expiry: an APPROVE against an already-expired proposal is rejected
    //    with proposal_review_window_expired; a REJECT on the SAME expired
    //    proposal succeeds — expiry only blocks APPROVE, per the packet's
    //    documented scope (open_question #5 in the service).
    // -------------------------------------------------------------------------
    it('rejects APPROVE on an expired proposal with proposal_review_window_expired, but allows REJECT on the same expired proposal', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('expiry');
      const actorB = await seedMemberedUser(orgId, 'expiry-B');
      const runId = `run-t6-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const pastExpiry = new Date(Date.now() - 60_000).toISOString();
        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'expiry',
            createdByActorId: actorA,
            expiresAt: pastExpiry,
          })
        );
        expect(created.expiresAt).toBe(pastExpiry);

        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: actorA },
          created.version
        );
        expect(submitted.status).toBe('PENDING_REVIEW');
        expect(
          proposalApprovalService.computeProposalExpiryState({ expiresAt: submitted.expiresAt })
        ).toBe('EXPIRED');

        // -- APPROVE against the expired proposal: rejected, no DB change.
        await expect(
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'expiry-approve',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: submitted.payloadDigest,
              decision: 'APPROVE',
              decidedByActorId: actorB,
            }),
            submitted.version
          )
        ).rejects.toThrow(/proposal_review_window_expired/);

        const rowAfterExpiredApprove = await readProposalRow(created.actionProposalId);
        expect(rowAfterExpiredApprove?.status).toBe('PENDING_REVIEW');
        expect(rowAfterExpiredApprove?.version).toBe(submitted.version);

        const decisionsAfterExpiredApprove = await readDecisionRows(created.actionProposalId);
        expect(decisionsAfterExpiredApprove).toHaveLength(0);

        // -- REJECT on the SAME expired proposal: succeeds, expiry does not
        //    block REJECT.
        const rejectResult = await proposalApprovalService.recordApprovalDecision(
          created.actionProposalId,
          minimalDecisionInput({
            tag: 'expiry-reject',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'REJECT',
            decidedByActorId: actorB,
          }),
          submitted.version
        );
        expect(rejectResult.proposal.status).toBe('REJECTED');

        const rowAfterReject = await readProposalRow(created.actionProposalId);
        expect(rowAfterReject?.status).toBe('REJECTED');
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 7. transitionProposalToExecuting rejects with proposal_target_stale when
    //    the referenced case_plan_versions row is no longer PUBLISHED (a later
    //    plan version superseded it) — the packet's own "invalidation"
    //    enforcement (CW-RT-023, CW-RT-061, CW-00-020-INV11).
    // -------------------------------------------------------------------------
    it('transitionProposalToExecuting rejects with proposal_target_stale once the targeted plan version has been superseded', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('target-stale');
      const actorB = await seedMemberedUser(orgId, 'target-stale-B');
      const actorExecutor = await seedMemberedUser(orgId, 'target-stale-executor');
      const runId = `run-t7-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const planVersionA = await publishedPlanVersion({
          caseId,
          tag: 'target-stale-a',
          actorId: actorA,
        });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'target-stale',
            createdByActorId: actorA,
            casePlanVersionId: planVersionA.casePlanVersionId,
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: actorA },
          created.version
        );
        const approved = await proposalApprovalService.recordApprovalDecision(
          created.actionProposalId,
          minimalDecisionInput({
            tag: 'target-stale',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'APPROVE',
            decidedByActorId: actorB,
          }),
          submitted.version
        );
        expect(approved.proposal.status).toBe('APPROVED');

        // Replan: publishing B atomically supersedes A for the same case, so
        // the proposal's targeted plan version (A) is no longer PUBLISHED.
        const planVersionB = await publishedPlanVersion({
          caseId,
          tag: 'target-stale-b',
          actorId: actorA,
          supersedesPlanVersionId: planVersionA.casePlanVersionId,
        });
        expect(planVersionB.casePlanVersionId).not.toBe(planVersionA.casePlanVersionId);

        await expect(
          proposalApprovalService.transitionProposalToExecuting(
            created.actionProposalId,
            { actorUserId: actorExecutor },
            approved.proposal.version
          )
        ).rejects.toThrow(/proposal_target_stale/);

        const row = await readProposalRow(created.actionProposalId);
        expect(row?.status).toBe('APPROVED');
        expect(row?.version).toBe(approved.proposal.version);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB, actorExecutor],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 8. AUTHORIZATION (CW-P12) — createActionProposal (create class) and
    //    recordApprovalDecision (approve class): an actor with no membership
    //    in the Case's org is rejected with case_access_denied for both.
    // -------------------------------------------------------------------------
    it('createActionProposal and recordApprovalDecision both reject an actor with no organization_members row for the Case\'s org', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('auth-no-membership');
      const noMembershipActor = await seedUser(orgId, 'auth-no-membership-outsider');
      const runId = `run-t8-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        await expect(
          proposalApprovalService.createActionProposal(
            minimalProposalInput({
              caseId,
              runId,
              tag: 'auth-no-membership-create',
              createdByActorId: noMembershipActor,
            })
          )
        ).rejects.toMatchObject({ code: 'case_access_denied' });

        const rowsAfterFailedCreate = await readProposalRowsForCase(caseId);
        expect(rowsAfterFailedCreate).toHaveLength(0);

        // A properly-membered actor creates and submits a real proposal, then
        // the no-membership actor's decision attempt is rejected too.
        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'auth-no-membership-decision',
            createdByActorId: actorA,
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: actorA },
          created.version
        );

        await expect(
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'auth-no-membership-decision',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: submitted.payloadDigest,
              decision: 'APPROVE',
              decidedByActorId: noMembershipActor,
            }),
            submitted.version
          )
        ).rejects.toMatchObject({ code: 'case_access_denied' });

        const row = await readProposalRow(created.actionProposalId);
        expect(row?.status).toBe('PENDING_REVIEW');
        const decisions = await readDecisionRows(created.actionProposalId);
        expect(decisions).toHaveLength(0);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, noMembershipActor],
        });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 9. AUTHORIZATION (CW-P12) — getActionProposal (read class, SEC-009
    //    hardening): a nonexistent id and a real id the actor cannot access
    //    both return null.
    // -------------------------------------------------------------------------
    it('getActionProposal returns null for both a nonexistent action_proposal_id and a real proposal the actor cannot access', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('auth-read-null');
      const noMembershipActor = await seedUser(orgId, 'auth-read-null-outsider');
      const runId = `run-t9-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });
        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({ caseId, runId, tag: 'auth-read-null', createdByActorId: actorA })
        );

        const missing = await proposalApprovalService.getActionProposal(
          `cwprop-${randomUUID()}`,
          noMembershipActor
        );
        const denied = await proposalApprovalService.getActionProposal(
          created.actionProposalId,
          noMembershipActor
        );
        expect(missing).toBeNull();
        expect(denied).toBeNull();

        const allowed = await proposalApprovalService.getActionProposal(created.actionProposalId, actorA);
        expect(allowed?.actionProposalId).toBe(created.actionProposalId);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, noMembershipActor],
        });
      }
    }, 30_000);

    // =========================================================================
    // EVENT OUTBOX (docs/product/case-workspace/acceptance/EVENT_TAXONOMY.md,
    // section "proposalApprovalService — aggregate ACTION_PROPOSAL")
    //
    // Every assertion below reads `case_workspace_event_outbox` out of band,
    // AFTER the command returned — never the value publishEvent handed back.
    // The whole point of the outbox is what survives COMMIT.
    // =========================================================================

    // -------------------------------------------------------------------------
    // 10. The happy-path lifecycle: six mutating commands, six outbox rows, in
    //     order, each with the taxonomy's literal event_type and a fully
    //     populated identity (org/aggregate/actor/correlation + the §10
    //     case->run->nodeRun chain and the POST-mutation aggregate version).
    //     Read-only calls interleaved at the end add nothing.
    // -------------------------------------------------------------------------
    it('emits exactly one correctly-identified outbox event per mutating command across the full DRAFT->AUDITED lifecycle, and none for reads', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('outbox-lifecycle');
      const actorB = await seedMemberedUser(orgId, 'outbox-lifecycle-B');
      const actorExecutor = await seedMemberedUser(orgId, 'outbox-lifecycle-exec');
      const runId = `run-t10-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'outbox-lifecycle',
            createdByActorId: actorA,
          })
        );
        const aggregateId = created.actionProposalId;
        const nodeRunId = `noderun-outbox-lifecycle`;

        const identity = {
          aggregateId,
          organizationId: orgId,
          projectId,
          caseId,
          runId,
          nodeRunId,
        };

        let rows = await readOutboxRowsForAggregate(aggregateId);
        expect(rows).toHaveLength(1);
        const createdEvent = expectOneEvent(rows, 0, {
          ...identity,
          eventType: 'proposal.created',
          actorUserId: actorA,
          aggregateVersion: 1,
        });
        // §6: facts, not payloads — the digest is carried, the payload is not.
        expect(createdEvent.redacted_summary.payloadDigest).toBe(created.payloadDigest);
        expect(createdEvent.redacted_summary.effectClass).toBe('SENSITIVE_UPDATE');
        expect(createdEvent.payload_ref).toBe(created.previewRef);

        const submitted = await proposalApprovalService.submitActionProposalForReview(
          aggregateId,
          { actorUserId: actorA },
          created.version
        );
        rows = await readOutboxRowsForAggregate(aggregateId);
        expect(rows).toHaveLength(2);
        const submitEvent = expectOneEvent(rows, 1, {
          ...identity,
          eventType: 'proposal.review_requested',
          actorUserId: actorA,
          aggregateVersion: submitted.version,
        });
        expect(submitEvent.redacted_summary.from).toBe('DRAFT');
        expect(submitEvent.redacted_summary.to).toBe('PENDING_REVIEW');

        const approved = await proposalApprovalService.recordApprovalDecision(
          aggregateId,
          minimalDecisionInput({
            tag: 'outbox-lifecycle',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'APPROVE',
            decidedByActorId: actorB,
          }),
          submitted.version
        );
        rows = await readOutboxRowsForAggregate(aggregateId);
        expect(rows).toHaveLength(3);
        const approveEvent = expectOneEvent(rows, 2, {
          ...identity,
          // Dynamic type: chosen from the decision, not hard-coded per branch.
          eventType: 'approval.approved',
          actorUserId: actorB,
          aggregateVersion: approved.proposal.version,
        });
        expect(approveEvent.redacted_summary.decision).toBe('APPROVE');
        expect(approveEvent.redacted_summary.decisionId).toBe(approved.decision.decisionId);
        expect(approveEvent.redacted_summary.approvalChannelPolicy).toBe('standard');
        expect(approveEvent.redacted_summary.authenticationAssurance).toBe('MFA');
        expect(approveEvent.redacted_summary.policyVersion).toBe('policy-v1');

        const executing = await proposalApprovalService.transitionProposalToExecuting(
          aggregateId,
          { actorUserId: actorExecutor },
          approved.proposal.version
        );
        const executed = await proposalApprovalService.transitionProposalToExecuted(
          aggregateId,
          { actorUserId: actorExecutor },
          executing.version
        );
        const audited = await proposalApprovalService.markProposalAudited(
          aggregateId,
          { actorUserId: actorExecutor },
          executed.version
        );

        rows = await readOutboxRowsForAggregate(aggregateId);
        expect(rows).toHaveLength(6);
        expectOneEvent(rows, 3, {
          ...identity,
          eventType: 'proposal.executing',
          actorUserId: actorExecutor,
          aggregateVersion: executing.version,
        });
        expectOneEvent(rows, 4, {
          ...identity,
          eventType: 'proposal.executed',
          actorUserId: actorExecutor,
          aggregateVersion: executed.version,
        });
        expectOneEvent(rows, 5, {
          ...identity,
          eventType: 'proposal.audited',
          actorUserId: actorExecutor,
          aggregateVersion: audited.version,
        });

        expect(rows.map((r) => r.event_type)).toEqual([
          'proposal.created',
          'proposal.review_requested',
          'approval.approved',
          'proposal.executing',
          'proposal.executed',
          'proposal.audited',
        ]);
        // Every event of one aggregate carries a distinct event_id (§8 dedup key).
        expect(new Set(rows.map((r) => r.event_id)).size).toBe(6);

        // Reads are not facts: none of these may append anything.
        await proposalApprovalService.getActionProposal(aggregateId, actorA);
        await proposalApprovalService.listActionProposalsForCase(caseId, undefined, actorA);
        await proposalApprovalService.listActionProposalsForRun(runId, actorA);
        await proposalApprovalService.listDecisionsForProposal(aggregateId, actorA);
        expect(await readOutboxRowsForAggregate(aggregateId)).toHaveLength(6);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB, actorExecutor],
        });
      }
    }, 60_000);

    // -------------------------------------------------------------------------
    // 11. Retried commands must not look like second actions (§8 dedup): a safe
    //     replay of createActionProposal/recordApprovalDecision performs no
    //     mutation, so it emits nothing. A REJECTED command emits nothing
    //     either — self_approval_forbidden and proposal_stale leave the outbox
    //     as empty as they leave the aggregate.
    // -------------------------------------------------------------------------
    it('emits no event for an idempotent replay and no event for a rejected command (self-approval, stale digest)', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('outbox-replay');
      const actorB = await seedMemberedUser(orgId, 'outbox-replay-B');
      const runId = `run-t11-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const input = minimalProposalInput({
          caseId,
          runId,
          tag: 'outbox-replay',
          createdByActorId: actorA,
        });
        const created = await proposalApprovalService.createActionProposal(input);
        const aggregateId = created.actionProposalId;
        expect(await readOutboxRowsForAggregate(aggregateId)).toHaveLength(1);

        // Safe replay of the create: same row returned, still ONE event.
        const replay = await proposalApprovalService.createActionProposal(input);
        expect(replay.actionProposalId).toBe(aggregateId);
        expect(await readOutboxRowsForAggregate(aggregateId)).toHaveLength(1);

        const submitted = await proposalApprovalService.submitActionProposalForReview(
          aggregateId,
          { actorUserId: actorA },
          created.version
        );
        expect(await readOutboxRowsForAggregate(aggregateId)).toHaveLength(2);

        // Rejected: GOV-022 self-approval.
        await expect(
          proposalApprovalService.recordApprovalDecision(
            aggregateId,
            minimalDecisionInput({
              tag: 'outbox-replay-self',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: submitted.payloadDigest,
              decision: 'APPROVE',
              decidedByActorId: actorA,
            }),
            submitted.version
          )
        ).rejects.toThrow(/self_approval_forbidden/);
        expect(await readOutboxRowsForAggregate(aggregateId)).toHaveLength(2);

        // Rejected: CW-GR-028 stale digest.
        await expect(
          proposalApprovalService.recordApprovalDecision(
            aggregateId,
            minimalDecisionInput({
              tag: 'outbox-replay-stale',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: 'sha256:not-the-live-digest',
              decision: 'APPROVE',
              decidedByActorId: actorB,
            }),
            submitted.version
          )
        ).rejects.toThrow(/proposal_stale/);
        expect(await readOutboxRowsForAggregate(aggregateId)).toHaveLength(2);

        // A real decision, then its own safe replay.
        //
        // DEFER is used deliberately: it is the ONLY decision whose
        // `ON CONFLICT (action_proposal_id, idempotency_key) DO NOTHING` replay
        // path is actually reachable. APPROVE/REJECT/REQUEST_CHANGES move the
        // proposal off PENDING_REVIEW, and recordApprovalDecision's status guard
        // (proposalApprovalService.ts, `if (row.status !== 'PENDING_REVIEW')`)
        // runs BEFORE the idempotency insert — so retrying one of those throws
        // `proposal_status_transition_not_allowed` instead of replaying. That is
        // pre-existing service behaviour, unrelated to the outbox; the event
        // rule under test here is "a replay adds no second event", and DEFER is
        // where that rule can be exercised.
        const decisionInput = minimalDecisionInput({
          tag: 'outbox-replay-decide',
          proposalVersion: submitted.proposalVersion,
          payloadDigest: submitted.payloadDigest,
          decision: 'DEFER',
          decidedByActorId: actorB,
        });
        await proposalApprovalService.recordApprovalDecision(
          aggregateId,
          decisionInput,
          submitted.version
        );
        const afterDecision = await readOutboxRowsForAggregate(aggregateId);
        expect(afterDecision).toHaveLength(3);
        expect(afterDecision[2]?.event_type).toBe('approval.deferred');

        const replayedDecision = await proposalApprovalService.recordApprovalDecision(
          aggregateId,
          decisionInput,
          submitted.version
        );
        expect(replayedDecision.decision.decisionId).toBe(
          afterDecision[2]?.redacted_summary.decisionId
        );
        expect(await readOutboxRowsForAggregate(aggregateId)).toHaveLength(3);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 60_000);

    // -------------------------------------------------------------------------
    // 12. The two taxonomy subtleties this service owns:
    //     - DEFER (§5.5) is a real, reachable decision that changes no status —
    //       it must still emit `approval.deferred`, at the UNCHANGED version;
    //     - `proposal.failed` -> `proposal.retry_requested` must carry a
    //       causationId back to the failure it retries, and the failure's
    //       free-text reason must NOT appear anywhere in the event.
    // -------------------------------------------------------------------------
    it('emits approval.deferred for a status-neutral DEFER, and links proposal.retry_requested to the proposal.failed it retries without copying the reason text', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('outbox-defer-retry');
      const actorB = await seedMemberedUser(orgId, 'outbox-defer-retry-B');
      const runId = `run-t12-${randomUUID()}`;
      const secretReason = 'connector returned 500 for account holder jan.kowalski@example.test';
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'outbox-defer-retry',
            createdByActorId: actorA,
          })
        );
        const aggregateId = created.actionProposalId;
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          aggregateId,
          { actorUserId: actorA },
          created.version
        );

        // -- DEFER: no status change, but a real, observable decision.
        const deferred = await proposalApprovalService.recordApprovalDecision(
          aggregateId,
          minimalDecisionInput({
            tag: 'outbox-defer',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'DEFER',
            decidedByActorId: actorB,
          }),
          submitted.version
        );
        expect(deferred.proposal.status).toBe('PENDING_REVIEW');
        expect(deferred.proposal.version).toBe(submitted.version);

        let rows = await readOutboxRowsForAggregate(aggregateId);
        expect(rows).toHaveLength(3);
        const deferEvent = expectOneEvent(rows, 2, {
          aggregateId,
          organizationId: orgId,
          projectId,
          caseId,
          runId,
          nodeRunId: 'noderun-outbox-defer-retry',
          eventType: 'approval.deferred',
          actorUserId: actorB,
          aggregateVersion: submitted.version,
        });
        expect(deferEvent.redacted_summary.from).toBe('PENDING_REVIEW');
        expect(deferEvent.redacted_summary.to).toBe('PENDING_REVIEW');

        // -- APPROVE -> EXECUTING -> FAILED -> retry.
        const approved = await proposalApprovalService.recordApprovalDecision(
          aggregateId,
          minimalDecisionInput({
            tag: 'outbox-defer-retry-approve',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'APPROVE',
            decidedByActorId: actorB,
          }),
          submitted.version
        );
        const executing = await proposalApprovalService.transitionProposalToExecuting(
          aggregateId,
          { actorUserId: actorB },
          approved.proposal.version
        );
        const failed = await proposalApprovalService.transitionProposalToFailed(
          aggregateId,
          { actorUserId: actorB },
          secretReason,
          executing.version
        );
        const retried = await proposalApprovalService.retryProposalFromFailed(
          aggregateId,
          { actorUserId: actorB },
          failed.version
        );
        expect(retried.status).toBe('APPROVED');

        rows = await readOutboxRowsForAggregate(aggregateId);
        expect(rows.map((r) => r.event_type)).toEqual([
          'proposal.created',
          'proposal.review_requested',
          'approval.deferred',
          'approval.approved',
          'proposal.executing',
          'proposal.failed',
          'proposal.retry_requested',
        ]);

        const failedEvent = rows[5];
        const retryEvent = rows[6];
        expect(Number(failedEvent.aggregate_version)).toBe(failed.version);
        expect(Number(retryEvent.aggregate_version)).toBe(retried.version);
        // The causal edge the taxonomy demands, resolved inside the retry's own
        // transaction.
        expect(retryEvent.causation_id).toBe(failedEvent.event_id);

        // "Error class only, never the provider response body": the prose
        // reason (which even contains an email address) is nowhere in the event.
        const failedSummary = JSON.stringify(failedEvent.redacted_summary);
        expect(failedSummary).not.toContain('jan.kowalski@example.test');
        expect(failedSummary).not.toContain('connector returned 500');
        expect(failedEvent.redacted_summary.reasonClass).toBe('unclassified');
        expect(String(failedEvent.redacted_summary.reasonDigest)).toMatch(/^sha256:[0-9a-f]{32}$/);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 60_000);

    // -------------------------------------------------------------------------
    // 12b. The two remaining branches of DECISION_EVENT_TYPES. APPROVE and
    //      DEFER are covered above; REJECT and REQUEST_CHANGES were emitted by
    //      the service but asserted by nothing, so the claim that the event
    //      type is derived from the decision (rather than hard-coded per
    //      branch) rested on two of four cases.
    //
    //      They need two proposals, not one: both decisions move the proposal
    //      off PENDING_REVIEW, and recordApprovalDecision's status guard
    //      rejects any second decision after that.
    // -------------------------------------------------------------------------
    it('emits approval.rejected for REJECT and approval.changes_requested for REQUEST_CHANGES, each exactly once, with full identity and the post-mutation version', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('outbox-reject-changes');
      const actorB = await seedMemberedUser(orgId, 'outbox-reject-changes-B');
      const runId = `run-t12b-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        // -- REJECT -> approval.rejected.
        const rejectCreated = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'outbox-reject',
            createdByActorId: actorA,
          })
        );
        const rejectId = rejectCreated.actionProposalId;
        const rejectSubmitted = await proposalApprovalService.submitActionProposalForReview(
          rejectId,
          { actorUserId: actorA },
          rejectCreated.version
        );
        const rejected = await proposalApprovalService.recordApprovalDecision(
          rejectId,
          minimalDecisionInput({
            tag: 'outbox-reject',
            proposalVersion: rejectSubmitted.proposalVersion,
            payloadDigest: rejectSubmitted.payloadDigest,
            decision: 'REJECT',
            decidedByActorId: actorB,
          }),
          rejectSubmitted.version
        );
        expect(rejected.proposal.status).toBe('REJECTED');

        const rejectRows = await readOutboxRowsForAggregate(rejectId);
        expect(rejectRows.map((r) => r.event_type)).toEqual([
          'proposal.created',
          'proposal.review_requested',
          'approval.rejected',
        ]);
        const rejectEvent = expectOneEvent(rejectRows, 2, {
          aggregateId: rejectId,
          organizationId: orgId,
          projectId,
          caseId,
          runId,
          nodeRunId: 'noderun-outbox-reject',
          eventType: 'approval.rejected',
          actorUserId: actorB,
          aggregateVersion: rejected.proposal.version,
        });
        // The decision is carried as a fact too, and the decision row it names
        // is the one the service actually inserted.
        expect(rejectEvent.redacted_summary.decision).toBe('REJECT');
        expect(rejectEvent.redacted_summary.decisionId).toBe(rejected.decision.decisionId);
        expect(rejectEvent.redacted_summary.from).toBe('PENDING_REVIEW');
        expect(rejectEvent.redacted_summary.to).toBe('REJECTED');
        expect(rejectEvent.redacted_summary.payloadDigest).toBe(rejectSubmitted.payloadDigest);

        // -- REQUEST_CHANGES -> approval.changes_requested, on its own proposal.
        const changesCreated = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'outbox-changes',
            createdByActorId: actorA,
          })
        );
        const changesId = changesCreated.actionProposalId;
        const changesSubmitted = await proposalApprovalService.submitActionProposalForReview(
          changesId,
          { actorUserId: actorA },
          changesCreated.version
        );
        const changed = await proposalApprovalService.recordApprovalDecision(
          changesId,
          minimalDecisionInput({
            tag: 'outbox-changes',
            proposalVersion: changesSubmitted.proposalVersion,
            payloadDigest: changesSubmitted.payloadDigest,
            decision: 'REQUEST_CHANGES',
            decidedByActorId: actorB,
          }),
          changesSubmitted.version
        );
        expect(changed.proposal.status).toBe('REQUESTED_CHANGES');

        const changesRows = await readOutboxRowsForAggregate(changesId);
        expect(changesRows.map((r) => r.event_type)).toEqual([
          'proposal.created',
          'proposal.review_requested',
          'approval.changes_requested',
        ]);
        const changesEvent = expectOneEvent(changesRows, 2, {
          aggregateId: changesId,
          organizationId: orgId,
          projectId,
          caseId,
          runId,
          nodeRunId: 'noderun-outbox-changes',
          eventType: 'approval.changes_requested',
          actorUserId: actorB,
          aggregateVersion: changed.proposal.version,
        });
        expect(changesEvent.redacted_summary.decision).toBe('REQUEST_CHANGES');
        expect(changesEvent.redacted_summary.decisionId).toBe(changed.decision.decisionId);
        expect(changesEvent.redacted_summary.from).toBe('PENDING_REVIEW');
        expect(changesEvent.redacted_summary.to).toBe('REQUESTED_CHANGES');

        // Four distinct event types across the two aggregates — the decision
        // really selects the type; neither proposal picked up the other's.
        expect(rejectEvent.event_id).not.toBe(changesEvent.event_id);
        expect(
          [...rejectRows, ...changesRows].filter((r) => r.event_type === 'approval.rejected')
        ).toHaveLength(1);
        expect(
          [...rejectRows, ...changesRows].filter((r) => r.event_type === 'approval.changes_requested')
        ).toHaveLength(1);
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 60_000);

    // -------------------------------------------------------------------------
    // 13. ATOMICITY, the property the whole outbox exists for: force the
    //     transaction to fail AT COMMIT — after both the aggregate UPDATE and
    //     the publishEvent INSERT have run on its client — and prove that
    //     NEITHER survived. If publishEvent ever opened its own connection or
    //     published post-commit, the event would be here and the mutation would
    //     not; that is the dual-write hole this test closes.
    // -------------------------------------------------------------------------
    it('rolls the outbox row back with the mutation when the transaction fails after both were written (revoke + commit-time failure)', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('outbox-rollback');
      const actorB = await seedMemberedUser(orgId, 'outbox-rollback-B');
      const runId = `run-t13-${randomUUID()}`;
      let dropTrigger: (() => Promise<void>) | null = null;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'outbox-rollback',
            createdByActorId: actorA,
          })
        );
        const aggregateId = created.actionProposalId;
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          aggregateId,
          { actorUserId: actorA },
          created.version
        );
        const approved = await proposalApprovalService.recordApprovalDecision(
          aggregateId,
          minimalDecisionInput({
            tag: 'outbox-rollback',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'APPROVE',
            decidedByActorId: actorB,
          }),
          submitted.version
        );

        const before = await readOutboxRowsForAggregate(aggregateId);
        expect(before).toHaveLength(3);

        dropTrigger = await installCommitFailureTrigger(aggregateId);

        await expect(
          proposalApprovalService.revokeApprovedProposal(
            aggregateId,
            { actorUserId: actorB },
            'policy_withdrawn',
            approved.proposal.version
          )
        ).rejects.toThrow(/cw_test_forced_commit_failure/);

        // The aggregate is untouched...
        const row = await readProposalRow(aggregateId);
        expect(row?.status).toBe('APPROVED');
        expect(row?.version).toBe(approved.proposal.version);

        // ...and so is the outbox: no proposal.revoked row exists.
        const after = await readOutboxRowsForAggregate(aggregateId);
        expect(after).toHaveLength(3);
        expect(after.map((r) => r.event_type)).not.toContain('proposal.revoked');

        // Control: with the trigger gone, the identical call succeeds and DOES
        // emit — proving the rollback above was the trigger, not a silent
        // failure to wire the event at all.
        await dropTrigger();
        dropTrigger = null;

        const revoked = await proposalApprovalService.revokeApprovedProposal(
          aggregateId,
          { actorUserId: actorB },
          'policy_withdrawn',
          approved.proposal.version
        );
        expect(revoked.status).toBe('REVOKED');

        const final = await readOutboxRowsForAggregate(aggregateId);
        expect(final).toHaveLength(4);
        const revokedEvent = expectOneEvent(final, 3, {
          aggregateId,
          organizationId: orgId,
          projectId,
          caseId,
          runId,
          nodeRunId: 'noderun-outbox-rollback',
          eventType: 'proposal.revoked',
          actorUserId: actorB,
          aggregateVersion: revoked.version,
        });
        expect(revokedEvent.redacted_summary.from).toBe('APPROVED');
        expect(revokedEvent.redacted_summary.to).toBe('REVOKED');
        expect(revokedEvent.redacted_summary.reasonClass).toBe('policy_withdrawn');
      } finally {
        if (dropTrigger) await dropTrigger().catch(() => undefined);
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 60_000);

    // -------------------------------------------------------------------------
    // 15. EPIC E6 AUTONOMY ENFORCEMENT AT THE MATERIAL STEP.
    //
    //     Reaching status APPROVED is NOT the same as being authorized to
    //     execute. `minimalProposalInput` proposes a SENSITIVE_UPDATE, which
    //     the classifier calls A3 (material) — so APPROVED -> EXECUTING now
    //     demands an EXPLICIT control with a CONFIGURED authentication
    //     assurance (06 §5: "a chat message alone is never material approval
    //     truth").
    //
    //     Two proposals, identical in every respect except the approval's
    //     `source` / `authenticationAssurance`, are driven to APPROVED and then
    //     to EXECUTING. Both must be refused, the aggregate must be left
    //     exactly where it was, and each refusal must leave a COMMITTED
    //     `policy.denied` outbox row — a denial published inside a transaction
    //     that then throws would be rolled back with the throw, which is the
    //     failure mode that makes a refusal unprovable.
    // -------------------------------------------------------------------------
    it('refuses APPROVED -> EXECUTING for a material action approved only in chat, and for one approved without a configured step-up, and commits policy.denied for each', async () => {
      const { orgId, projectId, caseId, actorId: actorA } = await seedOrgProjectCase('autonomy-gate');
      const actorB = await seedMemberedUser(orgId, 'autonomy-gate-B');
      const runId = `run-t15-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        /** Drives one proposal to APPROVED with a caller-chosen approval shape. */
        async function approvedProposal(params: {
          tag: string;
          source: RecordApprovalDecisionInput['source'];
          authenticationAssurance: string;
        }) {
          const created = await proposalApprovalService.createActionProposal(
            minimalProposalInput({ caseId, runId, tag: params.tag, createdByActorId: actorA })
          );
          const submitted = await proposalApprovalService.submitActionProposalForReview(
            created.actionProposalId,
            { actorUserId: actorA },
            created.version
          );
          const approved = await proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            {
              ...minimalDecisionInput({
                tag: params.tag,
                proposalVersion: submitted.proposalVersion,
                payloadDigest: submitted.payloadDigest,
                decision: 'APPROVE',
                decidedByActorId: actorB,
              }),
              source: params.source,
              authenticationAssurance: params.authenticationAssurance,
            },
            submitted.version
          );
          // The decision itself is recorded — the gate is at execution, not here.
          expect(approved.proposal.status).toBe('APPROVED');
          return approved.proposal;
        }

        const cases: Array<{
          tag: string;
          source: RecordApprovalDecisionInput['source'];
          authenticationAssurance: string;
          expectedCode: string;
        }> = [
          {
            tag: 'autonomy-chat-approval',
            source: 'CONVERSATIONAL',
            authenticationAssurance: 'MFA',
            expectedCode: 'autonomy_control_channel_not_explicit',
          },
          {
            tag: 'autonomy-no-stepup',
            source: 'BUTTON',
            authenticationAssurance: 'NONE',
            expectedCode: 'autonomy_step_up_assurance_not_configured',
          },
        ];

        for (const testCase of cases) {
          const proposal = await approvedProposal(testCase);
          const beforeRows = await readOutboxRowsForAggregate(proposal.actionProposalId);

          await expect(
            proposalApprovalService.transitionProposalToExecuting(
              proposal.actionProposalId,
              { actorUserId: actorB },
              proposal.version
            )
          ).rejects.toMatchObject({
            name: 'AutonomyPolicyDeniedError',
            code: testCase.expectedCode,
          });

          // The aggregate is EXACTLY where it was: not EXECUTING, not bumped.
          const row = await readProposalRow(proposal.actionProposalId);
          expect({ status: row?.status, version: row?.version }).toEqual({
            status: 'APPROVED',
            version: proposal.version,
          });

          // …and the refusal survived, read back out of band after COMMIT.
          const afterRows = await readOutboxRowsForAggregate(proposal.actionProposalId);
          expect(afterRows).toHaveLength(beforeRows.length + 1);
          const denied = afterRows[afterRows.length - 1]!;
          expect(denied.event_type).toBe('policy.denied');
          expect(denied.aggregate_id).toBe(proposal.actionProposalId);
          expect(denied.organization_id).toBe(orgId);
          expect(denied.case_id).toBe(caseId);
          expect(denied.run_id).toBe(runId);
          expect(denied.actor_user_id).toBe(actorB);
          expect(denied.redacted_summary).toMatchObject({
            denialCode: testCase.expectedCode,
            actionClass: 'A3',
            requiredControl: 'EXPLICIT_CONTROL_WITH_STEP_UP',
            // No org ceiling row exists for this fixture org, so the ceiling is
            // the fail-closed default, not a permissive assumption.
            organizationCeilingSource: 'UNCONFIGURED_FAIL_CLOSED_DEFAULT',
            effectiveAutonomy: 'ASK_EACH_ACTION',
            attemptedTransition: 'APPROVED->EXECUTING',
          });
          // §6 facts, not payloads: the digest travels, the payload does not.
          expect(denied.redacted_summary.payloadDigest).toBe(proposal.payloadDigest);
        }

        // Control: the SAME material action, approved through the button with a
        // configured assurance, still executes. Without this the two denials
        // above would be consistent with a gate that simply blocks everything.
        const allowed = await approvedProposal({
          tag: 'autonomy-button-approval',
          source: 'BUTTON',
          authenticationAssurance: 'MFA',
        });
        const executing = await proposalApprovalService.transitionProposalToExecuting(
          allowed.actionProposalId,
          { actorUserId: actorB },
          allowed.version
        );
        expect(executing.status).toBe('EXECUTING');
        const executingRows = await readOutboxRowsForAggregate(allowed.actionProposalId);
        const executingEvent = executingRows[executingRows.length - 1]!;
        expect(executingEvent.event_type).toBe('proposal.executing');
        // The authorizing decision is recorded ON the mutation event, so an
        // auditor can see which level and which ceiling let it through.
        expect(executingEvent.redacted_summary).toMatchObject({
          actionClass: 'A3',
          effectiveAutonomy: 'ASK_EACH_ACTION',
          organizationCeilingSource: 'UNCONFIGURED_FAIL_CLOSED_DEFAULT',
        });
      } finally {
        await teardown({
          runIds: [runId],
          orgIds: [orgId],
          projectIds: [projectId],
          userIds: [actorA, actorB],
        });
      }
    }, 60_000);
  }
);
