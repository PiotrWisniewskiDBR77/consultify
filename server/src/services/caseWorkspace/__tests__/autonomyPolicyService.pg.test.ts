/**
 * Case Workspace — autonomy classification + policy enforcement (EPIC E6),
 * proved against a REAL PostgreSQL.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as every sibling `*.pg.test.ts` here: `NODE_ENV=test` ALONE
 * is a trap — `Database.ts` hands back an in-memory MOCK unless
 * `RUN_DB_TESTS === '1'` AND `MOCK_DB === 'false'`, and every write silently
 * becomes a no-op. This file gates on both, probes that the schema it needs is
 * actually present, and SKIPS LOUDLY rather than passing vacuously.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run src/services/caseWorkspace/__tests__/autonomyPolicyService.pg.test.ts
 *
 * The classification block at the top is a PURE predicate over its input and
 * is deliberately NOT gated — it needs no database, and skipping it when a
 * database is missing would hide the one part of this file that can be
 * checked anywhere.
 *
 * ===========================================================================
 * WHAT IS ACTUALLY BEING PROVED (and what a green result here does NOT mean)
 * ===========================================================================
 *   - the A0-A4 classifier escalates on every unknown, and never de-escalates;
 *   - A0/A1 pass with no human control; A3/A4 never do;
 *   - the ORGANIZATION CEILING overrides a looser Case policy — proved
 *     DIFFERENTIALLY (same Case, same action, ceiling is the only variable),
 *     because a denial that would also have happened without the ceiling
 *     proves nothing about the ceiling;
 *   - an unconfigured policy DENIES rather than defaulting to consent;
 *   - a refusal writes a durable `policy.denied` outbox row.
 *
 * It does NOT prove that any UI, route or Teresa path calls this gate. Only
 * proposalApprovalService.transitionProposalToExecuting is wired to it today
 * (see that service's own pg test); every other caller is still ungated.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as autonomyPolicyService from '../autonomyPolicyService.js';
import type {
  ActionDescriptor,
  AutonomyPolicy,
  ExplicitControlEvidence,
} from '../autonomyPolicyService.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';

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
          AND column_name IN ('case_id', 'organization_id', 'autonomy_policy')`
    );
    const orgPolicy = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_ai_policy'
          AND column_name IN ('organization_id', 'policy')`
    );
    const outbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'event_type', 'organization_id', 'redacted_summary')`
    );
    const ok =
      Number(caseCore.rows[0]?.present ?? 0) === 3 &&
      Number(orgPolicy.rows[0]?.present ?? 0) === 2 &&
      Number(outbox.rows[0]?.present ?? 0) === 4;
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn(
        '[autonomyPolicyService.pg.test] SKIPPING LOUDLY: reachable database is missing case_core / organization_ai_policy / case_workspace_event_outbox columns.'
      );
    }
    return ok;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[autonomyPolicyService.pg.test] SKIPPING LOUDLY: database unreachable:', err);
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// PURE — the A0-A4 predicate. No database, therefore not gated.
// ---------------------------------------------------------------------------

describe('classifyActionClass — the A0-A4 predicate (08 §3.2)', () => {
  const classOf = (action: ActionDescriptor) =>
    autonomyPolicyService.classifyActionClass(action).actionClass;

  it('labels the three benign intents A0 / A1 / A4', () => {
    expect(classOf({ intent: 'ADVISE' })).toBe('A0');
    expect(classOf({ intent: 'PREPARE' })).toBe('A1');
    expect(classOf({ intent: 'MONITOR' })).toBe('A4');
  });

  it('labels a safe, reversible, internal execution A2', () => {
    expect(classOf({ intent: 'EXECUTE', effectClass: 'SAFE_ADDITIVE' })).toBe('A2');
    expect(
      classOf({
        intent: 'EXECUTE',
        effectClass: 'SAFE_UPDATE',
        reversibility: 'REVERSIBLE',
        dataClass: 'INTERNAL',
      })
    ).toBe('A2');
  });

  it('labels every material effect class A3', () => {
    expect(classOf({ intent: 'EXECUTE', effectClass: 'SENSITIVE_UPDATE' })).toBe('A3');
    expect(classOf({ intent: 'EXECUTE', effectClass: 'DESTRUCTIVE' })).toBe('A3');
    expect(classOf({ intent: 'EXECUTE', effectClass: 'GOVERNANCE_TRANSITION' })).toBe('A3');
  });

  it('escalates a nominally safe execution on any material signal', () => {
    expect(classOf({ intent: 'EXECUTE', effectClass: 'SAFE_UPDATE', externalEffect: true })).toBe(
      'A3'
    );
    expect(
      classOf({ intent: 'EXECUTE', effectClass: 'SAFE_UPDATE', materialCommitment: true })
    ).toBe('A3');
    expect(classOf({ intent: 'EXECUTE', effectClass: 'SAFE_ADDITIVE', formalDecision: true })).toBe(
      'A3'
    );
  });

  it('escalates on UNKNOWN or unrecognized risk attributes — never de-escalates', () => {
    expect(
      classOf({ intent: 'EXECUTE', effectClass: 'SAFE_UPDATE', reversibility: 'UNKNOWN' })
    ).toBe('A3');
    expect(
      classOf({ intent: 'EXECUTE', effectClass: 'SAFE_UPDATE', reversibility: 'IRREVERSIBLE' })
    ).toBe('A3');
    expect(
      classOf({ intent: 'EXECUTE', effectClass: 'SAFE_UPDATE', reversibility: 'mostly, probably' })
    ).toBe('A3');
    expect(classOf({ intent: 'EXECUTE', effectClass: 'SAFE_UPDATE', dataClass: 'RESTRICTED' })).toBe(
      'A3'
    );
    expect(classOf({ intent: 'EXECUTE', effectClass: 'SAFE_UPDATE', dataClass: 'UNKNOWN' })).toBe(
      'A3'
    );
  });

  it('treats an unclassifiable execution as material, not as safe', () => {
    // No effect class at all, and an effect class outside the registry
    // vocabulary: both are "the fact was not established", which under a
    // fail-closed rule is A3, not A2.
    expect(classOf({ intent: 'EXECUTE' })).toBe('A3');
    expect(classOf({ intent: 'EXECUTE', effectClass: 'PROBABLY_FINE' })).toBe('A3');
    expect(classOf({ intent: 'WHATEVER' as ActionDescriptor['intent'] })).toBe('A3');
  });

  it('refuses to let a mislabelled intent buy a cheaper class', () => {
    // "It is only advice" / "it is only a draft" while carrying an external or
    // material effect is the exact bypass a comment-based classification
    // cannot stop.
    expect(classOf({ intent: 'ADVISE', externalEffect: true })).toBe('A3');
    expect(classOf({ intent: 'PREPARE', materialCommitment: true })).toBe('A3');
    expect(classOf({ intent: 'PREPARE', effectClass: 'DESTRUCTIVE' })).toBe('A3');
    expect(classOf({ intent: 'MONITOR', formalDecision: true })).toBe('A3');
  });

  it('states the required control per class, and closes the plan-policy path at ASK_EACH_ACTION', () => {
    expect(autonomyPolicyService.requiredControlFor('A0', 'ASK_EACH_ACTION').requiredControl).toBe(
      'NONE'
    );
    expect(autonomyPolicyService.requiredControlFor('A1', 'ASK_EACH_ACTION').requiredControl).toBe(
      'NONE'
    );
    expect(
      autonomyPolicyService.requiredControlFor('A2', 'EXECUTE_APPROVED_PLAN').planPolicyPathOpen
    ).toBe(true);
    expect(
      autonomyPolicyService.requiredControlFor('A2', 'ASK_EACH_ACTION').planPolicyPathOpen
    ).toBe(false);
    for (const level of ['ASK_EACH_ACTION', 'ASK_MATERIAL_ACTIONS', 'EXECUTE_APPROVED_PLAN'] as const) {
      expect(autonomyPolicyService.requiredControlFor('A3', level).requiredControl).toBe(
        'EXPLICIT_CONTROL_WITH_STEP_UP'
      );
      expect(autonomyPolicyService.requiredControlFor('A4', level).requiredControl).toBe(
        'EXPLICIT_CONTROL_WITH_STEP_UP'
      );
    }
  });
});

// ---------------------------------------------------------------------------
// REAL DATABASE — resolution and enforcement
// ---------------------------------------------------------------------------

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('autonomyPolicyService — resolution + enforcement against a real PostgreSQL (E6)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixtures — every test owns its org/project/case and tears them down itself.
  // -------------------------------------------------------------------------

  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
    const suffix = randomUUID();
    const orgId = `cw-autonomy-org-${label}-${suffix}`;
    const projectId = `cw-autonomy-project-${label}-${suffix}`;
    const userId = `cw-autonomy-user-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Autonomy policy test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Autonomy policy test project (${label})`]
    );
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`cw-autonomy-member-${suffix}`, orgId, userId]
    );
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: userId,
    });
    return { orgId, projectId, caseId: created.caseId, actorId: userId };
  }

  /** Writes the org ceiling under the namespaced key the service reads. */
  async function setOrgCeiling(orgId: string, ceiling: unknown): Promise<void> {
    await control.query(
      `INSERT INTO organization_ai_policy (organization_id, policy)
         VALUES ($1, $2::jsonb)
       ON CONFLICT (organization_id) DO UPDATE SET policy = EXCLUDED.policy`,
      [orgId, JSON.stringify({ caseWorkspace: { maxAutonomyPolicy: ceiling } })]
    );
  }

  async function teardown(orgId: string, projectId: string, actorId: string): Promise<void> {
    await control
      .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_ai_policy WHERE organization_id = $1`, [orgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM case_core WHERE project_id = $1`, [projectId]).catch(() => undefined);
    await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM users WHERE id = $1`, [actorId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
  }

  const A3_ACTION: ActionDescriptor = { intent: 'EXECUTE', effectClass: 'SENSITIVE_UPDATE' };
  const A2_ACTION: ActionDescriptor = { intent: 'EXECUTE', effectClass: 'SAFE_ADDITIVE' };

  function validControl(overrides: Partial<ExplicitControlEvidence> = {}): ExplicitControlEvidence {
    return {
      channel: 'BUTTON',
      approverActorId: 'approver-actor',
      authenticationAssurance: 'MFA',
      boundProposalVersion: 3,
      boundPayloadDigest: 'sha256:bound-payload',
      ...overrides,
    };
  }

  const BINDING = {
    proposalVersion: 3,
    payloadDigest: 'sha256:bound-payload',
    proposerActorId: 'proposer-actor',
  };

  // -------------------------------------------------------------------------
  // 1. A0/A1 pass with no human control at all; A3/A4 never do.
  // -------------------------------------------------------------------------
  it('lets A0 and A1 through with no explicit approval, and refuses A3 and A4 without one', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('a0a1-vs-a3a4');
    try {
      for (const intent of ['ADVISE', 'PREPARE'] as const) {
        const evaluation = await autonomyPolicyService.evaluateAutonomy({
          organizationId: orgId,
          caseId,
          action: { intent },
        });
        expect(evaluation.actionClass).toBe(intent === 'ADVISE' ? 'A0' : 'A1');
        expect(evaluation.requiredControl).toBe('NONE');
        expect(evaluation.allowed).toBe(true);
        expect(evaluation.denialCode).toBeNull();
      }

      for (const action of [A3_ACTION, { intent: 'MONITOR' } as ActionDescriptor]) {
        const evaluation = await autonomyPolicyService.evaluateAutonomy({
          organizationId: orgId,
          caseId,
          action,
        });
        expect(['A3', 'A4']).toContain(evaluation.actionClass);
        expect(evaluation.requiredControl).toBe('EXPLICIT_CONTROL_WITH_STEP_UP');
        expect(evaluation.allowed).toBe(false);
        expect(evaluation.denialCode).toBe('autonomy_explicit_control_required');
        await expect(
          autonomyPolicyService.requireAutonomyFor({ organizationId: orgId, caseId, action })
        ).rejects.toMatchObject({
          name: 'AutonomyPolicyDeniedError',
          code: 'autonomy_explicit_control_required',
        });
      }
    } finally {
      await teardown(orgId, projectId, actorId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 2. What makes a control count: channel, binding, self-approval, step-up,
  //    expiry. Each negative is the SAME action as the positive, one field
  //    changed — so the assertion is about that field and nothing else.
  // -------------------------------------------------------------------------
  it('accepts only an explicit, bound, non-self, step-up-assured, unexpired control for A3', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('control-quality');
    try {
      const base = {
        organizationId: orgId,
        caseId,
        action: A3_ACTION,
        binding: BINDING,
      };

      const ok = await autonomyPolicyService.requireAutonomyFor({
        ...base,
        control: validControl(),
      });
      expect(ok.allowed).toBe(true);
      expect(ok.actionClass).toBe('A3');

      const cases: Array<[Partial<ExplicitControlEvidence>, string]> = [
        [{ channel: 'CONVERSATIONAL' }, 'autonomy_control_channel_not_explicit'],
        [{ channel: 'POLICY' }, 'autonomy_control_channel_not_explicit'],
        [{ approverActorId: 'proposer-actor' }, 'autonomy_control_self_approved'],
        [{ boundProposalVersion: 2 }, 'autonomy_control_not_bound_to_action'],
        [{ boundPayloadDigest: 'sha256:other-payload' }, 'autonomy_control_not_bound_to_action'],
        [{ authenticationAssurance: 'NONE' }, 'autonomy_step_up_assurance_not_configured'],
        [{ authenticationAssurance: '' }, 'autonomy_step_up_assurance_not_configured'],
        [{ expired: true }, 'autonomy_control_expired'],
      ];
      for (const [override, expectedCode] of cases) {
        const evaluation = await autonomyPolicyService.evaluateAutonomy({
          ...base,
          control: validControl(override),
        });
        expect({ override, code: evaluation.denialCode, allowed: evaluation.allowed }).toEqual({
          override,
          code: expectedCode,
          allowed: false,
        });
      }
    } finally {
      await teardown(orgId, projectId, actorId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 3. THE CEILING TEST. Same Case, same A2 action, same published plan
  //    policy, no explicit control. The ONLY variable is the organization
  //    ceiling. If the ceiling did nothing, both runs would be allowed.
  // -------------------------------------------------------------------------
  it('lets the organization ceiling override a looser Case policy (same case, same action, ceiling is the only variable)', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('org-ceiling');
    try {
      // The Case is deliberately set to the LOOSEST level a user may pick.
      await caseCoreService.updateAutonomyPolicy(caseId, 'EXECUTE_APPROVED_PLAN', {
        actorUserId: actorId,
      });
      const caseRow = await control.query<{ autonomy_policy: string }>(
        `SELECT autonomy_policy FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRow.rows[0]?.autonomy_policy).toBe('EXECUTE_APPROVED_PLAN');

      const request = {
        organizationId: orgId,
        caseId,
        action: A2_ACTION,
        planPolicy: { casePlanVersionId: 'plan-v1', published: true },
        control: null,
      };

      // (a) org ceiling AT the Case's level -> the plan-policy path is open.
      await setOrgCeiling(orgId, 'EXECUTE_APPROVED_PLAN');
      const permissive = await autonomyPolicyService.evaluateAutonomy(request);
      expect(permissive.organizationCeilingSource).toBe('ORG_POLICY_ROW');
      expect(permissive.casePolicy).toBe('EXECUTE_APPROVED_PLAN');
      expect(permissive.effectiveAutonomy).toBe('EXECUTE_APPROVED_PLAN');
      expect(permissive.actionClass).toBe('A2');
      expect(permissive.allowed).toBe(true);

      // (b) org ceiling LOWERED. The Case row is untouched and still says
      //     EXECUTE_APPROVED_PLAN — the ceiling must win anyway.
      await setOrgCeiling(orgId, 'ASK_EACH_ACTION');
      const capped = await autonomyPolicyService.evaluateAutonomy(request);
      expect(capped.casePolicy).toBe('EXECUTE_APPROVED_PLAN');
      expect(capped.organizationCeiling).toBe('ASK_EACH_ACTION');
      expect(capped.effectiveAutonomy).toBe('ASK_EACH_ACTION');
      expect(capped.allowed).toBe(false);
      expect(capped.denialCode).toBe('autonomy_plan_policy_path_closed');

      // The Case row was genuinely not modified by the ceiling.
      const caseRowAfter = await control.query<{ autonomy_policy: string }>(
        `SELECT autonomy_policy FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRowAfter.rows[0]?.autonomy_policy).toBe('EXECUTE_APPROVED_PLAN');

      // (c) the middle ceiling caps a looser Case to exactly the ceiling.
      await setOrgCeiling(orgId, 'ASK_MATERIAL_ACTIONS');
      const middle = await autonomyPolicyService.resolveEffectiveAutonomy(orgId, caseId, 'A2');
      expect(middle.effectiveAutonomy).toBe('ASK_MATERIAL_ACTIONS');
      expect(middle.reasons).toContain(
        'organization_ceiling_capped_case_policy:EXECUTE_APPROVED_PLAN->ASK_MATERIAL_ACTIONS'
      );

      // (d) a Case STRICTER than the ceiling keeps its own stricter level —
      //     the ceiling is a maximum, not an assignment.
      await caseCoreService.updateAutonomyPolicy(caseId, 'ASK_EACH_ACTION', {
        actorUserId: actorId,
      });
      const stricterCase = await autonomyPolicyService.resolveEffectiveAutonomy(orgId, caseId);
      expect(stricterCase.organizationCeiling).toBe('ASK_MATERIAL_ACTIONS');
      expect(stricterCase.effectiveAutonomy).toBe('ASK_EACH_ACTION');
    } finally {
      await teardown(orgId, projectId, actorId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 4. FAIL-CLOSED. No configured policy is not a permissive policy.
  // -------------------------------------------------------------------------
  it('denies when no organization ceiling is configured, and when the stored ceiling is malformed', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('fail-closed');
    try {
      const request = {
        organizationId: orgId,
        caseId,
        action: A2_ACTION,
        planPolicy: { casePlanVersionId: 'plan-v1', published: true },
        control: null,
      };

      // (a) no organization_ai_policy row at all.
      const noRow = await control.query(
        `SELECT 1 FROM organization_ai_policy WHERE organization_id = $1`,
        [orgId]
      );
      expect(noRow.rowCount).toBe(0);

      const unconfigured = await autonomyPolicyService.evaluateAutonomy(request);
      expect(unconfigured.organizationCeilingSource).toBe('UNCONFIGURED_FAIL_CLOSED_DEFAULT');
      expect(unconfigured.organizationCeiling).toBe('ASK_EACH_ACTION');
      expect(unconfigured.effectiveAutonomy).toBe('ASK_EACH_ACTION');
      expect(unconfigured.allowed).toBe(false);
      expect(unconfigured.denialCode).toBe('autonomy_plan_policy_path_closed');
      expect(unconfigured.denialReasons).toContain('organization_ceiling_not_configured');

      // (b) a row exists but the value is not one of the three levels. A
      //     misconfiguration must narrow, never widen.
      for (const junk of ['FULL_AUTO', '', null, 42, { nested: true }]) {
        await setOrgCeiling(orgId, junk);
        const malformed = await autonomyPolicyService.evaluateAutonomy(request);
        expect({ junk, source: malformed.organizationCeilingSource, allowed: malformed.allowed }).toEqual(
          { junk, source: 'UNCONFIGURED_FAIL_CLOSED_DEFAULT', allowed: false }
        );
      }

      // (c) an unresolvable Case (wrong tenant / nonexistent) denies A2 and A3
      //     with autonomy_policy_unresolved. A0 stays allowed: it is defined as
      //     producing no canonical mutation, so there is nothing to authorize.
      await setOrgCeiling(orgId, 'EXECUTE_APPROVED_PLAN');
      for (const badCaseId of [`no-such-case-${randomUUID()}`, '']) {
        const unresolved = await autonomyPolicyService.evaluateAutonomy({
          organizationId: orgId,
          caseId: badCaseId,
          action: A2_ACTION,
          control: validControl(),
          binding: BINDING,
        });
        expect(unresolved.policyResolved).toBe(false);
        expect(unresolved.effectiveAutonomy).toBe('ASK_EACH_ACTION');
        expect(unresolved.allowed).toBe(false);
        expect(unresolved.denialCode).toBe('autonomy_policy_unresolved');
      }

      // A real Case id, but asked for under a DIFFERENT organization: same
      // shape as "no such case" (SEC-009 enumeration safety).
      const foreign = await autonomyPolicyService.evaluateAutonomy({
        organizationId: `${orgId}-other`,
        caseId,
        action: A3_ACTION,
        control: validControl(),
        binding: BINDING,
      });
      expect(foreign.policyResolved).toBe(false);
      expect(foreign.denialCode).toBe('autonomy_policy_unresolved');

      const stillAdvice = await autonomyPolicyService.evaluateAutonomy({
        organizationId: orgId,
        caseId: `no-such-case-${randomUUID()}`,
        action: { intent: 'ADVISE' },
      });
      expect(stillAdvice.allowed).toBe(true);
      expect(stillAdvice.actionClass).toBe('A0');
    } finally {
      await teardown(orgId, projectId, actorId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 5. The refusal is durable. Read back through a SEPARATE pool, after the
  //    caller's transaction has committed — a returned value proves nothing
  //    about what survived COMMIT.
  // -------------------------------------------------------------------------
  it('writes a durable policy.denied outbox row carrying the class, the level and the ceiling source', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('policy-denied-event');
    try {
      const evaluation = await autonomyPolicyService.evaluateAutonomy({
        organizationId: orgId,
        caseId,
        action: A3_ACTION,
        control: { ...validControl(), channel: 'CONVERSATIONAL' },
        binding: BINDING,
      });
      expect(evaluation.allowed).toBe(false);

      const aggregateId = `cw-autonomy-agg-${randomUUID()}`;
      await withPgTransaction(async (client) => {
        await autonomyPolicyService.publishPolicyDeniedEvent(client, {
          evaluation,
          organizationId: orgId,
          projectId,
          aggregateType: 'ACTION_PROPOSAL',
          aggregateId,
          aggregateVersion: 7,
          caseId,
          actorUserId: actorId,
        });
      });

      const rows = await control.query<{
        event_type: string;
        organization_id: string;
        aggregate_id: string;
        case_id: string | null;
        actor_user_id: string;
        redacted_summary: Record<string, unknown>;
      }>(`SELECT * FROM case_workspace_event_outbox WHERE aggregate_id = $1`, [aggregateId]);
      expect(rows.rowCount).toBe(1);
      const row = rows.rows[0]!;
      expect(row.event_type).toBe('policy.denied');
      expect(row.organization_id).toBe(orgId);
      expect(row.case_id).toBe(caseId);
      expect(row.actor_user_id).toBe(actorId);
      expect(row.redacted_summary).toMatchObject({
        denialCode: 'autonomy_control_channel_not_explicit',
        actionClass: 'A3',
        requiredControl: 'EXPLICIT_CONTROL_WITH_STEP_UP',
        effectiveAutonomy: 'ASK_EACH_ACTION',
        organizationCeilingSource: 'UNCONFIGURED_FAIL_CLOSED_DEFAULT',
        policyResolved: true,
      });
    } finally {
      await teardown(orgId, projectId, actorId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 6. The resolver reads the LIVE row on the caller's own transaction, so the
  //    level enforced is the level true at mutation time — not a level cached
  //    from before the transaction opened.
  // -------------------------------------------------------------------------
  it('resolves the policy on the caller transaction, seeing that transaction\'s own uncommitted ceiling', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('tx-read');
    try {
      await setOrgCeiling(orgId, 'EXECUTE_APPROVED_PLAN');

      const seenInside = await withPgTransaction(async (client) => {
        await client.query(
          `UPDATE organization_ai_policy SET policy = ? WHERE organization_id = ?`,
          [JSON.stringify({ caseWorkspace: { maxAutonomyPolicy: 'ASK_EACH_ACTION' } }), orgId]
        );
        const inside = await autonomyPolicyService.resolveEffectiveAutonomy(orgId, caseId, 'A2', {
          client,
        });
        return inside.effectiveAutonomy;
      });
      expect(seenInside).toBe('ASK_EACH_ACTION');

      const afterCommit = await autonomyPolicyService.resolveEffectiveAutonomy(orgId, caseId);
      expect(afterCommit.organizationCeiling).toBe('ASK_EACH_ACTION');
    } finally {
      await teardown(orgId, projectId, actorId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // 7. A caller-supplied ceiling is honoured and labelled as such (used by
  //    callers that already resolved the org policy) — and it is still only a
  //    MAXIMUM, never a grant.
  // -------------------------------------------------------------------------
  it('honours a caller-supplied ceiling as a maximum and labels its source', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('supplied-ceiling');
    try {
      await setOrgCeiling(orgId, 'EXECUTE_APPROVED_PLAN');
      const supplied: AutonomyPolicy = 'ASK_EACH_ACTION';
      const resolution = await autonomyPolicyService.resolveEffectiveAutonomy(orgId, caseId, 'A3', {
        organizationCeiling: supplied,
      });
      expect(resolution.organizationCeilingSource).toBe('CALLER_SUPPLIED');
      expect(resolution.organizationCeiling).toBe('ASK_EACH_ACTION');
      expect(resolution.effectiveAutonomy).toBe('ASK_EACH_ACTION');
      expect(resolution.requirement?.requiredControl).toBe('EXPLICIT_CONTROL_WITH_STEP_UP');
    } finally {
      await teardown(orgId, projectId, actorId);
    }
  }, 60_000);
});
