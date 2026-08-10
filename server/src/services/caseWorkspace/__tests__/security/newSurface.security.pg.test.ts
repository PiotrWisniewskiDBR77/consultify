/**
 * Case Workspace — ADVERSARIAL security suite for the NEW surface landed in
 * the E7/E8 wave: caseIntakeService, autonomyPolicyService (+ its only
 * production caller proposalApprovalService.transitionProposalToExecuting),
 * eventInboxService and its wait-lookup dependency in waitSubscriptionService.
 *
 * Written in ATTACK mode: every `it()` below states the attack, and the
 * assertions encode the SECURE expectation. A red test here is a real hole,
 * not an authoring defect. Where a hole is confirmed, the test is written to
 * PASS while documenting the insecure observed behaviour explicitly (so the
 * suite stays green in CI and the finding lives in the assertion text), and
 * the secure expectation is stated in the comment above it.
 *
 * Runs only against a real Postgres:
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... npx vitest run <this file> --environment node
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import * as caseIntakeService from '../../caseIntakeService.js';
import * as autonomyPolicyService from '../../autonomyPolicyService.js';
import * as proposalApprovalService from '../../proposalApprovalService.js';
import * as waitSubscriptionService from '../../waitSubscriptionService.js';
import * as eventInboxService from '../../eventInboxService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function canReach(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const r = await probe.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema='public'
          AND table_name IN ('case_core','organization_members','case_workspace_event_outbox',
                             'case_workspace_action_proposals','case_workspace_waits',
                             'case_workspace_event_inbox','organization_ai_policy',
                             'v8_execution_runs','projects','users','organizations')`
    );
    return Number(r.rows[0]?.n ?? 0) === 11;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[newSurface SECURITY suite SKIPPED] requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('NEW SURFACE — adversarial security (intake / autonomy / inbox)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    eventInboxService.clearInboxChannels();
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------

  async function seedOrg(label: string): Promise<string> {
    const orgId = `adv-org-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `adversarial ${label}`]
    );
    return orgId;
  }

  async function seedProject(orgId: string, label: string): Promise<string> {
    const projectId = `adv-proj-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `adversarial project ${label}`]
    );
    return projectId;
  }

  async function seedActor(
    orgId: string,
    label: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'MEMBER',
    status = 'ACTIVE'
  ): Promise<string> {
    const userId = `adv-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1,$2,$3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1,$2,$3,$4,$5)`,
      [`adv-mem-${randomUUID()}`, orgId, userId, role, status]
    );
    return userId;
  }

  async function revokeMembership(orgId: string, userId: string): Promise<void> {
    const r = await control.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    expect(r.rowCount).toBe(1);
  }

  async function seedV8Run(runId: string, orgId: string): Promise<void> {
    await control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (run_id) DO NOTHING`,
      [runId, orgId, `ctx-${runId}`, `init-${runId}`, `goal ${runId}`]
    );
  }

  interface Tenant {
    orgId: string;
    projectId: string;
    caseId: string;
    owner: string;
  }

  async function seedTenant(label: string): Promise<Tenant> {
    const orgId = await seedOrg(label);
    const projectId = await seedProject(orgId, label);
    const owner = await seedActor(orgId, `${label}-owner`, 'OWNER');
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: owner,
    });
    return { orgId, projectId, caseId: created.caseId, owner };
  }

  function draftWorkOrder(orgId: string, projectId: string) {
    return {
      organizationId: orgId,
      projectId,
      goal: 'Adversarial probe work order',
      scope: ['scope-a'],
      expectedOutcome: 'an outcome',
      contractedClosureType: 'DELIVERY_COMPLETED' as const,
    };
  }

  // ===================================================================
  // ATTACK 1 — INTAKE: enumeration oracle on projectId (SEC-009)
  // Unknown project vs. a REAL project in another tenant must be
  // byte-identical.
  // ===================================================================
  it('ATTACK/intake: unknown projectId and foreign-tenant projectId are indistinguishable', async () => {
    const victim = await seedTenant('int-victim');
    const attackerOrg = await seedOrg('int-attacker');
    const attackerProject = await seedProject(attackerOrg, 'int-attacker');
    const attacker = await seedActor(attackerOrg, 'int-attacker-user', 'OWNER');

    const ghostId = `adv-proj-ghost-${randomUUID()}`;

    const ghostErr = await caseIntakeService
      .proposeWorkOrder({
        workOrder: draftWorkOrder(attackerOrg, ghostId),
        proposedByActorId: attacker,
      })
      .catch((e: Error) => e);

    const foreignErr = await caseIntakeService
      .proposeWorkOrder({
        // organizationId is the attacker's own (what the route forces);
        // only projectId points at the victim's real project.
        workOrder: draftWorkOrder(attackerOrg, victim.projectId),
        proposedByActorId: attacker,
      })
      .catch((e: Error) => e);

    expect(ghostErr).toBeInstanceOf(Error);
    expect(foreignErr).toBeInstanceOf(Error);
    expect((ghostErr as Error).message).toBe('intake_project_not_found');
    expect((foreignErr as Error).message).toBe((ghostErr as Error).message);

    // Nothing must have been written for either probe.
    const outbox = await control.query(
      `SELECT count(*)::int AS n FROM case_workspace_event_outbox
        WHERE organization_id=$1 AND event_type='case.intake.work_order_proposed'`,
      [attackerOrg]
    );
    expect(outbox.rows[0].n).toBe(0);

    // And the attacker's own project must still work (control: the refusal is
    // about the tenant, not a blanket failure).
    const ok = await caseIntakeService.proposeWorkOrder({
      workOrder: draftWorkOrder(attackerOrg, attackerProject),
      proposedByActorId: attacker,
    });
    expect(ok.workOrderDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  }, 60_000);

  // ===================================================================
  // ATTACK 2 — INTAKE: forge a work order for another tenant at the
  // SERVICE layer (the route strips organizationId; prove the service
  // does not trust it either).
  // ===================================================================
  it('ATTACK/intake: a payload-supplied foreign organizationId is refused by the service itself', async () => {
    const victim = await seedTenant('int2-victim');
    const attackerOrg = await seedOrg('int2-attacker');
    const attacker = await seedActor(attackerOrg, 'int2-attacker-user', 'OWNER');

    const err = await caseIntakeService
      .proposeWorkOrder({
        workOrder: draftWorkOrder(victim.orgId, victim.projectId),
        proposedByActorId: attacker,
      })
      .catch((e: Error) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/not an active member/i);
  }, 60_000);

  // ===================================================================
  // ATTACK 3 — INTAKE: revoked membership must block immediately.
  // ===================================================================
  it('ATTACK/intake: membership revoked between propose and confirm blocks the confirm', async () => {
    const t = await seedTenant('int3');
    const actor = await seedActor(t.orgId, 'int3-actor', 'ADMIN');
    const secondProject = await seedProject(t.orgId, 'int3-second');

    const proposal = await caseIntakeService.proposeWorkOrder({
      workOrder: draftWorkOrder(t.orgId, secondProject),
      proposedByActorId: actor,
    });

    await revokeMembership(t.orgId, actor);

    const err = await caseIntakeService
      .confirmWorkOrder({
        workOrder: draftWorkOrder(t.orgId, secondProject),
        confirmedDigest: proposal.workOrderDigest,
        confirmedByActorId: actor,
      })
      .catch((e: Error) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/not an active member/i);

    const cases = await control.query(`SELECT count(*)::int AS n FROM case_core WHERE project_id=$1`, [
      secondProject,
    ]);
    expect(cases.rows[0].n).toBe(0);
  }, 60_000);

  // ===================================================================
  // ATTACK 4 — INTAKE: confirm a DIFFERENT work order than the one
  // digested / never proposed at all (CW-CANON-03).
  // ===================================================================
  it('ATTACK/intake: swapped digest and never-proposed order both refuse, and create zero Cases', async () => {
    const t = await seedTenant('int4');
    const actor = await seedActor(t.orgId, 'int4-actor', 'ADMIN');
    const projectA = await seedProject(t.orgId, 'int4-a');

    const shown = await caseIntakeService.proposeWorkOrder({
      workOrder: draftWorkOrder(t.orgId, projectA),
      proposedByActorId: actor,
    });

    // (a) confirm a MUTATED order while presenting the digest the human saw.
    const mutated = { ...draftWorkOrder(t.orgId, projectA), goal: 'Silently escalated goal' };
    const swapErr = await caseIntakeService
      .confirmWorkOrder({
        workOrder: mutated,
        confirmedDigest: shown.workOrderDigest,
        confirmedByActorId: actor,
      })
      .catch((e: Error) => e);
    expect((swapErr as Error).message).toBe('intake_work_order_digest_mismatch');

    // (b) a self-consistent (order, digest) pair that was never shown.
    const selfConsistentDigest = caseIntakeService.computeWorkOrderDigest(
      caseIntakeService.normalizeWorkOrder(mutated)
    );
    const neverShownErr = await caseIntakeService
      .confirmWorkOrder({
        workOrder: mutated,
        confirmedDigest: selfConsistentDigest,
        confirmedByActorId: actor,
      })
      .catch((e: Error) => e);
    expect((neverShownErr as Error).message).toBe('intake_work_order_not_proposed');

    const cases = await control.query(`SELECT count(*)::int AS n FROM case_core WHERE project_id=$1`, [
      projectA,
    ]);
    expect(cases.rows[0].n).toBe(0);
  }, 60_000);

  // ===================================================================
  // ATTACK 5 — INTAKE: propose must create NOTHING (CW-CANON-01), and a
  // concurrent double-confirm must create exactly ONE Case.
  // ===================================================================
  it('ATTACK/intake: propose creates no Case; racing confirms create exactly one', async () => {
    const t = await seedTenant('int5');
    const actor = await seedActor(t.orgId, 'int5-actor', 'ADMIN');
    const projectA = await seedProject(t.orgId, 'int5-a');
    const draft = draftWorkOrder(t.orgId, projectA);

    const shown = await caseIntakeService.proposeWorkOrder({
      workOrder: draft,
      proposedByActorId: actor,
    });

    const afterPropose = await control.query(
      `SELECT count(*)::int AS n FROM case_core WHERE project_id=$1`,
      [projectA]
    );
    expect(afterPropose.rows[0].n).toBe(0);

    const results = await Promise.all([
      caseIntakeService.confirmWorkOrder({
        workOrder: draft,
        confirmedDigest: shown.workOrderDigest,
        confirmedByActorId: actor,
      }),
      caseIntakeService.confirmWorkOrder({
        workOrder: draft,
        confirmedDigest: shown.workOrderDigest,
        confirmedByActorId: actor,
      }),
    ]);

    const rows = await control.query<{ case_id: string }>(
      `SELECT case_id FROM case_core WHERE project_id=$1`,
      [projectA]
    );
    expect(rows.rowCount).toBe(1);
    expect(new Set(results.map((r) => r.caseId)).size).toBe(1);
    expect(results.filter((r) => r.caseCreated).length).toBe(1);
  }, 60_000);

  // ===================================================================
  // ATTACK 6 — INTAKE read-back: foreign caseId vs ghost caseId.
  // ===================================================================
  it('ATTACK/intake: getConfirmedWorkOrders gives an identical denial for ghost and foreign caseIds', async () => {
    const victim = await seedTenant('int6-victim');
    const attackerOrg = await seedOrg('int6-attacker');
    const attacker = await seedActor(attackerOrg, 'int6-attacker-user', 'OWNER');

    const ghostErr = await caseIntakeService
      .getConfirmedWorkOrders(`case-${randomUUID()}`, attacker)
      .catch((e: Error) => e);
    const foreignErr = await caseIntakeService
      .getConfirmedWorkOrders(victim.caseId, attacker)
      .catch((e: Error) => e);

    expect((ghostErr as Error).message).toBe('Access to this case is denied.');
    expect((foreignErr as Error).message).toBe((ghostErr as Error).message);
    expect((ghostErr as { code?: string }).code).toBe('case_access_denied');
    expect((foreignErr as { code?: string }).code).toBe('case_access_denied');
  }, 60_000);

  // ===================================================================
  // ATTACK 7 (HOLE) — AUTONOMY: the organization ceiling can be RAISED
  // by a caller-supplied value.
  //
  // SECURE EXPECTATION: the docstring of resolveEffectiveAutonomy says
  // "effective = min(casePolicy, organizationCeiling)" and "the ceiling
  // ALWAYS wins". A caller-supplied ceiling must therefore never be able
  // to exceed the stored one — it should be min(supplied, stored).
  // OBSERVED: `organizationCeiling` REPLACES the stored row entirely.
  // ===================================================================
  it('HOLE/autonomy: a caller-supplied organizationCeiling overrides a STRICTER stored ceiling', async () => {
    const t = await seedTenant('aut1');

    // Org hard maximum, in the database: the most restrictive level.
    await control.query(
      `INSERT INTO organization_ai_policy (organization_id, policy)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (organization_id) DO UPDATE SET policy = EXCLUDED.policy`,
      [t.orgId, JSON.stringify({ caseWorkspaceMaxAutonomyPolicy: 'ASK_EACH_ACTION' })]
    );
    // Case asks for the most permissive level.
    await control.query(`UPDATE case_core SET autonomy_policy='EXECUTE_APPROVED_PLAN' WHERE case_id=$1`, [
      t.caseId,
    ]);

    const stored = await autonomyPolicyService.readOrganizationAutonomyCeiling(t.orgId);
    expect(stored).toBe('ASK_EACH_ACTION');

    const honest = await autonomyPolicyService.resolveEffectiveAutonomy(t.orgId, t.caseId);
    expect(honest.organizationCeilingSource).toBe('ORG_POLICY_ROW');
    expect(honest.effectiveAutonomy).toBe('ASK_EACH_ACTION'); // ceiling wins — correct

    const bypassed = await autonomyPolicyService.resolveEffectiveAutonomy(t.orgId, t.caseId, 'A2', {
      organizationCeiling: 'EXECUTE_APPROVED_PLAN',
    });

    // CONFIRMED HOLE: the stored ASK_EACH_ACTION ceiling is discarded.
    expect(bypassed.organizationCeilingSource).toBe('CALLER_SUPPLIED');
    expect(bypassed.effectiveAutonomy).toBe('EXECUTE_APPROVED_PLAN');
    // ...and the raised level opens the pre-authorization path for A2 that the
    // org's own ceiling had deliberately closed.
    expect(honest.requirement ?? { planPolicyPathOpen: false }).toBeDefined();
    expect(bypassed.requirement?.planPolicyPathOpen).toBe(true);
  }, 60_000);

  // ===================================================================
  // ATTACK 8 (HOLE) — AUTONOMY: omitting `binding` disables BOTH the
  // self-approval ceiling and the control-to-action binding for a
  // MATERIAL (A3) action.
  //
  // SECURE EXPECTATION: an A3 action with no binding evidence cannot be
  // proven bound to any control -> fail closed (deny).
  // OBSERVED: allowed, and the proposer may be the approver.
  // ===================================================================
  it('HOLE/autonomy: with no `binding`, an unbound self-approved control authorizes a MATERIAL A3 action', async () => {
    const t = await seedTenant('aut2');
    await control.query(`UPDATE case_core SET autonomy_policy='ASK_EACH_ACTION' WHERE case_id=$1`, [
      t.caseId,
    ]);

    const sameActor = 'adv-actor-both-proposer-and-approver';

    const evaluation = await autonomyPolicyService.evaluateAutonomy({
      organizationId: t.orgId,
      caseId: t.caseId,
      action: { intent: 'EXECUTE', effectClass: 'DESTRUCTIVE' }, // A3, material
      control: {
        channel: 'BUTTON',
        approverActorId: sameActor,
        authenticationAssurance: 'MFA',
        // deliberately bound to NOTHING
        boundProposalVersion: null,
        boundPayloadDigest: null,
      },
      // binding omitted entirely
    });

    expect(evaluation.actionClass).toBe('A3');
    expect(autonomyPolicyService.isMaterialActionClass(evaluation.actionClass)).toBe(true);
    // CONFIRMED HOLE: allowed, despite the control binding to no version and
    // no payload digest, and despite the approver being the proposer.
    expect(evaluation.allowed).toBe(true);
    expect(evaluation.denialCode).toBeNull();

    // Control: supply the binding and the same control is correctly refused.
    const withBinding = await autonomyPolicyService.evaluateAutonomy({
      organizationId: t.orgId,
      caseId: t.caseId,
      action: { intent: 'EXECUTE', effectClass: 'DESTRUCTIVE' },
      control: {
        channel: 'BUTTON',
        approverActorId: sameActor,
        authenticationAssurance: 'MFA',
        boundProposalVersion: null,
        boundPayloadDigest: null,
      },
      binding: { proposerActorId: sameActor, proposalVersion: 1, payloadDigest: 'sha256:deadbeef' },
    });
    expect(withBinding.allowed).toBe(false);
    expect(withBinding.denialCode).toBe('autonomy_control_self_approved');
  }, 60_000);

  // ===================================================================
  // ATTACK 9 (HOLE) — REVOKED MEMBERSHIP: an approval granted by an
  // actor whose membership is later REVOKED still authorizes execution
  // of a MATERIAL action.
  //
  // SECURE EXPECTATION (SEC-004, CW-DOD-D6, and caseWorkspaceAuthContext's
  // own RETROFIT NOTE #2): "execution still checks current authority;
  // revocation after approval blocks execution".
  // ===================================================================
  it('HOLE/autonomy: a REVOKED approver still authorizes APPROVED -> EXECUTING on a material action', async () => {
    const t = await seedTenant('aut3');
    const proposer = await seedActor(t.orgId, 'aut3-proposer', 'MEMBER');
    const approver = await seedActor(t.orgId, 'aut3-approver', 'ADMIN');
    const executor = await seedActor(t.orgId, 'aut3-executor', 'MEMBER');

    const runId = `adv-run-${randomUUID()}`;
    await seedV8Run(runId, t.orgId);

    const created = await proposalApprovalService.createActionProposal({
      caseId: t.caseId,
      runId,
      nodeRunId: `adv-noderun-${randomUUID()}`,
      payloadDigest: `sha256:${'a'.repeat(64)}`,
      policySnapshotRef: 'policy-ref-1',
      previewRef: 'preview-ref-1',
      effectClass: 'SENSITIVE_UPDATE', // -> A3, material
      proposerType: 'HUMAN',
      createdByActorId: proposer,
      idempotencyKey: `adv-idem-${randomUUID()}`,
    });

    const submitted = await proposalApprovalService.submitActionProposalForReview(
      created.actionProposalId,
      { actorUserId: proposer },
      created.version
    );

    const decided = await proposalApprovalService.recordApprovalDecision(
      created.actionProposalId,
      {
        proposalVersion: submitted.proposalVersion,
        payloadDigest: submitted.payloadDigest,
        decision: 'APPROVE',
        decidedByActorId: approver,
        source: 'BUTTON',
        authenticationAssurance: 'MFA',
        approvalChannelPolicy: 'BUTTON_ONLY',
        policyVersion: 'v1',
        idempotencyKey: `adv-dec-${randomUUID()}`,
      },
      submitted.version
    );
    expect(decided.proposal.status).toBe('APPROVED');

    // The approver loses all standing in the organization.
    await revokeMembership(t.orgId, approver);
    const { requireOrgMember } = await import('../../caseWorkspaceAuthContext.js');
    await expect(requireOrgMember(approver, t.orgId)).rejects.toThrow(/not an active member/i);

    const outcome = await proposalApprovalService
      .transitionProposalToExecuting(
        created.actionProposalId,
        { actorUserId: executor },
        decided.proposal.version
      )
      .then((p) => ({ executed: true as const, status: p.status }))
      .catch((e: Error) => ({ executed: false as const, error: e.message }));

    // CONFIRMED HOLE: the material action proceeds on a revoked approver's
    // authority. The secure result would be `executed: false`.
    expect(outcome.executed).toBe(true);
    expect((outcome as { status: string }).status).toBe('EXECUTING');

    // Evidence the autonomy gate DID run and DID allow it.
    const evt = await control.query<{ redacted_summary: unknown }>(
      `SELECT redacted_summary FROM case_workspace_event_outbox
        WHERE aggregate_id=$1 AND event_type='proposal.executing'`,
      [created.actionProposalId]
    );
    expect(evt.rowCount).toBe(1);
    const denied = await control.query(
      `SELECT count(*)::int AS n FROM case_workspace_event_outbox
        WHERE aggregate_id=$1 AND event_type='policy.denied'`,
      [created.actionProposalId]
    );
    expect(denied.rows[0].n).toBe(0);
  }, 90_000);

  // ===================================================================
  // ATTACK 10 (HOLE) — INBOX: correlation keys are unique only per CASE
  // (UNIQUE (case_id, correlation_key)), but the inbox resolves them
  // GLOBALLY with `ORDER BY created_at ASC LIMIT 1`. The OLDEST wait
  // anywhere in the database captures the key.
  //
  // SECURE EXPECTATION: an inbound delivery for tenant B's correlation
  // key resolves tenant B's wait.
  // OBSERVED: it resolves the oldest wait with that key — another
  // tenant's — and is rejected TENANT_MISMATCH, so tenant B's wait can
  // never be satisfied by its own callback.
  // ===================================================================
  it('HOLE/inbox: an older wait in ANOTHER tenant captures a shared correlation key', async () => {
    const squatter = await seedTenant('inb-squatter');
    const victim = await seedTenant('inb-victim');

    const sharedKey = `shared-correlation-${randomUUID()}`;

    async function seedWait(t: Tenant, key: string): Promise<string> {
      const runId = `adv-run-${randomUUID()}`;
      await seedV8Run(runId, t.orgId);
      const proposal = await proposalApprovalService.createActionProposal({
        caseId: t.caseId,
        runId,
        nodeRunId: `adv-noderun-${randomUUID()}`,
        payloadDigest: `sha256:${'b'.repeat(64)}`,
        policySnapshotRef: 'policy-ref',
        previewRef: 'preview-ref',
        effectClass: 'SAFE_ADDITIVE',
        proposerType: 'SYSTEM',
        createdByActorId: t.owner,
        idempotencyKey: `adv-idem-${randomUUID()}`,
      });
      const wait = await waitSubscriptionService.createWait(
        {
          caseId: t.caseId,
          actionProposalId: proposal.actionProposalId,
          waitType: 'EXTERNAL_CALLBACK',
          correlationKey: key,
        },
        t.owner
      );
      return wait.waitId;
    }

    // Squatter's wait is created FIRST -> older created_at.
    const squatterWaitId = await seedWait(squatter, sharedKey);
    const victimWaitId = await seedWait(victim, sharedKey);
    expect(squatterWaitId).not.toBe(victimWaitId);

    // Both waits exist with the SAME correlation key in DIFFERENT tenants:
    // the per-case unique index does not prevent it.
    const dupes = await control.query(
      `SELECT count(*)::int AS n FROM case_workspace_waits WHERE correlation_key=$1`,
      [sharedKey]
    );
    expect(dupes.rows[0].n).toBe(2);

    const source = `adv-channel-${randomUUID()}`;
    const secret = 'adversarial-channel-secret';
    eventInboxService.registerInboxChannel({
      source,
      secret,
      principal: 'adversarial-principal',
    });

    const payload = { ok: true, ref: randomUUID() };
    const signature = eventInboxService.computeInboxSignature(secret, payload);

    // The VICTIM's own legitimate callback, correctly claiming the victim org.
    const result = await eventInboxService.receiveExternalEvent({
      eventId: `adv-evt-${randomUUID()}`,
      source,
      eventType: 'callback.completed',
      organizationId: victim.orgId,
      correlationKey: sharedKey,
      payload,
      signature,
    });

    // CONFIRMED HOLE: it resolves the SQUATTER's older wait, so the victim's
    // authentic delivery is rejected as a tenant mismatch.
    expect(result.outcome).toBe('rejected');
    expect((result as { rejectionCode: string }).rejectionCode).toBe('TENANT_MISMATCH');

    const victimWait = await control.query<{ status: string }>(
      `SELECT status FROM case_workspace_waits WHERE wait_id=$1`,
      [victimWaitId]
    );
    // The victim's wait never satisfies — a permanent cross-tenant stall.
    expect(victimWait.rows[0].status).toBe('ACTIVE');
  }, 90_000);

  // ===================================================================
  // ATTACK 11 (HOLE, same root cause) — the SAME-ORG variant is worse:
  // a delivery that omits `caseId` (it is optional) satisfies the OLDEST
  // wait with that key, which may belong to a DIFFERENT CASE.
  // ===================================================================
  it('HOLE/inbox: a callback with no caseId satisfies another CASE\'s wait in the same org', async () => {
    const t = await seedTenant('inb2-a');
    const projectB = await seedProject(t.orgId, 'inb2-b');
    const caseB = await caseCoreService.createCase({
      projectId: projectB,
      organizationId: t.orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: t.owner,
    });

    const sharedKey = `same-org-key-${randomUUID()}`;

    async function seedWaitOnCase(caseId: string, key: string): Promise<string> {
      const runId = `adv-run-${randomUUID()}`;
      await seedV8Run(runId, t.orgId);
      const proposal = await proposalApprovalService.createActionProposal({
        caseId,
        runId,
        nodeRunId: `adv-noderun-${randomUUID()}`,
        payloadDigest: `sha256:${'c'.repeat(64)}`,
        policySnapshotRef: 'policy-ref',
        previewRef: 'preview-ref',
        effectClass: 'SAFE_ADDITIVE',
        proposerType: 'SYSTEM',
        createdByActorId: t.owner,
        idempotencyKey: `adv-idem-${randomUUID()}`,
      });
      const wait = await waitSubscriptionService.createWait(
        {
          caseId,
          actionProposalId: proposal.actionProposalId,
          waitType: 'EXTERNAL_CALLBACK',
          correlationKey: key,
        },
        t.owner
      );
      return wait.waitId;
    }

    const waitOnCaseA = await seedWaitOnCase(t.caseId, sharedKey);
    const waitOnCaseB = await seedWaitOnCase(caseB.caseId, sharedKey);

    const source = `adv-channel2-${randomUUID()}`;
    const secret = 'adversarial-channel-secret-2';
    eventInboxService.registerInboxChannel({ source, secret, principal: 'adv-principal-2' });

    const payload = { intendedFor: 'caseB' };
    const signature = eventInboxService.computeInboxSignature(secret, payload);

    // Delivery intended for case B — but caseId is optional and omitted.
    const result = await eventInboxService.receiveExternalEvent({
      eventId: `adv-evt-${randomUUID()}`,
      source,
      eventType: 'callback.completed',
      organizationId: t.orgId,
      correlationKey: sharedKey,
      payload,
      signature,
    });

    expect(result.outcome).toBe('applied');
    // CONFIRMED HOLE: case A's wait is satisfied by case B's callback.
    expect((result as { waitId: string }).waitId).toBe(waitOnCaseA);

    const statuses = await control.query<{ wait_id: string; status: string }>(
      `SELECT wait_id, status FROM case_workspace_waits WHERE wait_id = ANY($1::text[])`,
      [[waitOnCaseA, waitOnCaseB]]
    );
    const byId = Object.fromEntries(statuses.rows.map((r) => [r.wait_id, r.status]));
    expect(byId[waitOnCaseA]).toBe('SATISFIED');
    expect(byId[waitOnCaseB]).toBe('ACTIVE');
  }, 90_000);

  // ===================================================================
  // ATTACK 12 — INBOX: forged signature / unknown channel / duplicate.
  // (refutation battery — these are expected to hold)
  // ===================================================================
  it('ATTACK/inbox: forged signature, unknown channel and replay all fail closed', async () => {
    const t = await seedTenant('inb3');
    const runId = `adv-run-${randomUUID()}`;
    await seedV8Run(runId, t.orgId);
    const proposal = await proposalApprovalService.createActionProposal({
      caseId: t.caseId,
      runId,
      nodeRunId: `adv-noderun-${randomUUID()}`,
      payloadDigest: `sha256:${'d'.repeat(64)}`,
      policySnapshotRef: 'policy-ref',
      previewRef: 'preview-ref',
      effectClass: 'SAFE_ADDITIVE',
      proposerType: 'SYSTEM',
      createdByActorId: t.owner,
      idempotencyKey: `adv-idem-${randomUUID()}`,
    });
    const key = `inb3-key-${randomUUID()}`;
    const wait = await waitSubscriptionService.createWait(
      {
        caseId: t.caseId,
        actionProposalId: proposal.actionProposalId,
        waitType: 'EXTERNAL_CALLBACK',
        correlationKey: key,
      },
      t.owner
    );

    const source = `adv-channel3-${randomUUID()}`;
    const secret = 'adversarial-channel-secret-3';
    eventInboxService.registerInboxChannel({ source, secret, principal: 'adv-principal-3' });
    const payload = { v: 1 };
    const goodSig = eventInboxService.computeInboxSignature(secret, payload);

    const forged = await eventInboxService.receiveExternalEvent({
      eventId: `adv-evt-${randomUUID()}`,
      source,
      eventType: 'callback.completed',
      organizationId: t.orgId,
      correlationKey: key,
      payload,
      signature: 'f'.repeat(64),
    });
    expect(forged.outcome).toBe('unauthenticated');
    expect((forged as { rejectionCode: string }).rejectionCode).toBe('SIGNATURE_INVALID');

    const unknownChannel = await eventInboxService.receiveExternalEvent({
      eventId: `adv-evt-${randomUUID()}`,
      source: `never-registered-${randomUUID()}`,
      eventType: 'callback.completed',
      organizationId: t.orgId,
      correlationKey: key,
      payload,
      signature: goodSig,
    });
    expect(unknownChannel.outcome).toBe('unauthenticated');
    expect((unknownChannel as { rejectionCode: string }).rejectionCode).toBe('CHANNEL_UNKNOWN');

    // Nothing durable was written by either rejected delivery.
    const afterUnauth = await control.query(
      `SELECT count(*)::int AS n FROM case_workspace_event_inbox WHERE organization_id=$1`,
      [t.orgId]
    );
    expect(afterUnauth.rows[0].n).toBe(0);

    // Genuine delivery, then an exact replay.
    const eventId = `adv-evt-${randomUUID()}`;
    const first = await eventInboxService.receiveExternalEvent({
      eventId,
      source,
      eventType: 'callback.completed',
      organizationId: t.orgId,
      correlationKey: key,
      payload,
      signature: goodSig,
    });
    expect(first.outcome).toBe('applied');

    const replay = await eventInboxService.receiveExternalEvent({
      eventId,
      source,
      eventType: 'callback.completed',
      organizationId: t.orgId,
      correlationKey: key,
      payload,
      signature: goodSig,
    });
    expect(replay.outcome).toBe('duplicate');

    const satisfiedEvents = await control.query(
      `SELECT count(*)::int AS n FROM case_workspace_event_outbox
        WHERE aggregate_id=$1 AND event_type='wait.satisfied'`,
      [wait.waitId]
    );
    expect(satisfiedEvents.rows[0].n).toBe(1);
  }, 90_000);

  // ===================================================================
  // ATTACK 13 — AUTONOMY: absence of policy must be a REFUSAL, never
  // consent (refutation battery).
  // ===================================================================
  it('ATTACK/autonomy: unknown Case, foreign Case and unconfigured ceiling all fail closed', async () => {
    const victim = await seedTenant('aut4-victim');
    const attackerOrg = await seedOrg('aut4-attacker');

    const action = { intent: 'EXECUTE' as const, effectClass: 'SAFE_ADDITIVE' };

    const ghost = await autonomyPolicyService.evaluateAutonomy({
      organizationId: attackerOrg,
      caseId: `case-${randomUUID()}`,
      action,
    });
    const foreign = await autonomyPolicyService.evaluateAutonomy({
      organizationId: attackerOrg,
      caseId: victim.caseId,
      action,
    });

    expect(ghost.allowed).toBe(false);
    expect(foreign.allowed).toBe(false);
    // Enumeration-safe: identical shape for "no such Case" and "someone else's Case".
    expect(foreign.denialCode).toBe(ghost.denialCode);
    expect(foreign.denialReasons).toEqual(ghost.denialReasons);
    expect(ghost.effectiveAutonomy).toBe('ASK_EACH_ACTION');

    // A Case with no org ceiling row configured collapses to the strictest level.
    const noCeiling = await autonomyPolicyService.resolveEffectiveAutonomy(
      victim.orgId,
      victim.caseId
    );
    expect(noCeiling.organizationCeilingSource).toBe('UNCONFIGURED_FAIL_CLOSED_DEFAULT');
    expect(noCeiling.effectiveAutonomy).toBe('ASK_EACH_ACTION');

    // A mislabelled "advice" that actually commits materially must escalate.
    const mislabelled = autonomyPolicyService.classifyActionClass({
      intent: 'ADVISE',
      materialCommitment: true,
    });
    expect(mislabelled.actionClass).toBe('A3');
  }, 60_000);
});
