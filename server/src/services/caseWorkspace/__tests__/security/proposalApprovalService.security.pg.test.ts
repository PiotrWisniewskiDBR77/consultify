/**
 * Case Workspace — Stream E adversarial security specification for
 * proposalApprovalService.ts (CW-P05, EPIC E6).
 *
 * SPECIFICATION, NOT YET RUN — see caseCoreService.security.pg.test.ts's
 * header for the full explanation of why (shared disposable Postgres +
 * services under concurrent modification by other streams right now; a
 * clean SKIP via the standard RUN_DB_TESTS/MOCK_DB/schema-probe gate is the
 * correct and expected outcome until fan-in, not a Stream E defect).
 *
 * Per caseWorkspaceAuthContext.ts's own RETROFIT NOTE, this service's
 * recordApprovalDecision is RETROFIT PRIORITY #1 (highest): "the literal
 * human authorization decision point ... Today it checks self-approval and
 * proposal staleness but never that decidedByActorId is even an active
 * member of the case's organization, let alone holds a role the org's
 * policy requires." Verified directly (not trusted from that comment) via:
 *   grep -rl "caseWorkspaceAuthContext\|requireCaseAccess\|requireOrgMember\|requireOrgRole" \
 *     server/src/services/caseWorkspace --include="*.ts" | grep -v caseWorkspaceAuthContext.ts
 * against the reference worktree: zero matches.
 *
 * Two describe blocks, same convention as caseCoreService.security.pg.test.ts:
 *   (A) target contract — requireCaseAccess composed in front of the
 *       service call. Exercises real, already-proven code. Expected PASS.
 *   (B) known gap (P1) — the service called directly, no auth gate.
 *       Expected FAIL today (documents a real, tracked gap; a red result
 *       here is correct, not a Stream E authoring defect).
 *
 * Fixture conventions (seedOrgProjectCase, seedV8Run, minimalProposalInput,
 * minimalDecisionInput, teardown order) are copied verbatim from the
 * existing __tests__/proposalApprovalService.pg.test.ts to stay consistent
 * with that file's own hard-won FK-ordering lessons (proposals before
 * v8_execution_runs before case_core before projects before organizations).
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import { requireCaseAccess } from '../../caseWorkspaceAuthContext.js';
import * as proposalApprovalService from '../../proposalApprovalService.js';
import type {
  CreateActionProposalInput,
  RecordApprovalDecisionInput,
} from '../../proposalApprovalService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const proposalsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_action_proposals'
          AND column_name IN ('action_proposal_id', 'case_id', 'run_id', 'status', 'version', 'idempotency_key')`
    );
    const runsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'v8_execution_runs'
          AND column_name IN ('run_id', 'organization_id')`
    );
    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    return (
      Number(proposalsResult.rows[0]?.present ?? 0) === 6 &&
      Number(runsResult.rows[0]?.present ?? 0) === 2 &&
      Number(orgMembersResult.rows[0]?.present ?? 0) === 4
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
    `[proposalApprovalService SECURITY pg suite SKIPPED — clean skip pending Stream A/B/C fan-in, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `proposals_approvals + v8_execution_spine + organization_members migrations applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('proposalApprovalService — adversarial security (Stream E, CW-P05/E6)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // ---------------------------------------------------------------------
  // Fixture helpers
  // ---------------------------------------------------------------------

  async function seedOrg(label: string): Promise<string> {
    const orgId = `secpa-org-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      orgId,
      `Stream E proposal test org (${label})`,
    ]);
    return orgId;
  }

  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `secpa-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  async function seedMember(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: string = 'ACTIVE'
  ): Promise<string> {
    const membershipId = `secpa-member-${randomUUID()}`;
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, $4, $5)`,
      [membershipId, orgId, userId, role, status]
    );
    return membershipId;
  }

  /**
   * Post-Stream-A addendum: caseCoreService.createCase now calls
   * requireOrgMember(createdByActorId, organizationId) internally, so the
   * fixture's creator actor must be a real ACTIVE member of the org — a
   * bare unseeded string id (the pre-retrofit fixture shape) now fails at
   * fixture-setup with CaseWorkspaceAuthError('not_org_member', ...).
   */
  async function seedActiveActor(
    orgId: string,
    tag: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'MEMBER'
  ): Promise<string> {
    const userId = await seedUser(orgId, tag);
    await seedMember(orgId, userId, role, 'ACTIVE');
    return userId;
  }

  async function seedOrgProjectCase(label: string): Promise<{ orgId: string; projectId: string; caseId: string }> {
    const orgId = await seedOrg(label);
    const projectId = `secpa-project-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Stream E proposal test project (${label})`]
    );
    const creatorUserId = await seedActiveActor(orgId, `${label}-creator`, 'OWNER');
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: creatorUserId,
    });
    return { orgId, projectId, caseId: created.caseId };
  }

  /** Copied verbatim from __tests__/proposalApprovalService.pg.test.ts's own seedV8Run(). */
  async function seedV8Run(params: { runId: string; organizationId: string; goal?: string }): Promise<void> {
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

  function minimalProposalInput(params: {
    caseId: string;
    runId: string;
    tag: string;
    createdByActorId?: string;
    idempotencyKey?: string;
    payloadDigest?: string;
  }): CreateActionProposalInput {
    return {
      caseId: params.caseId,
      runId: params.runId,
      nodeRunId: `noderun-${params.tag}`,
      casePlanVersionId: null,
      payloadDigest: params.payloadDigest ?? `sha256:${params.tag}-payload`,
      policySnapshotRef: `policy-snapshot-${params.tag}`,
      effectClass: 'SENSITIVE_UPDATE',
      previewRef: `preview-${params.tag}`,
      expiresAt: null,
      proposerType: 'AGENT',
      createdByActorId: params.createdByActorId ?? `actor-A-${params.tag}`,
      idempotencyKey: params.idempotencyKey ?? `idem-${params.tag}-${randomUUID()}`,
    };
  }

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

  async function readProposalRow(actionProposalId: string) {
    const result = await control.query(
      `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
      [actionProposalId]
    );
    return result.rows[0] ?? null;
  }

  /** Teardown order matters: proposals (and their cascaded decisions) before v8_execution_runs before case_core/projects before organizations. */
  async function teardown(params: { runIds: string[]; orgIds: string[]; projectIds: string[]; userIds?: string[] }): Promise<void> {
    if (params.runIds.length > 0) {
      await control
        .query(`DELETE FROM case_workspace_action_proposals WHERE run_id = ANY($1)`, [params.runIds])
        .catch(() => undefined);
      await control.query(`DELETE FROM v8_execution_runs WHERE run_id = ANY($1)`, [params.runIds]).catch(() => undefined);
    }
    for (const userId of params.userIds ?? []) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const projectId of params.projectIds) {
      await control.query(`DELETE FROM case_core WHERE project_id = $1`, [projectId]).catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const orgId of params.orgIds) {
      // organization_members cascades automatically (ON DELETE CASCADE from
      // organizations); users does not carry that FK, so any actor seeded
      // via seedActiveActor()/seedUser() for this org is swept here by
      // organization_id rather than needing per-test tracking.
      await control.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]).catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  // =========================================================================
  // (A) TARGET CONTRACT
  // =========================================================================
  describe('(A) target contract: requireCaseAccess in front of proposalApprovalService fails closed', () => {
    it('IDOR: an actor with no standing in the victim org is denied requireCaseAccess before createActionProposal would even run', async () => {
      const { orgId: victimOrgId, projectId: victimProjectId, caseId: victimCaseId } =
        await seedOrgProjectCase('idor-victim');
      const runId = `run-idor-${randomUUID()}`;
      await seedV8Run({ runId, organizationId: victimOrgId });
      const attackerOrgId = await seedOrg('idor-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'idor-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'ADMIN', 'ACTIVE');

      try {
        await expect(requireCaseAccess(attackerUserId, victimCaseId)).rejects.toMatchObject({
          code: 'case_access_denied',
        });
        // A route composing requireCaseAccess correctly never reaches
        // createActionProposal at all for this actor/case pair.
      } finally {
        await teardown({ runIds: [runId], orgIds: [victimOrgId, attackerOrgId], projectIds: [victimProjectId], userIds: [attackerUserId] });
      }
    }, 30_000);

    it('revoked membership: an approver whose membership is revoked between viewing and deciding is denied requireCaseAccess on the decision attempt', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('revoked-approver');
      const runId = `run-revoked-${randomUUID()}`;
      await seedV8Run({ runId, organizationId: orgId });
      const approverUserId = await seedUser(orgId, 'revoked-approver');
      const membershipId = await seedMember(orgId, approverUserId, 'ADMIN', 'ACTIVE');

      try {
        await expect(requireCaseAccess(approverUserId, caseId)).resolves.toBeTruthy();
        await control.query(`UPDATE organization_members SET status = 'REVOKED' WHERE id = $1`, [membershipId]);
        await expect(requireCaseAccess(approverUserId, caseId)).rejects.toMatchObject({
          code: 'case_access_denied',
        });
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId], userIds: [approverUserId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (B) GAP CLOSED by Stream A (formerly known gap P1, RETROFIT PRIORITY #5
  //     and #1 per caseWorkspaceAuthContext.ts's own RETROFIT NOTE).
  //     Verified directly against the CURRENT code
  //     (server/src/services/caseWorkspace/proposalApprovalService.ts):
  //     createActionProposal now opens with
  //     `await requireCaseAccess(createdByActorId, caseId);` (line 639,
  //     using the input's ALREADY-EXISTING createdByActorId field), and
  //     recordApprovalDecision now opens its transaction with
  //     `await requireCaseAccess(decidedByActorId, row.case_id);` (line 853,
  //     BEFORE the self-approval/staleness checks, using the input's
  //     ALREADY-EXISTING decidedByActorId field). Both tests below now
  //     assert REJECTION, proving each gap is closed — polarity inverted
  //     from the original spec, coverage kept (not deleted).
  // =========================================================================
  describe('(B) gap CLOSED by Stream A (formerly known gap P1): proposalApprovalService now self-enforces tenant/membership', () => {
    it('GAP CLOSED: createActionProposal now REJECTS a caseId the calling actor has no standing in (was: succeeded silently)', async () => {
      const { orgId: victimOrgId, projectId: victimProjectId, caseId: victimCaseId } =
        await seedOrgProjectCase('gap-create');
      const runId = `run-gap-create-${randomUUID()}`;
      await seedV8Run({ runId, organizationId: victimOrgId });
      const attackerOrgId = await seedOrg('gap-create-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'gap-create-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'CONSULTANT', 'ACTIVE');

      try {
        // Formerly succeeded silently — the attacker (a CONSULTANT in a
        // DIFFERENT org, arguably the lowest-privilege role) could plant a
        // proposal against the victim's case (the P1 this test used to
        // document). createActionProposal now requires requireCaseAccess
        // over the target caseId before it ever touches the row.
        await expect(
          proposalApprovalService.createActionProposal(
            minimalProposalInput({ caseId: victimCaseId, runId, tag: 'gap-create', createdByActorId: attackerUserId })
          )
        ).rejects.toMatchObject({ code: 'case_access_denied' });

        const rows = await control.query(`SELECT action_proposal_id FROM case_workspace_action_proposals WHERE case_id = $1`, [victimCaseId]);
        expect(rows.rows).toHaveLength(0); // no proposal was ever planted
      } finally {
        await teardown({ runIds: [runId], orgIds: [victimOrgId, attackerOrgId], projectIds: [victimProjectId], userIds: [attackerUserId] });
      }
    }, 30_000);

    it('GAP CLOSED: recordApprovalDecision (APPROVE) now REJECTS a decidedByActorId with no organization_members row at all (was: GOV-022\'s self-approval check alone let it through)', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('gap-decide');
      const runId = `run-gap-decide-${randomUUID()}`;
      await seedV8Run({ runId, organizationId: orgId });
      // createActionProposal/submitActionProposalForReview both now
      // self-enforce requireCaseAccess — the proposer must be a real ACTIVE
      // member of orgId.
      const proposerId = await seedActiveActor(orgId, 'gap-decide-proposer');

      try {
        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({ caseId, runId, tag: 'gap-decide', createdByActorId: proposerId })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: proposerId },
          created.version
        );

        // ghostApprover has NO organization_members row for `orgId` at all
        // (not even a REVOKED one) — a pure identity string with zero
        // standing. Formerly succeeded silently: GOV-022 only checked
        // decidedByActorId !== createdByActorId (self-approval), never that
        // decidedByActorId is a real, active member of the case's own
        // organization (the P1 this test used to document).
        // recordApprovalDecision now opens with
        // requireCaseAccess(decidedByActorId, row.case_id) BEFORE the
        // self-approval/staleness checks, so this ghost identity is denied
        // regardless of GOV-022.
        const ghostApproverId = `ghost-approver-${randomUUID()}`;
        await expect(
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'gap-decide',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: submitted.payloadDigest,
              decision: 'APPROVE',
              decidedByActorId: ghostApproverId,
            }),
            submitted.version
          )
        ).rejects.toMatchObject({ code: 'case_access_denied' });

        const row = await readProposalRow(created.actionProposalId);
        expect(row?.status).toBe('PENDING_REVIEW'); // unchanged — no decision landed
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (C) Stale version / optimistic concurrency — CORRECTED, not a Stream A
  //     concern. The original spec here predicted the loser of the race
  //     would surface `proposal_version_conflict` (from the UPDATE's
  //     `WHERE ... AND version = expectedVersion` OCC clause failing to
  //     match). Running this for real against Postgres shows that is not
  //     what happens: recordApprovalDecision's `loadForUpdate` acquires a
  //     `SELECT ... FOR UPDATE` row lock BEFORE the OCC update (same
  //     internal-lock pattern documented in caseCoreService.security.pg.test.ts's
  //     and artifactLinkService.security.pg.test.ts's own (C) sections), so
  //     the two concurrent calls fully SERIALIZE on that lock rather than
  //     racing into the UPDATE at the same time. By the time the second
  //     (loser) transaction acquires the lock, the FIRST transaction has
  //     already committed the decision and flipped `status` away from
  //     'PENDING_REVIEW' — and recordApprovalDecision checks
  //     `row.status !== 'PENDING_REVIEW'` (throws
  //     `proposal_status_transition_not_allowed`) BEFORE it ever compares
  //     `proposal_version`/`payload_digest` (the check that would throw
  //     `proposal_stale`) or reaches the OCC UPDATE (the check that would
  //     throw `proposal_version_conflict`). So the loser's real, correct
  //     error is `proposal_status_transition_not_allowed:<status>->decision`,
  //     not `proposal_version_conflict` — this was a Stream E authoring
  //     mistake in the ORIGINAL prediction (unrelated to Stream A's
  //     authorization retrofit), corrected here after actually running the
  //     suite against Postgres per this packet's own instructions. The
  //     property that actually matters — exactly one terminal decision ever
  //     lands, never a silent double-decision — still holds and is still
  //     asserted below.
  // =========================================================================
  describe('(C) stale version / optimistic concurrency (row-lock serializes; see corrected comment above)', () => {
    it('two CONCURRENT recordApprovalDecision calls with the SAME expectedVersion: exactly one wins, the other is rejected by the row-lock-serialized status check, never a silent double-decision', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('occ-decision');
      const runId = `run-occ-decision-${randomUUID()}`;
      await seedV8Run({ runId, organizationId: orgId });
      // createActionProposal/submitActionProposalForReview/recordApprovalDecision
      // all now self-enforce requireCaseAccess — every actor must be a real
      // ACTIVE member of orgId.
      const proposerId = await seedActiveActor(orgId, 'occ-decision-proposer');
      const approverAId = await seedActiveActor(orgId, 'occ-decision-approver-a');
      const approverBId = await seedActiveActor(orgId, 'occ-decision-approver-b');

      try {
        const created = await proposalApprovalService.createActionProposal(
          minimalProposalInput({ caseId, runId, tag: 'occ-decision', createdByActorId: proposerId })
        );
        const submitted = await proposalApprovalService.submitActionProposalForReview(
          created.actionProposalId,
          { actorUserId: proposerId },
          created.version
        );
        const staleExpectedVersion = submitted.version;

        const outcomes = await Promise.allSettled([
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'occ-decision-a',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: submitted.payloadDigest,
              decision: 'APPROVE',
              decidedByActorId: approverAId,
            }),
            staleExpectedVersion
          ),
          proposalApprovalService.recordApprovalDecision(
            created.actionProposalId,
            minimalDecisionInput({
              tag: 'occ-decision-b',
              proposalVersion: submitted.proposalVersion,
              payloadDigest: submitted.payloadDigest,
              decision: 'REJECT',
              decidedByActorId: approverBId,
            }),
            staleExpectedVersion
          ),
        ]);

        const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
        const rejected = outcomes.filter((o) => o.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect((rejected[0] as PromiseRejectedResult).reason?.message ?? String((rejected[0] as PromiseRejectedResult).reason)).toMatch(
          /proposal_status_transition_not_allowed:(APPROVED|REJECTED)->decision/
        );

        // Final DB state reflects exactly ONE terminal decision, not both.
        const row = await readProposalRow(created.actionProposalId);
        expect(['APPROVED', 'REJECTED']).toContain(row?.status);
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (D) Malformed input
  // =========================================================================
  describe('(D) malformed input rejected with stable domain errors', () => {
    it('createActionProposal rejects a missing payloadDigest with a domain error, not a raw constraint error', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('malformed-payload-digest');
      const runId = `run-malformed-1-${randomUUID()}`;
      await seedV8Run({ runId, organizationId: orgId });
      try {
        const input = minimalProposalInput({ caseId, runId, tag: 'malformed-1', payloadDigest: '' });
        await expect(proposalApprovalService.createActionProposal(input)).rejects.toThrow(
          'proposal_payload_digest_required'
        );
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    it('createActionProposal rejects an invalid effectClass enum value with a domain error', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('malformed-effect-class');
      const runId = `run-malformed-2-${randomUUID()}`;
      await seedV8Run({ runId, organizationId: orgId });
      try {
        const input = {
          ...minimalProposalInput({ caseId, runId, tag: 'malformed-2' }),
          effectClass: 'NOT_A_REAL_EFFECT_CLASS' as CreateActionProposalInput['effectClass'],
        };
        await expect(proposalApprovalService.createActionProposal(input)).rejects.toThrow(
          'proposal_effect_class_invalid'
        );
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    it('createActionProposal rejects a run belonging to a DIFFERENT organization than the case (cross-tenant, different resource type) — an existing internal protection, verified not just trusted', async () => {
      const { orgId: caseOrgId, projectId, caseId } = await seedOrgProjectCase('cross-resource-run');
      const otherOrgId = await seedOrg('cross-resource-run-other');
      const foreignRunId = `run-foreign-${randomUUID()}`;
      await seedV8Run({ runId: foreignRunId, organizationId: otherOrgId });
      // createActionProposal's requireCaseAccess(createdByActorId, caseId)
      // gate now runs BEFORE the run/case organization-mismatch check this
      // test targets, so the actor must be a real ACTIVE member of
      // caseOrgId — otherwise this test would (correctly, but for the WRONG
      // reason) observe case_access_denied instead of the
      // run_case_organization_mismatch business-logic error it means to
      // probe as "an existing internal protection".
      const actorId = await seedActiveActor(caseOrgId, 'cross-resource-run-actor');
      try {
        const input = minimalProposalInput({ caseId, runId: foreignRunId, tag: 'cross-resource-run', createdByActorId: actorId });
        await expect(proposalApprovalService.createActionProposal(input)).rejects.toThrow(
          'run_case_organization_mismatch'
        );
        const rows = await control.query(`SELECT * FROM case_workspace_action_proposals WHERE case_id = $1`, [caseId]);
        expect(rows.rows).toHaveLength(0);
      } finally {
        await teardown({ runIds: [foreignRunId], orgIds: [caseOrgId, otherOrgId], projectIds: [projectId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (E) Duplicate request / retry-replay
  // =========================================================================
  describe('(E) duplicate request / retry-replay', () => {
    it('CONCURRENT createActionProposal calls with the SAME idempotencyKey+payloadDigest (Promise.all): exactly one row lands, both callers observe the same actionProposalId', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('dup-concurrent');
      const runId = `run-dup-concurrent-${randomUUID()}`;
      await seedV8Run({ runId, organizationId: orgId });
      // createActionProposal now self-enforces requireCaseAccess — the
      // actor must be a real ACTIVE member of orgId.
      const actorId = await seedActiveActor(orgId, 'dup-concurrent-actor');
      try {
        const idempotencyKey = `idem-dup-concurrent-${randomUUID()}`;
        const input = minimalProposalInput({ caseId, runId, tag: 'dup-concurrent', idempotencyKey, createdByActorId: actorId });

        const [a, b] = await Promise.all([
          proposalApprovalService.createActionProposal(input),
          proposalApprovalService.createActionProposal(input),
        ]);
        expect(a.actionProposalId).toBe(b.actionProposalId);

        const rows = await control.query(
          `SELECT action_proposal_id FROM case_workspace_action_proposals WHERE case_id = $1`,
          [caseId]
        );
        expect(rows.rows).toHaveLength(1);
      } finally {
        await teardown({ runIds: [runId], orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });
});
