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

    return proposalsOk && decisionsOk && runsOk;
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

    /**
     * A fresh organization + project + case_core row, all uniquely named.
     * Same bundle as runBindingService.pg.test.ts's seedOrgProjectCase().
     */
    async function seedOrgProjectCase(
      label: string
    ): Promise<{ orgId: string; projectId: string; caseId: string }> {
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
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: `actor-propapp-${label}`,
      });
      return { orgId, projectId, caseId: created.caseId };
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
      createdByActorId?: string;
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
        createdByActorId: params.createdByActorId ?? `actor-A-${params.tag}`,
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
     * Teardown order matters: decisions cascade off proposals (ON DELETE
     * CASCADE), but proposals themselves have no ON DELETE clause on either
     * their case_core or v8_execution_runs FK (RESTRICT/NO ACTION), so
     * proposals must be deleted first, then v8_execution_runs, then case_core
     * (deleted via project cascade — see caseCoreService's own migration),
     * then projects, then organizations.
     */
    async function teardown(params: {
      runIds: string[];
      orgIds: string[];
      projectIds: string[];
    }): Promise<void> {
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
      const { orgId, projectId, caseId } = await seedOrgProjectCase('round-trip');
      const runId = `run-t1-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const idempotencyKey = `idem-round-trip-${randomUUID()}`;
        const input = minimalProposalInput({
          caseId,
          runId,
          tag: 'round-trip',
          idempotencyKey,
          payloadDigest: 'sha256:round-trip-payload',
        });

        const created = await proposalApprovalService.createActionProposal(input);
        expect(created.caseId).toBe(caseId);
        expect(created.runId).toBe(runId);
        expect(created.status).toBe('DRAFT');
        expect(created.version).toBe(1);

        const fetched = await proposalApprovalService.getActionProposal(created.actionProposalId);
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
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
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
      const { orgId, projectId, caseId } = await seedOrgProjectCase('self-approval');
      const runId = `run-t2-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'self-approval',
            createdByActorId: 'actor-A',
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: 'actor-A' },
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
              decidedByActorId: 'actor-A',
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
            decidedByActorId: 'actor-A',
          }),
          submitted.version
        );
        expect(rejectResult.proposal.status).toBe('REJECTED');
        expect(rejectResult.decision.decidedByActorId).toBe('actor-A');
        expect(rejectResult.decision.decision).toBe('REJECT');

        const rowAfterSelfReject = await readProposalRow(created.actionProposalId);
        expect(rowAfterSelfReject?.status).toBe('REJECTED');

        const decisionsAfterSelfReject = await readDecisionRows(created.actionProposalId);
        expect(decisionsAfterSelfReject).toHaveLength(1);
        expect(decisionsAfterSelfReject[0]?.decided_by_actor_id).toBe('actor-A');
        expect(decisionsAfterSelfReject[0]?.decision).toBe('REJECT');
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 3. A DIFFERENT actor approving actor-A's proposal succeeds normally,
    //    transitions PENDING_REVIEW -> APPROVED, and the decision row records
    //    actor-B as the decider.
    // -------------------------------------------------------------------------
    it('a different actor (actor-B) approving actor-A proposal succeeds, transitions to APPROVED, and records actor-B on the decision row', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('cross-actor-approve');
      const runId = `run-t3-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'cross-actor-approve',
            createdByActorId: 'actor-A',
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: 'actor-A' },
          created.version
        );

        const result = await proposalApprovalService.recordApprovalDecision(
          created.actionProposalId,
          minimalDecisionInput({
            tag: 'cross-actor-approve',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'APPROVE',
            decidedByActorId: 'actor-B',
          }),
          submitted.version
        );

        expect(result.proposal.status).toBe('APPROVED');
        expect(result.proposal.version).toBe(submitted.version + 1);
        expect(result.decision.decidedByActorId).toBe('actor-B');
        expect(result.decision.decision).toBe('APPROVE');

        const row = await readProposalRow(created.actionProposalId);
        expect(row?.status).toBe('APPROVED');

        const decisions = await readDecisionRows(created.actionProposalId);
        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.decided_by_actor_id).toBe('actor-B');
        expect(decisions[0]?.decision).toBe('APPROVE');
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 4. proposal_stale (CW-GR-028): a decision whose caller-supplied
    //    proposalVersion/payloadDigest no longer match the live row is rejected
    //    with no DB change.
    // -------------------------------------------------------------------------
    it('rejects a decision whose proposalVersion/payloadDigest do not match the live row with proposal_stale and leaves the DB unchanged', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('stale');
      const runId = `run-t4-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'stale',
            createdByActorId: 'actor-A',
            payloadDigest: 'sha256:stale-live-digest',
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: 'actor-A' },
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
              decidedByActorId: 'actor-B',
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
              decidedByActorId: 'actor-B',
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
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 5. Illegal state transition: recordApprovalDecision against a proposal
    //    still in DRAFT (never submitted for review) is rejected, DB status
    //    unchanged.
    // -------------------------------------------------------------------------
    it('rejects recordApprovalDecision against a DRAFT proposal (never submitted for review) and leaves status unchanged', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('illegal-transition');
      const runId = `run-t5-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'illegal-transition',
            createdByActorId: 'actor-A',
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
              decidedByActorId: 'actor-B',
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
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 6. Expiry: an APPROVE against an already-expired proposal is rejected
    //    with proposal_review_window_expired; a REJECT on the SAME expired
    //    proposal succeeds — expiry only blocks APPROVE, per the packet's
    //    documented scope (open_question #5 in the service).
    // -------------------------------------------------------------------------
    it('rejects APPROVE on an expired proposal with proposal_review_window_expired, but allows REJECT on the same expired proposal', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('expiry');
      const runId = `run-t6-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const pastExpiry = new Date(Date.now() - 60_000).toISOString();
        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'expiry',
            createdByActorId: 'actor-A',
            expiresAt: pastExpiry,
          })
        );
        expect(created.expiresAt).toBe(pastExpiry);

        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: 'actor-A' },
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
              decidedByActorId: 'actor-B',
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
            decidedByActorId: 'actor-B',
          }),
          submitted.version
        );
        expect(rejectResult.proposal.status).toBe('REJECTED');

        const rowAfterReject = await readProposalRow(created.actionProposalId);
        expect(rowAfterReject?.status).toBe('REJECTED');
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    // -------------------------------------------------------------------------
    // 7. transitionProposalToExecuting rejects with proposal_target_stale when
    //    the referenced case_plan_versions row is no longer PUBLISHED (a later
    //    plan version superseded it) — the packet's own "invalidation"
    //    enforcement (CW-RT-023, CW-RT-061, CW-00-020-INV11).
    // -------------------------------------------------------------------------
    it('transitionProposalToExecuting rejects with proposal_target_stale once the targeted plan version has been superseded', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('target-stale');
      const runId = `run-t7-${randomUUID()}`;
      try {
        await seedV8Run({ runId, organizationId: orgId });

        const planVersionA = await publishedPlanVersion({
          caseId,
          tag: 'target-stale-a',
          actorId: 'actor-plan-owner',
        });

        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({
            caseId,
            runId,
            tag: 'target-stale',
            createdByActorId: 'actor-A',
            casePlanVersionId: planVersionA.casePlanVersionId,
          })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: 'actor-A' },
          created.version
        );
        const approved = await proposalApprovalService.recordApprovalDecision(
          created.actionProposalId,
          minimalDecisionInput({
            tag: 'target-stale',
            proposalVersion: submitted.proposalVersion,
            payloadDigest: submitted.payloadDigest,
            decision: 'APPROVE',
            decidedByActorId: 'actor-B',
          }),
          submitted.version
        );
        expect(approved.proposal.status).toBe('APPROVED');

        // Replan: publishing B atomically supersedes A for the same case, so
        // the proposal's targeted plan version (A) is no longer PUBLISHED.
        const planVersionB = await publishedPlanVersion({
          caseId,
          tag: 'target-stale-b',
          actorId: 'actor-plan-owner',
          supersedesPlanVersionId: planVersionA.casePlanVersionId,
        });
        expect(planVersionB.casePlanVersionId).not.toBe(planVersionA.casePlanVersionId);

        await expect(
          proposalApprovalService.transitionProposalToExecuting(
            created.actionProposalId,
            { actorUserId: 'actor-executor' },
            approved.proposal.version
          )
        ).rejects.toThrow(/proposal_target_stale/);

        const row = await readProposalRow(created.actionProposalId);
        expect(row?.status).toBe('APPROVED');
        expect(row?.version).toBe(approved.proposal.version);
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  }
);
